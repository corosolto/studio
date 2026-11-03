# English Migration Program

Status: proposed

## Objective

Make the project presentable and maintainable for an international engineering and creator community without changing gameplay, public contracts or Brazilian identity.

This is a language and maintainability migration, not a license to rename every stable identifier or rewrite working logic.

## Canonical language policy

Use this rule across repositories:

> Write all new source code, comments, documentation, commits, pull requests, issue responses, automation and CI output in English. Player-facing content is localized through the product i18n system. Stable public identifiers, cultural names and historical evidence are preserved intentionally.

New files follow the rule immediately. Legacy files migrate by owning subsystem with behavior evidence.

## Scope matrix

| Surface | Migration | Guard |
|---|---|---|
| Source identifiers | Migrate when the owning module changes | Behavior and API compatibility checks |
| Source comments | Replace inaccurate/Portuguese comments with current English behavior | No comment-only claims treated as runtime proof |
| Canonical developer docs | Replace with English canonical documents | Link and generated-document checks |
| CI and bot output | Translate jobs, messages and summaries | Workflow self-tests and log review |
| Agent instructions | English canonical `AGENTS.md` and scoped guides | Agent can complete the golden path from a clean checkout |
| New file names | English from creation | Repository language check |
| Legacy source file names | Rename only with the module and every import updated | Import map, build and runtime checks |
| Generated files | Translate the generator, then regenerate | Generator check shows no manual drift |
| Test/eval script names | Preserve stable command IDs initially; provide English descriptions | CI/local command compatibility |
| Game strings | Extract dynamic strings into message IDs and localized values | PT-BR and English screenshot/interaction checks |
| Historical evidence | Preserve original language when useful for provenance | New English summary and links |
| Public IDs and URLs | Never translate as part of this program | Contract tests prove stability |

## Explicit preservation list

Do not translate or rekey without a separately reviewed compatibility migration:

- Map IDs and aliases recorded in matches and URLs.
- Character, faction, weapon, asset and pack IDs.
- Database columns, RPC argument names and public API fields.
- GLB node, rig, socket and animation names.
- Published media paths and immutable release paths.
- Portuguese keys used by the current exact-match localization dictionary.
- Brand names, character names, graffiti and Brazilian cultural terms.
- Historical incident and review evidence.

These are compatibility contracts, not untranslated leftovers.

## Migration waves

### E0 — Inventory and policy

1. Adopt the language policy in every repository.
2. Inventory generated files, stable command names, public IDs and localization keys.
3. Create a glossary for technical terms and Brazilian terms that remain unchanged.
4. Add a changed-file language check with positive and negative fixtures.

Gate: no runtime change and no generated-file drift.

### E1 — Public and agent-facing surface

Migrate:

- `README`, `AGENTS`, `CONTRIBUTING`, `SECURITY`, `SUPPORT` and governance files.
- Issue/PR templates and CI/bot output.
- Setup, architecture, quality and release guides.
- New Studio and client integration documents.

Gate: a new contributor can complete setup and a deterministic local match using only English documentation.

### E2 — Tooling and test descriptions

1. Translate test descriptions, log output and script rationale comments.
2. Preserve existing npm/eval command IDs until their consumers are deliberately migrated.
3. Split monolithic gate lists into named lanes with English ownership metadata.
4. Update generators rather than generated artifacts.

Gate: existing command entrypoints still work; output and documentation are English.

### E3 — Runtime modules

Migrate one subsystem at a time:

1. Establish the behavior baseline and consumer contract.
2. Rename internal identifiers and comments.
3. Rename source files only when it improves ownership and every reference can be updated.
4. Run the module's real behavior checks and compare with baseline.
5. Remove obsolete names when the cutover is complete; preserve only intentional external IDs.

Gate per subsystem: no behavior or public-contract change.

### E4 — Backend and admin

Apply the same module approach to APIs, operations and admin. Do not rename database or API contracts as part of an English-only PR. If an English contract is valuable, introduce a versioned API with an explicit migration and owner-approved SQL.

### E5 — Product internationalization

The current `public/js/i18n.js` uses exact Portuguese string matching. Dynamic and concatenated strings are not reliably covered.

Target:

1. Stable message IDs independent of source language.
2. `pt-BR` and `en` locale resources owned by the product, not by code renames.
3. Parameterized messages instead of concatenation.
4. Localized DOM at initial render and dynamic updates.
5. Screenshot and interaction checks for both locales.

Weapon nicknames and culturally specific content remain intentional localization decisions.

## File and generated-artifact rules

- Never edit a generated bundle to make it appear translated.
- Update its source generator and regenerate all language variants.
- Do not rename a published asset URL to make the repository look English.
- Prefer leaving a low-value legacy source filename until its module changes over performing a repository-wide rename.
- Use repository-wide reference checks for every renamed source module.

## CI language check

The check should operate on changed files and explicit exemptions, not unreliable language detection over the entire repository.

Required cases:

- Reject a new Portuguese CI job or bot message.
- Accept an English source change containing a preserved Portuguese map ID.
- Accept a historical evidence file marked as preserved.
- Accept PT-BR locale resources and player-facing content.
- Reject a newly generated Portuguese document when its English source was not updated.

The check must have mutants proving both acceptance and rejection paths.

## Completion definition

The English migration is complete for a module when:

- Its canonical source, comments and developer documentation are English.
- Its CI and agent output are English.
- Its generated files are reproducibly generated from English sources.
- Its public IDs and product localization remain compatible.
- No duplicate canonical Portuguese document remains unless explicitly classified as historical evidence.
- Its behavior and regression evidence match the pre-migration baseline.

Completion is measured module by module, not by an unsafe repository-wide find-and-replace.
