// Clip QA metrics for meshy-28 clips on a skinned character (docs/animation-conversion.md).
// Every frame of the clip is skinned on the CPU (tools/lib/character-rig.mjs, same maths as
// three.js) and measured against the floor (y = lowest vertex of the bind pose):
//   footSlide    horizontal travel of a planted foot joint (ankle or ball) in the world, i.e.
//                with the clip's extracted root motion added back (cm), inside the source's
//                contact windows; the limit rises to the source's own slide + 1 cm;
//   lowestVertex lowest skinned vertex per frame: the minimum (penetration when negative)
//                and the maximum (the whole body floats) (cm), and the minimum per body
//                region (heel, toe, hand, knee, body) with a stricter heel limit;
//   hips         Hips height range against the bind pose;
//   loopSeam     first versus last frame for loop clips: joint positions (cm) and local
//                rotations (degrees);
//   hands        LeftHand–RightHand distance; gated for two-handed weapon holds (rifle);
//   stretch      filled from tools/characters/rig-pose-test.mjs --clips (skin stretch).
import * as THREE from 'three';
import { FLOOR_CLAMP_REGIONS, FOOT_CONTACT_JOINTS, footContacts, vertexRegions } from './animation-retarget.mjs';
import { POSE_THRESHOLDS, clipOverrides, skinPositions, worldMatrices } from './character-rig.mjs';

export const CLIP_QA_THRESHOLDS = Object.freeze({
  footSlideCm: 4, // planted-foot travel within one contact window
  footSlideOverSourceCm: 1, // ...or at most this much above the source's own slide (extras.clip.contactSlide)
  penetrationCm: 2, // lowest vertex may sink at most this far below the floor
  heelPenetrationCm: 1, // heels (vertices of the Foot joints) sink at most this far
  floatCm: 3, // the per-frame lowest vertex may rise at most this far (grounded clips)
  hipsMaxRatio: 1.08, // hips above the bind height (grounded clips): legs over-extended
  loopSeamCm: 1.5,
  loopSeamDeg: 5,
  twoHandDeviationCm: 3, // |hand distance − median| for two-handed holds
  stretch: POSE_THRESHOLDS.clip,
});
export const TWO_HAND_HOLDS = Object.freeze(['rifle']);
const FOOT_JOINTS = FOOT_CONTACT_JOINTS;

const cm = (m) => +(m * 100).toFixed(2);
/** Joint name carrying the largest skin weight of vertex [primitive, vertex]. */
function dominantBone(rig, at) {
  if (!at) return null;
  const p = rig.prims[at[0]];
  let best = 0;
  for (let k = 1; k < 4; k += 1) if (p.W[at[1] * 4 + k] > p.W[at[1] * 4 + best]) best = k;
  return rig.names[p.J[at[1] * 4 + best]];
}

/**
 * Measure one clip (`sampler` from clipSampler) with metadata `meta` (extras.clip) on `rig`.
 * Returns the metric object; evaluateClip() applies the thresholds.
 */
