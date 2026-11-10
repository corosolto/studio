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

**parts** tags every face (`rig_part` face attribute) from landmarks of a 1 cm front silhouette and Y-ray cross-sections: legs below the crotch (first row where the midline is 2.5% of the height deep, so touching thighs still split), arms outside the armpit and above it, hands past the wrist, head above the narrowest neck row, torso for the rest. The wrist is the thinnest arm section just inside the widest palm section, or, with `parts.skinColors`, where skin-coloured texels start on the distal arm. The rigid hand part starts `parts.handPartOffset` × height past the wrist (default 0.03). `extras` carve out accessories by AND-combined selectors over position (`box`), texture colour (`colors` + `tolerance`), loose islands (`islandMaxFaces`), current part (`from`) and connectivity (`grow`), each with `rigid` (100% on one bone) or `bones` (allowed set). `grow: { seeds: [[x, y, z], …], crease, thickness }` keeps only the faces connected to the seed points (each within 5 cm of the surface): the region spreads over shared edges while the other selectors allow the face and the fold stays under `crease` degrees (default 40), so a cape's outer sheet stops at its hem and at the seams where it is fused to a boot or a coat; `thickness` (m) then adds every face connected to it through faces within that distance (the hem fold and the inner side of a thin sheet). A box only bounds the growth, so the back half of a leg or a boot inside a cape's box is no longer cape. `cut: ["leg_L", "leg_R"]` deletes the extra's faces that share a vertex with those parts, so a hem fused to a trouser leg or a heel hangs free instead of tearing between the cloth weights and the leg weights; the cut only removes one face ring, it never moves or welds vertices (`parts.json` reports `cutFaces`). `parts.json` lists the face counts, the landmarks and the texture palette (k-means hex colours) to write colour selectors against. Review `parts-review.png` before going on.

**joints** estimates all 26 distinct meshy-28 joints on the body without extras (a backpack or an antenna must not pull the spine or the head), every joint on the centroid of its limb or torso cross-section: shoulder just inside the armpit on the line fitted through the outer arm sections, elbow at `elbowRatio` of shoulder→wrist, hip at the crotch row + `hipAboveCrotch`, ankle at the thinnest leg section near the floor, toe on the ball of the foot, `Head` just above the narrowest neck row. The knee is searched only in the middle of the leg (`kneeWindow`, 0.38–0.62 of ankle→hip, so folds above a boot and at the hip are ignored): the strongest forward bend of the side profile of at least `kneeBendMin` (a bent leg; a bend backwards is a calf, a fold or a boot back), else the narrowest leg section between thigh and calf (cross-section area smoothed over 5 cm, `kneeProminence` below its sides, no row-to-row step over `kneeStepMax`, which is what a boot top or a coat hem looks like), else `kneeRatio`. `Hips`, `Spine02`, `Spine01` and `Spine` sit on the torso medial axis: the centroids of horizontal sections every 1 cm, sections off their running median dropped (a pouch, a belt buckle), and a tricube-weighted local line through the sections within 3% of the height of each joint; `neck` takes the median of its own narrower sections. `joints.shoulderAt: "junction"` moves the shoulder from the armpit (the torso run under the arm band, which a wide sleeve, a dropped T-shirt shoulder or an epaulette pushes out) to the arm-torso junction, where the underarm gap of the front silhouette opens; it is opt-in because it regressed most characters with fitted sleeves (see Limits). Ratios under `joints` in the config override the defaults, which were measured on the donor mesh (see Calibration). `joints-review.png` shows the front and side orthographic views with the 5 cm grid (labels in metres) and every joint; a `joints.json` next to the config (or `jointsOverride`) moves any subset of joints and wins:

```json
{ "joints": { "LeftArm": [0.17, 0.10, 1.36], "RightArm": [-0.17, 0.10, 1.36] }, "tips": { "LeftHand": [0.73, 0.0, 1.33] } }
```

`tips` moves the hand or toe tips the bones aim at. The `Curl` helpers always follow the hand joint, and the joints step stops when a hand tip is not past its hand joint along the forearm (the aligned hand frame would turn back up the arm); `validateJoints` repeats that check before the armature is built.

Coordinates are clean-space metres: +Z up, the character faces −Y, its left is +X (front view: right of the image is +X; side view: right of the image is +Y, the back).

**armature** builds one bone per meshy-28 joint on `joints.json` with the contract's parents; bones point at their chain child (hands and toes at the measured tips). Blender needs unique names, so the second `Curl_R`/`Curl_L` pair is `Curl_R.001`/`Curl_L.001` until assembly. `head_end`, `headfront` and the `Curl` helpers do not deform.

