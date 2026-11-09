// Animation conversion onto the meshy-28 skeleton (docs/animation-conversion.md).
//
// One retarget core serves both stages:
//   convert  source rig (Mixamo FBX, Quaternius UAL glTF) -> meshy-28 REFERENCE clip, by
//            world-rotation deltas (every bone, any rest-frame convention);
//   bake     meshy-28 reference clip -> one character's meshy-28 rig (the client's
//            tools/retarget-glb.mjs rules: deltas, except Arm/ForeArm/Hand which copy the
//            clip's absolute world rotation; Curl_* never animated).
// For a mapped bone and frame: delta = srcWorld · srcRestWorld⁻¹ (turned into the target's
// facing), desiredWorld = delta · tgtRestWorld, tgtLocal = tgtParentWorld⁻¹ · desiredWorld.
// Hips: the world displacement from the source rest, scaled by the hips-height ratio. Its
// horizontal drift (root motion) is extracted and recorded as metadata; the clip keeps the
// sway around it.
import { Document } from '@gltf-transform/core';
import * as THREE from 'three';
import { buildMeshy28Skeleton, skinPositions, worldMatrices } from './character-rig.mjs';

export const CLIP_FPS = 30;
export const CLIP_SCHEMA = 'coro-solto/clip@1';
/** Runtime-only joints: the client writes the grip curl on them; clips never carry them. */
export const RUNTIME_ONLY_JOINT = /^Curl_/;
/** Bones that bake copies as absolute world rotations (client retarget-glb.mjs rule). */
export const ABSOLUTE_ARM_JOINT = /Arm|Hand/;
export const ROOT_MOTION_MODES = Object.freeze(['in-place', 'keep', 'strip']);

/* Mixamo -> meshy-28. Names without the `mixamorig:` prefix (FBXLoader drops the colon,
   some exports carry `mixamorig1:` or no prefix; mixamoBaseName() normalises all of them).
   The spine follows the anatomy: Mixamo Spine (just above the hips) is meshy Spine02 (child
   of Hips), Spine2 (chest) is meshy Spine (parent of neck and clavicles). The client's
   retarget-mixamo.mjs maps them by name (Spine->Spine, Spine2->Spine02), which puts the
   chest's bend on the lowest spine joint. Fingers, HeadTop_End and toe ends have no
   meshy-28 counterpart; head_end and headfront stay at rest. */
export const MIXAMO_TO_MESHY28 = Object.freeze({
  Hips: 'Hips', Spine: 'Spine02', Spine1: 'Spine01', Spine2: 'Spine', Neck: 'neck', Head: 'Head',
  LeftShoulder: 'LeftShoulder', LeftArm: 'LeftArm', LeftForeArm: 'LeftForeArm', LeftHand: 'LeftHand',
  RightShoulder: 'RightShoulder', RightArm: 'RightArm', RightForeArm: 'RightForeArm', RightHand: 'RightHand',
  LeftUpLeg: 'LeftUpLeg', LeftLeg: 'LeftLeg', LeftFoot: 'LeftFoot', LeftToeBase: 'LeftToeBase',
  RightUpLeg: 'RightUpLeg', RightLeg: 'RightLeg', RightFoot: 'RightFoot', RightToeBase: 'RightToeBase',
});

/* Quaternius Universal Animation Library (UAL1/UAL2, CC0; UE5-mannequin naming) -> meshy-28.
   `root` carries root motion in the _RM files and is not a body bone; fingers and *_leaf
   bones have no meshy-28 counterpart. */
export const UAL_TO_MESHY28 = Object.freeze({
  pelvis: 'Hips', spine_01: 'Spine02', spine_02: 'Spine01', spine_03: 'Spine', neck_01: 'neck', Head: 'Head',
  clavicle_l: 'LeftShoulder', upperarm_l: 'LeftArm', lowerarm_l: 'LeftForeArm', hand_l: 'LeftHand',
  clavicle_r: 'RightShoulder', upperarm_r: 'RightArm', lowerarm_r: 'RightForeArm', hand_r: 'RightHand',
  thigh_l: 'LeftUpLeg', calf_l: 'LeftLeg', foot_l: 'LeftFoot', ball_l: 'LeftToeBase',
  thigh_r: 'RightUpLeg', calf_r: 'RightLeg', foot_r: 'RightFoot', ball_r: 'RightToeBase',
});

export const mixamoBaseName = (name) => String(name).replace(/^mixamorig\d*:?/, '');

/* World joint positions (glTF metres, +Y up, facing +Z, left +X) of the meshy-28 donor
   (client public/models/characters/mst.glb, measured 2026-11-09). With the donor rest frames
   of MESHY28_REST_WORLD they define the reference skeleton every reference clip is baked
   against; per-character bake then moves the clips onto each rig. */
export const MESHY28_REFERENCE_JOINTS = Object.freeze({
  Hips: [-0.0005, 0.8246, -0.0232],
  LeftUpLeg: [0.0745, 0.7423, -0.0084], LeftLeg: [0.1047, 0.413, 0.0507], LeftFoot: [0.1157, 0.0993, 0.0076], LeftToeBase: [0.1379, 0.0431, 0.119],
  RightUpLeg: [-0.0757, 0.7433, -0.0082], RightLeg: [-0.1067, 0.418, 0.0517], RightFoot: [-0.1114, 0.1118, -0.0048], RightToeBase: [-0.1357, 0.0428, 0.1128],
  Spine02: [-0.0004, 0.9564, 0.0031], Spine01: [-0.0004, 1.0882, 0.0293], Spine: [-0.0003, 1.22, 0.0556],
  LeftShoulder: [0.0331, 1.2462, 0.0554], LeftArm: [0.1665, 1.2462, 0.0552], LeftForeArm: [0.3904, 1.2306, -0.0244], LeftHand: [0.6313, 1.2209, -0.0254],
  RightShoulder: [-0.033, 1.2446, 0.0554], RightArm: [-0.1641, 1.2446, 0.0552], RightForeArm: [-0.3956, 1.2243, -0.0244], RightHand: [-0.6271, 1.2156, -0.0251],
  neck: [-0.0001, 1.3215, 0.0758], Head: [0, 1.3895, 0.0893], head_end: [0.0005, 1.7044, 0.0733], headfront: [0, 1.3895, 0.2065],
  Curl_R: [-0.6272, 1.2157, -0.0258], Curl_L: [0.6314, 1.221, -0.0261],
});

