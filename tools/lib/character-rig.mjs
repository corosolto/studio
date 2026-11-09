// Shared, data-only helpers for the Blender character rig pipeline (docs/character-rig.md):
// meshy-28 rest frames, GLB skeleton assembly, CPU skinning identical to three.js, the
// numeric pose test and its thresholds, and joints.json validation.
import * as THREE from 'three';
import { meshy28Joints } from './character-pack.mjs';

/* Rest WORLD rotations of the meshy-28 donor (client public/models/characters/mst.glb),
   under its `Armature` node (identity rotation, scale 0.01: bones in centimetres, mesh in
   metres). Every meshy-28 bone points along its local +Y. The shared clips are baked against
   these frames. A new rig keeps them for the spine, legs, clavicles and head (the client's
   tools/retarget-glb.mjs applies world-rotation DELTAS there), and turns the arm, forearm and
   hand frames by the shortest arc that puts local +Y on the measured bone: retarget-glb
   copies ABSOLUTE clip world rotations onto every Arm/Hand bone, so only an aligned frame
   makes the character's arm segments point where the clip's arms point. */
export const ARMATURE_SCALE = 0.01;
export const MESHY28_REST_WORLD = Object.freeze({
  Hips: [0.255601, -0.000167, 0, 0.966782],
  LeftUpLeg: [0.994194, 0.04148, -0.04148, 0.090203],
  LeftLeg: [0.997357, 0.018624, -0.018624, -0.067714],
  LeftFoot: [0.847206, 0.063811, -0.063811, 0.523543],
  LeftToeBase: [0.703698, 0.069348, -0.069348, 0.703698],
  RightUpLeg: [0.993844, -0.04294, 0.04294, 0.092666],
  RightLeg: [0.995772, -0.00848, 0.00848, -0.091077],
  RightFoot: [0.863294, -0.06444, 0.06444, 0.496406],
  RightToeBase: [0.703446, -0.071858, 0.071858, 0.703446],
  Spine02: [0.098178, 0.000299, -0.000299, 0.995169],
  Spine01: [0.098178, 0.000299, -0.000299, 0.995169],
  Spine: [0.064775, 0.002315, -0.002315, 0.997894],
  LeftShoulder: [-0.499652, -0.500347, 0.500347, -0.499652],
  LeftArm: [0.448291, 0.576171, -0.57617, 0.367546],
  LeftForeArm: [0.519049, 0.500592, -0.500593, 0.478959],
  LeftHand: [0.594297, 0.454549, -0.454549, 0.483302],
  RightShoulder: [0.499658, -0.500342, 0.500342, 0.499658],
  RightArm: [-0.461271, 0.573156, -0.573156, -0.360851],
  RightForeArm: [0.518037, -0.500433, 0.500433, 0.480387],
  RightHand: [0.584804, -0.455945, 0.455946, 0.49217],
  neck: [0.098179, 0.000699, -0.000699, 0.995168],
  Head: [0.154824, 0.00063, -0.00063, 0.987942],
  head_end: [-0.02538, 0.000776, -0.000776, 0.999677],
  headfront: [0.707107, 0, 0, 0.707107],
  Curl_R: [0.584804, -0.455945, 0.455946, 0.49217],
  Curl_L: [0.594297, 0.454549, -0.454549, 0.483302],
});

export const uniqueJointNames = [...new Set(meshy28Joints.map(([name]) => name))];
/** Helper joints that never carry skin weight (Blender builds them with use_deform off). */
export const NON_DEFORM_JOINTS = Object.freeze(['head_end', 'headfront', 'Curl_R', 'Curl_L']);
export const deformJointNames = uniqueJointNames.filter((name) => !NON_DEFORM_JOINTS.includes(name));
/** Clean space (Blender: +Z up, faces -Y, left +X) to glTF (+Y up, faces +Z, left +X). */
export const cleanToGltf = ([x, y, z]) => [x, z, -y];

