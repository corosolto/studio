#!/usr/bin/env node
// Public synthetic anatomy only: no private model, texture, animation, Blender or renderer.
// The gate proves a deformation prerequisite, never visual weapon-contact approval.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Document } from '@gltf-transform/core';
import { cloneDocument } from '@gltf-transform/functions';
import * as THREE from 'three';
import { assertGrip, assertGripMutants, handRegion } from './character-grip-check.mjs';
import { buildMeshy28Skeleton, loadRig, skinPositions, worldMatrices } from '../lib/character-rig.mjs';

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
