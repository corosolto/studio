"""Step 5 — skin weights: heat weights, voxel fallback, then part rules; export the GLB.

  Blender -b --python tools/blender/character_rig/rig_weights.py -- \
      --config characters/<id>/rig.json --work <dir>

1. Automatic (heat) weights on the cleaned mesh.  A voxel remesh of the body gets heat
   weights too; vertices that heat left unweighted (loose islands such as eyes or pouches)
   take the proxy's weights by nearest-surface transfer, and every vertex does when heat
   failed for a limb bone or left more than ``weights.heatFailShare`` of the main shell bare.
2. Part rules (``rig_part`` face attribute): each part allows a bone set — torso, vest and
   backpack never get arm bones, legs only their own chain plus Hips, arms only their own
   chain plus Spine and the clavicle.  Hands are 100% on their ``Hand``; the head is 100% on
   ``Head`` above ``Head`` + ``weights.headRigidAbove`` × height; extras use ``rigid`` (100%
   on one bone) or ``bones`` (allowed set) from the config.
3. Continuity: a bone allowed on one side of a part boundary and forbidden on the other fades
   to zero towards the boundary over ``weights.rampLength`` × height of surface distance, so
   the rules never create a weight step.
4. Smoothing only inside a part, tapering to nothing at ``weights.smoothRadius`` × height
   from ``weights.smoothJoints`` (shoulders and knees by default), never across parts, never
   on part-boundary or rigid vertices.  Elbows are left out by default: on capitao-caveira
   smoothing there raised the worst clip stretch at the back of the elbow (walk 2.88× ->
   4.28×); list them to opt in.
4b. Linear hinge blends (``weights.linearBlends``, wrists by default): the ForeArm+Hand share
   is re-split by position along the forearm axis, smoothstep over ±halfWidth × height
   around the wrist.  Heat alone switches ForeArm->Hand within one edge ring; on
   capitao-caveira that ring stretched 1.64× in the client hand gate (rig-maos-check) versus
   1.32× with the blend and ``parts.handPartOffset`` 0.04.
4c. Opt-in band models (``weights.waistBand``, ``weights.neckBand``, ``weights.flankBand``):
   weights in a band around the hips, the neck or the belly flanks as a function of height
   and angle around the torso axis.
5. At most 4 influences per vertex, normalised.

Writes ``weights.blend``, ``weights.json`` and ``blender-rig.glb`` (Blender's own skin; run
tools/characters/rig-assemble.mjs next for the meshy-28 GLB).
"""
from __future__ import annotations

import heapq
import json
import sys
from collections import defaultdict
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

DEFAULTS = {
    "heatFailShare": 0.02,
    "voxelSize": 0.006,        # x height
    "headRigidAbove": 0.02,    # x height above the Head joint
    "rampLength": 0.06,        # x height
    "smoothRadius": 0.06,      # x height
    "smoothIterations": 3,
    "smoothJoints": ["LeftArm", "RightArm", "LeftLeg", "RightLeg"],
    # [[parent, child, halfWidth x height], ...]: wrists by default (see step 4b).
    "linearBlends": [["LeftForeArm", "LeftHand", 0.035], ["RightForeArm", "RightHand", 0.035]],
    # Groin: within groinBand x height of the crotch and between the thighs, the thigh share
    # moves to Hips (fully on the midline), so spreading the legs does not tear the crotch.
    "groinBand": 0.05,
    # Weight gradient limit: along any edge no bone weight changes faster than the edge
    # length / (gradientRamp x height); 0 disables.
    "gradientRamp": 0.025,
    "gradientIterations": 200,
    # Torso height limits for the thighs and the clavicles (step 2); null leaves heat alone.
    "thighCeiling": None,      # fraction of UpLeg -> Hips height, e.g. 1.0 = the Hips joint
    "clavicleFloor": None,     # fraction of Spine02 -> Spine01 height, e.g. 0.0 = Spine02
    # Band weight models (step 4c'), x height or null: the waist band reaches this far below
    # the hip joints, the neck band this far above Head; each fades out over half of it.  The
    # flank band covers Hips -> Spine01 on the torso sides and fades out over half of it;
    # flankFade (x height or null) lengthens its lower fade, which ends at the Hips joint.
    "waistBand": None,
    "neckBand": None,
    "flankBand": None,
    "flankFade": None,
    # Spine-chain locality (step 2), x height or null: margin beyond the parent and child joints.
    "chainLocality": None,
    # Side exclusivity (step 2), x height or null: no opposite-side bones past this margin.
    "sideExclusive": None,
}