/** Document holding only the meshy-28 reference skeleton (an `Armature` node, scale 0.01). */
export function referenceSkeletonDocument() {
  const doc = new Document();
  const { armature } = buildMeshy28Skeleton(doc, MESHY28_REFERENCE_JOINTS);
  doc.createScene('scene').addChild(armature);
  return doc;
}

// ------------------------------------------------------------------------------------------
// glTF skeleton graphs.

const composeTrs = (t, r, s) => new THREE.Matrix4().compose(new THREE.Vector3(...t), new THREE.Quaternion(...r), new THREE.Vector3(...s));

/**
 * Skeleton of a glTF document: the subtree under the root ancestor of `rootJoint`, in
 * depth-first order (parents first). Names may repeat (meshy-28's Curl pairs); `byName`
 * keeps the first occurrence.
 */
export function skeletonGraph(doc, rootJoint = 'Hips') {
  const nodes = doc.getRoot().listNodes();
  const parentOf = new Map();
  for (const n of nodes) for (const c of n.listChildren()) parentOf.set(c, n);
  const anchor = nodes.find((n) => n.getName() === rootJoint);
  if (!anchor) throw new Error(`skeleton has no ${rootJoint} node`);
  let root = anchor;
  while (parentOf.get(root)) root = parentOf.get(root);
  const order = [];
  const index = new Map();
  const visit = (node, parent) => {
    const entry = {
      node, name: node.getName(), parent,
      t: node.getTranslation(), r: node.getRotation(), s: node.getScale(),
    };
    index.set(node, entry);
    order.push(entry);
    for (const c of node.listChildren()) visit(c, entry);
  };
  visit(root, null);
  for (const e of order) {
    e.restLocal = composeTrs(e.t, e.r, e.s);
    e.restWorld = e.parent ? e.parent.restWorld.clone().multiply(e.restLocal) : e.restLocal.clone();
    e.restWorldQ = e.parent ? e.parent.restWorldQ.clone().multiply(new THREE.Quaternion(...e.r)) : new THREE.Quaternion(...e.r);
    e.restWorldP = new THREE.Vector3().setFromMatrixPosition(e.restWorld);
  }
  const byName = new Map();
  for (const e of order) if (!byName.has(e.name)) byName.set(e.name, e);
  return { doc, root: order[0], order, byName, index };
}

/** Value of one glTF animation channel at time t (LINEAR/STEP/CUBICSPLINE value part). */
function channelValue(c, t) {
  const T = c.times;
  const last = T.length - 1;
  let i = 0;
  if (t >= T[last]) i = last;
  else while (i < last - 1 && T[i + 1] <= t) i += 1;
  const at = (k) => { const base = c.cubic ? (k * 3 + 1) * c.n : k * c.n; return Array.from(c.values.slice(base, base + c.n)); };
  if (i === last || c.step || t <= T[0]) return at(i);
  const f = Math.min(1, Math.max(0, (t - T[i]) / ((T[i + 1] - T[i]) || 1)));
  const a = at(i), b = at(i + 1);
  if (c.n === 4) return new THREE.Quaternion().fromArray(a).slerp(new THREE.Quaternion().fromArray(b), f).toArray();
  return a.map((x, k) => x + (b[k] - x) * f);
}

/** Native key rate: the most common key interval over all tracks (keys per second; null when none). */
function keyRate(trackTimes) {
  const counts = new Map();
  for (const T of trackTimes) {
    for (let k = 1; k < T.length; k += 1) {
      const dt = Math.round((T[k] - T[k - 1]) * 1e5);
      if (dt > 0) counts.set(dt, (counts.get(dt) || 0) + 1);
    }
  }
  if (!counts.size) return null;
  const [dt] = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  const rate = 1e5 / dt;
  return Math.abs(rate - Math.round(rate)) < 0.05 ? Math.round(rate) : +rate.toFixed(2);
}

/**
 * Pose source over a glTF animation: `map` names source nodes -> meshy-28 names (identity for
 * meshy-28 clips). World poses include every ancestor (UAL's Z-up `root`, the 0.01 Armature).
 */
export function gltfPoseSource(doc, animation, map, { rootJoint } = {}) {
  const sourceRoot = rootJoint || Object.keys(map).find((k) => map[k] === 'Hips');
  const graph = skeletonGraph(doc, sourceRoot);
  const channels = [];
  const keyTimes = [];
  for (const ch of animation.listChannels()) {
    const target = ch.getTargetNode(), s = ch.getSampler(), path = ch.getTargetPath();
    const entry = target && graph.index.get(target);
    if (!entry || !s || !['translation', 'rotation', 'scale'].includes(path)) continue;
    const times = s.getInput().getArray();
    keyTimes.push(times);
    channels.push({ entry, key: path === 'translation' ? 't' : path === 'rotation' ? 'r' : 's', times, values: s.getOutput().getArray(), n: path === 'rotation' ? 4 : 3, cubic: s.getInterpolation() === 'CUBICSPLINE', step: s.getInterpolation() === 'STEP' });
  }
  const startTime = Math.min(...channels.map((c) => c.times[0]));
  const duration = Math.max(0, ...channels.map((c) => c.times[c.times.length - 1])) - (Number.isFinite(startTime) ? startTime : 0);
  const joints = new Map();
  for (const [from, to] of Object.entries(map)) {
    const entry = graph.byName.get(from);
    if (entry && !joints.has(to)) joints.set(to, entry);
  }
  const worldOf = (overrides) => {
    const cache = new Map();
    const world = (e) => {
      if (cache.has(e)) return cache.get(e);
      const o = overrides.get(e);
      const local = o ? composeTrs(o.t || e.t, o.r || e.r, o.s || e.s) : e.restLocal;
      const m = e.parent ? world(e.parent).clone().multiply(local) : local.clone();
      cache.set(e, m);
      return m;
    };
    return world;
  };
  const pose = (world) => {
    const out = new Map();
    for (const [name, e] of joints) {
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      world(e).decompose(p, q, s);
      out.set(name, { p, q });
    }
    return out;
  };
  const restPose = pose(worldOf(new Map()));
  return {
    kind: 'gltf', duration, nativeFps: keyRate(keyTimes),
    joints: new Set(joints.keys()),
    rest: () => restPose,
    sample(t) {
      const overrides = new Map();
      for (const c of channels) {
        const o = overrides.get(c.entry) || {};
        o[c.key] = channelValue(c, (Number.isFinite(startTime) ? startTime : 0) + t);
        overrides.set(c.entry, o);
      }
      return pose(worldOf(overrides));
    },
  };
}

