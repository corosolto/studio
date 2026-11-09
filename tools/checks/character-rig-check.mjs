#!/usr/bin/env node
// Deterministic check of the Blender character rig pipeline's Node half (docs/character-rig.md).
// Blender does not run in CI, so this check covers what CI can prove without it:
//   R1  the committed per-character rig configs (characters/*/rig.json) are well formed;
//   R2  joints.json validation accepts a sane skeleton and rejects each broken one;
//   R3  the meshy-28 skeleton the assembler builds has the contract's 28 joints in skin
//       order, the donor rest frames, and inverse bind matrices that reproduce the mesh;
//   R4  the pose test passes a synthetic, well-skinned humanoid (programmatic tubes, no real
//       asset bytes) and fails each mutant on the clause it breaks;
//   R5  every Blender step exits non-zero on exceptions, and the runner (with a fake Blender)
//       records input/output hashes and never continues on missing, stale or edited files.
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document } from '@gltf-transform/core';
import * as THREE from 'three';
import { meshy28Joints } from '../lib/character-pack.mjs';
import {
  ALIGNED_BONES, MESHY28_REST_WORLD, SYNTHETIC_POSES, assembleMeshy28Model, buildMeshy28Skeleton, deformJointNames, evaluatePoseReport,
  loadRig, measurePose, measureSetup, skinPositions, summarize, syntheticOverrides, uniqueJointNames, validateJoints,
} from '../lib/character-rig.mjs';

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
      const modes = [Boolean(extra.rigid), Boolean(extra.bones), Boolean(extra.kind)].filter(Boolean).length;
      assert(modes === 1, `${file}: extra ${extra.name} needs exactly one of rigid, bones or kind`);
      assert(!extra.kind || ['skirt', 'cape'].includes(extra.kind), `${file}: extra ${extra.name} has unknown kind ${extra.kind}`);
      assert(extra.measure === undefined || typeof extra.measure === 'boolean', `${file}: extra ${extra.name} measure must be true or false`);
      for (const bone of extra.rigid ? [extra.rigid] : extra.bones || []) assert(deformJointNames.includes(bone), `${file}: ${extra.name} names ${bone}, which is not a deforming meshy-28 bone`);
      for (const from of extra.select?.from || []) assert(partNames.has(from) || names.has(from), `${file}: ${extra.name} selects from unknown part ${from}`);
      const grow = extra.select?.grow;
      if (grow) {
        assert(Array.isArray(grow.seeds) && grow.seeds.length && grow.seeds.every((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)), `${file}: ${extra.name} grow.seeds must be [x, y, z] points`);
        assert(grow.crease === undefined || (grow.crease > 0 && grow.crease <= 180), `${file}: ${extra.name} grow.crease must be in (0, 180] degrees`);
        assert(grow.thickness === undefined || grow.thickness >= 0, `${file}: ${extra.name} grow.thickness must be >= 0`);
      }
      for (const part of extra.cut || []) assert(partNames.has(part), `${file}: ${extra.name} cuts from unknown body part ${part}`);
    }
    for (const [parent, child] of cfg.weights?.linearBlends || []) {
      assert(deformJointNames.includes(parent) && deformJointNames.includes(child), `${file}: linearBlends names a bone that does not deform`);
    }
    for (const joint of cfg.weights?.smoothJoints || []) assert(uniqueJointNames.includes(joint), `${file}: smoothJoints names unknown joint ${joint}`);
    assert([undefined, 'armpit', 'junction'].includes(cfg.joints?.shoulderAt), `${file}: joints.shoulderAt must be "armpit" or "junction"`);
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
// glTF space: +Y up, faces +Z, character left is +X. Joints follow the donor layout.
const J = {
  Hips: [0, 0.83, -0.02], LeftUpLeg: [0.08, 0.75, -0.01], LeftLeg: [0.1, 0.42, 0.03], LeftFoot: [0.11, 0.1, 0], LeftToeBase: [0.13, 0.04, 0.11],
  RightUpLeg: [-0.08, 0.75, -0.01], RightLeg: [-0.1, 0.42, 0.03], RightFoot: [-0.11, 0.1, 0], RightToeBase: [-0.13, 0.04, 0.11],
  Spine02: [0, 0.96, 0], Spine01: [0, 1.09, 0], Spine: [0, 1.22, 0],
  LeftShoulder: [0.035, 1.25, 0], LeftArm: [0.17, 1.25, 0], LeftForeArm: [0.4, 1.25, 0], LeftHand: [0.62, 1.25, 0],
  RightShoulder: [-0.035, 1.25, 0], RightArm: [-0.17, 1.25, 0], RightForeArm: [-0.4, 1.25, 0], RightHand: [-0.62, 1.25, 0],
  neck: [0, 1.32, 0], Head: [0, 1.39, 0], head_end: [0, 1.7, 0], headfront: [0, 1.39, 0.12], Curl_R: [-0.62, 1.25, 0], Curl_L: [0.62, 1.25, 0],
};
const TIPS = { LeftHandTip: [0.72, 1.25, 0], RightHandTip: [-0.72, 1.25, 0] };
const cleanJoints = Object.fromEntries(Object.entries(J).map(([n, [x, y, z]]) => [n, [x, -z, y]]));

