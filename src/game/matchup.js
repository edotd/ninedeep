import { INJURY_CHANCE } from './constants';
import { rollDieWithAdvantage } from './rng';
import { offenseDieSize, defenseDieSize, offenseModifier, defenseModifier } from './roster';
import { cardTotal } from './cards';

// Rolls for a pre-matchup injury, or removes a specifically chosen player when a matchup
// card targets one. On a hit, pulls that player out; if a same-position bench card exists it
// subs in, otherwise the team plays this matchup one player short.
export function forceRemovePlayer(team, ids, preferredId) {
  const activeCards = ids.map((id) => team.hand.find((h) => h.id === id));
  const picked = (preferredId && activeCards.find((c) => c.id === preferredId)) || activeCards[Math.floor(Math.random() * activeCards.length)];
  const benchCards = team.hand.filter((c) => !ids.includes(c.id));
  const sub = benchCards.find((c) => c.position === picked.position) || null;
  let newIds;
  if (sub) { newIds = ids.filter((id) => id !== picked.id).concat([sub.id]); }
  else { newIds = ids.filter((id) => id !== picked.id); }
  return { ids: newIds, out: picked, sub };
}

export function checkInjury(team, chance = INJURY_CHANCE) {
  if (Math.random() > chance) return { ids: team.activeIds.slice(), out: null, sub: null };
  return forceRemovePlayer(team, team.activeIds);
}

export function benchScore(team, idsOverride) {
  const activeIds = idsOverride || team.activeIds;
  const benchCards = team.hand.filter((c) => !activeIds.includes(c.id));
  let sum = benchCards.reduce((s, c) => s + cardTotal(c), 0);
  if ((team.matchupCards || []).some((c) => c.name === 'Team Chemistry')) { sum *= 1.5; }
  return Math.round(sum / 20);
}

// The deterministic (no-dice) portion of a team's matchup score — used for the Standings
// tab and the Lineup screen so players can compare teams without waiting for a roll.
export function teamOutput(team) {
  const off = offenseModifier(team);
  const def = defenseModifier(team);
  const bench = benchScore(team);
  return { off, def, bench, total: off + def + bench };
}

// Resolves a bracket match's teams for display without mutating state — a semifinal/final
// shows its real teams once both feeder matchups are decided, even before it's been opened.
export function matchTeams(matches, m) {
  const a = m.a || (m.from && matches[m.from[0]].result ? matches[m.from[0]].result.winner : null);
  const b = m.b || (m.from && matches[m.from[1]].result ? matches[m.from[1]].result.winner : null);
  return { a, b };
}

// A match is playable once it has no dependency (quarterfinals) or both of its feeder
// matches have results (semifinals/final) — matches within a round can be played in any order.
export function isMatchUnlocked(matches, m) {
  return !m.from || (!!matches[m.from[0]].result && !!matches[m.from[1]].result);
}

// Top-4 seeds get a Home Court Advantage boost in every playoff matchup they play. Shared by
// the instant resolver (engine.js's rollCurrentMatchup, used for simulateAllPlayoffs) and the
// turn-by-turn engine (game/turn.js).
export function hasHomeCourt(team) {
  return !!(team.seed && team.seed <= 4);
}

// Sixth Man / Mind Games are the two fanbase mods that act live, during a matchup, rather
// than reshaping the season's attendance number (see game/fanbase.js for the rest). Both give
// the opponent a chance to beat a roll and avoid the effect entirely — no held card or choice
// involved, this is purely the crowd doing its thing.
export function applyLiveFanbaseMod(team, opponent, extra, opponentIds, cardNotes) {
  const mod = team.fanbaseMod;
  if (!mod || (mod.effect !== 'live-bonus' && mod.effect !== 'live-penalty')) return opponentIds;
  const roll = 1 + Math.floor(Math.random() * mod.valueDie);
  if (roll >= mod.value) return opponentIds; // opponent beat the roll — no effect
  if (mod.effect === 'live-bonus') {
    extra.leagueMod += 1;
    cardNotes.push({ text: `${opponent.name} rolls ${roll} against ${team.name}'s Sixth Man crowd (needed ${mod.value}+) — ${team.name} gets +1.`, cardName: 'Sixth Man' });
    return opponentIds;
  }
  const removal = forceRemovePlayer(opponent, opponentIds);
  cardNotes.push({ text: `${opponent.name} rolls ${roll} against ${team.name}'s Mind Games crowd (needed ${mod.value}+) — ${removal.out.archetype} is rattled, out for this matchup${removal.sub ? ', ' + removal.sub.archetype + ' subs in.' : ', no bench coverage.'}`, cardName: 'Mind Games' });
  return removal.ids;
}

