import BallMark from './BallMark';
import { teamOutput } from '../game/matchup';

const ERA_LENGTH = 8;

function outputFor(team) {
  return team && team.coach && team.activeIds && team.activeIds.length > 0 ? teamOutput(team) : null;
}
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
// front-office moves (fire coach, relocate market, invest in fanbase), so it's back.
export default function Sidebar({ state, myTeamId, overlay, onNav }) {
  const team = state.teams[myTeamId];
  const seasonNum = Math.min(state.season, ERA_LENGTH);
  // A quick glance at where you stand relative to the rest of the league without leaving
  // whatever screen you're on — sorted by Projected Output (each rotation's expected points,
  // same figure the persistent bar and bracket show), teams that haven't set a lineup yet
  // (no coach/active five) sink to the bottom rather than sorting as a false zero.
  const standings = state.teams
    .map((t) => ({ t, output: outputFor(t) }))
    .sort((a, b) => {
      if (a.output && b.output) return b.output.total - a.output.total;
      if (a.output) return -1;
      if (b.output) return 1;
      return a.t.id - b.t.id;
    });
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
      <div className="sidebar-standings">
        <div className="sidebar-standings-heading">Live Standings</div>
        {standings.map(({ t, output }, i) => (
          <div key={t.id} className={'sidebar-standings-row' + (t.id === myTeamId ? ' you' : '')}>
            <span className="sidebar-standings-rank">{i + 1}</span>
            <span className="sidebar-standings-tri">{t.tricode}</span>
            <span className="sidebar-standings-val">{output ? output.total.toFixed(2) : '—'}</span>
          </div>
        ))}
      </div>
      <div className="sidebar-footer">
        <div className="sidebar-era-label">Era 01 · Year {seasonNum} of {ERA_LENGTH}</div>
        <div className="era-bar">
          {Array.from({ length: ERA_LENGTH }, (_, i) => (
            <div key={i} className={'era-seg' + (i < seasonNum ? ' done' : '')} />
          ))}
        </div>
        <div className="sidebar-titles">
          <span className="sidebar-titles-value">{team.titles}</span>
          <span className="sidebar-titles-label">Championship{team.titles === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  );
}
