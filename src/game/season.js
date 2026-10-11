import { addToRoster, creditTeamSeason } from './chemistry';
import { TIERS, LEAGUE_ACCOLADES, REPLACEMENT_TIER, FREE_AGENT_TIER, BARGAIN_FREE_AGENT_TIER, BARGAIN_FREE_AGENT_COUNT, FREE_AGENT_POOL_SIZE, AI_NAMES, AI_TRICODES, POSITIONS, CHAMPIONSHIP_BAR_MULT, INJURY_CHANCE, FANBASE_ARCHETYPES, LEAGUE_TEAM_COUNT, ROSTER_SIZE, SEASON_ROLL_SPREAD, HIGH_CEILING_BONUS } from './constants';
import { drawGM, acquireOffseasonPlayer } from './gm';
import { advanceCareer } from './aging';
import { shuffle, weightedPick } from './rng';
import { makeCard, randomArch, randomArchForTier, neededPosition, drawCoachCard, applyCoachRetention, cardTotal } from './cards';
import { finalizeCap, isOverLimit, rosterSalary } from './economy';
import { autoSelectFive, effectiveRating, activeStatSum, benchRatingContribution, validateLineup, assignSixthMan } from './roster';
import { retentionBonus, relationshipBonus } from './cards';
import { handsOffBonus } from './gm';
import { startDraft, prepareDraftClass } from './draft';
import { initAttendance, rollFanbaseMod, recomputeSeasonAttendance, applyPlayoffBerthMilestone, applyHomeCourtMilestone, applyChampionshipMilestone, fanbaseEnabled } from './fanbase';
import { tricodeFor } from './names';
import { simulateSeasonOutput, teamOutput } from './matchup';
import { teamSynergy } from './skillsets';
import { recordFreeAgencyActivity } from './freeAgencyActivity';
import { autoPlaySeasonGameplans, dealStrategyCards } from './strategyCards';
import { forceFinalizeTeamBids, resolveAllFreeAgentBidding } from './bidding';

export function newEraState() {
  return {
    season: 1,
    freeAgents: [],
    freeAgentCoaches: [],
    upcomingDraftPool: [],
    teams: [],
    phase: 'setup',
    starPool: [],
    lastExpiredPlayers: [],
    log: [],
    freeAgencyActivity: [],
    cardCounter: 0,
    strategyCardCounter: 0,
    freeAgentCoachCounter: 0,
    eraId: null,
    // Present from era start (not just once proceedFromResults first resets it) since Free
    // Agency itself is reachable at any time, including before the first season's playoffs —
    // openFreeAgentBid/closeFreeAgency write into this the moment anyone bids.
    offseason: { contractsFiled: {}, freeAgencyClosed: {}, negotiations: {}, bidding: {} },
    settings: {
      injuryChance: INJURY_CHANCE,
      championshipBarMult: CHAMPIONSHIP_BAR_MULT,
      actionLogSpeed: 'normal',
      winCondition: 'outright', // 'bar' = must clear the championship bar; 'outright' = winning the Finals is enough
      matchupCardsEnabled: true,
      fanbaseCardsEnabled: false,
      coachChangesEnabled: false,
    },
  };
}

// Weighted by count, same shape as draft.js's pickWeightedTier — used below to give every
// League Accolade card a genuine, independent tier label alongside its accolade (see
// game/cards.js's makeCard) rather than reusing that helper across a circular import for six
// lines of logic.
function pickWeightedTier(pool) {
  const total = pool.reduce((s, t) => s + t.count, 0);
  let r = Math.random() * total;
  for (const t of pool) {
    if (r < t.count) return t;
    r -= t.count;
  }
  return pool[pool.length - 1];
}

