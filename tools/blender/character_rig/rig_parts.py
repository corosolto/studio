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

import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
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
        part[mask] = index[extra["name"]]
        extras_report.append({"name": extra["name"], "faces": int(mask.sum())})

    attr = C.face_part_layer(me, create=True)
    attr.data.foreach_set("value", part)
    me.update()
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
