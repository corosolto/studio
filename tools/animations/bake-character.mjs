#!/usr/bin/env node
// Bake meshy-28 reference clips onto one character's meshy-28 rig (docs/animation-conversion.md).
//
//   node tools/animations/bake-character.mjs --model=<character.glb> --clips=<reference dir> --out=<dir> [--states=<a,b>]
//
// Port of the client's tools/retarget-glb.mjs: legs, spine, clavicles, neck and head take the
// clip's world-rotation DELTAS (they keep the character's own rest offsets, so bone lengths
// and a crouched or bent rest pose survive); LeftArm/ForeArm/Hand and their right twins copy
// the clip's ABSOLUTE world rotation (an A-pose rig would otherwise hold every clip 30-40°
// off); Curl_* are never animated (the client writes the grip curl there). The Hips track is
// the clip's displacement scaled by the hips-height ratio; the reference clip is already in
// place, so its sway is kept and its root-motion metadata (velocity, contactSlide) is scaled
// the same way. Leg directions follow the reference's (rest alignment), the hips height keeps
// the lowest foot joint where the clip has it, two-bone IK pins the ankles inside the clip's
// contact windows (extras.clip.contacts), and a mesh-aware floor clamp keeps heels, toes, hands
// and knees above the floor (docs/animation-conversion.md). --no-foot-contact, --no-foot-ik,
// --no-floor-clamp and --no-limb-align switch those off. Works on clips without metadata too
// (the client's shared pack): contacts are then detected on the clip itself. Legacy client rigs
// (24 to 28 joints, meshy-28 names, optional Curl_*, Curl_*_Tip and neutral_bone helpers) bake
// as they are: joints match by name, helpers stay at rest and are listed in bakedFor.unanimated.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CLIP_FPS, FLOOR_CLAMP_REGIONS, clampToFloor, clipMetadata, closeLoop, holdTwoHandGrip, gltfPoseSource, retargetClip, skeletonGraph, writeClipDocument } from '../lib/animation-retarget.mjs';
import { RIG_MAPS } from '../lib/animation-sources.mjs';
import { loadRig } from '../lib/character-rig.mjs';
import { TWO_HAND_HOLDS } from '../lib/clip-qa.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const model = flag('model'), clipsDir = flag('clips'), outDir = flag('out');
if (!model || !clipsDir || !outDir) {
  console.error('usage: bake-character.mjs --model=<character.glb> --clips=<reference dir> --out=<dir> [--states=<a,b>] [--no-foot-contact] [--no-foot-ik] [--no-floor-clamp] [--no-limb-align] [--no-grip] [--passive-knees]');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const modelDoc = await io.read(model);
const target = skeletonGraph(modelDoc);
const rig = loadRig(modelDoc);
const states = flag('states')?.split(',').filter(Boolean)
  || readdirSync(clipsDir).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4)).sort();

// Skin joints a clip never drives: the runtime-only Curl_* and any non-meshy-28 helper of a
// legacy rig (Curl_*_Tip, neutral_bone); they stay at rest. Reported once per model.
const skinJoints = [...new Set(rig.names)];
const unanimated = (result) => skinJoints.filter((n) => !result.mapped.includes(n));
let reported = false;
/* The root velocity an in-place reference clip removed, at this character's scale (the IK keeps
   world-fixed contacts in the clip's moving frame with it). */
const inPlaceVelocity = (meta, tgt, src) => {
  const rm = meta.rootMotion;
  if (!rm?.extracted || rm.mode !== 'in-place') return [0, 0];
  const scale = tgt.byName.get('Hips').restWorldP.y / src.rest().get('Hips').p.y;
  return rm.velocity.map((v) => v * scale);
};
const baked = [];
for (const state of states) {
  const doc = await io.read(path.join(clipsDir, `${state}.glb`));
  const animation = doc.getRoot().listAnimations()[0];
  if (!animation) throw new Error(`${state}: no animation`);
  const meta = clipMetadata(doc);
  const source = gltfPoseSource(doc, animation, RIG_MAPS['meshy-28']);
  const result = retargetClip(source, target, { fps: meta.fps || CLIP_FPS, rootMotion: 'keep', absoluteArms: true, footContact: !args.includes('--no-foot-contact'), footIk: !args.includes('--no-foot-ik'), contacts: meta.contacts || null, loop: Boolean(meta.loop), inPlaceVelocity: inPlaceVelocity(meta, target, source), alignLimbs: args.includes('--no-limb-align') ? [] : undefined });
  const scale = (v) => +(v * result.hipsScale).toFixed(4);
  // --passive-knees: shins never lift the body (a rig with a tail or a robe skinned to a shin, or
  // a bent-leg mascot whose shins meet the floor, would otherwise be hoisted); recorded in
  // bakedFor.passiveRegions so the QA gate reports them as the rig's instead of gating them.
  const regions = args.includes('--passive-knees') ? FLOOR_CLAMP_REGIONS.map((r) => (r.name === 'knee' ? { ...r, lift: false, passive: true } : r)) : FLOOR_CLAMP_REGIONS;
  const floorClamp = args.includes('--no-floor-clamp') ? null : clampToFloor(rig, result, { clearance: meta.footClearance?.map(scale), regions, contacts: result.contacts });
  // Two-handed holds: the support hand stays on the weapon (--no-grip switches it off).
  const grip = TWO_HAND_HOLDS.includes(meta.hold) && !args.includes('--no-grip') ? holdTwoHandGrip(rig, result) : null;
  if (meta.loop) closeLoop(result);
  const rm = meta.rootMotion;
  const frames = result.times.length;
  const extras = {
    ...meta, fps: meta.fps || CLIP_FPS, frames, duration: +result.times[frames - 1].toFixed(4),
    contactSlide: meta.contactSlide != null ? scale(meta.contactSlide) : undefined,
    footClearance: meta.footClearance ? meta.footClearance.map(scale) : undefined,
    rootMotion: rm ? { ...rm, displacement: rm.displacement.map(scale), velocity: rm.velocity.map(scale), speed: scale(rm.speed) } : undefined,
    bakedFor: { model: path.basename(model), hipsScale: +result.hipsScale.toFixed(6), joints: result.mapped.length, unanimated: unanimated(result), footContact: result.contactCorrection, footIk: result.ik, floorClamp, grip, passiveRegions: args.includes('--passive-knees') ? ['knee'] : [], alignedLimbs: result.aligned },
  };
  await io.write(path.join(outDir, `${state}.glb`), writeClipDocument(target, result, state, extras));
  if (!reported) { console.log(`skin joints left at rest: ${unanimated(result).join(', ') || 'none'}`); reported = true; }
  baked.push({ name: state, frames, duration: extras.duration, joints: result.mapped.length, hipsScale: extras.bakedFor.hipsScale, rootSpeed: extras.rootMotion?.speed ?? null });
  console.log(`ok ${state}: ${frames} f, ${extras.duration}s, ${result.mapped.length} joints, hips scale ${extras.bakedFor.hipsScale}`);
}
writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({ model: path.basename(model), clips: baked }, null, 2)}\n`);
