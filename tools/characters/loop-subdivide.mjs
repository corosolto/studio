#!/usr/bin/env node
// Uma passada de Loop por posição; UV, materiais e influências ficam por canto.
// Uso: node tools/characters/loop-subdivide.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const REPORT_PATH = resolve(ROOT, 'artifacts/lajes-b/loop-subdivision-report.json');
const JOBS = [
  ['public/models/characters/punk.glb', 'public/models/characters/punk_b.glb'],
  ['public/models/ambient/dog_caramelo.glb', 'public/models/ambient/dog_caramelo_b.glb'],
];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const accessorSha256 = (accessor) => {
  if (!accessor) return null;
  const array = accessor.getArray();
  return sha256(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
};
const positionKey = (position) => position.map((value) => Object.is(value, -0) ? 0 : value).join(',');
const edgeKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
const normalize = (vector, fallback = [0, 1, 0]) => {
  const length = Math.hypot(...vector);
  return length > 1e-20 && Number.isFinite(length)
    ? vector.map((value) => value / length)
    : [...fallback];
};

function triangleCount(primitive) {
  assert.equal(primitive.getMode(), 4, 'Loop offline aceita somente TRIANGLES');
  const count = primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount();
  assert.equal(count % 3, 0, 'índices não formam triângulos');
  return count / 3;
}

function sourceIndices(primitive) {
  const indices = primitive.getIndices()?.getArray();
  return indices ? Array.from(indices) : Array.from({ length: primitive.getAttribute('POSITION').getCount() }, (_, i) => i);
}

function blendSkin(state, oldA, oldB) {
  const jointsAccessor = state.sources.get('JOINTS_0');
  const weightsAccessor = state.sources.get('WEIGHTS_0');
  if (!jointsAccessor && !weightsAccessor) return null;
  assert(jointsAccessor && weightsAccessor, 'JOINTS_0 e WEIGHTS_0 devem vir em pares');
  const jointsA = jointsAccessor.getElement(oldA, []);
  const weightsA = weightsAccessor.getElement(oldA, []);
  if (oldB == null) {
    const sum = weightsA.reduce((total, weight) => total + weight, 0);
    assert(sum > 0 && weightsA.every((weight) => weight >= 0 && Number.isFinite(weight)), 'peso de origem inválido');
    return { joints: [...jointsA], weights: weightsA.map((weight) => weight / sum) };
  }
  const jointsB = jointsAccessor.getElement(oldB, []);
  const weightsB = weightsAccessor.getElement(oldB, []);
  const combined = new Map();
  for (const [joints, weights] of [[jointsA, weightsA], [jointsB, weightsB]]) {
    for (let slot = 0; slot < 4; slot++) {
      assert(weights[slot] >= 0 && Number.isFinite(weights[slot]), 'peso de origem inválido');
      if (weights[slot] > 0) combined.set(joints[slot], (combined.get(joints[slot]) || 0) + weights[slot] * 0.5);
    }
  }
  const selected = [...combined.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 4);
  const sum = selected.reduce((total, entry) => total + entry[1], 0);
  assert(sum > 0, 'interpolação de pele sem peso');
  const joints = selected.map((entry) => entry[0]);
  const weights = selected.map((entry) => entry[1] / sum);
  while (joints.length < 4) {
    joints.push(joints[0]);
    weights.push(0);
  }
  return { joints, weights };
}

function appendVertex(state, oldA, oldB, position, smoothKey) {
  const outputIndex = state.smoothKeys.length;
  const skin = blendSkin(state, oldA, oldB);
  for (const [semantic, source] of state.sources) {
    const output = state.values.get(semantic);
    if (semantic === 'POSITION') {
      output.push(...position);
    } else if (semantic === 'NORMAL') {
      output.push(0, 0, 0);
    } else if (semantic === 'JOINTS_0') {
      output.push(...skin.joints);
    } else if (semantic === 'WEIGHTS_0') {
      output.push(...skin.weights);
    } else {
      const a = source.getElement(oldA, []);
      const b = oldB == null ? a : source.getElement(oldB, []);
      const integer = !(source.getArray() instanceof Float32Array) && !(source.getArray() instanceof Float64Array);
      for (let component = 0; component < a.length; component++) {
        const value = oldB == null ? a[component] : (a[component] + b[component]) * 0.5;
        output.push(integer ? Math.round(value) : value);
      }
    }
  }
  if (state.sources.has('NORMAL')) {
    const normals = state.sources.get('NORMAL');
    const a = normalize(normals.getElement(oldA, []));
    const b = oldB == null ? a : normalize(normals.getElement(oldB, []));
    state.fallbackNormals.push(normalize(a.map((value, i) => oldB == null ? value : (value + b[i]) * 0.5), a));
  }
  state.smoothKeys.push(smoothKey);
  return outputIndex;
}

function smoothNormals(states) {
  const sums = new Map();
  const add = (key, cross) => {
    if (!sums.has(key)) sums.set(key, [0, 0, 0]);
    const sum = sums.get(key);
    for (let i = 0; i < 3; i++) sum[i] += cross[i];
  };
  for (const state of states) {
    const positions = state.values.get('POSITION');
    for (let triangle = 0; triangle < state.outputIndices.length; triangle += 3) {
      const ids = state.outputIndices.slice(triangle, triangle + 3);
      const points = ids.map((id) => positions.slice(id * 3, id * 3 + 3));
      const ab = points[1].map((value, i) => value - points[0][i]);
      const ac = points[2].map((value, i) => value - points[0][i]);
      const cross = [
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0],
      ];
      for (const id of ids) add(state.smoothKeys[id], cross);
    }
  }
  for (const state of states) {
    if (!state.sources.has('NORMAL')) continue;
    const normals = state.values.get('NORMAL');
    for (let vertex = 0; vertex < state.smoothKeys.length; vertex++) {
      const normal = normalize(sums.get(state.smoothKeys[vertex]) || state.fallbackNormals[vertex], state.fallbackNormals[vertex]);
      normals.splice(vertex * 3, 3, ...normal);
    }
  }
}

