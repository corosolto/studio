#!/usr/bin/env node
// Proves tools/characters/build-character-pack.mjs end to end on a synthetic pipeline
// output (programmatic skinned GLB, converter-layout clip packs, synthetic pose-test, QA
// report, PROVENANCE and preview — no real asset bytes, nothing committed): a healthy
// build validates against the contract, is byte-deterministic, and every gate mutant is
// rejected with its own error code.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { isExtraClipName, meshy28Joints, optionalCharacterStates, requiredCharacterStates } from '../lib/character-pack.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCharacterPack, BuildCharacterPackError, CONVERTER_SCHEMA } from '../characters/build-character-pack.mjs';
import { readGlb } from '../lib/glb-inspect.mjs';
import { validatePack } from '../lib/pack.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const pad4 = bytes => Buffer.concat([bytes, Buffer.alloc((4 - (bytes.length % 4)) % 4)]);
const ID = 'fixture-builder-character';
const REVISION = '7b4b30d4b0b0fc56a58da3686ac987dfc5d36376';

let caseNumber = 0;
let passed = 0;
const fixtureDirectories = [];

function glb(document, chunks) {
  const views = [];
  const parts = [];
  let offset = 0;
  for (const chunk of chunks) {
    const padded = pad4(chunk.bytes);
    views.push({ buffer: 0, byteOffset: offset, byteLength: chunk.bytes.length });
    parts.push(padded);
    offset += padded.length;
  }
  const bin = Buffer.concat(parts);
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0', generator: 'coro-solto-studio builder-check' }, ...document, buffers: [{ byteLength: bin.length }], bufferViews: [...document.bufferViews ?? [], ...views] }));
  const paddedJson = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + paddedJson.length + bin.length, 8);
  header.writeUInt32LE(paddedJson.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, paddedJson, binHeader, bin]);
}

function skeletonNodes() {
  const nodes = [{ name: 'Armature', children: [] }];
  const firstIndex = new Map();
  for (const [name] of meshy28Joints) {
    firstIndex.set(name, firstIndex.get(name) ?? nodes.length);
    nodes.push({ name });
  }
  meshy28Joints.forEach(([, parent], offset) => {
    const owner = parent === null ? nodes[0] : nodes[firstIndex.get(parent)];
    owner.children = [...(owner.children || []), offset + 1];
  });
  return nodes;
}

function floats(values) {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => bytes.writeFloatLE(value, index * 4));
  return bytes;
}

function modelGlb() {
  const nodes = skeletonNodes();
  const vertexCount = 12 * 3;
  const positions = floats(Array.from({ length: vertexCount * 3 }, (_, index) => ((index * 7) % 11) * 0.01));
  const jointIndices = Buffer.alloc(vertexCount * 4);
  const jointWeights = floats(Array.from({ length: vertexCount * 4 }, (_, index) => (index % 4 === 0 ? 1 : 0)));
  const indices = Buffer.alloc(vertexCount * 2);
  for (let index = 0; index < vertexCount; index += 1) indices.writeUInt16LE(index, index * 2);
  const inverseBind = floats(meshy28Joints.flatMap(() => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
  nodes.push({ name: 'Body', mesh: 0, skin: 0 });
  return glb({
    scene: 0,
    scenes: [{ nodes: [0, nodes.length - 1] }],
    nodes,
    meshes: [{ name: 'Body', primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 }, indices: 3, mode: 4 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: vertexCount, type: 'VEC3', min: [0, 0, 0], max: [0.1, 0.1, 0.1] },
      { bufferView: 1, componentType: 5121, count: vertexCount, type: 'VEC4' },
      { bufferView: 2, componentType: 5126, count: vertexCount, type: 'VEC4' },
      { bufferView: 3, componentType: 5123, count: vertexCount, type: 'SCALAR' },
      { bufferView: 4, componentType: 5126, count: meshy28Joints.length, type: 'MAT4' },
    ],
    skins: [{ name: 'Armature', skeleton: 1, joints: meshy28Joints.map((_, offset) => offset + 1), inverseBindMatrices: 4 }],
  }, [
    { bytes: positions },
    { bytes: jointIndices },
    { bytes: jointWeights },
    { bytes: indices },
    { bytes: inverseBind },
  ]);
}

// One GLB holding several named clips (the converter's states/family pack layout).
function clipsGlb(names) {
  const nodes = skeletonNodes();
  const targetNode = nodes.findIndex(node => node.name === 'Hips');
  return glb({
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    animations: names.map(name => ({
      name,
      channels: [{ sampler: 0, target: { node: targetNode, path: 'rotation' } }],
      samplers: [{ input: 0, output: 1, interpolation: 'LINEAR' }],
    })),
    accessors: [
      { bufferView: 0, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] },
      { bufferView: 1, componentType: 5126, count: 2, type: 'VEC4' },
    ],
  }, [
    { bytes: floats([0, 1]) },
    { bytes: floats([0, 0, 0, 1, 0, 0, 0, 1]) },
  ]);
}