ARM_BONES = {"LeftArm", "LeftForeArm", "LeftHand", "RightArm", "RightForeArm", "RightHand"}


def part_rules(cfg):
    allowed = {
        "torso": {"Hips", "Spine02", "Spine01", "Spine", "LeftShoulder", "RightShoulder", "neck", "LeftUpLeg", "RightUpLeg"},
        "head": {"Spine", "neck", "Head"},
    }
    rigid = {}
    for side in ("Left", "Right"):
        s = side[0]
        allowed[f"arm_{s}"] = {"Spine", f"{side}Shoulder", f"{side}Arm", f"{side}ForeArm", f"{side}Hand"}
        allowed[f"hand_{s}"] = {f"{side}Hand"}
        rigid[f"hand_{s}"] = f"{side}Hand"
        allowed[f"leg_{s}"] = {"Hips", f"{side}UpLeg", f"{side}Leg", f"{side}Foot", f"{side}ToeBase"}
    for extra in cfg.get("extras", []):
        if extra.get("rigid"):
            allowed[extra["name"]] = {extra["rigid"]}
            rigid[extra["name"]] = extra["rigid"]
        elif extra.get("kind") in CLOTH_BONES:
            allowed[extra["name"]] = set(CLOTH_BONES[extra["kind"]])
        elif extra.get("remove"):
            allowed[extra["name"]] = set()  # deleted in the parts step; no face is left
        else:
            allowed[extra["name"]] = set(extra["bones"])
    return allowed, rigid


# Bones a hanging-cloth extra may use (``kind`` in the config); weights are procedural.
CLOTH_BONES = {
    "skirt": ["Hips", "Spine02", "Spine01", "Spine", "LeftUpLeg", "RightUpLeg"],
    "cape": ["Hips", "Spine02", "Spine01", "Spine", "neck", "LeftUpLeg", "RightUpLeg"],
}
# Share of a hanging cloth that follows the thighs at knee height: a skirt or a coat front
# goes with the legs, a cape behind them only partly.
CLOTH_LEG_SHARE = {"skirt": 0.8, "cape": 0.45}
# Opt-in front panel of a cloth extra (``frontPanel`` on the extra, ``true`` or an object
# overriding these): below the hip joints and in front of them the cloth follows both
# thighs, split over ±spread x the hip half-width instead of ±1, with ``share`` on the legs
# at knee height, like a skirt with less gain.
FRONT_PANEL = {"share": 0.25, "spread": 3.0}


def smoothstep(t):
    t = np.clip(t, 0.0, 1.0)
    return t * t * (3 - 2 * t)


def cloth_weights(points, kind, joints, bidx, front_panel=None):
    """Procedural weights for hanging cloth (coat skirts, skirts, capes).

    Above the hips the cloth follows the spine chain by height (piecewise linear between
    Hips, Spine02, Spine01, Spine and, for capes, neck).  Below the hip joints it fades into
    the thighs down to the knees, split left/right by x, with ``CLOTH_LEG_SHARE`` of the
    weight on the legs at knee height and the rest on Hips, so walking opens the cloth
    instead of tearing it between Hips and a leg.  ``front_panel`` (see ``FRONT_PANEL``)
    blends the front of the cloth, from the hip joints forward over one hip half-width,
    into a both-thighs split with its own leg share.
    """
    chain = ["Hips", "Spine02", "Spine01", "Spine"] + (["neck"] if kind == "cape" else [])
    zs = np.array([joints[b].z for b in chain])
    W = np.zeros((len(points), len(bidx)))
    z, x = points[:, 2], points[:, 0]
    for i in range(len(chain) - 1):
        lo, hi = zs[i], zs[i + 1]
        inside = (z >= lo) & (z < hi) if i < len(chain) - 2 else (z >= lo)
        t = np.clip((z[inside] - lo) / max(hi - lo, 1e-6), 0, 1)
        W[inside, bidx[chain[i]]] = 1 - t
        W[inside, bidx[chain[i + 1]]] += t
    below = z < zs[0]
    hip_z = 0.5 * (joints["LeftUpLeg"].z + joints["RightUpLeg"].z)
    knee_z = 0.5 * (joints["LeftLeg"].z + joints["RightLeg"].z)
    leg_x = 0.5 * (abs(joints["LeftUpLeg"].x) + abs(joints["RightUpLeg"].x))
    drop = smoothstep((hip_z - z[below]) / max(hip_z - knee_z, 1e-6))
    legs = CLOTH_LEG_SHARE[kind] * drop
    left = smoothstep((x[below] + leg_x) / (2 * leg_x))
    if front_panel:
        fp = {**FRONT_PANEL, **(front_panel if isinstance(front_panel, dict) else {})}
        hip_y = 0.5 * (joints["LeftUpLeg"].y + joints["RightUpLeg"].y)
        f = smoothstep((hip_y - points[below, 1]) / leg_x)
        spread = fp["spread"] * leg_x
        legs = (1 - f) * legs + f * fp["share"] * drop
        left = (1 - f) * left + f * smoothstep((x[below] + spread) / (2 * spread))
    W[below, bidx["LeftUpLeg"]] = legs * left
    W[below, bidx["RightUpLeg"]] = legs * (1 - left)
    W[below, bidx["Hips"]] = 1 - legs
    return W