export function buildStarPool(state) {
  state.starPool = [];
  state.freeAgentCoaches = [];
  TIERS.forEach((tier) => {
    for (let i = 0; i < tier.count; i++) {
      const posPool = tier.allowedPositions || POSITIONS;
      const pos = posPool[Math.floor(Math.random() * posPool.length)];
      state.starPool.push(makeCard(state, randomArchForTier(tier), pos, tier));
    }
  });
  // Accolade cards still fill exactly LEAGUE_ACCOLADES' own counts, same total headcount of
  // "special" players the pool has always had — the difference is each one now also gets a
  // real tier of its own (Role Player, High IQ, ...) as an independent label, instead of the
  // accolade name standing in for tierName outright.
  LEAGUE_ACCOLADES.forEach((accolade) => {
    for (let i = 0; i < accolade.count; i++) {
      const posPool = accolade.allowedPositions || POSITIONS;
      const pos = posPool[Math.floor(Math.random() * posPool.length)];
      state.starPool.push(makeCard(state, randomArchForTier(accolade), pos, pickWeightedTier(TIERS), null, accolade));
    }
  });
  shuffle(state.starPool);
  seedFreeAgentPool(state);
  if (state.settings?.coachChangesEnabled) seedFreeAgentCoachPool(state);
}

export function seedFreeAgentCoachPool(state) {
  const count = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const coach = drawCoachCard({ excludeHallOfFame: true });
    state.freeAgentCoachCounter = (state.freeAgentCoachCounter || 0) + 1;
    state.freeAgentCoaches.push({ ...coach, id: `free-agent-coach-${state.freeAgentCoachCounter}` });
  }
}

// dealHands doesn't check budget, so some teams start over cap with no way to fix it until
// the first round of releases/expirations stocks free agency — these cheap, low-output
// fillers (see FREE_AGENT_TIER) give every team an immediate option to shed salary instead.
// A handful roll the even-cheaper BARGAIN_FREE_AGENT_TIER instead, landing at
// MIN_PLAYER_SALARY — a true minimum-contract option alongside the regular fillers.
export function seedFreeAgentPool(state) {
  for (let i = 0; i < FREE_AGENT_POOL_SIZE; i++) {
    const position = POSITIONS[i % POSITIONS.length];
    const tier = i < BARGAIN_FREE_AGENT_COUNT ? BARGAIN_FREE_AGENT_TIER : FREE_AGENT_TIER;
    state.freeAgents.push(makeCard(state, randomArch(), position, tier));
  }
}

// teamSeats: array of { name, human, ownerUid } — seat 0 is always the primary/local seat in solo mode.
// Every team gets a stable `id` (its seat index) — once state round-trips through Firestore
// as JSON, object identity (team === otherTeam) no longer holds, so anything that needs to
// reference "this team" elsewhere in state (playoff matches, draft queue, seeds) must use
// this id instead. See game/rehydrate.js, which relinks object references by id after sync.
export function buildTeams(state, teamSeats) {
  state.teams = teamSeats.map((seat, id) => ({
    id,
    name: seat.name,
    tricode: tricodeFor(seat.name, AI_TRICODES),
    human: seat.human,
    ownerUid: seat.ownerUid ?? null,
    hand: [],
    titles: 0,
    playoffAppearances: 0,
    lastOverage: 0,
    retainedStreak: 0,
    lastCoachName: null,
    matchupCards: [],
    developmentCards: [],
    gameplanCards: [],
    seasonGameplanEffects: { offPercent: 0, defPercent: 0, benchBonus: 0, seedingPercent: 0 },
    fanbaseBaseline: 0,
    financeBoostUsedThisSeason: false,
    // Distinct from lineupConfirmed: this tracks whether the user has been through the Set
    // Lineup screen this season at all (a human must; an AI team never needs to, since its
    // auto-selected five is never reviewed by anyone — see every autoSelectFive call site).
    lineupSet: false,
    // One entry pushed per season in proceedFromResults, feeding the Season Recap screen's
    // era ledger (result reached, cap used, players under contract) — see seasonResultForTeam.
    seasonHistory: [],
    scoutingReport: [],
    scoutingHistory: [],
  }));
}

