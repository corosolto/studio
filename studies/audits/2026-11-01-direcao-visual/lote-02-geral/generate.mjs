import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const client = '/Volumes/Zenith/Projects/game/corosolto/csbrasil/client';
const node = '/opt/homebrew/opt/node/bin/node';
const model = 'google/gemini-3-pro-image';
const captures = JSON.parse(await readFile(root + '/capture-manifest.json', 'utf8')).captures;
const filter = process.argv[2];
let manifest;
try { manifest = JSON.parse(await readFile(root + '/generation-manifest.json', 'utf8')); }
catch { manifest = { model, startedAt: new Date().toISOString(), status: 'in-progress', concepts: [], failures: [] }; }
const bible = {
  B: 'B — STYLIZED REALISM. A polished realtime game with believable plaster, concrete, tile, wood, painted steel, glass, water, cloth and skin. Separate these materials through roughness, restrained specular response, selective bevel/normal highlights and correctly scaled medium-sized surface detail. Keep calm large surfaces, localized edge wear and contact shading; no uniform dirty noise. Restrained warm key light with readable cool fill where motivated by the source, balanced exposure and clear gameplay shadows. Preserve the original surface colors and each location’s biome, time of day and light sources. An interior remains an interior. Characters remain stylized satirical game characters, with credible fabric folds and metal response, not photoreal human replacements.',
  C: 'C — POLISHED GRAPHIC CARICATURE. A distinctive stylized realtime game with broad hand-painted color variation, clean sculpted planes, selective soft bevels, deliberate value grouping and tactile materials. Preserve original identity colors, using slightly richer controlled accents from the same palette. Broad gentle wear and contact shadows, no random grunge. Clear gameplay lighting with warm/cool separation where motivated by the source. Preserve biome, architecture and light sources; no automatic sunset or tropical makeover. Characters retain their exact existing satirical proportions, costume and silhouette. Materials should feel authored and consistent across every map, weapon and skin; no illustration overlays or obligatory black ink outlines.'
};
await writeFile(root + '/art-bible.json', JSON.stringify({ priority: ['B', 'C'], bible, source: 'Owner preference after lote-01; same master language for every category.', engine: 'Three.js r160 / WebGL2 candidate, not implemented' }, null, 2));
const lock = 'EDIT THE ATTACHED REAL GAME FRAME IN PLACE. Keep the exact camera, framing, perspective and spatial structure. Preserve building/roof silhouettes, existing geometry, routes, cover, openings and the exact object/character count and screen positions. Do not invent another scene, add props, stairs, railings, parapets, plants, trees, people, weapons or flags. Keep all existing emblems, banners, signs, decals and costume motifs unchanged; do not turn faction symbols into national or EU flags. No invented writing. Improve surface craftsmanship and lighting, not layout or design.';
const feasibility = 'RENDERING LIMIT: attainable Three.js r160/WebGL2 visuals using ordinary polygonal meshes, selective bevels, PBR base-color/normal/roughness/AO, optional baked static light, conventional shadow maps, simple ambient/environment fill and modest postprocessing. No ray tracing, dynamic GI, cinematic depth of field, dense volumetrics, strand hair, microdisplacement or expensive reflection effects. Every gameplay depth stays sharp. One full-frame edited image, no HUD, captions, borders, watermark or comparison collage.';
function makePrompt(capture, style) {
  const subject = capture.category === 'maps'
    ? 'ENVIRONMENT STUDY: this frame has no actor to add. Preserve the architecture, sky/ceiling, surfaces, vegetation, water and existing objects in their original positions. Empty areas remain empty. Do not put tiled roofs over flat rooftops or add elevated borders. Existing signs and decals remain the same.'
    : capture.category === 'weapons'
      ? 'WEAPON STUDY: preserve the exact weapon design, sights, barrel, stock, magazine, grips, attachments and visible hand count/pose. Keep original weapon skin motifs and sleeve/glove identity colors. Refine material separation and craftsmanship without changing the model or perspective.'
      : capture.category === 'characters' || capture.category === 'skins'
        ? 'CHARACTER/SKIN STUDY: preserve the exact existing character, identity, costume, skin motifs, hair silhouette, anatomical proportions, pose, limbs, held weapon and contacts. This is one of THREE camera angles of the same character and outfit in the SAME game scene. Do not redesign or substitute it; repeat the same material recipes in every angle. Keep the scene and character size exactly as the source.'
        : 'JAVAPORCO MODE STUDY: preserve the existing game map, boar enemies, human characters and their exact counts, poses, body proportions and positions. Improve materials, lighting and broad surfaces only; no fur strands, gore, new enemies or layout changes.';
  const panel = capture.triptych ? 'SOURCE FORMAT: THREE PANELS showing the SAME character at the SAME spot, front/profile/back, each in the real game environment. Preserve all three panels, their exact cameras, panel boundaries and the same costume/model across views. This is one coherent three-view in-game sheet. Do not collapse to one view, duplicate an angle, invent accessories or use a studio background.' : '';
  return `${panel}\n${lock}\n\n${bible[style]}\n\n${subject}\n\n${capture.triptych ? feasibility.replace('One full-frame edited image, no HUD, captions, borders, watermark or comparison collage.', 'Keep the existing three-panel sheet with in-game backgrounds. No HUD, new captions, watermark or studio.') : feasibility}\n\nLocation/subject: ${capture.name}. Preserve the exact source content. Output a single landscape frame.`;
}
async function generate(args, logPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(node, ['tools/gen-image.mjs', ...args], { cwd: client, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), 300000);
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { log = (log + chunk.toString()).slice(-10000); });
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', async code => { clearTimeout(timer); await writeFile(logPath, log); code === 0 ? resolve(log) : reject(new Error(`Generation failed (${code}), see ${logPath}`)); });
  });
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
let persistChain = Promise.resolve();
const persist = () => { const snapshot = JSON.stringify(manifest, null, 2); persistChain = persistChain.then(() => writeFile(root + '/generation-manifest.json', snapshot)); return persistChain; };
const jobs = captures.filter(c => c.inspected && (!filter || c.category === filter || c.id === filter)).flatMap(capture => ['B','C'].map(style => ({capture,style})));
async function worker() {
  while (jobs.length) {
    const {capture,style}=jobs.shift();
    const key = `${style}-${capture.id}`;
    if (manifest.concepts.some(c => c.id === key)) { console.log(`SKIP ${key}`); continue; }
    await mkdir(root + '/concepts/' + capture.category, { recursive: true });
    const prompt = makePrompt(capture, style);
    const promptPath = root + '/prompts/' + key + '.txt';
    await writeFile(promptPath, prompt);
    const id = 'cs-bc-20261101-' + key.toLowerCase();
    console.log(`START ${key} · ${capture.name}`);
    try {
      const log = await generate(['--id', id, '--prompt', prompt, '--ref', capture.path, '--model', model, '--aspect', '16:9', '--raw-only', '--out', root + '/concepts/' + capture.category], root + '/logs/' + key + '.log');
      const dest = root + '/concepts/' + capture.category + '/' + key + '.png';
      await copyFile('/tmp/gen-image/' + id + '.png', dest);
      const bytes = await readFile(dest), reference = await readFile(capture.path);
      manifest.concepts.push({ id: key, capture: capture.id, category: capture.category, style, name: capture.name, path: dest, prompt: promptPath, reference: capture.path, referenceSha256: digest(reference), bytes: bytes.length, sha256: digest(bytes), generatedAt: new Date().toISOString(), review: 'pending', type: '2D-concept-not-engine-render' });
      await persist();
      console.log(`DONE ${key} · ${bytes.length} bytes · ${log.split('\n').find(x => x.startsWith('[')) ?? ''}`);
    } catch (error) {
      manifest.failures.push({ id: key, at: new Date().toISOString(), error: error.message });
      await persist();
      throw error;
    }
  }
}
await Promise.all(Array.from({length:2}, () => worker()));
await persistChain;
console.log(`Completed current available queue: ${manifest.concepts.length} concepts. Overall coverage and independent review still require checking.`);
