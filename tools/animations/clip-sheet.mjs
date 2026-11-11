#!/usr/bin/env node
// Contact sheet of meshy-28 clips on one character (docs/animation-conversion.md).
//
//   node tools/animations/clip-sheet.mjs --model=<character.glb> --clips=<dir> --out=<sheet.png>
//        [--states=<a,b>] [--frames=6] [--view=front34|side] [--title=<text>] [--work=<dir>]
//        [--blender=<path>]
//
// One row per clip, --frames evenly spaced instants (first to last frame). Each instant is
// skinned on the CPU (tools/lib/character-rig.mjs) into a static GLB, rendered by Blender from
// one fixed camera over a 10 cm floor grid (tools/blender/render_clip_frames.py), and the tiles
// are assembled by tools/characters/rig-review.mjs sheet.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakePosedDocument, clipOverrides, clipSampler, loadRig, skinPositions } from '../lib/character-rig.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const model = flag('model'), clipsDir = flag('clips'), out = flag('out');
if (!model || !clipsDir || !out) {
  console.error('usage: clip-sheet.mjs --model=<character.glb> --clips=<dir> --out=<sheet.png> [--states=<a,b>] [--frames=6] [--view=front34|side] [--title=] [--work=<dir>] [--blender=]');
  process.exit(1);
}
const count = Math.max(2, Number(flag('frames') || 6));
const view = flag('view') || 'front34';
const blender = flag('blender') || process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
const work = flag('work') || mkdtempSync(path.join(tmpdir(), 'clip-sheet-'));
mkdirSync(work, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const states = flag('states')?.split(',').filter(Boolean)
  || readdirSync(clipsDir).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4)).sort();

const posed = [], labels = [];
let height = 0;
for (const state of states) {
  const sampler = clipSampler(await io.read(path.join(clipsDir, `${state}.glb`)));
  for (let k = 0; k < count; k += 1) {
    const t = +(sampler.duration * (k / (count - 1))).toFixed(4);
    const rig = loadRig(await io.read(model));
    if (!height) {
      let lo = Infinity, hi = -Infinity;
      for (const b of skinPositions(rig)) for (let v = 1; v < b.length; v += 3) { lo = Math.min(lo, b[v]); hi = Math.max(hi, b[v]); }
      height = hi - lo;
    }
    const file = path.join(work, `${state}@${String(k).padStart(2, '0')}.glb`);
    await io.write(file, bakePosedDocument(rig, skinPositions(rig, clipOverrides(rig, sampler, t))));
    posed.push(file);
    labels.push(`${state} ${t}s`);
  }
}
const renders = path.join(work, `renders-${view}`);
execFileSync(blender, ['-b', '--factory-startup', '--python', fileURLToPath(new URL('../blender/render_clip_frames.py', import.meta.url)), '--', renders, String(height), view, ...posed], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });
const tiles = posed.map((file, i) => `${labels[i]}=${path.join(renders, `${path.basename(file, '.glb')}.png`)}`);
const title = flag('title') || `${path.basename(model, '.glb')} — ${path.basename(path.resolve(clipsDir))} (${view}, 10 cm floor grid, red line = origin x)`;
execFileSync(process.execPath, [fileURLToPath(new URL('../characters/rig-review.mjs', import.meta.url)), 'sheet', out, String(count), title, ...tiles], { stdio: 'inherit' });
