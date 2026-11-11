#!/usr/bin/env node
// Run the whole Blender character rig pipeline for one character (docs/character-rig.md).
//
//   node tools/characters/rig-character.mjs --config=characters/<id>/rig.json --work=<dir>
//        [--source=<mint-final.glb>] [--from=<step>] [--to=<step>]
//        --clips-from=<shared clips dir> --retarget=<client>/tools/retarget-glb.mjs | --no-clips
//        [--blender=/Applications/Blender.app/Contents/MacOS/Blender] [--skip-review]
//
// Steps: clean -> parts -> joints (+ review sheets; joints.json validated) -> armature ->
// weights -> assemble (<work>/<id>.blender.glb) -> pose: the shared clips are retargeted onto
// the new rig with the client's tools/retarget-glb.mjs and the pose test runs --strict, so a
// threshold failure fails the run. --no-clips limits the pose test to the synthetic poses.
//
// Freshness: before a step runs, its outputs and every later step's outputs are deleted;
// after it runs, each output must exist and be newer than the step's start, whatever the
// step's exit code says. <work>/run-manifest.json records, per step, the SHA-256 of its
// inputs (source, config, joints override) and outputs. --from resumes only when every
// skipped step's outputs still hash to what the manifest recorded and its inputs are
// unchanged, so a step can never run on top of stale or hand-edited upstream files.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateJoints } from '../lib/character-rig.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true]; }));
if (!args.config || !args.work) {
  console.error('usage: rig-character.mjs --config=<rig.json> --work=<dir> [--source=<glb>] [--from=<step>] [--to=<step>] (--clips-from=<dir> --retarget=<retarget-glb.mjs> | --no-clips) [--blender=<path>] [--skip-review]');
  process.exit(1);
}
const config = path.resolve(args.config);
const work = path.resolve(args.work);
mkdirSync(work, { recursive: true });
const cfg = JSON.parse(readFileSync(config, 'utf8'));
const id = cfg.id;
const override = path.resolve(path.dirname(config), cfg.jointsOverride || 'joints.json');
const blender = args.blender || process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
const model = path.join(work, `${id}.blender.glb`);
const steps = ['clean', 'parts', 'joints', 'armature', 'weights', 'assemble', 'pose'];
const from = steps.indexOf(args.from || 'clean');
const to = steps.indexOf(args.to || 'pose');
if (from < 0 || to < 0 || to < from) throw new Error(`bad --from/--to: ${args.from} .. ${args.to}`);
if (from === 0 && !args.source) throw new Error('--source is required when starting from clean');
if (to === steps.length - 1 && !args['no-clips'] && !(args.retarget && args['clips-from'])) throw new Error('pass --clips-from and --retarget together (or --no-clips for synthetic poses only)');

/* Files each step writes (relative to the work dir) and the inputs outside the work dir it reads.
   Orthographic renders come with a <png>.view.json sidecar (rig-review.mjs reads both); the
   review sheets are outputs unless --skip-review, but are deleted before their step either way. */
