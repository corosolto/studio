# Continuação — investigação OMP + Kimi sobre realismo B

## Objetivo completo

Responder quais partes da direção visual B podem ser reproduzidas no CORO SOLTO com assets editáveis e Three.js/WebGL, quais exigem aproximação móvel e quais continuam sem prova. Comparar concretamente os seis pares base/B definidos pelo dono; verificar o renderer e os assets atuais; explicar custos e concessões; investigar Kimi 3D Make sem geração; desenhar uma prova futura capaz de fundamentar B, uma aproximação de B ou a avaliação de C.

Escopo restrito a leitura, inspeção de imagens/assets, pesquisa pública e escrita dos quatro relatórios desta investigação. Não alterar jogo/assets/configurações/receitas/outras frentes; não executar jogo, protótipo ou benchmark; não gerar assets, consumir quota, instalar, criar worktree, fazer commit/PR, merge, deploy ou publicação.

## Estado e decisões

- B é a preferência condicional do dono; C é alternativa e também exige validação real. Não há meta numérica aprovada nem decisão de troca de engine.
- Os conceitos são imagens 2D de IA, não assets 3D, renders medidos ou prova de movimento/desempenho.
- O estudo completo contém 68 bases e 136 conceitos; os seis pares desta investigação são uma amostra dirigida, não o acervo inteiro.
- O diagnóstico `feasibility-review.json` é hipótese de partida; suas constatações serão confirmadas no código atual antes de fundamentar recomendações.
- Nenhuma proposta desta investigação autoriza implementação.

## Ferramentas e modelo

- Modelo efetivo: `kimi-code/k3.1-pro` (Kimi Code).
- Ferramentas usadas até este marco: leitura de arquivos/imagens, pesquisa e busca em código, shell somente para fatos Git e criação da pasta própria, e três investigadores `scout` somente leitura para código/renderer, evidência visual e fontes oficiais Kimi 3D.
- Não há nesta sessão uma ferramenta dedicada Kimi 3D Make confirmada. Ferramentas Mint existentes não foram chamadas e não serão usadas, pois geração/consumo de quota está fora do escopo.
- Navegador/Ego Lite não foi necessário até este marco; fontes públicas podem ser lidas pelas ferramentas estáticas.

## Fontes já inspecionadas

- `PROMPT-OMP-KIMI-REALISMO.txt` integralmente.
- `owner-decision.json`, `SPEC.md`, `art-bible.json`, `coverage.json` e `feasibility-review.json`.
- Final de `/Volumes/Zenith/Projects/game/corosolto/corosolto-roadmap/reports/2026-11-01-processo-agentes/CONTINUATION.md`, inclusive os marcos do catálogo, decisão B/C, diagnóstico anterior e preparação deste prompt.
- Estado Git do cliente.

## Branch, HEAD e trabalho local preexistente

- Repositório: `client/`.
- Branch: `feat/fps-paid-viewmodels-aaa`, à frente de `origin/feat/fps-paid-viewmodels-aaa` em 2 commits.
- HEAD: `86c388b560e43e92cac13cd2675a86a69b715641`.
- Estado já modificado: 34 arquivos unstaged e 19 untracked; nenhum staged. Relevantes à investigação: `public/js/bloom.js`, `look.js`, `mapprops.js`, `textures.js`, `map_lajes_authored.js`, `map_sky.js` e `public/js/vendor/` untracked, além de evidências de mapas. Essas mudanças pertencem a outras frentes e não foram feitas por esta investigação.
- As capturas do estudo vieram da produção alpha.133; o checkout local contém trabalho visual posterior/em andamento. Observações locais não serão atribuídas automaticamente à produção das capturas.

## Artefatos produzidos

