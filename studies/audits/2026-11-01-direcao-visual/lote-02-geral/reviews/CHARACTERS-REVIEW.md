# Revisão independente — personagens B/C

Concluída: 24/24 conceitos, 12/12 personagens. 19 APROVADOS e 5 REPROVADOS quanto à fidelidade 2D. Não há conceitos pendentes.

Objetivo: comparar cada conceito ao triptico real e preservar personagem, roupa, pose e local. A direção final pertence ao dono. Este arquivo é também o checkpoint recuperável da revisão.

Branch observado no repositório `client`: `feat/fps-paid-viewmodels-aaa`; HEAD `86c388b56`. Nenhum arquivo de fonte/manifest foi alterado e nenhum commit foi criado por esta revisão, conforme SPEC.

Método: imagens completas de base e conceito vistas individualmente com `view_image`. O JSON guarda hashes, caminhos, evidência e limitações por item. Os hashes de 48 entradas (24 conceitos + 24 referências, incluindo referências repetidas) foram conferidos contra os arquivos e manifest, sem divergências.

## Limites herdados e de prova

A captura é uma pose idle congelada sem arma nas mãos. Mãos vazias diante do corpo, joelhos flexionados e diferenças do fundo entre as três câmeras já estão na base. Não são erros inventados pelo acabamento. O arco dorsal da Caipora também já existe. Cão, pombo, barraca, blocos e quadra são elementos existentes. As pranchas mostram o corpo grande; não comprovam reconhecimento na distância de partida, contatos com arma, animação ou desempenho. Nada aqui valida polycount, UV, pivô, rig ou Three.js.

Nenhuma nova pessoa real contemporânea ou gore foi observado. Não se reatribui autoria dos personagens existentes pela geração. O critério Brasil foi a retenção da identidade/contexto presentes: cangaço, folclore, saúde, futebol e a Quebrada; não exige acrescentar bandeiras ou adereços a cada personagem.

## Resultado por personagem

| Personagem | B | C |
|---|---|---|
| Esquerdomacho | APROVADO | APROVADO |
| Doutora do SUS | REPROVADO | APROVADO |
| Caminhoneiro | APROVADO | APROVADO |
| Coach Quântico | APROVADO | APROVADO |
| Adjim | APROVADO | APROVADO |
| Punk | REPROVADO | APROVADO |
| Mandrake | APROVADO | APROVADO |
| Lampião | REPROVADO | APROVADO |
| Caipora | APROVADO | APROVADO |
| Zé da Gotinha | APROVADO | APROVADO |
| ET de Varginha | REPROVADO | APROVADO |
| Canarinho Pistola | APROVADO | REPROVADO |

## Divergências de consistência para decisão posterior

- A maioria dos C mantém volumes facetados e superfícies gráficas. C-ET acrescenta contorno preto, que destoa dos demais C e requer escolha editorial de consistência; não foi usado para escolher o padrão.
- B separa materiais com textura/roughness, mas B-Lampião e B-ET reinterpretam objetos do fundo; B-Punk insere adereços novos e B-Doutora insere pintura de chão.
- Preservação brasileira foi avaliada pela identidade/contexto existentes: uniformes, cangaço, folclore, mascote de saúde e rua da Quebrada, sem exigir bandeiras/adereços novos em personagens genéricos.

## Vereditos e evidência

### B-char-esquerdomacho — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-esquerdomacho.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/B-char-esquerdomacho.png`.

- Conferido: Óculos redondos, barba/cabelo ruivos, camiseta vermelha com círculos claros, jeans e bolsa de lona mantidos nas três vistas.
- Conferido: Tronco estreito, pernas flexionadas, mãos vazias diante do corpo e bolsa no mesmo ombro; perfil/costas coerentes com a frente.
- Conferido: Barracas, cão, blocos, quadra, postes e prédios continuam nos respectivos painéis da Quebrada.
- Uso como acabamento: Separação de tecido/jeans/lona e arredondamento de superfície úteis; a pintura torna braços e jeans mais volumosos visualmente, sem troca inequívoca de design na silhueta observada.

### C-char-esquerdomacho — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-esquerdomacho.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/C-char-esquerdomacho.png`.

