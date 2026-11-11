#!/usr/bin/env node
// Convert every catalog clip of the private studio-assets animation catalog into meshy-28
// reference clips (docs/animation-conversion.md#library).
//
//   node tools/animations/build-library.mjs --catalog=<studio-assets>/animations/catalog.json --out=<library dir>
//        [--only=<category,...>] [--ids=<id,...>]
//
// Writes <out>/reference/<name>.glb and <out>/index.json: per clip the pack key it proposes
// (tools/lib/animation-library.mjs), catalog id, duration, loop (detected from the seam where
// the category allows it), airborne (both feet off the ground in the source), speed (m/s at
// reference scale) and the skipped catalog clips with their reason. Bake and QA per character
// with bake-character.mjs and clip-qa.mjs; library-report.mjs folds the verdicts back in.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CLIP_FPS, referenceSkeletonDocument, resultSeam, retargetClip, skeletonGraph, writeClipDocument } from '../lib/animation-retarget.mjs';
import { LIBRARY_EXTRA_NAMES, LOOP_SEAM, planLibrary } from '../lib/animation-library.mjs';
import { openSource } from '../lib/animation-sources.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const catalogFile = flag('catalog'), outDir = flag('out');
if (!catalogFile || !outDir) {
  console.error('usage: build-library.mjs --catalog=<catalog.json> --out=<dir> [--only=<category,...>] [--ids=<id,...>]');
  process.exit(1);
}
const catalog = JSON.parse(readFileSync(catalogFile, 'utf8'));
const root = path.dirname(path.dirname(path.resolve(catalogFile)));
const plan = planLibrary(catalog);
const only = flag('only')?.split(','), ids = flag('ids')?.split(',');
const todo = plan.clips.filter((c) => (!only || only.includes(c.category)) && (!ids || ids.includes(c.id)));
mkdirSync(path.join(outDir, 'reference'), { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const target = skeletonGraph(referenceSkeletonDocument());
const round = (v, d = 4) => +v.toFixed(d);

const entries = [], errors = [];
for (const [n, c] of todo.entries()) {
  const file = path.join(root, c.file);
  try {
    const src = c.action
      ? await openSource(file, { action: c.action, rig: 'ual' })
      : await openSource(file);
    const draft = retargetClip(src.source, target, { fps: CLIP_FPS, rootMotion: 'in-place', loop: c.loop === true });
    const seam = resultSeam(target, draft);
    const loop = c.loop === 'auto' ? seam.position <= LOOP_SEAM.position && seam.rotation <= LOOP_SEAM.rotation : c.loop;
    // Loops re-run so foot IK ramps wrap the seam.
    const result = loop && c.loop !== true ? retargetClip(src.source, target, { fps: CLIP_FPS, rootMotion: 'in-place', loop: true }) : draft;
    const frames = result.times.length;
    const airborne = result.airborneFrames >= 2;
    const meta = {
      fps: CLIP_FPS, frames, duration: round(result.times[frames - 1]), loop, hold: c.hold, airborne,
      rootMotion: result.rootMotion, hipsScale: round(result.hipsScale, 6), footContact: result.contactCorrection, footIk: result.ik,
      contacts: result.contacts, contactSlide: result.sourceSlide, footClearance: result.footClearance, sourceHipsRatio: result.sourceHipsRatio, alignedLimbs: result.aligned,
      source: { id: c.id, rig: src.rig, file: path.basename(file), take: src.take, nativeFps: src.source.nativeFps, duration: round(src.source.duration), start: 0, end: round(src.source.duration) },
      library: { key: c.key, keyStatus: c.keyStatus, primary: c.primary, category: c.category },
      reference: 'meshy-28 reference (MESHY28_REFERENCE_JOINTS)',
    };
    await io.write(path.join(outDir, 'reference', `${c.name}.glb`), writeClipDocument(target, result, c.name, meta));
    entries.push({
      name: c.name, key: c.key, keyStatus: c.keyStatus, primary: c.primary, id: c.id, category: c.category, pack: c.pack,
      weapon: c.weapon, hold: c.hold, loop, loopSeam: { position: round(seam.position), rotation: round(seam.rotation, 2) }, airborne,
      duration: meta.duration, frames, speed: result.rootMotion.speed, velocity: result.rootMotion.velocity,
      file: `reference/${c.name}.glb`, source: { file: c.file, action: c.action },
    });
    console.log(`[${n + 1}/${todo.length}] ${c.name} ${c.key ? `${c.key} (${c.keyStatus}${c.primary ? ', primary' : ''})` : ''} ${meta.duration}s${loop ? ' loop' : ''}${airborne ? ' airborne' : ''} ${result.rootMotion.speed} m/s`);
  } catch (error) {
    errors.push({ id: c.id, error: error.message });
    console.error(`[${n + 1}/${todo.length}] FAILED ${c.id}: ${error.message}`);
  }
}
const index = {
  schema: 'coro-solto/animation-library@1', skeleton: 'meshy-28', fps: CLIP_FPS, catalog: catalog.schema,
  counts: { catalog: catalog.clips.length, converted: entries.length, skipped: plan.skipped.length, failed: errors.length },
  libraryExtraNames: LIBRARY_EXTRA_NAMES,
  clips: entries, skipped: plan.skipped, failed: errors,
};
writeFileSync(path.join(outDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
console.log(`library: ${entries.length} converted, ${plan.skipped.length} skipped, ${errors.length} failed -> ${path.join(outDir, 'index.json')}`);
if (errors.length) process.exit(1);
