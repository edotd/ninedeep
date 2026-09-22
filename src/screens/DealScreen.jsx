import { useEffect, useRef, useState } from 'react';
import PlayerCard from '../components/PlayerCard';
import FrontOfficeCard from '../components/FrontOfficeCard';
import MatchupCard from '../components/MatchupCard';

const FO_KINDS = ['coach', 'fanbase', 'market'];

// Deck sits at rest just long enough to read as a real stack, then each card individually
// comes off the deck and files into its own slot in the persistent bar below (per design ref
// 4A, "Dealing the Nine") — that bar-filling-in IS the deal, not a separate animation next to
// it (see DesktopBar/PersistentBar's dealProgress gating). Once every card has landed, the
// same nine-plus cards resolve into a detailed review grid here so the player can actually
// read them, held until Continue. 'Instant' (and prefers-reduced-motion) skip straight there.
const DECK_MS = 500;
const DEAL_STAGGER_MS = 140;
const TOKEN_MS = 480;

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// The Deal (design ref 4A): nine player cards, three Front Office cards, and this era's
// Matchup Cards all dealt together in one animated beat, rather than across three separate
// pull screens. Matchup Cards still get their own PullModifierScreen every season after the
// first (only they refresh season to season — Hand and Front Office are dealt once for the
// whole era), so that screen stays untouched; this one only ever runs once, at the very start
// of an era.
export default function DealScreen({ state, actions, myTeamId, onDealProgress }) {
  const team = state.teams[myTeamId];
  const activeSet = new Set(team.activeIds || []);
  const starters = team.hand.filter((c) => activeSet.has(c.id));
  const bench = team.hand.filter((c) => !activeSet.has(c.id));
  const matchupCards = team.matchupCards || [];
  const total = starters.length + bench.length + FO_KINDS.length + matchupCards.length;
  const instant = state.settings.actionLogSpeed === 'instant' || reducedMotion();

  // 'deck' -> 'dealing' -> 'review'
  const [phase, setPhase] = useState(instant ? 'review' : 'deck');
  const [dealt, setDealt] = useState(instant ? total : 0);
  const [tokens, setTokens] = useState([]); // transient flying-card visuals, purely decorative
  const timersRef = useRef([]);
  const tokenIdRef = useRef(0);

  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };

  useEffect(() => {
    if (instant) { onDealProgress(total); return undefined; }
    if (phase === 'deck') {
      timersRef.current.push(setTimeout(() => setPhase('dealing'), DECK_MS));
    } else if (phase === 'dealing') {
      for (let i = 0; i < total; i++) {
        timersRef.current.push(setTimeout(() => {
          setDealt(i + 1);
          onDealProgress(i + 1);
          const id = tokenIdRef.current++;
          setTokens((t) => [...t, { id }]);
          setTimeout(() => setTokens((t) => t.filter((tok) => tok.id !== id)), TOKEN_MS);
        }, i * DEAL_STAGGER_MS));
      }
      timersRef.current.push(setTimeout(() => setPhase('review'), (total - 1) * DEAL_STAGGER_MS + TOKEN_MS));
    }
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleSkip = () => {
    clearTimers();
    setDealt(total);
    onDealProgress(total);
    setTokens([]);
    setPhase('review');
  };

  if (phase !== 'review') {
    return (
      <div className="screen deal-screen">
        <h1>Your Deal — Season {state.season}</h1>
        <p className="lede" style={{ marginBottom: 14 }}>Your 9-card hand, Front Office, and this season's Matchup Cards — dealt together.</p>
        <div className="deal-stage">
          <div className="deal-deck">
            <div className="deal-deck-card" /><div className="deal-deck-card" /><div className="deal-deck-card" />
            {tokens.map((t) => <div key={t.id} className="deal-token" />)}
          </div>
          {phase === 'dealing' && <div className="deal-count">{dealt} / {total} dealt</div>}
        </div>
        <button className="reset-link deal-skip" onClick={handleSkip}>Skip ▸▸</button>
      </div>
    );
  }

  return (
    <>
      <div className="screen deal-screen">
        <h1>Your Deal — Season {state.season}</h1>
        <p className="lede" style={{ marginBottom: 14 }}>Your 9-card hand, Front Office, and this season's Matchup Cards — all dealt together. Review everything here before heading to your Franchise file.</p>
        <div className="deal-centered">
          <div className="deal-heading">Starters ({starters.length}/5)</div>
          <div className="deal-row-5">
            {starters.map((c) => <div key={c.id} className="card-deal-in"><PlayerCard card={c} /></div>)}
          </div>
          <div className="deal-heading">Bench ({bench.length}/4)</div>
          <div className="deal-row-4">
            {bench.map((c) => <div key={c.id} className="card-deal-in"><PlayerCard card={c} /></div>)}
          </div>
          <div className="deal-heading">Front Office</div>
          <div className="fo-deal-row">
            {FO_KINDS.map((kind) => <div key={kind} className="card-deal-in"><FrontOfficeCard kind={kind} team={team} /></div>)}
          </div>
          <div className="deal-heading">Matchup Cards</div>
          <div className="mu-deal-row">
            {matchupCards.map((c) => <div key={c.id} className="card-deal-in"><MatchupCard card={c} /></div>)}
          </div>
        </div>
      </div>
      <div className="bottombar">
        <button className="primary" onClick={actions.finishDeal}>Continue</button>
      </div>
    </>
  );
}
