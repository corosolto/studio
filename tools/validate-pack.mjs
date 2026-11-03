#!/usr/bin/env node
import Ajv from 'ajv/dist/2020.js';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

if (!process.argv[2]) throw new Error('Usage: node tools/validate-pack.mjs <manifest.json> [package-root]');
const manifestPath = path.resolve(process.argv[2]);
const packageRoot = path.resolve(process.argv[3] || path.dirname(manifestPath));
const [schema, manifest] = await Promise.all([
  readFile(new URL('../schemas/asset-pack.schema.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(manifestPath, 'utf8').then(JSON.parse),
]);
const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
if (!validate(manifest)) {
  for (const error of validate.errors) console.error(`${error.instancePath || '/'} ${error.message}`);
  process.exit(1);
}
for (const file of manifest.files) {
  const absolute = path.resolve(packageRoot, file.path);
  if (!absolute.startsWith(`${packageRoot}${path.sep}`)) throw new Error(`File escapes the package root: ${file.path}`);
  const bytes = await readFile(absolute);
  const info = await stat(absolute);
  if (info.size !== file.bytes) throw new Error(`Byte size mismatch: ${file.path}`);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== file.sha256) throw new Error(`SHA-256 mismatch: ${file.path}`);
}
console.log(`PASS ${manifest.kind}/${manifest.id}@${manifest.version}: schema, ${manifest.files.length} files and hashes are valid`);
