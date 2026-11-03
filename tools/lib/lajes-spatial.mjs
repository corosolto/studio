import { readFile } from 'node:fs/promises';
import { resolvePackageFile } from './pack.mjs';

const bodyHeightMeters = 2.1;

function invariant(condition, message) {
  if (!condition) throw new Error(`Lajes spatial validation failed: ${message}`);
}

function isVector3(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

async function readPackageJson(stagingRoot, relativePath) {
  const { absolute } = await resolvePackageFile(stagingRoot, relativePath);
  return JSON.parse(await readFile(absolute, 'utf8'));
}

function validateBox(box) {
  invariant(box?.shape === 'axis_aligned_bounds', `Collision box ${box?.id || '<unknown>'} must be an AABB`);
  invariant(isVector3(box.min_m) && isVector3(box.max_m), `Collision box ${box.id} needs finite bounds`);
  invariant(box.min_m.every((component, index) => component <= box.max_m[index]), `Collision box ${box.id} has inverted bounds`);
}

function pointIsBlocked(point, boxes, agent) {
  const bodyMin = point[2] + agent.step_height_max_m + 1e-6;
  const bodyMax = point[2] + bodyHeightMeters;
  return boxes.find(box => {
    if (/^flight \d+ riser \d+;/i.test(box.role || '')) return false;
    const insideXY = point[0] >= box.min_m[0] - agent.radius_m && point[0] <= box.max_m[0] + agent.radius_m
      && point[1] >= box.min_m[1] - agent.radius_m && point[1] <= box.max_m[1] + agent.radius_m;
    return insideXY && box.max_m[2] > bodyMin && box.min_m[2] < bodyMax;
  });
}

function validateSegment(from, to, boxes, agent, label) {
  const delta = to.map((component, index) => component - from[index]);
  const length = Math.hypot(...delta);
  const steps = Math.max(1, Math.ceil(length / (agent.radius_m / 2)));
  invariant(steps <= 100000, `${label} exceeds the deterministic sampling budget`);
  for (let index = 0; index <= steps; index += 1) {
    const fraction = index / steps;
    const point = from.map((component, axis) => component + delta[axis] * fraction);
    const blocker = pointIsBlocked(point, boxes, agent);
    invariant(!blocker, `${label} intersects ${blocker?.id || 'collision geometry'} (${blocker?.object || 'unknown object'})`);
  }
}

export async function validateLajesSpatialData(stagingRoot) {
  const [collision, navigation, spawnData, regionData] = await Promise.all([
    readPackageJson(stagingRoot, 'collision/collision-boxes.json'),
    readPackageJson(stagingRoot, 'navigation/nav-graph.json'),
    readPackageJson(stagingRoot, 'spawns/spawns.json'),
    readPackageJson(stagingRoot, 'regions/regions.json'),
  ]);
  invariant(Number.isInteger(collision.box_count) && collision.box_count === collision.boxes?.length, 'Collision box_count must match the boxes array');
  invariant(Array.isArray(collision.boxes) && collision.boxes.length > 0, 'Collision boxes are required');
  for (const box of collision.boxes) validateBox(box);

  const agent = navigation.agent;
  invariant(Number.isFinite(agent?.radius_m) && agent.radius_m > 0, 'Navigation agent needs a positive radius');
  invariant(Number.isFinite(agent?.step_height_max_m) && agent.step_height_max_m > 0 && agent.step_height_max_m <= 0.175, 'Navigation step height must be in (0, 0.175] m');
  invariant(agent?.eye_height_m === 1.65, 'Navigation eye height must be 1.65 m');
  invariant(Array.isArray(navigation.nodes) && navigation.nodes.length >= 2, 'Navigation nodes are required');
  invariant(Array.isArray(navigation.edges) && navigation.edges.length > 0, 'Navigation edges are required');

  const nodes = new Map();
  for (const node of navigation.nodes) {
    invariant(typeof node?.id === 'string' && node.id.length > 0 && !nodes.has(node.id), `Missing or duplicate navigation node: ${node?.id}`);
    invariant(isVector3(node.position_m), `Navigation node ${node.id} needs a finite position`);
    nodes.set(node.id, node);
  }
  invariant(nodes.has('spawn_alley') && nodes.has('roof_water_tank'), 'Navigation needs spawn_alley and roof_water_tank nodes');

  const adjacency = new Map([...nodes.keys()].map(id => [id, []]));
  for (const edge of navigation.edges) {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    invariant(from && to, `Navigation edge has an unknown endpoint: ${edge.from} -> ${edge.to}`);
    invariant(Number.isFinite(edge.clear_width_m) && edge.clear_width_m >= 1.2, `Navigation edge ${edge.from} -> ${edge.to} must have at least 1.20 m clear width`);
    invariant(edge.kind === 'walk' || edge.kind === 'stairs', `Navigation edge ${edge.from} -> ${edge.to} has an unsupported kind`);
    const ascent = to.position_m[2] - from.position_m[2];
    if (edge.kind === 'walk') {
      invariant(Math.abs(ascent) <= agent.step_height_max_m + 1e-6, `Walk edge ${edge.from} -> ${edge.to} exceeds agent step height`);
    } else {
      invariant(Number.isFinite(edge.riser_m) && edge.riser_m > 0 && edge.riser_m <= agent.step_height_max_m, `Stair edge ${edge.from} -> ${edge.to} has an invalid riser`);
      invariant(Number.isFinite(edge.tread_m) && edge.tread_m >= 0.28, `Stair edge ${edge.from} -> ${edge.to} has an invalid tread`);
      invariant(Number.isInteger(edge.risers) && edge.risers > 0, `Stair edge ${edge.from} -> ${edge.to} needs positive risers`);
      invariant(Math.abs(ascent - edge.riser_m * edge.risers) <= 0.025, `Stair edge ${edge.from} -> ${edge.to} elevation does not match its risers`);
    }
    validateSegment(from.position_m, to.position_m, collision.boxes, agent, `${edge.kind} ${edge.from} -> ${edge.to}`);
    adjacency.get(edge.from).push(edge.to);
    if (navigation.bidirectional === true) adjacency.get(edge.to).push(edge.from);
  }

  const reached = new Set(['spawn_alley']);
  const queue = ['spawn_alley'];
  for (let index = 0; index < queue.length; index += 1) {
    for (const next of adjacency.get(queue[index])) {
      if (!reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
    }
  }
  invariant(reached.has('roof_water_tank'), 'Actual navigation edges do not connect spawn_alley to roof_water_tank');

  invariant(Array.isArray(regionData.regions) && regionData.regions.length > 0, 'At least one region is required');
  const regions = new Map();
  for (const region of regionData.regions) {
    invariant(typeof region?.id === 'string' && region.id.length > 0 && !regions.has(region.id), `Missing or duplicate region: ${region?.id}`);
    invariant(isVector3(region.min_m) && isVector3(region.max_m), `Region ${region.id} needs finite bounds`);
    invariant(region.min_m.every((component, index) => component <= region.max_m[index]), `Region ${region.id} has inverted bounds`);
    invariant(typeof region.traversable === 'boolean', `Region ${region.id} needs a traversable declaration`);
    regions.set(region.id, region);
  }

  invariant(Array.isArray(spawnData.spawns) && spawnData.spawns.length > 0, 'At least one spawn is required');
  const spawnIds = new Set();
  for (const spawn of spawnData.spawns) {
    invariant(typeof spawn?.id === 'string' && spawn.id.length > 0 && !spawnIds.has(spawn.id), `Missing or duplicate spawn: ${spawn?.id}`);
    spawnIds.add(spawn.id);
    invariant(isVector3(spawn.position_m), `Spawn ${spawn.id} needs a finite position`);
    invariant(spawn.eye_height_m === agent.eye_height_m, `Spawn ${spawn.id} eye height does not match the agent`);
    const region = regions.get(spawn.region);
    invariant(region, `Spawn ${spawn.id} references unknown region ${spawn.region}`);
    invariant(region.traversable === true, `Spawn ${spawn.id} region ${spawn.region} is not traversable`);
    invariant(spawn.position_m.every((component, index) => component >= region.min_m[index] && component <= region.max_m[index]), `Spawn ${spawn.id} is outside declared region ${spawn.region}`);
    const blocker = pointIsBlocked(spawn.position_m, collision.boxes, agent);
    invariant(!blocker, `Spawn ${spawn.id} intersects ${blocker?.id || 'collision geometry'} (${blocker?.object || 'unknown object'})`);
  }
  const primarySpawn = spawnData.spawns.find(spawn => spawn.id === 'spawn');
  invariant(primarySpawn, 'Missing primary spawn with id spawn');
  invariant(primarySpawn.position_m.every((component, index) => Math.abs(component - nodes.get('spawn_alley').position_m[index]) <= 1e-6), 'Primary spawn must coincide with spawn_alley');

  return { collisionBoxes: collision.boxes.length, navigationEdges: navigation.edges.length, spawns: spawnData.spawns.length, agent, bodyHeightMeters, spawnRecords: spawnData.spawns };
}
