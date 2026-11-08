import { open } from 'node:fs/promises';
import { inspectGlb, readGlb } from './glb-inspect.mjs';

export const requiredCharacterStates = Object.freeze(['idle', 'walk', 'run', 'shoot', 'death', 'crouch', 'crouchwalk', 'jump']);
export const optionalCharacterStates = Object.freeze(['idle1h', 'walk1h', 'walkfire']);

// The shared Meshy humanoid skeleton every runtime clip is baked against: skin joint order
// and the nearest joint ancestor of each joint (null for the root). Derived from the client
// donor `public/models/characters/mst.glb` and the 37 offline-rigged lote30 characters; the
// two finger helpers `Curl_R` and `Curl_L` appear twice each, so names alone are not unique.
export const meshy28Joints = Object.freeze([
  ['Hips', null],
  ['LeftUpLeg', 'Hips'], ['LeftLeg', 'LeftUpLeg'], ['LeftFoot', 'LeftLeg'], ['LeftToeBase', 'LeftFoot'],
  ['RightUpLeg', 'Hips'], ['RightLeg', 'RightUpLeg'], ['RightFoot', 'RightLeg'], ['RightToeBase', 'RightFoot'],
  ['Spine02', 'Hips'], ['Spine01', 'Spine02'], ['Spine', 'Spine01'],
  ['LeftShoulder', 'Spine'], ['LeftArm', 'LeftShoulder'], ['LeftForeArm', 'LeftArm'], ['LeftHand', 'LeftForeArm'],
  ['RightShoulder', 'Spine'], ['RightArm', 'RightShoulder'], ['RightForeArm', 'RightArm'], ['RightHand', 'RightForeArm'],
  ['neck', 'Spine'], ['Head', 'neck'], ['head_end', 'Head'], ['headfront', 'Head'],
  ['Curl_R', 'RightHand'], ['Curl_L', 'LeftHand'], ['Curl_R', 'RightHand'], ['Curl_L', 'LeftHand'],
].map(pair => Object.freeze(pair)));

