# Revisão independente — primeira leva de direção visual

Data: 2026-11-01. Escopo final: os nove conceitos A/B/C, as três bases de Lajes, ficha, prompts, receitas e metadados de captura. Revisão de pixels conforme `client/.claude/skills/asset-review/SKILL.md`, sem justificativa do autor, navegador, geração ou alteração do jogo. O A-02 foi inspecionado novamente após sua única correção. As referências espaciais são as bases; conceitos de acabamento não são autoridade para mudar a cena.

**Resultado: 1 APROVADO e 8 REPROVADOS.** A aprovação de C-02 vale exclusivamente para a imagem de direção visual. Nenhum item recebeu aprovação de integração. Os reprovados contêm acabamentos aproveitáveis, mas violam ao menos uma trava da ficha.

| Item | Veredito | Aproveitamento como referência de acabamento | Divergência principal |
| --- | --- | --- | --- |
| A-01-mundo | REPROVADO | Sim, paleta e superfícies limpas | Parapeito novo no telhado inferior direito |
| A-02-primeira-pessoa | REPROVADO | Sim, apenas materiais locais | Bandeiras com símbolos da União Europeia |
| A-03-personagem | REPROVADO | Sim, figurino e cabelo | Mão de apoio não toca o rifle |
| B-01-mundo | REPROVADO | Sim, separação de materiais | Parapeito novo e troca de emblemas |
| B-02-primeira-pessoa | REPROVADO | Sim, luz e materiais | Bandeira e mastro acrescentados ao fundo |
| B-03-personagem | REPROVADO | Sim, tecido/metal/alvenaria | Mão de apoio não toca o rifle |
| C-01-mundo | REPROVADO | Sim, paleta e pintura ampla | Parapeitos e plantas acrescentados |
| C-02-primeira-pessoa | APROVADO | Sim, melhor fidelidade espacial desta leva | Nenhuma divergência bloqueante encontrada nos pixels |
| C-03-personagem | REPROVADO | Sim, personagem e pintura | Apoio do rifle e cobertura de telhas nova |

“Sim” permite extrair uma receita local de cor, material ou acabamento. Não permite adotar a composição inteira, copiar objetos novos ou alterar o mapa. Não foi atribuída nota 8–9: estas imagens não demonstram essa qualidade no jogo.

## Evidências e correções mínimas

Coordenadas aproximadas em pixels, origem no canto superior esquerdo, grade comum de **1376×768**. As bases originais têm 3072×1728 e foram reamostradas apenas em memória para comparação; não foram alteradas. As regiões abaixo podem ser localizadas proporcionalmente nas bases. Não são medições de geometria 3D ou estimativas de custo.

### A-01 — mundo

Em `concepts/A-01-mundo.png`, x=850–1375/y=548–767, aparece um parapeito com arremate verde. O encontro das bordas em x≈942/y≈551 cria uma parede no telhado que está aberto em `baseline/01-mundo.png`. Isso altera cobertura e silhueta; não é um bevel. O conserto mais barato é restaurar somente o contorno aberto da base, conservando o tratamento de materiais.

Conferido de fato: câmera geral, organização dos volumes maiores, pipas, varal, estandartes e posição do anel central continuam próximos da referência. Areia, terracota, verde discreto e desgaste localizado são material de direção aproveitável. A imagem ainda é bastante próxima da base na organização de valores; o salto de qualidade não está comprovado.

### A-02 — primeira pessoa, arquivo atual

O arquivo atual, SHA-256 `918c2ab1c491a07dda560dd28b9c79f65719e2d1151b8bd31aae9f6fd1b7b414`, tem bandeira da União Europeia à direita, x=1082–1172/y=259–310, onde a base tem pano branco. O estandarte azul em x=559–596/y=295–318 também recebeu um círculo de estrelas. O prompt atual manda manter o emblema existente e não inventar bandeiras. Restaurar essas duas regiões é a correção mínima.

Conferido de fato nesta revisão: a composição voltou a seguir a base; planta, arma, mangas, trilhos, circulação à direita e anéis azuis permanecem nas regiões corretas. Não há nova escada ou personagem. O material é candidato plausível, mas o ganho de acabamento é conservador.

