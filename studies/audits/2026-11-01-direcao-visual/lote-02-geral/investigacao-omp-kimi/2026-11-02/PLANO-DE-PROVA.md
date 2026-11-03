# Plano de prova futura — direção visual B

**Status: desenho experimental, não autorização nem execução.** Nenhum protótipo, benchmark, geração ou medição foi realizado nesta investigação. Metas numéricas de aceite e esforço precisam ser aprovadas pelo dono antes da execução.

## 1. Decisão que a prova deve resolver

A prova deve testar quatro hipóteses independentes:

1. **H1 — fundamento opaco:** assets editáveis e o Three r160 atual reproduzem a separação de materiais, escala de detalhe, contato e exposição de B sem mudar identidade/layout.
2. **H2 — direção móvel:** reduzir detalhe, passes, sombras e geometria distante preserva a linguagem B e a leitura competitiva nos aparelhos representativos.
3. **H3 — água:** uma aproximação de reflexo/refração é visualmente aceitável no móvel; reflexão fiel de atores pode ter custo proibitivo e não deve bloquear H1/H2.
4. **H4 — Kimi 3D:** um export editável pode reduzir trabalho de um prop, sem presumir asset pronto, rig, PBR ou desempenho.

C não é hipótese de economia automática. Se for avaliada, usa a mesma cena, câmera, carga, instrumentos e critérios.

## 2. Recorte principal: Quebrada + AK + Punk

### Por que este recorte

- **Quebrada:** concentra asfalto, tijolo, reboco, veículos, cobertura, sombras e leitura urbana; usa Standard hoje.
- **AK:** testa madeira/metal/tecido próximos da câmera, viewmodel e mãos; já possui mapas PBR, portanto evita a falsa hipótese “basta ligar PBR”.
- **Punk:** testa roupa, pele, cabelo, silhueta, rig e três ângulos; normal/roughness já existem.
- **Não incluir Amazônia no primeiro recorte:** o código local correspondente não foi encontrado. Água/folhagem da Amazônia não deve impedir a resposta sobre os materiais opacos.
- **Piscina fica separada:** seu custo de água e passes pode esconder o resultado do fundamento B.

### Escopo de assets

Somente os elementos necessários à câmera e ao percurso de validação:

1. Um conjunto coerente de asfalto/calçada/tijolo/reboco e os materiais dos veículos já presentes na vista.
2. A AK e braços existentes, sem acessórios novos.
3. O Punk original, sem as tachas inventadas nas costas/barra.
4. LODs e maps dos itens alterados; nenhum redesenho de mapa, spawn, colisão, rota ou cobertura.

A cena de teste mantém o mapa e a carga real; não se apaga o restante do cenário para melhorar o resultado. A preparação offline pode incluir UV0/uv1, color/normal/ORM/AO, high-to-low, lightmap/probe estático e LOD. No Three real devem existir os meshes/materiais finais, rig/animação, luz/sombra, viewmodel, perfis de qualidade e o caminho de pós correspondente. Blender ou imagens fixas são somente preparação, nunca evidência final.

## 3. Pré-registro e baseline obrigatório

Antes de alterar qualquer asset na futura prova:

1. Escolher e congelar um commit sem trabalho visual concorrente no recorte; registrar HEAD, hash de assets, versão do cliente e Three.
2. Recapturar a baseline **nesse mesmo commit**. As imagens alpha.133 do estudo servem de direção, não de comparação pixel a pixel com o alpha.175 local.
3. Registrar câmeras do manifesto como ponto de partida:
   - Quebrada: posição `[3,4,-28]`, `lookAt [0,2,10]`, FOV 65.
   - AK: posição `[3,1.62,-28]`, FOV 70; documentar novamente o estado de bloom e o viewmodel efetivo.
   - Punk: recuperar as três câmeras e a pose do `capture-manifest.json`/scripts, sem inventar coordenadas.
4. Fixar exposição, horário, seed, resolução CSS, DPR, qualidade, navegador e flags. Registrar qualquer diferença necessária em vez de escondê-la.
5. Criar manifesto de assets com dimensões, formatos, canais, triângulos, UVs, skins/animações e hashes.
6. Definir dispositivos, carga representativa e orçamentos de aceite com o dono. Sem orçamento aprovado, a prova produz dados, não uma aprovação de desempenho.

## 4. Variantes: uma mudança por vez

