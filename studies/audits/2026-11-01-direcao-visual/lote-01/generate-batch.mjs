// Orchestration only. Image generation stays in the project's existing CLI.
import { mkdir, readFile, writeFile, copyFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const client = '/Volumes/Zenith/Projects/game/corosolto/csbrasil/client';
const node = '/opt/homebrew/opt/node/bin/node';
const model = 'google/gemini-3-pro-image';
const views = ['01-mundo', '02-primeira-pessoa', '03-personagem'];
const directions = [
  { id: 'A', title: 'Competitivo limpo',
    art: `Art direction A: polished competitive stylization. Clear designed shapes, elegant simple surfaces and strong visual hierarchy. A warm Brazilian neighborhood palette of pale sand plaster, rich terracotta brick, muted mint/teal painted metal and limited saturated cultural accents. Neutral daylight with a warm directional sun, cool soft fill, crisp stable shadows and tasteful contact shading. Foreground and playable surfaces are clear; distant buildings slightly lower contrast. Large clean material regions, restrained medium-scale wear, no noisy uniform grunge. Add well-placed edge bevel highlights and clean window reveals without moving openings. Character: carefully sculpted stylized forms and face planes, readable rainbow polygonal punk hair, blue jacket, red tartan trousers and dark boots, finely controlled cloth and metal response. Keep the existing satirical low-poly identity but give it deliberate commercial finish.`,
    recipe: 'Formas simples com bevels seletivos; base color e roughness organizados por superfície; normal apenas onde muda leitura; uma luz direcional e preenchimento ambiente; AO moderado; paleta areia/terracota/verde. Silhueta e fundo separados por valor. Não exige novas técnicas de renderização.' },
  { id: 'B', title: 'Realismo estilizado',
    art: `Art direction B: high-finish stylized realism for an actual browser FPS. Believable masonry, painted plaster, cast concrete, galvanized corrugated metal, glass, leather and fabric with distinctly different roughness. Calm large surfaces with controlled medium-scale chipped plaster at edges, masonry joints and localized contact dirt, never all-over procedural noise. Rich but restrained ochre/terracotta and faded green Brazilian rooftop colors. Neutral-to-warm late afternoon sun with readable cool sky fill, shadows retaining detail, physically plausible exposure, no heavy orange filter. Convincing depth through material scale, designed shadowing and restrained baked indirect light, not cinematic haze. Preserve a stylized satirical character: rainbow hard-surface punk mohawk, blue jacket with credible broad folds, red plaid trousers, dark boots. Better sculpting and texture resolution, not a photoreal human replacement. Weapon retains its exact current model and proportions with believable painted metal and grip roughness.`,
    recipe: 'Meshes modulares; bevel/normal para quinas; atlas base color/normal/roughness/AO; lightmap ou AO assado como candidatos para ambiente estático; shadow map de uma luz solar; PMREM estático para metal. Uso e orçamento de lightmap ainda precisam de protótipo; mais risco de memória e textura que A.' },
  { id: 'C', title: 'Caricatura elaborada',
    art: `Art direction C: a distinctive premium stylized Brazilian satirical game, hand-authored graphic charm and polished 3D materials. Warm cream, orange terracotta, dusty turquoise and selective vivid yellow/blue accents. Sculpted broad shapes, slightly softened bevels, subtly hand-painted color variation and elegant gradients grounded in surface materials. The existing modular architecture gets strong intentional color grouping and art-directed contact shadows, not a different building layout. Sunny lively neighborhood, a clear sky with broad simple cloud forms, soft readable shadows; no storybook illustration overlay. The existing punk reads as a memorable playable caricature: large clean color clumps in his rainbow spiked hair, appealing readable face planes, blue jacket, red tartan trousers, solid dark boots. Preserve his existing anatomical proportions, silhouette, pose, costume and weapon; improve the craftsmanship, not the design. No black ink outlines required; separation comes from values and restrained edge lighting.`,
    recipe: 'Base color com variações pintadas amplas; geometria de cabelo em blocos; bevels e normais suaves; luz solar com sombras convencionais; AO leve; materiais com roughness alta e especular controlado. Gradientes devem sobreviver à câmera e ao movimento. Nenhum contorno novo é pressuposto.' },
];
const constraints = `Create one edited visual development frame from the FIRST attached actual CORO SOLTO screenshot. This is a target concept, not a screenshot of an implemented upgrade. The task is to improve production craftsmanship and establish a coherent reusable visual language for maps, characters and atmosphere while preserving the Brazilian rooftop neighborhood and satirical cultural identity.
CAMERA AND GAMEPLAY LOCK: preserve the exact camera, crop, perspective, field of view, composition, building footprints/heights, rooflines, parapets, stairs, walkable routes, cover, sightlines, window/door placements, object count and screen positions from image 1. Do not rebuild the map, add new buildings, add vegetation, add clutter, insert people, remove railings or close paths. Preserve existing kites, laundry, flags, rooftop plants and signs in the same positions. Existing Portuguese signage may be made crisper without inventing logos or fake prose. Keep any existing blue gameplay rings in their original positions. No HUD, watermark, title, text panel, borders, split screen or collage. Use the full frame.
ENGINE FEASIBILITY: make this look like an attainable carefully art-directed WebGL2 / Three.js r160 realtime game frame: ordinary polygonal meshes with selective small bevels, PBR base-color/normal/roughness/AO textures, optional baked static lighting, one shadow-mapped directional sun and simple ambient/environment fill. A static environment map and modest existing postprocessing are plausible. Do not rely on ray/path tracing, Lumen, Nanite, real-time GI, cinematic depth of field, dense volumetric light/fog, strand hair, microdisplacement, offline fur or expensive screen-space reflections. Keep all gameplay depths sharp and enemies legible. Do not make an illustration, photobash, cinematic poster or photoreal photograph.
QUALITY: significant visible improvement in art direction, material separation, contact, bevels, palette hierarchy and lighting, not a color filter applied to the source. Rich finishing is selective and reusable, not more objects. Prioritize composition and consistent material recipes over microscopic detail.`;

function promptFor(direction, view) {
  // Character descriptions belong ONLY in the character frame. Otherwise the
  // image model may insert that described person into an empty gameplay view.
  const environmentArt = direction.art
    .replace(/ Character:.*$/, '')
    .replace(/ Preserve a stylized satirical character:.*$/, '')
    .replace(/ The existing punk reads as.*$/, '');
  const art = view === views[2] ? direction.art : environmentArt;
  const viewText = view === views[0]
    ? 'VIEW: wide environment overview. Preserve all architecture and the exact bird-eye perspective. Foreground rooftops and parapets must retain their exact silhouettes: do not add green railings or any new cover on the bare lower-center/left roof. No visible character or gun should be added. Establish the lighting, palette and shared surface recipes for this direction.'
    : view === views[1]
      ? 'VIEW: first-person rooftop gameplay. This source frame has NO other person. Keep the entire rooftop empty of people, especially the open right half. Preserve the exact pistol model, visible red sleeves with white star shapes, hands, hand count, weapon pose and its screen position. No extra fingers or extra gun. Preserve the rooftop rails and the potted plant at the same positions. Do not change the player weapon or turn this into a third-person view. Do not move the foreground plant toward the left or alter the gun angle.'
      : 'VIEW: full-body existing fictional punk in the environment. Preserve this EXACT person, costume, rainbow polygonal mohawk, blue jacket, red tartan trousers, dark boots, rifle, silhouette, limb count, aiming pose, screen location and screen size. Refine materials, forms, anatomy and face readability inside the existing silhouette. No new character, no closeup crop, no costume redesign, no photoreal celebrity. Ground contact and hands on the existing rifle must be coherent.';
  const styleRef = view === views[0] ? '' : 'REFERENCE ROLES: image 1 controls all geometry, camera, objects and character. Image 2 is the environment overview ALREADY GENERATED for this same art direction; borrow only its palette, lighting and surface treatment, NEVER its camera or composition. Match its time of day and material recipes across views.';
  return `${constraints}\n\n${art}\n\n${viewText}\n\n${styleRef}\n\nOutput ONE polished 16:9 full-frame game visual development concept.`;
}

async function run(args, logPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(node, ['tools/gen-image.mjs', ...args], { cwd: client, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); }, 300_000);
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk.toString()).slice(-12000); });
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('close', async code => {
      clearTimeout(timer);
      await writeFile(logPath, output);
      if (code !== 0) reject(new Error(`Generation failed, code=${code}; inspect ${logPath}`));
      else resolve(output.trim());
    });
  });
}

