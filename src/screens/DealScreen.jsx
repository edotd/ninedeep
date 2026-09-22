import { useEffect, useRef, useState } from 'react';
import PlayerCard from '../components/PlayerCard';
import FrontOfficeCard from '../components/FrontOfficeCard';
import MatchupCard from '../components/MatchupCard';

const FO_KINDS = ['coach', 'fanbase', 'market'];

// Deck sits at rest just long enough to read as a real stack, then every card lands in its
// final slot in one staggered wave (starters, then bench, then Front Office, then Matchup
// Cards) — matching design ref 4A ("Dealing the Nine"): cards off the stack, flipped, filed
// into place, no separate holding stage in between. 'Instant' skips straight to the settled
// grid, same as it skips everything else.
const DECK_MS = 550;
const STAGGER_MS = 70;

// The Deal (design ref 4A): nine player cards, three Front Office cards, and this era's
// Matchup Cards all dealt together in one animated beat, rather than across three separate
// pull screens. Everything lands directly in the same detailed review grid (no lightweight
// stand-in cards) and holds there until Continue — no auto-advance — straight to Team Summary.
// Matchup Cards still get their own PullModifierScreen every season after the first (only they
// refresh season to season — Hand and Front Office are dealt once for the whole era), so that
// screen stays untouched; this one only ever runs once, at the very start of an era.
export default function DealScreen({ state, actions, myTeamId }) {
  const team = state.teams[myTeamId];
  const activeSet = new Set(team.activeIds || []);
  const starters = team.hand.filter((c) => activeSet.has(c.id));
  const bench = team.hand.filter((c) => !activeSet.has(c.id));
  const matchupCards = team.matchupCards || [];
  const instant = state.settings.actionLogSpeed === 'instant';
  // 'deck' -> 'review'
  const [phase, setPhase] = useState(instant ? 'review' : 'deck');
  const timerRef = useRef(null);

  useEffect(() => {
    if (phase === 'deck') timerRef.current = setTimeout(() => setPhase('review'), DECK_MS);
    return () => clearTimeout(timerRef.current);
  }, [phase]);

  const handleSkip = () => {
    clearTimeout(timerRef.current);
    setPhase('review');
  };

  if (phase !== 'review') {
    return (
      <div className="screen deal-screen">
        <h1>Your Deal — Season {state.season}</h1>
        <p className="lede" style={{ marginBottom: 14 }}>Your 9-card hand, Front Office, and this season's Matchup Cards — dealt together.</p>
        <div className="deal-stage">
          <div className="deal-deck"><div className="deal-deck-card" /><div className="deal-deck-card" /><div className="deal-deck-card" /></div>
        </div>
        <button className="reset-link deal-skip" onClick={handleSkip}>Skip ▸▸</button>
      </div>
    );
  }

  let dealIndex = 0;
  const nextDelay = () => `${dealIndex++ * STAGGER_MS}ms`;

  return (
    <>
      <div className="screen deal-screen">
        <h1>Your Deal — Season {state.season}</h1>
        <p className="lede" style={{ marginBottom: 14 }}>Your 9-card hand, Front Office, and this season's Matchup Cards — all dealt together. Review everything here before heading to your Franchise file.</p>
        <div className="deal-centered">
          <div className="deal-heading">Starters ({starters.length}/5)</div>
          <div className="deal-row-5">
            {starters.map((c) => <div key={c.id} className="card-deal-in" style={{ animationDelay: nextDelay() }}><PlayerCard card={c} /></div>)}
          </div>
          <div className="deal-heading">Bench ({bench.length}/4)</div>
          <div className="deal-row-4">
            {bench.map((c) => <div key={c.id} className="card-deal-in" style={{ animationDelay: nextDelay() }}><PlayerCard card={c} /></div>)}
          </div>
          <div className="deal-heading">Front Office</div>
          <div className="fo-deal-row">
            {FO_KINDS.map((kind) => <div key={kind} className="card-deal-in" style={{ animationDelay: nextDelay() }}><FrontOfficeCard kind={kind} team={team} /></div>)}
          </div>
          <div className="deal-heading">Matchup Cards</div>
          <div className="mu-deal-row">
            {matchupCards.map((c) => <div key={c.id} className="card-deal-in" style={{ animationDelay: nextDelay() }}><MatchupCard card={c} /></div>)}
          </div>
        </div>
      </div>
      <div className="bottombar">
        <button className="primary" onClick={actions.finishDeal}>Continue</button>
      </div>
    </>
  );
}
