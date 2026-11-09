#!/usr/bin/env node
// Run the whole Blender character rig pipeline for one character (docs/character-rig.md).
//
//   node tools/characters/rig-character.mjs --config=characters/<id>/rig.json --work=<dir>
//        [--source=<mint-final.glb>] [--from=clean|parts|joints|armature|weights|assemble|pose]
//        [--clips-from=<shared clips dir>] [--retarget=<client>/tools/retarget-glb.mjs]
//        [--blender=/Applications/Blender.app/Contents/MacOS/Blender]
//
// Steps: clean -> parts -> joints (+ review sheets) -> armature -> weights -> assemble
// (<work>/<id>.blender.glb) -> pose (retargets the shared clips onto the new rig with the
// client's tools/retarget-glb.mjs when --retarget and --clips-from are given, then
// <work>/pose-test.json). Every step is rerunnable; --from resumes after a manual edit
// (for example a joints.json override next to the config).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true]; }));
if (!args.config || !args.work) {
  console.error('usage: rig-character.mjs --config=<rig.json> --work=<dir> [--source=<glb>] [--from=<step>] [--clips-from=<dir>] [--retarget=<retarget-glb.mjs>] [--blender=<path>]');
  process.exit(1);
}
const config = path.resolve(args.config);
const work = path.resolve(args.work);
const id = JSON.parse(readFileSync(config, 'utf8')).id;
const blender = args.blender || process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
const steps = ['clean', 'parts', 'joints', 'armature', 'weights', 'assemble', 'pose'];
const from = steps.indexOf(args.from || 'clean');
if (from < 0) throw new Error(`unknown step ${args.from}`);
if (from === 0 && !args.source) throw new Error('--source is required when starting from clean');

const run = (cmd, cmdArgs, options = {}) => {
  console.log(`$ ${[cmd, ...cmdArgs].join(' ')}`);
  const result = spawnSync(cmd, cmdArgs, { stdio: 'inherit', ...options });
  if (result.status !== 0) throw new Error(`${path.basename(cmd)} failed (${result.status})`);
};
const blenderStep = (step, extra = []) => run(blender, ['-b', '--factory-startup', '--python', path.join(root, `tools/blender/character_rig/rig_${step}.py`), '--', '--config', config, '--work', work, ...extra]);
const model = path.join(work, `${id}.blender.glb`);

for (const step of steps.slice(from)) {
  if (step === 'clean') blenderStep('clean', ['--source', path.resolve(args.source)]);
  else if (step === 'parts') { blenderStep('parts'); run(process.execPath, [path.join(root, 'tools/characters/rig-review.mjs'), 'parts', work]); }
  else if (step === 'joints') { blenderStep('joints'); run(process.execPath, [path.join(root, 'tools/characters/rig-review.mjs'), 'joints', work]); }
  else if (step === 'armature' || step === 'weights') blenderStep(step);
  else if (step === 'assemble') run(process.execPath, [path.join(root, 'tools/characters/rig-assemble.mjs'), work, model]);
  else if (step === 'pose') {
    const clips = path.join(work, 'clips');
    if (args.retarget && args['clips-from']) {
      const retarget = path.resolve(args.retarget);
      run(process.execPath, [retarget, path.resolve(args['clips-from']), model, clips], { cwd: path.resolve(path.dirname(retarget), '..') });
    }
    const poseArgs = [path.join(root, 'tools/characters/rig-pose-test.mjs'), model, `--out=${path.join(work, 'pose-test.json')}`, `--label=${id}`];
    if (existsSync(path.join(clips, 'idle.glb'))) poseArgs.push(`--clips=${clips}`);
    run(process.execPath, poseArgs);
  }
}
