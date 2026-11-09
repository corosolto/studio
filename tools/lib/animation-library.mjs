// Animation library rules (docs/animation-conversion.md#library): which studio-assets catalog
// clips are converted, from which file, with which loop/hold flags, and which pack key each
// clip proposes (character-pack `animations` states and `animations.extra` names).
//
// keyStatus:
//   state       a candidate for one of the 11 runtime states (idle, walk, run, ...);
//   vocabulary  a fixed `animations.extra` name of the pack contract;
//   emote       an `emote_` extra name (open prefix of the contract);
//   proposed    a name NOT in the contract yet (8-way diagonals, sprint, turns, ...), listed
//               in PROPOSED_EXTRA_NAMES for the contract;
//   library     converted and QA'd but without a pack key (soccer, prone, cover, ...).
// Several clips may propose the same key; exactly one per key is `primary`.

export const SKIPPED_CATEGORIES = Object.freeze({
  'utility-pose': 'T-pose reference, not a motion',
  rig: 'rig file (single-frame skinned mannequin)',
  swim: 'no water in the game',
});

/** Catalog categories whose clips never loop (one-shot actions); the rest are tested. */
export const ONE_SHOT_CATEGORIES = Object.freeze(['death', 'hit-reaction', 'reload', 'draw-holster', 'grenade', 'stance-transition', 'climb-vault', 'roll-slide', 'turn', 'jump']);
/** Categories where a rifle clip holds the weapon with both hands throughout (grip gate). */
export const TWO_HAND_RIFLE_CATEGORIES = Object.freeze(['locomotion-rifle', 'locomotion-rifle-8way', 'idle', 'fire', 'turn', 'jump']);
/** Loop detection: first and last frames within these limits (positions m, rotations °). */
export const LOOP_SEAM = Object.freeze({ position: 0.015, rotation: 5 }); // = the QA loop-seam gate

