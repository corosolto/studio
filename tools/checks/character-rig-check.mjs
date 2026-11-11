#!/usr/bin/env node
// Deterministic check of the Blender character rig pipeline's Node half (docs/character-rig.md).
// Blender does not run in CI, so this check covers what CI can prove without it:
//   R1  the committed per-character rig configs (characters/*/rig.json) are well formed;
//   R2  joints.json validation accepts a sane skeleton and rejects each broken one;
//   R3  the meshy-28 skeleton the assembler builds has the contract's 28 joints in skin
//       order, the donor rest frames, and inverse bind matrices that reproduce the mesh;
//   R4  the pose test passes a synthetic, well-skinned humanoid (programmatic tubes, no real
//       asset bytes) and fails each mutant on the clause it breaks.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document } from '@gltf-transform/core';
import * as THREE from 'three';
import { meshy28Joints } from '../lib/character-pack.mjs';
import {
  ALIGNED_BONES, MESHY28_REST_WORLD, SYNTHETIC_POSES, assembleMeshy28Model, deformJointNames, evaluatePoseReport,
  loadRig, measurePose, measureSetup, skinPositions, summarize, syntheticOverrides, uniqueJointNames, validateJoints,
} from '../lib/character-rig.mjs';
import { J, TIPS, synthBody, synthDocument } from './lib/synthetic-humanoid.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
let failures = 0;
const clause = (name, fn) => {
  try { const note = fn(); console.log(`PASS ${name}${note ? `: ${note}` : ''}`); }
  catch (error) { failures += 1; console.error(`FAIL ${name}: ${error.message}`); }
};
const assert = (ok, message) => { if (!ok) throw new Error(message); };

// ------------------------------------------------------------------------------ R1 configs
const forwardAxes = new Set(['-Y', '+Y', '-X', '+X']);
const partNames = new Set(['torso', 'head', 'arm_L', 'arm_R', 'hand_L', 'hand_R', 'leg_L', 'leg_R']);
const configs = readdirSync(path.join(root, 'characters'))
  .filter((dir) => statSync(path.join(root, 'characters', dir)).isDirectory())
  .map((dir) => [dir, path.join(root, 'characters', dir, 'rig.json')])
  .filter(([, file]) => { try { return statSync(file).isFile(); } catch { return false; } });
clause('R1 character rig configs are well formed', () => {
  assert(configs.length >= 2, `expected the two pilot configs, found ${configs.length}`);
  for (const [dir, file] of configs) {
    const cfg = JSON.parse(readFileSync(file, 'utf8'));
    assert(cfg.id === dir, `${file}: id ${cfg.id} must equal the folder ${dir}`);
    assert(forwardAxes.has(cfg.forward ?? '-Y'), `${file}: forward must be one of ${[...forwardAxes]}`);
    assert(cfg.targetHeight > 0.3 && cfg.targetHeight < 3, `${file}: targetHeight out of range`);
    const names = new Set();
    for (const extra of cfg.extras || []) {
      assert(extra.name && !partNames.has(extra.name) && !names.has(extra.name), `${file}: extra names must be unique and not body parts (${extra.name})`);
      names.add(extra.name);
      assert(Boolean(extra.rigid) !== Boolean(extra.bones), `${file}: extra ${extra.name} needs exactly one of rigid or bones`);
      for (const bone of extra.rigid ? [extra.rigid] : extra.bones) assert(deformJointNames.includes(bone), `${file}: ${extra.name} names ${bone}, which is not a deforming meshy-28 bone`);
      for (const from of extra.select?.from || []) assert(partNames.has(from) || names.has(from), `${file}: ${extra.name} selects from unknown part ${from}`);
    }
    for (const [parent, child] of cfg.weights?.linearBlends || []) {
      assert(deformJointNames.includes(parent) && deformJointNames.includes(child), `${file}: linearBlends names a bone that does not deform`);
    }
    for (const joint of cfg.weights?.smoothJoints || []) assert(uniqueJointNames.includes(joint), `${file}: smoothJoints names unknown joint ${joint}`);
  }
  return configs.map(([dir]) => dir).join(', ');
});
clause('R1 the Blender steps use the contract meshy-28 list', () => {
  // tools/blender/character_rig/common.py cannot import the JavaScript contract; compare its
  // MESHY28 tuple list with meshy28Joints so the two cannot drift apart.
  const source = readFileSync(path.join(root, 'tools/blender/character_rig/common.py'), 'utf8');
  const block = /MESHY28 = \[([\s\S]*?)\n\]/.exec(source)?.[1];
  assert(block, 'MESHY28 list not found in common.py');
  const pairs = [...block.matchAll(/\("([^"]+)", (None|"([^"]+)")\)/g)].map((m) => [m[1], m[3] ?? null]);
  assert(JSON.stringify(pairs) === JSON.stringify(meshy28Joints), `common.py MESHY28 differs from meshy28Joints: ${JSON.stringify(pairs)}`);
  return `${pairs.length} joints in skin order`;
});