function subdivideMesh(document, mesh, meshIndex) {
  const buffer = document.getRoot().listBuffers()[0] || document.createBuffer();
  const primitives = mesh.listPrimitives();
  assert(primitives.length > 0, 'malha vazia');
  assert(primitives.every((primitive) => primitive.listTargets().length === 0), 'morph targets não suportados');
  const geometries = [];
  const geometryByPosition = new Map();
  const states = primitives.map((primitive, primitiveIndex) => {
    const positions = primitive.getAttribute('POSITION');
    assert(positions?.getArray() instanceof Float32Array, 'POSITION deve ser FLOAT');
    const weights = primitive.getAttribute('WEIGHTS_0');
    if (weights) assert(weights.getArray() instanceof Float32Array, 'WEIGHTS_0 deve ser FLOAT');
    const sources = new Map(primitive.listSemantics().map((semantic) => [semantic, primitive.getAttribute(semantic)]));
    const state = {
      meshIndex,
      primitiveIndex,
      primitive,
      sources,
      values: new Map([...sources].map(([semantic]) => [semantic, []])),
      sourceIndices: sourceIndices(primitive),
      sourceIndicesAccessor: primitive.getIndices(),
      geometryOfVertex: new Array(positions.getCount()),
      oldOutputIndices: [],
      outputIndices: [],
      smoothKeys: [],
      fallbackNormals: [],
      edgeCache: new Map(),
    };
    for (let vertex = 0; vertex < positions.getCount(); vertex++) {
      const point = positions.getElement(vertex, []);
      assert(point.every(Number.isFinite), 'POSITION não finita');
      const key = positionKey(point);
      if (!geometryByPosition.has(key)) {
        geometryByPosition.set(key, geometries.length);
        geometries.push([...point]);
      }
      state.geometryOfVertex[vertex] = geometryByPosition.get(key);
    }
    return state;
  });

  const edges = [];
  const edgeByKey = new Map();
  const getEdge = (a, b) => {
    const key = edgeKey(a, b);
    if (!edgeByKey.has(key)) {
      const edge = { id: edges.length, a: Math.min(a, b), b: Math.max(a, b), opposites: [] };
      edgeByKey.set(key, edge);
      edges.push(edge);
    }
    return edgeByKey.get(key);
  };
  for (const state of states) {
    for (let triangle = 0; triangle < state.sourceIndices.length; triangle += 3) {
      const local = state.sourceIndices.slice(triangle, triangle + 3);
      const geometry = local.map((vertex) => state.geometryOfVertex[vertex]);
      assert.equal(new Set(geometry).size, 3, 'triângulo degenerado por posição');
      for (let corner = 0; corner < 3; corner++) {
        getEdge(geometry[corner], geometry[(corner + 1) % 3]).opposites.push(geometry[(corner + 2) % 3]);
      }
    }
  }

  const neighbors = geometries.map(() => new Set());
  const sharpNeighbors = geometries.map(() => []);
  for (const edge of edges) {
    neighbors[edge.a].add(edge.b);
    neighbors[edge.b].add(edge.a);
    if (edge.opposites.length !== 2) {
      sharpNeighbors[edge.a].push(edge.b);
      sharpNeighbors[edge.b].push(edge.a);
    }
  }
  const vertexRules = { interior: 0, crease: 0, fixed: 0 };
  const refinedVertices = geometries.map((point, id) => {
    const sharp = sharpNeighbors[id];
    if (sharp.length === 2) {
      vertexRules.crease++;
      return point.map((value, axis) => value * 0.75 + (geometries[sharp[0]][axis] + geometries[sharp[1]][axis]) * 0.125);
    }
    // Arestas >2 faces e leques abertos viram vincos fixos, nunca remesh.
    if (sharp.length > 0 || neighbors[id].size < 3) {
      vertexRules.fixed++;
      return [...point];
    }
    vertexRules.interior++;
    const valence = neighbors[id].size;
    const beta = (5 / 8 - (3 / 8 + Math.cos(2 * Math.PI / valence) / 4) ** 2) / valence;
    return point.map((value, axis) => {
      let sum = 0;
      for (const neighbor of neighbors[id]) sum += geometries[neighbor][axis];
      return value * (1 - valence * beta) + sum * beta;
    });
  });
  const refinedEdges = edges.map((edge) => {
    if (edge.opposites.length === 2) {
      const [oppositeA, oppositeB] = edge.opposites;
      return geometries[edge.a].map((value, axis) =>
        value * 0.375 + geometries[edge.b][axis] * 0.375
        + geometries[oppositeA][axis] * 0.125 + geometries[oppositeB][axis] * 0.125);
    }
    return geometries[edge.a].map((value, axis) => (value + geometries[edge.b][axis]) * 0.5);
  });

  for (const state of states) {
    for (let vertex = 0; vertex < state.geometryOfVertex.length; vertex++) {
      const geometry = state.geometryOfVertex[vertex];
      state.oldOutputIndices[vertex] = appendVertex(state, vertex, null, refinedVertices[geometry], `v:${geometry}`);
    }
    const edgeVertex = (oldA, oldB) => {
      const geometryA = state.geometryOfVertex[oldA];
      const geometryB = state.geometryOfVertex[oldB];
      const edge = edgeByKey.get(edgeKey(geometryA, geometryB));
      const low = Math.min(oldA, oldB);
      const high = Math.max(oldA, oldB);
      const cacheKey = `${edge.id}:${low}:${high}`;
      if (!state.edgeCache.has(cacheKey)) {
        state.edgeCache.set(cacheKey, appendVertex(state, oldA, oldB, refinedEdges[edge.id], `e:${edge.id}`));
      }
      return state.edgeCache.get(cacheKey);
    };
    for (let triangle = 0; triangle < state.sourceIndices.length; triangle += 3) {
      const [a, b, c] = state.sourceIndices.slice(triangle, triangle + 3);
      const oldA = state.oldOutputIndices[a];
      const oldB = state.oldOutputIndices[b];
      const oldC = state.oldOutputIndices[c];
      const ab = edgeVertex(a, b);
      const bc = edgeVertex(b, c);
      const ca = edgeVertex(c, a);
      state.outputIndices.push(oldA, ab, ca, ab, oldB, bc, ca, bc, oldC, ab, bc, ca);
    }
  }
  smoothNormals(states);

  const primitiveReports = [];
  for (const state of states) {
    for (const [semantic, source] of state.sources) {
      const ArrayType = source.getArray().constructor;
      const accessor = document.createAccessor()
        .setType(source.getType())
        .setNormalized(source.getNormalized())
        .setArray(new ArrayType(state.values.get(semantic)))
        .setBuffer(buffer);
      state.primitive.setAttribute(semantic, accessor);
    }
    const IndexType = state.smoothKeys.length > 65535 ? Uint32Array : Uint16Array;
    state.primitive.setIndices(document.createAccessor()
      .setType('SCALAR')
      .setArray(new IndexType(state.outputIndices))
      .setBuffer(buffer));
    primitiveReports.push({
      mesh: mesh.getName(),
      primitive: state.primitiveIndex,
      material: state.primitive.getMaterial()?.getName() || null,
      verticesBefore: state.sources.get('POSITION').getCount(),
      verticesAfter: state.smoothKeys.length,
      trianglesBefore: state.sourceIndices.length / 3,
      trianglesAfter: state.outputIndices.length / 3,
    });
  }
  return {
    states,
    primitiveReports,
    topology: {
      uniquePositions: geometries.length,
      edges: edges.length,
      boundaryEdges: edges.filter((edge) => edge.opposites.length === 1).length,
      nonManifoldEdges: edges.filter((edge) => edge.opposites.length > 2).length,
      vertexRules,
    },
  };
}