/**
 * Pose source over a three.js object tree and AnimationClip (what FBXLoader returns). Bones
 * are resolved like the AnimationMixer resolves track names (PropertyBinding.findNode), so
 * the leaf duplicates FBXLoader creates for skinned Mixamo files are never picked. The rest
 * pose is the tree as loaded (Mixamo: the T-pose).
 */
export function objectPoseSource(group, clip, map, { baseName = mixamoBaseName } = {}) {
  const names = new Set();
  group.traverse((o) => names.add(o.name));
  const joints = new Map();
  for (const name of names) {
    const meshy = map[baseName(name)];
    if (!meshy || joints.has(meshy)) continue;
    const node = THREE.PropertyBinding.findNode(group, name);
    if (node) joints.set(meshy, node);
  }
  const read = () => {
    group.updateMatrixWorld(true);
    const out = new Map();
    for (const [name, node] of joints) {
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      node.matrixWorld.decompose(p, q, s);
      out.set(name, { p, q });
    }
    return out;
  };
  const restPose = read();
  const mixer = new THREE.AnimationMixer(group);
  const action = mixer.clipAction(clip);
  // LoopOnce + clamp: setTime(duration) holds the last frame instead of wrapping to frame 0.
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  return {
    kind: 'object', duration: clip.duration, nativeFps: keyRate(clip.tracks.map((t) => t.times)),
    joints: new Set(joints.keys()),
    rest: () => restPose,
    sample(t) {
      // A LoopOnce action that reached its end stays paused; reset so any time can be sampled again.
      action.reset();
      mixer.setTime(Math.min(clip.duration, Math.max(0, t)));
      return read();
    },
  };
}

// ------------------------------------------------------------------------------------------
// Retarget core.

const UP = new THREE.Vector3(0, 1, 0);

/** Rotation about +Y that turns the source's facing onto the target's (from the hip line). */
export function facingYaw(sourceRest, target) {
  const srcL = sourceRest.get('LeftUpLeg')?.p, srcR = sourceRest.get('RightUpLeg')?.p;
  const tgtL = target.byName.get('LeftUpLeg')?.restWorldP, tgtR = target.byName.get('RightUpLeg')?.restWorldP;
  if (!srcL || !srcR || !tgtL || !tgtR) return new THREE.Quaternion();
  const s = srcL.clone().sub(srcR), t = tgtL.clone().sub(tgtR);
  const angle = Math.atan2(s.z, s.x) - Math.atan2(t.z, t.x);
  return new THREE.Quaternion().setFromAxisAngle(UP, angle);
}

/** Joints whose height above their rest height defines ground contact (heel/ankle and ball). */
export const FOOT_CONTACT_JOINTS = Object.freeze(['LeftFoot', 'LeftToeBase', 'RightFoot', 'RightToeBase']);

/* Source contact detection (reference metres): a foot joint is planted where it is within
   CONTACT_HEIGHT of its rest height and moves slower than CONTACT_SPEED horizontally in the
   source's world (root motion included). Windows shorter than CONTACT_MIN_FRAMES are dropped.
   The windows travel with the clip (extras.clip.contacts) so the QA gate measures a baked
   character's slide exactly where the motion capture plants the foot. */
export const CONTACT_HEIGHT = 0.03;
export const CONTACT_SPEED = 0.25;
export const CONTACT_MIN_FRAMES = 3;
/** Both feet this far above their rest heights (scaled source) count as an airborne frame. */
export const AIRBORNE_CLEARANCE = 0.08;

/** Planted frame windows per foot joint: { LeftFoot: [[first, last], ...], ... } (frame indices). */
export function footContacts(tracks, times) {
  const out = {};
  for (const [name, track] of Object.entries(tracks)) {
    const windows = [];
    let open = -1;
    for (let i = 0; i <= track.length; i += 1) {
      let planted = false;
      if (i < track.length) {
        const a = track[Math.max(0, i - 1)], b = track[Math.min(track.length - 1, i + 1)];
        const dt = times[Math.min(track.length - 1, i + 1)] - times[Math.max(0, i - 1)];
        const speed = dt > 0 ? Math.hypot(b.x - a.x, b.z - a.z) / dt : 0;
        planted = track[i].clear <= CONTACT_HEIGHT && speed <= CONTACT_SPEED;
      }
      if (planted && open < 0) open = i;
      if (!planted && open >= 0) {
        if (i - open >= CONTACT_MIN_FRAMES) windows.push([open, i - 1]);
        open = -1;
      }
    }
    out[name] = windows;
  }
  return out;
}

/** Leg chains for foot IK: hip joint, knee joint, ankle joint, the ankle's contact joints. */
export const LEG_CHAINS = Object.freeze([
  { side: 'Left', hip: 'LeftUpLeg', knee: 'LeftLeg', ankle: 'LeftFoot', contacts: ['LeftFoot', 'LeftToeBase'] },
  { side: 'Right', hip: 'RightUpLeg', knee: 'RightLeg', ankle: 'RightFoot', contacts: ['RightFoot', 'RightToeBase'] },
]);
/** Frames over which foot IK blends in before and out after a contact window. */
export const IK_BLEND_FRAMES = 4;

/* Limb bones aligned to the source's rest direction (bone -> the child it points at). Feet
   are not: ankle-to-ball slopes differ with foot shape, and both rests stand flat. */
export const LIMB_ALIGNMENT = Object.freeze([
  ['LeftArm', 'LeftForeArm'], ['LeftForeArm', 'LeftHand'], ['RightArm', 'RightForeArm'], ['RightForeArm', 'RightHand'],
  ['LeftUpLeg', 'LeftLeg'], ['LeftLeg', 'LeftFoot'], ['RightUpLeg', 'RightLeg'], ['RightLeg', 'RightFoot'],
]);

/**
 * Per-frame IK weight of one leg from its contact windows (1 inside, smooth ramp outside).
 * In a loop the last frame is the first frame again, so ramps wrap around the seam.
 */