export function measureClip(rig, sampler, meta = {}, { fps = meta.fps || 30 } = {}) {
  const duration = sampler.duration;
  const frames = Math.max(2, Math.round(duration * fps) + 1);
  const bind = skinPositions(rig);
  let floor = Infinity;
  for (const b of bind) for (let v = 1; v < b.length; v += 3) floor = Math.min(floor, b[v]);
  const restWorld = worldMatrices(rig);
  const node = (name) => rig.byName.get(name)?.[0];
  const pos = (world, name) => (node(name) ? new THREE.Vector3().setFromMatrixPosition(world(node(name))) : null);
  const restHeight = Object.fromEntries([...FOOT_JOINTS, 'Hips'].map((n) => [n, pos(restWorld, n)?.y]));
  const rm = meta.rootMotion;
  const velocity = rm && rm.extracted && rm.mode === 'in-place' ? new THREE.Vector3(rm.velocity[0], 0, rm.velocity[1]) : new THREE.Vector3();
  const deform = rig.joints.filter((j, i) => rig.joints.findIndex((k) => k.getName() === j.getName()) === i && !/^Curl_|^head_end$|^headfront$/.test(j.getName()));

  const membership = vertexRegions(rig);
  const regionLow = {};
  const lowest = [], lowestBone = [], hipsY = [], hands = [], feet = Object.fromEntries(FOOT_JOINTS.map((n) => [n, []]));
  const firstLast = [];
  for (let f = 0; f < frames; f += 1) {
    const t = f === frames - 1 ? duration : Math.min(duration, f / fps);
    const overrides = clipOverrides(rig, sampler, t);
    const world = worldMatrices(rig, overrides);
    let low = Infinity, lowAt = null;
    skinPositions(rig, overrides).forEach((p, pi) => {
      for (let v = 1; v < p.length; v += 3) {
        if (p[v] < low) { low = p[v]; lowAt = [pi, (v - 1) / 3]; }
        const r = membership[pi][(v - 1) / 3];
        const name = r == null ? 'body' : FLOOR_CLAMP_REGIONS[r].name;
        if (!(regionLow[name] <= p[v] - floor)) regionLow[name] = p[v] - floor;
      }
    });
    lowest.push(low - floor);
    lowestBone.push(lowAt);
    hipsY.push(pos(world, 'Hips').y);
    const l = pos(world, 'LeftHand'), r = pos(world, 'RightHand');
    if (l && r) hands.push(l.distanceTo(r));
    for (const n of FOOT_JOINTS) {
      const p = pos(world, n);
      if (p) feet[n].push({ t, y: p.y, x: p.x + velocity.x * t, z: p.z + velocity.z * t });
    }
    if (f === 0 || f === frames - 1) {
      firstLast.push({
        positions: deform.map((j) => new THREE.Vector3().setFromMatrixPosition(world(j))),
        rotations: deform.map((j) => new THREE.Quaternion(...((overrides.get(j) || rig.trs.get(j)).r))),
      });
    }
  }

  // Foot slide: world travel of each foot joint inside its planted windows: the source's
  // contacts carried by the clip (extras.clip.contacts), else detected on this character with
  // the same height/speed rule (footContacts).
  const fromClip = Boolean(meta.contacts);
  const times = feet[FOOT_JOINTS.find((n) => feet[n].length)]?.map((s) => s.t) || [];
  const windows = fromClip ? meta.contacts : footContacts(Object.fromEntries(FOOT_JOINTS.filter((n) => feet[n].length && restHeight[n] != null)
    .map((n) => [n, feet[n].map((s) => ({ x: s.x, z: s.z, clear: s.y - restHeight[n] }))])), times);
  const slide = { maxCm: 0, joint: null, window: null, contacts: fromClip ? 'clip' : 'detected', sourceCm: meta.contactSlide != null ? cm(meta.contactSlide) : null, plantedShare: 0 };
  let plantedFrames = 0, footFrames = 0;
  for (const n of FOOT_JOINTS) {
    const track = feet[n];
    footFrames += track.length;
    for (const [a, b] of windows[n] || []) {
      const w = track.slice(a, Math.min(b, track.length - 1) + 1);
      plantedFrames += w.length;
      let travel = 0;
      for (const s of w) travel = Math.max(travel, Math.hypot(s.x - w[0].x, s.z - w[0].z));
      if (w.length && travel > slide.maxCm / 100) Object.assign(slide, { maxCm: cm(travel), joint: n, window: [+w[0].t.toFixed(3), +w[w.length - 1].t.toFixed(3)] });
    }
  }
  slide.plantedShare = footFrames ? +(plantedFrames / footFrames).toFixed(3) : 0;

  let seam = null;
  if (meta.loop) {
    const [a, b] = firstLast;
    let posMax = 0, rotMax = 0, posJoint = null, rotJoint = null;
    deform.forEach((j, i) => {
      const d = a.positions[i].distanceTo(b.positions[i]);
      if (d > posMax) { posMax = d; posJoint = j.getName(); }
      const angle = THREE.MathUtils.radToDeg(a.rotations[i].angleTo(b.rotations[i]));
      if (angle > rotMax) { rotMax = angle; rotJoint = j.getName(); }
    });
    seam = { positionCm: cm(posMax), positionJoint: posJoint, rotationDeg: +rotMax.toFixed(2), rotationJoint: rotJoint };
  }

  const sorted = [...hands].sort((x, y) => x - y);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  const minLowest = Math.min(...lowest), maxLowest = Math.max(...lowest);
  return {
    frames, duration: +duration.toFixed(4), fps,
    footSlide: slide,
    lowestVertex: {
      minCm: cm(minLowest), minAt: +(lowest.indexOf(minLowest) / fps).toFixed(3), minBone: dominantBone(rig, lowestBone[lowest.indexOf(minLowest)]),
      maxCm: cm(maxLowest), maxAt: +(lowest.indexOf(maxLowest) / fps).toFixed(3), floorY: +floor.toFixed(4),
      byRegionCm: Object.fromEntries(Object.entries(regionLow).map(([k, v]) => [k, cm(v)])),
    },
    hips: {
      restHeight: +restHeight.Hips.toFixed(4), min: +Math.min(...hipsY).toFixed(4), max: +Math.max(...hipsY).toFixed(4),
      minRatio: +(Math.min(...hipsY) / restHeight.Hips).toFixed(3), maxRatio: +(Math.max(...hipsY) / restHeight.Hips).toFixed(3),
      sourceRatio: meta.sourceHipsRatio || null,
    },
    loopSeam: seam,
    hands: median == null ? null : {
      medianCm: cm(median), minCm: cm(sorted[0]), maxCm: cm(sorted[sorted.length - 1]),
      maxDeviationCm: cm(Math.max(median - sorted[0], sorted[sorted.length - 1] - median)),
    },
  };
}

