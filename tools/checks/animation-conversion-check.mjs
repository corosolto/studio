#!/usr/bin/env node
// Deterministic check of the animation conversion pipeline (docs/animation-conversion.md).
// No Mixamo or UAL bytes: every source is a synthetic skeleton built here (a three.js bone
// tree shaped like FBXLoader's Mixamo output, a glTF tree shaped like Quaternius UAL) with
// deliberately scrambled rest frames, so only convention-independent maths can pass.
//   A  convert: bone maps and hierarchy, rig detection, identity, world-delta transfer, spine
//      order, root motion modes, resampling/trim, facing, FBXLoader duplicate bones, UAL,
//      ground contact + foot IK on different leg proportions;
//   B  bake: absolute arms, Curl_* untouched, hips scale, metadata round trip, unmapped rigs;
//   Q  clip QA: a clean synthetic clip passes and each mutant fails on its own clause, and the
//      clip-qa CLI (with rig-pose-test.mjs --clips) gates skin stretch end to end.
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { meshy28Joints } from '../lib/character-pack.mjs';
import { clipSampler, deformJointNames, loadRig } from '../lib/character-rig.mjs';
import {
  MESHY28_REFERENCE_JOINTS, MIXAMO_TO_MESHY28, UAL_TO_MESHY28, clampToesToFloor, clipMetadata, gltfPoseSource, mixamoBaseName,
  objectPoseSource, referenceSkeletonDocument, retargetClip, skeletonGraph, writeClipDocument,
} from '../lib/animation-retarget.mjs';
import { RIG_MAPS, detectRig } from '../lib/animation-sources.mjs';
import { evaluateClip, measureClip } from '../lib/clip-qa.mjs';
import { J, synthDocument } from './lib/synthetic-humanoid.mjs';

let failures = 0;
const clause = async (name, fn) => {
  try { const note = await fn(); console.log(`PASS ${name}${note ? `: ${note}` : ''}`); }
  catch (error) { failures += 1; console.error(`FAIL ${name}: ${error.message}`); }
};
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const V = (a) => new THREE.Vector3(...a);
const Q = (axis, deg) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis).normalize(), THREE.MathUtils.degToRad(deg));
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

// ----------------------------------------------------------------------------- source rigs
const MIXAMO_PARENTS = {
  Hips: null, Spine: 'Hips', Spine1: 'Spine', Spine2: 'Spine1', Neck: 'Spine2', Head: 'Neck',
  LeftShoulder: 'Spine2', LeftArm: 'LeftShoulder', LeftForeArm: 'LeftArm', LeftHand: 'LeftForeArm',
  RightShoulder: 'Spine2', RightArm: 'RightShoulder', RightForeArm: 'RightArm', RightHand: 'RightForeArm',
  LeftUpLeg: 'Hips', LeftLeg: 'LeftUpLeg', LeftFoot: 'LeftLeg', LeftToeBase: 'LeftFoot',
  RightUpLeg: 'Hips', RightLeg: 'RightUpLeg', RightFoot: 'RightLeg', RightToeBase: 'RightFoot',
  HeadTop_End: 'Head', LeftHandIndex1: 'LeftHand',
};
const UAL_PARENTS = {
  root: null, pelvis: 'root', spine_01: 'pelvis', spine_02: 'spine_01', spine_03: 'spine_02', neck_01: 'spine_03', Head: 'neck_01',
  clavicle_l: 'spine_03', upperarm_l: 'clavicle_l', lowerarm_l: 'upperarm_l', hand_l: 'lowerarm_l', index_01_l: 'hand_l',
  clavicle_r: 'spine_03', upperarm_r: 'clavicle_r', lowerarm_r: 'upperarm_r', hand_r: 'lowerarm_r',
  thigh_l: 'pelvis', calf_l: 'thigh_l', foot_l: 'calf_l', ball_l: 'foot_l', ball_leaf_l: 'ball_l',
  thigh_r: 'pelvis', calf_r: 'thigh_r', foot_r: 'calf_r', ball_r: 'foot_r',
};
const meshyParent = new Map(meshy28Joints.map(([n, p]) => [n, p]));
const invert = (map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));

/* Source joint layout in metres (glTF frame) from a meshy-28 layout; unmapped helpers offset. */
function sourceLayout(map, parents, layout) {
  const inv = invert(map);
  const out = {};
  for (const name of Object.keys(parents)) {
    if (map[name]) out[name] = layout[map[name]];
    else if (parents[name] && out[parents[name]]) out[name] = out[parents[name]].map((v, i) => v + (i === 1 ? 0.08 : 0.01));
    else out[name] = [0, 0, 0];
  }
  for (const [meshy, src] of Object.entries(inv)) out[src] = layout[meshy];
  return out;
}
// A scrambled but deterministic rest frame per bone: conventions must not matter.
const scrambled = (i) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0.7 * i + 0.3, 1.3 * i + 0.1, 0.4 * i - 0.2));

/**
 * World pose function -> per-bone world rotations: `deltas[name]` rotates that joint (world
 * axes) and everything below it, composed down the chain.
 */
