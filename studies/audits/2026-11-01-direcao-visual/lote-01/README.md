# Primeira leva visual do CORO SOLTO

Abra `galeria.html` para comparar três direções nas vistas de ambiente,
primeira pessoa e personagem. O controle de sobreposição revela a captura
original; clique na imagem para abrir o arquivo integral. A galeria funciona
localmente e não envia avaliações ou conteúdo para serviço algum.

Os nove conceitos são imagens 2D de uma direção possível. A captura original é
real e vem do renderer público alpha.133 em Lajes. As melhorias propostas ainda
não estão implementadas. A resolução de saída do modelo pode variar ligeiramente
da proporção solicitada; os originais foram preservados sem recorte posterior.

O acabamento foi pedido com técnicas convencionais de Three.js/WebGL2: geometria
modular, pequenos bevels, materiais PBR, AO e iluminação estática assada como
candidatos, sol com shadow map, ambiente e pós moderado. Nenhuma imagem prova
custo de GPU, memória ou fidelidade em movimento. As receitas candidatas de cada
direção ficam na galeria e em `recipes.json`.

Geração via `client/tools/gen-image.mjs` existente, com OpenRouter e
`google/gemini-3-pro-image`. `generation-manifest.json` registra arquivos, hashes,
prompts e referências. `rejected/` conserva tentativas descartadas; elas não são
apagadas nem apresentadas como resultado aprovado. O runner retoma apenas itens
ausentes e não repete chamadas já registradas.

`SPEC.md` define o pedido e a revisão. `REVIEW.md` e `review.json` registram a
avaliação independente, incluindo divergências espaciais e de identidade. Uma
imagem bonita com objetos, pose ou layout alterados pode orientar materiais e
iluminação, mas não deve virar fonte de reconstrução do mapa.

Depois da escolha do dono, o passo seguinte é implementar uma amostra pequena
do mesmo trecho no motor real. Repetir câmeras, validar deslocamento, animação,
leitura de alvo, materiais e arma e medir os aparelhos alvo. A decisão sobre
expandir a linguagem para os demais mapas/personagens vem depois dessa prova.
Este estudo não altera o client nem a meta de envio às lojas em 04/11/2026.
