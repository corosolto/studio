# Lajes Studio continuation — 2026-11-03

## Operation

- Branch: `feat/lajes-studio-loop-20261103`.
- Main checkout is untouched; no merge, deployment, paid generation or public binary assets are authorized.
- The owner's 8/9 target remains unclaimed pending integrated-game owner review.

## Current milestone

Research and art direction are substantially advanced, with an evidence-backed source matrix, a constructible metric kit and the `loop-02-director-integration` candidate camera contract. The actual editable Blender slice now includes the connected alley/commercial corner, four-flight 6.60 m rooftop route, 1.10 m parapets, paired supported tanks, corrected grocery frontage, medium/low exports and fixed/route evidence. Independent loop-01 rejection and loop-02 re-reviews are preserved; remaining explicit deviations are the 4.60 m alley versus the 2.40 m kit target and the non-route east roof at 4.20 m versus 6.60 m. Final public verification passes structure/public-boundary checks, asset-generation contracts and mutant, pistol-source contract with the explicit client root, 60+ pack/gauntlet negative cases, and the real loop-02 gauntlet: 131 collision AABBs, 17 navigation edges, 3 spawn/region checks, medium 53 primitives/16,268 triangles and low 21/3,444. Static evidence is not runtime physics, free-roam, performance or owner approval. Candidate packaging is authorized only as an unapproved owner-review candidate by the final independent review; no 8/9 claim.

## Shared vertical-slice contract

- One Blender unit is one metre; Z is up; glTF export converts to the client's Y-up convention.
- Player eye height is 1.65 m; ordinary clear door openings are 0.90 x 2.10 m; exterior stair risers are at most 0.175 m with at least 0.28 m treads.
- The slice contains a traversable alley, a commercial corner with a resolved curb/sidewalk/facade junction, and an accessible rooftop with stairs, parapets, water tanks and a coherent skyline.
- Fixed cameras cover spawn/first read, alley, commercial corner, rooftop and sky/zenith. A circulation manifest records the walkable route.
- Private staging output is `maps/lajes/build/vertical-slice/` in `studio-assets`; editable source is `maps/lajes/source/lajes-vertical-slice.blend`.
- The private package must include geometry, textures, required LODs, collision, navigation, spawns and previews before client promotion.

## Slice ownership

- Research: `maps/lajes/research/` only.
- Art direction and metric kit: `art-bible/`, `kits/`, and `maps/lajes/concepts/` only.
- Blender: private `tools/blender/lajes_vertical_slice.py`, private `maps/lajes/source/`, and private `maps/lajes/build/vertical-slice/` only.
- Tooling: public `tools/`, `schemas/asset-pack.schema.json`, `maps/lajes/gauntlet/`, `releases/`, and `docs/INTEGRATION.md` only.
- Coordinator: `CONTINUATION.md`, integration fixes and final verification.

## Verification and release state

Final verification passed: Studio structure and public asset boundary, source contracts, PBR mutant rejection, pack/gauntlet positive and negative fixtures, and actual loop-02 images, GLBs, collision, navigation, spawns and regions. The pistol-source check requires `CORO_CLIENT_ROOT=/Volumes/Zenith/Projects/game/corosolto/csbrasil/client`; it passes with that explicit existing client root.

The genuine private candidate is `map/lajes/0.1.0`, source revision `892b54f4c57d3ffaed46b11182fc03d529515873`, with 98 hashed files and manifest SHA-256 `5f95943ad9fae20b2fd1322b48c71eced94978e83ae3ad05b74c7a048e33890d`. Schema, byte sizes and hashes were validated. It remains an unapproved owner-review candidate, not a published or runtime-promoted release. No 8/9 claim.