function ikWeights(windows, frames, loop = false) {
  const w = new Float32Array(frames);
  const period = frames - 1;
  for (const [a, b] of windows) {
    for (let i = a - IK_BLEND_FRAMES; i <= b + IK_BLEND_FRAMES; i += 1) {
      const outside = i < a ? a - i : i > b ? i - b : 0;
      const x = 1 - outside / (IK_BLEND_FRAMES + 1);
      const k = loop ? ((i % period) + period) % period : i;
      if (k < 0 || k >= frames) continue;
      w[k] = Math.max(w[k], x * x * (3 - 2 * x));
    }
  }
  if (loop) { w[0] = Math.max(w[0], w[period]); w[period] = w[0]; }
  return w;
}

/**
 * Two-bone IK in world space: bend the knee to the length hip→goal (law of cosines, about the
 * current bend axis, else `fallbackAxis`), then swing the hip so the ankle lands on the goal.
 * Returns the new world rotations { hip, knee } (the ankle keeps its world rotation).
 */
export function solveTwoBone(H, K, A, goal, hipQ, kneeQ, fallbackAxis) {
  const a = K.distanceTo(H), b = A.distanceTo(K);
  const u = H.clone().sub(K), v = A.clone().sub(K);
  let axis = u.clone().cross(v);
  if (axis.lengthSq() < 1e-12) axis = fallbackAxis.clone();
  axis.normalize();
  const d = THREE.MathUtils.clamp(goal.distanceTo(H), Math.abs(a - b) + 1e-6, a + b - 1e-6);
  const current = u.angleTo(v);
  const wanted = Math.acos(THREE.MathUtils.clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
  const bend = new THREE.Quaternion().setFromAxisAngle(axis, wanted - current);
  const ankle = K.clone().add(v.clone().applyQuaternion(bend));
  const swing = new THREE.Quaternion().setFromUnitVectors(ankle.sub(H).normalize(), goal.clone().sub(H).normalize());
  return { hip: swing.clone().multiply(hipQ), knee: swing.clone().multiply(bend).multiply(kneeQ) };
}

/**
 * Retarget `source` (gltfPoseSource/objectPoseSource) onto `target` (skeletonGraph).
 * options: fps, start, end (source seconds), rootMotion ('in-place' | 'keep' | 'strip'),
 * absoluteArms (bake rule), footContact, footIk, contacts (windows to use instead of the
 * detected ones, e.g. a reference clip's extras.clip.contacts), loop (IK ramps wrap the seam),
 * minJoints.
 * footContact (default on): the Hips height is corrected per frame so the target's lowest
 * foot joint (relative to its rest height) is as far above its rest height as the source's,
 * scaled. Without it, a target whose legs are proportioned differently from the source floats
 * or sinks whenever the knees bend (the hips-height ratio alone is only exact standing).
 * footIk (default on): inside the source's foot contact windows (ramped over IK_BLEND_FRAMES)
 * the ankle is pinned by two-bone IK to the source ankle's displacement from its rest, scaled
 * and added to the target ankle's rest; this is where the root velocity (the same scaled
 * source drift) keeps it still. (Pinning the ball instead while the heel is up was measured
 * and rejected: a leg proportioned differently cannot reach it at push-off, so the ball drags;
 * walk-forward on mst went from 1-2 cm to 9.6 cm of slide.)
 * Without it, different leg proportions make planted feet slide.
 * Returns { times, rotations: Map(name -> Float32Array xyzw), hips: Float32Array local xyz,
 *           rootMotion, hipsScale, mapped, contacts, contactCorrection: {min, max} (m), ik }.
 */
export function retargetClip(source, target, {
  fps = CLIP_FPS, start = 0, end = source.duration, rootMotion = 'in-place', absoluteArms = false,
  footContact = true, footIk = true, alignLimbs = LIMB_ALIGNMENT, contacts: givenContacts = null, loop = false, minJoints = 8,
} = {}) {
  if (!ROOT_MOTION_MODES.includes(rootMotion)) throw new Error(`rootMotion must be one of ${ROOT_MOTION_MODES.join(', ')}`);
  const mapped = target.order.filter((e) => source.joints.has(e.name) && !RUNTIME_ONLY_JOINT.test(e.name) && target.byName.get(e.name) === e);
  if (mapped.length < minJoints) {
    throw new Error(`only ${mapped.length} target joints map onto the source (minimum ${minJoints}); target root ${target.root.name}, source joints ${[...source.joints].join(',') || 'none'}`);
  }
  const mappedSet = new Set(mapped);
  const srcRest = source.rest();
  const yaw = facingYaw(srcRest, target), yawInv = yaw.clone().invert();
  const hipsT = target.byName.get('Hips');
  const srcHips = srcRest.get('Hips');
  if (!hipsT || !srcHips) throw new Error('both skeletons need Hips');
  const hipsScale = hipsT.restWorldP.y / (srcHips.p.y || 1);
  const hipsWorldScale = new THREE.Vector3();
  hipsT.restWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), hipsWorldScale);
  const feet = FOOT_CONTACT_JOINTS.map((n) => target.byName.get(n)).filter((e) => e && mappedSet.has(e) && srcRest.has(e.name));
  const contact = footContact && feet.length > 0;
  const t0 = Math.max(0, start), t1 = Math.min(source.duration, end);
  if (!(t1 > t0)) throw new Error(`empty time range ${t0}..${t1}`);
  const length = t1 - t0;
  const frames = Math.max(2, Math.round(length * fps) + 1);
  const times = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) times[i] = i === frames - 1 ? length : Math.min(length, i / fps);
  const displacement = [];
  const correction = { min: Infinity, max: -Infinity };
  const footTracks = {};
  const states = [];
  const sourceHips = { min: Infinity, max: -Infinity };
  const srcRestInv = new Map([...srcRest].map(([name, v]) => [name, v.q.clone().invert()]));
  // Rest-direction alignment: the target bone's rest frame turned (shortest arc) so the bone
  // points like the source's rest bone. World deltas then reproduce the source's limb
  // directions even where the two rest poses differ (a bent rest knee, arms swept back).
  const restAlign = new Map();
  for (const [bone, child] of alignLimbs) {
    const e = target.byName.get(bone), c = target.byName.get(child);
    if (!e || !c || !mappedSet.has(e) || (absoluteArms && ABSOLUTE_ARM_JOINT.test(bone)) || !srcRest.has(bone) || !srcRest.has(child)) continue;
    const tgtDir = c.restWorldP.clone().sub(e.restWorldP);
    const srcDir = srcRest.get(child).p.clone().sub(srcRest.get(bone).p).applyQuaternion(yaw);
    if (tgtDir.lengthSq() < 1e-12 || srcDir.lengthSq() < 1e-12) continue;
    restAlign.set(e, new THREE.Quaternion().setFromUnitVectors(tgtDir.normalize(), srcDir.normalize()).multiply(e.restWorldQ));
  }
  // World matrices below the Hips for one frame's local rotations.
  const forward = (localQ, hipsPos, worldQ) => {
    const cache = new Map([[hipsT, new THREE.Matrix4().compose(hipsPos, worldQ.get(hipsT), hipsWorldScale)]]);
    const worldOf = (e) => {
      if (!cache.has(e)) cache.set(e, worldOf(e.parent).clone().multiply(composeTrs(e.t, localQ.get(e).toArray(), e.s)));
      return cache.get(e);
    };
    return (e) => new THREE.Vector3().setFromMatrixPosition(worldOf(e));
  };

  // Pass 1: rotations by world deltas, hips displacement, ground contact, source foot tracks.
  for (let i = 0; i < frames; i += 1) {
    const pose = source.sample(t0 + times[i]);
    const worldQ = new Map(), localQ = new Map();
    for (const e of target.order) {
      const parentQ = e.parent ? worldQ.get(e.parent) : new THREE.Quaternion();
      if (!mappedSet.has(e)) {
        localQ.set(e, new THREE.Quaternion(...e.r));
        worldQ.set(e, parentQ.clone().multiply(localQ.get(e)));
        continue;
      }
      const src = pose.get(e.name).q;
      const desired = absoluteArms && ABSOLUTE_ARM_JOINT.test(e.name)
        ? yaw.clone().multiply(src)
        : yaw.clone().multiply(src).multiply(srcRestInv.get(e.name)).multiply(yawInv).multiply(restAlign.get(e) || e.restWorldQ);
      worldQ.set(e, desired);
      localQ.set(e, parentQ.clone().invert().multiply(desired).normalize());
    }
    const d = pose.get('Hips').p.clone().sub(srcHips.p).applyQuaternion(yaw).multiplyScalar(hipsScale);
    const hipsRatio = pose.get('Hips').p.y / srcHips.p.y;
    sourceHips.min = Math.min(sourceHips.min, hipsRatio);
    sourceHips.max = Math.max(sourceHips.max, hipsRatio);
    if (contact) {
      // Heights do not depend on the horizontal offset.
      const at = forward(localQ, hipsT.restWorldP.clone().add(d), worldQ);
      let srcClear = Infinity, tgtClear = Infinity;
      for (const e of feet) {
        srcClear = Math.min(srcClear, (pose.get(e.name).p.y - srcRest.get(e.name).p.y) * hipsScale);
        tgtClear = Math.min(tgtClear, at(e).y - e.restWorldP.y);
      }
      const dy = srcClear - tgtClear;
      d.y += dy;
      correction.min = Math.min(correction.min, dy);
      correction.max = Math.max(correction.max, dy);
    }
    const goals = {};
    for (const name of FOOT_CONTACT_JOINTS) {
      const p = pose.get(name)?.p, r = srcRest.get(name)?.p;
      if (!p || !r) continue;
      const delta = p.clone().sub(r).applyQuaternion(yaw).multiplyScalar(hipsScale);
      goals[name] = delta;
      (footTracks[name] ||= []).push({ x: delta.x, z: delta.z, clear: delta.y });
    }
    states.push({ worldQ, localQ, goals });
    displacement.push(d);
  }
  const contacts = givenContacts || footContacts(footTracks, times);
  // The source's own slide inside its contact windows (scaled): the floor of what any retarget can reach.
  let sourceSlide = 0;
  for (const [name, windows] of Object.entries(contacts)) {
    const track = footTracks[name] || [];
    for (const [a, b] of windows) {
      for (let k = a; k <= Math.min(b, track.length - 1); k += 1) sourceSlide = Math.max(sourceSlide, Math.hypot(track[k].x - track[a].x, track[k].z - track[a].z));
    }
  }
  // Frames with every foot joint more than AIRBORNE_CLEARANCE above its rest height (jumps).
  const footNames = Object.keys(footTracks);
  let airborneFrames = 0;
  for (let i = 0; i < frames; i += 1) if (footNames.length && footNames.every((n) => footTracks[n][i].clear > AIRBORNE_CLEARANCE)) airborneFrames += 1;
  // Per frame, how far the source's lowest foot joint is above its rest height (scaled, m).
  const footClearance = Array.from({ length: frames }, (_, i) => (footNames.length ? +Math.min(...footNames.map((n) => footTracks[n][i].clear)).toFixed(3) : 0));

  // Pass 2: foot IK inside the contact windows.
  const ik = { legs: 0, maxCorrection: 0 };
  if (footIk) {
    for (const leg of LEG_CHAINS) {
      const [hip, knee, ankle] = [leg.hip, leg.knee, leg.ankle].map((n) => target.byName.get(n));
      if (![hip, knee, ankle].every((e) => e && mappedSet.has(e)) || ankle.parent !== knee || knee.parent !== hip || !states[0].goals[leg.ankle]) continue;
      const windows = leg.contacts.flatMap((n) => contacts[n] || []);
      if (!windows.length) continue;
      ik.legs += 1;
      const weights = ikWeights(windows, frames, loop);
      // Bend axis for a straight leg: the rest bend plane, carried by the hip's rotation.
      const restAxisLocal = hip.restWorldP.clone().sub(knee.restWorldP).cross(ankle.restWorldP.clone().sub(knee.restWorldP));
      if (restAxisLocal.lengthSq() < 1e-12) restAxisLocal.set(1, 0, 0); else restAxisLocal.normalize();
      restAxisLocal.applyQuaternion(hip.restWorldQ.clone().invert());
      for (let i = 0; i < frames; i += 1) {
        if (!(weights[i] > 0)) continue;
        const { worldQ, localQ, goals } = states[i];
        const at = forward(localQ, hipsT.restWorldP.clone().add(displacement[i]), worldQ);
        const H = at(hip), K = at(knee), A = at(ankle);
        const goal = A.clone().lerp(ankle.restWorldP.clone().add(goals[leg.ankle]), weights[i]);
        ik.maxCorrection = Math.max(ik.maxCorrection, goal.distanceTo(A));
        const solved = solveTwoBone(H, K, A, goal, worldQ.get(hip), worldQ.get(knee), restAxisLocal.clone().applyQuaternion(worldQ.get(hip)));
        const ankleW = worldQ.get(ankle);
        worldQ.set(hip, solved.hip);
        worldQ.set(knee, solved.knee);
        localQ.set(hip, worldQ.get(hip.parent).clone().invert().multiply(solved.hip).normalize());
        localQ.set(knee, solved.hip.clone().invert().multiply(solved.knee).normalize());
        localQ.set(ankle, solved.knee.clone().invert().multiply(ankleW).normalize());
      }
    }
  }

  const rotations = new Map(mapped.map((e) => [e.name, new Float32Array(frames * 4)]));
  states.forEach(({ localQ }, i) => {
    for (const e of mapped) {
      const q = localQ.get(e), out = rotations.get(e.name);
      // Keep consecutive keys in the same hemisphere so LINEAR slerp never takes the long way.
      if (i > 0 && out[(i - 1) * 4] * q.x + out[(i - 1) * 4 + 1] * q.y + out[(i - 1) * 4 + 2] * q.z + out[(i - 1) * 4 + 3] * q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      out.set([q.x, q.y, q.z, q.w], i * 4);
    }
  });
  // Root motion: the straight line from the first to the last hips position (horizontal).
  const first = displacement[0], last = displacement[frames - 1];
  const drift = new THREE.Vector3(last.x - first.x, 0, last.z - first.z);
  for (let i = 0; i < frames; i += 1) {
    const d = displacement[i];
    if (rootMotion === 'in-place') d.addScaledVector(drift, -times[i] / length);
    else if (rootMotion === 'strip') { d.x = 0; d.z = 0; }
  }
  const parentWorldInv = hipsT.parent ? hipsT.parent.restWorld.clone().invert() : new THREE.Matrix4();
  const hips = new Float32Array(frames * 3);
  displacement.forEach((d, i) => {
    const local = hipsT.restWorldP.clone().add(d).applyMatrix4(parentWorldInv);
    hips.set([local.x, local.y, local.z], i * 3);
  });
  const round = (v) => +v.toFixed(4);
  return {
    times, rotations, hips, hipsScale, mapped: mapped.map((e) => e.name), contacts,
    contactCorrection: contact ? { min: round(correction.min), max: round(correction.max) } : null, sourceSlide: round(sourceSlide),
    sourceHipsRatio: [round(sourceHips.min), round(sourceHips.max)], aligned: [...restAlign.keys()].map((e) => e.name), airborneFrames, footClearance,
    ik: footIk ? { legs: ik.legs, maxCorrection: round(ik.maxCorrection) } : null,
    rootMotion: {
      mode: rootMotion, extracted: rootMotion !== 'keep',
      displacement: [round(drift.x), round(drift.z)],
      velocity: [round(drift.x / length), round(drift.z / length)],
      speed: round(Math.hypot(drift.x, drift.z) / length),
    },
  };
}

