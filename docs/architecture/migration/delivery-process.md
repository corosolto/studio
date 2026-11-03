# Delivery Process, DevX and Agent Experience

Status: proposed

## Operating principle

Optimize for frequent, reversible changes with explicit evidence. Do not optimize for the size of a rewrite or for how much an agent can generate in one run.

Consistency comes from stable contracts, small ownership boundaries, deterministic local development and required checks that catch real defects.

## Developer experience

### Package-manager decision and one-command setup

Before publishing setup instructions, approve an ADR that selects one package manager and its supported version for each repository. The ADR must name the authoritative package-manager declaration and the single checked-in lockfile. This document does not choose between npm and Yarn.

The client currently has Node-22-specific requirements and a Yarn package declaration while CI uses npm. Resolve that divergence in one change that aligns the declaration, lockfile, Corepack configuration, setup doctor, CI installation command and contributor documentation. Do not retain parallel install instructions or generate both package managers' lockfiles.

A clean-checkout CI job must assert that Corepack activates the declared version, dependency installation uses the selected manager's frozen/immutable lockfile mode, and installation leaves the lockfile unchanged. The setup doctor must reject a different manager or an unsupported version with an actionable English diagnostic.

After that decision and alignment, each repository provides one documented setup path that:

1. Verifies the required Node/package-manager versions and native prerequisites.
2. Installs dependencies using the same package manager and lockfile as CI.
3. Prepares required public fixtures without reading or printing secrets.
4. Runs the environment doctor.
5. Starts a deterministic local match with bots and no paid services.

### Golden paths

Document and test these workflows:

- Start a local game with bots.
- Change simulation behavior and run its module checks.
- Change a procedural map and compare fixed cameras.
- Build, verify and install a Studio pack.
- Run a web shell and a platform-shell smoke test.
- Rehearse rollout and rollback without production access.

Every golden path has one owner, one command and an expected observable result.

### Local development constraints

- No production credential is required for ordinary development.
- Local bots are always available as a playable fallback.
- Paid generation, deployment and migrations are opt-in owner actions.
- Browser tests use the project's port and locking conventions.
- Tests can be selected by module and by CI lane; contributors do not need to copy a monolithic script line.

### Message resources and per-surface migration

Define the intermediate message-resource schema and lookup contract before converting callers. At minimum, locale resources must be keyed by stable message IDs and carry English source text, translated text, translator context and declared interpolation placeholders. IDs must not change when copy changes. A single lookup API must accept the message ID, locale and placeholder values, and must define English fallback and missing-ID diagnostics for development and production.

Validate that contract with fixtures before migration. CI must extract the IDs referenced by callers and fail when any ID is absent from either the English (`en`) or Brazilian Portuguese (`pt-BR`) resource, or when the two resources declare incompatible placeholders. A fallback must not make a missing catalog entry pass CI.

Migrate one user-facing surface at a time. A surface is complete only when all of its callers use the lookup API and both locales render with the expected placeholders. Keep the legacy hard-coded-copy compatibility path until every caller in every surface has converted; partially migrated surfaces must continue to work in both locales. Remove that compatibility path only after a repository-wide caller check is clean and both locale validations pass.

## Agent Experience

### Canonical context

Each repository provides:

- Root `AGENTS.md` with architecture, boundaries and safety rules.
- Scoped instructions in complex directories.
- A current architecture map and generated ownership information.
- Setup and verification commands with expected runtime versions.
- Stable contract/schema locations and examples.
- A continuation convention for long-running tasks.
- Clear public/private and local/preview/production boundaries.

Agents must not depend on a prior chat to discover current behavior. Conversation history is secondary to repository evidence.

### Task packets

Non-trivial agent tasks should include:

```text
Goal
Target worktree and branch
In-scope files and non-goals
Public/private boundary
Contracts and stable IDs
Acceptance behavior
Required verification
Integration owner
Continuation path
```

Parallel work is partitioned by ownership, not by file count. One integration owner resolves shared contracts and runs final verification.

### Agent-specific safeguards

- Never read or print `.env` or credential material.
- Never use `--no-verify`, force push, direct main commits or unapproved deploys.
- Do not declare a second reviewer when only self-review occurred.
- Do not treat generated concepts, static screenshots or plausible output as runtime proof.
- Preserve rejected attempts and baseline differences.
- Stop and report concrete blockers instead of replacing the requested problem with an easier one.

## CI and review process

### Required checks by change type

