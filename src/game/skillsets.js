import { chemistryDetails } from './chemistry';
import { weightedPick } from './rng';

// Position preferences affect draw odds (3:1), never eligibility or player quality.
const rows = [
  ['Three and D', 'Spaces the floor and defends the perimeter.', 'Guard,Forward'],
  ['Vertical Finisher', 'Finishes lobs above the rim.', 'Forward,Big'],
  ['Locker Room Guy', 'Adds +1 flat Offense and Defense from anywhere on the roster; does not stack.', 'Guard,Forward,Big'],
  ['Three Point Specialist', 'Punishes defenses that leave a shooter open.', 'Guard,Forward'],
  ['Drive and Kick', 'Penetrates and finds open shooters.', 'Guard'],
  ['Pick-and-Roll Maestro', 'Creates advantages through ball screens.', 'Guard'],
  ['Lob Architect', 'Finds teammates moving toward the rim.', 'Guard,Forward'],
  ['Post Technician', 'Scores inside and draws help defenders.', 'Forward,Big'],
  ['Passing Hub', 'Directs offense with quick reads and precise passes.', 'Forward,Big'],
  ['Backdoor Cutter', 'Exploits defenders watching the ball.', 'Guard,Forward'],
  ['Screen Setter', 'Creates separation for teammates.', 'Forward,Big'],
  ['Floor-Stretching Big', 'Pulls interior defenders away from the basket.', 'Big'],
  ['Rim Runner', 'Sprints into early scoring opportunities.', 'Forward,Big'],
  ['Movement Shooter', 'Scores while relocating and coming off screens.', 'Guard,Forward'],
  ['Downhill Slasher', 'Attacks openings and finishes through traffic.', 'Guard,Forward'],
  ['Grab and Go', 'Turns defensive rebounds into immediate attacks.', 'Guard,Forward'],
  ['Outlet Specialist', 'Starts fast breaks with an early pass.', 'Forward,Big'],
  ['Rim Protector', 'Covers the basket when teammates get beaten.', 'Big'],
  ['Point-of-Attack Defender', 'Pressures the ball and contains penetration.', 'Guard,Forward'],
  ['Glass Cleaner', 'Secures rebounds to end defensive possessions.', 'Forward,Big'],
  ['Switch Defender', 'Covers different positions without breaking the scheme.', 'Forward,Big'],
  ['Help-Side Anchor', 'Rotates, covers gaps, and organizes defense.', 'Forward,Big'],
  ['Passing-Lane Disruptor', 'Anticipates passes and creates turnovers.', 'Guard,Forward'],
  ['Closer', 'Converts difficult scoring opportunities.', 'Guard,Forward'],
];
export const SKILLSETS = rows.map(([name, description, positions], i) => ({
  id: `skill-${String(i + 1).padStart(2, '0')}`, name, description, positions: positions.split(','),
}));
export const skillsetFor = (player) => SKILLSETS.find((s) => s.id === player?.skillsetId) || null;
export function rollSkillset(position) {
  return weightedPick(SKILLSETS.map((s) => ({ ...s, weight: s.positions.includes(position) ? 3 : 1 }))).id;
}

// Each unordered pairing appears once. All unspecified pairs, including duplicates, are neutral.
const eliteOff = [[1,5],[2,6],[4,8],[7,13],[9,10],[9,24],[11,14],[12,15],[16,17]];
const goodOff = [[1,6],[1,24],[2,7],[2,12],[4,5],[4,9],[4,11],[5,12],[6,10],[7,14],[8,10],[8,9],[13,16],[13,17],[15,16],[16,23],[17,23],[17,20]];
const eliteDef = [[18,19],[20,22],[21,23]];
const goodDef = [[1,18],[18,20],[19,21],[19,22],[21,22]];
export const SKILLSET_PAIRS = [
  ...eliteOff.map((pair) => ({ pair, side: 'offense', percent: 3 })),
  ...goodOff.map((pair) => ({ pair, side: 'offense', percent: 1 })),
  ...eliteDef.map((pair) => ({ pair, side: 'defense', percent: 3 })),
  ...goodDef.map((pair) => ({ pair, side: 'defense', percent: 1 })),
].map(({ pair, ...rule }) => ({ ...rule, skills: pair.map((n) => SKILLSETS[n - 1].id) }));
export const SYNERGY_CAP = 12;

export function teamSynergy(team, ids = team.activeIds || []) {
  const active = new Set(ids);
  const skills = new Set((team.hand || []).filter((p) => active.has(p.id)).map((p) => p.skillsetId));
  const pairs = SKILLSET_PAIRS.filter((rule) => rule.skills.every((id) => skills.has(id)));
  const rawOffense = pairs.filter((p) => p.side === 'offense').reduce((n,p) => n+p.percent, 0);
  const rawDefense = pairs.filter((p) => p.side === 'defense').reduce((n,p) => n+p.percent, 0);
  const flat = (team.hand || []).some((p) => p.skillsetId === 'skill-03') ? 1 : 0;
  const skillOffense = Math.min(SYNERGY_CAP, rawOffense);
  const skillDefense = Math.min(SYNERGY_CAP, rawDefense);
  const chemistry = chemistryDetails(team, ids, skillOffense, skillDefense, flat);
  return { pairs, rawOffense, rawDefense, skillOffense, skillDefense, flat, ...chemistry,
    offense: skillOffense + chemistry.continuity, defense: skillDefense + chemistry.continuity };
}

export function applySynergy(base, team, ids, side) {
  const synergy = teamSynergy(team, ids);
  return Math.round((base * (1 + synergy[side] / 100) + synergy.flat) * 100) / 100;
}
