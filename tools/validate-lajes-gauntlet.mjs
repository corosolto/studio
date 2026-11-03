#!/usr/bin/env node
import path from 'node:path';
import { validateLajesGauntlet } from './lib/lajes-gauntlet.mjs';

const usage = 'Usage: node tools/validate-lajes-gauntlet.mjs <scene-report.json> [staging-root] [--evidence-root <accepted-evidence-directory>]';
const positional = [];
let evidenceRoot;
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument === '--evidence-root') {
    evidenceRoot = process.argv[++index];
    if (!evidenceRoot) throw new Error(usage);
  } else if (argument.startsWith('--evidence-root=')) {
    evidenceRoot = argument.slice('--evidence-root='.length);
    if (!evidenceRoot) throw new Error(usage);
  } else if (argument.startsWith('--')) throw new Error(usage);
  else positional.push(argument);
}
if (positional.length < 1 || positional.length > 2) throw new Error(usage);
const reportPath = path.resolve(positional[0]);
const stagingRoot = path.resolve(positional[1] || path.dirname(reportPath));
const { spatial, lods } = await validateLajesGauntlet({ reportPath, stagingRoot, evidenceRoot });
console.log(`PASS Lajes gauntlet: metric scale, fixed cameras, routes, dimensions, corner and rooftop evidence are valid${evidenceRoot ? ` using accepted evidence ${path.resolve(evidenceRoot)}` : ' using private staging previews'}`);
console.log(`PASS Static clearance: ${spatial.collisionBoxes} collision AABBs, ${spatial.navigationEdges} navigation edges and ${spatial.spawns} spawns`);
console.log(`PASS GLB inspection: medium ${lods.medium.primitives} primitives/${lods.medium.triangles} triangles; low ${lods.low.primitives} primitives/${lods.low.triangles} triangles`);
console.log('NOTE Blender/static checks are not runtime or free-roam certification; floor support and full corridor-width clearance remain unverified');
