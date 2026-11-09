"""Step 4 — build the meshy-28 armature on joints.json.

  Blender -b --python tools/blender/character_rig/rig_armature.py -- \
      --config characters/<id>/rig.json --work <dir>

One bone per meshy-28 joint, heads exactly on ``joints.json``, parented as in
``tools/lib/character-pack.mjs#meshy28Joints``.  Each bone points at its chain child (the
segment the heat weighting uses); chain ends point at the hand/toe tips the joints step
measured.  Blender bone names are unique, so the second ``Curl_R``/``Curl_L`` pair is
``Curl_R.001``/``Curl_L.001`` here; tools/characters/rig-assemble.mjs restores the duplicate
names and the donor rest frames in the GLB.  ``head_end``, ``headfront`` and the ``Curl``
helpers do not deform.  Writes ``armature.blend``.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

# Bone tail target: the joint a bone points at (the segment heat weighting diffuses along).
TAIL = {
    "Hips": "Spine02", "Spine02": "Spine01", "Spine01": "Spine", "Spine": "neck", "neck": "Head", "Head": "head_end",
    "LeftUpLeg": "LeftLeg", "LeftLeg": "LeftFoot", "LeftFoot": "LeftToeBase",
    "RightUpLeg": "RightLeg", "RightLeg": "RightFoot", "RightFoot": "RightToeBase",
    "LeftShoulder": "LeftArm", "LeftArm": "LeftForeArm", "LeftForeArm": "LeftHand",
    "RightShoulder": "RightArm", "RightArm": "RightForeArm", "RightForeArm": "RightHand",
}


def blender_names():
    """meshy-28 skin order with Blender-unique names."""
    seen = {}
    out = []
    for name, parent in C.MESHY28:
        seen[name] = seen.get(name, 0) + 1
        unique = name if seen[name] == 1 else f"{name}.{seen[name] - 1:03d}"
        out.append((unique, name, parent))
    return out


def main():
    args = C.parse_args()
    C.open_blend(args.work / "parts.blend")
    data = json.loads((args.work / "joints.json").read_text())
    joints = {name: Vector(p) for name, p in data["joints"].items()}
    tips = {name: Vector(p) for name, p in data["tips"].items()}
    height = max(p.z for p in joints.values())

    for obj in [o for o in bpy.data.objects if o.type == "ARMATURE"]:
        bpy.data.objects.remove(obj, do_unlink=True)
    arm_data = bpy.data.armatures.new("Armature")
    arm = bpy.data.objects.new("Armature", arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    bones = {}
    for unique, name, parent in blender_names():
        bone = arm_data.edit_bones.new(unique)
        head = joints[name]
        if name in TAIL:
            tail = joints[TAIL[name]]
        elif name in ("LeftHand", "RightHand", "LeftToeBase", "RightToeBase"):
            tail = tips[name]
        elif name == "head_end":
            tail = head + Vector((0, 0, 0.03 * height))
        elif name == "headfront":
            tail = head + Vector((0, -0.03 * height, 0))
        else:  # Curl helpers: a short stub towards the hand tip
            hand = "LeftHand" if name.endswith("_L") else "RightHand"
            tail = head + (tips[hand] - joints[hand]).normalized() * 0.02
        if (tail - head).length < 0.005:
            tail = head + Vector((0, 0, 0.01))
        bone.head, bone.tail = head, tail
        bone.use_deform = name not in C.NON_DEFORM
        bones.setdefault(name, bone)
        if parent:
            bone.parent = bones[parent]
            bone.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    arm.show_in_front = True
    C.save_blend(args.work / "armature.blend")
    print(f"ARMATURE {len(arm_data.bones)} bones ({sum(b.use_deform for b in arm_data.bones)} deform)")


main()
