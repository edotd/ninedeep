import { useLocalGame } from './game/useLocalGame';
import SetupScreen from './screens/SetupScreen';
import GameShell from './components/GameShell';

export default function SoloGame() {
  const { state, actions, myTeamId } = useLocalGame();

  if (state.phase === 'setup') return <SetupScreen actions={actions} />;

  return <GameShell state={state} actions={actions} myTeamId={myTeamId} onNewEra={actions.newEra} />;
}
