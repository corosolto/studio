# Revisão independente — Javaporco e armas

Concluído: 26/26 conceitos vistos; 13 APROVADOS, 13 REPROVADOS. São 6 conceitos de Javaporco (4/2) e 20 de armas (9/11). Os números expressam fidelidade 2D à referência, sem ranking entre B e C.

Revisar 26 conceitos B/C: 3 bases do Javaporco e 10 famílias de arma, preservando arma/contagem/cenário e linguagem B/C.

Branch observado em `client`: `feat/fps-paid-viewmodels-aaa`; HEAD `86c388b56`. Sem geração, alteração de fonte/manifest ou commit. O relatório de personagens permanece intacto.

## Limites

- Conceitos 2D, sem validação de asset 3D ou desempenho; aprovação não escolhe padrão B/C pelo dono.
- Armas: uma captura estática de primeira pessoa em produção, com bloom=0; sem prova de animação, recarga, contatos ou alinhamento durante gameplay.
- Javaporco: preview local distinto de produção; quatro tipos são encenados, não onda ativa.

## Evidência e validação

Base e conceitos completos vistos com view_image; recortes comparáveis de farmácia, ônibus, parede, manga/luva e fachada ampliados apenas para inspeção. Vereditos não foram inferidos de prompts. Hashes finais conferidos contra generation-manifest.json.

52/52 verificações SHA-256 passaram (26 conceitos e 26 entradas de referência, 39 arquivos únicos). IDs cobrem exatamente os 26 extras do manifest. Não há imagem pendente. A conferência adicional de integridade do manifest inteiro passou em 272/272 hashes de 136 conceitos e suas referências (204 arquivos únicos); isso não estende o escopo visual deste relatório aos outros conceitos.

Recortes analíticos: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/reviews/extras-final-evidence.png` e `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/reviews/extras-jav-signage-evidence.png`. Os recortes são apenas auxiliares de inspeção, sem alteração das imagens avaliadas.

## Vereditos

### B-jav-city — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/javaporco/jav-city.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/javaporco/B-jav-city.png`.

- Conferido: Mesma vista aérea da cidade, cruzamento e quadras; volumes, telhados, postes/fios, carros e borda de mata mantêm posições reconhecíveis.
- Conferido: Igreja/torre branca à direita, prédio central com caixa d’água azul, clínica à esquerda e faixas do cruzamento permanecem no mesmo enquadramento.
- Conferido: Anéis/efeitos e animais visíveis na rua são da captura de preview; não foram confundidos com os quatro inimigos encenados de outra referência.
- Acabamento: Reboco e telhas ganham variação/contato, mantendo a paleta terracota/verde e a cidade brasileira cercada de mata.

### C-jav-city — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/javaporco/jav-city.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/javaporco/C-jav-city.png`.

- Conferido: Mesma vista aérea da cidade, cruzamento e quadras; volumes, telhados, postes/fios, carros e borda de mata mantêm posições reconhecíveis.
- Conferido: Igreja/torre branca à direita, prédio central com caixa d’água azul, clínica à esquerda e faixas do cruzamento permanecem no mesmo enquadramento.
- Conferido: Anéis/efeitos e animais visíveis na rua são da captura de preview; não foram confundidos com os quatro inimigos encenados de outra referência.
- Acabamento: Agrupamento da mata/telhados e cores mais chapadas preserva estrutura, rotas aparentes e contexto local.

### B-jav-pasto — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/javaporco/jav-pasto.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/javaporco/B-jav-pasto.png`.

- Conferido: Mesma clareira gramada no primeiro plano e mesma borda densa de troncos, copas e arbustos.
- Conferido: O caminho de terra à direita, linhas de troncos e silhuetas principais da vegetação permanecem; nenhum javaporco foi acrescentado nesta cena vazia.
- Conferido: Bioma de mata e luz de fim de dia mantidos; não vira favela, deserto ou floresta de outra composição.
- Acabamento: Casca, folhas e gramado recebem contraste e variação de luz/roughness; a faixa de luz no primeiro plano é mudança de acabamento/iluminação, sem novo obstáculo inequívoco.

### C-jav-pasto — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/javaporco/jav-pasto.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/javaporco/C-jav-pasto.png`.

