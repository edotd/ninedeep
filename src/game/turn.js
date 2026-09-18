import { applySupplementalCard, supplementalRoll } from './supplementalEffects';
// The turn-by-turn playoff match engine (design doc: "Nine Deep Match Flow", screens 2C/2D).
// A game is a coin flip followed by each team's own three-roll cycle — offense, defense,
// bench, in that order — first the coin-flip winner, then the other team. Offense/defense
// rolls open a card-play window for the rolling team and a reaction window for the other team
// (only meaningful when an Injury card was just played against a held Injury Prevention);
// bench never opens either window. This produces exactly the same m.result shape the old
// one-shot playMatchup did, so every downstream reader (MatchupBox, ResultsScreen,
// SeasonRecapScreen, seasonAvgScoreForTeam, lockSeasonAndSeed) keeps working unchanged.
import { HOME_COURT_BONUS } from './constants';
import { rollDie } from './rng';
import { offenseDieSize, defenseDieSize } from './roster';
import {
  checkInjury, playCardEffect, wantsAdvantage, playableCards,
  injuryPreventionCard, benchScore, hasHomeCourt, applyLiveFanbaseMod,
} from './matchup';
import { applyPlayoffWinMilestone } from './fanbase';

export const STEP_PLAN = [
  { who: 'first', kind: 'offense' },
  { who: 'first', kind: 'defense' },
  { who: 'first', kind: 'bench' },
  { who: 'second', kind: 'offense' },
  { who: 'second', kind: 'defense' },
  { who: 'second', kind: 'bench' },
];

function isInjuryCardName(name) {
  return name === 'Injury (Minor)' || name === 'Injury (Major)';
}

// stepIndex tags each entry with the roll it narrates, so the UI can pull "just this step's"
// lines for the resolution report while the full log still shows everything in order.
function pushLog(turn, tag, text) {
  turn.log.unshift({ tag, text, stepIndex: turn.stepIndex });
}

// Sets up everything that used to happen once at the top of rollCurrentMatchup — advantage,
// pre-turn injury checks, home court, live fanbase mods — then starts the coin flip.
export function beginTurn(state) {
  const m = state.playoff.matches[state.playoff.activeMatchIndex];
  if (m.from) {
    m.a = state.playoff.matches[m.from[0]].result.winner;
    m.b = state.playoff.matches[m.from[1]].result.winner;
  }
  const advA = wantsAdvantage(m.a, state.playoff);
  const advB = wantsAdvantage(m.b, state.playoff);
  if (advA) m.a.advantageAvailable = false;
  if (advB) m.b.advantageAvailable = false;
  const injuryChance = state.settings.injuryChance;
  const injA = checkInjury(m.a, injuryChance);
  const injB = checkInjury(m.b, injuryChance);
  let idsA = injA.ids, idsB = injB.ids;
  const extraA = { offDelta: 0, defDelta: 0, leagueMod: 0 };
  const extraB = { offDelta: 0, defDelta: 0, leagueMod: 0 };
  const cardNotes = [];
  const hcaA = hasHomeCourt(m.a, m.b);
  const hcaB = hasHomeCourt(m.b, m.a);
  if (hcaA) { extraA.offPercent = (extraA.offPercent || 0) + HOME_COURT_BONUS; extraA.defPercent = (extraA.defPercent || 0) + HOME_COURT_BONUS; }
  if (hcaB) { extraB.offPercent = (extraB.offPercent || 0) + HOME_COURT_BONUS; extraB.defPercent = (extraB.defPercent || 0) + HOME_COURT_BONUS; }
  idsB = applyLiveFanbaseMod(m.a, m.b, extraA, idsB, cardNotes);
  idsA = applyLiveFanbaseMod(m.b, m.a, extraB, idsA, cardNotes);

  m.turn = {
    stage: 'coinflip',
    stepIndex: 0,
    order: null,
    current: null,
    advA, advB, injA, injB, idsA, idsB, extraA, extraB, cardNotes, hcaA, hcaB,
    log: [],
  };
}

function startStep(m) {
  const turn = m.turn;
  const plan = STEP_PLAN[turn.stepIndex];
  const team = plan.who === 'first' ? turn.order[0] : turn.order[1];
  turn.current = { kind: plan.kind, team: team === m.a ? 'a' : 'b' };
  turn.stage = 'roll';
}

function flipCoin(m) {
  const turn = m.turn;
  const firstIsA = Math.random() < 0.5;
  turn.order = firstIsA ? [m.a, m.b] : [m.b, m.a];
  pushLog(turn, 'pregame', `Coin flip — ${turn.order[0].name} wins possession.`);
  startStep(m);
}

function aiChooseCard(team) {
  const options = playableCards(team);
  return options.length ? options[0] : null;
}

// Whether the reaction window is even worth showing — only an Injury card played against a
// held (unused) Injury Prevention card gives the other team anything to react with.
function needsReaction(cur, otherTeam) {
  return !!(cur.actionCard && isInjuryCardName(cur.actionCard.name) && injuryPreventionCard(otherTeam));
}