function textureSnapshot(texture) {
  if (!texture) return null;
  return { name: texture.getName(), mimeType: texture.getMimeType(), imageSha256: sha256(texture.getImage()) };
}

function metadataSnapshot(document) {
  const root = document.getRoot();
  const nodes = root.listNodes();
  const meshes = root.listMeshes();
  const skins = root.listSkins();
  const materials = root.listMaterials();
  const nodeIds = new Map(nodes.map((node, index) => [node, index]));
  const meshIds = new Map(meshes.map((mesh, index) => [mesh, index]));
  const skinIds = new Map(skins.map((skin, index) => [skin, index]));
  const materialIds = new Map(materials.map((material, index) => [material, index]));
  return {
    scenes: root.listScenes().map((scene) => ({ name: scene.getName(), children: scene.listChildren().map((node) => nodeIds.get(node)) })),
    nodes: nodes.map((node) => ({
      name: node.getName(),
      translation: node.getTranslation(),
      rotation: node.getRotation(),
      scale: node.getScale(),
      children: node.listChildren().map((child) => nodeIds.get(child)),
      mesh: node.getMesh() ? meshIds.get(node.getMesh()) : null,
      skin: node.getSkin() ? skinIds.get(node.getSkin()) : null,
    })),
    meshes: meshes.map((mesh) => ({
      name: mesh.getName(),
      primitives: mesh.listPrimitives().map((primitive) => ({
        mode: primitive.getMode(),
        material: primitive.getMaterial() ? materialIds.get(primitive.getMaterial()) : null,
        semantics: primitive.listSemantics().sort(),
        targets: primitive.listTargets().length,
      })),
    })),
    skins: skins.map((skin) => ({
      name: skin.getName(),
      joints: skin.listJoints().map((joint) => nodeIds.get(joint)),
      skeleton: skin.getSkeleton() ? nodeIds.get(skin.getSkeleton()) : null,
      inverseBindMatricesSha256: accessorSha256(skin.getInverseBindMatrices()),
      inverseBindMatricesCount: skin.getInverseBindMatrices()?.getCount() || 0,
    })),
    materials: materials.map((material) => ({
      name: material.getName(),
      baseColorFactor: material.getBaseColorFactor(),
      metallicFactor: material.getMetallicFactor(),
      roughnessFactor: material.getRoughnessFactor(),
      emissiveFactor: material.getEmissiveFactor(),
      alphaMode: material.getAlphaMode(),
      alphaCutoff: material.getAlphaCutoff(),
      doubleSided: material.getDoubleSided(),
      normalScale: material.getNormalScale(),
      occlusionStrength: material.getOcclusionStrength(),
      baseColorTexture: textureSnapshot(material.getBaseColorTexture()),
      metallicRoughnessTexture: textureSnapshot(material.getMetallicRoughnessTexture()),
      normalTexture: textureSnapshot(material.getNormalTexture()),
      occlusionTexture: textureSnapshot(material.getOcclusionTexture()),
      emissiveTexture: textureSnapshot(material.getEmissiveTexture()),
    })),
    textures: root.listTextures().map(textureSnapshot),
    animations: root.listAnimations().map((animation) => ({
      name: animation.getName(),
      channels: animation.listChannels().map((channel) => ({
        targetNode: nodeIds.get(channel.getTargetNode()),
        targetPath: channel.getTargetPath(),
        interpolation: channel.getSampler().getInterpolation(),
        inputSha256: accessorSha256(channel.getSampler().getInput()),
        outputSha256: accessorSha256(channel.getSampler().getOutput()),
      })),
    })),
  };
}