const STATES = [...requiredCharacterStates, ...optionalCharacterStates];
const LOCO_CLIPS = ['strafe_left', 'walk_back'];
const COMBAT_CLIPS = ['reload_rifle'];
const CEREMONY_CLIPS = ['victory'];
const EMOTE_CLIPS = ['emote_danca'];
for (const name of [...LOCO_CLIPS, ...COMBAT_CLIPS, ...CEREMONY_CLIPS, ...EMOTE_CLIPS]) {
  if (!isExtraClipName(name)) throw new Error(`fixture clip ${name} is not in the contract vocabulary`);
}

function converterClips() {
  const clips = {};
  for (const state of STATES) clips[state] = { file: 'states.glb', duration: 1.2, loop: true, provenance: 'mixamo/fixture/state' };
  for (const name of LOCO_CLIPS) clips[name] = { file: 'loco.glb', duration: 0.9, loop: true, provenance: 'mixamo/fixture/loco' };
  for (const name of COMBAT_CLIPS) clips[name] = { file: 'combat.glb', duration: 2.4, loop: false, provenance: 'mixamo/fixture/combat' };
  for (const name of CEREMONY_CLIPS) clips[name] = { file: 'ceremony.glb', duration: 3.1, loop: false, provenance: 'quaternius/fixture/ceremony' };
  for (const name of EMOTE_CLIPS) clips[name] = { file: 'emotes/emote_danca.glb', duration: 2.0, loop: true, provenance: 'mixamo/fixture/emote' };
  return clips;
}

