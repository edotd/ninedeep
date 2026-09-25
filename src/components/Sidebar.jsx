import BallMark from './BallMark';
import AnimatedPageLabel from './AnimatedPageLabel';
import { teamOutput } from '../game/matchup';
import { ERA_LENGTH } from '../game/constants';

function outputFor(team) {
  return team && team.coach && team.activeIds && team.activeIds.length > 0 ? teamOutput(team) : null;
}
// Phases that only ever occur after this season's lineup has been confirmed and
// lockSeasonAndSeed has run (see game/season.js) — state.seeds holds THIS season's real seed
// order by then, not a stale one left over from the season before. Everything earlier
// (dealing hands, front office, matchup cards, team summary) is still pre-seeding, so the
// sidebar has nothing but each team's own projected output to sort and show.
const POST_SEED_PHASES = new Set(['simulating', 'standings', 'playoffs', 'results', 'seasonrecap', 'contracts', 'draft', 'era_end']);

const PRIMARY_NAV_ITEMS = [
  { key: 'team', label: 'Franchise' },
  { key: 'freeagency', label: 'Free Agency' },
  { key: 'draftclass', label: 'Draft Class' },
  { key: 'standings', label: 'Standings' },
  { key: 'cardtypes', label: 'Card Types' },
];
const SUPPORT_NAV_ITEMS = [
  { key: 'glossary', label: 'Glossary' },
  { key: 'settings', label: 'Settings' },
];

// Desktop sidebar, per the brand handoff's "Screen: Roster + Cap Sheet". The design's own
// nav items (Roster/Cap Sheet/Free Agents/Season/Era Record) assume a screen structure this
// game doesn't have — its flow is phase-driven (Front Office -> Hand -> Lineup -> Playoffs
// -> Results -> Contracts -> Draft, in a fixed order), not free-roaming tabs. So the nav
// list here is the same always-available links the mobile top bar exposes today (Team /
// Standings / Glossary / Settings as overlays on top of the current phase), just restyled
// into the sidebar's vertical list. Team was dropped for a while when the persistent bar
// alone covered the roster/front-office/matchup view, but it's the only way to reach the
// front-office moves (fire coach or GM, invest in fanbase), so it's back.
export default function Sidebar({ state, myTeamId, overlay, pageLabel, viewTeamId, onNav, onViewTeam, onAcknowledgeNav, roomCode, freeAgencyAlert }) {
  const team = state.teams[myTeamId];
  const seasonNum = Math.min(state.season, ERA_LENGTH);
  // The Team overlay is showing someone else's file (opened from a standings row) when
  // viewTeamId is set to a team other than the caller's own — "Your Franchise" should only
  // read active for your own file, and the viewed team's own row should light up instead.
  const viewingOther = overlay === 'team' && viewTeamId != null && viewTeamId !== myTeamId;
  // Once this season is actually seeded, state.seeds IS the real standings order (see
  // game/season.js's lockSeasonAndSeed) — rank is each team's real seed, not just wherever
  // its own projection currently sorts to. Before that, there's no seed yet, only each team's
  // own projected output to sort and show — teams without a lineup set sink to the bottom
  // rather than sorting as a false zero.
  const seeded = POST_SEED_PHASES.has(state.phase) && !!state.seeds;
  const standings = seeded
    ? state.seeds.map(({ t }) => ({ t, output: outputFor(t) }))
    : state.teams
        .map((t) => ({ t, output: outputFor(t) }))
        .sort((a, b) => {
          if (a.output && b.output) return b.output.total - a.output.total;
          if (a.output) return -1;
          if (b.output) return 1;
          return a.t.id - b.t.id;
        });
  return (
    <div className="sidebar">
      {/* Unlike the mobile topbar's logo (Header.jsx), this one doesn't open anything — the
          sidebar's nav is always visible already — so it never needs the nav-attention
          treatment; onAcknowledgeNav still fires on click so a desktop user can dismiss the
          same to-do state some other way. */}
      <button type="button" className="sidebar-lockup" onClick={onAcknowledgeNav} aria-label="Nine Deep menu">
        <BallMark size={36} variant="onInk" />
        <AnimatedPageLabel key={pageLabel} page={pageLabel} />
      </button>
      <div className="sidebar-team">{team.name}</div>
      {roomCode && <div className="sidebar-room-code" title="Share this code so others can join this room">Room {roomCode}</div>}
      <nav className="sidebar-nav">
        {PRIMARY_NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={'sidebar-nav-item' + (overlay === item.key && !(item.key === 'team' && viewingOther) ? ' active' : '')}
            onClick={() => onNav(item.key)}
          >
            {item.label}{item.key === 'freeagency' && freeAgencyAlert && <span className="nav-badge-dot" />}
          </button>
        ))}
      </nav>
      <div className="sidebar-standings">
        <div className="sidebar-standings-heading">{seeded ? 'Live Standings' : 'Projected Output'}</div>
        <div className="sidebar-standings-row head">
          <span className="sidebar-standings-rank">{seeded ? 'Seed' : '#'}</span>
          <span className="sidebar-standings-tri">Team</span>
          <span className="sidebar-standings-val">{seeded ? 'Output' : 'Proj'}</span>
        </div>
        {standings.map(({ t, output }, i) => (
          <div
            key={t.id}
            className={'sidebar-standings-row' + (t.id === myTeamId ? ' you' : '') + (viewingOther && t.id === viewTeamId ? ' viewing' : '')}
            onClick={onViewTeam ? () => onViewTeam(t.id) : undefined}
            style={{ cursor: onViewTeam ? 'pointer' : undefined }}
          >
            <span className="sidebar-standings-rank">{seeded ? t.seed : i + 1}</span>
            <span className="sidebar-standings-tri">{t.tricode}</span>
            <span className="sidebar-standings-val">{output ? output.total.toFixed(2) : '—'}</span>
          </div>
        ))}
        <nav className="sidebar-nav sidebar-nav-secondary">
          {SUPPORT_NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={'sidebar-nav-item' + (overlay === item.key ? ' active' : '')}
              onClick={() => onNav(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
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
