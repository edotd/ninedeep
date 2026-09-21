import { chemistryDetails } from './chemistry';
import { weightedPick } from './rng';

// `positions` and `families` are both hard eligibility gates, not weights — a player can only
// roll a skillset whose position list includes their own position, and whose family list
// matches their archetype's peak stat (or 'ANY'). Position used to be a 3:1 draw-odds
// preference instead of a real gate, which let a low-odds roll still land badly-fit skillsets
// on the wrong position (a Guard coming up Floor-Stretching Big or Rim Protector, a Big-only
// flavor). `families` is which archetype peak-stat(s) (SCO/PLM/REB/DEF) the skillset's flavor
// actually fits, or 'ANY' for the handful with no stat identity: an archetype never rolls a
// skillset outside its families (see rollSkillset/ARCHETYPE_FAMILY below), so a Pass-First
// guard can't come up Rim Runner — it simply can't happen.
const rows = [
  ['Three and D', 'Spaces the floor and defends the perimeter.', 'Guard,Forward', 'SCO,DEF'],
  ['Vertical Finisher', 'Finishes lobs above the rim.', 'Forward,Big', 'SCO'],
  ['Wise Veteran', 'Adds +1% Offense and Defense from anywhere on the roster; does not stack.', 'Guard,Forward,Big', 'ANY'],
  ['Three Point Specialist', 'Punishes defenses that leave a shooter open.', 'Guard,Forward', 'SCO'],
  ['Drive and Kick', 'Penetrates and finds open shooters.', 'Guard', 'PLM'],
  ['Pick-and-Roll Maestro', 'Creates advantages through ball screens.', 'Guard', 'PLM'],
  ['Lob Architect', 'Finds teammates moving toward the rim.', 'Guard,Forward', 'PLM'],
  ['Post Technician', 'Scores inside and draws help defenders.', 'Forward,Big', 'SCO'],
  ['Passing Hub', 'Directs offense with quick reads and precise passes.', 'Forward,Big', 'PLM'],
  ['Backdoor Cutter', 'Exploits defenders watching the ball.', 'Guard,Forward', 'SCO'],
  ['Screen Setter', 'Creates separation for teammates.', 'Forward,Big', 'PLM'],
  ['Floor-Stretching Big', 'Pulls interior defenders away from the basket.', 'Big', 'SCO'],
  ['Rim Runner', 'Sprints into early scoring opportunities.', 'Forward,Big', 'SCO'],
  ['Movement Shooter', 'Scores while relocating and coming off screens.', 'Guard,Forward', 'SCO'],
  ['Downhill Slasher', 'Attacks openings and finishes through traffic.', 'Guard,Forward', 'SCO'],
  ['Grab and Go', 'Turns defensive rebounds into immediate attacks.', 'Guard,Forward', 'REB'],
  ['Outlet Specialist', 'Starts fast breaks with an early pass.', 'Forward,Big', 'REB'],
  ['Rim Protector', 'Covers the basket when teammates get beaten.', 'Big', 'DEF'],
  ['Point-of-Attack Defender', 'Pressures the ball and contains penetration.', 'Guard,Forward', 'DEF'],
  ['Glass Cleaner', 'Secures rebounds to end defensive possessions.', 'Forward,Big', 'REB'],
  ['Switch Defender', 'Covers different positions without breaking the scheme.', 'Forward,Big', 'DEF'],
  ['Help-Side Anchor', 'Rotates, covers gaps, and organizes defense.', 'Forward,Big', 'DEF'],
  ['Passing-Lane Disruptor', 'Anticipates passes and creates turnovers.', 'Guard,Forward', 'DEF'],
  ['Closer', 'Converts difficult scoring opportunities.', 'Guard,Forward', 'SCO'],
];
export const SKILLSETS = rows.map(([name, description, positions, families], i) => ({
  id: `skill-${String(i + 1).padStart(2, '0')}`, name, description, positions: positions.split(','), families: families.split(','),
}));
export const skillsetFor = (player) => SKILLSETS.find((s) => s.id === player?.skillsetId) || null;

// Which peak-stat family an archetype fits for skillset eligibility — 'Balanced' has no single
// specialization (flat base stats), so it's treated as 'ANY' rather than tying it to its
// nominal SCO peak.
const ARCHETYPE_FAMILY = {
  'Pass-First': 'PLM', 'Scorer': 'SCO', 'Playmaker': 'PLM', 'Balanced': 'ANY',
  'Marksman': 'SCO', 'Rebounder': 'REB', 'Defender': 'DEF',
};

export function rollSkillset(position, archetype, careerStage) {
  const family = ARCHETYPE_FAMILY[archetype];
  let eligible = SKILLSETS.filter((s) => s.positions.includes(position));
  if (family && family !== 'ANY') {
    eligible = eligible.filter((s) => s.families.includes('ANY') || s.families.includes(family));
  }
  eligible = eligible.filter((s) => s.id !== 'skill-03' || careerStage === 'Veteran');
  return weightedPick(eligible.map((s) => ({ ...s, weight: 1 }))).id;
}

