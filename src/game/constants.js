// Ported verbatim from nine-deep.html — the single-player prototype is the spec.
// Do not change values or behavior here without checking against that file.

export const POSITIONS = ['Guard', 'Forward', 'Big'];

export const ARCHETYPES = {
  'Dimer':      { base: { SCO: 4, PLM: 10, REB: 3, DEF: 5 }, peak: 'PLM' },
  'Scorer':     { base: { SCO: 10, PLM: 4, REB: 3, DEF: 4 }, peak: 'SCO' },
  'Playmaker':  { base: { SCO: 6, PLM: 9, REB: 2, DEF: 4 }, peak: 'PLM' },
  'Balanced':   { base: { SCO: 6, PLM: 6, REB: 6, DEF: 6 }, peak: 'SCO' },
  'Sniper':     { base: { SCO: 9, PLM: 2, REB: 2, DEF: 4 }, peak: 'SCO' },
  'Rebounder':  { base: { SCO: 3, PLM: 2, REB: 10, DEF: 5 }, peak: 'REB' },
  'Defender':   { base: { SCO: 2, PLM: 3, REB: 5, DEF: 10 }, peak: 'DEF' },
};

export const POSITION_MOD = {
  Guard:   { SCO: 1, PLM: 2, REB: -2, DEF: -1 },
  Forward: { SCO: 0, PLM: 0, REB: 0, DEF: 0 },
  Big:     { SCO: -1, PLM: -2, REB: 2, DEF: 1 },
};

// Base Player Modifiers — quality/trait tiers with no age restriction on who can roll them.
export const TIERS = [
  { name: 'Role Player', uniform: 1.00, peak: 1.00, contract: 7, count: 7 },
  { name: 'Bench Player', uniform: 1.05, peak: 1.10, contract: 6, count: 4 },
  { name: 'All-Star', uniform: 1.10, peak: 1.20, contract: 4, count: 4 },
  { name: 'High IQ', uniform: 1.10, peak: 1.20, contract: 4, count: 4, forceStat: 'PLM' },
  { name: 'Hustler', uniform: 1.10, peak: 1.20, contract: 4, count: 4, forceStats: ['DEF', 'REB'] },
];
export const REPLACEMENT_TIER = { name: 'Undrafted', uniform: 1, peak: 1, contract: 6 };

// League Accolades — elite, statistical-distinction tiers. These can only roll on a player
// whose age falls within the Prime Career Level window (26-35), since you don't win these
// before or after your prime — with one exception: Generational Talent (primeExempt) can
// appear at any age, since it marks a player's ceiling, not a given season's form.
export const LEAGUE_ACCOLADES = [
  { name: 'All-League Defensive Team', uniform: 1.10, peak: 1.30, contract: 4, count: 3, accolade: true },
  { name: 'All-League 2nd Team', uniform: 1.15, peak: 1.30, contract: 4, count: 4, accolade: true },
  { name: 'All-League 1st Team', uniform: 1.20, peak: 1.40, contract: 3, count: 3, accolade: true },
  { name: 'Defensive Player of the Year', uniform: 1.15, peak: 1.50, contract: 2, count: 2, accolade: true },
  { name: 'Scoring Champion', uniform: 1.15, peak: 1.50, contract: 2, count: 2, forceStat: 'SCO', accolade: true },
  { name: 'Rebounding Champion', uniform: 1.15, peak: 1.50, contract: 2, count: 2, forceStat: 'REB', allowedPositions: ['Forward', 'Big'], accolade: true },
  { name: 'Assist Leader', uniform: 1.15, peak: 1.50, contract: 2, count: 2, forceStat: 'PLM', accolade: true },
  { name: 'MVP Candidate', uniform: 1.25, peak: 1.55, contract: 2, count: 3, accolade: true },
  { name: 'Generational Talent', uniform: 1.30, peak: 1.65, contract: 2, count: 2, accolade: true, primeExempt: true },
];

