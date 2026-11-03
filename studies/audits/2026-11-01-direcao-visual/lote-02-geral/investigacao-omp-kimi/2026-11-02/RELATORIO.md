# Investigação do realismo B — CORO SOLTO

Data: 02/11/2026. Escopo: leitura de código, metadados de assets, imagens e fontes públicas. Nenhuma alteração no jogo, geração, upload, protótipo ou benchmark.

## Resposta central

**B é uma direção plausível para o Three.js/WebGL já existente, mas ainda não é uma aparência reproduzida nem uma decisão de desempenho.** O acabamento principal — materiais opacos distintos, escala de textura, rugosidade, normais, desgaste localizado, contato, exposição e luz estática — pode ser produzido com assets editáveis, preparação offline e o renderer atual. Não é necessário trocar de engine nem “ligar PBR”: PBR, IBL/PMREM, AO, sombras e pós já existem.

| Classe | Partes de B | Decisão fundamentada |
|---|---|---|
| Reproduzível em princípio com o pipeline atual | Reboco/tijolo/asfalto/azulejo/madeira/metal/tecido/pele; roughness e normal autorados; bevels seletivos; paleta e exposição; AO/lightmap estático; reflexo ambiental aproximado; LOD e batching | É a parte mais forte de B e deve liderar uma prova futura. Depende principalmente de autoria e consistência dos assets, não de um recurso novo de engine. |
| Exige aproximação no celular | Água com reflexo/refração, sombras suaves extensas, folhagem/cabelo transparente, muitos atores animados/VFX, cadeia de pós e resolução interna | Preservar paleta, identidade, escala de material e composição; reduzir atualização/resolução de reflexos, casters, overdraw, passes e detalhe distante. A perda visual deve ser explícita. |
| Continua sem prova | Fidelidade de B em movimento e sob vários ângulos; reflexão correta de atores; estabilidade de frame time, memória, carregamento e aquecimento em aparelhos dos usuários; qualidade dos exports Kimi 3D | Só uma amostra real, com carga representativa e dispositivos físicos, pode aprovar B, uma aproximação ou motivar C. Imagem 2D, preview web e vídeo não respondem a isso. |

**Recomendação:** manter B como primeira hipótese e autorizar futuramente apenas uma prova pequena na **Quebrada com AK e Punk**, deixando **Piscina/água como experimento separado de maior risco**. Esse recorte testa o fundamento mais reutilizável de B sem transformar a água em bloqueio da decisão. C deve ser comparado no mesmo recorte se B falhar; sua aparência mais gráfica não comprova menor custo.

## 1. Evidência, proveniência e limites

- Modelo efetivo: `kimi-code/k3.1-pro`. Ferramentas: leitura de arquivos/imagens, busca em código, inspeção de metadados GLB com Node, pesquisa estática de fontes oficiais e três investigadores `scout` somente leitura. Não houve ferramenta Kimi 3D dedicada nem uso de Mint.
- Repositório `client/`: branch `feat/fps-paid-viewmodels-aaa`, HEAD `86c388b560e43e92cac13cd2675a86a69b715641`, 2 commits à frente do remoto. Havia 34 arquivos modificados e 19 não rastreados de outras frentes. Entre os relevantes: `public/js/bloom.js`, `look.js`, `mapprops.js`, `textures.js`, `map_lajes_authored.js`, `map_sky.js` e `public/js/vendor/`.
- A versão local é `2.0.0-alpha.175` (`public/js/version.js:3`). As bases são capturas sintéticas da produção `alpha.133-a64e2abe238c`, não deste checkout. O trabalho local de viewmodels/mapas não pode ser atribuído retroativamente às capturas.
- O estudo completo tem 68 bases e 136 conceitos: 18 mapas, 3 estudos Javaporco, 10 famílias de armas, 12 personagens selecionados de 63 e 25 skins aprovadas. Esta investigação examina seis pares dirigidos, não todo o acervo (`coverage.json`).
- Todos os conceitos são `2D-concept-not-engine-render`, gerados por `google/gemini-3-pro-image` (`generation-manifest.json`). As capturas são encenadas; não são gameplay humano nem medição de desempenho.
- Pixels das visões gerais B/C e dos seis pares foram abertos. Os mecanismos de render abaixo são **propostas inferidas**, não algoritmos revelados pelas imagens.