- Conferido: Óculos redondos, barba/cabelo ruivos, camiseta vermelha com círculos claros, jeans e bolsa de lona mantidos nas três vistas.
- Conferido: Tronco estreito, pernas flexionadas, mãos vazias diante do corpo e bolsa no mesmo ombro; perfil/costas coerentes com a frente.
- Conferido: Barracas, cão, blocos, quadra, postes e prédios continuam nos respectivos painéis da Quebrada.
- Uso como acabamento: Agrupamento de cor e planos mais suaves conserva as peças e a silhueta esguia; não há nova skin ou objeto observado.

### B-char-doutora — REPROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-doutora.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/B-char-doutora.png`.

- Conferido: Jaleco branco, roupa turquesa, tênis brancos, estetoscópio e rabo de cavalo longo mantidos.
- Conferido: Mesma flexão de joelhos e gesto vazio das mãos; três vistas da mesma roupa, sem arma inventada.
- Uso como acabamento: Materiais do jaleco, calça e cabelo são úteis como referência, mas há invenção localizada do chão.
- Divergência: O painel do perfil acrescenta uma faixa branca horizontal no passeio, logo abaixo do meio-fio. A base tem passeio uniforme nessa região.
- Evidência: painel central, faixa horizontal em x≈460–915, y≈690–725 no conceito 1376×768; passeio abaixo do meio-fio. Origem: nova invenção no conceito; não está na captura.
- Conserto barato: Restaurar somente o trecho do passeio a partir da base, mantendo o acabamento do personagem; não prolongar a faixa de pedestres para a calçada.

### C-char-doutora — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-doutora.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/C-char-doutora.png`.

- Conferido: Jaleco branco, roupa turquesa, tênis brancos, estetoscópio e rabo de cavalo longo mantidos.
- Conferido: Mesma flexão de joelhos e gesto vazio das mãos; três vistas da mesma roupa, sem arma inventada.
- Uso como acabamento: Mantém o jaleco aberto, a cauda do cabelo e o cenário; o agrupamento claro/turquesa permite reconhecer a profissão sem redesenho observado.

### B-char-caminhoneiro — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-caminhoneiro.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/B-char-caminhoneiro.png`.

- Conferido: Boné verde/amarelo/branco, bigode preto, cabelo cacheado, camisa amarela com bordas verdes e emblema, fivela oval, luvas, jeans e botas marrons mantidos.
- Conferido: Corpo robusto, joelhos flexionados e mãos vazias à frente persistem nas três vistas.
- Conferido: Parte traseira da camisa continua amarela sem número ou estampa nova; ruas e blocos na posição original.
- Uso como acabamento: Jeans, couro da bota e tecido da camisa distintos; as dobras refinam o corpo robusto já existente.

### C-char-caminhoneiro — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-caminhoneiro.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/C-char-caminhoneiro.png`.

- Conferido: Boné verde/amarelo/branco, bigode preto, cabelo cacheado, camisa amarela com bordas verdes e emblema, fivela oval, luvas, jeans e botas marrons mantidos.
- Conferido: Corpo robusto, joelhos flexionados e mãos vazias à frente persistem nas três vistas.
- Conferido: Parte traseira da camisa continua amarela sem número ou estampa nova; ruas e blocos na posição original.
- Uso como acabamento: Grandes massas amarelas, verdes e azuis e solado mais limpo mantêm a identidade brasileira já presente.

### B-char-coach — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-coach.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/B-char-coach.png`.

- Conferido: Terno e calça azul-escuros, camisa clara aberta e microfone de cabeça mantidos.
- Conferido: Cabelo curto, corpo esguio, pernas flexionadas e gesto das mãos à frente continuam coerentes entre frente/perfil/costas.
- Conferido: Não aparecem gravata, arma, plateia ou adereços novos; quadra e rua permanecem no enquadramento original.
- Uso como acabamento: Acabamento do tecido e calçado mais crível; os traços faciais ficam menos sorridentes, mas o rosto, penteado e acessórios ainda correspondem à identidade genérica da base.

### C-char-coach — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-coach.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/C-char-coach.png`.

- Conferido: Terno e calça azul-escuros, camisa clara aberta e microfone de cabeça mantidos.
- Conferido: Cabelo curto, corpo esguio, pernas flexionadas e gesto das mãos à frente continuam coerentes entre frente/perfil/costas.
- Conferido: Não aparecem gravata, arma, plateia ou adereços novos; quadra e rua permanecem no enquadramento original.
- Uso como acabamento: Lapelas e planos do terno mais gráficos, com a mesma roupa e leitura do headset; nenhuma troca de design inequívoca observada.