function worldPose(parents, restWorld, deltas) {
  const D = new Map(), W = new Map();
  const order = [];
  const visit = (n) => { order.push(n); for (const [c, p] of Object.entries(parents)) if (p === n) visit(c); };
  for (const [n, p] of Object.entries(parents)) if (!p) visit(n);
  for (const n of order) {
    const parentD = parents[n] ? D.get(parents[n]) : new THREE.Quaternion();
    D.set(n, deltas[n] ? deltas[n].clone().multiply(parentD) : parentD.clone());
    W.set(n, D.get(n).clone().multiply(restWorld.get(n)));
  }
  return { D, W, order };
}

/**
 * Mixamo-like three.js source in centimetres, as FBXLoader returns it (names `mixamorigX`).
 * frames(t) -> { deltas, hips: [x,y,z] world displacement in metres }.
 */
function mixamoSource({ layout = MESHY28_REFERENCE_JOINTS, frames, duration = 1, fps = 30, prefix = 'mixamorig', dupLeaves = false, yaw = 0, unit = 100 }) {
  const parents = MIXAMO_PARENTS;
  const pts = sourceLayout(MIXAMO_TO_MESHY28, parents, layout);
  const names = Object.keys(parents);
  const restWorld = new Map(names.map((n, i) => [n, scrambled(i)]));
  const group = new THREE.Group();
  group.rotation.y = yaw;
  const bones = new Map();
  for (const n of names) {
    const bone = new THREE.Bone();
    bone.name = `${prefix}${n}`;
    bones.set(n, bone);
  }
  if (dupLeaves) {
    // Skinned Mixamo FBX: FBXLoader adds a same-named leaf as the first child of each bone; the
    // animated bone is the outer one and the leaf must never be picked.
    for (const [n, bone] of bones) {
      const dup = new THREE.Bone();
      dup.name = bone.name;
      dup.quaternion.copy(Q([1, 1, 0], 70));
      bone.add(dup);
    }
  }
  for (const n of names) {
    const p = parents[n];
    const bone = bones.get(n);
    const worldPos = V(pts[n]).multiplyScalar(unit);
    if (p) {
      const pq = restWorld.get(p), pp = V(pts[p]).multiplyScalar(unit);
      bone.position.copy(worldPos.sub(pp).applyQuaternion(pq.clone().invert()));
      bone.quaternion.copy(pq.clone().invert().multiply(restWorld.get(n)));
      bones.get(p).add(bone);
    } else {
      bone.position.copy(worldPos);
      bone.quaternion.copy(restWorld.get(n));
      group.add(bone);
    }
  }
  const count = Math.round(duration * fps) + 1;
  const times = Array.from({ length: count }, (_, i) => Math.min(duration, i / fps));
  const values = new Map(names.map((n) => [n, []]));
  const hips = [];
  for (const t of times) {
    const f = frames(t);
    const { W } = worldPose(parents, restWorld, Object.fromEntries(Object.entries(f.deltas || {}).map(([meshy, q]) => [invert(MIXAMO_TO_MESHY28)[meshy] || meshy, q])));
    for (const n of names) {
      const local = parents[n] ? W.get(parents[n]).clone().invert().multiply(W.get(n)) : W.get(n);
      values.get(n).push(...local.toArray());
    }
    hips.push(...V(pts.Hips).add(V(f.hips || [0, 0, 0])).multiplyScalar(unit).toArray());
  }
  const tracks = names.map((n) => new THREE.QuaternionKeyframeTrack(`${prefix}${n}.quaternion`, times, values.get(n)));
  tracks.push(new THREE.VectorKeyframeTrack(`${prefix}Hips.position`, times, hips));
  const clip = new THREE.AnimationClip('mixamo.com', duration, tracks);
  return objectPoseSource(group, clip, MIXAMO_TO_MESHY28);
}

/** UAL-like glTF source: Z-up `root` (−90° about X) holding the pelvis tree, metres. */
function ualSource({ frames, duration = 1, fps = 30 }) {
  const parents = UAL_PARENTS;
  const pts = sourceLayout(UAL_TO_MESHY28, parents, MESHY28_REFERENCE_JOINTS);
  const names = Object.keys(parents);
  const rootQ = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);
  const restWorld = new Map(names.map((n, i) => [n, n === 'root' ? rootQ.clone() : scrambled(i + 3)]));
  pts.root = [0, 0, 0];
  const doc = new Document();
  const buffer = doc.createBuffer();
  const nodes = new Map();
  for (const n of names) {
    const p = parents[n];
    const pq = p ? restWorld.get(p) : new THREE.Quaternion();
    const pp = p ? V(pts[p]) : new THREE.Vector3();
    const node = doc.createNode(n).setTranslation(V(pts[n]).sub(pp).applyQuaternion(pq.clone().invert()).toArray())
      .setRotation(pq.clone().invert().multiply(restWorld.get(n)).toArray());
    nodes.set(n, node);
    if (p) nodes.get(p).addChild(node);
  }
  doc.createScene('s').addChild(doc.createNode('Armature').addChild(nodes.get('root')));
  const count = Math.round(duration * fps) + 1;
  const times = Float32Array.from({ length: count }, (_, i) => Math.min(duration, i / fps));
  const rot = new Map(names.map((n) => [n, []]));
  const pelvis = [];
  for (const t of times) {
    const f = frames(t);
    const { W } = worldPose(parents, restWorld, Object.fromEntries(Object.entries(f.deltas || {}).map(([meshy, q]) => [invert(UAL_TO_MESHY28)[meshy] || meshy, q])));
    for (const n of names) rot.get(n).push(...(parents[n] ? W.get(parents[n]).clone().invert().multiply(W.get(n)) : W.get(n)).toArray());
    pelvis.push(...V(pts.pelvis).add(V(f.hips || [0, 0, 0])).applyQuaternion(rootQ.clone().invert()).toArray());
  }
  const anim = doc.createAnimation('Synthetic_Loop');
  const input = doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer);
  const add = (n, pathName, type, arr) => {
    const s = doc.createAnimationSampler().setInput(input).setOutput(doc.createAccessor().setType(type).setArray(Float32Array.from(arr)).setBuffer(buffer)).setInterpolation('LINEAR');
    anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(nodes.get(n)).setTargetPath(pathName).setSampler(s));
  };
  for (const n of names) add(n, 'rotation', 'VEC4', rot.get(n));
  add('pelvis', 'translation', 'VEC3', pelvis);
  return gltfPoseSource(doc, anim, UAL_TO_MESHY28);
}