await mkdir(path.join(root, 'concepts'), { recursive: true });
const manifestPath = path.join(root, 'generation-manifest.json');
let manifest;
try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); }
catch { manifest = { model, status: 'in-progress', startedAt: new Date().toISOString(), concepts: [] }; }
await writeFile(path.join(root, 'recipes.json'), JSON.stringify(directions, null, 2));
const only = process.argv[2];
const repairPov = process.argv.includes('--repair-pov');
if (repairPov && only !== 'A-02-primeira-pessoa') throw new Error('This bounded repair is only for A-02-primeira-pessoa.');
for (const direction of directions) {
  for (const view of views) {
    const key = `${direction.id}-${view}`;
    if (only && key !== only) continue;
    const prior = manifest.concepts.find(item => item.id === key);
    if (prior && !repairPov) { console.log(`SKIP ${key}: recorded output exists`); continue; }
    if (prior && repairPov) {
      await mkdir(path.join(root, 'rejected'), { recursive: true });
      const rejectedPath = path.join(root, 'rejected', `${key}-attempt-02.png`);
      await copyFile(prior.path, rejectedPath);
      await copyFile(prior.prompt, path.join(root, 'rejected', `${key}-attempt-02-prompt.txt`));
      manifest.rejected ??= [];
      manifest.rejected.push({ ...prior, path: rejectedPath, reason: 'Independent review: replacement scene, new stairs/roofs and Portugal identity; rejected before bounded single-reference repair.' });
      manifest.concepts = manifest.concepts.filter(item => item.id !== key);
      manifest.status = 'bounded-repair-in-progress';
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    }
    const prompt = repairPov ? `Edit the attached CORO SOLTO gameplay screenshot IN PLACE. Keep this exact image composition, camera and perspective. Do not invent another scene. Preserve every building, roofline, window, door, railing, rooftop floor, blue gameplay ring, laundry, kite and plant at exactly its original screen position. The plant stays just right of center behind the gun. The big right rooftop stays empty. Do not add people, stairs, tile roofs, props or new railings. This is a BRAZILIAN neighborhood, not Portugal. Keep the existing BLUE faction banners with their existing star emblem; no national flags, no invented text or signs.
Improve only the visual craftsmanship: clean competitive stylization with calm sand-colored plaster, terracotta brick, muted green metal, clearer roughness separation, selective small bevels, tasteful contact shadow and restrained wear. Neutral daylight, soft cool ambient fill and a gentle warm directional sun; maintain clear playable surfaces. An attainable high-quality Three.js/WebGL game frame using conventional PBR materials and shadow maps. No cinematic blur, ray tracing or volumetric effects.
Preserve the exact existing black/navy pistol design and its screen position/angle, existing hands, the red sleeves and their white star-like motifs. Do not redesign the weapon or add fingers. Restyle THIS screenshot; leave its spatial structure unchanged. One full-frame landscape image.` : promptFor(direction, view);
    const promptPath = path.join(root, 'prompts', `${key}.txt`);
    const source = path.join(root, 'baseline', `${view}.png`);
    const refs = [source];
    if (view !== views[0] && !repairPov) refs.push(path.join(root, 'concepts', `${direction.id}-${views[0]}.png`));
    await writeFile(promptPath, prompt);
    const id = `cs-look-20261101-${key.toLowerCase()}`;
    const args = ['--id', id, '--prompt', prompt, '--model', model, '--aspect', '16:9', '--raw-only', '--out', path.join(root, 'concepts')];
    for (const ref of refs) args.push('--ref', ref);
    console.log(`START ${key} — ${direction.title}`);
    const log = await run(args, path.join(root, 'logs', `${key}.log`));
    const raw = `/tmp/gen-image/${id}.png`;
    const dest = path.join(root, 'concepts', `${key}.png`);
    await copyFile(raw, dest);
    const bytes = await readFile(dest);
    const entry = { id: key, direction: direction.title, view, path: dest, prompt: promptPath, references: refs, bytes: (await stat(dest)).size, sha256: createHash('sha256').update(bytes).digest('hex'), generatedAt: new Date().toISOString(), review: 'pending', type: '2D-concept-not-engine-render' };
    manifest.concepts.push(entry);
    manifest.status = manifest.concepts.length === 9 ? 'generated-review-pending' : 'in-progress';
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`DONE ${key}: ${entry.bytes} bytes; ${log.split('\n').find(line => line.startsWith('[')) ?? ''}`);
  }
}
console.log(`Recorded ${manifest.concepts.length}/9 concepts; independent visual review pending.`);
