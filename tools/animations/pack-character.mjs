#!/usr/bin/env node
// Pack one character's baked clips for the client (docs/animation-conversion.md#packs).
//
//   node tools/animations/pack-character.mjs --clips=<baked dir> --out=<dir> [--id=<character id>]
//        [--states=<a,b>] [--extras=<a,b>] [--model=<character.glb>] [--no-compress]
//
// Writes <out>/states.glb (the runtime states, one animation each, named by state), <out>/extra.glb
// (the contract extras present in --clips, named by their vocabulary key) and <out>/manifest.json:
// per file sha256 and bytes, per clip its file, duration, loop, root speed (m/s at this
// character's scale), hold and provenance (studio-assets catalog id). Defaults: every state of
// the pack contract and every contract extra name found in --clips.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { clipMetadata } from '../lib/animation-retarget.mjs';
import { extraClipNames, isExtraClipName, optionalCharacterStates, requiredCharacterStates } from '../lib/character-pack.mjs';
import { PACK_RESAMPLE_TOLERANCE, packClips } from '../lib/clip-pack.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const clipsDir = flag('clips'), outDir = flag('out');
if (!clipsDir || !outDir) {
  console.error('usage: pack-character.mjs --clips=<baked dir> --out=<dir> [--id=] [--states=a,b] [--extras=a,b] [--model=] [--no-compress]');
  process.exit(1);
}
const compress = !args.includes('--no-compress');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const present = (n) => existsSync(path.join(clipsDir, `${n}.glb`));
const states = flag('states')?.split(',') || [...requiredCharacterStates, ...optionalCharacterStates].filter(present);
const extras = flag('extras')?.split(',') || extraClipNames.filter(present);
for (const n of extras) if (!isExtraClipName(n)) throw new Error(`${n} is not a contract extra name`);
for (const n of requiredCharacterStates) if (!states.includes(n)) throw new Error(`missing required state ${n}`);
mkdirSync(outDir, { recursive: true });

const manifest = {
  schema: 'coro-solto/character-clips@1', id: flag('id') || path.basename(path.resolve(outDir)), skeleton: 'meshy-28',
  model: flag('model') ? { file: path.basename(flag('model')), sha256: createHash('sha256').update(readFileSync(flag('model'))).digest('hex') } : null,
  compression: compress ? { resampleTolerance: PACK_RESAMPLE_TOLERANCE, rotations: 'int16 normalized (core glTF, read by three.js GLTFLoader)' } : null,
  files: {}, clips: {},
};
for (const [file, names] of [['states.glb', states], ['extra.glb', extras]]) {
  if (!names.length) continue;
  const clips = [];
  for (const name of names) clips.push({ name, doc: await io.read(path.join(clipsDir, `${name}.glb`)) });
  const bytes = await io.writeBinary(await packClips(clips, { compress }));
  writeFileSync(path.join(outDir, file), bytes);
  manifest.files[file] = { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 9 }).length, clips: names };
  for (const { name, doc } of clips) {
    const m = clipMetadata(doc);
    manifest.clips[name] = {
      file, duration: m.duration ?? null, loop: Boolean(m.loop), hold: m.hold || 'none', airborne: Boolean(m.airborne),
      speed: m.rootMotion?.speed ?? null, velocity: m.rootMotion?.velocity ?? null,
      provenance: m.source?.id || null, sourceTake: m.source?.take || null,
    };
  }
}
writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${manifest.id}: ${Object.entries(manifest.files).map(([f, v]) => `${f} ${v.clips.length} clips ${v.bytes} B (${v.gzipBytes} gzip)`).join(', ')}`);