function resolveStep(state, m) {
  const turn = m.turn;
  const plan = STEP_PLAN[turn.stepIndex];
  const cur = turn.current;
  const side = cur.team === 'a' ? 'a' : 'b';
  const otherSide = side === 'a' ? 'b' : 'a';
  const actingTeam = cur.team === 'a' ? m.a : m.b;
  const otherTeam = cur.team === 'a' ? m.b : m.a;
  const actingExtra = side === 'a' ? turn.extraA : turn.extraB;
  const otherExtra = otherSide === 'a' ? turn.extraA : turn.extraB;

  if (cur.actionCard?.effectType) {
    const note = applySupplementalCard(state, actingTeam, otherTeam, cur.actionCard,
      actingExtra, otherExtra, side === 'a' ? turn.idsA : turn.idsB,
      otherSide === 'a' ? turn.idsA : turn.idsB, cur.actionTargetId, cur.actionStat || (cur.kind === 'defense' ? 'DEF' : 'SCO'), cur.kind);
    if (note) { turn.cardNotes.push({ text: note, cardName: cur.actionCard.name }); pushLog(turn, 'action', note); }
  } else if (cur.actionCard) {
    let otherIds = otherSide === 'a' ? turn.idsA : turn.idsB;
    const res = playCardEffect(actingTeam, otherTeam, otherIds, state.playoff, cur.actionCard, cur.actionTargetId, cur.reacts);
    if (otherSide === 'a') turn.idsA = res.targetIds; else turn.idsB = res.targetIds;
    actingExtra.offDelta += res.userOffDelta; actingExtra.defDelta += res.userDefDelta; actingExtra.leagueMod += res.userLeagueMod;
    otherExtra.offDelta += res.targetOffDelta; otherExtra.defDelta += res.targetDefDelta;
    if (res.note) turn.cardNotes.push({ text: res.note, cardName: res.cardName });
  }

  const myIds = side === 'a' ? turn.idsA : turn.idsB;
  if (plan.kind === 'bench') {
    const bench = benchScore(actingTeam, myIds);
    turn[`${side}Bench`] = bench;
    pushLog(turn, 'resolution', `${actingTeam.name}'s bench contributes +${bench}.`);
  } else {
    const off = plan.kind === 'offense';
    const sides = off ? offenseDieSize(actingTeam) : defenseDieSize(actingTeam);
    const label = off ? 'Off' : 'Def';
    turn[`${side}${label}First`] = cur.first ?? cur.die;
    turn[`${side}${label}Second`] = cur.second ?? cur.dieOther ?? cur.die;
    turn[`${side}${label}Sides`] = sides;
    refreshRolls(m);
    const mod = turn[`${side}${label}Mod`];
    const total = turn[`${side}${label}Total`];
    cur.die = turn[`${side}${label}Die`];
    pushLog(turn, 'resolution', `${actingTeam.name} rolls ${cur.die} (1d${sides}) on ${off ? 'Offense' : 'Defense'} — +${mod} = ${total}.`);
  }

  refreshRolls(m);
  turn.current = null;
  turn.stepIndex += 1;
  if (turn.stepIndex >= STEP_PLAN.length) {
    finishTurn(state, m);
  } else {
    turn.stage = 'stepdone';
  }
}

// Recompute resolved rolls as well: a second-team penalty still affects this game.
function refreshRolls(m) {
  const turn = m.turn;
  for (const side of ['a', 'b']) {
    for (const kind of ['offense', 'defense']) {
      const label = kind === 'offense' ? 'Off' : 'Def';
      const first = turn[`${side}${label}First`];
      if (first == null) continue;
      const result = supplementalRoll(m[side], side === 'a' ? turn.idsA : turn.idsB,
        side === 'a' ? turn.extraA : turn.extraB, kind, first,
        turn[`${side}${label}Second`], side === 'a' ? turn.advA : turn.advB);
      for (const key of ['die', 'dieOther', 'mod', 'total', 'mode']) {
        turn[`${side}${label}${key[0].toUpperCase() + key.slice(1)}`] = result[key];
      }
    }
  }
}

