#!/usr/bin/env node
import path from 'node:path';
import { validatePack } from './lib/pack.mjs';

if (!process.argv[2]) throw new Error('Usage: node tools/validate-pack.mjs <manifest.json> [package-root]');
const manifestPath = path.resolve(process.argv[2]);
const packageRoot = path.resolve(process.argv[3] || path.dirname(manifestPath));
const { manifest } = await validatePack({ manifestPath, packageRoot });
console.log(`PASS ${manifest.kind}/${manifest.id}@${manifest.version}: schema, ${manifest.files.length} files and hashes are valid`);