/** Per-clip stretch summary from a rig-pose-test report (clip poses of that name). */
export function stretchFromPoseReport(report, name) {
  const poses = (report?.poses || []).filter((p) => p.kind === 'clip' && p.name === name);
  if (!poses.length) return null;
  const max = (get) => poses.reduce((best, p) => { const v = get(p); return v != null && (!best || v > best.value) ? { value: v, time: p.time } : best; }, null);
  return {
    samples: poses.length,
    maxEdge: max((p) => p.maxEdge), backMaxEdge: max((p) => p.backMaxEdge),
    handMaxEdgeL: max((p) => p.handMaxEdge?.L), handMaxEdgeR: max((p) => p.handMaxEdge?.R),
    seamGapMax: max((p) => p.seamGapMax),
  };
}

/** Threshold failures of one clip's metrics (empty when it passes). */
export function evaluateClip(metrics, meta = {}, thresholds = CLIP_QA_THRESHOLDS) {
  const failures = [];
  const grounded = !meta.airborne;
  const slideLimit = Math.max(thresholds.footSlideCm, (metrics.footSlide.sourceCm ?? -Infinity) + thresholds.footSlideOverSourceCm);
  if (metrics.footSlide.maxCm > slideLimit) failures.push(`foot slide ${metrics.footSlide.maxCm} cm (${metrics.footSlide.joint} ${metrics.footSlide.window?.join('–')}s) > ${+slideLimit.toFixed(2)}`);
  if (metrics.lowestVertex.minCm < -thresholds.penetrationCm) failures.push(`floor penetration ${metrics.lowestVertex.minCm} cm @${metrics.lowestVertex.minAt}s < -${thresholds.penetrationCm}`);
  const heel = metrics.lowestVertex.byRegionCm?.heel;
  if (heel != null && heel < -thresholds.heelPenetrationCm) failures.push(`heel sinks ${heel} cm < -${thresholds.heelPenetrationCm}`);
  if (grounded && metrics.lowestVertex.maxCm > thresholds.floatCm) failures.push(`floats ${metrics.lowestVertex.maxCm} cm @${metrics.lowestVertex.maxAt}s > ${thresholds.floatCm}`);
  if (grounded && metrics.hips.maxRatio > thresholds.hipsMaxRatio) failures.push(`hips rise to ${metrics.hips.maxRatio}× bind height > ${thresholds.hipsMaxRatio}`);
  if (meta.loop && metrics.loopSeam) {
    if (metrics.loopSeam.positionCm > thresholds.loopSeamCm) failures.push(`loop seam ${metrics.loopSeam.positionCm} cm (${metrics.loopSeam.positionJoint}) > ${thresholds.loopSeamCm}`);
    if (metrics.loopSeam.rotationDeg > thresholds.loopSeamDeg) failures.push(`loop seam ${metrics.loopSeam.rotationDeg}° (${metrics.loopSeam.rotationJoint}) > ${thresholds.loopSeamDeg}`);
  }
  if (TWO_HAND_HOLDS.includes(meta.hold) && metrics.hands && metrics.hands.maxDeviationCm > thresholds.twoHandDeviationCm) {
    failures.push(`two-hand grip drifts ${metrics.hands.maxDeviationCm} cm from ${metrics.hands.medianCm} cm > ${thresholds.twoHandDeviationCm}`);
  }
  const s = metrics.stretch, lim = thresholds.stretch;
  if (s) {
    if (s.maxEdge?.value > lim.maxEdge) failures.push(`skin stretch ${s.maxEdge.value}× @${s.maxEdge.time}s > ${lim.maxEdge}`);
    if (s.backMaxEdge?.value > lim.backMaxEdge) failures.push(`back stretch ${s.backMaxEdge.value}× @${s.backMaxEdge.time}s > ${lim.backMaxEdge}`);
    for (const side of ['L', 'R']) {
      const v = s[`handMaxEdge${side}`];
      if (v?.value > lim.handMaxEdge) failures.push(`hand ${side} stretch ${v.value}× @${v.time}s > ${lim.handMaxEdge}`);
    }
    if (s.seamGapMax?.value > lim.seamGapMax) failures.push(`seam opens ${s.seamGapMax.value} m > ${lim.seamGapMax}`);
  }
  return failures;
}
