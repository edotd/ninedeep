import { useEffect, useRef, useState } from 'react';
import MatchupCard from '../components/MatchupCard';
import { ACTION_LOG_SPEEDS } from '../game/constants';

// Matchup cards are now dealt automatically the moment the player advances from the Hand
// screen (see initSeasonModifierCards) — this screen just reveals them one by one in a
// centered row, same pattern as Front Office and Hand. No pull button.
export default function PullModifierScreen({ state, actions, myTeamId }) {
  const team = state.teams[myTeamId];
  const cards = team.matchupCards || [];
  const [dealtCount, setDealtCount] = useState(0);
  const timersRef = useRef([]);

  useEffect(() => {
    if (!cards.length) return;
    const delay = ACTION_LOG_SPEEDS[state.settings.actionLogSpeed] ?? ACTION_LOG_SPEEDS.normal;
    if (delay === 0) {
      setDealtCount(cards.length);
      return;
    }
    timersRef.current = cards.map((_, i) => setTimeout(() => setDealtCount(i + 1), delay * (i + 1)));
    return () => timersRef.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dealing = dealtCount < cards.length;
  const handleSkip = () => {
    timersRef.current.forEach(clearTimeout);
    setDealtCount(cards.length);
  };

  return (
    <>
      <div className="screen">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1>Matchup Cards — Season {state.season}</h1>
          {dealing && <button className="reset-link" style={{ flexShrink: 0, marginLeft: 10 }} onClick={handleSkip}>Skip ▸▸</button>}
        </div>
        <p className="lede">Your {cards.length} Matchup Modifier cards for the season. They stay with you the whole season, can't be traded or returned, and a fresh set is dealt next season.</p>
        <div className="mu-deal-row">
          {cards.slice(0, dealtCount).map((c, i) => (
            <div key={c.id ?? i} className="card-deal-in"><MatchupCard card={c} /></div>
          ))}
        </div>
      </div>
      <div className="bottombar">
        <button className="primary" disabled={dealing} onClick={actions.proceedToLineupFromModifier}>
          {dealing ? 'Dealing…' : 'Continue'}
        </button>
      </div>
    </>
  );
}
