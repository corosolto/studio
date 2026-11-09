"""Step 1 — clean the unrigged character mesh.

  Blender -b --python tools/blender/character_rig/rig_clean.py -- \
      --config characters/<id>/rig.json --source <mint-final.glb> --work <dir>

Turns the source so the character faces -Y (``forward`` in the config names the axis
the source faces), scales it to ``targetHeight`` metres with the feet on z=0, applies
every transform, merges coincident seam vertices by distance, dissolves degenerate
faces, recalculates outward normals and reports loose parts, holes and flips.

Writes ``clean.blend``, ``clean.json`` and ``clean-front/back/side.png`` in the work dir.
"""
from __future__ import annotations

import math
import sys
from collections import Counter
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

FORWARD_TO_Z_ANGLE = {"-Y": 0.0, "+Y": math.pi, "+X": -math.pi / 2, "-X": math.pi / 2}


def coincident_vertex_count(co: np.ndarray, digits: int = 6) -> int:
    keys = Counter(map(tuple, np.round(co, digits)))
    return sum(count for count in keys.values() if count > 1)


def loose_parts(bm):
    seen = set()
    parts = []
    for start in bm.verts:
        if start.index in seen:
            continue
        stack = [start]
        seen.add(start.index)
        members = []
        while stack:
            v = stack.pop()
            members.append(v)
            for e in v.link_edges:
                o = e.other_vert(v)
                if o.index not in seen:
                    seen.add(o.index)
                    stack.append(o)
        pts = np.array([v.co[:] for v in members])
        faces = {f.index for v in members for f in v.link_faces}
        parts.append({"vertices": len(members), "faces": len(faces),
                      "min": C.r(pts.min(axis=0), 3), "max": C.r(pts.max(axis=0), 3)})
    parts.sort(key=lambda p: -p["vertices"])
    return parts


def main():
    args = C.parse_args([("--source", {"required": True})])
    cfg = args.cfg
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(Path(args.source).resolve()))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        raise RuntimeError("source has no mesh")
    for o in list(bpy.context.scene.objects):
        if o.type != "MESH":
            continue
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    for o in [o for o in bpy.context.scene.objects if o.type != "MESH"]:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = "Body"
    body.data.name = "Body"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    forward = cfg.get("forward", "-Y")
    angle = FORWARD_TO_Z_ANGLE[forward]
    me = body.data
    if angle:
        me.transform(Matrix.Rotation(angle, 4, "Z"))
    co, _ = C.mesh_arrays(body)
    raw_lo, raw_hi = co.min(axis=0), co.max(axis=0)
    raw_height = float(raw_hi[2] - raw_lo[2])
    target = float(cfg.get("targetHeight", 1.7))
    scale = target / raw_height
    me.transform(Matrix.Scale(scale, 4))
    co, _ = C.mesh_arrays(body)
    low = co[co[:, 2] < co[:, 2].min() + 0.35 * target]
    cx = 0.5 * (low[:, 0].min() + low[:, 0].max())
    cy = 0.5 * (low[:, 1].min() + low[:, 1].max())
    shift = (-cx, -cy, -float(co[:, 2].min()))
    me.transform(Matrix.Translation(shift))
    me.update()

    co, _ = C.mesh_arrays(body)
    report = {
        "step": "clean", "source": str(Path(args.source).resolve()), "forward": forward,
        "rawHeight": C.r(raw_height, 5), "scale": C.r(scale, 5), "targetHeight": target,
        "translationAfterScale": C.r(shift, 5),
        "before": {"vertices": len(me.vertices), "faces": len(me.polygons),
                   "triangles": sum(len(p.vertices) - 2 for p in me.polygons),
                   "seamVertices": coincident_vertex_count(co)},
    }

    bm = C.bm_from(body)
    merge_dist = float(cfg.get("mergeDistance", 1e-4))
    before_verts = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=merge_dist)
    merged = before_verts - len(bm.verts)
    loose_verts = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose_verts, context="VERTS")
    bm.faces.ensure_lookup_table()
    zero_before = sum(1 for f in bm.faces if f.calc_area() < 1e-10)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-6, edges=bm.edges)
    bm.faces.ensure_lookup_table()
    zero_after = sum(1 for f in bm.faces if f.calc_area() < 1e-10)
    old_normals = [f.normal.copy() for f in bm.faces]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    flipped = sum(1 for f, n in zip(bm.faces, old_normals) if f.normal.dot(n) < 0)
    boundary = sum(1 for e in bm.edges if e.is_boundary)
    non_manifold = sum(1 for e in bm.edges if not e.is_manifold and not e.is_boundary)
    bm.verts.ensure_lookup_table()
    bm.verts.index_update()
    parts = loose_parts(bm)
    bm.to_mesh(me)
    bm.free()
    if me.has_custom_normals:
        bpy.context.view_layer.objects.active = body
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    for p in me.polygons:
        p.use_smooth = True
    me.update()

    co, _ = C.mesh_arrays(body)
    lo, hi = co.min(axis=0), co.max(axis=0)
    report.update({
        "mergeDistance": merge_dist, "mergedVertices": merged, "deletedLooseVertices": len(loose_verts),
        "after": {"vertices": len(me.vertices), "faces": len(me.polygons),
                  "triangles": sum(len(p.vertices) - 2 for p in me.polygons),
                  "seamVertices": coincident_vertex_count(co)},
        "zeroAreaFaces": {"before": zero_before, "after": zero_after},
        "flippedFaces": flipped, "boundaryEdges": boundary, "nonManifoldEdges": non_manifold,
        "height": C.r(hi[2] - lo[2], 4), "bounds": {"min": C.r(lo, 4), "max": C.r(hi, 4)},
        "looseParts": {"count": len(parts), "largest": parts[:12]},
    })
    C.save_blend(args.work / "clean.blend")
    C.ensure_sun()
    C.render_ortho_views(args.work / "clean", (lo.tolist(), hi.tolist()), views=("front", "back", "side"), res_per_m=360)
    C.write_json(args.work / "clean.json", report)
    print(f"CLEAN height={report['height']} seams {report['before']['seamVertices']}->{report['after']['seamVertices']} "
          f"merged={merged} flipped={flipped} loose={len(parts)} boundary={boundary}")


main()