## 2. Comparação visual concreta

As visões gerais mostram a linguagem comum: B separa superfícies por resposta de material e detalhe médio; C agrupa variação de cor e planos de forma mais gráfica. Ambas ainda usam luz, sombra, exposição, textura, geometria e culling; C não elimina esses custos.

| Caso e imagem/região | Diferença observável base → B e origem provável | Aproveitável versus invenção | Fidelidade 2D existente |
|---|---|---|---|
| **Quebrada** — `baseline/maps/quebrada.png` × `concepts/maps/B-map-quebrada.png`; bloco diante do ônibus `x≈0,61–0,76 / y≈0,61–0,70` e centro-esquerda | Asfalto, calçada, tijolo e veículos ganham variação de superfície e contato (**textura/material/iluminação**). Os blocos ocre retangulares viram barreiras Jersey cinza com inclinação e vãos (**geometria/silhueta/cor/composição**). | Aproveitar acabamento de asfalto/tijolo/reboco e desgaste localizado. Não transportar as barreiras nem mudar cobertura/cor. | **REPROVADO** em `reviews/maps-review.json`; a reprovação não nega a preferência estética por B. |
| **AK** — `baseline/weapons/weapon-ak.png` × `concepts/weapons/B-weapon-ak.png`; madeira, receptor, luva e mãos em primeiro plano | Veio da madeira, usinagem/parafusos, rugosidade do aço, trama do tecido e contato ficam mais distintos (**material/textura**). Guarda-mão, receptor, carregador, miras, luva vermelha/estrelas e apoio das mãos permanecem. | Acabamento aproveitável sem acessório novo. A imagem não prova UV, rig, recarga ou contatos em movimento. | **APROVADO** em `reviews/extras-review.json`; captura base estática com `bloom=0`. |
| **Piscina** — `baseline/maps/piscina_treta.png` × `concepts/maps/B-map-piscina_treta.png`; terço direito `x≈0,80–1,00 / y≈0,46–0,64`; água e paredes | Água passa de azul plano a translúcida/verde-azulada com arquitetura refletida; azulejo/juntas, reboco e metal se separam; vigas projetam sombras (**material/iluminação**). B adiciona três espreguiçadeiras e escada à direita (**geometria/composição**). | Aproveitar cerâmica, água e luz como referência; remover móveis/escada inventados. Reflexo/cáustica observado não revela técnica nem custo. | **REPROVADO** em `reviews/maps-review.json`. |
| **Amazônia** — `baseline/maps/amazonia.png` × `concepts/maps/B-map-amazonia.png`; palafitas, passarelas, água, copas e névoa | Madeira ganha grão/umidade, água ganha reflexos e variação, folhas recebem detalhe médio e a luz na névoa fica mais direcional (**material/textura/iluminação/atmosfera**). Palafitas, canoa, troncos, passarelas e vãos permanecem reconhecíveis. | Acabamento aproveitável. Não há prova de reflexão dinâmica, folhagem em movimento ou desempenho. | **APROVADO** em `reviews/maps-review.json`. O código local pesquisado não contém módulo/registro Amazônia; não há base para prescrever alteração específica desse mapa neste checkout. |
| **Punk** — `baseline/characters/char-punk.png` × `concepts/characters/B-char-punk.png`; tríptico, sobretudo painel direito `x≈1100–1167/y≈307–331` e `x≈1110–1182/y≈390–410` no conceito 1376×768 | Couro, xadrez, metal, pele/cabelo e dobras ganham separação (**material/textura/iluminação**). Silhueta e pose permanecem legíveis. B inventa fileiras de tachas no alto das costas e na barra (**geometria/identidade**). | Aproveitar couro/tecido/cabelo; remover tachas novas. Normal map não cria essas tachas nem corrige rig/contato. | **REPROVADO** em `reviews/characters-review.json`. Idle sem arma é herdado da captura. |
| **Canarinho Cyborg** — `baseline/skins/skin-canarinho-cyborg.png` × `concepts/skins/B-skin-canarinho-cyborg.png`; frente/perfil/costas, placas, juntas, bico e peito 24 | Placas metálicas, juntas, olho mecânico, bico e superfície amarela ganham respostas distintas; asfalto e luz ficam mais contrastados (**material/textura/iluminação**). Cabeça, bico, olho verde, peito 24, faixas, garras, cauda, pose e cenário permanecem. | Boa referência de identidade e separação de materiais. Não prova deformação, reconhecimento à distância ou especular estável em movimento. | **APROVADO** em `reviews/skins-review.json`. |

