import test from 'node:test';
import assert from 'node:assert/strict';
import { CHEMISTRY_GRADES, chemistryGrade, addToRoster, creditTeamSeason, completedTeamYears } from '../src/game/chemistry.js';
import { teamSynergy } from '../src/game/skillsets.js';
import { newEraState, proceedFromResults, signFreeAgent, startPlayoffs, lockSeasonAndSeed } from '../src/game/season.js';
import { startEra } from '../src/game/engine.js';

test('every plus/minus boundary and adjacent score matches the scale',()=>{
 for(let i=0;i<CHEMISTRY_GRADES.length;i++){
  const [min,grade]=CHEMISTRY_GRADES[i];assert.equal(chemistryGrade(min),grade);
  if(min>0)assert.equal(chemistryGrade(min-1),CHEMISTRY_GRADES[i+1][1]);
 }
 assert.equal(chemistryGrade(100),'A+');assert.equal(chemistryGrade(-1),'F');
});
test('tenure accrues once per season for starters and bench (at different rates), resets on transfer, survives serialization',()=>{
 const a={id:0,hand:[],activeIds:['p']},b={id:1,hand:[],activeIds:[]};
 addToRoster(a,{id:'p'});addToRoster(a,{id:'bench'});
 creditTeamSeason(a,1);creditTeamSeason(a,1);creditTeamSeason(a,2);
 assert.equal(completedTeamYears(a.hand[0],a.id),2);assert.equal(completedTeamYears(a.hand[1],a.id),2);
 // 'p' is the only id in activeIds both credited seasons (starter, +0.5/yr); 'bench' never is
 // (bench, +0.25/yr). No pair bonus — activeIds never held two players at once here.
 const saved=JSON.parse(JSON.stringify(a));
 const s=teamSynergy(saved);
 assert.equal(s.starterYears,2);assert.equal(s.benchYears,2);assert.equal(s.pairYears,0);
 assert.equal(s.continuity,2*0.5+2*0.25);
 const player=a.hand.shift();addToRoster(b,player);assert.equal(completedTeamYears(player,b.id),0);
 assert.equal(completedTeamYears(player,a.id),0);
});
test('two starters credit both individual continuity and shared pair continuity',()=>{
 const t={id:0,hand:[],activeIds:['p0','p1']};
 addToRoster(t,{id:'p0'});addToRoster(t,{id:'p1'});
 creditTeamSeason(t,1);creditTeamSeason(t,2);creditTeamSeason(t,3);
 const s=teamSynergy(t);
 assert.equal(s.starterYears,6);assert.equal(s.benchYears,0);assert.equal(s.pairYears,3);
 // 6 starter-years * 0.5 + 3 pair-years * 0.25 = 3.75
 assert.equal(s.continuity,3.75);assert.equal(s.offense,3.75);assert.equal(s.defense,3.75);
 // Splitting the pair (only p0 starts) still credits p0's own tenure, but the pair itself
 // stops accruing further shared years — its 3 already-credited years still count once p1
 // (or a lineup with both again) is back in the query.
 t.activeIds=['p0'];creditTeamSeason(t,4);
 const solo=teamSynergy(t);assert.equal(solo.starterYears,7);assert.equal(solo.pairYears,0);
 assert.equal(teamSynergy(t,['p0','p1']).pairYears,3);
});
test('the coach-retained bonus is +0.5% Off/Def per consecutive season, independent of roster tenure',()=>{
 const t={id:0,hand:[],activeIds:[],retainedStreak:4};
 assert.equal(teamSynergy(t).continuity,2);assert.equal(teamSynergy(t).coachYears,4);
});
test('five starters for two years yield individual plus mutual pair continuity; fit and tenure caps are independent',()=>{
 const t={id:0,hand:[],activeIds:['p0','p1','p2','p3','p4']};
 for(let i=0;i<5;i++)addToRoster(t,{id:`p${i}`});
 creditTeamSeason(t,1);creditTeamSeason(t,2);
 // 5 players * 2 starter-years * 0.5 = 5, plus all 10 mutual pairs * 2 pair-years * 0.25 = 5.
 const s=teamSynergy(t);assert.equal(s.offense,10);assert.equal(s.defense,10);assert.equal(s.score,65);assert.equal(s.grade,'D');
 for(let year=3;year<=7;year++)creditTeamSeason(t,year);
 assert.equal(teamSynergy(t).tenurePoints,15);assert.equal(teamSynergy(t).continuity,35);
});
// Two Signature-tier pairings (Unstoppable Two-Man Game + Half-Court Clinic, +15% offense each)
// already push raw synergy to 30 — the Skillset-fit score component (2.5 points per combined
// percent, capped at 30) saturates well before that, at combined 12%, so this fixture maxes
// both the synergy cap and the fit-score cap at once.
test('approved skill example with three-year starters and a leader earns A+',()=>{
 const t={id:0,hand:[],activeIds:['p0','p1','p2','p3','p4']};
 [6,1,10,9,2].forEach((n,i)=>addToRoster(t,{id:`p${i}`,skillsetId:`skill-${String(n).padStart(2,'0')}`}));
 addToRoster(t,{id:'leader',skillsetId:'skill-03'});
 for(let year=1;year<=3;year++)creditTeamSeason(t,year);
 // Skillset fit and the score/grade cap out the same as before; continuity itself is bigger
 // now that mutual starter pairs (10 of them, 3 years each) add their own +0.25%/year on top
 // of each individual's own +0.5%/year, plus the bench leader's +0.25%/year: 5*3*0.5 (7.5) +
 // 1*3*0.25 (0.75) + 10*3*0.25 (7.5) = 15.75.
 const s=teamSynergy(t);assert.equal(s.score,100);assert.equal(s.grade,'A+');assert.equal(s.continuity,15.75);assert.equal(s.offense,46.75);assert.equal(s.defense,16.75);assert.equal(s.leadership,1);
});
test('real season completion credits retained and expired players, free-agent transfer resets',()=>{
 const state=newEraState();startEra(state,'Test');
 lockSeasonAndSeed(state);startPlayoffs(state);state.playoffTeams=[];
 const player=state.teams[0].hand[0];player.contract=1;
 state.phase='results';proceedFromResults(state);
 assert(state.teams[0].hand.every(p=>completedTeamYears(p,0)===1));
 const expired=state.freeAgents.find(p=>p.id===player.id);assert.equal(completedTeamYears(expired,0),1);
 const target=state.teams[1];target.hand.pop();state.phase='freeagency';signFreeAgent(state,player.id,1);
 assert.equal(completedTeamYears(target.hand.find(p=>p.id===player.id),1),0);
});
