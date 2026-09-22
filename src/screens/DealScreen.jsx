import { useLayoutEffect, useRef, useState } from 'react';
import PlayerCard from '../components/PlayerCard';
import FrontOfficeCard from '../components/FrontOfficeCard';
import MatchupCard from '../components/MatchupCard';

const FO_KINDS = ['coach', 'fanbase', 'market'];

// Deck sits at rest just long enough to read as a real stack, then each card individually
// flies out of the deck to its own slot in the review grid below, one at a time — matching
// design ref 4A ("Dealing the Nine"): cards come off the stack one by one and are filed into
// place, not a group fade-in. 'Instant' (and prefers-reduced-motion) skip straight to the
// settled grid, same as they skip everything else.
const DECK_MS = 550;
const DEAL_STAGGER_MS = 90;
const FLY_MS = 520;

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// The Deal (design ref 4A): nine player cards, three Front Office cards, and this era's
// Matchup Cards all dealt together in one animated beat, rather than across three separate
// pull screens. Each card is a real (not stand-in) PlayerCard/FrontOfficeCard/MatchupCard,
// and every one of them plays the same "off the deck, into the slot" flight: we measure the
// deck's on-screen position right before it disappears, then measure each card's already-laid-
// out final position, and animate from one to the other with a small per-card stagger (a FLIP —
// First/Last/Invert/Play — since the deck and the grid never coexist in the DOM at once).
// Everything holds in the review grid until Continue — no auto-advance — straight to Team
// Summary. Matchup Cards still get their own PullModifierScreen every season after the first
// (only they refresh season to season — Hand and Front Office are dealt once for the whole
// era), so that screen stays untouched; this one only ever runs once, at the very start of an
// era.
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
  const deckRef = useRef(null);
  const deckOriginRef = useRef(null);
  const cardRefs = useRef([]);

  const goToReview = () => {
    const rect = deckRef.current?.getBoundingClientRect();
    if (rect) deckOriginRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setPhase('review');
  };

  useLayoutEffect(() => {
    if (phase === 'deck') timerRef.current = setTimeout(goToReview, DECK_MS);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useLayoutEffect(() => {
    if (phase !== 'review') return;
    const origin = deckOriginRef.current;
    const nodes = cardRefs.current.filter(Boolean);
    if (!origin || reducedMotion() || nodes.length === 0) return;

    nodes.forEach((node, i) => {
      const rect = node.getBoundingClientRect();
      const dx = origin.x - (rect.left + rect.width / 2);
      const dy = origin.y - (rect.top + rect.height / 2);
      node.style.transition = 'none';
      node.style.opacity = '0';
      node.style.transform = `translate(${dx}px, ${dy}px) scale(0.3) rotate(${i % 2 === 0 ? -16 : 16}deg)`;
      node.style.willChange = 'transform, opacity';
      // eslint-disable-next-line no-unused-expressions
      node.offsetHeight; // force layout so the "from" state above actually paints
      node.style.transition = `transform ${FLY_MS}ms cubic-bezier(.2,.8,.25,1) ${i * DEAL_STAGGER_MS}ms, opacity ${Math.min(FLY_MS, 260)}ms ease-out ${i * DEAL_STAGGER_MS}ms`;
      node.style.opacity = '1';
      node.style.transform = 'translate(0px, 0px) scale(1) rotate(0deg)';
    });
  }, [phase]);

  const handleSkip = () => {
    clearTimeout(timerRef.current);
    goToReview();
  };

  if (phase !== 'review') {
    return (
      <div className="screen deal-screen">
        <h1>Your Deal — Season {state.season}</h1>
        <p className="lede" style={{ marginBottom: 14 }}>Your 9-card hand, Front Office, and this season's Matchup Cards — dealt together.</p>
        <div className="deal-stage">
          <div className="deal-deck" ref={deckRef}><div className="deal-deck-card" /><div className="deal-deck-card" /><div className="deal-deck-card" /></div>
        </div>
        <button className="reset-link deal-skip" onClick={handleSkip}>Skip ▸▸</button>
      </div>
    );
  }

  cardRefs.current = [];
  let refIndex = 0;
  const collectRef = (el) => { cardRefs.current[refIndex++] = el; };

  return (
    <>
      <div className="screen deal-screen">
        <h1>Your Deal — Season {state.season}</h1>
        <p className="lede" style={{ marginBottom: 14 }}>Your 9-card hand, Front Office, and this season's Matchup Cards — all dealt together. Review everything here before heading to your Franchise file.</p>
        <div className="deal-centered">
          <div className="deal-heading">Starters ({starters.length}/5)</div>
          <div className="deal-row-5">
            {starters.map((c) => <div key={c.id} className="card-deal-in" style={{ animation: 'none' }} ref={collectRef}><PlayerCard card={c} /></div>)}
          </div>
          <div className="deal-heading">Bench ({bench.length}/4)</div>
          <div className="deal-row-4">
            {bench.map((c) => <div key={c.id} className="card-deal-in" style={{ animation: 'none' }} ref={collectRef}><PlayerCard card={c} /></div>)}
          </div>
          <div className="deal-heading">Front Office</div>
          <div className="fo-deal-row">
            {FO_KINDS.map((kind) => <div key={kind} className="card-deal-in" style={{ animation: 'none' }} ref={collectRef}><FrontOfficeCard kind={kind} team={team} /></div>)}
          </div>
          <div className="deal-heading">Matchup Cards</div>
          <div className="mu-deal-row">
            {matchupCards.map((c) => <div key={c.id} className="card-deal-in" style={{ animation: 'none' }} ref={collectRef}><MatchupCard card={c} /></div>)}
          </div>
        </div>
      </div>
      <div className="bottombar">
        <button className="primary" onClick={actions.finishDeal}>Continue</button>
      </div>
    </>
  );
}