Normal maps alteram iluminação, não silhueta, rig, contato de mãos/pés nem cobertura. Os três conceitos reprovados só podem orientar acabamento depois de removidas as invenções; os três aprovados continuam sem validade como asset integrado.

## 3. Inventário verificado do pipeline atual

| Capacidade | Evidência atual | Consequência para B |
|---|---|---|
| Three e compatibilidade | Three **r160** em `public/vendor/three.module.js:6`. `glcontext.js:23-104` tenta WebGL2/WebGL1, tiers de contexto e marca degradação. `main.js:52-72` força low em compatibilidade/hardware fraco. | A prova deve incluir WebGL2 e fallback real. Não há justificativa para migração de engine. |
| Qualidade e resolução | `_applyQuality`, `game.js:2847-2858`: DPR high `min(devicePixelRatio,2)`, med 1, low 0,75; low desliga sombras. | DPR afeta mundo, pós e bandwidth. A mesma identidade B precisa sobreviver à redução de pixels. |
| IBL/PBR | `_buildEnv`, `game.js:1244-1293`: DataTexture equirectangular 512×256, PMREM e `scene.environment`. | Reflexo ambiente já existe; é procedural/estático e não contém arquitetura ou atores refletidos com fidelidade. |
| Materiais por mapa | Quebrada usa `MeshStandardMaterial` (`map_quebrada.js:60-70`). Piscina usa fábrica geral `MeshLambertMaterial` (`map_piscina.js:77`) e água `MeshPhysicalMaterial` (`:196-198`). | Não há um único “botão PBR”. Migrar seletivamente superfícies visíveis de Lambert para Standard faz mais sentido que aplicar Physical em tudo. |
| Texturas derivadas e autoradas | `textures.js:31-52` deriva normal por Sobel e roughness por luminância; `detailFor` (`:105-135`) compartilha/cacheia; `loadPbrSet` (`:139-160`) carrega color/normal/rough autorados. Detalhe fica fora em low. | O caminho autorado é reutilizável. Derivados de albedo não substituem roughness/normal com significado físico nem escala de texel consistente. |
| Personagens | `upgradeCharMaterial`, `characters.js:378-415`, preserva normal/roughness, mas usa metalness 0 e roughness base 0,86; há efeitos de leitura/rim/região. | B já tem base PBR. Metais de skins precisam de tratamento por região/material válido, não metalness global nem rim como substituto. |
| Punk e AK | Metadados dos GLBs públicos: ambos têm baseColor, normal e metallicRoughness WebP. Punk tem 1 skin e 0 animações; AK tem 0 skins/animações. | A lacuna não é ausência de mapas. Qualidade, escala, animação e aparência em runtime permanecem não medidas. O viewmodel local atual também tem outra frente em andamento. |
| Lightmap/AO | `shell.js:1-21` carrega shell Lajes, `uv1` e `_lm.webp`; há AO de vértice/contato. | Existe contrato offline reutilizável, não evidência de bake consistente em todos os mapas. |
| Pós | `bloom.js:946-1050`: mundo, depth/água quando registrada, máscara skinned, SSAO med/high, viewmodel, bloom, AgX/composite e AA high. Low usa tone path sem composer (`main.js:123-134`, `bloom.js:786-828`). | A cadeia já é complexa; novos passes aumentam RTs, bandwidth e compilação. Aproveitar os caminhos existentes antes de adicionar outro. |
| Sombras | PCFSoft, foco direcional que segue jogador em `bloom.js:704-782`; qualidade altera sombras. | Uma luz direcional focada e contatos simples são mais plausíveis que várias sombras suaves de grande área. |
| Água reutilizável | `water.js` implementa Gerstner, duas normais, profundidade/foam, Fresnel de céu e especular; `DepthPass` compartilha profundidade. A Piscina inspecionada usa outro caminho Physical transparente. | Há componentes reutilizáveis, mas não reflexão planar/refração fiel de cena na Piscina. Integração exigiria decisão específica e teste de passes. |
| Culling/batching | `mapprops.js` faz merge, InstancedMesh e buckets espaciais; `frustumCulled` padrão. `occluders` é para bala/LOS, não occlusion culling de GPU. | Não recriar batching. LOD/overdraw e quantidade de casters continuam trabalho de assets/cena. |
| Compressão GPU | Não há KTX2Loader/transcoder registrado nos caminhos inspecionados; GLBs Punk/AK usam WebP. | KTX2/Basis é proposta futura. WebP reduz download, não comprova textura comprimida residente na GPU. |

