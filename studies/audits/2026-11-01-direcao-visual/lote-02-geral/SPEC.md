# CORO SOLTO — consistência global B/C

Ruben escolheu, nesta ordem: B realismo estilizado, C caricatura elaborada,
A competitivo limpo e base. Quer ver o conjunto antes de decidir o padrão:
todos os mapas começando pelos mais escolhidos, modo Javaporco, uma arma de
cada tipo, personagens e skins da loja em três ângulos de terceira pessoa
no cenário. A decisão sobre adiar Unreal por cerca de seis meses é condicional
à consistência vista no conjunto; não foi tomada como decisão de plataforma.

## Objetivo e definição de pronto

Produzir um catálogo comparativo local de direção visual, com base real e B/C,
cobrindo os 18 mapas do registro público (12 jogáveis e seis retirados para
retrabalho, acessados pela oficina), o modo Javaporco na versão de preview,
as famílias de arma existentes e personagens/skins com três ângulos no cenário.
Inventariar os catálogos e marcar cobertura explicitamente; não apresentar uma
amostra como todo o acervo. Começar pelos mapas prioritários sem encerrar o
objetivo nas primeiras cinco imagens. Conservar originais, prompts, câmeras,
fontes, hashes, itens ausentes e revisão independente. Sem alteração do jogo.

## Referências e linguagem comum

Lote 01 como direção escolhida pelo dono. B tem prioridade editorial. As receitas
compartilham escala de detalhe, separação de roughness, desgaste localizado,
bevels seletivos, contato, leitura de alvo e exposição. Preservar cores de
identidade, roupa, skin, facção, placa e arma do original. Respeitar bioma e luz
motivada: hospital não vira rua ensolarada, floresta não vira favela.

B: realismo estilizado, materiais distintos e críveis, variação de superfície
em escala média e leitura competitiva. C: variações pintadas amplas, agrupamento
de cor e formas mais gráficas com materiais e iluminação coerentes. Em ambos,
preservar a identidade satírica e brasileira já existente. Não redesenhar elenco.

## Travas

Mesma câmera e estrutura espacial entre base/B/C. Sem inserir objetos, bandeiras,
cobertura, pessoas, armas, árvores ou rotas. Personagens/skins preservam design,
corpo, número de membros, roupa, arma e contatos; três ângulos da mesma pose e
posição no mesmo cenário. Não confundir as vistas com três skins diferentes.

Viabilidade candidata em Three.js r160/WebGL2: meshes, texturas PBR, bevel/normal,
AO/lightmap assado quando aplicável, luzes motivadas, shadow maps, ambiente
estático e pós moderado. Sem exigir ray tracing, GI dinâmica, DOF, cabelo em fios,
microdisplacement ou volumes densos. Cenas atuais públicas e preview são fontes
distintas e ficam rotuladas.

## Aceite e limites

Estes são conceitos 2D. Não são implementação, novo asset 3D, FPS medido ou
promessa de nota 8–9. A crítica separa fidelidade espacial/identidade de utilidade
como referência de acabamento. Referência bonita com objeto inventado não passa
para integração. O dono escolhe o padrão após comparar; não escolher C só por
um resultado ter passado no lote 01. A prova no renderer virá em amostra jogável.

Pipeline existente: client/tools/gen-image.mjs, OpenRouter. Artefatos fora do
client. Sem nova worktree, dependência de runtime, commit, PR, merge ou deploy.
Meta de envio às lojas em 04/11 permanece preservada.

## Decisão do dono — 01/11/2026

Estudo preservado. Após ver o conjunto, Ruben considerou B (realismo) mais
bonito e C (gráfico) mais próximo da aparência de jogo; ambos representam a
direção desejada de melhoria em relação ao visual atual.

Escolha condicional: B se a aparência puder ser reproduzida em Three.js/WebGL
com bom desempenho nos dispositivos dos usuários. Se B não atender a isso, C
é a alternativa, também sujeita à validação real. Não há metas numéricas
aprovadas, benchmark realizado ou mudança de engine decidida por esta escolha.

A ressalva do dono fica preservada: imagens bonitas geradas por IA podem não
ser reproduzidas no jogo real com a mesma fidelidade. Os conceitos não são
prova de implementação, jogabilidade em movimento ou desempenho. As críticas
de fidelidade e os desvios continuam válidos; a preferência estética por B
não aprova automaticamente esses desvios para integração.

**Não operar agora.** Esta atualização autoriza apenas salvar o estudo e a
decisão. Nenhuma implementação, protótipo, geração adicional ou alteração no
jogo será iniciada por este registro. Uma prova real pequena fica como opção
futura, somente quando o dono solicitar retomar.

Registro estruturado: [owner-decision.json](owner-decision.json). Galeria, bases,
conceitos, prompts, câmeras, hashes, visões gerais, cobertura e revisões estão
preservados na pasta deste estudo.
