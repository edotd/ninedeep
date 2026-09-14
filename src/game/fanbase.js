// Fanbase system: archetype (drawn once per era, like Coach) + a seasonal mod (drawn every
// season, like a matchup card) drive a formula that recomputes team.attendance at the end of
// each season. Season milestones (playoff berth, home court, playoff wins, a championship,
// and the season-end result itself) make small permanent additions to team.fanbaseBaseline,
// so a team's attendance floor climbs across the era independent of any single season's luck.
import {
  FANBASE_MODS, STEADY_BAND, FAIR_WEATHER_BASE_BAND, FANBASE_ATTENDANCE_MAX_SWING,
  MARKETS, MILESTONE_PLAYOFF_BERTH, MILESTONE_HOME_COURT, MILESTONE_PLAYOFF_WIN, MILESTONE_CHAMPIONSHIP,
  MILESTONE_SEASON_END_BEST, MILESTONE_SEASON_END_WORST,
} from './constants';
import { weightedPick } from './rng';

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function marketFloorFor(team) {
  const def = MARKETS.find((m) => team.market && m.name === team.market.name);
  return def ? def.attendanceFloor : MARKETS[0].attendanceFloor;
}

// The raw formula value for a season, before this team's permanent baseline or its current
// mod are applied. `percentile` is this team's rank (0 = league-worst, 1 = league-best) by
// last season's average matchup score — 0.5 (neutral) for a team with no season played yet.
function computeAttendanceFormula(team, percentile, floor) {
  const archetype = team.fanbaseArchetype && team.fanbaseArchetype.name;
  if (archetype === 'Die Hard') return 0.90 + Math.random() * 0.10;
  if (archetype === 'Fair Weather') {
    const band = FAIR_WEATHER_BASE_BAND * (1 + (1 - percentile));
    return floor + Math.random() * band;
  }
  return floor + percentile * STEADY_BAND; // Steady, and the default for anything unset
}

// Called once, right when a team's Market is known for the first time (no season played yet,
// so performance is neutral) — gives a starting attendance instead of leaving it undefined.
export function initAttendance(team) {
  team.attendance = clamp01(computeAttendanceFormula(team, 0.5, marketFloorFor(team)) + (team.fanbaseBaseline || 0));
}

export function applyMilestone(team, amount) {
  team.fanbaseBaseline = (team.fanbaseBaseline || 0) + amount;
}
export function applyPlayoffBerthMilestone(team) { applyMilestone(team, MILESTONE_PLAYOFF_BERTH); }
export function applyHomeCourtMilestone(team) { applyMilestone(team, MILESTONE_HOME_COURT); }
export function applyPlayoffWinMilestone(team) { applyMilestone(team, MILESTONE_PLAYOFF_WIN); }
export function applyChampionshipMilestone(team) { applyMilestone(team, MILESTONE_CHAMPIONSHIP); }

// Fanbase mods are re-rolled every season from the shared pool, restricted by archetype
// where noted (Team Pride). Sixth Man / Mind Games need a 1-10 value rolled at draw time,
// same as a matchup card's value — the copy is cloned so that roll doesn't mutate the shared
// FANBASE_MODS definition.
export function rollFanbaseMod(team) {
  const archetypeName = team.fanbaseArchetype && team.fanbaseArchetype.name;
  const pool = FANBASE_MODS.filter((m) => !m.restrictTo || m.restrictTo.includes(archetypeName));
  const picked = weightedPick(pool);
  team.fanbaseMod = picked.needsValue
    ? { ...picked, value: 1 + Math.floor(Math.random() * picked.valueDie) }
    : { ...picked };
}

// Runs once per team at season end (see season.js's proceedFromResults). Recomputes this
// season's attendance from the formula + baseline, applies the current mod against last
// season's number, then banks the Season-End milestone into the baseline for next season.
export function recomputeSeasonAttendance(state) {
  const teams = state.teams;
  const scores = teams.map((t) => t.lastSeasonAvgScore || 0);
  const sorted = [...scores].sort((a, b) => a - b);
  teams.forEach((team, i) => {
    const percentile = teams.length > 1 ? sorted.indexOf(scores[i]) / (teams.length - 1) : 0.5;
    const raw = computeAttendanceFormula(team, percentile, marketFloorFor(team));
    const target = clamp01(raw + (team.fanbaseBaseline || 0));
    const prev = team.attendance !== undefined ? team.attendance : target;

    let next = target;
    const mod = team.fanbaseMod;
    if (mod && mod.effect === 'nullify-decrease' && next < prev) next = prev;
    else if (mod && mod.effect === 'cap-decrease' && prev - next > FANBASE_ATTENDANCE_MAX_SWING) next = prev - FANBASE_ATTENDANCE_MAX_SWING;
    else if (mod && mod.effect === 'cap-increase' && next - prev > FANBASE_ATTENDANCE_MAX_SWING) next = prev + FANBASE_ATTENDANCE_MAX_SWING;
    team.attendance = clamp01(next);

    // Season End milestone — scales with the seed this team just finished the season on;
    // banked into the baseline now so it benefits next season's number, not this one.
    if (team.seed && team.seed <= 8) {
      const t = (8 - team.seed) / 7; // 1 at seed 1, 0 at seed 8
      applyMilestone(team, MILESTONE_SEASON_END_WORST + t * (MILESTONE_SEASON_END_BEST - MILESTONE_SEASON_END_WORST));
    }
  });
}
