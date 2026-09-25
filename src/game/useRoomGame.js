import { useEffect, useMemo, useRef, useState } from 'react';
import { subscribeGameState, applyGameAction } from '../firebase/gameSync';
import { rehydrateState } from './rehydrate';
import { actionMap } from './actionMap';
import { claimSeat, leaveSeat, startEraOnline, resetRoomToLobby } from './lobby';

const lobbyActionMap = { claimSeat, leaveSeat, startEraOnline, resetRoomToLobby };
// These actions change the shared screen or resolve shared results. Applying them optimistically
// can let an older Firestore snapshot briefly restore the previous phase, remounting a loading
// transition or series screen. Wait for the ordered server snapshot for these actions instead.
const NON_OPTIMISTIC_ACTIONS = new Set([
  'confirmLineup', 'finishConstruction', 'finishSeasonSimulation', 'finishDraftTransition', 'openSeries', 'closeSeries',
  'beginTurn', 'simulateOneMatch', 'simulateAllPlayoffs', 'beginPlayoffs', 'finishPlayoffs',
  // Each of these rolls dice (or can resolve someone else's dangling bid) inside the mutator
  // itself — an optimistic local roll would show a result the real transaction's own roll can
  // then silently overwrite. See rng.js's header comment on single-resolver-path rolls.
  'submitNegotiationOffer', 'openFreeAgentBid', 'raiseFreeAgentBid', 'standPatFreeAgentBid', 'closeFreeAgency',
]);

// Firestore-backed counterpart to useLocalGame — same actions object shape (plus a few
// lobby-only actions), so every screen written against useLocalGame works unmodified here.
// Each action applies optimistically to a local clone first (same mutator, same shape as
// solo mode) so the click feels instant, then writes through a Firestore transaction in the
// background; the onSnapshot listener's update (server truth, or another player's action)
// still wins whenever it arrives and replaces the optimistic guess.
export function useRoomGame(roomCode, myUid) {
  const [state, setState] = useState(null);
  const stateRef = useRef(null);
  // Surfaced so the UI can actually tell a player their click didn't land — the optimistic
  // apply below makes every action look instantly successful even when the real Firestore
  // transaction behind it later fails (a stale/racing auth token, a dropped connection on a
  // phone's network), so without this the failure is invisible outside the console.
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    if (!roomCode) return;
    return subscribeGameState(roomCode, (data) => {
      stateRef.current = data;
      setState(data);
    });
  }, [roomCode]);

  const actions = useMemo(() => {
    const wrap = (name, fn) => (...args) => {
      setActionError(null);
      if (stateRef.current && !NON_OPTIMISTIC_ACTIONS.has(name)) {
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
      return applyGameAction(roomCode, fn, ...args).catch((err) => {
        console.error('[nine-deep] action failed:', err);
        // The next real snapshot (or the retry this prompts) replaces this optimistic guess,
        // but until then the local view still shows the action as having worked — flag it so
        // the screen can tell the player to retry instead of silently doing nothing.
        setActionError('That didn\'t save — check your connection and try again.');
      });
    };
    return {
      ...Object.fromEntries(Object.entries(actionMap).map(([name, fn]) => [name, wrap(name, fn)])),
      ...Object.fromEntries(Object.entries(lobbyActionMap).map(([name, fn]) => [name, wrap(name, fn)])),
    };
  }, [roomCode]);

  const myTeamId = state && state.teams ? (state.teams.find((t) => t.ownerUid === myUid)?.id ?? null) : null;

  return { state, actions, myTeamId, actionError };
}
