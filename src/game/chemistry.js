// Tenure belongs to a club, not to age or contract length. Old saves start at zero.
export function completedTeamYears(player, teamId) {
  return player.teamTenure?.teamId === teamId ? Math.max(0, player.teamTenure.completedYears || 0) : 0;
}
// starterYears/benchYears split completedYears by the role a player actually held that
// season (see creditTeamSeason below) — a player who's spent time in both roles carries
// credit from each, since both contribute their own continuity bonus (see chemistryDetails).
function starterYearsOf(player, teamId) {
  return player.teamTenure?.teamId === teamId ? Math.max(0, player.teamTenure.starterYears || 0) : 0;
}
function benchYearsOf(player, teamId) {
  return player.teamTenure?.teamId === teamId ? Math.max(0, player.teamTenure.benchYears || 0) : 0;
}

const freshTenure = (teamId) => ({ teamId, completedYears: 0, starterYears: 0, benchYears: 0, lastCreditedSeason: 0 });

export function addToRoster(team, player) {
  if (player.teamTenure?.teamId !== team.id) player.teamTenure = freshTenure(team.id);
  team.hand.push(player);
}

// Credits exactly one completed season per player (guarded per-player so a stray double-call
// can't double-credit), split into starterYears or benchYears by whether they were in
// activeIds when the season they just finished was actually played — still true here since
// this runs right after Results, before the next lineup is set. Also tallies, for every pair
// of players who started together this season, one more year toward their shared continuity
// (team.starterPairYears, keyed by sorted "idA:idB"), guarded at the team level the same way.
export function creditTeamSeason(team, season) {
  const active = new Set(team.activeIds || []);
  for (const player of team.hand) {
    if (player.teamTenure?.teamId !== team.id) player.teamTenure = freshTenure(team.id);
    if (player.teamTenure.lastCreditedSeason >= season) continue;
    player.teamTenure.completedYears += 1;
    if (active.has(player.id)) player.teamTenure.starterYears = (player.teamTenure.starterYears || 0) + 1;
    else player.teamTenure.benchYears = (player.teamTenure.benchYears || 0) + 1;
    player.teamTenure.lastCreditedSeason = season;
  }
  if ((team.lastPairCreditedSeason || 0) < season) {
    team.starterPairYears ||= {};
    const starterIds = team.hand.filter((p) => active.has(p.id)).map((p) => p.id).sort();
    for (let i = 0; i < starterIds.length; i++) {
      for (let j = i + 1; j < starterIds.length; j++) {
        const key = starterIds[i] + ':' + starterIds[j];
        team.starterPairYears[key] = (team.starterPairYears[key] || 0) + 1;
      }
    }
    team.lastPairCreditedSeason = season;
  }
}
// How many seasons this exact pair of currently-active starters has started together before —
// the shared half of "+.25 for every year two starters have started together" (see
// chemistryDetails; the other half is just that this season itself now counts as one, credited
// above once it's actually completed).
function starterPairYears(team, idA, idB) {
  const [a, b] = [idA, idB].sort();
  return team.starterPairYears?.[a + ':' + b] || 0;
}

export const CHEMISTRY_GRADES = [
  [97, 'A+'], [93, 'A'], [90, 'A−'], [87, 'B+'], [83, 'B'], [80, 'B−'],
  [77, 'C+'], [73, 'C'], [70, 'C−'], [67, 'D+'], [63, 'D'], [60, 'D−'], [0, 'F'],
];
export function chemistryGrade(score) {
  return CHEMISTRY_GRADES.find(([minimum]) => Math.max(0, Math.min(100, Math.round(score))) >= minimum)[1];
}

// Continuity has four independent sources, each its own flat rate per completed year:
// +0.5% Off/Def per year a player (anywhere on the roster) has started for this team, +0.25%
// per year they've been a bench piece instead, +0.25% per year the CURRENT starting five's
// pairs have started together before, and +0.5% per year the current coach has been retained.
// All four fold into the same uncapped `continuity` add-on teamSynergy already applies to
// offense/defense, and the same combined figure (doubled, to undo the starter rate's own 0.5×
// so a year of pure starter continuity still reads as 1 point) still feeds the 0-100 score's
// tenurePoints, capped at 15 exactly as before.
export function chemistryDetails(team, ids, skillOffense, skillDefense, leadership) {
  const active = new Set(ids);
  const starterYears = team.hand.reduce((sum, p) => sum + starterYearsOf(p, team.id), 0);
  const benchYears = team.hand.reduce((sum, p) => sum + benchYearsOf(p, team.id), 0);
  const starters = [...active];
  let pairYears = 0;
  for (let i = 0; i < starters.length; i++) {
    for (let j = i + 1; j < starters.length; j++) pairYears += starterPairYears(team, starters[i], starters[j]);
  }
  const coachYears = Math.max(0, team.retainedStreak || 0);
  const continuity = starterYears * 0.5 + benchYears * 0.25 + pairYears * 0.25 + coachYears * 0.5;
  const fitPoints = Math.min(30, (skillOffense + skillDefense) * 2.5);
  const tenurePoints = Math.min(15, Math.round(continuity * 2));
  const leadershipPoints = leadership ? 5 : 0;
  const score = Math.round(50 + fitPoints + tenurePoints + leadershipPoints);
  return { score, grade: chemistryGrade(score), starterYears, benchYears, pairYears, coachYears, continuity, fitPoints, tenurePoints, leadershipPoints };
}
