# Studio → client integration

Local candidate packaging and validation are implemented for the Lajes vertical slice. Client loading, runtime promotion and deployment are not implemented by these tools. This document defines the boundary without coupling the public Studio to a client working branch.

## Flow

1. The Studio inventories private staging bytes, validates the scene gauntlet and writes a private release candidate atomically.
2. The candidate manifest and binary payload remain in private storage; the public repository does not contain a genuine Lajes candidate manifest or model payload.
3. The owner reviews its content, provenance, previews, rejected attempts and explicit limitations. Tool validation alone is not approval.
4. After explicit approval, immutable files and a manifest may be published with hashes.
5. A client PR pins the content kind, ID, version and SHA-256 and runs its own integration checks.
6. Runtime promotion, merge and deployment remain separate owner-controlled decisions.

## Rules

- No pack references a Studio working branch.
- No pack contains executable JavaScript filenames, shebang payloads, native executable images or WASM binaries.
- Every file has a hash and byte size; validation reads the actual bytes and rejects mismatches, duplicate entries and symlinks that escape the package root.
- Every release records provenance and licensing.
- Map packs declare geometry, textures, LODs, collision, navigation, spawns, regions and previews. Every payload path has exactly one role and exactly one `files` entry; undeclared or missing files are rejected.
- All payload paths are canonical package-relative paths. Absolute paths, traversal segments, backslashes and executable JavaScript are rejected.
- Character packs declare compatible rigs, animations, materials, skins and previews.
- `low` is a required output profile.
- The client may reject a Studio-valid release if it violates runtime contracts.

## Versioning

The schema uses `schemaVersion`. Incompatible changes require a new major version and an explicit migration. Unknown fields are data, never commands.