/** Validate a joints.json produced by tools/blender/character_rig/rig_joints.py. */
export function validateJoints(json) {
  const errors = [];
  if (json?.skeleton !== 'meshy-28') errors.push('skeleton must be "meshy-28"');
  if (json?.units !== 'm') errors.push('units must be "m"');
  const joints = json?.joints || {};
  for (const name of uniqueJointNames) {
    const p = joints[name];
    if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite)) errors.push(`${name}: missing or not three finite numbers`);
  }
  for (const name of Object.keys(joints)) if (!uniqueJointNames.includes(name)) errors.push(`${name}: not a meshy-28 joint`);
  if (errors.length) return errors;
  for (const name of uniqueJointNames) {
    const x = joints[name][0];
    if (/^Left|_L$/.test(name) && !(x > 0)) errors.push(`${name}: left joints must have x > 0 (character left is +X)`);
    if (/^Right|_R$/.test(name) && !(x < 0)) errors.push(`${name}: right joints must have x < 0`);
  }
  const z = (name) => joints[name][2];
  const order = [['Hips', 'Spine02'], ['Spine02', 'Spine01'], ['Spine01', 'Spine'], ['Spine', 'neck'], ['neck', 'Head'], ['Head', 'head_end'],
    ['LeftFoot', 'LeftLeg'], ['LeftLeg', 'LeftUpLeg'], ['RightFoot', 'RightLeg'], ['RightLeg', 'RightUpLeg']];
  for (const [low, high] of order) if (!(z(low) < z(high))) errors.push(`${low} must be below ${high}`);
  for (const side of ['Left', 'Right']) {
    const s = side === 'Left' ? 1 : -1;
    const chain = [`${side}Shoulder`, `${side}Arm`, `${side}ForeArm`, `${side}Hand`].map((n) => joints[n][0] * s);
    if (!chain.every((v, i) => i === 0 || v > chain[i - 1])) errors.push(`${side} arm chain must run outward from the spine`);
    // The hand rest frame is aimed at this tip (restWorldRotation): it has to lie past the
    // wrist along the forearm, or the aligned frame turns the hand back up the arm.
    const tip = json.tips?.[`${side}Hand`];
    if (!Array.isArray(tip) || tip.length !== 3 || !tip.every(Number.isFinite)) {
      errors.push(`tips.${side}Hand: missing or not three finite numbers`);
      continue;
    }
    const hand = joints[`${side}Hand`], fore = joints[`${side}ForeArm`];
    const along = [0, 1, 2].reduce((sum, k) => sum + (tip[k] - hand[k]) * (hand[k] - fore[k]), 0);
    if (!(along > 0) || !(tip[0] * s > hand[0] * s)) errors.push(`tips.${side}Hand must lie beyond ${side}Hand along the forearm`);
  }
  return errors;
}

/* Bones whose rest frame is aligned to the measured bone direction (child joint, or the hand
   tip for the hands), see MESHY28_REST_WORLD. */
export const ALIGNED_BONES = Object.freeze({
  LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand', LeftHand: 'LeftHandTip',
  RightArm: 'RightForeArm', RightForeArm: 'RightHand', RightHand: 'RightHandTip',
});

/** Rest world rotation of `name` for joints at `points` (glTF metres; may hold `<Side>HandTip`). */
export function restWorldRotation(name, points) {
  const donor = new THREE.Quaternion(...MESHY28_REST_WORLD[name]).normalize();
  const curlHand = { Curl_L: 'LeftHand', Curl_R: 'RightHand' }[name];
  if (curlHand) return restWorldRotation(curlHand, points);
  const target = ALIGNED_BONES[name] && points[ALIGNED_BONES[name]];
  if (!target) return donor;
  const along = new THREE.Vector3(...target).sub(new THREE.Vector3(...points[name]));
  if (along.length() < 1e-6) return donor;
  const donorAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(donor);
  return new THREE.Quaternion().setFromUnitVectors(donorAxis, along.normalize()).multiply(donor).normalize();
}

/**
 * Build the meshy-28 skeleton into `doc`: an `Armature` node (scale 0.01) holding 28 joints in
 * skin order, positioned at `jointsGltf` (metres, glTF space; `LeftHandTip`/`RightHandTip`
 * optional) with the rest frames of restWorldRotation().
 * Returns { armature, joints (nodes in skin order), inverseBindMatrices (Float32Array) }.
 */
