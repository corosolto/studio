#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const validator = path.join(root, 'tools/validate-pack.mjs');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-pack-'));
try {
  const bytes = Buffer.from('studio-smoke');
  fs.writeFileSync(path.join(directory, 'asset.bin'), bytes);
  const manifest = {
    schemaVersion: 1,
    kind: 'map',
    id: 'lajes',
    version: '0.1.0',
    source: { revision: 'abcdef1234567', provenance: ['CI smoke fixture'] },
    files: [{ path: 'asset.bin', sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }],
  };
  const manifestPath = path.join(directory, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  execFileSync(process.execPath, [validator, manifestPath], { stdio: 'inherit' });
  manifest.files[0].sha256 = '0'.repeat(64);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  let rejected = false;
  try { execFileSync(process.execPath, [validator, manifestPath], { stdio: 'pipe' }); } catch { rejected = true; }
  if (!rejected) throw new Error('Hash mutant was not rejected');
  console.log('PASS Hash mutant rejected');
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
