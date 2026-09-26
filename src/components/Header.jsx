import { useState } from 'react';
import BallMark from './BallMark';
import AnimatedPageLabel from './AnimatedPageLabel';
import { ERA_LENGTH } from '../game/constants';

// The Cap/Bar/Titles stats strip that used to live here is gone — the persistent bar is
// always up now (see GameShell) and already carries cap; Titles has its own home on the Team
// screen and Sidebar, and the championship bar is shown, more prominently, on Standings
// itself. Removing it gives every screen's own heading the space right at the top instead of
// competing with a second header band above it.
//
// On mobile the Team/Free Agency/Standings/Glossary/Settings row used to be its own permanent
// band under the logo — real vertical space on a screen that's already tight. The logo now
// doubles as that row's menu trigger there (see .topbar-menu-btn / .topbar-nav in index.css,
// scoped to the mobile breakpoint only); desktop keeps the row inline exactly as before, so
// menuOpen never applies there.
export default function Header({ state, myTeamId, overlay, pageLabel, onTeam, onFreeAgency, onDraftClass, onGlossary, onStandings, onSettings, navNeedsAttention, roomCode, freeAgencyAlert, freeAgencyLocked }) {
  const team = state.teams[myTeamId];
  const seasonNum = Math.min(state.season, ERA_LENGTH);
  const [menuOpen, setMenuOpen] = useState(false);
  const navClick = (fn) => () => { setMenuOpen(false); fn(); };
  return (
    <div className="topbar">
      <div className="topbar-lockup">
        <button
          type="button"
          className={'topbar-menu-btn' + (menuOpen ? ' open' : '') + (navNeedsAttention ? ' nav-attention' : '')}
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          <BallMark size={28} variant="onInk" />
        </button>
        <AnimatedPageLabel key={pageLabel} page={pageLabel} />
        <div className="topbar-title">{team.name} {team.tricode && <span className="topbar-tricode">{team.tricode}</span>}</div>
      </div>
      <div className="era-bar-wrap">
        <div className="era-bar-label">
          <span>Era 01 · Year {seasonNum} of {ERA_LENGTH}</span>
          {roomCode && <span className="topbar-room-code" title="Share this code so others can join this room">Room {roomCode}</span>}
        </div>
        <div className="era-bar">
          {Array.from({ length: ERA_LENGTH }, (_, i) => (
            <div key={i} className={'era-seg' + (i < seasonNum ? ' done' : '')} />
          ))}
        </div>
      </div>
      {menuOpen && <div className="topbar-menu-backdrop" onClick={() => setMenuOpen(false)} />}
      <div className={'topbar-nav' + (menuOpen ? ' open' : '')}>
        <button className={'reset-link' + (overlay === 'team' ? ' active' : '')} onClick={navClick(onTeam)}>Franchise</button>
        <button className={'reset-link' + (overlay === 'freeagency' ? ' active' : '') + (freeAgencyLocked ? ' locked' : '')} onClick={navClick(onFreeAgency)} disabled={freeAgencyLocked} title={freeAgencyLocked ? 'Free Agency reopens next season' : undefined}>
          Free Agency{freeAgencyLocked ? <span className="nav-lock-icon" aria-label="Locked">🔒</span> : freeAgencyAlert && <span className="alert-badge" aria-label="Needs attention">!</span>}
        </button>
        <button className={'reset-link' + (overlay === 'draftclass' ? ' active' : '')} onClick={navClick(onDraftClass)}>Draft Class</button>
        <button className={'reset-link' + (overlay === 'standings' ? ' active' : '')} onClick={navClick(onStandings)}>Standings</button>
        <button className={'reset-link' + (overlay === 'glossary' ? ' active' : '')} onClick={navClick(onGlossary)}>Glossary</button>
        <button className={'reset-link' + (overlay === 'settings' ? ' active' : '')} onClick={navClick(onSettings)}>Settings</button>
      </div>
    </div>
  );
}