// Each unordered pairing appears once. All unspecified pairs, including duplicates, are neutral.
// Formerly a flat "Elite Fit" (+3%) / "Good Fit" (+1%) tier per pair; now each pairing is a
// named, formerly-playable Matchup card retired into a passive bonus — same flavor and value it
// had as a card, just always-on for whichever team starts both skillsets, instead of a blind
// per-exchange play. The card itself is removed from supplementalCards.js's deck (see that
// file's note on this same migration) so its effect exists in exactly one place. Legendary-rarity
// cards are deliberately excluded from migration — a passive, guaranteed-if-you-roster-it bonus
// doesn't carry the same weight as a rare, exciting draw, so "Offensive Avalanche" stays a card.
const NAMED_PAIRS = [
  // Offense — 5 Core (+5%), 4 Prime (+10%), 3 Signature (+15%).
  { pair: [1, 5], side: 'offense', percent: 5, name: 'Second-Side Action' },
  { pair: [2, 7], side: 'offense', percent: 5, name: 'Early Offense' },
  { pair: [1, 24], side: 'offense', percent: 5, name: 'Extra Shooting Practice' },
  { pair: [4, 5], side: 'offense', percent: 5, name: 'Drive and Kick' },
  { pair: [4, 8], side: 'offense', percent: 5, name: 'Paint Touches' },
  { pair: [9, 24], side: 'offense', percent: 10, name: 'Focused Film Session' },
  { pair: [4, 12], side: 'offense', percent: 10, name: 'Five-Out Attack' },
  { pair: [11, 14], side: 'offense', percent: 10, name: 'Hot Hand' },
  { pair: [16, 17], side: 'offense', percent: 10, name: 'Pace and Space' },
  { pair: [9, 10], side: 'offense', percent: 15, name: 'Half-Court Clinic' },
  { pair: [12, 15], side: 'offense', percent: 15, name: 'Empty-Side Action' },
  { pair: [2, 6], side: 'offense', percent: 15, name: 'Unstoppable Two-Man Game' },
  // Defense — 5 Core (+5%), 4 Prime (+10%), 4 Signature (+15%).
  { pair: [18, 23], side: 'defense', percent: 5, name: 'Active Hands' },
  { pair: [22, 23], side: 'defense', percent: 5, name: 'Closeout Drill' },
  { pair: [18, 20], side: 'defense', percent: 5, name: 'Protect the Paint' },
  { pair: [19, 23], side: 'defense', percent: 5, name: 'Ball Pressure' },
  { pair: [1, 23], side: 'defense', percent: 5, name: 'Deny the Wing' },
  { pair: [1, 18], side: 'defense', percent: 10, name: 'Switch Everything' },
  { pair: [19, 21], side: 'defense', percent: 10, name: 'Physical Coverage' },
  { pair: [21, 22], side: 'defense', percent: 10, name: 'Shrink the Floor' },
  { pair: [18, 21], side: 'defense', percent: 10, name: 'Ice the Screen' },
  { pair: [19, 22], side: 'defense', percent: 15, name: 'Weak-Side Help' },
  { pair: [21, 23], side: 'defense', percent: 15, name: 'Clamp Down' },
  { pair: [20, 22], side: 'defense', percent: 15, name: 'No Easy Looks' },
  { pair: [18, 19], side: 'defense', percent: 15, name: 'Fortress Defense' },
];
export const SKILLSET_PAIRS = NAMED_PAIRS.map(({ pair, ...rule }) => ({ ...rule, skills: pair.map((n) => SKILLSETS[n - 1].id) }));
// Raised alongside the bigger per-pair values above (was 12, when pairs topped out at 3%) — a
// single Signature pairing (+15%) used to be five separate elite pairs' worth of cap room, which
// would have made the cap the only thing that mattered instead of which pairs you actually have.
export const SYNERGY_CAP = 30;

export function teamSynergy(team, ids = team.activeIds || []) {
  const active = new Set(ids);
  const skills = new Set((team.hand || []).filter((p) => active.has(p.id)).map((p) => p.skillsetId));
  const pairs = SKILLSET_PAIRS.filter((rule) => rule.skills.every((id) => skills.has(id)));
  const rawOffense = pairs.filter((p) => p.side === 'offense').reduce((n,p) => n+p.percent, 0);
  const rawDefense = pairs.filter((p) => p.side === 'defense').reduce((n,p) => n+p.percent, 0);
  const leadership = (team.hand || []).some((p) => p.skillsetId === 'skill-03') ? 1 : 0;
  const skillOffense = Math.min(SYNERGY_CAP, rawOffense);
  const skillDefense = Math.min(SYNERGY_CAP, rawDefense);
  const chemistry = chemistryDetails(team, ids, skillOffense, skillDefense, leadership);
  return { pairs, rawOffense, rawDefense, skillOffense, skillDefense, leadership, ...chemistry,
    offense: skillOffense + chemistry.continuity + leadership, defense: skillDefense + chemistry.continuity + leadership };
}

export function applySynergy(base, team, ids, side) {
  const synergy = teamSynergy(team, ids);
  return Math.round(base * (1 + synergy[side] / 100) * 100) / 100;
}
