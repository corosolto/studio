# CORO SOLTO — Game Architecture Migration Study

Status: proposed for owner review, not an implementation decision
Date: 2026-11-03

## Executive decision

Do not rewrite the game or migrate its architecture in a single program. Use an incremental migration with behavior baselines, stable public identifiers and independently reversible steps.

The English migration must cover source code, developer documentation, automation and agent-facing workflows. It must not translate Brazilian player-facing content, cultural names, public IDs, database keys, URLs, asset node names or historical evidence. The game already has an English localization path; expand it instead of replacing Portuguese content.

## Delivery window and strategic outcomes

The owner-defined sequence is:

1. Finish Javaporcos and produce/publish its trailer and campaign.
2. Finish Operação Flavio, stabilize it and complete its public communication.
3. Start the architecture migration only after the owner declares that release stable.

Until then, release-critical gameplay work takes priority. Architecture work is limited to research, baseline capture and non-runtime documentation; no structural migration competes with these launches.

The re-architecture has exactly three strategic outcomes:

| Outcome | Required result |
|---|---|
| 1. Repeatable multiplatform deployment | Thin platform shells, signed content distribution and reproducible store builds without rewriting game rules per target |
| 2. Scalable and consistent community production | Explicit contracts, reliable processes, safe creator access, provenance and evidence instead of ad-hoc asset contributions |
| 3. Conference-quality engineering | Readable English code and documentation, defensible module boundaries, reproducible tests and architecture diagrams suitable for public technical talks in Austria and France |

Conference readiness is an outcome of better engineering, not a cosmetic documentation pass. Every claimed improvement must remain reproducible in the public repository.

## Current foundations worth preserving

| Area | Existing evidence | Decision |
|---|---|---|
| Runtime | Astro static site plus zero-build ES modules and Three.js; `client/astro.config.mjs`, `client/public/js/main.js` | Keep the runtime technology during the architecture migration |
| Simulation | `Game.update(dt, render)` is currently a mixed simulation/presentation loop with a render-suppression flag in `client/public/js/game.js` | Inventory its call graph and stateful side effects before extracting a simulation contract; the flag alone is not proof of separation |
| Map loading | `client/public/js/map_json.js` demonstrates registration of an external descriptor through the normal map registry | Treat this only as a registration precedent; design and prove a separate pack-to-world adapter for binary Studio packs |
| Content packs | PR `corosolto/client#1225` implements offline schema, path, hash and immutable-install verification | Extend it with signed remote publication; do not create a second loader |
| Testing | Node game harness, seeded bots, mutation checks, generated docs and 113 deploy gates in `client/tools/eval/` | Preserve the evidence model while splitting CI into clearer lanes |
| Studio | Public research/tools and private source assets with English CI | Keep this repository boundary |
| Infrastructure | Terraform, Cloud Run, Supabase, Vercel, Cloudflare, GCE nodes, OIDC and Secret Manager | Consolidate provisioning and drift detection instead of changing providers by default |
| Localization | `client/public/js/i18n.js` plus PT/EN pages and Docusaurus mirrors | Move dynamic strings to message IDs and preserve PT-BR as a supported product locale |

## Target at a glance

- One shared Three.js runtime, with explicit simulation, rendering, content and platform boundaries.
- Web/PWA, Electron, Capacitor and portal SDKs as thin distribution shells.
- Immutable Studio packs, verified by schema and SHA-256, with signed manifests before remote loading.
- One backend authority for accounts, entitlements, economy, multiplayer and telemetry.
- Infrastructure as code, preview/staging/production separation, observable rollouts and reversible releases.
- English-first repositories, developer experience and agent experience, with preserved Brazilian content and stable IDs.
- Community contribution through documented contracts and inert content packs, never arbitrary executable code.

Detailed target: [target-architecture.md](target-architecture.md).

## Migration waves

| Wave | Deliverable | Gate to continue |
|---|---|---|
| 0. Baseline and ownership | Runtime/content IDs, current architecture map, test lanes, performance and download baselines, repository ownership | Baselines reproduce on a clean checkout; owners and rollback paths are named |
| 1. English and governance | Language policy, English entry docs, CI/agent output, contribution/security/governance documents | No runtime diff; generated docs and existing checks pass |
| 2. Runtime contracts | Explicit map/world, simulation, renderer, platform and network boundaries around existing code | Same gameplay evidence and deterministic harness results as baseline; unchanged `SIM_HASH` or a coordinated client/node rollout with a real staging compatibility smoke |
| 3. Signed content distribution | Signed manifests, key rotation/revocation, immutable CDN publication, cache and pack/runtime compatibility | Valid packs install; bad signatures, revoked/expired packs, incompatible world hashes and rollback fail closed; mixed-version and active-match behavior is recorded |
| 4. Platform shells | PWA, portal adapters, Electron and Capacitor through one platform contract | Each shell passes pinned-content, malicious-origin, lifecycle, input, payment and store smoke suites |
| 5. Backend and provisioning | Entitlements/payment adapters, environment parity, import-first IaC, drift detection and release observability | Preview → staging → production promotion and rollback are demonstrated without destructive unreviewed infrastructure changes |
| 6. Community workflow | Creator submission, licensing, moderation, provenance, review, publication and takedown | A hostile external fixture completes validation without privileges; licensing, appeals and CDN/client tombstones are proven before intake opens |
| 7. Conference readiness | Public architecture, deterministic demo, quickstart, release evidence and limitations | A new contributor can follow the public demo without private assets or credentials |

