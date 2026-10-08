import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import DeckShuffle, { CardBack } from '../components/DeckShuffle';

const ALL_FO_KINDS = ['coach', 'fanbase', 'market'];

// The deck shuffles right on the stage (DeckShuffle — "cut and slide"), squares up, and then each
// card individually comes off that same deck and files into its own slot in the persistent bar
// below (per design ref 4A, "Dealing the Nine") — that bar-filling-in IS the deal, not a separate
// animation next to it (see DesktopBar/PersistentBar's dealProgress gating). Shuffle and deal are
// one continuous beat with no pause or button between them. Once every card has landed, this goes
// straight to onDealDone (the League page covers "review your cards" in far more detail than a
// plain grid ever did) — no extra tap-through screen. 'Instant' (and prefers-reduced-motion) skip
// both animations but still land on the same onDealDone call.
const DEAL_STAGGER_MS = 140;
const TOKEN_MS = 480;

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// The Deal (design ref 4A): seven player cards and three Front Office cards, dealt together in
// one animated beat. In-Game Adjustments (formerly "Adjustment Cards") no longer get dealt here
// at all — a coach now rolls those fresh at the start of each match instead (see roster.js's
// rollAdjustmentCards); this screen only ever runs once, at the very start of an era.
//
// Moving on from here (onDealDone) is purely a LOCAL, per-client decision — it does not touch
// shared game state at all. Every player's hand/Front Office cards are already dealt
// in the shared doc the instant the era starts, so there is nothing left to synchronize:
// each player watches their own deal animation and continues to their own Team File on their
// own schedule, same as GameShell's overlay screens never yank other players around. On
// mobile, once the deal finishes there's nothing further to review here (the Team File is
// that review), so it goes straight there — no extra tap-through screen.
export default function DealScreen({ state, myTeamId, onDealProgress, onDealDone }) {
  const team = state.teams[myTeamId];
  const activeSet = new Set(team.activeIds || []);
  const starters = team.hand.filter((c) => activeSet.has(c.id));
  const bench = team.hand.filter((c) => !activeSet.has(c.id));
  const FO_KINDS = state.settings.fanbaseCardsEnabled === false ? ALL_FO_KINDS.filter((k) => k !== 'fanbase') : ALL_FO_KINDS;
  const total = starters.length + bench.length + FO_KINDS.length;
  const instant = state.settings.actionLogSpeed === 'instant' || reducedMotion();

  // 'shuffle' -> 'dealing' -> onDealDone. Instant / reduced-motion skips the shuffle.
  const [phase, setPhase] = useState(instant ? 'dealing' : 'shuffle');
  const [dealt, setDealt] = useState(instant ? total : 0);
  const [tokens, setTokens] = useState([]); // transient flying-card visuals, purely decorative
  const timersRef = useRef([]);
  const tokenIdRef = useRef(0);

  // The lobby can scroll (the host notification control sits near its bottom), while the deal
  // replaces it inside the same app shell. iOS preserves that document offset across the swap,
  // which makes the newly shown deal look shifted upward. Reset before paint so every player's
  // deal starts at the true top regardless of where the preceding screen was left.
  useLayoutEffect(() => { window.scrollTo(0, 0); }, []);

  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };

  useEffect(() => {
    if (instant) { onDealProgress(total); onDealDone(); return undefined; }
    if (phase === 'dealing') {
      for (let i = 0; i < total; i++) {
        timersRef.current.push(setTimeout(() => {
          setDealt(i + 1);
          onDealProgress(i + 1);
          const id = tokenIdRef.current++;
          setTokens((t) => [...t, { id }]);
          setTimeout(() => setTokens((t) => t.filter((tok) => tok.id !== id)), TOKEN_MS);
        }, i * DEAL_STAGGER_MS));
      }
      timersRef.current.push(setTimeout(onDealDone, (total - 1) * DEAL_STAGGER_MS + TOKEN_MS));
    }
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleSkip = () => {
    clearTimers();
    setDealt(total);
    onDealProgress(total);
    setTokens([]);
    onDealDone();
  };

  return (
    <div className="screen deal-screen">
      <div className="deal-intro">
        <h1>Your Deal — Season {state.season}</h1>
        <p className="lede" style={{ marginBottom: 14 }}>Your 7-player roster and Front Office — dealt together.</p>
      </div>
      <div className="deal-stage">
        <div className="deal-deck">
          <DeckShuffle skip={instant} onDone={() => setPhase('dealing')} />
          {tokens.map((t) => <div key={t.id} className="deal-token"><CardBack s={160} h={224} /></div>)}
        </div>
        <div className="deal-count">{phase === 'dealing' ? `${dealt} / ${total} dealt` : 'Shuffling the deck'}</div>
      </div>
      <button className="reset-link deal-skip" onClick={handleSkip}>Skip ▸▸</button>
    </div>
  );
}
