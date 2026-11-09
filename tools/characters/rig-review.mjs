#!/usr/bin/env node
// Review sheets for the Blender character rig pipeline (docs/character-rig.md).
//
//   node tools/characters/rig-review.mjs joints <work>   front + side with a 5 cm grid and joint dots
//   node tools/characters/rig-review.mjs parts <work>    flat-colour part renders with a legend
//   node tools/characters/rig-review.mjs sheet <out.png> <columns> <title> <label=png>...
//                                                         labelled contact sheet of arbitrary PNGs
//
// Blender writes each orthographic PNG with a `<png>.view.json` sidecar (centre, image axes,
// pixels per metre); the grid and joint dots are drawn here from those numbers, in metres.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const BACKGROUND = { r: 58, g: 60, b: 66, alpha: 1 };
const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function project(view, point) {
  const d = point.map((v, i) => v - view.center[i]);
  const dot = (a) => a[0] * d[0] + a[1] * d[1] + a[2] * d[2];
  return [view.width / 2 + dot(view.right) * view.pixelsPerMetre, view.height / 2 - dot(view.up) * view.pixelsPerMetre];
}

function gridSvg(view, spacing = 0.05) {
  const lines = [];
  const ppm = view.pixelsPerMetre;
  const axisCentre = (axis) => axis.reduce((sum, a, i) => sum + a * view.center[i], 0);
  const horizontal = axisCentre(view.right), vertical = axisCentre(view.up);
  const halfW = view.width / 2 / ppm, halfH = view.height / 2 / ppm;
  for (let k = Math.ceil((horizontal - halfW) / spacing); k * spacing <= horizontal + halfW; k += 1) {
    const x = view.width / 2 + (k * spacing - horizontal) * ppm;
    const major = k % 10 === 0, mid = k % 5 === 0;
    lines.push(`<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${view.height}" stroke="${major ? '#ffd23f' : '#ffffff'}" stroke-opacity="${major ? 0.7 : mid ? 0.45 : 0.22}" stroke-width="${major ? 1.6 : 1}"/>`);
    if (mid) lines.push(`<text x="${(x + 3).toFixed(1)}" y="${view.height - 6}" font-size="13" fill="#ffd23f" font-family="Helvetica, Arial, sans-serif">${(k * spacing).toFixed(2)}</text>`);
  }
  for (let k = Math.ceil((vertical - halfH) / spacing); k * spacing <= vertical + halfH; k += 1) {
    const y = view.height / 2 - (k * spacing - vertical) * ppm;
    const major = k % 10 === 0, mid = k % 5 === 0;
    lines.push(`<line x1="0" y1="${y.toFixed(1)}" x2="${view.width}" y2="${y.toFixed(1)}" stroke="${major ? '#ffd23f' : '#ffffff'}" stroke-opacity="${major ? 0.7 : mid ? 0.45 : 0.22}" stroke-width="${major ? 1.6 : 1}"/>`);
    if (mid) lines.push(`<text x="4" y="${(y - 3).toFixed(1)}" font-size="13" fill="#ffd23f" font-family="Helvetica, Arial, sans-serif">${(k * spacing).toFixed(2)}</text>`);
  }
  return lines.join('');
}

