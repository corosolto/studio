"""Step 2 — tag every face with a body part.

  Blender -b --python tools/blender/character_rig/rig_parts.py -- \
      --config characters/<id>/rig.json --work <dir>

Body parts come from landmarks of the 1 cm front silhouette (crotch, T-pose arm band,
armpits, wrists, neck): legs below the crotch, arms outside the shoulder line, hands past
the wrist, head above the neck, torso for the rest.  When ``parts.skinColors`` is set the
wrist moves to where the skin-coloured texels of the distal arm start (bare hands).
Configured ``extras`` (backpack, vest, antenna, ears, tail, holster...) are then carved out
with AND-combined selectors over position, texture colour and loose islands:

  {"name": "backpack", "select": {"from": ["torso"], "box": {"min": [null, 0.1, 1.0],
   "max": [null, null, 1.5]}, "colors": ["#202020"], "tolerance": 0.1,
   "islandMaxFaces": 400}, "bones": ["Spine01", "Spine"], "rigid": "Spine"}

The part index is stored in the ``rig_part`` face attribute (order: torso, head, arm_L,
arm_R, hand_L, hand_R, leg_L, leg_R, then extras).  Writes ``parts.blend``, ``parts.json``
and flat-colour ``parts-front/back/side.png`` renders for review.
"""
from __future__ import annotations

import math
import sys
from collections import defaultdict, deque
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

SEED_MAX_DISTANCE = 0.05  # m: a grow seed must lie this close to the surface


def face_neighbours(me):
    """Face index -> faces sharing an edge with it."""
    by_edge = defaultdict(list)
    for p in me.polygons:
        for key in p.edge_keys:
            by_edge[key].append(p.index)
    nbrs = [[] for _ in me.polygons]
    for faces in by_edge.values():
        for f in faces:
            nbrs[f].extend(g for g in faces if g != f)
    return nbrs


def flood(nbrs, start, passes):
    """Faces reachable from ``start`` over edge neighbours where ``passes(f, g)``."""
    sel = np.zeros(len(nbrs), dtype=bool)
    sel[list(start)] = True
    queue = deque(start)
    while queue:
        f = queue.popleft()
        for g in nbrs[f]:
            if not sel[g] and passes(f, g):
                sel[g] = True
                queue.append(g)
    return sel


def grow_mask(body, grow, allowed, nbrs, centers, name):
    """Faces of one connected region grown from seed points.

    From the faces nearest to ``seeds`` the region spreads over shared edges while the
    other selectors allow the face and the fold between the two faces stays under
    ``crease`` degrees (default 40), so a cape's outer sheet stops at its hem and at the
    seams where it is fused to boots or a coat.  ``thickness`` (m, default 0) then adds the
    rest of a thin sheet: every face connected to the region through faces lying within
    ``thickness`` of it (the hem fold and the inner side), whatever the fold.
    """
    me = body.data
    bvh = C.bvh_for_faces(body)
    seeds = []
    for point in grow["seeds"]:
        loc, _normal, face, dist = bvh.find_nearest(Vector(point))
        if face is None or dist > SEED_MAX_DISTANCE:
            raise RuntimeError(f"extra {name}: grow seed {point} is not within {SEED_MAX_DISTANCE} m of the surface "
                               f"(nearest surface point {C.r(loc, 3) if loc else None})")
        if not allowed[face]:
            raise RuntimeError(f"extra {name}: grow seed {point} lands on face {face}, which its other selectors exclude")
        seeds.append(face)
    normals = np.empty(len(me.polygons) * 3)
    me.polygons.foreach_get("normal", normals)
    normals = normals.reshape(-1, 3)
    cos_crease = math.cos(math.radians(float(grow.get("crease", 40))))
    sel = flood(nbrs, seeds, lambda f, g: allowed[g] and normals[f] @ normals[g] >= cos_crease)
    thickness = float(grow.get("thickness", 0.0))
    if thickness > 0:
        sheet = C.bvh_for_faces(body, sel)
        near = np.array([sheet.find_nearest(Vector(c))[3] <= thickness for c in centers])
        sel = flood(nbrs, np.nonzero(sel)[0].tolist(), lambda f, g: allowed[g] and near[g])
    return sel
import common as C  # noqa: E402


def box_mask(centers, box):
    mask = np.ones(len(centers), dtype=bool)
    for k in range(3):
        lo = box.get("min", [None] * 3)[k]
        hi = box.get("max", [None] * 3)[k]
        if lo is not None:
            mask &= centers[:, k] >= lo
        if hi is not None:
            mask &= centers[:, k] <= hi
    return mask


