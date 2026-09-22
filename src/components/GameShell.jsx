import { useEffect, useState } from 'react';
import Header from './Header';
import PersistentBar from './PersistentBar';
import Sidebar from './Sidebar';
import DesktopBar from './DesktopBar';
import { useIsDesktop } from '../hooks/useIsDesktop';
import GlossaryScreen from '../screens/GlossaryScreen';
import LeagueScreen from '../screens/LeagueScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CardOverviewScreen from '../screens/CardOverviewScreen';
import PullCardsScreen from '../screens/PullCardsScreen';
import DealScreen from '../screens/DealScreen';
import TeamSummaryScreen from '../screens/TeamSummaryScreen';
import PullModifierScreen from '../screens/PullModifierScreen';
import StandingsScreen from '../screens/StandingsScreen';
import PlayoffsScreen from '../screens/PlayoffsScreen';
import ResultsScreen from '../screens/ResultsScreen';
import SeasonRecapScreen from '../screens/SeasonRecapScreen';
import DraftScreen from '../screens/DraftScreen';
import EraEndScreen from '../screens/EraEndScreen';
import ConstructingScreen from '../screens/ConstructingScreen';
import SimulatingSeasonScreen from '../screens/SimulatingSeasonScreen';
import SeasonTransitionScreen from '../screens/SeasonTransitionScreen';
import ContractsScreen from '../screens/ContractsScreen';
import FreeAgencyScreen from '../screens/FreeAgencyScreen';
import FreeAgencyTicker from './FreeAgencyTicker';

const SCREENS = {
  cardoverview: CardOverviewScreen,
  pullcards: PullCardsScreen,
  pullhand: DealScreen,
  pullmodifier: PullModifierScreen,
  seasontransition: SeasonTransitionScreen,
  constructing: ConstructingScreen,
  teamsummary: TeamSummaryScreen,
  standings: StandingsScreen,
  playoffs: PlayoffsScreen,
  results: ResultsScreen,
  seasonrecap: SeasonRecapScreen,
  contracts: ContractsScreen,
  draft: DraftScreen,
  simulating: SimulatingSeasonScreen,
  era_end: EraEndScreen,
};

// The persistent bar is up from the very start of the onboarding sequence now — its slots
// read as empty (see PersistentBar/DesktopBar) until each card type is actually dealt, so the
// bar filling in phase by phase (hand, then front office, then matchup cards) IS the deal
// animation's payoff rather than something hidden until Team Summary. It's still hidden during
// the Simulating Season loading beat and the Season Recap screen — the roster the bar would
// show is about to be replaced by next season's, same full-screen treatment as Constructing.
const HIDE_BAR_PHASES = new Set(['simulating', 'seasonrecap', 'seasontransition']);

