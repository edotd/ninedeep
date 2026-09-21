import { POSITIONS } from './constants';
import { drawMatchupModifierCard } from './cards';
import { modifierBreakdown } from './roster';

export const PLAYER_STATS = ['SCO', 'PLM', 'REB', 'DEF'];

export function eligibleStatTargets(team, ids, card) {
  return ids.map((id) => team.hand.find((player) => player.id === id))
    .filter((player) => player && (card.maxSalary == null || player.salary <= card.maxSalary));
}

// All numerical changes live on match extras, never on the persistent roster.
export function applySupplementalCard(state, user, opponent, card, ownExtra, opposingExtra, ownIds, opposingIds, targetId, stat = 'SCO', kind = 'offense') {
  if (card.used || !card.playable) return null;
  const self = card.target === 'self';
  const team = self ? user : opponent;
  const extra = self ? ownExtra : opposingExtra;
  const ids = self ? ownIds : opposingIds;
  let detail = card.description;
  if (card.effectType === 'PLAYER_STAT_MOD' || card.effectType === 'CAP_HIT_STAT') {
    if (!PLAYER_STATS.includes(stat)) return null;
    const candidates = eligibleStatTargets(team, ids, card);
    const player = targetId ? candidates.find((p) => p.id === targetId) : candidates[0];
    if (!player) return null;
    const playerId = player.id;
    const value = card.effectType === 'CAP_HIT_STAT' ? player.salary : card.value;
    if (!Number.isFinite(value)) return null;
    extra.statChanges ||= [];
    extra.statChanges.push({ playerId, stat, value });
    detail = `${value >= 0 ? '+' : ''}${value} ${stat} for ${player.archetype}`;
  } else if (card.effectType === 'POSITION_PERCENT' || card.effectType === 'POSITION_COVERAGE_PERCENT') {
    const starters = ids.map((id) => team.hand.find((p) => p.id === id)).filter(Boolean);
    const count = card.effectType === 'POSITION_PERCENT'
      ? starters.filter((p) => p.position === card.position).length
      : Number(POSITIONS.every((position) => starters.some((p) => p.position === position)));
    const value = card.value * count;
    const key = card.ability === 'offense' ? 'offPercent' : 'defPercent';
    extra[key] = (extra[key] || 0) + value;
    detail = `+${value}% ${card.ability}` + (card.position ? ` from ${count} starting ${card.position}${count === 1 ? '' : 's'}` : ' from starting position coverage');
  } else if (card.effectType === 'OFFENSE_PERCENT' || card.effectType === 'DEFENSE_PERCENT') {
    const key = card.effectType === 'OFFENSE_PERCENT' ? 'offPercent' : 'defPercent';
    extra[key] = (extra[key] || 0) + card.value;
  } else if (card.effectType === 'DICE_MOD') {
    const key = kind === 'defense' ? 'defDice' : 'offDice';
    extra[key] = (extra[key] || 0) + card.value;
    detail += ` (${kind})`;
  } else if (card.effectType === 'ADVANTAGE') {
    extra.cardAdvantage = true;
  } else if (card.effectType === 'DISADVANTAGE') {
    extra.cardDisadvantage = true;
  } else if (card.effectType === 'MATCHUP_CARD_MOD') {
    if (card.value > 0) {
      const drawn = drawMatchupModifierCard(state, true);
      if (drawn) { user.matchupCards.push(drawn); detail = `drew ${drawn.name}`; }
      else detail = 'deck empty — no card drawn';
    } else {
      const available = opponent.matchupCards.filter((c) => !c.used && c.playable);
      const discarded = available[Math.floor(Math.random() * available.length)];
      if (discarded) { discarded.used = true; detail = `discarded ${discarded.name}`; }
      else detail = 'no unused playable card to discard';
    }
  } else return null;
  card.used = true;
  return `${user.name} played ${card.name} on ${team.name} — ${detail}.`;
}

// Applies any temporary player-stat-target card effects (extra.statChanges) on top of the
// roster's real stats, without mutating it — same adjusted view supplementalRoll's own modifier
// lookup uses, exposed so the breakdown popover can reconcile against the exact roll.
export function statAdjustedTeam(team, extra) {
  return { ...team, hand: team.hand.map((player) => {
    const stats = { ...player.stats };
    for (const change of extra.statChanges || []) {
      if (change.playerId === player.id) stats[change.stat] = Math.max(1, stats[change.stat] + change.value);
    }
    return { ...player, stats };
  }) };
}

export function supplementalRoll(team, ids, extra, kind, first, second, baseAdvantage = false) {
  const advantage = !!(baseAdvantage || extra.cardAdvantage);
  const disadvantage = !!extra.cardDisadvantage;
  const mode = advantage === disadvantage ? 0 : advantage ? 1 : -1;
  const rolled = mode > 0 ? Math.max(first, second) : mode < 0 ? Math.min(first, second) : first;
  const adjusted = statAdjustedTeam(team, extra);
  const off = kind === 'offense';
  const roster = modifierBreakdown(adjusted, ids, kind);
  const base = roster.base;
  // Keep fractional bonuses so a +5% card cannot disappear through integer rounding.
  const cardPercent = extra[off ? 'offPercent' : 'defPercent'] || 0;
  const cardDelta = extra[off ? 'offDelta' : 'defDelta'] || 0;
  const mod = Math.round((base * Math.max(0, 1 + cardPercent / 100) + cardDelta) * 100) / 100;
  const die = Math.max(1, rolled + (extra[off ? 'offDice' : 'defDice'] || 0));
  const breakdown = { ...roster, cardPercent, cardDelta, mod };
  return { die, mod, total: Math.round((die + mod) * 100) / 100, dieOther: mode ? (rolled === first ? second : first) : null, mode, breakdown };
}
