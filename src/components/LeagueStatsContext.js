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
