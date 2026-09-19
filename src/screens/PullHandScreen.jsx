import { useEffect, useRef, useState } from 'react';
import PlayerCard from '../components/PlayerCard';
import { ACTION_LOG_SPEEDS } from '../game/constants';

// Cards are already fully dealt in state the moment this screen mounts — the "dealing"
// animation is purely a local reveal, one card at a time, using the same Action Log Speed
// setting the matchup roll uses elsewhere (instant = no animation, show the whole hand).
// Dealt at full card size (not the compact tiles other roster views use), each group (five
// starters, four bench) in its own single row now that the window isn't capped at 900px.
export default function PullHandScreen({ state, actions, myTeamId }) {
  const team = state.teams[myTeamId];
  const activeSet = new Set(team.activeIds || []);
  const starters = team.hand.filter((c) => activeSet.has(c.id));
  const bench = team.hand.filter((c) => !activeSet.has(c.id));
  const ordered = [...starters, ...bench];
  const [dealtCount, setDealtCount] = useState(0);
  const timersRef = useRef([]);
  const cardRefs = useRef(new Map());
  const animatedDealRef = useRef(true);

  useEffect(() => {
    const delay = ACTION_LOG_SPEEDS[state.settings.actionLogSpeed] ?? ACTION_LOG_SPEEDS.normal;
    if (delay === 0) {
      animatedDealRef.current = false;
      setDealtCount(ordered.length);
      return;
    }
    timersRef.current = ordered.map((_, i) => setTimeout(() => setDealtCount(i + 1), delay * (i + 1)));
    return () => timersRef.current.forEach(clearTimeout);
    // Runs once when this screen first mounts for a freshly dealt hand — not on every
    // incidental re-render (e.g. an online room's snapshot updates while still on this phase).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!animatedDealRef.current || dealtCount === 0) return;
    const current = ordered[dealtCount - 1];
    cardRefs.current.get(current?.id)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    // `ordered` is fixed for this one-time deal; only advance when another card is revealed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealtCount]);

  const dealtIds = new Set(ordered.slice(0, dealtCount).map((c) => c.id));
  const dealing = dealtCount < ordered.length;
  const handleSkip = () => {
    timersRef.current.forEach(clearTimeout);
    animatedDealRef.current = false;
    setDealtCount(ordered.length);
  };

  return (
    <>
      <div className="screen deal-screen">
        <h1>Your Hand — Season {state.season}</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <p className="lede" style={{ margin: 0 }}>Your 9-card hand has been dealt — starters and bench are auto-set for you. Review it here before pulling your Front Office cards next.</p>
          {dealing && <button className="reset-link" style={{ flexShrink: 0, marginLeft: 10 }} onClick={handleSkip}>Skip ▸▸</button>}
        </div>
        <div className="deal-centered">
          <div className="deal-heading">Starters ({starters.length}/5)</div>
          <div className="deal-row-5">
            {starters.map((c) => dealtIds.has(c.id) && (
              <div key={c.id} ref={(node) => node ? cardRefs.current.set(c.id, node) : cardRefs.current.delete(c.id)} className="card-deal-in"><PlayerCard card={c} /></div>
            ))}
          </div>
          <div className="deal-heading">Bench ({bench.length}/4)</div>
          <div className="deal-row-4">
            {bench.map((c) => dealtIds.has(c.id) && (
              <div key={c.id} ref={(node) => node ? cardRefs.current.set(c.id, node) : cardRefs.current.delete(c.id)} className="card-deal-in"><PlayerCard card={c} /></div>
            ))}
          </div>
        </div>
      </div>
      <div className="bottombar">
        <button className="primary" disabled={dealing} onClick={actions.proceedFromHand}>
          {dealing ? 'Dealing…' : 'Continue'}
        </button>
      </div>
    </>
  );
}
