import { open } from 'node:fs/promises';
import { inspectGlb, readAccessorComponent, readGlb } from './glb-inspect.mjs';

export const requiredCharacterStates = Object.freeze(['idle', 'walk', 'run', 'shoot', 'death', 'crouch', 'crouchwalk', 'jump']);
export const optionalCharacterStates = Object.freeze(['idle1h', 'walk1h', 'walkfire']);

// Optional named clips a pack may carry beyond the states, as `animations.extra` entries.
// Fixed names for locomotion, weapon handling, damage reactions, melee and round outcomes,
// plus free-form emotes under the `emote_` prefix (at least one character after the prefix).
// State names are never valid extra names, so the two key spaces stay disjoint.
export const extraClipNames = Object.freeze([
  'strafe_left', 'strafe_right', 'walk_back', 'run_back',
  'strafe_left_pistol', 'strafe_right_pistol', 'walk_back_pistol',
  'reload_rifle', 'reload_pistol', 'draw_rifle', 'holster_rifle', 'draw_pistol', 'holster_pistol',
  'hit_front', 'hit_back', 'hit_left', 'hit_right', 'hit_head',
  'grenade_throw', 'knife_idle', 'knife_stab', 'victory', 'defeat',
]);
export const extraClipPrefixes = Object.freeze(['emote_']);

export function isExtraClipName(name) {
  return extraClipNames.includes(name)
    || extraClipPrefixes.some(prefix => name.length > prefix.length && name.startsWith(prefix));
}

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
  for (const [state, file] of Object.entries(manifest.animations || {})) {
    if (state === 'extra') continue;
    entries.push({ role: `animations.${state}`, path: file });
  }
  entries.push(...characterExtraEntries(manifest));
  for (const role of ['previews', 'evidence']) {
    for (const file of manifest[role] || []) entries.push({ role, path: file });
  }
  return entries;
}

// Extra-clip role entries. This is also the structural gate that rejects names outside the
// vocabulary (bare prefixes, state names, anything else) during validateManifestStructure,
// before any payload is hashed.
export function characterExtraEntries(manifest) {
  const extras = manifest.animations?.extra;
  if (extras === undefined) return [];
  if (typeof extras !== 'object' || Array.isArray(extras)) throw new Error('animations.extra must be an object keyed by extra clip name');
  const entries = [];
  for (const [name, entry] of Object.entries(extras)) {
    if (!isExtraClipName(name)) throw new Error(`animations.extra has an unknown clip name: ${name}`);
    entries.push({ role: `animations.extra.${name}`, path: entry?.file });
  }
  return entries;
}

const pairKey = ([name, parent]) => `${name}<${parent ?? ''}`;

function multiset(pairs) {
  const counts = new Map();
  for (const pair of pairs) counts.set(pairKey(pair), (counts.get(pairKey(pair)) || 0) + 1);
  return counts;
}

function assertSkinAttributes(document, bin, label, primitive, jointCount) {
  const position = document.accessors[primitive.attributes?.POSITION];
  const joints = document.accessors[primitive.attributes?.JOINTS_0];
  const weights = document.accessors[primitive.attributes?.WEIGHTS_0];
  if (!joints || !weights) throw new Error(`${label}: skinned primitive is missing JOINTS_0 or WEIGHTS_0`);
  if (joints.type !== 'VEC4' || ![5121, 5123].includes(joints.componentType) || joints.count !== position.count) {
    throw new Error(`${label}: JOINTS_0 must be an unsigned byte or short VEC4 per vertex`);
  }
  const normalizedWeights = [5121, 5123].includes(weights.componentType) && weights.normalized === true;
  if (weights.type !== 'VEC4' || (weights.componentType !== 5126 && !normalizedWeights) || weights.count !== position.count) {
    throw new Error(`${label}: WEIGHTS_0 must be a float or normalized VEC4 per vertex`);
  }
  for (let vertex = 0; vertex < joints.count; vertex += 1) {
    for (let component = 0; component < 4; component += 1) {
      if (readAccessorComponent(document, bin, label, joints, vertex, component) >= jointCount) {
        throw new Error(`${label}: JOINTS_0 vertex ${vertex} references a joint outside the skin`);
      }
    }
  }
}