## 4. Lacunas e propostas compatíveis

### 4.1 Assets e preparação offline

| Diferença a resolver | Reuso e lacuna | Onde/dependências | Risco e verificação futura |
|---|---|---|---|
| Superfícies opacas com identidade e roughness crível | Reusar `loadPbrSet`, Standard e GLBs; faltam receitas e mapas autorados consistentes, não mais ruído derivado de albedo. | Assets Quebrada/Piscina/Punk/AK; UV0, canais ORM e color spaces. | Ruído uniforme, roughness invertida e especular instável. Comparar mesma câmera/luz e inspecionar canais antes do WebGL. |
| Escala de juntas, veios, tijolo e desgaste | `repeat`/UV já existem, mas derivados não garantem texel density. Falta escala em unidades de mundo e UVs adequadas. | Autoria DCC; uv0 para material, uv1 para bake quando necessário. | Tiling, shimmer e escala diferente entre props. Medir tamanho físico e comparar câmera próxima/distante e movimento. |
| Silhueta/bevels e detalhe high-to-low | GLBs e normais existem; falta bake seletivo de bevel/detalhe sem mudar layout. | Blender/DCC; low mesh + normal/AO, LODs e colisão inalterada. | Normal não corrige silhueta. Girar 360°, verificar contatos, cobertura, rig e reconhecimento à distância. |
| Metais de Cyborg versus couro/pele | `upgradeCharMaterial` reutiliza mapas, mas zera metalness genericamente. Falta classificação confiável de regiões e canais válidos. | Materiais `CS_HARD_`/regiões e assets; preservar metalness apenas onde autorado. | Tornar tudo metálico ou plástico. Testar Punk e Canarinho sob o mesmo ambiente e em movimento. |
| Luz/AO estática | Shell Lajes e contrato uv1 já existem. Falta produção para o recorte e regras para não dobrar luz dinâmica. | Pipeline Blender/lightmap, probes/cubemaps estáticos e assets. | Memória adicional, vazamento/double lighting e atores sem iluminação correspondente. A/B com bake e atores em movimento. |
| LOD e variantes móveis | Buckets/instancing já existem. Faltam LODs e política de carregamento seletivo. | Assets, catálogo e loader; manter silhueta/layout/colisão. | Popping, perda de leitura e maior download se todos os LODs forem baixados. Medir transição e bytes por perfil. |
| Memória de textura | Loader GLTF e WebP existem; falta pipeline KTX2/Basis registrado e transcode/fallback. | Preparação offline + `GLTFLoader.setKTX2Loader`, transcoder WASM e detecção de hardware. | CPU de transcode, workers, compatibilidade e artefatos em normal maps. Inventariar formato transcodificado, bytes GPU estimados e tempo de carregamento. |

### 4.2 Renderer e cena

1. **Materiais da Piscina:** a diferença visada é cerâmica/reboco/metal com resposta distinta. Reusar Standard/IBL/detail loader; falta migração seletiva da fábrica Lambert em `map_piscina.js` e mapas autorados. Standard é por fragmento e mais caro que Lambert; não aplicar Physical/clearcoat indiscriminadamente. Verificar mesmo enquadramento, exposição e custo por perfil.
2. **Luz e sombras:** reusar lightmap/AO/contato e o sol direcional focado. Falta decidir quais elementos são estáticos e quais atores precisam de sombra dinâmica. Sombras suaves em cenários extensos exigem resolução, filtragem e redraw de casters; reduzir casters/raio/atualização no móvel. Verificar pés, becos, vários ângulos e leitura de alvo.
3. **Água:** separar aparência básica de reflexão/refração correta. Reusar normais/profundidade/Fresnel de `water.js` ou o Physical local, sem duplicar passes. Reflexão planar de atores em movimento exige render espelhado atualizado; refração de cena exige cor/profundidade e cuidado com transparência. No móvel, começar por ambiente estático + normais + tinta por profundidade; aceitar perda de reflexos fiéis. Testar separadamente.
4. **Folhagem/cabelo:** reusar culling/LOD; faltam regras de alpha test/blend, camadas e casters. Blend ordena e redesenha pixels; muitas camadas aumentam overdraw e shadow cost. Preferir cutout/LOD/camadas reduzidas quando a identidade permitir; medir shimmer e leitura de adversários.
5. **Pós e resolução:** reusar SSAO/bloom/tone e o caminho low equivalente de exposição. Não adicionar GI, volumetria densa ou outro composite para imitar o conceito. Ajustar resolução/passes por perfil somente depois de medir; preservar paleta e contraste entre perfis.
6. **Amazônia:** sem módulo local, só é possível indicar direção genérica de madeira/água/folhagem. Antes de qualquer proposta específica é preciso obter o código/assets correspondentes à captura ou reintroduzir o mapa no recorte autorizado.