// ------------------------------------------------------------------------------ synthetic body
const cleanJoints = Object.fromEntries(Object.entries(J).map(([n, [x, y, z]]) => [n, [x, -z, y]]));

function poseReport(doc) {
  const rig = loadRig(doc);
  const setup = measureSetup(rig);
  const poses = SYNTHETIC_POSES.map((pose) => ({ kind: 'synthetic', name: pose.name, ...measurePose(rig, setup, skinPositions(rig, syntheticOverrides(rig, pose))) }));
  return { bindError: setup.bindError, poses, summary: summarize(poses) };
}

// ------------------------------------------------------------------------------ R2 joints.json
const baseJoints = {
  units: 'm', skeleton: 'meshy-28', joints: cleanJoints,
  tips: Object.fromEntries(Object.entries(TIPS).map(([n, [x, y, z]]) => [n.replace('Tip', ''), [x, -z, y]])),
};
clause('R2 joints.json validation accepts the synthetic skeleton', () => {
  const errors = validateJoints(baseJoints);
  assert(!errors.length, errors.join('; '));
  return `${uniqueJointNames.length} joints`;
});
const jointMutants = [
  ['missing joint', (j) => { delete j.joints.LeftHand; }, /LeftHand: missing/],
  ['left joint on the right', (j) => { j.joints.LeftForeArm[0] = -0.4; }, /LeftForeArm: left joints/],
  ['spine out of order', (j) => { j.joints.Spine01[2] = 0.9; }, /Spine02 must be below Spine01/],
  ['arm chain folds back', (j) => { j.joints.LeftHand[0] = 0.3; }, /Left arm chain/],
  ['unknown joint', (j) => { j.joints.Tail = [0, 0, 0]; }, /Tail: not a meshy-28 joint/],
  ['wrong skeleton id', (j) => { j.skeleton = 'mixamo'; }, /skeleton must be/],
  ['missing hand tip', (j) => { delete j.tips.RightHand; }, /tips\.RightHand: missing/],
  ['hand tip behind the wrist', (j) => { j.tips.LeftHand[0] = 0.5; }, /tips\.LeftHand must lie beyond LeftHand/],
];
for (const [name, mutate, expected] of jointMutants) {
  clause(`R2 joints.json mutant rejected: ${name}`, () => {
    const copy = JSON.parse(JSON.stringify(baseJoints));
    mutate(copy);
    const errors = validateJoints(copy);
    assert(errors.some((e) => expected.test(e)), `expected ${expected}, got ${JSON.stringify(errors)}`);
  });
}

// ------------------------------------------------------------------------------ R3 assembly
/* A Blender-like export of the synthetic body: Blender bone names (unique, the second Curl
   pair suffixed .001) in scrambled skin order, identity inverse binds, and the mesh under a
   translated parent. assembleMeshy28Model must remap every weight by name, bake the parent
   transform and land on exactly the deformation of the reference meshy-28 body. */
function blenderLikeDocument({ mutant = null } = {}) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const body = synthBody();
  const names = meshy28Joints.map(([name], i) => (meshy28Joints.findIndex(([n]) => n === name) === i ? name : `${name}.001`));
  const order = [...names.keys()].sort((a, b) => ((a * 7) % 28) - ((b * 7) % 28));
  const blenderIndex = new Map(order.map((slotIndex, i) => [slotIndex, i]));
  if (mutant === 'unknown-bone') names[order[0]] = 'Tail';
  const joints = body.joints.map((slotIndex) => blenderIndex.get(slotIndex));
  const weights = body.weights.slice();
  if (mutant === 'weightless-vertex') weights.splice(0, 4, 0, 0, 0, 0);
  const shift = [0.1, 0.02, -0.03];
  const positions = body.positions.map((v, i) => v - shift[i % 3]);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer))
    .setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(new Uint16Array(joints)).setBuffer(buffer))
    .setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(new Float32Array(weights)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(body.indices)).setBuffer(buffer));
  const holder = doc.createNode('Armature').setTranslation(shift);
  const meshNode = doc.createNode('Body').setMesh(doc.createMesh('Body').addPrimitive(prim));
  holder.addChild(meshNode);
  const ibm = new Float32Array(28 * 16);
  const skin = doc.createSkin('blender').setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(buffer));
  order.forEach((slotIndex, i) => {
    ibm.set(new THREE.Matrix4().elements, i * 16);
    const node = doc.createNode(names[slotIndex]);
    holder.addChild(node);
    skin.addJoint(node);
  });
  meshNode.setSkin(skin);
  doc.createScene('scene').addChild(holder);
  return doc;
}