const states = {
  'mixamo/pro-rifle-pack/idle': 'idle', 'mixamo/pro-rifle-pack/walk-forward': 'walk', 'mixamo/pro-rifle-pack/run-forward': 'run',
  'mixamo/shooter-pack/firing-rifle': 'shoot', 'mixamo/pro-rifle-pack/death-from-the-back': 'death',
  'mixamo/pro-rifle-pack/idle-crouching': 'crouch', 'mixamo/pro-rifle-pack/walk-crouching-forward': 'crouchwalk',
  'mixamo/basic-shooter-pack/rifle-jump': 'jump', 'mixamo/pistol-handgun-locomotion-pack/pistol-idle': 'idle1h',
  'mixamo/pistol-handgun-locomotion-pack/pistol-walk': 'walk1h',
};
const stateAlternates = {
  'ual/ual1/Pistol_Idle_Loop': 'idle1h', 'ual/ual1/Death01': 'death', 'mixamo/basic-shooter-pack/firing-rifle': 'shoot',
  'mixamo/loose/firing-rifle': 'shoot', 'mixamo/basic-shooter-pack/walking': 'walk', 'mixamo/basic-shooter-pack/rifle-run': 'run',
  'mixamo/loose/rifle-run': 'run', 'mixamo/loose/crouch-walking': 'crouchwalk', 'mixamo/basic-shooter-pack/rifle-aiming-idle': 'idle',
  'mixamo/loose/rifle-aiming-idle': 'idle',
};
const vocabulary = {
  'mixamo/pro-rifle-pack/walk-left': 'strafe_left', 'mixamo/pro-rifle-pack/walk-right': 'strafe_right',
  'mixamo/pro-rifle-pack/walk-backward': 'walk_back', 'mixamo/pro-rifle-pack/run-backward': 'run_back',
  'mixamo/pistol-handgun-locomotion-pack/pistol-strafe': 'strafe_left_pistol', 'mixamo/pistol-handgun-locomotion-pack/pistol-strafe-2': 'strafe_right_pistol',
  'mixamo/pistol-handgun-locomotion-pack/pistol-walk-backward': 'walk_back_pistol',
  'mixamo/basic-shooter-pack/reloading': 'reload_rifle', 'ual/ual1/Pistol_Reload': 'reload_pistol',
  'mixamo/loose/rifle-pull-out': 'draw_rifle', 'mixamo/loose/rifle-put-away': 'holster_rifle',
  'mixamo/loose/standing-react-small-from-front': 'hit_front', 'mixamo/loose/standing-react-small-from-back': 'hit_back',
  'mixamo/loose/standing-react-small-from-left': 'hit_left', 'mixamo/loose/standing-react-small-from-right': 'hit_right',
  'mixamo/loose/standing-react-small-from-headshot': 'hit_head',
  'mixamo/basic-shooter-pack/toss-grenade': 'grenade_throw', 'mixamo/loose/knife-idle': 'knife_idle', 'mixamo/loose/stabbing': 'knife_stab',
  'mixamo/loose/victory': 'victory', 'mixamo/loose/defeated': 'defeat',
};
const vocabularyAlternates = {
  'mixamo/basic-shooter-pack/strafe-left': 'strafe_left', 'mixamo/basic-shooter-pack/strafe-2': 'strafe_left',
  'mixamo/basic-shooter-pack/strafe-right': 'strafe_right', 'mixamo/basic-shooter-pack/strafe': 'strafe_right', 'mixamo/loose/strafe': 'strafe_right',
  'mixamo/basic-shooter-pack/walking-backwards': 'walk_back', 'mixamo/basic-shooter-pack/run-backwards': 'run_back', 'mixamo/loose/run-backwards': 'run_back',
  'mixamo/loose/reload': 'reload_rifle', 'mixamo/loose/reloading': 'reload_rifle',
  'mixamo/loose/standing-react-large-from-front': 'hit_front', 'mixamo/loose/standing-react-large-from-back': 'hit_back',
  'mixamo/loose/standing-react-large-from-left': 'hit_left', 'mixamo/loose/standing-react-large-from-right': 'hit_right',
  'mixamo/basic-shooter-pack/hit-reaction': 'hit_front', 'ual/ual1/Hit_Chest': 'hit_front', 'ual/ual1/Hit_Head': 'hit_head',
  'mixamo/loose/hit-on-side-of-head': 'hit_head',
  'mixamo/loose/grenade-throw': 'grenade_throw', 'mixamo/loose/throw-grenade': 'grenade_throw', 'mixamo/loose/grenade-throw-1': 'grenade_throw',
  'ual/ual2/OverhandThrow': 'grenade_throw', 'mixamo/loose/double-dagger-stab': 'knife_stab', 'mixamo/loose/bayonet-stab': 'knife_stab',
  'mixamo/loose/victory-idle': 'victory', 'mixamo/loose/sad-idle': 'defeat',
};
/* Proposed extra names (not in the contract yet). 8-way: <gait>_<direction> with fwd/back and
   the diagonals fwd_left, fwd_right, back_left, back_right; the cardinal walk directions keep
   the contract's strafe_left/strafe_right/walk_back and run_back. */
