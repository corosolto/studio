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

`public/` is a Git-ignored workspace. Copy published client inputs there while preserving relative paths. Canonical editable sources remain in the private asset repository. Approved outputs are promoted to immutable packs; files in `public/` are not automatically releases.

Example input for the Lajes optimizer:

```text
public/models/props/lajes_facades_cc0.glb
```

The tool generates `public/models/props/lajes_facades_cc0_lod.glb` without modifying the original.

## Commands

```bash
# Structure, JSON, public asset boundary and tool syntax
npm run check

# Source contracts without API calls
npm run check:asset-gen
npm run check:pistol-source

# Valid-package and hash-mutant smoke tests
npm run smoke:pack

# Validate schema, byte size and SHA-256 for a package
node tools/validate-pack.mjs path/manifest.json path/package-root

# Generate LODs after preparing the local workspace
node tools/optimize-lajes-cc0-lod.mjs

# Derive the third-person AK with explicit inputs
node tools/viewmodels/derivar-ak-3p.mjs \
  --de=public/models/viewmodels/coro/ak-hires.glb \
  --original=public/models/weapons/ak.glb \
  --para=public/models/weapons/ak_b.glb
```

`tools/gen-asset.mjs`, `gen-image.mjs` and `gen-character-concept-openrouter.mjs` can consume paid quota and require credentials. They are excluded from smoke checks and require explicit authorization.

## Check ownership

- Authoring and pack checks belong to this repository.
- Runtime and integration checks remain in the client.
- Studio checks validate sources, packs, provenance and evidence.
- Client checks validate navigation, collision, rendering and gameplay behavior.
