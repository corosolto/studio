import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname);
const IMG = path.join(ROOT, 'images');
const OUT = ROOT;
const font = 'DejaVu Sans, Arial, sans-serif';
const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const header = (title, subtitle, width) => `
  <rect width="${width}" height="112" fill="#121a20"/>
  <text x="40" y="48" fill="#f4eee1" font-family="${font}" font-size="30" font-weight="700">${esc(title)}</text>
  <text x="40" y="82" fill="#a9bbc4" font-family="${font}" font-size="18">${esc(subtitle)}</text>`;
const footer = (width, y, text = 'REFERÊNCIA / DIREÇÃO — não é render final do jogo') => `
  <rect y="${y}" width="${width}" height="54" fill="#121a20"/>
  <text x="40" y="${y + 34}" fill="#a9bbc4" font-family="${font}" font-size="16">${esc(text)}</text>`;
async function image(file, x, y, w, h, fit = 'cover') {
  const data = await sharp(path.join(IMG, file)).resize(w, h, { fit, background: '#202b33' }).png().toBuffer();
  return `<image href="data:image/png;base64,${data.toString('base64')}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>`;
}
function cardTitle(x, y, title, subtitle = '', color = '#f4eee1') {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="${font}" font-size="23" font-weight="700">${esc(title)}</text>
  ${subtitle ? `<text x="${x}" y="${y + 30}" fill="#a9bbc4" font-family="${font}" font-size="17">${esc(subtitle)}</text>` : ''}`;
}
function bullets(x, y, rows, color = '#d7e0e4', size = 17) {
  return rows.map((row, i) => `<text x="${x}" y="${y + i * 27}" fill="${color}" font-family="${font}" font-size="${size}">• ${esc(row)}</text>`).join('');
}

async function referencesBoard() {
  const width = 1600, cardW = 740, cardH = 430, left = 40, right = 820;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="1450" viewBox="0 0 ${width} 1450"><rect width="${width}" height="1450" fill="#202b33"/>${header('COMPLEXO FAVELA — referências visuais', 'Silhueta, rua, fios, materiais e horizonte para o gauntlet de Lajes', width)}`;
  const cards = [
    ['rocinha-telhados.jpg', left, 142, '1. LAJES HABITADAS', 'Caixas d’água, extensões, antenas, fibrocimento e varal.'],
    ['recife-rua.jpg', right, 142, '2. RUA COM TETO DE CABOS', 'Terra, grades, umidade e horizonte no fim do corredor.'],
    ['rocinha-fios.jpg', left, 710, '3. UTILIDADES NA FACHADA', 'Feixes, drops, postes, AC e amarrações — não linhas retas.'],
    ['alemao-camadas.jpg', right, 710, '4. HORIZONTE EM CAMADAS', 'Detalhe próximo + anel urbano + morro e haze.'],
  ];
  for (const [file, x, y, title, subtitle] of cards) {
    svg += `<rect x="${x}" y="${y}" width="${cardW}" height="500" rx="10" fill="#2c3942"/>`;
    svg += await image(file, x, y, cardW, cardH);
    svg += cardTitle(x + 18, y + 462, title);
    svg += `<text x="${x + 18}" y="${y + 488}" fill="#a9bbc4" font-family="${font}" font-size="16">${esc(subtitle)}</text>`;
  }
  svg += `<rect x="40" y="1240" width="1520" height="128" rx="10" fill="#2c3942"/>`;
  svg += cardTitle(64, 1278, 'O QUE PERSEGUIMOS', '', '#f4eee1');
  svg += bullets(64, 1320, ['Irregularidade construtiva e sinais de uso — não mais polígonos por si só.', 'Materiais motivados e atmosfera, preservando leitura competitiva.'], '#d7e0e4', 18);
  svg += footer(width, 1396);
  svg += '</svg>';
  return svg;
}

