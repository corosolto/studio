# Studio tools

## Setup

```bash
npm ci
npm run check
```

Use Node.js 22.12 or newer. Blender is required only by Python authoring recipes. Setup and checks never call paid generation APIs.

## Public boundary

The public repository must not contain `.blend`, `.blend1`, `.glb`, `.fbx`, `.mdl` or `.unitypackage` files. Editable sources and licensed packs belong to the private `corosolto/studio-assets` repository.

## Local workspace

`public/` is a Git-ignored workspace for locally prepared optimizer inputs and outputs. Canonical editable sources remain in the private asset repository. Files in `public/` are not releases, and this repository does not ship public Lajes model binaries. Approved outputs are promoted to immutable private packs before any separate client integration.

## Commands

```bash
# Structure, JSON, public asset boundary, tool syntax, and the synthetic character pack
# and concept prompt contracts (tools/checks/character-*-check.mjs)
npm run check

# Source contracts without API calls
npm run check:asset-gen
npm run check:pistol-source

# Valid-package, builder and mutant smoke tests (synthetic fixtures only)
npm run smoke:pack

# Validate schema, declarations, safe paths, byte size and SHA-256 for a package
node tools/validate-pack.mjs path/manifest.json path/package-root

# Validate a private Lajes scene report and its five fixed-camera images
node tools/validate-lajes-gauntlet.mjs \
  /path/to/private/maps/lajes/build/vertical-slice/scene-report.json \
  /path/to/private/maps/lajes/build/vertical-slice

# Validate the accepted public loop explicitly (no loop is implied by default)
node tools/validate-lajes-gauntlet.mjs \
  /path/to/private/maps/lajes/build/vertical-slice/scene-report.json \
  /path/to/private/maps/lajes/build/vertical-slice \
  --evidence-root maps/lajes/gauntlet/evidence/loop-02

# Build map/lajes/0.1.0 into an absent directory outside this public worktree
node tools/build-lajes-pack.mjs \
  --staging /path/to/private/maps/lajes/build/vertical-slice \
  --output /path/to/private/candidates/map/lajes/0.1.0 \
  --revision <private-source-revision> \
  --provenance "Authored metric Blender vertical slice" \
  --provenance "Private staging bytes hashed locally"

# Generate LODs after preparing the local workspace
node tools/optimize-lajes-cc0-lod.mjs

# Derive the third-person AK with explicit inputs
node tools/viewmodels/derivar-ak-3p.mjs \
  --de=/path/to/private/models/viewmodels/coro/ak-hires.glb \
  --original=/path/to/private/models/weapons/ak.glb \
  --para=/path/to/private/models/weapons/ak_b.glb
```

### Lajes staging and candidate contract

The builder inventories only real regular files under the supplied private staging directory. It requires non-empty `geometry/`, `textures/`, `collision/`, `navigation/`, `spawns/`, `regions/` and `previews/` inventories, plus a `low` LOD under `lods/` (for example, `lods/low/...` or `lods/scene-low.glb`). Other LOD profiles are inferred deterministically from directory or file names. `scene-report.json`, generated `*-manifest.json` sidecars and otherwise unclassified files are declared as evidence, so every packaged file has exactly one role and one hash entry. Symlinks, executable JavaScript, missing inventories and empty files are rejected; content is never synthesized.

The builder runs the Lajes gauntlet before copying. The report must declare metre units, Z up, eye height 1.65 m, the `spawn`, `alley`, `corner`, `rooftop` and `sky` cameras, an upward zenith sky view, connected alley and stair-accessible rooftop routes with at least 1.20 m clear width, clear doors, stairs with at least 1.20 m clear width, a resolved commercial corner, a parapet of at least 1.10 m, exactly two water tanks with the west tank service-clearance assertion, and skyline facts. Every camera needs a distinct, existing package-relative PNG, JPEG or WebP, and its capture record must match the image byte size and SHA-256. By default these bytes come from private staging `previews/`; `--evidence-root` instead resolves each capture's distinct `public_evidence` path under the explicitly selected accepted loop directory. `low_captures` is mandatory for the same five camera IDs, requires distinct medium/low paths, and is verified in both locations. `route_sequence` must match `previews/route-sequence.json` and contain six ordered route frames; every route image is verified by byte size and SHA-256 in private staging and the explicit public root. The synthetic shape is in `maps/lajes/gauntlet/fixtures/scene-report.valid.json`; it is test input, not visual approval evidence.

The gauntlet reads `collision/collision-boxes.json`, `navigation/nav-graph.json`, `spawns/spawns.json` and `regions/regions.json` directly. It samples every actual graph segment against collision AABBs expanded by the declared agent radius, applies step height and a 2.10 m body/head envelope, treats authored flight-riser boxes as walkable stairs while retaining all other obstacles, traverses the real spawn-to-roof graph, checks spawn obstruction and region membership, and aligns spawn/corner cameras with their declared spawn eye positions. It parses GLB JSON and BIN chunks to validate bufferView/accessor ranges and strides, finite POSITION floats and every index, then matches measured counts with `lods/export-validation.json`. Medium is limited to 90 primitives/100000 triangles and low to 40 primitives/32000 triangles; low must have strictly fewer triangles. These deterministic checks do not certify runtime physics, rendering, performance, free roam, floor support or full corridor-width clearance.

The output directory must be absent and outside the public Studio worktree. Files are copied into a sibling temporary directory, the manifest is renamed into place, all copied bytes are validated, and only then is the complete candidate directory renamed to the requested output. A candidate is not owner-approved, runtime-promoted or deployed.

The smoke suite rejects missing rooftop routes and cameras, absent/incomplete low captures, missing or hash-mutated route images, route-sidecar divergence, spawn/corner camera mismatches, spawns outside regions, unsafe preview paths, bad doors and stairs, narrow routes, low parapets, missing tank clearance, absent or non-shrinking LODs, primitive/triangle-budget overflows, GLB/report/sidecar mismatches, non-finite positions, out-of-bounds indices, solid-wall route blockage, insufficient 2.10 m head clearance, crate-obstructed spawns, missing declarations, duplicate and unsafe paths, undeclared files, executable JavaScript and shebangs, hash/size mutations and existing output directories. It also checks schema v1 compatibility for kinds without a role contract, rejects a character manifest without character roles, and checks that failed builds expose no candidate directory.

`tools/gen-asset.mjs`, `gen-image.mjs` and `gen-character-concept-openrouter.mjs` can consume paid quota and require credentials. They are excluded from smoke checks and require explicit authorization. `--dry-run` of the concept tool prints its preflight without reading credentials.

### Character pack contract

`node tools/validate-pack.mjs` applies the character contract in [docs/character-pack.md](../docs/character-pack.md) to `kind: "character"` manifests: meshy-28 skin, triangle and byte budgets, one clip per state named after it, image previews and rights. `gen-character-concept-openrouter.mjs --ficha <json>` composes the concept prompt from a character sheet; `openai/gpt-image-*` models use OpenRouter's Images API.

## Check ownership

- Authoring and pack checks belong to this repository.
- Runtime and integration checks remain in the client.
- Studio checks validate sources, packs, provenance and evidence.
- Client checks validate navigation, collision, rendering and gameplay behavior.