export function buildMeshy28Skeleton(doc, jointsGltf) {
  const armature = doc.createNode('Armature').setScale([ARMATURE_SCALE, ARMATURE_SCALE, ARMATURE_SCALE]);
  const nodes = [];
  const worldOf = new Map();
  const firstByName = new Map();
  const armatureWorld = new THREE.Matrix4().makeScale(ARMATURE_SCALE, ARMATURE_SCALE, ARMATURE_SCALE);
  for (const [name, parentName] of meshy28Joints) {
    const position = new THREE.Vector3(...jointsGltf[name]);
    const rotation = restWorldRotation(name, jointsGltf);
    const world = new THREE.Matrix4().compose(position, rotation, new THREE.Vector3(ARMATURE_SCALE, ARMATURE_SCALE, ARMATURE_SCALE));
    const parentNode = parentName ? firstByName.get(parentName) : armature;
    const parentWorld = parentName ? worldOf.get(parentNode) : armatureWorld;
    const local = new THREE.Matrix4().copy(parentWorld).invert().multiply(world);
    const t = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    local.decompose(t, q, s);
    const node = doc.createNode(name).setTranslation(t.toArray()).setRotation(q.normalize().toArray()).setScale([1, 1, 1]);
    parentNode.addChild(node);
    // Recompose from the stored local TRS so the IBM matches exactly what a loader rebuilds.
    worldOf.set(node, new THREE.Matrix4().multiplyMatrices(parentWorld, new THREE.Matrix4().compose(t, q, new THREE.Vector3(1, 1, 1))));
    if (!firstByName.has(name)) firstByName.set(name, node);
    nodes.push(node);
  }
  const ibm = new Float32Array(nodes.length * 16);
  nodes.forEach((node, i) => ibm.set(worldOf.get(node).clone().invert().elements, i * 16));
  return { armature, joints: nodes, inverseBindMatrices: ibm };
}

// ------------------------------------------------------------------------------------------
// CPU skinning (same maths as three.js SkinnedMesh with the identity bind matrix the
// GLTFLoader uses): v' = Σ w · (jointWorld · IBM) · v.

const localMatrix = (trs) => new THREE.Matrix4().compose(new THREE.Vector3(...trs.t), new THREE.Quaternion(...trs.r), new THREE.Vector3(...trs.s));

export function loadRig(doc) {
  const nodes = doc.getRoot().listNodes();
  const parent = new Map();
  for (const n of nodes) for (const c of n.listChildren()) parent.set(c, n);
  const skinned = nodes.find((n) => n.getSkin() && n.getMesh());
  if (!skinned) throw new Error('no skinned mesh');
  const skin = skinned.getSkin();
  const joints = skin.listJoints();
  const ibm = joints.map((_, i) => new THREE.Matrix4().fromArray(skin.getInverseBindMatrices().getElement(i, [])));
  const trs = new Map(nodes.map((n) => [n, { t: n.getTranslation(), r: n.getRotation(), s: n.getScale() }]));
  const byName = new Map();
  for (const n of nodes) { const list = byName.get(n.getName()) || []; list.push(n); byName.set(n.getName(), list); }
  const prims = skinned.getMesh().listPrimitives().map((p) => ({
    pos: p.getAttribute('POSITION').getArray(), J: p.getAttribute('JOINTS_0').getArray(),
    W: p.getAttribute('WEIGHTS_0').getArray(), idx: p.getIndices()?.getArray() || null,
    count: p.getAttribute('POSITION').getCount(),
  }));
  return { doc, nodes, parent, skin, joints, names: joints.map((j) => j.getName()), ibm, trs, byName, prims };
}

export function worldMatrices(rig, overrides = new Map()) {
  const cache = new Map();
  const world = (n) => {
    if (cache.has(n)) return cache.get(n);
    const m = localMatrix(overrides.get(n) || rig.trs.get(n));
    const p = rig.parent.get(n);
    const result = p ? new THREE.Matrix4().multiplyMatrices(world(p), m) : m;
    cache.set(n, result);
    return result;
  };
  return world;
}

export function skinPositions(rig, overrides = new Map()) {
  const world = worldMatrices(rig, overrides);
  const mats = rig.joints.map((j, i) => new THREE.Matrix4().multiplyMatrices(world(j), rig.ibm[i]).elements);
  const acc = new Float64Array(16);
  return rig.prims.map((p) => {
    const out = new Float32Array(p.count * 3);
    for (let v = 0; v < p.count; v += 1) {
      acc.fill(0);
      for (let k = 0; k < 4; k += 1) {
        const w = p.W[v * 4 + k];
        if (!w) continue;
        const e = mats[p.J[v * 4 + k]];
        for (let q = 0; q < 16; q += 1) acc[q] += e[q] * w;
      }
      const x = p.pos[v * 3], y = p.pos[v * 3 + 1], z = p.pos[v * 3 + 2];
      out[v * 3] = acc[0] * x + acc[4] * y + acc[8] * z + acc[12];
      out[v * 3 + 1] = acc[1] * x + acc[5] * y + acc[9] * z + acc[13];
      out[v * 3 + 2] = acc[2] * x + acc[6] * y + acc[10] * z + acc[14];
    }
    return out;
  });
}

// ------------------------------------------------------------------------------------------
// Poses.

