import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { assertNotExecutableJavaScript, assertPackageRelativePath, hashFile, resolvePackageFile } from './pack.mjs';
import { inspectGlb } from './glb-inspect.mjs';
import { validateLajesSpatialData } from './lajes-spatial.mjs';

export const lajesFixedCameras = Object.freeze(['spawn', 'alley', 'corner', 'rooftop', 'sky']);
export const lajesRouteFrameIds = Object.freeze(['01-ground', '02-court-passage', '03-flight-02', '04-landing-02', '05-flight-04', '06-roof-arrival']);

function isVector3(value) {
  return Array.isArray(value) && value.length === 3 && value.every(component => Number.isFinite(component));
}

function fixedCamera(report, name) {
  const matches = Array.isArray(report?.cameras?.cameras) ? report.cameras.cameras.filter(camera => camera?.id === name) : [];
  return matches.length === 1 ? matches[0] : undefined;
}

function validateSpawnCameraMetadata(report, spawnRecords, name) {
  const spawn = spawnRecords.find(record => record.id === name);
  if (!spawn) throw new Error(`Missing ${name} spawn metadata for fixed camera`);
  const camera = fixedCamera(report, name);
  const expected = [spawn.position_m[0], spawn.position_m[1], spawn.position_m[2] + spawn.eye_height_m];
  if (!expected.every((component, index) => Math.abs(camera.location_m[index] - component) <= 0.0001)) {
    throw new Error(`Camera ${name} location ${JSON.stringify(camera.location_m)} does not match spawn eye position ${JSON.stringify(expected)}`);
  }
}

function validateExportRecord(record, lod, actual, label) {
  if (record?.passed !== true || !Array.isArray(record.errors) || record.errors.length !== 0) throw new Error(`${label} did not pass without errors`);
  if (record.path !== lod.path || record.bytes !== lod.bytes || record.sha256 !== lod.sha256) throw new Error(`${label} identity does not match the LOD report`);
  const checks = record.checks || {};
  for (const key of ['all_indices_in_bounds_and_below_position_count', 'all_position_accessors_in_bounds_and_finite', 'glb_2_header_and_lengths', 'json_and_bin_chunks_within_file']) {
    if (checks[key] !== true) throw new Error(`${label} check ${key} did not pass`);
  }
  if (checks.primitive_count !== actual.primitives || checks.position_values_checked !== actual.positionValuesChecked || checks.index_values_checked !== actual.indexValuesChecked) {
    throw new Error(`${label} measured counts do not match actual GLB inspection`);
  }
}

