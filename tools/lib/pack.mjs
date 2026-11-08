import Ajv from 'ajv/dist/2020.js';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { characterRoleEntries, validateCharacterPack } from './character-pack.mjs';

const schema = JSON.parse(await readFile(new URL('../../schemas/asset-pack.schema.json', import.meta.url), 'utf8'));
const validateSchema = new Ajv({ allErrors: true, strict: true }).compile(schema);
const executableJavaScriptExtensions = new Set(['.js', '.cjs', '.mjs', '.jsx', '.ts', '.cts', '.mts']);
const executableMagic = ['4d5a', '7f454c46', '0061736d', 'feedface', 'feedfacf', 'cefaedfe', 'cffaedfe', 'cafebabe', 'cafebabf', 'bebafeca', 'bfbafeca'];

export function assertPackageRelativePath(value, label = 'Path') {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a non-empty string`);
  if (value.includes('\0') || value.includes('\\')) throw new Error(`${label} contains an unsafe character: ${value}`);
  if (value.startsWith('/') || value.endsWith('/') || /^[a-zA-Z]:/.test(value)) {
    throw new Error(`${label} must be package-relative: ${value}`);
  }
  const segments = value.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error(`${label} contains an unsafe segment: ${value}`);
  }
  if (path.posix.normalize(value) !== value) throw new Error(`${label} is not canonical: ${value}`);
  return value;
}

export function assertNotExecutableJavaScript(value) {
  if (executableJavaScriptExtensions.has(path.posix.extname(value).toLowerCase())) {
    throw new Error(`Executable JavaScript is forbidden in packs: ${value}`);
  }
}

export function mapRoleEntries(manifest) {
  if (manifest.kind !== 'map') return [];
  const entries = [];
  for (const role of ['geometry', 'textures', 'collision', 'navigation', 'spawns', 'regions', 'previews', 'evidence']) {
    for (const file of manifest[role] || []) entries.push({ role, path: file });
  }
  for (const [profile, files] of Object.entries(manifest.lods || {})) {
    for (const file of files) {
      if (path.posix.extname(file).toLowerCase() !== '.glb') throw new Error(`LOD ${profile} must reference a GLB: ${file}`);
      entries.push({ role: `lods.${profile}`, path: file });
    }
  }
  return entries;
}

export function validateManifestStructure(manifest) {
  if (!validateSchema(manifest)) {
    const details = validateSchema.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('\n');
    throw new Error(`Manifest schema validation failed:\n${details}`);
  }

  const fileIndexes = new Map();
  for (const [index, file] of manifest.files.entries()) {
    assertPackageRelativePath(file.path, `files[${index}].path`);
    assertNotExecutableJavaScript(file.path);
    if (fileIndexes.has(file.path)) throw new Error(`Duplicate file entry: ${file.path}`);
    fileIndexes.set(file.path, index);
  }

  const roleOwners = new Map();
  for (const entry of [...mapRoleEntries(manifest), ...characterRoleEntries(manifest)]) {
    assertPackageRelativePath(entry.path, `${entry.role} path`);
    assertNotExecutableJavaScript(entry.path);
    if (roleOwners.has(entry.path)) {
      throw new Error(`Duplicate declared path: ${entry.path} (${roleOwners.get(entry.path)} and ${entry.role})`);
    }
    if (!fileIndexes.has(entry.path)) throw new Error(`Declared path is missing from files: ${entry.path}`);
    roleOwners.set(entry.path, entry.role);
  }

  if (manifest.kind === 'map' || manifest.kind === 'character') {
    for (const file of manifest.files) {
      if (!roleOwners.has(file.path)) throw new Error(`Pack file has no ${manifest.kind} role declaration: ${file.path}`);
    }
  }
  if (manifest.kind === 'map' && !manifest.lods.low?.length) throw new Error('Map pack is missing its low LOD profile');
  return manifest;
}

export async function resolvePackageFile(packageRoot, relativePath) {
  assertPackageRelativePath(relativePath);
  const root = await realpath(path.resolve(packageRoot));
  const candidate = path.resolve(root, relativePath);
  const relative = path.relative(root, candidate);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error(`File escapes the package root: ${relativePath}`);
  }
  const absolute = await realpath(candidate);
  const realRelative = path.relative(root, absolute);
  if (!realRelative || realRelative.startsWith(`..${path.sep}`) || realRelative === '..' || path.isAbsolute(realRelative)) {
    throw new Error(`File resolves outside the package root: ${relativePath}`);
  }
  const info = await stat(absolute);
  if (!info.isFile()) throw new Error(`Declared path is not a regular file: ${relativePath}`);
  return { absolute, info };
}

export async function hashFile(absolute) {
  const hash = createHash('sha256');
  const input = createReadStream(absolute);
  input.on('data', chunk => hash.update(chunk));
  await new Promise((resolve, reject) => {
    input.on('end', resolve);
    input.on('error', reject);
  });
  return hash.digest('hex');
}

async function assertNoExecutableMagic(relativePath, absolute) {
  const handle = await open(absolute, 'r');
  try {
    const prefix = Buffer.alloc(4);
    const { bytesRead } = await handle.read(prefix, 0, prefix.length, 0);
    if (bytesRead >= 2 && prefix[0] === 0x23 && prefix[1] === 0x21) {
      throw new Error(`Executable script shebang is forbidden in packs: ${relativePath}`);
    }
    const hexadecimal = prefix.subarray(0, bytesRead).toString('hex');
    if (executableMagic.some(magic => hexadecimal.startsWith(magic))) {
      throw new Error(`Executable payload is forbidden in packs: ${relativePath}`);
    }
  } finally {
    await handle.close();
  }
}

export async function validatePack({ manifestPath, packageRoot = path.dirname(manifestPath) }) {
  const resolvedManifestPath = path.resolve(manifestPath);
  const resolvedPackageRoot = path.resolve(packageRoot);
  const manifest = JSON.parse(await readFile(resolvedManifestPath, 'utf8'));
  validateManifestStructure(manifest);

  const absolutes = new Map();
  for (const file of manifest.files) {
    const { absolute, info } = await resolvePackageFile(resolvedPackageRoot, file.path);
    await assertNoExecutableMagic(file.path, absolute);
    if (info.size !== file.bytes) throw new Error(`Byte size mismatch: ${file.path}`);
    const sha256 = await hashFile(absolute);
    if (sha256 !== file.sha256) throw new Error(`SHA-256 mismatch: ${file.path}`);
    absolutes.set(file.path, absolute);
  }
  const character = manifest.kind === 'character' ? await validateCharacterPack(manifest, absolutes) : undefined;
  return { manifest, manifestPath: resolvedManifestPath, packageRoot: resolvedPackageRoot, character };
}
