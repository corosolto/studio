# Coro Solto Studio

Open content studio for CORO SOLTO: research, art direction, authoring tools, gauntlets and versioned content packs.

The game client remains the runtime. This repository contains the open production process for maps and characters, with skins planned for a later phase.

## Repository boundary

- **Public:** research, art direction, studies, authoring scripts, schemas, gauntlets and review evidence.
- **Private:** editable source assets, licensed source packs, unpublished production files and their history. These belong to `corosolto/studio-assets`.
- **Not allowed here:** `.blend`, `.blend1`, `.glb`, `.fbx`, `.mdl`, `.unitypackage`, credentials, private asset bundles or unpublished licensed media.

The public repository has a clean history. Do not commit a private asset and remove it in a later commit: that would still expose it.

## Principles

1. Research before production.
2. Trace every visual decision to a reference and a constructible rule.
3. Preserve editable sources in the private asset repository.
4. Use gauntlet loops before approval; a static beauty shot is not proof.
5. Identify self-review and independent review separately.
6. Publish immutable, hashed packs. The client never consumes a working branch.
7. Design for `med` and `low` from the beginning.
8. Record provenance, licensing and AI/tool involvement.
9. Write repository documentation, code comments, automation and CI output in English.

## Structure

```text
art-bible/       shared visual direction
references/      research guidance and source indexes
decisions/       ADRs and owner decisions
kits/            reusable component specifications
maps/            map research, concepts and gauntlets
characters/      character production conventions
viewmodels/      first-person presentation standards
schemas/         content and evidence contracts
tools/           authoring and validation tools
studies/         historical and cross-project studies
releases/        release manifests and review evidence
```

## Checks

```bash
npm ci
npm run check
npm run check:asset-gen
npm run smoke:pack
```

Checks never call paid generation APIs. See `tools/README.md` for authoring commands and the local workspace contract.

## Lajes 8/9

Lajes is the first production pilot. Its goal is to replace a generic assortment of props with a specific, coherent Brazilian community. See `maps/lajes/README.md` and `maps/lajes/gauntlet/rubric.md`.

## Future client integration

The target contract is defined in `schemas/asset-pack.schema.json` and `docs/INTEGRATION.md`. Client loader work requires a separate client PR and is not implemented here.