const meshy28BoneNames = new Set(meshy28Joints.map(([name]) => name));
const imageMagic = [
  { extensions: ['.png'], matches: bytes => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { extensions: ['.jpg', '.jpeg'], matches: bytes => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { extensions: ['.webp'], matches: bytes => bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP' },
];

export function characterRoleEntries(manifest) {
  if (manifest.kind !== 'character') return [];
  const entries = [{ role: 'model', path: manifest.model }];
  for (const [state, file] of Object.entries(manifest.animations || {})) entries.push({ role: `animations.${state}`, path: file });
  for (const role of ['previews', 'evidence']) {
    for (const file of manifest[role] || []) entries.push({ role, path: file });
  }
  return entries;
}

const pairKey = ([name, parent]) => `${name}<${parent ?? ''}`;

function multiset(pairs) {
  const counts = new Map();
  for (const pair of pairs) counts.set(pairKey(pair), (counts.get(pairKey(pair)) || 0) + 1);
  return counts;
}

function assertMeshy28Skin(document, label) {
  const nodes = Array.isArray(document.nodes) ? document.nodes : [];
  if (!Array.isArray(document.skins) || document.skins.length !== 1) throw new Error(`${label}: character model must contain exactly one skin`);
  const [skin] = document.skins;
  const skinnedMeshNodes = nodes.filter(node => node.skin !== undefined);
  if (!skinnedMeshNodes.length) throw new Error(`${label}: no node binds a mesh to the skin`);
  for (const node of skinnedMeshNodes) {
    if (node.skin !== 0 || !document.meshes[node.mesh]) throw new Error(`${label}: skinned node must reference skin 0 and a valid mesh`);
    for (const primitive of document.meshes[node.mesh].primitives) {
      if (primitive.attributes?.JOINTS_0 === undefined || primitive.attributes?.WEIGHTS_0 === undefined) {
        throw new Error(`${label}: skinned primitive is missing JOINTS_0 or WEIGHTS_0`);
      }
    }
  }
  if (!Array.isArray(skin.joints) || skin.joints.some(index => !Number.isInteger(index) || !nodes[index]) || new Set(skin.joints).size !== skin.joints.length) {
    throw new Error(`${label}: skin joints must be unique valid node indices`);
  }
  const inverseBind = document.accessors[skin.inverseBindMatrices];
  if (!inverseBind || inverseBind.type !== 'MAT4' || inverseBind.componentType !== 5126 || inverseBind.count !== skin.joints.length) {
    throw new Error(`${label}: inverseBindMatrices must be one float MAT4 per joint`);
  }

  const parents = new Map();
  for (const [index, node] of nodes.entries()) {
    for (const child of node.children || []) {
      if (parents.has(child)) throw new Error(`${label}: node ${child} has more than one parent`);
      parents.set(child, index);
    }
  }
  const jointSet = new Set(skin.joints);
  const actual = skin.joints.map(joint => {
    const seen = new Set([joint]);
    let ancestor = parents.get(joint);
    while (ancestor !== undefined && !jointSet.has(ancestor)) {
      if (seen.has(ancestor)) throw new Error(`${label}: node hierarchy contains a cycle`);
      seen.add(ancestor);
      ancestor = parents.get(ancestor);
    }
    return [nodes[joint].name ?? '', ancestor === undefined ? null : nodes[ancestor].name ?? ''];
  });
  const expected = multiset(meshy28Joints);
  const observed = multiset(actual);
  const missing = [...expected].filter(([key, count]) => (observed.get(key) || 0) < count).map(([key]) => key);
  const unexpected = [...observed].filter(([key, count]) => (expected.get(key) || 0) < count).map(([key]) => key);
  if (skin.joints.length !== meshy28Joints.length || missing.length || unexpected.length) {
    throw new Error(`${label}: skin is not meshy-28 (${skin.joints.length} joints; missing ${missing.join(', ') || 'none'}; unexpected ${unexpected.join(', ') || 'none'})`);
  }
}

function assertStateAnimation(document, state, label) {
  const animation = (document.animations || []).find(candidate => candidate.name === state);
  if (!animation) throw new Error(`${label}: no animation named "${state}"`);
  const nodes = Array.isArray(document.nodes) ? document.nodes : [];
  if (!Array.isArray(animation.channels) || !animation.channels.length || !Array.isArray(animation.samplers)) {
    throw new Error(`${label}: animation "${state}" has no channels`);
  }
  for (const channel of animation.channels) {
    if (!animation.samplers[channel.sampler] || !nodes[channel.target?.node]) throw new Error(`${label}: animation "${state}" has an invalid channel`);
  }
  for (const sampler of animation.samplers) {
    if (!document.accessors[sampler.input] || !document.accessors[sampler.output]) throw new Error(`${label}: animation "${state}" has an invalid sampler`);
  }
  if (!animation.channels.some(channel => meshy28BoneNames.has(nodes[channel.target.node].name))) {
    throw new Error(`${label}: animation "${state}" drives no meshy-28 bone`);
  }
}

async function assertImage(file, absolute) {
  const handle = await open(absolute, 'r');
  try {
    const bytes = Buffer.alloc(12);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    const extension = file.slice(file.lastIndexOf('.')).toLowerCase();
    const format = imageMagic.find(candidate => candidate.extensions.includes(extension));
    if (bytesRead < 12 || !format?.matches(bytes)) throw new Error(`Preview is not a valid ${extension} image: ${file}`);
  } finally {
    await handle.close();
  }
}

// Reads every declared character file as data only: GLB containers are parsed and bounds
// checked, nothing is loaded into a renderer or executed.
export async function validateCharacterPack(manifest, absolutes) {
  const totalBytes = manifest.files.reduce((sum, file) => sum + file.bytes, 0);
  if (totalBytes > manifest.budgets.bytes) throw new Error(`Character pack is ${totalBytes} bytes, over its ${manifest.budgets.bytes}-byte budget`);

  const model = await inspectGlb(absolutes.get(manifest.model), manifest.model);
  assertMeshy28Skin(model.document, manifest.model);
  if (model.triangles > manifest.budgets.triangles) {
    throw new Error(`${manifest.model}: ${model.triangles} triangles, over the ${manifest.budgets.triangles}-triangle budget`);
  }

  for (const [state, file] of Object.entries(manifest.animations)) {
    const { document } = await readGlb(absolutes.get(file), file);
    assertStateAnimation(document, state, file);
  }
  for (const file of manifest.previews) await assertImage(file, absolutes.get(file));
  return { triangles: model.triangles, bytes: totalBytes, joints: meshy28Joints.length, animations: Object.keys(manifest.animations).length };
}