def main():
    args = C.parse_args()
    cfg = args.cfg
    C.open_blend(args.work / "clean.blend")
    body = C.body_object()
    me = body.data
    labels = C.part_labels(cfg)
    index = {name: i for i, name in enumerate(labels)}
    _, centers = C.mesh_arrays(body)
    colors = C.face_colors(body)
    islands = C.connected_face_islands(body)
    island_size = np.bincount(islands)

    lm = C.landmarks(body)
    H = lm["height"]
    pcfg = cfg.get("parts", {})
    # The arm region reaches this far inside the armpit line above the armpit (the deltoid);
    # default is a quarter of the arm thickness, clamped to 1..5 cm.
    inset_cfg = pcfg.get("armShoulderInset")
    part = np.full(len(centers), index["torso"], dtype=np.int32)
    x, z = centers[:, 0], centers[:, 2]
    arm_lo, arm_hi = lm["armBand"]
    head = z > lm["neckZ"]
    part[head] = index["head"]
    legs = z < lm["crotchZ"] - 0.005
    part[legs & (x >= 0)] = index["leg_L"]
    part[legs & (x < 0)] = index["leg_R"]
    wrists = {}
    for side, arm in lm["arms"].items():
        s = arm["sign"]
        xs = x * s
        inset = float(inset_cfg) if inset_cfg is not None else min(max(0.25 * arm["armThickness"], 0.01), 0.05)
        # Arm faces are outside the armpit line and no lower than the armpit (a hip pouch or a
        # tail can reach past the armpit x); only far outside the torso (drooping hands) may
        # they hang lower.
        far_out = xs > arm["armpitX"] + 0.5 * (arm["tip"] - arm["armpitX"])
        is_arm = (z > lm["crotchZ"]) & (z < lm["neckZ"]) & (
            ((xs > arm["armpitX"] + 0.01) & ((z > arm["armpitZ"] - 0.03 * H) | far_out))
            | ((xs > arm["armpitX"] - inset) & (z > arm["armpitZ"] - 0.01) & (z < arm_hi + 0.06 * H)))
        wrist = arm["wristX"]
        wrist_source = "cross-section minimum"
        if pcfg.get("skinColors"):
            skin = np.zeros(len(centers), dtype=bool)
            for hexcolor in pcfg["skinColors"]:
                skin |= np.linalg.norm(colors - C.from_hex(hexcolor), axis=1) <= float(pcfg.get("skinTolerance", 0.12))
            distal = is_arm & skin & (xs > arm["armpitX"] + 0.5 * (arm["tip"] - arm["armpitX"]))
            if distal.sum() >= 10:
                wrist = float(np.percentile(xs[distal], 3))
                wrist_source = "skin colour"
        if pcfg.get("wristX") is not None:
            wrist = abs(float(pcfg["wristX"]))
            wrist_source = "config wristX"
        # The wrist is where the Hand joint goes; the rigid hand part starts
        # ``handPartOffset`` x height past it (default 0.03) so the forearm->hand blend of
        # rig_weights.py has room.
        hand_start = wrist + float(pcfg.get("handPartOffset", 0.03)) * H
        wrists[side] = {"x": C.r(wrist * s), "source": wrist_source, "handPartStartX": C.r(hand_start * s)}
        part[is_arm & ~(xs > hand_start)] = index[f"arm_{side}"]
        part[is_arm & (xs > hand_start)] = index[f"hand_{side}"]

    extras_report = []
    nbrs = None
    for extra in cfg.get("extras", []):
        sel = extra.get("select", {})
        mask = np.ones(len(centers), dtype=bool)
        if "from" in sel:
            mask &= np.isin(part, [index[name] for name in sel["from"]])
        if "box" in sel:
            mask &= box_mask(centers, sel["box"])
        if "colors" in sel:
            near = np.zeros(len(centers), dtype=bool)
            for hexcolor in sel["colors"]:
                near |= np.linalg.norm(colors - C.from_hex(hexcolor), axis=1) <= float(sel.get("tolerance", 0.1))
            mask &= near
        if "islandMaxFaces" in sel:
            mask &= island_size[islands] <= int(sel["islandMaxFaces"])
        if "grow" in sel:
            nbrs = nbrs or face_neighbours(me)
            mask = grow_mask(body, sel["grow"], mask, nbrs, centers, extra["name"])
        part[mask] = index[extra["name"]]
        extras_report.append({"name": extra["name"], "faces": int(mask.sum())})

    # Cuts (``cut: [parts]``): the extra's faces that share a vertex with those parts are
    # deleted, so a cape or coat hem fused to a boot or a trouser leg hangs free instead of
    # tearing between the cloth weights and the leg weights.  Geometry is only removed,
    # never moved or welded: the cut opens one face ring, it does not hide a seam.
    # Removals (``remove: true``): every face of the extra is deleted and the opening it
    # leaves in the rest of the mesh is capped, for geometry the concept does not have
    # (coelho-pascoa-shopping: a rod with a ball fused to the tail, pointing straight back).
    drop = np.zeros(len(part), dtype=bool)
    capped = set()
    for extra, entry in zip(cfg.get("extras", []), extras_report):
        own = np.nonzero(part == index[extra["name"]])[0]
        if extra.get("remove"):
            drop[own] = True
            entry["removedFaces"] = len(own)
            capped.add(extra["name"])
            continue
        if not extra.get("cut"):
            continue
        fused = np.zeros(len(me.vertices), dtype=bool)
        for i in np.nonzero(np.isin(part, [index[name] for name in extra["cut"]]))[0]:
            fused[list(me.polygons[i].vertices)] = True
        hit = [i for i in own if fused[list(me.polygons[i].vertices)].any()]
        drop[hit] = True
        entry["cutFaces"] = len(hit)

    attr = C.face_part_layer(me, create=True)
    attr.data.foreach_set("value", part)
    me.update()
    if drop.any():
        removed = np.isin(part, [index[name] for name in capped])
        bm = C.bm_from(body)
        rim = {v for i in np.nonzero(removed)[0] for v in bm.faces[i].verts}
        bmesh.ops.delete(bm, geom=[bm.faces[i] for i in np.nonzero(drop)[0]], context="FACES")
        if rim:
            layer = bm.faces.layers.int.get("rig_part")
            edges = [e for e in bm.edges if e.is_boundary and all(v in rim for v in e.verts)]
            for face in bmesh.ops.holes_fill(bm, edges=edges, sides=0)["faces"]:
                around = [g[layer] for e in face.edges for g in e.link_faces if g is not face]
                face[layer] = max(set(around), key=around.count) if around else index["torso"]
        bm.to_mesh(me)
        bm.free()
        me.update()
        _, part = C.read_face_parts(body, cfg)
        _, centers = C.mesh_arrays(body)
    C.save_blend(args.work / "parts.blend")

    centers_k, klabels = C.kmeans_palette(colors, k=int(pcfg.get("paletteSize", 8)))
    palette = sorted(({"hex": C.to_hex(c), "faces": int((klabels == j).sum())} for j, c in enumerate(centers_k)),
                     key=lambda p: -p["faces"])
    counts = {name: int((part == i).sum()) for i, name in enumerate(labels)}
    report = {"step": "parts", "labels": labels, "faces": counts, "wrists": wrists,
              "landmarks": C.public_landmarks(lm), "extras": extras_report, "palette": palette,
              "islands": {"count": int(len(island_size)), "sizes": sorted(map(int, island_size), reverse=True)[:16]}}
    C.write_json(args.work / "parts.json", report)

    # Flat-colour review render on a throwaway copy.
    review = body.copy()
    review.data = body.data.copy()
    review.name = "PartsReview"
    bpy.context.scene.collection.objects.link(review)
    body.hide_render = True
    review.data.materials.clear()
    for i, name in enumerate(labels):
        color = C.PART_COLORS.get(name) or C.EXTRA_COLORS[(i - len(C.PART_NAMES)) % len(C.EXTRA_COLORS)]
        review.data.materials.append(C.flat_material(f"part_{name}", color))
    review.data.polygons.foreach_set("material_index", part)
    review.data.update()
    C.ensure_sun()
    lo, hi = C.world_bounds(review)
    C.render_ortho_views(args.work / "parts", (lo, hi), views=("front", "back", "side"), res_per_m=360)
    legend = [{"name": name, "hex": C.to_hex(C.PART_COLORS.get(name) or C.EXTRA_COLORS[(i - len(C.PART_NAMES)) % len(C.EXTRA_COLORS)])}
              for i, name in enumerate(labels)]
    C.write_json(args.work / "parts-legend.json", legend)
    print("PARTS " + " ".join(f"{k}={v}" for k, v in counts.items()))


C.run_main(main)
