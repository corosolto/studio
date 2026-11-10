#!/usr/bin/env node
// Patch only pilot Hand→Curl influences and Curl bind frames. Never regenerate mesh data.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { cloneDocument } from '@gltf-transform/functions';
import { assertGrip, handRegion } from '../checks/character-grip-check.mjs';
import { CLIP_STATES, loadRig, worldMatrices } from '../lib/character-rig.mjs';
import { validatePack } from '../lib/pack.mjs';
import { readGlb } from '../lib/glb-inspect.mjs';

const [sourcePack, targetPack, annotation, donorPath, reportPath] = process.argv.slice(2);
assert(sourcePack && targetPack && annotation && donorPath && reportPath,
  'usage: repair-grip-pack.mjs <pack@0.2.0> <absent-pack@0.2.1> <grip.json> <mst.glb> <report.json>');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const config = JSON.parse(readFileSync(annotation, 'utf8'));
assert(!existsSync(targetPack), 'immutable target pack already exists');
assert(!existsSync(reportPath), 'immutable report already exists');
const originalManifestBytes = readFileSync(path.join(sourcePack, 'manifest.json'));
const manifest = JSON.parse(originalManifestBytes);
assert.equal(manifest.id, config.id); assert.equal(manifest.version, '0.2.0');
assert.equal(path.basename(targetPack), '0.2.1', 'pilot output must be a new 0.2.1 pack');
const sourceBytes = readFileSync(path.join(sourcePack, manifest.model));
assert.equal(sha(sourceBytes), config.sourceSha256, 'unsupported source geometry; author a new annotation');
const donorBytes = readFileSync(donorPath);
assert.equal(sha(donorBytes), config.donorSha256, 'donor changed');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const original = await io.readBinary(sourceBytes), rig = loadRig(original);
const donor = loadRig(await io.readBinary(donorBytes));
const donorInfluences = {};
for (const h of config.hands) {
  const slots = donor.names.flatMap((n, i) => n === h.curl ? [i] : []);
  donorInfluences[h.curl] = donor.prims.reduce((total, p) => total + Array.from({ length: p.count }, (_, v) =>
    [0, 1, 2, 3].some(k => slots.includes(p.J[v * 4 + k]) && p.W[v * 4 + k] > 0.001) ? 1 : 0).reduce((a, b) => a + b, 0), 0);
  assert(donorInfluences[h.curl] > 32, 'reference donor has no working Curl deformation');
  const hand = donor.joints[donor.names.indexOf(h.hand)], curl = donor.joints[slots[0]];
  assert(hand.listChildren().includes(curl), 'unsupported reference Curl hierarchy');
  assert(curl.getRotation().slice(0, 3).every(v => Math.abs(v) < 1e-6), 'unsupported reference flexion frame');
}
assert.equal(rig.prims.length, 1); assert.equal(rig.joints.length, 28);
// Preserve the original GLB JSON and BIN verbatim except precisely allowed edits. Using the
// exporter here would needlessly rewrite geometry, UV, texture/material and clip bytes.
assert.equal(sourceBytes.readUInt32LE(0), 0x46546c67); assert.equal(sourceBytes.readUInt32LE(4), 2);
const jsonLength = sourceBytes.readUInt32LE(12), json = JSON.parse(sourceBytes.subarray(20, 20 + jsonLength));
const binStart = 20 + jsonLength + 8, bin = Buffer.from(sourceBytes.subarray(binStart));
assert.equal(sourceBytes.readUInt32LE(20 + jsonLength + 4), 0x004e4942);
assert(!json.extensionsRequired?.length, 'compressed/extended source requires a separate repair');
const skin = json.skins[0], primitive = json.meshes[0].primitives[0];
const allowedBytes = new Uint8Array(bin.length);
function writeElement(index, row, values) {
  const a = json.accessors[index], view = json.bufferViews[a.bufferView];
  const size = { 5121: 1, 5123: 2, 5126: 4 }[a.componentType];
  assert(size && !a.normalized && !a.sparse, 'unsupported skin accessor encoding');
  const offset = (view.byteOffset || 0) + (a.byteOffset || 0) + row * (view.byteStride || values.length * size);
  values.forEach((value, k) => {
    const at = offset + k * size;
    if (a.componentType === 5126) bin.writeFloatLE(value, at);
    else if (a.componentType === 5123) bin.writeUInt16LE(value, at);
    else bin.writeUInt8(value, at);
    allowedBytes.fill(1, at, at + size);
  });
}
const working = cloneDocument(original), workRig = loadRig(working);
for (const h of config.hands) {
  assert(h.palmY < h.knuckleY && h.knuckleY < h.fullY && h.branchY > h.knuckleY);
  const region = handRegion(rig, h), { hi, ci, points, members, scale } = region;
  assert(Math.abs(scale - 0.01) < 1e-9, 'annotation expects centimetre skeleton, metre mesh');
  for (const p of rig.prims) for (let v = 0; v < p.count; v++) for (let k = 0; k < 4; k++) {
    assert(!(rig.names[p.J[v * 4 + k]].startsWith('Curl_') && p.W[v * 4 + k] > 0), 'source already has finger weights');
  }
  const curl = workRig.joints[ci]; curl.setTranslation([0, h.knuckleY / scale, 0]).setRotation([0, 0, 0, 1]);
  // Both duplicate Curl joints stay children of Hand; only the first becomes deforming.
  // This preserves the meshy-28 joint order/hierarchy and the existing runtime discovery.
  json.nodes[skin.joints[ci]].translation = curl.getTranslation();
  json.nodes[skin.joints[ci]].rotation = curl.getRotation();
  const p = rig.prims[0];
  for (let v = 0; v < p.count; v++) {
    const q = points[v];
    if (!members[v] || q.y <= h.knuckleY || q.x * h.thumbSign >= h.thumbX) continue;
    const js = Array.from(p.J.slice(v * 4, v * 4 + 4)), ws = Array.from(p.W.slice(v * 4, v * 4 + 4));
    const slot = js.findIndex((j, k) => j === hi && ws[k] > 0), free = ws.findIndex(w => w === 0);
    assert(slot >= 0 && free >= 0, 'finger needs an available skin slot; never discard unrelated influences');
    const t = Math.min(1, (q.y - h.knuckleY) / (h.fullY - h.knuckleY));
    const moved = ws[slot] * t * t * (3 - 2 * t);
    ws[slot] -= moved; js[free] = ci; ws[free] = moved;
    writeElement(primitive.attributes.JOINTS_0, v, js);
    writeElement(primitive.attributes.WEIGHTS_0, v, ws);
  }
  // Compute IBM from the complete parent chain; no world-space offsets in local space.
  const updated = loadRig(working), inverse = worldMatrices(updated)(updated.joints[ci]).clone().invert();
  writeElement(skin.inverseBindMatrices, ci, inverse.elements);
}
// All payload bytes outside explicitly changed weight/IBM elements are identical.
const oldBin = sourceBytes.subarray(binStart);
for (let i = 0; i < bin.length; i++) if (!allowedBytes[i]) assert.equal(bin[i], oldBin[i], `unexpected binary change ${i}`);
const jsonBytes = Buffer.from(JSON.stringify(json)), pad = (4 - jsonBytes.length % 4) % 4;
const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(20 + jsonBytes.length + pad + 8 + bin.length, 8);
header.writeUInt32LE(jsonBytes.length + pad, 12); header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(bin.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
const result = Buffer.concat([header, jsonBytes, Buffer.alloc(pad, 32), binHeader, bin]);
const measurements = assertGrip(original, await io.readBinary(result), config);
// Validate the complete original before publication, not just the rewritten model.
await validatePack({ manifestPath: path.join(sourcePack, 'manifest.json') });
const states = await readGlb(path.join(sourcePack, manifest.animations.idle), 'states', { allowMeshoptFallback: true });
const clipNames = states.document.animations.map(a => a.name);
assert(CLIP_STATES.every(state => manifest.animations[state] === manifest.animations.idle),
  'all eleven runtime states must map to the shared states pack');
assert.deepEqual([...clipNames].sort(), [...CLIP_STATES].sort(), 'existing complete eleven named runtime states required');
manifest.version = '0.2.1';
manifest.source.provenance.push(`Offline pilot Curl repair: ${config.id}/grip.json; source model ${config.sourceSha256}; donor ${config.donorSha256}; palm/thumb and all non-skin payload bytes unchanged. Numeric prerequisite only; visual approval pending.`);
const entry = manifest.files.find(f => f.path === manifest.model); entry.sha256 = sha(result); entry.bytes = result.length;
mkdirSync(path.dirname(targetPack), { recursive: true });
const temporary = mkdtempSync(path.join(path.dirname(targetPack), '.grip-pack-'));
let reportTemporary = null, published = false, complete = false;
try {
  // Materialize only validated, declared payloads as fresh regular files. Copying a
  // source tree can preserve symlinks or undeclared files and write back into it.
  for (const file of manifest.files) {
    const destination = path.join(temporary, file.path);
    mkdirSync(path.dirname(destination), { recursive: true });
    const bytes = file.path === manifest.model ? result : readFileSync(path.join(sourcePack, file.path));
    writeFileSync(destination, bytes, { flag: 'wx' });
  }
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(path.join(temporary, 'manifest.json'), manifestBytes, { flag: 'wx' });
  await validatePack({ manifestPath: path.join(temporary, 'manifest.json') });
  for (const f of manifest.files) if (f.path !== manifest.model) {
    assert.equal(sha(readFileSync(path.join(temporary, f.path))), sha(readFileSync(path.join(sourcePack, f.path))), 'non-model pack payload changed');
  }
  const report = {
    status: 'numeric-prerequisite-only-visual-review-required', command: [process.execPath, ...process.argv.slice(1)],
    toolSha256: sha(readFileSync(fileURLToPath(import.meta.url))), annotationSha256: sha(readFileSync(annotation)),
    sourcePack, sourceManifestSha256: sha(originalManifestBytes), outputPack: targetPack,
    manifestSha256: sha(manifestBytes), modelSha256: sha(result), donorInfluences, clipNames,
    preserved: ['geometry', 'topology', 'UV', 'normals', 'materials', 'images', 'rights', 'all animation files', 'joint hierarchy/order'],
    measurements,
  };
  // Prepare evidence before making the pack visible. A report failure must not strand
  // an immutable version that can neither be completed nor retried.
  reportTemporary = mkdtempSync(path.join(path.dirname(reportPath), '.grip-report-'));
  const stagedReport = path.join(reportTemporary, 'report.json');
  writeFileSync(stagedReport, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  assert(!existsSync(targetPack), 'immutable target appeared during repair');
  renameSync(temporary, targetPack); published = true;
  // Hard-link publication is atomic and fails rather than replacing existing evidence.
  linkSync(stagedReport, reportPath); complete = true;
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (published && !complete) rmSync(targetPack, { recursive: true, force: true });
  if (reportTemporary) rmSync(reportTemporary, { recursive: true, force: true });
  rmSync(temporary, { recursive: true, force: true });
}
