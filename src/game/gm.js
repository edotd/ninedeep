import { GM_TYPES, MARKETS, GM_BONUS_RATE, HANDS_OFF_BONUS_CAP } from './constants';
import { weightedPick } from './rng';
import { rollMarketCapAdj } from './economy';
import { completedTeamYears, addToRoster } from './chemistry';

export function drawGM(excludeType = null) {
  const market = weightedPick(MARKETS);
  const types = GM_TYPES.filter((type) => type !== excludeType);
  return {
    type: types[Math.floor(Math.random() * types.length)],
    market: { name: market.name, capAdj: rollMarketCapAdj(market) },
  };
}

export function handsOffBonus(team, ids = team.activeIds || []) {
  if (team.gmType !== 'Hands-Off' || ids.length !== 5) return 0;
  const coachYears = Math.max(0, team.retainedStreak || 0);
  const starterYears = Math.min(...ids.map((id) => {
    const player = team.hand.find((card) => card.id === id);
    return player ? completedTeamYears(player, team.id) : 0;
  }));
  return Math.min(HANDS_OFF_BONUS_CAP, (coachYears + starterYears) * GM_BONUS_RATE);
}

export function offseasonPrice(team, salary) {
  return team.gmType === 'Aggressive' ? Math.round(salary * (1 - GM_BONUS_RATE) * 100) / 100 : salary;
}

export function acquireOffseasonPlayer(team, card) {
  const signed = { ...card, salary: offseasonPrice(team, card.salary) };
  addToRoster(team, signed);
  return signed;
}