export function defaultSoloSeats(teamName) {
  return [{ name: teamName, human: true }, ...AI_NAMES.slice(0, LEAGUE_TEAM_COUNT - 1).map((n) => ({ name: n, human: false }))];
}

// Shuffles the star pool and deals up to the roster limit, then tops short hands up with
// generic Undrafted fillers. Any surplus star cards remain outside the opening hands.
export function dealHands(state) {
  const teamCount = state.teams.length;
  const order = [...Array(teamCount).keys()];
  shuffle(order);
  const base = Math.floor(state.starPool.length / teamCount);
  const extraCount = state.starPool.length % teamCount;
  const extraSet = new Set(order.slice(0, extraCount));
  state.teams.forEach((team, idx) => {
    const count = Math.min(ROSTER_SIZE, base + (extraSet.has(idx) ? 1 : 0));
    for (let i = 0; i < count; i++) { addToRoster(team, state.starPool.pop()); }
  });
  state.teams.forEach((team) => {
    while (team.hand.length < ROSTER_SIZE) {
      addToRoster(team, makeCard(state, randomArch(), neededPosition(team) || POSITIONS[Math.floor(Math.random() * 3)], REPLACEMENT_TIER));
    }
    // A seven-card hand is small enough that an even star-pool deal can omit a position.
    // Replace one surplus-position card for each gap so every opening roster can form a
    // legal starting five without immediately entering free agency.
    for (const position of POSITIONS) {
      if (team.hand.some((card) => card.position === position)) continue;
      const counts = Object.fromEntries(POSITIONS.map((pos) => [pos, team.hand.filter((card) => card.position === pos).length]));
      const replaceIndex = team.hand.findIndex((card) => counts[card.position] > 1 && !(team.activeIds || []).includes(card.id));
      const fallbackIndex = team.hand.findIndex((card) => counts[card.position] > 1);
      const index = replaceIndex >= 0 ? replaceIndex : fallbackIndex;
      if (index >= 0) team.hand.splice(index, 1, makeCard(state, randomArch(), position, REPLACEMENT_TIER));
    }
  });
}

export function refreshAdvantage(team) {
  team.advantageAvailable = !!(team.fanbaseArchetype && team.fanbaseArchetype.name === 'Die Hard');
}

// Runs once, right after team setup and before hands are dealt. Coach, Fanbase, and GM are
// pulled here for AI teams and kept for the whole era. Human teams pull their own via pullCoach etc.
// dealHands can't check budget itself — it runs before any team has a coach or GM, so
// team.seasonCap doesn't exist yet. Once the real cap is known, swap
// out the team's priciest hand card(s) for a cheap Undrafted filler until the roster fits — no
// dead cap, since the outgoing player never actually held the roster spot for a season. Every
// team starts at or under budget instead of relying on the cheap-filler free agents already
// seeded into the pool as a fix a human has to notice and act on themselves.
function enforceStartingBudget(state, team) {
  let guard = 0;
  while (rosterSalary(team) > team.seasonCap && team.hand.length && guard < 20) {
    guard++;
    const priciest = team.hand.reduce((worst, c) => (c.salary > worst.salary ? c : worst), team.hand[0]);
    team.hand.splice(team.hand.indexOf(priciest), 1);
    if (team.activeIds) team.activeIds = team.activeIds.filter((id) => id !== priciest.id);
    state.freeAgents.push({ ...priciest, contract: priciest.maxContract, lastTeamId: team.id });
    const need = neededPosition(team);
    addToRoster(team, makeCard(state, randomArch(), need || POSITIONS[Math.floor(Math.random() * 3)], REPLACEMENT_TIER));
  }
  if (guard > 0) { team.activeIds = autoSelectFive(team.hand); assignSixthMan(team); }
}