const AXIS = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const deg = (d) => (d * Math.PI) / 180;

/* Synthetic poses as WORLD rotations about joints (glTF: +Y up, +Z forward, left +X), applied
   parent first. They exercise each region hard and independently of any clip retarget. */
export const SYNTHETIC_POSES = Object.freeze([
  { name: 'arms-up-90', steps: [['LeftArm', 'z', 90], ['RightArm', 'z', -90]] },
  { name: 'arms-forward-60', steps: [['LeftArm', 'y', -60], ['RightArm', 'y', 60]] },
  { name: 'step-left', steps: [['LeftUpLeg', 'x', -45], ['LeftLeg', 'x', 60]] },
  { name: 'step-right', steps: [['RightUpLeg', 'x', -45], ['RightLeg', 'x', 60]] },
  { name: 'head-turn-60', steps: [['neck', 'y', 30], ['Head', 'y', 30]] },
]);

export function syntheticOverrides(rig, pose) {
  const overrides = new Map();
  for (const [jointName, axis, degrees] of pose.steps) {
    for (const node of rig.byName.get(jointName) || []) {
      const world = worldMatrices(rig, overrides);
      const q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
      world(node).decompose(p, q, s);
      const qp = new THREE.Quaternion();
      const parentNode = rig.parent.get(node);
      if (parentNode) world(parentNode).decompose(new THREE.Vector3(), qp, new THREE.Vector3());
      const target = new THREE.Quaternion().setFromAxisAngle(AXIS[axis], deg(degrees)).multiply(q);
      const local = qp.clone().invert().multiply(target).normalize();
      overrides.set(node, { ...(overrides.get(node) || rig.trs.get(node)), r: local.toArray() });
    }
  }
  return overrides;
}

/**
 * Float values of an accessor: normalized integer arrays (glTF allows normalized byte/short
 * quaternion outputs in animations, which three.js's GLTFLoader dequantizes) are scaled back to
 * [-1, 1] / [0, 1] the same way.
 */
export function accessorFloats(accessor) {
  const a = accessor.getArray();
  if (!accessor.getNormalized() || a instanceof Float32Array) return a;
  const max = { Int8Array: 127, Uint8Array: 255, Int16Array: 32767, Uint16Array: 65535 }[a.constructor.name];
  if (!max) throw new Error(`unsupported normalized component type ${a.constructor.name}`);
  return Float32Array.from(a, (v) => Math.max(v / max, -1));
}

/** Sampler over an animation of a clip GLB document (the first by default; LINEAR/STEP/CUBICSPLINE). */
export function clipSampler(doc, animation = null) {
  const anim = animation || doc.getRoot().listAnimations()[0];
  if (!anim) return null;
  const channels = [];
  for (const ch of anim.listChannels()) {
    const s = ch.getSampler(), target = ch.getTargetNode();
    if (!s || !target || ch.getTargetPath() === 'weights') continue;
    const n = ch.getTargetPath() === 'rotation' ? 4 : 3;
    channels.push({ name: target.getName(), path: ch.getTargetPath(), times: s.getInput().getArray(), values: accessorFloats(s.getOutput()), n, cubic: s.getInterpolation() === 'CUBICSPLINE', step: s.getInterpolation() === 'STEP' });
  }
  const duration = Math.max(0, ...channels.map((c) => c.times[c.times.length - 1]));
  const value = (c, t) => {
    const T = c.times; let i = 0;
    while (i < T.length - 2 && T[i + 1] <= t) i += 1;
    const f = T.length > 1 && !c.step ? Math.min(1, Math.max(0, (t - T[i]) / ((T[i + 1] - T[i]) || 1))) : 0;
    const at = (k) => { const base = c.cubic ? (k * 3 + 1) * c.n : k * c.n; return Array.from(c.values.slice(base, base + c.n)); };
    const a = at(i), b = at(Math.min(i + 1, T.length - 1));
    if (c.n === 4) return new THREE.Quaternion().fromArray(a).slerp(new THREE.Quaternion().fromArray(b), f).toArray();
    return a.map((x, k) => x + (b[k] - x) * f);
  };
  return { duration, pose: (t) => channels.map((c) => ({ name: c.name, path: c.path, value: value(c, t) })) };
}

export function clipOverrides(rig, sampler, t) {
  const overrides = new Map();
  for (const { name, path, value } of sampler.pose(t)) {
    for (const node of rig.byName.get(name) || []) {
      const base = overrides.get(node) || { ...rig.trs.get(node) };
      overrides.set(node, { ...base, [path === 'translation' ? 't' : path === 'rotation' ? 'r' : 's']: value });
    }
  }
  return overrides;
}