- Conferido: Mesma clareira gramada no primeiro plano e mesma borda densa de troncos, copas e arbustos.
- Conferido: O caminho de terra à direita, linhas de troncos e silhuetas principais da vegetação permanecem; nenhum javaporco foi acrescentado nesta cena vazia.
- Conferido: Bioma de mata e luz de fim de dia mantidos; não vira favela, deserto ou floresta de outra composição.
- Acabamento: Planos de cor mais amplos e mancha clara de luz no gramado preservam a clareira e a mata; a mancha não foi tratada como evidência de terreno/rota nova.

### B-jav-enemies — REPROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/javaporco/jav-enemies.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/javaporco/B-jav-enemies.png`.

- Conferido: Exatamente quatro javaporcos visíveis no alinhamento frontal, com ordem/tamanho jovem, adulto, matriarca e aríete preservados.
- Conferido: Pernas, focinhos, presas e pelagem mantêm a forma animal de referência; sem armadura, espécie ou membro novo observado.
- Conferido: Mesma rua, cruzamento/faixas, carros, prédio com caixa d’água e Mercadinho São Luiz; manchas vermelhas de chão já existem na base, sem novo gore observado.
- Acabamento: Pelagem, asfalto e fachadas ganham textura/contato útil, mas a tipografia de placas foi redesenhada incorretamente.
- Divergência: A placa verde superior da Farmácia São José foi substituída por letras inventadas. O trecho SÃO JOSÉ ainda é identificável na referência e deixa de ser preservado em B e C; a placa lateral também sofre corrupção.
- Evidência: placa superior da farmácia ao fundo, x≈408–486,y≈260–286 do PNG de conceito 1376×768; placa lateral imediatamente abaixo/à direita.
- Origem: corrupção nova no conceito; poste e luz que ocultam parte de FARMÁCIA já estão na base.
- Conserto barato: Recompor o decal/texto Farmácia São José diretamente da referência (incluindo a placa lateral), mantendo oclusões e perspectiva; reaplicar somente acabamento/desgaste sem gerar novas letras.

### C-jav-enemies — REPROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/javaporco/jav-enemies.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/javaporco/C-jav-enemies.png`.

- Conferido: Exatamente quatro javaporcos visíveis no alinhamento frontal, com ordem/tamanho jovem, adulto, matriarca e aríete preservados.
- Conferido: Pernas, focinhos, presas e pelagem mantêm a forma animal de referência; sem armadura, espécie ou membro novo observado.
- Conferido: Mesma rua, cruzamento/faixas, carros, prédio com caixa d’água e Mercadinho São Luiz; manchas vermelhas de chão já existem na base, sem novo gore observado.
- Acabamento: Massas animais e ambiente permanecem coerentes com a base; placa da farmácia deixa de preservar o texto original.
- Divergência: A placa verde superior da Farmácia São José foi substituída por letras inventadas. O trecho SÃO JOSÉ ainda é identificável na referência e deixa de ser preservado em B e C; a placa lateral também sofre corrupção.
- Evidência: placa superior da farmácia ao fundo, x≈408–486,y≈260–286 do PNG de conceito 1376×768; placa lateral imediatamente abaixo/à direita.
- Origem: corrupção nova no conceito; poste e luz que ocultam parte de FARMÁCIA já estão na base.
- Conserto barato: Recompor o decal/texto Farmácia São José diretamente da referência (incluindo a placa lateral), mantendo oclusões e perspectiva; reaplicar somente acabamento/desgaste sem gerar novas letras.

### B-weapon-ak — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/weapons/weapon-ak.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/weapons/B-weapon-ak.png`.

- Conferido: AK continua com guarda-mão de madeira, receptor metálico escuro, carregador curvo e mesmas miras sem luneta ou acessório novo.
- Conferido: Posição de primeira pessoa, mão de apoio sob a madeira e mão traseira no punho mantidas; nenhuma segunda arma criada.
- Conferido: Ônibus, Kombi, coberturas, cruzamento, postes e fachadas conservam a estrutura principal da Quebrada.
- Acabamento: Madeira, aço e tecido ganham separação de roughness/desgaste; manga vermelha e estrelas claras da luva permanecem.

### C-weapon-ak — REPROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/weapons/weapon-ak.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/weapons/C-weapon-ak.png`.

