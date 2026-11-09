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

**Rotations: world deltas.** Per bone and frame: `delta = srcWorld · srcRestWorld⁻¹`, `desiredWorld = delta · tgtRestWorld`, `tgtLocal = tgtParentWorld⁻¹ · desiredWorld`. No bone axis convention matters: the check builds its sources with scrambled rest frames. The source's facing is measured from its hip line and turned onto the target's in quarter turns (a source facing −Z converts like one facing +Z; the few degrees a rig's asymmetric hip joints suggest are ignored, they turned whole clips off the root velocity's line on legacy rigs). Consecutive quaternion keys are kept in the same hemisphere so LINEAR slerp never takes the long way.

**Rest alignment (`LIMB_ALIGNMENT`).** Upper arm, forearm, thigh and shin: before the delta is applied, the target's rest frame is turned by the shortest arc that makes the bone point like the source's rest bone. Mixamo and UAL rest with straight arms and legs; the donor rests with bent knees (18°) and forearms swept back, which plain deltas would add to every pose (crouched walks, rifle hands pulled back). Feet are not aligned: both rests stand flat, and ankle-to-ball slopes differ with foot shape. The correction is capped at 20° per bone (`MAX_REST_ALIGN`), so a rig bent on purpose keeps the rest of its bend. A leg bound with the knee bent past 45° (`MAX_ALIGN_KNEE_BEND`; thigh to shin) is not aligned at all: on the short mascot and robe rigs of the Blender set (padre-parapsicologo 93°, profeta-auditorio 61°, teletreco-sinal-fraco 55°) the knee joint sits off the leg line, and straightening it stood the character 13 to 30% above its bind height (clause A13).