clause('R3 assembly remaps Blender weights by name and bakes the mesh transform', () => {
  const doc = blenderLikeDocument();
  const result = assembleMeshy28Model(doc, JSON.parse(JSON.stringify(baseJoints)));
  assert(result.joints === 28 && result.baked, `expected 28 joints and a baked transform, got ${JSON.stringify(result)}`);
  const rig = loadRig(doc);
  rig.joints.forEach((node, i) => assert(node.getName() === meshy28Joints[i][0], `joint ${i} is ${node.getName()}`));
  const reference = loadRig(synthDocument());
  const pose = SYNTHETIC_POSES.find((p) => p.name === 'arms-up-90');
  const a = skinPositions(rig, syntheticOverrides(rig, pose))[0], b = skinPositions(reference, syntheticOverrides(reference, pose))[0];
  let worst = 0;
  for (let k = 0; k < a.length; k += 1) worst = Math.max(worst, Math.abs(a[k] - b[k]));
  assert(worst < 1e-4, `assembled body deforms differently from the reference (${worst} m)`);
  return `arms-up deformation matches to ${worst.toExponential(1)} m, bind error ${result.bindError.toExponential(1)} m`;
});
for (const [mutant, expected] of [['unknown-bone', /Tail is not a meshy-28 bone/], ['weightless-vertex', /vertex 0 has no skin weight/]]) {
  clause(`R3 assembly mutant rejected: ${mutant}`, () => {
    let message = '';
    try { assembleMeshy28Model(blenderLikeDocument({ mutant }), JSON.parse(JSON.stringify(baseJoints))); } catch (error) { message = error.message; }
    assert(expected.test(message), `expected ${expected}, got ${message || 'success'}`);
  });
}

// ------------------------------------------------------------------------------ R3 skeleton
clause('R3 assembled skeleton is meshy-28 with donor frames, aligned arm frames and exact bind', () => {
  const rig = loadRig(synthDocument());
  const parentName = (node) => { const p = rig.parent.get(node); return rig.joints.includes(p) ? p.getName() : null; };
  rig.joints.forEach((node, i) => {
    const [name, parent] = meshy28Joints[i];
    assert(node.getName() === name && parentName(node) === parent, `joint ${i} is ${node.getName()}<${parentName(node)}, expected ${name}<${parent}`);
  });
  const world = new Map();
  const worldOf = (n) => {
    if (world.has(n)) return world.get(n);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...n.getTranslation()), new THREE.Quaternion(...n.getRotation()), new THREE.Vector3(...n.getScale()));
    const p = rig.parent.get(n);
    const r = p ? worldOf(p).clone().multiply(m) : m;
    world.set(n, r); return r;
  };
  const points = { ...J, ...TIPS };
  for (const node of rig.joints) {
    const name = node.getName();
    const q = new THREE.Quaternion(), p = new THREE.Vector3();
    worldOf(node).decompose(p, q, new THREE.Vector3());
    assert(p.distanceTo(new THREE.Vector3(...J[name])) < 1e-5, `${name} is not at its joints.json position`);
    const aligned = ALIGNED_BONES[name];
    if (aligned) {
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      const bone = new THREE.Vector3(...points[aligned]).sub(p).normalize();
      assert(axis.dot(bone) > 0.99999, `${name} local +Y does not point at ${aligned}`);
    } else if (!/^Curl_/.test(name)) {
      const donor = new THREE.Quaternion(...MESHY28_REST_WORLD[name]).normalize();
      assert(Math.abs(q.dot(donor)) > 0.99999, `${name} rest frame differs from the donor`);
    }
  }
  const setup = measureSetup(rig);
  assert(setup.bindError < 1e-5, `bind error ${setup.bindError}`);
  return `bind error ${setup.bindError.toExponential(1)} m`;
});

// ------------------------------------------------------------------------------ R4 pose test
clause('R4 synthetic humanoid passes the pose thresholds', () => {
  const report = poseReport(synthDocument());
  const failed = evaluatePoseReport(report);
  assert(!failed.length, failed.join('; '));
  return `worst ${report.summary.synthetic.maxEdge.value}× (${report.summary.synthetic.maxEdge.pose})`;
});
const poseMutants = [
  ['arm-weight-on-torso', /back stretch/],
  ['split-seam', /seam opens/],
  ['stale-ibm', /bind pose does not reproduce/],
  ['hard-step', /max edge stretch/],
  ['hand-on-spine', /hand L stretch/],
];
for (const [mutant, expected] of poseMutants) {
  clause(`R4 pose-test mutant rejected: ${mutant}`, () => {
    const failed = evaluatePoseReport(poseReport(synthDocument({ mutant })));
    assert(failed.some((f) => expected.test(f)), `expected ${expected}, got ${failed.slice(0, 3).join('; ') || 'a pass'}`);
    return failed[0];
  });
}
clause('R4 a report without synthetic poses is rejected', () => {
  const failed = evaluatePoseReport({ bindError: 0, poses: [] });
  assert(failed.some((f) => /no synthetic poses/.test(f)), failed.join('; '));
});

if (failures) {
  console.error(`character-rig-check: ${failures} clause(s) failed`);
  process.exit(1);
}
console.log('PASS character rig pipeline (configs, joints.json, meshy-28 assembly, pose test and mutants)');
