# Quality, Security and Operations

Status: proposed

**Reading status:** Content explicitly identified as “existing” or “observed” describes current mechanisms or facts. Every other control, budget, test lane and operational gate in this document is a target-state proposal, not a claim that the mechanism is already implemented.

## Quality strategy

Existing strengths are the deterministic Node harness, seeded bots, consumer-facing evals, mutants, generated docs and production probes. The proposed quality strategy improves lane ownership and reduces duplicated gate lists without removing existing evidence.

### Test lanes

| Lane | Content | Trigger | Required property |
|---|---|---|---|
| Change-local | Module unit and contract checks | Before every PR | Fast, deterministic and relevant to changed behavior |
| PR fast | Syntax, schemas, security boundaries, docs, affected integration | Every PR | No unrelated long-running lanes |
| PR full | Runtime, gameplay, packs, build and required visual contracts | Before merge | Complete consumer confidence with named evidence |
| Nightly | Browser matrix, long simulations, mutation rotation, dependency and provisioning drift | Scheduled | Flakes and blind checks become tracked work |
| Release candidate | Physical mobile devices, store shells, payments, performance and package size | Every release | Platform-specific release approval |
| Post-deploy | Health, cache coherence, backend/node/client hashes and telemetry | Deploy and rollback | Production matches the approved release and rollback is verified |

Moving expensive checks out of a local pre-push hook must not remove them from required CI. The existing full gate passed 113/113 during the Studio integration study; intermittent boot-budget results demonstrate why flaky infrastructure and real regressions need different reporting.

## Test pyramid by boundary

| Boundary | Required tests |
|---|---|
| Simulation | Deterministic state, combat, movement, rounds and seeded bots |
| World/map | Collision, navigation, spawns, regions, route traversal and ground queries |
| Pack | Schema, roles, inert files, paths, sizes, hashes, signatures, anti-rollback and immutable installs |
| Platform | Lifecycle, input, storage, entitlements, unsupported capabilities, store callbacks, malicious navigation/deep links and per-request IPC sender/origin checks |
| Payments | Signature, replay, idempotency, dispute, refund and reconciliation |
| Visual | Fixed cameras, free roam, low/medium profiles and actual-device evidence |
| Operations | Preview/staging/prod parity, rollout, rollback, cache and health |
| Community | Untrusted fixture submission with structural/runtime budget fixtures, bounded workers, no code execution and no privileged write path |

Every new invariant needs a failing case or mutant. A green fixture that cannot catch the original defect is not release evidence.

## Performance and package budgets

Record named baselines before setting targets:

- Initial compressed download and total download per platform.
- File count and largest pack size.
- Boot and map-load distributions.
- Frame time, draw calls, triangles and memory by quality profile.
- Thermal behavior and battery impact on physical mobile devices.
- Pack cache hit rate and install/recovery time.

