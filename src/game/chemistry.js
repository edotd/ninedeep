// Tenure belongs to a club, not to age or contract length. Old saves start at zero.
export function completedTeamYears(player, teamId) {
  return player.teamTenure?.teamId === teamId ? Math.max(0, player.teamTenure.completedYears || 0) : 0;
}

export function addToRoster(team, player) {
  if (player.teamTenure?.teamId !== team.id) {
    player.teamTenure = { teamId: team.id, completedYears: 0, lastCreditedSeason: 0 };
  }
  team.hand.push(player);
}

export function creditTeamSeason(team, season) {
  for (const player of team.hand) {
    if (player.teamTenure?.teamId !== team.id) {
      player.teamTenure = { teamId: team.id, completedYears: 0, lastCreditedSeason: 0 };
    }
    if (player.teamTenure.lastCreditedSeason >= season) continue;
    player.teamTenure.completedYears += 1;
    player.teamTenure.lastCreditedSeason = season;
  }
}

export const CHEMISTRY_GRADES = [
  [97, 'A+'], [93, 'A'], [90, 'A−'], [87, 'B+'], [83, 'B'], [80, 'B−'],
  [77, 'C+'], [73, 'C'], [70, 'C−'], [67, 'D+'], [63, 'D'], [60, 'D−'], [0, 'F'],
];
export function chemistryGrade(score) {
  return CHEMISTRY_GRADES.find(([minimum]) => Math.max(0, Math.min(100, Math.round(score))) >= minimum)[1];
}

export function chemistryDetails(team, ids, skillOffense, skillDefense, flat) {
  const active = new Set(ids);
  const starterYears = team.hand.filter((p) => active.has(p.id)).reduce((sum,p) => sum + completedTeamYears(p, team.id), 0);
  const fitPoints = Math.min(30, (skillOffense + skillDefense) * 2.5);
  const tenurePoints = Math.min(15, starterYears);
  const leadershipPoints = flat ? 5 : 0;
  const score = Math.round(50 + fitPoints + tenurePoints + leadershipPoints);
  return { score, grade: chemistryGrade(score), starterYears, continuity: starterYears * 0.5, fitPoints, tenurePoints, leadershipPoints };
}