| Variante | Conteúdo | O que isola |
|---|---|---|
| **V0 — baseline congelada** | Jogo real no commit escolhido, sem nova direção | Referência visual, carregamento, memória e frame time. |
| **V1 — assets B opacos** | Mesma cena/luz/passes de V0; somente UV/PBR/high-to-low/LOD dos assets do recorte | Quanto de B vem de autoria sem nova técnica de renderer. |
| **V2 — luz/AO estática** | V1 + bake/probe/contato estritamente necessários; sem double lighting | Quanto da diferença depende de iluminação e qual custo muda. |
| **V3 — perfis móveis B** | Melhor receita de V1/V2 com variantes de DPR, LOD, casters, transparência e passes já existentes | Se a direção sobrevive às concessões e onde ocorre o gargalo. |
| **C0 — alternativa, somente se necessária** | Mesma geometria/câmera/carga e orçamento; assets com linguagem C | Comparação justa de aparência e custo, sem presumir vantagem. |

Não combinar KTX2, nova água, novo pós e assets B na primeira mudança. KTX2 pode ser uma variante posterior de carregamento/memória depois que V1 estiver visualmente aceita. Cada variante deve manter kill-switch e manifesto próprio durante a prova; isso descreve o experimento futuro, não uma implementação atual.

## 5. Protocolo visual

### 5.1 Comparação estática controlada

Para V0/V1/V2/V3, capturar:

- A câmera geral da Quebrada e a câmera FPS da AK.
- Frente/perfil/costas do Punk na mesma pose e posição.
- Close-ups de asfalto/tijolo/azulejo quando aplicável, madeira/aço da AK e couro/xadrez/cabelo do Punk.
- Os mesmos quadros em low/med/high e no caminho de compatibilidade.

Critérios propostos:

1. **Identidade/composição — bloqueador:** nenhuma barreira Jersey, mobiliário, tachas, acessório, cobertura, rota, cor de facção ou mudança de pose não autorizada.
2. **Separação de materiais:** madeira, aço, tecido, pele, reboco e tijolo devem permanecer distinguíveis sem depender de sujeira uniforme.
3. **Escala:** juntas/veios/fibras/tijolos coerentes com o tamanho do objeto e sem tiling evidente na câmera de jogo.
4. **Contato/exposição:** pés/props não flutuam; sombras não escondem alvo/facção; highlights não estouram nem apagam mira/identidade.
5. **Silhueta:** preservada em 360° e na distância real de combate; normal map não conta como correção de forma.
6. **Equivalência móvel:** low pode perder microdetalhe, não paleta, layout, identidade ou leitura de alvo.

### 5.2 Movimento e mudança de ângulo

Gravar o mesmo percurso repetível com câmera e seed:

- Caminhar/correr, girar 360°, aproximar/afastar superfícies e atravessar áreas de sombra/luz.
- Idle, corrida, salto e ações já existentes do Punk; observar deformação, pés, cabelo e roupa.
- Tiro/recarga e transições existentes da AK; observar mãos, miras, clipping e especular.
- Adversários em distâncias reais de combate e cruzando folhas/sombras/água quando aplicável.

Reprovar shimmer/z-fighting, popping que revela/esconde adversário, especular instável que mascara alvo, rig quebrado, contato de mãos/pés incorreto ou diferença de regra/visibilidade entre perfis. Vídeo serve para revisão de movimento; os dados de desempenho vêm dos instrumentos, não da gravação.

## 6. Carga representativa

A cena vazia não é aceite. Executar dois ensaios no jogo real:

1. **Partida representativa:** quantidade e combinação de jogadores, armas, bots, VFX e sombras observadas em partidas reais; registrar a configuração e justificar que representa o uso dos usuários.
2. **Pico previsto:** limite real de atores do modo e um ensaio Javaporco com a carga máxima prevista, sem inventar número neste plano. Reutilizar os mesmos princípios de LOD/materiais; não criar uma nova direção de arte para esse ensaio.

Medir primeiro a baseline correspondente. Se o modo não suportar a mesma cena/seed, documentar a diferença e não comparar números como se fossem do mesmo caso.

## 7. Experimento separado: água da Piscina

Câmera de referência do estudo: `[0,2.3,-8]`, `lookAt [0,0.3,8]`, FOV 65; recapturar no commit da prova. Não adicionar as espreguiçadeiras/escada inventadas à direita.