// ------------------------------------------------------------------------------------------
// Measurement.

const MIN_EDGE = 5e-4; // edges shorter than 0.5 mm are ignored (ratios of slivers are noise)

/** Precompute edges, regions and seam groups from the bind pose. */
export function measureSetup(rig) {
  const bind = skinPositions(rig);
  let bindError = 0;
  rig.prims.forEach((p, pi) => { for (let k = 0; k < p.pos.length; k += 1) bindError = Math.max(bindError, Math.abs(bind[pi][k] - p.pos[k])); });
  const world = worldMatrices(rig);
  const jointPos = (name) => { const n = rig.byName.get(name)?.[0]; return n ? new THREE.Vector3().setFromMatrixPosition(world(n)) : null; };
  const hips = jointPos('Hips'), neck = jointPos('neck'), spine01 = jointPos('Spine01'), lArm = jointPos('LeftArm'), rArm = jointPos('RightArm');
  const halfWidth = Math.max(Math.abs(lArm?.x ?? 0.2), Math.abs(rArm?.x ?? 0.2)) + 0.02;
  const handIdx = { L: new Set(), R: new Set() };
  rig.names.forEach((n, i) => { if (n === 'LeftHand' || n === 'Curl_L') handIdx.L.add(i); if (n === 'RightHand' || n === 'Curl_R') handIdx.R.add(i); });
  const prims = rig.prims.map((p, pi) => {
    const s = bind[pi];
    const idx = p.idx || Uint32Array.from({ length: p.count }, (_, i) => i);
    const seen = new Set();
    const edges = [];
    for (let t = 0; t + 2 < idx.length; t += 3) {
      for (const [a, b] of [[idx[t], idx[t + 1]], [idx[t + 1], idx[t + 2]], [idx[t + 2], idx[t]]]) {
        const key = a < b ? a * 4294967296 + b : b * 4294967296 + a;
        if (seen.has(key)) continue;
        seen.add(key);
        const L = Math.hypot(s[a * 3] - s[b * 3], s[a * 3 + 1] - s[b * 3 + 1], s[a * 3 + 2] - s[b * 3 + 2]);
        if (L > MIN_EDGE) edges.push([a, b, L]);
      }
    }
    const handWeight = (side, v) => { let w = 0; for (let k = 0; k < 4; k += 1) if (handIdx[side].has(p.J[v * 4 + k])) w += p.W[v * 4 + k]; return w; };
    const isBack = (v) => hips && neck && spine01 && s[v * 3 + 1] > hips.y && s[v * 3 + 1] < neck.y && s[v * 3 + 2] < spine01.z - 0.02 && Math.abs(s[v * 3]) < halfWidth;
    const regions = { back: [], handL: [], handR: [] };
    edges.forEach((e, ei) => {
      if (isBack(e[0]) && isBack(e[1])) regions.back.push(ei);
      if (handWeight('L', e[0]) >= 0.25 || handWeight('L', e[1]) >= 0.25) regions.handL.push(ei);
      if (handWeight('R', e[0]) >= 0.25 || handWeight('R', e[1]) >= 0.25) regions.handR.push(ei);
    });
    const groups = new Map();
    for (let v = 0; v < p.count; v += 1) {
      const key = `${Math.round(s[v * 3] * 1e5)},${Math.round(s[v * 3 + 1] * 1e5)},${Math.round(s[v * 3 + 2] * 1e5)}`;
      const list = groups.get(key); if (list) list.push(v); else groups.set(key, [v]);
    }
    const seams = [...groups.values()].filter((g) => g.length > 1);
    return { edges, regions, seams, bind: s };
  });
  return {
    bind, bindError, prims,
    hasBack: prims.some((p) => p.regions.back.length),
    hasHands: { L: prims.some((p) => p.regions.handL.length), R: prims.some((p) => p.regions.handR.length) },
  };
}

function topBones(rig, pi, v) {
  const p = rig.prims[pi];
  const list = [];
  for (let k = 0; k < 4; k += 1) if (p.W[v * 4 + k] > 0) list.push([rig.names[p.J[v * 4 + k]], +p.W[v * 4 + k].toFixed(3)]);
  return list.sort((a, b) => b[1] - a[1]);
}

