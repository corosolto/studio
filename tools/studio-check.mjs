#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const requiredDirectories = ['art-bible', 'references', 'decisions', 'maps', 'characters', 'viewmodels', 'schemas', 'tools', 'studies', 'releases'];
for (const directory of requiredDirectories) {
  if (!statSync(path.join(root, directory), { throwIfNoEntry: false })?.isDirectory()) throw new Error(`Required directory is missing: ${directory}`);
}
const requiredFiles = [
  'tools/blender/viewmodels/build_ak_hires_pilot.py',
  'tools/blender/viewmodels/build_pistol_hires_pilot.py',
  'tools/build-lajes-pack.mjs',
  'tools/validate-lajes-gauntlet.mjs',
  'tools/lib/pack.mjs',
  'tools/lib/lajes-gauntlet.mjs',
  'tools/lib/lajes-spatial.mjs',
  'tools/lib/glb-inspect.mjs',
  'tools/lib/character-pack.mjs',
  'tools/lib/character-concept-prompt.mjs',
  'tools/checks/character-pack-check.mjs',
  'tools/checks/character-concept-prompt-check.mjs',
  'tools/lib/character-rig.mjs',
  'tools/checks/character-rig-check.mjs',
  'tools/checks/character-grip-public-check.mjs',
  'docs/character-rig.md',
  'maps/lajes/gauntlet/fixtures/scene-report.valid.json',
];
for (const file of requiredFiles) {
  if (!statSync(path.join(root, file), { throwIfNoEntry: false })?.isFile()) throw new Error(`Required Studio contract file is missing: ${file}`);
}
for (const file of ['package.json', 'mint-assets.json', 'schemas/asset-pack.schema.json', 'maps/lajes/gauntlet/fixtures/scene-report.valid.json']) {
  JSON.parse(readFileSync(path.join(root, file), 'utf8'));
}
const walk = (directory, ignored = new Set()) => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  if (ignored.has(entry.name)) return [];
  const absolute = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(absolute, ignored) : [absolute];
});
const privateExtensions = new Set(['.blend', '.blend1', '.glb', '.fbx', '.mdl', '.unitypackage']);
const publicFiles = walk(root, new Set(['.git', 'node_modules', 'public']));
const forbidden = publicFiles.filter(file => privateExtensions.has(path.extname(file)));
if (forbidden.length) throw new Error(`Private source assets detected in the public studio:\n${forbidden.join('\n')}`);
const scripts = walk(path.join(root, 'tools')).filter(file => file.endsWith('.mjs'));
for (const script of scripts) execFileSync(process.execPath, ['--check', script], { stdio: 'pipe' });
console.log(`PASS Studio structure, JSON, public asset boundary and ${scripts.length} Node tool syntax checks`);
// Contract checks that use synthetic fixtures only; they never call paid generation APIs.
for (const check of ['tools/checks/character-pack-check.mjs', 'tools/checks/character-concept-prompt-check.mjs', 'tools/checks/character-rig-check.mjs', 'tools/checks/character-grip-public-check.mjs']) {
  execFileSync(process.execPath, [path.join(root, check)], { stdio: 'inherit' });
}
