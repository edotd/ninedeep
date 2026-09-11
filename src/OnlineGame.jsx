import { useRoomGame } from './game/useRoomGame';
import LobbyScreen from './screens/LobbyScreen';
import GameShell from './components/GameShell';

export default function OnlineGame({ roomCode, myUid, onExit }) {
  const { state, actions, myTeamId } = useRoomGame(roomCode, myUid);

  if (!state) {
    return (
      <div className="screen">
        <h1>Connecting…</h1>
        <p className="lede">Joining room {roomCode}.</p>
      </div>
    );
  }

  if (state.phase === 'lobby') {
    return <LobbyScreen state={state} actions={actions} roomCode={roomCode} myUid={myUid} onExit={onExit} />;
  }

  return <GameShell state={state} actions={actions} myTeamId={myTeamId} onNewEra={() => actions.resetRoomToLobby(myUid)} />;
}