A tentativa anterior inspecionada está em `rejected/A-02-primeira-pessoa-attempt-02.png`, SHA-256 `ea9c66db1d2235f5447b8dbbe426112ba8097deed6caff13868c714aace97861`. Ela **não é o arquivo atual nem um décimo item**: substituía a cena por portas, telhados de barro, escadas e grades novas; deslocava a planta à esquerda; erguia os anéis em pé; mudava modelo/pose da pistola e expunha mãos de pele. A bandeira portuguesa no alto à direita e a placa “FLAGAS DO PORTUGUESO” também contrariavam a identidade. Essa tentativa não é referência espacial nem um resultado aprovado.

### A-03 — personagem

O punk conserva cabelo em blocos multicoloridos, jaqueta azul, calça xadrez vermelha, botas, rifle, pose e escala. A mão de apoio em x=795–844/y=391–420 aponta aberta para baixo, enquanto a coronha está acima, em y≈357–382. O defeito já está em `baseline/03-personagem.png`: não se trata de membro extra gerado. Entretanto, a ficha exige contato coerente com a arma. Ajustar punho e dedos, sem mudar mira ou gesto geral, é a correção mínima.

O acabamento de tecido, cabelo e quinas pode orientar produção. A mudança de superfície das barreiras para tijolo e chapa não deve ser interpretada como permissão para alterar volume, material físico ou colisão. O rosto é pequeno no quadro e não sustenta avaliação fina de expressão.

### B-01 — mundo

Há um parapeito de concreto novo em x=849–1375/y=550–767, ausente na laje aberta da base. Há também bandeiras nacionais nos lugares dos estandartes azuis da facção: x≈458–486/y≈311–342, x≈674–696/y≈272–294 e x≈709–750/y≈369–410. A identidade brasileira não exige mudar o sinal de facção. Restaurar a laje e os emblemas é suficiente para os bloqueios apontados.

O tijolo, o reboco descascado e o concreto são mais distintos; o sol de fim de tarde é legível e as sombras conservam detalhe. Esses acabamentos são aproveitáveis. A rugosidade e o desgaste devem ser produzidos em materiais com escala consistente, sem assumir microgeometria a partir da imagem.

### B-02 — primeira pessoa

Em x=799–835/y=234–299 foi acrescentada uma bandeira brasileira e seu mastro junto à pipa. A base não tem bandeira nesse ponto; seu estandarte azul original está mais à esquerda, perto de x=561–592/y=297–318. Remover o prop novo é o conserto mínimo.

Conferido de fato: perspectiva, vaso, grades, barreiras, passagem, pistola e mangas continuam próximos da referência; não há personagem novo. Materiais e luz conversam com as outras duas vistas B. O piso permanece legível, mas não há inimigo para testar contraste de alvos nas sombras.

### B-03 — personagem

A identidade e a silhueta do punk foram mantidas, com roupa e metal de resposta visual mais distinta. O bloqueio está em x=794–844/y=391–421: mão aberta sob a coronha, afastada da arma. É a mesma pose defeituosa da base. Ajustar somente o apoio local da mão é a correção mínima; não é necessário redesenhar personagem ou rifle.

A cena tem acabamento de alvenaria e luz compatível com B-01/B-02. Não há fio de cabelo individual, DOF ou volume de névoa que pareça obrigatório ao aspecto. Isso indica plausibilidade de receita, não custo medido.

### C-01 — mundo

O conceito acrescenta borda elevada na laje inferior direita, x=847–1375/y=548–767, e um parapeito amarelo sobre o bloco que era ocre e plano, x=333–613/y=491–648. Acrescenta também vasos/folhas em x=210–269/y=449–497 e x=328–398/y=245–278. São objetos e coberturas novos, contra a trava espacial. Remover só essas adições, preservando o agrupamento de cores, resolve os bloqueios identificados.

A paleta creme/terracota/turquesa/amarelo é intencional e se repete em C-02/C-03. Nuvens de formas amplas e desgaste pintado são referências viáveis. Telhas e ondulações não devem virar mudanças de altura ou superfície caminhável por interpretação do conceito: o protótipo deve preservar a geometria base.

### C-02 — primeira pessoa

**APROVADO como conceito visual 2D.** Conferidos a mesma composição, o vaso perto do centro, as grades, as barreiras, a passagem à direita, a pistola e sua posição, as mangas vermelhas com marcas brancas, os anéis azuis e a ausência de personagem novo. Não encontrei um prop novo ou uma obstrução relevante nesta vista. O xadrez não se aplica a esta vista; não foi inferido figurino de personagem ausente.

