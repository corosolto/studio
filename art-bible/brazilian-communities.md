# Lajes direction — one terrace, built over time

## Intent and status

Build a specific, inhabited Brazilian community rather than use “favela” as a collection of brick, wires, tanks and wear. This document directs only the connected vertical slice: alley, commercial corner and stair-accessible rooftop. It is a constructible art premise, not research clearance, a claim about a real community, runtime promotion or a declaration of the owner's visual target.

The machine-readable metric source of truth is `kits/lajes-architecture.v1.json`. The composition diagram is `maps/lajes/concepts/lajes-vertical-slice-callouts.svg`; it is not an as-built coordinate survey. Dimensions below agree with the JSON's conceptual constructible layout. For loop-02 integration, `maps/lajes/gauntlet/evidence/loop-02/cameras.json` is the authoritative camera export and the JSON mirrors it as the candidate contract; owner review remains pending.

## Place premise

**Fictional Morro das Lajes, North Zone Rio de Janeiro.** A northwest-facing hillside has been occupied as masonry terraces. This slice sits on one near-level terrace: the alley runs along it, while the two-storey stair and three receding roof bands communicate the hill. Do not flatten the skyline into generic city blocks or make the playable alley implausibly steep.

It is a humid tropical summer afternoon, 16:20 shortly after rain. Northwest sun at 32° elevation gives warm direct light and cool open shade. Dampness remains in the gutter, open drain and two shallow alley depressions; the rest is drying. The sky is blue-gray with light warm distance haze and must remain stable at zenith.

The place, dates and business are fictional. Construction history explains geometry:

| Phase | Narrative period | Architectural consequence |
|---|---|---|
| P0 unfinished | continuing work | Exposed concrete frame and bounded ceramic masonry, never uniform “ruin.” |
| P1 original rooms | 1975–1990 | One-storey load-bearing masonry, practical openings and barred ground-floor windows. |
| P2 vertical addition | 1990–2010 | A 3.30 m upper floor, concrete roof, occasional setback and visible construction seam. |
| P3 finishing campaign | 2010–2020 | Large warm/sage plaster and paint fields; old material remains at returns and repairs. |
| P4 current commercial use | present | Grocery opening, shutter, awning, service meter and one painted sign inserted into the ground floor. |

These are storytelling phases, not unresearched historical assertions about a named settlement.

## Reference use

Use only categories already established in `maps/lajes/research/reference-matrix.md` and the legacy manifest: openings/circulation; street, poles, wiring and sidewalks; alley depth and junctions; rolling doors, bars, sills and tanks; rooftop extensions; height variation and masonry; hillside layers and skyline; localized plaster damage; directional light and trim shadows. The JSON maps these categories to kit decisions.

This direction does **not** claim to have reviewed frames, extracted measurements from photographs or completed the research agent's work. Research must still test the premise against identifiable physical scale and local construction detail.

## Metric contract and assembly

- 1 Blender unit = 1 m; Z up, +X east, +Y north. Origin is the west plot's southwest corner at finished sidewalk Z=0.
- Player eye = ground +1.65 m. Ordinary clear doors = 0.90 × 2.10 m. Floor-to-floor = 3.30 m.
- Structural grid = 1.20 m; facade panels increment in 0.60 m. Walls = 0.15 m; slabs = 0.18 m; columns = 0.20 × 0.20 m.
- Street asphalt top Z=−0.15 m. Sidewalk is 1.80 m clear, top Z=0, 1.5% fall to street; curb is 0.15 m high in 0.90 m segments.
- West corner plot occupies X=0–7.40, Y=0–8.40, Z=0–6.60. East plot occupies X=9.80–16.40, Y=0–12.60 with a rear upper setback.
- Alley finished wall faces are X=7.40 and 9.80: **2.40 m clear**, 14.40 m long and level on this terrace. Crossfall is 1.5% to a 0.18 m drain at the east edge; 2.18 m remains walkable.
- The accessible roof is at Z=6.60 with 1.10 m parapets. “Accessible” means player-traversable by stairs, not step-free or universally accessible.

Module pivots are bottom center, fronts face local −Y. Join facade panels on bay lines; avoid coplanar overlaps. Assembly bounds, opening schedules and route waypoints are explicit in the JSON.

## Facades, openings and resolved junctions

Use three large facade color fields at most per elevation. A phase change must coincide with a structural seam, addition or use change—not random color noise. Do not repeat one phase for more than two adjacent bays without such a reason.

- Room window: 1.20 × 1.20 m clear, sill 0.95 m above finished floor, 0.10 m recess.
- Bathroom window: 0.60 × 0.60 m clear, sill 1.80 m, 0.08 m recess and frosted pane.
- Ground-floor room windows may have 12 mm bars at ≤0.14 m spacing, projecting 0.045 m.
- Leave ≥0.45 m solid between openings and at corner returns. Lintels are 0.20 m deep.
- Sills project 0.07 m, are 0.045 m thick and slope outward 8%.
- Dark room recesses are geometry. Do not fill every opening with identical reflective blue glass.

