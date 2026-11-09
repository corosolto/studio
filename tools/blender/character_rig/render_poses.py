"""Render static posed GLBs (tools/characters/rig-pose-test.mjs --bake) for rig comparisons.

  Blender -b --python tools/blender/character_rig/render_poses.py -- \
      --out <dir> --height <metres> [--res 480] <label>=<posed.glb> ...

Writes ``<label>-front.png``, ``<label>-back.png`` and ``<label>-34.png`` (three-quarter
front-left, perspective) per GLB with identical framing for every input, so before/after
stills line up in a contact sheet (tools/characters/rig-review.mjs sheet).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def main():
    argv = sys.argv[sys.argv.index("--") + 1:]
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--height", type=float, required=True)
    parser.add_argument("--res", type=int, default=480)
    parser.add_argument("entries", nargs="+")
    args = parser.parse_args(argv)
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    H = args.height
    centre = Vector((0, 0, 0.5 * H))
    views = {
        "front": (Vector((0, -6 * H, 0.5 * H)), "ORTHO"),
        "back": (Vector((0, 6 * H, 0.5 * H)), "ORTHO"),
        "34": (Vector((2.3 * H, -2.6 * H, 1.05 * H)), "PERSP"),
    }
    for entry in args.entries:
        label, glb = entry.split("=", 1)
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(Path(glb).resolve()))
        scene = bpy.context.scene
        scene.render.engine = "BLENDER_EEVEE"
        scene.render.resolution_x = scene.render.resolution_y = args.res
        scene.render.image_settings.file_format = "PNG"
        scene.view_settings.view_transform = "Standard"
        scene.world = bpy.data.worlds.new("w")
        scene.world.color = (0.32, 0.33, 0.36)
        for name, rot, energy in (("key", (0.8, 0.1, 0.5), 3.2), ("fill", (-1.0, 0.0, 2.8), 1.4),
                                  ("back", (-0.9, 0.0, 0.3), 2.4)):
            light = bpy.data.objects.new(name, bpy.data.lights.new(name, "SUN"))
            light.data.energy = energy
            light.rotation_euler = rot
            scene.collection.objects.link(light)
        cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
        scene.collection.objects.link(cam)
        scene.camera = cam
        for view, (location, kind) in views.items():
            cam.data.type = kind
            cam.location = location
            look_at(cam, centre)
            if kind == "ORTHO":
                cam.data.ortho_scale = 1.2 * H
            else:
                cam.data.lens = 50
                cam.data.sensor_width = 36
                distance = (location - centre).length
                cam.data.lens = 36 * distance / (1.3 * H)
            scene.render.filepath = str(out / f"{label}-{view}.png")
            bpy.ops.render.render(write_still=True)
            print(f"RENDER {scene.render.filepath}")


main()