function finishTurn(state, m) {
  const turn = m.turn;
  const aSum = turn.aOffTotal + turn.aDefTotal + turn.aBench + turn.extraA.leagueMod;
  const bSum = turn.bOffTotal + turn.bDefTotal + turn.bBench + turn.extraB.leagueMod;
  const winner = aSum === bSum ? (Math.random() < 0.5 ? m.a : m.b) : aSum > bSum ? m.a : m.b;
  m.result = {
    a: m.a, b: m.b, advA: !!turn.advA, advB: !!turn.advB,
    aOffDie: turn.aOffDie, aOffMod: turn.aOffMod, aOffTotal: turn.aOffTotal, aOffSides: turn.aOffSides,
    aDefDie: turn.aDefDie, aDefMod: turn.aDefMod, aDefTotal: turn.aDefTotal, aDefSides: turn.aDefSides,
    aBench: turn.aBench, aLeagueMod: turn.extraA.leagueMod, aSum,
    bOffDie: turn.bOffDie, bOffMod: turn.bOffMod, bOffTotal: turn.bOffTotal, bOffSides: turn.bOffSides,
    bDefDie: turn.bDefDie, bDefMod: turn.bDefMod, bDefTotal: turn.bDefTotal, bDefSides: turn.bDefSides,
    bBench: turn.bBench, bLeagueMod: turn.extraB.leagueMod, bSum,
    winner,
    injA: turn.injA, injB: turn.injB, cardNotes: turn.cardNotes,
    aExtra: turn.extraA, bExtra: turn.extraB, hcaA: turn.hcaA, hcaB: turn.hcaB,
    turnLog: turn.log,
  };
  applyPlayoffWinMilestone(winner);
  state.playoff.cardChoices ||= {};
  state.playoff.cardChoices[m.a.id] = { useAdvantage: false, selectedCardId: null, selectedTargetId: null, useInjuryPrevention: false };
  state.playoff.cardChoices[m.b.id] = { useAdvantage: false, selectedCardId: null, selectedTargetId: null, useInjuryPrevention: false };
  turn.stage = 'complete';
}

// Single entry point driving every stage transition. `payload` only matters at the two stages
// that ask a human for a decision:
//  - stage 'action', payload { cardId, targetId? } to play a card, or { pass: true } to pass.
//  - stage 'reaction', payload { reacts: bool } for whether the target plays Injury Prevention.
// Every other stage (coinflip, roll, stepdone) ignores payload — it's a mechanical advance.
// An AI-controlled team's action/reaction is decided automatically the moment its stage is
// reached, so calling this with no payload is enough to carry an AI-vs-AI match to completion.
export function advanceTurn(state, payload) {
  const m = state.playoff.matches[state.playoff.activeMatchIndex];
  const turn = m.turn;
  if (!turn || turn.stage === 'complete') return;

  if (turn.stage === 'coinflip') { flipCoin(m); return; }
  if (turn.stage === 'stepdone') { startStep(m); return; }

  if (turn.stage === 'roll') {
    const plan = STEP_PLAN[turn.stepIndex];
    const cur = turn.current;
    const actingTeam = cur.team === 'a' ? m.a : m.b;
    if (plan.kind === 'bench') {
      pushLog(turn, 'roll', `${actingTeam.name} looks to the bench.`);
      resolveStep(state, m);
      return;
    }
    const off = plan.kind === 'offense';
    const sides = off ? offenseDieSize(actingTeam) : defenseDieSize(actingTeam);
    const adv = cur.team === 'a' ? turn.advA : turn.advB;
    // Store both raw rolls so a later Advantage/Disadvantage card can resolve
    // without rerolling on refresh or after a Firestore round trip.
    const first = rollDie(sides);
    const second = rollDie(sides);
    cur.first = first; cur.second = second;
    const rolled = supplementalRoll(actingTeam, cur.team === 'a' ? turn.idsA : turn.idsB, cur.team === 'a' ? turn.extraA : turn.extraB, plan.kind, first, second, adv);
    cur.die = rolled.die; cur.dieOther = rolled.dieOther; cur.mode = rolled.mode;
    cur.sides = sides;
    pushLog(turn, 'roll', `${actingTeam.name} rolls for ${off ? 'Offense' : 'Defense'}.`);
    turn.stage = 'action';
    return;
  }

  if (turn.stage === 'action') {
    const cur = turn.current;
    const actingTeam = cur.team === 'a' ? m.a : m.b;
    const otherTeam = cur.team === 'a' ? m.b : m.a;
    if (actingTeam.human) {
      const options = playableCards(actingTeam);
      const card = payload && !payload.pass ? options.find((c) => c.id === payload.cardId) || null : null;
      cur.actionCard = card;
      cur.actionTargetId = card ? payload.targetId || null : null;
      cur.actionStat = card ? payload.stat || (cur.kind === 'defense' ? 'DEF' : 'SCO') : null;
    } else {
      cur.actionCard = aiChooseCard(actingTeam);
      cur.actionTargetId = null;
    }
    pushLog(turn, 'action', cur.actionCard ? `${actingTeam.name} plays ${cur.actionCard.name}.` : `${actingTeam.name} passes.`);
    if (needsReaction(cur, otherTeam)) { turn.stage = 'reaction'; }
    else { resolveStep(state, m); }
    return;
  }

  if (turn.stage === 'reaction') {
    const cur = turn.current;
    const otherTeam = cur.team === 'a' ? m.b : m.a;
    cur.reacts = otherTeam.human ? !!(payload && payload.reacts) : true; // AI always reacts if it can
    pushLog(turn, 'reaction', cur.reacts ? `${otherTeam.name} answers with Injury Prevention.` : `${otherTeam.name} has no answer.`);
    resolveStep(state, m);
  }
}
