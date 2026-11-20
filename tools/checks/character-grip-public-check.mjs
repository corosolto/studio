#!/usr/bin/env node
// Public synthetic anatomy only: no private model, texture, animation, Blender or renderer.
// The gate proves a deformation prerequisite, never visual weapon-contact approval.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { cloneDocument } from '@gltf-transform/functions';
import * as THREE from 'three';
import { assertGrip, assertGripMutants, handRegion } from './character-grip-check.mjs';
import { buildMeshy28Skeleton, CLIP_STATES, loadRig, skinPositions, worldMatrices } from '../lib/character-rig.mjs';

const config = JSON.parse(readFileSync(new URL('../../characters/capitao-caveira/grip.json', import.meta.url), 'utf8'));
const points = {
  Hips: [0, .83, -.02], LeftUpLeg: [.08, .75, -.01], LeftLeg: [.1, .42, .03], LeftFoot: [.11, .1, 0], LeftToeBase: [.13, .04, .11],
  RightUpLeg: [-.08, .75, -.01], RightLeg: [-.1, .42, .03], RightFoot: [-.11, .1, 0], RightToeBase: [-.13, .04, .11],
  Spine02: [0, .96, 0], Spine01: [0, 1.09, 0], Spine: [0, 1.22, 0],
  LeftShoulder: [.035, 1.25, 0], LeftArm: [.17, 1.25, 0], LeftForeArm: [.4, 1.25, 0], LeftHand: [.62, 1.25, 0],
  RightShoulder: [-.035, 1.25, 0], RightArm: [-.17, 1.25, 0], RightForeArm: [-.4, 1.25, 0], RightHand: [-.62, 1.25, 0],
  neck: [0, 1.32, 0], Head: [0, 1.39, 0], head_end: [0, 1.7, 0], headfront: [0, 1.39, .12],
  Curl_R: [-.62, 1.25, 0], Curl_L: [.62, 1.25, 0],
};
const before = new Document(), buffer = before.createBuffer();
const built = buildMeshy28Skeleton(before, points);
const skin = before.createSkin().setInverseBindMatrices(before.createAccessor().setType('MAT4').setArray(built.inverseBindMatrices).setBuffer(buffer));
for (const joint of built.joints) skin.addJoint(joint);
const positions = [], joints = [], weights = [], indices = [];
for (const h of config.hands) {
  const hi = built.joints.findIndex(j => j.getName() === h.hand);
  const handWorld = new THREE.Matrix4().fromArray(built.joints[hi].getWorldMatrix());
  // Disconnected tubes are intentional: four distal branches plus a shorter thumb.
  // No production geometry is approximated or copied by this fixture.
  const tube = (x, ys, radius) => {
    const start = positions.length / 3, sides = 8;
    for (const y of ys) for (let k = 0; k < sides; k++) {
      const angle = k / sides * Math.PI * 2;
      const p = new THREE.Vector3(x + Math.cos(angle) * radius, y, Math.sin(angle) * radius).multiplyScalar(100).applyMatrix4(handWorld);
      positions.push(...p.toArray()); joints.push(hi, 0, 0, 0); weights.push(1, 0, 0, 0);
    }
    for (let ring = 1; ring < ys.length; ring++) for (let k = 0; k < sides; k++) {
      const a = start + (ring - 1) * sides + k, b = start + (ring - 1) * sides + (k + 1) % sides;
      const c = start + ring * sides + k, d = start + ring * sides + (k + 1) % sides;
      indices.push(a, c, b, b, c, d);
    }
  };
  for (const x of [-.05, -.02, .01, .04]) tube(x * -h.thumbSign, [.14, .17, .18, .19, .20, .22, .24, .26], .007);
  tube(h.thumbSign * .09, [.10, .12, .14, .16, .17], .008);
  tube(0, [.03, .06, .09, .12, .145], .04);
}
const accessor = (type, array) => before.createAccessor().setType(type).setArray(array).setBuffer(buffer);
const primitive = before.createPrimitive()
  .setAttribute('POSITION', accessor('VEC3', new Float32Array(positions)))
  .setAttribute('JOINTS_0', accessor('VEC4', new Uint16Array(joints)))
  .setAttribute('WEIGHTS_0', accessor('VEC4', new Float32Array(weights)))
  .setIndices(accessor('SCALAR', new Uint16Array(indices)));