No wave authorizes a big-bang rename, framework change or runtime rewrite.

Every wave must satisfy the reproducible predicates in [acceptance-gates.md](acceptance-gates.md). “Compatible” or “demonstrated” without a named input, command, environment, expected result and rollback observation is not a pass.

## English migration policy

The detailed program is in [english-migration.md](english-migration.md).

### Translate progressively

- Source identifiers and comments when their owning module is migrated.
- New and canonical developer documentation.
- CI jobs, bot messages, test output and agent instructions.
- New file names and legacy source file names only with all references updated.

### Preserve intentionally

- Map, character, faction, asset, pack, database and public API IDs.
- GLB node and socket names.
- Published URLs and immutable media names.
- Player-facing Brazilian names, graffiti, cultural terms and PT-BR localization.
- Historical reports and evidence when translation would reduce provenance value.

### Do not mass-translate

- String literals that are keys in the current localization dictionary.
- Generated files; change their generators and regenerate them.
- Public APIs or database columns without a versioned contract and owner-reviewed migration.

## Quality, security and operations

The complete model is in [quality-security-operations.md](quality-security-operations.md).

Required release properties:

1. Deterministic tests and mutation checks before behavior changes.
2. Signed remote packs with public-key verification, anti-rollback rules and immutable files.
3. Server-authoritative entitlements and payment reconciliation for each store.
4. OIDC and managed secrets; no credentials in repositories or agent logs.
5. Preview, staging and production with explicit provenance and rollback.
6. Cache purge and compatibility verification on both deployment and rollback.
7. Performance budgets derived from measured baselines and platform requirements, not invented universal numbers.

## DevX, Agent Experience and community

The operating process is in [delivery-process.md](delivery-process.md).

Every repository needs one canonical agent entrypoint, scoped instructions, an environment doctor, deterministic fixtures, named CI lanes, ownership rules and a documented golden path. Agents must be able to discover contracts from repository files rather than conversation history.

## Repository topology decision

Keep the existing repositories during the migration. Do not combine a language migration, architecture migration and monorepo migration.

Extract shared packages only when two real consumers need the same contract. Candidate seams are the pack schema, platform adapter and runtime world contract. Their first home should be the repository that owns the current implementation; a later workspace is an ADR decision, not a prerequisite.

## Platform decisions to validate in their own ADRs

| Topic | Study recommendation |
|---|---|
| Desktop | Electron for Chromium consistency; evaluate Steamworks integration before committing |
| Mobile | Capacitor for lifecycle, native payments and store integration |
| Microsoft Store PC | PWA/MSIX first; native shell only if required by measured gaps |
| Xbox | Separate feasibility and certification study, not an implied PWA target |
| Remote content | Owner-controlled CDN with signed manifests and cached atomic installs |
| Oxen.ai | Production-only pilot for private datasets and model evaluation; never a runtime dependency |
| TypeScript | Do not combine a language rewrite with the architecture migration; use schemas and JSDoc at existing seams first |

## Success measures

Establish baselines in wave 0 and review trends per release:

- Initial download and total content size by platform/profile.
- Boot, map-load and frame-time distributions on named physical devices.
- PR lane duration, flaky-gate rate and time to recover from a failed release.
- Change failure rate and rollback frequency.
- Percentage of packs with complete provenance, signature and runtime evidence.
- Time for a new contributor or agent to reach the first deterministic local match.
- Public documentation coverage and unresolved security findings.

No numeric performance target is approved by this study except explicit external platform limits.

## Open owner decisions

1. Public-source licensing and contributor governance.
2. Signing-key custody, rotation and emergency revocation.
3. Approved remote content storage and publication credentials.
4. Which platforms receive the first paid entitlements.
5. Whether historical developer documents remain canonical bilingual evidence or receive new English replacements.
6. When the current long pre-push suite moves to CI lanes without weakening required checks.

These decisions do not block the baseline, English-policy or contract-inventory work.