function jointSvg(view, joints) {
  const out = [];
  const colour = (name) => (/^Left|_L$/.test(name) ? '#4da3ff' : /^Right|_R$/.test(name) ? '#3ddc84' : '#ff4d4d');
  const placed = [];
  for (const [name, point] of Object.entries(joints)) {
    if (/^Curl_/.test(name)) continue;
    const [x, y] = project(view, point);
    out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${colour(name)}" stroke="#000" stroke-width="1.5"/>`);
    // Side view stacks left and right joints: nudge overlapping labels sideways first,
    // then up, and draw a leader line back to the dot.
    let lx = x + 7, ly = y - 7;
    for (let tries = 0; placed.some(([px, py]) => Math.abs(px - lx) < 90 && Math.abs(py - ly) < 13) && tries < 12; tries += 1) {
      if (tries % 2 === 0) lx += 95; else { lx -= 95; ly -= 13; }
    }
    placed.push([lx, ly]);
    if (lx !== x + 7 || ly !== y - 7) out.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(lx - 2).toFixed(1)}" y2="${(ly - 4).toFixed(1)}" stroke="${colour(name)}" stroke-width="1"/>`);
    out.push(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="13" font-weight="bold" fill="${colour(name)}" stroke="#000" stroke-width="3" paint-order="stroke" font-family="Helvetica, Arial, sans-serif">${esc(name)}</text>`);
  }
  return out.join('');
}

async function framed(png, overlaySvg, view, title) {
  const base = await sharp(png).png().toBuffer();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${view.width}" height="${view.height}">${overlaySvg}` +
    `<text x="8" y="22" font-size="18" font-weight="bold" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke" font-family="Helvetica, Arial, sans-serif">${esc(title)}</text></svg>`;
  return sharp({ create: { width: view.width, height: view.height, channels: 4, background: BACKGROUND } })
    .composite([{ input: base }, { input: Buffer.from(svg) }]).png().toBuffer();
}

async function hstack(buffers, out, gap = 12) {
  const metas = await Promise.all(buffers.map((b) => sharp(b).metadata()));
  const height = Math.max(...metas.map((m) => m.height));
  const width = metas.reduce((sum, m) => sum + m.width, 0) + gap * (buffers.length - 1);
  let x = 0;
  const layers = buffers.map((input, i) => { const layer = { input, left: x, top: 0 }; x += metas[i].width + gap; return layer; });
  await sharp({ create: { width, height, channels: 4, background: { r: 20, g: 20, b: 24, alpha: 1 } } }).composite(layers).png().toFile(out);
  console.log(`WROTE ${out}`);
}

const readView = (png) => JSON.parse(readFileSync(`${png}.view.json`, 'utf8'));

async function jointsSheet(work) {
  const joints = JSON.parse(readFileSync(path.join(work, 'joints.json'), 'utf8'));
  const buffers = [];
  for (const view of ['front', 'side']) {
    const png = path.join(work, `joints-${view}.png`);
    const v = readView(png);
    buffers.push(await framed(png, gridSvg(v) + jointSvg(v, joints.joints), v, `${view} — 5 cm grid, metres${joints.overridden?.length ? ` — override: ${joints.overridden.length} joints` : ''}`));
  }
  await hstack(buffers, path.join(work, 'joints-review.png'));
}

async function partsSheet(work) {
  const legend = JSON.parse(readFileSync(path.join(work, 'parts-legend.json'), 'utf8'));
  const buffers = [];
  for (const view of ['front', 'back', 'side']) {
    const png = path.join(work, `parts-${view}.png`);
    const v = readView(png);
    const key = view === 'front'
      ? legend.map((l, i) => `<rect x="8" y="${34 + i * 20}" width="14" height="14" fill="${l.hex}" stroke="#000"/><text x="28" y="${46 + i * 20}" font-size="14" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke" font-family="Helvetica, Arial, sans-serif">${esc(l.name)}</text>`).join('')
      : '';
    buffers.push(await framed(png, key, v, view));
  }
  await hstack(buffers, path.join(work, 'parts-review.png'));
}

// sheet <out.png> <columns> <title> <label=png>...
async function contactSheet(out, columns, title, entries) {
  const cells = [];
  for (const entry of entries) {
    const at = entry.indexOf('=');
    const label = entry.slice(0, at), file = entry.slice(at + 1);
    if (!existsSync(file)) throw new Error(`missing image ${file}`);
    cells.push({ label, buffer: await sharp(file).png().toBuffer(), meta: await sharp(file).metadata() });
  }
  const cw = Math.max(...cells.map((c) => c.meta.width)), ch = Math.max(...cells.map((c) => c.meta.height)) + 26;
  const rows = Math.ceil(cells.length / columns);
  const head = 40;
  const width = cw * columns, height = head + ch * rows;
  const layers = [{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${head}"><text x="10" y="28" font-size="22" font-weight="bold" fill="#fff" font-family="Helvetica, Arial, sans-serif">${esc(title)}</text></svg>`), left: 0, top: 0 }];
  cells.forEach((c, i) => {
    const left = (i % columns) * cw, top = head + Math.floor(i / columns) * ch;
    layers.push({ input: c.buffer, left, top: top + 26 });
    layers.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="26"><text x="6" y="19" font-size="16" fill="#ffd23f" font-family="Helvetica, Arial, sans-serif">${esc(c.label)}</text></svg>`), left, top });
  });
  await sharp({ create: { width, height, channels: 4, background: { r: 20, g: 20, b: 24, alpha: 1 } } }).composite(layers).png().toFile(out);
  console.log(`WROTE ${out}`);
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === 'joints') await jointsSheet(path.resolve(rest[0]));
else if (mode === 'parts') await partsSheet(path.resolve(rest[0]));
else if (mode === 'sheet') await contactSheet(path.resolve(rest[0]), Number(rest[1]), rest[2], rest.slice(3));
else {
  console.error('usage: rig-review.mjs joints <work> | parts <work> | sheet <out.png> <columns> <title> <label=png>...');
  process.exit(1);
}
