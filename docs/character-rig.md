# Character rig (Blender pipeline)

Rigs a new, unrigged character mesh (a Mint final) onto the shared **meshy-28** skeleton in a reproducible way, replacing the proximity auto-skin of the client's `tools/rig-from-donor.mjs` for new characters. The method: clean mesh → split into body parts → place joints per character from orthographic views on a 5 cm grid (`joints.json`) → build the meshy-28 armature → rule-based weights → numeric pose test.

The output is a skinned GLB that satisfies the [character pack contract](character-pack.md) (`skeleton: "meshy-28"`) and works with the shared clips and the client's `tools/retarget-glb.mjs`.

Blender (5.2 LTS) runs locally only; CI runs the deterministic Node check (`tools/checks/character-rig-check.mjs`, part of `npm run check`). Every intermediate and output file holds private character bytes and lives in a work directory **outside** this repository.

## Run

```bash
node tools/characters/rig-character.mjs \
  --config=characters/<id>/rig.json \
  --work=<private work dir>/<id> \
  --source=<mint-final.glb> \
  --clips-from=<client>/public/models/anims/mixamo \
  --retarget=<client>/tools/retarget-glb.mjs
```

`--from=<step>` resumes at `clean`, `parts`, `joints`, `armature`, `weights`, `assemble` or `pose` (for example after adding a `joints.json` override); `--to=<step>` stops early. `--blender=<path>` or `BLENDER` selects the binary (default `/Applications/Blender.app/Contents/MacOS/Blender`).

Every Blender step exits 1 on any Python exception (`C.run_main`; plain `blender --python` exits 0). Before a step runs, the runner deletes its outputs and those of every later step, including the orthographic renders, their `.view.json` sidecars and the review sheets (also with `--skip-review`); afterwards each output must exist and be newer than the step, whatever the exit code. `<work>/run-manifest.json` records per step the SHA-256 of its inputs (source, config, joints override) and outputs, and `--from` refuses to resume when a skipped step's outputs or inputs changed since it ran. Each Blender step can also run alone:

```bash
Blender -b --factory-startup --python tools/blender/character_rig/rig_<step>.py -- --config characters/<id>/rig.json --work <dir> [--source <glb>]
```

## Steps

| Step | Tool | Writes (in the work dir) |
| --- | --- | --- |
| clean | `tools/blender/character_rig/rig_clean.py` | `clean.blend`, `clean.json`, `clean-front/back/side.png` |
| parts | `tools/blender/character_rig/rig_parts.py` | `parts.blend`, `parts.json`, `parts-*.png`; `parts-review.png` (`rig-review.mjs parts`) |
| joints | `tools/blender/character_rig/rig_joints.py` | `joints.json`, `joints-estimate.json`, `joints-front/side.png`; `joints-review.png` (`rig-review.mjs joints`) |
| armature | `tools/blender/character_rig/rig_armature.py` | `armature.blend` |
| weights | `tools/blender/character_rig/rig_weights.py` | `weights.blend`, `weights.json`, `blender-rig.glb` |
| assemble | `tools/characters/rig-assemble.mjs` | `<id>.blender.glb` (the meshy-28 model) |
| pose | `retarget-glb.mjs` (client) + `tools/characters/rig-pose-test.mjs` | `clips/*.glb`, `pose-test.json` |

**clean** turns the source so the character faces −Y in Blender (+Z in glTF; `forward` names the axis the source faces), scales it to `targetHeight` with the feet on z = 0, centres the legs on the origin, applies every transform, merges coincident seam vertices by distance (`mergeDistance`, 0.1 mm), dissolves degenerate faces and recalculates outward normals. `clean.json` reports seam vertices before/after the merge, flipped faces, zero-area faces, boundary and non-manifold edges, loose parts and the measured height.

