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
  ALIGNED_BONES, MESHY28_REST_WORLD, SYNTHETIC_POSES, buildMeshy28Skeleton, evaluatePoseReport, loadRig, measurePose, measureSetup,
  skinPositions, summarize, syntheticOverrides, uniqueJointNames, validateJoints,
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
      assert(Boolean(extra.rigid) !== Boolean(extra.bones), `${file}: extra ${extra.name} needs exactly one of rigid or bones`);
      for (const bone of extra.rigid ? [extra.rigid] : extra.bones) assert(uniqueJointNames.includes(bone), `${file}: ${extra.name} names unknown bone ${bone}`);
      for (const from of extra.select?.from || []) assert(partNames.has(from) || names.has(from), `${file}: ${extra.name} selects from unknown part ${from}`);
    }
    for (const [parent, child] of cfg.weights?.linearBlends || []) {
      assert(uniqueJointNames.includes(parent) && uniqueJointNames.includes(child), `${file}: linearBlends names unknown bones`);
    }
  }
  return configs.map(([dir]) => dir).join(', ');
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
const baseJoints = { units: 'm', skeleton: 'meshy-28', joints: cleanJoints };
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
];
for (const [name, mutate, expected] of jointMutants) {
  clause(`R2 joints.json mutant rejected: ${name}`, () => {
    const copy = JSON.parse(JSON.stringify(baseJoints));
    mutate(copy);
    const errors = validateJoints(copy);
    assert(errors.some((e) => expected.test(e)), `expected ${expected}, got ${JSON.stringify(errors)}`);
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
  ['arm-weight-on-torso', /back stretch|max edge stretch/],
  ['split-seam', /seam opens/],
  ['stale-ibm', /bind pose does not reproduce/],
  ['hard-step', /max edge stretch/],
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
