import { POSITIONS, ARCHETYPES, RARITIES } from './constants';
import { playerGrade } from './cards';

export const PLAYER_GRADES = ['A+', 'A', 'B', 'C', 'D', 'F'];
export const PLAYER_ARCHETYPES = Object.keys(ARCHETYPES);
export const COST_BRACKETS = [1, 2, 3, 4, 5];

export const DEFAULT_PLAYER_FILTERS = { position: 'All', grade: 'All', rarity: 'All', archetype: 'All', cost: 'All' };

export function playerFiltersActive(filters) {
  return Object.values(filters).some((v) => v !== 'All');
}

// Cost is a "at most" bracket rather than an exact match — salaries land on quarter-point
// values, so an exact-match dropdown would mostly show nothing.
export function matchesPlayerFilters(card, filters) {
  if (!filters) return true;
  if (filters.position !== 'All' && card.position !== filters.position) return false;
  if (filters.grade !== 'All' && playerGrade(card) !== filters.grade) return false;
  if (filters.rarity !== 'All' && card.rarity !== filters.rarity) return false;
  if (filters.archetype !== 'All' && card.archetype !== filters.archetype) return false;
  if (filters.cost !== 'All' && card.salary > Number(filters.cost)) return false;
  return true;
}

export { POSITIONS, RARITIES };

const POSITION_ORDER = { Guard: 0, Forward: 1, Big: 2 };
const RARITY_ORDER = { Legendary: 0, Signature: 1, Prime: 2, Core: 3 };

export function sortPlayers(cards, sort = 'position') {
  return [...cards].sort((a, b) => {
    if (['SCO', 'PLM', 'REB', 'DEF'].includes(sort)) return (b.stats?.[sort] || 0) - (a.stats?.[sort] || 0);
    if (sort === 'grade') return total(b) - total(a);
    if (sort === 'rarity') return (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99);
    if (sort === 'archetype') return String(a.archetype).localeCompare(String(b.archetype));
    return (POSITION_ORDER[a.position] ?? 99) - (POSITION_ORDER[b.position] ?? 99);
  });
}

function total(card) {
  return Object.values(card.stats || {}).reduce((sum, value) => sum + value, 0);
}
