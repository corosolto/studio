#!/usr/bin/env node
// Builds a tiny synthetic character pack (programmatic skinned GLB, no real asset bytes),
// proves it validates, then proves every contract mutant is rejected for the right reason.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertExtraClipVocabulary, clipFamily, converterExtraClipNames, coreExtraClipNames, extraClipNames, meshy28Joints, optionalCharacterStates, requiredCharacterStates } from '../lib/character-pack.mjs';
import { readGlb } from '../lib/glb-inspect.mjs';
import { validatePack } from '../lib/pack.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const pad4 = bytes => Buffer.concat([bytes, Buffer.alloc((4 - (bytes.length % 4)) % 4)]);

function glb(document, chunks, extraBuffers = []) {
  const views = [];
  const parts = [];
  let offset = 0;
  for (const chunk of chunks) {
    const padded = pad4(chunk.bytes);
    views.push({ buffer: 0, byteOffset: offset, byteLength: chunk.bytes.length, ...(chunk.target ? { target: chunk.target } : {}) });
    parts.push(padded);
    offset += padded.length;
  }
  const bin = Buffer.concat(parts);
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0', generator: 'coro-solto-studio character-pack-check' }, ...document, buffers: [{ byteLength: bin.length }, ...extraBuffers], bufferViews: [...document.bufferViews ?? [], ...views] }));
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

function skeletonNodes(joints) {
  const nodes = [{ name: 'Armature', children: [] }];
  const firstIndex = new Map();
  for (const [name] of joints) {
    firstIndex.set(name, firstIndex.get(name) ?? nodes.length);
    nodes.push({ name });
  }
  joints.forEach(([, parent], offset) => {
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

function modelGlb({ joints = meshy28Joints, triangles = 12, skin = true, weights = true, mode = 4, jointsAccessor = 1, jointValue = 0 } = {}) {
  const nodes = skeletonNodes(joints);
  const vertexCount = triangles * 3;
  const positions = floats(Array.from({ length: vertexCount * 3 }, (_, index) => ((index * 7) % 11) * 0.01));
  const jointIndices = Buffer.alloc(vertexCount * 4, jointValue);
  const jointWeights = floats(Array.from({ length: vertexCount * 4 }, (_, index) => (index % 4 === 0 ? 1 : 0)));
  const indices = Buffer.alloc(vertexCount * 2);
  for (let index = 0; index < vertexCount; index += 1) indices.writeUInt16LE(index, index * 2);
  const inverseBind = floats(joints.flatMap(() => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
  const attributes = { POSITION: 0, JOINTS_0: jointsAccessor, ...(weights ? { WEIGHTS_0: 2 } : {}) };
  nodes.push({ name: 'Body', mesh: 0, ...(skin ? { skin: 0 } : {}) });
  return glb({
    scene: 0,
    scenes: [{ nodes: [0, nodes.length - 1] }],
    nodes,
    meshes: [{ name: 'Body', primitives: [{ attributes, indices: 3, mode }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: vertexCount, type: 'VEC3', min: [0, 0, 0], max: [0.1, 0.1, 0.1] },
      { bufferView: 1, componentType: 5121, count: vertexCount, type: 'VEC4' },
      { bufferView: 2, componentType: 5126, count: vertexCount, type: 'VEC4' },
      { bufferView: 3, componentType: 5123, count: vertexCount, type: 'SCALAR' },
      { bufferView: 4, componentType: 5126, count: joints.length, type: 'MAT4' },
    ],
    ...(skin ? { skins: [{ name: 'Armature', skeleton: 1, joints: joints.map((_, offset) => offset + 1), inverseBindMatrices: 4 }] } : {}),
  }, [
    { bytes: positions, target: 34962 },
    { bytes: jointIndices, target: 34962 },
    { bytes: jointWeights, target: 34962 },
    { bytes: indices, target: 34963 },
    { bytes: inverseBind },
  ]);
}

// `morph` adds a second, morph-weights channel on a `Face` node: 'valid' (one morph
// target), 'no-targets' (mesh without morph targets) or 'missing-mesh' (mesh index 999).
function clipGlb(name, { target = 'Hips', path: channelPath = 'rotation', keyframes = 2, outputValues = keyframes, morph } = {}) {
  const nodes = skeletonNodes(meshy28Joints);
  if (target !== 'Hips') nodes.push({ name: target });
  const targetNode = nodes.findIndex(node => node.name === target);
  const input = keyframes ? [{ bufferView: 0, componentType: 5126, count: keyframes, type: 'SCALAR', min: [0], max: [keyframes - 1] }] : [{ componentType: 5126, count: 0, type: 'SCALAR' }];
  const output = outputValues ? [{ bufferView: keyframes ? 1 : 0, componentType: 5126, count: outputValues, type: 'VEC4' }] : [{ componentType: 5126, count: 0, type: 'VEC4' }];
  const chunks = [
    ...(keyframes ? [{ bytes: floats(Array.from({ length: keyframes }, (_, index) => index)) }] : []),
    ...(outputValues ? [{ bytes: floats(Array.from({ length: outputValues }, () => [0, 0, 0, 1]).flat()) }] : []),
  ];
  const channels = [{ sampler: 0, target: { node: targetNode, ...(channelPath ? { path: channelPath } : {}) } }];
  const samplers = [{ input: 0, output: 1, interpolation: 'LINEAR' }];
  const morphDocument = {};
  if (morph) {
    nodes.push({ name: 'Face', mesh: morph === 'missing-mesh' ? 999 : 0 });
    if (morph !== 'missing-mesh') morphDocument.meshes = [{ primitives: [{ attributes: {}, ...(morph === 'valid' ? { targets: [{}] } : {}) }] }];
    output.push({ bufferView: 0, componentType: 5126, count: keyframes, type: 'SCALAR' });
    samplers.push({ input: 0, output: 2, interpolation: 'LINEAR' });
    channels.push({ sampler: 1, target: { node: nodes.length - 1, path: 'weights' } });
  }
  return glb({
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    ...morphDocument,
    animations: [{ name, channels, samplers }],
    accessors: [...input, ...output],
  }, chunks);
}

// A family pack (or a states pack): several named clips sharing one GLB, all driving the Hips
// rotation channel, exactly how the converter merges per-clip GLBs into states/loco/combat/
// ceremony files.
function clipsGlb(names) {
  const nodes = skeletonNodes(meshy28Joints);
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

// The converter's EXT_meshopt_compression shape: buffer 0 holds the compressed stream (the
// BIN chunk), buffer 1 is the virtual fallback buffer, and every bufferView lives in the
// fallback with a compressed range pointing into buffer 0.
function meshoptClipsGlb(names, { markFallback = true, overshootStream = false } = {}) {
  const nodes = skeletonNodes(meshy28Joints);
  const targetNode = nodes.findIndex(node => node.name === 'Hips');
  const stream = Buffer.alloc(16, 7);
  const secondHalf = overshootStream ? 16 : 8;
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
    bufferViews: [
      { buffer: 1, byteOffset: 0, byteLength: 8, extensions: { EXT_meshopt_compression: { buffer: 0, byteOffset: 0, byteLength: 8 } } },
      { buffer: 1, byteOffset: 8, byteLength: 32, extensions: { EXT_meshopt_compression: { buffer: 0, byteOffset: secondHalf, byteLength: secondHalf === 16 ? 16 : 8 } } },
    ],
  }, [{ bytes: stream }], [{ byteLength: 40, ...(markFallback ? { extensions: { EXT_meshopt_compression: { fallback: true } } } : {}) }]);
}

const allStates = [...requiredCharacterStates, ...optionalCharacterStates];
function validFiles() {
  const files = { 'model/fixture-character.glb': modelGlb(), 'previews/portrait.png': png };
  for (const state of allStates) files[`animations/${state}.glb`] = clipGlb(state);
  // strafe_left and walk_back share the loco family pack; sprint_fwd_left keeps the old
  // one-file-per-clip layout; the emote keeps its own file. Family declared on some keys only.
  files['animations/extra/loco.glb'] = clipsGlb(['strafe_left', 'walk_back']);
  files['animations/extra/sprint-fwd-left.glb'] = clipGlb('sprint_fwd_left');
  files['animations/extra/emote-danca.glb'] = clipGlb('emote_danca');
  return files;
}

function manifestFor(files) {
  return {
    schemaVersion: 1,
    kind: 'character',
    id: 'fixture-character',
    version: '0.1.0',
    source: { revision: 'abcdef1234567', provenance: ['Deterministic synthetic character fixture; not a release'] },
    files: Object.entries(files).map(([file, bytes]) => ({ path: file, sha256: sha256(bytes), bytes: bytes.length })),
    model: 'model/fixture-character.glb',
    skeleton: 'meshy-28',
    animations: {
      ...Object.fromEntries(allStates.map(state => [state, `animations/${state}.glb`])),
      extra: {
        strafe_left: { file: 'animations/extra/loco.glb', duration: 0.8, loop: true, rootMotion: false, source: 'Synthetic strafe-left fixture clip', family: 'loco' },
        walk_back: { file: 'animations/extra/loco.glb', duration: 1.1, loop: true, rootMotion: false, source: 'Synthetic walk-back fixture clip' },
        emote_danca: { file: 'animations/extra/emote-danca.glb', duration: 2.5, loop: false, rootMotion: false, source: 'Synthetic emote fixture clip', family: 'emote' },
        sprint_fwd_left: { file: 'animations/extra/sprint-fwd-left.glb', duration: 0.7, loop: true, rootMotion: false, source: 'Synthetic converter-vocabulary fixture clip' },
      },
    },
    previews: ['previews/portrait.png'],
    rights: { status: 'original', basis: 'Invented synthetic test character with no likeness or third-party design.' },
    budgets: { triangles: 100, bytes: 1048576 },
  };
}

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-character-'));
let caseNumber = 0;
async function validateCase({ files = validFiles(), replace = {}, mutate = () => {} } = {}) {
  const packageRoot = path.join(directory, `case-${caseNumber += 1}`);
  const contents = { ...files, ...replace };
  for (const [file, bytes] of Object.entries(contents)) {
    const destination = path.join(packageRoot, ...file.split('/'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
  }
  const manifest = manifestFor(contents);
  mutate(manifest);
  const manifestPath = path.join(packageRoot, 'manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return validatePack({ manifestPath, packageRoot });
}

// Synchronous form of expectRejection for the pure vocabulary invariant (no pack fixture).
function expectVocabularyFailure(label, pattern, options) {
  try {
    assertExtraClipVocabulary(options);
  } catch (caught) {
    if (!pattern.test(caught.message)) throw new Error(`${label} was rejected for the wrong reason: ${caught.message}`);
    console.log(`PASS ${label} rejected`);
    return;
  }
  throw new Error(`${label} was not rejected`);
}

async function expectRejection(label, pattern, options) {
  let error;
  try { await validateCase(options); } catch (caught) { error = caught; }
  if (!error) throw new Error(`${label} was not rejected`);
  if (!pattern.test(error.message)) throw new Error(`${label} was rejected for the wrong reason: ${error.message}`);
  console.log(`PASS ${label} rejected`);
}

const dropState = state => manifest => {
  delete manifest.animations[state];
  manifest.files = manifest.files.filter(file => file.path !== `animations/${state}.glb`);
};

const dropExtras = manifest => {
  for (const entry of Object.values(manifest.animations.extra || {})) {
    manifest.files = manifest.files.filter(file => file.path !== entry.file);
  }
  delete manifest.animations.extra;
};

try {
  const valid = await validateCase();
  console.log(`PASS Valid synthetic character pack (${valid.character.triangles} triangles, ${valid.character.joints} meshy-28 joints, ${valid.character.animations} state clips, ${valid.character.extraClips} extra clips)`);
  const requiredOnly = await validateCase({ mutate: manifest => { optionalCharacterStates.forEach(state => dropState(state)(manifest)); dropExtras(manifest); } });
  console.log(`PASS Valid character pack with only the ${requiredOnly.character.animations} required states and ${requiredOnly.character.extraClips} extra clips`);
  await validateCase({ replace: { 'animations/idle.glb': clipGlb('idle', { morph: 'valid' }) } });
  console.log('PASS Valid clip with a bone channel plus a morph-weights channel');

  // Every state may also come from one shared states pack whose clip names are the state names.
  const statesPack = await validateCase({
    files: {
      'model/fixture-character.glb': modelGlb(),
      'previews/portrait.png': png,
      'animations/states.glb': clipsGlb(allStates),
      'animations/extra/loco.glb': clipsGlb(['strafe_left', 'walk_back']),
      'animations/extra/sprint-fwd-left.glb': clipGlb('sprint_fwd_left'),
      'animations/extra/emote-danca.glb': clipGlb('emote_danca'),
    },
    mutate: manifest => {
      for (const state of allStates) manifest.animations[state] = 'animations/states.glb';
    },
  });
  console.log(`PASS Valid character pack with all ${statesPack.character.animations} states in one states.glb`);

  // The converter's meshopt family packs (fallback buffer + compressed streams) validate as
  // animation files, while the raw model read keeps the strict single-buffer container.
  await validateCase({ replace: { 'animations/extra/loco.glb': meshoptClipsGlb(['strafe_left', 'walk_back']) } });
  console.log('PASS Valid meshopt-compressed family pack accepted');
  const meshoptShape = path.join(directory, 'meshopt-shape.glb');
  fs.writeFileSync(meshoptShape, meshoptClipsGlb(['strafe_left']));
  await readGlb(meshoptShape, 'meshopt-shape.glb', { allowMeshoptFallback: true });
  try {
    await readGlb(meshoptShape, 'meshopt-shape.glb');
    throw new Error('Strict readGlb accepted the meshopt fallback layout');
  } catch (caught) {
    if (!/one self-contained buffer/.test(caught.message)) throw new Error(`Strict readGlb rejected for the wrong reason: ${caught.message}`);
  }
  console.log('PASS Strict readGlb still rejects the meshopt fallback layout (model path)');

  // Single-source vocabulary invariant: the contract vocabulary must equal the core names plus
  // the animation conversion library's proposed names (snapshot in character-pack.mjs).
  assertExtraClipVocabulary();
  console.log(`PASS Extra clip vocabulary covers the conversion library (${extraClipNames.length} names = ${coreExtraClipNames.length} core + ${converterExtraClipNames.length} converter)`);
  expectVocabularyFailure('Converter key missing from the vocabulary', /converter clip names missing from the vocabulary: vault_low/, {
    converter: [...converterExtraClipNames, 'vault_low'],
  });
  expectVocabularyFailure('Vocabulary name outside the core and converter sets', /extra clip names outside the core and converter sets: moonwalk/, {
    vocabulary: [...extraClipNames, 'moonwalk'],
  });
  expectVocabularyFailure('Core name dropped from the vocabulary', /core extra clip names missing from the vocabulary: victory/, {
    vocabulary: extraClipNames.filter(name => name !== 'victory'),
  });
  expectVocabularyFailure('Duplicate vocabulary entry', /duplicate extra clip name in the vocabulary: sprint/, {
    vocabulary: [...extraClipNames, 'sprint'],
  });


  // Family parity: the contract mirror must classify every name exactly like the converter's
  // packFamily. Snapshot generated 2026-11-09 by importing packFamily from
  // feat/animation-conversion-20261109 tools/lib/clip-pack.mjs over every state, vocabulary and
  // sample emote name; the converter's pack id `emotes` is the contract family `emote`.
  const converterPackFamilies = Object.freeze({
    idle: 'states', walk: 'states', run: 'states', shoot: 'states', death: 'states', crouch: 'states',
    crouchwalk: 'states', jump: 'states', idle1h: 'states', walk1h: 'states', walkfire: 'states',
    strafe_left: 'loco', strafe_right: 'loco', walk_back: 'loco', run_back: 'loco', strafe_left_pistol: 'loco',
    strafe_right_pistol: 'loco', walk_back_pistol: 'loco', reload_rifle: 'combat', reload_pistol: 'combat',
    draw_rifle: 'combat', holster_rifle: 'combat', draw_pistol: 'combat', holster_pistol: 'combat',
    hit_front: 'combat', hit_back: 'combat', hit_left: 'combat', hit_right: 'combat', hit_head: 'combat',
    grenade_throw: 'combat', knife_idle: 'combat', knife_stab: 'combat', victory: 'ceremony', defeat: 'ceremony',
    crouch_aim: 'loco', crouch_pistol: 'loco', crouch_turn_left: 'loco', crouch_turn_right: 'loco',
    crouchwalk_back: 'loco', crouchwalk_back_left: 'loco', crouchwalk_back_right: 'loco', crouchwalk_fwd_left: 'loco',
    crouchwalk_fwd_right: 'loco', crouchwalk_left: 'loco', crouchwalk_right: 'loco', death_crouch: 'ceremony',
    death_front: 'ceremony', death_headshot_back: 'ceremony', death_headshot_front: 'ceremony', death_right: 'ceremony',
    idle_aim: 'loco', jump_land: 'loco', jump_loop: 'loco', jump_pistol: 'loco', jump_start: 'loco',
    run_back_left: 'loco', run_back_pistol: 'loco', run_back_right: 'loco', run_fwd_left: 'loco', run_fwd_right: 'loco',
    run_left: 'loco', run_pistol: 'loco', run_right: 'loco', shoot_crouch: 'combat', shoot_pistol: 'combat',
    sprint: 'loco', sprint_back: 'loco', sprint_back_left: 'loco', sprint_back_right: 'loco', sprint_fwd_left: 'loco',
    sprint_fwd_right: 'loco', sprint_left: 'loco', sprint_right: 'loco', turn_left: 'loco', turn_right: 'loco',
    walk_back_left: 'loco', walk_back_right: 'loco', walk_fwd_left: 'loco', walk_fwd_right: 'loco',
    emote_salute: 'emotes', emote_danca: 'emotes', emote_breakdance_uprock: 'emotes', emote_capoeira_bencao: 'emotes',
  });
  const assertFamilyParity = (classifier, label) => {
    for (const [name, converter] of Object.entries(converterPackFamilies)) {
      const expected = converter === 'emotes' ? 'emote' : converter;
      if (classifier(name) !== expected) throw new Error(`${label}: family of ${name} is ${classifier(name)}, converter says ${expected}`);
    }
  };
  assertFamilyParity(clipFamily, 'Clip family mirror');
  console.log(`PASS Clip family mirror matches the converter's packFamily for ${Object.keys(converterPackFamilies).length} names`);
  try {
    assertFamilyParity(name => (name === 'hit_head' ? 'loco' : clipFamily(name)), 'Poisoned family mirror');
    throw new Error('Poisoned family mirror was not rejected');
  } catch (caught) {
    if (!/Poisoned family mirror: family of hit_head is loco, converter says combat/.test(caught.message)) {
      throw new Error(`Poisoned family mirror rejected for the wrong reason: ${caught.message}`);
    }
    console.log('PASS Poisoned family mirror rejected');
  }
  for (const state of requiredCharacterStates) {
    await expectRejection(`Missing required state ${state}`, new RegExp(`must have required property '${state}'`), { mutate: dropState(state) });
  }
  await expectRejection('Unknown animation state', /must NOT have additional properties/, {
    replace: { 'animations/dance.glb': clipGlb('dance') },
    mutate: manifest => { manifest.animations.dance = 'animations/dance.glb'; },
  });
  await expectRejection('Clip name differs from its state', /no animation named "jump"/, { replace: { 'animations/jump.glb': clipGlb('Jump') } });
  await expectRejection('Clip drives no meshy-28 bone', /drives no meshy-28 bone/, { replace: { 'animations/run.glb': clipGlb('run', { target: 'mixamorig:Hips' }) } });
  await expectRejection('Clip channel without target path', /animation "shoot" has an invalid channel/, { replace: { 'animations/shoot.glb': clipGlb('shoot', { path: null }) } });
  await expectRejection('Clip with only morph weights on a bone', /animation "walk" has an invalid channel/, { replace: { 'animations/walk.glb': clipGlb('walk', { path: 'weights' }) } });
  await expectRejection('Morph weights channel on a missing mesh', /animation "jump" has an invalid channel/, { replace: { 'animations/jump.glb': clipGlb('jump', { morph: 'missing-mesh' }) } });
  await expectRejection('Morph weights channel on a mesh without morph targets', /animation "idle" has an invalid channel/, { replace: { 'animations/idle.glb': clipGlb('idle', { morph: 'no-targets' }) } });
  await expectRejection('Clip without keyframes', /animation "death" has no keyframes/, { replace: { 'animations/death.glb': clipGlb('death', { keyframes: 0 }) } });
  await expectRejection('Clip output count differs from keyframes', /output values that do not match its rotation keyframes/, { replace: { 'animations/crouch.glb': clipGlb('crouch', { keyframes: 2, outputValues: 1 }) } });
  await expectRejection('State pointed at another state per-state file', /animations\/idle\.glb: no animation named "walk"/, {
    mutate: manifest => {
      manifest.animations.walk = manifest.animations.idle;
      manifest.files = manifest.files.filter(file => file.path !== 'animations/walk.glb');
    },
  });
  await expectRejection('Unknown extra clip name', /animations\.extra has an unknown clip name: moonwalk/, {
    replace: { 'animations/extra/moonwalk.glb': clipGlb('moonwalk') },
    mutate: manifest => { manifest.animations.extra.moonwalk = { file: 'animations/extra/moonwalk.glb', duration: 1, loop: false, rootMotion: false, source: 'Not in the vocabulary' }; },
  });
  await expectRejection('Extra clip name equal to a state', /unknown clip name: idle/, {
    mutate: manifest => { manifest.animations.extra.idle = manifest.animations.extra.strafe_left; },
  });
  await expectRejection('Bare emote prefix as an extra clip name', /unknown clip name: emote_/, {
    replace: { 'animations/extra/emote-puro.glb': clipGlb('emote_') },
    mutate: manifest => { manifest.animations.extra.emote_ = { file: 'animations/extra/emote-puro.glb', duration: 1, loop: false, rootMotion: false, source: 'Bare prefix' }; },
  });
  await expectRejection('Extra clip name outside the key pattern', /\/animations\/extra must match pattern "\^\[a-z\]\[a-z0-9_\]\{1,40\}\$"/, {
    replace: { 'animations/extra/Strafe-left.glb': clipGlb('strafe_left') },
    mutate: manifest => { manifest.animations.extra.Strafe_left = { file: 'animations/extra/Strafe-left.glb', duration: 1, loop: true, rootMotion: false, source: 'Uppercase key' }; },
  });
  await expectRejection('Family pack file missing from files', /Declared path is missing from files: animations\/extra\/loco\.glb/, {
    mutate: manifest => { manifest.files = manifest.files.filter(file => file.path !== 'animations/extra/loco.glb'); },
  });
  await expectRejection('Extra clip file shared with a state', /Duplicate declared path: animations\/idle\.glb \(animations\.idle and animations\.extra\.strafe_left\)/, {
    mutate: manifest => { manifest.animations.extra.strafe_left.file = manifest.animations.idle; },
  });
  await expectRejection('Extras counted in the byte budget', /over its \d+-byte budget/, {
    mutate: manifest => {
      const extraBytes = manifest.files.filter(file => file.path.startsWith('animations/extra/')).reduce((sum, file) => sum + file.bytes, 0);
      manifest.budgets.bytes = manifest.files.reduce((sum, file) => sum + file.bytes, 0) - extraBytes;
    },
  });
  await expectRejection('Extra clip misnamed inside its one-clip file', /animations\/extra\/sprint-fwd-left\.glb: no animation named "sprint_fwd_left"/, {
    replace: { 'animations/extra/sprint-fwd-left.glb': clipGlb('SprintFwdLeft') },
  });
  await expectRejection('Key missing inside the family pack', /animations\/extra\/loco\.glb: no animation named "walk_back"/, {
    replace: { 'animations/extra/loco.glb': clipsGlb(['strafe_left']) },
  });
  await expectRejection('Emote clip sharing a family-pack file', /emote clips keep one file per clip, but animations\/extra\/loco\.glb is shared by /, {
    mutate: manifest => { manifest.animations.extra.emote_danca.file = 'animations/extra/loco.glb'; },
  });
  await expectRejection('Emote clips sharing one file', /emote clips keep one file per clip/, {
    mutate: manifest => { manifest.animations.extra.emote_salute = { ...manifest.animations.extra.emote_danca, file: manifest.animations.extra.emote_danca.file }; },
  });
  await expectRejection('Declared family mismatching the clip name', /animations\.extra\.strafe_left declares family "combat" but its name belongs to "loco"/, {
    mutate: manifest => { manifest.animations.extra.strafe_left.family = 'combat'; },
  });
  await expectRejection('Family outside the contract enum', /animations\/extra\/strafe_left\/family must be equal to one of the allowed values/, {
    mutate: manifest => { manifest.animations.extra.strafe_left.family = 'states'; },
  });
  await expectRejection('Family pack mixing clip families', /animations\/extra\/loco\.glb mixes clip families \(loco and combat\)/, {
    mutate: manifest => { manifest.animations.extra.reload_rifle = { file: 'animations/extra/loco.glb', duration: 2, loop: false, rootMotion: false, source: 'Combat clip in a loco pack' }; },
  });
  await expectRejection('States pack missing one state clip', /animations\/states\.glb: no animation named "walkfire"/, {
    files: {
      'model/fixture-character.glb': modelGlb(),
      'previews/portrait.png': png,
      'animations/states.glb': clipsGlb(allStates.filter(state => state !== 'walkfire')),
      'animations/extra/loco.glb': clipsGlb(['strafe_left', 'walk_back']),
      'animations/extra/sprint-fwd-left.glb': clipGlb('sprint_fwd_left'),
      'animations/extra/emote-danca.glb': clipGlb('emote_danca'),
    },
    mutate: manifest => {
      for (const state of allStates) manifest.animations[state] = 'animations/states.glb';
    },
  });
  await expectRejection('Second buffer without the meshopt fallback marker', /GLB validation failed for animations\/extra\/loco\.glb: GLB must contain one self-contained buffer/, {
    replace: { 'animations/extra/loco.glb': meshoptClipsGlb(['strafe_left', 'walk_back'], { markFallback: false }) },
  });
  await expectRejection('Meshopt stream past the BIN chunk', /bufferView 1 has an out-of-bounds meshopt stream/, {
    replace: { 'animations/extra/loco.glb': meshoptClipsGlb(['strafe_left', 'walk_back'], { overshootStream: true }) },
  });
  await expectRejection('Extra clip file is not a GLB', /animations\/extra\/strafe_left\/file must match pattern/, {
    mutate: manifest => { manifest.animations.extra.strafe_left.file = 'animations/extra/strafe-left.gltf'; },
  });
  await expectRejection('Extra entry missing a required field', /animations\/extra\/strafe_left must have required property 'duration'/, {
    mutate: manifest => { delete manifest.animations.extra.strafe_left.duration; },
  });
  await expectRejection('Extra entry with a mistyped loop', /animations\/extra\/strafe_left\/loop must be boolean/, {
    mutate: manifest => { manifest.animations.extra.strafe_left.loop = 'yes'; },
  });
  await expectRejection('Extra entry with a non-numeric duration', /animations\/extra\/strafe_left\/duration must be number/, {
    mutate: manifest => { manifest.animations.extra.strafe_left.duration = '0.8'; },
  });

  await expectRejection('Wrong skeleton id', /\/skeleton must be equal to constant/, { mutate: manifest => { manifest.skeleton = 'mixamo-65'; } });
  const renamed = meshy28Joints.map(([name, parent]) => [name === 'LeftForeArm' ? 'LeftElbow' : name, parent === 'LeftForeArm' ? 'LeftElbow' : parent]);
  await expectRejection('Wrong skeleton bone name', /missing LeftForeArm<LeftArm.*unexpected LeftElbow<LeftArm/, { replace: { 'model/fixture-character.glb': modelGlb({ joints: renamed }) } });
  const reparented = meshy28Joints.map(([name, parent]) => [name, name === 'neck' ? 'Spine01' : parent]);
  await expectRejection('Reparented skeleton bone', /missing neck<Spine.*unexpected neck<Spine01/, { replace: { 'model/fixture-character.glb': modelGlb({ joints: reparented }) } });
  await expectRejection('Missing duplicated finger helper', /27 joints; missing Curl_L<LeftHand/, { replace: { 'model/fixture-character.glb': modelGlb({ joints: meshy28Joints.slice(0, 27) }) } });
  await expectRejection('Model without skin', /exactly one skin/, { replace: { 'model/fixture-character.glb': modelGlb({ skin: false }) } });
  await expectRejection('Skinned primitive without weights', /missing JOINTS_0 or WEIGHTS_0/, { replace: { 'model/fixture-character.glb': modelGlb({ weights: false }) } });
  await expectRejection('JOINTS_0 references a missing accessor', /missing JOINTS_0 or WEIGHTS_0/, { replace: { 'model/fixture-character.glb': modelGlb({ jointsAccessor: 999 }) } });
  await expectRejection('JOINTS_0 is not a joint VEC4', /JOINTS_0 must be an unsigned byte or short VEC4/, { replace: { 'model/fixture-character.glb': modelGlb({ jointsAccessor: 2 }) } });
  await expectRejection('JOINTS_0 value outside the skin', /JOINTS_0 vertex 0 references a joint outside the skin/, { replace: { 'model/fixture-character.glb': modelGlb({ jointValue: 28 }) } });
  await expectRejection('Triangle strip hiding triangles from the budget', /character primitives must be triangle lists/, {
    replace: { 'model/fixture-character.glb': modelGlb({ mode: 5 }) },
    mutate: manifest => { manifest.budgets.triangles = 1; },
  });
  const badMagic = Buffer.from(modelGlb());
  badMagic.writeUInt32LE(0x46546c68, 0);
  await expectRejection('Model with bad GLB magic', /invalid GLB 2 header/, { replace: { 'model/fixture-character.glb': badMagic } });
  const glbVersionOne = Buffer.from(modelGlb());
  glbVersionOne.writeUInt32LE(1, 4);
  await expectRejection('Model with GLB version 1', /invalid GLB 2 header/, { replace: { 'model/fixture-character.glb': glbVersionOne } });
  await expectRejection('Model path is not a GLB', /\/model must match pattern/, {
    replace: { 'model/fixture-character.gltf': modelGlb() },
    mutate: manifest => { manifest.model = 'model/fixture-character.gltf'; },
  });

  await expectRejection('Model over triangle budget', /12 triangles, over the 11-triangle budget/, { mutate: manifest => { manifest.budgets.triangles = 11; } });
  await expectRejection('Pack over byte budget', /declares \d+ bytes, over its 1024-byte budget/, { mutate: manifest => { manifest.budgets.bytes = 1024; } });
  await expectRejection('Byte budget enforced before hashing', /declares \d+ bytes, over its 1048576-byte budget/, {
    mutate: manifest => { manifest.files.find(file => file.path === manifest.model).bytes += 2097152; },
  });
  await expectRejection('Triangle budget above contract ceiling', /\/budgets\/triangles must be <= 15000/, { mutate: manifest => { manifest.budgets.triangles = 15001; } });
  await expectRejection('Missing budgets', /must have required property 'budgets'/, { mutate: manifest => { delete manifest.budgets; } });

  await expectRejection('Bad rights status', /\/rights\/status must be equal to one of the allowed values/, { mutate: manifest => { manifest.rights.status = 'fan-art'; } });
  await expectRejection('Rights without basis', /\/rights must have required property 'basis'/, { mutate: manifest => { delete manifest.rights.basis; } });
  await expectRejection('Missing rights', /must have required property 'rights'/, { mutate: manifest => { delete manifest.rights; } });

  await expectRejection('Missing previews', /must have required property 'previews'/, {
    mutate: manifest => {
      delete manifest.previews;
      manifest.files = manifest.files.filter(file => file.path !== 'previews/portrait.png');
    },
  });
  await expectRejection('Empty previews', /\/previews must NOT have fewer than 1 items/, { mutate: manifest => { manifest.previews = []; } });
  await expectRejection('Preview bytes are not an image', /Preview is not a valid \.png image/, { replace: { 'previews/portrait.png': Buffer.from('not an image, just text bytes') } });
  await expectRejection('Preview with non-image extension', /\/previews\/0 must match pattern/, {
    replace: { 'previews/portrait.gif': png },
    mutate: manifest => {
      manifest.previews = ['previews/portrait.gif'];
      manifest.files = manifest.files.filter(file => file.path !== 'previews/portrait.png');
    },
  });

  await expectRejection('Undeclared character file', /no character role declaration: evidence\/orphan.bin/, { replace: { 'evidence/orphan.bin': Buffer.from('orphan') } });
  await expectRejection('Declared clip absent from files', /Declared path is missing from files: animations\/idle.glb/, {
    mutate: manifest => { manifest.files = manifest.files.filter(file => file.path !== 'animations/idle.glb'); },
  });
  await expectRejection('Hash-mutated model', /SHA-256 mismatch: model\/fixture-character.glb/, {
    mutate: manifest => { manifest.files.find(file => file.path === manifest.model).sha256 = '0'.repeat(64); },
  });
  await expectRejection('Size-mutated clip', /Byte size mismatch: animations\/death.glb/, {
    mutate: manifest => { manifest.files.find(file => file.path === 'animations/death.glb').bytes += 4; },
  });
  console.log('PASS Character pack contract: valid fixture accepted and every mutant rejected');
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
