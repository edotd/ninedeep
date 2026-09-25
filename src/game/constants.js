// Ported verbatim from nine-deep.html — the single-player prototype is the spec.
// Do not change values or behavior here without checking against that file.

export const POSITIONS = ['Guard', 'Forward', 'Big'];
export const ERA_LENGTH = 9;
export const LEAGUE_TEAM_COUNT = 9;

// Forfeiting a pick's cap bonus scales from FORFEIT_BONUS_MAX (1st overall) down to
// FORFEIT_BONUS_MIN (last) — see draft.js's forfeitBonusForPosition.
export const FORFEIT_BONUS_MAX = 2;
export const FORFEIT_BONUS_MIN = 0.5;

export const ARCHETYPES = {
  'Pass-First': { base: { SCO: 4, PLM: 10, REB: 3, DEF: 5 }, peak: 'PLM' },
  'Scorer':     { base: { SCO: 10, PLM: 4, REB: 3, DEF: 4 }, peak: 'SCO' },
  'Playmaker':  { base: { SCO: 6, PLM: 9, REB: 2, DEF: 4 }, peak: 'PLM' },
  'Balanced':   { base: { SCO: 6, PLM: 6, REB: 6, DEF: 6 }, peak: 'SCO' },
  'Marksman':   { base: { SCO: 9, PLM: 2, REB: 2, DEF: 4 }, peak: 'SCO' },
  'Rebounder':  { base: { SCO: 3, PLM: 2, REB: 10, DEF: 5 }, peak: 'REB' },
  'Defender':   { base: { SCO: 2, PLM: 3, REB: 5, DEF: 10 }, peak: 'DEF' },
};

export const POSITION_MOD = {
  Guard:   { SCO: 1, PLM: 2, REB: -2, DEF: -1 },
  Forward: { SCO: 0, PLM: 0, REB: 0, DEF: 0 },
  Big:     { SCO: -1, PLM: -2, REB: 2, DEF: 1 },
};

// Card rarity — same four-tier vocabulary Adjustment cards already use (see skillsets.js's
// SKILLSET_PAIRS "Core/Prime/Signature" comment and supplementalCards.js's own `rarity` field),
// now extended to player and coach cards. Assigned by relative power/scarcity within each of
// player tiers, League Accolades, and coach modifiers below (not an independent random roll),
// so "rarer = bigger stat bonus + cost" falls out of which tier a card already is rather than
// stacking a second multiplier on top of it.
export const RARITIES = ['Core', 'Prime', 'Signature', 'Legendary'];

// Base Player Modifiers — quality/trait tiers with no age restriction on who can roll them.
export const TIERS = [
  { name: 'Role Player', uniform: 1.00, peak: 1.00, contract: 7, count: 7, rarity: 'Core' },
  { name: 'Journeyman', uniform: 1.05, peak: 1.10, contract: 6, count: 4, rarity: 'Core' },
  { name: 'High IQ', uniform: 1.10, peak: 1.20, contract: 4, count: 4, forceStat: 'PLM', rarity: 'Prime' },
  { name: 'Hustler', uniform: 1.10, peak: 1.20, contract: 4, count: 4, forceStats: ['DEF', 'REB'], rarity: 'Prime' },
  // Peak 1.65 is the single highest of any tier or accolade below (MVP's is 1.55) — the
  // rarest, most powerful Base Player Modifier earns the top rarity outright.
  { name: 'Generational Talent', uniform: 1.30, peak: 1.65, contract: 2, count: 2, rarity: 'Legendary' },
];
// contractVariance widens the ±1 every other tier gets (see cards.js's makeCard) — these
// generic fillers are the initial roster's bench toppers (see dealHands), and a flat ±1 kept
// every one of them locked into a 5-7 season deal, so a fresh bench was always long-contract
// players. The wider spread mixes real short deals (as low as 3) into the same pool.
export const REPLACEMENT_TIER = { name: 'Undrafted', uniform: 1, peak: 1, contract: 6, contractVariance: 3, rarity: 'Core' };

// Cheap, low-output fillers seeded into free agency at era start. dealHands doesn't check
// budget, so some teams start over cap — these give every team an immediate, low-commitment
// way to shed salary instead of waiting for the first round of releases/expirations to stock
// the free agent pool. Below-floor stat totals still clamp to MIN_PLAYER_SALARY in cardTotal.
export const FREE_AGENT_TIER = { name: 'Undrafted', uniform: 0.7, peak: 1, contract: 3, rarity: 'Core' };
// A handful of even-cheaper fillers mixed into the same pool (see season.js's
// seedFreeAgentPool) — reliably floors out at MIN_PLAYER_SALARY, a genuine salary-dump /
// minimum-contract option distinct from the regular filler above.
export const BARGAIN_FREE_AGENT_TIER = { name: 'Undrafted', uniform: 0.5, peak: 1, contract: 2, rarity: 'Core' };
export const BARGAIN_FREE_AGENT_COUNT = 3;
export const FREE_AGENT_POOL_SIZE = 12;
export const MIN_PLAYER_SALARY = 0.25;
export const MIN_GM_COST = 0.5;

