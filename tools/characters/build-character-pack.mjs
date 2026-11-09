#!/usr/bin/env node
// Builds one character pack (kind: "character") from the standard pipeline outputs.
// Deterministic promotion step: same inputs always produce the same pack bytes, so a
// rebuilt version is byte-identical and an already-published version can never change.
//
// Inputs (all produced by earlier pipeline stages, see docs/character-pipeline.md):
//   --id            character id (must equal the converter manifest id)
//   --version       pack semver, e.g. 0.2.0
//   --model         rigged meshy-28 GLB from the Blender rig pipeline (<id>.blender.glb)
//   --pose-test     pose-test.json from the same rig run (the rig gate; must have 0 failures)
//   --clips         baked clip dir in character-clips@2 layout (states/loco/combat/ceremony.glb
//                   + emotes/<key>.glb + manifest.json, from the animation converter)
//   --qa            clip QA report for those packs (tools/animations/clip-qa.mjs); non-rig
//                   failures refuse the build unless explicitly allowlisted
//   --assets        studio-assets character dir (reads PROVENANCE.md ## Rights)
//   --revision      studio-assets commit the PROVENANCE.md was read at (recorded in the manifest)
//   --preview       preview image file (png/jpg/jpeg/webp); repeat for more portraits
//   --out           pack root; the pack lands in <out>/character/<id>/<version>/
//   --allow-qa      explicit allowance "<clip|*>:<substring>" for a non-rig QA failure; repeatable
//   --rights-reference  citation line for a public-domain character; repeatable, >= 1 required
//   --omit-extra    "<extra key>[:<reason>]": drop that optional extra clip from the pack (its
//                   family GLB is rewritten without it), skip its QA results and record the
//                   omission with its reason and QA failures in the manifest provenance;
//                   repeatable; states can never be omitted
//
// The pack is validated with the shared contract validator (tools/lib/pack.mjs) after it
// is written; a pack that does not validate is not built. No file here is ever committed
// to this repository: model, clips, previews and manifests carry private character bytes.
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { Logger, NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clipFamily, isExtraClipName, optionalCharacterStates, requiredCharacterStates } from '../lib/character-pack.mjs';
import { validatePack } from '../lib/pack.mjs';

export const CONVERTER_SCHEMA = 'coro-solto/character-clips@2';
const RIGHTS_STATUSES = ['original', 'public-domain', 'political-satire'];
const PREVIEW_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const FAMILIES = ['loco', 'combat', 'ceremony'];
const TRIANGLE_BUDGET_STEP = 500;
const TRIANGLE_CAP = 15000;
const BYTES_BUDGET = 8388608; // declared byte budget (schema cap is 16 MiB; stay stricter)
const STATE_NAMES = [...requiredCharacterStates, ...optionalCharacterStates];

export class BuildCharacterPackError extends Error {
  constructor(code, message) {
    super(`[${code}] ${message}`);
    this.code = code;
  }
}

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

function requiredFile(file, code, what) {
  const info = statSync(file, { throwIfNoEntry: false });
  if (!info?.isFile()) throw new BuildCharacterPackError(code, `missing ${what}: ${file}`);
  return file;
}

function readJson(file, code, what) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new BuildCharacterPackError(code, `${what} is not valid JSON (${file}): ${error.message}`);
  }
  return parsed;
}

function hasPreviewSignature(bytes, extension) {
  if (extension === '.png') return bytes.length > 8 && bytes[0] === 0x89 && bytes.subarray(1, 4).toString('ascii') === 'PNG';
  if (extension === '.jpg' || extension === '.jpeg') return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.length > 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
}

