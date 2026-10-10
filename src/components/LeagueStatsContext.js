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
