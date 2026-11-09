import { open } from 'node:fs/promises';

const glbMagic = 0x46546c67;
const jsonChunkType = 0x4e4f534a;
const binChunkType = 0x004e4942;
const maximumJsonBytes = 16 * 1024 * 1024;
const maximumBinBytes = 256 * 1024 * 1024;
const componentBytes = new Map([[5120, 1], [5121, 1], [5122, 2], [5123, 2], [5125, 4], [5126, 4]]);
const typeComponents = new Map([['SCALAR', 1], ['VEC2', 2], ['VEC3', 3], ['VEC4', 4], ['MAT2', 4], ['MAT3', 9], ['MAT4', 16]]);

function fail(label, message) {
  throw new Error(`GLB validation failed for ${label}: ${message}`);
}

function integer(value) {
  return Number.isInteger(value) && value >= 0;
}

// Parses and bounds-checks the GLB 2 container, buffer views and accessors without
// interpreting any scene content. Returns the JSON document and the BIN chunk bytes.
// `allowMeshoptFallback` also accepts the EXT_meshopt_compression layout the animation
// converter emits (buffer 0 = compressed stream in the BIN chunk, further buffers marked
// `EXT_meshopt_compression.fallback` = virtual uncompressed views that exist only logically);
// callers that read raw component bytes (the character model) keep the strict single buffer.
export async function readGlb(absolute, label = absolute, { allowMeshoptFallback = false } = {}) {
  const handle = await open(absolute, 'r');
  try {
    const { size } = await handle.stat();
    const header = Buffer.alloc(20);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead !== header.length || header.readUInt32LE(0) !== glbMagic || header.readUInt32LE(4) !== 2) {
      fail(label, 'invalid GLB 2 header');
    }
    if (header.readUInt32LE(8) !== size || header.readUInt32LE(16) !== jsonChunkType) fail(label, 'invalid length or JSON chunk');
    const jsonBytes = header.readUInt32LE(12);
    if (jsonBytes < 1 || jsonBytes > maximumJsonBytes || 20 + jsonBytes + 8 > size) fail(label, 'invalid JSON chunk size');
    const jsonBuffer = Buffer.alloc(jsonBytes);
    if ((await handle.read(jsonBuffer, 0, jsonBytes, 20)).bytesRead !== jsonBytes) fail(label, 'truncated JSON chunk');
    const binHeader = Buffer.alloc(8);
    if ((await handle.read(binHeader, 0, 8, 20 + jsonBytes)).bytesRead !== 8 || binHeader.readUInt32LE(4) !== binChunkType) {
      fail(label, 'missing BIN chunk');
    }
    const binBytes = binHeader.readUInt32LE(0);
    const binStart = 28 + jsonBytes;
    if (binBytes > maximumBinBytes || binStart + binBytes !== size) fail(label, 'BIN chunk does not exactly match the file length');
    const bin = Buffer.alloc(binBytes);
    if ((await handle.read(bin, 0, binBytes, binStart)).bytesRead !== binBytes) fail(label, 'truncated BIN chunk');
    const document = JSON.parse(jsonBuffer.toString('utf8').trim());
    if (!Array.isArray(document.accessors) || !Array.isArray(document.bufferViews) || !Array.isArray(document.buffers)) {
      fail(label, 'missing accessor, bufferView or buffer inventories');
    }
    const meshoptFallback = allowMeshoptFallback && document.buffers.slice(1).every(
      buffer => buffer.uri === undefined && integer(buffer.byteLength)
        && buffer.extensions?.EXT_meshopt_compression?.fallback === true,
    );
    if (document.buffers[0].uri !== undefined || !integer(document.buffers[0].byteLength) || document.buffers[0].byteLength > binBytes
      || (document.buffers.length > 1 && !meshoptFallback)) {
      fail(label, 'GLB must contain one self-contained buffer within the BIN chunk');
    }

    for (const [index, view] of document.bufferViews.entries()) {
      if (!integer(view.byteOffset ?? 0) || !integer(view.byteLength) || view.byteLength < 1) fail(label, `invalid bufferView ${index}`);
      const offset = view.byteOffset ?? 0;
      const compression = view.extensions?.EXT_meshopt_compression;
      if (view.buffer === 0) {
        if (offset + view.byteLength > document.buffers[0].byteLength || offset + view.byteLength > binBytes) fail(label, `bufferView ${index} exceeds its buffer`);
      } else if (meshoptFallback && compression !== undefined
        && document.buffers[view.buffer]?.extensions?.EXT_meshopt_compression?.fallback === true) {
        // The bytes live in the compressed stream: bounds-check the stream range instead.
        const streamOffset = compression.byteOffset ?? 0;
        if (compression.buffer !== 0 || !integer(streamOffset) || !integer(compression.byteLength) || compression.byteLength < 1
          || streamOffset + compression.byteLength > document.buffers[0].byteLength) {
          fail(label, `bufferView ${index} has an out-of-bounds meshopt stream`);
        }
      } else {
        fail(label, `bufferView ${index} exceeds its buffer`);
      }
      if (view.byteStride !== undefined && (!integer(view.byteStride) || view.byteStride < 4 || view.byteStride > 256 || view.byteStride % 4 !== 0)) {
        fail(label, `invalid byteStride on bufferView ${index}`);
      }
    }
    for (const [index, accessor] of document.accessors.entries()) {
      const componentSize = componentBytes.get(accessor.componentType);
      const components = typeComponents.get(accessor.type);
      if (!componentSize || !components || !integer(accessor.count) || !integer(accessor.byteOffset ?? 0)) fail(label, `invalid accessor ${index}`);
      if (accessor.sparse !== undefined) fail(label, `sparse accessor ${index} is not supported by this export gate`);
      if (accessor.bufferView === undefined) {
        if (accessor.count !== 0) fail(label, `non-empty accessor ${index} has no bufferView`);
        continue;
      }
      const view = document.bufferViews[accessor.bufferView];
      if (!view) fail(label, `accessor ${index} references an invalid bufferView`);
      const elementBytes = componentSize * components;
      const stride = view.byteStride ?? elementBytes;
      if (stride < elementBytes || stride % componentSize !== 0) fail(label, `accessor ${index} has an incompatible stride`);
      const relativeEnd = (accessor.byteOffset ?? 0) + (accessor.count ? (accessor.count - 1) * stride + elementBytes : 0);
      if (relativeEnd > view.byteLength || (accessor.byteOffset ?? 0) % componentSize !== 0) fail(label, `accessor ${index} exceeds its bufferView or alignment`);
    }
    return { document, bin };
  } finally {
    await handle.close();
  }
}

