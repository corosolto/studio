"""Step 3 — estimate the meshy-28 joint positions and render them for review.

  Blender -b --python tools/blender/character_rig/rig_joints.py -- \
      --config characters/<id>/rig.json --work <dir>

Deterministic first estimate from the body without extras (a backpack or an antenna
must not pull the spine or the head):

- arms: shoulder just inside the armpit line, elbow at ``elbowRatio`` of shoulder→wrist,
  wrist where the parts step put it; each joint sits on the centroid of the arm
  cross-section (rays along Y), and the shoulder on the line fitted through them;
- legs: hip at the crotch row (``hipAboveCrotch``) on the leg section; ankle at the thinnest leg
  section near the floor, knee at the strongest bend of the side profile (or
  ``kneeRatio`` of ankle→hip on straight legs), toe on the ball of the foot;
- spine: ``Hips`` above the hip joints, ``Spine`` just under the shoulder line,
  ``Spine02``/``Spine01`` at thirds, all on the torso section centroid;
- head: ``Head`` at the narrowest neck row, ``neck`` 60% of the way from ``Spine``,
  ``head_end`` on the top of the head, ``headfront`` in front of ``Head``.

Ratios default to measurements of the meshy-28 donor and can be set under ``joints`` in
the config.  A per-character override file (``jointsOverride`` in the config, relative to
the config, default ``joints.json`` next to it) wins joint by joint.

Writes ``joints.json`` (clean-space metres: +Z up, faces -Y, left is +X), the
``joints-estimate.json`` before overrides, and ``joints-front/side.png`` +
``.view.json`` for the 5 cm grid review sheet (tools/characters/rig-review.mjs).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

# Defaults measured on the meshy-28 donor mesh (client public/models/characters/mst.glb)
# with tools/blender/character_rig run on it; see docs/character-rig.md.
DEFAULTS = {
    "shoulderInset": 0.05,     # shoulder joint x = armpit x - shoulderInset * arm thickness
    "shoulderRaise": 0.1,      # shoulder joint z = arm centre line + shoulderRaise * arm thickness
    "clavicleRatio": 0.2,      # LeftShoulder x = clavicleRatio * shoulder x
    "elbowRatio": 0.5,         # elbow at this fraction of shoulder -> wrist
    "hipAboveCrotch": 0.045,   # UpLeg z = crotch + hipAboveCrotch * H
    "hipsAboveUpLeg": 0.049,   # Hips z = UpLeg z + hipsAboveUpLeg * H
    "kneeRatio": 0.49,         # knee at this fraction of ankle -> hip on straight legs
    "kneeBendMin": 0.02,       # side-profile deviation (m) that counts as a bent knee
    "kneeForward": 0.25,       # knee joint moves this fraction of the leg depth to the front
    "ankleWindow": [0.035, 0.09],
    "toeRatio": 0.72,          # ball of the foot from heel to toe tip
    "toeHeightRatio": 0.4,     # toe joint height as a fraction of the ankle height
    "spineBelowShoulder": 0.015,
    "neckRatio": 0.6,
    "headAboveNeck": 0.02,     # Head z = narrowest neck row + headAboveNeck * H
    "headfrontForward": 0.069,
}


def section_xy(bvh, xs, z, ymin, ymax):
    """Centroid (x, y) and area of a horizontal section through rays along Y at height z."""
    total = 0.0
    acc = np.zeros(2)
    for x in xs:
        for a, b in C.section_y(bvh, float(x), float(z), ymin, ymax):
            length = b - a
            total += length
            acc += np.array([x, ymin - 0.1 + (a + b) * 0.5]) * length
    if total <= 0:
        return None, 0.0
    return acc / total, total


def arm_section(bvh, lm, side, x_abs, ymin, ymax):
    arm = lm["arms"][side]
    keys = np.array(list(arm["column"].keys()))
    key = keys[np.argmin(np.abs(keys - x_abs))]
    zc, _t, za, zb = arm["column"][key]
    zs = np.arange(za, zb + 1e-9, 0.005)
    best, area = C.section_centroid_xz(bvh, [x_abs * arm["sign"]], zs, ymin, ymax)
    if best is None:
        return Vector((x_abs * arm["sign"], 0.0, zc)), 0.0
    return best, area


def main():
    args = C.parse_args()
    cfg = args.cfg
    J = {**DEFAULTS, **cfg.get("joints", {})}
    C.open_blend(args.work / "parts.blend")
    body = C.body_object()
    labels, parts = C.read_face_parts(body, cfg)
    n_body = len(C.PART_NAMES)
    body_mask = parts < n_body
    lm = C.landmarks(body, face_mask=body_mask)
    parts_report = json.loads((args.work / "parts.json").read_text())
    bvh = lm["_bvh"]
    ymin, ymax = lm["_y"]
    H = lm["height"]
    co, _ = C.mesh_arrays(body)
    me = body.data
    joints = {}
    notes = {}

    # ---------------------------------------------------------------- arms
    for side, prefix in (("L", "Left"), ("R", "Right")):
        arm = lm["arms"][side]
        s = arm["sign"]
        wrist = abs(float(parts_report["wrists"][side]["x"]))
        override_wrist = cfg.get("parts", {}).get("wristX")
        if override_wrist is not None:
            wrist = float(override_wrist)
        x_sh = arm["armpitX"] - J["shoulderInset"] * arm["armThickness"]
        x_el = x_sh + J["elbowRatio"] * (wrist - x_sh)
        # Fit the arm centre line on the outer 75% of shoulder->wrist: straps, vest edges
        # and the deltoid next to the torso would drag a full-length fit.
        start = arm["armpitX"] + 0.25 * (wrist - arm["armpitX"])
        samples = [start + k * (wrist - start) / 6 for k in range(7)]
        cents = [arm_section(bvh, lm, side, x, ymin, ymax)[0] for x in samples]
        xs = np.array([c.x * s for c in cents])
        fit_y = np.polyfit(xs, [c.y for c in cents], 1)
        fit_z = np.polyfit(xs, [c.z for c in cents], 1)
        shoulder = Vector((x_sh * s, np.polyval(fit_y, x_sh),
                           np.polyval(fit_z, x_sh) + J["shoulderRaise"] * arm["armThickness"]))
        elbow, _ = arm_section(bvh, lm, side, x_el, ymin, ymax)
        hand, _ = arm_section(bvh, lm, side, wrist, ymin, ymax)
        joints[f"{prefix}Arm"] = shoulder
        joints[f"{prefix}ForeArm"] = elbow
        joints[f"{prefix}Hand"] = hand
        joints[f"{prefix}Shoulder"] = Vector((J["clavicleRatio"] * x_sh * s, shoulder.y, shoulder.z))
        joints[f"Curl_{side}"] = hand.copy()
        notes[f"{prefix}Hand"] = parts_report["wrists"][side]["source"] if override_wrist is None else "config wristX"
        tip_x = arm["tip"]
        tip, _ = arm_section(bvh, lm, side, tip_x - 0.01, ymin, ymax)
        notes[f"{prefix}HandTip"] = C.r(tip)

    # ---------------------------------------------------------------- legs
    crotch = lm["crotchZ"]
    hip_z = crotch + J["hipAboveCrotch"] * H
    leg_tips = {}
    for side, prefix in (("L", "Left"), ("R", "Right")):
        s = 1.0 if side == "L" else -1.0
        line = lm["legs"][side]
        zs_line = np.array(sorted(line))

        def leg_row(z):
            key = zs_line[np.argmin(np.abs(zs_line - z))]
            return line[key]

        def leg_section(z):
            _mean, xmin_, xmax_ = leg_row(z)
            xs = np.arange(xmin_, xmax_ + 1e-9, 0.005)
            return section_xy(bvh, xs, z, ymin, ymax)

        lo_w, hi_w = J["ankleWindow"]
        best = None
        for z in np.arange(lo_w * H, hi_w * H + 1e-9, 0.005):
            cen, area = leg_section(z)
            if cen is not None and (best is None or area < best[2]):
                best = (z, cen, area)
        ankle_z, ankle_c, _ = best
        thigh_c, _ = leg_section(crotch - 0.03)
        pelvis_y = None
        cen_p, _ = section_xy(bvh, np.arange(-lm["torsoHalfWidth"] * 0.6, lm["torsoHalfWidth"] * 0.6 + 1e-9, 0.005),
                              hip_z, ymin, ymax)
        if cen_p is not None:
            pelvis_y = cen_p[1]
        hip = Vector((thigh_c[0], thigh_c[1] if pelvis_y is None else 0.5 * (thigh_c[1] + pelvis_y), hip_z))
        ankle = Vector((ankle_c[0], ankle_c[1], ankle_z))
        # Knee: strongest bend of the side profile, else the donor ratio.
        prof = []
        for z in np.arange(ankle_z + 0.05, hip_z - 0.05, 0.01):
            cen, _ = leg_section(z)
            if cen is not None:
                t = (z - ankle_z) / (hip_z - ankle_z)
                straight = ankle + (hip - ankle) * t
                prof.append((z, cen, cen[1] - straight.y))
        bend = max(prof, key=lambda p: abs(p[2])) if prof else None
        if bend and abs(bend[2]) >= J["kneeBendMin"]:
            knee_z = bend[0]
            notes[f"{prefix}Leg"] = f"side-profile bend {C.r(bend[2], 3)} m"
        else:
            knee_z = ankle_z + J["kneeRatio"] * (hip_z - ankle_z)
            notes[f"{prefix}Leg"] = "kneeRatio"
        knee_c, _ = leg_section(knee_z)
        spans = C.section_y(bvh, float(knee_c[0]), float(knee_z), ymin, ymax)
        knee_y = knee_c[1]
        if spans:
            front = ymin - 0.1 + min(a for a, _ in spans)
            back = ymin - 0.1 + max(b for _, b in spans)
            knee_y -= J["kneeForward"] * (back - front)
        knee = Vector((knee_c[0], knee_y, knee_z))
        # Foot: leg-part vertices below the ankle on this side.
        leg_index = labels.index(f"leg_{side}")
        foot_v = set()
        for i, p in enumerate(me.polygons):
            if parts[i] == leg_index:
                foot_v.update(p.vertices)
        fv = co[sorted(foot_v)]
        fv = fv[(fv[:, 2] < ankle_z) & (fv[:, 0] * s > 0)]
        y_front, y_heel = float(fv[:, 1].min()), float(fv[:, 1].max())
        y_toe = y_heel + J["toeRatio"] * (y_front - y_heel)
        near = fv[np.abs(fv[:, 1] - y_toe) < 0.02]
        toe = Vector((float(near[:, 0].mean()) if len(near) else ankle.x, y_toe, J["toeHeightRatio"] * ankle_z))
        joints[f"{prefix}UpLeg"] = hip
        joints[f"{prefix}Leg"] = knee
        joints[f"{prefix}Foot"] = ankle
        joints[f"{prefix}ToeBase"] = toe
        leg_tips[prefix] = Vector((toe.x, y_front, toe.z))

    # ---------------------------------------------------------------- spine and head
    full_bvh = C.bvh_for_faces(body)
    extra_v = set()
    for i, p in enumerate(me.polygons):
        if not body_mask[i]:
            extra_v.update(p.vertices)
    extra_co = co[sorted(extra_v)] if extra_v else np.zeros((0, 3))

    def torso_section(z, half=None):
        """Torso centroid at height z without extras.

        Removing a backpack fused to the back leaves a hole, so rays that miss their exit
        fall back to the full mesh clipped in front of the extras at this height.
        """
        half = half or lm["torsoHalfWidth"] * 0.6
        xs = np.arange(-half, half + 1e-9, 0.005)
        cen, _ = section_xy(bvh, xs, z, ymin, ymax)
        if cen is not None:
            return cen
        near = extra_co[(np.abs(extra_co[:, 2] - z) < 0.03) & (np.abs(extra_co[:, 0]) < half)] if len(extra_co) else extra_co
        y_cut = float(near[:, 1].min()) if len(near) else ymax
        total, acc = 0.0, np.zeros(2)
        for x in xs:
            for a, b in C.section_y(full_bvh, float(x), float(z), ymin, ymax):
                ya, yb = ymin - 0.1 + a, min(ymin - 0.1 + b, y_cut)
                if yb > ya:
                    total += yb - ya
                    acc += np.array([x, 0.5 * (ya + yb)]) * (yb - ya)
        if total <= 0:
            raise RuntimeError(f"no torso section at z={z:.3f}")
        return acc / total

    up_z = 0.5 * (joints["LeftUpLeg"].z + joints["RightUpLeg"].z)
    hips_z = up_z + J["hipsAboveUpLeg"] * H
    shoulder_z = 0.5 * (joints["LeftArm"].z + joints["RightArm"].z)
    spine_z = shoulder_z - J["spineBelowShoulder"] * H
    # Hips and Spine sit on the torso section centroid; the two middle joints lie on the
    # straight line between them (vest plates, pouches and a removed backpack make the
    # mid-torso centroid jump front to back).
    hips_y = torso_section(hips_z)[1]
    spine_y = torso_section(spine_z)[1]
    for name, t in (("Hips", 0.0), ("Spine02", 1 / 3), ("Spine01", 2 / 3), ("Spine", 1.0)):
        joints[name] = Vector((0.0, hips_y + t * (spine_y - hips_y), hips_z + t * (spine_z - hips_z)))
    head_z = lm["neckZ"] + J["headAboveNeck"] * H
    cen = torso_section(head_z, half=lm["neckHalfWidth"])
    joints["Head"] = Vector((0.0, cen[1], head_z))
    neck_z = spine_z + J["neckRatio"] * (head_z - spine_z)
    cen = torso_section(neck_z, half=lm["neckHalfWidth"] * 1.5)
    joints["neck"] = Vector((0.0, cen[1], neck_z))
    top = lm["headTopZ"]
    cen = torso_section(head_z + 0.6 * (top - head_z), half=lm["neckHalfWidth"])
    joints["head_end"] = Vector((0.0, cen[1], top))
    joints["headfront"] = Vector((0.0, joints["Head"].y - J["headfrontForward"] * H, head_z))

    estimate = {name: C.r(joints[name]) for name in C.UNIQUE_JOINTS}
    override_path = (args.config_path.parent / cfg.get("jointsOverride", "joints.json")).resolve()
    overridden = []
    if override_path.is_file():
        override = json.loads(override_path.read_text())
        for name, value in override.get("joints", {}).items():
            if name not in joints:
                raise RuntimeError(f"override names unknown joint {name}")
            joints[name] = Vector(value)
            overridden.append(name)
    final = {name: C.r(joints[name]) for name in C.UNIQUE_JOINTS}
    meta = {
        "units": "m", "space": "clean: +Z up, faces -Y, character left is +X",
        "grid": 0.05, "skeleton": "meshy-28",
    }
    C.write_json(args.work / "joints-estimate.json", {**meta, "joints": estimate, "notes": notes,
                                                     "ratios": J, "landmarks": C.public_landmarks(lm)})
    C.write_json(args.work / "joints.json", {**meta, "joints": final, "override": str(override_path) if overridden else None,
                                            "overridden": overridden,
                                            "tips": {"LeftHand": notes["LeftHandTip"], "RightHand": notes["RightHandTip"],
                                                     "LeftToeBase": C.r(leg_tips["Left"]), "RightToeBase": C.r(leg_tips["Right"])}})
    C.ensure_sun()
    lo, hi = C.world_bounds(body)
    C.render_ortho_views(args.work / "joints", (lo, hi), views=("front", "side"), res_per_m=600)
    print("JOINTS " + " ".join(f"{k}={v}" for k, v in final.items()))


main()
