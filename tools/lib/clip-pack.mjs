// Per-character clip packs (docs/animation-conversion.md#packs): many meshy-28 clip GLBs baked on
// one rig, merged into one GLB with one animation per clip, keyframes resampled and rotations
// stored as normalized int16 quaternions. Both are core glTF 2.0 (animation sampler outputs for
// rotation may be normalized SHORT), which three.js's GLTFLoader dequantizes itself: no decoder
// or extension is needed in the client.
import { Document } from '@gltf-transform/core';
import { dedup, resample } from '@gltf-transform/functions';
import { accessorFloats } from './character-rig.mjs';

/** Keyframe removal tolerance of resample() (value units: quaternion components; cm for the hips under the 0.01 Armature). */
export const PACK_RESAMPLE_TOLERANCE = 1e-4;
const INT16 = 32767;

/**
 * Merge `clips` ([{ name, doc }], each a clip GLB document over the same skeleton) into one
 * document: the first clip's nodes, one animation per clip renamed to `name`, its extras kept.
 * With `compress`, redundant keys are dropped (resample, PACK_RESAMPLE_TOLERANCE), identical
 * accessors shared (dedup) and rotation outputs written as normalized int16.
 */
export async function packClips(clips, { compress = true, tolerance = PACK_RESAMPLE_TOLERANCE } = {}) {
  if (!clips.length) throw new Error('nothing to pack');
  const out = new Document();
  const buffer = out.createBuffer();
  const scene = out.createScene('scene');
  const nodeByName = new Map();
  const first = clips[0].doc;
  const parentOf = new Map();
  for (const n of first.getRoot().listNodes()) for (const c of n.listChildren()) parentOf.set(c, n);
  const copy = (n) => {
    const m = out.createNode(n.getName()).setTranslation(n.getTranslation()).setRotation(n.getRotation()).setScale(n.getScale());
    if (!nodeByName.has(n.getName())) nodeByName.set(n.getName(), m);
    for (const c of n.listChildren()) m.addChild(copy(c));
    return m;
  };
  for (const n of first.getRoot().listNodes()) if (!parentOf.has(n) && !n.getMesh()) scene.addChild(copy(n));
  for (const { name, doc } of clips) {
    const source = doc.getRoot().listAnimations()[0];
    if (!source) throw new Error(`${name}: no animation`);
    const anim = out.createAnimation(name).setExtras(source.getExtras());
    for (const ch of source.listChannels()) {
      const target = nodeByName.get(ch.getTargetNode()?.getName());
      if (!target) throw new Error(`${name}: channel on ${ch.getTargetNode()?.getName()}, a node the first clip lacks`);
      const s = ch.getSampler();
      const sampler = out.createAnimationSampler().setInterpolation(s.getInterpolation())
        .setInput(out.createAccessor().setType('SCALAR').setArray(Float32Array.from(s.getInput().getArray())).setBuffer(buffer))
        .setOutput(out.createAccessor().setType(s.getOutput().getType()).setArray(Float32Array.from(accessorFloats(s.getOutput()))).setBuffer(buffer));
      anim.addSampler(sampler);
      anim.addChannel(out.createAnimationChannel().setTargetNode(target).setTargetPath(ch.getTargetPath()).setSampler(sampler));
    }
  }
  if (compress) {
    await out.transform(resample({ tolerance }), dedup({ propertyTypes: ['Accessor'] }));
    for (const anim of out.getRoot().listAnimations()) {
      for (const ch of anim.listChannels()) {
        if (ch.getTargetPath() !== 'rotation') continue;
        const output = ch.getSampler().getOutput();
        if (output.getNormalized()) continue; // shared by dedup, already quantized
        output.setArray(Int16Array.from(output.getArray(), (v) => Math.round(Math.max(-1, Math.min(1, v)) * INT16))).setNormalized(true);
      }
    }
  }
  return out;
}

/** Clip names of a pack, in order. */
export const packClipNames = (doc) => doc.getRoot().listAnimations().map((a) => a.getName());

/**
 * One clip of a pack as its own clip document (nodes, that animation, data as stored: a packed
 * clip is measured exactly as the client will read it).
 */
export function unpackClip(doc, name) {
  const source = doc.getRoot().listAnimations().find((a) => a.getName() === name);
  if (!source) throw new Error(`pack has no clip ${name}`);
  const out = new Document();
  const buffer = out.createBuffer();
  const scene = out.createScene('scene');
  const map = new Map();
  const parentOf = new Map();
  for (const n of doc.getRoot().listNodes()) for (const c of n.listChildren()) parentOf.set(c, n);
  const copy = (n) => {
    const m = out.createNode(n.getName()).setTranslation(n.getTranslation()).setRotation(n.getRotation()).setScale(n.getScale());
    map.set(n, m);
    for (const c of n.listChildren()) m.addChild(copy(c));
    return m;
  };
  for (const n of doc.getRoot().listNodes()) if (!parentOf.has(n)) scene.addChild(copy(n));
  const anim = out.createAnimation(name).setExtras(source.getExtras());
  for (const ch of source.listChannels()) {
    const s = ch.getSampler();
    const sampler = out.createAnimationSampler().setInterpolation(s.getInterpolation())
      .setInput(out.createAccessor().setType('SCALAR').setArray(s.getInput().getArray().slice()).setBuffer(buffer))
      .setOutput(out.createAccessor().setType(s.getOutput().getType()).setArray(s.getOutput().getArray().slice()).setNormalized(s.getOutput().getNormalized()).setBuffer(buffer));
    anim.addSampler(sampler);
    anim.addChannel(out.createAnimationChannel().setTargetNode(map.get(ch.getTargetNode())).setTargetPath(ch.getTargetPath()).setSampler(sampler));
  }
  return out;
}
