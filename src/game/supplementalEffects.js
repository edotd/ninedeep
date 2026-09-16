import { drawMatchupModifierCard } from './cards';
import { offenseModifier, defenseModifier } from './roster';

export const PLAYER_STATS = ['SCO', 'PLM', 'REB', 'DEF'];

// All numerical changes live on match extras, never on the persistent roster.
export function applySupplementalCard(state, user, opponent, card, ownExtra, opposingExtra, ownIds, opposingIds, targetId, stat = 'SCO', kind = 'offense') {
  if (card.used || !card.playable) return null;
  const self = card.target === 'self';
  const team = self ? user : opponent;
  const extra = self ? ownExtra : opposingExtra;
  const ids = self ? ownIds : opposingIds;
  let detail = card.description;
  if (card.effectType === 'PLAYER_STAT_MOD') {
    if (!PLAYER_STATS.includes(stat)) return null;
    const playerId = targetId || ids[0];
    if (!ids.includes(playerId) || !team.hand.some((p) => p.id === playerId)) return null;
    extra.statChanges ||= [];
    extra.statChanges.push({ playerId, stat, value: card.value });
    const player = team.hand.find((p) => p.id === playerId);
    detail = `${card.value > 0 ? '+' : ''}${card.value} ${stat} for ${player.archetype}`;
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

export function supplementalRoll(team, ids, extra, kind, first, second, baseAdvantage = false) {
  const advantage = !!(baseAdvantage || extra.cardAdvantage);
  const disadvantage = !!extra.cardDisadvantage;
  const mode = advantage === disadvantage ? 0 : advantage ? 1 : -1;
  const rolled = mode > 0 ? Math.max(first, second) : mode < 0 ? Math.min(first, second) : first;
  const adjusted = { ...team, hand: team.hand.map((player) => {
    const stats = { ...player.stats };
    for (const change of extra.statChanges || []) {
      if (change.playerId === player.id) stats[change.stat] = Math.max(1, stats[change.stat] + change.value);
    }
    return { ...player, stats };
  }) };
  const off = kind === 'offense';
  const base = off ? offenseModifier(adjusted, ids) : defenseModifier(adjusted, ids);
  // Keep fractional bonuses so a +5% card cannot disappear through integer rounding.
  const mod = Math.round((base * Math.max(0, 1 + (extra[off ? 'offPercent' : 'defPercent'] || 0) / 100) + (extra[off ? 'offDelta' : 'defDelta'] || 0)) * 100) / 100;
  const die = Math.max(1, rolled + (extra[off ? 'offDice' : 'defDice'] || 0));
  return { die, mod, total: Math.round((die + mod) * 100) / 100, dieOther: mode ? (rolled === first ? second : first) : null, mode };
}
