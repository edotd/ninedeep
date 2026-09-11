import { useCallback, useMemo, useReducer, useRef } from 'react';
import { newEraState, signFreeAgent, signReplacement, finishFreeAgency, proceedFromResults } from './season';
import { draftPick, tradeDown } from './draft';
import * as engine from './engine';

// Solo-mode game hook: holds a single mutable state object (mirrors the original `G`) in a
// ref, and forces a re-render after each action — same "mutate, then reveal" shape the
// multiplayer version will use, just with a Firestore write standing in for forceRender().
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
    return {
      newEra: wrap((state) => { Object.assign(state, newEraState()); }),
      startEra: wrap(engine.startEra),
      pullCoach: wrap(engine.pullCoach),
      pullFanbase: wrap(engine.pullFanbase),
      pullMarket: wrap(engine.pullMarket),
      proceedToSeason1: wrap(engine.proceedToSeason1),
      proceedFromHand: wrap(engine.proceedFromHand),
      pullMatchupCard: wrap(engine.pullMatchupCard),
      proceedToLineupFromModifier: wrap(engine.proceedToLineupFromModifier),
      toggleActive: wrap(engine.toggleActive),
      autoSetHuman: wrap(engine.autoSetHuman),
      confirmLineup: wrap(engine.confirmLineup),
      beginPlayoffs: wrap(engine.beginPlayoffs),
      toggleAdvantage: wrap(engine.toggleAdvantage),
      toggleCardPlay: wrap(engine.toggleCardPlay),
      toggleInjuryPrevention: wrap(engine.toggleInjuryPrevention),
      rollCurrentMatchup: wrap(engine.rollCurrentMatchup),
      advancePlayoff: wrap(engine.advancePlayoff),
      openGlossary: wrap(engine.openGlossary),
      closeGlossary: wrap(engine.closeGlossary),
      openLeague: wrap(engine.openLeague),
      closeLeague: wrap(engine.closeLeague),
      openSettings: wrap(engine.openSettings),
      closeSettings: wrap(engine.closeSettings),
      updateSettings: wrap(engine.updateSettings),
      proceedFromResults: wrap(proceedFromResults),
      draftPick: wrap(draftPick),
      tradeDown: wrap(tradeDown),
      signFreeAgent: wrap((state, cardId) => signFreeAgent(state, cardId, 0)),
      signReplacement: wrap((state) => signReplacement(state, 0)),
      finishFreeAgency: wrap(finishFreeAgency),
    };
  }, [commit]);

  return { state: stateRef.current, actions };
}
