/* Meshy preview tasks contain geometry without final textures. The permanent
   contract is preview → refine with PBR and 2K textures before downloading.
   Mutant: --mutante=sem-refine disables PBR and must fail. */
import { readFileSync } from 'node:fs';

const file = new URL('../gen-asset.mjs', import.meta.url);
let src = readFileSync(file, 'utf8');
const mutant = process.argv.includes('--mutante=sem-refine');
if (mutant) {
  const broken = src.replace('enable_pbr: true', 'enable_pbr: false');
  if (broken === src) throw new Error('Mutant did not apply: enable_pbr: true is missing');
  src = broken;
}

const checks = [
  ['AG1', 'Meshy creates a refine task from the preview',
    /mode:\s*['"]refine['"]/.test(src) && /preview_task_id:\s*previewTaskId/.test(src)],
  ['AG2', 'Refine generates PBR maps', /enable_pbr:\s*true/.test(src)],
  ['AG3', 'Refine uses a 2K texture for map props',
    /texture_resolution:\s*['"]2k['"]/.test(src)],
  ['AG4', 'Final download follows the refine task poll',
    /refineTaskId[\s\S]{0,1200}pollUntil\(refineTaskId\)[\s\S]{0,1600}download\(result\.url/.test(src)],
];

let failures = 0;
for (const [id, description, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${description}`);
  if (!ok) failures++;
}
if (failures) {
  console.error(`Asset-generation PBR contract failed: ${failures}/${checks.length}`);
  process.exitCode = 1;
} else if (mutant) {
  console.error('PBR mutant survived');
  process.exitCode = 1;
} else console.log('Asset-generation PBR contract passed');
