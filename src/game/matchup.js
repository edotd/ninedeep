import { INJURY_CHANCE } from './constants';
import { rollDieWithAdvantage } from './rng';
import { offenseDieSize, defenseDieSize, offenseModifier, defenseModifier } from './roster';
import { cardTotal } from './cards';

// Rolls for a pre-matchup injury. On a hit, pulls a random active player out; if a same-position
// bench card exists it subs in, otherwise the team plays this matchup one player short.
export function forceRemovePlayer(team, ids) {
  const activeCards = ids.map((id) => team.hand.find((h) => h.id === id));
  const picked = activeCards[Math.floor(Math.random() * activeCards.length)];
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
  if (team.matchupCard && team.matchupCard.name === 'Team Chemistry') { sum *= 1.5; }
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

export function wantsAdvantage(team, playoff) {
  if (!team.advantageAvailable) return false;
  if (team.human) return playoff.useAdvantage;
  return true; // AI uses its Die Hard advantage the first chance it gets
}

// Injury Prevention no longer blocks automatically — its holder must choose to hold it ready
// for the matchup (human: via the playoff.useInjuryPrevention toggle; AI: always holds it ready).
export function wantsInjuryPrevention(team, playoff) {
  const card = team.matchupCard;
  if (!card || card.used || card.name !== 'Injury Prevention') return false;
  if (team.human) return !!(playoff && playoff.useInjuryPrevention);
  return true;
}

function isInjuryCard(name) {
  return name === 'Injury (Minor)' || name === 'Injury (Major)';
}

export function playCardEffect(user, target, targetIds, playoff) {
  const card = user.matchupCard;
  card.used = true;
  const result = { targetIds, userOffDelta: 0, userDefDelta: 0, userLeagueMod: 0, targetOffDelta: 0, targetDefDelta: 0, note: null, cardName: card.name };

  if (isInjuryCard(card.name)) {
    const ip = target.matchupCard;
    const ipReady = ip && ip.name === 'Injury Prevention' && wantsInjuryPrevention(target, playoff);
    if (ipReady && ip.value >= card.value) {
      ip.used = true;
      result.note = user.name + ' played ' + card.name + ' on ' + target.name + ' — blocked by Injury Prevention (' + ip.value + ' ≥ ' + card.value + ').';
    } else {
      const removal = forceRemovePlayer(target, targetIds);
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
      const removal = forceRemovePlayer(target, targetIds);
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
  } else if (card.name === 'Strategy Advantage') {
    result.userOffDelta = 2;
    result.userDefDelta = 2;
    result.note = user.name + ' played Strategy Advantage — Offense and Defense up.';
  } else if (card.name === 'Divine Intervention') {
    result.userLeagueMod = card.value;
    result.note = user.name + ' played Divine Intervention — +' + card.value + ' League Modifier.';
  }
  return result;
}
