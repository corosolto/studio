# CORO SOLTO — primeira leva de direção visual

Pedido do dono: melhorar de forma visível o padrão de mapas, personagens e
ambiência, perseguindo referência escolhida e linguagem comum de produção.
Ele avalia o estado atual em 5–6, às vezes 7, e deseja 8–9, até 10. O resultado
precisa ser realizável em WebGL/Three.js. Pedido desta etapa: produzir a primeira
leva de conceitos. Nenhuma nota já foi conquistada ou comprovada.

## Escopo desta leva

Três direções por três vistas reais do mesmo mapa público Lajes: ambiente,
primeira pessoa e personagem punk fictício. As capturas estão em `baseline/`;
posição, FOV, versão, arma e encenação em `capture-metadata.json`.

- A: competitivo limpo, com formas e valores claros.
- B: realismo estilizado, com maior separação de materiais.
- C: caricatura elaborada, preservando o humor e a identidade brasileira.

Os prompts integrais estão em `prompts/`; `recipes.json` registra as receitas
candidatas. Imagem 1 é a referência espacial; imagem 2, quando existe, é apenas
a referência de acabamento da mesma direção. Não copiar composição da imagem 2.

## Critérios de revisão dos pixels

1. Mesmas câmeras, arquitetura, percursos, coberturas, aberturas e objetos.
   Qualquer nova grade, muro, prop ou mudança de passagem deve ser apontada.
   Não aceitar automaticamente alterações espaciais porque a imagem é bonita.
2. Punk preserva cabelo em blocos multicoloridos, jaqueta azul, calça xadrez
   vermelha, botas, rifle, pose, membros e silhueta. A primeira pessoa preserva
   pistola, mãos e mangas vermelhas com formas de estrela brancas.
3. Brasil reconhecível e linguagem coerente entre vistas. Materiais, desgaste,
   paleta e iluminação devem se repetir de modo intencional.
4. Acabamento e leitura em escala de jogo: não depender de close, poluição ou
   efeitos que escondam alvos. Não há HUD novo neste estudo.
5. A receita deve ser plausível em Three.js r160/WebGL2 com meshes, bevels
   seletivos, texturas PBR, AO/lightmaps assados como candidatos, um sol com
   shadow map, ambiente e pós moderado. Sem ray tracing, GI dinâmica, névoa
   volumétrica densa, DOF cinematográfico, fios de cabelo ou microdisplacement.

## Limite da aprovação

São imagens 2D de direção, não assets 3D ou renders de uma implementação nova.
Não permitem medir draw calls, memória, FPS, polycount, UV, pivôs ou consistência
temporal. Aprovação visual de um conceito não é aceite técnico nem autorização
de implantação. Não há troca de engine, dependência nova, PR, merge ou deploy.

Depois da escolha de Ruben: traduzir uma direção em uma pequena amostra jogável
no motor, comparar as mesmas câmeras e em movimento e medir nos aparelhos alvo.
Só depois de provar o salto e a repetibilidade ampliar para o resto do jogo.
Preservar as frentes de lançamento e a meta de envio às lojas em 04/11.