function assertMeshy28Skin(document, bin, label) {
  const nodes = Array.isArray(document.nodes) ? document.nodes : [];
  if (!Array.isArray(document.skins) || document.skins.length !== 1) throw new Error(`${label}: character model must contain exactly one skin`);
  const [skin] = document.skins;
  if (!Array.isArray(skin.joints) || skin.joints.some(index => !Number.isInteger(index) || !nodes[index]) || new Set(skin.joints).size !== skin.joints.length) {
    throw new Error(`${label}: skin joints must be unique valid node indices`);
  }
  const inverseBind = document.accessors[skin.inverseBindMatrices];
  if (!inverseBind || inverseBind.type !== 'MAT4' || inverseBind.componentType !== 5126 || inverseBind.count !== skin.joints.length) {
    throw new Error(`${label}: inverseBindMatrices must be one float MAT4 per joint`);
  }
  const skinnedMeshNodes = nodes.filter(node => node.skin !== undefined);
  if (!skinnedMeshNodes.length) throw new Error(`${label}: no node binds a mesh to the skin`);
  for (const node of skinnedMeshNodes) {
    if (node.skin !== 0 || !document.meshes[node.mesh]) throw new Error(`${label}: skinned node must reference skin 0 and a valid mesh`);
    for (const primitive of document.meshes[node.mesh].primitives) assertSkinAttributes(document, bin, label, primitive, skin.joints.length);
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

const channelOutputTypes = { translation: 'VEC3', rotation: 'VEC4', scale: 'VEC3', weights: 'SCALAR' };

function assertStateAnimation(document, state, label) {
  const animation = (document.animations || []).find(candidate => candidate.name === state);
  if (!animation) throw new Error(`${label}: no animation named "${state}"`);
  const nodes = Array.isArray(document.nodes) ? document.nodes : [];
  if (!Array.isArray(animation.channels) || !animation.channels.length || !Array.isArray(animation.samplers)) {
    throw new Error(`${label}: animation "${state}" has no channels`);
  }
  for (const sampler of animation.samplers) {
    if (!document.accessors[sampler.input] || !document.accessors[sampler.output]) throw new Error(`${label}: animation "${state}" has an invalid sampler`);
  }
  for (const channel of animation.channels) {
    const sampler = animation.samplers[channel.sampler];
    const outputType = channelOutputTypes[channel.target?.path];
    const target = nodes[channel.target?.node];
    // Morph `weights` animate the target mesh's morph targets, never the skeleton.
    const morphTargets = channel.target?.path === 'weights' ? document.meshes?.[target?.mesh]?.primitives?.[0]?.targets?.length ?? 0 : 1;
    if (!sampler || !target || !outputType || morphTargets < 1) {
      throw new Error(`${label}: animation "${state}" has an invalid channel`);
    }
    const input = document.accessors[sampler.input];
    const output = document.accessors[sampler.output];
    const interpolation = sampler.interpolation ?? 'LINEAR';
    if (!['LINEAR', 'STEP', 'CUBICSPLINE'].includes(interpolation)) throw new Error(`${label}: animation "${state}" has an invalid interpolation`);
    if (input.type !== 'SCALAR' || input.componentType !== 5126 || input.count < 1) throw new Error(`${label}: animation "${state}" has no keyframes`);
    const normalizedOutput = ['rotation', 'weights'].includes(channel.target.path) && [5120, 5121, 5122, 5123].includes(output.componentType) && output.normalized === true;
    const expectedOutputs = input.count * (interpolation === 'CUBICSPLINE' ? 3 : 1) * morphTargets;
    if (output.type !== outputType || (output.componentType !== 5126 && !normalizedOutput) || output.count !== expectedOutputs) {
      throw new Error(`${label}: animation "${state}" has output values that do not match its ${channel.target.path} keyframes`);
    }
  }
  if (!animation.channels.some(channel => channel.target.path !== 'weights' && meshy28BoneNames.has(nodes[channel.target.node].name))) {
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

// Sum of declared payload bytes, compared with `budgets.bytes` before anything is hashed.
export function characterDeclaredBytes(manifest) {
  return manifest.files.reduce((sum, file) => sum + file.bytes, 0);
}

// Reads every declared character file as data only: GLB containers are parsed and bounds
// checked, nothing is loaded into a renderer or executed. The byte budget is enforced
// earlier, by validateManifestStructure, before any payload is hashed.
export async function validateCharacterPack(manifest, absolutes) {
  const model = await inspectGlb(absolutes.get(manifest.model), manifest.model, { includeBin: true });
  for (const mesh of model.document.meshes) {
    if (mesh.primitives.some(primitive => (primitive.mode ?? 4) !== 4)) throw new Error(`${manifest.model}: character primitives must be triangle lists (mode 4)`);
  }
  assertMeshy28Skin(model.document, model.bin, manifest.model);
  if (model.triangles > manifest.budgets.triangles) {
    throw new Error(`${manifest.model}: ${model.triangles} triangles, over the ${manifest.budgets.triangles}-triangle budget`);
  }

  for (const [state, file] of Object.entries(manifest.animations)) {
    if (state === 'extra') continue;
    const { document } = await readGlb(absolutes.get(file), file);
    assertStateAnimation(document, state, file);
  }
  for (const [name, entry] of Object.entries(manifest.animations.extra || {})) {
    const { document } = await readGlb(absolutes.get(entry.file), entry.file);
    assertStateAnimation(document, name, entry.file);
  }
  for (const file of manifest.previews) await assertImage(file, absolutes.get(file));
  const states = Object.keys(manifest.animations).filter(key => key !== 'extra').length;
  return {
    triangles: model.triangles,
    bytes: characterDeclaredBytes(manifest),
    joints: meshy28Joints.length,
    animations: states,
    extraClips: Object.keys(manifest.animations.extra || {}).length,
  };
}