// ----------------------------------------------------------------------------- target FK
/** World joint positions of `graph` at frame i of a retarget result. */
function fk(graph, result, i) {
  const out = new Map(), world = new Map();
  for (const e of graph.order) {
    const r = result.rotations.get(e.name) && graph.byName.get(e.name) === e ? Array.from(result.rotations.get(e.name).slice(i * 4, i * 4 + 4)) : e.r;
    const t = e.name === 'Hips' ? Array.from(result.hips.slice(i * 3, i * 3 + 3)) : e.t;
    const local = new THREE.Matrix4().compose(V(t), new THREE.Quaternion(...r), V(e.s));
    const m = e.parent ? world.get(e.parent).clone().multiply(local) : local;
    world.set(e, m);
    if (!out.has(e.name)) out.set(e.name, new THREE.Vector3().setFromMatrixPosition(m));
  }
  return out;
}
const restPos = (graph, name) => graph.byName.get(name).restWorldP.clone();
const reference = skeletonGraph(referenceSkeletonDocument());
const still = () => ({ deltas: {} });

// ----------------------------------------------------------------------------- A convert
await clause('A1 Mixamo and UAL maps cover the 22 deforming meshy-28 joints once and keep the hierarchy', () => {
  for (const [label, map, parents] of [['mixamo', MIXAMO_TO_MESHY28, MIXAMO_PARENTS], ['ual', UAL_TO_MESHY28, UAL_PARENTS]]) {
    const targets = Object.values(map);
    assert(new Set(targets).size === targets.length, `${label}: a meshy-28 joint is mapped twice`);
    assert(JSON.stringify([...targets].sort()) === JSON.stringify([...deformJointNames].sort()), `${label}: maps ${targets.length} joints, expected exactly ${deformJointNames.join(',')}`);
    for (const [src, meshy] of Object.entries(map)) {
      let p = parents[src];
      while (p && !map[p]) p = parents[p];
      assert((p ? map[p] : null) === meshyParent.get(meshy), `${label}: ${src}->${meshy} sits under ${p ? map[p] : 'nothing'}, meshy-28 parent is ${meshyParent.get(meshy)}`);
    }
  }
  return 'spine order Spine->Spine02, Spine1->Spine01, Spine2->Spine (Mixamo); spine_01->Spine02 (UAL)';
});

await clause('A2 rig detection and Mixamo prefix normalisation', () => {
  assert(detectRig(['mixamorigHips', 'mixamorigSpine2']) === 'mixamo', 'FBXLoader names');
  assert(detectRig(['Hips', 'Spine2', 'LeftUpLeg']) === 'mixamo', 'unprefixed Unity export');
  assert(detectRig(['root', 'pelvis', 'spine_01', 'upperarm_l']) === 'ual', 'UAL');
  assert(detectRig(['Armature', 'Hips', 'Spine02', 'LeftUpLeg']) === 'meshy-28', 'meshy-28');
  assert(detectRig(['Bip01', 'Bip01 Pelvis']) === null, 'unknown rig must not be guessed');
  for (const n of ['mixamorig:LeftArm', 'mixamorigLeftArm', 'mixamorig1:LeftArm', 'LeftArm']) assert(mixamoBaseName(n) === 'LeftArm', n);
});

await clause('A3 a source at rest yields the reference rest pose (scrambled source frames)', () => {
  const result = retargetClip(mixamoSource({ frames: still }), reference);
  let worst = 0;
  const at = fk(reference, result, 0);
  for (const name of deformJointNames) worst = Math.max(worst, at.get(name).distanceTo(restPos(reference, name)));
  assert(worst < 1e-4, `joints move ${worst} m away from rest`);
  assert(result.mapped.length === 22 && !result.rotations.has('Curl_R'), `mapped ${result.mapped.length}`);
  return `${result.mapped.length} joints, worst ${worst.toExponential(1)} m`;
});

