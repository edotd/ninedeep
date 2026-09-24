import { useRoomGame } from './game/useRoomGame';
import LobbyScreen from './screens/LobbyScreen';
import GameShell from './components/GameShell';

export default function OnlineGame({ roomCode, myUid, onExit }) {
  const { state, actions, myTeamId, actionError } = useRoomGame(roomCode, myUid);

  if (!state) {
    return (
      <div className="screen">
        <h1>Connecting…</h1>
        <p className="lede">Joining room {roomCode}.</p>
      </div>
    );
  }

  if (state.phase === 'lobby') {
    return <LobbyScreen state={state} actions={actions} roomCode={roomCode} myUid={myUid} onExit={onExit} actionError={actionError} />;
  }

  // The era already started without you (joined late, or your seat was reassigned) —
  // there's nothing for you to control here, so say so instead of crashing on a missing team.
  if (myTeamId === null) {
    return (
      <div className="screen">
        {onExit && <button className="reset-link" style={{ marginBottom: 12 }} onClick={onExit}>← Leave</button>}
        <h1>No Seat in This Room</h1>
        <p className="lede">This era is already underway and you don't hold a seat in it. Ask the host to start a new era from the lobby, or check the room code.</p>
      </div>
    );
  }

  return <GameShell state={state} actions={actions} myTeamId={myTeamId} roomCode={roomCode} onNewEra={() => actions.resetRoomToLobby(myUid)} />;
}
