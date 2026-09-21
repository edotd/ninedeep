import { useEffect, useRef, useState } from 'react';
import PlayerCard from '../components/PlayerCard';
import FrontOfficeCard from '../components/FrontOfficeCard';
import MatchupCard from '../components/MatchupCard';
import { ACTION_LOG_SPEEDS } from '../game/constants';

const FO_KINDS = ['coach', 'fanbase', 'market'];

// The Deal (design ref 4A, "Dealing the Nine") — the one-time era-opening beat that replaces
// the old three-screen sequence (Hand, then Front Office, then Matchup Cards, each its own
// pull screen). Hand, Front Office, and this season's Matchup Cards are all dealt together in
// state the instant startEra runs (see engine.js) — this screen just reveals the whole thing
// at once rather than card by card, and holds until the player is ready to move on: no
// auto-advance, Continue is the only way through, straight to Team Summary. Matchup Cards
// still get their own PullModifierScreen every season after the first (only they refresh
// season to season — Hand and Front Office are dealt once for the whole era), so that screen
// stays untouched; this one only ever runs once, at the very start of an era.
export default function DealScreen({ state, actions, myTeamId }) {
  const team = state.teams[myTeamId];
  const activeSet = new Set(team.activeIds || []);
  const starters = team.hand.filter((c) => activeSet.has(c.id));
  const bench = team.hand.filter((c) => !activeSet.has(c.id));
  const matchupCards = team.matchupCards || [];
  const [dealt, setDealt] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const delay = ACTION_LOG_SPEEDS[state.settings.actionLogSpeed] ?? ACTION_LOG_SPEEDS.normal;
    if (delay === 0) { setDealt(true); return; }
    // Every card lands on the same beat — nine player cards, three Front Office cards, and
    // three Matchup Cards all flip together, not one after another.
    timerRef.current = setTimeout(() => setDealt(true), delay);
    return () => clearTimeout(timerRef.current);
    // Runs once for this one-time deal, not on every incidental re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSkip = () => {
    clearTimeout(timerRef.current);
    setDealt(true);
  };

  return (
    <>
      <div className="screen deal-screen">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <h1>Your Deal — Season {state.season}</h1>
          {!dealt && <button className="reset-link" style={{ flexShrink: 0, marginLeft: 10 }} onClick={handleSkip}>Skip ▸▸</button>}
        </div>
        <p className="lede" style={{ marginTop: -8, marginBottom: 14 }}>Your 9-card hand, Front Office, and this season's Matchup Cards — all dealt together. Review everything here before heading to your Franchise file.</p>
        <div className="deal-centered">
          <div className="deal-heading">Starters ({starters.length}/5)</div>
          <div className="deal-row-5">
            {dealt && starters.map((c) => <div key={c.id} className="card-deal-in"><PlayerCard card={c} /></div>)}
          </div>
          <div className="deal-heading">Bench ({bench.length}/4)</div>
          <div className="deal-row-4">
            {dealt && bench.map((c) => <div key={c.id} className="card-deal-in"><PlayerCard card={c} /></div>)}
          </div>
          <div className="deal-heading">Front Office</div>
          <div className="fo-deal-row">
            {dealt && FO_KINDS.map((kind) => <div key={kind} className="card-deal-in"><FrontOfficeCard kind={kind} team={team} /></div>)}
          </div>
          <div className="deal-heading">Matchup Cards</div>
          <div className="mu-deal-row">
            {dealt && matchupCards.map((c) => <div key={c.id} className="card-deal-in"><MatchupCard card={c} /></div>)}
          </div>
        </div>
      </div>
      <div className="bottombar">
        <button className="primary" disabled={!dealt} onClick={actions.finishDeal}>
          {dealt ? 'Continue' : 'Dealing…'}
        </button>
      </div>
    </>
  );
}
