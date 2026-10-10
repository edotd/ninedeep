import { createContext } from 'react';

// Highest value of each stat across every rostered player in the league. Cards read it to
// decide which stat numbers earn the gold shine (see PlayerCard.jsx). null outside the game shell.
export const LeagueStatsContext = createContext(null);

export function leagueStatMax(teams) {
  const max = { SCO: 0, PLM: 0, REB: 0, DEF: 0 };
  for (const team of teams || []) {
    for (const card of team.hand || []) {
      for (const stat of Object.keys(max)) if ((card.stats?.[stat] || 0) > max[stat]) max[stat] = card.stats[stat];
    }
  }
  return max;
}

// card id -> 'Starter' | 'Sixth Man' | 'Depth' for every card on a team with a saved lineup.
export const RosterRolesContext = createContext(null);

export function rosterRoles(teams) {
  const roles = {};
  for (const team of teams || []) {
    if (!team.lineupSet) continue;
    const active = new Set(team.activeIds || []);
    for (const card of team.hand || []) {
      roles[card.id] = active.has(card.id) ? 'Starter' : card.id === team.sixthManId ? 'Sixth Man' : 'Depth';
    }
  }
  return roles;
}

// card id -> 'high' | 'low' for the costliest / cheapest player(s) on each team (ties share it).
// A team with every cost equal, or fewer than two players, has neither.
export const RosterCostsContext = createContext(null);

export function rosterCostRanks(teams) {
  const ranks = {};
  for (const team of teams || []) {
    const hand = team.hand || [];
    if (hand.length < 2) continue;
    const costs = hand.map((card) => card.salary);
    const max = Math.max(...costs), min = Math.min(...costs);
    if (max === min) continue;
    for (const card of hand) {
      if (card.salary === max) ranks[card.id] = 'high';
      else if (card.salary === min) ranks[card.id] = 'low';
    }
  }
  return ranks;
}