export function playMatchup(a, b, advA, advB, idsA, idsB, extraA, extraB) {
  extraA = extraA || { offDelta: 0, defDelta: 0, leagueMod: 0 };
  extraB = extraB || { offDelta: 0, defDelta: 0, leagueMod: 0 };
  const aOffSides = offenseDieSize(a), aDefSides = defenseDieSize(a);
  const bOffSides = offenseDieSize(b), bDefSides = defenseDieSize(b);
  const aOffDie = rollDieWithAdvantage(aOffSides, advA), aOffMod = offenseModifier(a, idsA) + (extraA.offDelta || 0), aOffTotal = aOffDie + aOffMod;
  const aDefDie = rollDieWithAdvantage(aDefSides, advA), aDefMod = defenseModifier(a, idsA) + (extraA.defDelta || 0), aDefTotal = aDefDie + aDefMod;
  const aBench = benchScore(a, idsA);
  const aLeagueMod = extraA.leagueMod || 0;
  const aSum = aOffTotal + aDefTotal + aBench + aLeagueMod;
  const bOffDie = rollDieWithAdvantage(bOffSides, advB), bOffMod = offenseModifier(b, idsB) + (extraB.offDelta || 0), bOffTotal = bOffDie + bOffMod;
  const bDefDie = rollDieWithAdvantage(bDefSides, advB), bDefMod = defenseModifier(b, idsB) + (extraB.defDelta || 0), bDefTotal = bDefDie + bDefMod;
  const bBench = benchScore(b, idsB);
  const bLeagueMod = extraB.leagueMod || 0;
  const bSum = bOffTotal + bDefTotal + bBench + bLeagueMod;
  const winner = aSum === bSum ? (Math.random() < 0.5 ? a : b) : aSum > bSum ? a : b;
  return {
    a, b, advA: !!advA, advB: !!advB,
    aOffDie, aOffMod, aOffTotal, aOffSides, aDefDie, aDefMod, aDefTotal, aDefSides, aBench, aLeagueMod, aSum,
    bOffDie, bOffMod, bOffTotal, bOffSides, bDefDie, bDefMod, bDefTotal, bDefSides, bBench, bLeagueMod, bSum,
    winner,
  };
}

// A human team's in-matchup choices (Advantage / which matchup card to play / hold Injury
// Prevention ready) are keyed by team id on state.playoff.cardChoices — not a single flat
// flag — since a matchup can have a human on both sides, each making their own independent
// choice. selectedCardId replaces a plain boolean now that a team can hold up to
// MATCHUP_CARD_DRAW_COUNT cards and must pick which (if any) unused playable one to play.
export function cardChoicesFor(playoff, team) {
  return (playoff && playoff.cardChoices && playoff.cardChoices[team.id]) || { useAdvantage: false, selectedCardId: null, selectedTargetId: null, useInjuryPrevention: false };
}

export function wantsAdvantage(team, playoff) {
  if (!team.advantageAvailable) return false;
  if (team.human) return cardChoicesFor(playoff, team).useAdvantage;
  return true; // AI uses its Die Hard advantage the first chance it gets
}

export function playableCards(team) {
  return (team.matchupCards || []).filter((c) => !c.used && c.playable);
}

// The Injury Prevention card a team currently has ready to block with, if any — picks the
// highest value one when a team happens to hold more than one (only the best matters).
export function injuryPreventionCard(team) {
  const cards = (team.matchupCards || []).filter((c) => !c.used && c.name === 'Injury Prevention');
  if (!cards.length) return null;
  return cards.reduce((best, c) => (c.value > best.value ? c : best));
}

// Injury Prevention no longer blocks automatically — its holder must choose to hold it ready
// for the matchup (human: via their own cardChoices.useInjuryPrevention; AI: always ready).
export function wantsInjuryPrevention(team, playoff) {
  if (!injuryPreventionCard(team)) return false;
  if (team.human) return cardChoicesFor(playoff, team).useInjuryPrevention;
  return true;
}

function isInjuryCard(name) {
  return name === 'Injury (Minor)' || name === 'Injury (Major)';
}