/** Stretch metrics of one posed state against the bind pose. */
export function measurePose(rig, setup, posed, { worst = 10 } = {}) {
  let maxEdge = 1, back = 1, handL = 1, handR = 1, seamGap = 0;
  const ratios = [];
  const perVertex = [];
  setup.prims.forEach((sp, pi) => {
    const s = posed[pi];
    const vmax = new Float32Array(rig.prims[pi].count).fill(1);
    const r = new Float32Array(sp.edges.length);
    sp.edges.forEach(([a, b, L], ei) => {
      const ratio = Math.hypot(s[a * 3] - s[b * 3], s[a * 3 + 1] - s[b * 3 + 1], s[a * 3 + 2] - s[b * 3 + 2]) / L;
      r[ei] = ratio;
      ratios.push(ratio);
      if (ratio > maxEdge) maxEdge = ratio;
      if (ratio > vmax[a]) vmax[a] = ratio;
      if (ratio > vmax[b]) vmax[b] = ratio;
    });
    for (const ei of sp.regions.back) back = Math.max(back, r[ei]);
    for (const ei of sp.regions.handL) handL = Math.max(handL, r[ei]);
    for (const ei of sp.regions.handR) handR = Math.max(handR, r[ei]);
    for (const group of sp.seams) {
      const [a] = group;
      for (const b of group.slice(1)) seamGap = Math.max(seamGap, Math.hypot(s[a * 3] - s[b * 3], s[a * 3 + 1] - s[b * 3 + 1], s[a * 3 + 2] - s[b * 3 + 2]));
    }
    vmax.forEach((ratio, v) => perVertex.push([ratio, pi, v]));
  });
  ratios.sort((a, b) => a - b);
  perVertex.sort((a, b) => b[0] - a[0]);
  const seenPositions = new Set();
  const worstVertices = [];
  for (const [ratio, pi, v] of perVertex) {
    const b = setup.prims[pi].bind;
    const key = `${b[v * 3].toFixed(4)},${b[v * 3 + 1].toFixed(4)},${b[v * 3 + 2].toFixed(4)}`;
    if (seenPositions.has(key)) continue;
    seenPositions.add(key);
    worstVertices.push({ vertex: v, primitive: pi, ratio: +ratio.toFixed(3), rest: [b[v * 3], b[v * 3 + 1], b[v * 3 + 2]].map((x) => +x.toFixed(4)), bones: topBones(rig, pi, v) });
    if (worstVertices.length >= worst) break;
  }
  const quantile = (q) => (ratios.length ? ratios[Math.min(ratios.length - 1, Math.floor(q * ratios.length))] : 1);
  return {
    maxEdge: +maxEdge.toFixed(3), p99Edge: +quantile(0.99).toFixed(3), backMaxEdge: setup.hasBack ? +back.toFixed(3) : null,
    handMaxEdge: { L: setup.hasHands.L ? +handL.toFixed(3) : null, R: setup.hasHands.R ? +handR.toFixed(3) : null },
    seamGapMax: +seamGap.toFixed(5), worstVertices,
  };
}

export const CLIP_STATES = Object.freeze(['idle', 'walk', 'run', 'shoot', 'death', 'crouch', 'crouchwalk', 'jump', 'idle1h', 'walk1h', 'walkfire']);
export const CLIP_SAMPLES = 8;

/* Pass/fail limits of the pose test. Hands follow the client's hand gate (RM1 2.5x,
   tools/eval/rig-maos-check.mjs). Body and upper-back limits sit just above the meshy-28
   donor's own result on its shared clips (mst: 3.04x max edge, 3.04x back, 2.19x synthetic;
   docs/character-rig.md). Seams welded in the clean step must not open: 5 mm. */
export const POSE_THRESHOLDS = Object.freeze({
  clip: { maxEdge: 3.5, backMaxEdge: 3.5, handMaxEdge: 2.5, seamGapMax: 0.005 },
  synthetic: { maxEdge: 3.5, backMaxEdge: 3.5, handMaxEdge: 2.5, seamGapMax: 0.005 },
  bindError: 0.002,
});

export function summarize(poses) {
  const pick = (kind, key, side) => {
    let best = null;
    for (const p of poses.filter((q) => q.kind === kind)) {
      const value = side ? p.handMaxEdge[side] : p[key];
      if (value == null) continue;
      if (!best || value > best.value) best = { value, pose: p.name, time: p.time ?? null };
    }
    return best;
  };
  const out = {};
  for (const kind of ['synthetic', 'clip']) {
    out[kind] = {
      maxEdge: pick(kind, 'maxEdge'), backMaxEdge: pick(kind, 'backMaxEdge'),
      handMaxEdgeL: pick(kind, null, 'L'), handMaxEdgeR: pick(kind, null, 'R'), seamGapMax: pick(kind, 'seamGapMax'),
    };
  }
  out.perClip = {};
  for (const p of poses.filter((q) => q.kind === 'clip')) {
    const cur = out.perClip[p.name];
    if (!cur || p.maxEdge > cur.maxEdge) out.perClip[p.name] = { maxEdge: p.maxEdge, time: p.time, backMaxEdge: p.backMaxEdge };
  }
  return out;
}