async function comparisonBoard() {
  const width = 1600;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="1714" viewBox="0 0 ${width} 1714"><rect width="${width}" height="1714" fill="#202b33"/>${header('ATUAL × PROPOSTA', 'Comparação de capturas reais com a direção pretendida', width)}`;
  const rows = [
    { y: 142, title: 'MAPA: de módulos para comunidade densa', current: 'atual-spawn.png', target: 'rocinha-telhados.jpg', currentLabel: 'ATUAL: fachadas e laje', targetLabel: 'ALVO: objetos de uso e silhueta irregular', bullets: ['Mais variação de altura e cobertura', 'Objetos de laje sem encher o orçamento', 'Horizonte com três camadas'] },
    { y: 650, title: 'PUNK: de figura poligonal para material e contato', current: 'atual-punk.png', target: 'referencia-punk-b.png', currentLabel: 'ATUAL: malha suavizada e contraste', targetLabel: 'ALVO: couro, tecido, pele e silhueta coerentes', bullets: ['Sem facetas dominantes em movimento', 'Mãos e pés com contato', 'Sem lavar preto/cores ou perder identidade'] },
    { y: 1158, title: 'AK: madeira, aço e orientação correta', current: 'atual-ak.png', target: 'referencia-mapa-b.png', currentLabel: 'ATUAL: AK derivada e ambiente fotográfico', targetLabel: 'ALVO: resposta de material e acabamento B', bullets: ['Cano e grip corretos em 1P/3P', 'Madeira/aço/tecido separados', 'Sem especular facetado ou modelo antigo'] },
  ];
  for (const row of rows) {
    svg += cardTitle(40, row.y, row.title);
    svg += `<rect x="40" y="${row.y + 20}" width="700" height="330" rx="8" fill="#2c3942"/><rect x="820" y="${row.y + 20}" width="700" height="330" rx="8" fill="#2c3942"/>`;
    svg += await image(row.current, 40, row.y + 20, 700, 330);
    svg += await image(row.target, 820, row.y + 20, 700, 330);
    svg += `<text x="48" y="${row.y + 372}" fill="#a9bbc4" font-family="${font}" font-size="16">${esc(row.currentLabel)}</text>`;
    svg += `<text x="828" y="${row.y + 372}" fill="#a9bbc4" font-family="${font}" font-size="16">${esc(row.targetLabel)}</text>`;
    svg += bullets(48, row.y + 406, row.bullets, '#d7e0e4', 17);
  }
  svg += footer(width, 1660);
  svg += '</svg>';
  return svg;
}

async function interiorBoard() {
  const width = 1600;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="1568" viewBox="0 0 ${width} 1568"><rect width="${width}" height="1568" fill="#202b33"/>${header('CASA JOGÁVEL — ataque e defesa', 'Interior real, porta principal, janela alternativa e saída', width)}`;
  svg += `<rect x="40" y="142" width="940" height="640" rx="10" fill="#2c3942"/>`;
  svg += await image('casa-interior.jpg', 40, 142, 940, 640);
  svg += `<rect x="1020" y="142" width="540" height="640" rx="10" fill="#2c3942"/>`;
  svg += cardTitle(1050, 190, 'FLUXO PROPOSTO');
  const nodes = [
    { y: 250, title: 'PORTA', text: 'acesso principal + visada' },
    { y: 390, title: 'INTERIOR', text: 'piso, teto, colisão e cobertura' },
    { y: 530, title: 'JANELA', text: 'salto/mantle + ataque/defesa' },
    { y: 670, title: 'SAÍDA', text: 'retorno ou segunda abertura' },
  ];
  for (const [i, node] of nodes.entries()) {
    svg += `<rect x="1050" y="${node.y - 34}" width="460" height="84" rx="8" fill="#3b4b56"/>`;
    svg += cardTitle(1070, node.y, node.title, '', '#f4eee1');
    svg += `<text x="1070" y="${node.y + 28}" fill="#a9bbc4" font-family="${font}" font-size="17">${esc(node.text)}</text>`;
    if (i < nodes.length - 1) svg += `<text x="1080" y="${node.y + 76}" fill="#e4b46b" font-family="${font}" font-size="28">↓</text>`;
  }
  svg += `<rect x="40" y="830" width="1520" height="130" rx="10" fill="#2c3942"/>`;
  svg += bullets(64, 866, ['Entrar e sair por porta e janela; atirar por ambas as aberturas.', 'Câmera e bot completam o percurso; nenhum colisor invisível.', 'Interior simplificado em low sem alterar a jogabilidade.'], '#d7e0e4', 19);
  svg += cardTitle(40, 1010, 'IMPLEMENTADO: interior real no jogo');
  svg += `<rect x="40" y="1030" width="940" height="430" rx="10" fill="#2c3942"/>`;
  svg += await image('casa-interior-jogo.png', 40, 1030, 940, 430);
  svg += `<rect x="1020" y="1030" width="540" height="430" rx="10" fill="#2c3942"/>`;
  svg += bullets(1050, 1080, ['Porta atravessada até x=-9,62.', 'Janela atravessada até x=-14,47.', 'Tiro e visada pelos vãos.', 'Rota do bot para entrar e sair.', 'med: 1005 calls / 1,344 M triângulos.', 'low: 379 calls / 583 mil triângulos.'], '#d7e0e4', 19);
  svg += footer(width, 1514, 'PROPOSTA E PRIMEIRA CASA IMPLEMENTADA — demais casas seguem fechadas');
  svg += '</svg>';
  return svg;
}

