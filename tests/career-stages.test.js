import test from 'node:test';
import assert from 'node:assert/strict';
import { CAREER_STAGES, CAREER_LEVELS, advanceCareer, careerBonus, careerLevel } from '../src/game/aging.js';
import { buildTeams, newEraState, initFrontOffice, initSeasonModifierCards } from '../src/game/season.js';
import { GM_TYPES } from '../src/game/constants.js';

test('five career stages have distinct output ranges and advance without numeric ages', () => {
  assert.deepEqual(CAREER_STAGES, ['Young', 'Established', 'Prime', 'Veteran', 'Declining']);
  const card = { careerStage: 'Young', stageYears: 1, careerRoll: 0.5 };
  assert.equal(careerBonus(card, card.careerRoll), 0.2);
  advanceCareer(card);
  assert.equal(card.careerStage, 'Established');
  assert.equal(card.stageYears, 0);
  assert.equal('age' in card, false);
  assert(CAREER_LEVELS.Prime.min > CAREER_LEVELS.Established.min);
  assert(CAREER_LEVELS.Declining.max < 0);
});

test('numeric age in an older save is read and converted when its season closes', () => {
  const card = { age: 34, careerRoll: 0.5 };
  assert.equal(careerLevel(card), 'Veteran');
  advanceCareer(card);
  assert.equal(card.careerStage, 'Veteran');
  assert.equal('age' in card, false);
});

test('front office deals GM types and a visible first-season fanbase modifier', () => {
  const state = newEraState();
  buildTeams(state, [{ name: 'Test', human: true }]);
  initFrontOffice(state);
  const team = state.teams[0];
  assert(GM_TYPES.includes(team.gmType));
  const firstMod = team.fanbaseMod;
  assert(firstMod?.name);
  initSeasonModifierCards(state);
  assert.deepEqual(team.fanbaseMod, firstMod);
});
