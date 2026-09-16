import { teamOutput } from '../game/matchup';
import { teamExperience } from '../game/aging';
import { formatCoins, rosterSalary } from '../game/economy';

const ERA_LENGTH = 8;
const RESULT_LABEL = { TITLE: 'Champions', FINALS: 'Lost The Final', R2: 'Lost Round 2', R1: 'Lost Round 1', MISSED: 'Missed The Playoffs' };

// The Odometer (design brand handoff, "Nine Deep Transitions" 2A) — a one-time beat shown
// between seasons, for every season after the first (season 1 has no "last season" to file
// against). Not a loading state: it says a new season has started and what it will be judged
// on. state.season and every team's front-office/cap/matchup-card data for the new season are
// already finalized by the time this renders (see season.js's finishFreeAgency), so the
// "projected this season" panel is real, not a placeholder.
//
// The design's panel pairs a filed win-loss record against a projected one; this game doesn't
// simulate a win-loss record for a season (only the Standings' Off/Def Avg, and only once the
// season is actually locked), so "Last Season" shows the actual postseason result filed for
// it and "Projected This Season" shows the real front-office/chemistry/output numbers this
// roster is starting the new season with — the same figures the persistent bar carries.
export default function SeasonTransitionScreen({ state, actions, myTeamId }) {
  const team = state.teams[myTeamId];
  const seasonNum = Math.min(state.season, ERA_LENGTH);
  const played = seasonNum - 1;
  const remaining = ERA_LENGTH - played;
  const outright = state.settings && state.settings.winCondition === 'outright';

  const history = team.seasonHistory || [];
  const lastSeason = history[history.length - 1];
  const output = team.coach && team.activeIds && team.activeIds.length > 0 ? teamOutput(team) : null;
  const chemistry = team.coach ? teamExperience(team) : null;
  const salary = rosterSalary(team);

  return (
    <>
      <div className="screen trans-screen">
        <div className="trans-inner">
          <div className="trans-eyebrow"><span>Era 01</span><span className="accent">Season</span></div>
          <div className="trans-headline-row">
            <div className="trans-numeral">{seasonNum}</div>
            <div className="trans-team">{team.name}</div>
          </div>

          <div className="trans-era-bar">
            {Array.from({ length: ERA_LENGTH }, (_, i) => (
              <div key={i} className={'trans-era-seg' + (i < played ? ' done' : i === played ? ' current' : '')} />
            ))}
          </div>

          <div className="trans-meta-row">
            <span>{played} Season{played === 1 ? '' : 's'} Played · {remaining} Remaining</span>
            <span>Win Condition · {outright ? 'Win Playoffs Outright' : 'Championship Bar'}</span>
          </div>

          <div className="trans-panels">
            <div className="trans-panel">
              <div className="trans-panel-head"><span>Last Season</span><span>Season {played}</span></div>
              <div className="trans-panel-figure">{lastSeason ? (RESULT_LABEL[lastSeason.result] || lastSeason.result) : '—'}</div>
              <div className="trans-panel-sub">{lastSeason ? `${formatCoins(lastSeason.capUsed)} cap used · ${lastSeason.underContract} under contract` : 'No record filed yet.'}</div>
            </div>
            <div className="trans-panel current">
              <div className="trans-panel-head"><span>Projected This Season</span><span>Before The Deal</span></div>
              <div className="trans-panel-figure accent">{output ? output.total : '—'}</div>
              <div className="trans-panel-sub">Chemistry {chemistry !== null ? chemistry : '—'}/10 · Budget {formatCoins(salary)} / {formatCoins(team.seasonCap || 0)}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="bottombar">
        <button className="primary" onClick={actions.proceedFromSeasonTransition}>Begin Season {seasonNum}</button>
      </div>
    </>
  );
}
