# Lajes — evidence-backed reference matrix

Research baseline: **2026-11-03**. Scope: one connected alley, a commercial street corner, and a stair-connected accessible rooftop. This is a composite Brazilian community study, not a reconstruction of a named real place. The references span different cities and dates; they must not be presented as one documented neighborhood.

## 1. Evidence protocol

| Tag | Meaning | Permitted use |
|---|---|---|
| **VP** | Directly visible in a real photograph. | Form, adjacency, material/use relationships and relative scale. |
| **VG** | Directly visible in a captured gameplay frame. | Composition, asset typology and spatial sequencing only. It is not documentary evidence of a real place. |
| **VB** | Directly visible in a current Lajes baseline capture. | Anti-reference and regression definition. |
| **D** | Documented by a cited technical source. | Product-specific or normative calibration, with its scope stated. |
| **I** | Interpretation or relative-scale inference from an image. | A hypothesis to test in the scene; never a measured real-world value. |
| **A** | Explicit metric or art-direction assumption for this slice. | A build target that can be changed deliberately; not a claim about the references. |

No photograph or gameplay frame has camera calibration, known lens geometry at capture, or a surveyed scale bar. **No numerical dimensions are inferred from perspective images.** People, vehicles, weapons and doors provide only relative scale cues. All numerical build targets below are therefore **D** or **A**. Norms are used for human-scale sanity checks, not as a claim that this fictional map or an informal existing building is code-compliant.

## 2. Metric contract and derived kit calibration

Shared constraints are 1 Blender unit = 1 m, Z up, player eye 1.65 m, clear doors 0.90 x 2.10 m, stair risers <= 0.175 m and treads >= 0.28 m. The following turns those constraints into inspectable kit values.

| ID | Value and status | Application / reason |
|---|---|---|
| M01 | **1 BU = 1 m; Z up; eye 1.65 m — A** | Place a non-rendering 1.65 m eye marker and a 1.80 m human-height gauge at spawn while assembling every route. |
| M02 | **Door clear opening 0.90 x 2.10 m — A/D** | Game target is 0.10 m wider than the 0.80 x 2.10 m minimum for open doors stated by NBR 9050:2015/Em1:2020, section 6.11.2.4 [N01]. Measure the free opening, not the leaf or outer frame. |
| M03 | **Stair riser 0.17 m; tread 0.30 m; clear width 1.20 m; landing depth 1.20 m — A** | Gives `0.30 + 2 x 0.17 = 0.64 m` and satisfies the shared riser/tread limits. Keep every riser/tread in a flight equal. The width and landing values are slice assumptions, not dimensions measured in references. |
| M04 | **Route/sidewalk clear width 1.20 m; commercial-corner local widening 1.50 m — A/D** | N01 sections 6.12.5 and 6.12.7.2 preserve a 1.20 m pedestrian clear band around works and curb ramps. Apply that as the minimum obstruction-free game route; frontage furniture and poles sit outside it. The 1.50 m corner widening is an art/gameplay choice. |
| M05 | **Curb/gutter step 0.15 m; gutter channel 0.20 m wide — A** | Use a continuous curb with explicit lowered crossings, not an accidental collision cliff. These are modeling choices; none of the visual sources supplies a measured curb. |
| M06 | **Default window 1.00 x 1.10 m; sill 0.90 m; alternate narrow window 0.60 x 1.10 m — A** | Establish readable residential scale from the door gauge. Security bars and shutters remain within the facade assembly rather than floating off it. |
| M07 | **Parapet 1.10 m above finished rooftop; stair handrail 0.92 m — A/D** | The parapet height is a slice assumption. The handrail height follows N01 section 6.9.3.2 when the detailed stair is built; it does not replace a guard at an exposed roof edge. |
| M08 | **If a 1,000 L Fortlev-like tank is used: 0.80 m total height, 1.47 m upper diameter, 1.29 m lower diameter; full rigid level base and 0.60 m clear service perimeter — D** | Product-specific values and installation guidance from N02, not a universal size for every photographed tank. Do not balance tanks on narrow beams or leave them unsupported. |
| M09 | **Primary service bundle 3–6 conductors; 1–2 drops per served frontage; typical visible sag 0.30–0.60 m on an 8–12 m span — A** | Readable infrastructure without a sky-filling wire sculpture. Every span must have two declared anchors; these counts and sags are art assumptions, not electrical design. |
| M10 | **Typical residential storey 2.80–3.20 m; rolling-shop clear opening 2.40 x 2.40 m — A** | Use the door and human gauge to prevent miniature floors. Vary rooflines by changing a coherent building assembly, not by arbitrarily stretching windows and doors. |

