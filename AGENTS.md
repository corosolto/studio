# Agent and CI policy

## Language

Write all new documentation, code comments, commit messages, pull requests, issue responses, automation and CI output in English. Historical evidence may remain in its original language when translation would reduce provenance value.

## Public/private boundary

This is a public repository. Never commit editable source assets, licensed packs, credentials, private URLs containing tokens, unpublished production bundles or files matching `.blend`, `.blend1`, `.glb`, `.fbx`, `.mdl` or `.unitypackage`.

Store those files in `corosolto/studio-assets`, which remains private. Removing a sensitive file in a later commit is not sufficient because history would still contain it.

## Production

Research precedes asset production. Every map or character follows documented gauntlet loops with references, fixed cameras, A/B evidence, explicit limitations and owner approval. Do not represent concept art as proof of runtime fidelity or performance.

## Automation

CI must be deterministic, must not call paid generation services and must report in English. Runtime integration tests remain in the client repository.
