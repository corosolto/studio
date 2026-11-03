# Lajes — 8/9 gauntlet

## Scorecard

| Dimension | Weight |
|---|---:|
| Brazilian fidelity | 30 |
| Spatial coherence and scale | 20 |
| Materials and finish | 15 |
| Composition and immersion | 15 |
| Gameplay readability | 10 |
| Performance | 10 |

Scores from 1 to 10 require justification and evidence. The weighted average cannot compensate for a critical failure: broken geometry, invalid routes, distorted sky or an exceeded budget blocks approval.

## Required loop

1. Record the hypothesis and references.
2. Produce the smallest slice that can test it.
3. Capture the same cameras as the baseline.
4. Review identity, scale, materials, atmosphere and gameplay separately.
5. Run negative or mutant cases whenever a check can produce a false pass.
6. Fix the cause rather than hiding the symptom.
7. Repeat A/B capture and record what changed.
8. Only then submit the result to the owner.

## Minimum cameras

- Spawn and first map read.
- Alley at player height.
- Corner with sidewalk–facade junction.
- Rooftop with water tanks and skyline.
- Sky viewed at the zenith.
- Free roam in motion, not only static poses.

## Deterministic tool gate

Run the local validator against private staging before building a candidate:

```bash
node tools/validate-lajes-gauntlet.mjs \
  /path/to/private/maps/lajes/build/vertical-slice/scene-report.json \
  /path/to/private/maps/lajes/build/vertical-slice
```

For the accepted public captures, append `--evidence-root maps/lajes/gauntlet/evidence/loop-02`. The CLI then validates each capture's `public_evidence` path, byte size and SHA-256 in that directory. No evidence loop is selected implicitly; loop-01 remains rejected/historical.

The validator requires the fixed camera IDs `spawn`, `alley`, `corner`, `rooftop` and `sky`, an upward sky view within 15 degrees of the zenith, existing preview bytes, metric player/door/stair constraints, at least 1.20 m route and stair clear widths, a stair-accessible rooftop route with real Z ascent, a resolved corner junction, at least 1.10 m parapets, exactly two water tanks, verified west-tank service clearance and a coherent skyline. All five `low_captures` are mandatory, and six ordered `route_sequence` frames must match their sidecar and verified image bytes in private and explicitly selected public roots. `fixtures/scene-report.valid.json` is synthetic test input, not Lajes review evidence.

Actual `collision-boxes.json`, `nav-graph.json`, `spawns.json` and `regions.json` data is checked for spawn-to-roof connectivity, segment/AABB clearance using agent radius, step height and a 2.10 m body envelope, stair-riser handling, spawn region membership, camera/spawn alignment, and spawn/walkway obstruction. Exported GLB JSON/BIN data and the export-validation sidecar must agree on valid ranges, strides, finite positions, bounded indices and measured counts. Medium is limited to 90 primitives/100000 triangles and low to 40 primitives/32000 triangles, with strictly fewer low triangles. Floor support and full corridor-width clearance remain unverified.

`npm run smoke:pack` covers missing routes, cameras, low captures and route images, route-sidecar divergence, unsafe evidence paths, undersized dimensions, camera/spawn and region mismatches, absent or non-shrinking LODs, primitive/triangle-budget overflows, GLB/report/sidecar mismatches, non-finite positions, out-of-bounds indices, solid-wall route blockage, low head clearance, obstructed spawns, incomplete declarations, duplicate/unsafe paths, executable JavaScript/shebangs, undeclared files, and hash/size mutations. Passing these checks does not satisfy visual review, runtime physics, free-roam review, client gameplay checks or owner approval.

## Review

- Identify the author.
- Identify the independent reviewer when one exists.
- Record version, hash and environment.
- Preserve rejected attempts in history.
- State missing physical-device or benchmark evidence explicitly.