const [references, comparison, interior] = await Promise.all([referencesBoard(), comparisonBoard(), interiorBoard()]);
await Promise.all([
  sharp(Buffer.from(references)).png().toFile(path.join(OUT, '01-referencias-favela.png')),
  sharp(Buffer.from(comparison)).png().toFile(path.join(OUT, '02-atual-x-proposta.png')),
  sharp(Buffer.from(interior)).png().toFile(path.join(OUT, '03-casa-jogavel.png')),
  fs.promises.writeFile(path.join(OUT, '01-referencias-favela.svg'), references),
  fs.promises.writeFile(path.join(OUT, '02-atual-x-proposta.svg'), comparison),
  fs.promises.writeFile(path.join(OUT, '03-casa-jogavel.svg'), interior),
]);

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Complexo favela — proposta visual</title><style>
:root{color-scheme:dark;background:#202b33;color:#f4eee1;font-family:Arial,sans-serif}body{margin:0 auto;max-width:1640px;padding:24px;background:#202b33}h1{font-size:28px;margin:0 0 8px}p{color:#a9bbc4;line-height:1.5}section{margin:28px 0}img{display:block;width:100%;height:auto;border-radius:10px}figure{margin:0}figcaption{font-size:15px;color:#a9bbc4;margin:10px 0 22px}a{color:#e4b46b}nav{display:flex;gap:16px;flex-wrap:wrap;margin:18px 0}nav a{background:#2c3942;padding:10px 14px;border-radius:8px;text-decoration:none}
</style></head><body><h1>Complexo favela — proposta visual</h1><p>Pranchas de referência e direção. Não são renders finais nem promessa de implementação.</p><nav><a href="01-referencias-favela.png">1. Referências</a><a href="02-atual-x-proposta.png">2. Atual × proposta</a><a href="03-casa-jogavel.png">3. Casa jogável</a><a href="../LAJES-FAVELA-GAUNTLET-PROPOSTA.md">Proposta completa</a></nav>
<section><h2>1. Referências de favela</h2><figure><a href="01-referencias-favela.png"><img src="01-referencias-favela.png" alt="Prancha com telhados de Rocinha, rua de Recife, fios e horizonte do Complexo do Alemão"></a><figcaption>Silhueta, rua, utilidades e horizonte que orientam o gauntlet.</figcaption></figure></section>
<section><h2>2. Estado atual × proposta</h2><figure><a href="02-atual-x-proposta.png"><img src="02-atual-x-proposta.png" alt="Comparação das capturas atuais de Lajes, Punk e AK com as referências de direção"></a><figcaption>O que já melhorou e o que ainda precisa mudar em arquitetura, personagem e arma.</figcaption></figure></section>
<section><h2>3. Casa jogável</h2><figure><a href="03-casa-jogavel.png"><img src="03-casa-jogavel.png" alt="Referência de interior de casa e fluxo porta, interior, janela e saída"></a><figcaption>Interior real com ataque/defesa, entrada e saída validadas por gameplay.</figcaption></figure></section>
</body></html>`;
await fs.promises.writeFile(path.join(OUT, 'index.html'), html);
console.log('Pranchas geradas em', OUT);