const proposed = {
  'mixamo/pro-rifle-pack/walk-forward-left': 'walk_fwd_left', 'mixamo/pro-rifle-pack/walk-forward-right': 'walk_fwd_right',
  'mixamo/pro-rifle-pack/walk-backward-left': 'walk_back_left', 'mixamo/pro-rifle-pack/walk-backward-right': 'walk_back_right',
  'mixamo/pro-rifle-pack/run-left': 'run_left', 'mixamo/pro-rifle-pack/run-right': 'run_right',
  'mixamo/pro-rifle-pack/run-forward-left': 'run_fwd_left', 'mixamo/pro-rifle-pack/run-forward-right': 'run_fwd_right',
  'mixamo/pro-rifle-pack/run-backward-left': 'run_back_left', 'mixamo/pro-rifle-pack/run-backward-right': 'run_back_right',
  'mixamo/pro-rifle-pack/sprint-forward': 'sprint', 'mixamo/pro-rifle-pack/sprint-backward': 'sprint_back',
  'mixamo/pro-rifle-pack/sprint-left': 'sprint_left', 'mixamo/pro-rifle-pack/sprint-right': 'sprint_right',
  'mixamo/pro-rifle-pack/sprint-forward-left': 'sprint_fwd_left', 'mixamo/pro-rifle-pack/sprint-forward-right': 'sprint_fwd_right',
  'mixamo/pro-rifle-pack/sprint-backward-left': 'sprint_back_left', 'mixamo/pro-rifle-pack/sprint-backward-right': 'sprint_back_right',
  'mixamo/pro-rifle-pack/walk-crouching-left': 'crouchwalk_left', 'mixamo/pro-rifle-pack/walk-crouching-right': 'crouchwalk_right',
  'mixamo/pro-rifle-pack/walk-crouching-backward': 'crouchwalk_back',
  'mixamo/pro-rifle-pack/walk-crouching-forward-left': 'crouchwalk_fwd_left', 'mixamo/pro-rifle-pack/walk-crouching-forward-right': 'crouchwalk_fwd_right',
  'mixamo/pro-rifle-pack/walk-crouching-backward-left': 'crouchwalk_back_left', 'mixamo/pro-rifle-pack/walk-crouching-backward-right': 'crouchwalk_back_right',
  'mixamo/pro-rifle-pack/idle-aiming': 'idle_aim', 'mixamo/pro-rifle-pack/idle-crouching-aiming': 'crouch_aim',
  'mixamo/pistol-handgun-locomotion-pack/pistol-run': 'run_pistol', 'mixamo/pistol-handgun-locomotion-pack/pistol-run-backward': 'run_back_pistol',
  'mixamo/pistol-handgun-locomotion-pack/pistol-kneeling-idle': 'crouch_pistol', 'mixamo/pistol-handgun-locomotion-pack/pistol-jump': 'jump_pistol',
  'ual/ual1/Pistol_Shoot': 'shoot_pistol', 'mixamo/loose/crouch-rapid-fire': 'shoot_crouch',
  'mixamo/pro-rifle-pack/turn-90-left': 'turn_left', 'mixamo/pro-rifle-pack/turn-90-right': 'turn_right',
  'mixamo/pro-rifle-pack/crouching-turn-90-left': 'crouch_turn_left', 'mixamo/pro-rifle-pack/crouching-turn-90-right': 'crouch_turn_right',
  'mixamo/pro-rifle-pack/jump-up': 'jump_start', 'mixamo/pro-rifle-pack/jump-loop': 'jump_loop', 'mixamo/pro-rifle-pack/jump-down': 'jump_land',
  'mixamo/pro-rifle-pack/death-from-the-front': 'death_front', 'mixamo/pro-rifle-pack/death-from-right': 'death_right',
  'mixamo/pro-rifle-pack/death-from-front-headshot': 'death_headshot_front', 'mixamo/pro-rifle-pack/death-from-back-headshot': 'death_headshot_back',
  'mixamo/pro-rifle-pack/death-crouching-headshot-front': 'death_crouch',
};
const proposedAlternates = {
  'ual/ual1/Jump_Start': 'jump_start', 'ual/ual1/Jump_Loop': 'jump_loop', 'ual/ual1/Jump_Land': 'jump_land',
  'mixamo/basic-shooter-pack/turn-left': 'turn_left', 'mixamo/loose/turn-right': 'turn_right',
  'ual/ual1/Sprint_Loop': 'sprint', 'mixamo/pistol-handgun-locomotion-pack/pistol-jump-2': 'jump_pistol',
};
/* The pack contract's fixed extra names (corosolto/studio branch feat/pack-optional-clips-20261109,
   tools/lib/character-pack.mjs#extraClipNames; import it from there once that PR lands). */
export const CONTRACT_EXTRA_NAMES = Object.freeze([
  'strafe_left', 'strafe_right', 'walk_back', 'run_back', 'strafe_left_pistol', 'strafe_right_pistol', 'walk_back_pistol',
  'reload_rifle', 'reload_pistol', 'draw_rifle', 'holster_rifle', 'draw_pistol', 'holster_pistol',
  'hit_front', 'hit_back', 'hit_left', 'hit_right', 'hit_head', 'grenade_throw', 'knife_idle', 'knife_stab', 'victory', 'defeat',
]);
export const RUNTIME_STATES = Object.freeze(['idle', 'walk', 'run', 'shoot', 'death', 'crouch', 'crouchwalk', 'jump', 'idle1h', 'walk1h', 'walkfire']);
export const PROPOSED_EXTRA_NAMES = Object.freeze([...new Set([...Object.values(proposed), ...Object.values(proposedAlternates)])].sort());
const EMOTE_CATEGORIES = { emote: '', gesture: '', 'dance-breakdance': 'breakdance_', 'dance-capoeira': 'capoeira_' };

