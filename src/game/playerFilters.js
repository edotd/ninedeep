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