A pintura de superfícies amplas, o turquesa/amarelo localizado e o céu simples repetem a linguagem C sem sacrificar a leitura do piso. É a referência mais fiel da leva para orientar uma pequena amostra jogável. Como o quadro está sem inimigos, não demonstra legibilidade de alvos, qualidade de silhueta inimiga distante ou comportamento em combate. Não recebe aceite técnico ou autorização de implantação.

### C-03 — personagem

Além da mão de apoio aberta e distante do rifle em x=793–844/y=390–421, o quadro inclui telhado de barro em x=0–443/y=394–490, atrás da barreira laranja à esquerda. A base tem laje aberta ali; a fileira elevada de telhas muda o contorno. Corrigir a mão e restaurar a superfície plana são os consertos mínimos.

O cabelo em blocos, o azul da jaqueta, o xadrez vermelho, as botas e a silhueta do punk são reconhecíveis. A pintura conversa com C-01/C-02. As linhas escuras desenhadas no corpo não são prova de shader ou solução temporal; só podem ser aceitas após sobreviverem à câmera e à animação.

## Coerência, identidade e limites técnicos

As três direções têm sinais diferenciáveis: A usa superfícies mais calmas; B acentua separação de materiais e luz de fim de tarde; C agrupa cores e pinta variações amplas. C é a linguagem mais facilmente reconhecível entre as três vistas desta leva. A precisa harmonizar a luz: a vista geral é mais difusa, enquanto o personagem tem sombras longas e mais duras. B e C repetem melhor as receitas entre vistas. Isso é uma avaliação comparativa de imagens, não uma escolha feita pelo dono.

A arquitetura de lajes, alvenaria aparente, varais, pipas e comércio preserva sinais de Brasil nas vistas atuais. Trocar facções por bandeiras nacionais em B não é necessário; símbolos da UE no A-02 são incompatíveis. Não encontrei pessoa real identificável, gore ou marca licenciada nova nas nove imagens atuais; isso é inspeção visual, não certificação de direitos. Os três punks mantêm dois braços e duas pernas; a falha observada é contato com a arma, herdado da base.

Acabamentos observados podem ser perseguidos com meshes modulares, bevels seletivos, base color/normal/roughness, AO/lightmap candidatos, ambiente estático e um sol com shadow map. Não vejo efeito que obrigue ray tracing, GI dinâmica, névoa volumétrica densa, DOF ou cabelo em fios. A luz pintada em uma imagem, porém, não garante que uma receita dessas a reproduza em todas as câmeras.

Todos os conceitos têm 1376×768, razão aproximadamente 1,7917; as bases são 16:9 exatos, aproximadamente 1,7778. Há diferença de aspecto de cerca de 0,78%, tratada como limitação comum de entrega/comparação, não como prova isolada de mudança de FOV. Os detalhes de mãos foram vistos ampliados para diagnóstico; a avaliação de acabamento usou também os quadros completos. Não foram calculados SSIM/IoU de imagens com materiais diferentes: esses números misturariam acabamento com mudança espacial.

Não foram medidos draw calls, memória, FPS, polígonos, UV, pivôs, pesos, colisões, estabilidade de sombras ou consistência temporal. As capturas foram encenadas/sintéticas conforme os metadados e não representam partidas humanas. Depois da escolha do dono, a prova necessária continua sendo uma pequena amostra no Three.js r160/WebGL2, nas mesmas câmeras e em movimento, com alvos e aparelhos reais. Nenhum arquivo de `client/` foi alterado nesta revisão.

## Identidade dos arquivos avaliados

Prefixos SHA-256 para detectar troca posterior; `A-02` acima inclui o hash completo por ter sido substituído durante a revisão.

| Item | SHA-256, primeiros 16 caracteres |
| --- | --- |
| A-01-mundo | `14b3c1d242890c9e` |
| A-02-primeira-pessoa | `918c2ab1c491a07d` |
| A-03-personagem | `92f57463fd1c8500` |
| B-01-mundo | `8165d00a4047fa1d` |
| B-02-primeira-pessoa | `5de0f75c35c7fa55` |
| B-03-personagem | `b77d7e9fc70ba3cf` |
| C-01-mundo | `035ea8715c981e7e` |
| C-02-primeira-pessoa | `ef4fb3c1dff99613` |
| C-03-personagem | `52091dfe82914bb2` |