def band_model(co, joints, bidx, kind, margin, fade_below=None):
    """Weights of the waist, neck or flank band model and their blend factor per vertex.

    waist: from ``margin`` below the hip joints up to Spine02.  The thighs take the sides
    (|sin| of the angle around the vertical axis through Hips, so a belly or a coat front
    and the small of the back stay on the spine) and fade out by the Hips joint; the rest
    goes from Hips to Spine02 by height.
    neck: from Spine up to ``margin`` above Head.  The clavicles take the sides and fade out
    by the neck joint; the rest goes Spine -> neck -> Head by height.
    flank: from Hips up to Spine01, on the sides of the torso only (|sin| of the angle
    around the vertical through Hips from 0.5 to 0.9, so the belly front and the back keep
    their weights): only the spine chain by height (Hips -> Spine02 -> Spine01), no
    clavicle and no thigh, where heat put both on one flank of a big belly.
    The blend factor is 1 inside the band and smoothsteps to 0 over margin / 2 beyond it
    (below it over ``fade_below`` when given).
    """
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    W = np.zeros((len(co), len(bidx)))
    side_of = 1.0
    if kind == "flank":
        lo, mid, hi = joints["Hips"].z, joints["Spine02"].z, joints["Spine01"].z
        side = np.abs(x) / np.maximum(np.hypot(x, y - joints["Hips"].y), 1e-6)
        side_of = smoothstep((side - 0.5) / 0.4)
        up = smoothstep((z - lo) / max(mid - lo, 1e-6))
        top = smoothstep((z - mid) / max(hi - mid, 1e-6))
        W[:, bidx["Hips"]] = 1 - up
        W[:, bidx["Spine02"]] = up * (1 - top)
        W[:, bidx["Spine01"]] = up * top
    elif kind == "waist":
        axis_y = joints["Hips"].y
        up_z = 0.5 * (joints["LeftUpLeg"].z + joints["RightUpLeg"].z)
        lo, hips_z, hi = up_z - margin, joints["Hips"].z, joints["Spine02"].z
        side = np.abs(x) / np.maximum(np.hypot(x, y - axis_y), 1e-6)
        limb = smoothstep((side - 0.3) / 0.5) * smoothstep((hips_z - z) / max(hips_z - lo, 1e-6))
        up = smoothstep((z - hips_z) / max(hi - hips_z, 1e-6))
        W[:, bidx["LeftUpLeg"]] = np.where(x >= 0, limb, 0.0)
        W[:, bidx["RightUpLeg"]] = np.where(x < 0, limb, 0.0)
        W[:, bidx["Hips"]] = (1 - limb) * (1 - up)
        W[:, bidx["Spine02"]] = (1 - limb) * up
    else:
        axis_y = joints["neck"].y
        lo, neck_z, head_z = joints["Spine"].z, joints["neck"].z, joints["Head"].z
        hi = head_z + margin
        side = np.abs(x) / np.maximum(np.hypot(x, y - axis_y), 1e-6)
        limb = smoothstep((side - 0.3) / 0.5) * (1 - smoothstep((z - lo) / max(neck_z - lo, 1e-6)))
        lower = smoothstep((z - lo) / max(neck_z - lo, 1e-6))
        upper = smoothstep((z - neck_z) / max(head_z - neck_z, 1e-6))
        W[:, bidx["LeftShoulder"]] = np.where(x >= 0, limb, 0.0)
        W[:, bidx["RightShoulder"]] = np.where(x < 0, limb, 0.0)
        W[:, bidx["Spine"]] = (1 - limb) * (1 - lower)
        W[:, bidx["neck"]] = (1 - limb) * lower * (1 - upper)
        W[:, bidx["Head"]] = (1 - limb) * lower * upper
    fade = 0.5 * margin
    below = fade_below or fade
    alpha = smoothstep((z - (lo - below)) / below) * smoothstep(((hi + fade) - z) / fade) * side_of
    return W, alpha