const armUpKneeHead = (t) => ({ deltas: { LeftArm: Q(Z, 90 * t), RightLeg: Q(X, 60 * t), Head: Q(Y, 30 * t) } });
await clause('A4 world-rotation deltas transfer onto the reference (arm up 90°, knee 60°, head 30°)', () => {
  const result = retargetClip(mixamoSource({ frames: armUpKneeHead }), reference, { footIk: false });
  const at = fk(reference, result, result.times.length - 1);
  const pivot = (joint, child, q) => restPos(reference, joint).add(restPos(reference, child).sub(restPos(reference, joint)).applyQuaternion(q));
  const hand = pivot('LeftArm', 'LeftHand', Q(Z, 90)).sub(restPos(reference, 'LeftArm'));
  const got = at.get('LeftHand').clone().sub(at.get('LeftArm'));
  assert(got.distanceTo(hand) < 1e-3, `left hand off by ${got.distanceTo(hand)} m`);
  const ankle = restPos(reference, 'RightFoot').sub(restPos(reference, 'RightLeg')).applyQuaternion(Q(X, 60));
  const gotAnkle = at.get('RightFoot').clone().sub(at.get('RightLeg'));
  assert(gotAnkle.distanceTo(ankle) < 1e-3, `right ankle off by ${gotAnkle.distanceTo(ankle)} m`);
  const front = at.get('headfront').clone().sub(at.get('Head'));
  const wantFront = restPos(reference, 'headfront').sub(restPos(reference, 'Head')).applyQuaternion(Q(Y, 30));
  assert(front.distanceTo(wantFront) < 1e-3, `head turn off by ${front.distanceTo(wantFront)} m`);
  return 'hand, ankle and head-front within 1 mm';
});

await clause('A5 Mixamo chest bend lands on meshy Spine, not on Spine02', () => {
  const result = retargetClip(mixamoSource({ frames: (t) => ({ deltas: { Spine: Q(X, 30 * t) } }) }), reference, { footIk: false });
  const i = result.times.length - 1;
  const at = fk(reference, result, i);
  const angle = (a, b) => THREE.MathUtils.radToDeg(at.get(b).clone().sub(at.get(a)).angleTo(restPos(reference, b).sub(restPos(reference, a))));
  const low = angle('Spine02', 'Spine01'), top = angle('Spine', 'neck');
  assert(low < 0.05 && Math.abs(top - 30) < 0.05, `Spine02 segment turned ${low}°, Spine segment ${top}° (expected 0 and 30)`);
  return `Spine02 ${low.toFixed(3)}°, Spine ${top.toFixed(2)}°`;
});

const walking = (t) => ({ deltas: {}, hips: [0.03 * Math.sin(2 * Math.PI * t), 0, 1.2 * t] });
await clause('A6 root motion: in-place keeps sway and records velocity; keep and strip', () => {
  const src = () => mixamoSource({ frames: walking });
  const scale = reference.byName.get('Hips').restWorldP.y / (MESHY28_REFERENCE_JOINTS.Hips[1] * 100);
  const inPlace = retargetClip(src(), reference, { footIk: false });
  const n = inPlace.times.length;
  const hipsX = (r, i) => fk(reference, r, i).get('Hips');
  const first = hipsX(inPlace, 0), last = hipsX(inPlace, n - 1), quarter = hipsX(inPlace, Math.round((n - 1) / 4));
  assert(first.distanceTo(last) < 1e-4, `in-place hips drift ${first.distanceTo(last)} m`);
  assert(Math.abs(quarter.x - first.x - 0.03 * scale * 100) < 1e-3, `sway ${quarter.x - first.x} m, expected ${0.03 * scale * 100}`);
  assert(Math.abs(inPlace.rootMotion.velocity[1] - 1.2 * scale * 100) < 1e-3 && inPlace.rootMotion.extracted, `velocity ${inPlace.rootMotion.velocity}`);
  const keep = retargetClip(src(), reference, { rootMotion: 'keep', footIk: false });
  assert(Math.abs(hipsX(keep, n - 1).z - hipsX(keep, 0).z - 1.2 * scale * 100) < 1e-3, 'keep must leave the drift in the clip');
  const strip = retargetClip(src(), reference, { rootMotion: 'strip', footIk: false });
  const rest = restPos(reference, 'Hips');
  assert(Math.abs(hipsX(strip, n - 1).x - rest.x) < 1e-5 && Math.abs(hipsX(strip, n - 1).z - rest.z) < 1e-5, 'strip must pin hips XZ to rest');
  return `velocity ${inPlace.rootMotion.velocity[1]} m/s (scaled ${(scale * 100).toFixed(4)})`;
});

await clause('A7 resampling to 30 fps and trimming', () => {
  const sweep = (t) => ({ deltas: { LeftArm: Q(Z, 90 * t) } });
  const r = retargetClip(mixamoSource({ frames: sweep, fps: 24 }), reference, { footIk: false });
  assert(r.times.length === 31 && Math.abs(r.times[30] - 1) < 1e-6, `24 fps source gave ${r.times.length} frames ending ${r.times.at(-1)}`);
  const trimmed = retargetClip(mixamoSource({ frames: sweep, fps: 24 }), reference, { start: 0.25, end: 0.75, footIk: false });
  assert(trimmed.times.length === 16 && Math.abs(trimmed.times.at(-1) - 0.5) < 1e-6, `trim gave ${trimmed.times.length} frames`);
  const at = fk(reference, trimmed, 0);
  const want = restPos(reference, 'LeftHand').sub(restPos(reference, 'LeftArm')).applyQuaternion(Q(Z, 22.5));
  assert(at.get('LeftHand').clone().sub(at.get('LeftArm')).distanceTo(want) < 2e-3, 'trimmed frame 0 is not the source pose at 0.25 s');
});