// Verifies the rig pose gate: the shipped model must be a rig whose own pose test passed.
function readPoseGate(poseTestPath, id) {
  const pose = readJson(requiredFile(poseTestPath, 'pose_test_missing', 'pose test report'), 'pose_test_invalid', 'pose test report');
  const failures = pose.failures ?? [];
  if (!Array.isArray(failures)) throw new BuildCharacterPackError('pose_test_invalid', 'pose test failures is not an array');
  if (failures.length) {
    throw new BuildCharacterPackError('pose_gate_failed', `${id}: rig pose gate failed with ${failures.length} failures (${poseTestPath}); re-rig the character before packing`);
  }
  if (!Number.isFinite(pose.triangles) || pose.triangles <= 0) {
    throw new BuildCharacterPackError('pose_test_invalid', `${id}: pose test has no triangle count`);
  }
  return pose;
}

// Clip QA gate: failures tagged `[rig: ...]` point at rig weights (repair work tracked by
// the rig stage, not the pack); every other failure must be covered by the allowlist.
// Omitted extras leave the pack, so their results no longer gate it.
function checkClipQa(qaPath, allow, omissions, id) {
  const qa = readJson(requiredFile(qaPath, 'qa_report_missing', 'clip QA report'), 'qa_report_invalid', 'clip QA report');
  const results = qa.results;
  if (!Array.isArray(results)) throw new BuildCharacterPackError('qa_report_invalid', 'clip QA report has no results array');
  const disallowed = [];
  for (const result of results) {
    if (omissions.has(result.name)) continue;
    for (const failure of result.failures ?? []) {
      if (String(failure).includes('[rig:')) continue;
      const covered = allow.some(({ clip, needle }) => (clip === '*' || clip === result.name) && String(failure).includes(needle));
      if (!covered) disallowed.push(`${result.name}: ${failure}`);
    }
  }
  if (disallowed.length) {
    throw new BuildCharacterPackError('qa_failure_not_allowed', `${id}: clip QA has ${disallowed.length} non-rig failure(s) not on the allowlist:\n  ${disallowed.join('\n  ')}\nfix the conversion or pass --allow-qa=<clip|*>:<substring> for a reviewed exception`);
  }
  return results;
}

// Omitted extras are an owner decision (for example a clip whose QA fails on this
// character): the runtime falls back when an optional extra is missing, but the states are
// its floor, so only contract extras can be omitted.
function planOmissions(omitExtra, id) {
  const omissions = new Map();
  for (const { name, reason } of omitExtra) {
    if (STATE_NAMES.includes(name)) {
      throw new BuildCharacterPackError('omit_extra_state', `${id}: ${name} is a state; only optional extra clips can be omitted`);
    }
    if (!isExtraClipName(name)) throw new BuildCharacterPackError('omit_extra_invalid', `${id}: --omit-extra ${JSON.stringify(name)} is not a contract extra name`);
    if (omissions.has(name)) throw new BuildCharacterPackError('omit_extra_invalid', `${id}: --omit-extra ${name} given twice`);
    omissions.set(name, reason?.trim() ?? '');
  }
  return omissions;
}

// The recorded reason of each omission: the explicit reason plus every QA failure of that
// clip, so the manifest carries the measured numbers that justified dropping it.
function omissionRecords(omissions, results, id) {
  return [...omissions].sort(([a], [b]) => a.localeCompare(b)).map(([name, reason]) => {
    const failures = results.filter((result) => result.name === name).flatMap((result) => result.failures ?? []).map(String);
    const why = [reason, failures.length ? `clip QA: ${failures.join('; ')}` : ''].filter(Boolean).join('; ');
    if (!why) {
      throw new BuildCharacterPackError('omit_reason_missing', `${id}: omitted extra ${name} has no QA failure to cite; pass --omit-extra=${name}:<reason>`);
    }
    return { name, reason: why };
  });
}

// Rewrites a converter family pack without the omitted clips. The document keeps whatever
// encoding it was read with (the converter's EXT_meshopt_compression included), only the
// dropped clips' channels, samplers and now-unused accessors leave; skeleton nodes stay.
async function dropClips(source, names, id) {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const document = (await io.read(source)).setLogger(new Logger(Logger.Verbosity.WARN));
  for (const name of names) {
    const animation = document.getRoot().listAnimations().find((candidate) => candidate.getName() === name);
    if (!animation) throw new BuildCharacterPackError('omit_extra_absent', `${id}: omitted extra ${name} is not in ${source}`);
    for (const channel of animation.listChannels()) channel.dispose();
    for (const sampler of animation.listSamplers()) sampler.dispose();
    animation.dispose();
  }
  await document.transform(prune({ propertyTypes: [PropertyType.ACCESSOR], keepLeaves: true }));
  return Buffer.from(await io.writeBinary(document));
}

