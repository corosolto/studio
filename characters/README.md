# Characters

Each character production includes research, concepts, private editable sources, rig, animations, materials, gauntlets and releases. Each character ships as its own pack under the contract in [docs/character-pack.md](../docs/character-pack.md) (shared meshy-28 rig, per-state clips, previews, rights and budgets); the pilot is `capitao-caveira`.

`characters/<id>/rig.json` (and an optional `joints.json` override next to it) configure the Blender rig pipeline for that character; see [docs/character-rig.md](../docs/character-rig.md). Only these small JSON files live here: meshes, rigs and renders stay in the private work directory.
