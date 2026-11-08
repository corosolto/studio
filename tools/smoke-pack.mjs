#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLajesPack } from './build-lajes-pack.mjs';
import { validateLajesGauntlet } from './lib/lajes-gauntlet.mjs';
import { validatePack } from './lib/pack.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const validator = path.join(root, 'tools/validate-pack.mjs');
const builder = path.join(root, 'tools/build-lajes-pack.mjs');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-pack-'));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const clone = value => JSON.parse(JSON.stringify(value));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const jsonBytes = value => Buffer.from(JSON.stringify(value));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function glbFixture(trianglesPerPrimitive, primitiveCount) {
  const vertexCount = trianglesPerPrimitive * 3;
  const positions = Buffer.alloc(vertexCount * 3 * 4);
  const indices = Buffer.alloc(vertexCount * 2);
  for (let index = 0; index < vertexCount; index += 1) {
    positions.writeFloatLE((index % 13) * 0.01, index * 12);
    positions.writeFloatLE((index % 7) * 0.01, index * 12 + 4);
    positions.writeFloatLE(0, index * 12 + 8);
    indices.writeUInt16LE(index, index * 2);
  }
  const bin = Buffer.concat([positions, indices]);
  const document = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.length, target: 34962 },
      { buffer: 0, byteOffset: positions.length, byteLength: indices.length, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: vertexCount, type: 'VEC3' },
      { bufferView: 1, componentType: 5123, count: vertexCount, type: 'SCALAR' },
    ],
    meshes: [{ primitives: Array.from({ length: primitiveCount }, () => ({ attributes: { POSITION: 0 }, indices: 1, mode: 4 })) }],
  };
  const json = Buffer.from(JSON.stringify(document));
  const paddedJsonBytes = Math.ceil(json.length / 4) * 4;
  const paddedBinBytes = Math.ceil(bin.length / 4) * 4;
  const bytes = Buffer.alloc(28 + paddedJsonBytes + paddedBinBytes, 0x20);
  bytes.writeUInt32LE(0x46546c67, 0);
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(paddedJsonBytes, 12);
  bytes.writeUInt32LE(0x4e4f534a, 16);
  json.copy(bytes, 20);
  bytes.writeUInt32LE(paddedBinBytes, 20 + paddedJsonBytes);
  bytes.writeUInt32LE(0x004e4942, 24 + paddedJsonBytes);
  bin.copy(bytes, 28 + paddedJsonBytes);
  return bytes;
}

async function expectRejection(label, operation) {
  let rejected = false;
  try { await operation(); } catch { rejected = true; }
  if (!rejected) throw new Error(`${label} was not rejected`);
  console.log(`PASS ${label} rejected`);
}