export function initFrontOffice(state) {
  state.phase = 'pullcards';
  state.bar = undefined;
  state.leagueAvg = undefined;
  // Auto-dealt for every team, human or AI — same "no manual pull button" treatment as the
  // hand and matchup cards. PullCardsScreen just reveals what's already in state.
  const fbEnabled = fanbaseEnabled(state);
  state.teams.forEach((team) => {
    team.coach = drawCoachCard();
    applyCoachRetention(team, team.coach);
    if (fbEnabled) {
      team.fanbaseArchetype = weightedPick(FANBASE_ARCHETYPES);
      rollFanbaseMod(team);
    }
    const gm = drawGM();
    team.gmType = gm.type;
    team.gmRarity = gm.rarity;
    team.gmTrait = gm.trait;
    if (fbEnabled) initAttendance(team);
    refreshAdvantage(team);
    finalizeCap(team);
    enforceStartingBudget(state, team);
  });
  prepareDraftClass(state);
}

export function initSeasonModifierCards(state) {
  state.bar = undefined;
  state.leagueAvg = undefined;
  // Fanbase mods are re-rolled every season for every team, independent of the In-Game
  // Adjustments setting — they're a fanbase mechanic, not a matchup one. Skipped entirely when
  // the Fanbase system itself is off for this era.
  const fbEnabled = fanbaseEnabled(state);
  state.teams.forEach((team) => {
    if (fbEnabled && (state.season > 1 || !team.fanbaseMod)) rollFanbaseMod(team);
    dealStrategyCards(state, team);
    // In-Game Adjustments are rolled fresh at the start of each match now (see roster.js's
    // rollAdjustmentCards), not dealt for the whole season — clear out whatever's left from last
    // season's final match so the new season's first match actually rolls a fresh hand instead
    // of finding a non-empty one and skipping the roll.
    team.matchupCards = [];
  });
  state.phase = 'constructing';
}

// Runs at the start of every season after the first. Cards are already kept — this just refreshes
// season-scoped state (cap recompute, coach retention streak, Die Hard's once-per-season ability).
export function startNewSeasonRoster(state) {
  state.teams.forEach((team) => {
    applyCoachRetention(team, team.coach);
    refreshAdvantage(team);
    finalizeCap(team);
    if (!team.activeIds || !validateLineup(team).valid) team.activeIds = autoSelectFive(team.hand);
    assignSixthMan(team);
    team.lineupConfirmed = false;
    // Human teams must revisit Set Lineup each season; AI teams' auto-selected five never
    // gets (or needs) manual review, so treat it as already set.
    team.lineupSet = !team.human || Boolean(team.lineupPreserved);
    team.financeBoostUsedThisSeason = false;
  });
  prepareDraftClass(state);
  initSeasonModifierCards(state);
}

export function seedTeam(state, n) {
  return state.seeds[n - 1].t;
}

