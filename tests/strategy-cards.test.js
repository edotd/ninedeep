import test from 'node:test';
import assert from 'node:assert/strict';
import { dealStrategyCards, applyDevelopmentPoint, setCoachGameplan, gameplanEffects } from '../src/game/strategyCards.js';
import { rehydrateState } from '../src/game/rehydrate.js';

function fixture() {
  const player = { id: 'p1', stats: { SCO: 10, PLM: 10, REB: 10, DEF: 10 } };
  const team = { id: 0, hand: [player], activeIds: ['p1'], coach: { name: 'Coach', archetype: 'Offensive Minded' } };
  const opponent = { id: 1, hand: [], coach: { name: 'Other', archetype: 'Balanced' } };
  return { state: { season: 1, phase: 'teamsummary', strategyCardCounter: 0, teams: [team, opponent] }, team, opponent, player };
}

test('coaches receive two unique Gameplans and two Development Points each season', () => {
  for (let i = 0; i < 30; i += 1) {
    const { state, team } = fixture();
    dealStrategyCards(state, team);
    assert.equal(team.developmentPoints, 2);
    assert.equal(team.coach.gameplans.length, 2);
    assert.equal(new Set(team.coach.gameplans.map((plan) => plan.name)).size, 2);
    assert.equal(team.activeGameplanId, null);
    assert.deepEqual(team.developmentCards, []);
    assert.deepEqual(team.gameplanCards, []);
  }
});

test('Development Points permanently improve stats allowed by coaching style', () => {
  const { state, team, player } = fixture();
  team.developmentPoints = 2;
  assert.equal(applyDevelopmentPoint(state, 0, 'p1', 'SCO').ok, true);
  assert.equal(player.stats.SCO, 11);
  assert.equal(applyDevelopmentPoint(state, 0, 'p1', 'DEF').ok, false);
  assert.equal(applyDevelopmentPoint(state, 0, 'p1', 'PLM').ok, true);
  assert.equal(team.developmentPoints, 0);
  const saved = rehydrateState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(saved.teams[0].hand[0].development.statChanges, { SCO: 1, PLM: 1 });
});

test('one of the coach primary or secondary Gameplans can be selected', () => {
  const { state, team } = fixture();
  dealStrategyCards(state, team);
  const second = team.coach.gameplans[1];
  assert.equal(setCoachGameplan(state, 0, second.id).ok, true);
  assert.equal(team.activeGameplanId, second.id);
  assert.deepEqual(team.seasonGameplanEffects, { offPercent: gameplanEffects(team, second).offPercent || 0, defPercent: gameplanEffects(team, second).defPercent || 0, benchBonus: gameplanEffects(team, second).benchBonus || 0, seedingPercent: 0 });
});

test('position-based Gameplan cards resolve against the lineup at play time', () => {
  const { state, team } = fixture();
  team.hand = [
    { id: 'p1', position: 'Guard', stats: { SCO: 10, PLM: 10, REB: 10, DEF: 10 } },
    { id: 'p2', position: 'Guard', stats: { SCO: 10, PLM: 10, REB: 10, DEF: 10 } },
    { id: 'p3', position: 'Guard', stats: { SCO: 10, PLM: 10, REB: 10, DEF: 10 } },
    { id: 'p4', position: 'Forward', stats: { SCO: 10, PLM: 10, REB: 10, DEF: 10 } },
    { id: 'p5', position: 'Big', stats: { SCO: 10, PLM: 10, REB: 10, DEF: 10 } },
  ];
  team.activeIds = ['p1', 'p2', 'p3', 'p4', 'p5'];
  team.coach.gameplans = [{ id: 'g1', name: 'Three-Guard Attack', dynamicEffect: { type: 'positionCount', position: 'Guard', perCount: 5, ability: 'offense' } }, { id: 'spare-1', name: 'Spare', effects: {} }];
  assert.equal(setCoachGameplan(state, 0, 'g1').ok, true);
  assert.equal(team.seasonGameplanEffects.offPercent, 15);

  const { state: state2, team: team2 } = fixture();
  team2.hand = team.hand.map((p) => ({ ...p }));
  team2.activeIds = ['p1', 'p2', 'p3', 'p4', 'p5'];
  team2.coach.gameplans = [{ id: 'g2', name: 'Numbers Advantage', dynamicEffect: { type: 'positionThreshold', minCount: 3, bonusPercent: 12, ability: 'offense' } }, { id: 'spare-2', name: 'Spare', effects: {} }];
  assert.equal(setCoachGameplan(state2, 0, 'g2').ok, true);
  assert.equal(team2.seasonGameplanEffects.offPercent, 12);

  const { state: state3, team: team3 } = fixture();
  team3.hand = [
    { id: 'p1', position: 'Guard', stats: { SCO: 10, PLM: 10, REB: 10, DEF: 10 } },
    { id: 'p2', position: 'Forward', stats: { SCO: 10, PLM: 10, REB: 10, DEF: 10 } },
    { id: 'p3', position: 'Big', stats: { SCO: 10, PLM: 10, REB: 10, DEF: 10 } },
  ];
  team3.activeIds = ['p1', 'p2', 'p3'];
  team3.coach.gameplans = [{ id: 'g3', name: 'Numbers Advantage', dynamicEffect: { type: 'positionThreshold', minCount: 3, bonusPercent: 12, ability: 'offense' } }, { id: 'spare-3', name: 'Spare', effects: {} }];
  assert.equal(setCoachGameplan(state3, 0, 'g3').ok, true);
  assert.equal(team3.seasonGameplanEffects.offPercent, 0);
});
