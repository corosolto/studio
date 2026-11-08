#!/usr/bin/env node
// Builds a tiny synthetic character pack (programmatic skinned GLB, no real asset bytes),
// proves it validates, then proves every contract mutant is rejected for the right reason.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { meshy28Joints, optionalCharacterStates, requiredCharacterStates } from '../lib/character-pack.mjs';
import { validatePack } from '../lib/pack.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const pad4 = bytes => Buffer.concat([bytes, Buffer.alloc((4 - (bytes.length % 4)) % 4)]);

function glb(document, chunks) {
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
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0', generator: 'coro-solto-studio character-pack-check' }, ...document, buffers: [{ byteLength: bin.length }], bufferViews: views }));
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

function clipGlb(name, { target = 'Hips', path: channelPath = 'rotation', keyframes = 2, outputValues = keyframes } = {}) {
  const nodes = skeletonNodes(meshy28Joints);
  if (target !== 'Hips') nodes.push({ name: target });
  const targetNode = nodes.findIndex(node => node.name === target);
  const input = keyframes ? [{ bufferView: 0, componentType: 5126, count: keyframes, type: 'SCALAR', min: [0], max: [keyframes - 1] }] : [{ componentType: 5126, count: 0, type: 'SCALAR' }];
  const output = outputValues ? [{ bufferView: keyframes ? 1 : 0, componentType: 5126, count: outputValues, type: 'VEC4' }] : [{ componentType: 5126, count: 0, type: 'VEC4' }];
  const chunks = [
    ...(keyframes ? [{ bytes: floats(Array.from({ length: keyframes }, (_, index) => index)) }] : []),
    ...(outputValues ? [{ bytes: floats(Array.from({ length: outputValues }, () => [0, 0, 0, 1]).flat()) }] : []),
  ];
  return glb({
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    animations: [{ name, channels: [{ sampler: 0, target: { node: targetNode, ...(channelPath ? { path: channelPath } : {}) } }], samplers: [{ input: 0, output: 1, interpolation: 'LINEAR' }] }],
    accessors: [...input, ...output],
  }, chunks);
}

const allStates = [...requiredCharacterStates, ...optionalCharacterStates];
function validFiles() {
  const files = { 'model/fixture-character.glb': modelGlb(), 'previews/portrait.png': png };
  for (const state of allStates) files[`animations/${state}.glb`] = clipGlb(state);
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
    animations: Object.fromEntries(allStates.map(state => [state, `animations/${state}.glb`])),
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

try {
  const valid = await validateCase();
  console.log(`PASS Valid synthetic character pack (${valid.character.triangles} triangles, ${valid.character.joints} meshy-28 joints, ${valid.character.animations} state clips)`);
  const requiredOnly = await validateCase({ mutate: manifest => optionalCharacterStates.forEach(state => dropState(state)(manifest)) });
  console.log(`PASS Valid character pack with only the ${requiredOnly.character.animations} required states`);

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
  await expectRejection('Clip without keyframes', /animation "death" has no keyframes/, { replace: { 'animations/death.glb': clipGlb('death', { keyframes: 0 }) } });
  await expectRejection('Clip output count differs from keyframes', /output values that do not match its rotation keyframes/, { replace: { 'animations/crouch.glb': clipGlb('crouch', { keyframes: 2, outputValues: 1 }) } });
  await expectRejection('Same clip declared for two states', /Duplicate declared path/, { mutate: manifest => { manifest.animations.walk = manifest.animations.idle; } });

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