- `CONTINUATION.md`: contexto, decisões, fontes, estado e limites; atualizado nos marcos de escopo, pesquisa e entrega.
- `RELATORIO.md`: resposta central, seis comparações visuais, inventário do renderer/assets, lacunas, custos móveis, avaliação Kimi 3D, fontes oficiais e ordem de trabalho.
- `MATRIZ.csv`: 32 linhas de dados e 11 colunas, com imagem/região, técnica, código, lacuna, preparação, custo não medido, concessão, evidência e confiança.
- `PLANO-DE-PROVA.md`: recorte Quebrada + AK + Punk, variantes, água separada, carga real, dispositivos físicos, instrumentos/limites, mini-prova Kimi e condições B/B aproximado/C.

## Aceitos, rejeitados e limites

- Aceito como evidência: decisão explícita do dono, cobertura declarada do estudo e estado Git observado.
- Ainda não aceito como conclusão própria: qualquer constatação do diagnóstico anterior que dependa de código, pixels ou documentação ainda não revisada nesta rodada.
- Rejeitado como prova: aparência estática, marketing, screenshot/vídeo/demo desktop ou compressão de download como evidência de desempenho, asset integrado ou memória GPU.
- Nenhum jogo, protótipo, benchmark, geração, upload ou consumo de quota executado.

## Marco 2 — pesquisa concluída

- Pixels das visões gerais B/C e dos seis pares base/B foram inspecionados, incluindo os trípticos de Punk e Canarinho Cyborg. Reviews e manifestos confirmam: B-Quebrada, B-Piscina e B-Punk reprovados por invenções; B-Amazônia, B-AK e B-Canarinho aprovados apenas em fidelidade 2D.
- Confirmados no checkout: Three r160; WebGL2 com fallback WebGL1 e perfis low/med/high; IBL procedural via PMREM; cadeia com SSAO/máscara de personagem/viewmodel/bloom/tone/AA; caminho low sem pós; sombras; materiais Standard na Quebrada, Lambert geral na Piscina e água Physical; mapas derivados de albedo e loader PBR autorado; lightmap na shell Lajes; culling/batching; ausência de KTX2 ativo.
- GLBs públicos `punk.glb` e `ak.glb` inspecionados por metadados: ambos contêm baseColor, normal e metallicRoughness WebP; Punk tem um skin e nenhuma animação embutida; AK não tem skin/animação. Isso não prova qualidade de UV, aparência ou custo.
- A versão local é `2.0.0-alpha.175`; não há módulo/registro Amazônia no código local pesquisado, embora exista captura de produção alpha.133. Portanto, não há rastreabilidade local suficiente para prescrever mudança específica no renderer da Amazônia.
- Fontes oficiais Kimi/Three.js e termos Kimi foram lidos em 02/11/2026. 3D Make documenta preview/edição e exportações, mas não foi encontrada API pública 3D nem ferramenta dedicada montada no OMP. Quota unificada é consumida por geração/edição; custo unitário não confirmado. Direitos de output têm condições e exigem revisão para uso comercial e de terceiros.
- Nenhum jogo, protótipo, benchmark, geração, upload ou consumo de quota executado.

## Marco 3 — entrega e revisão crítica concluídas

### Fontes técnicas efetivamente consultadas

- Código atual: `public/vendor/three.module.js`, `public/js/version.js`, `main.js`, `glcontext.js`, `game.js` (`_buildEnv`, `_applyQuality`), `bloom.js`, `look.js`, `textures.js`, `characters.js` (`upgradeCharMaterial`), `glbchars.js`, `mapprops.js`, `shell.js`, `water.js`, `map_quebrada.js`, `map_piscina.js`, `map_lajes.js` e `map_lajes_authored.js`; busca por Amazônia sem correspondência no código local.
- Assets: metadados JSON dos GLBs públicos `models/characters/punk.glb` e `models/weapons/ak.glb`, sem executar o jogo.
- Imagens: `visao-geral-B.png`, `visao-geral-C.png` e os doze arquivos base/B dos seis casos solicitados; trípticos lidos como pranchas de três ângulos.
- Estudo/revisões: `capture-manifest.json`, `generation-manifest.json`, `reviews/maps-review.json`, `characters-review.json`, `skins-review.json`, `extras-review.json` e arquivos de contexto já listados acima.
- Fontes oficiais acessadas em 02/11/2026:
  - https://www.kimi.com/en/help/3d-make/3d-make-overview
  - https://www.kimi.ai/academy/3d-tutorial
  - https://www.kimi.com/resources/how-to-make-a-3d-model
  - https://www.kimi.com/resources/3d-modeling
  - https://platform.kimi.ai/docs/llms.txt
  - https://www.kimi.com/user/agreement/modelUse?version=v2
  - https://threejs.org/manual/pages/textures.html
  - https://threejs.org/manual/pages/shadows.html
  - https://threejs.org/docs/pages/MeshStandardMaterial.html
  - https://threejs.org/docs/pages/GLTFLoader.html
  - https://threejs.org/docs/pages/KTX2Loader.html