await clause('A8 a source facing -Z converts like one facing +Z', () => {
  const a = retargetClip(mixamoSource({ frames: armUpKneeHead }), reference, { footIk: false });
  const b = retargetClip(mixamoSource({ frames: armUpKneeHead, yaw: Math.PI }), reference, { footIk: false });
  let worst = 0;
  for (const i of [0, 15, 30]) { const pa = fk(reference, a, i), pb = fk(reference, b, i); for (const n of deformJointNames) worst = Math.max(worst, pa.get(n).distanceTo(pb.get(n))); }
  assert(worst < 1e-4, `facing changes the result by ${worst} m`);
});

await clause('A9 FBXLoader duplicate leaf bones and Mixamo prefixes do not change the result', () => {
  const a = retargetClip(mixamoSource({ frames: armUpKneeHead }), reference, { footIk: false });
  for (const [label, options] of [['duplicates', { dupLeaves: true }], ['mixamorig1 prefix', { prefix: 'mixamorig1' }], ['no prefix', { prefix: '' }]]) {
    const b = retargetClip(mixamoSource({ frames: armUpKneeHead, ...options }), reference, { footIk: false });
    let worst = 0;
    for (const [name, arr] of a.rotations) for (let k = 0; k < arr.length; k += 1) worst = Math.max(worst, Math.abs(arr[k] - b.rotations.get(name)[k]));
    assert(worst < 1e-5, `${label}: rotations differ by ${worst}`);
  }
});

await clause('A10 UAL glTF source (Z-up root) converts through UAL_TO_MESHY28', () => {
  const result = retargetClip(ualSource({ frames: armUpKneeHead }), reference, { footIk: false });
  const at = fk(reference, result, result.times.length - 1);
  const hand = restPos(reference, 'LeftHand').sub(restPos(reference, 'LeftArm')).applyQuaternion(Q(Z, 90));
  const err = at.get('LeftHand').clone().sub(at.get('LeftArm')).distanceTo(hand);
  assert(result.mapped.length === 22 && err < 1e-3, `mapped ${result.mapped.length}, hand off by ${err} m`);
  return `hand within ${err.toExponential(1)} m`;
});

/* Different proportions: the source's shins are 20% shorter (legs mirrored left to right). It squats (thighs forward,
   shins back) with the hips lowered so both source ankles stay planted. */
const shortShins = Object.fromEntries(Object.entries(MESHY28_REFERENCE_JOINTS).map(([n, p]) => [n, [...p]]));
const leftKnee = V(shortShins.LeftLeg);
for (const n of ['LeftFoot', 'LeftToeBase']) shortShins[n] = V(shortShins[n]).sub(leftKnee).multiplyScalar(0.8).add(leftKnee).toArray();
// Mirror the left leg so both source ankles stay exactly planted under one hips path.
for (const n of ['UpLeg', 'Leg', 'Foot', 'ToeBase']) shortShins[`Right${n}`] = [-shortShins[`Left${n}`][0], shortShins[`Left${n}`][1], shortShins[`Left${n}`][2]];
const squat = (layout, angle = (t) => 50 * Math.sin(Math.PI * t)) => {
  const thigh = V(layout.LeftLeg).sub(V(layout.LeftUpLeg)), shin = V(layout.LeftFoot).sub(V(layout.LeftLeg));
  return (t) => {
    const a = angle(t);
    // Hips offset that keeps the ankle where it stands: minus the change of hip→ankle.
    const moved = thigh.clone().applyQuaternion(Q(X, -a)).add(shin.clone().applyQuaternion(Q(X, a))).sub(thigh).sub(shin);
    return { deltas: { LeftUpLeg: Q(X, -a), RightUpLeg: Q(X, -a), LeftLeg: Q(X, 2 * a), RightLeg: Q(X, 2 * a), LeftFoot: Q(X, -a), RightFoot: Q(X, -a) }, hips: moved.negate().toArray() };
  };
};

await clause('A11 ground contact + foot IK keep planted feet still on different leg proportions', () => {
  const run = (options) => {
    const r = retargetClip(mixamoSource({ layout: shortShins, frames: squat(shortShins) }), reference, options);
    let slide = 0, sink = 0;
    for (let i = 0; i < r.times.length; i += 1) {
      const at = fk(reference, r, i);
      for (const n of ['LeftFoot', 'RightFoot']) {
        const d = at.get(n).clone().sub(restPos(reference, n));
        slide = Math.max(slide, Math.hypot(d.x, d.z));
        sink = Math.max(sink, Math.abs(d.y));
      }
    }
    return { slide, sink, r };
  };
  const fixed = run({});
  assert(fixed.slide < 0.005 && fixed.sink < 0.005, `ankles move ${fixed.slide} m / ${fixed.sink} m with contact + IK`);
  assert(Object.values(fixed.r.contacts).some((w) => w.length), 'source contacts not detected');
  const raw = run({ footContact: false, footIk: false });
  assert(raw.slide > 0.02 || raw.sink > 0.02, `without contact + IK the mismatch should show (${raw.slide}, ${raw.sink})`);
  return `with: ${(fixed.slide * 100).toFixed(2)} cm slide / ${(fixed.sink * 100).toFixed(2)} cm height; without: ${(raw.slide * 100).toFixed(1)} / ${(raw.sink * 100).toFixed(1)} cm`;
});