// `targetId` is the specific opposing player the attacker chose (for cards with
// targetsPlayer — Injury Minor/Major, Player Suspension); null/omitted falls back to random,
// which is how AI always plays it. `reactsOverride` lets a caller supply the target's
// react-or-not decision directly (the turn engine's live reaction stage) instead of having it
// read from the pre-set cardChoices toggle — omit it to keep the old pre-roll-toggle behavior.
export function playCardEffect(user, target, targetIds, playoff, card, targetId, reactsOverride) {
  card.used = true;
  const result = { targetIds, userOffDelta: 0, userDefDelta: 0, userLeagueMod: 0, targetOffDelta: 0, targetDefDelta: 0, note: null, cardName: card.name };

  if (isInjuryCard(card.name)) {
    // The target may react with their own held Injury Prevention card if they have one —
    // their choice, not automatic. Playing it consumes it, win or lose; it only actually
    // blocks the injury if the reactive roll clears the attacking card's value.
    const ip = injuryPreventionCard(target);
    const reacts = reactsOverride !== undefined ? (reactsOverride && !!ip) : (ip && wantsInjuryPrevention(target, playoff));
    if (reacts) {
      ip.used = true;
      const roll = 1 + Math.floor(Math.random() * ip.valueDie);
      if (roll >= card.value) {
        result.note = target.name + ' played Injury Prevention against ' + user.name + "'s " + card.name + ' — rolled ' + roll + ' (needed ' + card.value + '+) — blocked.';
        return result;
      }
      const removal = forceRemovePlayer(target, targetIds, targetId);
      result.targetIds = removal.ids;
      result.note = target.name + ' played Injury Prevention against ' + user.name + "'s " + card.name + ' — rolled ' + roll + ' (needed ' + card.value + '+) — ' + removal.out.archetype + ' (' + removal.out.position + ') is out' + (removal.sub ? ', ' + removal.sub.archetype + ' subs in.' : ', no bench coverage.');
    } else {
      const removal = forceRemovePlayer(target, targetIds, targetId);
      result.targetIds = removal.ids;
      result.note = user.name + ' played ' + card.name + ' on ' + target.name + ' — ' + removal.out.archetype + ' (' + removal.out.position + ') is out' + (removal.sub ? ', ' + removal.sub.archetype + ' subs in.' : ', no bench coverage.');
    }
  } else if (card.name === 'Distraction (External)' || card.name === 'Distraction (Internal)') {
    const pct = card.value;
    const hitOffense = Math.random() < 0.5;
    if (hitOffense) { result.targetOffDelta = -Math.round((offenseModifier(target, targetIds) * pct) / 100); }
    else { result.targetDefDelta = -Math.round((defenseModifier(target, targetIds) * pct) / 100); }
    result.note = user.name + ' played ' + card.name + ' on ' + target.name + ' — ' + (hitOffense ? 'Offense' : 'Defense') + ' down ' + pct + '%.';
  } else if (card.name === 'Player Suspension') {
    const roll = 1 + Math.floor(Math.random() * 10);
    if (roll < card.value) {
      const removal = forceRemovePlayer(target, targetIds, targetId);
      result.targetIds = removal.ids;
      result.note = user.name + ' played Player Suspension on ' + target.name + ' — roll ' + roll + ' < ' + card.value + ', ' + removal.out.archetype + ' suspended' + (removal.sub ? ', ' + removal.sub.archetype + ' subs in.' : ', no bench coverage.');
    } else {
      result.note = user.name + ' played Player Suspension on ' + target.name + ' — roll ' + roll + ' ≥ ' + card.value + ', suspension avoided.';
    }
  } else if (card.name === 'Biased Officiating') {
    if (Math.random() < 0.5) { result.targetOffDelta = -2; } else { result.targetDefDelta = -2; }
    result.note = user.name + ' played Biased Officiating on ' + target.name + '.';
  } else if (card.name === 'Focused Film Session') {
    result.userDefDelta = 2;
    result.note = user.name + ' played Focused Film Session — Defense up.';
  } else if (card.name === 'Strategic Advantage') {
    result.userOffDelta = 2;
    result.userDefDelta = 2;
    result.note = user.name + ' played Strategic Advantage — Offense and Defense up.';
  } else if (card.name === 'Divine Intervention') {
    result.userLeagueMod = card.value;
    result.note = user.name + ' played Divine Intervention — +' + card.value + ' League Modifier.';
  }
  return result;
}