**Bake rule (port of the client's `retarget-glb.mjs`).** `LeftArm`/`LeftForeArm`/`LeftHand` and the right twins copy the clip's absolute world rotation (`absoluteArms`): an A-pose rig would otherwise hold every clip 30 to 40° off. The Blender rigs align those frames to the bones, so absolute frames point the bones where the clip points. Everything else uses deltas plus rest alignment on the legs. `Curl_*` are never animated. A target with fewer than 8 matching joints is refused (the client tool once wrote 11 empty clips and reported success).

**Hips.** The hips' world displacement from the source rest, turned into the target's facing and scaled by the hips-height ratio. Root motion (`rootMotion`):

- `in-place` (default): the straight line from the first to the last hips position (horizontal) is removed. Sway around it stays, a loop closes, and the line is recorded as `rootMotion: { displacement, velocity, speed }` in metres at the clip's scale (bake scales it again for each character), so the runtime can move the character, or set the playback rate, at the speed that keeps the feet planted;
- `keep`: horizontal motion stays in the clip;
- `strip`: hips XZ pinned to rest (the client's old behaviour; loses sway).

**Ground contact (`footContact`).** Per frame the hips height is corrected so the target's lowest foot joint (ankle or ball, relative to its rest height) is as far above its rest height as the source's, scaled. The hips-height ratio alone is only right standing: with different leg proportions the target floated up to 8 cm on bent knees (pilot round 1).

**Contacts and foot IK (`footIk`).** A source foot joint is planted where it is within 3 cm of its rest height and moves slower than 0.25 m/s in the source's world (root motion included), for at least 3 frames (`footContacts`). The windows travel with the clip (`extras.clip.contacts`, frame indices) and bake reuses them. Inside a window (ramped over 4 frames; ramps wrap the seam of a loop) two-bone IK (`solveTwoBone`: knee bend by the law of cosines about the current bend plane, then a hip swing) pins the ankle to the source ankle's displacement from its rest, scaled, added to the target ankle's rest. With the root velocity added back, that position is where the source keeps the foot, so planted feet stop sliding on characters whose legs differ from the source's. `contactSlide` records the source's own slide inside its windows.

**Reach, ball lock (`footIk`, `footAim`).** Where a standing leg cannot reach its planted ankle (the goal is farther from the hip than thigh plus shin), the hips drop by the deficit, at most 5 cm per frame (`MAX_REACH_DROP`), before the IK runs. While the ball is planted, the foot turns about the pinned ankle so the ball stays where it landed; the lock is a world point, so in an in-place clip's frame it moves back at the root velocity (`inPlaceVelocity`, which bake passes from the reference clip). Loops are closed after these per-frame corrections (`closeLoop`).

**Floor clamp (bake, `clampToFloor`).** Bake knows the character's mesh. Per frame it skins the mesh and treats the regions of `FLOOR_CLAMP_REGIONS` (a vertex belongs to the region of its dominant joint) in order; a region acts when its lowest vertex sinks more than 5 mm below the bind floor:

- heels (`Foot`) pitch at the ankle, toes (`ToeBase`) at the ball, hands (`Hand`, `Curl_*`) at the elbow, then the shoulder: the pivot turns about the horizontal axis across the lever to the sinking vertex (≤ 45° per step);
- when the heel and the toes of one foot both sink (the ankle is too low for this foot), or no pivot has a usable lever (a heel right under the ankle, a hand planted under a straight arm), two-bone IK raises that ankle or wrist by the depth;
- knees and the rest of the body (torso, head, upper limbs lying on the floor) raise the hips;
- shin-weighted vertices below the ankle in the bind pose (a shoe skinned to the shin, common in the legacy client rigs) are a passive `shoe` region: they move with the shin, no pivot can lift them, and lifting the body for them made cuca float, so the clamp leaves them and the QA reports them apart;
- after up to 8 passes the whole body is lifted out of any remaining penetration, or dropped when its lowest point hangs more than 2 cm above the source's lowest foot (`footClearance`, scaled): on the floor where the source plants a foot, no higher than the source's feet in a flight phase;
- `bake --passive-knees` makes the knee region passive like `shoe` (no lift, no penetration gate, recorded in `bakedFor.passiveRegions`): for rigs with geometry skinned to a shin that is not a shin. cuca's alligator tail is skinned to `RightLeg` (280 vertices reaching 1.3 m behind the hips), so every stride swung it into the floor and the clamp hoisted the body.

Longer or differently shaped feet otherwise pushed toes 2.1 to 5.5 cm and heels up to 1.5 cm through the floor (pilot), the donor's longer arms put a hand 5.5 cm into the floor while kneeling (`grenade-throw`), and lying or handstand clips sank the torso up to 32 cm (library round 1).

**Two-hand grip (bake, `holdTwoHandGrip`).** For `hold: rifle` clips, where the `LeftHand` to `RightHand` distance leaves 2 cm (`GRIP_TOLERANCE`) around its median, the left arm is solved by two-bone IK (the hand keeps its world rotation) to bring the support hand back along the same line, in up to three passes. Arms copy absolute world directions, so on other shoulder widths and spine lengths the hands drifted 3 to 5 cm apart over a run stride (run_back_left on 17 of 130 rigs). Clips drifting more than 8 cm (`GRIP_MAX_DRIFT`, a reload) are left alone (clause B3).

**Sampling.** Output is resampled to 30 fps (`CLIP_FPS`) by sampling the source at `i/30` s, with the last frame exactly at the end (`frames = round(length · 30) + 1`). The FBX path samples through a `THREE.AnimationMixer` with `LoopOnce` + clamp (so the last frame is the real end pose); the glTF path samples LINEAR/STEP/CUBICSPLINE channels. FBXLoader adds a same-named leaf under each bone of a skinned Mixamo file; bones are resolved like the mixer resolves track names, so the animated bone is used (clause A9). The native key rate (most common key interval) is recorded as `source.nativeFps`.

## Clip metadata (`extras.clip` on the animation)

| Key | Meaning |
| --- | --- |
| `schema`, `skeleton` | `coro-solto/clip@1`, `meshy-28`. |
| `fps`, `frames`, `duration` | Output sampling. |
| `loop`, `hold`, `airborne` | From the manifest or the library rules; select QA gates. |
| `rootMotion` | `{ mode, extracted, displacement: [x, z], velocity: [x, z], speed }` (m, m/s), scaled per character by bake. |
| `contacts`, `contactSlide`, `footClearance` | Source contact windows per foot joint (frame indices), the source's own slide inside them, and per frame how far the source's lowest foot joint is above its rest height (m, scaled per character). |
| `hipsScale`, `footContact`, `footIk`, `alignedLimbs`, `sourceHipsRatio` | Conversion facts: hips-height ratio, hips correction range (m), IK legs and largest ankle correction (m), aligned bones, the source's hips height range as a fraction of its rest height. |
| `source` | `{ id, rig, file, take, nativeFps, duration, start, end }`. |
| `bakedFor` | Bake facts: `{ model, hipsScale, joints, footContact, footIk, floorClamp: { heel, toe, hand, knee, body, limbLift, bodyShift: { frames, max }, unresolvedFrames }, grip: { frames, maxCm, driftCm }, passiveRegions, alignedLimbs }`. |
| `library` | Library clips: `{ key, keyStatus, primary, category }` (see [Library](#library)). |

The client loads these GLBs like its shared clips (skeleton nodes plus one animation, LINEAR); `extras` is ignored by three.js.

## QA gate (`tools/animations/clip-qa.mjs`, `tools/lib/clip-qa.mjs`)

Every frame of every clip is skinned on the CPU (same maths as three.js) on the character's mesh. The floor is the lowest vertex of the bind pose.

| Gate | Measure | Limit (`CLIP_QA_THRESHOLDS`) |
| --- | --- | --- |
| Foot slide | Horizontal travel of each foot joint inside its contact windows, in the world (the clip's in-place root velocity added back). Windows come from `extras.clip.contacts`, else they are detected on the character with the same rule. | ≤ 4 cm, or ≤ 1.25 × the source's own slide + 1 cm |
| Floor penetration | Lowest skinned vertex over the clip (passive `shoe` vertices, and the regions in `bakedFor.passiveRegions`, reported apart), also per region (heel, toe, hand, knee, body, shoe). | ≥ −2 cm; heels ≥ −1 cm |
| Floating | Per frame, the lowest vertex above the source's own lowest-foot clearance (`footClearance`); without it, the raw lowest vertex (not for `airborne`). | ≤ 3 cm |
| Hips height | Hips height range / bind height; the source's range is reported next to it. On a rig bound with a knee bent past 45° the bind height is not its standing height: the failure is tagged `[rig: knee bound bent N°]`. | max ≤ 1.08, or the source's max + 0.08 (not for `airborne`) |
| Loop seam | First versus last frame (loops): joint positions and local rotations. | ≤ 1.5 cm, ≤ 5° |
| Two-hand grip | `LeftHand` to `RightHand` distance, maximum deviation from its median (`hold: rifle`). | ≤ 3 cm |
| Skin stretch | `tools/characters/rig-pose-test.mjs --clips=<dir> --states=<clips> --samples=12`: per clip, the worst edge, upper back and hands. Tagged `[rig: A+B]` when the worst vertex carries ≥ 15% on bones of opposite sides or three or more joints apart (a crotch on both thighs, an armpit on `Spine02`) and for opened UV seams, else `[clip]` (`stretchCause`). | `POSE_THRESHOLDS.clip`: 3.5×, 3.5×, 2.5×, seams 5 mm |

The limits were set before the pilot from the client's gates (stretch, hands) and common foot-skating tolerances. Four became relative to the source, each because a source does it on its own and no retarget can do better: slide (a take can slide: Grenade Throw 3.5 cm over 8 s in the source; a pivoting ball travels with foot length, which differs up to ~1.2× between characters), floating (a jump's flight or a handstand's raised feet), hips height (jog-backward and breakdance uprocks rise above rest in the source; the reference skeleton sits up to 0.08 higher, see residuals), and heels got a stricter 1 cm limit.

`--flags-from=<dir>` measures clips without metadata (the client's shipped clips) with the loop, hold and airborne flags of the same-named converted clips.

`tools/animations/clip-sheet.mjs` renders `--frames` evenly spaced instants of each clip (one row per clip) from a fixed camera over a 10 cm floor grid with Blender (`tools/blender/render_clip_frames.py`), assembled by `rig-review.mjs sheet`.

## Check (`npm run check`)

`tools/checks/animation-conversion-check.mjs` builds Mixamo-like bone trees (FBXLoader naming, scrambled rest frames, optional duplicate leaves, three prefixes, −Z facing) and a UAL-like glTF (Z-up `root`) in code, and a synthetic skinned body (`tools/checks/lib/synthetic-humanoid.mjs`, shared with the rig check). Clauses: maps and hierarchy (A1), rig detection (A2), rest identity (A3), world-delta transfer within 1 mm (A4), spine order (A5), root-motion modes (A6), 24 → 30 fps resampling, trim and re-sampling a source after a full pass (A7), facing (A8), FBX duplicates and prefixes (A9), UAL (A10), ground contact + IK on shorter shins (A11: 0.00 cm with, 4.5 cm slide / 2.9 cm height without) and loop-wrapped IK ramps (A11), rest alignment (A12: knee straight with, 18° without) and a leg bound at 68° kept (A13), bake rules (B1, B2), the two-hand grip hold (B3: 4.8 cm drift to 1.9 cm), the QA gates on a clean clip plus one mutant per gate including the heel limit (Q1, Q2), the CLI end to end with `--strict` and a torn-hand body (Q3), the floor clamp on sunk toes, heels, whole feet, hands and body and the drop of a hanging body (Q4), the FBX footer fallback on 32- and 64-bit node records (L1), the library plan and key rules (L2, L3), and packs (P1: int16 rotations within 0.003°, a third of the uncompressed bytes).

## Pilot (2026-11-09)

Six Mixamo clips owner-downloaded (`tools/animations/manifests/pilot-20261109.json`): `Reload`, `Grenade Throw`, `Knife Idle`, `Rifle Pull Out`, and `walk left`/`walk right` from the Rifle 8-Way Locomotion pack (byte-identical to Pro Rifle). Baked onto `capitao-caveira` (Blender rig from [character-rig.md](character-rig.md)) and onto the legacy donor `mst`. Work directory (private): `csbrasil/local/anim-conv-20261109/` (`r1` to `r5`, `sheets/`, `ual/`, `library/`, `spine/`).

- **Round 1**, the straight port of the client tools: feet float 5.7 to 8.1 cm on capitao-caveira (every clip but one) and penetrate up to 3.3 cm on mst, because the hips-height ratio is not the leg-length ratio when knees bend. 5/6 clips fail on capitao-caveira, 5/6 on mst.
- **Round 2**: ground contact, source contact windows, foot IK. Floating gone; slide inside source contacts at the source's own level. Remaining: toes through the floor at heel-off (mst −3.6 to −5.5 cm, capitao −2.1 cm), and crouched postures (hips 0.74 to 0.83 of rest against the source's 0.79 to 0.87) from the donor's bent rest knees.
- **Round 3**: rest alignment of arms and legs, bake-time toe clamp, slide limit relative to the source's own slide. capitao-caveira 6/6, mst 5/6 (a hand 5.5 cm into the floor).
- **Residual round** (`r4`, `r5`): the floor clamp grows to heels, hands, knees and the body, with limb IK where no pivot works. **12/12 pass**; every lowest vertex is within 5 mm of the floor.

Final QA (`r5`; slide: measured (source's own); low: lowest vertex min/max; hips: ratio to bind (source); seam: position/rotation; grip: median ± max deviation; stretch: body/back/hand L/hand R):

| capitao-caveira | slide cm | low cm | hips | seam cm/° | grip cm | stretch × | result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| reload | 3.45 (3.31) | −0.50 / 0.02 | 0.94 to 0.98 (0.90 to 0.95) | n/a | 32.3 ± 12.6 | 2.09 / 1.67 / 1.22 / 1.17 | pass |
| grenade-throw | 4.04 (4.05) | −0.48 / 0.18 | 0.54 to 0.69 (0.48 to 0.61) | n/a | 50.4 ± 52.9 | 2.84 / 2.63 / 1.08 / 1.12 | pass |
| knife-idle (loop) | 0.66 (0.66) | 1.27 / 1.44 | 0.89 to 0.93 (0.85 to 0.90) | 0.00 / 0.04 | 49.9 ± 1.9 | 2.00 / 1.37 / 1.09 / 1.09 | pass |
| rifle-pull-out | 0.86 (0.87) | −0.12 / −0.02 | 1.00 to 1.01 (0.97 to 0.98) | n/a | 44.3 ± 12.5 | 2.20 / 1.66 / 1.19 / 1.25 | pass |
| rifle-walk-left (loop, rifle) | 1.79 (1.85) | −0.44 / 0.55 | 0.83 to 0.92 (0.79 to 0.87) | 0.03 / 0.07 | 29.9 ± 0.08 | 2.13 / 1.80 / 1.09 / 1.05 | pass |
| rifle-walk-right (loop, rifle) | 1.37 (1.44) | −0.49 / 0.14 | 0.87 to 0.95 (0.83 to 0.92) | 0.01 / 0.03 | 30.4 ± 0.41 | 2.12 / 1.94 / 1.10 / 1.05 | pass |

| mst | slide cm | low cm | hips | seam cm/° | grip cm | stretch × | result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| reload | 3.03 (2.90) | −0.50 / −0.03 | 0.91 to 0.97 (0.90 to 0.95) | n/a | 31.7 ± 16.8 | 3.02 / 3.02 / 1.66 / 1.30 | pass |
| grenade-throw | 3.55 (3.55) | −0.50 / 0.00 | 0.50 to 0.64 (0.48 to 0.61) | n/a | 55.4 ± 69.7 | 3.19 / 2.70 / 1.14 / 1.14 | pass (hand −5.48 → −0.50 cm) |
| knife-idle (loop) | 0.58 (0.58) | 1.12 / 1.25 | 0.87 to 0.91 (0.85 to 0.90) | 0.00 / 0.04 | 54.8 ± 2.5 | 2.15 / 2.15 / 1.23 / 1.14 | pass |
| rifle-pull-out | 0.76 (0.76) | −0.50 / −0.19 | 0.99 (0.97 to 0.98) | n/a | 49.1 ± 17.4 | 2.94 / 2.94 / 1.67 / 1.35 | pass |
| rifle-walk-left (loop, rifle) | 1.62 (1.62) | −0.49 / 0.31 | 0.82 to 0.90 (0.79 to 0.87) | 0.04 / 0.06 | 29.2 ± 0.31 | 2.70 / 2.70 / 1.18 / 1.04 | pass |
| rifle-walk-right (loop, rifle) | 1.89 (1.26) | −0.50 / 0.09 | 0.86 to 0.94 (0.83 to 0.92) | 0.02 / 0.03 | 29.3 ± 0.55 | 2.89 / 2.89 / 1.23 / 1.03 | pass |

Root speed of the strafe walks: 1.53 m/s on the reference skeleton, 1.74 m/s baked on capitao-caveira (hips scale 1.14). Reload walks forward at 0.79 m/s (reference).

## Library

`tools/animations/build-library.mjs --catalog=<studio-assets>/animations/catalog.json --out=<dir>` converts the whole private catalog (`tools/lib/animation-library.mjs` holds the rules) into `<dir>/reference/*.glb` and `<dir>/index.json`; bake and QA it per character with the commands above, then `tools/animations/library-report.mjs --index=<dir>/index.json --qa=<label>=<qa.json>...` writes each verdict into the index and prints the category table.

- **Skipped**: T-poses (`utility-pose`), rig files (`rig`), swimming (no water in the game), and the second copy of a take the catalog marks `same_take_as` (the pack copy is kept over the loose download).
- **Sources**: Mixamo FBX as cataloged; UAL actions from the `_RM` files (root motion; same actions as `_Standard`).
- **Loop**: `_Loop` UAL actions loop; one-shot categories (death, hit reactions, reloads, draw/holster, grenades, stance transitions, climbing, rolls, turns, jumps) never do; every other clip loops when its first and last frames agree within the QA seam limit (1.5 cm, 5°).
- **Hold**: rifle clips of locomotion, idle, fire, turn and jump categories hold a rifle with both hands (grip gate); other rifle clips are `rifle-partial`; pistol, knife and sword/shield as cataloged.
- **Airborne**: both source feet more than 8 cm above their rest heights for at least 2 frames.
- **Keys** (`index.json`: `key`, `keyStatus`, `primary`; one primary per key): `state` (a candidate for one of the 11 runtime states), `vocabulary` (an `animations.extra` name of the pack contract, `extraClipNames` in `tools/lib/character-pack.mjs`, imported as the single source), `emote` (`emote_<name>`, for emotes, gestures, breakdance and capoeira), `library` (converted and QA'd, no pack key: soccer, prone, cover, injured, melee, ...).

The library's own extra names (`LIBRARY_EXTRA_NAMES`: 8-way diagonals as `<gait>_<fwd|back>_<left|right>`, `sprint_*`, `crouchwalk_*`, turns, jump phases, death variants; cardinal walk directions keep `strafe_left`/`strafe_right`/`walk_back`, run backwards keeps `run_back`) must equal the contract's `converterExtraClipNames` (check clause L3).

No catalog clip covers `draw_pistol`, `holster_pistol` or the `walkfire` state.

Library gauntlet (419 converted, 18 skipped, 0 failed; mst and capitao-caveira):

- round 1: 295/419 and 298/419 pass. Systematic: bodies through the floor in lying, rolling and handstand clips (103 failures), floating in running and dance flight phases (69), slide on pivots (48), loops whose seam the 3 cm/10° detector accepted but the gate did not (9), and 23 FBX files FBXLoader could not read (a footer it misreads; now re-parsed with a padded footer);
- round 2: body lift, source-relative floating and hips gates, 1.25× slide ratio, seam detection at the gate limit: 355/419 and 354/419;
- round 3: whole-body lift/drop, limb IK for hands under straight arms. Pinning the ball while the heel is up was tried and reverted (a differently proportioned leg cannot reach it at push-off, so the ball dragged: walk-forward on mst went from 1.6 to 9.6 cm of slide). Final: **372/419 (mst) and 367/419 (capitao-caveira)**.

| category | clips | mst pass | capitao-caveira pass | failure kinds (count over mst + capitao-caveira) |
| --- | --- | --- | --- | --- |
| aim-pose | 3 | 3/3 | 3/3 | n/a |
| climb-vault | 7 | 7/7 | 6/7 | skin stretch (1) |
| cover | 9 | 8/9 | 9/9 | skin stretch (1), back stretch (1) |
| dance-breakdance | 34 | 16/34 | 24/34 | skin stretch (18), back stretch (14), foot slide (12) |
| dance-capoeira | 39 | 29/39 | 28/39 | skin stretch (14), foot slide (13), back stretch (6) |
| death | 10 | 8/10 | 7/10 | skin stretch (3), back stretch (2), floats (1) |
| draw-holster | 2 | 2/2 | 2/2 | n/a |
| emote | 8 | 8/8 | 8/8 | n/a |
| fire | 5 | 5/5 | 5/5 | n/a |
| gesture | 18 | 18/18 | 17/18 | loop seam (1) |
| grenade | 5 | 5/5 | 4/5 | skin stretch (1) |
| hit-reaction | 16 | 15/16 | 15/16 | skin stretch (2), back stretch (1) |
| idle | 13 | 13/13 | 13/13 | n/a |
| injured | 20 | 19/20 | 19/20 | foot slide (2) |
| interaction-prop | 21 | 21/21 | 21/21 | n/a |
| jump | 16 | 15/16 | 16/16 | skin stretch (1), back stretch (1) |
| knife-melee | 4 | 4/4 | 4/4 | n/a |
| locomotion-pistol | 14 | 13/14 | 14/14 | skin stretch (1), back stretch (1) |
| locomotion-rifle | 19 | 18/19 | 18/19 | skin stretch (1), back stretch (1), two-hand grip drifts (1) |
| locomotion-rifle-8way | 32 | 31/32 | 32/32 | skin stretch (1), back stretch (1) |
| locomotion-unarmed | 6 | 6/6 | 6/6 | n/a |
| melee | 19 | 17/19 | 17/19 | skin stretch (2), foot slide (2), back stretch (1) |
| prone | 12 | 9/12 | 1/12 | skin stretch (14), back stretch (3), floats (1) |
| reload | 5 | 5/5 | 4/5 | skin stretch (1) |
| roll-slide | 4 | 4/4 | 4/4 | n/a |
| soccer | 54 | 50/54 | 48/54 | skin stretch (9), back stretch (5), foot slide (1) |
| spell | 4 | 4/4 | 4/4 | n/a |
| stance-transition | 4 | 4/4 | 4/4 | n/a |
| turn | 9 | 8/9 | 8/9 | foot slide (2) |
| victory-defeat | 4 | 4/4 | 3/4 | skin stretch (1) |
| zombie | 3 | 3/3 | 3/3 | n/a |
| **total** | 419 | 372/419 | 367/419 | |

Of the remaining failures, 32 (mst) and 30 (capitao-caveira) are skin stretch only: breakdance, capoeira and prone poses past what the donor's and the Blender rig's weights hold (worst 4.12× on mst `breakdance-footwork-to-freeze`, 4.57× on capitao-caveira `prone-left-turn`); that is rig repair (P4), not conversion. The rest is foot slide on spins and pivots in dances, turns and a few melee/injured clips (4.1 to 14 cm against 4 to 11 cm limits), two capitao-caveira death/prone frames floating 4 to 5 cm, one loop seam (1.69 cm) and one grip drift (3.03 cm). Among keyed primaries, four mst clips fail on stretch only (`run_pistol`, `death_right`, `death_front`, `crouchwalk_fwd_left`) and capitao-caveira's `death_front` slides 6.2 cm.

## Spine map

The client maps the Mixamo spine by name (`Spine`→`Spine`, `Spine2`→`Spine02`). Measured on the 10 current game states that have a catalog source (`walkfire` has none), converted both ways and baked onto mst, capitao-caveira (Blender rig) and doutora (legacy rig); evidence in `csbrasil/local/anim-conv-20261109/spine/` (`torso-direction.json`, `*/qa-*.json`, sheets `sheets/spine-<character>-<map>.png`).

Mean local bend away from rest at the three spine joints, low to high (degrees):

| state | source (Mixamo Spine / Spine1 / Spine2) | anatomical (Spine02 / Spine01 / Spine) | by name (Spine02 / Spine01 / Spine) |
| --- | --- | --- | --- |
| idle | 6.4 / 5.6 / 9.5 | 6.4 / 5.6 / 9.5 | 21.4 / 9.5 / 5.6 |
| walk | 14.4 / 18.7 / 18.9 | 14.4 / 18.7 / 18.9 | 49.1 / 18.9 / 18.7 |
| run | 13.7 / 16.5 / 16.2 | 13.7 / 16.5 / 16.2 | 45.4 / 16.2 / 16.5 |
| shoot | 7.9 / 16.4 / 16.4 | 7.9 / 16.4 / 16.4 | 40.7 / 16.4 / 16.4 |
| death | 13.2 / 9.7 / 9.8 | 13.2 / 9.7 / 9.8 | 31.7 / 9.8 / 9.7 |
| crouch | 16.7 / 17 / 21 | 16.7 / 17 / 21 | 54.6 / 21 / 17 |
| crouchwalk | 24.9 / 16.1 / 16.7 | 24.9 / 16.1 / 16.7 | 56.9 / 16.7 / 16.1 |
| jump | 23.3 / 7.1 / 7.1 | 23.3 / 7.1 / 7.1 | 37.5 / 7.1 / 7.1 |
| idle1h | 7.9 / 8.3 / 8.3 | 7.9 / 8.3 / 8.3 | 23.9 / 8.3 / 8.3 |
| walk1h | 5.7 / 5.1 / 10.2 | 5.7 / 5.1 / 10.2 | 16.1 / 10.2 / 5.1 |

By name, the chest's world rotation lands on the waist joint: the lowest spine joint bends 16 to 57° where the source bends 6 to 25°, and the upper two get the source's values swapped. Skin stretch barely changes (mst back 3.311× vs 3.312×; doutora 2.05× vs 2.07×; capitao-caveira 1.95× vs 2.25×, lower with the anatomical map in 5 of 10 states and higher in 3); all clips pass on both maps except capitao-caveira `run` (a 3.7 cm float that both maps share). The client's current clips (its shared pack baked with its `retarget-glb.mjs`) fail 8/11 on mst, 11/11 on capitao-caveira and 7/11 on doutora on floor contact (floating up to 40 cm in `jump`, penetrating up to 20 cm in `death`); that comparison uses different source takes, so it shows the contact handling, not the spine map.

**Recommendation: keep the anatomical map.** It reproduces where the source bends; stretch is equal or lower. The client stays as it is until its clips are regenerated from this pipeline.

## Legacy client rigs (P5 pilot)

`bake-character.mjs` bakes the client's legacy rigs as they are: 74 bodies (`public/models/characters`, 24 to 28 joints) and 26 skins (`public/models/skins`, 26 joints), all with meshy-28 names. Joints match by name; the helpers no clip drives stay at rest and are listed in `bakedFor.unanimated` (`Curl_L`/`Curl_R`, plus `Curl_L_Tip`/`Curl_R_Tip` on doidinho-bairro, programador-virado and motoca-cachorro-loko, and `neutral_bone` on motoca-cachorro-loko). Every rig has the 22 joints clips animate (plus `head_end` and `headfront`); the 24-joint rigs lack only the `Curl_*` helpers, which clips never drive.

Run on all 100 (client `6ae417eeb`): the 11 states from the library primaries (walkfire = walk-forward: no catalog clip walks while firing) plus the 21 contract extras, each baked per character, against what the client ships today (per-character merged GLB, the shared `mixamo.glb` for missing states, skin-embedded clips) and against the unbaked reference clips (a shared pack). Evidence (private): `csbrasil/local/anim-conv-20261109/legacy/` (`summary.md`, `summary-round{1,2,3}.json`, `<id>/qa-{new,current,shared}.json`, `sheets/`).

| set | strict pass | pass, rig stretch aside |
| --- | --- | --- |
| new, 11 states | 708/1100 | 1085/1100 |
| new, 21 extras | 1325/2100 | 2084/2100 |
| shipped today, 11 states | 343/1100 | 582/1100 |
| shared pack (unbaked), 11 states | 76/1100 | |

Today's clips fail mostly on floor contact (465 failures: feet through the floor up to 13 cm, bodies floating); 32 characters break even the clip-free synthetic poses (rig weights: barbudo, cuca, profeta-calcada, lula-mandrake, ...), which the lula weight repair addresses. The remaining clip-side failures are cuca (a bent-leg mascot: human locomotion drives its shins into the floor), small grip drifts in run/run_back and a few stance slides (microfonildo, zero-um-mandrake, ancap death).

No state passes as a shared clip on more than 35 of 100 rigs, so every state is baked per character: about 255 KB merged for the 11 states (53 KB gzip after resampling and int16 rotations) and 653 KB for the 21 extras (207 KB gzip), against 372 KB for today's per-character merged states.

**Packed run (130 characters).** The 100 legacy rigs plus the 30 Blender-rigged characters that pass the v4 pose test (`csbrasil/local/rig-blender-20261109/v4`), each baked with the 11 states and the 66 contract extras the library has (all of them but `draw_pistol` and `holster_pistol`, which have no source), packed and gated as stored. Evidence (private): `csbrasil/local/anim-conv-20261109/legacy-out/` (`<id>/{states.glb,extra.glb,manifest.json,qa-*.json}`, `summary.md`, `summary.json`, round 1 in `_round1/`).

| packed clips | pass | rig weights only | clip failures |
| --- | --- | --- | --- |
| 100 legacy rigs, 11 states | 710 | 385 | 5 |
| 100 legacy rigs, 66 extras | 4012 | 2530 | 58 |
| 30 Blender rigs, 11 states | 317 | 11 | 2 |
| 30 Blender rigs, 66 extras | 1790 | 119 | 71 |

"Rig weights only": every failure is skin stretch on a rig that breaks the clip-free synthetic poses, or tagged `[rig]` (worst vertex weights, bent-knee bind), or on a clip the clean reference rigs (mst, capitao-caveira) carry without stretch. Round 1 had 686 clip failures; leaving bent-bound legs unaligned, the two-hand grip hold and the flight-phase drop took them to 136. cuca is baked with `--passive-knees`: states hips at most 1.037 of bind height, at most 2 cm above the source's feet, no gate failure besides the rig's stretch; its tail still sinks up to 29 cm, against 52 cm with today's clips.

## Packs

`tools/animations/pack-character.mjs --clips=<baked dir> --out=<dir> --id=<id> --model=<character.glb>` packs one character's baked clips for the client:

- `states.glb`: the 11 runtime states, one animation each, named by state;
- `extra.glb`: every contract extra name (`extraClipNames` in `tools/lib/character-pack.mjs`) present in the baked dir, named by its key; loaded lazily;
- `manifest.json` (`coro-solto/character-clips@1`): model file and sha256, per file sha256, bytes, gzip bytes and clip list, per clip its file, duration, loop, hold, airborne, root speed (m/s at this character's scale) and velocity, and provenance (the studio-assets catalog id and take).

Packing (`tools/lib/clip-pack.mjs`) drops redundant keys (`resample`, tolerance 1e-4), shares identical accessors (`dedup`) and stores rotation outputs as normalized int16 quaternions. Both are core glTF 2.0 (rotation sampler outputs may be normalized SHORT): the client's `GLTFLoader` dequantizes them in `_getArrayFromAccessor`, with no extension or decoder. `clip-qa --pack=<pack.glb>` gates every clip of a pack as stored, and the readers (`clipSampler`, `gltfPoseSource`) dequantize normalized outputs like three.js (`accessorFloats`).

| per character (130 characters) | uncompressed | packed |
| --- | --- | --- |
| `states.glb` (11 clips) | 329 KB, 162 KB gzip | 144 to 148 KB, 52 to 54 KB gzip |
| `extra.glb` (66 clips) | 2.06 MB, 1.01 MB gzip | 1.05 to 1.07 MB, 439 to 450 KB gzip |

Packing lost no pass: on all 130 characters and 77 clips the packed QA passes every clip the uncompressed one does (one more, a walk_back_left slide on oakley at the limit). `EXT_meshopt_compression` would take another 15% (states) to 25% (extras) off the gzip size; the client already registers `MeshoptDecoder` (`public/vendor/meshopt_decoder.module.js`, 29 KB) in its `GLTFLoader`, but the Studio readers would need the decoder too, so packs stay core glTF for now.

## Limits and residual issues

- **Hips sit 0.02 to 0.08 of the bind height above the source's** (pilot ratio columns). The reference skeleton's thigh/shin proportions differ from Mixamo's X Bot, and ground contact keeps the feet faithful, not the hips height; with straight-leg alignment, the same knee angle leaves the hips a little higher. Visually the character stands slightly taller in crouches (0.54 vs 0.48 of rest in the deepest `grenade-throw` kneel on capitao-caveira). The hips gate allows the source's height + 0.08 for this reason.
- **Foot slide on spins and pivots** (dances, turns): the ankle is pinned, the ball follows the character's own foot length.
- **Skin stretch in extreme poses** is the rigs' (P4).
- **Grip distance is set by proportions.** `rifle` holds are held within 2 cm over time (`holdTwoHandGrip`) but the hands sit 29 to 30 cm apart on the reference; another weapon length needs the client's hand IK or a per-weapon arm adjustment.
- **Root motion is a straight line.** Turning clips, curved paths and yaw are not extracted (hips yaw stays in the clip).
- **Contacts need root motion.** In-place sources (UAL `*_Standard.glb`) yield no contact windows for locomotion; the library uses the `_RM` files.
- **Floor clamp runs only in bake** (the reference skeleton has no mesh).
- **Geometry skinned to a shin** (cuca's tail on `RightLeg`): `--passive-knees` keeps the body down, but the tail swings through the floor (up to 29 cm) until the rig's weights are repaired.
- **Remaining clip failures (136 of 10010 packed clips):** hips 1.08 to 1.16 of bind height on run diagonals and death_front for short-legged Blender rigs (53), foot slide 4 to 8 cm on crouch-walk diagonals (42, half on boneca-da-cristaleira, whose rig breaks the synthetic poses at 24×), and skin stretch 3.5 to 4.9× on death_front, death_right, run_pistol and crouchwalk_fwd_left, clips that also stretch mst slightly (3.6×).