await clause('A11 foot IK ramps wrap the seam of a loop (first frame == last frame)', () => {
  // A periodic half squat whose only contact window ends 2 frames before the seam.
  const frames = squat(shortShins, (t) => 30 + 15 * Math.sin(2 * Math.PI * t));
  const run = (loop) => retargetClip(mixamoSource({ layout: shortShins, frames }), reference, { contacts: { LeftFoot: [[22, 28]] }, loop });
  const seam = (r) => {
    let worst = 0;
    for (const arr of r.rotations.values()) for (let k = 0; k < 4; k += 1) worst = Math.max(worst, Math.abs(Math.abs(arr[k]) - Math.abs(arr[(r.times.length - 1) * 4 + k])));
    return worst;
  };
  const looped = seam(run(true)), open = seam(run(false));
  assert(looped < 1e-5, `loop seam opens by ${looped} (quaternion component)`);
  assert(open > 1e-3, `a non-loop retarget should differ at the ends here (${open})`);
  return `seam ${looped.toExponential(1)} (non-loop ramp would leave ${open.toFixed(3)})`;
});

await clause('A12 limbs follow the source rest directions where the rests differ (straight vs bent knees)', () => {
  // Source legs and arms are straight lines (knees and elbows on the hip-ankle / shoulder-wrist
  // lines); the reference rests with bent knees and swept-back forearms.
  const straight = Object.fromEntries(Object.entries(MESHY28_REFERENCE_JOINTS).map(([n, p]) => [n, [...p]]));
  for (const [a, mid, b] of [['LeftUpLeg', 'LeftLeg', 'LeftFoot'], ['RightUpLeg', 'RightLeg', 'RightFoot'], ['LeftArm', 'LeftForeArm', 'LeftHand'], ['RightArm', 'RightForeArm', 'RightHand']]) {
    straight[mid] = V(straight[a]).lerp(V(straight[b]), 0.5).toArray();
  }
  const bend = (r, a, mid, b) => { const at = fk(reference, r, 0); return THREE.MathUtils.radToDeg(at.get(mid).clone().sub(at.get(a)).angleTo(at.get(b).clone().sub(at.get(mid)))); };
  const aligned = retargetClip(mixamoSource({ layout: straight, frames: still }), reference, { footIk: false });
  const raw = retargetClip(mixamoSource({ layout: straight, frames: still }), reference, { footIk: false, alignLimbs: [] });
  const knee = bend(aligned, 'LeftUpLeg', 'LeftLeg', 'LeftFoot'), elbow = bend(aligned, 'LeftArm', 'LeftForeArm', 'LeftHand');
  const rawKnee = bend(raw, 'LeftUpLeg', 'LeftLeg', 'LeftFoot');
  assert(knee < 0.1 && elbow < 0.1, `aligned knee ${knee}°, elbow ${elbow}° (expected straight like the source)`);
  assert(rawKnee > 5, `without alignment the reference's bent rest knee should remain (${rawKnee}°)`);
  return `knee ${knee.toFixed(3)}°, elbow ${elbow.toFixed(3)}° (unaligned knee ${rawKnee.toFixed(1)}°)`;
});

// ----------------------------------------------------------------------------- B bake
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
/* A character with longer legs and A-pose arms (40° down): absolute arms, delta legs. */
const aPose = Object.fromEntries(Object.entries(J).map(([n, p]) => [n, [...p]]));
for (const [side, sx] of [['Left', 1], ['Right', -1]]) {
  const shoulder = V(aPose[`${side}Arm`]);
  for (const n of [`${side}ForeArm`, `${side}Hand`, `Curl_${side[0]}`]) aPose[n] = V(aPose[n]).sub(shoulder).applyAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(-40 * sx)).add(shoulder).toArray();
}
const character = () => synthDocument({ joints: aPose });
const armsForwardWalk = (t) => ({ deltas: { LeftArm: Q(Y, -70), RightArm: Q(Y, 70), LeftUpLeg: Q(X, -20 * Math.sin(2 * Math.PI * t)), RightUpLeg: Q(X, 20 * Math.sin(2 * Math.PI * t)) } });
const referenceClip = (frames = armsForwardWalk, meta = {}) => {
  const r = retargetClip(mixamoSource({ frames }), reference, { footIk: false });
  return writeClipDocument(reference, r, 'clip', { fps: 30, loop: true, hold: 'rifle', rootMotion: r.rootMotion, contacts: r.contacts, ...meta });
};