| Change | Required evidence |
|---|---|
| Comment/documentation | Links, generated docs and meaning review |
| English-only source or message-resource migration | Behavior equivalence, stable IDs and missing-ID checks in both locales |
| Simulation/gameplay | Deterministic regression and consumer-visible behavior |
| Map/visual | Fixed cameras, free roam, routes, low/medium and budget |
| Pack pipeline | Valid/invalid fixtures, signatures, hashes and immutable installation |
| Platform shell | Lifecycle, input, capabilities and store smoke tests |
| Backend/payment | Authorization, idempotency, replay and reconciliation |
| Infrastructure | Plan review, drift, preview/staging and rollback |

No change type is approved only because unrelated full-suite checks are green.

### Pull request rules

- Keep one behavioral purpose per PR.
- Separate mechanical English changes from architecture changes.
- Update affected callers, tests and documentation in the same change.
- Remove obsolete code and generated artifacts through clean cutover.
- Record pre-existing failures with baseline comparison instead of hiding them.
- Keep merge and deployment owner-controlled.

## Community and governance

A conference-ready public project needs more than readable source:

- `CODE_OF_CONDUCT.md`.
- `SECURITY.md` with private vulnerability reporting.
- `CONTRIBUTING.md` with setup and review expectations.
- `GOVERNANCE.md` with maintainers and decision rights.
- `SUPPORT.md` with supported channels and response boundaries.
- Issue and pull-request templates in English.
- ADRs for consequential decisions and a readable changelog.
- Explicit licensing for source, documentation, references and content packs.

Do not choose a public-source license implicitly. Source-code licensing and community content licensing are separate owner decisions.

## Creator workflow

External creator intake remains blocked until every control below has a named accountable owner, written approval and linked end-to-end test evidence:

- Contributor license grants covering submitted content and its distribution in content packs.
- Rights and provenance for reference material and AI-assisted or AI-generated content, including rejection when the required rights cannot be demonstrated.
- Takedown authority, including who may authorize and execute a takedown.
- CDN and client tombstones, with tested propagation to edge caches and enforcement for previously installed clients.
- An appeals workflow that records requests, decisions and restoration or continued revocation.
- Retention rules for submissions, provenance, license evidence, moderation decisions, appeals and tombstones.
- Response owners and deadlines for submission review, takedown handling and appeals.

Tests must exercise insufficient rights or grants, takedown issuance, CDN/client tombstone enforcement, appeal resolution and retention expiry. Moderation approval alone does not unblock intake. Local tooling and contract development may continue, but no external submission is accepted, hosted or published while this gate remains open.

After the intake gate lifts:

1. Creator selects a supported map or character contract.
2. Studio provides research, deterministic tooling and local preview.
3. Automated checks validate format, paths, budgets, provenance and inert content.
4. Gauntlet evidence is reviewed by an independent reviewer where required.
5. Moderation and licensing are approved.
6. An authorized release process signs the pack.
7. The client validates runtime compatibility before promotion.
8. Attribution, version history, rejection, takedown and appeals remain auditable under the approved retention rules.

Creators never receive production deployment, signing or backend privileges.

## Documentation architecture

Keep four distinct audiences separate:

| Audience | Documentation |
|---|---|
| Players | Localized game help, controls and store information |
| Contributors | Setup, architecture, tests and review process |
| Agents | Machine-discoverable contracts, ownership and execution boundaries |
| Creators | Research, kits, pack contracts, gauntlets and publication |

Avoid mixing incident history into the canonical quickstart. Preserve it as linked evidence with an English summary when needed.

## Conference readiness checklist

- Public repositories contain no private source assets or credentials.
- English quickstart reaches a deterministic playable demo.
- Architecture diagrams match the current implementation and mark future work.
- A clean CI run and a release evidence package are linked.
- The demo works without paid APIs or private services.
- Known limitations are visible rather than hidden behind a polished screenshot.
- Community, security and licensing policies are published.
- A new contributor can identify where to make a change and how to prove it.

## Process success measures

- Time to first local match for a new contributor.
- Time for an agent to discover the correct contract without chat history.
- PR duration, review iterations and rollback frequency.
- Flaky-check rate and duplicated-gate drift.
- Frequency of broken releases caused by generated-file or documentation drift.
- Contributor submissions accepted without maintainer intervention in the runtime.

Measure these before assigning improvement targets. The process exists to make correct change easier, not to increase ceremony.
