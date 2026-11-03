# Future Studio → client integration

The integration is not implemented yet. This document defines the target contract without coupling the public studio to a client working branch.

## Flow

1. The Studio validates a release candidate.
2. The owner approves its content and evidence.
3. Immutable files and a manifest are published with hashes.
4. A client PR pins the content kind, ID, version and SHA-256.
5. The client runs its own integration checks.
6. Merge and deployment remain owner-controlled.

## Rules

- No pack references a Studio working branch.
- No pack contains executable JavaScript.
- Every file has a hash; every release records provenance and licensing.
- Map packs declare geometry, textures, LODs, collision, navigation, spawns, regions and previews.
- Character packs declare compatible rigs, animations, materials, skins and previews.
- `low` is a required output profile.
- The client may reject a Studio-valid release if it violates runtime contracts.

## Versioning

The schema uses `schemaVersion`. Incompatible changes require a new major version and an explicit migration. Unknown fields are data, never commands.
