#!/usr/bin/env node
// Offline prerequisite only. This is not a visual/weapon-contact approval.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { cloneDocument } from '@gltf-transform/functions';
import * as THREE from 'three';
import { loadRig, POSE_THRESHOLDS, skinPositions, worldMatrices } from '../lib/character-rig.mjs';

// Inherit, do not invent, the existing hand-edge ceiling from character-rig.mjs:384-390.
// Calibration: docs/character-rig.md:97-104 records mst hand L/R 1.68x/1.30x,
// measured by rig-pose-test.mjs and compared with the original client RM1 hand gate.
const handEdgeLimit = POSE_THRESHOLDS.synthetic.handMaxEdge;
const same = (a, b, message) => assert.deepEqual(Array.from(a), Array.from(b), message);
const distance = (a, b, v) => Math.hypot(...[0, 1, 2].map(k => a[v * 3 + k] - b[v * 3 + k]));
export function handRegion(rig, config) {
  const hi = rig.names.indexOf(config.hand), ci = rig.names.indexOf(config.curl);
  assert(hi >= 0 && ci >= 0, 'missing Hand/Curl');
  const inverse = worldMatrices(rig)(rig.joints[hi]).clone().invert();
  const scale = new THREE.Vector3().setFromMatrixScale(worldMatrices(rig)(rig.joints[hi])).x;
  const p = rig.prims[0];
  const points = [], members = [];
  for (let v = 0; v < p.count; v++) {
    points.push(new THREE.Vector3().fromArray(p.pos, v * 3).applyMatrix4(inverse).multiplyScalar(scale));
    members.push([0, 1, 2, 3].reduce((sum, k) => sum + (p.J[v * 4 + k] === hi ? p.W[v * 4 + k] : 0), 0) > 0.5);
  }
  return { hi, ci, points, members, scale };
}
function branches(rig, region, config) {
  // Weld position duplicates only for the measurement; never change exported topology.
  const p = rig.prims[0], keys = new Map(), weld = [];
  for (let v = 0; v < p.count; v++) {
    const key = Array.from(p.pos.slice(v * 3, v * 3 + 3), x => x.toFixed(6)).join(',');
    if (!keys.has(key)) keys.set(key, keys.size);
    weld.push(keys.get(key));
  }
  const selected = region.points.map((q, v) => region.members[v] && q.y > config.branchY && q.x * config.thumbSign < config.thumbX);
  const adj = new Map();
  assert(p.idx, 'finger topology requires indexed triangles');
  for (let t = 0; t < p.idx.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = p.idx[t + e], b = p.idx[t + (e + 1) % 3];
    if (!selected[a] || !selected[b]) continue;
    if (!adj.has(weld[a])) adj.set(weld[a], new Set());
    if (!adj.has(weld[b])) adj.set(weld[b], new Set());
    adj.get(weld[a]).add(weld[b]); adj.get(weld[b]).add(weld[a]);
  }
  const seen = new Set(), components = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const stack = [start], ids = new Set([start]); seen.add(start);
    while (stack.length) for (const next of adj.get(stack.pop())) {
      if (!seen.has(next)) { seen.add(next); ids.add(next); stack.push(next); }
    }
    components.push(weld.flatMap((w, v) => ids.has(w) ? [v] : []));
  }
  assert.equal(components.length, 4, `${config.hand}: annotation must isolate four fingers (not the thumb)`);
  assert(components.every(c => c.length >= 8), 'finger component too small');
  return components;
}
export function assertGrip(before, after, config) {
  const a = loadRig(before), b = loadRig(after);
  assert.equal(a.prims.length, 1, 'pilot annotation requires one primitive');
  assert.equal(b.prims.length, 1, 'primitive count changed');
  same(a.prims[0].pos, b.prims[0].pos, 'base shape changed');
  same(a.prims[0].idx, b.prims[0].idx, 'topology changed');
  assert.deepEqual(a.names, b.names, 'joint order/names changed');
  const ma = before.getRoot().listMeshes()[0].listPrimitives()[0], mb = after.getRoot().listMeshes()[0].listPrimitives()[0];
  assert.deepEqual(ma.listSemantics(), mb.listSemantics(), 'attribute semantics changed');
  for (const semantic of ma.listSemantics()) if (!['JOINTS_0', 'WEIGHTS_0'].includes(semantic)) {
    same(ma.getAttribute(semantic).getArray(), mb.getAttribute(semantic).getArray(), `${semantic} changed`);
  }
  const bindA = skinPositions(a)[0], bindB = skinPositions(b)[0], p = b.prims[0];
  let bindError = 0;
  for (let v = 0; v < p.count; v++) {
    bindError = Math.max(bindError, distance(bindA, bindB, v));
    const sum = [0, 1, 2, 3].reduce((s, k) => s + p.W[v * 4 + k], 0);
    assert(Math.abs(sum - 1) < 1e-5, 'weight mass lost');
  }
  assert(bindError < 0.0001, `bind shape error ${bindError}`);
  const result = { bindError, hands: [] }, allowed = new Set();
  for (const h of config.hands) {
    const region = handRegion(a, h), { hi, ci, points, members } = region;
    const fingers = branches(a, region, h);
    let influenced = 0;
    const weight = (rig, v, j) => [0, 1, 2, 3].reduce((s, k) => s + (rig.prims[0].J[v * 4 + k] === j ? rig.prims[0].W[v * 4 + k] : 0), 0);
    for (let v = 0; v < p.count; v++) {
      const q = points[v], protectedVertex = !members[v] || q.y <= h.palmY || q.x * h.thumbSign >= h.thumbX;
      const cw = weight(b, v, ci);
      if (cw > 1e-5) {
        influenced++; allowed.add(v);
        assert(!protectedVertex, `${h.hand}: palm/thumb acquired Curl influence`);
      }
      assert(Math.abs(weight(a, v, hi) - weight(b, v, hi) - cw) < 1e-5, 'Curl mass must come only from Hand');
    }
    assert(influenced > 32, `${h.hand}: zero/insufficient finger influence`);
    const bends = [];
    for (const angle of [0.55, 0.95]) {
      const node = b.joints[ci], trs = b.trs.get(node);
      const euler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(...trs.r), 'XYZ'); euler.x += angle;
      const overrides = new Map([[node, { ...trs, r: new THREE.Quaternion().setFromEuler(euler).toArray() }]]);
      const bent = skinPositions(b, overrides)[0];
      const inv = worldMatrices(b)(b.joints[hi]).clone().invert();
      const moving = fingers.map(group => {
        const deltas = group.map(v => {
          const rest = new THREE.Vector3().fromArray(bindB, v * 3).applyMatrix4(inv).multiplyScalar(region.scale);
          const curl = new THREE.Vector3().fromArray(bent, v * 3).applyMatrix4(inv).multiplyScalar(region.scale);
          return { displacement: curl.distanceTo(rest), inward: curl.z - rest.z, shortening: rest.y - curl.y };
        });
        const mean = field => deltas.reduce((s, d) => s + d[field], 0) / deltas.length;
        assert(mean('displacement') > 0.005, `${h.hand}: inert finger`);
        assert(mean('inward') > 0.003 && mean('shortening') > 0.001, `${h.hand}: wrong flexion frame/sign`);
        return { vertices: group.length, meanDisplacement: mean('displacement'), inward: mean('inward') };
      });
      let protectedMotion = 0, maxEdge = 1;
      for (let v = 0; v < p.count; v++) if (!members[v] || points[v].y <= h.palmY || points[v].x * h.thumbSign >= h.thumbX) {
        protectedMotion = Math.max(protectedMotion, distance(bindB, bent, v));
      }
      assert(protectedMotion < 0.0001, `${h.hand}: curl rotates palm/thumb/body`);
      for (let t = 0; t < p.idx.length; t += 3) for (let e = 0; e < 3; e++) {
        const i = p.idx[t + e], j = p.idx[t + (e + 1) % 3];
        const len = data => Math.hypot(...[0, 1, 2].map(k => data[i * 3 + k] - data[j * 3 + k]));
        if (len(bindB) > 0.0001) maxEdge = Math.max(maxEdge, len(bent) / len(bindB));
      }
      assert(maxEdge <= handEdgeLimit, `${h.hand}: curl tears topology ${maxEdge}x (existing hand ceiling ${handEdgeLimit}x)`);
      bends.push({ angle, moving, protectedMotion, maxEdge });
    }
    result.hands.push({ hand: h.hand, influenced, bends });
  }
  // Outside the authored finger region every original influence must remain intact.
  for (let v = 0; v < p.count; v++) {
    const weights = rig => {
      const out = new Map();
      for (let k = 0; k < 4; k++) { const w = rig.prims[0].W[v * 4 + k], j = rig.prims[0].J[v * 4 + k]; if (w) out.set(j, (out.get(j) || 0) + w); }
      return out;
    };
    const wa = weights(a), wb = weights(b);
    const handIndices = config.hands.flatMap(h => [a.names.indexOf(h.hand), a.names.indexOf(h.curl)]);
    for (const j of new Set([...wa.keys(), ...wb.keys()])) if (!allowed.has(v) || !handIndices.includes(j)) {
      assert(Math.abs((wa.get(j) || 0) - (wb.get(j) || 0)) < 1e-5, 'unrelated skin weight changed');
    }
  }
  return result;
}

