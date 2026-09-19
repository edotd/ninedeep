import test from 'node:test';
import assert from 'node:assert/strict';
import { MATCHUP_MODIFIER_TYPES as deck } from '../src/game/supplementalCards.js';
import { drawMatchupModifierCard, resetMatchupDeck } from '../src/game/cards.js';
import { applySupplementalCard, supplementalRoll } from '../src/game/supplementalEffects.js';
import { newEraState, lockSeasonAndSeed, initSeasonModifierCards, startPlayoffs } from '../src/game/season.js';
import { startEra, proceedFromCardOverview, proceedFromHand, proceedToSeason1, rollCurrentMatchup } from '../src/game/engine.js';
import { beginTurn, advanceTurn } from '../src/game/turn.js';
import { rehydrateState } from '../src/game/rehydrate.js';
const card = (name) => ({ ...deck.find((c) => c.name === name), id: name, used: false });
function game() {
  const state = newEraState();
  startEra(state, 'Test'); proceedFromCardOverview(state); proceedFromHand(state); proceedToSeason1(state);
  state.settings.injuryChance = 0;
  state.teams.forEach((t) => { t.fanbaseMod = null; });
  return state;
}
const extra = () => ({ offDelta: 0, defDelta: 0, leagueMod: 0 });

test('97 unique fixed definitions, three Legendaries, no replacement across serialized draws', () => {
  assert.equal(deck.length, 97); assert.equal(new Set(deck.map(c => c.name)).size, 97);
  assert.equal(deck.filter(c => c.rarity === 'Legendary').length, 3);
  assert(deck.filter(c => c.passive === 'seeding').every(c => c.value > 0));
  let state = {}; const drawn = [];
  for (let i = 0; i < 97; i++) { drawn.push(drawMatchupModifierCard(state)); state = JSON.parse(JSON.stringify(state)); }
  assert.equal(new Set(drawn.map(c => c.definitionId)).size, 97);
  assert.equal(drawMatchupModifierCard(state), null);
  assert.equal(drawn.find(c => c.name === 'Biased Officiating').value, 3);
  assert.equal(drawn.find(c => c.name === 'Focused Film Session').value, 10);
  resetMatchupDeck(state); assert.equal(state.matchupDeck.length, 97);
});

test('every playable definition resolves and consumes once without mutating roster stats', () => {
  for (const definition of deck.filter(c => c.playable)) {
    const state = game(); const [a,b] = state.teams; const c = card(definition.name);
    if (c.maxSalary != null) a.hand.find(p => p.id === a.activeIds[0]).salary = 1;
    a.matchupCards = [c]; b.matchupCards = [card('Friendly Bounce')];
    const before = JSON.stringify([a.hand,b.hand]); const ea = extra(), eb = extra();
    assert(applySupplementalCard(state,a,b,c,ea,eb,a.activeIds,b.activeIds,null,'SCO','offense'), c.name);
    assert(c.used); assert.equal(JSON.stringify([a.hand,b.hand]), before);
    assert.equal(applySupplementalCard(state,a,b,c,ea,eb,a.activeIds,b.activeIds,null), null);
    for (const [team, effects] of [[a,ea],[b,eb]]) assert(Number.isFinite(supplementalRoll(team,team.activeIds,effects,'offense',2,5).total));
  }
});

test('dice, percentages, advantage and disadvantage have exact scoring semantics', () => {
  const state=game(), [a,b]=state.teams, ea=extra(), eb=extra();
  const base = supplementalRoll(a,a.activeIds,ea,'offense',2,5);
  applySupplementalCard(state,a,b,card('Biased Officiating'),ea,eb,a.activeIds,b.activeIds);
  assert.equal(supplementalRoll(a,a.activeIds,ea,'offense',2,5).die,5);
  applySupplementalCard(state,a,b,card('Focused Film Session'),ea,eb,a.activeIds,b.activeIds);
  assert.equal(supplementalRoll(a,a.activeIds,ea,'offense',2,5).mod, Math.round(base.mod*1.1*100)/100);
  ea.cardAdvantage=true; assert.equal(supplementalRoll(a,a.activeIds,ea,'defense',2,5).die,5);
  ea.cardDisadvantage=true; assert.equal(supplementalRoll(a,a.activeIds,ea,'defense',2,5).die,2);
  ea.cardAdvantage=false; assert.equal(supplementalRoll(a,a.activeIds,ea,'defense',5,2).die,2);
});

