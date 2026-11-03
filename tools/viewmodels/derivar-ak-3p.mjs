#!/usr/bin/env node
/* Deriva a AK estática de 3ª pessoa do golden 1P, sem alterar os dois insumos.
 *
 * O golden fornece GEOMETRIA, UV e materiais. O ak.glb original entra só na
 * calibração do contrato já usado pelo jogo: comprimento 0,88 m e grip a 62%
 * do comprimento a partir da boca. As correspondências de UV recuperam a mesma
 * transformação usada pelo build golden, inclusive a parte da coronha que o
 * recorte de 1P removeu. O pente reserva da recarga é utilitário e não entra.
 *
 * Uso (na raiz do cliente/worktree):
 *   node tools/viewmodels/derivar-ak-3p.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback;
const GOLDEN = path.resolve(arg('de', 'public/models/viewmodels/coro/ak-hires.glb'));
const ORIGINAL = path.resolve(arg('original', 'public/models/weapons/ak.glb'));
const OUTPUT = path.resolve(arg('para', 'public/models/weapons/ak_b.glb'));
if (OUTPUT === GOLDEN || OUTPUT === ORIGINAL) throw new Error('Os originais são somente leitura');

const KEEP = [
  'coro_solto_project_ak_body',
  'coro_solto_project_ak_magazine',
  'coro_solto_project_ak_charging_handle',
];
const LENGTH_M = 0.88;
const GRIP_FROM_MUZZLE = 0.62;
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

// GLTFLoader é usado apenas para avaliar o skinning. As imagens reais continuam
// no Document do gltf-transform e são gravadas sem recompressão.
globalThis.self = globalThis;
globalThis.Image = class {
  width = 1;
  height = 1;
  set src(_) { queueMicrotask(() => this.onload?.()); }
};
globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
globalThis.ProgressEvent ??= class {};
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const parseThree = async (file, meshopt = false) => {
  const bytes = fs.readFileSync(file);
  let loader = new GLTFLoader();
  if (meshopt) loader = loader.setMeshoptDecoder(MeshoptDecoder);
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
};

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});
const [doc, golden, original] = await Promise.all([
  io.read(GOLDEN),
  parseThree(GOLDEN, true),
  parseThree(ORIGINAL),
]);
golden.scene.updateWorldMatrix(true, true);
original.scene.updateWorldMatrix(true, true);

let originalMesh = null;
original.scene.traverse((o) => {
  if (o.isMesh) {
    if (originalMesh) throw new Error('A AK de referência deve ter uma única malha');
    originalMesh = o;
  }
});
if (!originalMesh) throw new Error('AK de referência sem malha');

// Cada peça golden é rígida e presa a um único osso. Calcula a mesma cadeia do
// SkinnedMesh para posições E normais; não usa a pose animada de recarga.
const baked = new Map();
for (const name of KEEP) {
  const mesh = golden.scene.getObjectByName(name);
  if (!mesh?.isSkinnedMesh) throw new Error(`Malha skinned ausente: ${name}`);
  const joints = mesh.geometry.attributes.skinIndex;
  const weights = mesh.geometry.attributes.skinWeight;
  if (!joints || !weights || joints.count !== mesh.geometry.attributes.position.count) {
    throw new Error(`Skin incompleto: ${name}`);
  }
  const joint = joints.getX(0);
  for (let i = 0; i < joints.count; i++) {
    for (let k = 0; k < 4; k++) {
      const component = ['getX', 'getY', 'getZ', 'getW'][k];
      const weight = weights[component](i);
      const expected = k === 0 ? 1 : 0;
      if (weight !== expected || (weight && joints[component](i) !== joint)) {
        throw new Error(`${name}: skin deixou de ser rígido no vértice ${i}`);
      }
    }
  }
  mesh.skeleton.update();
  const boneMatrix = new THREE.Matrix4().fromArray(mesh.skeleton.boneMatrices, joint * 16);
  const matrix = new THREE.Matrix4().copy(mesh.matrixWorld)
    .multiply(mesh.bindMatrixInverse).multiply(boneMatrix).multiply(mesh.bindMatrix);
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
  const position = mesh.geometry.attributes.position;
  const normal = mesh.geometry.attributes.normal;
  const positions = new Float32Array(position.count * 3);
  const normals = new Float32Array(position.count * 3);
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i).applyMatrix4(matrix).toArray(positions, i * 3);
    n.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize().toArray(normals, i * 3);
  }
  baked.set(name, { mesh, positions, normals });
}

// UVs únicos a 1e-4 ligam os vértices preservados aos seus originais. Ajusta
// golden.x/y/z como função afim dos três eixos do asset de mundo original.
const sourcePosition = originalMesh.geometry.attributes.position;
const sourceUV = originalMesh.geometry.attributes.uv;
if (!sourceUV) throw new Error('AK original sem UV para calibração');
const uvKey = (attribute, i) => `${attribute.getX(i).toFixed(4)},${attribute.getY(i).toFixed(4)}`;
const uvCounts = new Map(), uvRows = new Map();
for (let i = 0; i < sourceUV.count; i++) {
  const key = uvKey(sourceUV, i);
  uvCounts.set(key, (uvCounts.get(key) || 0) + 1);
  uvRows.set(key, i);
}
const pairs = [];
for (const name of KEEP.slice(0, 2)) {
  const { mesh, positions } = baked.get(name);
  const uv = mesh.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const key = uvKey(uv, i);
    if (uvCounts.get(key) !== 1) continue;
    const sourceIndex = uvRows.get(key);
    pairs.push({
      source: [sourcePosition.getX(sourceIndex), sourcePosition.getY(sourceIndex), sourcePosition.getZ(sourceIndex)],
      golden: [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]],
    });
  }
}
if (pairs.length < 500) throw new Error(`Calibração UV insuficiente: ${pairs.length} pares`);
function fitAxis(sourceAxis, goldenAxis) {
  let sa = 0, sb = 0, saa = 0, sab = 0;
  for (const pair of pairs) {
    const a = pair.source[sourceAxis], b = pair.golden[goldenAxis];
    sa += a; sb += b; saa += a * a; sab += a * b;
  }
  const scale = (pairs.length * sab - sa * sb) / (pairs.length * saa - sa * sa);
  const offset = (sb - scale * sa) / pairs.length;
  let maxResidual = 0, squared = 0;
  for (const pair of pairs) {
    const residual = pair.golden[goldenAxis] - scale * pair.source[sourceAxis] - offset;
    maxResidual = Math.max(maxResidual, Math.abs(residual));
    squared += residual * residual;
  }
  if (!Number.isFinite(scale) || Math.abs(scale) < 1e-6 || maxResidual > 0.002) {
    throw new Error(`Calibração inválida ${sourceAxis}->${goldenAxis}: resíduo ${maxResidual}`);
  }
  return { scale, offset, maxResidual, rmse: Math.sqrt(squared / pairs.length) };
}
// glTF original: +X boca, +Y topo, +Z lateral.
// Golden em bind pose: +Y boca, -Z topo, ±X lateral.
const barrel = fitAxis(0, 1);
const up = fitAxis(1, 2);
const side = fitAxis(2, 0);
if (barrel.scale <= 0 || up.scale >= 0) throw new Error('Eixos da AK não correspondem ao contrato esperado');

const sourceBox = new THREE.Box3().setFromObject(originalMesh);
const sourceGripX = sourceBox.max.x - (sourceBox.max.x - sourceBox.min.x) * GRIP_FROM_MUZZLE;
const goldenGrip = new THREE.Vector3(
  side.offset,
  barrel.scale * sourceGripX + barrel.offset,
  up.offset,
);
const goldenFullLength = barrel.scale * (sourceBox.max.x - sourceBox.min.x);
const uniformScale = LENGTH_M / goldenFullLength;
const normalize = new THREE.Matrix4().makeRotationX(Math.PI / 2);
normalize.scale(new THREE.Vector3(uniformScale, uniformScale, uniformScale));
const normalizedGrip = goldenGrip.clone().applyMatrix4(normalize);
normalize.setPosition(normalizedGrip.multiplyScalar(-1));
const normalMatrix = new THREE.Matrix3().getNormalMatrix(normalize);

const root = doc.getRoot();
const weaponMaterial = root.listMaterials().find((m) => m.getName() === 'assault_ak Material');
if (!weaponMaterial) throw new Error('Material PBR da AK ausente');
const textureHashes = {};
for (const texture of new Set([
  weaponMaterial.getBaseColorTexture(),
  weaponMaterial.getNormalTexture(),
  weaponMaterial.getMetallicRoughnessTexture(),
  weaponMaterial.getOcclusionTexture(),
].filter(Boolean))) textureHashes[texture.getName()] = sha256(texture.getImage());
if (Object.keys(textureHashes).length !== 3) throw new Error('baseColor/normal/ORM esperados na AK');

const sourceNodes = new Set(root.listNodes());
const outputScene = doc.createScene('AK_b_RightHand');
const outputRoot = doc.createNode('AK_b');
outputScene.addChild(outputRoot);
for (const name of KEEP) {
  const sourceNode = root.listNodes().find((n) => n.getName() === name);
  const mesh = sourceNode?.getMesh();
  const primitives = mesh?.listPrimitives() || [];
  if (primitives.length !== 1) throw new Error(`${name}: esperado um primitive`);
  const primitive = primitives[0];
  const { positions, normals } = baked.get(name);
  const position = primitive.getAttribute('POSITION');
  const normal = primitive.getAttribute('NORMAL');
  if (position.getCount() * 3 !== positions.length || normal.getCount() * 3 !== normals.length) {
    throw new Error(`${name}: accessors não correspondem ao GLTFLoader`);
  }
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < position.getCount(); i++) {
    p.fromArray(positions, i * 3).applyMatrix4(normalize).toArray(positions, i * 3);
    n.fromArray(normals, i * 3).applyMatrix3(normalMatrix).normalize().toArray(normals, i * 3);
  }
  position.setArray(positions);
  normal.setArray(normals);
  position.setNormalized(false);
  normal.setNormalized(false);
  primitive.setAttribute('JOINTS_0', null);
  primitive.setAttribute('WEIGHTS_0', null);
  outputRoot.addChild(doc.createNode(name).setMesh(mesh));
}
for (const scene of root.listScenes()) if (scene !== outputScene) scene.dispose();
for (const node of sourceNodes) node.dispose();
root.setDefaultScene(outputScene);
for (const animation of root.listAnimations()) animation.dispose();
for (const skin of root.listSkins()) skin.dispose();
for (const camera of root.listCameras()) camera.dispose();
for (const extension of root.listExtensionsUsed()) {
  if (extension.extensionName === 'EXT_meshopt_compression') extension.dispose();
}
const retainedAccessors = new Set();
for (const name of KEEP) {
  const outputNode = outputRoot.listChildren().find((n) => n.getName() === name);
  for (const primitive of outputNode.getMesh().listPrimitives()) {
    for (const semantic of primitive.listSemantics()) retainedAccessors.add(primitive.getAttribute(semantic));
    if (primitive.getIndices()) retainedAccessors.add(primitive.getIndices());
  }
}
for (const accessor of root.listAccessors()) if (!retainedAccessors.has(accessor)) accessor.dispose();
await doc.transform(prune());

const rawBounds = getBounds(outputScene);
outputRoot.setExtras({
  contract: 'RightHand; grip na origem; boca +Z; topo +Y; metros',
  derivedFrom: path.relative(process.cwd(), GOLDEN),
  sourceSha256: sha256(fs.readFileSync(GOLDEN)),
  calibrationSha256: sha256(fs.readFileSync(ORIGINAL)),
  nominalLengthM: LENGTH_M,
  gripFractionFromMuzzle: GRIP_FROM_MUZZLE,
  rotationXDeg: 90,
  uniformScale,
  gripTranslationM: normalize.elements.slice(12, 15),
  visibleBoundsM: rawBounds,
});
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
await io.write(OUTPUT, doc);

// Prova o artefato final: sem rig/câmera/mãos, sem meshopt obrigatório, texturas
// byte-idênticas e parsing pelo mesmo GLTFLoader usado em weapons.js.
const check = await io.read(OUTPUT);
const checkRoot = check.getRoot();
const checkScene = checkRoot.getDefaultScene();
const bounds = getBounds(checkScene);
const names = checkRoot.listNodes().filter((n) => n.getMesh()).map((n) => n.getName());
if (names.length !== KEEP.length || KEEP.some((name) => !names.includes(name))) throw new Error(`Meshes finais incorretos: ${names}`);
if (names.some((name) => /(?:^|_)hands?(?:_|$)|sleeve|glove|camera|light|replacement|utility/i.test(name))) throw new Error('Conteúdo de 1P/utilitário sobrou no GLB');
if (checkRoot.listSkins().length || checkRoot.listAnimations().length || checkRoot.listCameras().length) throw new Error('Rig, animação ou câmera sobrou no GLB');
if (checkRoot.listExtensionsUsed().some((e) => e.extensionName === 'EXT_meshopt_compression')) throw new Error('Saída ainda exige meshopt');
for (const material of checkRoot.listMaterials()) {
  for (const texture of new Set([
    material.getBaseColorTexture(), material.getNormalTexture(),
    material.getMetallicRoughnessTexture(), material.getOcclusionTexture(),
  ].filter(Boolean))) {
    if (textureHashes[texture.getName()] !== sha256(texture.getImage())) throw new Error(`Textura alterada: ${texture.getName()}`);
  }
}
const loaded = await parseThree(OUTPUT);
let loadedMeshes = 0, loadedCameras = 0;
loaded.scene.traverse((o) => { if (o.isMesh) loadedMeshes++; if (o.isCamera) loadedCameras++; });
if (loadedMeshes !== KEEP.length || loadedCameras) throw new Error('GLTFLoader não reconheceu a cena estática esperada');

const report = {
  output: path.relative(process.cwd(), OUTPUT),
  outputSha256: sha256(fs.readFileSync(OUTPUT)),
  meshes: names,
  materials: checkRoot.listMaterials().map((m) => m.getName()),
  textureHashes,
  calibrationPairs: pairs.length,
  calibration: { barrel, up, side },
  contract: outputRoot.getExtras().contract,
  nominalLengthM: LENGTH_M,
  visibleBoundsM: bounds,
  visibleSizeM: bounds.max.map((v, i) => v - bounds.min[i]),
  virtualFullBoundsZM: [uniformScale * (barrel.scale * sourceBox.min.x + barrel.offset - goldenGrip.y), uniformScale * (barrel.scale * sourceBox.max.x + barrel.offset - goldenGrip.y)],
  gripOriginM: [0, 0, 0],
  gltfLoaderMeshes: loadedMeshes,
  meshoptRequired: false,
};
console.log(JSON.stringify(report, null, 2));