/** Penetration below the bind floor tolerated before the floor clamp acts (m). */
export const FLOOR_CLAMP_TOLERANCE = 0.005;
/** Height above the floor at which a body whose source has a foot planted is dropped back (m). */
export const FLOAT_DROP = 0.02;

/* Body regions the bake-time floor clamp keeps above the floor, in the order it treats them.
   A vertex belongs to the region of its dominant joint. `pivots` are tried in order: the
   first whose lever to the sinking vertex is not vertical turns about the horizontal axis
   across that lever (heel: the ankle pitches the foot; toes: the ball; hands: the elbow, then
   the shoulder). When the heel and the toes of one foot both sink, no pitch can help (the
   ankle itself is too low for this foot's shape): two-bone IK on `limb` raises that ankle by
   the shallower depth first; the same IK raises a wrist or an ankle whose levers are all
   vertical (a hand planted under a straight arm). `lift` regions raise the hips instead:
   knees (a kneeling thigh is vertical, so no rotation lifts the knee) and the rest of the
   body (`bones: null`: torso, head, upper limbs lying on the floor). */
export const FLOOR_CLAMP_REGIONS = Object.freeze([
  { name: 'heel', bones: ['LeftFoot'], pivots: ['LeftFoot'], limb: ['LeftUpLeg', 'LeftLeg', 'LeftFoot'] },
  { name: 'heel', bones: ['RightFoot'], pivots: ['RightFoot'], limb: ['RightUpLeg', 'RightLeg', 'RightFoot'] },
  { name: 'toe', bones: ['LeftToeBase'], pivots: ['LeftToeBase'], limb: ['LeftUpLeg', 'LeftLeg', 'LeftFoot'] },
  { name: 'toe', bones: ['RightToeBase'], pivots: ['RightToeBase'], limb: ['RightUpLeg', 'RightLeg', 'RightFoot'] },
  { name: 'hand', bones: ['LeftHand', 'Curl_L'], pivots: ['LeftForeArm', 'LeftArm'], limb: ['LeftArm', 'LeftForeArm', 'LeftHand'] },
  { name: 'hand', bones: ['RightHand', 'Curl_R'], pivots: ['RightForeArm', 'RightArm'], limb: ['RightArm', 'RightForeArm', 'RightHand'] },
  { name: 'knee', bones: ['LeftLeg'], lift: true },
  { name: 'knee', bones: ['RightLeg'], lift: true },
  { name: 'body', bones: null, lift: true },
]);