/** Tubes along joint chains; each ring is weighted by a smoothstep blend around every joint. */
function synthBody({ mutant = null } = {}) {
  const positions = [], joints = [], weights = [], indices = [];
  const slot = new Map(meshy28Joints.map(([name], i) => [name, i]).reverse());
  const tube = (chain, radius, step = 0.02, sides = 8, blend = 0.05) => {
    const points = chain.map((n) => new THREE.Vector3(...(Array.isArray(n) ? n : J[n])));
    const names = chain.map((n) => (Array.isArray(n) ? null : n));
    const total = points.slice(1).reduce((s, p, i) => s + p.distanceTo(points[i]), 0);
    const rings = Math.max(2, Math.round(total / step) + 1);
    const start = positions.length / 3;
    const segLen = points.slice(1).map((p, i) => p.distanceTo(points[i]));
    for (let r = 0; r < rings; r += 1) {
      let d = (r / (rings - 1)) * total, seg = 0;
      while (seg < segLen.length - 1 && d > segLen[seg]) { d -= segLen[seg]; seg += 1; }
      const a = points[seg], b = points[seg + 1];
      const centre = a.clone().lerp(b, Math.min(1, d / segLen[seg]));
      const axis = b.clone().sub(a).normalize();
      const u = Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0).cross(axis).normalize() : new THREE.Vector3(1, 0, 0).cross(axis).normalize();
      const v = axis.clone().cross(u);
      // Bone owning this ring: the chain joint at the segment start. Within `blend` of a
      // joint the ring is shared with the bone across it, 50/50 exactly at the joint.
      const own = names[seg] ?? names[seg + 1];
      const next = names[seg + 1];
      const prev = seg > 0 ? names[seg - 1] : null;
      const toNext = segLen[seg] - d;
      let other = null, w = 0;
      if (next && next !== own && toNext < blend) { other = next; w = 0.5 * (1 - toNext / blend); }
      else if (prev && prev !== own && d < blend) { other = prev; w = 0.5 * (1 - d / blend); }
      if (mutant === 'hard-step') w = 0;
      for (let k = 0; k < sides; k += 1) {
        const ang = (k / sides) * Math.PI * 2;
        const p = centre.clone().addScaledVector(u, Math.cos(ang) * radius).addScaledVector(v, Math.sin(ang) * radius);
        positions.push(p.x, p.y, p.z);
        joints.push(slot.get(own), other ? slot.get(other) : 0, 0, 0);
        weights.push(1 - w, w, 0, 0);
      }
      if (r > 0) for (let k = 0; k < sides; k += 1) {
        const a0 = start + (r - 1) * sides + k, a1 = start + (r - 1) * sides + ((k + 1) % sides);
        const b0 = start + r * sides + k, b1 = start + r * sides + ((k + 1) % sides);
        indices.push(a0, b0, a1, a1, b0, b1);
      }
    }
  };
  tube(['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head', 'head_end'], 0.12);
  tube(['LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', [0.72, 1.25, 0]], 0.045);
  tube(['RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', [-0.72, 1.25, 0]], 0.045);
  tube(['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', [0.14, 0.03, 0.2]], 0.06);
  tube(['RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase', [-0.14, 0.03, 0.2]], 0.06);
  if (mutant === 'arm-weight-on-torso') {
    // Upper-back vertices of the spine tube take 60% LeftArm (the defect the part rules forbid).
    for (let i = 0; i < positions.length / 3; i += 1) {
      const [x, y, z] = positions.slice(i * 3, i * 3 + 3);
      if (y > 1.1 && y < 1.3 && z < -0.05 && Math.abs(x) < 0.15 && joints[i * 4] !== slot.get('LeftArm')) {
        joints[i * 4 + 1] = slot.get('LeftArm'); weights[i * 4] = 0.4; weights[i * 4 + 1] = 0.6;
      }
    }
  }
  if (mutant === 'split-seam') {
    // Duplicate one spine-ring vertex (a UV seam) and weight the copy to the left arm.
    const v = 40;
    positions.push(...positions.slice(v * 3, v * 3 + 3));
    joints.push(slot.get('LeftArm'), 0, 0, 0);
    weights.push(1, 0, 0, 0);
    indices.push(v, positions.length / 3 - 1, v + 1);
  }
  if (mutant === 'hand-on-spine') {
    // Every other ring of the left hand is skinned to Spine: lifting the arm tears the hand.
    for (let i = 0; i < positions.length / 3; i += 1) {
      const [x, y] = positions.slice(i * 3, i * 3 + 2);
      if (x > 0.63 && Math.abs(y - 1.25) < 0.06 && Math.round((x - 0.62) / 0.02) % 2 === 1) {
        joints.splice(i * 4, 4, slot.get('Spine'), 0, 0, 0);
        weights.splice(i * 4, 4, 1, 0, 0, 0);
      }
    }
  }
  return { positions, joints, weights, indices };
}