// Rights come verbatim from the studio-assets PROVENANCE.md ## Rights section.
function parseRights(assetsDir, references, id) {
  const provenance = requiredFile(path.join(assetsDir, 'PROVENANCE.md'), 'provenance_missing', 'PROVENANCE.md');
  const markdown = readFileSync(provenance, 'utf8');
  const section = markdown.split(/^## Rights$/m)[1]?.split(/^## /m)[0] ?? '';
  const status = /\*\*([\w-]+)\*\*/.exec(section)?.[1];
  const basis = /^- Basis: (.+)$/m.exec(section)?.[1]?.trim();
  if (!RIGHTS_STATUSES.includes(status ?? '')) {
    throw new BuildCharacterPackError('rights_status_invalid', `${id}: rights status ${JSON.stringify(status)} is not one of ${RIGHTS_STATUSES.join(', ')} in ${provenance}`);
  }
  if (!basis) throw new BuildCharacterPackError('rights_basis_missing', `${id}: no "- Basis:" line in ## Rights of ${provenance}`);
  const rights = { status, basis };
  if (status === 'public-domain') {
    if (!references.length) {
      throw new BuildCharacterPackError('rights_references_missing', `${id}: public-domain requires at least one --rights-reference citation`);
    }
    rights.references = [...references];
  }
  return rights;
}

// Layout of the converter output (character-clips@2): states share states.glb, extras share
// one family pack per non-emote family, emotes keep one file each. The builder reproduces
// that layout inside the pack and derives every family from the contract's own clipFamily,
// so the manifest can never disagree with the validator mirror. Omitted extras are left out
// of the manifest; a family pack that loses clips is listed in droppedByFamily for rewriting.
function planClips(clipsDir, id, omissions) {
  const converter = readJson(requiredFile(path.join(clipsDir, 'manifest.json'), 'converter_manifest_missing', 'converter manifest'), 'converter_manifest_invalid', 'converter manifest');
  if (converter.schema !== CONVERTER_SCHEMA) {
    throw new BuildCharacterPackError('converter_schema', `${id}: converter manifest schema is ${JSON.stringify(converter.schema)}, expected ${CONVERTER_SCHEMA}`);
  }
  if (converter.id !== undefined && converter.id !== id) {
    throw new BuildCharacterPackError('converter_id_mismatch', `${id}: converter manifest id is ${converter.id}`);
  }
  if (!converter.model || typeof converter.model.sha256 !== 'string') {
    throw new BuildCharacterPackError('converter_manifest_invalid', `${id}: converter manifest has no model.sha256`);
  }
  const clips = converter.clips;
  if (!clips || typeof clips !== 'object' || Array.isArray(clips)) {
    throw new BuildCharacterPackError('converter_manifest_invalid', `${id}: converter manifest has no clips object`);
  }
  const animations = {};
  const stateFiles = new Set();
  for (const state of STATE_NAMES) {
    const clip = clips[state];
    if (!clip) {
      if (requiredCharacterStates.includes(state)) throw new BuildCharacterPackError('state_missing', `${id}: state ${state} missing from the converter clips`);
      continue;
    }
    if (clip.file !== 'states.glb') {
      throw new BuildCharacterPackError('state_layout_unsupported', `${id}: state ${state} lives in ${clip.file}; this builder consumes the shared states.glb layout`);
    }
    stateFiles.add(clip.file);
    animations[state] = `animations/${clip.file}`;
  }
  const extra = {};
  const familyCounts = { loco: 0, combat: 0, ceremony: 0, emote: 0 };
  const familyFiles = new Map();
  const emoteFiles = [];
  const catalogRoots = new Set();
  const droppedByFamily = new Map();
  for (const [name, clip] of Object.entries(clips)) {
    if (STATE_NAMES.includes(name)) continue;
    if (!isExtraClipName(name)) {
      throw new BuildCharacterPackError('extra_name_not_in_vocabulary', `${id}: clip ${name} is neither a state nor a contract extra name`);
    }
    const family = clipFamily(name);
    if (family === 'states') throw new BuildCharacterPackError('extra_family_invalid', `${id}: clip ${name} classified as a state`);
    if (omissions.has(name)) {
      if (family !== 'emote') droppedByFamily.set(family, [...(droppedByFamily.get(family) ?? []), name]);
      continue;
    }
    const relative = family === 'emote' ? `animations/emotes/${name}.glb` : `animations/${family}.glb`;
    if (family === 'emote') emoteFiles.push([name, relative]);
    else familyFiles.set(family, `animations/${family}.glb`);
    if (!(Number(clip.duration) > 0)) {
      throw new BuildCharacterPackError('clip_metadata_invalid', `${id}: clip ${name} duration ${clip.duration}`);
    }
    if (typeof clip.provenance !== 'string' || !clip.provenance) {
      throw new BuildCharacterPackError('clip_metadata_invalid', `${id}: clip ${name} has no provenance`);
    }
    extra[name] = {
      file: relative,
      duration: clip.duration,
      loop: !!clip.loop,
      rootMotion: false, // clips are baked in place; the converter manifest carries the velocity metadata
      source: `${clip.provenance} retargeted to meshy-28 (${CONVERTER_SCHEMA})`,
      family,
    };
    familyCounts[family] += 1;
    catalogRoots.add(clip.provenance.split('/').slice(0, 2).join('/'));
  }
  animations.extra = extra;
  for (const name of omissions.keys()) {
    if (!clips[name]) throw new BuildCharacterPackError('omit_extra_absent', `${id}: omitted extra ${name} is not in the converter clips`);
  }
  // Every referenced source file must exist in the converter output before anything is copied.
  const requiredSources = [['states.glb', stateFiles.size > 0], ...FAMILIES.map((family) => [`${family}.glb`, familyFiles.has(family)]), ...emoteFiles.map(([name]) => [`emotes/${name}.glb`, true])];
  for (const [file, needed] of requiredSources) {
    if (needed) requiredFile(path.join(clipsDir, file), 'pack_file_missing', `converter pack file ${file}`);
  }
  return { converter, animations, familyCounts, familyFiles, emoteFiles, droppedByFamily, catalogRoots: [...catalogRoots].sort(), stateCount: STATE_NAMES.filter((state) => animations[state]).length };
}

function planPreviews(previews, id) {
  if (!previews.length) throw new BuildCharacterPackError('preview_missing', `${id}: at least one --preview is required`);
  const seen = new Set();
  return previews.map((preview) => {
    const extension = path.extname(preview).toLowerCase();
    if (!PREVIEW_EXTENSIONS.has(extension)) {
      throw new BuildCharacterPackError('preview_signature', `${id}: preview ${preview} is not a png/jpg/jpeg/webp`);
    }
    const name = path.basename(preview);
    if (seen.has(name)) throw new BuildCharacterPackError('preview_signature', `${id}: duplicate preview name ${name}`);
    seen.add(name);
    const bytes = readFileSync(requiredFile(preview, 'preview_missing', 'preview'));
    if (!hasPreviewSignature(bytes, extension)) {
      throw new BuildCharacterPackError('preview_signature', `${id}: preview ${preview} does not start with the ${extension} signature`);
    }
    return { source: preview, relative: `previews/${name}` };
  });
}

export async function buildCharacterPack({ id, version, model, poseTest, clips, qa, assets, revision, previews = [], allowQa = [], rightsReferences = [], omitExtra = [], out }) {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(id ?? '')) throw new BuildCharacterPackError('id_invalid', `id ${JSON.stringify(id)} must match ^[a-z][a-z0-9-]{0,63}$`);
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new BuildCharacterPackError('version_invalid', `version ${JSON.stringify(version)} must be semver x.y.z`);
  if (!/^[0-9a-f]{7,40}$/.test(revision ?? '')) throw new BuildCharacterPackError('revision_invalid', `revision ${JSON.stringify(revision)} must be a git sha`);

  const modelFile = requiredFile(model, 'model_missing', 'rigged GLB');
  const pose = readPoseGate(poseTest, id);
  const omissions = planOmissions(omitExtra, id);
  const qaResults = checkClipQa(qa, allowQa, omissions, id);
  const omitted = omissionRecords(omissions, qaResults, id);
  const rights = parseRights(assets, rightsReferences, id);
  const plannedPreviews = planPreviews(previews, id);
  const plan = planClips(clips, id, omissions);

  const modelSha = sha256(modelFile);
  if (plan.converter.model.sha256 !== modelSha) {
    throw new BuildCharacterPackError('model_sha_mismatch', `${id}: converter model sha256 ${plan.converter.model.sha256} != rigged GLB sha256 ${modelSha}; the clips were baked for a different model`);
  }

  const budgetTriangles = Math.ceil(pose.triangles / TRIANGLE_BUDGET_STEP) * TRIANGLE_BUDGET_STEP;
  if (budgetTriangles > TRIANGLE_CAP) {
    throw new BuildCharacterPackError('triangles_over_budget', `${id}: ${pose.triangles} triangles (budget ${budgetTriangles}) over the ${TRIANGLE_CAP} cap`);
  }
  const counts = plan.familyCounts;
  const manifest = {
    schemaVersion: 1,
    kind: 'character',
    id,
    version,
    source: {
      revision,
      provenance: [
        `studio-assets characters/${id} @ ${revision.slice(0, 8)}: ficha, concept, rights; rigged model sha256 ${modelSha}`,
        `Blender character rig pipeline${pose.label ? ` (${pose.label})` : ''}: clean+parts+joints+weights, meshy-28, pose gate PASS (0 failures)`,
        `${CONVERTER_SCHEMA}: ${plan.stateCount} states + ${counts.loco} loco + ${counts.combat} combat + ${counts.ceremony} ceremony + ${counts.emote} emotes; catalog: ${plan.catalogRoots.join(', ')}`,
        ...omitted.map(({ name, reason }) => {
          const family = clipFamily(name);
          const where = family === 'emote' ? 'emote file not packed' : `dropped from animations/${family}.glb`;
          return `omitted extra ${name} (${where}; the runtime falls back for a missing optional extra): ${reason}`;
        }),
      ],
    },
    files: [],
    model: `model/${id}.glb`,
    skeleton: 'meshy-28',
    animations: plan.animations,
    previews: plannedPreviews.map(({ relative }) => relative),
    rights,
    budgets: { triangles: budgetTriangles, bytes: BYTES_BUDGET },
  };

  // Assemble into a staging name first: a version directory that already exists must stay
  // byte-identical, so an existing differing manifest refuses the build before any copy.
  const directory = path.join(path.resolve(out), 'character', id, version);
  const staging = `${directory}.building`;
  const manifestPath = path.join(directory, 'manifest.json');
  const entries = [];
  const putStaged = (source, relative) => {
    const staged = path.join(staging, relative);
    mkdirSync(path.dirname(staged), { recursive: true });
    copyFileSync(source, staged);
    entries.push({ path: relative, sha256: sha256(staged), bytes: statSync(staged).size });
  };
  const putStagedBytes = (bytes, relative) => {
    const staged = path.join(staging, relative);
    mkdirSync(path.dirname(staged), { recursive: true });
    writeFileSync(staged, bytes);
    entries.push({ path: relative, sha256: sha256(staged), bytes: bytes.length });
  };
  try {
    putStaged(modelFile, `model/${id}.glb`);
    if (plan.stateCount > 0) putStaged(path.join(clips, 'states.glb'), 'animations/states.glb');
    for (const family of FAMILIES) {
      if (!plan.familyFiles.has(family)) continue;
      const source = path.join(clips, `${family}.glb`);
      const dropped = plan.droppedByFamily.get(family);
      if (dropped) putStagedBytes(await dropClips(source, dropped, id), `animations/${family}.glb`);
      else putStaged(source, `animations/${family}.glb`);
    }
    for (const [name] of plan.emoteFiles) putStaged(path.join(clips, 'emotes', `${name}.glb`), `animations/emotes/${name}.glb`);
    for (const { source, relative } of plannedPreviews) putStaged(source, relative);

    const totalBytes = entries.reduce((sum, file) => sum + file.bytes, 0);
    if (totalBytes > BYTES_BUDGET) {
      throw new BuildCharacterPackError('bytes_over_budget', `${id}: ${totalBytes} bytes over the declared ${BYTES_BUDGET} byte budget`);
    }
    manifest.files = [...entries].sort((a, b) => a.path.localeCompare(b.path));
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    if (statSync(manifestPath, { throwIfNoEntry: false })?.isFile()) {
      if (!readFileSync(manifestPath).equals(manifestBytes)) {
        throw new BuildCharacterPackError('pack_version_exists', `${manifestPath} already exists with different content; packs are immutable, publish a new version instead`);
      }
    } else {
      mkdirSync(directory, { recursive: true });
      writeFileSync(manifestPath, manifestBytes);
      for (const entry of entries) {
        const destination = path.join(directory, entry.path);
        mkdirSync(path.dirname(destination), { recursive: true });
        copyFileSync(path.join(staging, entry.path), destination);
      }
    }

    let validation;
    try {
      validation = await validatePack({ manifestPath, packageRoot: directory });
    } catch (error) {
      throw new BuildCharacterPackError('pack_validation_failed', `${id}@${version}: the built pack failed the contract validator: ${error.message}`);
    }
    return {
      id,
      version,
      directory,
      manifestSha256: sha256(manifestPath),
      totalBytes,
      triangles: pose.triangles,
      budgetTriangles,
      files: validation.manifest.files.length,
      omitted: omitted.map(({ name }) => name),
      manifest,
    };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

function repeatable(argv, name) {
  return argv.filter((argument) => argument.startsWith(`--${name}=`)).map((argument) => argument.slice(name.length + 3));
}

const isInvocation = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isInvocation) {
  const argv = process.argv.slice(2);
  const value = (name) => {
    const match = argv.find((argument) => argument.startsWith(`--${name}=`));
    if (match === undefined) throw new BuildCharacterPackError('argument_missing', `--${name} is required`);
    return match.slice(name.length + 3);
  };
  const summary = await buildCharacterPack({
    id: value('id'),
    version: value('version'),
    model: value('model'),
    poseTest: value('pose-test'),
    clips: value('clips'),
    qa: value('qa'),
    assets: value('assets'),
    revision: value('revision'),
    out: value('out'),
    previews: repeatable(argv, 'preview'),
    allowQa: repeatable(argv, 'allow-qa').map((entry) => {
      const separator = entry.indexOf(':');
      if (separator <= 0) throw new BuildCharacterPackError('argument_invalid', `--allow-qa expects "<clip|*>:<substring>", got ${JSON.stringify(entry)}`);
      return { clip: entry.slice(0, separator), needle: entry.slice(separator + 1) };
    }),
    rightsReferences: repeatable(argv, 'rights-reference'),
    omitExtra: repeatable(argv, 'omit-extra').map((entry) => {
      const separator = entry.indexOf(':');
      return separator < 0 ? { name: entry } : { name: entry.slice(0, separator), reason: entry.slice(separator + 1) };
    }),
  });
  const omittedNote = summary.omitted.length ? `, omitted ${summary.omitted.join(', ')}` : '';
  console.log(`PASS character/${summary.id}@${summary.version}: built ${summary.files} files, ${summary.totalBytes}/${BYTES_BUDGET} bytes, ${summary.triangles}/${summary.budgetTriangles} triangles${omittedNote}, manifest sha256 ${summary.manifestSha256}`);
}
