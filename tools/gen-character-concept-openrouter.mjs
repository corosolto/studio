#!/usr/bin/env node
/* Gera um concept original por vez via OpenRouter e persiste a procedência.

   Uso seguro:
     node tools/gen-character-concept-openrouter.mjs \
       --prompt-file prompts/nerdolas/designer-ux.md \
       --reference public/img/faccoes/nerdolas.webp \
       --out references/nerdolas/designer-ux/designer-ux-concept-v1.png \
       --dry-run

   Character sheet mode (the prompt is composed from the ficha, see
   tools/lib/character-concept-prompt.mjs; identity photos stay outside the repo):
     node tools/gen-character-concept-openrouter.mjs \
       --ficha /path/to/fichas/capitao-caveira.json \
       --refs-dir /path/outside/repo/refs/capitao-caveira \
       --reference /path/to/estilo-elenco.jpg \
       --out /path/outside/repo/capitao-caveira-concept-v1.png \
       --model openai/gpt-image-1 --dry-run

   --aspect W:H defaults to 1:1 with --prompt-file and 2:3 (full-body T-pose) with --ficha.
   Models `openai/gpt-image-*` go through OpenRouter's Images API; the others use chat/completions.

   A ferramenta não sobrescreve sem --force e nunca imprime a chave.
*/
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import sharp from 'sharp';
import { composeCharacterConceptPrompt } from './lib/character-concept-prompt.mjs';
import { usesOpenRouterImagesApi } from './lib/openrouter-image.mjs';

const args = process.argv.slice(2);
const value = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const promptFile = value('--prompt-file');
const fichaFile = value('--ficha');
const reference = value('--reference');
const output = value('--out');
const model = value('--model') || 'google/gemini-3.1-flash-image';
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
if ((!promptFile === !fichaFile) || !reference || !output)
  throw new Error('uso: (--prompt-file <md> | --ficha <json> [--refs-dir <dir>]) --reference <imagem> --out <png> [--aspect W:H] [--model id] [--dry-run] [--force]');
if (!existsSync(promptFile || fichaFile) || !existsSync(reference)) throw new Error('prompt, ficha ou referência inexistente');
if (extname(output).toLowerCase() !== '.png') throw new Error('--out precisa terminar em .png');
if (!dryRun && existsSync(output) && !force) throw new Error(`saída já existe: ${output} (use --force deliberadamente)`);
const aspectRatio = value('--aspect') || (fichaFile ? '2:3' : '1:1');
if (!/^\d+:\d+$/.test(aspectRatio)) throw new Error(`--aspect must be W:H, got ${aspectRatio}`);

function loadEnv(file = '.env') {
  const out = {};
  let text; try { text = readFileSync(file, 'utf8'); } catch { return out; }
  for (const line of text.split('\n')) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let current = match[2].trim();
    if ((current.startsWith('"') && current.endsWith('"')) || (current.startsWith("'") && current.endsWith("'")))
      current = current.slice(1, -1);
    out[match[1]] = current;
  }
  return out;
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const mimeOf = (file) => ({ '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' })[extname(file).toLowerCase()] || 'image/png';

let prompt;
let promptSource;
let identityReferences = [];
if (fichaFile) {
  const fichaBytes = readFileSync(fichaFile);
  const ficha = JSON.parse(fichaBytes.toString('utf8'));
  const refsDir = value('--refs-dir') || `references/${ficha.id}`;
  identityReferences = (ficha.refs || []).map((file) => join(refsDir, file)).filter((file) => {
    if (existsSync(file)) return true;
    console.error(`· missing identity reference ignored: ${file}`);
    return false;
  });
  prompt = composeCharacterConceptPrompt(ficha, { referenceCount: identityReferences.length });
  promptSource = { ficha: fichaFile, fichaSha256: sha256(fichaBytes), promptSha256: sha256(Buffer.from(prompt)) };
} else {
  const promptMarkdown = readFileSync(promptFile, 'utf8');
  prompt = promptMarkdown.split(/^## Prompt usado\s*$/m)[1]?.trim();
  if (!prompt) throw new Error(`${promptFile}: seção “## Prompt usado” vazia ou ausente`);
  promptSource = { promptFile, promptSha256: sha256(Buffer.from(promptMarkdown)) };
}
// Identity references first (images 1..N), then the cast style reference (image N+1).
const images = [...identityReferences, reference].map((file) => {
  const bytes = readFileSync(file);
  return { file, sha256: sha256(bytes), url: `data:${mimeOf(file)};base64,${bytes.toString('base64')}` };
});
const referenceSha256 = images.at(-1).sha256;
const identityReferenceReceipt = images.slice(0, -1).map(({ file, sha256: digest }) => ({ file, sha256: digest }));
const imagesApi = usesOpenRouterImagesApi(model);
const preflight = {
  dryRun,
  provider: 'openrouter',
  model,
  ...(imagesApi ? { endpoint: 'images' } : {}),
  ...(fichaFile ? { ficha: fichaFile, identityReferences: identityReferenceReceipt } : { promptFile }),
  promptCharacters: prompt.length,
  reference,
  referenceSha256,
  output,
  imageSize: '1K',
  aspectRatio,
};
console.log(JSON.stringify(preflight, null, 2));
if (args.includes('--print-prompt')) console.log(prompt);
if (dryRun) process.exit(0);

const env = { ...loadEnv(), ...process.env };
if (!env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY ausente; use --dry-run ou configure fora do git');
const imageParts = images.map(({ url }) => ({ type: 'image_url', image_url: { url } }));
const response = await fetch(`https://openrouter.ai/api/v1/${imagesApi ? 'images' : 'chat/completions'}`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    'content-type': 'application/json',
    'HTTP-Referer': 'https://game.csbrasil.online',
    'X-Title': 'CORO SOLTO: Treta Suprema',
  },
  body: JSON.stringify(imagesApi
    ? { model, prompt, aspect_ratio: aspectRatio, quality: 'high', n: 1, input_references: imageParts }
    : {
      model,
      modalities: ['image', 'text'],
      image_config: { aspect_ratio: aspectRatio, image_size: '1K' },
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, ...imageParts] }],
    }),
});
if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${(await response.text()).slice(0, 600)}`);
const payload = await response.json();
const base64 = imagesApi
  ? payload.data?.[0]?.b64_json
  : /^data:image\/[a-z0-9.+-]+;base64,(.+)$/i.exec(payload.choices?.[0]?.message?.images?.[0]?.image_url?.url || '')?.[1];
if (!base64) {
  const diagnostic = {
    generationId: payload.id || null,
    finishReason: payload.choices?.[0]?.finish_reason || null,
    message: String(payload.choices?.[0]?.message?.content || '').slice(0, 400),
    error: payload.error?.message || null,
  };
  throw new Error(`OpenRouter respondeu sem imagem base64: ${JSON.stringify(diagnostic)}`);
}
const raw = Buffer.from(base64, 'base64');
mkdirSync(dirname(output), { recursive: true });
await sharp(raw).png().toFile(output);
const bytes = readFileSync(output);
const metadata = await sharp(bytes).metadata();
const receipt = {
  provider: 'openrouter',
  model,
  ...(imagesApi ? { endpoint: 'images' } : {}),
  generationId: payload.id || null,
  generatedAt: new Date().toISOString(),
  ...promptSource,
  ...(fichaFile ? { identityReferences: identityReferenceReceipt, aspectRatio } : {}),
  reference,
  referenceSha256,
  width: metadata.width,
  height: metadata.height,
  sha256: sha256(bytes),
  usage: payload.usage || null,
};
writeFileSync(`${output}.json`, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, output, ...receipt }, null, 2));