- Conferido: AK continua com guarda-mão de madeira, receptor metálico escuro, carregador curvo e mesmas miras sem luneta ou acessório novo.
- Conferido: Posição de primeira pessoa, mão de apoio sob a madeira e mão traseira no punho mantidas; nenhuma segunda arma criada.
- Conferido: Ônibus, Kombi, coberturas, cruzamento, postes e fachadas conservam a estrutura principal da Quebrada.
- Acabamento: Arma e guarda-mão conservam forma e materiais, com planos de cor mais gráficos; a manga sofre troca indevida por pele.
- Divergência: O antebraço de apoio, coberto por manga vermelha na base, passa a pele exposta alaranjada entre o punho da luva e a manga curta no canto inferior. Isso muda a roupa/skin; não é só iluminação.
- Evidência: primeiro plano, antebraço esquerdo/de apoio em x≈816–947,y≈642–767 do conceito 1376×768.
- Origem: troca nova de tecido por pele; a base tem antebraço vermelho contínuo.
- Conserto barato: Repor a manga vermelha integral e seu punho no mesmo contorno/pose da base; preservar arma, luva estampada e acabamento C.

### B-weapon-pistol — REPROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/weapons/weapon-pistol.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/weapons/B-weapon-pistol.png`.

- Conferido: Pistola escura compacta, ferrolho, miras abertas e empunhadura com duas mãos preservados.
- Conferido: Luvas vermelhas com estrelas claras e escala/posição da arma continuam reconhecíveis.
- Acabamento: Ferrolho/luvas têm material útil, mas a cobertura do cenário foi convertida em banco e há placa nova.
- Divergência: A cobertura retangular marrom à frente do ônibus foi substituída por banco de ripas com assento/pés. Uma placa vertical SOMA também aparece acima/atrás do ônibus, ausente na base.
- Evidência: banco no centro-direita x≈882–1068,y≈405–455; nova placa SOMA x≈966–1021,y≈319–350 no conceito 1376×768.
- Origem: novos objetos/semântica no conceito; a base mostra cobertura lisa e placa clara sem esse letreiro nessa posição.
- Conserto barato: Restaurar a cobertura marrom lisa com a silhueta original e remover o letreiro novo; manter o acabamento da pistola e das luvas.

### C-weapon-pistol — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/weapons/weapon-pistol.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/weapons/C-weapon-pistol.png`.

- Conferido: Pistola escura compacta, ferrolho, miras abertas e empunhadura com duas mãos preservados.
- Conferido: Luvas vermelhas com estrelas claras e escala/posição da arma continuam reconhecíveis.
- Acabamento: Mantém o desenho da pistola, luvas, ônibus, rua e coberturas lisas; acabamento metálico mais suave sem novo acessório observado.

### B-weapon-revolver38 — REPROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/weapons/weapon-revolver38.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/weapons/B-weapon-revolver38.png`.

- Conferido: Revólver prateado com tambor, cano curto/médio, mira traseira escura e punho marrom mantém família e enquadramento.
- Conferido: Luvas vermelhas estampadas e gesto de duas mãos permanecem; não surgem luneta, silenciador ou segunda arma.
- Acabamento: Metal e punho são úteis como referência, porém a cobertura do mapa recebe outra forma/material.
- Divergência: As coberturas marrons lisas à frente do ônibus e no centro distante viram barreiras Jersey cinza de concreto, com base alargada e faces inclinadas. Isso troca forma e cor do obstáculo.
- Evidência: cobertura à frente do ônibus x≈878–1072,y≈403–453 e cobertura central x≈600–704,y≈391–419 no conceito 1376×768.
- Origem: nova reinterpretação de geometria/material; prismas marrons na base.
- Conserto barato: Repor os prismas retos marrons da referência e limitar desgaste/material à sua superfície, sem base alargada ou faces Jersey.

### C-weapon-revolver38 — REPROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/weapons/weapon-revolver38.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/weapons/C-weapon-revolver38.png`.