await clause('B1 bake copies absolute arm directions, keeps legs as deltas, never animates Curl_*', async () => {
  const clipDoc = await io.readBinary(await io.writeBinary(referenceClip()));
  const source = gltfPoseSource(clipDoc, clipDoc.getRoot().listAnimations()[0], RIG_MAPS['meshy-28']);
  const target = skeletonGraph(character());
  const r = retargetClip(source, target, { rootMotion: 'keep', absoluteArms: true, footIk: false });
  assert(!r.rotations.has('Curl_R') && !r.rotations.has('Curl_L'), 'Curl_* animated');
  const i = 7;
  const refAt = fk(reference, retargetClip(gltfPoseSource(clipDoc, clipDoc.getRoot().listAnimations()[0], RIG_MAPS['meshy-28']), reference, { rootMotion: 'keep', footIk: false, footContact: false }), i);
  const at = fk(target, r, i);
  const dir = (m, a, b) => m.get(b).clone().sub(m.get(a)).normalize();
  const armErr = THREE.MathUtils.radToDeg(dir(at, 'LeftArm', 'LeftForeArm').angleTo(dir(refAt, 'LeftArm', 'LeftForeArm')));
  assert(armErr < 0.5, `A-pose character's arm points ${armErr}° away from the clip's`);
  const hipsScale = target.byName.get('Hips').restWorldP.y / reference.byName.get('Hips').restWorldP.y;
  assert(Math.abs(r.hipsScale - hipsScale) < 1e-9, `hips scale ${r.hipsScale}`);
  return `arm direction error ${armErr.toFixed(3)}°, hips scale ${hipsScale.toFixed(4)}`;
});

await clause('B2 clip metadata round-trips through the GLB and unmapped rigs are refused', async () => {
  const doc = await io.readBinary(await io.writeBinary(referenceClip()));
  const meta = clipMetadata(doc);
  assert(meta.schema === 'coro-solto/clip@1' && meta.skeleton === 'meshy-28' && meta.loop === true && meta.hold === 'rifle' && meta.rootMotion?.mode === 'in-place', JSON.stringify(meta).slice(0, 200));
  const stranger = new Document();
  stranger.createScene('s').addChild(stranger.createNode('Hips').addChild(stranger.createNode('Bip01 Spine')));
  let message = '';
  try { retargetClip(gltfPoseSource(doc, doc.getRoot().listAnimations()[0], RIG_MAPS['meshy-28']), skeletonGraph(stranger)); } catch (error) { message = error.message; }
  assert(/only 1 target joints map/.test(message), `expected a refusal, got ${message || 'success'}`);
});

// ----------------------------------------------------------------------------- Q clip QA
const body = synthDocument();
const bodyGraph = skeletonGraph(body);
const bodyRig = loadRig(body);
/** A meshy-28 clip on the synthetic body straight from world deltas (no retarget rules). */
function bodyClip(frames, meta, { duration = 1, fps = 30 } = {}) {
  const parents = Object.fromEntries(bodyGraph.order.filter((e) => e === bodyGraph.byName.get(e.name)).map((e) => [e.name, e.parent ? e.parent.name : null]));
  const restWorld = new Map(bodyGraph.order.map((e) => [e.name, e.restWorldQ]));
  const n = Math.round(duration * fps) + 1;
  const times = Float32Array.from({ length: n }, (_, i) => Math.min(duration, i / fps));
  const names = deformJointNames;
  const rotations = new Map(names.map((name) => [name, new Float32Array(n * 4)]));
  const hips = new Float32Array(n * 3);
  const hipsE = bodyGraph.byName.get('Hips');
  const parentInv = hipsE.parent.restWorld.clone().invert();
  times.forEach((t, i) => {
    const f = frames(t, i, n);
    const { W } = worldPose(parents, restWorld, f.deltas || {});
    for (const name of names) rotations.get(name).set((parents[name] ? W.get(parents[name]).clone().invert().multiply(W.get(name)) : W.get(name)).toArray(), i * 4);
    hips.set(hipsE.restWorldP.clone().add(V(f.hips || [0, 0, 0])).applyMatrix4(parentInv).toArray(), i * 3);
  });
  return writeClipDocument(bodyGraph, { times, rotations, hips }, 'q', { fps, ...meta });
}
const qa = async (doc) => {
  const reread = await io.readBinary(await io.writeBinary(doc));
  const meta = clipMetadata(reread);
  const metrics = measureClip(bodyRig, clipSampler(reread), meta);
  return { metrics, failures: evaluateClip(metrics, meta) };
};
const rifleHold = { LeftArm: Q(Y, -60), RightArm: Q(Y, 60) };
const goodClip = (extra = () => ({})) => (t, i, n) => {
  const e = extra(t, i, n);
  return { deltas: { ...rifleHold, ...(e.deltas || {}) }, hips: e.hips || [0, -0.004 * Math.sin(Math.PI * t) ** 2, 0] };
};
const loopMeta = { loop: true, hold: 'rifle' };

