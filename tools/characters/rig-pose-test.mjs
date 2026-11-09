#!/usr/bin/env node
// Numeric pose test of a skinned meshy-28 GLB (docs/character-rig.md).
//
//   node tools/characters/rig-pose-test.mjs <model.glb> [--clips=<dir>] [--out=<report.json>]
//        [--label=<name>] [--strict] [--bake=<pose>[@<fraction>]:<out.glb>]...
//
// Skins the mesh on the CPU exactly like three.js and measures, for five synthetic poses
// (arms up 90°, arms forward 60°, a step with each leg, head turned 60°) and, with --clips, for
// 8 instants of each of the 11 state clips (use the clips retargeted to this model): the
// longest edge stretch versus the bind pose, the 99th percentile, the upper-back and hand
// regions, how far welded seam vertices drift apart, and the 10 worst vertices with their
// bones. --strict exits 1 when tools/lib/character-rig.mjs#POSE_THRESHOLDS fail.
// --bake writes a static posed copy (no skin) for renders, e.g. --bake=walk@0.25:walk.glb or
// --bake=arms-up-90:up.glb; `rest` bakes the bind pose.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  CLIP_SAMPLES, CLIP_STATES, SYNTHETIC_POSES, bakePosedDocument, clipOverrides, clipSampler, evaluatePoseReport,
  loadRig, measurePose, measureSetup, skinPositions, summarize, syntheticOverrides,
} from '../lib/character-rig.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const model = args.find((a) => !a.startsWith('--'));
if (!model) {
  console.error('usage: rig-pose-test.mjs <model.glb> [--clips=<dir>] [--out=<report.json>] [--label=<name>] [--strict] [--bake=<pose>[@<f>]:<out.glb>]');
  process.exit(1);
}
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const clipsDir = flag('clips');
const rig = loadRig(await io.read(model));
const setup = measureSetup(rig);
const poses = [];
const samplers = new Map();

for (const pose of SYNTHETIC_POSES) {
  poses.push({ kind: 'synthetic', name: pose.name, ...measurePose(rig, setup, skinPositions(rig, syntheticOverrides(rig, pose))) });
}
if (clipsDir) {
  for (const state of CLIP_STATES) {
    const file = path.join(clipsDir, `${state}.glb`);
    if (!existsSync(file)) throw new Error(`missing clip ${file}`);
    const sampler = clipSampler(await io.read(file));
    if (!sampler) throw new Error(`${file}: no animation`);
    samplers.set(state, sampler);
    for (let k = 0; k < CLIP_SAMPLES; k += 1) {
      const fraction = k / (CLIP_SAMPLES - 1);
      const time = +(sampler.duration * fraction).toFixed(4);
      poses.push({ kind: 'clip', name: state, time, ...measurePose(rig, setup, skinPositions(rig, clipOverrides(rig, sampler, time))) });
    }
  }
}

const triangles = rig.prims.reduce((sum, p) => sum + (p.idx ? p.idx.length : p.count) / 3, 0);
let minY = Infinity, maxY = -Infinity;
for (const b of setup.bind) for (let v = 1; v < b.length; v += 3) { minY = Math.min(minY, b[v]); maxY = Math.max(maxY, b[v]); }
const report = {
  model: path.resolve(model), label: flag('label') || path.basename(model, '.glb'), clips: clipsDir ? path.resolve(clipsDir) : null,
  triangles, vertices: rig.prims.reduce((sum, p) => sum + p.count, 0), height: +(maxY - minY).toFixed(4),
  bindError: +setup.bindError.toExponential(3), hasBack: setup.hasBack, hasHands: setup.hasHands,
  summary: summarize(poses), poses,
};
report.failures = evaluatePoseReport(report);
if (flag('out')) writeFileSync(flag('out'), `${JSON.stringify(report, null, 2)}\n`);

const fmt = (x) => (x == null ? '—' : `${x.value}× ${x.pose}${x.time != null ? `@${x.time}s` : ''}`);
console.log(`${report.label}: ${triangles} tris, height ${report.height} m, bind error ${report.bindError} m`);
for (const kind of ['synthetic', 'clip']) {
  const s = report.summary[kind];
  if (!s.maxEdge) continue;
  console.log(`  ${kind.padEnd(9)} max edge ${fmt(s.maxEdge)} | back ${fmt(s.backMaxEdge)} | hand L ${fmt(s.handMaxEdgeL)} | hand R ${fmt(s.handMaxEdgeR)} | seam gap ${s.seamGapMax?.value ?? 0} m`);
  const worstPose = poses.filter((p) => p.kind === kind).sort((a, b) => b.maxEdge - a.maxEdge)[0];
  console.log(`  worst ${kind} vertices (${worstPose.name}${worstPose.time != null ? `@${worstPose.time}s` : ''}):`);
  for (const v of worstPose.worstVertices) console.log(`    ${String(v.ratio).padEnd(7)} v${v.vertex} rest ${v.rest.join(',')} ${v.bones.map(([b, w]) => `${b}:${w}`).join(' ')}`);
}
console.log(report.failures.length ? `  FAIL ${report.failures.length} threshold(s): ${report.failures.slice(0, 5).join(' | ')}` : '  PASS pose thresholds');

for (const spec of args.filter((a) => a.startsWith('--bake=')).map((a) => a.slice(7))) {
  const at = spec.lastIndexOf(':');
  const [poseName, fractionText] = spec.slice(0, at).split('@');
  const out = spec.slice(at + 1);
  const fresh = loadRig(await io.read(model));
  let overrides = new Map();
  const synthetic = SYNTHETIC_POSES.find((p) => p.name === poseName);
  if (synthetic) overrides = syntheticOverrides(fresh, synthetic);
  else if (poseName !== 'rest') {
    const sampler = samplers.get(poseName) || (clipsDir && clipSampler(await io.read(path.join(clipsDir, `${poseName}.glb`))));
    if (!sampler) throw new Error(`--bake: unknown pose ${poseName} (pass --clips for clip states)`);
    overrides = clipOverrides(fresh, sampler, sampler.duration * Number(fractionText ?? 0));
  }
  await io.write(out, bakePosedDocument(fresh, skinPositions(fresh, overrides)));
  console.log(`  baked ${spec.slice(0, at)} -> ${out}`);
}
if (args.includes('--strict') && report.failures.length) process.exit(1);