### Decisões aceitas

- B permanece a primeira hipótese, não uma aprovação de implementação ou desempenho.
- O fundamento opaco de B é compatível em princípio com assets editáveis e o pipeline atual; a prioridade é autoria/consistência de materiais, UVs, high-to-low, iluminação estática e LOD.
- A prova futura recomendada é Quebrada + AK + Punk; Piscina/água é teste separado. Reflexão fiel de atores, grandes sombras suaves, folhagem/transparência e carga de muitos atores são riscos altos/não medidos.
- Kimi 3D só entra como mini-avaliação manual futura de um prop, condicionada a cota, termos e export editável. Não há integração 3D pública/montada confirmada no OMP.

### Hipóteses rejeitadas como prova

- “Basta ligar PBR/bloom”, trocar engine, aplicar Physical em todos os materiais ou usar normal map para corrigir silhueta/rig/contato.
- WebP pequeno como evidência de pouca memória GPU; geometria comprimida como evidência de menos renderização; C como opção intrinsecamente mais barata.
- Conceito 2D, screenshot, preview/vídeo Kimi, demo desktop ou arquivo STL como prova de asset WebGL integrado, animação ou desempenho móvel.
- Veredictos APROVADO/REPROVADO do catálogo como escolha estética ou validação de renderer; eles medem somente fidelidade 2D.

### Verificação da entrega

- Os quatro arquivos exigidos existem somente nesta subpasta datada; nenhum arquivo do jogo/estudo foi alterado.
- `MATRIZ.csv` foi parseada: 33 linhas incluindo cabeçalho, 32 casos, 11 colunas em todas as linhas, nenhuma linha malformada.
- Revisão crítica própria feita após a consolidação; não houve segundo revisor independente desta conclusão técnica. As revisões independentes citadas são apenas as revisões 2D preexistentes do catálogo.
- Nenhum jogo, protótipo, benchmark, geração, upload, consumo de quota, instalação, worktree, commit/PR, merge, deploy ou publicação realizado.

### Limites restantes

- Nenhuma medição real de frame time, GPU, memória, carregamento, aquecimento ou bateria; metas numéricas continuam não aprovadas.
- Fidelidade em movimento, animação/contatos, distância real de combate, carga representativa e perfis físicos Android/iOS continua sem prova.
- O checkout alpha.175 difere das capturas alpha.133 e contém trabalho de outras frentes; a prova deve recapturar baseline em um único commit.
- Amazônia não tem módulo local correspondente encontrado; propostas específicas ficam dependentes do código/assets corretos.
- Formatos Kimi são documentados, não exports obtidos/inspecionados. UV/PBR/topologia/LOD/rig/qualidade, custo unitário, integração OMP e condições comerciais/externas definitivas continuam não confirmados.

## Próximo passo

O dono revisa `RELATORIO.md`, `MATRIZ.csv` e `PLANO-DE-PROVA.md` e decide se solicita a prova futura. Antes de qualquer execução: escolher commit/dispositivos/carga, aprovar metas e autorizar explicitamente implementação ou geração. Esta investigação termina aqui; não avançar para implementação por conta própria.
