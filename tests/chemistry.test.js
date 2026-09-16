import test from 'node:test';
import assert from 'node:assert/strict';
import { CHEMISTRY_GRADES, chemistryGrade, addToRoster, creditTeamSeason, completedTeamYears } from '../src/game/chemistry.js';
import { teamSynergy } from '../src/game/skillsets.js';
import { newEraState, proceedFromResults, signFreeAgent, startPlayoffs, lockSeasonAndSeed } from '../src/game/season.js';
import { startEra, proceedFromCardOverview, proceedFromHand, proceedToSeason1 } from '../src/game/engine.js';

test('every plus/minus boundary and adjacent score matches the scale',()=>{
 for(let i=0;i<CHEMISTRY_GRADES.length;i++){
  const [min,grade]=CHEMISTRY_GRADES[i];assert.equal(chemistryGrade(min),grade);
  if(min>0)assert.equal(chemistryGrade(min-1),CHEMISTRY_GRADES[i+1][1]);
 }
 assert.equal(chemistryGrade(100),'A+');assert.equal(chemistryGrade(-1),'F');
});
test('tenure accrues once per season for starters and bench, resets on transfer, survives serialization',()=>{
 const a={id:0,hand:[],activeIds:['p']},b={id:1,hand:[],activeIds:[]};
 addToRoster(a,{id:'p'});addToRoster(a,{id:'bench'});
 creditTeamSeason(a,1);creditTeamSeason(a,1);creditTeamSeason(a,2);
 assert.equal(completedTeamYears(a.hand[0],a.id),2);assert.equal(completedTeamYears(a.hand[1],a.id),2);
 const saved=JSON.parse(JSON.stringify(a));assert.equal(teamSynergy(saved).continuity,1);
 assert.equal(teamSynergy(saved,['p','bench']).continuity,2);
 const player=a.hand.shift();addToRoster(b,player);assert.equal(completedTeamYears(player,b.id),0);
 assert.equal(completedTeamYears(player,a.id),0);
});
test('five starters for two years yield +5% both sides; fit and tenure caps are independent',()=>{
 const t={id:0,hand:[],activeIds:['p0','p1','p2','p3','p4']};
 for(let i=0;i<5;i++)addToRoster(t,{id:`p${i}`});
 creditTeamSeason(t,1);creditTeamSeason(t,2);
 const s=teamSynergy(t);assert.equal(s.offense,5);assert.equal(s.defense,5);assert.equal(s.score,60);assert.equal(s.grade,'D−');
 for(let year=3;year<=7;year++)creditTeamSeason(t,year);
 assert.equal(teamSynergy(t).tenurePoints,15);assert.equal(teamSynergy(t).continuity,17.5);
});
test('approved +8% skill example with three-year starters and a leader earns A−',()=>{
 const t={id:0,hand:[],activeIds:['p0','p1','p2','p3','p4']};
 [6,1,10,9,2].forEach((n,i)=>addToRoster(t,{id:`p${i}`,skillsetId:`skill-${String(n).padStart(2,'0')}`}));
 addToRoster(t,{id:'leader',skillsetId:'skill-03'});
 for(let year=1;year<=3;year++)creditTeamSeason(t,year);
 const s=teamSynergy(t);assert.equal(s.score,90);assert.equal(s.grade,'A−');assert.equal(s.offense,15.5);assert.equal(s.defense,7.5);assert.equal(s.flat,1);
});
test('real season completion credits retained and expired players, free-agent transfer resets',()=>{
 const state=newEraState();startEra(state,'Test');proceedFromCardOverview(state);proceedFromHand(state);proceedToSeason1(state);
 lockSeasonAndSeed(state);startPlayoffs(state);state.playoffTeams=[];
 const player=state.teams[0].hand[0];player.contract=1;
 proceedFromResults(state);
 assert(state.teams[0].hand.every(p=>completedTeamYears(p,0)===1));
 const expired=state.freeAgents.find(p=>p.id===player.id);assert.equal(completedTeamYears(expired,0),1);
 const target=state.teams[1];target.hand.pop();signFreeAgent(state,player.id,1);
 assert.equal(completedTeamYears(target.hand.find(p=>p.id===player.id),1),0);
});