| Variante | Técnica futura | Pergunta |
|---|---|---|
| **W0** | Água atual e materiais atuais | Baseline de aparência/passes/custo. |
| **W1 — móvel primeiro** | Cerâmica PBR + normais/Fresnel/profundidade + ambiente estático; sem reflexão planar de atores | Quanto de B é obtido sem redesenhar a cena? A perda de reflexão/refração é aceitável? |
| **W2 — reflexão limitada** | W1 + reflexão planar em resolução/update reduzidos e orçamento explícito | Qual custo de redesenhar arquitetura e atores? A defasagem/artefato é aceitável? |
| **W3 — somente se W2 for insuficiente** | Refração/cor de cena e/ou atualização maior, ainda sem recursos fora do WebGL | Existe benefício visual que justifique os passes e RTs? |

Percorrer a borda, olhar de cima/raso, mover atores ao redor e atrás da água, testar VFX e todos os perfis. Registrar número/tamanho de RTs, passes, draws e atualizações. Verificar feedback de depth, sorting, transparência, compilação e perda/restauração de contexto.

**Regra de decisão:** W1 aprovado + W2/W3 caro demais não reprova B inteiro; fundamenta B aproximado. Se nem a cerâmica/água simplificada preservar a direção ou a leitura, registrar uma lacuna específica antes de ampliar B.

## 8. Dispositivos e condições

Seleção final depende de telemetria dos usuários; não há distribuição de aparelhos nesta investigação. Proposta mínima:

| Classe física | Seleção | Objetivo |
|---|---|---|
| Android baixo suportado | Aparelho real com menor memória/GPU ainda suportada pelos usuários | Compatibilidade, memória, aquecimento e low. |
| Android mediano real | Modelo frequente na telemetria | Perfil principal e med/low. |
| iPhone/iOS mais antigo suportado | Modelo real ainda presente entre usuários | Safari/WebGL, memória e limitações de instrumentação. |
| Dispositivo recente de referência | Android ou iOS recente | Separar limitação de hardware de defeito da cena; não aprovar sozinho. |
| Desktop | Apenas referência de desenvolvimento | Diagnóstico visual; não substitui celular. |

Registrar modelo, SoC/GPU, RAM, OS, navegador/versão, bateria/temperatura inicial quando disponível, resolução CSS/drawing buffer, DPR, WebGL/tier e flags. Testar WebGL2 real; incluir `safe=1`/WebGL1 em um ensaio de compatibilidade e um dispositivo degradado real se houver. Não usar emulador como prova de GPU/temperatura.

Condições propostas, ainda não metas aprovadas:

- **20 minutos contínuos** por sessão sustentada para expor aquecimento e degradação; repetir o percurso curto ao menos três vezes para variância.
- Três carregamentos frios e três quentes por variante/dispositivo; mesma rede e servidor, com cache/estado registrados.
- Rede real dos usuários quando possível; throttling de laboratório apenas como comparação controlada.
- Sem DevTools aberto durante a cronometragem, salvo quando a ferramenta exigir; registrar o overhead e separar captura de profiling da corrida principal.

## 9. Medição e limites de observação

| Dimensão | Método futuro | Limite que deve aparecer no resultado |
|---|---|---|
| Frame time apresentado | Timestamps de `requestAnimationFrame`/`performance.now` no laço real; série completa, p50/p95/p99, máximo e quedas por janela | rAF não separa CPU de GPU nem prova apresentação perfeita; registrar refresh rate e VSYNC. |
| CPU de update/render | `performance.mark/measure` em simulação, animação, culling e submissão; long tasks com `PerformanceObserver` quando suportado | Marcações medem o trecho instrumentado, não todo trabalho do browser/driver. |
| GPU por passe | `EXT_disjoint_timer_query_webgl2` quando disponível; marcar mundo, SSAO, máscara, viewmodel, bloom, água e pós | Extensão pode faltar, ser imprecisa ou ficar `DISJOINT`; não inventar tempo GPU por subtração. |
| Cena | `renderer.info` para calls/triangles/geometries/textures/programs; contagem de atores/casters/RTs e drawing buffer | Contadores não medem overdraw nem custo de shader; registrar quando ocorre reset. |
| Memória | Inventário de texturas por dimensão/formato/mips + RTs + geometrias; heap/API do browser quando disponível | WebGL não expõe memória GPU real universalmente. Estimativa deve ser rotulada e não somada como se fosse uso total do processo. |
| Carregamento | Navigation/Resource Timing, bytes por content type, tempo até menu e até primeira partida interativa; decode/transcode/compile separados | Cache, servidor, rede e compilação assíncrona afetam resultado; registrar frio/quente e erros. |
| Estabilidade | Quedas perceptíveis, long tasks, crash, perda/restauração de contexto, erros de shader e memória ao longo da sessão | Ausência de erro em uma sessão não prova estabilidade geral. |
| Aquecimento/energia | Série de frame time ao longo de 20 min; temperatura/bateria via ferramentas do SO quando acessíveis | Navegador não expõe temperatura/GPU energy de forma consistente; evitar causalidade sem sensor. |
| Qualidade visual | Matched captures + vídeo do percurso + checklist de identidade/leitura | Imagem estática não aprova movimento nem desempenho; vídeo comprimido não mede frame time. |