### B-char-adjim — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-adjim.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/B-char-adjim.png`.

- Conferido: Chapéu vermelho com ornamento, nariz vermelho, maquiagem branca, cabelo lateral verde/azulado, gola franzida e macacão verde/amarelo de bolinhas mantidos.
- Conferido: Suspensórios, botões traseiros, punhos/tornozelos franzidos, luvas claras e sapatos compridos vermelho/amarelos continuam nas mesmas vistas.
- Conferido: Mesma pose vazia e pés em contato aparente com o chão; nenhuma arma ou objeto do palhaço acrescentado.
- Uso como acabamento: Tecido e dobras da gola ganham contraste; a gola fica mais marrom/escura que o lilás/bege da base, risco de paleta para transposição, sem mudar as peças.

### C-char-adjim — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-adjim.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/C-char-adjim.png`.

- Conferido: Chapéu vermelho com ornamento, nariz vermelho, maquiagem branca, cabelo lateral verde/azulado, gola franzida e macacão verde/amarelo de bolinhas mantidos.
- Conferido: Suspensórios, botões traseiros, punhos/tornozelos franzidos, luvas claras e sapatos compridos vermelho/amarelos continuam nas mesmas vistas.
- Conferido: Mesma pose vazia e pés em contato aparente com o chão; nenhuma arma ou objeto do palhaço acrescentado.
- Uso como acabamento: Preserva melhor a gola clara e a divisão de cores/bolinhas do macacão; cabelo facetado e sapatos exagerados são herdados da captura.

### B-char-punk — REPROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-punk.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/B-char-punk.png`.

- Conferido: Cabelo pontudo verde com pontas rosas, maquiagem escura, jaqueta preta, calça xadrez vermelha, correntes e botas altas mantidos.
- Conferido: Mesmo gesto vazio, pernas finas flexionadas e cabelo com leitura coerente nos três ângulos.
- Uso como acabamento: Couro, metal e xadrez ficam bem distintos, mas o acabamento inclui adereços de roupa novos.
- Divergência: Na vista de costas aparecem uma fileira larga de tachas no alto das costas/gola e duas fileiras na barra da jaqueta. A jaqueta de costas da base é lisa nessas áreas; as tachas de ombro originais não equivalem a essas novas bandas.
- Evidência: painel direito, alto das costas x≈1100–1167,y≈307–331 e barra x≈1110–1182,y≈390–410 no conceito 1376×768. Origem: nova invenção no conceito; ombros com tachas já existiam na base.
- Conserto barato: Remover as bandas de tachas das costas e da barra; preservar o couro, xadrez e tachas originais dos ombros.

### C-char-punk — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-punk.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/C-char-punk.png`.

- Conferido: Cabelo pontudo verde com pontas rosas, maquiagem escura, jaqueta preta, calça xadrez vermelha, correntes e botas altas mantidos.
- Conferido: Mesmo gesto vazio, pernas finas flexionadas e cabelo com leitura coerente nos três ângulos.
- Uso como acabamento: Mantém a jaqueta de costas predominantemente lisa e a escala das peças; botões, correntes e tachas dos ombros já existem na base.

### B-char-mandrake — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-mandrake.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/B-char-mandrake.png`.

- Conferido: Boné preto, óculos vermelhos, colete branco/vermelho/azul-escuro aberto, correntes douradas, tatuagens e relógio mantidos.
- Conferido: Bermuda branca/vermelha, bolso lateral, tênis azuis/verdes e o mesmo gesto vazio aparecem coerentemente nos três ângulos.
- Conferido: Rua, blocos, telha metálica, cão, barraca e quadra conservam a estrutura da captura.
- Uso como acabamento: Tecido do colete e bermuda, metal das correntes e calçado distinguem-se sem trocar a identidade urbana brasileira da base.

### C-char-mandrake — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-mandrake.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/C-char-mandrake.png`.

- Conferido: Boné preto, óculos vermelhos, colete branco/vermelho/azul-escuro aberto, correntes douradas, tatuagens e relógio mantidos.
- Conferido: Bermuda branca/vermelha, bolso lateral, tênis azuis/verdes e o mesmo gesto vazio aparecem coerentemente nos três ângulos.
- Conferido: Rua, blocos, telha metálica, cão, barraca e quadra conservam a estrutura da captura.
- Uso como acabamento: Grandes faixas de cor e contornos das peças preservam o colete, bermuda e acessórios; não foi observada skin alternativa.

