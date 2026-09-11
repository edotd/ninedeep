import { formatCoins } from '../game/economy';

export default function Header({ state, myTeamId, onGlossary, onStandings, onSettings, onNewEra }) {
  const team = state.teams[myTeamId];
  return (
    <div className="topbar">
      <div className="topbar-title">{team.name}</div>
      <div className="topbar-stats">
        <div className="tb-cell"><b>{Math.min(state.season, 8)}/8</b><span>Season</span></div>
        <div className="tb-cell"><b>{team.titles}</b><span>Titles</span></div>
        <div className="tb-cell"><b>{team.seasonCap !== undefined ? formatCoins(team.seasonCap) : '—'}</b><span>Cap</span></div>
        <div className="tb-cell"><b>{state.bar !== undefined ? Math.round(state.bar) : '—'}</b><span>Bar</span></div>
      </div>
      {state.phase !== 'league' && <button className="reset-link" onClick={onStandings}>Standings</button>}
      {state.phase !== 'glossary' && <button className="reset-link" onClick={onGlossary}>Glossary</button>}
      {state.phase !== 'settings' && <button className="reset-link" onClick={onSettings}>Settings</button>}
      <button
        className="reset-link"
        onClick={() => { if (confirm('Start a new era? Current progress will be lost.')) onNewEra(); }}
      >
        New Era
      </button>
    </div>
  );
}
