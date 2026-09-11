// Single source of truth for "action name -> mutator function" used by both useLocalGame
// (solo, in-memory) and useRoomGame (Firestore-backed). Every mutator has the same signature
// either way: (state, ...args) => result | undefined, mutating state in place.
import { newEraState, signFreeAgent, signReplacement, finishFreeAgency, proceedFromResults, finishPlayoffs } from './season';
import { draftPick, tradeDown } from './draft';
import * as engine from './engine';

export const actionMap = {
  newEra: (state) => { Object.assign(state, newEraState()); },
  startEra: engine.startEra,
  pullCoach: engine.pullCoach,
  pullFanbase: engine.pullFanbase,
  pullMarket: engine.pullMarket,
  proceedToSeason1: engine.proceedToSeason1,
  proceedFromHand: engine.proceedFromHand,
  pullMatchupCard: engine.pullMatchupCard,
  proceedToLineupFromModifier: engine.proceedToLineupFromModifier,
  toggleActive: engine.toggleActive,
  autoSetHuman: engine.autoSetHuman,
  confirmLineup: engine.confirmLineup,
  beginPlayoffs: engine.beginPlayoffs,
  toggleAdvantage: engine.toggleAdvantage,
  toggleCardPlay: engine.toggleCardPlay,
  toggleInjuryPrevention: engine.toggleInjuryPrevention,
  rollCurrentMatchup: engine.rollCurrentMatchup,
  openSeries: engine.openSeries,
  closeSeries: engine.closeSeries,
  finishPlayoffs,
  openGlossary: engine.openGlossary,
  closeGlossary: engine.closeGlossary,
  openLeague: engine.openLeague,
  closeLeague: engine.closeLeague,
  openSettings: engine.openSettings,
  closeSettings: engine.closeSettings,
  updateSettings: engine.updateSettings,
  proceedFromResults,
  draftPick,
  tradeDown,
  signFreeAgent,
  signReplacement,
  finishFreeAgency,
};