// League Accolades — elite, statistical-distinction tiers. These only roll on players in
// the Prime career stage and never appear in the draft.
export const LEAGUE_ACCOLADES = [
  { name: 'All-Star', uniform: 1.10, peak: 1.20, contract: 4, count: 4, accolade: true, rarity: 'Prime' },
  { name: 'All-League Defensive Team', uniform: 1.10, peak: 1.30, contract: 4, count: 3, forceStat: 'DEF', accolade: true, rarity: 'Prime' },
  { name: 'All-League 2nd Team', uniform: 1.15, peak: 1.30, contract: 4, count: 4, accolade: true, rarity: 'Prime' },
  { name: 'All-League 1st Team', uniform: 1.20, peak: 1.40, contract: 3, count: 3, accolade: true, rarity: 'Signature' },
  { name: 'Defensive Player of the Year', uniform: 1.15, peak: 1.50, contract: 2, count: 2, forceStat: 'DEF', accolade: true, rarity: 'Signature' },
  { name: 'Scoring Champion', uniform: 1.15, peak: 1.50, contract: 2, count: 2, forceStat: 'SCO', accolade: true, rarity: 'Signature' },
  { name: 'Rebounding Champion', uniform: 1.15, peak: 1.50, contract: 2, count: 2, forceStat: 'REB', allowedPositions: ['Forward', 'Big'], accolade: true, rarity: 'Signature' },
  { name: 'Assist Leader', uniform: 1.15, peak: 1.50, contract: 2, count: 2, forceStat: 'PLM', accolade: true, rarity: 'Signature' },
  { name: 'Most Valuable Player', uniform: 1.25, peak: 1.55, contract: 2, count: 3, accolade: true, rarity: 'Legendary' },
];

export const COACH_ARCHETYPES = {
  'Offensive Minded': { offBase: 10, defBase: 2 },
  'Defensive Minded': { offBase: 2, defBase: 10 },
  'Balanced': { offBase: 6, defBase: 6 },
};
// Salary scales with how much a modifier actually boosts a coach, not just its draw weight —
// Hot Headed's bigger die and Genius/Hall of Fame's big multipliers used to cost barely more
// than Strategist's modest +30%, so an elite coach was nearly free relative to the cap. The
// spread is now wide enough that landing one of the top modifiers is a real budget commitment,
// not a strictly-better-for-free upgrade.
// Rolled once per team per possession change (see turn.js's triggerOnTheFly) — a match is
// exactly two possessions, so this fires at most once per matchup, at the exchange 1 -> 2
// changeover.
export const ON_THE_FLY_CHANCE = 0.3;
export const COACH_MODIFIERS = [
  { name: 'Strategist', mult: 1.3, die: 6, weight: 30, salary: 0.5, ability: '', rarity: 'Core' },
  { name: 'Former Player', mult: 1.6, die: 6, weight: 25, salary: 1.25, ability: '', rarity: 'Prime' },
  { name: 'Collegiate Success', mult: 1.1, die: 6, weight: 25, salary: 0.5, ability: '+3% Off/Def and +1 die size for every consecutive season retained (stacks).', rarity: 'Prime' },
  { name: 'Hot Headed', mult: 1.4, die: 7, weight: 12, salary: 1.0, ability: '', rarity: 'Signature' },
  { name: 'On The Fly', mult: 1.15, die: 6, weight: 15, salary: 1.0, ability: `${Math.round(ON_THE_FLY_CHANCE * 100)}% chance to draw a new Adjustment card when possession changes during a matchup.`, rarity: 'Prime' },
  { name: 'Genius', mult: 1.5, die: 6, weight: 10, salary: 2.0, ability: '', rarity: 'Signature' },
  { name: 'Hall of Fame', mult: 2.0, hofDie: true, weight: 8, salary: 3.0, ability: '', rarity: 'Legendary' },
];
// Fanbase archetype — drawn once per era, like Coach. Attendance itself is computed fresh
// each season (see game/fanbase.js) from the archetype's formula, market floor, performance,
// and the team's permanent fanbaseBaseline (built up via season milestones) — attendanceBase
// no longer lives here as a fixed number the way the old FANBASE_TYPES pool worked.
export const FANBASE_ARCHETYPES = [
  { name: 'Steady', weight: 80 },
  { name: 'Fair Weather', weight: 15 },
  { name: 'Die Hard', weight: 5 },
];
// How wide Steady's deterministic performance-to-attendance band is, and Fair Weather's base
// band before it widens for a worse-performing team — see game/fanbase.js's computeAttendance.
export const STEADY_BAND = 0.20;
export const FAIR_WEATHER_BASE_BAND = 0.15;