// The seeding/cap-lock portion of the original confirmLineup(), run after every team's
// active five is finalized for the season.
export function lockSeasonAndSeed(state) {
  state.teams.filter((team) => !team.human).forEach((team) => autoPlaySeasonGameplans(state, team));
  state.teams.forEach((team) => {
    const total9 = rosterSalary(team);
    let overage = Math.max(0, total9 - team.seasonCap);
    team.lastOverage = overage;
    team.overBudgetLastSeason = overage > 0;
    team.total9Salary = total9;
    // Purely informational — see simulateSeasonOutput. Runs here (under the Simulating
    // Season loading beat, before Standings shows) rather than at matchup time; the player
    // never sees or plays these games, just the two averaged figures.
    const sim = simulateSeasonOutput(team);
    team.simOffenseAvg = sim.off;
    team.simDefenseAvg = sim.def;
  });
  state.teams.forEach((viewer) => {
    viewer.scoutingHistory ||= [];
    for (const cardId of viewer.scoutingReport || []) {
      const card = state.teams.flatMap((candidate) => candidate.hand || []).concat(state.freeAgents || [], state.upcomingDraftPool || []).find((candidate) => candidate.id === cardId);
      if (!card) continue;
      const value = cardTotal(card);
      viewer.scoutingHistory.push({ cardId, season: state.season, game: 'Regular Season', starterOutput: Math.round((value / 20) * 100) / 100, sixthManOutput: Math.round((value * 0.75 / 20) * 100) / 100, depthOutput: Math.round((value * 0.25 / 20) * 100) / 100, card: { ...card } });
    }
  });

  // Seeding logging — effectiveRating (below) now folds in the same Team Chemistry/Skillset
  // synergy that teamOutput's Proj Offense/Defense/Bench already apply (averaged across both
  // sides into one blended multiplier, since this is one undifferentiated stat total rather
  // than separate offense/defense sums — see roster.js's effectiveRating for the exact math).
  const seedLog = [];
  const seeds = state.teams
    .map((t) => {
      const raw = activeStatSum(t);
      const bonus = t.coach ? retentionBonus(t) + relationshipBonus(t) + handsOffBonus(t) : 0;
      const synergy = t.coach ? teamSynergy(t) : null;
      const base = effectiveRating(t);
      // Keep season outcomes close to the roster users built. The roll provides enough
      // movement for neighboring teams to trade places without overwhelming a clear output
      // advantage: uniformly distributed from -3.0% through +3.0% (a High Ceiling coach raises
      // only the top of that range).
      const rollTop = SEASON_ROLL_SPREAD + (t.coach?.modifier === 'High Ceiling' ? HIGH_CEILING_BONUS : 0);
      const randomMult = 1 - SEASON_ROLL_SPREAD + Math.random() * (SEASON_ROLL_SPREAD + rollTop);
      let val = base * randomMult;
      val *= 1 + ((t.seasonGameplanEffects?.seedingPercent || 0) / 100);
      const seedingCards = (t.matchupCards || []).filter((c) => c.effectType === 'SEEDING_PERCENT' && !c.used);
      const seedingCardPct = seedingCards.reduce((sum, c) => sum + c.value, 0);
      val *= 1 + seedingCardPct / 100;
      seedingCards.forEach((c) => { c.used = true; });
      const favorableSchedule = (t.matchupCards || []).some((c) => !c.effectType && c.name === 'Favorable Schedule' && !c.used);
      if (favorableSchedule) val *= 1.10;
      const output = t.coach && t.activeIds && t.activeIds.length > 0 ? teamOutput(t) : null;
      const breakdown = {
        teamId: t.id,
        teamName: t.name,
        rawStatSum: raw,
        staffPct: t.coach ? Math.round(bonus * 1000) / 10 : null,
        synergyOffensePct: synergy?.offense ?? null,
        synergyDefensePct: synergy?.defense ?? null,
        benchRating: benchRatingContribution(t),
        incompleteRosterPenalty: t.coach?.modifier === 'More with Less' ? 0 : Math.max(0, ROSTER_SIZE - t.hand.length) * 40,
        baseRating: Math.round(base * 10) / 10,
        seasonRollPct: Math.round((randomMult - 1) * 1000) / 10,
        gameplanSeedingPct: t.seasonGameplanEffects?.seedingPercent || 0,
        seedingCardPct,
        favorableSchedulePct: favorableSchedule ? 10 : 0,
        finalRating: Math.round(val),
        projectedOutput: output?.total ?? null,
      };
      seedLog.push({
        Team: t.name,
        'Raw 4-Stat Sum': raw,
        'Coach+Rel Bonus %': t.coach ? Math.round(bonus * 1000) / 10 : '—',
        'Synergy Off/Def %': synergy ? `${synergy.offense > 0 ? `+${synergy.offense}%` : 'N/A'} / ${synergy.defense > 0 ? `+${synergy.defense}%` : 'N/A'}` : '—',
        'Bench Rating': benchRatingContribution(t),
        'Effective Rating (incl. synergy)': Math.round(base * 10) / 10,
        'Random Roll': `${Math.round((randomMult - 1) * 1000) / 10}%`,
        'Seeding Card Bonus %': seedingCardPct + (favorableSchedule ? ' +10 (Favorable Schedule)' : ''),
        'Final Seeding Rating': Math.round(val),
        'Proj Offense': output ? output.off : '—',
        'Proj Defense': output ? output.def : '—',
        'Bench Output': output ? output.bench : '—',
      });
      return { t, val, breakdown };
    })
    .sort((a, b) => b.val - a.val);
  seeds.forEach((s, rank) => { s.t.seed = rank + 1; });
  seedLog.sort((a, b) => b['Final Seeding Rating'] - a['Final Seeding Rating']);
  console.log(`%c🏀 Season ${state.season} — Seeding Breakdown`, 'font-weight:bold;font-size:13px;');
  console.table(seedLog);
  state.seasonBreakdown = seeds.map(({ breakdown }, rank) => ({ ...breakdown, seed: rank + 1 }));
  state.seeds = seeds;
  state.playoffTeams = seeds.slice(0, 8).map((s) => s.t);
  state.playoffTeams.forEach((t) => {
    t.playoffAppearances = (t.playoffAppearances || 0) + 1;
    applyPlayoffBerthMilestone(t);
    if (t.seed <= 4) applyHomeCourtMilestone(t);
  });
  // Championship bar is set from the playoff field only — teams that missed the cut don't
  // drag the bar down (or up) for the teams that actually have a shot at the title.
  state.leagueAvg = state.playoffTeams.reduce((s, t) => s + effectiveRating(t), 0) / state.playoffTeams.length;
  state.barMult = (state.settings && state.settings.championshipBarMult) || CHAMPIONSHIP_BAR_MULT;
  state.bar = state.leagueAvg * state.barMult;
  // Standings appear after a themed "Simulating Season" loading beat, not instantly — see
  // SimulatingSeasonScreen / finishSeasonSimulation in engine.js.
  state.phase = 'simulating';
}

