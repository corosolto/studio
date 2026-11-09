"""Render posed (static) character GLBs for animation contact sheets.

Blender -b --factory-startup --python tools/blender/render_clip_frames.py -- <out_dir> <height_m> <view> <posed.glb>...

Every frame uses the same camera, framed on a character of <height_m> standing at the origin
(glTF +Z forward is Blender -Y), so motion, crouch depth and floor contact compare across
frames and clips. <view> is `front34` (front three-quarter) or `side` (from the character's
left). The floor is a translucent plane at z = 0 with a 10 cm grid and a red horizon line
through the origin, so feet below the floor and sliding feet are visible.
"""
import math
import os
import sys

import bpy
from mathutils import Vector


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def grid_material():
    mat = bpy.data.materials.new('clip_floor')
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.9
    coord = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (10, 10, 10)  # one checker cell = 10 cm
    checker = nodes.new('ShaderNodeTexChecker')
    checker.inputs['Scale'].default_value = 1.0
    checker.inputs['Color1'].default_value = (0.075, 0.08, 0.09, 1)
    checker.inputs['Color2'].default_value = (0.04, 0.045, 0.055, 1)
    links.new(coord.outputs['Object'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], checker.inputs['Vector'])
    links.new(checker.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Alpha'].default_value = 0.82
    if hasattr(mat, 'surface_render_method'):
        mat.surface_render_method = 'BLENDED'
    return mat


def setup(height, view):
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
    floor = bpy.context.object
    floor.name = 'clip_floor'
    floor.data.materials.append(grid_material())
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.0005))
    line = bpy.context.object
    line.scale = (3, 0.002, 0.0005)
    red = bpy.data.materials.new('origin_line')
    red.diffuse_color = (0.9, 0.1, 0.1, 1)
    red.use_nodes = True
    red.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.9, 0.1, 0.1, 1)
    line.data.materials.append(red)
    centre = Vector((0, 0, height * 0.46))
    distance = height * 1.75
    if view == 'side':
        cam_loc = centre + Vector((distance, 0, height * 0.12))
    else:
        cam_loc = centre + Vector((distance * 0.62, -distance * 0.78, height * 0.25))
    bpy.ops.object.camera_add(location=cam_loc)
    camera = bpy.context.object
    look_at(camera, centre)
    camera.data.lens = 50
    bpy.context.scene.camera = camera
    for location, energy, color in (((-2, -3, 4), 900, (1.0, 0.9, 0.8)), ((3, 2, 2.5), 500, (0.6, 0.75, 1.0))):
        bpy.ops.object.light_add(type='AREA', location=location)
        lamp = bpy.context.object
        lamp.data.energy = energy
        lamp.data.size = 2.5
        lamp.data.color = color
        look_at(lamp, centre)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 360
    scene.render.resolution_y = 440
    scene.render.image_settings.file_format = 'PNG'
    scene.world = bpy.data.worlds.new('clip_world') if scene.world is None else scene.world
    scene.world.color = (0.03, 0.035, 0.045)
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = 0.6


def render(src, out_dir):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=src)
    imported = [o for o in bpy.context.scene.objects if o not in before]
    scene = bpy.context.scene
    scene.render.filepath = os.path.join(out_dir, os.path.basename(src).rsplit('.', 1)[0] + '.png')
    bpy.ops.render.render(write_still=True)
    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)
    print(f'RENDER {scene.render.filepath}')


args = sys.argv[sys.argv.index('--') + 1:]
out, height, view = os.path.abspath(args[0]), float(args[1]), args[2]
os.makedirs(out, exist_ok=True)
reset_scene()
setup(height, view)
for asset in args[3:]:
    render(os.path.abspath(asset), out)
