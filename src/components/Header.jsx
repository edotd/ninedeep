import BallMark from './BallMark';
import { ERA_LENGTH } from '../game/constants';

// The Cap/Bar/Titles stats strip that used to live here is gone — the persistent bar is
// always up now (see GameShell) and already carries cap; Titles has its own home on the Team
// screen and Sidebar, and the championship bar is shown, more prominently, on Standings
// itself. Removing it gives every screen's own heading the space right at the top instead of
// competing with a second header band above it.
export default function Header({ state, myTeamId, overlay, onTeam, onFreeAgency, onGlossary, onStandings, onSettings }) {
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
      <div className="topbar-nav">
        <button className={'reset-link' + (overlay === 'team' ? ' active' : '')} onClick={onTeam}>Team</button>
        <button className={'reset-link' + (overlay === 'freeagency' ? ' active' : '')} onClick={onFreeAgency}>Free Agency</button>
        <button className={'reset-link' + (overlay === 'standings' ? ' active' : '')} onClick={onStandings}>Standings</button>
        <button className={'reset-link' + (overlay === 'glossary' ? ' active' : '')} onClick={onGlossary}>Glossary</button>
        <button className={'reset-link' + (overlay === 'settings' ? ' active' : '')} onClick={onSettings}>Settings</button>
      </div>
    </div>
  );
}
