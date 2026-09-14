import { formatCoins } from '../game/economy';
import BallMark from './BallMark';

const ERA_LENGTH = 8;

export default function Header({ state, myTeamId, overlay, onTeam, onGlossary, onStandings, onSettings }) {
  const team = state.teams[myTeamId];
  const seasonNum = Math.min(state.season, ERA_LENGTH);
  return (
    <div className="topbar">
      <div className="topbar-lockup">
        <BallMark size={28} variant="onInk" />
        <span className="topbar-wordmark"><b>NINE</b> <i>DEEP</i></span>
        <div className="topbar-title">{team.name}</div>
      </div>
      <div className="era-bar-wrap">
        <div className="era-bar-label"><span>Era 01 · Year {seasonNum} of {ERA_LENGTH}</span></div>
        <div className="era-bar">
          {Array.from({ length: ERA_LENGTH }, (_, i) => (
            <div key={i} className={'era-seg' + (i < seasonNum ? ' done' : '')} />
          ))}
        </div>
      </div>
      <div className="topbar-stats">
        <div className="tb-cell"><b>{team.titles}</b><span>Titles</span></div>
        <div className="tb-cell"><b>{team.seasonCap !== undefined ? formatCoins(team.seasonCap) : '—'}</b><span>Cap</span></div>
        <div className="tb-cell"><b>{state.bar !== undefined ? Math.round(state.bar) : '—'}</b><span>Bar</span></div>
      </div>
      <div className="topbar-nav">
        <button className={'reset-link' + (overlay === 'team' ? ' active' : '')} onClick={onTeam}>Team</button>
        <button className={'reset-link' + (overlay === 'standings' ? ' active' : '')} onClick={onStandings}>Standings</button>
        <button className={'reset-link' + (overlay === 'glossary' ? ' active' : '')} onClick={onGlossary}>Glossary</button>
        <button className={'reset-link' + (overlay === 'settings' ? ' active' : '')} onClick={onSettings}>Settings</button>
      </div>
    </div>
  );
}
