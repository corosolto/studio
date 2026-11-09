# Animation conversion (Mixamo / UAL → meshy-28)

Turns third-party character animations into clips for the shared **meshy-28** skeleton (see [character-pack.md](character-pack.md)) in three steps:

1. **convert** a source clip (Adobe Mixamo FBX, Quaternius Universal Animation Library glTF) into a **reference clip** on the meshy-28 reference skeleton;
2. **bake** reference clips onto one character's meshy-28 rig (for example a [Blender rig](character-rig.md));
3. **QA** the baked clips on that character's skinned mesh, and look at a contact sheet.

Everything runs locally in Node (Blender only renders contact sheets). CI runs `tools/checks/animation-conversion-check.mjs` (part of `npm run check`) on synthetic skeletons and a synthetic skinned body only.

## Licensing and where files live

- **Mixamo** animations may be used in commercial games, but the raw files must not be redistributed standalone. Raw FBX files live only in the private `corosolto/studio-assets` repository (Git LFS, `animations/sources/`, indexed by `animations/catalog.json`). This public repository holds no FBX, GLB or clip bytes (`npm run check` rejects `.fbx`/`.glb`); converted clips ship only inside game packs.
- **Quaternius UAL 1 and 2** are CC0 1.0. The conversion still records the source in the clip metadata.
- Work directories (reference clips, baked clips, QA reports, sheets) stay outside this repository.
- Clips record their provenance in `extras.clip.source.id`: the studio-assets catalog id (for example `mixamo/loose/reload`).

## Run

```bash
# 1. convert: a manifest of catalog ids (sources resolved through the private catalog)
node tools/animations/convert-clips.mjs \
  --manifest=tools/animations/manifests/pilot-20261109.json \
  --catalog=<studio-assets>/animations/catalog.json --out=<work>/reference

#    or one file; UAL needs --action (list them with --list)
node tools/animations/convert-clips.mjs <Reload.fbx> --out=<work>/reference --name=reload --id=mixamo/loose/reload
node tools/animations/convert-clips.mjs <UAL1_Standard_RM.glb> --list
node tools/animations/convert-clips.mjs <UAL1_Standard_RM.glb> --action=Walk_Loop --out=<work>/reference

# 2. bake onto a character
node tools/animations/bake-character.mjs --model=<character.glb> --clips=<work>/reference --out=<work>/<character>

# 3. QA gate (JSON report; --strict exits 1 on any failure) and contact sheet
node tools/animations/clip-qa.mjs --model=<character.glb> --clips=<work>/<character> --out=<work>/qa-<character>.json --strict
node tools/animations/clip-sheet.mjs --model=<character.glb> --clips=<work>/<character> --out=<work>/<character>.png [--view=side]
```

Manifest entries: `{ "name", "id"?, "source"?, "action"?, "take"?, "loop"?, "hold"?, "airborne"?, "start"?, "end"?, "rootMotion"? }`. `hold` is `rifle` (two-handed; the grip gate applies), `pistol`, `knife` or `none`. `airborne` exempts jumps from the float and hips gates. `start`/`end` trim in source seconds. UAL actions ending in `_Loop` default to `loop: true`; Mixamo loops must be declared.

Use the UAL `_RM` files (`UAL1_Standard_RM.glb`): their `root` carries the root motion, which the conversion extracts into metadata. The `UAL*_Standard.glb` files are already in place, so locomotion keeps no speed and the QA cannot locate planted feet.

## Bone maps

Both maps cover the 22 deforming meshy-28 joints once each; `head_end`, `headfront` and the `Curl_*` helpers are never animated (the client writes the grip curl on `Curl_*`). The check (clause A1) proves that each mapped source bone sits under the source bone mapped to its meshy-28 parent.

### Mixamo → meshy-28 (`MIXAMO_TO_MESHY28`)

