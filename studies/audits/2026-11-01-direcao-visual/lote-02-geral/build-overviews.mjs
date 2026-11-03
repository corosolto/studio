import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const subjects=[
 ['maps','map-piscina_treta','Piscina da Treta'],
 ['maps','map-amazonia','Treta na Amazônia'],
 ['javaporco','jav-city','Invasão dos Javaporcos · preview'],
 ['weapons','weapon-ak','AK-47 · primeira pessoa'],
 ['characters','char-punk','Punk · três ângulos no cenário'],
 ['skins','skin-canarinho-cyborg','Canarinho Cyborg · três ângulos no cenário']
];
for(const style of ['B','C']){
const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Visão geral ${style} · CORO SOLTO</title><style>*{box-sizing:border-box}html,body{margin:0;background:#111710;color:#eef4e8;font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif}main{width:1536px;padding:24px}header{display:flex;justify-content:space-between;align-items:end;padding-bottom:20px}h1{font-size:36px;letter-spacing:-.03em;margin:0}p{font-size:15px;color:#b8c7af;margin:5px 0 0}.mark{font-size:13px;letter-spacing:.12em;color:#cceab7}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0;background:#1d281c;border:1px solid #3b4936;overflow:hidden;border-radius:5px}figcaption{font-size:17px;padding:10px 14px;color:#d9eacb}img{display:block;width:734px;height:410px;object-fit:fill}footer{font-size:13px;color:#aebda7;margin-top:16px}</style><main><header><div><div class="mark">CORO SOLTO · LOTE 02</div><h1>${style==='B'?'B · Realismo estilizado':'C · Acabamento gráfico'}</h1><p>A mesma receita de materiais em mapas, modo, arma, personagem e skin.</p></div><span class="mark">CONCEITOS 2D · 01 NOV 2026</span></header><div class="grid">${subjects.map(([category,id,name])=>`<figure><figcaption>${name}</figcaption><img src="concepts/${category}/${style}-${id}.png" alt="${name}"></figure>`).join('')}</div><footer>Estudos gerados a partir de capturas reais. Desvios de fidelidade documentados na galeria. Integração, animação e desempenho ainda não validados.</footer></main></html>`;
await writeFile(root+'/visao-geral-'+style+'.html',html);
}
console.log('Overview pages B/C written. Render only after every PNG exists and decodes.');
