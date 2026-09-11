import { useLocalGame } from './game/useLocalGame';
import Header from './components/Header';
import SetupScreen from './screens/SetupScreen';
import GlossaryScreen from './screens/GlossaryScreen';
import LeagueScreen from './screens/LeagueScreen';
import SettingsScreen from './screens/SettingsScreen';
import PullCardsScreen from './screens/PullCardsScreen';
import PullHandScreen from './screens/PullHandScreen';
import PullModifierScreen from './screens/PullModifierScreen';
import LineupScreen from './screens/LineupScreen';
import StandingsScreen from './screens/StandingsScreen';
import PlayoffsScreen from './screens/PlayoffsScreen';
import ResultsScreen from './screens/ResultsScreen';
import FreeAgencyScreen from './screens/FreeAgencyScreen';
import EraEndScreen from './screens/EraEndScreen';

const SCREENS = {
  pullcards: PullCardsScreen,
  pullhand: PullHandScreen,
  pullmodifier: PullModifierScreen,
  lineup: LineupScreen,
  standings: StandingsScreen,
  playoffs: PlayoffsScreen,
  results: ResultsScreen,
  freeagency: FreeAgencyScreen,
  era_end: EraEndScreen,
};

export default function App() {
  const { state, actions } = useLocalGame();
  const headerProps = {
    state,
    onGlossary: actions.openGlossary,
    onStandings: actions.openLeague,
    onSettings: actions.openSettings,
    onNewEra: actions.newEra,
  };

  if (state.phase === 'setup') return <SetupScreen actions={actions} />;

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
        <LeagueScreen state={state} actions={actions} />
      </>
    );
  }

  const Screen = SCREENS[state.phase];
  if (!Screen) {
    return (
      <div className="screen">
        <h1>Something broke</h1>
        <p className="lede">Unknown phase: {state.phase}</p>
        <button className="secondary" style={{ width: '100%', marginTop: 14 }} onClick={actions.newEra}>Start New Era</button>
      </div>
    );
  }

  return (
    <>
      <Header {...headerProps} />
      <Screen state={state} actions={actions} />
    </>
  );
}
