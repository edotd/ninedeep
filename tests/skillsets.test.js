import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILLSETS, SKILLSET_PAIRS, rollSkillset, teamSynergy } from '../src/game/skillsets.js';
import { makeCard, drawCoachCard, drawMatchupModifierCard } from '../src/game/cards.js';
import { REPLACEMENT_TIER } from '../src/game/constants.js';
import { offenseModifier, defenseModifier } from '../src/game/roster.js';
import { playMatchup, teamOutput, simulateSeasonOutput } from '../src/game/matchup.js';
import { beginTurn, advanceTurn } from '../src/game/turn.js';
import { swapStarter } from '../src/game/engine.js';
import { rehydrateState } from '../src/game/rehydrate.js';
const sid = (n) => `skill-${String(n).padStart(2,'0')}`;
function team(numbers) {
  return {id:0,name:'Test',human:true,activeIds:numbers.map((_,i)=>`p${i}`),
    coach:{offBonus:0,defBonus:0,offDie:6,defDie:6},matchupCards:[],
    hand:numbers.map((n,i)=>({id:`p${i}`,skillsetId:sid(n),position:['Guard','Guard','Forward','Big','Big'][i%5],archetype:'Balanced',stats:{SCO:10,PLM:10,DEF:10,REB:10},salary:1,age:27,careerRoll:0.5}))};
}
test('24 skillsets, 35 unique mutual pairings; every pairing resolves at its approved strength',()=>{
  assert.equal(SKILLSETS.length,24);assert.equal(SKILLSET_PAIRS.length,35);
  assert.equal(new Set(SKILLSET_PAIRS.map(p=>p.skills.slice().sort().join(':'))).size,35);
  for(const pair of SKILLSET_PAIRS){
    const t=team([1,2]);t.hand.forEach((p,i)=>{p.skillsetId=pair.skills[i];});
    assert.equal(teamSynergy(t)[pair.side],pair.percent);
    t.hand.reverse();assert.equal(teamSynergy(t)[pair.side],pair.percent);
  }
});
test('approved example totals +8% offense; bench aura adds flat one without stacking',()=>{
  const t=team([6,1,10,9,2]);assert.equal(teamSynergy(t).offense,8);assert.equal(teamSynergy(t).defense,0);
  t.hand.push({...t.hand[0],id:'bench1',skillsetId:sid(3)},{...t.hand[0],id:'bench2',skillsetId:sid(3)});
  assert.equal(teamSynergy(t).flat,1);assert.equal(teamSynergy(t).offense,8);
});
test('duplicate combinations count once; missing partners and legacy players are neutral',()=>{
  const t=team([1,1,5,5,3]);assert.equal(teamSynergy(t).offense,3);
  assert.equal(teamSynergy(t,['p0','p1']).offense,0);
  assert.equal(teamSynergy(t,['p0','p1']).flat,1);
  t.hand.forEach(p=>{delete p.skillsetId;});assert.equal(teamSynergy(t).flat,0);assert.equal(teamSynergy(t).pairs.length,0);
});
test('independent caps apply and injury lineup overrides remove inactive pairings',()=>{
  const t=team(SKILLSETS.map((_,i)=>i+1));const s=teamSynergy(t);
  assert.equal(s.offense,12);assert.equal(s.defense,12);assert(s.rawOffense>12);
  assert.equal(teamSynergy(t,['p17','p18']).defense,3);
  assert.equal(teamSynergy(t,['p17']).defense,0);
});
test('skillset persists in generated player JSON; only player cards roll skillsets',()=>{
  const state={};
  for (const position of ['Guard','Forward','Big']) {
    const c=makeCard(state,'Balanced',position,REPLACEMENT_TIER);
    assert(SKILLSETS.some(s=>s.id===c.skillsetId));
    const saved=JSON.parse(JSON.stringify(c));saved.contract--;saved.age++;
    assert.equal(saved.skillsetId,c.skillsetId);
    for(let i=0;i<30;i++){const rolled=rollSkillset(position);assert(SKILLSETS.some(s=>s.id===rolled));}
  }
  assert.equal(drawCoachCard().skillsetId,undefined);assert.equal(drawMatchupModifierCard(state).skillsetId,undefined);
});
test('fractional synergy appears in scoring and projections; bench aura is exactly +1',()=>{
  const t=team([6,1,10,9,2]);const plain=structuredClone(t);plain.hand.forEach(p=>{delete p.skillsetId;});
  const base=offenseModifier(plain);assert.equal(offenseModifier(t),Math.round(base*1.08*100)/100);
  assert.equal(defenseModifier(t),defenseModifier(plain));
  t.hand.push({...t.hand[0],id:'bench',skillsetId:sid(3)});
  assert.equal(offenseModifier(t),Math.round((base*1.08+1)*100)/100);
  assert.equal(defenseModifier(t),defenseModifier(plain)+1);
  assert.equal(teamOutput(t).off,Math.round((offenseModifier(t)+3.5)*100)/100);
  const result=playMatchup(t,plain,false,false,t.activeIds,plain.activeIds);
  assert.equal(result.aOffMod,offenseModifier(t));
  assert(Number.isFinite(simulateSeasonOutput(t).off));
});
test('swap validates positions, ownership of cards and season lock; updates chemistry',()=>{
  const t=team([6,1,10,9,2]);t.hand.push({...t.hand[0],id:'bench',skillsetId:sid(18),position:'Guard'});
  const state={phase:'teamsummary',teams:[t]};
  assert.equal(swapStarter(state,0,'p0','missing').ok,false);
  assert.equal(swapStarter(state,0,'p2','bench').ok,false); // only Forward
  assert.equal(swapStarter(state,0,'p0','bench').ok,true);assert.notEqual(teamSynergy(t).offense,8);
  t.lineupConfirmed=true;assert.equal(swapStarter(state,0,'bench','p0').ok,false);
  t.lineupConfirmed=false;state.phase='playoffs';assert.equal(swapStarter(state,0,'bench','p0').ok,false);
});
test('turn-by-turn scoring retains skillsets after each multiplayer serialization',()=>{
  const a=team([6,1,10,9,2]), b=team([18,19,20,21,22]);b.id=1;b.name='Other';
  let state={teams:[a,b],settings:{injuryChance:0},playoff:{activeMatchIndex:0,cardChoices:{},matches:[{a,b,label:'Test',result:null}]}};
  beginTurn(state);let steps=0;
  while(state.playoff.matches[0].turn.stage!=='complete'&&steps++<40){
    advanceTurn(state,{pass:true});state=rehydrateState(JSON.parse(JSON.stringify(state)));
  }
  const result=state.playoff.matches[0].result;assert(result);
  assert.equal(result.aOffMod,offenseModifier(state.teams[0]));
  assert.equal(result.bDefMod,defenseModifier(state.teams[1]));
});
