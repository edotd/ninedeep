import { teamSynergy } from '../game/skillsets';
import { teamOutput } from '../game/matchup';

function safeOutput(team) {
  if (!team.coach || !team.activeIds || !team.hand.length) return null;
  return teamOutput(team);
}

export default function LeagueScreen({ state, myTeamId, onBack, onViewTeam }) {
  const rows = state.teams.map((t) => ({ t, out: safeOutput(t) }));
  rows.sort((a, b) => (b.out ? b.out.total : -Infinity) - (a.out ? a.out.total : -Infinity));

  return (
    <>
      <div className="screen">
        <h1>Standings</h1>
        <div className="league-standings-table">
          <div className="league-standings-row head">
            <span>Team</span><span>Chemistry</span><span>Projected Output</span><span>Offense</span><span>Defense</span>
          </div>
          {rows.map(({ t, out }, index) => (
            <button
              type="button"
              key={t.name}
              className={'league-standings-row' + (t.id === myTeamId ? ' you' : '')}
              onClick={onViewTeam ? () => onViewTeam(t.id) : undefined}
              disabled={!onViewTeam}
            >
              <span className="league-team"><i>{index + 1}</i><b>{t.name}</b></span>
              <span>{teamSynergy(t).grade}</span>
              <span className="league-output">{out ? out.total : '—'}</span>
              <span>{out ? out.off : '—'}</span>
              <span>{out ? out.def : '—'}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="bottombar">
        <button className="primary" onClick={onBack}>Back</button>
      </div>
    </>
  );
}
