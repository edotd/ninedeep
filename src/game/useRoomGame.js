import { useEffect, useMemo, useRef, useState } from 'react';
import { subscribeGameState, applyGameAction } from '../firebase/gameSync';
import { rehydrateState } from './rehydrate';
import { actionMap } from './actionMap';
import { claimSeat, leaveSeat, startEraOnline, resetRoomToLobby } from './lobby';

const lobbyActionMap = { claimSeat, leaveSeat, startEraOnline, resetRoomToLobby };

// Firestore-backed counterpart to useLocalGame — same actions object shape (plus a few
// lobby-only actions), so every screen written against useLocalGame works unmodified here.
// Each action applies optimistically to a local clone first (same mutator, same shape as
// solo mode) so the click feels instant, then writes through a Firestore transaction in the
// background; the onSnapshot listener's update (server truth, or another player's action)
// still wins whenever it arrives and replaces the optimistic guess.
export function useRoomGame(roomCode, myUid) {
  const [state, setState] = useState(null);
  const stateRef = useRef(null);

  useEffect(() => {
    if (!roomCode) return;
    return subscribeGameState(roomCode, (data) => {
      stateRef.current = data;
      setState(data);
    });
  }, [roomCode]);

  const actions = useMemo(() => {
    const wrap = (fn) => (...args) => {
      if (stateRef.current) {
        try {
          const optimistic = structuredClone(stateRef.current);
          rehydrateState(optimistic);
          fn(optimistic, ...args);
          stateRef.current = optimistic;
          setState(optimistic);
        } catch {
          // If the optimistic apply itself throws, skip it — the real transaction below is
          // still the source of truth and will correct the view once it resolves.
        }
      }
      return applyGameAction(roomCode, fn, ...args).catch((err) => console.error('[nine-deep] action failed:', err));
    };
    return {
      ...Object.fromEntries(Object.entries(actionMap).map(([name, fn]) => [name, wrap(fn)])),
      ...Object.fromEntries(Object.entries(lobbyActionMap).map(([name, fn]) => [name, wrap(fn)])),
    };
  }, [roomCode]);

  const myTeamId = state && state.teams ? (state.teams.find((t) => t.ownerUid === myUid)?.id ?? null) : null;

  return { state, actions, myTeamId };
}