try {
  const staging = path.join(directory, 'private-staging');
  const output = path.join(directory, 'private-candidates/map/lajes/0.1.0');
  const reportPath = path.join(staging, 'scene-report.json');
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'maps/lajes/gauntlet/fixtures/scene-report.valid.json'), 'utf8'));
  const lowGlb = glbFixture(300, 1);
  const mediumGlb = glbFixture(500, 2);
  Object.assign(fixture.lods.low, { bytes: lowGlb.length, sha256: sha256(lowGlb), primitives: 1 });
  Object.assign(fixture.lods.medium, { bytes: mediumGlb.length, sha256: sha256(mediumGlb), primitives: 2 });
  const exportRecord = (profile, bytes, primitives, positions, indices) => ({
    path: fixture.lods[profile].path,
    bytes: bytes.length,
    sha256: sha256(bytes),
    passed: true,
    errors: [],
    checks: {
      all_indices_in_bounds_and_below_position_count: true,
      all_position_accessors_in_bounds_and_finite: true,
      glb_2_header_and_lengths: true,
      json_and_bin_chunks_within_file: true,
      index_values_checked: indices,
      position_values_checked: positions,
      primitive_count: primitives,
    },
  });
  fixture.export_validation = {
    schema_version: 1,
    passed: true,
    medium_primitive_budget_passed: true,
    low_primitive_budget_passed: true,
    medium: exportRecord('medium', mediumGlb, 2, 3000, 3000),
    low: exportRecord('low', lowGlb, 1, 900, 900),
  };
  const exportValidationFixture = clone(fixture.export_validation);
  const collisionFixture = {
    box_count: 4,
    boxes: [
      { id: 'floor', object: 'Walkable floor', role: 'continuous alley floor', shape: 'axis_aligned_bounds', min_m: [-2, -1, -0.2], max_m: [2, 21, 0] },
      { id: 'wall', object: 'Off-route wall', role: 'facade masonry', shape: 'axis_aligned_bounds', min_m: [2, -1, 0], max_m: [2.2, 21, 3] },
      { id: 'stair-1', object: 'First stair', role: 'flight 1 riser 1; top 0.15 m', shape: 'axis_aligned_bounds', min_m: [-0.67, 8, -0.15], max_m: [0.67, 8.3, 0.15] },
      { id: 'stair-2', object: 'Second stair', role: 'flight 1 riser 2; top 0.30 m', shape: 'axis_aligned_bounds', min_m: [-0.67, 8.3, 0], max_m: [0.67, 8.6, 0.3] },
    ],
  };
  const navigationFixture = {
    schema_version: 1,
    bidirectional: true,
    agent: { eye_height_m: 1.65, radius_m: 0.3, step_height_max_m: 0.175 },
    nodes: [
      { id: 'spawn_alley', position_m: [0, 0, 0] },
      { id: 'alley_mid', position_m: [0, 5, 0] },
      { id: 'stair_base', position_m: [0, 8, 0] },
      { id: 'roof_water_tank', position_m: [0, 20, 6] },
    ],
    edges: [
      { from: 'spawn_alley', to: 'alley_mid', kind: 'walk', clear_width_m: 1.2 },
      { from: 'alley_mid', to: 'stair_base', kind: 'walk', clear_width_m: 1.2 },
      { from: 'stair_base', to: 'roof_water_tank', kind: 'stairs', clear_width_m: 1.2, riser_m: 0.15, risers: 40, tread_m: 0.3 },
    ],
  };
  const spawnFixture = { spawns: [
    { id: 'spawn', position_m: [0, 0, 0], eye_height_m: 1.65, region: 'alley' },
    { id: 'corner', position_m: [3, 5, 0], eye_height_m: 1.65, region: 'commercial_corner' },
    { id: 'rooftop', position_m: [0, 8, 6], eye_height_m: 1.65, region: 'west_rooftop' },
  ] };
  const regionsFixture = { regions: [
    { id: 'alley', traversable: true, min_m: [-2, -1, -0.2], max_m: [2, 21, 3.2] },
    { id: 'commercial_corner', traversable: true, min_m: [2, -6, -0.2], max_m: [8, 8, 4.3] },
    { id: 'west_rooftop', traversable: true, min_m: [-2, -2, 5.5], max_m: [2, 10, 8.8] },
  ] };
  const fixtureFiles = {
    'geometry/scene.bin': Buffer.from('metric-geometry'),
    'textures/wall.png': png,
    'lods/low/scene.glb': lowGlb,
    'lods/medium/scene.glb': mediumGlb,
    'lods/export-validation.json': jsonBytes(exportValidationFixture),
    'previews/route-sequence.json': jsonBytes(fixture.route_sequence),
    'collision/collision-boxes.json': jsonBytes(collisionFixture),
    'navigation/nav-graph.json': jsonBytes(navigationFixture),
    'spawns/spawns.json': jsonBytes(spawnFixture),
    'regions/regions.json': jsonBytes(regionsFixture),
  };
  for (const [relative, bytes] of Object.entries(fixtureFiles)) {
    const destination = path.join(staging, ...relative.split('/'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
  }
  for (const camera of fixture.cameras.cameras) {
    const destination = path.join(staging, ...camera.preview.split('/'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, png);
  }
  for (const capture of fixture.low_captures) {
    const destination = path.join(staging, ...capture.path.split('/'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, png);
  }
  for (const frame of fixture.route_sequence.frames) {
    const destination = path.join(staging, ...frame.path.split('/'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, png);
  }
  writeJson(reportPath, fixture);
  await validateLajesGauntlet({ reportPath, stagingRoot: staging });
  console.log('PASS Valid synthetic Lajes scene report and fixed-camera evidence');
  const acceptedEvidence = path.join(directory, 'accepted-loop-02');
  fs.mkdirSync(acceptedEvidence);
  for (const capture of [...fixture.captures, ...fixture.low_captures, ...fixture.route_sequence.frames]) {
    const destination = path.join(acceptedEvidence, ...capture.public_evidence.split('/'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, png);
  }
  await validateLajesGauntlet({ reportPath, stagingRoot: staging, evidenceRoot: acceptedEvidence });
  console.log('PASS Explicit accepted evidence root and public capture paths');

  execFileSync(process.execPath, [
    builder,
    '--staging', staging,
    '--output', output,
    '--revision', 'abcdef1234567',
    '--provenance', 'Deterministic synthetic smoke fixture; not a release',
  ], { stdio: 'pipe' });
  const manifestPath = path.join(output, 'manifest.json');
  execFileSync(process.execPath, [validator, manifestPath, output], { stdio: 'pipe' });
  console.log('PASS Atomic private Lajes candidate build and byte verification');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.lods['export-validation']) throw new Error('LOD validation sidecar was misclassified as a model profile');
  if (!manifest.evidence.includes('lods/export-validation.json')) throw new Error('LOD validation sidecar is missing from evidence');
  console.log('PASS LOD validation sidecar is evidence, not a model profile');
  async function packMutant(label, mutate) {
    const mutant = clone(manifest);
    mutate(mutant);
    writeJson(manifestPath, mutant);
    await expectRejection(label, () => validatePack({ manifestPath, packageRoot: output }));
  }
  await packMutant('Absent low LOD', value => { delete value.lods.low; });
  await packMutant('Missing collision declaration', value => { delete value.collision; });
  await packMutant('Unsafe package path', value => { value.files[0].path = '../escape.bin'; });
  await packMutant('Duplicate file path', value => { value.files[1].path = value.files[0].path; });
  await packMutant('Duplicate role path', value => { value.collision[0] = value.geometry[0]; });
  await packMutant('Hash-mutated pack', value => { value.files[0].sha256 = '0'.repeat(64); });
  await packMutant('Size-mutated pack', value => { value.files[0].bytes += 1; });
  await packMutant('Executable JavaScript', value => {
    value.files.push({ path: 'evidence/injected.mjs', sha256: createHash('sha256').update('x').digest('hex'), bytes: 1 });
  });
  await packMutant('Declared path absent from files', value => { value.geometry[0] = 'geometry/missing.bin'; });
  await packMutant('Undeclared map file', value => {
    value.files.push({ path: 'evidence/orphan.bin', sha256: createHash('sha256').update('x').digest('hex'), bytes: 1 });
  });
  const shebangBytes = Buffer.from('#!/usr/bin/env node\nconsole.log("forbidden");\n');
  const shebangPath = path.join(output, 'evidence/shebang.bin');
  fs.mkdirSync(path.dirname(shebangPath), { recursive: true });
  fs.writeFileSync(shebangPath, shebangBytes);
  await packMutant('Disguised executable shebang', value => {
    value.evidence.push('evidence/shebang.bin');
    value.files.push({ path: 'evidence/shebang.bin', sha256: createHash('sha256').update(shebangBytes).digest('hex'), bytes: shebangBytes.length });
  });
  fs.rmSync(shebangPath);
  writeJson(manifestPath, manifest);
  await validatePack({ manifestPath, packageRoot: output });

  const geometryPath = path.join(output, manifest.geometry[0]);
  const geometryBytes = fs.readFileSync(geometryPath);
  const outsidePath = path.join(directory, 'outside.bin');
  fs.writeFileSync(outsidePath, geometryBytes);
  fs.rmSync(geometryPath);
  fs.symlinkSync(outsidePath, geometryPath);
  await expectRejection('Symlink escaping package root', () => validatePack({ manifestPath, packageRoot: output }));
  fs.rmSync(geometryPath);
  fs.writeFileSync(geometryPath, geometryBytes);

  async function reportMutant(label, mutate) {
    const mutant = clone(fixture);
    mutate(mutant);
    writeJson(reportPath, mutant);
    await expectRejection(label, () => validateLajesGauntlet({ reportPath, stagingRoot: staging }));
  }
  await reportMutant('Missing rooftop route', value => { delete value.routes.rooftop; });
  await reportMutant('Missing fixed camera', value => { value.cameras.cameras = value.cameras.cameras.filter(camera => camera.id !== 'rooftop'); });
  await reportMutant('Non-zenith sky camera', value => { value.cameras.cameras.find(camera => camera.id === 'sky').target_m = [20, 8, 8]; });
  await reportMutant('Spawn camera position mismatch', value => { value.cameras.cameras.find(camera => camera.id === 'spawn').location_m[0] = 0.1; });
  await reportMutant('Corner camera position mismatch', value => { value.cameras.cameras.find(camera => camera.id === 'corner').location_m[1] = 0; });
  await reportMutant('Narrow alley route', value => { value.routes.alley.minClearWidthMeters = 1.19; });
  await reportMutant('Narrow rooftop route', value => { value.routes.rooftop.minClearWidthMeters = 1.19; });
  await reportMutant('Narrow stair clear width', value => { value.construction_facts.stairs.clear_width_m = 1.19; });
  await reportMutant('Undersized roof parapet', value => { value.roof_access.roof_parapet_height_m = 1.09; });
  await reportMutant('Missing west tank service assertion', value => { value.roof_access.west_tank_service_perimeter_at_least_0_60_m = false; });
  await reportMutant('Insufficient west tank route clearance', value => { value.roof_access.west_tank_plinth_to_route_clearance_m = 0.59; });
  await reportMutant('Missing second water tank', value => { value.construction_facts.water_tanks.count = 1; });
  await reportMutant('Undersized clear door', value => { value.construction_facts.doors.clear_width_m = 0.89; });
  await reportMutant('Oversized stair riser', value => { value.construction_facts.stairs.riser_m = 0.176; });
  await reportMutant('Duplicate medium and low LOD paths', value => { value.lods.low.path = value.lods.medium.path; });
  await reportMutant('Non-positive low triangle count', value => { value.lods.low.triangles = 0; });
  await reportMutant('Low LOD not smaller than medium', value => { value.lods.low.triangles = value.lods.medium.triangles; });
  await reportMutant('Medium LOD triangle budget', value => { value.lods.medium.triangles = 100001; });
  await reportMutant('Low LOD triangle budget', value => { value.lods.low.triangles = 32001; });
  await reportMutant('Medium LOD primitive budget', value => { value.lods.medium.primitives = 91; });
  await reportMutant('Low LOD primitive budget', value => { value.lods.low.primitives = 41; });
  await reportMutant('GLB primitive count mismatch', value => { value.lods.medium.primitives = 3; });
  await reportMutant('GLB triangle count mismatch', value => { value.lods.medium.triangles = 1001; });
  await reportMutant('Hash-mutated LOD evidence', value => { value.lods.low.sha256 = '0'.repeat(64); });
  await reportMutant('Absent low capture set', value => { delete value.low_captures; });
  await reportMutant('Missing low capture', value => { value.low_captures = value.low_captures.filter(capture => capture.camera !== 'sky'); });
  await reportMutant('Low capture reuses medium path', value => { value.low_captures[0].path = value.captures[0].path; });
  await reportMutant('Hash-mutated low capture evidence', value => { value.low_captures[0].sha256 = '0'.repeat(64); });
  await reportMutant('Missing route sequence frame', value => { value.route_sequence.frames.pop(); });
  await reportMutant('Route sequence metadata mismatch', value => { value.route_sequence.frames[0].route_node = 'wrong-node'; });
  await reportMutant('Hash-mutated route image evidence', value => { value.route_sequence.frames[0].sha256 = '0'.repeat(64); });
  await reportMutant('Unsafe camera evidence path', value => { value.cameras.cameras.find(camera => camera.id === 'spawn').preview = '../outside.png'; });
  await reportMutant('Missing fixed-camera capture record', value => { value.captures = value.captures.filter(capture => capture.camera !== 'sky'); });
  await reportMutant('Hash-mutated camera evidence', value => { value.captures.find(capture => capture.camera === 'spawn').sha256 = '0'.repeat(64); });

  async function glbMutant(label, profile, bytes, triangles) {
    const relative = fixture.lods[profile].path;
    const destination = path.join(staging, ...relative.split('/'));
    const original = profile === 'low' ? lowGlb : mediumGlb;
    const mutant = clone(fixture);
    Object.assign(mutant.lods[profile], { bytes: bytes.length, sha256: sha256(bytes), triangles });
    fs.writeFileSync(destination, bytes);
    writeJson(reportPath, mutant);
    await expectRejection(label, () => validateLajesGauntlet({ reportPath, stagingRoot: staging }));
    fs.writeFileSync(destination, original);
  }
  await glbMutant('Exported medium GLB primitive overflow', 'medium', glbFixture(10, 91), 910);
  await glbMutant('Exported low GLB primitive overflow', 'low', glbFixture(10, 41), 410);
  async function corruptLowGlb(label, mutate) {
    const bytes = Buffer.from(lowGlb);
    const binStart = 28 + bytes.readUInt32LE(12);
    mutate(bytes, binStart);
    const destination = path.join(staging, fixture.lods.low.path);
    const mutant = clone(fixture);
    mutant.lods.low.sha256 = sha256(bytes);
    fs.writeFileSync(destination, bytes);
    writeJson(reportPath, mutant);
    await expectRejection(label, () => validateLajesGauntlet({ reportPath, stagingRoot: staging }));
    fs.writeFileSync(destination, lowGlb);
  }
  await corruptLowGlb('Non-finite GLB POSITION value', (bytes, binStart) => { bytes.writeFloatLE(Number.NaN, binStart); });
  await corruptLowGlb('Out-of-bounds GLB index', (bytes, binStart) => { bytes.writeUInt16LE(900, binStart + 900 * 12); });
  writeJson(reportPath, fixture);
  const exportSidecarPath = path.join(staging, 'lods/export-validation.json');
  const exportSidecarMutant = clone(exportValidationFixture);
  exportSidecarMutant.low.checks.position_values_checked += 1;
  writeJson(exportSidecarPath, exportSidecarMutant);
  await expectRejection('Export sidecar count mismatch', () => validateLajesGauntlet({ reportPath, stagingRoot: staging }));
  writeJson(exportSidecarPath, exportValidationFixture);

  const routeSidecarPath = path.join(staging, 'previews/route-sequence.json');
  const routeHashReport = clone(fixture);
  const routeHashSidecar = clone(fixture.route_sequence);
  routeHashReport.route_sequence.frames[0].sha256 = '0'.repeat(64);
  routeHashSidecar.frames[0].sha256 = '0'.repeat(64);
  writeJson(reportPath, routeHashReport);
  writeJson(routeSidecarPath, routeHashSidecar);
  await expectRejection('Route image actual hash mismatch', () => validateLajesGauntlet({ reportPath, stagingRoot: staging }));
  writeJson(routeSidecarPath, fixture.route_sequence);
  writeJson(reportPath, fixture);
  const firstRouteImage = path.join(staging, fixture.route_sequence.frames[0].path);
  fs.rmSync(firstRouteImage);
  await expectRejection('Missing route image payload', () => validateLajesGauntlet({ reportPath, stagingRoot: staging }));
  fs.writeFileSync(firstRouteImage, png);
  writeJson(reportPath, fixture);

  const collisionPath = path.join(staging, 'collision/collision-boxes.json');
  async function collisionMutant(label, box) {
    const mutant = clone(collisionFixture);
    mutant.boxes.push(box);
    mutant.box_count = mutant.boxes.length;
    writeJson(collisionPath, mutant);
    await expectRejection(label, () => validateLajesGauntlet({ reportPath, stagingRoot: staging }));
  }
  await collisionMutant('Blocked ground route by solid wall', {
    id: 'route-wall', object: 'Route-blocking wall', role: 'facade masonry', shape: 'axis_aligned_bounds',
    min_m: [-0.5, 2, 0], max_m: [0.5, 2.2, 2],
  });
  await collisionMutant('Insufficient 2.10 metre head clearance', {
    id: 'low-lintel', object: 'Low overhead obstruction', role: 'commercial lintel masonry', shape: 'axis_aligned_bounds',
    min_m: [-0.5, 2, 1.8], max_m: [0.5, 2.2, 2.2],
  });
  await collisionMutant('Obstructed primary spawn by crate', {
    id: 'spawn-crate', object: 'Spawn-blocking crate', role: 'shop produce crate', shape: 'axis_aligned_bounds',
    min_m: [-0.2, -0.2, 0], max_m: [0.2, 0.2, 0.5],
  });
  writeJson(collisionPath, collisionFixture);
  const spawnPath = path.join(staging, 'spawns/spawns.json');
  const outsideRegionSpawn = clone(spawnFixture);
  outsideRegionSpawn.spawns.find(spawn => spawn.id === 'corner').position_m[0] = 99;
  writeJson(spawnPath, outsideRegionSpawn);
  await expectRejection('Spawn outside declared region', () => validateLajesGauntlet({ reportPath, stagingRoot: staging }));
  writeJson(spawnPath, spawnFixture);
  writeJson(reportPath, fixture);
  const rooftopPreview = path.join(staging, fixture.cameras.cameras.find(camera => camera.id === 'rooftop').preview);
  fs.rmSync(rooftopPreview);
  await expectRejection('Missing fixed-camera evidence', () => validateLajesGauntlet({ reportPath, stagingRoot: staging }));
  fs.writeFileSync(rooftopPreview, png);

  const lowLod = path.join(staging, 'lods/low/scene.glb');
  const hiddenLowLod = path.join(directory, 'held-low-lod.bin');
  fs.renameSync(lowLod, hiddenLowLod);
  const missingLowOutput = path.join(directory, 'missing-low-output');
  await expectRejection('Builder with absent low LOD', () => buildLajesPack({
    staging,
    output: missingLowOutput,
    revision: 'abcdef1234567',
    provenance: ['Negative smoke fixture'],
  }));
  if (fs.existsSync(missingLowOutput)) throw new Error('Failed build exposed an output directory');
  fs.renameSync(hiddenLowLod, lowLod);
  console.log('PASS Failed build leaves no candidate output');

  await expectRejection('Existing output directory', () => buildLajesPack({
    staging,
    output,
    revision: 'abcdef1234567',
    provenance: ['Negative smoke fixture'],
  }));

  const nonMapRoot = path.join(directory, 'skin-pack');
  fs.mkdirSync(nonMapRoot);
  const bytes = Buffer.from('studio-smoke');
  fs.writeFileSync(path.join(nonMapRoot, 'asset.bin'), bytes);
  const nonMapManifest = {
    schemaVersion: 1,
    kind: 'skin',
    id: 'smoke-skin',
    version: '0.1.0',
    source: { revision: 'abcdef1234567', provenance: ['CI smoke fixture'] },
    files: [{ path: 'asset.bin', sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }],
  };
  const nonMapManifestPath = path.join(nonMapRoot, 'manifest.json');
  writeJson(nonMapManifestPath, nonMapManifest);
  await validatePack({ manifestPath: nonMapManifestPath, packageRoot: nonMapRoot });
  console.log('PASS Kind without role contract keeps schema v1 compatibility');
  // Character packs have their own contract (tools/checks/character-pack-check.mjs).
  writeJson(nonMapManifestPath, { ...nonMapManifest, kind: 'character', id: 'smoke-character' });
  await expectRejection('Character pack without character roles', () => validatePack({ manifestPath: nonMapManifestPath, packageRoot: nonMapRoot }));
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