Nenhum upgrade de Three é pré-requisito demonstrado. r160 já contém o caminho necessário à prova; KTX2 é addon a vendorizar/registrar, não motivo para trocar engine. Recursos exclusivos de outra engine não são solução disponível neste WebGL.

## 5. Custos e concessões no celular

Sem medições, os custos abaixo são relativos e qualitativos.

| Alternativa | Produção/offline | Download e memória residente | CPU/GPU por frame | Concessão e risco |
|---|---|---|---|---|
| PBR autorado + ORM | Artes, UV, bake e validação de canais | Mais mapas; ORM limita arquivos/samplers. WebP pequeno ainda pode virar RGBA grande | Standard por fragmento e múltiplos samples aumentam GPU; CPU quase inalterado | Melhor custo/benefício em superfícies próximas; distantes podem simplificar. |
| UV/escala consistente | Autoria e auditoria | Sem aumento necessário; uv1 adicional ocupa memória de geometria | Custo baixo se reutilizar texturas/samplers | Tiling menor e menos shimmer; exige retrabalho de assets. |
| High-to-low + bevel seletivo | High mesh, bake e LOD | Normal/AO e variantes ocupam download/memória | Low mesh reduz vértices/skinned cost; normais mantêm custo de fragmento | Silhueta e colisão devem ficar; detalhe some à distância. |
| Lightmap/AO/probes assados | Bake, uv1 e regras de iluminação | Novas texturas/probes; possível redução de shadow maps | Menos luz/sombra dinâmica; ainda samples e bandwidth | Só estático; atores podem parecer desconectados. Evitar double lighting. |
| KTX2/Basis | Encode, perfis de qualidade e fallback | Pode manter compressão GPU; download depende do encode; requer WASM/workers | Transcode no carregamento; sampling comprimido pode reduzir bandwidth | Não é “grátis”; medir boot, formato real e qualidade de normais. |
| LOD/culling/batching | LODs, buckets e validação | Variantes podem aumentar pacote se mal carregadas | Menos triângulos/draws/overdraw; troca de LOD tem CPU | Popping e leitura competitiva; occlusion culling não existe hoje. |
| Transparência/folhagem | Cards/meshes/cutouts e LOD | Alpha maps e geometria | Overdraw, sorting e shadow redraw; alpha test também tem custo | Bordas/cobertura mudam; não reduzir visibilidade de forma diferente entre times/perfis. |
| Sombras suaves | Configuração de luz/casters | Shadow maps consomem memória | Cada luz/caster redesenha geometria; filtros consomem samples | Grande área suave é alto risco; usar bake + um direcional + contato simples. |
| Pós + DPR | Ajuste e QA por perfil | RTs/depth/half-float escalam com pixels | Passes fullscreen, mips e bandwidth escalam com DPR | Menos resolução/AO/bloom preserva identidade, mas perde microdetalhe/contato. |
| Água avançada | Shader, integração e QA | RTs de cor/depth/reflexo | Reflexão/refração pode redesenhar cena e atores; update móvel é caro | Estático/Fresnel é mais barato e menos fiel. Não prometer o reflexo do conceito em low. |