Antes da execução, transformar os dados em orçamentos por dispositivo: frame time/cauda, limite de quedas, memória/pico, carregamento e perda visual. **Nenhum valor numérico de aceite é proposto como se já fosse aprovado.** A baseline V0 deve orientar os limiares relativos; o dono decide quanto de regressão é aceitável.

## 10. Mini-prova Kimi 3D, independente

### Entrada e teto

- Um prop opaco simples da Quebrada, com referência e dimensões medidas do asset original; nenhum segredo ou upload nesta fase atual.
- Uma geração e no máximo uma revisão, como teto **proposto**; confirmar cota e autorização antes.
- Fluxo manual na interface oficial; não presumir API/OMP nem usar endpoints internos.

### Saída editável exigida

- GLB obrigatório para o teste WebGL; glTF/OBJ podem ser diagnóstico, não substitutos equivalentes sem auditoria.
- `.blend` e scripts quando o fluxo Kimi Work/Blender estiver efetivamente disponível; não exigir plugin inexistente no OMP.
- Manifesto de origem, prompts, data, cota observada, termos aplicáveis e qualquer serviço externo usado.

### Inspeção antes do Three

1. Escala/pivô/orientação e dimensões comparadas ao original.
2. Triângulos, topologia, normals/tangents, UV0/uv1 e materiais.
3. Base color/normal/ORM, color spaces, texturas embutidas e memória estimada.
4. Silhueta/identidade e possibilidade real de edição/LOD. STL, vídeo ou preview não satisfazem esse teste.
5. Direitos/identificadores e termos de terceiros; revisão do dono/jurídica antes de uso comercial.

Só depois, com nova autorização, importar no mesmo recorte e comparar V0/V1 por câmera/luz, movimento e custo. O teste responde se Kimi reduz trabalho de **um prop**; não generalizar para personagens, skins, armas animadas ou o jogo inteiro.

## 11. Condições de decisão

### Seguir com B

Todas as condições:

- Identidade/composição aprovadas e acabamento principal reconhecível na câmera e em movimento.
- Carga representativa e pico testados no jogo real, não em cena vazia.
- Orçamentos aprovados atendidos nos dispositivos físicos selecionados, inclusive sessão sustentada, carregamento e memória.
- Nenhuma perda de leitura competitiva bloqueadora entre perfis.
- Água pode seguir como item separado se o restante for aprovado e a aproximação for aceita explicitamente.

### Seguir com B aproximado

- H1 é visualmente aprovada, mas H2/H3 exigem redução de microdetalhe, sombras, transparência, pós ou reflexos.
- A versão aproximada mantém paleta, materiais principais, identidade e leitura; as perdas são documentadas e aceitas pelo dono.
- Reflexão fiel de atores não é requisito implícito se W1 for aprovada e W2/W3 falhar no orçamento.

### Avaliar C

- Mesmo após assets e aproximações razoáveis, B não atinge a aparência desejada, ou excede os orçamentos aprovados, ou prejudica leitura/identidade.
- C0 deve então ser produzida no mesmo recorte e comparada com V0 e a melhor variante B. C não vence por parecer mais simples em uma imagem; precisa demonstrar aparência aceita e custo compatível.

### Resultado inconclusivo

- Metas/dispositivos/carga não representativos, instrumentos indisponíveis, baseline diferente, export Kimi ausente ou medição inválida.
- Nesse caso, registrar o que falta e repetir somente a parte inconclusiva; não converter ausência de dado em reprovação ou aprovação.

## 12. Evidências que a futura execução deve entregar

1. Manifesto de commit/assets/dispositivos e pré-registro de metas.
2. Matched captures V0/V1/V2/V3 e, se necessário, C0/W0–W3.
3. Vídeos dos percursos e checklist de identidade, contatos, animação e leitura.
4. Séries brutas e resumos de frame time/passes, memória estimada/observada, carregamento, erros e condições ambientais.
5. Relatório de falhas e concessões, com dados faltantes explícitos.
6. Decisão final separada para fundamento B, água e Kimi 3D; nenhuma generalização além do recorte testado.

Até uma solicitação posterior do dono, este documento permanece apenas planejamento.