/** Threshold failures of a pose-test report (empty when it passes). */
export function evaluatePoseReport(report, thresholds = POSE_THRESHOLDS) {
  const failures = [];
  if (!(report?.bindError <= thresholds.bindError)) failures.push(`bind pose does not reproduce the mesh (${report?.bindError} m)`);
  const poses = report?.poses || [];
  const kinds = new Set(poses.map((p) => p.kind));
  if (!kinds.has('synthetic')) failures.push('no synthetic poses measured');
  for (const pose of poses) {
    const limit = thresholds[pose.kind];
    if (!limit) { failures.push(`${pose.name}: unknown pose kind ${pose.kind}`); continue; }
    const at = pose.time != null ? `${pose.name}@${pose.time}` : pose.name;
    if (pose.maxEdge > limit.maxEdge) failures.push(`${at}: max edge stretch ${pose.maxEdge} > ${limit.maxEdge}`);
    if (pose.backMaxEdge > limit.backMaxEdge) failures.push(`${at}: back stretch ${pose.backMaxEdge} > ${limit.backMaxEdge}`);
    for (const side of ['L', 'R']) {
      const v = pose.handMaxEdge?.[side];
      if (v != null && v > limit.handMaxEdge) failures.push(`${at}: hand ${side} stretch ${v} > ${limit.handMaxEdge}`);
    }
    if (pose.seamGapMax > limit.seamGapMax) failures.push(`${at}: seam opens ${pose.seamGapMax} m > ${limit.seamGapMax}`);
  }
  return failures;
}

/** Area-weighted vertex normals, welded across coincident positions (UV seams stay smooth). */
function weldedNormals(positions, indices) {
  const count = positions.length / 3;
  const keyOf = (v) => `${Math.round(positions[v * 3] * 1e5)},${Math.round(positions[v * 3 + 1] * 1e5)},${Math.round(positions[v * 3 + 2] * 1e5)}`;
  const groupOf = new Map();
  const group = new Int32Array(count);
  for (let v = 0; v < count; v += 1) {
    const key = keyOf(v);
    if (!groupOf.has(key)) groupOf.set(key, groupOf.size);
    group[v] = groupOf.get(key);
  }
  const acc = new Float64Array(groupOf.size * 3);
  const idx = indices || Uint32Array.from({ length: count }, (_, i) => i);
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    const u = [0, 1, 2].map((k) => positions[b * 3 + k] - positions[a * 3 + k]);
    const w = [0, 1, 2].map((k) => positions[c * 3 + k] - positions[a * 3 + k]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    for (const v of [a, b, c]) for (let k = 0; k < 3; k += 1) acc[group[v] * 3 + k] += n[k];
  }
  const out = new Float32Array(count * 3);
  for (let v = 0; v < count; v += 1) {
    const g = group[v];
    const L = Math.hypot(acc[g * 3], acc[g * 3 + 1], acc[g * 3 + 2]) || 1;
    for (let k = 0; k < 3; k += 1) out[v * 3 + k] = acc[g * 3 + k] / L;
  }
  return out;
}

/** Static copy of a skinned GLB in one posed state (for renders): skin and joints removed. */
export function bakePosedDocument(rig, posed) {
  const doc = rig.doc;
  const skinnedNode = doc.getRoot().listNodes().find((n) => n.getSkin() && n.getMesh());
  skinnedNode.getMesh().listPrimitives().forEach((p, pi) => {
    const positions = Float32Array.from(posed[pi]);
    p.getAttribute('POSITION').setArray(positions);
    p.setAttribute('JOINTS_0', null);
    p.setAttribute('WEIGHTS_0', null);
    p.getAttribute('NORMAL')?.setArray(weldedNormals(positions, p.getIndices()?.getArray() || null));
    p.setAttribute('TANGENT', null);
  });
  skinnedNode.setSkin(null);
  for (const n of doc.getRoot().listNodes()) if (n !== skinnedNode) n.dispose();
  for (const s of doc.getRoot().listSkins()) s.dispose();
  for (const a of doc.getRoot().listAnimations()) a.dispose();
  skinnedNode.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
  const scene = doc.getRoot().listScenes()[0] || doc.createScene('scene');
  if (!scene.listChildren().includes(skinnedNode)) scene.addChild(skinnedNode);
  return doc;
}