**weights**:

1. Heat (automatic) weights on the cleaned mesh; a voxel remesh of the body (`voxelSize` × height) is heat-weighted too and transfers its weights to vertices heat left bare (loose islands such as eyes or pouches), or to every vertex when heat failed on a limb bone or left more than `heatFailShare` of the main shell bare.
2. Part rules: torso, vest and backpack never carry arm bones; legs carry only their own chain plus `Hips`; arms their own chain plus `Spine` and the clavicle; hands are 100% on their `Hand`; the head is 100% on `Head` above `Head` + `headRigidAbove` × height; extras follow their `rigid`/`bones`. Opt-in height limits: with `thighCeiling`, vertices on no leg part carry the thighs no higher than that fraction of UpLeg → Hips; with `clavicleFloor`, vertices on no arm part carry the clavicles no lower than that fraction of Spine02 → Spine01 (heat lets a thigh climb a coat front or a clavicle slide down a chest). Switched on for every character they made five passing rigs fail, so they stay off by default. Two more opt-in limits act on vertices of no limb part: `chainLocality` (× height) allows each spine-chain bone (`Hips` … `neck`) only between its parent and child joints plus the margin, where a linear blend along the chain would weight it (heat left `Hips` 0.30 on vlad's chest 25 cm above the joint); `sideExclusive` (× height) removes every `Left*` bone from vertices more than the margin right of the midline and every `Right*` bone from the other side (heat through satanista-talkshow's collar put `RightShoulder` 0.14 on the left armpit). satanista-talkshow passes with both (`0.02`, `0.03`) plus `gradientRamp` 0.04 and shoulder → arm `linearBlends` (worst clip 3.79× → 3.39×).
3. Continuity: a bone allowed on one side of a part boundary and forbidden on the other fades to zero towards the boundary over `rampLength` × height of surface distance. The fade scales existing weights, so where a vertex carries nothing on the bones allowed across the boundary, normalisation restores the old ratios and a step can remain; the pose test is the guard.
4. Smoothing inside a part only, tapering to nothing at `smoothRadius` × height from `smoothJoints` (shoulders and knees), never on part-boundary or rigid vertices, never across parts. Elbows are not smoothed by default: on capitao-caveira it raised the worst walk stretch at the back of the elbow from 2.88× to 4.28×.
5. Linear hinge blends (`linearBlends`, wrists by default): the ForeArm+Hand share is re-split by position along the forearm axis, smoothstep over ±halfWidth × height, because heat switches ForeArm→Hand within one edge ring.
6. Hanging cloth: extras with `kind: "skirt"` (coat skirts, skirts, cassocks) or `kind: "cape"` get procedural weights. Above the hips they follow the spine chain by height; below the hip joints they fade into the thighs down to the knees, split left/right by x, with 80% (skirt) or 45% (cape) of the weight on the legs at knee height and the rest on `Hips`. Vertices on the seam between two cloth extras (a coat split into `coat-upper` and `coat-lower`) take the mean of both extras' cloth weights; left on heat, vlad's seam carried `Hips` 0.61 + `RightUpLeg` 0.28 next to cloth vertices at `Hips` 0.96 and tore in death (4.05× → 3.58× with the seam rule). Opt-in `frontPanel` on a cloth extra (`true` or `{ "share": 0.25, "spread": 3 }`): in front of the hip joints (blended in over one hip half-width) the cloth below the hips follows both thighs, split over ±`spread` × the hip half-width instead of ±1, with `share` of the weight on the legs at knee height instead of the kind's share. On vlad's `coat-lower` it changed nothing measurable (3.583× with and without): the remaining tear was the groin, not the coat front.
7. Band models (opt-in, `waistBand` and `neckBand`, × height): inside a horizontal band the rule weights are replaced by a smooth function of height and of the angle around the torso axis, fading back over half the margin beyond each end. The waist band runs from `waistBand` below the hip joints up to `Spine02`: the thighs take the sides (|sin| of the angle around the vertical through `Hips`, so a belly, a coat front and the small of the back stay on the spine) and fade out by the `Hips` joint, the rest goes `Hips` → `Spine02` by height. The neck band runs from `Spine` to `neckBand` above `Head`: the clavicles take the sides and fade out by `neck`, the rest goes `Spine` → `neck` → `Head`. Arms, hands and rigid vertices are left alone; `weights.json` reports `bandVertices`. On ministro-creepy the waist band (with the coat as a measured cape) took the worst clip from 6.89× to 3.27× (PASS); it helped vlad (6.03× → 5.30×) and ursinho-fliperama's neck band 5.42× → 4.40×, but made barbudo-creepy, bebezao-de-feira, rapper-zona-sul and dino-festa (tail) worse, so neither is a default.
   The flank band (`flankBand`, × height) runs from `Hips` to `Spine01` on the torso sides only (|sin| of the angle around the vertical through `Hips` from 0.5 to 0.9, so the belly front and the back keep their weights): no clavicle and no thigh there, only `Hips` → `Spine02` → `Spine01` by height; legs and head are left alone. `flankFade` (× height) sets the length of its lower fade, which ends at the `Hips` joint (default half of `flankBand`). On bebezao-de-feira, `flankBand` 0.04 removed the crouchwalk tear on the left flank (`LeftShoulder` 0.43 at 0.925 m next to `LeftUpLeg` 0.29 at 0.895 m; crouchwalk 3.59× → 3.48×), but its default lower fade, 3.4 cm under `Hips`, became the new step in death (thigh 0.55 at 0.70 m next to `Hips` 0.85 at 0.75 m; 3.25× → 3.77×). With `flankFade` 0.043 (fade from 0.65 m) death was still 4.09×; 0.06 and 0.08 brought death to 3.09× and bebezao passes at 3.48× (crouchwalk) with 0.06.
