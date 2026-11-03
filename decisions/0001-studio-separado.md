# ADR 0001 — Separate the open studio from private assets

Date: 2026-11-03
Status: accepted by the owner

## Context

Map and character production mixed research, authoring tools, editable sources and licensed assets with the game client. Publishing that history would expose private assets even if their files were deleted in a later commit.

## Decision

Maintain two repositories:

- `corosolto/studio`: public, with a clean history containing research, studies, tools, contracts and review evidence.
- `corosolto/studio-assets`: private, preserving editable sources, licensed source packs, unpublished production files and the original studio history.

The client remains responsible for runtime behavior and integration checks. It will consume approved, immutable packs through a later versioned integration.

## Rules

- No private binary source formats in the public repository.
- No credentials or arbitrary executable code in community packs.
- New repository content and CI output use English.
- Historical evidence may retain its original language.
- The Studio never deploys the game or consumes a client working branch.

## Consequences

Public contributors can study and improve the production process without receiving private source assets. Releases require explicit provenance, hashes and owner approval.
