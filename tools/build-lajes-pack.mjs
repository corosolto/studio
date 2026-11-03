#!/usr/bin/env node
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLajesGauntlet } from './lib/lajes-gauntlet.mjs';
import { assertNotExecutableJavaScript, assertPackageRelativePath, hashFile, validateManifestStructure, validatePack } from './lib/pack.mjs';

const publicStudioRoot = fileURLToPath(new URL('../', import.meta.url));
const roles = ['geometry', 'textures', 'collision', 'navigation', 'spawns', 'regions', 'previews'];
const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;

function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function inventory(stagingRoot) {
  const files = [];
  async function visit(directory, prefix = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => compareText(left.name, right.name));
    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Staging symlinks are not allowed: ${relativePath}`);
      if (entry.isDirectory()) {
        await visit(absolute, relativePath);
      } else if (entry.isFile()) {
        assertPackageRelativePath(relativePath, 'Staging path');
        assertNotExecutableJavaScript(relativePath);
        if (relativePath === 'manifest.json') throw new Error('Staging must not contain a pre-existing manifest.json');
        files.push(relativePath);
      } else {
        throw new Error(`Staging entry is not a regular file: ${relativePath}`);
      }
    }
  }
  await visit(stagingRoot);
  return files.sort(compareText);
}

function lodProfile(relativePath) {
  const remainder = relativePath.slice('lods/'.length);
  const segments = remainder.split('/');
  const candidate = segments.length > 1 ? segments[0] : path.posix.basename(remainder, path.posix.extname(remainder));
  if (/(?:^|[-_.])low(?:$|[-_.])/i.test(candidate)) return 'low';
  const profile = candidate.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return profile || 'other';
}

function classify(files) {
  const manifest = {
    geometry: [],
    textures: [],
    lods: {},
    collision: [],
    navigation: [],
    spawns: [],
    regions: [],
    previews: [],
    evidence: [],
  };
  for (const file of files) {
    const role = roles.find(candidate => file.startsWith(`${candidate}/`));
    if (path.posix.basename(file).endsWith('-manifest.json')) manifest.evidence.push(file);
    else if (role) manifest[role].push(file);
    else if (file.startsWith('lods/') && path.posix.extname(file).toLowerCase() === '.glb') {
      const profile = lodProfile(file);
      (manifest.lods[profile] ||= []).push(file);
    } else manifest.evidence.push(file);
  }
  return manifest;
}

async function assertAbsent(outputRoot) {
  try {
    await lstat(outputRoot);
    throw new Error(`Output must be absent; refusing to overwrite: ${outputRoot}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function nearestExistingRealPath(directory) {
  let current = directory;
  while (true) {
    try { return await realpath(current); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      current = parent;
    }
  }
}

export async function buildLajesPack({ staging, output, revision, provenance }) {
  if (!staging || !output || !revision || !provenance?.length) {
    throw new Error('staging, output, revision and at least one provenance entry are required');
  }
  const stagingRoot = path.resolve(staging);
  const outputRoot = path.resolve(output);
  if (isInside(publicStudioRoot, stagingRoot)) throw new Error('Staging must be outside the public Studio worktree');
  if (isInside(publicStudioRoot, outputRoot)) throw new Error('Candidate output must be private and outside the public Studio worktree');
  if (isInside(stagingRoot, outputRoot) || isInside(outputRoot, stagingRoot)) {
    throw new Error('Staging and output directories must not contain one another');
  }
  const stagingInfo = await stat(stagingRoot);
  if (!stagingInfo.isDirectory()) throw new Error(`Staging is not a directory: ${stagingRoot}`);
  const [resolvedStagingRoot, resolvedPublicRoot] = await Promise.all([realpath(stagingRoot), realpath(publicStudioRoot)]);
  if (isInside(resolvedPublicRoot, resolvedStagingRoot)) throw new Error('Resolved staging must be outside the public Studio worktree');
  await assertAbsent(outputRoot);

  await validateLajesGauntlet({ reportPath: path.join(stagingRoot, 'scene-report.json'), stagingRoot });
  const files = await inventory(stagingRoot);
  if (!files.length) throw new Error('Staging contains no files');
  const declarations = classify(files);
  const fileEntries = [];
  for (const relativePath of files) {
    const absolute = path.join(stagingRoot, ...relativePath.split('/'));
    const info = await stat(absolute);
    fileEntries.push({ path: relativePath, sha256: await hashFile(absolute), bytes: info.size });
  }
  const manifest = {
    schemaVersion: 1,
    kind: 'map',
    id: 'lajes',
    version: '0.1.0',
    source: { revision, provenance },
    ...declarations,
    files: fileEntries,
  };
  validateManifestStructure(manifest);

  const parent = path.dirname(outputRoot);
  if (isInside(resolvedPublicRoot, await nearestExistingRealPath(parent))) throw new Error('Resolved candidate output ancestry must be outside the public Studio worktree');
  await mkdir(parent, { recursive: true });
  if (isInside(resolvedPublicRoot, await realpath(parent))) throw new Error('Resolved candidate output must be outside the public Studio worktree');
  const temporaryRoot = path.join(parent, `.${path.basename(outputRoot)}.tmp-${process.pid}-${Date.now()}`);
  let completed = false;
  try {
    await mkdir(temporaryRoot, { mode: 0o700 });
    for (const relativePath of files) {
      const destination = path.join(temporaryRoot, ...relativePath.split('/'));
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(path.join(stagingRoot, ...relativePath.split('/')), destination, constants.COPYFILE_EXCL);
    }
    const temporaryManifest = path.join(temporaryRoot, `.manifest.json.tmp-${process.pid}`);
    await writeFile(temporaryManifest, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    await rename(temporaryManifest, path.join(temporaryRoot, 'manifest.json'));
    await validatePack({ manifestPath: path.join(temporaryRoot, 'manifest.json'), packageRoot: temporaryRoot });
    await assertAbsent(outputRoot);
    await rename(temporaryRoot, outputRoot);
    completed = true;
  } finally {
    if (!completed) await rm(temporaryRoot, { recursive: true, force: true });
  }
  return { manifest, outputRoot };
}

function parseArguments(argv) {
  const options = { provenance: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const match = /^--(staging|output|revision|provenance)=(.*)$/.exec(argument);
    const key = match?.[1] || (argument.startsWith('--') ? argument.slice(2) : '');
    const value = match ? match[2] : argv[++index];
    if (!['staging', 'output', 'revision', 'provenance'].includes(key) || !value) {
      throw new Error('Usage: node tools/build-lajes-pack.mjs --staging <private-staging> --output <absent-private-output> --revision <source-revision> --provenance <statement> [--provenance <statement>]');
    }
    if (key === 'provenance') options.provenance.push(value);
    else options[key] = value;
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { manifest, outputRoot } = await buildLajesPack(parseArguments(process.argv.slice(2)));
  console.log(`PASS built private candidate ${manifest.kind}/${manifest.id}/${manifest.version}: ${manifest.files.length} files at ${outputRoot}`);
}