// Fanbase mods — one rolled per team per season (like a matchup card), shared pool. Team
// Pride is restricted to certain archetypes (see restrictTo); Sixth Man / Mind Games are live
// in-matchup effects resolved in engine.js's rollCurrentMatchup, the rest reshape the season's
// attendance calculation in game/fanbase.js.
export const FANBASE_MODS = [
  { name: 'Team Pride', weight: 5, restrictTo: ['Steady', 'Die Hard'], effect: 'nullify-decrease', flavor: 'Nullifies any decrease in fanbase attendance this season.' },
  { name: 'Invested', weight: 30, effect: 'cap-decrease', flavor: "Caps how far this season's attendance can fall." },
  { name: 'Corporate', weight: 30, effect: 'cap-increase', flavor: "Caps how far this season's attendance can climb." },
  { name: 'Sixth Man', weight: 20, effect: 'live-bonus', needsValue: true, valueDie: 10, flavor: 'A raucous home crowd. Opponents must beat a roll or you get +1 to your score.' },
  { name: 'Mind Games', weight: 15, effect: 'live-penalty', needsValue: true, valueDie: 10, flavor: "A hostile crowd gets in a player's head. Opponents must beat a roll or a random active player is thrown off their game." },
];
export const FANBASE_ATTENDANCE_MAX_SWING = 0.10; // Invested / Corporate cap, in attendance points

// Market — Small through Massive, each with an attendance floor (see game/fanbase.js) and a
// cap-adjustment range (the actual capAdj is rolled within it at pull time — see
// economy.js's rollMarketCapAdj). A new market is rolled with every new GM.
export const MARKETS = [
  { name: 'Small', weight: 25, capAdjMin: 0.5, capAdjMax: 1.0, attendanceFloor: 0.50 },
  { name: 'Medium', weight: 40, capAdjMin: 1.0, capAdjMax: 1.75, attendanceFloor: 0.60 },
  { name: 'Large', weight: 25, capAdjMin: 1.75, capAdjMax: 2.5, attendanceFloor: 0.70 },
  { name: 'Massive', weight: 10, capAdjMin: 2.5, capAdjMax: 3.5, attendanceFloor: 0.80 },
];
export const GM_TYPES = ['Aggressive', 'Hands-Off', 'Neutral'];
export const GM_BONUS_RATE = 0.02;
export const HANDS_OFF_BONUS_CAP = 0.12;

// Front-office moves (fire coach, fire GM, invest in fanbase) spend budget room —
// see game/finances.js — rather than a separate currency, so these costs are tuned to
// typical budget-room magnitudes (a few coins), not a standalone balance's larger scale.
export const FANBASE_BOOST_COST = 2;
export const FANBASE_BOOST_AMOUNT = 0.02;

// Season milestone bumps — permanent additions to a team's fanbaseBaseline (see
// game/fanbase.js). Season End scales by final seed; the rest are flat.
export const MILESTONE_PLAYOFF_BERTH = 0.005;
export const MILESTONE_HOME_COURT = 0.005;
export const MILESTONE_PLAYOFF_WIN = 0.0075;
export const MILESTONE_CHAMPIONSHIP = 0.02;
export const MILESTONE_SEASON_END_BEST = 0.010; // seed 1
export const MILESTONE_SEASON_END_WORST = 0.002; // seed 8 (missed playoffs = 0)

export const AI_NAMES = ['Ironclad Capital', 'Harborline Holdings', 'Vantage Point Group', 'Steel & Sycamore', 'Continental Ledger Co.', 'Northgate Ventures', 'Granite Peak Partners', 'Meridian Sports Partners', 'Cobalt Ridge Capital'];
// Curated three-letter tricodes for the fixed AI ownership groups, in the same order as
// AI_NAMES — hand-picked rather than run through names.js's tricodeFor() derivation, which
// exists for arbitrary player-chosen franchise names instead. See game/names.js.
export const AI_TRICODES = {
  'Ironclad Capital': 'IRC',
  'Harborline Holdings': 'HAR',
  'Vantage Point Group': 'VPG',
  'Steel & Sycamore': 'STS',
  'Continental Ledger Co.': 'CLC',
  'Northgate Ventures': 'NGV',
  'Granite Peak Partners': 'GPP',
  'Meridian Sports Partners': 'MSP',
  'Cobalt Ridge Capital': 'CRC',
};
export const CHAMPIONSHIP_BAR_MULT = 1.10;
export const INJURY_CHANCE = 0.03;

// How many Matchup Modifier cards a team pulls per season, when Matchup Cards are enabled
// (see settings.matchupCardsEnabled in game/season.js's newEraState).
export const MATCHUP_CARD_DRAW_COUNT = 3;

// Off/Def percentage bonus for Home Court Advantage — a top-4 seed gets it in every playoff
// matchup they play, except against another top-4 seed, where only the higher (numerically
// lower) seed gets it. See game/matchup.js's hasHomeCourt and engine.js's rollCurrentMatchup.
export const HOME_COURT_BONUS = 1;

// Delay (ms) between successive Action Log entries appearing while a matchup rolls out.
// "instant" reveals everything the moment Roll Dice is clicked, no animation at all.
export const ACTION_LOG_SPEEDS = {
  slow: 650,
  normal: 400,
  fast: 175,
  instant: 0,
};

export const PLAYER_RELATIONSHIP_MIN = 1;
export const PLAYER_RELATIONSHIP_MAX = 10;

export { MATCHUP_MODIFIER_TYPES } from './supplementalCards';