def vertex_groups_matrix(obj, bones):
    index = {name: i for i, name in enumerate(bones)}
    group_bone = {g.index: index.get(g.name) for g in obj.vertex_groups}
    W = np.zeros((len(obj.data.vertices), len(bones)))
    for v in obj.data.vertices:
        for g in v.groups:
            b = group_bone.get(g.group)
            if b is not None:
                W[v.index, b] = g.weight
    return W


def auto_weights(obj, arm):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")


def adjacency(me):
    nbrs = defaultdict(list)
    for e in me.edges:
        a, b = e.vertices
        length = (me.vertices[a].co - me.vertices[b].co).length
        nbrs[a].append((b, length))
        nbrs[b].append((a, length))
    return nbrs


def distance_to(nbrs, sources, n, limit):
    dist = np.full(n, np.inf)
    heap = [(0.0, s) for s in sources]
    for s in sources:
        dist[s] = 0.0
    heapq.heapify(heap)
    while heap:
        d, v = heapq.heappop(heap)
        if d > dist[v] or d > limit:
            continue
        for u, length in nbrs[v]:
            nd = d + length
            if nd < dist[u]:
                dist[u] = nd
                heapq.heappush(heap, (nd, u))
    return dist


def main():
    args = C.parse_args()
    cfg = args.cfg
    P = {**DEFAULTS, **cfg.get("weights", {})}
    C.open_blend(args.work / "armature.blend")
    body = C.body_object()
    arm = bpy.data.objects["Armature"]
    me = body.data
    labels, face_parts = C.read_face_parts(body, cfg)
    joints = {k: Vector(v) for k, v in json.loads((args.work / "joints.json").read_text())["joints"].items()}
    co, _ = C.mesh_arrays(body)
    H = float(co[:, 2].max())
    n = len(co)
    deform = [b.name for b in arm.data.bones if b.use_deform]
    bidx = {name: i for i, name in enumerate(deform)}

    # ---------------------------------------------------------------- 1. heat + voxel proxy
    for g in list(body.vertex_groups):
        body.vertex_groups.remove(g)
    for m in list(body.modifiers):
        body.modifiers.remove(m)
    body.parent = None
    auto_weights(body, arm)
    W_heat = vertex_groups_matrix(body, deform)
    unweighted = W_heat.sum(axis=1) <= 1e-6
    empty_bones = [name for name in deform if W_heat[:, bidx[name]].max() <= 1e-6]

    proxy = body.copy()
    proxy.data = body.data.copy()
    proxy.name = "VoxelProxy"
    bpy.context.scene.collection.objects.link(proxy)
    for g in list(proxy.vertex_groups):
        proxy.vertex_groups.remove(g)
    for m in list(proxy.modifiers):
        proxy.modifiers.remove(m)
    proxy.parent = None
    remesh = proxy.modifiers.new("voxel", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = P["voxelSize"] * H
    remesh.adaptivity = 0.0
    bpy.context.view_layer.objects.active = proxy
    bpy.ops.object.select_all(action="DESELECT")
    proxy.select_set(True)
    bpy.ops.object.modifier_apply(modifier="voxel")
    auto_weights(proxy, arm)
    W_proxy_v = vertex_groups_matrix(proxy, deform)
    proxy_bvh = BVHTree.FromObject(proxy, bpy.context.evaluated_depsgraph_get())
    W_proxy = np.zeros_like(W_heat)
    pme = proxy.data
    for v in range(n):
        loc, _normal, face, _dist = proxy_bvh.find_nearest(Vector(co[v]))
        if face is None:
            continue
        verts = list(pme.polygons[face].vertices)
        d = np.array([(pme.vertices[i].co - loc).length for i in verts]) + 1e-6
        w = (1 / d) / (1 / d).sum()
        W_proxy[v] = (W_proxy_v[verts] * w[:, None]).sum(axis=0)
    # Heat failed when it left many vertices of the main shell bare or a limb bone without
    # any skin.  Small loose islands (eyes, pouches) are expected to miss heat and take the
    # proxy weights below.
    face_island = C.connected_face_islands(body)
    main_island = np.bincount(face_island).argmax()
    on_main = np.zeros(n, dtype=bool)
    for i, p in enumerate(me.polygons):
        if face_island[i] == main_island:
            on_main[list(p.vertices)] = True
    limb_bones = [b for b in deform if b.startswith(("Left", "Right")) and not b.endswith(("Shoulder", "ToeBase"))]
    heat_failed = unweighted[on_main].mean() > P["heatFailShare"] or any(b in empty_bones for b in limb_bones)
    if heat_failed:
        W = W_proxy.copy()
        method = "voxel proxy (heat failed)"
    else:
        W = W_heat.copy()
        W[unweighted] = W_proxy[unweighted]
        method = "heat" if not unweighted.any() else "heat + voxel proxy for unweighted vertices"
    bpy.data.objects.remove(proxy, do_unlink=True)

    # ---------------------------------------------------------------- 2. part rules
    allowed_by_part, rigid_by_part = part_rules(cfg)
    vparts = [set() for _ in range(n)]
    for i, p in enumerate(me.polygons):
        for v in p.vertices:
            vparts[v].add(labels[face_parts[i]])
    allowed = np.zeros((n, len(deform)), dtype=bool)
    rigid = [None] * n
    head_rigid_z = joints["Head"].z + P["headRigidAbove"] * H
    for v in range(n):
        names = set()
        for part in vparts[v]:
            names |= allowed_by_part[part]
        for name in names:
            allowed[v, bidx[name]] = True
        rigid_bones = {rigid_by_part.get(part) for part in vparts[v]}
        if len(rigid_bones) == 1 and None not in rigid_bones:
            rigid[v] = rigid_bones.pop()
        elif vparts[v] == {"head"} and co[v, 2] > head_rigid_z:
            rigid[v] = "Head"
    # Torso height limits (opt-in): heat lets a thigh reach up a belly or a coat front and a
    # clavicle reach down a chest or a bib, where hip flexion or a shrug then drags skin far
    # from the joint.  With thighCeiling, vertices on no leg part carry the thighs no higher
    # than that fraction of UpLeg -> Hips; with clavicleFloor, vertices on no arm or hand
    # part carry the clavicles no lower than that fraction of Spine02 -> Spine01.  The
    # boundary fades of step 3 ramp them out.  Off by default: switched on for all 37
    # characters of the 2026-11-09 set they fixed the chest of coelho-pascoa-shopping and
    # corisco but made five passing rigs fail at the hips or shoulders.
    if P["thighCeiling"] is not None:
        up_z = 0.5 * (joints["LeftUpLeg"].z + joints["RightUpLeg"].z)
        above = co[:, 2] > up_z + P["thighCeiling"] * (joints["Hips"].z - up_z)
        off_legs = np.array([not any(part.startswith("leg_") for part in vparts[v]) for v in range(n)])
        for bone in ("LeftUpLeg", "RightUpLeg"):
            allowed[off_legs & above, bidx[bone]] = False
    if P["clavicleFloor"] is not None:
        below = co[:, 2] < joints["Spine02"].z + P["clavicleFloor"] * (joints["Spine01"].z - joints["Spine02"].z)
        off_arms = np.array([not any(part.startswith(("arm_", "hand_")) for part in vparts[v]) for v in range(n)])
        for bone in ("LeftShoulder", "RightShoulder"):
            allowed[off_arms & below, bidx[bone]] = False
    # Spine-chain locality (opt-in, chainLocality x height): on vertices of no limb part, a
    # chain bone (Hips, Spine02, Spine01, Spine, neck) is allowed only between its parent
    # joint and its child joint (where a linear blend along the chain would give it any
    # weight), widened by the margin.  Heat on a coat or a big body can leave Hips weight
    # 25 cm above the Hips joint, which a crouch then folds open.
    if P["chainLocality"] is not None:
        chain = ["Hips", "Spine02", "Spine01", "Spine", "neck", "Head"]
        zs = [joints[b].z for b in chain]
        margin = P["chainLocality"] * H
        off_limbs = np.array([not any(p.startswith(("arm_", "hand_", "leg_")) for p in vparts[v]) for v in range(n)])
        for i, bone in enumerate(chain[:-1]):
            lo = zs[i - 1] - margin if i > 0 else -np.inf
            hi = zs[i + 1] + margin
            allowed[off_limbs & ((co[:, 2] < lo) | (co[:, 2] > hi)), bidx[bone]] = False
    # Side exclusivity (opt-in, sideExclusive x height): a vertex more than the margin to
    # one side of the midline carries no bone of the other side.  Heat through a collar,
    # a cape or a fused chest can put RightShoulder weight on the left armpit.
    if P["sideExclusive"] is not None:
        margin = P["sideExclusive"] * H
        for prefix, other_side in (("Right", co[:, 0] > margin), ("Left", co[:, 0] < -margin)):
            for name in deform:
                if name.startswith(prefix):
                    allowed[other_side, bidx[name]] = False
    W = np.where(allowed, W, 0.0)
    nearest_fill = 0
    bone_heads = {name: joints[name.split(".")[0]] for name in deform}
    for v in range(n):
        if rigid[v] is None and W[v].sum() <= 1e-6:
            Wp = np.where(allowed[v], W_proxy[v], 0.0)
            if Wp.sum() > 1e-6:
                W[v] = Wp
            else:
                cands = [name for name in deform if allowed[v, bidx[name]]]
                best = min(cands, key=lambda b: (bone_heads[b] - Vector(co[v])).length)
                W[v, bidx[best]] = 1.0
                nearest_fill += 1

    # ---------------------------------------------------------------- 3. boundary fades
    nbrs = adjacency(me)
    ramp = P["rampLength"] * H
    faded = 0
    for b, name in enumerate(deform):
        forbidden = np.nonzero(~allowed[:, b])[0]
        if not len(forbidden) or not allowed[:, b].any():
            continue
        dist = distance_to(nbrs, forbidden.tolist(), n, ramp)
        near = (dist < ramp) & allowed[:, b] & (W[:, b] > 0)
        t = np.clip(dist[near] / ramp, 0, 1)
        W[near, b] *= t * t * (3 - 2 * t)
        faded += int(near.sum())

    # ---------------------------------------------------------------- 4. local smoothing
    # Inside one part only, tapering to nothing at smoothRadius from the joint, and never on
    # part-boundary vertices: they anchor the fades of step 3, so smoothing cannot reopen a
    # step there.
    vf = defaultdict(lambda: defaultdict(int))
    for i, p in enumerate(me.polygons):
        for v in p.vertices:
            vf[v][labels[face_parts[i]]] += 1
    primary = [max(vf[v], key=vf[v].get) if vf[v] else None for v in range(n)]
    sums = W.sum(axis=1, keepdims=True)
    W = np.divide(W, sums, out=np.zeros_like(W), where=sums > 1e-9)
    radius = P["smoothRadius"] * H
    centres = np.array([joints[name][:] for name in P["smoothJoints"]])
    nearest = np.min(np.linalg.norm(co[:, None, :] - centres[None], axis=2), axis=1)
    alpha = np.where(nearest < radius, 0.5 * (1 - nearest / radius), 0.0)
    zone = np.array([alpha[v] > 0 and rigid[v] is None and len(vparts[v]) == 1 for v in range(n)])
    smoothed = int(zone.sum())
    for _ in range(int(P["smoothIterations"])):
        W_new = W.copy()
        for v in np.nonzero(zone)[0]:
            same = [u for u, _ in nbrs[v] if primary[u] == primary[v]]
            if same:
                W_new[v] = (1 - alpha[v]) * W[v] + alpha[v] * W[same].mean(axis=0)
        W = np.where(allowed, W_new, 0.0)

    # Linear hinge blends: for each [parent, child, halfWidth] the parent+child share of a
    # vertex is re-split by its position along the parent->child axis, smoothstep from
    # child joint - halfWidth x height (all parent) to + halfWidth (all child).  Heat makes
    # the wrist switch from ForeArm to Hand within one edge ring; this spreads it.
    for parent_bone, child_bone, half in P["linearBlends"]:
        pb, cb = bidx[parent_bone], bidx[child_bone]
        axis = joints[child_bone] - joints[parent_bone]
        axis.normalize()
        origin = np.array(joints[child_bone][:])
        proj = (co - origin) @ np.array(axis[:])
        t = np.clip((proj + half * H) / (2 * half * H), 0, 1)
        share = W[:, pb] + W[:, cb]
        mask = (share > 1e-6) & np.array([rigid[v] is None for v in range(n)]) & allowed[:, pb] & allowed[:, cb]
        s = t[mask] * t[mask] * (3 - 2 * t[mask])
        W[mask, cb] = share[mask] * s
        W[mask, pb] = share[mask] * (1 - s)

    # ---------------------------------------------------------------- 4c. hanging cloth
    for v in np.nonzero([r is not None for r in rigid])[0]:
        W[v] = 0.0
        W[v, bidx[rigid[v]]] = 1.0
    landmarks = json.loads((args.work / "parts.json").read_text())["landmarks"]
    crotch_z = float(landmarks["crotchZ"])
    rigid_mask = np.array([r is not None for r in rigid])
    # Vertices on a seam between two cloth extras (a coat cut into an upper and a lower
    # extra) take the mean of their extras' cloth weights; left on heat they tore the seam
    # (vlad death 4.05x: seam Hips 0.61 + RightUpLeg 0.28 next to cloth Hips 0.96).
    cloth = {e["name"]: e for e in cfg.get("extras", []) if e.get("kind") in CLOTH_BONES}
    on_cloth = np.array([bool(vparts[v]) and vparts[v] <= cloth.keys() for v in range(n)]) & ~rigid_mask
    cloth_vertices = {}
    if on_cloth.any():
        Wc = np.zeros((n, len(bidx)))
        share = np.array([len(vparts[v]) for v in range(n)], dtype=float)
        for name, extra in cloth.items():
            mask = on_cloth & np.array([name in vparts[v] for v in range(n)])
            Wc[mask] += cloth_weights(co[mask], extra["kind"], joints, bidx, extra.get("frontPanel")) / share[mask, None]
            cloth_vertices[name] = int((mask & (share == 1)).sum())
        W[on_cloth] = Wc[on_cloth]
        cloth_vertices["seam"] = int((on_cloth & (share > 1)).sum())

    # ---------------------------------------------------------------- 4c'. band models
    # Opt-in replacements for heat where crouch and death tear a junction whose heat
    # weights depend on what the surface happens to touch (a coat front over the thighs,
    # a tail base, dreads over the nape).  Inside the band the weights are a smooth
    # function of height and of the angle around the torso axis only; they fade back to the
    # rule weights over half the margin beyond each end.
    band_vertices = {}
    eligible = ~rigid_mask & np.array([not any(p.startswith(("arm_", "hand_")) for p in vparts[v]) for v in range(n)])
    for kind, margin in (("waist", P["waistBand"]), ("neck", P["neckBand"]), ("flank", P["flankBand"])):
        if not margin:
            continue
        fade_below = P["flankFade"] * H if kind == "flank" and P["flankFade"] else None
        Wm, alpha = band_model(co, joints, bidx, kind, margin * H, fade_below)
        Wm = np.where(allowed, Wm, 0.0)
        sums = Wm.sum(axis=1)
        alpha = np.where(eligible & (sums > 1e-6), alpha, 0.0)
        if kind in ("waist", "flank"):
            alpha = np.where([("head" in vparts[v]) for v in range(n)], 0.0, alpha)
        if kind in ("neck", "flank"):
            alpha = np.where([any(p.startswith("leg_") for p in vparts[v]) for v in range(n)], 0.0, alpha)
        Wm = np.divide(Wm, sums[:, None], out=np.zeros_like(Wm), where=sums[:, None] > 1e-6)
        rows = W.sum(axis=1, keepdims=True)
        W = np.divide(W, rows, out=np.zeros_like(W), where=rows > 1e-9)
        W = alpha[:, None] * Wm + (1 - alpha[:, None]) * W
        band_vertices[kind] = int((alpha > 0.5).sum())

    # ---------------------------------------------------------------- 4d. groin
    band = P["groinBand"] * H
    groin = 0
    if band > 0:
        leg_x = 0.5 * (abs(joints["LeftUpLeg"].x) + abs(joints["RightUpLeg"].x))
        m = smoothstep(1 - np.abs(co[:, 0]) / leg_x) * smoothstep(1 - np.abs(co[:, 2] - crotch_z) / band)
        m = np.where(rigid_mask | ~allowed[:, bidx["Hips"]], 0.0, m)
        for side in ("LeftUpLeg", "RightUpLeg"):
            moved = W[:, bidx[side]] * m
            W[:, bidx[side]] -= moved
            W[:, bidx["Hips"]] += moved
        groin = int((m > 0.05).sum())

    # ---------------------------------------------------------------- 4e. gradient limit
    # Hard weight steps between neighbouring vertices (heat on layered cloth, proxy transfer
    # across fused voxels, binary weights on small islands) tear edges open whatever the
    # thresholds elsewhere.  Every edge whose weight change exceeds its length over
    # gradientRamp x height is relaxed towards its neighbour, rigid vertices held fixed.
    limit_iterations, limit_left = 0, 0
    if P["gradientRamp"] > 0:
        E = np.array([e.vertices[:] for e in me.edges], dtype=np.int64)
        L = np.linalg.norm(co[E[:, 0]] - co[E[:, 1]], axis=1)
        g = L / (P["gradientRamp"] * H)
        free = (~rigid_mask).astype(float)
        sums = W.sum(axis=1, keepdims=True)
        W = np.divide(W, sums, out=np.zeros_like(W), where=sums > 1e-9)
        for limit_iterations in range(1, int(P["gradientIterations"]) + 1):
            d = W[E[:, 0]] - W[E[:, 1]]
            mag = np.abs(d).max(axis=1)
            over = mag > g * 1.001
            if not over.any():
                break
            a, b = E[over, 0], E[over, 1]
            fa, fb = free[a], free[b]
            share = fa + fb
            keep = share > 0
            corr = d[over] * (1 - g[over] / mag[over])[:, None]
            delta = np.zeros_like(W)
            count = np.zeros(n)
            np.add.at(delta, a[keep], -corr[keep] * (fa[keep] / share[keep])[:, None])
            np.add.at(delta, b[keep], corr[keep] * (fb[keep] / share[keep])[:, None])
            np.add.at(count, a[keep], 1)
            np.add.at(count, b[keep], 1)
            W = np.where(allowed, np.clip(W + delta / np.maximum(count, 1)[:, None], 0, None), 0.0)
            sums = W.sum(axis=1, keepdims=True)
            W = np.divide(W, sums, out=np.zeros_like(W), where=sums > 1e-9)
        # Counted on the final weights, after the last correction of the loop.
        limit_left = int((np.abs(W[E[:, 0]] - W[E[:, 1]]).max(axis=1) > g * 1.001).sum())

    # ---------------------------------------------------------------- 5. rigid, limit, normalise
    for v in range(n):
        if rigid[v] is not None:
            W[v] = 0.0
            W[v, bidx[rigid[v]]] = 1.0
            continue
        row = W[v]
        if (row > 0).sum() > 4:
            row[np.argsort(row)[:-4]] = 0.0
        total = row.sum()
        if total <= 1e-9:
            cands = [name for name in deform if allowed[v, bidx[name]]]
            best = min(cands, key=lambda b: (bone_heads[b] - Vector(co[v])).length)
            row[:] = 0.0
            row[bidx[best]] = 1.0
            nearest_fill += 1
        else:
            row /= total
        W[v] = row

    for g in list(body.vertex_groups):
        body.vertex_groups.remove(g)
    groups = {name: body.vertex_groups.new(name=name) for name in deform}
    for b, name in enumerate(deform):
        for v in np.nonzero(W[:, b] > 0)[0]:
            groups[name].add([int(v)], float(W[v, b]), "REPLACE")

    # ---------------------------------------------------------------- report + export
    arm_cols = [bidx[b] for b in ARM_BONES if b in bidx]
    no_arm_parts = {"torso"} | {e["name"] for e in cfg.get("extras", []) if not (set(e.get("bones", [])) | {e.get("rigid")}) & ARM_BONES}
    only_no_arm = np.array([bool(vparts[v]) and vparts[v] <= no_arm_parts for v in range(n)])
    hand_checks = {}
    for side in ("L", "R"):
        only_hand = np.array([vparts[v] == {f"hand_{side}"} for v in range(n)])
        col = bidx[f"{'Left' if side == 'L' else 'Right'}Hand"]
        hand_checks[side] = {"vertices": int(only_hand.sum()), "minHandWeight": C.r(W[only_hand, col].min() if only_hand.any() else 1.0)}
    influences = (W > 0).sum(axis=1)
    report = {
        "step": "weights", "method": method, "params": P,
        "heat": {"unweightedVertices": int(unweighted.sum()), "emptyBones": empty_bones},
        "nearestBoneFill": nearest_fill, "fadedWeights": faded, "smoothedVertices": smoothed,
        "rigidVertices": int(sum(r is not None for r in rigid)),
        "clothVertices": cloth_vertices, "bandVertices": band_vertices, "groinVertices": groin,
        "gradientLimit": {"iterations": limit_iterations, "edgesStillOver": limit_left},
        "armWeightOnNoArmParts": C.r(W[only_no_arm][:, arm_cols].max() if only_no_arm.any() else 0.0, 6),
        "hands": hand_checks,
        "influences": {str(k): int((influences == k).sum()) for k in range(1, 5)},
        "maxInfluences": int(influences.max()),
        "weightSumError": C.r(np.abs(W.sum(axis=1) - 1).max(), 8),
        "boneVertexCounts": {name: int((W[:, b] > 0).sum()) for b, name in enumerate(deform)},
    }
    C.write_json(args.work / "weights.json", report)
    C.save_blend(args.work / "weights.blend")
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(args.work / "blender-rig.glb"), export_format="GLB", use_selection=False,
        export_skins=True, export_animations=False, export_morph=False, export_yup=True,
        export_apply=False, export_materials="EXPORT", export_image_format="AUTO",
        export_def_bones=False, export_cameras=False, export_lights=False)
    print(f"WEIGHTS method={method} unweighted={int(unweighted.sum())} emptyBones={empty_bones} "
          f"armOnTorso={report['armWeightOnNoArmParts']} hands={hand_checks} maxInf={report['maxInfluences']}")


C.run_main(main)