A fórmula aproximada documentada pelo Three para textura RGBA com mipmaps é `largura × altura × 4 × 1,33` bytes; compressão JPEG/WebP do arquivo não reduz esse valor depois de decodificada. KTX2 pode transcodificar para formato comprimido suportado, mas precisa de registro e hardware. Da mesma forma, geometria comprimida para download continua exigindo decode, memória e trabalho de vértice/raster/sombra.

### Pontos de maior risco

- **Refletir atores na Piscina:** reflexão estática de ambiente não resolve atores. Uma reflexão planar correta precisa renderizá-los novamente sempre que se movem; cortar atualização causa defasagem. Refração adiciona cor/depth e problemas de ordenação. A concessão móvel recomendada é não refletir atores com fidelidade em low.
- **Sombras extensas:** o manual do Three explica que cada luz com sombra redesenha os casters; point light pode exigir seis vistas. Bake estático, sol único e sombras de contato reduzem o custo, mas não reproduzem toda iluminação dinâmica.
- **Folhagem e cabelo:** camadas transparentes redesenham os mesmos pixels e podem entrar no shadow pass. Reduzir camadas/casters e usar cutout/LOD perde suavidade e volume.
- **Muitos personagens/Javaporcos:** skinning, segunda passada de máscara, sombras, VFX e overdraw se somam. Uma cena vazia ou um único personagem não aprova esse caso.
- **Carregamento:** mapas extras, LODs, lightmaps e transcode podem atrasar a primeira partida e elevar memória mesmo com bom frame time depois. Medir frio/quente e pico, não só steady state.

### Direção B por perfil

| Perfil | Preservar | Reduzir/aproximar |
|---|---|---|
| Low/compatibilidade | Paleta, layout, silhueta, identidade de time/skin/arma, roughness grossa e exposição equivalente | DPR 0,75 já existente; sem pós/sombras no caminho atual; bake/AO de vértice/contato, água com ambiente estático, folhagem/LOD simplificados. |
| Med | Mesma direção de materiais e composição | DPR 1; SSAO/sombra existentes; sem presumir AA novo; detalhe e reflexões mais caros apenas se o orçamento futuro permitir. |
| High | Maior detalhe de superfície e contato | DPR até 2 e AA existentes; reflexão dinâmica/reduzida somente depois de prova específica, não como padrão para todos. |

Perdas que afetam leitura competitiva não são concessões aceitáveis por padrão: mudança de cobertura/silhueta, desaparecimento de alvo com LOD/folha, sombras que escondem facção, especular cintilante que mascara alvo ou água que reduz contraste de forma diferente entre perfis.

## 6. Kimi 3D Make — evidência sem geração

### 6.1 Produto, modelo, sessão e externos

- **Modelo Kimi usado pelo OMP:** acesso ao LLM K3.1 Pro/Kimi Code para raciocínio, código e tool calling. O catálogo oficial da API documenta endpoints de linguagem/visão/ferramentas, não um endpoint de geração 3D. Isso não é acesso automático ao 3D Make.
- **Produto 3D Make:** produto web/app com 3D Web, 3D Modeling e 3D Printing, entrada por texto/imagem, preview 360°, edição multi-turn e compartilhamento. Está disponível por interface Kimi, não como ferramenta montada nesta sessão.
- **Ferramentas desta sessão:** não há plugin/device Kimi 3D ou Kimi Work confirmado. Mint e REA existem, mas são outros produtos e não foram usados. Não se deve presumir que plugins do Kimi Work estejam disponíveis no OMP.
- **Geradores externos:** o tutorial oficial descreve Tripo, Meshy e Hyper3D para malhas detalhadas e Blender/engines/plugins para fluxos locais. Suas cotas, termos e qualidade são separados e não foram confirmados.

**Integração:** nenhuma API pública 3D Make para a operação desejada foi encontrada na documentação oficial examinada. O fluxo confirmado é manual: gerar/editar na interface Kimi, exportar, baixar e só depois auditar/importar localmente. Ausência de integração no OMP não prova incapacidade do produto; apenas impede afirmar automação disponível aqui.

### 6.2 Saídas documentadas, não obtidas nesta investigação

