// Single source of truth for "action name -> mutator function" used by both useLocalGame
// (solo, in-memory) and useRoomGame (Firestore-backed). Every mutator has the same signature
// either way: (state, ...args) => result | undefined, mutating state in place.
import { newEraState, signFreeAgent, proceedFromResults, proceedFromSeasonRecap, proceedFromSeasonTransition, finishPlayoffs, fileContracts, renewExpiredContract } from './season';
import { draftPick, forfeitPick } from './draft';
import { fireCoach, fireGM, hireFreeAgentCoach, investInFanbase, releasePlayer } from './finances';
import * as engine from './engine';
import { beginTurn, advanceTurn } from './turn';
import { applyDevelopmentCard, playGameplanCard } from './strategyCards';

export const actionMap = {
  newEra: (state) => { Object.assign(state, newEraState()); },
  startEra: engine.startEra,
  proceedFromCardOverview: engine.proceedFromCardOverview,
  proceedToSeason1: engine.proceedToSeason1,
  pullMatchupCard: engine.pullMatchupCard,
  pullAllMatchupCards: engine.pullAllMatchupCards,
  proceedToLineupFromModifier: engine.proceedToLineupFromModifier,
  finishConstruction: engine.finishConstruction,
  finishSeasonSimulation: engine.finishSeasonSimulation,
  confirmLineup: engine.confirmLineup,
  markLineupSet: engine.markLineupSet,
  clearLineup: engine.clearLineup,
  swapStarter: engine.swapStarter,
  promoteToStarter: engine.promoteToStarter,
  demoteStarter: engine.demoteStarter,
  autoSetLineup: engine.autoSetLineup,
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
  draftPick,
  forfeitPick,
  signFreeAgent,
  proceedFromSeasonTransition,
  fireCoach,
  hireFreeAgentCoach,
  fireGM,
  investInFanbase,
  releasePlayer,
  applyDevelopmentCard,
  playGameplanCard,
};
