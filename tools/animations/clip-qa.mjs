#!/usr/bin/env node
// Clip QA gate (docs/animation-conversion.md): foot slide while planted, lowest vertex against
// the floor, hips height range, loop seam, two-hand grip stability and skin stretch (through
// tools/characters/rig-pose-test.mjs --clips) for meshy-28 clips baked onto one character.
//
//   node tools/animations/clip-qa.mjs --model=<character.glb> --clips=<dir> [--states=<a,b>]
//        [--out=<report.json>] [--label=<name>] [--samples=<n>] [--flags-from=<dir>] [--no-stretch] [--strict]
//
// Clip metadata (extras.clip: loop, hold, airborne, rootMotion) selects the gates that apply.
// --flags-from takes loop, hold and airborne from the same-named clip in another directory, for
// clips without metadata (the client's shipped clips) measured against converted ones.
// --strict exits 1 when any clip fails tools/lib/clip-qa.mjs#CLIP_QA_THRESHOLDS.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clipMetadata } from '../lib/animation-retarget.mjs';
import { clipSampler, loadRig } from '../lib/character-rig.mjs';
import { CLIP_QA_THRESHOLDS, evaluateClip, measureClip, stretchFromPoseReport } from '../lib/clip-qa.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const model = flag('model'), clipsDir = flag('clips');
if (!model || !clipsDir) {
  console.error('usage: clip-qa.mjs --model=<character.glb> --clips=<dir> [--states=<a,b>] [--out=<report.json>] [--label=<name>] [--samples=<n>] [--flags-from=<dir>] [--no-stretch] [--strict]');
  process.exit(1);
}
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const states = flag('states')?.split(',').filter(Boolean)
  || readdirSync(clipsDir).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4)).sort();

let poseReport = null;
if (!args.includes('--no-stretch')) {
  const scratch = mkdtempSync(path.join(tmpdir(), 'clip-qa-'));
  const reportFile = path.join(scratch, 'pose-test.json');
  const poseTest = fileURLToPath(new URL('../characters/rig-pose-test.mjs', import.meta.url));
  execFileSync(process.execPath, [poseTest, model, `--clips=${clipsDir}`, `--states=${states.join(',')}`, `--samples=${flag('samples') || 12}`, `--out=${reportFile}`], { stdio: 'pipe' });
  poseReport = JSON.parse(readFileSync(reportFile, 'utf8'));
  rmSync(scratch, { recursive: true, force: true });
}

const rig = loadRig(await io.read(model));
const flagsFrom = (state) => {
  const file = flag('flags-from') && path.join(flag('flags-from'), `${state}.glb`);
  if (!file || !existsSync(file)) return {};
  const { loop, hold, airborne } = clipMetadata(flagsDocs.get(state));
  return { loop, hold, airborne };
};
const flagsDocs = new Map();
if (flag('flags-from')) for (const state of states) { const f = path.join(flag('flags-from'), `${state}.glb`); if (existsSync(f)) flagsDocs.set(state, await io.read(f)); }
const clips = [];
for (const state of states) {
  const doc = await io.read(path.join(clipsDir, `${state}.glb`));
  const meta = { ...clipMetadata(doc), ...flagsFrom(state) };
  const sampler = clipSampler(doc);
  if (!sampler) throw new Error(`${state}: no animation`);
  const metrics = measureClip(rig, sampler, meta);
  metrics.stretch = poseReport ? stretchFromPoseReport(poseReport, state) : null;
  const failures = evaluateClip(metrics, meta);
  clips.push({ name: state, loop: Boolean(meta.loop), hold: meta.hold || 'none', airborne: Boolean(meta.airborne), rootMotion: meta.rootMotion || null, metrics, failures });
}
const report = {
  model: path.resolve(model), label: flag('label') || path.basename(model, '.glb'), clips: path.resolve(clipsDir),
  thresholds: CLIP_QA_THRESHOLDS,
  synthetic: poseReport ? poseReport.summary.synthetic : null,
  clipCount: clips.length, failing: clips.filter((c) => c.failures.length).map((c) => c.name),
  results: clips,
};
if (flag('out')) writeFileSync(flag('out'), `${JSON.stringify(report, null, 2)}\n`);

const v = (x) => (x == null ? '—' : x);
console.log(`${report.label}: ${clips.length} clips, ${report.failing.length} failing`);
console.log('  clip                 slide(src) cm  low min/max cm  hips ratio (source)     seam cm/°     hands med±dev cm  stretch max/back/hL/hR');
for (const c of clips) {
  const m = c.metrics, s = m.stretch;
  console.log(`  ${c.name.padEnd(20)} ${`${m.footSlide.maxCm}${m.footSlide.sourceCm != null ? `(${m.footSlide.sourceCm})` : ''}`.padStart(11)}  ${`${m.lowestVertex.minCm}/${m.lowestVertex.maxCm}`.padStart(14)}  ${`${m.hips.minRatio}–${m.hips.maxRatio}${m.hips.sourceRatio ? `(${m.hips.sourceRatio.map((x) => x.toFixed(2)).join('–')})` : ''}`.padStart(22)}  ${(m.loopSeam ? `${m.loopSeam.positionCm}/${m.loopSeam.rotationDeg}` : '—').padStart(11)}  ${(m.hands ? `${m.hands.medianCm}±${m.hands.maxDeviationCm}` : '—').padStart(16)}  ${s ? `${v(s.maxEdge?.value)}/${v(s.backMaxEdge?.value)}/${v(s.handMaxEdgeL?.value)}/${v(s.handMaxEdgeR?.value)}` : '—'}`);
  for (const f of c.failures) console.log(`    FAIL ${f}`);
}
if (args.includes('--strict') && report.failing.length) process.exit(1);
