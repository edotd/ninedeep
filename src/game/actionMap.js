// Single source of truth for "action name -> mutator function" used by both useLocalGame
// (solo, in-memory) and useRoomGame (Firestore-backed). Every mutator has the same signature
// either way: (state, ...args) => result | undefined, mutating state in place.
import { newEraState, signFreeAgent, signReplacement, finishFreeAgency, proceedFromResults, proceedFromSeasonRecap, finishPlayoffs } from './season';
import { draftPick, tradeDown } from './draft';
import { fireCoach, relocateMarket, investInFanbase } from './finances';
import * as engine from './engine';
import { beginTurn, advanceTurn } from './turn';

export const actionMap = {
  newEra: (state) => { Object.assign(state, newEraState()); },
  startEra: engine.startEra,
  proceedFromCardOverview: engine.proceedFromCardOverview,
  pullCoach: engine.pullCoach,
  pullFanbase: engine.pullFanbase,
  pullMarket: engine.pullMarket,
  pullFrontOffice: engine.pullFrontOffice,
  proceedToSeason1: engine.proceedToSeason1,
  proceedFromHand: engine.proceedFromHand,
  pullMatchupCard: engine.pullMatchupCard,
  pullAllMatchupCards: engine.pullAllMatchupCards,
  proceedToLineupFromModifier: engine.proceedToLineupFromModifier,
  finishConstruction: engine.finishConstruction,
  finishSeasonSimulation: engine.finishSeasonSimulation,
  confirmLineup: engine.confirmLineup,
  beginPlayoffs: engine.beginPlayoffs,
  toggleAdvantage: engine.toggleAdvantage,
  rollCurrentMatchup: engine.rollCurrentMatchup,
  simulateAllPlayoffs: engine.simulateAllPlayoffs,
  beginTurn,
  advanceTurn,
  openSeries: engine.openSeries,
  closeSeries: engine.closeSeries,
  finishPlayoffs,
  updateSettings: engine.updateSettings,
  proceedFromResults,
  proceedFromSeasonRecap,
  draftPick,
  tradeDown,
  signFreeAgent,
  signReplacement,
  finishFreeAgency,
  fireCoach,
  relocateMarket,
  investInFanbase,
};
