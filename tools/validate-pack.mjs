#!/usr/bin/env node
import path from 'node:path';
import { validatePack } from './lib/pack.mjs';

if (!process.argv[2]) throw new Error('Usage: node tools/validate-pack.mjs <manifest.json> [package-root]');
const manifestPath = path.resolve(process.argv[2]);
const packageRoot = path.resolve(process.argv[3] || path.dirname(manifestPath));
const { manifest, character } = await validatePack({ manifestPath, packageRoot });
const characterFacts = character
  ? `; meshy-28 skin, ${character.triangles}/${manifest.budgets.triangles} triangles, ${character.bytes}/${manifest.budgets.bytes} bytes, ${character.animations} state clips`
  : '';
console.log(`PASS ${manifest.kind}/${manifest.id}@${manifest.version}: schema, ${manifest.files.length} files and hashes are valid${characterFacts}`);