External limits are hard constraints for the release that targets them, but they are not timeless architecture constants. As checked on **2026-11-03**, the official [CrazyGames technical requirements](https://docs.crazygames.com/requirements/technical/) stated a maximum **50 MB initial download**, **250 MB total file size** and **1,500 files**, with a **20 MB initial-download** limit for mobile-homepage eligibility. With SDK integration, CrazyGames defines the initial-download window as loading start through the first `Gameplay start` event; without it, total file size is used for that threshold. Recheck the linked policy at each portal submission and record the policy date with release evidence.

The measured **93,655,071-byte uncompressed Lajes candidate** is a local asset measurement, not a measurement of either CrazyGames initial download or total file size. Do not infer portal compliance by comparing that uncompressed number with both limits. Measure actual transferred bytes through first gameplay for initial download, and the complete packaged file set for total size and file count, retaining compressed and uncompressed measurements separately. The proposed profile-specific packaging keeps Lajes out of the initial portal download and loads it on demand; Studio research files never enter runtime bundles.

## Security model

### Content and community packs

Threats:

- Malicious or altered CDN content.
- Path traversal and executable payloads.
- Unauthorized release signing or key theft.
- Rollback to a vulnerable release.
- Community content with unlicensed sources or prohibited material.

Proposed controls:

- Signed manifests and pinned public verification keys.
- Key rotation, revocation and emergency pin policy.
- Inert-file allowlist and magic-byte checks.
- Atomic immutable installation and complete-file verification.
- Provenance, license and moderation review before publication.
- No arbitrary JavaScript, WASM or native binaries in packs.

#### Proposed community-asset admission boundary

Treat every community asset as hostile. Before full community-asset parsing, decoding or GPU upload, define numeric per-file, per-pack and per-quality-profile budgets in versioned configuration; an absent or unlimited budget is a rejection, not a pass. A bounded header/manifest preflight may inspect only the fixed-length metadata needed to validate declared lengths and counts. It must not invoke the general GLB parser, allocate from attacker-declared sizes or upload content. Full parsing is allowed only after that preflight and must run in a cancellable worker with independent structural and runtime limits.

| Budget boundary | Required limits and enforcement |
|---|---|
| GLB structure | GLB count per pack; declared and actual file/chunk bytes; JSON/bin chunk bounds; scene depth; nodes, meshes, primitives, materials, accessors, buffer views and total object counts |
| Textures | Width, height, mip count, encoded bytes, per-texture and aggregate decoded pixels/bytes; reject dimension or arithmetic overflow before allocation |
| Animation | Clips, channels/tracks, keyframes, duration and sampled output bytes; reject unbounded sampling or interpolation work |
| Decompression | Compressed input bytes, expanded output bytes and expansion ratio per resource and in aggregate; stream with a hard output cap and abort rather than allocating the declared result |
| CPU/GPU memory | Geometry, decoded texture including mip levels, animation and aggregate resident bytes; reserve against the selected profile's CPU/GPU budget before allocation and release all reservations on failure |
| Workers and time | Worker count, queue depth, concurrent submissions, CPU time and wall-clock deadline per file and per pack; timeout, cancellation and worker termination must bound slow or non-terminating inputs |

Measure actual decoded sizes and resource use during processing as well as declared metadata; either one can stop admission. Rejection discards the entire candidate, terminates its workers and leaves no installed, published or trusted-cache artifact.

Required adversarial fixtures include mismatched/truncated GLB chunks, excessive counts and deep or cyclic scene graphs, out-of-bounds accessors, oversized textures and mip amplification, dense or very long animations, decompression bombs, slow/non-terminating workers and CPU/GPU budget overruns. Tests must prove deterministic rejection before unrestricted allocation, bounded worker/time use, resource cleanup and no partial publication. Include fixtures just below and just above every numeric limit so the admission boundary itself is tested.

### Backend and payments

Proposed controls:

- Server-authoritative economy, entitlements and competitive results.
- Verified provider webhooks with replay protection and idempotent settlement.
- Rate limits on authentication, tickets, login and purchase endpoints.
- Short-lived credentials and least-privilege service accounts.
- Explicit unsupported/pending states instead of optimistic success.
- Reconciliation and audit logs for financial transactions.

### Supply chain

Proposed controls:

- Pinned actions and dependencies with reviewed updates.
- Secret scanning and dependency scanning with ownership.
- Build provenance and an SBOM for release shells.
- No secrets in repository files, issues, logs, prompts or agent evidence.
- Reproducible release builds where practical.

#### Proposed fork and community CI isolation

Run fork pull requests and community-content validation in disposable, unprivileged workers. Their repository checkout is read-only except for isolated temporary/output directories, and their CI token is read-only with every unneeded permission explicitly disabled. These jobs receive no repository, organization or environment secrets and no OIDC/cloud token (`id-token: none`); a privileged event such as `pull_request_target` must never check out or execute their code.

Apply default-deny or narrowly allowlisted network egress to pinned dependency services only, blocking cloud metadata, internal services and deployment/control-plane endpoints. Enforce CPU, memory, disk, process, concurrency and wall-clock quotas. Store outputs only in a quarantined artifact namespace with content hashes and explicit untrusted provenance; quarantine is not a release cache, deployment source or signing input.

Signing is a separate protected workflow requiring explicit owner approval. It rebuilds from the reviewed trusted revision, verifies source/provenance and artifact digests, and uses signing credentials available only to that workflow. Approval must not rerun untrusted code with secrets or sign merely because the untrusted CI job passed.

A required hostile-PR fixture must attempt token writes, secret and OIDC access, network exfiltration to a controlled canary, cloud-metadata/internal-network access, resource exhaustion, writes outside its workspace and escape from artifact quarantine. The test passes only when every attempt is denied or bounded, no credential is exposed, the job cannot promote or sign output, and audit evidence identifies the rejection. Use synthetic canaries rather than real production secrets.

### Application shells

Proposed controls:

- Load shell code only from pinned local bundles or content-hashed bundles verified against the approved release manifest before execution; a URL, version string or cache header alone is not an integrity check.
- Deny remote navigation by default for the privileged shell, including redirects and new windows. Any explicit external-link exception opens outside the privileged context and never inherits its IPC access.
- Treat deep links and custom-protocol URLs as untrusted input: parse against a strict route allowlist, reject local-file/remote-navigation escapes and require reauthorization after any navigation.
- Validate the IPC sender on **every request**, not only at bridge creation: bind the exact sender frame/window identity and expected origin, check that neither has navigated, then authorize the typed command and validate its payload. Remote or unknown origins receive no privileged bridge.
- Apply a CSP appropriate to each shell and portal, expose no privileged Node.js API to game content and keep backend secrets out of packaged clients.
- Use secure token storage and narrow IPC bridges that return explicit errors without leaking privileged paths, tokens or internal state.
- Add malicious-origin, spoofed/reused-frame, redirect and malicious deep-link fixtures that attempt navigation, local-file access and privileged IPC. The required result is rejection on every request, with no confused-deputy action or credential disclosure.

## Provisioning and environments

### Existing reusable foundation

The backend already has Terraform, Cloud Run, Secret Manager, OIDC/WIF and versioned SQL. The client uses Vercel and Cloudflare; multiplayer nodes use client/server hash compatibility checks. These are migration assets, not reasons to change providers.

### Target environments

| Environment | Purpose | Data and credentials |
|---|---|---|
| Local | Deterministic development and bots | Local fixtures; no production secrets |
| Preview | PR-specific runtime and pack validation | Isolated synthetic data and short-lived credentials |
| Staging | Release integration, store sandbox and rollout rehearsal | Production-like configuration with isolated data |
| Production | Owner-approved release | Managed production secrets and controlled permissions |

### Proposed infrastructure as code migration

Start in **import-only mode**. First inventory every supported Vercel, Cloudflare, Cloud Run, GCE, storage and signing-metadata resource with its provider, remote ID, environment, dependencies, current configuration and owner. Record imported, deliberately unmanaged and unsupported items explicitly. Only imports into declarative state are permitted in this phase; no create, update or delete apply is allowed. Review the resource-to-configuration/state mapping and resolve unexpected drift before proposing an apply.

Use independent state per provider and environment with pinned provider versions, mandatory state locking, encryption, versioned backups, tested restoration and least-privilege state access. A no-destroy policy combines `prevent_destroy` lifecycle rules with CI/plan policy that rejects deletes and replacements; importing or adopting a resource must never make it eligible for unattended destruction.

After import, validate the actual repository and SHA—the already observed backend checkout drift is a release blocker, not a cosmetic warning—and produce an immutable saved plan. An owner must explicitly approve that exact plan digest, commit and resource-action inventory before apply; apply consumes only the approved plan and is never automatic. Production uses separate protected credentials and roles from preview/staging and from all fork/community jobs, with credentials exposed only to the approved production plan/apply boundary.

Run read-only drift detection on a schedule and before release. Keep SQL migrations owner-applied and package each migration in the deploy artifact as required by the backend Dockerfile contract.

## Rollout and rollback

1. Build an immutable runtime and content release.
2. Deploy preview and verify the exact commit, schema and pack hashes.
3. Rehearse store sandbox payments and entitlement grants in staging.
4. Roll out in controlled stages, using the existing regional approach where appropriate.
5. Verify client, backend, node and pack compatibility after each stage.
6. Purge and verify affected edge caches on both rollout and rollback.
7. Revert the release pin to the previous approved runtime or pack without overwriting files.

Health checks need cache-busting where the edge caches `/api/health`. Backend merge is not deployment, and deployment is not SQL migration.

## Observability

Correlate a release across:

- Client commit and runtime version.
- Backend and multiplayer server SHAs.
- Studio pack manifest hashes and signer key IDs.
- Platform/shell type and store version.
- Content profile and device class.

Track errors, boot/map failures, pack verification failures, payment reconciliation, rollout health and performance. Define numeric SLOs only after baselines exist.

## Privacy and store compliance

- Document data collection and consent per platform.
- Separate operational telemetry from optional analytics.
- Support account/data deletion workflows.
- Review age rating, UGC moderation, ads and payment requirements per store before enabling the feature.
- Keep community publishing disabled on a platform until its UGC requirements are satisfied.

## Release evidence package

Every release candidate should include:

- Commit and environment identities.
- Tests and known pre-existing failures with baseline comparison.
- Pack manifests, signatures, provenance and file hashes.
- Download and performance results on named devices.
- Security and dependency results.
- Rollout and rollback records.
- Explicit unsupported features and remaining owner-review items.