8. Groin: within `groinBand` × height (0.05) of the crotch and between the thigh joints, the thigh share moves to `Hips`, fully on the midline, so spreading the legs does not tear the crotch. Where a tunic or a buckle hangs in front of the crotch the band's edge can itself be the step: on vlad (crotch 0.74 m) the midline went from `Hips` 0.46 at 0.795 m to 0.71 at 0.775 m and tore in death (3.58×); `groinBand` 0.08 (with `gradientRamp` 0.05) moved the edge off the tunic and vlad passes at 3.30× (crouch).
9. Gradient limit: the ramps of step 3 only scale weights that already exist, so neighbouring vertices could still switch bones within millimetres (heat on layered cloth, proxy transfer across fused voxels, binary weights on small islands). Every edge whose weight change exceeds its length over `gradientRamp` × height (0.025) is relaxed towards its neighbour, rigid vertices held fixed, until no edge exceeds it (`gradientIterations`). This creates shared influence across part borders.
10. At most 4 influences per vertex, normalised. `weights.json` reports the method, bare vertices, the largest arm weight left on no-arm parts (must be 0), the minimum `Hand` weight on hand vertices (must be 1), cloth and groin vertex counts, the gradient-limit iterations and the influence histogram.

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
| `extras[]` | `{ name, select: { from, box: {min, max}, colors, tolerance, islandMaxFaces, grow: {seeds, crease, thickness} }, rigid \| bones \| kind, measure, cut, frontPanel }`; `kind` is `skirt` or `cape`; `measure: true` keeps the extra in the joint measurement (default for skirts; accessories are measured out); `cut` lists body parts to cut the extra from (see **parts**); `frontPanel` (cloth only, opt-in) splits the front of the cloth over both thighs (see **weights** step 6). |
| `joints.*` | Estimator options and ratios (`shoulderAt`: `armpit` (default) or `junction`, `shoulderInset`, `shoulderRaise`, `clavicleRatio`, `elbowRatio`, `hipAboveCrotch`, `hipsAboveUpLeg`, `kneeRatio`, `kneeWindow`, `kneeBendMin`, `kneeProminence`, `kneeStepMax`, `kneeForward`, `ankleWindow`, `toeRatio`, `toeHeightRatio`, `spineBelowShoulder`, `spineDepth` (spine axis that fraction of the way from the torso centroid to the back, default 0), `neckRatio`, `headAboveNeck`, `headfrontForward`). |
| `jointsOverride` | Override file relative to the config (default `joints.json`). |
| `weights.*` | `heatFailShare`, `voxelSize`, `headRigidAbove`, `rampLength`, `smoothRadius`, `smoothIterations`, `smoothJoints`, `linearBlends`, `groinBand`, `gradientRamp`, `gradientIterations`, `thighCeiling`, `clavicleFloor` (opt-in, step 2), `waistBand`, `neckBand`, `flankBand`, `flankFade` (opt-in, step 7), `chainLocality`, `sideExclusive` (opt-in, step 2). |

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
- Where an unmeasured extra wraps the whole torso (vlad's `coat-lower` raised to 0.95 m), no torso section and no body vertex is left at that height; the spine axis then uses the full-mesh section through the extra, which sits on the coat's centroid rather than the body's. Mark such an extra `measure: true` or keep its box below the spine sections.
- Joint positions are a first estimate: always look at `joints-review.png` and `parts-review.png`.
- `shoulderAt: "junction"`, `spineDepth`, `thighCeiling`/`clavicleFloor` and a larger `gradientRamp` (0.04) are per-character levers, not defaults: on the 37-character set of 2026-11-09 each fixed some rigs and broke others when applied to all (junction shoulders: 7 passing rigs failed; `spineDepth` 0.4 worsened barbudo-creepy and bebezao-de-feira).
- Heat weighting can fail on non-manifold meshes; the voxel proxy covers it, but check `weights.json` (`method`, `heat.unweightedVertices`).
- Hips translation and in-place motion come from `retarget-glb.mjs`; this pipeline does not author clips.
- The Blender weights still treat `Curl_L`/`Curl_R` as non-deforming. A body pose PASS is **not** a playable-hand approval. The explicit offline pilot repair below is required before evaluating capitao-caveira's grip; it is not enabled for the other characters.
- The pipeline run (`rig-character.mjs`) fails when the pose test fails (`--strict`); `--no-clips` limits it to the synthetic poses.

## Offline grip prerequisite — capitao-caveira only

`characters/capitao-caveira/grip.json` pins the exact 0.2.0 mesh and donor hashes.
The existing client's `tools/finger-curl.mjs` establishes the longitudinal weight
ramp and positive local-X curl convention, but its world/local offset and IBM
calculations must not be copied onto the centimetre skeleton. This repair computes
the new inverse bind matrix from the complete actual joint hierarchy.

Measured in Hand-local metres, the pilot's four non-thumb fingers separate into
four welded-position components past Y=0.185 (left) / 0.195 (right). The annotation
places their shared hinge at Y=0.17 / 0.18 and smoothly transfers only existing
Hand weight to the first corresponding Curl. Palm Y<=0.15 / 0.16 and thumb-side
X<=-0.075 / X>=0.075 remain untouched. No geometry, normals, UV, topology,
material, image, rights or animation bytes are regenerated. Duplicate Curl joints
remain in contract order, parented to Hand, with the unused copies unweighted.
This is one bend per finger, matching the existing meshy-28 mechanism, not a new
fully articulated finger rig.

From this Studio worktree, with `BASE` pointing at the local character pack root
and `DONOR` at the client's existing `public/models/characters/mst.glb`:

```sh
node tools/characters/repair-grip-pack.mjs \
  "$BASE/capitao-caveira/0.2.0" "$BASE/capitao-caveira/0.2.1" \
  characters/capitao-caveira/grip.json "$DONOR" \
  "$BASE/capitao-caveira/grip-0.2.1.json"
node tools/checks/character-grip-check.mjs \
  "$BASE/capitao-caveira/0.2.0/model/capitao-caveira.glb" \
  "$BASE/capitao-caveira/0.2.1/model/capitao-caveira.glb" \
  characters/capitao-caveira/grip.json --mutants
```

The builder refuses existing output/report paths, altered source/donor hashes,
unsupported skin encodings or missing weight slots. Before publication it runs
the causal numeric gate and validates the full original and new packs, including
the unchanged complete eleven-state clip file. It records exact commands, source,
tool and annotation hashes, output manifest/model hashes, donor influences and
per-finger measurements outside the pack. Local version 0.2.0 is immutable.

The gate rejects zero finger influence, rotation of palm/thumb, wrong flexion
frame/sign, bind error above 0.1 mm, geometry/attribute/topology changes, unrelated
weight changes, or curl edge stretch above 2.5x. All four fingers must move inward
at both runtime endpoint curls (0.55 and 0.95 rad). `--mutants` includes the actual
zero-weight source, changed silhouette, palm-as-finger and reversed-frame defects.
Passing establishes only a real deformation prerequisite: the parent must render
the pilot with the actual AK and obtain independent visual acceptance. Do not
publish/integrate the remaining 29 or generalize an annotation across characters.

The hand edge ceiling is shared with `POSE_THRESHOLDS.synthetic.handMaxEdge` in
`tools/lib/character-rig.mjs`, not a new aesthetic threshold. Its existing RM1
provenance is documented there; the calibration table above records mst hand
L/R=1.68x/1.30x on shared clips, measured by `tools/characters/rig-pose-test.mjs`.
The grip production report records the additional synthetic Curl endpoints:
left 1.484x and right 1.747x maximum at 0.95 rad. None of these numbers approves
actual AK contact or replaces the parent browser/visual evaluation.