- Conferido: Revólver prateado com tambor, cano curto/médio, mira traseira escura e punho marrom mantém família e enquadramento.
- Conferido: Luvas vermelhas estampadas e gesto de duas mãos permanecem; não surgem luneta, silenciador ou segunda arma.
- Acabamento: Metal, detalhes quentes e planos de cor continuam na família revólver; o cenário adiciona e substitui obstáculos.
- Divergência: Uma caixa de madeira com diagonal foi acrescentada ao passeio esquerdo, que estava livre. A cobertura da frente do ônibus ganha construção de ripas, e o pequeno prisma laranja ao lado vira barril cilíndrico.
- Evidência: caixa nova no passeio x≈254–344,y≈403–459; barril x≈834–872,y≈406–453 e cobertura de madeira x≈876–1069,y≈404–453 no conceito 1376×768.
- Origem: invenção/substituição nova; base sem caixa nesse passeio e com prisma laranja.
- Conserto barato: Remover a caixa nova e restaurar o prisma laranja e as coberturas lisas no mesmo contorno da base; manter a arma e seu acabamento.

### B-weapon-mp5 — REPROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/weapons/weapon-mp5.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/weapons/B-weapon-mp5.png`.

- Conferido: MP5 conserva corpo escuro compacto, mira frontal em anel, mira traseira e carregador inferior; sem óptica ou silenciador inventado.
- Conferido: Mesmo enquadramento de primeira pessoa, apoio da mão e manga vermelha.
- Acabamento: Aço gasto e tecido rendem separação útil, mas a luva estampada foi redesenhada como luva tática lisa.
- Divergência: As estrelas claras grandes visíveis na luva de apoio da base desapareceram; B e C mostram luva vermelha lisa com costuras/punho tático. A manga vermelha permanece, mas a skin da mão mudou.
- Evidência: mão de apoio/punho em x≈835–961,y≈490–670 do conceito 1376×768; comparar estampa branca da mesma região da base.
- Origem: apagamento novo de estampa; estrelas são visíveis na captura original.
- Conserto barato: Restaurar as estrelas claras nas mesmas faces visíveis da luva, conservando a paleta vermelha, pose e volumes originais; usar textura em vez de redesenhar luva lisa.

### C-weapon-mp5 — REPROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/weapons/weapon-mp5.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/weapons/C-weapon-mp5.png`.

- Conferido: MP5 conserva corpo escuro compacto, mira frontal em anel, mira traseira e carregador inferior; sem óptica ou silenciador inventado.
- Conferido: Mesmo enquadramento de primeira pessoa, apoio da mão e manga vermelha.
- Acabamento: Arma preserva estrutura com planos mais amplos, mas também perde a estampa clara da luva.
- Divergência: As estrelas claras grandes visíveis na luva de apoio da base desapareceram; B e C mostram luva vermelha lisa com costuras/punho tático. A manga vermelha permanece, mas a skin da mão mudou.
- Evidência: mão de apoio/punho em x≈835–961,y≈490–670 do conceito 1376×768; comparar estampa branca da mesma região da base.
- Origem: apagamento novo de estampa; estrelas são visíveis na captura original.
- Conserto barato: Restaurar as estrelas claras nas mesmas faces visíveis da luva, conservando a paleta vermelha, pose e volumes originais; usar textura em vez de redesenhar luva lisa.

### B-weapon-shotgun — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/weapons/weapon-shotgun.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/weapons/B-weapon-shotgun.png`.

- Conferido: Escopeta escura mantém trilho superior, duas miras abertas, tubos/guarda-mão e receptor comprido; não vira outra família de arma.
- Conferido: Mesma posição das duas mãos, luvas vermelhas com estrelas claras e mangas vermelhas.
- Conferido: Ônibus, Kombi, blocos/coberturas, faixa de pedestres, postes/fios e prédios continuam no mesmo local.
- Acabamento: Aço escuro, desgaste de bordas e tecido se distinguem sem acessório ou objeto novo observado.

### C-weapon-shotgun — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/weapons/weapon-shotgun.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/weapons/C-weapon-shotgun.png`.

- Conferido: Escopeta escura mantém trilho superior, duas miras abertas, tubos/guarda-mão e receptor comprido; não vira outra família de arma.
- Conferido: Mesma posição das duas mãos, luvas vermelhas com estrelas claras e mangas vermelhas.
- Conferido: Ônibus, Kombi, blocos/coberturas, faixa de pedestres, postes/fios e prédios continuam no mesmo local.
- Acabamento: Superfícies metálicas mais gráficas e reflexos quentes preservam contorno, roupa e cenário.

### B-weapon-awp — REPROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/weapons/weapon-awp.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/weapons/B-weapon-awp.png`.