Mixamo names appear as `mixamorig:Hips` (FBX), `mixamorigHips` (three's FBXLoader drops the colon), `mixamorig1:Hips` or `Hips` (Unity re-exports); all are normalised to the base name.

| Mixamo | meshy-28 | | Mixamo | meshy-28 |
| --- | --- | --- | --- | --- |
| Hips | Hips | | LeftUpLeg | LeftUpLeg |
| Spine | **Spine02** | | LeftLeg | LeftLeg |
| Spine1 | Spine01 | | LeftFoot | LeftFoot |
| Spine2 | **Spine** | | LeftToeBase | LeftToeBase |
| Neck | neck | | RightUpLeg | RightUpLeg |
| Head | Head | | RightLeg | RightLeg |
| LeftShoulder | LeftShoulder | | RightFoot | RightFoot |
| LeftArm | LeftArm | | RightToeBase | RightToeBase |
| LeftForeArm | LeftForeArm | | RightShoulder | RightShoulder |
| LeftHand | LeftHand | | RightArm | RightArm |
| | | | RightForeArm | RightForeArm |
| | | | RightHand | RightHand |

Not mapped: `HeadTop_End`, `LeftToe_End`/`RightToe_End`, every finger bone.

The spine follows the anatomy: Mixamo `Spine` (just above the hips) is meshy `Spine02` (child of `Hips`), and `Spine2` (the chest, parent of neck and clavicles) is meshy `Spine`. The client's `tools/retarget-mixamo.mjs` (and `retarget-ue2.mjs`) map these by name (`Spine`→`Spine`, `Spine2`→`Spine02`), which puts the chest's bend on the lowest spine joint (check clause A5).

### Quaternius UAL → meshy-28 (`UAL_TO_MESHY28`)

UAL 1 and 2 use the UE5-mannequin naming; the glTF puts the skeleton under a `root` node rotated −90° about X (Z-up inside), which the world-space maths absorbs.

| UAL | meshy-28 | | UAL | meshy-28 |
| --- | --- | --- | --- | --- |
| pelvis | Hips | | thigh_l | LeftUpLeg |
| spine_01 | Spine02 | | calf_l | LeftLeg |
| spine_02 | Spine01 | | foot_l | LeftFoot |
| spine_03 | Spine | | ball_l | LeftToeBase |
| neck_01 | neck | | thigh_r | RightUpLeg |
| Head | Head | | calf_r | RightLeg |
| clavicle_l | LeftShoulder | | foot_r | RightFoot |
| upperarm_l | LeftArm | | ball_r | RightToeBase |
| lowerarm_l | LeftForeArm | | clavicle_r | RightShoulder |
| hand_l | LeftHand | | upperarm_r | RightArm |
| | | | lowerarm_r | RightForeArm |
| | | | hand_r | RightHand |

Not mapped: `root` (root motion only), `*_leaf_*`, every finger bone (`index_*`, `middle_*`, `ring_*`, `pinky_*`, `thumb_*`).

## Method (`tools/lib/animation-retarget.mjs`)

One core, `retargetClip(source, target, options)`, does both convert and bake. The source is a pose source (`objectPoseSource` over FBXLoader's bone tree and AnimationClip, or `gltfPoseSource` over a glTF node tree); the target a `skeletonGraph` of a glTF document.

**Reference skeleton.** The donor's joint positions (`MESHY28_REFERENCE_JOINTS`, measured from the client's `mst.glb`) with the donor rest frames (`buildMeshy28Skeleton`). Convert writes every clip against it; bake moves clips onto each character.

**Rotations: world deltas.** Per bone and frame: `delta = srcWorld · srcRestWorld⁻¹`, `desiredWorld = delta · tgtRestWorld`, `tgtLocal = tgtParentWorld⁻¹ · desiredWorld`. No bone axis convention matters: the check builds its sources with scrambled rest frames. The source's facing is measured from its hip line and turned onto the target's (a source facing −Z converts like one facing +Z). Consecutive quaternion keys are kept in the same hemisphere so LINEAR slerp never takes the long way.

**Rest alignment (`LIMB_ALIGNMENT`).** Upper arm, forearm, thigh and shin: before the delta is applied, the target's rest frame is turned by the shortest arc that makes the bone point like the source's rest bone. Mixamo and UAL rest with straight arms and legs; the donor rests with bent knees (18°) and forearms swept back, which plain deltas would add to every pose (crouched walks, rifle hands pulled back). Feet are not aligned: both rests stand flat, and ankle-to-ball slopes differ with foot shape.

**Bake rule (port of the client's `retarget-glb.mjs`).** `LeftArm`/`LeftForeArm`/`LeftHand` and the right twins copy the clip's absolute world rotation (`absoluteArms`): an A-pose rig would otherwise hold every clip 30–40° off. The Blender rigs align those frames to the bones, so absolute frames point the bones where the clip points. Everything else uses deltas plus rest alignment on the legs. `Curl_*` are never animated. A target with fewer than 8 matching joints is refused (the client tool once wrote 11 empty clips and reported success).

**Hips.** The hips' world displacement from the source rest, turned into the target's facing and scaled by the hips-height ratio. Root motion (`rootMotion`):

- `in-place` (default): the straight line from the first to the last hips position (horizontal) is removed. Sway around it stays, a loop closes, and the line is recorded as `rootMotion: { displacement, velocity, speed }` in metres at the clip's scale (bake scales it again for each character), so the runtime can move the character, or set the playback rate, at the speed that keeps the feet planted;
- `keep`: horizontal motion stays in the clip;
- `strip`: hips XZ pinned to rest (the client's old behaviour; loses sway).

**Ground contact (`footContact`).** Per frame the hips height is corrected so the target's lowest foot joint (ankle or ball, relative to its rest height) is as far above its rest height as the source's, scaled. The hips-height ratio alone is only right standing: with different leg proportions the target floated up to 8 cm on bent knees (pilot round 1).

**Contacts and foot IK (`footIk`).** A source foot joint is planted where it is within 3 cm of its rest height and moves slower than 0.25 m/s in the source's world (root motion included), for at least 3 frames (`footContacts`). The windows travel with the clip (`extras.clip.contacts`, frame indices) and bake reuses them. Inside a window (ramped over 4 frames; ramps wrap the seam of a loop) two-bone IK (`solveTwoBone`: knee bend by the law of cosines about the current bend plane, then a hip swing) pins the ankle to the source ankle's displacement from its rest, scaled, added to the target ankle's rest. With the root velocity added back, that position is where the source keeps the foot, so planted feet stop sliding on characters whose legs differ from the source's. `contactSlide` records the source's own slide inside its windows.

**Toe clamp (bake, `clampToesToFloor`).** Bake knows the character's mesh: per frame it skins the vertices that belong to each `ToeBase` and, when the lowest sinks more than 5 mm below the bind floor, pitches that toe up about the horizontal axis across the toe lever (at most 3 iterations of ≤45°). Longer or differently pitched feet otherwise pushed the toes 2.1–5.5 cm through the floor at heel-off (pilot round 2).

**Sampling.** Output is resampled to 30 fps (`CLIP_FPS`) by sampling the source at `i/30` s, with the last frame exactly at the end (`frames = round(length · 30) + 1`). The FBX path samples through a `THREE.AnimationMixer` with `LoopOnce` + clamp (so the last frame is the real end pose); the glTF path samples LINEAR/STEP/CUBICSPLINE channels. FBXLoader adds a same-named leaf under each bone of a skinned Mixamo file; bones are resolved like the mixer resolves track names, so the animated bone is used (clause A9). The native key rate (most common key interval) is recorded as `source.nativeFps`.

## Clip metadata (`extras.clip` on the animation)

| Key | Meaning |
| --- | --- |
| `schema`, `skeleton` | `coro-solto/clip@1`, `meshy-28`. |
| `fps`, `frames`, `duration` | Output sampling. |
| `loop`, `hold`, `airborne` | From the manifest; select QA gates. |
| `rootMotion` | `{ mode, extracted, displacement: [x, z], velocity: [x, z], speed }` (m, m/s), scaled per character by bake. |
| `contacts`, `contactSlide` | Source contact windows per foot joint (frame indices) and the source's own slide inside them (m, scaled per character). |
| `hipsScale`, `footContact`, `footIk`, `alignedLimbs`, `sourceHipsRatio` | Conversion facts: hips-height ratio, hips correction range (m), IK legs and largest ankle correction (m), aligned bones, the source's hips height range as a fraction of its rest height. |
| `source` | `{ id, rig, file, take, nativeFps, duration, start, end }`. |
| `bakedFor` | Bake facts: `{ model, hipsScale, joints, footContact, footIk, toeClamp: { frames, maxDeg }, alignedLimbs }`. |

The client loads these GLBs like its shared clips (skeleton nodes plus one animation, LINEAR); `extras` is ignored by three.js.

## QA gate (`tools/animations/clip-qa.mjs`, `tools/lib/clip-qa.mjs`)

Every frame of every clip is skinned on the CPU (same maths as three.js) on the character's mesh. The floor is the lowest vertex of the bind pose.

| Gate | Measure | Limit (`CLIP_QA_THRESHOLDS`) |
| --- | --- | --- |
| Foot slide | Horizontal travel of each foot joint inside its contact windows, in the world (the clip's in-place root velocity added back). Windows come from `extras.clip.contacts`, else they are detected on the character with the same rule. | ≤ 4 cm, or ≤ the source's own slide + 1 cm |
| Floor penetration | Lowest skinned vertex over the clip (reports the dominant bone). | ≥ −2 cm |
| Floating | Highest of the per-frame lowest vertices (not for `airborne`). | ≤ 3 cm |
| Hips height | Hips height range / bind height; the source's range is reported next to it. | max ≤ 1.08 (not for `airborne`) |
| Loop seam | First versus last frame (loops): joint positions and local rotations. | ≤ 1.5 cm, ≤ 5° |
| Two-hand grip | `LeftHand`–`RightHand` distance, maximum deviation from its median (`hold: rifle`). | ≤ 3 cm |
| Skin stretch | `tools/characters/rig-pose-test.mjs --clips=<dir> --states=<clips> --samples=12`: per clip, the worst edge, upper back and hands. | `POSE_THRESHOLDS.clip`: 3.5×, 3.5×, 2.5×, seams 5 mm |

The limits were set before the pilot from the client's gates (stretch, hands) and common foot-skating tolerances and were not loosened; round 3 added the source-relative slide allowance, because a motion-capture take can slide on its own (Grenade Throw: 3.5 cm over 8 s in the source) and no retarget can do better than its source.

`tools/animations/clip-sheet.mjs` renders `--frames` evenly spaced instants of each clip (one row per clip) from a fixed camera over a 10 cm floor grid with Blender (`tools/blender/render_clip_frames.py`), assembled by `rig-review.mjs sheet`.

## Check (`npm run check`)

`tools/checks/animation-conversion-check.mjs` builds Mixamo-like bone trees (FBXLoader naming, scrambled rest frames, optional duplicate leaves, three prefixes, −Z facing) and a UAL-like glTF (Z-up `root`) in code, and a synthetic skinned body (`tools/checks/lib/synthetic-humanoid.mjs`, shared with the rig check). Clauses: maps and hierarchy (A1), rig detection (A2), rest identity (A3), world-delta transfer within 1 mm (A4), spine order (A5), root-motion modes (A6), 24 → 30 fps resampling and trim (A7), facing (A8), FBX duplicates and prefixes (A9), UAL (A10), ground contact + IK on shorter shins (A11: 0.00 cm with, 4.5 cm slide / 2.9 cm height without), loop-wrapped IK ramps (A11), rest alignment (A12: knee straight with, 18° without), bake rules (B1, B2), and the QA gates on a clean clip plus one mutant per gate, the CLI end to end with `--strict` and a torn-hand body, and the toe clamp (Q1–Q4).

## Pilot (2026-11-09)

Six Mixamo clips owner-downloaded (`tools/animations/manifests/pilot-20261109.json`): `Reload`, `Grenade Throw`, `Knife Idle`, `Rifle Pull Out`, and `walk left`/`walk right` from the Rifle 8-Way Locomotion pack (byte-identical to Pro Rifle). Baked onto `capitao-caveira` (Blender rig from [character-rig.md](character-rig.md)) and onto the legacy donor `mst`. Work directory (private): `csbrasil/local/anim-conv-20261109/` (`r1`, `r2`, `r3` rounds, `sheets/`, `ual/`).

Gauntlet (all QA numbers measured with the final gate):

- **Round 1**, the straight port of the client tools: feet float 5.7–8.1 cm on capitao-caveira (every clip but one) and penetrate up to 3.3 cm on mst, because the hips-height ratio is not the leg-length ratio when knees bend. 5/6 clips fail on capitao-caveira, 5/6 on mst.
- **Round 2**: ground contact, source contact windows, foot IK. Floating gone; slide inside source contacts at the source's own level. Remaining: toes through the floor at heel-off (mst −3.6 to −5.5 cm, capitao −2.1 cm), and crouched postures (hips 0.74–0.83 of rest against the source's 0.79–0.87) from the donor's bent rest knees.
- **Round 3**: rest alignment of arms and legs, bake-time toe clamp, slide limit relative to the source's own slide. capitao-caveira passes 6/6, mst 5/6.

Round 3 QA (slide: measured (source's own); low: lowest vertex min/max; hips: ratio to bind (source); seam: position/rotation; grip: median ± max deviation; stretch: body/back/hand L/hand R):

| capitao-caveira | slide cm | low cm | hips | seam cm/° | grip cm | stretch × | result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| reload | 3.45 (3.31) | −1.35 / −0.03 | 0.94–0.98 (0.90–0.95) | — | 32.3 ± 12.6 | 2.09 / 1.67 / 1.22 / 1.17 | pass |
| grenade-throw | 4.04 (4.05) | −0.48 / 0.18 | 0.54–0.69 (0.48–0.61) | — | 50.4 ± 52.9 | 2.84 / 2.63 / 1.08 / 1.12 | pass |
| knife-idle (loop) | 0.66 (0.66) | 1.27 / 1.44 | 0.89–0.93 (0.85–0.90) | 0.00 / 0.04 | 49.9 ± 1.9 | 2.00 / 1.37 / 1.09 / 1.09 | pass |
| rifle-pull-out | 0.86 (0.87) | −0.12 / −0.02 | 1.00–1.01 (0.97–0.98) | — | 44.3 ± 12.5 | 2.20 / 1.66 / 1.19 / 1.25 | pass |
| rifle-walk-left (loop, rifle) | 1.79 (1.85) | −1.18 / 0.55 | 0.83–0.92 (0.79–0.87) | 0.03 / 0.07 | 29.9 ± 0.08 | 2.13 / 1.80 / 1.09 / 1.05 | pass |
| rifle-walk-right (loop, rifle) | 1.37 (1.44) | −1.05 / 0.14 | 0.87–0.95 (0.83–0.92) | 0.01 / 0.03 | 30.4 ± 0.41 | 2.12 / 1.94 / 1.10 / 1.05 | pass |

| mst | slide cm | low cm | hips | seam cm/° | grip cm | stretch × | result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| reload | 3.03 (2.90) | −1.29 / −0.03 | 0.91–0.97 (0.90–0.95) | — | 31.7 ± 16.8 | 3.02 / 3.02 / 1.66 / 1.30 | pass |
| grenade-throw | 3.55 (3.55) | **−5.48** / −0.16 | 0.50–0.64 (0.48–0.61) | — | 55.3 ± 69.8 | 3.19 / 2.70 / 1.14 / 1.14 | fail: right hand 5.5 cm into the floor at 2.93 s |
| knife-idle (loop) | 0.58 (0.58) | 1.12 / 1.25 | 0.87–0.91 (0.85–0.90) | 0.00 / 0.04 | 54.8 ± 2.5 | 2.15 / 2.15 / 1.23 / 1.14 | pass |
| rifle-pull-out | 0.76 (0.76) | −0.54 / −0.19 | 0.99 (0.97–0.98) | — | 49.1 ± 17.4 | 2.94 / 2.94 / 1.67 / 1.35 | pass |
| rifle-walk-left (loop, rifle) | 1.62 (1.62) | −1.36 / 0.31 | 0.82–0.90 (0.79–0.87) | 0.04 / 0.06 | 29.2 ± 0.31 | 2.70 / 2.70 / 1.18 / 1.04 | pass |
| rifle-walk-right (loop, rifle) | 1.61 (1.26) | −1.34 / 0.09 | 0.86–0.94 (0.83–0.92) | 0.02 / 0.03 | 29.3 ± 0.55 | 2.89 / 2.89 / 1.23 / 1.03 | pass |

Root speed of the strafe walks: 1.53 m/s on the reference skeleton, 1.74 m/s baked on capitao-caveira (hips scale 1.14). Reload walks forward at 0.79 m/s (reference).

A UAL 1 sample (`_RM` file: `Idle_Loop`, `Pistol_Reload`, `Walk_Loop`) passes on capitao-caveira; on mst `Walk_Loop` reaches −2.08 cm under `LeftFoot` (limit −2).

## Limits and residual issues

- **Hands and knees are not ground-constrained.** Only the feet have contact handling. In `grenade-throw` the donor's longer arms put the right hand 5.5 cm into the floor while kneeling; a hand-contact IK (or an arm-length-aware clamp like the toe clamp) is the next step.
- **Heel penetration** of up to 2.1 cm remains where the foot itself (not the toes) pitches below the floor; the toe clamp handles `ToeBase` vertices only.
- **Hips sit 0.02–0.08 of the bind height above the source's** (ratio columns above): the reference skeleton's thigh/shin proportions differ from Mixamo's, and the contact correction keeps the feet, not the hips height, faithful.
- **Grip distance is set by proportions.** `rifle` holds are stable over time (±0.1–0.6 cm) but the hands sit 29–30 cm apart; a weapon of a different length needs the client's hand IK or a per-weapon arm adjustment.
- **Root motion is a straight line.** Turning clips, curved paths and yaw are not extracted (hips yaw stays in the clip).
- **Contacts need root motion.** In-place sources (UAL `*_Standard.glb`) yield no contact windows for locomotion, so their foot slide is not measured; use the `_RM` files.
- The mesh-aware toe clamp runs only in bake (the reference skeleton has no mesh); reference clips may still have toes below the floor on other feet.
