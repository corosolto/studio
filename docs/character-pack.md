# Character pack contract

One pack per character: `kind: "character"`, `id` equal to the character id, semver `version`. The pilot pack is `capitao-caveira`. Packs are built from private sources in `corosolto/studio-assets`; this public repository holds only the schema, the validator and synthetic fixtures.

## Manifest

On top of the common fields (`schemaVersion`, `kind`, `id`, `version`, `source`, `files`), `schemas/asset-pack.schema.json` requires for characters:

| Field | Contract |
| --- | --- |
| `model` | One package path ending in `.glb`: the rigged, skinned character. |
| `skeleton` | `"meshy-28"` (see below). |
| `animations` | Object keyed by state. Required: `idle`, `walk`, `run`, `shoot`, `death`, `crouch`, `crouchwalk`, `jump`. Optional: `idle1h`, `walk1h`, `walkfire`. No other keys. Each value is a distinct `.glb` path. |
| `previews` | At least one portrait image path (`.png`, `.jpg`, `.jpeg` or `.webp`). |
| `rights` | `{ "status": "original" \| "public-domain" \| "political-satire", "basis": "<why this is clear>", "references": ["<citation>", ...] }`; `references` is optional. |
| `budgets` | `{ "triangles": <int ≤ 15000>, "bytes": <int ≤ 16777216> }`. `triangles` bounds the model; `bytes` bounds the sum of every `files[].bytes`. |
| `evidence` | Optional extra paths (for example a provenance sidecar). |

Every file in `files` must be declared by exactly one role (`model`, `animations.<state>`, `previews`, `evidence`) and every declared path must appear in `files`.

```json
{
  "schemaVersion": 1,
  "kind": "character",
  "id": "capitao-caveira",
  "version": "0.1.0",
  "source": { "revision": "<studio-assets commit>", "provenance": ["Mint final model, offline meshy-28 rig"] },
  "files": [{ "path": "model/capitao-caveira.glb", "sha256": "…", "bytes": 1 }],
  "model": "model/capitao-caveira.glb",
  "skeleton": "meshy-28",
  "animations": { "idle": "animations/idle.glb", "walk": "animations/walk.glb", "…": "…" },
  "previews": ["previews/portrait.jpg"],
  "rights": { "status": "original", "basis": "Invented character; concept prompt forbids likeness of real people and existing characters." },
  "budgets": { "triangles": 6000, "bytes": 8388608 }
}
```

## Validation

`node tools/validate-pack.mjs <manifest.json> [package-root]` runs the schema, safe-path, role, size and SHA-256 checks shared by every pack. Before any payload is hashed, the sum of `files[].bytes` must not exceed `budgets.bytes`. It then reads the character bytes as data only (no renderer, no code execution):

- The model is a GLB 2 container with in-bounds buffer views and accessors, finite positions and in-range indices. Every primitive is a triangle list (mode 4), and the triangle count must not exceed `budgets.triangles`.
- The model has exactly one skin, and `inverseBindMatrices` holds one float `MAT4` per joint. Every skinned primitive has a `JOINTS_0` unsigned byte/short `VEC4` and a float or normalized `WEIGHTS_0` `VEC4` per vertex, and every joint index stays inside the skin.
- The skin is exactly meshy-28: 28 joints whose (name, nearest joint ancestor) pairs match the list below as a multiset.
- Each animation GLB contains an animation named exactly as its state that drives at least one meshy-28 bone through a `translation`, `rotation` or `scale` channel. A `weights` channel must target a mesh with morph targets. Every sampler has at least one float keyframe time and the output type and count that match its interpolation (and, for `weights`, the number of morph targets).
- Each preview starts with the PNG, JPEG or WebP signature for its extension.

## meshy-28

The shared Meshy humanoid skeleton the runtime clips are baked against, taken from the client donor `public/models/characters/mst.glb` and identical in all 37 offline-rigged Creepypasta Season characters. Skin joint order, with the nearest joint ancestor in parentheses:

`Hips` (root), `LeftUpLeg` (Hips), `LeftLeg` (LeftUpLeg), `LeftFoot` (LeftLeg), `LeftToeBase` (LeftFoot), `RightUpLeg` (Hips), `RightLeg` (RightUpLeg), `RightFoot` (RightLeg), `RightToeBase` (RightFoot), `Spine02` (Hips), `Spine01` (Spine02), `Spine` (Spine01), `LeftShoulder` (Spine), `LeftArm` (LeftShoulder), `LeftForeArm` (LeftArm), `LeftHand` (LeftForeArm), `RightShoulder` (Spine), `RightArm` (RightShoulder), `RightForeArm` (RightArm), `RightHand` (RightForeArm), `neck` (Spine), `Head` (neck), `head_end` (Head), `headfront` (Head), `Curl_R` (RightHand), `Curl_L` (LeftHand), `Curl_R` (RightHand), `Curl_L` (LeftHand).

Note the Meshy spine order (`Spine02` is next to the hips), the lowercase `neck`, and the two finger helpers that appear twice each. The authoritative list is `meshy28Joints` in `tools/lib/character-pack.mjs`.

## Rights

- `original`: invented character without identity references; the concept prompt carries the ORIGINAL CHARACTER clause.
- `public-domain`: historical figure or public-domain work (for example Stoker's 1897 *Dracula*); `basis` names the source and `references` cites it. The concept prompt carries the PUBLIC-DOMAIN FIGURE clause and excludes modern film or TV portrayals.
- `political-satire`: creepy skin of an existing roster caricature under the project's political satire exception.

Photos of real people never enter either repository.

## Checks

`npm run check` builds a synthetic character pack (a programmatic 12-triangle skinned GLB and eleven one-channel clips, no real asset bytes), validates it, and requires each contract mutant to be rejected for its stated reason: missing states, unknown state, misnamed clip, clip driving no meshy-28 bone, clip channel without a path, clip without keyframes or with mismatched output, wrong skeleton id, renamed, reparented or missing bone, missing skin or weights, missing, mistyped or out-of-skin `JOINTS_0`, triangle strips, bad GLB magic or version, triangle and byte budgets (including the byte budget before hashing), bad rights, missing or invalid previews, undeclared files, and hash or size mutations.

## Concept generation

`tools/gen-character-concept-openrouter.mjs --ficha <ficha.json> --reference <cast image> --out <png>` composes the concept prompt from a character sheet (`especie`/`proporcao`, ORIGINAL CHARACTER clause without references, `dominioPublico` clause) via `tools/lib/character-concept-prompt.mjs`. `openai/gpt-image-*` models use OpenRouter's Images API in this tool and in `tools/gen-image.mjs`. Both tools call paid APIs. Checks run the concept tool only with `--dry-run`, which exits before credentials are read, and never run `gen-image.mjs`.