Plaster is 0.015 m thick and ends with a physical lip at exposed masonry. The slab/parapet overlap is 0.075 m; coping overhangs 0.03 m and includes a 0.012 m drip recess. Walls meet floors and sidewalk without floating gaps. Grocery interiors have an 0.08 m base band. Expose a 0.20 m column or 0.025 m seam where an addition meets original masonry.

## Palette and material families

Hex values are sRGB; convert to scene-linear in Blender. Keep color in broad fields and roughness differences restrained.

| Family | Use | sRGB | Roughness | Metallic |
|---|---|---:|---:|---:|
| Warm painted plaster | main west facade, parapet | `#D7C7A8` | 0.86 | 0 |
| Sage painted plaster | upper/addition field | `#8FAE9E` | 0.84 | 0 |
| Ochre painted plaster | bounded secondary field | `#C58D55` | 0.85 | 0 |
| Exposed ceramic | original masonry and one repair | `#9E513B` | 0.92 | 0 |
| Structural concrete | frame, slabs, plinths | `#8C867A` | 0.88 | 0 |
| Sidewalk concrete | 0.60 m pavers | `#9A9386` | 0.92 | 0 |
| Worn asphalt | street only | `#484944` | 0.96 | 0 |
| Painted steel | frames and shutter | `#B8B19D` | 0.58 | 0.35 |
| Teal sign paint | grocery identity | `#1E6663` | 0.65 | 0 |
| Cream lettering | grocery lettering | `#F1E3C2` | 0.70 | 0 |
| Blue polyethylene | two water tanks | `#246C9B` | 0.48 | 0 |
| Fiber cement | awning and sparse roof sheets | `#636C6B` | 0.90 | 0 |
| Dark interior recess | open rooms | `#252C2B` | 0.82 | 0 |

The complete family set, including mortar, damp concrete, grates, timber and frosted glass, is in the JSON.

## Stair, roof and water system

The stair door is in the west alley wall at Y=2.30–3.20. Four U-shaped flights each have **10 risers × 0.165 m**, **0.30 m treads**, 2.70 m run and 1.20 m clear width. Landing depth is 1.20 m; landing levels are 1.65, 3.30, 4.95 and 6.60 m. Maintain 2.10 m headroom and a continuous 0.92 m handrail. The route is explicit from spawn to roof in `route_waypoints_m`.

Two intentional, identical 1000 L tanks represent added household capacity. Each tapered tank is 1.47 m upper diameter, 1.29 m lower diameter and 0.80 m total height on a full, level 1.55 × 1.55 × 0.20 m plinth. Place centers at (1.45, 6.90) and (4.15, 6.90). Reserve 0.60 m service perimeter around each tank, producing 2.67 × 2.67 m service envelopes; keep the stair headhouse and props outside them. A 32 mm feed branches to both; 40 mm overflows join a real downpipe; 25 mm distribution serves the dwelling. Pipe clips are ≤1.20 m apart. Tanks must read as utilities, never miniature rooftop houses. These dimensions and supports are art-direction calibration, not structural certification.

Protect every open roof edge with a 1.10 m parapet and coping. Keep ≥35% of the rooftop camera as readable sky. Three background terrace bands at successively higher levels provide the hillside silhouette; vary setbacks and leave gaps rather than cloning tanks across every roof.

## Connected infrastructure

One 7.80 m concrete pole sits at (7.95, −1.30), preserving a 1.20 m sidewalk clear zone. Street feed terminates at the pole; individual west and east service drops terminate at facade brackets; one low-voltage line continues to a roof junction. Every cable has named endpoints, support and sag. A quadratic Bezier approximation is acceptable: lower the chord midpoint by the specified sag and the control midpoint by twice that amount.

Show no more than three spans crossing the alley camera. Use a 55 mm three-cable street bundle and 12–16 mm service cables. Brackets have 0.12 m stand-offs and visible fasteners. No free ends, straight webs or decorative wires without a network role.

## Commercial corner

**MERCEARIA IRMÃOS REIS** is a family-run daily-needs grocery. Its use explains the 3.00 × 2.40 m rolling opening, separate 0.90 × 2.10 m entrance, 3.90 m wide supported fiber-cement awning and one 3.60 × 0.55 m teal/cream sign. Secondary text is only “PÃO • LEITE • GELO.”

One 0.45 × 0.65 m price board sits inside a jamb; one 0.60 × 0.40 × 0.75 m crate stack may sit wholly inside the threshold. Neither enters the 1.20 m sidewalk clear zone. No neon collage, competing signs or merchandise scatter.

## Localized wear, not global noise

- Ground-contact wear covers ≤18% of a wall; upper-facade wear ≤6%.
- Rising damp is 0.15–0.45 m high; only the shaded drain zone may reach 0.60 m, within 0.45 m of the channel.
- Corner chips occur below 0.80 m and within 0.25 m of an exposed corner.
- Allow one exposed-brick hero patch per elevation, ≤0.90 × 1.40 m. Hero plaster loss is 0.015–0.04 m deep.
- Water streaks start only below coping joints, overflows or drip edges: 0.03–0.12 m wide, 0.25–0.90 m long, at most three families per facade.
- Dust lightens upward coping/sill faces by only 10–20%. Do not apply a uniform peeling, dirt or wet coating.

