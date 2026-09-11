import { useCallback, useMemo, useReducer, useRef } from 'react';
import { newEraState } from './season';
import { actionMap } from './actionMap';

// Solo-mode game hook: holds a single mutable state object (mirrors the original `G`) in a
// ref, and forces a re-render after each action — same "mutate, then reveal" shape the
// multiplayer version uses, just with a local re-render standing in for a Firestore write.
// Solo mode always has exactly one human seat, at index 0.
export function useLocalGame() {
  const [, forceRender] = useReducer((x) => x + 1, 0);
  const stateRef = useRef(newEraState());

  const commit = useCallback(() => forceRender(), [forceRender]);

  const actions = useMemo(() => {
    const wrap = (fn) => (...args) => {
      const result = fn(stateRef.current, ...args);
      commit();
      return result;
    };
    return Object.fromEntries(Object.entries(actionMap).map(([name, fn]) => [name, wrap(fn)]));
  }, [commit]);

  return { state: stateRef.current, actions, myTeamId: 0 };
}
