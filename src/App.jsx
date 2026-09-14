import { useEffect, useState } from 'react';
import SoloGame from './SoloGame';
import OnlineGame from './OnlineGame';
import LandingScreen from './screens/LandingScreen';
import { DarkModeProvider } from './hooks/useDarkMode';

function AppInner() {
  const [mode, setMode] = useState(null); // null | 'solo' | { roomCode, uid }
  const [pendingJoinCode, setPendingJoinCode] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) setPendingJoinCode(room.toUpperCase());
  }, []);

  if (mode === 'solo') return <SoloGame />;
  if (mode && mode.roomCode) {
    return <OnlineGame roomCode={mode.roomCode} myUid={mode.uid} onExit={() => setMode(null)} />;
  }

  return (
    <LandingScreen
      pendingJoinCode={pendingJoinCode}
      onSolo={() => setMode('solo')}
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
