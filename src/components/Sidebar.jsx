import BallMark from './BallMark';

const ERA_LENGTH = 8;
const NAV_ITEMS = [
  { key: 'team', label: 'Team' },
  { key: 'standings', label: 'Standings' },
  { key: 'glossary', label: 'Glossary' },
  { key: 'settings', label: 'Settings' },
];

// Desktop sidebar, per the brand handoff's "Screen: Roster + Cap Sheet". The design's own
// nav items (Roster/Cap Sheet/Free Agents/Season/Era Record) assume a screen structure this
// game doesn't have — its flow is phase-driven (Front Office -> Hand -> Lineup -> Playoffs
// -> Results -> Draft -> Free Agency, in a fixed order), not free-roaming tabs. So the nav
// list here is the same always-available links the mobile top bar exposes today (Team /
// Standings / Glossary / Settings as overlays on top of the current phase), just restyled
// into the sidebar's vertical list. Team was dropped for a while when the persistent bar
// alone covered the roster/front-office/matchup view, but it's the only way to reach the
// Team Finances moves (fire coach, relocate market, invest in fanbase), so it's back.
export default function Sidebar({ state, myTeamId, overlay, onNav }) {
  const team = state.teams[myTeamId];
  const seasonNum = Math.min(state.season, ERA_LENGTH);
  return (
    <div className="sidebar">
      <div className="sidebar-lockup">
        <BallMark size={36} variant="onInk" />
        <span className="topbar-wordmark"><b>NINE</b> <i>DEEP</i></span>
      </div>
      <div className="sidebar-team">{team.name}</div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={'sidebar-nav-item' + (overlay === item.key ? ' active' : '')}
            onClick={() => onNav(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-era-label">Era 01 · Year {seasonNum} of {ERA_LENGTH}</div>
        <div className="era-bar">
          {Array.from({ length: ERA_LENGTH }, (_, i) => (
            <div key={i} className={'era-seg' + (i < seasonNum ? ' done' : '')} />
          ))}
        </div>
        <div className="sidebar-titles">
          <span className="sidebar-titles-value">{team.titles}</span>
          <span className="sidebar-titles-label">Championship{team.titles === 1 ? '' : 's'} Filed</span>
        </div>
      </div>
    </div>
  );
}
