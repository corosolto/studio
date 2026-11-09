// Synthetic meshy-28 humanoid for the Studio checks (no real asset bytes): tubes along the
// joint chains of the donor layout, skinned with smoothstep blends at each joint, on the
// skeleton tools/lib/character-rig.mjs#buildMeshy28Skeleton builds. Mutants inject the rig
// defects the pose test must catch.
import { Document } from '@gltf-transform/core';
import * as THREE from 'three';
import { meshy28Joints } from '../../lib/character-pack.mjs';
import { buildMeshy28Skeleton } from '../../lib/character-rig.mjs';

// glTF space: +Y up, faces +Z, character left is +X. Joints follow the donor layout.
export const J = {
  Hips: [0, 0.83, -0.02], LeftUpLeg: [0.08, 0.75, -0.01], LeftLeg: [0.1, 0.42, 0.03], LeftFoot: [0.11, 0.1, 0], LeftToeBase: [0.13, 0.04, 0.11],
  RightUpLeg: [-0.08, 0.75, -0.01], RightLeg: [-0.1, 0.42, 0.03], RightFoot: [-0.11, 0.1, 0], RightToeBase: [-0.13, 0.04, 0.11],
  Spine02: [0, 0.96, 0], Spine01: [0, 1.09, 0], Spine: [0, 1.22, 0],
  LeftShoulder: [0.035, 1.25, 0], LeftArm: [0.17, 1.25, 0], LeftForeArm: [0.4, 1.25, 0], LeftHand: [0.62, 1.25, 0],
  RightShoulder: [-0.035, 1.25, 0], RightArm: [-0.17, 1.25, 0], RightForeArm: [-0.4, 1.25, 0], RightHand: [-0.62, 1.25, 0],
  neck: [0, 1.32, 0], Head: [0, 1.39, 0], head_end: [0, 1.7, 0], headfront: [0, 1.39, 0.12], Curl_R: [-0.62, 1.25, 0], Curl_L: [0.62, 1.25, 0],
};
export const TIPS = { LeftHandTip: [0.72, 1.25, 0], RightHandTip: [-0.72, 1.25, 0] };

/** Tubes along joint chains (`joints`: another layout, same names); each ring is weighted by a
    smoothstep blend around every joint. */