| Saída | Evidência oficial | Limite |
|---|---|---|
| Preview 360°, edição online, link | Guia 3D Make | Não é asset integrado nem benchmark. |
| Vídeo/Live Photo | Guia 3D Make, etapa Export and share | Serve apresentação, não Three.js. |
| GLB/glTF/OBJ | Recurso oficial “How to make a 3D model”, atualizado 30/10/2026 | Formatos documentados; nenhum arquivo foi gerado/aberto para confirmar conteúdo. |
| BLEND | Recurso oficial “3D modeling”, atualizado 31/10/2026, declara GLB/BLEND | Não validado; projeto `.blend` e scripts também são descritos no fluxo Kimi Work/Blender. Não confundir os dois ambientes. |
| STL/3MF para impressão | Recurso “3D modeling”; guia de impressão | Malha para slicer não comprova UV/PBR/LOD/rig para jogo. |
| Código editável/scripts | Tutorial oficial para Kimi Code/Work + Blender/Python | Não confirmado como export do 3D Make web nem plugin acessível nesta sessão. |
| FBX/USDZ | Recurso “How to make a 3D model” associa a fluxos Kimi Work | Não confirmado como export direto do 3D Make. |
| Imagem estática, rig/animação e mapas PBR completos | **Não confirmado** nas páginas centrais inspecionadas; rigging aparece como etapa/limitação do workflow | Exigir inspeção real, não inferir de GLB/preview. |

### 6.3 Onde poderia reduzir trabalho

| Categoria | Uso candidato | Preparação ainda obrigatória antes do Three.js |
|---|---|---|
| Arquitetura/props | Blocagem ou prop simples paramétrico; GLB editável; scripts Blender quando o ambiente apropriado estiver disponível | Dimensões, pivô/orientação, colisão, UV0/uv1, texel density, PBR, bevel/LOD, lightmap e licença. |
| Acabamento de modelos existentes | Auxílio para brief/scripts de materiais e bake; não há prova de que 3D Make preserve um modelo/UV ao “melhorar” | Trabalho DCC sobre o asset original, canais ORM, color space, rig e identidade. Não reconstruir para trocar acabamento. |
| Personagens/skins | Conceito/malha inicial por serviço externo, não primeira escolha para produção | Topologia, proporções, rig/pesos/animações, mãos/pés, expressão, LOD e materiais. Rig não confirmado; risco alto de identidade. |
| Armas | Teste de hard-surface estático é mais razoável que personagem | Silhueta exata, escala, peças móveis, UV/PBR, miras, viewmodel FOV, contatos e animação. Um STL/preview não basta. |

**Quota/custos:** o guia oficial diz que geração e edição consomem a cota unificada da assinatura Kimi, consultada em `Me → Settings → Subscription`. Nenhum custo numérico por geração foi confirmado nas fontes lidas. Nada foi gerado para descobrir.

**Direitos:** os termos vigentes em 02/11/2026 (atualizados em 24/08/2026) atribuem ao usuário direitos sobre Input/Output na medida permitida por lei, sem infringir terceiros (cláusula 5.2), mas não garantem unicidade/adequação. A cláusula 1.3 descreve casos permitidos pessoais, a 5.3 concede licença ao provedor para otimização e a 6 trata de identificadores de conteúdo gerado. Serviços externos têm termos próprios (9.1). **Uso comercial no jogo e direitos de qualquer gerador externo precisam de revisão jurídica/do dono antes da produção**; esta investigação não dá parecer jurídico.

### 6.4 Mini-avaliação futura, sem executar agora

Entrada: um prop opaco simples da Quebrada, com referência e dimensões obtidas do asset, sem material confidencial. Exigir GLB e, se o fluxo Kimi Work/Blender for escolhido, `.blend` + scripts. Uma geração e no máximo uma revisão seriam o teto **proposto**, condicionado a autorização/cota.

Fluxo: interface oficial → export/download manual → auditoria offline de escala, orientação, triângulos, UVs, texturas/canais, materiais e licença → importação isolada no mesmo recorte WebGL somente após nova autorização. Comparar aparência na mesma câmera/luz e inspecionar movimento/LOD/memória. Se entregar apenas preview/vídeo/STL, ou se GLB não preservar dados editáveis úteis, reprovar para esse uso. Não trocar o roteamento de geração do projeto nem iniciar comparação com outro gerador por esta pesquisa.

## 7. Incertezas que permanecem