function assertFiniteAccessors(document) {
  let values = 0;
  for (const accessor of document.getRoot().listAccessors()) {
    for (const value of accessor.getArray()) {
      assert(Number.isFinite(value), `accessor ${accessor.getName()} contém NaN/Infinity`);
      values++;
    }
  }
  return values;
}

function validateOutput(source, output, states) {
  assert.deepEqual(metadataSnapshot(output), metadataSnapshot(source), 'rig, materiais, texturas, nós ou clipes mudaram');
  const finiteValues = assertFiniteAccessors(output);
  const maxJoints = Math.max(...output.getRoot().listSkins().map((skin) => skin.listJoints().length), 0);
  let weightVertices = 0;
  let normalVertices = 0;
  for (const mesh of output.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    const weights = primitive.getAttribute('WEIGHTS_0');
    const joints = primitive.getAttribute('JOINTS_0');
    if (weights || joints) {
      assert(weights && joints, 'pele incompleta no output');
      assert.equal(weights.getCount(), joints.getCount());
      for (let vertex = 0; vertex < weights.getCount(); vertex++) {
        const w = weights.getElement(vertex, []);
        const j = joints.getElement(vertex, []);
        assert(w.every((value) => value >= 0 && Number.isFinite(value)), 'peso negativo ou não finito');
        assert(Math.abs(w.reduce((sum, value) => sum + value, 0) - 1) < 1e-5, 'pesos não normalizados');
        assert(j.every((value) => Number.isInteger(value) && value >= 0 && (maxJoints === 0 || value < maxJoints)), 'skinIndex inválido');
        weightVertices++;
      }
    }
    const normals = primitive.getAttribute('NORMAL');
    if (normals) {
      for (let vertex = 0; vertex < normals.getCount(); vertex++) {
        const normal = normals.getElement(vertex, []);
        assert(Math.abs(Math.hypot(...normal) - 1) < 1e-4, 'normal nula ou não unitária');
        normalVertices++;
      }
    }
  }

  let uvCornersPreserved = 0;
  let skinCornersPreserved = 0;
  for (const state of states) {
    const sourcePrimitive = source.getRoot().listMeshes()[state.meshIndex].listPrimitives()[state.primitiveIndex];
    const outputPrimitive = output.getRoot().listMeshes()[state.meshIndex].listPrimitives()[state.primitiveIndex];
    for (const semantic of state.sources.keys()) {
      if (semantic === 'POSITION' || semantic === 'NORMAL') continue;
      const before = sourcePrimitive.getAttribute(semantic);
      const after = outputPrimitive.getAttribute(semantic);
      for (let oldVertex = 0; oldVertex < state.oldOutputIndices.length; oldVertex++) {
        const a = before.getElement(oldVertex, []);
        const b = after.getElement(state.oldOutputIndices[oldVertex], []);
        if (semantic === 'WEIGHTS_0') {
          assert(a.every((value, i) => Math.abs(value - b[i]) < 1e-5), 'peso de vértice antigo mudou');
        } else {
          assert.deepEqual(b, a, `${semantic} de vértice antigo mudou`);
        }
      }
      if (semantic.startsWith('TEXCOORD_')) uvCornersPreserved += state.oldOutputIndices.length;
      if (semantic === 'JOINTS_0') skinCornersPreserved += state.oldOutputIndices.length;
    }
  }
  return { finiteValues, weightVertices, normalVertices, uvCornersPreserved, skinCornersPreserved };
}