export function startPlayoffs(state) {
  state.phase = 'playoffs';
  state.playoff = {
    activeMatchIndex: null,
    cardChoices: {},
    matches: [
      { label: 'Quarterfinal 1', a: seedTeam(state, 1), b: seedTeam(state, 8), result: null },
      { label: 'Quarterfinal 2', a: seedTeam(state, 4), b: seedTeam(state, 5), result: null },
      { label: 'Quarterfinal 3', a: seedTeam(state, 2), b: seedTeam(state, 7), result: null },
      { label: 'Quarterfinal 4', a: seedTeam(state, 3), b: seedTeam(state, 6), result: null },
      { label: 'Semifinal 1', a: null, b: null, from: [0, 1], result: null },
      { label: 'Semifinal 2', a: null, b: null, from: [2, 3], result: null },
      { label: 'Final', a: null, b: null, from: [4, 5], result: null },
    ],
  };
}

export function seasonAvgScoreForTeam(state, team) {
  let total = 0, games = 0;
  state.playoff.matches.forEach((m) => {
    if (!m.result) return;
    if (m.result.a === team) { total += m.result.aSum; games++; }
    else if (m.result.b === team) { total += m.result.bSum; games++; }
  });
  return games ? total / games : 0;
}

export function finishPlayoffs(state) {
  const winner = state.playoff.matches[state.playoff.matches.length - 1].result.winner;
  const outright = state.settings && state.settings.winCondition === 'outright';
  const champion = outright ? winner : (effectiveRating(winner) >= state.bar ? winner : null);
  if (champion) { champion.titles++; applyChampionshipMilestone(champion); }

  state.lastResult = { seeds: state.seeds, matches: state.playoff.matches, winner, leagueAvg: state.leagueAvg, bar: state.bar, barMult: state.barMult, champion, outright };
  state.log.push({ season: state.season, champion: champion ? champion.name : null, bar: Math.round(state.bar), winner: winner.name });
  state.phase = 'results';
}

