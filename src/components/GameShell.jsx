import { useState } from 'react';
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
import PullHandScreen from '../screens/PullHandScreen';
import TeamSummaryScreen from '../screens/TeamSummaryScreen';
import PullModifierScreen from '../screens/PullModifierScreen';
import StandingsScreen from '../screens/StandingsScreen';
import PlayoffsScreen from '../screens/PlayoffsScreen';
import ResultsScreen from '../screens/ResultsScreen';
import SeasonRecapScreen from '../screens/SeasonRecapScreen';
import DraftScreen from '../screens/DraftScreen';
import FreeAgencyScreen from '../screens/FreeAgencyScreen';
import EraEndScreen from '../screens/EraEndScreen';
import ConstructingScreen from '../screens/ConstructingScreen';
import SimulatingSeasonScreen from '../screens/SimulatingSeasonScreen';
import SeasonTransitionScreen from '../screens/SeasonTransitionScreen';
import ContractsScreen from '../screens/ContractsScreen';
import RosterFilingScreen from '../screens/RosterFilingScreen';
import OffseasonLineupScreen from '../screens/OffseasonLineupScreen';

const SCREENS = {
  cardoverview: CardOverviewScreen,
  pullcards: PullCardsScreen,
  pullhand: PullHandScreen,
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
  freeagency: FreeAgencyScreen,
  roster: RosterFilingScreen,
  offseasonlineup: OffseasonLineupScreen,
  simulating: SimulatingSeasonScreen,
  era_end: EraEndScreen,
};

// The persistent bar is up from the very start of the onboarding sequence now — its slots
// read as empty (see PersistentBar/DesktopBar) until each card type is actually dealt, so the
// bar filling in phase by phase (hand, then front office, then matchup cards) IS the deal
// animation's payoff rather than something hidden until Team Summary. It's still hidden during
// the Simulating Season loading beat and the Season Recap screen — the roster the bar would
// show is about to be replaced by next season's, same full-screen treatment as Constructing.
const HIDE_BAR_PHASES = new Set(['simulating', 'seasonrecap', 'seasontransition', 'contracts', 'draft', 'freeagency', 'roster', 'offseasonlineup']);

// Glossary/Standings/Settings/Team are client-local overlays, not part of the shared game
// phase — a room's `state.phase` drives what everyone in the room sees, so if opening the
// Glossary changed it, one player checking a rule would yank every other player's screen
// to the Glossary too. Overlay state lives here instead and never touches Firestore.
//
// The game's *flow* (Card Overview -> Hand -> Front Office -> Matchup Cards -> Team Summary ->
// Playoffs -> Results -> Draft -> Free Agency) is identical on mobile and desktop — only the surrounding
// shell changes at the desktop breakpoint: a Sidebar + full-width persistent bar per the
// brand handoff, instead of the phone-width top bar + collapsed bottom bar. Same
// `overlay`/`Screen` resolution feeds both shells so the two never drift out of sync.
export default function GameShell({ state, actions, myTeamId, onNewEra }) {
  const [overlay, setOverlay] = useState(null); // null | 'glossary' | 'settings' | 'standings' | 'team'
  const toggleOverlay = (name) => setOverlay((o) => (o === name ? null : name));
  const isDesktop = useIsDesktop();

  const headerProps = {
    state,
    myTeamId,
    overlay,
    onGlossary: () => toggleOverlay('glossary'),
    onStandings: () => toggleOverlay('standings'),
    onSettings: () => toggleOverlay('settings'),
    onTeam: () => toggleOverlay('team'),
  };

  const showChrome = state.teams && state.teams.length > 0;
  const showBar = showChrome && !HIDE_BAR_PHASES.has(state.phase);

  const close = () => setOverlay(null);
  let overlayBody = null;
  if (overlay === 'glossary') overlayBody = <GlossaryScreen state={state} onBack={close} />;
  else if (overlay === 'settings') overlayBody = <SettingsScreen state={state} actions={actions} onBack={close} onNewEra={onNewEra} />;
  else if (overlay === 'standings') overlayBody = <LeagueScreen state={state} myTeamId={myTeamId} onBack={close} />;
  else if (overlay === 'team') overlayBody = <TeamSummaryScreen state={state} actions={actions} myTeamId={myTeamId} onBack={close} />;

  const Screen = SCREENS[state.phase];
  const mainBody = overlayBody || (Screen
    ? <Screen state={state} actions={actions} myTeamId={myTeamId} />
    : (
      <div className="screen">
        <h1>Something broke</h1>
        <p className="lede">Unknown phase: {state.phase}</p>
        <button className="secondary" style={{ width: '100%', marginTop: 14 }} onClick={onNewEra}>Start New Era</button>
      </div>
    ));

  if (isDesktop && showChrome) {
    return (
      <div className="desktop-shell">
        <Sidebar state={state} myTeamId={myTeamId} overlay={overlay} onNav={toggleOverlay} />
        <div className="desktop-content">
          {mainBody}
        </div>
        {showBar && <DesktopBar state={state} myTeamId={myTeamId} actions={actions} />}
      </div>
    );
  }

  return (
    <>
      {showChrome && <Header {...headerProps} />}
      {mainBody}
      {showBar && <PersistentBar state={state} myTeamId={myTeamId} onExpand={() => toggleOverlay('team')} />}
    </>
  );
}