export function assertGripMutants(before, after, config) {
  const reject = (name, doc, pattern) => {
    assert.throws(() => assertGrip(before, doc, config), pattern, `mutant survived: ${name}`);
    console.log(`KILLED ${name}`);
  };
  reject('original-zero-finger-influence', before, /zero\/insufficient finger influence/);
  const geometry = cloneDocument(after); geometry.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION').getArray()[0] += 0.01;
  reject('changed-base-silhouette', geometry, /base shape changed/);
  const wholeHand = cloneDocument(after), rig = loadRig(wholeHand), h = config.hands[0], region = handRegion(loadRig(before), h);
  const v = region.members.findIndex((m, i) => m && region.points[i].y < h.palmY);
  assert(v >= 0, 'palm mutant did not find a protected vertex');
  const j = rig.prims[0].J, w = rig.prims[0].W;
  let changed = false;
  for (let k = 0; k < 4; k++) if (j[v * 4 + k] === region.hi && w[v * 4 + k] > 0) {
    j[v * 4 + k] = region.ci; changed = true;
  }
  assert(changed, 'palm mutant did not change an influence');
  reject('whole-palm-as-fingers', wholeHand, /palm\/thumb acquired Curl influence/);
  const wrongFrame = cloneDocument(after); wrongFrame.getRoot().listNodes().find(n => n.getName() === h.curl).setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI).toArray());
  reject('reversed-flexion-frame', wrongFrame, /bind shape error|wrong flexion frame/);
}

if (process.argv[1]?.endsWith('/character-grip-check.mjs')) {
  const [source, repaired, annotation, flag] = process.argv.slice(2);
  assert(source && repaired && annotation, 'usage: character-grip-check.mjs <before.glb> <after.glb> <grip.json> [--mutants]');
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), config = JSON.parse(readFileSync(annotation, 'utf8'));
  const before = await io.read(source), after = await io.read(repaired);
  console.log(JSON.stringify(assertGrip(before, after, config), null, 2));
  if (flag === '--mutants') assertGripMutants(before, after, config);
}