function synthDocument(options = {}) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const body = synthBody(options);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(body.positions)).setBuffer(buffer))
    .setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(new Uint16Array(body.joints)).setBuffer(buffer))
    .setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(new Float32Array(body.weights)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(body.indices)).setBuffer(buffer));
  const meshNode = doc.createNode('Body').setMesh(doc.createMesh('Body').addPrimitive(prim));
  const skeleton = buildMeshy28Skeleton(doc, { ...J, ...TIPS });
  if (options.mutant === 'stale-ibm') skeleton.joints[13].setTranslation(skeleton.joints[13].getTranslation().map((v, i) => v + (i === 1 ? 5 : 0)));
  const skin = doc.createSkin('meshy-28').setSkeleton(skeleton.joints[0])
    .setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(skeleton.inverseBindMatrices).setBuffer(buffer));
  for (const node of skeleton.joints) skin.addJoint(node);
  meshNode.setSkin(skin);
  doc.createScene('scene').addChild(meshNode).addChild(skeleton.armature);
  return doc;
}

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

// ------------------------------------------------------------------------------ R5 runner
/* The runner never continues on missing or stale step outputs. Blender itself cannot run in
   CI, so a fake Blender (a Node script with Blender's command line) writes each step's files;
   FAKE_SKIP=<step> makes it exit 0 without writing (what Blender did when a Python step
   raised before the steps called C.run_main), FAKE_FAIL=<step> makes it exit 1. */