// How far a team got this postseason, for the Season Recap era ledger — 'MISSED' the
// playoffs entirely, 'R1'/'R2' lost in that round, 'FINALS' lost the Final, 'TITLE' won it
// and cleared the championship bar. Read from state.playoff/state.lastResult before
// startPlayoffs re-initializes them for the next season.
export function seasonResultForTeam(state, team) {
  if (!state.playoffTeams || !state.playoffTeams.includes(team)) return 'MISSED';
  const matches = state.playoff.matches;
  const final = matches[matches.length - 1];
  if (final.result && final.result.winner === team) {
    return state.lastResult && state.lastResult.champion === team ? 'TITLE' : 'FINALS';
  }
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (m.result && (m.result.a === team || m.result.b === team) && m.result.winner !== team) {
      if (i <= 3) return 'R1';
      if (i <= 5) return 'R2';
      return 'FINALS';
    }
  }
  return 'MISSED';
}

export function proceedFromResults(state) {
  if (state.phase !== 'results') return;
  state.teams.forEach((team) => { team.lastSeasonAvgScore = seasonAvgScoreForTeam(state, team); });
  if (fanbaseEnabled(state)) recomputeSeasonAttendance(state);
  // Filed once, before contracts move — captures the season exactly as it was played
  // (result reached, full committed cap, all nine still on the roster). `output` is this same
  // freeze-frame for the roster's projected rating — Season Recap reads it back instead of
  // recomputing teamOutput live, which by the time that screen renders reflects contracts
  // already decremented/players already expired for the NEW season, not the one just finished.
  state.teams.forEach((team) => {
    team.seasonHistory ||= [];
    team.seasonHistory.push({
      season: state.season,
      result: seasonResultForTeam(state, team),
      capUsed: team.total9Salary !== undefined ? team.total9Salary : rosterSalary(team),
      underContract: team.hand.length,
      output: team.coach && team.activeIds?.length ? teamOutput(team) : null,
    });
  });
  state.lastExpiredPlayers = [];
  state.offseason = { contractsFiled: {}, freeAgencyClosed: {}, negotiations: {}, bidding: {} };
  state.teams.forEach((team) => {
    creditTeamSeason(team, state.season);
    const kept = [];
    team.hand.forEach((c) => {
      c.contract--;
      advanceCareer(c);
      if (c.contract <= 0) {
        // Contracts/FreeAgencyScreen both filter lastExpiredPlayers by lastTeamId — push the
        // same tagged copy that goes to free agency (not the bare original `c`, which never
        // carries lastTeamId) so that filter can actually match. expiredSeason marks exactly
        // this season's crop, league-wide (every team, not just human ones, unlike
        // lastExpiredPlayers) — ContractsScreen filters state.freeAgents by it directly, since
        // freeAgents itself is a single era-long pool with no other way to isolate "just
        // expired this season" from years of accumulated unsigned free agents.
        const expiredCard = Object.assign({}, c, { contract: c.maxContract, lastTeamId: team.id, expiredSeason: state.season });
        state.freeAgents.push(expiredCard);
        recordFreeAgencyActivity(state, 'released', expiredCard, team);
        if (team.human) state.lastExpiredPlayers.push(expiredCard);
      } else kept.push(c);
    });
    team.hand = kept;
  });
  // Season Recap (the era ledger) is filed here, between Results and the Draft — see
  // proceedFromSeasonRecap below, which is what actually calls startDraft.
  state.phase = 'seasonrecap';
}

export function proceedFromSeasonRecap(state) {
  if (state.phase !== 'seasonrecap') return;
  state.phase = 'contracts';
}

const allHumanFiled = (state, key) => state.teams.filter((t) => t.human).every((t) => state.offseason[key][t.id]);

