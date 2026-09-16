import { useEffect, useState } from 'react';
import GameShell from './components/GameShell';
import OnlineGame from './OnlineGame';
import EntryScreen from './screens/EntryScreen';
import { useLocalGame } from './game/useLocalGame';
import { DarkModeProvider } from './hooks/useDarkMode';

function AppInner() {
  const [mode, setMode] = useState(null); // null | 'solo' | { roomCode, uid }
  const [pendingJoinCode, setPendingJoinCode] = useState('');
  // Instantiated unconditionally (cheap — newEraState() just seeds defaults, no star pool
  // built yet) so EntryScreen's Solo tab can drive the same state/actions straight through
  // actions.startEra — no separate SetupScreen step, and no second game-state object to
  // reconcile once `mode` flips to 'solo'.
  const localGame = useLocalGame();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) setPendingJoinCode(room.toUpperCase());
  }, []);

  if (mode === 'solo') {
    return <GameShell state={localGame.state} actions={localGame.actions} myTeamId={localGame.myTeamId} onNewEra={localGame.actions.newEra} />;
  }
  if (mode && mode.roomCode) {
    return <OnlineGame roomCode={mode.roomCode} myUid={mode.uid} onExit={() => setMode(null)} />;
  }

  return (
    <EntryScreen
      pendingJoinCode={pendingJoinCode}
      soloState={localGame.state}
      soloActions={localGame.actions}
      onStartSolo={() => setMode('solo')}
      onEnterRoom={(roomCode, uid) => setMode({ roomCode, uid })}
    />
  );
}

export default function App() {
  return (
    <DarkModeProvider>
      <AppInner />
    </DarkModeProvider>
  );
}