// Writes one synthetic pipeline output; every mutant below overrides a piece of it.
function writeFixture(overrides = {}) {
  const directory = path.join(os.tmpdir(), `studio-builder-${process.pid}-${caseNumber += 1}`);
  fixtureDirectories.push(directory);
  const modelBytes = overrides.modelBytes ?? modelGlb();
  const clips = overrides.clips ?? converterClips();
  const files = {
    'model.glb': modelBytes,
    'pose-test.json': JSON.stringify({ model: 'model.glb', label: 'v4-fixture', triangles: overrides.triangles ?? 12, failures: overrides.poseFailures ?? [] }, null, 2),
    'clips/manifest.json': JSON.stringify({
      schema: overrides.schema ?? CONVERTER_SCHEMA,
      id: overrides.converterId ?? ID,
      skeleton: 'meshy-28',
      model: { file: 'model.glb', sha256: overrides.modelSha ?? sha256(modelBytes) },
      files: {},
      clips,
    }, null, 2),
    'clips/states.glb': clipsGlb(STATES.filter(state => clips[state])),
    'clips/emotes/emote_danca.glb': clipsGlb(['emote_danca']),
    'assets/PROVENANCE.md': overrides.provenance ?? '## Ficha\n\n## Rights\n\n- Status: **original**.\n- Basis: Invented synthetic character; no likeness, no third-party design.\n\n## Notes\n',
    'qa.json': JSON.stringify({ model: 'model.glb', clipCount: 2, failing: [], results: overrides.qaResults ?? [
      { name: 'idle', failures: [] },
      { name: 'death', failures: ['skin stretch 4.16\u00d7 @1.3818s > 3.5 [rig: RightShoulder+Head]'] },
    ] }, null, 2),
    'previews/portrait-front.png': overrides.previewBytes ?? png,
  };
  if (clips.strafe_left || clips.walk_back) files['clips/loco.glb'] = clipsGlb(LOCO_CLIPS.filter(name => clips[name]));
  if (clips.reload_rifle) files['clips/combat.glb'] = clipsGlb(COMBAT_CLIPS.filter(name => clips[name]));
  if (clips.victory) files['clips/ceremony.glb'] = clipsGlb(CEREMONY_CLIPS.filter(name => clips[name]));
  for (const [name, bytes] of Object.entries(overrides.extraFiles ?? {})) files[name] = bytes;
  for (const name of overrides.removeFiles ?? []) delete files[name];
  for (const [name, bytes] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(directory, name)), { recursive: true });
    fs.writeFileSync(path.join(directory, name), bytes);
  }
  const defaultOptions = {
    id: ID,
    version: '0.2.0',
    model: path.join(directory, 'model.glb'),
    poseTest: path.join(directory, 'pose-test.json'),
    clips: path.join(directory, 'clips'),
    qa: path.join(directory, 'qa.json'),
    assets: path.join(directory, 'assets'),
    revision: REVISION,
    previews: [path.join(directory, 'previews/portrait-front.png')],
    allowQa: overrides.allowQa ?? [],
    rightsReferences: overrides.rightsReferences ?? [],
    omitExtra: overrides.omitExtra ?? [],
    out: overrides.out ?? path.join(directory, 'out'),
  };
  return { directory, options: overrides.options ? overrides.options(defaultOptions) : defaultOptions };
}

function expectFailure(label, code, overrides) {
  const { options } = writeFixture(overrides);
  return buildCharacterPack(options).then(() => {
    throw new Error(`${label} was not rejected`);
  }, error => {
    if (!(error instanceof BuildCharacterPackError) || error.code !== code) {
      throw new Error(`${label} was rejected for the wrong reason (want [${code}]): ${error.message}`);
    }
    console.log(`PASS ${label} rejected`);
    passed += 1;
  });
}

async function expectSuccess(label, overrides, verify) {
  const { options } = writeFixture(overrides);
  const summary = await buildCharacterPack(options);
  if (!/^[0-9a-f]{64}$/.test(summary.manifestSha256)) throw new Error(`${label}: manifest sha256 missing`);
  if (verify) await verify(summary);
  console.log(`PASS ${label}`);
  passed += 1;
  return summary;
}

const packRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-builder-pack-'));
try {
  // The healthy build: validates against the shared contract, states share states.glb,
  // extras carry converter metadata and the family derived by the contract's own mirror.
  const healthy = await expectSuccess('healthy build', {}, summary => {
    if (summary.files !== 7) throw new Error(`healthy build packed ${summary.files} files, expected 7`);
    for (const state of STATES) {
      if (summary.manifest.animations[state] !== 'animations/states.glb') throw new Error(`state ${state} does not share states.glb`);
    }
    const strafe = summary.manifest.animations.extra.strafe_left;
    if (strafe.family !== 'loco' || strafe.file !== 'animations/loco.glb' || strafe.loop !== true || strafe.duration !== 0.9) throw new Error('strafe_left extra metadata is wrong');
    if (summary.manifest.animations.extra.emote_danca.file !== 'animations/emotes/emote_danca.glb') throw new Error('emote does not keep its own file');
    if (summary.manifest.rights.status !== 'original' || !summary.manifest.rights.basis.includes('Invented')) throw new Error('rights not copied verbatim');
    if (summary.manifest.source.revision !== REVISION) throw new Error('studio-assets revision not recorded');
    if (summary.manifest.files.at(-1).path !== 'previews/portrait-front.png') throw new Error('files are not sorted by path');
    if (summary.manifest.budgets.triangles !== 500 || summary.manifest.budgets.bytes !== 8388608) throw new Error('budgets not derived from the pose test');
    if (!summary.manifest.source.provenance[2].includes('11 states + 2 loco + 1 combat + 1 ceremony + 1 emote')) throw new Error('converter provenance line is wrong');
  });

  // The CLI wrapper parses the same arguments and prints the same PASS summary.
  {
    const { options } = writeFixture({ out: path.join(packRoot, 'cli') });
    const output = execFileSync(process.execPath, [
      path.join(root, 'tools/characters/build-character-pack.mjs'),
      `--id=${options.id}`, `--version=${options.version}`, `--model=${options.model}`, `--pose-test=${options.poseTest}`,
      `--clips=${options.clips}`, `--qa=${options.qa}`, `--assets=${options.assets}`, `--revision=${options.revision}`,
      `--preview=${options.previews[0]}`, `--out=${options.out}`,
    ], { encoding: 'utf8' });
    if (!output.startsWith(`PASS character/${ID}@0.2.0: built 7 files`)) throw new Error(`CLI output is not the PASS summary: ${output.trim()}`);
    console.log('PASS CLI invocation builds the same pack');
    passed += 1;
  }

  // Determinism: the same inputs produce byte-identical manifests wherever they land.
  await expectSuccess('deterministic rebuild elsewhere', { out: path.join(packRoot, 'det-b') }, summary => {
    if (summary.manifestSha256 !== healthy.manifestSha256) throw new Error('rebuild in another root changed the manifest sha');
  });
  await expectSuccess('immutable version rebuild is a no-op', { out: path.join(packRoot, 'det-b') }, summary => {
  });

  // The built pack also passes the shared validator on its own (defense in depth).
  {
    const manifestPath = path.join(packRoot, 'det-b', 'character', ID, '0.2.0', 'manifest.json');
    const { character } = await validatePack({ manifestPath, packageRoot: path.dirname(manifestPath) });
    if (character.animations !== STATES.length) throw new Error(`validator counted ${character.animations} state clips`);
    console.log('PASS built pack validates against the contract');
    passed += 1;
  }

  // An already-published version must never change: identical rebuild is fine, a
  // different input under the same version is refused.
  {
    const immutableRoot = path.join(packRoot, 'immutable');
    await expectSuccess('immutable version first build', { out: immutableRoot });
    await expectFailure('immutable version refuses to change', 'pack_version_exists', {
      out: immutableRoot,
      previewBytes: Buffer.concat([png, Buffer.from('different bytes')]),
    });
  }

  await expectFailure('pose gate failure', 'pose_gate_failed', { poseFailures: ['walk: clip worst edge 12.3\u00d7 > 3.5'] });
  await expectFailure('missing pose test', 'pose_test_missing', { removeFiles: ['pose-test.json'] });
  await expectFailure('missing QA report', 'qa_report_missing', { removeFiles: ['qa.json'] });
  await expectFailure('QA report without results', 'qa_report_invalid', { qaResults: 'nope' });
  await expectFailure('non-rig QA failure', 'qa_failure_not_allowed', { qaResults: [{ name: 'run_back', failures: ['foot slide 5.2 cm > 4 cm'] }] });
  await expectFailure('non-rig QA failure on another clip', 'qa_failure_not_allowed', { qaResults: [{ name: 'idle', failures: [] }, { name: 'jump', failures: ['floating 4.1 cm > 3 cm'] }] });
  await expectSuccess('non-rig QA failure allowlisted by clip', {
    qaResults: [{ name: 'run_back', failures: ['foot slide 5.2 cm > 4 cm'] }],
    allowQa: [{ clip: 'run_back', needle: 'foot slide 5.2' }],
  });
  await expectSuccess('non-rig QA failure allowlisted by wildcard', {
    qaResults: [{ name: 'victory', failures: ['floating 4.1 cm > 3 cm'] }],
    allowQa: [{ clip: '*', needle: 'floating' }],
  });
  await expectFailure('allowlist for the wrong clip does not cover', 'qa_failure_not_allowed', {
    qaResults: [{ name: 'run_back', failures: ['foot slide 5.2 cm > 4 cm'] }],
    allowQa: [{ clip: 'idle', needle: 'foot slide' }],
  });
  await expectFailure('converter schema mismatch', 'converter_schema', { schema: 'coro-solto/character-clips@1' });
  await expectFailure('converter id mismatch', 'converter_id_mismatch', { converterId: 'another-character' });
  await expectFailure('model sha mismatch', 'model_sha_mismatch', { modelSha: '0'.repeat(64) });
  await expectFailure('missing converter manifest', 'converter_manifest_missing', { removeFiles: ['clips/manifest.json'] });
  await expectFailure('required state missing', 'state_missing', { clips: (() => { const clips = converterClips(); delete clips.jump; return clips; })() });
  await expectFailure('state outside states.glb', 'state_layout_unsupported', { clips: (() => { const clips = converterClips(); clips.idle.file = 'idle.glb'; return clips; })() });
  await expectFailure('extra name outside the vocabulary', 'extra_name_not_in_vocabulary', { clips: { ...converterClips(), teleport: { file: 'loco.glb', duration: 1, loop: false, provenance: 'mixamo/fixture/teleport' } } });
  await expectFailure('zero duration clip', 'clip_metadata_invalid', { clips: { ...converterClips(), strafe_left: { ...converterClips().strafe_left, duration: 0 } } });
  await expectFailure('clip without provenance', 'clip_metadata_invalid', { clips: { ...converterClips(), victory: { file: 'ceremony.glb', duration: 3, loop: false, provenance: '' } } });
  await expectFailure('missing family pack file', 'pack_file_missing', { removeFiles: ['clips/loco.glb'] });
  await expectFailure('missing ceremony pack file', 'pack_file_missing', { removeFiles: ['clips/ceremony.glb'] });
  await expectFailure('missing emote file', 'pack_file_missing', { removeFiles: ['clips/emotes/emote_danca.glb'] });
  await expectFailure('missing PROVENANCE', 'provenance_missing', { removeFiles: ['assets/PROVENANCE.md'] });
  await expectFailure('unknown rights status', 'rights_status_invalid', { provenance: '## Rights\n\n- Status: **fan-art**.\n- Basis: Someone else\u2019s character.\n' });
  await expectFailure('rights without basis', 'rights_basis_missing', { provenance: '## Rights\n\n- Status: **original**.\n' });
  await expectFailure('public-domain without citations', 'rights_references_missing', { provenance: '## Rights\n\n- Status: **public-domain**.\n- Basis: Bram Stoker, Dracula, 1897 (author died 1912).\n' });
  await expectSuccess('public-domain with citation', {
    provenance: '## Rights\n\n- Status: **public-domain**.\n- Basis: Bram Stoker, Dracula, 1897 (author died 1912).\n',
    rightsReferences: ['Bram Stoker, Dracula, 1897 (author died 1912)'],
  }, summary => {
    if (summary.manifest.rights.references?.[0] !== 'Bram Stoker, Dracula, 1897 (author died 1912)') throw new Error('citation not recorded');
  });
  await expectFailure('triangles over the cap', 'triangles_over_budget', { triangles: 16000 });
  await expectFailure('bytes over the budget', 'bytes_over_budget', { previewBytes: Buffer.concat([png, Buffer.alloc(8388608)]) });
  await expectFailure('preview with wrong signature', 'preview_signature', { previewBytes: Buffer.from('not a png at all') });
  await expectFailure('no preview', 'preview_missing', { options: defaults => ({ ...defaults, previews: [] }) });
  await expectFailure('bad revision', 'revision_invalid', { options: defaults => ({ ...defaults, revision: 'not-a-sha' }) });
  await expectFailure('bad version', 'version_invalid', { options: defaults => ({ ...defaults, version: '0.2' }) });

  // Omitted extras (owner decision): the clip leaves its family pack and the manifest, its QA
  // failure stops gating the build, and the provenance records the reason with the number.
  const stretch = 'skin stretch 3.666\u00d7 @0.6364s > 3.5 [clip: Hips+RightUpLeg]';
  await expectFailure('QA failure on a kept extra still refuses', 'qa_failure_not_allowed', {
    qaResults: [{ name: 'walk_back', failures: [stretch] }],
  });
  await expectSuccess('omitted extra leaves its family pack', {
    qaResults: [{ name: 'idle', failures: [] }, { name: 'walk_back', failures: [stretch] }],
    omitExtra: [{ name: 'walk_back' }],
  }, summary => {
    const extra = summary.manifest.animations.extra;
    if (extra.walk_back || extra.strafe_left?.file !== 'animations/loco.glb') throw new Error('walk_back still declared or strafe_left lost');
    if (summary.files !== 7) throw new Error(`omitted build packed ${summary.files} files, expected 7`);
    const line = summary.manifest.source.provenance.find(entry => entry.startsWith('omitted extra walk_back'));
    if (!line?.includes('3.666\u00d7') || !line.includes('animations/loco.glb')) throw new Error(`omission not recorded with its QA number: ${line}`);
    if (!summary.manifest.source.provenance[2].includes('11 states + 1 loco')) throw new Error('converter provenance still counts the omitted clip');
    return readGlb(path.join(summary.directory, 'animations/loco.glb'), 'loco.glb', { allowMeshoptFallback: true }).then(({ document }) => {
      const names = document.animations.map(animation => animation.name);
      if (names.join() !== 'strafe_left') throw new Error(`rewritten loco.glb holds ${names.join(', ')}`);
    });
  });
  await expectSuccess('omitted emote with an explicit reason drops its file', {
    omitExtra: [{ name: 'emote_danca', reason: 'owner decision: lobby emote cut' }],
  }, summary => {
    if (summary.files !== 6 || summary.manifest.files.some(file => file.path.includes('emote_danca'))) throw new Error('omitted emote file still packed');
    if (!summary.manifest.source.provenance.some(entry => entry.includes('omitted extra emote_danca') && entry.includes('owner decision: lobby emote cut'))) throw new Error('emote omission reason not recorded');
  });
  {
    const { options } = writeFixture({ out: path.join(packRoot, 'cli-omit'), qaResults: [{ name: 'walk_back', failures: [stretch] }] });
    const output = execFileSync(process.execPath, [
      path.join(root, 'tools/characters/build-character-pack.mjs'),
      `--id=${options.id}`, `--version=${options.version}`, `--model=${options.model}`, `--pose-test=${options.poseTest}`,
      `--clips=${options.clips}`, `--qa=${options.qa}`, `--assets=${options.assets}`, `--revision=${options.revision}`,
      `--preview=${options.previews[0]}`, `--out=${options.out}`, '--omit-extra=walk_back',
    ], { encoding: 'utf8' });
    if (!output.includes('triangles, omitted walk_back, manifest sha256')) throw new Error(`CLI did not report the omission: ${output.trim()}`);
    console.log('PASS CLI --omit-extra builds without the clip');
    passed += 1;
  }
  await expectFailure('omitting a required state', 'omit_extra_state', { omitExtra: [{ name: 'jump', reason: 'owner decision' }] });
  await expectFailure('omitting an optional state', 'omit_extra_state', { omitExtra: [{ name: 'walkfire', reason: 'owner decision' }] });
  await expectFailure('omitting a name outside the vocabulary', 'omit_extra_invalid', { omitExtra: [{ name: 'teleport', reason: 'owner decision' }] });
  await expectFailure('omitting the same extra twice', 'omit_extra_invalid', { omitExtra: [{ name: 'victory', reason: 'a' }, { name: 'victory', reason: 'b' }] });
  await expectFailure('omitting an extra the converter never baked', 'omit_extra_absent', {
    clips: (() => { const clips = converterClips(); delete clips.walk_back; return clips; })(),
    omitExtra: [{ name: 'walk_back', reason: 'owner decision' }],
  });
  await expectFailure('omission without a reason or QA failure', 'omit_reason_missing', { omitExtra: [{ name: 'strafe_left' }] });

  console.log(`PASS character pack builder check (${passed} cases)`);
} finally {
  fs.rmSync(packRoot, { recursive: true, force: true });
  for (const directory of fixtureDirectories) fs.rmSync(directory, { recursive: true, force: true });
}
