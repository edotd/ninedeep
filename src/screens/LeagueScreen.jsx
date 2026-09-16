import { teamSynergy } from '../game/skillsets';
import { teamOutput } from '../game/matchup';
import { teamExperience } from '../game/aging';

function safeOutput(team) {
  if (!team.coach || !team.activeIds || !team.hand.length) return null;
  return teamOutput(team);
}

export default function LeagueScreen({ state, myTeamId, onBack }) {
  const rows = state.teams.map((t) => ({ t, out: safeOutput(t), exp: teamExperience(t) }));
  rows.sort((a, b) => (b.out ? b.out.total : -Infinity) - (a.out ? a.out.total : -Infinity));

  return (
    <>
      <div className="screen">
        <h1>Standings</h1>
        <p className="lede">Every team's current coach and matchup output — the deterministic part of their score (offense modifier + defense modifier + bench), before dice are rolled — plus a Chemistry letter grade from Skillset fit, starter tenure, and leadership, alongside the separate experience rating. Not visible until hands are dealt for the season.</p>
        {rows.map(({ t, out, exp }) => (
          <div key={t.name} className={'standing-row' + (t.id === myTeamId ? ' you' : '')} style={{ alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span>{t.name}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{t.coach ? t.coach.name : 'No coach yet'}</span>
            </div>
            <div style={{ display: 'flex', gap: 14, fontFamily: 'var(--mono)', alignItems: 'baseline' }}>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>Off {out ? out.off : '—'}</span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>Def {out ? out.def : '—'}</span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>Chem {teamSynergy(t).grade} · Exp {exp !== null ? exp : '—'}</span>
              <b>{out ? out.total : '—'}</b>
            </div>
          </div>
        ))}
      </div>
      <div className="bottombar">
        <button className="primary" onClick={onBack}>Back</button>
      </div>
    </>
  );
}
