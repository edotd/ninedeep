import Header from './Header';
import GlossaryScreen from '../screens/GlossaryScreen';
import LeagueScreen from '../screens/LeagueScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PullCardsScreen from '../screens/PullCardsScreen';
import PullHandScreen from '../screens/PullHandScreen';
import PullModifierScreen from '../screens/PullModifierScreen';
import LineupScreen from '../screens/LineupScreen';
import StandingsScreen from '../screens/StandingsScreen';
import PlayoffsScreen from '../screens/PlayoffsScreen';
import ResultsScreen from '../screens/ResultsScreen';
import DraftScreen from '../screens/DraftScreen';
import FreeAgencyScreen from '../screens/FreeAgencyScreen';
import EraEndScreen from '../screens/EraEndScreen';

const SCREENS = {
  pullcards: PullCardsScreen,
  pullhand: PullHandScreen,
  pullmodifier: PullModifierScreen,
  lineup: LineupScreen,
  standings: StandingsScreen,
  playoffs: PlayoffsScreen,
  results: ResultsScreen,
  draft: DraftScreen,
  freeagency: FreeAgencyScreen,
  era_end: EraEndScreen,
};

// Renders everything from the Front Office pull through Era End — shared by solo play and
// an online room once its era is underway. `onNewEra` differs by mode (solo resets to the
// name-entry screen; an online room resets to its lobby, keeping seat claims).
export default function GameShell({ state, actions, myTeamId, onNewEra }) {
  const headerProps = {
    state,
    myTeamId,
    onGlossary: actions.openGlossary,
    onStandings: actions.openLeague,
    onSettings: actions.openSettings,
    onNewEra,
  };

  if (state.phase === 'glossary') {
    return (
      <>
        {state.teams && state.teams.length > 0 && <Header {...headerProps} />}
        <GlossaryScreen state={state} actions={actions} />
      </>
    );
  }

  if (state.phase === 'settings') {
    return (
      <>
        {state.teams && state.teams.length > 0 && <Header {...headerProps} />}
        <SettingsScreen state={state} actions={actions} />
      </>
    );
  }

  if (state.phase === 'league') {
    return (
      <>
        <Header {...headerProps} />
        <LeagueScreen state={state} actions={actions} myTeamId={myTeamId} />
      </>
    );
  }

  const Screen = SCREENS[state.phase];
  if (!Screen) {
    return (
      <div className="screen">
        <h1>Something broke</h1>
        <p className="lede">Unknown phase: {state.phase}</p>
        <button className="secondary" style={{ width: '100%', marginTop: 14 }} onClick={onNewEra}>Start New Era</button>
      </div>
    );
  }

  return (
    <>
      <Header {...headerProps} />
      <Screen state={state} actions={actions} myTeamId={myTeamId} />
    </>
  );
}