await clause('Q1 a clean synthetic rifle loop passes every clip gate', async () => {
  const { metrics, failures: f } = await qa(bodyClip(goodClip(), loopMeta));
  assert(!f.length, f.join('; '));
  return `slide ${metrics.footSlide.maxCm} cm, lowest ${metrics.lowestVertex.minCm}/${metrics.lowestVertex.maxCm} cm, seam ${metrics.loopSeam.positionCm} cm, grip ±${metrics.hands.maxDeviationCm} cm`;
});
await clause('Q1 in-place root motion is added back before measuring slide', async () => {
  // The body drifts backwards at 0.12 m/s in the clip; the declared root velocity cancels it.
  const meta = { ...loopMeta, loop: false, rootMotion: { mode: 'in-place', extracted: true, velocity: [0, 0.12], speed: 0.12 } };
  const { failures: f } = await qa(bodyClip(goodClip((t) => ({ hips: [0, 0, -0.12 * t] })), meta));
  assert(!f.length, f.join('; '));
});
const mutants = [
  ['planted feet slide 10 cm', goodClip((t) => ({ hips: [0.1 * t, 0, 0] })), { ...loopMeta, loop: false }, /foot slide/],
  ['feet sink 6 cm into the floor', goodClip(() => ({ hips: [0, -0.06, 0] })), loopMeta, /floor penetration/],
  ['body floats 6 cm', goodClip(() => ({ hips: [0, 0.06, 0] })), loopMeta, /floats/],
  ['hips over-extended', goodClip(() => ({ hips: [0, 0.1, 0] })), loopMeta, /hips rise/],
  ['loop seam breaks', goodClip((t, i, n) => ({ deltas: i === n - 1 ? { LeftArm: Q(Y, -30) } : {} })), loopMeta, /loop seam/],
  ['two-hand grip drifts', goodClip((t) => ({ deltas: { RightArm: Q(Y, 60 + 25 * Math.sin(2 * Math.PI * t)) } })), loopMeta, /two-hand grip/],
  ['contacts from the clip are honoured', goodClip((t) => ({ hips: [0.1 * t, 0, 0] })), { ...loopMeta, loop: false, contacts: { LeftFoot: [[0, 30]] } }, /foot slide .*LeftFoot/],
];
for (const [label, frames, meta, expected] of mutants) {
  await clause(`Q2 clip QA mutant rejected: ${label}`, async () => {
    const { failures: f } = await qa(bodyClip(frames, meta));
    assert(f.some((x) => expected.test(x)), `expected ${expected}, got ${f.join('; ') || 'a pass'}`);
    return f.find((x) => expected.test(x));
  });
}
await clause('Q2 airborne clips are exempt from the float and hips gates', async () => {
  const { failures: f } = await qa(bodyClip(goodClip(() => ({ hips: [0, 0.1, 0] })), { ...loopMeta, airborne: true }));
  assert(!f.some((x) => /floats|hips rise/.test(x)), f.join('; '));
});

await clause('Q3 clip-qa CLI gates skin stretch through rig-pose-test --clips (and --strict)', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'anim-check-'));
  try {
    const cli = fileURLToPath(new URL('../animations/clip-qa.mjs', import.meta.url));
    await io.write(path.join(dir, 'body.glb'), synthDocument());
    await io.write(path.join(dir, 'torn.glb'), synthDocument({ mutant: 'hand-on-spine' }));
    mkdirSync(path.join(dir, 'clips'));
    await io.write(path.join(dir, 'clips', 'rifle-loop.glb'), bodyClip(goodClip(), loopMeta));
    const run = (model) => {
      const out = path.join(dir, `${path.basename(model)}.json`);
      let code = 0;
      try { execFileSync(process.execPath, [cli, `--model=${model}`, `--clips=${path.join(dir, 'clips')}`, `--out=${out}`, '--samples=6', '--strict'], { stdio: 'pipe' }); } catch (error) { code = error.status; }
      return { code, report: JSON.parse(readFileSync(out, 'utf8')) };
    };
    const good = run(path.join(dir, 'body.glb'));
    assert(good.code === 0 && !good.report.failing.length, `clean body failed: ${good.report.results[0].failures.join('; ')}`);
    const torn = run(path.join(dir, 'torn.glb'));
    assert(torn.code === 1 && torn.report.results[0].failures.some((x) => /hand L stretch/.test(x)), `torn hand not caught: ${torn.report.results[0].failures.join('; ')}`);
    return `clean ${good.report.results[0].metrics.stretch.maxEdge.value}×, torn hand ${torn.report.results[0].metrics.stretch.handMaxEdgeL.value}×`;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

await clause('Q4 the bake-time toe clamp lifts toes pushed through the floor', async () => {
  const doc = bodyClip(() => ({ deltas: { LeftToeBase: Q(X, 35), RightToeBase: Q(X, 35) } }), { loop: false });
  const graph = skeletonGraph(doc);
  const anim = doc.getRoot().listAnimations()[0];
  const r = retargetClip(gltfPoseSource(doc, anim, RIG_MAPS['meshy-28']), bodyGraph, { rootMotion: 'keep', footIk: false, footContact: false });
  const before = measureClip(bodyRig, clipSampler(await io.readBinary(await io.writeBinary(writeClipDocument(graph, r, 'a', {})))), {});
  const stats = clampToesToFloor(bodyRig, r);
  const after = measureClip(bodyRig, clipSampler(await io.readBinary(await io.writeBinary(writeClipDocument(graph, r, 'b', {})))), {});
  assert(before.lowestVertex.minCm < -1 && after.lowestVertex.minCm >= -0.6 && stats.frames > 0, `toes ${before.lowestVertex.minCm} -> ${after.lowestVertex.minCm} cm (${JSON.stringify(stats)})`);
  return `lowest toe ${before.lowestVertex.minCm} -> ${after.lowestVertex.minCm} cm, ${stats.frames} frames, ≤${stats.maxDeg}°`;
});

if (failures) {
  console.error(`FAIL animation conversion: ${failures} clause(s)`);
  process.exit(1);
}
console.log('PASS animation conversion (maps, convert maths, root motion, contact/IK, bake rules, clip QA gates and mutants)');