const renders = (prefix, views) => views.flatMap((view) => [`${prefix}-${view}.png`, `${prefix}-${view}.png.view.json`]);
const REVIEWS = { parts: 'parts-review.png', joints: 'joints-review.png' };
const OUTPUTS = {
  clean: ['clean.blend', 'clean.json', ...renders('clean', ['front', 'back', 'side'])],
  parts: ['parts.blend', 'parts.json', 'parts-legend.json', ...renders('parts', ['front', 'back', 'side']), ...(args['skip-review'] ? [] : [REVIEWS.parts])],
  joints: ['joints.json', 'joints-estimate.json', ...renders('joints', ['front', 'side']), ...(args['skip-review'] ? [] : [REVIEWS.joints])],
  armature: ['armature.blend'],
  weights: ['weights.blend', 'weights.json', 'blender-rig.glb'],
  assemble: [path.basename(model)],
  pose: ['pose-test.json'],
};
const DIRS = { pose: ['clips'] };
const inputsOf = (step) => {
  const files = { config };
  if (step === 'clean') files.source = path.resolve(args.source ?? '');
  if (step === 'joints' && existsSync(override)) files.override = override;
  return files;
};
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const manifestPath = path.join(work, 'run-manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { steps: {} };

// Resume guard: every skipped step must be intact and its inputs unchanged.
for (const step of steps.slice(0, from)) {
  const record = manifest.steps[step];
  if (!record) throw new Error(`cannot resume at ${steps[from]}: ${step} has no record in ${manifestPath}; run --from=${step}`);
  for (const [name, digest] of Object.entries(record.outputs)) {
    const file = path.join(work, name);
    if (!existsSync(file) || sha(file) !== digest) throw new Error(`cannot resume at ${steps[from]}: ${name} changed or vanished since ${step} ran; run --from=${step}`);
  }
  for (const [role, file] of Object.entries(inputsOf(step))) {
    // A --source given on resume must be the one clean ran on; without --source it is not checked.
    if (role === 'source' && !args.source) continue;
    const digest = existsSync(file) ? sha(file) : null;
    if (record.inputs[role]?.sha256 !== digest) throw new Error(`cannot resume at ${steps[from]}: ${role} ${file} changed since ${step} ran; run --from=${step}`);
  }
  if (step === 'joints' && !existsSync(override) && record.inputs.override) throw new Error(`cannot resume at ${steps[from]}: the joints override was removed since joints ran; run --from=joints`);
}

// Invalidate this run's steps and everything downstream before anything runs.
for (const step of steps.slice(from)) {
  for (const name of [...OUTPUTS[step], ...(REVIEWS[step] ? [REVIEWS[step]] : [])]) rmSync(path.join(work, name), { force: true });
  for (const name of DIRS[step] || []) rmSync(path.join(work, name), { recursive: true, force: true });
  delete manifest.steps[step];
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const run = (cmd, cmdArgs) => {
  console.log(`$ ${[cmd, ...cmdArgs].join(' ')}`);
  const result = spawnSync(cmd, cmdArgs, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${path.basename(cmd)} ${path.basename(cmdArgs.find((a) => /\.(py|mjs)$/.test(a)) || '')} failed (exit ${result.status ?? result.signal})`);
};
const blenderStep = (step, extra = []) => run(blender, ['-b', '--factory-startup', '--python', path.join(root, `tools/blender/character_rig/rig_${step}.py`), '--', '--config', config, '--work', work, ...extra]);
const review = (kind) => { if (!args['skip-review']) run(process.execPath, [path.join(root, 'tools/characters/rig-review.mjs'), kind, work]); };

for (const step of steps.slice(from, to + 1)) {
  const started = Date.now();
  const inputs = Object.fromEntries(Object.entries(inputsOf(step)).map(([role, file]) => [role, { path: file, sha256: sha(file) }]));
  if (step === 'clean') blenderStep('clean', ['--source', path.resolve(args.source)]);
  else if (step === 'parts') { blenderStep('parts'); review('parts'); }
  else if (step === 'joints') {
    blenderStep('joints');
    if (existsSync(path.join(work, 'joints.json'))) {
      const errors = validateJoints(JSON.parse(readFileSync(path.join(work, 'joints.json'), 'utf8')));
      if (errors.length) throw new Error(`joints.json is invalid:\n${errors.join('\n')}`);
    }
    review('joints');
  } else if (step === 'armature' || step === 'weights') blenderStep(step);
  else if (step === 'assemble') run(process.execPath, [path.join(root, 'tools/characters/rig-assemble.mjs'), work, model]);
  else if (step === 'pose') {
    const clips = path.join(work, 'clips');
    const poseArgs = [path.join(root, 'tools/characters/rig-pose-test.mjs'), model, `--out=${path.join(work, 'pose-test.json')}`, `--label=${id}`, '--strict'];
    if (!args['no-clips']) {
      run(process.execPath, [path.resolve(args.retarget), path.resolve(args['clips-from']), model, clips]);
      if (!existsSync(path.join(clips, 'idle.glb'))) throw new Error(`retarget wrote no clips to ${clips}`);
      poseArgs.push(`--clips=${clips}`);
    }
    run(process.execPath, poseArgs);
  }
  const outputs = {};
  for (const name of OUTPUTS[step]) {
    const file = path.join(work, name);
    if (!existsSync(file)) throw new Error(`${step} did not write ${name} (exit code was 0); not continuing on missing or stale files`);
    if (statSync(file).mtimeMs < started - 1000) throw new Error(`${step} left ${name} older than the step; not continuing on stale files`);
    outputs[name] = sha(file);
  }
  manifest.steps[step] = { finishedAt: new Date().toISOString(), inputs, outputs };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
