import { useEffect, useMemo, useState } from 'react';
import { subscribeGameState, applyGameAction } from '../firebase/gameSync';
import { actionMap } from './actionMap';
import { claimSeat, leaveSeat, startEraOnline, resetRoomToLobby } from './lobby';

const lobbyActionMap = { claimSeat, leaveSeat, startEraOnline, resetRoomToLobby };

// Firestore-backed counterpart to useLocalGame — same actions object shape (plus a few
// lobby-only actions), so every screen written against useLocalGame works unmodified here.
// Instead of a local ref + forceRender, each action writes through a transaction and the
// onSnapshot listener is what actually updates `state` (and re-renders every viewer,
// including whoever just acted).
export function useRoomGame(roomCode, myUid) {
  const [state, setState] = useState(null);

  useEffect(() => {
    if (!roomCode) return;
    return subscribeGameState(roomCode, setState);
  }, [roomCode]);

  const actions = useMemo(() => {
    const wrap = (fn) => (...args) => applyGameAction(roomCode, fn, ...args).catch((err) => console.error('[nine-deep] action failed:', err));
    return {
      ...Object.fromEntries(Object.entries(actionMap).map(([name, fn]) => [name, wrap(fn)])),
      ...Object.fromEntries(Object.entries(lobbyActionMap).map(([name, fn]) => [name, wrap(fn)])),
    };
  }, [roomCode]);

  const myTeamId = state && state.teams ? (state.teams.find((t) => t.ownerUid === myUid)?.id ?? null) : null;

  return { state, actions, myTeamId };
}
