#!/usr/bin/env node
// Step 6 of the Blender character rig (docs/character-rig.md): turn Blender's skinned export
// into the meshy-28 GLB the game and the shared clips expect.
//
//   node tools/characters/rig-assemble.mjs <work> <out.glb>
//
// Reads <work>/blender-rig.glb (tools/blender/character_rig/rig_weights.py) and
// <work>/joints.json, drops Blender's skeleton and builds the 28-joint meshy-28 skin in skin
// order (duplicate Curl_R/Curl_L pair included) under an `Armature` node scaled 0.01, with the
// donor's rest frames on the measured joint positions and fresh inverse bind matrices.
// Weights are remapped by bone name; the mesh keeps Blender's welded topology, UVs and
// material. Fails unless the bind pose reproduces the mesh to 0.1 mm.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { meshy28Joints } from '../lib/character-pack.mjs';
import { buildMeshy28Skeleton, cleanToGltf, loadRig, measureSetup, validateJoints } from '../lib/character-rig.mjs';

const [work, out] = process.argv.slice(2);
if (!work || !out) {
  console.error('usage: rig-assemble.mjs <work> <out.glb>');
  process.exit(1);
}
const jointsJson = JSON.parse(readFileSync(path.join(work, 'joints.json'), 'utf8'));
const errors = validateJoints(jointsJson);
if (errors.length) throw new Error(`joints.json is invalid:\n${errors.join('\n')}`);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(path.join(work, 'blender-rig.glb'));
const root = doc.getRoot();
const parent = new Map();
for (const n of root.listNodes()) for (const c of n.listChildren()) parent.set(c, n);
const skinned = root.listNodes().filter((n) => n.getSkin() && n.getMesh());
if (skinned.length !== 1) throw new Error(`expected one skinned mesh, found ${skinned.length}`);
const meshNode = skinned[0];
const oldSkin = meshNode.getSkin();

// Old joint index -> meshy-28 skin index (Blender's `.001` is the second Curl occurrence).
const slots = new Map();
meshy28Joints.forEach(([name], i) => { const list = slots.get(name) || []; list.push(i); slots.set(name, list); });
const remap = oldSkin.listJoints().map((joint) => {
  const match = /^(.*)\.(\d{3})$/.exec(joint.getName());
  const base = match ? match[1] : joint.getName();
  const occurrence = match ? Number(match[2]) : 0;
  const index = slots.get(base)?.[occurrence];
  if (index === undefined) throw new Error(`Blender joint ${joint.getName()} is not a meshy-28 bone`);
  return index;
});

// Bake the mesh node's world transform into the vertices (Blender usually exports identity).
const world = (n) => {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...n.getTranslation()), new THREE.Quaternion(...n.getRotation()), new THREE.Vector3(...n.getScale()));
  const p = parent.get(n);
  return p ? world(p).multiply(m) : m;
};
const meshWorld = world(meshNode);
const identity = meshWorld.equals(new THREE.Matrix4());
const normalMatrix = new THREE.Matrix3().getNormalMatrix(meshWorld);

let remapped = 0;
for (const prim of meshNode.getMesh().listPrimitives()) {
  if (!identity) {
    const pos = prim.getAttribute('POSITION');
    const v = new THREE.Vector3();
    const arr = pos.getArray().slice();
    for (let i = 0; i < pos.getCount(); i += 1) { v.fromArray(arr, i * 3).applyMatrix4(meshWorld).toArray(arr, i * 3); }
    pos.setArray(arr);
    const nrm = prim.getAttribute('NORMAL');
    if (nrm) {
      const narr = nrm.getArray().slice();
      for (let i = 0; i < nrm.getCount(); i += 1) v.fromArray(narr, i * 3).applyMatrix3(normalMatrix).normalize().toArray(narr, i * 3);
      nrm.setArray(narr);
    }
    prim.setAttribute('TANGENT', null);
  }
  const J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
  const joints = new Uint16Array(J.getCount() * 4), weights = new Float32Array(W.getCount() * 4);
  const j = [], w = [];
  for (let i = 0; i < J.getCount(); i += 1) {
    J.getElement(i, j); W.getElement(i, w);
    const sum = w.reduce((a, b) => a + b, 0);
    if (!(sum > 0)) throw new Error(`vertex ${i} has no skin weight`);
    for (let k = 0; k < 4; k += 1) {
      weights[i * 4 + k] = w[k] / sum;
      joints[i * 4 + k] = w[k] > 0 ? remap[j[k]] : 0;
    }
    remapped += 1;
  }
  prim.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(joints).setBuffer(J.getBuffer()));
  prim.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(weights).setBuffer(W.getBuffer()));
  J.dispose(); W.dispose();
}

const jointsGltf = Object.fromEntries(Object.entries(jointsJson.joints).map(([name, p]) => [name, cleanToGltf(p)]));
for (const side of ['Left', 'Right']) {
  const tip = jointsJson.tips?.[`${side}Hand`];
  if (tip) jointsGltf[`${side}HandTip`] = cleanToGltf(tip);
}
const skeleton = buildMeshy28Skeleton(doc, jointsGltf);
const buffer = root.listBuffers()[0];
const skin = doc.createSkin('meshy-28')
  .setSkeleton(skeleton.joints[0])
  .setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(skeleton.inverseBindMatrices).setBuffer(buffer));
for (const node of skeleton.joints) skin.addJoint(node);

const scene = root.listScenes()[0];
const keep = new Set([meshNode, skeleton.armature, ...skeleton.joints]);
for (const n of root.listNodes()) if (!keep.has(n)) n.dispose();
oldSkin.dispose();
meshNode.setSkin(skin).setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
for (const child of scene.listChildren()) scene.removeChild(child);
scene.addChild(meshNode).addChild(skeleton.armature);
for (const a of root.listAnimations()) a.dispose();

const setup = measureSetup(loadRig(doc));
if (!(setup.bindError <= 1e-4)) throw new Error(`bind pose does not reproduce the mesh: ${setup.bindError} m`);
await io.write(out, doc);
console.log(`ASSEMBLED ${out}: ${skin.listJoints().length} joints (meshy-28), ${remapped} skinned vertices, bind error ${setup.bindError.toExponential(2)} m${identity ? '' : ', mesh transform baked'}`);