const reports = [];
for (const [sourceRelative, outputRelative] of JOBS) {
  const sourcePath = resolve(ROOT, sourceRelative);
  const outputPath = resolve(ROOT, outputRelative);
  assert.notEqual(resolve(outputPath), resolve(sourcePath), 'o original nunca pode ser sobrescrito');
  assert(outputPath.endsWith('_b.glb'), 'output deve ter sufixo _b');
  const sourceSha256 = sha256(readFileSync(sourcePath));
  const source = await io.read(sourcePath);
  const document = await io.read(sourcePath);
  assertFiniteAccessors(source);
  const trianglesBefore = source.getRoot().listMeshes().reduce((sum, mesh) =>
    sum + mesh.listPrimitives().reduce((meshSum, primitive) => meshSum + triangleCount(primitive), 0), 0);

  const subdivisions = document.getRoot().listMeshes().map((mesh, meshIndex) => subdivideMesh(document, mesh, meshIndex));
  const states = subdivisions.flatMap((subdivision) => subdivision.states);
  const oldAccessors = new Set();
  for (const state of states) {
    for (const accessor of state.sources.values()) oldAccessors.add(accessor);
    if (state.sourceIndicesAccessor) oldAccessors.add(state.sourceIndicesAccessor);
  }
  // Não usar prune(): folhas nomeadas do rig são contrato dos clipes externos.
  for (const accessor of oldAccessors) {
    if (accessor.listParents().every((parent) => parent.propertyType === 'Root')) accessor.dispose();
  }
  const trianglesAfter = document.getRoot().listMeshes().reduce((sum, mesh) =>
    sum + mesh.listPrimitives().reduce((meshSum, primitive) => meshSum + triangleCount(primitive), 0), 0);
  assert.equal(trianglesAfter, trianglesBefore * 4, 'subdivisão não produziu exatamente 4x triângulos');

  mkdirSync(dirname(outputPath), { recursive: true });
  await io.write(outputPath, document);
  const output = await io.read(outputPath);
  const validation = validateOutput(source, output, states);
  assert.equal(sha256(readFileSync(sourcePath)), sourceSha256, 'o original mudou durante a execução');
  const metadata = metadataSnapshot(output);
  const report = {
    source: sourceRelative,
    output: outputRelative,
    algorithm: 'Loop, uma passada, topologia por posição exata; boundaries/vincos preservados; normais suaves por posição',
    sourceSha256,
    outputSha256: sha256(readFileSync(outputPath)),
    sourceUnchanged: true,
    bytesBefore: statSync(sourcePath).size,
    bytesAfter: statSync(outputPath).size,
    trianglesBefore,
    trianglesAfter,
    ratio: trianglesAfter / trianglesBefore,
    topology: subdivisions.map((subdivision) => subdivision.topology),
    primitives: subdivisions.flatMap((subdivision) => subdivision.primitiveReports),
    preserved: {
      nodeNames: metadata.nodes.map((node) => node.name),
      skins: metadata.skins,
      materials: metadata.materials.map((material) => material.name),
      textureImageSha256: metadata.textures.map((texture) => texture.imageSha256),
      animations: metadata.animations.map((animation) => animation.name),
      ...validation,
      note: 'Vértices antigos mantêm UV/JOINTS; WEIGHTS antigos diferem no máximo 1e-5 por renormalização. Novos pesos interpolam até quatro influências e somam 1.',
    },
  };
  reports.push(report);
  console.log(`${sourceRelative}: ${trianglesBefore} -> ${trianglesAfter} tri | ${outputRelative}`);
}
mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify({ generator: 'tools/characters/loop-subdivide.mjs', assets: reports }, null, 2)}\n`);
console.log(`Relatório: ${relative(ROOT, REPORT_PATH)}`);
