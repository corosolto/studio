# Lajes loop-02 independent candidate review

## Identity and verdict

- Authoring slice: `BlenderVerticalSlice`, Blender 5.2.0 LTS, seed 12061103.
- Independent reviewer: `IndependentSliceReview` (`reviewer` agent), with no authoring edits or test execution.
- Candidate: `map/lajes/0.1.0`, loop-02; fixed images are 1600 x 1000 using Blender Eevee.
- Verdict: **honest to package as an unapproved owner-review candidate**. No critical or major static-geometry, evidence, packaging-budget or tooling blocker remained in the final review.
- Status limits: owner review pending; no runtime promotion, production approval or 8/9 claim.

## Re-review evidence

- The 1.50 m court opening, four 10-riser flights, landings and roof arrival are visible in route frames and agree with collision/navigation data. The corner spawn is inside `commercial_corner`.
- Medium and low corner captures show the teal `MERCEARIA IRMÃOS REIS` sign and `PÃO • LEITE • GELO`. Reported sign, opening, curb and sidewalk dimensions agree with the metric kit. One crate remains inside the threshold and the public walkway is clear.
- Both tanks occupy the accessible west roof on 1.55 m full-level plinths. The west roof is 6.60 m with 1.10 m parapets and preserved tank/route clearance.
- The sky camera looks directly +Z with identical camera/target X and Y. Medium and low images exercise the polar view.
- Medium GLB has 53 primitives and 16,268 triangles; low has 21 primitives and 3,444 triangles. Deep validation reads GLB BIN chunks, bufferViews, finite POSITION values and every index; the export sidecar matches measured counts.
- Mandatory medium/low captures, six route images and hashes, spawn-region membership, spawn-camera alignment, 2.10 m head clearance and triangle budgets are integrated into the reusable gauntlet.

## Gate disposition

| Gate | Final candidate status |
|---|---|
| R01 Human scale | Static pass; wider alley explicitly declared as a deviation. |
| R02/R03 Ground and alley continuity | Static pass; genuine opening and court/stair sequence evidenced. |
| R04 Commercial corner | Candidate pass; identity, dimensions and walkway corrections visible and machine-readable. |
| R05 Utilities | Visual candidate pass only; endpoint/network correctness not independently runtime-verified. |
| R06 Accessible occupied roof | Static pass for modeled stairs, arrival, parapets, tanks and clearance. |
| R07 Sky and skyline | Zenith requirement passes; skyline richness remains an owner-art-review matter. |
| R08 Anchored occupation | Suitable for an owner-review blockout; material and occupation polish remain. |
| LOD authoring | Static pass for primitive/triangle budgets, deep GLB validation and medium/low identity. |
| Free roam, runtime and owner approval | Not passed or claimed. |

## Explicit deviations and polish

1. Alley clear width is 4.60 m versus the conceptual 2.40 m kit target. The owner must accept or reject it.
2. The non-route east context roof is Z=4.20 m versus the conceptual 6.60 m value.
3. Faint vertical sky banding/streaking remains visible, especially in the low zenith capture. It is not classified as a proven hard seam or polar pinch; full-resolution owner inspection is required.
4. Procedural 256 px textures, uniform masonry, sparse occupation and simplified background terraces remain blockout-level polish.

The candidate camera mirror was synchronized to the authoritative loop-02 export after review. The SVG remains a composition diagram, not an as-built coordinate survey.

## Verification and remaining limits

The coordinator exercised the official checks after implementation: public structure/private-extension boundary, source contracts and PBR mutant, pack/gauntlet positive and negative fixtures, and the actual loop-02 report/images/GLBs/collision/navigation/spawns/regions. The real gauntlet reported 131 collision AABBs, 17 navigation edges, three spawns, medium 53 primitives/16,268 triangles and low 21/3,444.

The package still does not establish cooked physics, an engine navmesh, actual client traversal, step-offset behavior, runtime spawn safety, free-roam review, runtime draw calls, FPS, memory use, physical-device performance, final utility/structural/electrical/accessibility approval, or owner acceptance. The six route images are Blender camera poses, not free-roam movement.