- Conferido: A coronha/chassi verde, luneta grande com torres, receptor/ferrolho e cano comprido continuam reconhecíveis na mesma pose.
- Conferido: Mãos, estrelas das luvas e mangas vermelhas permanecem; ônibus, Kombi, coberturas e postes continuam nas mesmas posições.
- Acabamento: O metal ganha reflexos/arestas e a coronha verde continua identificável; a pintura do ônibus perde a cor de referência.
- Divergência: A faixa vermelha frontal e lateral do ônibus foi apagada: o veículo vermelho/branco da base vira cinza/branco muito sujo.
- Evidência: ônibus ao fundo, x≈835–985,y≈345–407 no conceito 1376×768.
- Origem: perda nova de cor do cenário; não é limitação da captura.
- Conserto barato: Restaurar a faixa vermelha e a divisão de pintura do ônibus a partir da base; manter desgaste sem encobrir a identidade cromática.

### C-weapon-awp — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/weapons/weapon-awp.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/weapons/C-weapon-awp.png`.

- Conferido: Coronha/chassi verde, receptor escuro, cano e luneta grande com torres preservam a silhueta e a família da AWP.
- Conferido: Luvas vermelhas com estrelas e mangas vermelhas continuam na mesma pose.
- Conferido: Ônibus com faixa vermelha, Kombi, coberturas, fachadas e postes/fios permanecem no mesmo enquadramento.
- Acabamento: Planos quentes/frios mais amplos deixam madeira/polímero verde, metal e tecido legíveis sem novo acessório.

### B-weapon-svd — REPROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/weapons/weapon-svd.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/weapons/B-weapon-svd.png`.

- Conferido: Guarda-mão/coronha de madeira, apoio escuro de bochecha, receptor/carregador escuros e luneta mantêm a família e a pose da SVD.
- Conferido: Mangas e luvas vermelhas com estrelas permanecem; não foi acrescentada outra arma ou óptica.
- Acabamento: Madeira e aço se separam bem no viewmodel; o fundo recebeu desenhos ausentes na base.
- Divergência: Foi acrescentado um desenho branco de caveira/cabeça na parede alta de tijolos à direita; a mesma região da base tem tijolos sem esse desenho. Também surge marca escura na parede alta à esquerda.
- Evidência: caveira no alto à direita, x≈1307–1351,y≈313–350; marca à esquerda, x≈270–309,y≈318–360 do conceito 1376×768.
- Origem: decal/grafite novo no conceito, não defeito herdado.
- Conserto barato: Repor os trechos de tijolo da referência nessas regiões e manter somente grafites já existentes.

### C-weapon-svd — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/weapons/weapon-svd.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/weapons/C-weapon-svd.png`.

- Conferido: Madeira do guarda-mão/coronha, apoio de bochecha, receptor/carregador e luneta continuam no mesmo desenho e lugar.
- Conferido: Mãos, estrelas brancas e mangas vermelhas preservadas.
- Conferido: Ônibus, Kombi, blocos de cobertura, fachadas e postes/fios continuam na cena; não se observou novo decal equivalente ao de B.
- Acabamento: Madeira, metal e tecido recebem pinceladas/reflexos mais agrupados com boa separação do fundo.

### B-weapon-lmg — REPROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/weapons/weapon-lmg.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/weapons/B-weapon-lmg.png`.

- Conferido: Receptor/guarda-mão areia, cano escuro, alça superior e munição em fita continuam identificando a mesma metralhadora.
- Conferido: Mesma pose de apoio e manga vermelha; a fita visível permanece, sem caixa nova de munição. A quantidade exata de elos não foi medida.
- Acabamento: Perfurações e separação metal/polímero ajudam a leitura, porém a luva perde sua marca gráfica.
- Divergência: As grandes estrelas claras da luva de apoio desaparecem; a mão vira uma luva vermelha lisa com costuras. A base tem várias pontas brancas visíveis nessa mesma mão.
- Evidência: luva sob o guarda-mão, x≈1035–1155,y≈584–685 do conceito 1376×768.
- Origem: remoção nova de detalhe da skin; estrelas são visíveis na referência.
- Conserto barato: Reaplicar a textura/decais de estrelas da luva original, preservando o vermelho e a mesma cobertura dos dedos.

### C-weapon-lmg — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/weapons/weapon-lmg.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/weapons/C-weapon-lmg.png`.

