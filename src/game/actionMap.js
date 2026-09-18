// Single source of truth for "action name -> mutator function" used by both useLocalGame
// (solo, in-memory) and useRoomGame (Firestore-backed). Every mutator has the same signature
// either way: (state, ...args) => result | undefined, mutating state in place.
import { newEraState, signFreeAgent, signReplacement, finishFreeAgency, proceedFromResults, proceedFromSeasonRecap, proceedFromSeasonTransition, finishPlayoffs, fileContracts, fileRoster, fileOffseasonLineup, renewExpiredContract } from './season';
import { draftPick, tradeDown } from './draft';
import { fireCoach, fireGM, investInFanbase, releasePlayer } from './finances';
import * as engine from './engine';
import { beginTurn, advanceTurn } from './turn';

export const actionMap = {
  newEra: (state) => { Object.assign(state, newEraState()); },
  startEra: engine.startEra,
  proceedFromCardOverview: engine.proceedFromCardOverview,
  proceedToSeason1: engine.proceedToSeason1,
  proceedFromHand: engine.proceedFromHand,
  pullMatchupCard: engine.pullMatchupCard,
  pullAllMatchupCards: engine.pullAllMatchupCards,
  proceedToLineupFromModifier: engine.proceedToLineupFromModifier,
  finishConstruction: engine.finishConstruction,
  finishSeasonSimulation: engine.finishSeasonSimulation,
  confirmLineup: engine.confirmLineup,
  swapStarter: engine.swapStarter,
  beginPlayoffs: engine.beginPlayoffs,
  toggleAdvantage: engine.toggleAdvantage,
  rollCurrentMatchup: engine.rollCurrentMatchup,
  simulateAllPlayoffs: engine.simulateAllPlayoffs,
  simulateOneMatch: engine.simulateOneMatch,
  beginTurn,
  advanceTurn,
  openSeries: engine.openSeries,
  closeSeries: engine.closeSeries,
  finishPlayoffs,
  updateSettings: engine.updateSettings,
  proceedFromResults,
  proceedFromSeasonRecap,
  fileContracts,
  renewExpiredContract,
  fileRoster,
  fileOffseasonLineup,
  draftPick,
  tradeDown,
  signFreeAgent,
  signReplacement,
  finishFreeAgency,
  proceedFromSeasonTransition,
  fireCoach,
  fireGM,
  investInFanbase,
  releasePlayer,
};