/** Region index of every vertex of `rig` (dominant joint; a `bones: null` region takes the rest). */
export function vertexRegions(rig, regions = FLOOR_CLAMP_REGIONS) {
  return rig.prims.map((p) => {
    const out = new Array(p.count).fill(null);
    for (let v = 0; v < p.count; v += 1) {
      let best = 0;
      for (let k = 1; k < 4; k += 1) if (p.W[v * 4 + k] > p.W[v * 4 + best]) best = k;
      const name = rig.names[p.J[v * 4 + best]];
      let region = regions.findIndex((r) => r.bones?.includes(name));
      if (region < 0) region = regions.findIndex((r) => r.bones === null);
      out[v] = region < 0 ? null : region;
    }
    return out;
  });
}

/**
 * Bake-time, mesh-aware floor clamp (`rig`: loadRig of the character). Per frame the mesh is
 * skinned; when a region's lowest vertex sinks more than FLOOR_CLAMP_TOLERANCE below the bind
 * floor, the region's pivot turns it up about the horizontal axis across the lever (at most 45°
 * per step), a foot whose heel and toes both sink (or a limb no pivot can lift) is raised by
 * two-bone IK, and `lift` regions raise the hips by the depth. Up to 8 passes per frame; then
 * the whole body is lifted out of any remaining penetration, or dropped back to the floor when
 * the source has a foot planted (`clearance`: extras.clip.footClearance, scaled) and this
 * character hangs more than FLOAT_DROP above it.
 * Rewrites `result.rotations` and `result.hips` in place. Returns per-region { frames, max }
 * (degrees for pivots, metres for lifts; `limbLift` for the IK) and the frames still
 * below the tolerance.
 */