### B-char-lampiao — REPROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-lampiao.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/B-char-lampiao.png`.

- Conferido: Chapéu de couro com três estrelas frontais, óculos, cabelo escuro, lenço, roupa marrom, bolsos e costuras claras mantidos.
- Conferido: Cartucheiras cruzadas na frente/costas, sandálias e pose sem arma nas mãos preservadas; os três ângulos mostram a mesma roupa.
- Uso como acabamento: Couro, tecido, cartucheiras e sandália rendem material de acabamento útil, porém o cenário foi reinterpretado com outros objetos.
- Divergência: Os blocos vermelho e ocre no painel de perfil foram substituídos por dois caixotes de madeira com tábuas diagonais; o bloco vermelho da vista de costas também vira caixote. As chapas metálicas de fundo são reinterpretadas como pano pendurado.
- Evidência: painel central, caixotes em x≈460–590,y≈350–455; painel direito, caixa em x≈1033–1076,y≈353–413; chapa acima/atrás do cenário frontal e da marquise. Origem: nova invenção no conceito; a base mostra prismas lisos coloridos e chapa ondulada.
- Conserto barato: Recompor os prismas vermelho/ocre e as chapas da referência, conservando câmeras/arestas e aplicando somente material/desgaste; manter o acabamento do personagem.

### C-char-lampiao — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-lampiao.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/C-char-lampiao.png`.

- Conferido: Chapéu de couro com três estrelas frontais, óculos, cabelo escuro, lenço, roupa marrom, bolsos e costuras claras mantidos.
- Conferido: Cartucheiras cruzadas na frente/costas, sandálias e pose sem arma nas mãos preservadas; os três ângulos mostram a mesma roupa.
- Uso como acabamento: Conserva os blocos coloridos e a chapa de fundo, além do chapéu, cartucheiras e roupa do personagem; volumes e cores mantêm a referência ao cangaço.

### B-char-caipora — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-caipora.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/B-char-caipora.png`.

- Conferido: Pele vermelha/alaranjada, cabelo longo vermelho, máscara/faixa escura nos olhos, top e proteção de pernas de onça, franjas e pés descalços preservados.
- Conferido: Arco preso às costas já existe na base e continua nas vistas; não é arma nova inventada pela geração.
- Conferido: Mesma pose de mãos livres à frente, mesma silhueta corporal e disposição do cenário; a roupa não foi trocada nem ampliada/reduzida em cobertura.
- Uso como acabamento: A textura da onça e as massas de cabelo são mais críveis; o cabelo pode orientar textura/normal sem exigir fios individuais em tempo real.

### C-char-caipora — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-caipora.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/C-char-caipora.png`.

- Conferido: Pele vermelha/alaranjada, cabelo longo vermelho, máscara/faixa escura nos olhos, top e proteção de pernas de onça, franjas e pés descalços preservados.
- Conferido: Arco preso às costas já existe na base e continua nas vistas; não é arma nova inventada pela geração.
- Conferido: Mesma pose de mãos livres à frente, mesma silhueta corporal e disposição do cenário; a roupa não foi trocada nem ampliada/reduzida em cobertura.
- Uso como acabamento: Mantém a paleta vermelha/onça e usa luz mais quente; franjas e arco pertencem ao desenho original e seguem coerentes entre vistas.

### B-char-gotinha — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-gotinha.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/B-char-gotinha.png`.

- Conferido: Cabeça grande arredondada com ponta, chapéu branco, cruz vermelha no chapéu e tórax, olhos pretos e sorriso preservados.
- Conferido: Corpo branco pequeno, braços curtos, duas pernas, pés grandes e gesto vazio mantêm as proporções do mascote nas três vistas.
- Conferido: Perfil/costas não ganham cruz ou rosto traseiro; mesmos blocos e cenário.
- Uso como acabamento: Superfície branca levemente têxtil permanece legível e separada do asfalto; marcas escuras de pneu foram adicionadas como desgaste de superfície, sem novos volumes/rotas.

### C-char-gotinha — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-gotinha.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/C-char-gotinha.png`.

- Conferido: Cabeça grande arredondada com ponta, chapéu branco, cruz vermelha no chapéu e tórax, olhos pretos e sorriso preservados.
- Conferido: Corpo branco pequeno, braços curtos, duas pernas, pés grandes e gesto vazio mantêm as proporções do mascote nas três vistas.
- Conferido: Perfil/costas não ganham cruz ou rosto traseiro; mesmos blocos e cenário.
- Uso como acabamento: Planos amplos de luz/sombra mantêm a identidade e os símbolos frontais; facetas visíveis na cabeça são acabamento de superfície, sem novo membro ou acessório.

