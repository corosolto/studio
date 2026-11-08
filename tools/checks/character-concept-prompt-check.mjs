#!/usr/bin/env node
// Concept prompt and OpenRouter route contract. Runs the generator only with --dry-run,
// which exits before credentials are read; no API is ever called.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeCharacterConceptPrompt } from '../lib/character-concept-prompt.mjs';
import { usesOpenRouterImagesApi } from '../lib/openrouter-image.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const generator = path.join(root, 'tools/gen-character-concept-openrouter.mjs');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const base = { id: 'fixture', genero: 'm', identidade: 'invented test identity', roupa: 'plain test outfit', corpo: 'about 1.75 m, average build' };
const originalClause = 'ORIGINAL CHARACTER: an invented face and design';

function expect(label, condition) {
  if (!condition) throw new Error(`${label} failed`);
  console.log(`PASS ${label}`);
}

const original = composeCharacterConceptPrompt(base);
expect('No references adds the ORIGINAL CHARACTER clause', original.includes(originalClause) && !original.includes('PUBLIC-DOMAIN FIGURE'));
expect('No references describes the body from the character sheet', original.includes('BODY (from the character sheet, the most important part)'));
expect('Human default keeps the 1/7 head canon and image 1 as the cast', original.includes('ONE adult man') && original.includes('head about 1/7') && original.includes('STYLE (image 1 is'));
expect('genero f selects an adult woman', composeCharacterConceptPrompt({ ...base, genero: 'f' }).includes('ONE adult woman'));

const publicDomain = composeCharacterConceptPrompt({ ...base, dominioPublico: 'Stoker 1897 novel' });
expect('dominioPublico swaps the lock for the PUBLIC-DOMAIN FIGURE clause', publicDomain.includes('PUBLIC-DOMAIN FIGURE (Stoker 1897 novel): base the look only on public-domain sources') && !publicDomain.includes(originalClause));

const referenced = composeCharacterConceptPrompt({ ...base, dominioPublico: 'ignored with photos' }, { referenceCount: 2 });
expect('Photo references drop both rights clauses', !referenced.includes(originalClause) && !referenced.includes('PUBLIC-DOMAIN FIGURE'));
expect('Photo references number images 1..N and the cast as N+1', referenced.includes('(from the photo references, images 1 to 2)') && referenced.includes('STYLE (image 3 is') && referenced.includes('BODY (measured on photos'));

const creature = composeCharacterConceptPrompt({ ...base, especie: 'plush mascot creature', proporcao: 'head about 1/3 of total height.' });
expect('especie replaces the adult human and applies proporcao', creature.includes('ONE plush mascot creature') && creature.includes('PROPORTIONS: head about 1/3 of total height.') && !creature.includes('head about 1/7'));
let rejected = false;
try { composeCharacterConceptPrompt({ ...base, especie: 'plush mascot creature' }); } catch { rejected = true; }
expect('especie without proporcao is rejected', rejected);

expect('openai/gpt-image-* routes to the Images API', usesOpenRouterImagesApi('openai/gpt-image-1') && usesOpenRouterImagesApi('openai/gpt-image-1-mini'));
expect('Other models keep chat/completions', !usesOpenRouterImagesApi('google/gemini-3-pro-image') && !usesOpenRouterImagesApi('google/gemini-3.1-flash-image') && !usesOpenRouterImagesApi('openai/gpt-5'));

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-concept-'));
try {
  const reference = path.join(directory, 'cast.png');
  const fichaPath = path.join(directory, 'fixture.json');
  const promptPath = path.join(directory, 'prompt.md');
  fs.writeFileSync(reference, png);
  fs.writeFileSync(fichaPath, JSON.stringify({ ...base, refs: [] }));
  fs.writeFileSync(promptPath, '# Fixture\n\n## Prompt usado\n\nA plain invented test character.\n');
  const dryRun = (...args) => {
    const stdout = execFileSync(process.execPath, [generator, ...args, '--reference', reference, '--out', path.join(directory, 'out.png'), '--dry-run'], { cwd: directory, encoding: 'utf8' });
    return stdout;
  };
  const legacy = JSON.parse(dryRun('--prompt-file', promptPath));
  expect('Prompt-file dry run keeps its preflight shape, model and 1:1 aspect', JSON.stringify(Object.keys(legacy)) === JSON.stringify(['dryRun', 'provider', 'model', 'promptFile', 'promptCharacters', 'reference', 'referenceSha256', 'output', 'imageSize', 'aspectRatio'])
    && legacy.model === 'google/gemini-3.1-flash-image' && legacy.aspectRatio === '1:1');
  const fichaRun = dryRun('--ficha', fichaPath, '--model', 'openai/gpt-image-1', '--print-prompt');
  const preflight = JSON.parse(fichaRun.slice(0, fichaRun.indexOf('\n}\n') + 2));
  expect('Ficha dry run routes gpt-image to the Images API at 2:3', preflight.endpoint === 'images' && preflight.aspectRatio === '2:3' && preflight.identityReferences.length === 0);
  expect('Ficha dry run prints the composed ORIGINAL CHARACTER prompt', fichaRun.includes(originalClause));
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
console.log('PASS Character concept prompt and OpenRouter route contract');
