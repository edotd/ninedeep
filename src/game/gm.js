import { GM_TYPES, GM_RARITIES, GM_TRAITS, MARKETS, GM_BONUS_RATE, HANDS_OFF_BONUS_CAP } from './constants';
import { weightedPick } from './rng';
import { rollMarketCapAdj } from './economy';
import { completedTeamYears, addToRoster } from './chemistry';

export function drawGM() {
  const market = weightedPick(MARKETS);
  const rarity = weightedPick(GM_RARITIES);
  const trait = GM_TRAITS[Math.floor(Math.random() * GM_TRAITS.length)];
  const value = rarity.min + Math.floor(Math.random() * (rarity.max - rarity.min + 1));
  return {
    type: GM_TYPES[0],
    rarity: rarity.name,
    trait: { ...trait, value },
    market: { name: market.name, capAdj: rollMarketCapAdj(market) },
  };
}

export function handsOffBonus(team, ids = team.activeIds || []) {
  if (team.gmTrait?.name !== 'Hands-Off' || ids.length !== 5) return 0;
  const coachYears = Math.max(0, team.retainedStreak || 0);
  const starterYears = Math.min(...ids.map((id) => {
    const player = team.hand.find((card) => card.id === id);
    return player ? completedTeamYears(player, team.id) : 0;
  }));
  return Math.min(HANDS_OFF_BONUS_CAP, (coachYears + starterYears) * GM_BONUS_RATE * (team.gmTrait.value || 1));
}

export function offseasonPrice(team, salary) {
  return team.gmTrait?.name === 'Deal Maker' ? Math.round(salary * (1 - GM_BONUS_RATE * (team.gmTrait.value || 1)) * 100) / 100 : salary;
}

export function scoutingLimit(team) {
  return 3 + (team.gmTrait?.name === 'Talent Hawk' ? (team.gmTrait.value || 0) : 0);
}

export function acquireOffseasonPlayer(team, card) {
  const signed = { ...card, salary: offseasonPrice(team, card.salary) };
  addToRoster(team, signed);
  return signed;
}