const leaf = (id) => id.split('/').pop();
const snake = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
/** Library file stem of a catalog id: `pro-rifle-pack--walk-left`, `ual1--walk-loop`. */
export const libraryName = (id) => id.replace(/^mixamo\//, '').replace(/^ual\//, '').split('/').map((p) => p.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).join('--');

/** Preference between two catalog takes of the same motion: packs before loose downloads, then id order. */
const preferred = (a, b) => {
  const loose = (id) => id.includes('/loose/');
  if (loose(a) !== loose(b)) return loose(a) ? b : a;
  return a < b ? a : b;
};

/**
 * Plan the library from a studio-assets catalog: { clips: [{ id, name, key, keyStatus, primary,
 * category, file, action, loop ('auto' | boolean), hold, ... }], skipped: [{ id, reason }] }.
 */
export function planLibrary(catalog) {
  const clips = [], skipped = [];
  const usedEmotes = new Set();
  for (const c of catalog.clips) {
    if (SKIPPED_CATEGORIES[c.category]) { skipped.push({ id: c.id, category: c.category, reason: SKIPPED_CATEGORIES[c.category] }); continue; }
    const twin = (c.same_take_as || []).map((t) => t.id).find((other) => preferred(c.id, other) === other);
    if (twin) { skipped.push({ id: c.id, category: c.category, reason: `same take as ${twin} (kept)` }); continue; }
    let key = null, keyStatus = 'library', primary = false;
    if (states[c.id]) [key, keyStatus, primary] = [states[c.id], 'state', true];
    else if (stateAlternates[c.id]) [key, keyStatus] = [stateAlternates[c.id], 'state'];
    else if (vocabulary[c.id]) [key, keyStatus, primary] = [vocabulary[c.id], 'vocabulary', true];
    else if (vocabularyAlternates[c.id]) [key, keyStatus] = [vocabularyAlternates[c.id], 'vocabulary'];
    else if (proposed[c.id]) [key, keyStatus, primary] = [proposed[c.id], 'proposed', true];
    else if (proposedAlternates[c.id]) [key, keyStatus] = [proposedAlternates[c.id], 'proposed'];
    else if (EMOTE_CATEGORIES[c.category] != null || c.id === 'ual/ual1/Dance_Loop') {
      const base = snake(leaf(c.id).replace(/_Loop$/i, ''));
      let name = `emote_${(EMOTE_CATEGORIES[c.category] || '') + base.replace(/^breakdance_/, '')}`.slice(0, 41).replace(/_$/, '');
      for (let n = 2; usedEmotes.has(name); n += 1) name = `${name.slice(0, 38)}_${n}`;
      usedEmotes.add(name);
      [key, keyStatus, primary] = [name, 'emote', true];
    }
    const ual = c.source === 'quaternius-ual';
    const loop = /_Loop$/.test(c.action || '') ? true : ONE_SHOT_CATEGORIES.includes(c.category) ? false : 'auto';
    const hold = c.weapon === 'rifle' ? (TWO_HAND_RIFLE_CATEGORIES.includes(c.category) ? 'rifle' : 'rifle-partial')
      : ['pistol', 'knife', 'sword/shield'].includes(c.weapon) ? c.weapon.replace('/', '-') : 'none';
    clips.push({
      id: c.id, name: libraryName(c.id), key, keyStatus, primary, category: c.category, pack: c.pack, weapon: c.weapon,
      // UAL: the _RM file carries root motion (the Standard file is in place), same actions.
      file: ual ? (c.root_motion_variant?.file || c.file) : c.file, action: c.action || null, loop, hold,
    });
  }
  return { clips, skipped };
}