- Conferido: Receptor/guarda-mão e alça areia, cano escuro e fita de munição mantêm a família da metralhadora sem óptica/caixa novas.
- Conferido: Luvas vermelhas com marcas claras e mangas vermelhas continuam; mesma pose de apoio. A quantidade exata de elos da fita não foi medida.
- Conferido: Cena mantém ônibus com faixa vermelha, Kombi, coberturas e fachadas no mesmo enquadramento.
- Acabamento: Planos de cor e contorno fino separam a arma do fundo. A espessura do contorno deve ser tratada como consistência editorial com o restante de C, sem escolher a direção pelo dono.

### B-weapon-carbine — REPROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/weapons/weapon-carbine.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/weapons/B-weapon-carbine.png`.

- Conferido: Receptor cinza/prata, guarda-mão de madeira, cano/tubo inferior estreitos e miras abertas mantêm a carabina da base.
- Conferido: Mãos, estrelas e mangas vermelhas preservadas; nenhum acessório óptico novo.
- Acabamento: Madeira e aço ganham textura/reflexo, mas a fachada deixa de conservar material e volume da captura.
- Divergência: A fachada longa de tijolos aparentes à esquerda foi convertida em reboco cinza e ganhou um toldo corrugado projetado sobre portas. A base tem tijolo exposto nessa extensão e não tem esse toldo projetado.
- Evidência: fachada à esquerda, especialmente novo toldo x≈0–245,y≈339–367 do conceito 1376×768; reboco ocupa a faixa superior e inferior dessa mesma fachada.
- Origem: troca nova de material e introdução de volume no cenário.
- Conserto barato: Retomar tijolos e recortes de reboco da referência e remover o toldo novo; preservar os cartazes/grafites originais.

### C-weapon-carbine — REPROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/weapons/weapon-carbine.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/weapons/C-weapon-carbine.png`.

- Conferido: A carabina mantém receptor metálico, madeira do guarda-mão, tubos/cano longos e miras abertas; não vira outro tipo de arma.
- Conferido: Pose das mãos e estrelas nas luvas permanecem; alteração se concentra na estampa da manga.
- Acabamento: Metal e madeira ficam legíveis em planos pintados; a roupa recebeu uma estampa que não existe na captura.
- Divergência: A manga vermelha lisa do antebraço foi redesenhada com uma estampa grande de arabescos/ondas vermelhos escuros. Na base, as variações são iluminação e dobras, sem esse motivo decorativo.
- Evidência: antebraço de apoio, x≈741–968,y≈599–767 do conceito 1376×768.
- Origem: estampa nova da skin, não textura herdada.
- Conserto barato: Remover os arabescos e manter tecido vermelho liso com dobras/sombreamento; conservar as estrelas apenas nas regiões da luva que já as têm.

### B-weapon-knife — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/weapons/weapon-knife.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/weapons/B-weapon-knife.png`.

- Conferido: Mesma faca de lâmina reta metálica apontada para cima/esquerda, cabo escuro e pequena guarda; não se transforma em outra arma.
- Conferido: Mesma mão direita segurando o cabo e esquerda livre, com luvas vermelhas estreladas e mangas vermelhas.
- Conferido: Câmera, Kombi, ônibus, blocos de cobertura, prédios e postes/fios preservam a composição da captura.
- Acabamento: Borda da lâmina, costuras e tecido ficam mais críveis. A luz fica mais dourada/contrastada no cenário; isso requer reprodução no renderer, mas não prova por si uma mudança de layout ou design.

### C-weapon-knife — APROVADO

Base: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/baseline/weapons/weapon-knife.png`. Conceito: `/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral/concepts/weapons/C-weapon-knife.png`.

- Conferido: Lâmina reta metálica, cabo escuro e pequena guarda conservam a faca e a orientação da captura.
- Conferido: Duas mãos nas mesmas poses, luvas com estrelas claras e mangas vermelhas preservadas.
- Conferido: Ônibus, Kombi, coberturas, prédios e postes/fios permanecem no mesmo enquadramento.
- Acabamento: Reflexos quentes e planos pintados simplificam metal/tecido sem novo desenho de arma ou roupa.

## Continuação

Cobertura visual e hashes concluídos. Corrigir as divergências localizadas nos 13 reprovados e revisar novas imagens; a decisão editorial continua com o dono. Não há bloqueio ou geração aguardada.