// Glossary/Standings/Settings/Team/Card Types are client-local overlays, not part of the shared game
// phase — a room's `state.phase` drives what everyone in the room sees, so if opening the
// Glossary changed it, one player checking a rule would yank every other player's screen
// to the Glossary too. Overlay state lives here instead and never touches Firestore.
//
// The game's *flow* (Hand -> Front Office -> Matchup Cards -> Team Summary ->
// Playoffs -> Results -> Contracts -> Draft -> Team) is identical on mobile and desktop — only the surrounding
// shell changes at the desktop breakpoint: a Sidebar + full-width persistent bar per the
// brand handoff, instead of the phone-width top bar + collapsed bottom bar. Same
// `overlay`/`Screen` resolution feeds both shells so the two never drift out of sync.
export default function GameShell({ state, actions, myTeamId, onNewEra }) {
  const [overlay, setOverlay] = useState(null); // null | 'glossary' | 'settings' | 'standings' | 'team' | 'freeagency' | 'cardtypes'
  // Clicking another team in Standings opens the Team overlay on THEIR file instead of the
  // caller's own (viewTeamId), remembering whatever overlay (or none, for a phase screen like
  // StandingsScreen) was showing so Back returns there rather than dumping out to the base game.
  const [viewTeamId, setViewTeamId] = useState(null);
  const [returnOverlay, setReturnOverlay] = useState(null);
  const toggleOverlay = (name) => setOverlay((o) => (o === name ? null : name));
  // Navigating to 'team' via the sidebar/header (as opposed to jumping in from Standings)
  // always means "show my own file" — reset any leftover viewTeamId from a prior jump.
  const handleNav = (name) => { if (name === 'team') setViewTeamId(null); toggleOverlay(name); };
  const isDesktop = useIsDesktop();

  // How many cards of the opening deal (hand, then Front Office, then Matchup Cards, in that
  // fixed order) have visibly landed so far — DealScreen counts these up as it deals, and
  // DesktopBar/PersistentBar slice their real slots down to this count while state.phase is
  // 'pullhand', so the persistent bar filling in slot by slot IS the deal animation's payoff
  // (see DesktopBar's own comment) rather than something that only snaps to full on Continue.
  const [dealProgress, setDealProgress] = useState(0);
  useEffect(() => { if (state.phase === 'pullhand') setDealProgress(0); }, [state.phase]);

  const openTeamView = (teamId, fromOverlay) => {
    setReturnOverlay(fromOverlay);
    setViewTeamId(teamId);
    setOverlay('team');
  };
  const closeTeamView = () => {
    setOverlay(returnOverlay);
    setReturnOverlay(null);
    setViewTeamId(null);
  };

  const headerProps = {
    state,
    myTeamId,
    overlay,
    onGlossary: () => toggleOverlay('glossary'),
    onStandings: () => toggleOverlay('standings'),
    onSettings: () => toggleOverlay('settings'),
    onTeam: () => handleNav('team'),
    onFreeAgency: () => toggleOverlay('freeagency'),
  };

  const showChrome = state.teams && state.teams.length > 0;
  const showBar = showChrome && !HIDE_BAR_PHASES.has(state.phase);

  const close = () => setOverlay(null);
  let overlayBody = null;
  if (overlay === 'glossary') overlayBody = <GlossaryScreen state={state} onBack={close} />;
  else if (overlay === 'settings') overlayBody = <SettingsScreen state={state} actions={actions} onBack={close} onNewEra={onNewEra} />;
  else if (overlay === 'standings') overlayBody = <LeagueScreen state={state} myTeamId={myTeamId} onBack={close} onViewTeam={(id) => openTeamView(id, 'standings')} />;
  else if (overlay === 'team') overlayBody = <TeamSummaryScreen state={state} actions={actions} myTeamId={myTeamId} viewTeamId={viewTeamId} onBack={closeTeamView} />;
  else if (overlay === 'freeagency') overlayBody = <FreeAgencyScreen state={state} actions={actions} myTeamId={myTeamId} onBack={close} />;
  else if (overlay === 'cardtypes') overlayBody = <CardOverviewScreen state={state} actions={actions} myTeamId={myTeamId} onBack={close} />;

  const Screen = SCREENS[state.phase];
  const mainBody = overlayBody || (Screen
    ? <Screen state={state} actions={actions} myTeamId={myTeamId} onViewTeam={(id) => openTeamView(id, null)} onEndGame={onNewEra} dealProgress={dealProgress} onDealProgress={setDealProgress} />
    : (
      <div className="screen">
        <h1>Something broke</h1>
        <p className="lede">Unknown phase: {state.phase}</p>
        <button className="secondary" style={{ width: '100%', marginTop: 14 }} onClick={onNewEra}>Reset Game</button>
      </div>
    ));

  if (isDesktop && showChrome) {
    return (
      <div className="desktop-shell">
        <Sidebar state={state} myTeamId={myTeamId} overlay={overlay} viewTeamId={viewTeamId} onNav={handleNav} onViewTeam={(id) => openTeamView(id, overlay)} />
        <div className="desktop-content">
          {mainBody}
        </div>
        <FreeAgencyTicker activity={state.freeAgencyActivity} withBar={showBar} />
        {showBar && <DesktopBar state={state} myTeamId={myTeamId} actions={actions} dealProgress={dealProgress} />}
      </div>
    );
  }

  return (
    <>
      {showChrome && <Header {...headerProps} />}
      {mainBody}
      {showChrome && <FreeAgencyTicker activity={state.freeAgencyActivity} withBar={showBar} />}
      {showBar && <PersistentBar state={state} myTeamId={myTeamId} onExpand={() => handleNav('team')} dealProgress={dealProgress} />}
    </>
  );
}