export function fileContracts(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (state.phase !== 'contracts' || !team?.human) return { ok: false, msg: 'Contracts are not open.' };
  state.offseason.contractsFiled[team.id] = true;
  if (allHumanFiled(state, 'contractsFiled')) {
    // The draft starting is what actually ends the open-market bidding on this season's
    // expiring contracts (see ContractsScreen's own confirmation copy) — finalize every human's
    // still-"opening" bid first (mirrors closeFreeAgency's own forceFinalizeTeamBids step) so a
    // bid nobody got to raise doesn't lose to a tie-break roll it never had a real shot at.
    state.teams.forEach((t) => forceFinalizeTeamBids(state, t));
    resolveAllFreeAgentBidding(state, 'contracts');
    startDraft(state);
  }
  return { ok: true };
}

// Optional early Free Agency closeout. Once closed, this team can no longer sign, bid on, or
// release players until next turn. Begin Season can be used without this step and processes
// the shared bid board once every human is ready (see engine.js).
export function closeFreeAgency(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (!team?.human) return { ok: false, msg: 'Only a human GM closes out free agency.' };
  if (isOverLimit(team)) return { ok: false, msg: 'You are over the allowed budget — fix your roster before closing out free agency.' };
  forceFinalizeTeamBids(state, team);
  state.offseason.freeAgencyClosed ||= {};
  state.offseason.freeAgencyClosed[team.id] = true;
  // Offers stay live for the whole market. The final close is the single server-side
  // resolution point, so every client receives the same winners and tie rolls.
  if (allHumanFiled(state, 'freeAgencyClosed')) resolveAllFreeAgentBidding(state);
  return { ok: true };
}

export function renewExpiredContract(state, teamIdx, cardId) {
  const team = state.teams[teamIdx];
  if (state.phase !== 'contracts' || !team?.human || state.offseason?.contractsFiled?.[team.id]) return { ok: false, msg: 'Contract decisions are closed.' };
  if (team.hand.length >= ROSTER_SIZE) return { ok: false, msg: 'Your roster is full.' };
  const index = state.freeAgents.findIndex((c) => c.id === cardId && c.lastTeamId === team.id);
  if (index < 0) return { ok: false, msg: 'Player is not available for renewal.' };
  const [card] = state.freeAgents.splice(index, 1);
  const signed = acquireOffseasonPlayer(team, { ...card, freeAgentSignedSeason: state.season });
  recordFreeAgencyActivity(state, 'signed', signed, team);
  return { ok: true };
}

export function wasReleasedByTeamThisSeason(card, team, season) {
  return card?.releasedByTeamId === team?.id && card?.releasedSeason === season;
}

export function signFreeAgent(state, cardId, teamIdx) {
  const idx = state.freeAgents.findIndex((c) => c.id === cardId);
  if (idx < 0) return { ok: false, msg: 'Card not available.' };
  const team = state.teams[teamIdx];
  if (state.offseason?.freeAgencyClosed?.[team.id]) return { ok: false, msg: 'You have closed out free agency this turn.' };
  const card = state.freeAgents[idx];
  if (wasReleasedByTeamThisSeason(card, team, state.season)) {
    return { ok: false, msg: 'You cannot re-sign a player you released this season.' };
  }
  state.freeAgents.splice(idx, 1);
  const signed = acquireOffseasonPlayer(team, { ...card, freeAgentSignedSeason: state.season });
  recordFreeAgencyActivity(state, 'signed', signed, team);
  return { ok: true };
}

// The Odometer (design brand handoff, "Nine Deep Transitions" 2A) — a one-time beat between
// seasons, shown for every season after the first (the first has no "last season" to show).
// Not a loading state: it's the beat that says a new season has started and what it will be
// judged on.
export function proceedFromSeasonTransition(state) {
  if (state.phase !== 'seasontransition') return;
  state.phase = 'constructing';
}
