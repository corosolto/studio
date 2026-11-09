"""Shared helpers for the Blender character rig steps.

Every step script is run headless and is rerunnable:

  Blender -b --python tools/blender/character_rig/<step>.py -- \
      --config characters/<id>/rig.json --work <private work dir> [--source <mint-final.glb>]

Each step reads the previous step's ``.blend`` from the work directory and writes
its own ``.blend`` plus a JSON report there.  The work directory holds private
character bytes and must live outside this repository.

Coordinates inside Blender after the clean step: metres, +Z up, the character
faces -Y and its left side is +X (the glTF exporter turns this into +Y up,
+Z forward, which is what the game and the meshy-28 donor use).
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

# Exact meshy-28 joint list (tools/lib/character-pack.mjs#meshy28Joints).  Blender bone
# names must be unique, so the duplicated finger helpers carry a ``.001`` suffix inside
# Blender; tools/characters/rig-assemble.mjs restores the duplicate names in the GLB.
MESHY28 = [
    ("Hips", None),
    ("LeftUpLeg", "Hips"), ("LeftLeg", "LeftUpLeg"), ("LeftFoot", "LeftLeg"), ("LeftToeBase", "LeftFoot"),
    ("RightUpLeg", "Hips"), ("RightLeg", "RightUpLeg"), ("RightFoot", "RightLeg"), ("RightToeBase", "RightFoot"),
    ("Spine02", "Hips"), ("Spine01", "Spine02"), ("Spine", "Spine01"),
    ("LeftShoulder", "Spine"), ("LeftArm", "LeftShoulder"), ("LeftForeArm", "LeftArm"), ("LeftHand", "LeftForeArm"),
    ("RightShoulder", "Spine"), ("RightArm", "RightShoulder"), ("RightForeArm", "RightArm"), ("RightHand", "RightForeArm"),
    ("neck", "Spine"), ("Head", "neck"), ("head_end", "Head"), ("headfront", "Head"),
    ("Curl_R", "RightHand"), ("Curl_L", "LeftHand"), ("Curl_R", "RightHand"), ("Curl_L", "LeftHand"),
]
UNIQUE_JOINTS = list(dict.fromkeys(name for name, _ in MESHY28))
PARENT = {name: parent for name, parent in MESHY28}
# Helper joints that must never carry skin weight.
NON_DEFORM = {"head_end", "headfront", "Curl_R", "Curl_L"}

PART_NAMES = ["torso", "head", "arm_L", "arm_R", "hand_L", "hand_R", "leg_L", "leg_R"]
PART_COLORS = {
    "torso": (0.78, 0.76, 0.70), "head": (0.95, 0.45, 0.45),
    "arm_L": (0.25, 0.55, 0.95), "arm_R": (0.25, 0.85, 0.55),
    "hand_L": (1.00, 0.90, 0.10), "hand_R": (1.00, 0.30, 0.90),
    "leg_L": (0.65, 0.40, 0.90), "leg_R": (0.95, 0.55, 0.20),
}
EXTRA_COLORS = [(0.10, 0.95, 0.95), (0.60, 0.95, 0.20), (0.55, 0.30, 0.15), (0.20, 0.20, 0.75),
                (0.90, 0.10, 0.10), (0.98, 0.98, 0.98)]


def parse_args(extra=None):
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True, help="characters/<id>/rig.json")
    parser.add_argument("--work", required=True, help="private work directory (outside the repo)")
    for flag, kwargs in (extra or []):
        parser.add_argument(flag, **kwargs)
    args = parser.parse_args(argv)
    args.config_path = Path(args.config).resolve()
    args.cfg = json.loads(args.config_path.read_text())
    args.work = Path(args.work).resolve()
    args.work.mkdir(parents=True, exist_ok=True)
    return args


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2, sort_keys=False) + "\n")
    print(f"WROTE {path}")


def r(value, digits=4):
    if isinstance(value, (list, tuple, Vector, np.ndarray)):
        return [round(float(v), digits) for v in value]
    return round(float(value), digits)


def open_blend(path: Path) -> None:
    bpy.ops.wm.open_mainfile(filepath=str(path))


def save_blend(path: Path) -> None:
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    print(f"WROTE {path}")


def body_object():
    return bpy.data.objects["Body"]


def mesh_arrays(obj):
    """Vertex positions (N,3) and triangle-fan face centroids/normals as numpy arrays."""
    me = obj.data
    co = np.empty(len(me.vertices) * 3, dtype=np.float64)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    centers = np.empty(len(me.polygons) * 3, dtype=np.float64)
    me.polygons.foreach_get("center", centers)
    return co, centers.reshape(-1, 3)


def face_part_layer(me, create=False):
    attr = me.attributes.get("rig_part")
    if attr is None and create:
        attr = me.attributes.new("rig_part", "INT", "FACE")
    return attr


def part_labels(cfg):
    """Ordered part labels: the fixed body parts, then the configured extras."""
    return PART_NAMES + [extra["name"] for extra in cfg.get("extras", [])]


def read_face_parts(obj, cfg):
    labels = part_labels(cfg)
    attr = face_part_layer(obj.data)
    if attr is None:
        raise RuntimeError("Body has no rig_part face attribute; run rig_parts.py first")
    values = np.empty(len(obj.data.polygons), dtype=np.int32)
    attr.data.foreach_get("value", values)
    return labels, values


def bvh_for_faces(obj, face_mask=None):
    me = obj.data
    verts = [v.co.copy() for v in me.vertices]
    polys = [tuple(p.vertices) for i, p in enumerate(me.polygons) if face_mask is None or face_mask[i]]
    return BVHTree.FromPolygons(verts, polys, all_triangles=False)


def ray_intervals(bvh, origin: Vector, direction: Vector, max_len: float):
    """All surface crossings along a ray, paired into inside intervals (entry, exit) in metres."""
    hits = []
    start = origin.copy()
    travelled = 0.0
    eps = 1e-5
    while travelled < max_len:
        loc, _normal, _index, dist = bvh.ray_cast(start, direction, max_len - travelled)
        if loc is None:
            break
        travelled += dist + eps
        hits.append(travelled - eps)
        start = loc + direction * eps
        if len(hits) > 64:
            break
    intervals = []
    for k in range(0, len(hits) - 1, 2):
        intervals.append((hits[k], hits[k + 1]))
    return intervals


def front_silhouette(bvh, xmin, xmax, zmax, step, ymin, ymax):
    """Occupancy grid seen from the front: occ[iz, ix] for z = iz*step, x = xmin + ix*step."""
    nx = int(math.ceil((xmax - xmin) / step)) + 1
    nz = int(math.ceil(zmax / step)) + 1
    occ = np.zeros((nz, nx), dtype=bool)
    direction = Vector((0, 1, 0))
    length = ymax - ymin + 0.2
    for iz in range(nz):
        z = iz * step
        for ix in range(nx):
            x = xmin + ix * step
            loc, *_ = bvh.ray_cast(Vector((x, ymin - 0.1, z)), direction, length)
            if loc is not None:
                occ[iz, ix] = True
    return occ


def section_y(bvh, x, z, ymin, ymax):
    """Depth intervals of the mesh along +Y through (x, z)."""
    return ray_intervals(bvh, Vector((x, ymin - 0.1, z)), Vector((0, 1, 0)), ymax - ymin + 0.2)


def section_centroid_xz(bvh, xs, zs, ymin, ymax):
    """Centroid and area of the solid crossed by rays along Y through a grid of (x, z)."""
    total = 0.0
    acc = Vector((0, 0, 0))
    for x in xs:
        for z in zs:
            for a, b in section_y(bvh, x, z, ymin, ymax):
                length = b - a
                total += length
                acc += Vector((x, ymin - 0.1 + (a + b) * 0.5, z)) * length
    if total <= 0:
        return None, 0.0
    return acc / total, total


def setup_render(engine="BLENDER_EEVEE", res=(900, 1100), transparent=True):
    scene = bpy.context.scene
    scene.render.engine = engine
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = transparent
    scene.view_settings.view_transform = "Standard"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("rig_world")
    scene.world.color = (0.6, 0.6, 0.6)
    return scene


def ortho_camera(name, location, target, ortho_scale):
    cam_data = bpy.data.cameras.get(name) or bpy.data.cameras.new(name)
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ortho_scale
    cam = bpy.data.objects.get(name) or bpy.data.objects.new(name, cam_data)
    if cam.name not in bpy.context.scene.collection.objects:
        bpy.context.scene.collection.objects.link(cam)
    cam.location = location
    cam.rotation_euler = (Vector(target) - Vector(location)).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    return cam


def ensure_sun():
    if "rig_sun" in bpy.data.objects:
        return
    for name, rot, energy in (("rig_sun", (0.7, 0.15, 0.4), 3.0), ("rig_fill", (-0.9, 0.0, 2.6), 1.2)):
        light = bpy.data.lights.new(name, "SUN")
        light.energy = energy
        obj = bpy.data.objects.new(name, light)
        obj.rotation_euler = rot
        bpy.context.scene.collection.objects.link(obj)


VIEWS = {
    # name: (camera direction from target, image-right axis, image-up axis)
    "front": (Vector((0, -1, 0)), Vector((1, 0, 0)), Vector((0, 0, 1))),
    "back": (Vector((0, 1, 0)), Vector((-1, 0, 0)), Vector((0, 0, 1))),
    "side": (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))),
}


def render_ortho_views(out_prefix: Path, bounds, views=("front", "side"), res_per_m=500, margin=0.08):
    """Render orthographic views and write the pixel mapping next to each PNG.

    The sidecar ``<png>.view.json`` lets tools/characters/rig-review.mjs draw the 5 cm grid
    and joint dots in exact metres without trusting Blender's camera maths twice.
    """
    lo, hi = bounds
    center = (Vector(lo) + Vector(hi)) * 0.5
    outputs = []
    for view in views:
        direction, right, up = VIEWS[view]
        width = abs((Vector(hi) - Vector(lo)).dot(right)) + 2 * margin
        height = (hi[2] - lo[2]) + 2 * margin
        res_x = int(round(width * res_per_m))
        res_y = int(round(height * res_per_m))
        setup_render(res=(res_x, res_y))
        ortho_camera("rig_cam", center + direction * 5.0, center, max(width, height))
        bpy.context.scene.render.filepath = str(out_prefix) + f"-{view}.png"
        bpy.ops.render.render(write_still=True)
        mapping = {
            "view": view, "png": Path(bpy.context.scene.render.filepath).name,
            "width": res_x, "height": res_y, "pixelsPerMetre": res_per_m,
            "center": r(center), "right": r(right), "up": r(up),
        }
        write_json(Path(bpy.context.scene.render.filepath + ".view.json"), mapping)
        outputs.append(mapping)
    return outputs


def world_bounds(obj):
    co, _ = mesh_arrays(obj)
    mw = np.array(obj.matrix_world)
    pts = co @ mw[:3, :3].T + mw[:3, 3]
    return pts.min(axis=0).tolist(), pts.max(axis=0).tolist()


def flat_material(name, color):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf is not None:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.8
    mat.diffuse_color = (*color, 1.0)
    return mat


def bm_from(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    return bm


def _runs(row: np.ndarray):
    """Contiguous True runs of a 1-D boolean row as (start, end) inclusive indices."""
    runs = []
    start = None
    for i, value in enumerate(row):
        if value and start is None:
            start = i
        elif not value and start is not None:
            runs.append((start, i - 1))
            start = None
    if start is not None:
        runs.append((start, len(row) - 1))
    return runs


def run_main(main):
    """Run a step's main() and exit non-zero on any exception.

    Blender's ``--python`` swallows script exceptions and exits 0; the runner relies on the
    exit code (and on fresh outputs) to never reuse a previous step's files.
    """
    import os
    import traceback
    try:
        main()
    except BaseException:  # noqa: BLE001 - every failure must reach the exit code
        traceback.print_exc()
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(1)
    sys.stdout.flush()


def landmarks(obj, face_mask=None, step=0.01, crotch_z=None):
    """Body landmarks measured from a 1 cm front silhouette and Y-ray cross-sections.

    Only faces in ``face_mask`` are measured (the joints step passes the body without
    extras such as a backpack or an antenna).  Everything is in clean-space metres.
    """
    bvh = bvh_for_faces(obj, face_mask)
    co, _ = mesh_arrays(obj)
    if face_mask is not None:
        used = np.zeros(len(co), dtype=bool)
        for i, p in enumerate(obj.data.polygons):
            if face_mask[i]:
                used[list(p.vertices)] = True
        co = co[used]
    lo, hi = co.min(axis=0), co.max(axis=0)
    H = float(hi[2])
    xmin, xmax = float(lo[0]) - step, float(hi[0]) + step
    ymin, ymax = float(lo[1]), float(hi[1])
    occ = front_silhouette(bvh, xmin, xmax, H, step, ymin, ymax)
    nz, nx = occ.shape
    xs = xmin + np.arange(nx) * step
    zs = np.arange(nz) * step
    ic = int(round((0.0 - xmin) / step))
    band = slice(max(ic - 1, 0), ic + 2)

    # Crotch: first height above 15% H where the midline (x = -1, 0, +1 cm) is at least
    # 2.5% H deep front to back.  A silhouette test alone fails when the thighs touch.
    # ``crotch_z`` from the caller wins: removing extras (a cape over the back of the legs)
    # opens the mesh, rays then never exit and the depth test below finds no crotch.
    if crotch_z is None:
        crotch_z = 0.47 * H
        for iz in range(int(0.15 * H / step), int(0.8 * H / step)):
            z = float(zs[iz])
            depth = np.mean([sum(b - a for a, b in section_y(bvh, x, z, ymin, ymax)) for x in (-0.01, 0.0, 0.01)])
            if depth >= 0.025 * H:
                crotch_z = z
                break

    def central_run(iz):
        for a, b in _runs(occ[iz]):
            if a - 1 <= ic <= b + 1:
                return float(xs[a]), float(xs[b])
        return None

    # Torso reference half-width just above the crotch.
    widths = []
    for iz in range(int((crotch_z + 0.04 * H) / step), int((crotch_z + 0.14 * H) / step)):
        run = central_run(iz)
        if run:
            widths.append(max(-run[0], run[1]))
    w_ref = float(np.median(widths)) if widths else 0.1 * H

    # Arm band: lowest block of rows above the crotch whose extent on both sides reaches
    # well past the torso (T-pose arms).  Ears or a wide head above it are ignored.
    ext_l = np.array([xs[np.nonzero(occ[iz] & (xs > 0))[0]].max() if (occ[iz] & (xs > 0)).any() else 0.0 for iz in range(nz)])
    ext_r = np.array([-xs[np.nonzero(occ[iz] & (xs < 0))[0]].min() if (occ[iz] & (xs < 0)).any() else 0.0 for iz in range(nz)])
    # Arm band: the T-pose test (both sides reach 2.2x the torso half-width) first; A-pose
    # arms hang closer to the body, so the factor relaxes down to 1.5x before giving up.
    for factor in (2.2, 1.9, 1.7, 1.5):
        wide = (ext_l > factor * w_ref) & (ext_r > factor * w_ref) & (zs > crotch_z + 0.05 * H)
        rows = np.nonzero(wide)[0]
        if len(rows):
            break
    if not len(rows):
        raise RuntimeError("no arm band found in the front silhouette (arms closer than 1.5x the torso "
                           "half-width); override the arm joints in joints.json")
    first = rows[0]
    last = first
    while last + 1 < nz and wide[last + 1]:
        last += 1
    arm_lo, arm_hi = float(zs[first]), float(zs[last])

    sides = {}
    for side, sign in (("L", 1.0), ("R", -1.0)):
        ext = ext_l if sign > 0 else ext_r
        tip = float(ext[first:last + 1].max())
        # Armpit: half-width of the torso run just below the arm band.
        below = int(max(first - 3, 0))
        run = central_run(below) or (-w_ref, w_ref)
        x_ap = float(run[1] if sign > 0 else -run[0])

        # Arm centre line and thickness per column, within a band around the arm rows.
        zlo = max(arm_lo - 0.08 * H, crotch_z)
        zhi = arm_hi + 0.04 * H
        izlo, izhi = int(zlo / step), int(zhi / step) + 1
        column = {}
        for ix in range(nx):
            x = float(xs[ix]) * sign
            if x < x_ap * 0.6 or x > tip + 1e-6:
                continue
            filled = np.nonzero(occ[izlo:izhi, ix])[0]
            if len(filled):
                # keep only the run nearest the arm band centre
                runs = _runs(occ[izlo:izhi, ix])
                mid = ((arm_lo + arm_hi) * 0.5 - zlo) / step
                a, b = min(runs, key=lambda ab: 0 if ab[0] <= mid <= ab[1] else min(abs(ab[0] - mid), abs(ab[1] - mid)))
                column[round(x, 4)] = (zlo + (a + b) * 0.5 * step, (b - a + 1) * step, zlo + a * step, zlo + b * step)
        def col(x):
            key = min(column, key=lambda k: abs(k - x))
            return column[key]
        # The torso row under the arm can be a narrow waist (hunched or skinny bodies), so
        # the armpit is also found where the silhouette column becomes much taller than the
        # arm itself, scanning inward from mid-arm.
        keys = np.array(sorted(column))
        mid_arm = keys[(keys > x_ap + 0.3 * (tip - x_ap)) & (keys < x_ap + 0.7 * (tip - x_ap))]
        t_arm = float(np.median([column[k][1] for k in mid_arm])) if len(mid_arm) else 0.0
        x_body = None
        for k in keys[keys <= x_ap + 0.3 * (tip - x_ap)][::-1]:
            if t_arm and column[k][1] > 2.0 * t_arm:
                x_body = float(k) + step
                break
        if x_body is not None and x_body > x_ap:
            x_ap = x_body
        thick = col(x_ap + 0.03)[1]
        armpit_z = col(x_ap + 0.02)[2]

        # Wrist: area profile of the distal half; the palm is the widest section of the
        # distal 35% and the wrist is the outermost section within 8% H inside the palm
        # whose area is within 10% of the thinnest one (fingers are thin too, so the
        # plain minimum would land on them).
        def area_at(x):
            _zc, _t, za, zb = col(x)
            area = 0.0
            for z in np.arange(za, zb + 1e-9, step * 0.25):
                for a_, b_ in section_y(bvh, x * sign, float(z), ymin, ymax):
                    area += (b_ - a_) * step * 0.25
            return area
        xs_prof = np.arange(tip - 0.5 * (tip - x_ap), tip, 0.005)
        prof = np.array([area_at(float(x)) for x in xs_prof])
        distal = xs_prof > tip - 0.35 * (tip - x_ap)
        peak = float(xs_prof[distal][int(np.argmax(prof[distal]))])
        window = (xs_prof >= peak - 0.08 * H) & (xs_prof <= peak) & (prof > 0)
        if window.any():
            thinnest = float(prof[window].min())
            x_wrist = float(xs_prof[window & (prof <= 1.1 * thinnest)].max())
        else:
            x_wrist = tip - 0.11 * H
        sides[side] = {
            "sign": sign, "tip": tip, "armpitX": x_ap, "armpitZ": armpit_z, "armThickness": thick,
            "wristX": x_wrist, "column": column,
        }

    # Neck: narrowest central run above the arm band (lower half of what is above it).
    neck_z, neck_w = None, None
    top_iz = nz - 1
    while top_iz > last and not occ[top_iz, band].any():
        top_iz -= 1
    for iz in range(last + 1, int(last + 1 + 0.6 * (top_iz - last))):
        run = central_run(iz)
        if not run:
            continue
        w = max(-run[0], run[1])
        if neck_w is None or w < neck_w - 1e-9:
            neck_z, neck_w = float(zs[iz]), w
    if neck_z is None:
        neck_z, neck_w = arm_hi + 0.05 * H, w_ref * 0.5
    head_top = float(zs[top_iz])

    # Legs: per-side centre line below the crotch.
    legs = {}
    for side, sign in (("L", 1.0), ("R", -1.0)):
        line = {}
        for iz in range(0, int(crotch_z / step)):
            cells = np.nonzero(occ[iz] & (xs * sign > 0))[0]
            if len(cells):
                line[round(float(zs[iz]), 4)] = (float(xs[cells].mean()), float(xs[cells].min()), float(xs[cells].max()))
        legs[side] = line
    return {
        "height": H, "step": step, "bounds": {"min": r(lo), "max": r(hi)},
        "crotchZ": crotch_z, "torsoHalfWidth": w_ref, "armBand": [arm_lo, arm_hi],
        "neckZ": neck_z, "neckHalfWidth": neck_w, "headTopZ": head_top,
        "arms": sides, "legs": legs, "_bvh": bvh, "_y": (ymin, ymax),
    }


def public_landmarks(lm):
    """JSON-friendly subset of :func:`landmarks`."""
    out = {k: (r(v) if isinstance(v, float) else v) for k, v in lm.items()
           if not k.startswith("_") and k not in ("arms", "legs")}
    out["arms"] = {s: {k: r(v) for k, v in a.items() if k not in ("column",)} for s, a in lm["arms"].items()}
    return out


def base_color_image(obj):
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type != "BSDF_PRINCIPLED":
                continue
            stack = [link.from_node for link in node.inputs["Base Color"].links]
            while stack:
                current = stack.pop()
                if current.type == "TEX_IMAGE" and current.image is not None:
                    return current.image
                for socket in current.inputs:
                    stack.extend(link.from_node for link in socket.links)
    return None


def face_colors(obj):
    """Mean base-colour texel (sRGB 0..1) per face, sampled at the UV centroid and corners."""
    me = obj.data
    image = base_color_image(obj)
    n = len(me.polygons)
    if image is None or not me.uv_layers:
        return np.full((n, 3), 0.5)
    w, h = image.size
    px = np.empty(w * h * 4, dtype=np.float32)
    image.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    uv = np.empty(len(me.loops) * 2, dtype=np.float64)
    me.uv_layers.active.data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    out = np.zeros((n, 3))
    for i, p in enumerate(me.polygons):
        loops = uv[p.loop_start:p.loop_start + p.loop_total]
        c = loops.mean(axis=0)
        samples = np.vstack([c, c + (loops - c) * 0.6])
        u = np.clip((samples[:, 0] % 1.0) * w, 0, w - 1).astype(int)
        v = np.clip((samples[:, 1] % 1.0) * h, 0, h - 1).astype(int)
        out[i] = px[v, u, :3].mean(axis=0)
    return out


def to_hex(rgb):
    return "#" + "".join(f"{int(round(max(0.0, min(1.0, float(c))) * 255)):02x}" for c in rgb)


def from_hex(text):
    text = text.lstrip("#")
    return np.array([int(text[i:i + 2], 16) / 255.0 for i in (0, 2, 4)])


def kmeans_palette(colors, k=8, iterations=25):
    """Deterministic k-means (farthest-point init) over face colours."""
    centers = [colors.mean(axis=0)]
    for _ in range(k - 1):
        d = np.min([((colors - c) ** 2).sum(axis=1) for c in centers], axis=0)
        centers.append(colors[int(np.argmax(d))])
    centers = np.array(centers)
    for _ in range(iterations):
        labels = np.argmin(((colors[:, None, :] - centers[None]) ** 2).sum(axis=2), axis=1)
        for j in range(k):
            if (labels == j).any():
                centers[j] = colors[labels == j].mean(axis=0)
    labels = np.argmin(((colors[:, None, :] - centers[None]) ** 2).sum(axis=2), axis=1)
    return centers, labels


def connected_face_islands(obj):
    """Face index -> island id over vertex-shared connectivity."""
    me = obj.data
    parent = list(range(len(me.vertices)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for e in me.edges:
        a, b = find(e.vertices[0]), find(e.vertices[1])
        if a != b:
            parent[a] = b
    roots = [find(p.vertices[0]) for p in me.polygons]
    ids = {root: i for i, root in enumerate(dict.fromkeys(roots))}
    return np.array([ids[root] for root in roots])