export function clampToFloor(rig, result, { regions = FLOOR_CLAMP_REGIONS, passes = 8, clearance = null } = {}) {
  const bind = skinPositions(rig);
  let floor = Infinity;
  for (const b of bind) for (let v = 1; v < b.length; v += 3) floor = Math.min(floor, b[v]);
  const node = (name) => rig.byName.get(name)?.[0];
  const membership = vertexRegions(rig, regions);
  const active = regions.map((r, i) => membership.some((m) => m.includes(i)) && (r.lift || r.pivots.some((p) => node(p) && result.rotations.has(p))));
  const stats = {};
  for (const r of regions) stats[r.name] ||= { frames: 0, max: 0 };
  stats.limbLift = { frames: 0, max: 0 };
  stats.bodyShift = { frames: 0, max: 0 };
  let unresolved = 0;
  const hipsNode = node('Hips');
  const parentWorldInv = rig.parent.get(hipsNode) ? null : new THREE.Matrix4();
  const frames = result.times.length;
  for (let i = 0; i < frames; i += 1) {
    const overrides = new Map();
    for (const [name, arr] of result.rotations) {
      const n = node(name);
      if (n) overrides.set(n, { ...rig.trs.get(n), r: Array.from(arr.slice(i * 4, i * 4 + 4)) });
    }
    overrides.set(hipsNode, { ...(overrides.get(hipsNode) || rig.trs.get(hipsNode)), t: Array.from(result.hips.slice(i * 3, i * 3 + 3)) });
    const touched = new Set();
    let sinking = false;
    for (let pass = 0; pass < passes; pass += 1) {
      const skinned = skinPositions(rig, overrides);
      const world = worldMatrices(rig, overrides);
      const low = regions.map(() => ({ y: Infinity, at: null }));
      membership.forEach((m, pi) => m.forEach((region, v) => {
        if (region == null || !active[region]) return;
        const y = skinned[pi][v * 3 + 1];
        if (y < low[region].y) low[region] = { y, at: [pi, v] };
      }));
      let moved = false;
      sinking = false;
      // Whole foot below the floor: raise that ankle by leg IK (same limb chain on heel and toe).
      const legs = new Map();
      regions.forEach((region, ri) => {
        const depth = floor - low[ri].y;
        if (!region.limb || !active[ri] || depth <= FLOOR_CLAMP_TOLERANCE) return;
        const key = region.limb.join();
        const entry = legs.get(key) || { limb: region.limb, depths: [] };
        entry.depths.push(depth);
        legs.set(key, entry);
      });
      const liftLimb = (limb, lift) => {
        const [hip, knee, ankle] = limb.map(node);
        if (![hip, knee, ankle].every((n) => n && result.rotations.has(n.getName()))) return false;
        const pos = (n) => new THREE.Vector3().setFromMatrixPosition(world(n));
        const rot = (n) => { const q = new THREE.Quaternion(); world(n).decompose(new THREE.Vector3(), q, new THREE.Vector3()); return q; };
        const H = pos(hip), K = pos(knee), A = pos(ankle);
        const fallback = new THREE.Vector3(1, 0, 0).applyQuaternion(rot(hip));
        const solved = solveTwoBone(H, K, A, A.clone().add(new THREE.Vector3(0, lift, 0)), rot(hip), rot(knee), fallback);
        const locals = [
          [hip, rot(rig.parent.get(hip)).invert().multiply(solved.hip)],
          [knee, solved.hip.clone().invert().multiply(solved.knee)],
          [ankle, solved.knee.clone().invert().multiply(rot(ankle))],
        ];
        for (const [n, q] of locals) {
          q.normalize();
          const track = result.rotations.get(n.getName());
          const prev = track.slice(i * 4, i * 4 + 4);
          if (prev[0] * q.x + prev[1] * q.y + prev[2] * q.z + prev[3] * q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
          track.set(q.toArray(), i * 4);
          overrides.set(n, { ...overrides.get(n), r: q.toArray() });
        }
        stats.limbLift.max = Math.max(stats.limbLift.max, lift);
        touched.add('limbLift');
        return true;
      };
      for (const { limb, depths } of legs.values()) if (depths.length > 1 && liftLimb(limb, Math.min(...depths))) moved = true;
      if (moved) continue; // re-skin before pitching
      regions.forEach((region, ri) => {
        const depth = floor - low[ri].y;
        if (!active[ri] || depth <= FLOOR_CLAMP_TOLERANCE) return;
        sinking = true;
        if (moved && region.lift) return; // re-measure after rotations before lifting the body
        if (region.lift) {
          const parent = rig.parent.get(hipsNode);
          const toLocal = parent ? world(parent).clone().invert() : parentWorldInv;
          const hipsWorld = new THREE.Vector3().setFromMatrixPosition(world(hipsNode)).add(new THREE.Vector3(0, depth, 0));
          const local = hipsWorld.applyMatrix4(toLocal).toArray();
          overrides.set(hipsNode, { ...overrides.get(hipsNode), t: local });
          result.hips.set(local, i * 3);
          stats[region.name].max = Math.max(stats[region.name].max, depth);
          touched.add(region.name);
          moved = true;
          return;
        }
        const V = new THREE.Vector3().fromArray(skinned[low[ri].at[0]], low[ri].at[1] * 3);
        for (const pivotName of region.pivots) {
          const pivot = node(pivotName);
          if (!pivot || !result.rotations.has(pivotName)) continue;
          const P = new THREE.Vector3().setFromMatrixPosition(world(pivot));
          const lever = V.clone().sub(P);
          const axis = lever.clone().cross(new THREE.Vector3(0, 1, 0));
          if (lever.length() < 1e-4 || axis.length() < 0.2 * lever.length()) continue; // lever (near) vertical
          const angle = Math.min(Math.PI / 4, Math.asin(Math.min(1, depth / lever.length())) + 1e-3);
          const pivotQ = new THREE.Quaternion(), parentQ = new THREE.Quaternion();
          world(pivot).decompose(new THREE.Vector3(), pivotQ, new THREE.Vector3());
          world(rig.parent.get(pivot)).decompose(new THREE.Vector3(), parentQ, new THREE.Vector3());
          const local = parentQ.invert().multiply(new THREE.Quaternion().setFromAxisAngle(axis.normalize(), angle).multiply(pivotQ)).normalize();
          const track = result.rotations.get(pivotName);
          const prev = track.slice(i * 4, i * 4 + 4);
          if (prev[0] * local.x + prev[1] * local.y + prev[2] * local.z + prev[3] * local.w < 0) local.set(-local.x, -local.y, -local.z, -local.w);
          track.set(local.toArray(), i * 4);
          overrides.set(pivot, { ...overrides.get(pivot), r: local.toArray() });
          stats[region.name].max = Math.max(stats[region.name].max, THREE.MathUtils.radToDeg(angle));
          touched.add(region.name);
          moved = true;
          return;
        }
        // No pivot can lift it (levers vertical: a heel under the ankle, a hand under a straight
        // arm): raise the ankle or the wrist by IK.
        if (region.limb && liftLimb(region.limb, depth)) moved = true;
      });
      if (!moved) break;
    }
    // Whole body last: lift it out of the floor, or, where the source has a foot planted
    // (clearance ≤ 1 cm) and this character hangs more than FLOAT_DROP above the floor, drop it.
    let lowest = Infinity;
    skinPositions(rig, overrides).forEach((p, pi) => membership[pi].forEach((region, v) => { if (region != null && active[region]) lowest = Math.min(lowest, p[v * 3 + 1]); }));
    lowest -= floor;
    const shift = lowest < -FLOOR_CLAMP_TOLERANCE ? -lowest
      : clearance && clearance[i] != null && clearance[i] <= 0.01 && lowest > FLOAT_DROP ? -lowest : 0;
    if (shift) {
      const world = worldMatrices(rig, overrides);
      const parent = rig.parent.get(hipsNode);
      const toLocal = parent ? world(parent).clone().invert() : parentWorldInv;
      const local = new THREE.Vector3().setFromMatrixPosition(world(hipsNode)).add(new THREE.Vector3(0, shift, 0)).applyMatrix4(toLocal).toArray();
      overrides.set(hipsNode, { ...overrides.get(hipsNode), t: local });
      result.hips.set(local, i * 3);
      stats.bodyShift.max = Math.max(stats.bodyShift.max, Math.abs(shift));
      touched.add('bodyShift');
      sinking = false;
    }
    for (const name of touched) stats[name].frames += 1;
    if (sinking) unresolved += 1;
  }
  for (const v of Object.values(stats)) v.max = +v.max.toFixed(4);
  return { ...stats, unresolvedFrames: unresolved };
}

/** World joint positions (first node of each name) of `target` at frame i of a retarget result. */
export function resultJointPositions(target, result, i) {
  const out = new Map(), world = new Map();
  for (const e of target.order) {
    const rot = result.rotations.get(e.name);
    const r = rot && target.byName.get(e.name) === e ? Array.from(rot.slice(i * 4, i * 4 + 4)) : e.r;
    const t = e === target.byName.get('Hips') ? Array.from(result.hips.slice(i * 3, i * 3 + 3)) : e.t;
    const m = composeTrs(t, r, e.s);
    const w = e.parent ? world.get(e.parent).clone().multiply(m) : m;
    world.set(e, w);
    if (!out.has(e.name)) out.set(e.name, new THREE.Vector3().setFromMatrixPosition(w));
  }
  return out;
}

/**
 * First versus last frame of a retarget result: largest joint position difference (m) and
 * largest local rotation difference (degrees) over the animated joints. Used to detect loops.
 */
export function resultSeam(target, result) {
  const last = result.times.length - 1;
  const a = resultJointPositions(target, result, 0), b = resultJointPositions(target, result, last);
  let position = 0, rotation = 0;
  for (const [name, arr] of result.rotations) {
    position = Math.max(position, a.get(name).distanceTo(b.get(name)));
    const qa = new THREE.Quaternion().fromArray(arr, 0), qb = new THREE.Quaternion().fromArray(arr, last * 4);
    rotation = Math.max(rotation, THREE.MathUtils.radToDeg(qa.angleTo(qb)));
  }
  return { position, rotation };
}

/**
 * Clip GLB: the target skeleton (no mesh) and one animation, LINEAR, rotations for every
 * mapped joint plus the Hips translation. `extras` lands on the animation (`extras.clip`).
 */
export function writeClipDocument(target, result, name, extras = {}) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('scene');
  const nodeOf = new Map();
  const firstByName = new Map();
  for (const e of target.order) {
    const node = doc.createNode(e.name).setTranslation([...e.t]).setRotation([...e.r]).setScale([...e.s]);
    nodeOf.set(e, node);
    if (!firstByName.has(e.name)) firstByName.set(e.name, node);
    if (e.parent) nodeOf.get(e.parent).addChild(node); else scene.addChild(node);
  }
  const animation = doc.createAnimation(name);
  const input = doc.createAccessor().setType('SCALAR').setBuffer(buffer).setArray(Float32Array.from(result.times));
  const track = (node, path, type, array) => {
    const sampler = doc.createAnimationSampler().setInput(input).setInterpolation('LINEAR')
      .setOutput(doc.createAccessor().setType(type).setBuffer(buffer).setArray(array));
    animation.addSampler(sampler);
    animation.addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler));
  };
  for (const [joint, array] of result.rotations) track(firstByName.get(joint), 'rotation', 'VEC4', array);
  track(firstByName.get('Hips'), 'translation', 'VEC3', result.hips);
  animation.setExtras({ clip: { schema: CLIP_SCHEMA, skeleton: 'meshy-28', ...extras } });
  return doc;
}

/** `extras.clip` of a clip document's first animation ({} when absent). */
export function clipMetadata(doc) {
  return doc.getRoot().listAnimations()[0]?.getExtras()?.clip || {};
}