test('player targets validated; stat changes remain temporary and cover all four stats', () => {
  const state=game(), [a,b]=state.teams;
  for (const stat of ['SCO','PLM','REB','DEF']) {
    const c=card('Legacy Performance'), ea=extra();
    assert.equal(applySupplementalCard(state,a,b,c,ea,extra(),a.activeIds,b.activeIds,'invalid',stat),null);
    assert.equal(c.used,false);
    assert(applySupplementalCard(state,a,b,c,ea,extra(),a.activeIds,b.activeIds,a.activeIds[0],stat));
    assert.deepEqual(ea.statChanges,[{playerId:a.activeIds[0],stat,value:4}]);
  }
});

test('three cards per team; seeding cards consumed; disabling cards clears hands', () => {
  const state=game(); assert(state.teams.every(t=>t.matchupCards.length===3));
  state.teams[0].matchupCards=[card('Strong Finish'),card('Historic Regular Season')];
  lockSeasonAndSeed(state); assert(state.teams[0].matchupCards.every(c=>c.used));
  state.settings.matchupCardsEnabled=false; initSeasonModifierCards(state);
  assert(state.teams.every(t=>t.matchupCards.length===0)); assert.equal(state.phase,'constructing');
});

test('extra draw excludes expired seeding cards; discard consumes opponent card; exhausted deck safe', () => {
  const state=game(), [a,b]=state.teams;
  state.matchupDeck=[card('Strong Finish').definitionId,card('Biased Officiating').definitionId];
  a.matchupCards=[]; b.matchupCards=[card('Home Court')];
  applySupplementalCard(state,a,b,card('Advance Scout'),extra(),extra(),a.activeIds,b.activeIds);
  assert.equal(a.matchupCards[0].name,'Biased Officiating');
  applySupplementalCard(state,a,b,card('Limited Film'),extra(),extra(),a.activeIds,b.activeIds);
  assert(b.matchupCards[0].used);
  applySupplementalCard(state,a,b,card('Extra Preparation'),extra(),extra(),a.activeIds,b.activeIds);
  assert.equal(a.matchupCards.length,1);
});

test('a card played during defense\'s blind window still cuts that same exchange\'s offense roll, and state survives JSON sync', () => {
  let state=game(); lockSeasonAndSeed(state); startPlayoffs(state); state.playoff.activeMatchIndex=0;
  let m=state.playoff.matches[0]; m.a.matchupCards=[];m.b.matchupCards=[];m.a.human=true;m.b.human=true;
  beginTurn(state); advanceTurn(state); advanceTurn(state); // flips coin, then opens Exchange 1's blind card window
  state=rehydrateState(JSON.parse(JSON.stringify(state))); m=state.playoff.matches[0];
  const offenseTeam = m.turn.offenseSide==='a' ? m.a : m.b;
  const defenseTeam = m.turn.defenseSide==='a' ? m.a : m.b;
  defenseTeam.matchupCards=[card('Scouted Tendencies')];
  const baselineMod = supplementalRoll(offenseTeam, offenseTeam.activeIds, extra(), 'offense', 1, 1).mod;
  advanceTurn(state,{pass:true}); // offense passes blind
  state=rehydrateState(JSON.parse(JSON.stringify(state))); m=state.playoff.matches[0];
  advanceTurn(state,{cardId:'Scouted Tendencies'}); // defense plays it blind, resolving the exchange
  state=rehydrateState(JSON.parse(JSON.stringify(state))); m=state.playoff.matches[0];
  assert.equal(m.turn.stage,'resolved');
  const offSide = m.turn.offenseSide;
  assert(m.turn[`${offSide}OffMod`] < baselineMod);
  assert(m.turn.cardNotes.some(n=>n.cardName==='Scouted Tendencies'));
});

test('instant simulation executes new effects and finishes', () => {
  const state=game(); lockSeasonAndSeed(state);startPlayoffs(state);state.playoff.activeMatchIndex=0;
  const m=state.playoff.matches[0];m.a.human=false;m.b.human=false;
  m.a.matchupCards=[card('Biased Officiating')];m.b.matchupCards=[card('Back-to-Back')];
  rollCurrentMatchup(state);
  assert(m.result.winner);assert.equal(m.result.aExtra.offDice,3);assert(m.result.aExtra.cardDisadvantage);
  assert.equal(m.result.cardNotes.length,2);
});

