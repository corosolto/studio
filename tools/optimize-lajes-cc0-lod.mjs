#!/usr/bin/env node
// Uso: node tools/optimize-lajes-cc0-lod.mjs
import { createHash } from 'node:crypto';
import { readFile, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PROPS = join(ROOT, 'public/models/props');
const RATIO = 0.35;
const ERROR = 0.001;
const STEMS = [
  'lajes_facades_cc0',
  'lajes_shanty_house_cc0',
  'lajes_rustic_house_cc0',
  'lajes_favela_house_cc0',
  'lajes_brazilian_house_cc0',
  'lajes_favela_tower_cc0',
  'lajes_factory_facade_cc0',
  'lajes_broken_door_cc0',
];

await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function primitiveTriangles(prim) {
  const indices = prim.getIndices();
  const count = indices ? indices.getCount() : prim.getAttribute('POSITION')?.getCount() || 0;
  if (prim.getMode() === 4) return count / 3;
  if (prim.getMode() === 5 || prim.getMode() === 6) return Math.max(0, count - 2);
  return 0;
}

function snapshot(doc) {
  const root = doc.getRoot();
  const meshes = root.listMeshes();
  const perMesh = meshes.map((mesh) => mesh.listPrimitives().reduce((sum, prim) => sum + primitiveTriangles(prim), 0));
  const textures = root.listTextures();
  const textureIds = new Map(textures.map((texture, index) => [texture, index]));
  const nodeSignature = (node) => ({
    name: node.getName(),
    mesh: node.getMesh() ? meshes.indexOf(node.getMesh()) : -1,
    children: node.listChildren().map(nodeSignature),
  });
  return {
    triangles: perMesh.reduce((sum, count) => sum + count, 0),
    instantiatedTriangles: root.listNodes().reduce((sum, node) => {
      const mesh = node.getMesh();
      return sum + (mesh ? perMesh[meshes.indexOf(mesh)] : 0);
    }, 0),
    materials: root.listMaterials().map((material) => ({
      name: material.getName(),
      baseColor: material.getBaseColorFactor(),
      metallic: material.getMetallicFactor(),
      roughness: material.getRoughnessFactor(),
      alphaMode: material.getAlphaMode(),
      alphaCutoff: material.getAlphaCutoff(),
      doubleSided: material.getDoubleSided(),
      textures: [
        material.getBaseColorTexture(),
        material.getMetallicRoughnessTexture(),
        material.getNormalTexture(),
        material.getOcclusionTexture(),
        material.getEmissiveTexture(),
      ].map((texture) => texture ? textureIds.get(texture) : -1),
    })),
    textures: textures.map((texture) => ({
      name: texture.getName(),
      mimeType: texture.getMimeType(),
      imageSha256: texture.getImage() ? sha256(texture.getImage()) : null,
    })),
    hierarchy: root.listScenes().map((scene) => scene.listChildren().map(nodeSignature)),
    semantics: meshes.map((mesh) => mesh.listPrimitives().map((prim) => prim.listSemantics().sort())),
    extensions: root.listExtensionsUsed().map((extension) => extension.extensionName).sort(),
  };
}

function assertFiniteAccessors(doc, label) {
  for (const accessor of doc.getRoot().listAccessors()) {
    const array = accessor.getArray();
    if (!array) continue;
    for (let i = 0; i < array.length; i++) {
      if (!Number.isFinite(array[i])) throw new Error(`${label}: accessor ${accessor.getName() || i} contém NaN/Infinity`);
    }
  }
}

function validateDocument(before, after, outputDoc, label) {
  if (!(after.triangles < before.triangles)) throw new Error(`${label}: sem redução de triângulos`);
  for (const key of ['materials', 'textures', 'hierarchy', 'semantics']) {
    if (!equal(before[key], after[key])) throw new Error(`${label}: ${key} não preservado`);
  }
  if (after.extensions.includes('EXT_meshopt_compression')) {
    throw new Error(`${label}: saída exigiria MeshoptDecoder`);
  }
  assertFiniteAccessors(outputDoc, label);
}

globalThis.self = globalThis;
globalThis.Image = class {
  width = 1;
  height = 1;
  set src(_) { queueMicrotask(() => this.onload?.()); }
};
globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
globalThis.ProgressEvent ??= class {
  constructor(type, data) { this.type = type; Object.assign(this, data); }
};
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');

async function validateGLTFLoader(bytes, label) {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new GLTFLoader().parseAsync(buffer, '');
  let meshes = 0;
  gltf.scene.traverse((object) => {
    if (!object.isMesh) return;
    meshes++;
    for (const attribute of Object.values(object.geometry.attributes)) {
      const array = attribute.array || attribute.data?.array;
      if (!array) throw new Error(`${label}: atributo sem buffer no GLTFLoader`);
      for (let i = 0; i < array.length; i++) {
        if (!Number.isFinite(array[i])) throw new Error(`${label}: NaN/Infinity no GLTFLoader`);
      }
    }
  });
  if (!meshes) throw new Error(`${label}: GLTFLoader não encontrou meshes`);
}

const report = [];
for (const stem of STEMS) {
  const sourcePath = join(PROPS, `${stem}.glb`);
  const outputPath = join(PROPS, `${stem}_lod.glb`);
  const tempPath = join(PROPS, `${stem}_lod.tmp.glb`);
  const sourceBytes = await readFile(sourcePath);
  const sourceHash = sha256(sourceBytes);
  const sourceDoc = await io.read(sourcePath);
  const before = snapshot(sourceDoc);
  assertFiniteAccessors(sourceDoc, stem);

  await sourceDoc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: ERROR }));
  await io.write(tempPath, sourceDoc);

  try {
    const outputBytes = await readFile(tempPath);
    const outputDoc = await io.read(tempPath);
    const after = snapshot(outputDoc);
    validateDocument(before, after, outputDoc, stem);
    await validateGLTFLoader(outputBytes, stem);
    if (sha256(await readFile(sourcePath)) !== sourceHash) throw new Error(`${stem}: original foi alterado`);
    await rename(tempPath, outputPath);
    report.push({
      asset: stem,
      antes: before.triangles,
      depois: after.triangles,
      reducao: `${(100 * (1 - after.triangles / before.triangles)).toFixed(1)}%`,
      instanciadosAntes: before.instantiatedTriangles,
      instanciadosDepois: after.instantiatedTriangles,
      bytes: (await stat(outputPath)).size,
    });
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

console.table(report);
console.log(`LODs gerados com ratio=${RATIO}, error=${ERROR}, sem compressão meshopt no output.`);
