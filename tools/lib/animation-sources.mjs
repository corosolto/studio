// Source loaders for the animation conversion (docs/animation-conversion.md): Mixamo FBX
// (three.js FBXLoader, with or without skin), Quaternius UAL glTF and meshy-28 clip GLBs.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { uniqueJointNames } from './character-rig.mjs';
import { MIXAMO_TO_MESHY28, UAL_TO_MESHY28, gltfPoseSource, mixamoBaseName, objectPoseSource } from './animation-retarget.mjs';

export const RIG_MAPS = Object.freeze({
  mixamo: MIXAMO_TO_MESHY28,
  ual: UAL_TO_MESHY28,
  'meshy-28': Object.freeze(Object.fromEntries(uniqueJointNames.map((n) => [n, n]))),
});

/** Which source rig a list of bone names belongs to (null when none matches). */
export function detectRig(names) {
  const set = new Set(names);
  const base = new Set(names.map(mixamoBaseName));
  if (names.some((n) => /^mixamorig/.test(n)) || (base.has('Spine2') && base.has('LeftUpLeg'))) return 'mixamo';
  if (set.has('pelvis') && set.has('spine_01') && set.has('upperarm_l')) return 'ual';
  if (set.has('Hips') && set.has('Spine02') && set.has('LeftUpLeg')) return 'meshy-28';
  return null;
}

/** The longest non-empty take of an FBX/three.js group (Mixamo files add an empty "Take 001"). */
export function pickClip(animations, take) {
  if (take) {
    const named = animations.find((a) => a.name === take);
    if (!named) throw new Error(`take ${take} not found (have ${animations.map((a) => a.name).join(', ')})`);
    return named;
  }
  return [...animations].filter((a) => a.tracks.length).sort((a, b) => b.duration * b.tracks.length - a.duration * a.tracks.length)[0] || null;
}

/**
 * Byte offset where the top-level node list of a binary FBX ends (before its null record), or
 * null for ASCII files. Each node record: end offset, property count, property bytes (u32, or
 * u64 from version 7500), a name length byte and the name; a zero end offset closes a list.
 */
export function fbxNodeListEnd(bytes) {
  if (bytes.subarray(0, 18).toString('latin1') !== 'Kaydara FBX Binary') return null;
  const big = bytes.readUInt32LE(23) >= 7500;
  let pos = 27;
  for (;;) {
    const end = big ? Number(bytes.readBigUInt64LE(pos)) : bytes.readUInt32LE(pos);
    if (end === 0 || end > bytes.length) return pos;
    pos = end;
  }
}

/**
 * Parse an FBX file with three's FBXLoader (embedded textures are irrelevant and silenced).
 * FBXLoader decides where the node list stops from the footer size (the last 160 + 16 bytes);
 * some Mixamo exports carry a different footer and it then reads the footer as a node
 * ("Unknown property type"). Those are re-parsed with the footer replaced by 176 zero bytes
 * right after the last top-level node, which is what the loader's heuristic expects.
 */
export function parseFbx(file) {
  const bytes = readFileSync(file);
  const warn = console.warn;
  console.warn = () => {};
  const parse = (b) => new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  try {
    return parse(bytes);
  } catch (error) {
    const end = /Unknown property type/.test(error.message) ? fbxNodeListEnd(bytes) : null;
    if (end == null) throw error;
    return parse(Buffer.concat([bytes.subarray(0, end), Buffer.alloc(176)]));
  } finally {
    console.warn = warn;
  }
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/**
 * Open one source clip: { source (pose source), rig, take, file }.
 * FBX: Mixamo rig. glTF/GLB: UAL or meshy-28 rig, `action` selects the animation by name
 * (default: the first). `rig` overrides detection.
 */
export async function openSource(file, { action, take, rig } = {}) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.fbx') {
    const group = parseFbx(file);
    const names = [];
    group.traverse((o) => names.push(o.name));
    const kind = rig || detectRig(names);
    if (!RIG_MAPS[kind]) throw new Error(`${file}: unknown source rig (bones ${names.slice(0, 6).join(', ')}…)`);
    const clip = pickClip(group.animations, take);
    if (!clip) throw new Error(`${file}: no animation`);
    return { file, rig: kind, take: clip.name, source: objectPoseSource(group, clip, RIG_MAPS[kind]) };
  }
  if (ext === '.glb' || ext === '.gltf') {
    const doc = await io.read(file);
    const kind = rig || detectRig(doc.getRoot().listNodes().map((n) => n.getName()));
    if (!RIG_MAPS[kind]) throw new Error(`${file}: unknown source rig`);
    const animations = doc.getRoot().listAnimations();
    const animation = action ? animations.find((a) => a.getName() === action) : animations[0];
    if (!animation) throw new Error(`${file}: animation ${action ?? '(first)'} not found${action ? ` (have ${animations.length})` : ''}`);
    return { file, rig: kind, take: animation.getName(), doc, source: gltfPoseSource(doc, animation, RIG_MAPS[kind]) };
  }
  throw new Error(`${file}: unsupported source format ${ext}`);
}

/** Animation names of a glTF/GLB source with durations (for --list). */
export async function listActions(file) {
  const doc = await io.read(file);
  return doc.getRoot().listAnimations().map((a) => ({
    name: a.getName(),
    duration: +Math.max(0, ...a.listSamplers().map((s) => s.getInput().getMax([])[0])).toFixed(3),
  }));
}