test('cap hit preserves fractions for every chosen stat without changing salary or permanent stats', () => {
  const state=game(), [a,b]=state.teams;
  const starter=a.hand.find(p=>p.id===a.activeIds[0]); starter.salary=3.5;
  const before=JSON.stringify(a.hand);
  for (const stat of ['SCO','PLM','REB','DEF']) {
    const c=card('Earn Your Contract'), effects=extra();
    assert(applySupplementalCard(state,a,b,c,effects,extra(),a.activeIds,b.activeIds,starter.id,stat));
    assert.deepEqual(effects.statChanges,[{playerId:starter.id,stat,value:3.5}]);
    assert.equal(JSON.stringify(a.hand),before);
    const restored=JSON.parse(JSON.stringify(effects));
    assert.equal(restored.statChanges[0].value,3.5);
    const expected={...a,hand:a.hand.map(p=>p.id===starter.id?{...p,stats:{...p.stats,[stat]:p.stats[stat]+3.5}}:p)};
    for (const kind of ['offense','defense']) assert.deepEqual(
      supplementalRoll(a,a.activeIds,restored,kind,3,4),
      supplementalRoll(expected,a.activeIds,extra(),kind,3,4));
  }
  starter.salary=0;
  const effects=extra();
  assert(applySupplementalCard(state,a,b,card('Earn Your Contract'),effects,extra(),a.activeIds,b.activeIds,starter.id));
  assert.equal(effects.statChanges[0].value,0);
});

test('position effects count only matchup starters and stack with flat bonuses', () => {
  const state=game(), [a,b]=state.teams;
  const starters=a.activeIds.map(id=>a.hand.find(p=>p.id===id));
  ['Guard','Guard','Guard','Forward','Big'].forEach((pos,i)=>{starters[i].position=pos;});
  a.hand.filter(p=>!a.activeIds.includes(p.id)).forEach(p=>{p.position='Guard';});
  for (const [name,key,expected] of [
    ['Three-Guard Attack','offPercent',15],['Switchable Wings','defPercent',5],
    ['Own the Paint','defPercent',5],['Interior Pressure','offPercent',5],
    ['Positionless Basketball','offPercent',10],
  ]) {
    const effects=extra();
    applySupplementalCard(state,a,b,card(name),effects,extra(),a.activeIds,b.activeIds);
    assert.equal(effects[key],expected,name);
  }
  const effects=extra();
  applySupplementalCard(state,a,b,card('Three-Guard Attack'),effects,extra(),a.activeIds,b.activeIds);
  applySupplementalCard(state,a,b,card('Focused Film Session'),effects,extra(),a.activeIds,b.activeIds);
  assert.equal(effects.offPercent,25);
  const fewer=a.activeIds.slice(0,4), missing=extra();
  applySupplementalCard(state,a,b,card('Positionless Basketball'),missing,extra(),fewer,b.activeIds);
  assert.equal(missing.offPercent,0);
  const noGuards=extra();
  applySupplementalCard(state,a,b,card('Three-Guard Attack'),noGuards,extra(),a.activeIds.slice(3),b.activeIds);
  assert.equal(noGuards.offPercent,0);
});

test('Bargain Production rejects expensive starters and bench players; AI finds eligible starter', () => {
  const state=game(), [a,b]=state.teams;
  a.hand.forEach(p=>{p.salary=3.5;});
  const cheap=a.hand.find(p=>p.id===a.activeIds[1]);cheap.salary=1;
  const c=card('Bargain Production'),effects=extra();
  assert.equal(applySupplementalCard(state,a,b,c,effects,extra(),a.activeIds,b.activeIds,a.activeIds[0]),null);
  assert.equal(c.used,false);
  const bench=a.hand.find(p=>!a.activeIds.includes(p.id));bench.salary=0;
  assert.equal(applySupplementalCard(state,a,b,c,effects,extra(),a.activeIds,b.activeIds,bench.id),null);
  assert(applySupplementalCard(state,a,b,c,effects,extra(),a.activeIds,b.activeIds,null,'REB'));
  assert.deepEqual(effects.statChanges,[{playerId:cheap.id,stat:'REB',value:2}]);
});