const mesh = before.createMesh().addPrimitive(primitive);
before.createScene().addChild(built.armature).addChild(before.createNode('SyntheticHands').setMesh(mesh).setSkin(skin));
const after = cloneDocument(before), baseline = loadRig(before);
for (const h of config.hands) {
  const region = handRegion(baseline, h), rig = loadRig(after), { hi, ci, members, points: local } = region;
  const node = rig.joints[ci]; node.setTranslation([0, h.knuckleY / region.scale, 0]).setRotation([0, 0, 0, 1]);
  const changed = loadRig(after), inverse = worldMatrices(changed)(node).clone().invert();
  after.getRoot().listSkins()[0].getInverseBindMatrices().setElement(ci, inverse.elements);
  for (let v = 0; v < rig.prims[0].count; v++) {
    if (!members[v] || local[v].y <= h.knuckleY || local[v].x * h.thumbSign >= h.thumbX) continue;
    const t = Math.min(1, (local[v].y - h.knuckleY) / (h.fullY - h.knuckleY)), w = t * t * (3 - 2 * t);
    rig.prims[0].J[v * 4 + 1] = ci; rig.prims[0].W[v * 4] = 1 - w; rig.prims[0].W[v * 4 + 1] = w;
    assert.equal(rig.prims[0].J[v * 4], hi);
  }
}
const report = assertGrip(before, after, config);
console.log(`PASS public grip prerequisite: ${JSON.stringify(report)}`);
assertGripMutants(before, after, config);

// Cross-check the offline implementation against an actual Three.js SkinnedMesh.
// Euler XYZ addition is exactly the runtime operation, including on nonidentity rest frames.
const rig = loadRig(after), isJoint = new Set(rig.joints), objects = new Map();
for (const n of rig.nodes) {
  const o = isJoint.has(n) ? new THREE.Bone() : new THREE.Object3D(), trs = rig.trs.get(n);
  o.name = n.getName(); o.position.fromArray(trs.t); o.quaternion.fromArray(trs.r); o.scale.fromArray(trs.s); objects.set(n, o);
}
const root = new THREE.Group();
for (const n of rig.nodes) (rig.parent.has(n) ? objects.get(rig.parent.get(n)) : root).add(objects.get(n));
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(rig.prims[0].pos, 3));
geometry.setAttribute('skinIndex', new THREE.BufferAttribute(rig.prims[0].J, 4));
geometry.setAttribute('skinWeight', new THREE.BufferAttribute(rig.prims[0].W, 4));
const skinned = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
const skeleton = new THREE.Skeleton(rig.joints.map(n => objects.get(n)), rig.ibm.map(m => m.clone()));
root.add(skinned); root.updateMatrixWorld(true); skinned.bind(skeleton, new THREE.Matrix4());
let maxEngineError = 0;
for (const angle of [.55, .95]) {
  const overrides = new Map();
  for (const h of config.hands) {
    const node = rig.joints[rig.names.indexOf(h.curl)], trs = rig.trs.get(node), o = objects.get(node);
    o.quaternion.fromArray(trs.r); o.rotation.x += angle;
    overrides.set(node, { ...trs, r: o.quaternion.toArray() });
  }
  root.updateMatrixWorld(true); skeleton.update();
  const expected = skinPositions(rig, overrides)[0];
  for (let v = 0; v < rig.prims[0].count; v++) {
    const actual = skinned.applyBoneTransform(v, new THREE.Vector3().fromArray(rig.prims[0].pos, v * 3));
    maxEngineError = Math.max(maxEngineError, actual.distanceTo(new THREE.Vector3().fromArray(expected, v * 3)));
  }
}
assert(maxEngineError < 1e-6, `offline/runtime skinning mismatch ${maxEngineError}m`);
console.log(`PASS Three.js SkinnedMesh parity: ${maxEngineError}m maximum error`);
geometry.dispose(); skinned.material.dispose(); skeleton.dispose();

