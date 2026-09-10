import { useLocalGame } from './game/useLocalGame';
import Header from './components/Header';
import SetupScreen from './screens/SetupScreen';
import GlossaryScreen from './screens/GlossaryScreen';
import PullCardsScreen from './screens/PullCardsScreen';
import PullModifierScreen from './screens/PullModifierScreen';
import LineupScreen from './screens/LineupScreen';
import StandingsScreen from './screens/StandingsScreen';
import PlayoffsScreen from './screens/PlayoffsScreen';
import ResultsScreen from './screens/ResultsScreen';
import FreeAgencyScreen from './screens/FreeAgencyScreen';
import EraEndScreen from './screens/EraEndScreen';

const SCREENS = {
  pullcards: PullCardsScreen,
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

  if (state.phase === 'setup') return <SetupScreen actions={actions} />;
  if (state.phase === 'glossary') {
    return (
      <>
        {state.teams && state.teams.length > 0 && <Header state={state} onGlossary={actions.openGlossary} onNewEra={actions.newEra} />}
        <GlossaryScreen actions={actions} />
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
      <Header state={state} onGlossary={actions.openGlossary} onNewEra={actions.newEra} />
      <Screen state={state} actions={actions} />
    </>
  );
}