export const COACH_ARCHETYPES = {
  'Offensive Minded': { offBase: 10, defBase: 2 },
  'Defensive Minded': { offBase: 2, defBase: 10 },
  'Balanced': { offBase: 6, defBase: 6 },
};
export const COACH_MODIFIERS = [
  { name: 'Strategist', mult: 1.3, die: 6, weight: 30, salary: 0.5, ability: '' },
  { name: 'Former Player', mult: 1.6, die: 6, weight: 25, salary: 1.0, ability: '' },
  { name: 'Collegiate Success', mult: 1.1, die: 6, weight: 25, salary: 0.5, ability: '+3% Off/Def and +1 die size for every consecutive season retained (stacks).' },
  { name: 'Hot Headed', mult: 1.4, die: 7, weight: 12, salary: 0.5, ability: '' },
  { name: 'Genius', mult: 1.5, die: 6, weight: 10, salary: 1.25, ability: '' },
  { name: 'Hall of Fame', mult: 2.0, hofDie: true, weight: 8, salary: 1.5, ability: '' },
];
export const FANBASE_TYPES = [
  { name: 'Casual', attendanceBase: 0.65, weight: 30 },
  { name: 'Basic', attendanceBase: 0.75, weight: 40 },
  { name: 'Invested', attendanceBase: 0.85, weight: 20 },
  { name: 'Die Hard', attendanceBase: 0.95, weight: 10, ability: 'Once per season: gain Advantage on a matchup — roll twice on both dice and keep the higher of each.' },
];
// Market size only ever adds to the cap — Small is the smallest boost, Large the biggest.
// The actual capAdj on a team's market card is rolled within this range at pull time
// (see economy.js rollMarketCapAdj), not a fixed number.
export const MARKETS = [
  { name: 'Large', weight: 20, capAdjMin: 2.0, capAdjMax: 3.0 },
  { name: 'Basic', weight: 55, capAdjMin: 1.0, capAdjMax: 2.0 },
  { name: 'Small', weight: 25, capAdjMin: 0.5, capAdjMax: 1.0 },
];

export const AI_NAMES = ['Ironclad Capital', 'Harborline Holdings', 'Vantage Point Group', 'Steel & Sycamore', 'Continental Ledger Co.', 'Northgate Ventures', 'Granite Peak Partners', 'Meridian Sports Partners', 'Cobalt Ridge Capital'];
export const CHAMPIONSHIP_BAR_MULT = 1.10;
export const INJURY_CHANCE = 0.03;

// Aging — players 20-40 with a 26-35 "Prime" Career Level window; coaches 40-65 with no
// Career Level curve of their own. See game/aging.js for the bonus this drives.
export const PLAYER_AGE_MIN = 20;
export const PLAYER_AGE_MAX = 40;
export const PLAYER_PRIME_START = 26;
export const PLAYER_PRIME_BASE_END = 35;
export const COACH_AGE_MIN = 40;
export const COACH_AGE_MAX = 65;
export const PLAYER_RELATIONSHIP_MIN = 1;
export const PLAYER_RELATIONSHIP_MAX = 10;

// Matchup Modifier cards: one drawn per team per season, kept all season, cannot be traded/returned.
// "playable" cards require an explicit play action against a target during a specific matchup.
// "passive" cards apply automatically for as long as they're held (bench score boost, seeding boost).
// Injury Prevention is "reactive" — its holder chooses whether to hold it ready before each matchup
// (see wantsInjuryPrevention in game/matchup.js); it no longer triggers automatically.
export const MATCHUP_MODIFIER_TYPES = [
  { name: 'Injury (Minor)', category: 'debuff', weight: 3, flavor: 'A quick tweak — should be fine by tip-off.', playable: true, needsValue: true, valueDie: 6 },
  { name: 'Injury (Major)', category: 'debuff', weight: 1, flavor: 'This one looks serious.', playable: true, needsValue: true, valueDie: 10 },
  { name: 'Distraction (External)', category: 'debuff', weight: 2, flavor: 'Their focus is wavering under the weight of outside noise.', playable: true, needsValue: true, valueDie: 10 },
  { name: 'Distraction (Internal)', category: 'debuff', weight: 2, flavor: 'Internal strife is starting to come between them.', playable: true, needsValue: true, valueDie: 10 },
  { name: 'Player Suspension', category: 'debuff', weight: 2, flavor: 'The league has made a decision and a suspension is imminent.', playable: true, needsValue: true, valueDie: 10 },
  { name: 'Biased Officiating', category: 'debuff', weight: 2, flavor: 'The officials seem to have a favorite tonight.', playable: true, needsValue: false },
  { name: 'Injury Prevention', category: 'buff', weight: 2, flavor: "Your team's medical staff has proven to be exceptional.", playable: false, reactive: true, needsValue: true, valueDie: 10 },
  { name: 'Focused Film Session', category: 'buff', weight: 1, flavor: 'Extra film study sharpens the defense.', playable: true, needsValue: false },
  { name: 'Favorable Schedule', category: 'buff', weight: 1, flavor: 'An easier slate lies ahead.', playable: false, passive: 'seeding' },
  { name: 'Team Chemistry', category: 'buff', weight: 1, flavor: 'This roster just clicks.', playable: false, passive: 'bench' },
  { name: 'Strategic Advantage', category: 'buff', weight: 1, flavor: 'A tactical edge, prepared well in advance.', playable: true, needsValue: false },
  { name: 'Divine Intervention', category: 'buff', weight: 1, flavor: 'The basketball gods are in your favor.', playable: true, needsValue: true, valueDie: 10 },
];