## Composition and director camera revision

### Conceptual composition cameras — not integration poses

These original poses belong only to the conceptual metric layout above. Loop-02 geometry uses a different coordinate layout; applying this table there can place cameras inside solids.

| Conceptual camera | Position (m) | Target (m) | Lens | Intended composition |
|---|---|---|---:|---|
| `spawn` | (−3.60, −0.90, 1.65) | (4.00, 3.00, 2.50) | 24 mm | Shop threshold, turn into alley, upper addition. |
| `alley` | (8.60, 1.00, 1.65) | (8.60, 12.00, 2.40) | 25 mm | Two phases, walking line, drain, stair door, supported wires. |
| `corner` | (−4.20, −4.00, 1.65) | (3.40, 0.60, 2.35) | 28 mm | Curb–sidewalk–facade junction and inhabited grocery. |
| `rooftop` | (2.00, 4.00, 8.25) | (7.00, 13.50, 8.00) | 24 mm | Parapet, paired tanks, stair arrival, terrace skyline. |
| `sky` | (2.00, 4.00, 8.25) | (2.00, 4.00, 20.00) | 24 mm | Undistorted zenith with only a low architectural anchor. |

### Candidate loop-02 fixed-camera contract — owner review pending

The director integration revision adopts the actual export at `maps/lajes/gauntlet/evidence/loop-02/cameras.json` as the **candidate** loop-02 set. Fixed order is `spawn`, `alley`, `corner`, `rooftop`, `sky`; output is 1600 × 1000 px. This is not an owner approval.

| Camera / Blender object | Location (m) | Target (m) | Lens | Declared spawn |
|---|---|---|---:|---|
| `spawn` / `CAM_spawn` | (0.0, −4.0, 1.6699999570846558) | (0.0, 3.0, 1.85) | 24 mm | `spawn`; eye +1.65 m |
| `alley` / `CAM_alley` | (0.75, −2.5, 1.649999976158142) | (−2.5, 9.2, 3.05) | 22 mm | none |
| `corner` / `CAM_corner` | (8.800000190734863, −8.0, 1.5199999809265137) | (4.5, −4.4, 2.25) | 22 mm | `corner`; eye +1.65 m |
| `rooftop` / `CAM_rooftop` | (−2.950000047683716, 12.5, 8.649999618530273) | (−4.75, 1.2, 6.55) | 22 mm | none |
| `sky` / `CAM_sky` | (−4.699999809265137, 5.400000095367432, 7.75) | (−4.7, 5.4, 50.0) | 18 mm | none |

Every candidate uses a 36 mm sensor and clip `[0.05000000074505806, 250.0]` m. The JSON revision preserves the export's exact XYZ Euler radians, WXYZ quaternions, purposes and preview paths. Coordinates are Blender metres/Z-up. The SVG displays rounded candidate values for composition reading only; the evidence export remains authoritative.

## Low/med identity budgets

The slice caps are **med: 100,000 triangles / 90 calls**, **low: 32,000 triangles / 40 calls**. Category caps are in the JSON and are authoring limits, not measured performance.

Low retains the 2.40 m alley, 3.30 m storey rhythm, opening positions/recesses, three facade color fields, grocery opening and readable sign, curb/sidewalk edge, 1.10 m parapets, two tanks and plinths, supported cable sag, complete stair/collision and three skyline bands. Remove brick relief outside the hero patch, tiny chips/bevels, clips/ties, shutter slat microgeometry, small secondary lettering, tank ribs/fasteners and distant bars first. Never spend the identity budget on noise.

## Measurable anti-miniature and anti-clutter gate

1. Doors, 3.30 m storeys, 0.165/0.30 m stairs, 1.47/1.29 m tapered tanks, 3.60 m sign and 0.15 m curb remain metric scale witnesses; never independently rescale architecture to fit a camera.
2. Keep 1.20 m navigation clearance and the 1.20 m sidewalk zone free of props.
3. No miniature houses, monolithic roof props, broken vehicles or unsupported geometry.
4. Maximum three alley-crossing wire spans, one junction box per drop, one shop price board and one crate stack.
5. Color patches are ≥2.40 × 2.40 m; at most three base facade colors per elevation and one exposed-brick patch.
6. Every prop has use, support and owner. Variation follows construction phase or use; never random scale, rotation or scatter.
7. Reject identical blue-glass grids, generic red-dirt courtyards, uniform peeling, free wire ends and tank grids on background roofs.

## Authoring order and limitations

Author route/collision and ground sections first; then structural masses and openings; then stair/roof/water; then commerce and connected services; then localized wear; finally capture all five cameras at med and low. Preserve rejected attempts and record changes against the same cameras.

Limitations: this is one occupied terrace, not a full hillside drainage or circulation solution; the exact place/history/signage are fictional; reference categories still require research validation; no physical-device or runtime benchmark is claimed; stair access is not universal accessibility; loop-02 cameras are candidates with owner review pending; concepts alone cannot pass a production gate or establish the owner's target.
