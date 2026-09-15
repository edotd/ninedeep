import { useMemo } from 'react';
import PlayerCard from '../components/PlayerCard';
import FrontOfficeCard from '../components/FrontOfficeCard';
import MatchupCard from '../components/MatchupCard';
import { drawCoachCard, applyCoachRetention } from '../game/cards';
import { weightedPick } from '../game/rng';
import { FANBASE_ARCHETYPES, MARKETS, MATCHUP_MODIFIER_TYPES } from '../game/constants';
import { rollMarketCapAdj } from '../game/economy';
import { initAttendance } from '../game/fanbase';

// A throwaway team, built with the same generators the real Front Office pull uses, purely so
// this screen has something real to show in the Front Office example — never written to
// state.teams, so it has no effect on the actual game.
function buildSampleTeam() {
  const team = { hand: [], activeIds: [], retainedStreak: 0, lastCoachName: null };
  team.coach = drawCoachCard();
  applyCoachRetention(team, team.coach);
  team.fanbaseArchetype = weightedPick(FANBASE_ARCHETYPES);
  const marketDef = weightedPick(MARKETS);
  team.market = { name: marketDef.name, capAdj: rollMarketCapAdj(marketDef) };
  initAttendance(team);
  team.advantageAvailable = team.fanbaseArchetype.name === 'Die Hard';
  return team;
}

// Same shape drawMatchupModifierCard (game/cards.js) produces, minus the state-backed id
// counter — this is a display-only example, never dealt into any real hand.
function sampleMatchupCard(i) {
  const t = weightedPick(MATCHUP_MODIFIER_TYPES);
  const value = t.needsValue ? 1 + Math.floor(Math.random() * (t.valueDie || 10)) : null;
  return {
    id: 'preview-' + i, name: t.name, category: t.category, flavor: t.flavor,
    playable: !!t.playable, reactive: !!t.reactive, passive: t.passive || null,
    targetsPlayer: !!t.targetsPlayer, valueDie: t.valueDie || 10, value, used: false,
  };
}

const FINE_PRINT = {
  players: [
    { label: 'When', value: 'Set once per season, on the Lineup step' },
    { label: 'What It Carries', value: 'Offense, defense, and cap hit' },
    { label: 'When It Expires', value: 'Contract reaches zero years remaining' },
  ],
  'co-frontoffice': [
    { label: 'When', value: 'Pulled once, right after your hand is dealt' },
    { label: 'What It Carries', value: 'Coaching bonuses, attendance, and cap boosts' },
    { label: 'How It Changes', value: 'Fire your coach or relocate your market from the Team screen' },
  ],
  matchup: [
    { label: 'When', value: 'Played during your own offense or defense roll' },
    { label: 'What It Carries', value: 'A one-time swing to a single game' },
    { label: 'Limit', value: 'One card per roll, discarded once played' },
  ],
};

// "Before the Deal" (design brand handoff, 3A) — a one-time overview of the three card types,
// shown before any dealing starts. Player examples are drawn straight from the real season
// pool (safe to preview — dealing hasn't touched it yet); Front Office and Matchup examples
// are built from the same generators the real pulls use, on a throwaway sample never written
// to any real team, since neither has actually been pulled yet at this point in the flow.
export default function CardOverviewScreen({ state, actions }) {
  const playerExamples = state.starPool.slice(0, 3);
  const sampleTeam = useMemo(() => buildSampleTeam(), []);
  const matchupExamples = useMemo(() => [0, 1, 2].map(sampleMatchupCard), []);

  const SECTIONS = [
    {
      tone: 'players', kind: 'Card Type 01', title: 'Player Cards', count: 'Nine Of Your Nine',
      body: 'The bulk of your hand — nine rostered players, five in your starting five and four on the bench. Stats and cap hit are fixed for the season; contract years count down as seasons pass.',
      examples: <div className="fa-grid">{playerExamples.map((c) => <PlayerCard key={c.id} card={c} />)}</div>,
    },
    {
      tone: 'co-frontoffice', kind: 'Card Type 02', title: 'Front Office Cards', count: 'Three Of Your Nine',
      body: 'Coach, Fanbase, and Market — three standing arrangements that shape your whole era, not just one game. Pulled once and held through Era 01 unless you spend Team Finances to change them.',
      examples: (
        <div className="fo-deal-row">
          {['coach', 'fanbase', 'market'].map((kind) => (
            <div key={kind} className="fo2-wrap"><FrontOfficeCard kind={kind} team={sampleTeam} /></div>
          ))}
        </div>
      ),
    },
    {
      tone: 'matchup', kind: 'Card Type 03', title: 'Matchup Cards', count: 'Three Of Your Nine',
      body: "Three modifier cards, dealt fresh each season. Play one during a playoff matchup to swing a roll in your favor — or hold Injury Prevention ready to answer an opponent's card.",
      examples: (
        <div className="mu-deal-row">
          {matchupExamples.map((c) => <div key={c.id} className="mu2-wrap"><MatchupCard card={c} /></div>)}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="screen co-screen">
        <div className="co-inner">
          <div className="co-masthead">
            <div className="co-eyebrow">{state.teamName || 'Your Franchise'} · Before The Deal</div>
            <h1 className="co-title">Your Nine</h1>
            <div className="co-meta">
              <div>
                <div className="co-meta-label">Hand Size</div>
                <div className="co-meta-value">Nine Cards</div>
              </div>
              <div>
                <div className="co-meta-label">Card Types</div>
                <div className="co-meta-value accent">Three</div>
              </div>
            </div>
          </div>

          {SECTIONS.map((s) => (
            <div className={'co-section ' + s.tone} key={s.title}>
              <div className="co-section-band">
                <span>{s.kind}</span>
                <span>{s.count}</span>
              </div>
              <div className="co-section-body">
                <div className="co-section-title">{s.title}</div>
                <p className="co-section-text">{s.body}</p>
                <div className="co-examples">{s.examples}</div>
                <div className="co-fine-grid">
                  {FINE_PRINT[s.tone].map((f) => (
                    <div className="co-fine-cell" key={f.label}>
                      <div className="co-fine-label">{f.label}</div>
                      <div className="co-fine-value">{f.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bottombar">
        <button className="primary" onClick={actions.proceedFromCardOverview}>Deal My Hand</button>
      </div>
    </>
  );
}