### B-char-et — REPROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-et.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/B-char-et.png`.

- Conferido: Pele verde, cabeça grande, olhos vermelhos, pequenos relevos no topo, corpo fino sem roupa e gesto das mãos à frente preservados.
- Conferido: Mesmas três vistas e posição corporal; sem arma, roupa ou acessório novo no alienígena.
- Uso como acabamento: Pele mais lisa/especular e olhos separados por roughness oferecem referência, mas o fundo troca blocos por caixotes e a fachada frontal perde o tijolo exposto.
- Divergência: A pilha de volumes marrons à esquerda da frente e os blocos vermelho/ocre do perfil foram transformados em caixotes com tábuas diagonais. O bloco traseiro também vira caixa e a fachada frontal passa de tijolo aparente vermelho a reboco cinza.
- Evidência: painel esquerdo: caixas em x≈20–100,y≈263–395 e fachada x≈0–458,y≈213–390; centro: caixotes x≈460–590,y≈351–456; direita: caixa x≈1034–1076,y≈353–413. Origem: novas interpretações no conceito; não são objetos ou reboco observados na captura.
- Conserto barato: Restaurar volumes lisos, blocos vermelho/ocre e tijolo vermelho da base; reter o ET e apenas o acabamento superficial autorizado.

### C-char-et — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-et.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/C-char-et.png`.

- Conferido: Pele verde, cabeça grande, olhos vermelhos, pequenos relevos no topo, corpo fino sem roupa e gesto das mãos à frente preservados.
- Conferido: Mesmas três vistas e posição corporal; sem arma, roupa ou acessório novo no alienígena.
- Uso como acabamento: A paleta e silhueta do ET de Varginha são preservadas; o contorno preto é exclusivo deste C no lote inspecionado e precisa de decisão de consistência antes de aplicação global, sem reprovação de identidade por si só.

### B-char-canarinho — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-canarinho.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/B-char-canarinho.png`.

- Conferido: Cabeça amarela com crista, sobrancelhas zangadas, bico laranja/rosa, camisa amarela de gola/bordas verdes, número 24, short azul, meias brancas e calçado azul preservados.
- Conferido: Cauda, braços/penas, pernas curtas flexionadas e gesto vazio mantêm coerência entre frente/perfil/costas.
- Uso como acabamento: Tecido, plumagem e calçado ficam distintos; a aparência de penas deve orientar textura/normal e geometria simples, sem pressupor cabelo/penas individuais no renderer.

### C-char-canarinho — REPROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/characters/char-canarinho.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/characters/C-char-canarinho.png`.

- Conferido: Cabeça amarela com crista, sobrancelhas zangadas, bico laranja/rosa, camisa amarela de gola/bordas verdes, número 24, short azul, meias brancas e calçado azul preservados.
- Conferido: Cauda, braços/penas, pernas curtas flexionadas e gesto vazio mantêm coerência entre frente/perfil/costas.
- Uso como acabamento: Personagem, uniforme e volumes facetados permanecem reconhecíveis, mas o fundo traseiro ganhou uma paisagem urbana inexistente.
- Divergência: A vista de costas ganhou um skyline de prédios altos atrás da quadra/muro. A mesma área da base contém céu/neblina, sem essa fileira de torres.
- Evidência: painel direito, fundo acima do muro/quadra, x≈998–1375,y≈212–335 no conceito 1376×768. Origem: nova invenção no conceito; não é detalhe de material da captura.
- Conserto barato: Remover somente os prédios distantes adicionados e recompor o céu/neblina da base, preservando personagem, postes, quadra e muro.

## Continuação

Entregar os 24 vereditos ao agente coordenador; correções e seleção editorial dependem de etapa posterior autorizada.

As cinco reprovações são B-Doutora, B-Punk, B-Lampião, B-ET e C-Canarinho. Corrigir o trecho indicado e repetir a comparação com a mesma referência/hash antes de aceitar a versão corrigida.

Nenhum veredito escolhe B ou C como padrão nem atribui uma nota estética pelo dono. A aprovação deste relatório é apenas a fidelidade visual 2D; o aceite de asset/renderização requer amostra real no engine e revisão na distância de partida.