**parts** tags every face (`rig_part` face attribute) from landmarks of a 1 cm front silhouette and Y-ray cross-sections: legs below the crotch (first row where the midline is 2.5% of the height deep, so touching thighs still split), arms outside the armpit and above it, hands past the wrist, head above the narrowest neck row, torso for the rest. The wrist is the thinnest arm section just inside the widest palm section, or, with `parts.skinColors`, where skin-coloured texels start on the distal arm. The rigid hand part starts `parts.handPartOffset` × height past the wrist (default 0.03). `extras` carve out accessories by AND-combined selectors over position (`box`), texture colour (`colors` + `tolerance`), loose islands (`islandMaxFaces`) and current part (`from`), each with `rigid` (100% on one bone) or `bones` (allowed set). `parts.json` lists the face counts, the landmarks and the texture palette (k-means hex colours) to write colour selectors against. Review `parts-review.png` before going on.

**joints** estimates all 26 distinct meshy-28 joints on the body without extras (a backpack or an antenna must not pull the spine or the head), every joint on the centroid of its limb or torso cross-section: shoulder just inside the armpit on the line fitted through the outer arm sections, elbow at `elbowRatio` of shoulder→wrist, hip at the crotch row + `hipAboveCrotch`, ankle at the thinnest leg section near the floor, knee at the strongest side-profile bend (bent mascot legs) or at `kneeRatio`, toe on the ball of the foot, `Hips`/`Spine` on the torso centroid with `Spine02`/`Spine01` on the line between them, `Head` just above the narrowest neck row. Ratios under `joints` in the config override the defaults, which were measured on the donor mesh (see Calibration). `joints-review.png` shows the front and side orthographic views with the 5 cm grid (labels in metres) and every joint; a `joints.json` next to the config (or `jointsOverride`) moves any subset of joints and wins:

```json
{ "joints": { "LeftArm": [0.17, 0.10, 1.36], "RightArm": [-0.17, 0.10, 1.36] }, "tips": { "LeftHand": [0.73, 0.0, 1.33] } }
```

`tips` moves the hand or toe tips the bones aim at. The `Curl` helpers always follow the hand joint, and the joints step stops when a hand tip is not past its hand joint along the forearm (the aligned hand frame would turn back up the arm); `validateJoints` repeats that check before the armature is built.

Coordinates are clean-space metres: +Z up, the character faces −Y, its left is +X (front view: right of the image is +X; side view: right of the image is +Y, the back).

**armature** builds one bone per meshy-28 joint on `joints.json` with the contract's parents; bones point at their chain child (hands and toes at the measured tips). Blender needs unique names, so the second `Curl_R`/`Curl_L` pair is `Curl_R.001`/`Curl_L.001` until assembly. `head_end`, `headfront` and the `Curl` helpers do not deform.

**weights**:

1. Heat (automatic) weights on the cleaned mesh; a voxel remesh of the body (`voxelSize` × height) is heat-weighted too and transfers its weights to vertices heat left bare (loose islands such as eyes or pouches), or to every vertex when heat failed on a limb bone or left more than `heatFailShare` of the main shell bare.
2. Part rules: torso, vest and backpack never carry arm bones; legs carry only their own chain plus `Hips`; arms their own chain plus `Spine` and the clavicle; hands are 100% on their `Hand`; the head is 100% on `Head` above `Head` + `headRigidAbove` × height; extras follow their `rigid`/`bones`.
3. Continuity: a bone allowed on one side of a part boundary and forbidden on the other fades to zero towards the boundary over `rampLength` × height of surface distance. The fade scales existing weights, so where a vertex carries nothing on the bones allowed across the boundary, normalisation restores the old ratios and a step can remain; the pose test is the guard.
4. Smoothing inside a part only, tapering to nothing at `smoothRadius` × height from `smoothJoints` (shoulders and knees), never on part-boundary or rigid vertices, never across parts. Elbows are not smoothed by default: on capitao-caveira it raised the worst walk stretch at the back of the elbow from 2.88× to 4.28×.
5. Linear hinge blends (`linearBlends`, wrists by default): the ForeArm+Hand share is re-split by position along the forearm axis, smoothstep over ±halfWidth × height, because heat switches ForeArm→Hand within one edge ring.
6. Hanging cloth: extras with `kind: "skirt"` (coat skirts, skirts, cassocks) or `kind: "cape"` get procedural weights. Above the hips they follow the spine chain by height; below the hip joints they fade into the thighs down to the knees, split left/right by x, with 80% (skirt) or 45% (cape) of the weight on the legs at knee height and the rest on `Hips`.
7. Groin: within `groinBand` × height (0.05) of the crotch and between the thigh joints, the thigh share moves to `Hips`, fully on the midline, so spreading the legs does not tear the crotch.
8. Gradient limit: the ramps of step 3 only scale weights that already exist, so neighbouring vertices could still switch bones within millimetres (heat on layered cloth, proxy transfer across fused voxels, binary weights on small islands). Every edge whose weight change exceeds its length over `gradientRamp` × height (0.025) is relaxed towards its neighbour, rigid vertices held fixed, until no edge exceeds it (`gradientIterations`). This creates shared influence across part borders.
9. At most 4 influences per vertex, normalised. `weights.json` reports the method, bare vertices, the largest arm weight left on no-arm parts (must be 0), the minimum `Hand` weight on hand vertices (must be 1), cloth and groin vertex counts, the gradient-limit iterations and the influence histogram.