// Exercise the real repair CLI, not a mock, using only generated temporary bytes.
const work = mkdtempSync(path.join(os.tmpdir(), 'studio-grip-public-'));
try {
  const io = new NodeIO(), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const modelBytes = Buffer.from(await io.writeBinary(before)), donorBytes = Buffer.from(await io.writeBinary(after));
  const sourcePack = path.join(work, 'source'), modelPath = 'model/pilot.glb', statesPath = 'animations/states.glb', previewPath = 'previews/front.png';
  for (const dir of ['model', 'animations', 'previews']) mkdirSync(path.join(sourcePack, dir), { recursive: true });
  writeFileSync(path.join(sourcePack, 'payload.glb'), modelBytes);
  symlinkSync('../payload.glb', path.join(sourcePack, modelPath));
  const donorPath = path.join(work, 'donor.glb'), annotationPath = path.join(work, 'grip.json');
  writeFileSync(donorPath, donorBytes);
  writeFileSync(annotationPath, JSON.stringify({ ...config, sourceSha256: sha(modelBytes), donorSha256: sha(donorBytes) }));
  const preview = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  writeFileSync(path.join(sourcePack, previewPath), preview);
  const statesBytes = async names => {
    const doc = new Document(), buf = doc.createBuffer(), hips = doc.createNode('Hips');
    doc.createScene().addChild(hips);
    const time = doc.createAccessor().setType('SCALAR').setArray(new Float32Array([0, 1])).setBuffer(buf);
    const values = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 83, 0, 0, 83, 0])).setBuffer(buf);
    for (const name of names) {
      const sampler = doc.createAnimationSampler().setInput(time).setOutput(values).setInterpolation('LINEAR');
      doc.createAnimation(name).addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(hips).setTargetPath('translation').setSampler(sampler));
    }
    return Buffer.from(await io.writeBinary(doc));
  };
  const setSourceManifest = async (names, declared) => {
    const clips = await statesBytes(names);
    writeFileSync(path.join(sourcePack, statesPath), clips);
    const files = [[modelPath, modelBytes], [statesPath, clips], [previewPath, preview]].map(([p, bytes]) => ({ path: p, bytes: bytes.length, sha256: sha(bytes) }));
    writeFileSync(path.join(sourcePack, 'manifest.json'), JSON.stringify({
      schemaVersion: 1, kind: 'character', id: config.id, version: '0.2.0',
      source: { revision: 'synthetic-public-fixture', provenance: ['Generated mathematical fixture; no private source assets'] },
      files, model: modelPath, skeleton: 'meshy-28', animations: Object.fromEntries(declared.map(name => [name, statesPath])),
      previews: [previewPath], rights: { status: 'original', basis: 'Programmatic public test geometry' },
      budgets: { triangles: 5000, bytes: 8388608 },
    }));
  };
  await setSourceManifest(CLIP_STATES, CLIP_STATES);
  const script = fileURLToPath(new URL('../characters/repair-grip-pack.mjs', import.meta.url));
  const run = (name, { reportParent = true, injectLinkFailure = false } = {}) => {
    const directory = path.join(work, name); mkdirSync(directory);
    const target = path.join(directory, '0.2.1');
    const evidence = reportParent ? path.join(directory, 'report.json') : path.join(directory, 'missing-parent/report.json');
    const hook = "import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';fs.linkSync=()=>{throw new Error('injected evidence-link failure')};syncBuiltinESMExports();";
    const preload = injectLinkFailure ? ['--import', `data:text/javascript,${encodeURIComponent(hook)}`] : [];
    const result = spawnSync(process.execPath, [...preload, script, sourcePack, target, annotationPath, donorPath, evidence], { encoding: 'utf8' });
    assert.equal(sha(readFileSync(path.join(sourcePack, modelPath))), sha(modelBytes), 'repair changed immutable source bytes');
    assert(lstatSync(path.join(sourcePack, modelPath)).isSymbolicLink(), 'repair replaced source symlink');
    return { result, target, evidence };
  };
  const valid = run('valid');
  assert.equal(valid.result.status, 0, valid.result.stderr);
  assert(!lstatSync(path.join(valid.target, modelPath)).isSymbolicLink(), 'staged model must be materialized');
  assert(existsSync(valid.evidence), 'successful repair lacks evidence');
  assertGrip(before, await io.read(path.join(valid.target, modelPath)), config);
  console.log('PASS real repair CLI materializes symlinks, preserves source and publishes a validated pack plus evidence');
  const absentParent = run('missing-evidence-parent', { reportParent: false });
  assert.notEqual(absentParent.result.status, 0, 'missing report parent unexpectedly accepted');
  assert(!existsSync(absentParent.target) && !existsSync(absentParent.evidence), 'report preparation failure published a partial version');
  console.log('PASS missing evidence parent leaves no immutable partial version');
  const linkFailure = run('evidence-link-failure', { injectLinkFailure: true });
  assert.notEqual(linkFailure.result.status, 0, 'injected report publication failure was not applied');
  assert.match(linkFailure.result.stderr, /injected evidence-link failure/);
  assert(!existsSync(linkFailure.target) && !existsSync(linkFailure.evidence), 'evidence failure did not roll back the published version');
  console.log('PASS injected evidence publication failure rolls back the new pack');
  const requiredEight = CLIP_STATES.slice(0, 8);
  await setSourceManifest([...requiredEight, 'unrelated_a', 'unrelated_b', 'unrelated_c'], requiredEight);
  const incomplete = run('missing-optional-runtime-states');
  assert.notEqual(incomplete.result.status, 0, 'eleven unrelated clip names unexpectedly accepted');
  assert.match(incomplete.result.stderr, /all eleven runtime states/);
  assert(!existsSync(incomplete.target), 'incomplete runtime states published a version');
  console.log('PASS eleven-clip count cannot substitute for all eleven named runtime states');
} finally { rmSync(work, { recursive: true, force: true }); }
