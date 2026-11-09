# Character pipeline (the standard process)

Every new third-person character of CORO SOLTO follows this one route, end to end. The
output is an immutable Studio character pack ([character-pack.md](character-pack.md))
pinned by a client release — never a new GLB under the client's `public/`, never a Mint or
proximity auto-rig, never clips that skipped the QA gate.

Stage docs live on their branches until the program merges: the pack contract
(`feat/character-pack-contract-20261108` + `feat/pack-optional-clips-20261109`), the
Blender rig (`docs/character-rig.md`, `feat/blender-character-rig-20261109` +
`fix/character-rig-robustness-20261109`) and the animation conversion
(`docs/animation-conversion.md`, `feat/animation-conversion-20261109`). This document is
the map that ties them together; the builder (`tools/characters/build-character-pack.mjs`)
is the only promotion step.

```
concept ──> Mint model ──> Blender rig ──> animation bake ──> pack build ──> client verify ──> release pin
 (rights)    (owner)       + pose gate      + clip QA          + validate      + install         (own PR)
```

## 1. Concept and rights (studio-assets, private)

A character starts as a ficha in the private `corosolto/studio-assets` repository
(`characters/<id>/`): ficha, concept, references and `PROVENANCE.md`. The `## Rights`
section is the contract the builder reads later: `original`, `public-domain` (with
citations) or `political-satire`. Photos of real people never enter either repository;
the concept prompt carries the ORIGINAL CHARACTER or PUBLIC-DOMAIN FIGURE clause
(`tools/gen-character-concept-openrouter.mjs --dry-run` composes it without calling any
paid API).

## 2. Mint model (owner-generated)

The unrigged final GLB comes from the owner's Mint run (agents make no paid generation
calls). It lands with the ficha (for the 2026-11 lot: `csbrasil/local/mint-raw/lote30/`).
This is the last time the model has no skeleton: everything after this stage works on the
shared **meshy-28** skeleton.

## 3. Blender rig + pose gate

```bash
node tools/characters/rig-character.mjs \
  --config=characters/<id>/rig.json --work=<private>/<id> \
  --source=<mint-final.glb> --clips-from=<client>/public/models/anims/mixamo \
  --retarget=<client>/tools/retarget-glb.mjs
```

Clean → parts → joints → armature → weights → assemble → pose, in Blender 5.2, described
in `docs/character-rig.md` (branch `feat/blender-character-rig-20261109`). The gate is the
numeric pose test (`pose-test.json`): the build refuses to continue unless it has **0
failures**. Work in gauntlet rounds — measure, fix (a `joints.json` override, a
`parts.extras` selector, a weights lever), re-measure, at most 3 rounds; keep the best
round. Gate thresholds: body/upper back ≤ 3.5×, hands ≤ 2.5×, seams ≤ 5 mm, bind ≤ 2 mm;
the pilot quality reference is stricter (worst clip edge ≈ 2.6–2.8×, hands ≤ 1.4×,
synthetic poses ≤ 3.0×). A character whose rig never passes the gate gets **no pack** (7
of the 37-character lot stayed out for exactly this reason).

Always look at `joints-review.png` and `parts-review.png` before trusting the numbers.

## 4. Animation bake + clip QA

```bash
node tools/animations/build-library.mjs --catalog=<studio-assets>/animations/catalog.json --out=<work>/reference
node tools/animations/bake-character.mjs --model=<id>.blender.glb --clips=<work>/reference --out=<work>/<id>
node tools/animations/clip-qa.mjs --model=<id>.blender.glb --clips=<work>/<id> --out=<work>/qa-<id>.json --strict --pack=states,loco,combat,ceremony
```

`docs/animation-conversion.md` (branch `feat/animation-conversion-20261109`) covers the
conversion of the private Mixamo/Quaternius catalog onto meshy-28, the bake (ground
contact, foot IK, floor clamp, two-hand grip) and the QA gates (foot slide, floor
penetration, floating, hips height, loop seam, grip, skin stretch). The output this
builder consumes is the **character-clips@2** pack: `states.glb` (the 11 runtime states),
`loco.glb`, `combat.glb`, `ceremony.glb`, one GLB per emote and a `manifest.json` that
records each clip's duration, loop flag and catalog provenance.

QA failures tagged `[rig: …]` are rig-weight defects (tracked by the rig stage, not the
pack); every other failure is a conversion defect and blocks step 5 unless the reviewer
allows it explicitly.

## 5. Previews