// Reads one numeric component of an accessor already bounds-checked by readGlb.
export function readAccessorComponent(document, bin, label, accessor, element, component = 0) {
  const view = document.bufferViews[accessor.bufferView];
  const components = typeComponents.get(accessor.type);
  const stride = view.byteStride ?? componentBytes.get(accessor.componentType) * components;
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + element * stride + component * componentBytes.get(accessor.componentType);
  if (accessor.componentType === 5126) return bin.readFloatLE(offset);
  if (accessor.componentType === 5125) return bin.readUInt32LE(offset);
  if (accessor.componentType === 5123) return bin.readUInt16LE(offset);
  if (accessor.componentType === 5121) return bin.readUInt8(offset);
  fail(label, 'unsupported numeric component in POSITION or index accessor');
}

// `includeBin` keeps the BIN chunk in the result for callers that read more accessors;
// it is off by default so LOD inspection does not retain every BIN chunk.
export async function inspectGlb(absolute, label = absolute, { includeBin = false } = {}) {
  const { document, bin } = await readGlb(absolute, label);
  if (!Array.isArray(document.meshes)) fail(label, 'missing mesh inventory');
  const readComponent = (accessor, element, component = 0) => readAccessorComponent(document, bin, label, accessor, element, component);

  let primitives = 0;
  let triangles = 0;
  let positionValuesChecked = 0;
  let indexValuesChecked = 0;
  for (const mesh of document.meshes) {
    if (!Array.isArray(mesh.primitives)) fail(label, 'mesh has no primitive array');
    for (const primitive of mesh.primitives) {
      primitives += 1;
      const position = document.accessors[primitive.attributes?.POSITION];
      if (!position || position.type !== 'VEC3' || position.componentType !== 5126 || position.count < 1) fail(label, 'primitive needs a finite float VEC3 POSITION accessor');
      for (let vertex = 0; vertex < position.count; vertex += 1) {
        for (let component = 0; component < 3; component += 1) {
          if (!Number.isFinite(readComponent(position, vertex, component))) fail(label, `non-finite POSITION at vertex ${vertex}`);
        }
      }
      positionValuesChecked += position.count;

      let elementCount = position.count;
      if (primitive.indices !== undefined) {
        const indices = document.accessors[primitive.indices];
        if (!indices || indices.type !== 'SCALAR' || ![5121, 5123, 5125].includes(indices.componentType) || indices.count < 1) fail(label, 'invalid index accessor');
        for (let index = 0; index < indices.count; index += 1) {
          if (readComponent(indices, index) >= position.count) fail(label, `index ${index} exceeds POSITION count ${position.count}`);
        }
        indexValuesChecked += indices.count;
        elementCount = indices.count;
      }
      if ((primitive.mode ?? 4) === 4) {
        if (elementCount % 3 !== 0) fail(label, 'triangle primitive count is not divisible by three');
        triangles += elementCount / 3;
      }
    }
  }
  return { primitives, triangles, positionValuesChecked, indexValuesChecked, document, ...(includeBin ? { bin } : {}) };
}