## 3. Preserved capture provenance and limits

The original four YouTube sources and frame times are retained below. Local frames are in `maps/lajes/research/complexo-favela/`; the contact sheet is `favela-reference-contact.png`. All were inspected on 2026-11-03. They show a game, including its HUD, weapon, watermark and browser UI. They are useful secondary visual references but cannot establish real dimensions, construction dates, locations or current conditions.

| Source | Preserved frames | Direct observations and allowed use |
|---|---|---|
| [Y01](https://www.youtube.com/shorts/QqQmPkyLkdM) | 2, 5, 10, 20, 35, 48 s | **VG:** metal and rolling doors, shuttered/barred windows, exposed concrete edges, painted and weathered wall zones, potted palms and small planters. Use for opening/facade typology and occupied-frontage composition only. |
| [Y02](https://www.youtube.com/shorts/TkXng5bGQUs) | 2, 8, 20, 40 s | **VG:** street corridor, poles, multiple overhead spans, painted shop panels/signs, awning bands and roof-level views. Use for connected-infrastructure and commercial-corner composition. |
| [Y03](https://www.youtube.com/shorts/s3LNGJro0Y8) | 2, 8, 20, 40 s | **VG:** narrow alley, occluding turns, stairs with a wall handrail, doorway landings and alternating exposed/finished wall surfaces. Use for route rhythm; weapon and player scale are not survey references. |
| [Y04](https://www.youtube.com/shorts/fugtKMTzmA0) | 2, 8, 20, 40 s | **VG:** rolling shutters, doors, window bars, stained lower walls, blue rooftop tanks and slab/parapet fragments. Use for kit variants; the later interior/weapon frames are not environmental evidence. |

## 4. Observation-to-kit matrix

### 4.1 Human-scale routes, curbs, stairs and openings

| Evidence | Direct observation / bounded inference | Constructible application |
|---|---|---|
| **C02, C03, C05** | **VP:** C02 includes a standing adult and full-size vans beside narrow frontages; C03 shows a person beside a door and wall-mounted utility boxes; C05 includes people on a broad stair and path. **I:** these are relative human-scale cues only. C05 is a formal public viewpoint, so its stair style is not a model for the residential alley. | Anchor the entire slice to M01–M03. Use C02/C03 for occupied street scale and only step cadence/landing readability from C05. Never scale a whole building to fit a view. |
| **Y03, N01** | **VG:** the alley changes direction and elevation; stairs meet small landings and openings rather than ending in empty terrain. **D:** N01 supplies the open-door and clear-route calibration in M02/M04. | Build one continuous collision/navigation route from spawn through the alley to the corner and rooftop. Keep top and bottom stair landings clear; no door leaf, tank, pole or planter may reduce M03/M04. |
| **C02, Y01, Y03** | **VP/VG:** ground floors meet the lane with local thresholds and edge changes; C02 is unpaved and therefore is evidence for adjacency, not a directive to copy its surface into the paved slice. | Resolve a deliberate paved section: facade threshold -> frontage strip -> 1.20 m clear sidewalk -> 0.15 m curb -> gutter -> road. Break the curb only at authored crossings/driveways and keep M04 continuous. |
| **C03, C04, Y01, Y04** | **VP:** small metal doors, blue security grilles, louvered/shuttered windows, projecting sills and utility fixtures recur. **VG:** rolling shutters and recessed openings distinguish street-level use. | Create door, narrow-window, wide-window and rolling-shutter assemblies from M02/M06/M10. Frames, bars, sills and shutters share the same wall plane and collision logic; no pasted-on floating frames. |

### 4.2 Construction phases and facade use

| Evidence | Direct observation / bounded inference | Constructible application |
|---|---|---|
| **C04, C01** | **VP:** exposed brick, plastered/painted walls, unfinished-looking posts and upper additions coexist; roof heights and setbacks vary. These photographs do not establish the date or chronology of any individual phase. | Use three coherent states: `masonry/exposed`, `plastered/unfinished`, and `occupied/painted`. Assign state per building or per understandable addition, with material transitions at slabs, corners and openings—not random noise across every wall tile. |
| **C03, C04** | **VP:** painted lower fronts, worn plaster, exposed service runs, wall fixtures, laundry and vegetation communicate occupation. Upper floors do not share one identical opening pattern. | Add use after structure: a service riser follows a wall, a tank sits over support, laundry occupies a balcony/opening, and paint stops at a real edge. Keep weathering localized below sills, at splash zones and at contacts. |
| **Y01, Y04, C03** | **VG/VP:** shuttered ground floors and residential upper openings provide a useful mixed-use composition. The gameplay frames do not prove a real business type or location. | At the corner, use one rolling-shop bay below a residential facade; adjacent alley frontages remain predominantly residential. Change at least two of finish, opening family and roofline between neighboring bays; never repeat three identical complete facades. |

### 4.3 Roofs, parapets, water tanks and skyline

| Evidence | Direct observation / bounded inference | Constructible application |
|---|---|---|
| **C01, C04, Y04** | **VP:** blue polyethylene tanks, simple roof terraces, fibrocement-covered areas, small rooftop additions and antennas appear among dense occupied roofs. **VG:** tanks and parapets are readable rooftop landmarks. | Make the playable roof a flat, continuous slab with M07 edge protection. Put fibrocement on a separate non-route shelter/addition. Include at least one properly supported tank and one small vertical landmark; do not scatter tanks on inaccessible decorative roofs at uniform intervals. |
| **N02, C01** | **D:** N02 documents tank proportions, a fully supported level base, service clearance and inlet/outlet/overflow/cleaning connections for the specified product. **VP:** C01 supports the tank-on-roof relationship, not the hidden pipe design. | Use M08 for the selected tank. Model a full base and an intelligible inlet/outlet/overflow group routed toward the wet core. Preserve the 0.60 m service perimeter and the main traversal lane. No engineering/load claim is made. |
| **C04, C06, C07** | **VP:** dense skylines combine small height changes, tanks/antennas, vegetation and larger landforms; distant masses lose contrast relative to near detail. | Build three depth bands: near playable roofs, midground varied roof blocks, far simplified neighborhood/landform silhouettes. Avoid a single flat roofline and avoid isolated giant background boxes. Keep tanks/antennas as sparse accents rather than one on every roof. |

### 4.4 Connected utility infrastructure

| Evidence | Direct observation / bounded inference | Constructible application |
|---|---|---|
| **C03, C02, C04** | **VP:** poles carry multiple conductors; service runs leave the street network and terminate at facade equipment; wall-mounted utility boxes and vertical conduits establish a complete service path. Cable density varies by view. | Define a utility graph before placing wires: street poles -> primary bundles -> facade attachment -> service drop -> utility box -> vertical conduit. M09 controls visual density. Every cable has real endpoints; no free tips, closed decorative rings or giant sky loops. |
| **Y02, C02** | **VG/VP:** overhead lines reinforce the street direction and create layered silhouettes, while lower facades retain windows, signs and entrances. | Place primary bundles on the street side and keep the M04 pedestrian band and door swing/traverse volumes clear. Use the utility corridor to lead the eye toward the corner, not to fill every patch of sky. |

### 4.5 Commerce, signage, vegetation and everyday objects

| Evidence | Direct observation / bounded inference | Constructible application |
|---|---|---|
| **Y02, Y04, C03** | **VG:** painted fascia-like panels, colored ground-floor fronts, an awning band and rolling shutters make the commercial edge distinct from residential lanes. **VP:** C03 supplies attached house numbering and small-scale frontage details. | Give the corner one primary shop sign, one address number and one rolling/open shop bay. Attach signs to fascia or wall; do not float text. Use invented PT-BR service names and original graphics rather than copying real brands or watermarks. |
| **C03, C04, C07, Y01** | **VP:** vegetation appears in pots, planted pockets and larger tree masses between buildings; C07 has substantial foreground tree cover. **VG:** potted palms mark entrances. Species cannot be identified reliably enough here for a botanical claim. | Use generic non-identified broadleaf/palm-like assets as art assumptions. Cluster pots at thresholds and trees in authored planted pockets; anchor every plant to soil or a pot. Preserve M04 and do not distribute identical shrubs as filler. |
| **C03, C02, Y02** | **VP/VG:** laundry, bins/containers, street vehicles and small frontage objects occur in use-specific locations. No source justifies indiscriminate clutter. | Group props by activity: laundry above a residential opening, bins against a wall, chairs/ crates at the shop edge. Keep the central route and sightline thresholds clear. Everyday objects must explain use, not conceal unresolved junctions. |

### 4.6 Local sky and atmosphere

| Evidence | Direct observation / bounded inference | Constructible application |
|---|---|---|
| **C05, C06, C07** | **VP:** near facades and vegetation retain stronger detail while distant hills/neighborhoods are quieter and lower contrast. C05 has a documented 17:10 capture time, but that does not establish the desired map time or sun direction. | Use distance-dependent contrast reduction/haze and three skyline depth bands. Do not infer a sun angle from C05. Keep far geometry simple and atmospherically subordinate to the playable roof. |
| **C02, Y01, Y02** | **VP/VG:** bright sky and cloud fragments contrast with narrow shaded corridors. Exposure, game rendering and post-processing differ, so these are not radiometric references. | Choose a neutral-to-warm daytime rig as **A**, with readable cool shade and no global orange wash. Use a continuous 360-degree sky with no visible seam or polar distortion. Exact location, season, weather and solar azimuth remain unresolved. |

## 5. Fixed-camera application and regression matrix

The fixed cameras are `spawn`, `alley`, `corner`, `rooftop`, and `sky`. Numeric checks are scene/mesh/navigation checks; camera captures verify their visible result. A camera image alone must not be used to “measure” hidden clearance.

| Rule / cameras | Required visible and measurable result | Baseline anti-reference addressed |
|---|---|---|
| **R01 Human scale — spawn, alley, corner** | At least two route doors are visible at M02; the spawn eye marker is 1.65 m; windows follow M06 and storeys M10. No uniformly stretched miniature facade family. | B01/B03/B04/B05: small-looking doors/windows and repeated block masses make the scene read as a miniature. |
| **R02 Continuous ground junction — spawn, corner, alley** | A continuous navigation/collision path connects spawn, sidewalk, corner, alley and rooftop. Clear band >= 1.20 m; corner widening 1.50 m; curb 0.15 m except at authored crossings; no unplanned route discontinuity. | B01/B03/B05: broad empty ground and unresolved facade/street edges replace a readable pedestrian section. |
| **R03 Alley sequence — alley** | The alley contains an occluding turn or threshold, a connected stair, and openings at landings. No three consecutive complete facade repeats; exposed, plastered and occupied states appear in coherent assemblies. | B03/B04: long open blocks and mechanical repetition remove depth, use and local identity. |
| **R04 Resolved commercial corner — corner** | One shop bay has an attached PT-BR sign, M10 rolling opening and a facade/threshold/sidewalk/curb/gutter/road junction. Sign and props do not obstruct M04. | B01/B04: anonymous repeated boxes and bare edges provide no commercial or pedestrian focal point. |
| **R05 Connected utilities — corner, sky, rooftop** | Zero free cable endpoints and zero closed ornamental cable loops. The corner has at least one traceable pole -> span -> facade attachment -> drop -> utility-box path. M09 controls bundle density. | B02: an oversized ring/knot of wires dominates the sky and does not read as a service network. |
| **R06 Accessible occupied roof — rooftop** | A stair using M03 reaches a continuous roof; exposed edges have M07 protection; at least one tank follows M08 with base, service clearance and connected pipe group. The roof is not just a backdrop. | B05 and the rooftop portions of B01/B04: open terrain and repeated boxes do not provide a connected, occupied vertical destination. |
| **R07 Skyline depth and clean sky — rooftop, sky** | Near/mid/far silhouette bands are visible; far forms are lower contrast. No sky seam, obvious polar pinch, floating background block or oversized cable sculpture. | B01/B02/B04/B05: empty/flat horizons, artificial wiring and undifferentiated background masses flatten the scene. |
| **R08 Anchored occupation — alley, corner, rooftop** | Plants, laundry, signs, tanks and utility fixtures each have a physical support and use relationship. The clear route remains measurable after dressing. | B01/B03/B04/B05: repetition and empty ground are not acceptable substitutes for specific, connected everyday use. |

### Baseline capture index

| Baseline | Classification and observed failure | Primary regression |
|---|---|---|
| `baseline-2026-11-03/01.png` | **VB anti-reference:** miniature-like repeated blocks, sparse open ground, weak facade/curb resolution and flat distant read. | R01, R02, R04, R07, R08 |
| `baseline-2026-11-03/02.png` | **VB anti-reference:** a huge circular wire formation and dense overhead geometry overpower the street; connected service logic is not visible. | R05, R07 |
| `baseline-2026-11-03/03.png` | **VB anti-reference:** oversized empty alley/ground, miniature-like openings and repeated facade treatment. | R01, R02, R03, R08 |
| `baseline-2026-11-03/04.png` | **VB anti-reference:** repeated salmon-colored blocks, uniform facade rhythm and little readable infrastructure or use. | R01, R03, R04, R07, R08 |
| `baseline-2026-11-03/05.png` | **VB anti-reference:** expansive sparse ground and detached-looking blocks do not communicate a connected alley/stair/roof community. | R01, R02, R06, R07, R08 |

## 6. Source index

All web sources below were publicly accessible without payment and checked on **2026-11-03**. License terms apply to the referenced source media. No new external images or textures are copied into the repository by this research update. If source media is later adapted, preserve the applicable attribution/share-alike notices and record the adaptation.

| ID | Provenance | License / permitted research role |
|---|---|---|
| **Y01–Y04** | YouTube Shorts URLs in section 3; on-screen `@JulioPistolada` watermark; original publication dates not verified. Local browser-frame captures already retained in this directory. | Publicly viewable; creator rights reserved. Internal visual study only; do not use frames, logos or watermarks as map textures. |
| **C01** | Daytours4u, *Favela da Rocinha - telhados*, photographed 2013-06-08. [Wikimedia Commons file page](https://commons.wikimedia.org/wiki/File:Favela_da_Rocinha_-_telhados.jpg); source links to Flickr. | **CC BY 2.0**, confirmed on the Commons page. Roof/tank/addition reference. |
| **C02** | Wilfredor, *Recife Favela Detran street*, photographed 2019-12-26; identified as Iputinga, Recife. [Wikimedia Commons file page](https://commons.wikimedia.org/wiki/File:Recife_Favela_Detran_street.jpg). | **CC0 1.0**. Street scale, frontage, vehicle and infrastructure reference; not a paved-curb detail source. |
| **C03** | Alicia Nijdam, *Rocinha*, photographed 2008-03-21. [Wikimedia Commons file page](https://commons.wikimedia.org/wiki/File:Alicia_Nijdam-rocinha.jpg); source links to Flickr. | **CC BY 2.0**, confirmed on the Commons page. Utility, opening and occupied-facade reference. |
| **C04** | chensiyuan, *Inside Rocinha favela, Rio de Janeiro, Brazil, 2010*. [Wikimedia Commons file page](https://commons.wikimedia.org/wiki/File:1_rocinha_favela_closeup.JPG). | Multi-licensed; this matrix cites the **CC BY-SA 4.0** option. Construction-state, facade, tank and dense-skyline reference. |
| **C05** | Adam Jones, *View over Complexo do Alemão … from Igreja da Penha*, photographed 2015-05-10 at 17:10. [Wikimedia Commons file page](https://commons.wikimedia.org/wiki/File:View_over_Complexo_do_Alemao_(Favela)_-_From_Igreja_da_Penha_-_Rio_de_Janeiro_-_Brazil_-_02_(17557053655).jpg); source links to Flickr. | **CC BY-SA 2.0**, confirmed on the Commons page. Human cadence on stairs and distance/atmosphere reference only. |
| **C06** | Carlos Luis M C da Cruz, *Complexo da Maré*, photographed 2010-04-09. [Wikimedia Commons file page](https://commons.wikimedia.org/wiki/File:Complexo_mare.JPG). | Released to the **public domain** by the author. Dense skyline and small-variation reference. |
| **C07** | Wilfredor, *Rio de Janeiro Favela, Rio de Janeiro State, Brazil 01*, photographed 2023-09-16; Commons categorizes the image under Maré. [Wikimedia Commons file page](https://commons.wikimedia.org/wiki/File:Rio_de_Janeiro_Favela,_Rio_de_Janeiro_State,_Brazil_01.jpg). | **CC0 1.0**. Vegetation, landform, skyline layering and atmospheric-depth reference. |
| **N01** | ABNT NBR 9050:2015, **Emenda 1:2020**, *Acessibilidade a edificações, mobiliário, espaços e equipamentos urbanos*. [Public municipal host, Prefeitura de Canoas](https://www.canoas.rs.gov.br/wp-content/uploads/2020/07/norma-abnt-NBR-9050-2015-emenda-1-2020.pdf). Sections cited above. | **© ABNT; all rights reserved.** Publicly readable normative citation only; do not redistribute the PDF as an asset. Used for calibration, not certification. |
| **N02** | Fortlev, *Catálogo Técnico — Tanque Fortlev*, dated July 2023. [Manufacturer PDF](https://www.fortlev.com.br/wp-content/uploads/2020/01/Manual-Catalogo-Tecnico-Tanque-Fortlev.pdf), especially pp. 4–7. | Manufacturer technical documentation; factual product dimensions/installation relationships cited. No product imagery is redistributed. |
| **B01** | Current Lajes owner-camera captures, five images in `baseline-2026-11-03/`, inspected 2026-11-03. Legacy performance baseline and earlier reference IDs remain in `legacy-references-manifest.json`. | Project-local baseline/anti-reference evidence. Not an external visual source. |

## 7. Explicit gaps and non-claims

- **Place and period are unresolved.** Rio and Recife photographs from 2008–2023 plus gameplay are intentionally triangulated. Lajes is a fictional composite; no source proves that one selected street, facade or skyline belongs to the final setting.
- **No measured survey exists.** Orthographic elevations, calibrated curbs/stairs/openings, wall thicknesses and roof structures are still needed for real-world dimensional claims. Current numerical values are only shared contract, explicit assumptions, normative calibration or product documentation.
- **Ground-junction closeups are weak.** C02 shows an unpaved street; the gameplay frames are not reliable construction records. A real paved Brazilian corner with curb ramp, gutter, threshold and drainage detail remains the highest-priority visual gap.
- **Rooftop access and services need closer evidence.** Existing photographs support tanks/roof occupation, but not a complete stair-to-parapet junction or a fully traceable tank installation. N02 covers the selected tank, not structural slab capacity or the whole plumbing design.
- **Commerce is under-documented photographically.** Shop composition currently relies substantially on gameplay. Legible, rights-cleared Brazilian shopfront/signage photographs and original PT-BR sign designs remain open.
- **Vegetation is not botanically specified.** No exact native/local species, planting date or maintenance regime is claimed. Final assets need a deliberate species/style selection or an explicit generic-vegetation decision.
- **Atmosphere is an art target, not climate reconstruction.** Exact city, season, time, cloud coverage, sun azimuth and pollution/humidity conditions are unchosen. The current requirement is depth readability and a seamless sky, not meteorological accuracy.
- **Gameplay references remain secondary.** Their geometry, rendering, weapons and HUD may distort scale and materials. They cannot validate historical use, engineering, electrical safety or dimensions.
- **No structural, electrical, accessibility or gameplay-balance approval is implied.** Traversal, sightlines, collision and navigation still require separate implementation checks; no paid service was used for this research.
