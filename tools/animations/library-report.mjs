#!/usr/bin/env node
// Fold clip-qa reports into a library index and summarise them per catalog category
// (docs/animation-conversion.md#library).
//
//   node tools/animations/library-report.mjs --index=<library>/index.json --qa=<label>=<qa.json>... [--md=<summary.md>]
//
// Adds `qa.<label> = { verdict: 'pass' | 'fail', failures }` to every clip of the index (in
// place) and prints, per category, the clip count and the passes per character, plus the
// failure kinds (the clause before the number in each clip-qa failure).
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const indexFile = flag('index');
const reports = args.filter((a) => a.startsWith('--qa=')).map((a) => { const [label, file] = a.slice(5).split('='); return { label, report: JSON.parse(readFileSync(file, 'utf8')) }; });
if (!indexFile || !reports.length) {
  console.error('usage: library-report.mjs --index=<index.json> --qa=<label>=<qa.json>... [--md=<summary.md>]');
  process.exit(1);
}
const index = JSON.parse(readFileSync(indexFile, 'utf8'));
const kind = (failure) => failure.replace(/ [-\d.]+.*$/, '').replace(/ \(.*$/, '').trim();
for (const { label, report } of reports) {
  const byName = new Map(report.results.map((r) => [r.name, r]));
  for (const clip of index.clips) {
    const r = byName.get(clip.name);
    clip.qa ||= {};
    clip.qa[label] = r ? { verdict: r.failures.length ? 'fail' : 'pass', failures: r.failures } : { verdict: 'missing', failures: [] };
  }
}
writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`);

const labels = reports.map((r) => r.label);
const categories = [...new Set(index.clips.map((c) => c.category))].sort();
const rows = [];
const totals = Object.fromEntries(labels.map((l) => [l, 0]));
for (const category of categories) {
  const clips = index.clips.filter((c) => c.category === category);
  const kinds = new Map();
  const cells = labels.map((l) => {
    const pass = clips.filter((c) => c.qa[l].verdict === 'pass').length;
    totals[l] += pass;
    for (const c of clips) for (const f of c.qa[l].failures) kinds.set(`${kind(f)}`, (kinds.get(kind(f)) || 0) + 1);
    return `${pass}/${clips.length}`;
  });
  const top = [...kinds].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} (${n})`).join(', ');
  rows.push(`| ${category} | ${clips.length} | ${cells.join(' | ')} | ${top || 'n/a'} |`);
}
const header = `| category | clips | ${labels.map((l) => `${l} pass`).join(' | ')} | failure kinds (count over ${labels.join(' + ')}) |\n| --- | --- | ${labels.map(() => '---').join(' | ')} | --- |`;
const total = `| **total** | ${index.clips.length} | ${labels.map((l) => `${totals[l]}/${index.clips.length}`).join(' | ')} | |`;
const md = `${header}\n${rows.join('\n')}\n${total}\n`;
console.log(md);
if (flag('md')) writeFileSync(flag('md'), md);