Render the portraits from the **same GLB the pack ships** (for the 2026-11 lot:
`render_poses.py` from the rig pipeline, orthographic front + three-quarters, framing per
the rig pipeline's height rules). Previews prove identity: they are hashed into the
manifest next to the model.

## 6. Pack build + validate

```bash
node tools/characters/build-character-pack.mjs \
  --id=<id> --version=0.2.0 \
  --model=<rig work>/<id>.blender.glb --pose-test=<rig work>/pose-test.json \
  --clips=<bake output>/<id> --qa=<work>/qa-<id>.json \
  --assets=<studio-assets>/characters/<id> --revision=<studio-assets sha> \
  --preview=<front.png> --preview=<34.png> \
  --out=<pack root>
```

The builder (`npm run pack:build-character`) is deterministic — same inputs, same pack
bytes — and fails closed. It refuses to build when:

| Refusal | Meaning |
| --- | --- |
| `pose_gate_failed` | the rig pose test has failures; back to step 3 |
| `qa_failure_not_allowed` | a non-rig clip QA failure is not covered by an explicit `--allow-qa=<clip\|*>:<substring>` |
| `converter_schema` / `converter_id_mismatch` / `model_sha_mismatch` | the clips were not baked for this model (SHA-256 chain) |
| `state_missing` / `state_layout_unsupported` / `extra_name_not_in_vocabulary` / `pack_file_missing` | the clip set does not match the contract vocabulary or layout |
| `rights_*` | PROVENANCE rights missing, unknown status, no basis, or public-domain without citations |
| `triangles_over_budget` / `bytes_over_budget` | over the declared budgets (triangles cap 15000, bytes 8388608; schema caps 15000/16 MiB) |
| `preview_signature` / `preview_missing` | previews absent or not a real PNG/JPEG/WebP |
| `pack_version_exists` | that version was already published with different content — packs are immutable, bump the version |
| `pack_validation_failed` | the freshly built pack failed the shared contract validator |
| `omit_extra_state` / `omit_extra_invalid` / `omit_extra_absent` / `omit_reason_missing` | an `--omit-extra` names a state, a key outside the vocabulary or twice, a clip the converter never baked, or has neither a reason nor a QA failure to cite |

The built pack ends in `<out>/character/<id>/<version>/` and is validated in place
(`tools/validate-pack.mjs` runs inside the build; `npm run pack:validate` re-runs it
standalone). Families in the manifest come from the contract's own `clipFamily`, so the
manifest can never disagree with the validator mirror. The 2026-11 pilot measured the full
layout at 4.4–6.7 MB per pack (worst `bebe-reborn` 6671250 bytes = 80% of the 8 MiB
declared budget; 30 packs, 155.5 MiB total, 85 clips each).

An optional extra that fails clip QA on one character can leave that character's pack by
owner decision instead of an allowance: `--omit-extra=<key>[:<reason>]` (repeatable). The
builder rewrites the clip's family pack without it (same encoding; the other clips decode
identically), drops it from `animations.extra`, stops gating on its QA results and adds one
`source.provenance` line per omission with the reason and every QA failure of that clip, for
example `omitted extra crouchwalk_back (dropped from animations/loco.glb; ...): clip QA: skin
stretch 3.666× @0.6364s > 3.5 [clip: Hips+RightUpLeg]`. The runtime falls back when an
optional extra is missing; states are its floor, so they can never be omitted.

## 7. Client verify + install

```bash
node scripts/studio-pack.mjs install <pack root>/character/<id>/<version>   # into the local tree
node scripts/studio-pack.mjs verify <id>@<version>
STUDIO_PACK_ROOT=<local tree> npm run dev                                    # serves /packs/
STUDIO_PACK_ROOT=<local tree> npm run eval:studiochar:browser                 # real-renderer gate
```

The client verifier (client PR #1225) re-checks the installed tree: schema, hashes,
immutable install (versions live side by side), and the runtime resolver's fail-closed
order (`docs/studio-character-release.md`, client PR #1244). Nothing is copied into
`public/`: the dev server and the CDN both serve packs read-only from the pack root.

## 8. Release pin (own PR, owner's call)

A character reaches players only when a client release pins the pack
(`public/js/data/content-releases.js`: kind, id, version, `manifestSha256`,
`manifestUrl`, `minRuntime`) — and joining the roster (characters.js, art, backend
allowlist, multiplayer identity) is a separate PR each, per
`docs/studio-character-release.md`. Publishing the pack files to the public Studio pack
root and bumping a pin are owner decisions.

## Where artifacts live

| Place | Content | Visibility |
| --- | --- | --- |
| `corosolto/studio-assets` | fichas, concepts, references, Mint finals, `PROVENANCE.md`, raw Mixamo FBX (LFS) + `animations/catalog.json` | private |
| `csbrasil/local/…` (rig work, bake, QA, packs, previews) | every private byte produced by steps 3–6 | private, not committed |
| `corosolto/studio` (this repo) | pipeline tools, contract, docs, synthetic checks — no GLB/FBX/blend/images ever | public |
| `corosolto/client` `public/` | the legacy character tree stays until cutover; **no new character GLBs land here** | public |

## Checks

`npm run check` includes `tools/checks/character-pack-builder-check.mjs`: a synthetic
pipeline output (skinned meshy-28 GLB, family packs, pose test, QA report, PROVENANCE,
preview) is built, validated against the contract, rebuilt byte-identical, and every gate
mutant above is rejected with its own error code — including the immutable-version rule
and the QA allowlist. An omitted extra is proven gone from its rewritten family pack and
recorded with its QA number. No real asset bytes are committed anywhere.