export function validateLajesSceneReport(report) {
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };

  check(report?.schema_version === 1, 'schema_version must be 1');
  check(report?.candidate?.kind === 'map' && report.candidate.id === 'lajes' && report.candidate.version === '0.1.0', 'Candidate must be map/lajes/0.1.0');
  check(report?.candidate?.status === 'candidate', 'Candidate status must remain candidate');
  check(report?.metric_contract?.unit_metres === 1, 'metric_contract.unit_metres must be 1');
  check(report?.metric_contract?.player_eye_height === 1.65, 'metric_contract.player_eye_height must be 1.65');
  const bounds = report?.bounds_blender_z_up;
  check(isVector3(bounds?.min_m) && isVector3(bounds?.max_m) && isVector3(bounds?.dimensions_m), 'Blender Z-up bounds need finite min, max and dimension vectors');
  check(Array.isArray(bounds?.dimensions_m) && bounds.dimensions_m.every(component => Number.isFinite(component) && component > 0), 'Scene dimensions must be positive');

  const previews = new Set();
  const publicEvidencePaths = new Set();
  check(Array.isArray(report?.cameras?.fixed_order), 'cameras.fixed_order must be an array');
  const fixedOrder = Array.isArray(report?.cameras?.fixed_order) ? report.cameras.fixed_order : [];
  for (const name of lajesFixedCameras) {
    check(fixedOrder.filter(id => id === name).length === 1, `fixed_order must contain ${name} exactly once`);
    const camera = fixedCamera(report, name);
    check(Boolean(camera), `Missing or duplicate fixed camera: ${name}`);
    if (!camera) continue;
    check(isVector3(camera.location_m), `Camera ${name} needs a finite location_m vector`);
    check(isVector3(camera.target_m), `Camera ${name} needs a finite target_m vector`);
    if (isVector3(camera.location_m) && isVector3(camera.target_m)) {
      check(camera.location_m.some((component, index) => component !== camera.target_m[index]), `Camera ${name} location and target must differ`);
    }
    check(typeof camera.preview === 'string', `Camera ${name} needs preview evidence`);
    if (typeof camera.preview === 'string') {
      try {
        assertPackageRelativePath(camera.preview, `Camera ${name} preview`);
        assertNotExecutableJavaScript(camera.preview);
        check(/\.(?:png|jpe?g|webp)$/i.test(camera.preview), `Camera ${name} preview must be a PNG, JPEG or WebP image`);
        check(!previews.has(camera.preview), `Camera preview is duplicated: ${camera.preview}`);
        previews.add(camera.preview);
      } catch (error) {
        errors.push(error.message);
      }
    }
    const captures = Array.isArray(report?.captures) ? report.captures.filter(capture => capture?.camera === name) : [];
    check(captures.length === 1, `Camera ${name} needs exactly one capture record`);
    if (captures.length === 1) {
      check(captures[0].path === camera.preview, `Camera ${name} capture path must match its preview`);
      check(typeof captures[0].public_evidence === 'string', `Camera ${name} capture needs a public_evidence path`);
      if (typeof captures[0].public_evidence === 'string') {
        try {
          assertPackageRelativePath(captures[0].public_evidence, `Camera ${name} public evidence`);
          assertNotExecutableJavaScript(captures[0].public_evidence);
          check(/\.(?:png|jpe?g|webp)$/i.test(captures[0].public_evidence), `Camera ${name} public evidence must be a PNG, JPEG or WebP image`);
          check(!publicEvidencePaths.has(captures[0].public_evidence), `Public camera evidence is duplicated: ${captures[0].public_evidence}`);
          publicEvidencePaths.add(captures[0].public_evidence);
        } catch (error) {
          errors.push(error.message);
        }
      }
      check(Number.isInteger(captures[0].bytes) && captures[0].bytes >= 1, `Camera ${name} capture needs a positive byte size`);
      check(/^[a-f0-9]{64}$/.test(captures[0].sha256 || ''), `Camera ${name} capture needs a SHA-256 digest`);
    }
  }

  {
    check(Array.isArray(report.low_captures), 'low_captures must be an array containing all five fixed cameras');
    const lowPrivatePaths = new Set();
    const lowPublicPaths = new Set();
    for (const name of lajesFixedCameras) {
      const matches = Array.isArray(report.low_captures) ? report.low_captures.filter(capture => capture?.camera === name) : [];
      check(matches.length === 1, `Low capture set needs exactly one ${name} record`);
      if (matches.length !== 1) continue;
      const capture = matches[0];
      const mediumCapture = report.captures.find(item => item.camera === name);
      for (const [key, seen] of [['path', lowPrivatePaths], ['public_evidence', lowPublicPaths]]) {
        check(typeof capture[key] === 'string', `Low ${name} capture needs ${key}`);
        if (typeof capture[key] !== 'string') continue;
        try {
          assertPackageRelativePath(capture[key], `Low ${name} ${key}`);
          assertNotExecutableJavaScript(capture[key]);
          check(/\.(?:png|jpe?g|webp)$/i.test(capture[key]), `Low ${name} ${key} must be a PNG, JPEG or WebP image`);
          check(!seen.has(capture[key]), `Low capture path is duplicated: ${capture[key]}`);
          check(capture[key] !== mediumCapture?.[key], `Low and medium ${name} capture paths must differ`);
          seen.add(capture[key]);
        } catch (error) {
          errors.push(error.message);
        }
      }
      check(Number.isInteger(capture.bytes) && capture.bytes >= 1, `Low ${name} capture needs a positive byte size`);
      check(/^[a-f0-9]{64}$/.test(capture.sha256 || ''), `Low ${name} capture needs a SHA-256 digest`);
    }
  }

  const routeSequence = report?.route_sequence;
  check(routeSequence?.schema_version === 1, 'route_sequence.schema_version must be 1');
  check(routeSequence?.renderer === 'BLENDER_EEVEE', 'route_sequence renderer must be BLENDER_EEVEE');
  check(typeof routeSequence?.evidence_type === 'string' && /not runtime/i.test(routeSequence.evidence_type), 'route_sequence must explicitly declare non-runtime evidence');
  check(Array.isArray(routeSequence?.frames) && routeSequence.frames.length === lajesRouteFrameIds.length, 'route_sequence must contain exactly six frames');
  const routePrivatePaths = new Set();
  const routePublicPaths = new Set();
  for (const [index, id] of lajesRouteFrameIds.entries()) {
    const frame = Array.isArray(routeSequence?.frames) ? routeSequence.frames[index] : undefined;
    check(frame?.id === id, `Route frame ${index} must be ${id}`);
    check(typeof frame?.route_node === 'string' && frame.route_node.length > 0, `Route frame ${id} needs route_node metadata`);
    check(isVector3(frame?.location_m) && isVector3(frame?.target_m), `Route frame ${id} needs finite location and target vectors`);
    for (const [key, seen] of [['path', routePrivatePaths], ['public_evidence', routePublicPaths]]) {
      check(typeof frame?.[key] === 'string', `Route frame ${id} needs ${key}`);
      if (typeof frame?.[key] !== 'string') continue;
      try {
        assertPackageRelativePath(frame[key], `Route frame ${id} ${key}`);
        assertNotExecutableJavaScript(frame[key]);
        check(/\.(?:png|jpe?g|webp)$/i.test(frame[key]), `Route frame ${id} ${key} must be a PNG, JPEG or WebP image`);
        check(!seen.has(frame[key]), `Route image path is duplicated: ${frame[key]}`);
        seen.add(frame[key]);
      } catch (error) {
        errors.push(error.message);
      }
    }
    check(Number.isInteger(frame?.bytes) && frame.bytes >= 1, `Route frame ${id} needs a positive byte size`);
    check(/^[a-f0-9]{64}$/.test(frame?.sha256 || ''), `Route frame ${id} needs a SHA-256 digest`);
  }

  const skyCamera = fixedCamera(report, 'sky');
  if (isVector3(skyCamera?.location_m) && isVector3(skyCamera?.target_m)) {
    const delta = skyCamera.target_m.map((component, index) => component - skyCamera.location_m[index]);
    check(delta[2] > 0 && Math.hypot(delta[0], delta[1]) <= delta[2] * Math.tan(Math.PI / 12), 'Sky camera must look upward within 15 degrees of the zenith');
  }

  for (const name of ['alley', 'rooftop']) {
    const route = report?.routes?.[name];
    check(Boolean(route), `Missing ${name} route`);
    if (!route) continue;
    check(route.connected === true, `${name} route must be connected`);
    check(route.traversable === true, `${name} route must be traversable`);
    check(Number.isFinite(route.minClearWidthMeters) && route.minClearWidthMeters >= 1.2, `${name} route clear width must be at least 1.20 m`);
    check(Array.isArray(route.points) && route.points.length >= 2 && route.points.every(isVector3), `${name} route needs at least two finite 3D points`);
  }
  const rooftop = report?.routes?.rooftop;
  check(rooftop?.accessibleByStairs === true, 'Rooftop route must be accessible by stairs');
  if (Array.isArray(rooftop?.points) && rooftop.points.length >= 2 && rooftop.points.every(isVector3)) {
    const ascent = rooftop.points.at(-1)[2] - rooftop.points[0][2];
    check(ascent >= 2, 'Rooftop route must ascend at least 2 m on Z');
    check(Number.isFinite(rooftop.elevationAscentMeters) && Math.abs(rooftop.elevationAscentMeters - ascent) <= 0.02, 'Rooftop elevationAscentMeters must match route endpoints');
  }
  check(report?.roof_access?.spawn_to_roof_graph_connected === true, 'Navigation graph must connect spawn to rooftop');
  check(report?.roof_access?.continuous_modeled_roof_access === true, 'Roof access must be continuously modeled');
  check(Number.isFinite(report?.roof_access?.roof_parapet_height_m) && report.roof_access.roof_parapet_height_m >= 1.1, 'Rooftop parapet must be at least 1.10 m');
  check(report?.roof_access?.west_tank_service_perimeter_at_least_0_60_m === true, 'West tank service perimeter assertion must be true');
  check(Number.isFinite(report?.roof_access?.west_tank_plinth_to_route_clearance_m) && report.roof_access.west_tank_plinth_to_route_clearance_m >= 0.6, 'West tank plinth-to-route clearance must be at least 0.60 m');

  const doors = report?.construction_facts?.doors;
  check(Number.isFinite(doors?.clear_width_m) && doors.clear_width_m >= 0.9, 'Door clear width must be at least 0.90 m');
  check(Number.isFinite(doors?.clear_height_m) && doors.clear_height_m >= 2.1, 'Door clear height must be at least 2.10 m');
  const stairs = report?.construction_facts?.stairs;
  check(Number.isFinite(stairs?.riser_m) && stairs.riser_m > 0 && stairs.riser_m <= 0.175, 'Stair riser must be in (0, 0.175] m');
  check(Number.isFinite(stairs?.tread_m) && stairs.tread_m >= 0.28, 'Stair tread must be at least 0.28 m');
  check(Number.isFinite(stairs?.clear_width_m) && stairs.clear_width_m >= 1.2, 'Stair clear width must be at least 1.20 m');
  check(Number.isInteger(stairs?.flights) && stairs.flights >= 1, 'At least one stair flight is required');

  const corner = report?.construction_facts?.commercial_corner;
  const junctions = Array.isArray(corner?.material_junctions) ? corner.material_junctions.join(' ') : '';
  check(typeof corner?.shop === 'string' && corner.shop.length > 0, 'Commercial corner must identify its shop');
  check(Number.isFinite(corner?.sidewalk_width_m) && corner.sidewalk_width_m > 0, 'Commercial corner needs a positive sidewalk width');
  check(Number.isFinite(corner?.curb_height_m) && corner.curb_height_m > 0, 'Commercial corner needs a measured curb');
  check(/asphalt/i.test(junctions) && /curb/i.test(junctions) && /sidewalk/i.test(junctions) && /facade/i.test(junctions), 'Commercial corner must resolve asphalt, curb, sidewalk and facade junctions');

  const tanks = report?.construction_facts?.water_tanks;
  check(Number.isInteger(tanks?.count) && tanks.count === 2, 'Rooftop must include exactly two water tanks');
  check(tanks?.on_accessible_west_roof === true, 'Both water tanks must be on the accessible west rooftop');
  check(isVector3(tanks?.west_south_center_m), 'South water tank needs a finite west_south_center_m position');
  check(isVector3(tanks?.west_north_center_m), 'North water tank needs a finite west_north_center_m position');
  const skyline = report?.construction_facts?.skyline;
  check(Number.isInteger(skyline?.context_house_count) && skyline.context_house_count >= 3, 'Skyline needs at least three context houses');
  check(Array.isArray(skyline?.varied_roof_heights_m) && skyline.varied_roof_heights_m.length === skyline.context_house_count && skyline.varied_roof_heights_m.every(height => Number.isFinite(height) && height > 0), 'Skyline roof heights must match the context house count');
  check(new Set(Array.isArray(skyline?.varied_roof_heights_m) ? skyline.varied_roof_heights_m : []).size >= 2, 'Skyline must have varied roof heights');

  const mediumLod = report?.lods?.medium;
  const lowLod = report?.lods?.low;
  for (const [profile, lod] of [['medium', mediumLod], ['low', lowLod]]) {
    check(Boolean(lod), `Missing ${profile} LOD report`);
    check(typeof lod?.path === 'string', `${profile} LOD report needs a path`);
    if (typeof lod?.path === 'string') {
      try {
        assertPackageRelativePath(lod.path, `${profile} LOD path`);
        assertNotExecutableJavaScript(lod.path);
        check(lod.path.toLowerCase().endsWith('.glb'), `${profile} LOD path must reference a GLB`);
      } catch (error) {
        errors.push(error.message);
      }
    }
    check(Number.isInteger(lod?.triangles) && lod.triangles > 0, `${profile} LOD triangle count must be a positive integer`);
    const triangleBudget = profile === 'medium' ? 100000 : 32000;
    check(Number.isInteger(lod?.triangles) && lod.triangles <= triangleBudget, `${profile} LOD must have at most ${triangleBudget} triangles`);
    const primitiveBudget = profile === 'medium' ? 90 : 40;
    check(Number.isInteger(lod?.primitives) && lod.primitives > 0, `${profile} LOD primitive count must be a positive integer`);
    check(Number.isInteger(lod?.primitives) && lod.primitives <= primitiveBudget, `${profile} LOD must have at most ${primitiveBudget} primitives`);
    check(Number.isInteger(lod?.bytes) && lod.bytes >= 1, `${profile} LOD report needs a positive byte size`);
    check(/^[a-f0-9]{64}$/.test(lod?.sha256 || ''), `${profile} LOD report needs a SHA-256 digest`);
  }
  if (typeof mediumLod?.path === 'string' && typeof lowLod?.path === 'string') {
    check(mediumLod.path !== lowLod.path, 'Medium and low LOD paths must differ');
  }
  if (Number.isInteger(mediumLod?.triangles) && mediumLod.triangles > 0 && Number.isInteger(lowLod?.triangles) && lowLod.triangles > 0) {
    check(lowLod.triangles < mediumLod.triangles, 'Low LOD must have strictly fewer triangles than medium LOD');
  }

  if (errors.length) throw new Error(`Lajes scene report validation failed:\n${errors.map(error => `- ${error}`).join('\n')}`);
  return report;
}

