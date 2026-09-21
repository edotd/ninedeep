import { useEffect, useRef, useState } from 'react';
import PlayerCard from '../components/PlayerCard';
import FrontOfficeCard from '../components/FrontOfficeCard';
import MatchupCard from '../components/MatchupCard';
import BallMark from '../components/BallMark';
import { useDarkMode } from '../hooks/useDarkMode';

const FO_KINDS = ['coach', 'fanbase', 'market'];

// Fixed, not tied to Settings' Action Log Speed — that setting fast-forwards a *repeated*
// per-matchup animation players see dozens of times a game; this one plays exactly once per
// era, so it stays a real, visible beat regardless of that preference. 'Instant' still skips
// it outright, same as it skips everything else.
const DEAL_DELAY_MS = 1100;

// The Deal (design ref 4A, "Dealing the Nine") — the one-time era-opening beat that replaces
// the old three-screen sequence (Hand, then Front Office, then Matchup Cards, each its own
// pull screen). Hand, Front Office, and this season's Matchup Cards are all dealt together in
// state the instant startEra runs (see engine.js); this screen holds on a visible "dealing"
// beat first (so the reveal actually reads as an event, not content just appearing), then
// flips the whole hand in at once — no auto-advance, Continue is the only way through,
// straight to Team Summary. Matchup Cards still get their own PullModifierScreen every season
// after the first (only they refresh season to season — Hand and Front Office are dealt once
// for the whole era), so that screen stays untouched; this one only ever runs once, at the
// very start of an era.
export default function DealScreen({ state, actions, myTeamId }) {
  const { darkMode } = useDarkMode();
  const team = state.teams[myTeamId];
  const activeSet = new Set(team.activeIds || []);
  const starters = team.hand.filter((c) => activeSet.has(c.id));
  const bench = team.hand.filter((c) => !activeSet.has(c.id));
  const matchupCards = team.matchupCards || [];
  const [dealt, setDealt] = useState(state.settings.actionLogSpeed === 'instant');
  const timerRef = useRef(null);

  useEffect(() => {
    if (dealt) return undefined;
    // Every card lands on the same beat — nine player cards, three Front Office cards, and
    // three Matchup Cards all flip together, not one after another.
    timerRef.current = setTimeout(() => setDealt(true), DEAL_DELAY_MS);
    return () => clearTimeout(timerRef.current);
    // Runs once for this one-time deal, not on every incidental re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSkip = () => {
    clearTimeout(timerRef.current);
    setDealt(true);
  };

  if (!dealt) {
    return (
      <div className="screen constructing-screen">
        <BallMark size={72} variant={darkMode ? 'onInk' : 'onFile'} spinning />
        <div className="constructing-message"><span className="constructing-message-in">Dealing your hand, Front Office, and Matchup Cards…</span></div>
        <button className="reset-link" onClick={handleSkip}>Skip ▸▸</button>
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
