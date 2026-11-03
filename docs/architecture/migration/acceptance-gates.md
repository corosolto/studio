# Reproducible Acceptance Gates

Status: proposed

This document defines what evidence each migration wave must produce. Commands marked **existing** were observed in the repositories. Commands marked **required new** are deliverables of that wave and must not be cited as passing before they exist.

## Evidence record

Every gate run records:

- Repository, branch, commit and clean/dirty state.
- Exact command and immutable input paths/URLs.
- Runtime, package-manager and platform versions.
- Expected result and actual result, including allowed variance.
- Environment and device/browser names.
- Output artifact paths and relevant hashes.
- Rollback action and observed post-rollback state.
- Pre-existing failures compared with a clean baseline.

A screenshot without a reproducible command is supplementary evidence, not a gate.

## Wave 0 — Baseline and ownership

### Inputs

- Clean client, backend, admin, Studio and Studio Assets revisions.
- Current map/public-ID inventory and runtime/content manifests.
- Named devices and browser versions.
- Current production release and one previous rollback target.

### Required checks

- **Existing:** `git rev-parse --show-toplevel`, `git status --short --branch`, and repository remote verification for every checkout.
- **Existing:** `npm run smoke:pack` in the public Studio checkout.
- **Required new:** after the client integration branch lands, `npm run eval:studiopack` in the client; until then record the integration branch and commit explicitly instead of treating it as a clean-mainline command.
- **Existing:** `npm run check:deploy` on a clean client baseline; record duration and all failures without suppressing them.
- **Required new:** `dev:doctor` records runtime/package-manager mismatches and missing prerequisites without reading secrets.
- **Required new:** `baseline:capture` records download, boot, map-load, frame-time and package-size data with artifact hashes.

### Pass and rollback

Two clean runs produce the same inventory and compatible deterministic results. Any performance variance is recorded rather than hidden. The previous production release is identified and its restore procedure is documented, but no production rollback is executed for this baseline.

## Wave 1 — English and governance

### Required checks

- **Existing:** `npm run docs:check` and `npm run arch:check` in the client; `npm run check` in Studio.
- **Required new:** `english:check` validates changed-file policy, exemptions and generated files with positive/negative fixtures.
- **Required new:** `community:docs:check` verifies required contribution, security, governance, support and licensing documents.

### Pass and rollback

No runtime or public-ID diff occurs. All canonical new documents are English and generated artifacts reproduce exactly. Reverting the documentation change restores the previous docs without affecting runtime files.

## Wave 2 — Runtime contracts

### Required checks

- **Existing:** the affected deterministic simulation, map, gameplay and visual checks, followed by `npm run check:deploy` for the release candidate.
- **Existing:** compare the resulting `SIM_HASH`/client reference with the authoritative multiplayer node contract.
- **Required new:** `runtime:contract:check` exercises the world adapter with compatible and missing assets and proves visible failure instead of fallback substitution.
- **Required new:** `multiplayer:compat:check` runs a real client-node smoke in staging and records mixed-version rejection or coordinated compatibility.
- **Required new:** a call-graph and side-effect inventory for `Game.update` precedes any simulation split.

### Pass and rollback

If simulation semantics are unchanged, the simulation hash remains unchanged. If the hash changes, a coordinated client/node canary and rollback are required before promotion. Local bot success alone is insufficient. Reverting the runtime pin restores the previous client and node pair without leaving a mixed active-match deployment.

## Wave 3 — Signed content distribution

### Required checks

- **Existing:** `npm run smoke:pack` in the public Studio checkout.
- **Required new:** after the client integration branch lands, `npm run eval:studiopack` in the client for local schema, path, size, hash and immutable-install behavior.
- **Required new:** `studio:pack:verify-remote` validates the signature, signer policy, world-contract hash and minimum runtime before download/install.
- **Required new:** `studio:pack:revocation:check` covers compromised keys, revoked/expired releases, clock skew, offline cache, tombstones and recovery.
- **Required new:** adversarial content fixtures cover decompression expansion, oversized textures, mesh/accessor counts, animation data, parser time and GPU memory.
- **Required new:** mixed-version, active-match and rollback fixtures verify the server-approved world identity and `/health` metadata.

### Pass and rollback

Valid approved packs install and load; altered, revoked, expired, incompatible or resource-exhausting packs fail before runtime promotion. Rollback restores the previous signed release pin and removes or disables the rejected pack from CDN and client caches according to the revocation policy.

## Wave 4 — Platform shells

### Required checks

- **Required new:** `platform:smoke --shell=web|electron|capacitor|portal` verifies lifecycle, input, unsupported capabilities and storage.
- **Required new:** `platform:security:check` proves pinned local/content-hashed bundles, denied remote navigation, sender/origin validation on every IPC command, and malicious deep-link rejection.
- **Required new:** provider-specific payment and restore-purchase fixtures cover pending, success, failure, replay, refund, account linking and unlinking.
- **Existing external constraint:** current store requirements are recorded with official URLs and retrieval dates, not copied as permanent assumptions.

### Pass and rollback

Each shell runs the approved content and rejects a malicious origin. Unsupported capabilities return explicit results. Store rollback leaves entitlement ownership consistent and restores the previous signed shell/content pair.

## Wave 5 — Backend and provisioning

### Required checks

- **Required new:** an inventory/import-only IaC report maps every existing resource before any apply. Per-provider state is locked and backed up; destructive plans are denied pending explicit owner review.
- **Existing:** backend API and multiplayer smoke suites and their health contracts.
- **Required new:** `release:compat:check` verifies client, backend, node, pack and schema identities in preview, staging and production.
- **Required new:** `release:rollback:check` verifies edge purge, cache-busted health, active-match behavior, schema compatibility and entitlement preservation.

### Pass and rollback

Preview → staging → production promotion has matching approved identities and no unreviewed destructive infrastructure change. Rollback restores the previous release and verifies the same health and entitlement checks; no migration or destructive apply is implicit in deployment.

## Wave 6 — Community workflow

### Required checks

- **Required new:** a hostile fork-PR fixture runs read-only validation without secrets, `id-token`, write permissions or unrestricted network access. Artifacts remain quarantined.
- **Required new:** owner-approved signing/promotion is a separate job and cannot be triggered by untrusted content.
- **Required new:** `community:policy:check` verifies contributor grants, reference/AI rights, moderation, appeals, retention, response owners/deadlines and takedown authority.
- **Required new:** `community:takedown:check` propagates a tombstone to CDN and client caches and verifies restoration/appeal behavior.

### Pass and rollback

External intake remains closed until every legal, security and revocation check passes. A rejected or removed submission cannot reach signing or runtime. Takedown restores the prior approved content state while preserving the audit record.

## Wave 7 — Conference readiness

### Required checks

- **Required new:** a clean-checkout contributor follows only public English documentation and reaches a deterministic bot match without private assets, credentials or paid APIs.
- **Existing:** public Studio CI and the client release/build checks for the demonstrated revision.
- **Required new:** `conference:demo:check` verifies the pinned demo, public architecture, release evidence and known limitations.

### Pass and rollback

The demo and CI are reproducible from public instructions, and private material remains absent. If the public demo fails, the previous working demo revision and instructions remain available rather than being overwritten in place.