export async function validateLajesGauntlet({ reportPath, stagingRoot = path.dirname(reportPath), evidenceRoot }) {
  const resolvedReportPath = path.resolve(reportPath);
  const resolvedStagingRoot = path.resolve(stagingRoot);
  const resolvedEvidenceRoot = evidenceRoot ? path.resolve(evidenceRoot) : undefined;
  const report = JSON.parse(await readFile(resolvedReportPath, 'utf8'));
  validateLajesSceneReport(report);
  const spatial = await validateLajesSpatialData(resolvedStagingRoot);
  validateSpawnCameraMetadata(report, spatial.spawnRecords, 'spawn');
  validateSpawnCameraMetadata(report, spatial.spawnRecords, 'corner');
  for (const name of lajesFixedCameras) {
    const preview = fixedCamera(report, name).preview;
    const capture = report.captures.find(item => item.camera === name);
    const evidencePath = resolvedEvidenceRoot ? capture.public_evidence : preview;
    const evidenceBase = resolvedEvidenceRoot || resolvedStagingRoot;
    const { absolute, info } = await resolvePackageFile(evidenceBase, evidencePath);
    if (info.size !== capture.bytes) throw new Error(`Camera preview byte size mismatch: ${evidencePath}`);
    if (await hashFile(absolute) !== capture.sha256) throw new Error(`Camera preview SHA-256 mismatch: ${evidencePath}`);
  }
  for (const name of lajesFixedCameras) {
    const capture = report.low_captures.find(item => item.camera === name);
    const evidencePath = resolvedEvidenceRoot ? capture.public_evidence : capture.path;
    const evidenceBase = resolvedEvidenceRoot || resolvedStagingRoot;
    const { absolute, info } = await resolvePackageFile(evidenceBase, evidencePath);
    if (info.size !== capture.bytes) throw new Error(`Low camera preview byte size mismatch: ${evidencePath}`);
    if (await hashFile(absolute) !== capture.sha256) throw new Error(`Low camera preview SHA-256 mismatch: ${evidencePath}`);
  }
  const routeSidecarPath = await resolvePackageFile(resolvedStagingRoot, 'previews/route-sequence.json');
  const routeSidecar = JSON.parse(await readFile(routeSidecarPath.absolute, 'utf8'));
  if (JSON.stringify(routeSidecar) !== JSON.stringify(report.route_sequence)) throw new Error('Route sequence sidecar does not match the scene report');
  for (const frame of report.route_sequence.frames) {
    const evidencePath = resolvedEvidenceRoot ? frame.public_evidence : frame.path;
    const evidenceBase = resolvedEvidenceRoot || resolvedStagingRoot;
    const { absolute, info } = await resolvePackageFile(evidenceBase, evidencePath);
    if (info.size !== frame.bytes) throw new Error(`Route image byte size mismatch: ${evidencePath}`);
    if (await hashFile(absolute) !== frame.sha256) throw new Error(`Route image SHA-256 mismatch: ${evidencePath}`);
  }
  const actualLods = {};
  for (const profile of ['medium', 'low']) {
    const lod = report.lods[profile];
    const { absolute, info } = await resolvePackageFile(resolvedStagingRoot, lod.path);
    if (info.size !== lod.bytes) throw new Error(`${profile} LOD byte size mismatch: ${lod.path}`);
    if (await hashFile(absolute) !== lod.sha256) throw new Error(`${profile} LOD SHA-256 mismatch: ${lod.path}`);
    const actual = await inspectGlb(absolute, lod.path);
    actualLods[profile] = actual;
    const primitiveBudget = profile === 'medium' ? 90 : 40;
    if (actual.primitives > primitiveBudget) throw new Error(`${profile} GLB exceeds ${primitiveBudget} primitives: ${lod.path}`);
    const triangleBudget = profile === 'medium' ? 100000 : 32000;
    if (actual.triangles > triangleBudget) throw new Error(`${profile} GLB exceeds ${triangleBudget} triangles: ${lod.path}`);
    if (actual.primitives !== lod.primitives) throw new Error(`${profile} LOD primitive count does not match its GLB: ${lod.path}`);
    if (actual.triangles !== lod.triangles) throw new Error(`${profile} LOD triangle count does not match its GLB: ${lod.path}`);
  }
  if (actualLods.low.triangles >= actualLods.medium.triangles) throw new Error('Low GLB must have strictly fewer triangles than medium GLB');
  const exportValidationPath = await resolvePackageFile(resolvedStagingRoot, 'lods/export-validation.json');
  const exportValidation = JSON.parse(await readFile(exportValidationPath.absolute, 'utf8'));
  if (exportValidation.passed !== true || report.export_validation?.passed !== true) throw new Error('Export validation sidecar and report must pass');
  for (const profile of ['medium', 'low']) {
    const budgetKey = `${profile}_primitive_budget_passed`;
    if (exportValidation[budgetKey] !== true || report.export_validation[budgetKey] !== true) throw new Error(`${profile} export primitive budget did not pass`);
    validateExportRecord(exportValidation[profile], report.lods[profile], actualLods[profile], `Export sidecar ${profile}`);
    validateExportRecord(report.export_validation[profile], report.lods[profile], actualLods[profile], `Report export summary ${profile}`);
  }
  return { report, reportPath: resolvedReportPath, stagingRoot: resolvedStagingRoot, evidenceRoot: resolvedEvidenceRoot, spatial, lods: actualLods };
}
