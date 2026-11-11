#!/usr/bin/env node
// Pack one character's baked clips for the client (docs/animation-conversion.md#packs).
//
//   node tools/animations/pack-character.mjs --clips=<baked dir> --out=<dir> [--id=<character id>]
//        [--model=<character.glb>] [--emotes=<emote_a,emote_b>] [--no-compress]
//
// Writes <out>/states.glb (the runtime states), <out>/loco.glb, combat.glb and ceremony.glb (the
// contract extras in --clips, by packFamily), <out>/emotes/<key>.glb for each --emotes key, and
// <out>/manifest.json: per file sha256, bytes, gzip bytes and clips; per clip its file,
// duration, loop, hold, root speed (m/s at this character's scale) and provenance
// (studio-assets catalog id). Every clip is named by its state or vocabulary key.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { clipMetadata } from '../lib/animation-retarget.mjs';
import { extraClipNames, isExtraClipName, optionalCharacterStates, requiredCharacterStates } from '../lib/character-pack.mjs';
import { PACK_FAMILIES, PACK_RESAMPLE_TOLERANCE, packClips, packFamily, packIO } from '../lib/clip-pack.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const clipsDir = flag('clips'), outDir = flag('out');
if (!clipsDir || !outDir) {
  console.error('usage: pack-character.mjs --clips=<baked dir> --out=<dir> [--id=] [--model=] [--emotes=emote_a,emote_b] [--no-compress]');
  process.exit(1);
}
const compress = !args.includes('--no-compress');
const io = await packIO();
const present = (n) => existsSync(path.join(clipsDir, `${n}.glb`));
const states = [...requiredCharacterStates, ...optionalCharacterStates].filter(present);
for (const n of requiredCharacterStates) if (!states.includes(n)) throw new Error(`missing required state ${n}`);
const extras = extraClipNames.filter(present);
const emotes = flag('emotes')?.split(',').filter(Boolean) || [];
for (const n of emotes) {
  if (!isExtraClipName(n) || packFamily(n) !== 'emotes') throw new Error(`${n} is not an emote_ key`);
  if (!present(n)) throw new Error(`missing emote ${n}`);
}

const files = PACK_FAMILIES.map((family) => [`${family}.glb`, family === 'states' ? states : extras.filter((n) => packFamily(n) === family)])
  .concat(emotes.map((n) => [`emotes/${n}.glb`, [n]]))
  .filter(([, names]) => names.length);
mkdirSync(outDir, { recursive: true });
rmSync(path.join(outDir, 'emotes'), { recursive: true, force: true });
const manifest = {
  schema: 'coro-solto/character-clips@2', id: flag('id') || path.basename(path.resolve(outDir)), skeleton: 'meshy-28',
  model: flag('model') ? { file: path.basename(flag('model')), sha256: createHash('sha256').update(readFileSync(flag('model'))).digest('hex') } : null,
  compression: compress ? { resampleTolerance: PACK_RESAMPLE_TOLERANCE, rotations: 'int16 normalized', buffers: 'EXT_meshopt_compression, no filters' } : null,
  files: {}, clips: {},
};
for (const [file, names] of files) {
  const clips = [];
  for (const name of names) clips.push({ name, doc: await io.read(path.join(clipsDir, `${name}.glb`)) });
  const bytes = await io.writeBinary(await packClips(clips, { compress }));
  mkdirSync(path.dirname(path.join(outDir, file)), { recursive: true });
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
