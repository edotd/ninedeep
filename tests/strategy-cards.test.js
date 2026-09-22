import test from 'node:test';
import assert from 'node:assert/strict';
import { dealStrategyCards, applyDevelopmentCard, playGameplanCard } from '../src/game/strategyCards.js';
import { rehydrateState } from '../src/game/rehydrate.js';

function fixture() {
  const player = { id: 'p1', stats: { SCO: 10, PLM: 10, REB: 10, DEF: 10 } };
  const team = { id: 0, hand: [player], developmentCards: [], gameplanCards: [] };
  const opponent = { id: 1, hand: [], developmentCards: [], gameplanCards: [] };
  return { state: { season: 1, phase: 'teamsummary', strategyCardCounter: 0, teams: [team, opponent] }, team, opponent, player };
}

test('coaches receive two to four Development cards and two Gameplan cards each season', () => {
  for (let i = 0; i < 30; i += 1) {
    const { state, team } = fixture();
    dealStrategyCards(state, team);
    assert(team.developmentCards.length >= 2 && team.developmentCards.length <= 4);
    assert.equal(team.gameplanCards.length, 2);
  }
});

test('a permanent Development card changes stats and a player can receive only one', () => {
  const { state, team, player } = fixture();
  team.developmentCards = [
    { id: 'd1', kind: 'development', name: 'Shooting Lab', description: '+2 SCO', statChanges: { SCO: 2 }, used: false },
    { id: 'd2', kind: 'development', name: 'Glass Work', description: '+2 REB', statChanges: { REB: 2 }, used: false },
  ];
  assert.equal(applyDevelopmentCard(state, 0, 'd1', 'p1').ok, true);
  assert.equal(player.stats.SCO, 12);
  assert.equal(applyDevelopmentCard(state, 0, 'd2', 'p1').ok, false);
  const saved = rehydrateState(JSON.parse(JSON.stringify(state)));
  assert.equal(saved.teams[0].hand[0].development.cardName, 'Shooting Lab');
  assert.deepEqual(saved.teams[0].hand[0].development.statChanges, { SCO: 2 });
});

test('Gameplan cards apply once to a team or opponent and old saves receive defaults', () => {
  const { state, team, opponent } = fixture();
  team.gameplanCards = [{ id: 'g1', kind: 'gameplan', name: 'Disrupt Rhythm', target: 'opponent', contexts: ['season', 'playoff'], effects: { offPercent: -6 }, used: false }];
  assert.equal(playGameplanCard(state, 0, 'g1', 'season', opponent.id).ok, true);
  assert.equal(opponent.seasonGameplanEffects.offPercent, -6);
  assert.equal(playGameplanCard(state, 0, 'g1', 'season', opponent.id).ok, false);
  const old = rehydrateState({ teams: [{ id: 0 }] });
  assert.deepEqual(old.teams[0].developmentCards, []);
  assert.equal(old.teams[0].seasonGameplanEffects.seedingPercent, 0);
});
