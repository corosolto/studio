#!/usr/bin/env node
// Step 6 of the Blender character rig (docs/character-rig.md): turn Blender's skinned export
// into the meshy-28 GLB the game and the shared clips expect.
//
//   node tools/characters/rig-assemble.mjs <work> <out.glb>
//
// Reads <work>/blender-rig.glb (tools/blender/character_rig/rig_weights.py) and
// <work>/joints.json and runs assembleMeshy28Model (tools/lib/character-rig.mjs): Blender's
// skeleton is replaced by the 28-joint meshy-28 skin in skin order (duplicate Curl_R/Curl_L
// pair included) under an `Armature` node scaled 0.01, with the donor rest frames (arm frames
// aligned to the measured bones) and fresh inverse bind matrices. Weights are remapped by bone
// name; the mesh keeps Blender's welded topology, UVs and material.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assembleMeshy28Model } from '../lib/character-rig.mjs';

const [work, out] = process.argv.slice(2);
if (!work || !out) {
  console.error('usage: rig-assemble.mjs <work> <out.glb>');
  process.exit(1);
}
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(path.join(work, 'blender-rig.glb'));
const result = assembleMeshy28Model(doc, JSON.parse(readFileSync(path.join(work, 'joints.json'), 'utf8')));
await io.write(out, doc);
console.log(`ASSEMBLED ${out}: ${result.joints} joints (meshy-28), ${result.vertices} skinned vertices, bind error ${result.bindError.toExponential(2)} m${result.baked ? ', mesh transform baked' : ''}`);