**assemble** drops Blender's skeleton and builds the meshy-28 skin in contract order (duplicate `Curl` pair included) under an `Armature` node scaled 0.01 (centimetre bones, metre mesh, like the donor), with fresh inverse bind matrices; it fails unless the bind pose reproduces the mesh to 0.1 mm. Rest frames: spine, legs, clavicles and head keep the donor's rest world rotations (`MESHY28_REST_WORLD` in `tools/lib/character-rig.mjs`; the client's `retarget-glb.mjs` applies world-rotation deltas there). `LeftArm`, `LeftForeArm`, `LeftHand` and their right counterparts are turned by the shortest arc that puts local +Y (the meshy-28 bone axis) on the measured bone, because `retarget-glb.mjs` copies the clip's **absolute** world rotations onto every Arm/Hand bone: only an aligned frame makes the character's arm segments point where the clip's arms point (Mint T-poses angle the arms forward, the donor's angle them ~20° back).

## Pose test

`node tools/characters/rig-pose-test.mjs <model.glb> --clips=<dir> --out=<report.json> [--strict] [--bake=<pose>[@<fraction>]:<out.glb>]` skins on the CPU exactly like three.js (`Σ w · jointWorld · IBM · v`) and measures five synthetic poses (arms up 90°, arms forward 60°, a step with each leg, head turned 60°) and 8 instants of each of the 11 state clips (pass the clips retargeted to that model). Per pose: the longest edge stretch versus the bind pose, the 99th percentile, the upper-back region (between `Hips` and `neck`, behind `Spine01`), each hand (edges touching ≥ 25% hand weight, the client's `rig-maos-check` rule), the largest gap between vertices welded in the bind pose (UV seams), and the 10 worst vertices with their bones. `--bake` writes a static posed copy for renders (`tools/blender/character_rig/render_poses.py`, front/back/three-quarter with identical framing; `rig-review.mjs sheet` makes contact sheets).

Thresholds (`POSE_THRESHOLDS`): body and upper back ≤ 3.5× (the donor reaches 3.04× on its own clips), hands ≤ 2.5× (the client hand gate), seams ≤ 5 mm, bind error ≤ 2 mm. `--strict` exits 1 on any failure.

## Configuration (`characters/<id>/rig.json`)

| Key | Meaning |
| --- | --- |
| `id`, `forward`, `targetHeight` | Folder id; axis the source faces (`-Y`, `+Y`, `-X`, `+X`); height in metres after cleaning. |
| `mergeDistance` | Seam merge distance in metres (default 0.0001). |
| `parts.skinColors`, `parts.skinTolerance` | Hex colours of bare hands; the wrist moves to where they start. |
| `parts.handPartOffset`, `parts.armShoulderInset`, `parts.wristX` | Rigid hand start past the wrist (× height); how far the arm part reaches inside the armpit; wrist override (absolute x). |
| `extras[]` | `{ name, select: { from, box: {min, max}, colors, tolerance, islandMaxFaces }, rigid \| bones \| kind, measure }`; `kind` is `skirt` or `cape`; `measure: true` keeps the extra in the joint measurement (default for skirts; accessories are measured out). |
| `joints.*` | Estimator ratios (`shoulderInset`, `shoulderRaise`, `clavicleRatio`, `elbowRatio`, `hipAboveCrotch`, `hipsAboveUpLeg`, `kneeRatio`, `kneeBendMin`, `kneeForward`, `ankleWindow`, `toeRatio`, `toeHeightRatio`, `spineBelowShoulder`, `neckRatio`, `headAboveNeck`, `headfrontForward`). |
| `jointsOverride` | Override file relative to the config (default `joints.json`). |
| `weights.*` | `heatFailShare`, `voxelSize`, `headRigidAbove`, `rampLength`, `smoothRadius`, `smoothIterations`, `smoothJoints`, `linearBlends`, `groinBand`, `gradientRamp`, `gradientIterations`. |

## Calibration

The joint ratios were measured by running clean → parts → joints on the donor mesh itself (client `public/models/characters/mst.glb`, with its backpack and flag as extras) and comparing with the donor's joints: mean error 4.0 cm over the 24 skeleton joints. Knees, ankles, toes, elbows, wrists, `Head`, `head_end` and `headfront` land within 2.5 cm. The differences are front-to-back: the estimator puts the spine on the torso centroid, 7 to 9 cm in front of the donor's spine (which follows the anatomical spine near the back), the hips and `Hips` 5 to 7 cm forward, and the shoulders on the fitted arm line, 7 cm behind the donor's.

## Pilots (2026-11-09)

Old rigs: `transplant` is the raw `rig-from-donor.mjs` transplant, `pr1253` the client PR #1253 rig with fitted elbow/wrist (the rig of `capitao-caveira@0.1.1`); `mst` is the donor on its own clips, for reference. Clips are the shared clips retargeted onto each rig. Hand numbers from the client gate (`tools/eval/rig-maos-check.mjs`, raw shared clips) match the pose test's hand columns.

| capitao-caveira | transplant | pr1253 | Blender | mst |
| --- | --- | --- | --- | --- |
| clip worst edge | 86.37× | 72.90× (crouchwalk) | 2.62× (death) | 3.04× |
| clip upper back / backpack | 26.58× | 72.90× (crouchwalk) | 2.49× (crouch) | 3.04× |
| clip hand L / R | 86.37× / 36.41× | 1.44× / 1.31× | 1.22× / 1.23× | 1.68× / 1.30× |
| synthetic worst edge | 17.97× | 43.72× (arms forward) | 3.01× (arms up) | 2.19× |
| seam gap | 0 | 0 | 0 | 0 |
| triangles / height | 4905 / 1.70 m | 4905 / 1.70 m | 4905 / 1.70 m | 4929 / 1.70 m |

| teletreco-sinal-fraco | transplant | pr1253 | Blender | mst |
| --- | --- | --- | --- | --- |
| clip worst edge | 86.42× | 93.87× (death) | 2.81× (death) | 3.04× |
| clip hand L / R | 86.42× / 12.81× | not measurable (no hand weights) | 1.40× / 1.32× | 1.68× / 1.30× |
| synthetic worst edge | 49.16× | 69.00× (arms up) | 2.18× (arms up) | 2.19× |
| triangles / height | 5022 / 1.70 m | 5022 / 1.70 m | 5022 / 1.30 m | 4929 / 1.70 m |

The plush mascot keeps human-like clip motion: idle, walk, run, crouch, crouchwalk, jump and death read as plausible; in shoot and walkfire its short arms hold the hands 0.10 × height apart against the donor's 0.20, so a two-handed weapon cannot reach both hands.

## Limits

- The arm-band test accepts arms down to 1.5× the torso half-width away from the body (A-poses); closer arms need a `joints.json` override. The crotch is measured on the full mesh in the parts step, because removing extras can open the mesh.
- Joint positions are a first estimate: always look at `joints-review.png` and `parts-review.png`.
- Heat weighting can fail on non-manifold meshes; the voxel proxy covers it, but check `weights.json` (`method`, `heat.unweightedVertices`).
- Hips translation and in-place motion come from `retarget-glb.mjs`; this pipeline does not author clips.
- `Curl_L`/`Curl_R` carry no skin (hands are 100% `Hand`), as in the rigs from `rig-from-donor.mjs`: the client's grip curl rotates those bones but the fingers do not close around the weapon.
- The pipeline run (`rig-character.mjs`) fails when the pose test fails (`--strict`); `--no-clips` limits it to the synthetic poses.