export function synthBody({ mutant = null, joints: layout = J } = {}) {
  const positions = [], joints = [], weights = [], indices = [];
  const slot = new Map(meshy28Joints.map(([name], i) => [name, i]).reverse());
  const tube = (chain, radius, step = 0.02, sides = 8, blend = 0.05) => {
    const points = chain.map((n) => new THREE.Vector3(...(Array.isArray(n) ? n : layout[n])));
    const names = chain.map((n) => (Array.isArray(n) ? null : n));
    const total = points.slice(1).reduce((s, p, i) => s + p.distanceTo(points[i]), 0);
    const rings = Math.max(2, Math.round(total / step) + 1);
    const start = positions.length / 3;
    const segLen = points.slice(1).map((p, i) => p.distanceTo(points[i]));
    for (let r = 0; r < rings; r += 1) {
      let d = (r / (rings - 1)) * total, seg = 0;
      while (seg < segLen.length - 1 && d > segLen[seg]) { d -= segLen[seg]; seg += 1; }
      const a = points[seg], b = points[seg + 1];
      const centre = a.clone().lerp(b, Math.min(1, d / segLen[seg]));
      const axis = b.clone().sub(a).normalize();
      const u = Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0).cross(axis).normalize() : new THREE.Vector3(1, 0, 0).cross(axis).normalize();
      const v = axis.clone().cross(u);
      // Bone owning this ring: the chain joint at the segment start. Within `blend` of a
      // joint the ring is shared with the bone across it, 50/50 exactly at the joint.
      const own = names[seg] ?? names[seg + 1];
      const next = names[seg + 1];
      const prev = seg > 0 ? names[seg - 1] : null;
      const toNext = segLen[seg] - d;
      let other = null, w = 0;
      if (next && next !== own && toNext < blend) { other = next; w = 0.5 * (1 - toNext / blend); }
      else if (prev && prev !== own && d < blend) { other = prev; w = 0.5 * (1 - d / blend); }
      if (mutant === 'hard-step') w = 0;
      for (let k = 0; k < sides; k += 1) {
        const ang = (k / sides) * Math.PI * 2;
        const p = centre.clone().addScaledVector(u, Math.cos(ang) * radius).addScaledVector(v, Math.sin(ang) * radius);
        positions.push(p.x, p.y, p.z);
        joints.push(slot.get(own), other ? slot.get(other) : 0, 0, 0);
        weights.push(1 - w, w, 0, 0);
      }
      if (r > 0) for (let k = 0; k < sides; k += 1) {
        const a0 = start + (r - 1) * sides + k, a1 = start + (r - 1) * sides + ((k + 1) % sides);
        const b0 = start + r * sides + k, b1 = start + r * sides + ((k + 1) % sides);
        indices.push(a0, b0, a1, a1, b0, b1);
      }
    }
  };
  tube(['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head', 'head_end'], 0.12);
  tube(['LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', [0.72, 1.25, 0]], 0.045);
  tube(['RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', [-0.72, 1.25, 0]], 0.045);
  tube(['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', [0.14, 0.03, 0.2]], 0.06);
  tube(['RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase', [-0.14, 0.03, 0.2]], 0.06);
  if (mutant === 'arm-weight-on-torso') {
    // Upper-back vertices of the spine tube take 60% LeftArm (the defect the part rules forbid).
    for (let i = 0; i < positions.length / 3; i += 1) {
      const [x, y, z] = positions.slice(i * 3, i * 3 + 3);
      if (y > 1.1 && y < 1.3 && z < -0.05 && Math.abs(x) < 0.15 && joints[i * 4] !== slot.get('LeftArm')) {
        joints[i * 4 + 1] = slot.get('LeftArm'); weights[i * 4] = 0.4; weights[i * 4 + 1] = 0.6;
      }
    }
  }
  if (mutant === 'split-seam') {
    // Duplicate one spine-ring vertex (a UV seam) and weight the copy to the left arm.
    const v = 40;
    positions.push(...positions.slice(v * 3, v * 3 + 3));
    joints.push(slot.get('LeftArm'), 0, 0, 0);
    weights.push(1, 0, 0, 0);
    indices.push(v, positions.length / 3 - 1, v + 1);
  }
  if (mutant === 'hand-on-spine') {
    // Every other ring of the left hand is skinned to Spine: lifting the arm tears the hand.
    for (let i = 0; i < positions.length / 3; i += 1) {
      const [x, y] = positions.slice(i * 3, i * 3 + 2);
      if (x > 0.63 && Math.abs(y - 1.25) < 0.06 && Math.round((x - 0.62) / 0.02) % 2 === 1) {
        joints.splice(i * 4, 4, slot.get('Spine'), 0, 0, 0);
        weights.splice(i * 4, 4, 1, 0, 0, 0);
      }
    }
  }
  return { positions, joints, weights, indices };
}

export function synthDocument(options = {}) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const body = synthBody(options);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(body.positions)).setBuffer(buffer))
    .setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(new Uint16Array(body.joints)).setBuffer(buffer))
    .setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(new Float32Array(body.weights)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(body.indices)).setBuffer(buffer));
  const meshNode = doc.createNode('Body').setMesh(doc.createMesh('Body').addPrimitive(prim));
  const skeleton = buildMeshy28Skeleton(doc, { ...(options.joints || J), ...TIPS });
  if (options.mutant === 'stale-ibm') skeleton.joints[13].setTranslation(skeleton.joints[13].getTranslation().map((v, i) => v + (i === 1 ? 5 : 0)));
  const skin = doc.createSkin('meshy-28').setSkeleton(skeleton.joints[0])
    .setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(skeleton.inverseBindMatrices).setBuffer(buffer));
  for (const node of skeleton.joints) skin.addJoint(node);
  meshNode.setSkin(skin);
  doc.createScene('scene').addChild(meshNode).addChild(skeleton.armature);
  return doc;
}