1. Não há medição de FPS/frame time, memória, download, carregamento ou temperatura; todos os custos são relativos.
2. Não há prova de B em movimento, animação, contato de mãos/pés, mudança de ângulo, distância real de combate ou carga de atores/VFX.
3. Reflexão/refração de atores, sombras muito suaves, folhagem densa e água do conceito não têm fidelidade móvel demonstrada.
4. O checkout difere da produção das bases e tem alterações de outras frentes. Amazônia não tem código local correspondente encontrado.
5. Formatos Kimi são documentação, não exports inspecionados. UVs, PBR, topologia, LOD, rig, preservação de materiais e qualidade de export são não confirmados.
6. Custo unitário Kimi, integração pública 3D no OMP e condições comerciais/externas definitivas são não confirmados.
7. A amostra de seis pares não cobre os 68 estudos nem os assets excluídos do catálogo.

## 8. Ordem curta de trabalho proposta

1. **Congelar recorte e baseline no mesmo commit** — depende de autorização futura e da ausência de mudanças visuais concorrentes; demonstra que câmera, identidade e composição são comparáveis.
2. **Produzir assets B opacos da Quebrada + AK + Punk e seus LODs/bakes** — depende de receitas e direitos; demonstra se o fundamento de B sobrevive a UV/PBR/rig/360°.
3. **Integrar no Three real e validar movimento/carga/perfis** — depende de 1–2; demonstra fidelidade em gameplay e custo, não apenas still.
4. **Testar água da Piscina separadamente** — depende do baseline e do orçamento de passes; demonstra quanto do reflexo/refração é viável e qual aproximação móvel preserva leitura.
5. **Decidir B, B aproximado ou C com a mesma régua** — depende de metas aprovadas e dispositivos físicos; C só entra como alternativa medida, não como promessa de economia.
6. **Avaliar Kimi 3D com um prop, em paralelo somente se autorizado** — depende de cota, termos e export editável; demonstra redução de trabalho de asset, não desempenho do jogo.

O desenho completo, métricas e critérios estão em `PLANO-DE-PROVA.md`; as linhas rastreáveis por região/técnica estão em `MATRIZ.csv`.

## 9. Fontes oficiais datadas

Acesso em **02/11/2026**:

- Kimi 3D Make — visão geral, fluxo, exportação e quota: https://www.kimi.com/en/help/3d-make/3d-make-overview
- Kimi — tutorial 3D, atualizado 29/10/2026; modelagem paramétrica/malha, Kimi Work, Blender e serviços externos: https://www.kimi.ai/academy/3d-tutorial
- Kimi — “How to make a 3D model”, atualizado 30/10/2026; GLB/glTF/OBJ e distinção Kimi Work: https://www.kimi.com/resources/how-to-make-a-3d-model
- Kimi — “3D modeling”, atualizado 31/10/2026; GLB/BLEND e STL/3MF documentados: https://www.kimi.com/resources/3d-modeling
- Kimi API Platform — catálogo de modelos/endpoints consultado para ausência de API 3D pública: https://platform.kimi.ai/docs/llms.txt
- Kimi Terms of Services — vigência/condições de Input/Output, identificação e terceiros: https://www.kimi.com/user/agreement/modelUse?version=v2
- Three.js — memória de texturas e mipmaps: https://threejs.org/manual/pages/textures.html
- Three.js — shadow maps, redraw de casters e alternativas assadas: https://threejs.org/manual/pages/shadows.html
- Three.js — Standard/PBR por fragmento, normal/roughness/lightmap/AO: https://threejs.org/docs/pages/MeshStandardMaterial.html
- Three.js — GLTFLoader e `setKTX2Loader`: https://threejs.org/docs/pages/GLTFLoader.html
- Three.js — KTX2/Basis, transcode, WASM e detecção de suporte: https://threejs.org/docs/pages/KTX2Loader.html

A documentação web atual descreve comportamento geral; a implementação efetiva do projeto foi verificada no Three r160 vendorizado. Nenhuma fonte de marketing foi usada como prova de fidelidade, integração ou desempenho.

## 10. Revisão crítica

Revisão crítica própria após consolidar código, pixels e fontes: removidas como fundamentos quaisquer ideias de que B exige apenas PBR/bloom, que WebP prova baixa memória, que C é necessariamente mais barato, que um preview Kimi é asset pronto ou que o diagnóstico anterior prova desempenho. As revisões independentes citadas são exclusivamente as revisões 2D já existentes do catálogo; não houve segundo revisor independente desta conclusão técnica nem validação em runtime.
