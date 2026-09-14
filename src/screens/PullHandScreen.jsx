import { useEffect, useRef, useState } from 'react';
import PlayerCard from '../components/PlayerCard';
import { ACTION_LOG_SPEEDS } from '../game/constants';

// Cards are already fully dealt in state the moment this screen mounts — the "dealing"
// animation is purely a local reveal, one card at a time, using the same Action Log Speed
// setting the matchup roll uses elsewhere (instant = no animation, show the whole hand).
// Dealt at full card size (not the compact tiles other roster views use) in a 3-per-row
// grid, so the player can actually read stats while reviewing their fresh hand.
export default function PullHandScreen({ state, actions, myTeamId }) {
  const team = state.teams[myTeamId];
  const activeSet = new Set(team.activeIds || []);
  const starters = team.hand.filter((c) => activeSet.has(c.id));
  const bench = team.hand.filter((c) => !activeSet.has(c.id));
  const ordered = [...starters, ...bench];
  const [dealtCount, setDealtCount] = useState(0);
  const timersRef = useRef([]);

  useEffect(() => {
    const delay = ACTION_LOG_SPEEDS[state.settings.actionLogSpeed] ?? ACTION_LOG_SPEEDS.normal;
    if (delay === 0) {
      setDealtCount(ordered.length);
      return;
    }
    timersRef.current = ordered.map((_, i) => setTimeout(() => setDealtCount(i + 1), delay * (i + 1)));
    return () => timersRef.current.forEach(clearTimeout);
    // Runs once when this screen first mounts for a freshly dealt hand — not on every
    // incidental re-render (e.g. an online room's snapshot updates while still on this phase).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dealtIds = new Set(ordered.slice(0, dealtCount).map((c) => c.id));
  const dealing = dealtCount < ordered.length;
  const handleSkip = () => {
    timersRef.current.forEach(clearTimeout);
    setDealtCount(ordered.length);
  };

  return (
    <>
      <div className="screen">
        <h1>Your Hand — Season {state.season}</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <p className="lede" style={{ margin: 0 }}>Your 9-card hand has been dealt — starters and bench are auto-set for you. Review it here before pulling your Front Office cards next.</p>
          {dealing && <button className="reset-link" style={{ flexShrink: 0, marginLeft: 10 }} onClick={handleSkip}>Skip ▸▸</button>}
        </div>
        <h2>Starters ({starters.length}/5)</h2>
        <div className="fa-grid">
          {starters.map((c) => dealtIds.has(c.id) && (
            <div key={c.id} className="card-deal-in"><PlayerCard card={c} /></div>
          ))}
        </div>
        <h2>Bench ({bench.length})</h2>
        <div className="fa-grid">
          {bench.map((c) => dealtIds.has(c.id) && (
            <div key={c.id} className="card-deal-in"><PlayerCard card={c} /></div>
          ))}
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