/**
 * Turn Blender's skinned export (tools/blender/character_rig/rig_weights.py) into the meshy-28
 * model in place: weights remapped by bone name (Blender's `.001` suffix is the second
 * occurrence of a duplicated helper), the mesh node's transform baked into the vertices, the
 * Blender skeleton replaced by buildMeshy28Skeleton() on `jointsJson` (clean-space metres, as
 * written by rig_joints.py). Throws on an invalid joints.json, an unknown bone, a vertex
 * without weight, or a bind pose that does not reproduce the mesh to 0.1 mm.
 */
export function assembleMeshy28Model(doc, jointsJson) {
  const errors = validateJoints(jointsJson);
  if (errors.length) throw new Error(`joints.json is invalid:\n${errors.join('\n')}`);
  const root = doc.getRoot();
  const parent = new Map();
  for (const n of root.listNodes()) for (const c of n.listChildren()) parent.set(c, n);
  const skinned = root.listNodes().filter((n) => n.getSkin() && n.getMesh());
  if (skinned.length !== 1) throw new Error(`expected one skinned mesh, found ${skinned.length}`);
  const meshNode = skinned[0];
  const oldSkin = meshNode.getSkin();

  const slots = new Map();
  meshy28Joints.forEach(([name], i) => { const list = slots.get(name) || []; list.push(i); slots.set(name, list); });
  const remap = oldSkin.listJoints().map((joint) => {
    const match = /^(.*)\.(\d{3})$/.exec(joint.getName());
    const index = slots.get(match ? match[1] : joint.getName())?.[match ? Number(match[2]) : 0];
    if (index === undefined) throw new Error(`Blender joint ${joint.getName()} is not a meshy-28 bone`);
    return index;
  });

  const world = (n) => {
    const m = localMatrix({ t: n.getTranslation(), r: n.getRotation(), s: n.getScale() });
    const p = parent.get(n);
    return p ? world(p).multiply(m) : m;
  };
  const meshWorld = world(meshNode);
  const baked = !meshWorld.equals(new THREE.Matrix4());
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(meshWorld);
  let vertices = 0;
  for (const prim of meshNode.getMesh().listPrimitives()) {
    if (baked) {
      const v = new THREE.Vector3();
      const pos = prim.getAttribute('POSITION');
      const arr = pos.getArray().slice();
      for (let i = 0; i < pos.getCount(); i += 1) v.fromArray(arr, i * 3).applyMatrix4(meshWorld).toArray(arr, i * 3);
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
    if (!J || !W) throw new Error('skinned primitive without JOINTS_0/WEIGHTS_0');
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
      vertices += 1;
    }
    prim.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(joints).setBuffer(J.getBuffer()));
    prim.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(weights).setBuffer(W.getBuffer()));
    J.dispose(); W.dispose();
  }

  const jointsGltf = Object.fromEntries(Object.entries(jointsJson.joints).map(([name, p]) => [name, cleanToGltf(p)]));
  for (const side of ['Left', 'Right']) jointsGltf[`${side}HandTip`] = cleanToGltf(jointsJson.tips[`${side}Hand`]);
  const skeleton = buildMeshy28Skeleton(doc, jointsGltf);
  const skin = doc.createSkin('meshy-28').setSkeleton(skeleton.joints[0])
    .setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(skeleton.inverseBindMatrices).setBuffer(root.listBuffers()[0]));
  for (const node of skeleton.joints) skin.addJoint(node);

  const scene = root.listScenes()[0] || doc.createScene('scene');
  const keep = new Set([meshNode, skeleton.armature, ...skeleton.joints]);
  for (const n of root.listNodes()) if (!keep.has(n)) n.dispose();
  oldSkin.getInverseBindMatrices()?.dispose();
  oldSkin.dispose();
  meshNode.setSkin(skin).setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
  for (const child of scene.listChildren()) scene.removeChild(child);
  scene.addChild(meshNode).addChild(skeleton.armature);
  for (const a of root.listAnimations()) a.dispose();

  const { bindError } = measureSetup(loadRig(doc));
  if (!(bindError <= 1e-4)) throw new Error(`bind pose does not reproduce the mesh: ${bindError} m`);
  return { joints: skin.listJoints().length, vertices, bindError, baked };
}
