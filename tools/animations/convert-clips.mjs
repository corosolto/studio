#!/usr/bin/env node
// Convert source animations to meshy-28 reference clips (docs/animation-conversion.md).
//
//   node tools/animations/convert-clips.mjs --manifest=<clips.json> --out=<dir> [--catalog=<studio-assets>/animations/catalog.json]
//        [--sources=<dir>] [--reference=<meshy28.glb>]
//   node tools/animations/convert-clips.mjs <source.fbx|.glb> --out=<dir> [--name=<clip>] [--id=<catalog id>] [--action=<name>] [--take=<name>]
//        [--loop] [--hold=rifle|pistol|knife|none] [--airborne] [--start=<s>] [--end=<s>]
//        [--root-motion=in-place|keep|strip] [--rig=mixamo|ual|meshy-28] [--reference=<meshy28.glb>] [--no-foot-contact] [--no-foot-ik] [--no-limb-align]
//   node tools/animations/convert-clips.mjs <source.glb> --list
//
// Sources: Mixamo FBX (mixamorig rig, with or without skin, any frame rate), Quaternius UAL
// glTF (one action per clip, --action) and meshy-28 clips. Output: one `<name>.glb` per clip
// on the meshy-28 reference skeleton (MESHY28_REFERENCE_JOINTS, or the skeleton of
// --reference), resampled to 30 fps, plus `manifest.json`. Metadata (loop, hold, root motion,
// source) is stored in the animation's `extras.clip`.
// Manifest: { "clips": [{ "name", "id"?, "source"?, "action"?, "take"?, "loop"?, "hold"?, "airborne"?,
// "start"?, "end"?, "rootMotion"? }] }. `id` is the private corosolto/studio-assets animation
// catalog id (provenance, recorded in extras.clip.source.id); with --catalog it also resolves
// the source file. Otherwise `source` is relative to --sources (default: the manifest's folder).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  CLIP_FPS, ROOT_MOTION_MODES, referenceSkeletonDocument, retargetClip, skeletonGraph, writeClipDocument,
} from '../lib/animation-retarget.mjs';
import { listActions, openSource } from '../lib/animation-sources.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const has = (name) => args.includes(`--${name}`);
const positional = args.filter((a) => !a.startsWith('--'));
const usage = 'usage: convert-clips.mjs --manifest=<clips.json> --out=<dir> | <source> --out=<dir> [--name= --action= --loop --hold= --start= --end= --root-motion=] | <source.glb> --list';

if (has('list')) {
  if (!positional[0]) { console.error(usage); process.exit(1); }
  for (const a of await listActions(positional[0])) console.log(`${a.name}\t${a.duration}s`);
  process.exit(0);
}
const outDir = flag('out');
if (!outDir || (!flag('manifest') && !positional[0])) { console.error(usage); process.exit(1); }
mkdirSync(outDir, { recursive: true });

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const referenceDoc = flag('reference') ? await io.read(flag('reference')) : referenceSkeletonDocument();
const target = skeletonGraph(referenceDoc);
const slug = (text) => String(text).toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let entries, sourcesDir;
if (flag('manifest')) {
  const manifestFile = path.resolve(flag('manifest'));
  entries = JSON.parse(readFileSync(manifestFile, 'utf8')).clips;
  sourcesDir = path.resolve(flag('sources') || path.dirname(manifestFile));
} else {
  sourcesDir = process.cwd();
  entries = [{
    name: flag('name'), id: flag('id'), source: positional[0], action: flag('action'), take: flag('take'), rig: flag('rig'),
    loop: has('loop') ? true : undefined, hold: flag('hold'), airborne: has('airborne'),
    start: flag('start') != null ? Number(flag('start')) : undefined, end: flag('end') != null ? Number(flag('end')) : undefined,
    rootMotion: flag('root-motion'),
  }];
}

const catalog = flag('catalog') ? JSON.parse(readFileSync(flag('catalog'), 'utf8')) : null;
// Catalog `file` paths are relative to the studio-assets repository root (catalog: animations/catalog.json).
const catalogRoot = catalog ? path.dirname(path.dirname(path.resolve(flag('catalog')))) : null;
const sourceFile = (entry) => {
  if (catalog && entry.id) {
    const hit = catalog.clips.find((c) => c.id === entry.id);
    if (!hit) throw new Error(`catalog has no clip ${entry.id}`);
    return path.join(catalogRoot, hit.file);
  }
  if (!entry.source) throw new Error(`${entry.name || entry.id}: no source (pass --catalog for catalog ids)`);
  return path.resolve(sourcesDir, entry.source);
};

const results = [];
for (const entry of entries) {
  const file = sourceFile(entry);
  const opened = await openSource(file, { action: entry.action, take: entry.take, rig: entry.rig });
  const name = entry.name || slug(entry.action || path.basename(file));
  const loop = entry.loop ?? /_Loop$/.test(entry.action || '');
  const rootMotion = entry.rootMotion || 'in-place';
  if (!ROOT_MOTION_MODES.includes(rootMotion)) throw new Error(`${name}: rootMotion must be one of ${ROOT_MOTION_MODES.join(', ')}`);
  const start = entry.start ?? 0, end = entry.end ?? opened.source.duration;
  const result = retargetClip(opened.source, target, { fps: CLIP_FPS, start, end, rootMotion, footContact: !has('no-foot-contact'), footIk: !has('no-foot-ik'), loop, alignLimbs: has('no-limb-align') ? [] : undefined });
  const frames = result.times.length;
  const meta = {
    fps: CLIP_FPS, frames, duration: +result.times[frames - 1].toFixed(4), loop, hold: entry.hold || 'none', airborne: Boolean(entry.airborne),
    rootMotion: result.rootMotion, hipsScale: +result.hipsScale.toFixed(6), footContact: result.contactCorrection, footIk: result.ik, contacts: result.contacts, contactSlide: result.sourceSlide, sourceHipsRatio: result.sourceHipsRatio, alignedLimbs: result.aligned,
    source: {
      id: entry.id || null, rig: opened.rig, file: path.basename(file), take: opened.take, nativeFps: opened.source.nativeFps,
      duration: +opened.source.duration.toFixed(4), start: +start.toFixed(4), end: +end.toFixed(4),
    },
    reference: flag('reference') ? path.basename(flag('reference')) : 'meshy-28 reference (MESHY28_REFERENCE_JOINTS)',
  };
  await io.write(path.join(outDir, `${name}.glb`), writeClipDocument(target, result, name, meta));
  results.push({ name, mappedJoints: result.mapped.length, ...meta });
  console.log(`ok ${name}: ${opened.rig} ${path.basename(file)}${opened.take ? ` [${opened.take}]` : ''} ${meta.source.nativeFps ?? '?'} fps -> ${frames} f @ ${CLIP_FPS} fps, ${meta.duration}s, ${result.mapped.length} joints, root ${rootMotion} ${result.rootMotion.speed} m/s${loop ? ', loop' : ''}`);
}
writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({ skeleton: 'meshy-28', fps: CLIP_FPS, clips: results }, null, 2)}\n`);