clause('R5 every Blender step exits non-zero on exceptions (C.run_main)', () => {
  const dir = path.join(root, 'tools/blender/character_rig');
  const steps = readdirSync(dir).filter((f) => /^rig_.*\.py$/.test(f));
  for (const file of steps) assert(/\nC\.run_main\(main\)\s*$/.test(readFileSync(path.join(dir, file), 'utf8')), `${file} does not end with C.run_main(main)`);
  assert(/os\._exit\(1\)/.test(readFileSync(path.join(dir, 'common.py'), 'utf8')), 'common.run_main does not exit 1');
  return steps.join(', ');
});
{
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'rig-runner-'));
  const fake = path.join(tmp, 'fake-blender.mjs');
  writeFileSync(fake, `#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import path from 'node:path';
const argv = process.argv.slice(2);
const step = path.basename(argv[argv.indexOf('--python') + 1]).replace(/^rig_|\\.py$/g, '');
const work = argv[argv.indexOf('--work') + 1];
if (process.env.FAKE_FAIL === step) process.exit(1);
if (process.env.FAKE_SKIP === step) process.exit(0);
const views = { clean: ['front', 'back', 'side'], parts: ['front', 'back', 'side'], joints: ['front', 'side'] }[step];
const renders = views.flatMap((v) => [step + '-' + v + '.png', step + '-' + v + '.png.view.json']).filter((f) => f !== process.env.FAKE_NO_RENDER);
const files = { clean: ['clean.blend', 'clean.json'], parts: ['parts.blend', 'parts.json', 'parts-legend.json'], joints: ['joints-estimate.json'] }[step];
for (const f of [...files, ...renders]) writeFileSync(path.join(work, f), step + Date.now());
if (step === 'joints') writeFileSync(path.join(work, 'joints.json'), process.env.FAKE_JOINTS);
`);
  chmodSync(fake, 0o755);
  const config = path.join(tmp, 'rig.json');
  const source = path.join(tmp, 'source.glb');
  writeFileSync(config, JSON.stringify({ id: 'fake', targetHeight: 1.7 }));
  writeFileSync(source, 'mesh');
  const work = path.join(tmp, 'work');
  const runner = (from, env = {}) => spawnSync(process.execPath, [path.join(root, 'tools/characters/rig-character.mjs'),
    `--config=${config}`, `--work=${work}`, `--source=${source}`, `--from=${from}`, '--to=joints', '--no-clips', '--skip-review', `--blender=${fake}`],
  { encoding: 'utf8', env: { ...process.env, FAKE_JOINTS: JSON.stringify(baseJoints), ...env } });
  const expectFail = (result, pattern) => {
    assert(result.status !== 0, 'runner succeeded');
    assert(pattern.test(result.stderr), `expected ${pattern}, got ${result.stderr.split('\n').find((l) => /Error/.test(l)) || result.stderr.slice(0, 200)}`);
  };
  clause('R5 runner records clean -> parts -> joints with input and output hashes', () => {
    const result = runner('clean');
    assert(result.status === 0, result.stderr);
    const manifest = JSON.parse(readFileSync(path.join(work, 'run-manifest.json'), 'utf8'));
    assert(['clean', 'parts', 'joints'].every((s) => manifest.steps[s]?.outputs), 'manifest lacks a step');
    assert(manifest.steps.clean.inputs.source.sha256 && manifest.steps.joints.outputs['joints.json'], 'manifest lacks hashes');
  });
  clause('R5 mutant rejected: a step exits 0 without writing (stale joints.json is not reused)', () => {
    expectFail(runner('joints', { FAKE_SKIP: 'joints' }), /joints did not write joints\.json/);
    assert(!existsSync(path.join(work, 'joints.json')), 'the stale joints.json survived');
  });
  clause('R5 mutant rejected: a step exits 1', () => expectFail(runner('clean', { FAKE_FAIL: 'parts' }), /failed \(exit 1\)/));
  clause('R5 mutant rejected: a step leaves an old render behind', () => {
    assert(runner('clean').status === 0, 'baseline run failed');
    expectFail(runner('parts', { FAKE_NO_RENDER: 'parts-side.png' }), /parts did not write parts-side\.png/);
    assert(!existsSync(path.join(work, 'parts-side.png')), 'the stale parts-side.png survived');
  });
  clause('R5 mutant rejected: resuming after the config changed', () => {
    assert(runner('clean').status === 0, 'baseline run failed');
    writeFileSync(config, JSON.stringify({ id: 'fake', targetHeight: 1.6 }));
    expectFail(runner('joints'), /config .* changed since clean ran/);
  });
  clause('R5 mutant rejected: resuming on a hand-edited upstream output', () => {
    assert(runner('clean').status === 0, 'baseline run failed');
    writeFileSync(path.join(work, 'parts.json'), '{}');
    expectFail(runner('joints'), /parts\.json changed or vanished since parts ran/);
  });
  rmSync(tmp, { recursive: true, force: true });
}

if (failures) {
  console.error(`character-rig-check: ${failures} clause(s) failed`);
  process.exit(1);
}
console.log('PASS character rig pipeline (configs, joints.json, meshy-28 assembly, pose test and mutants)');
