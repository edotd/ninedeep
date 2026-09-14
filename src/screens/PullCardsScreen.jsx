import { useEffect, useRef, useState } from 'react';
import FrontOfficeCard from '../components/FrontOfficeCard';
import { ACTION_LOG_SPEEDS } from '../game/constants';

const KINDS = ['coach', 'fanbase', 'market'];

// Same one-at-a-time deal as the Hand and Matchup Cards screens — one click pulls all three
// Front Office cards into state, then this screen reveals them one by one in a centered row.
export default function PullCardsScreen({ state, actions, myTeamId }) {
  const team = state.teams[myTeamId];
  const allPulled = team.coach && team.fanbaseArchetype && team.market;
  const [dealtCount, setDealtCount] = useState(0);
  const timersRef = useRef([]);

  useEffect(() => {
    if (!allPulled) return;
    const delay = ACTION_LOG_SPEEDS[state.settings.actionLogSpeed] ?? ACTION_LOG_SPEEDS.normal;
    if (delay === 0) {
      setDealtCount(KINDS.length);
      return;
    }
    timersRef.current = KINDS.map((_, i) => setTimeout(() => setDealtCount(i + 1), delay * (i + 1)));
    return () => timersRef.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPulled]);

  const dealing = allPulled && dealtCount < KINDS.length;
  const handleSkip = () => {
    timersRef.current.forEach(clearTimeout);
    setDealtCount(KINDS.length);
  };

  return (
    <>
      <div className="screen">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1>Front Office</h1>
          {dealing && <button className="reset-link" style={{ flexShrink: 0, marginLeft: 10 }} onClick={handleSkip}>Skip ▸▸</button>}
        </div>
        <p className="lede">Your Coach, Fanbase, and Market cards. These are kept for the whole era — pulled once, right after your 9-card hand is dealt.</p>
        {allPulled ? (
          <div className="fo-deal-row">
            {KINDS.slice(0, dealtCount).map((kind) => (
              <div key={kind} className="card-deal-in"><FrontOfficeCard kind={kind} team={team} /></div>
            ))}
          </div>
        ) : (
          <button className="primary" style={{ width: '100%', padding: 18, margin: '16px 0', fontSize: 16 }} onClick={() => actions.pullFrontOffice(myTeamId)}>
            Pull Front Office Cards
          </button>
        )}
      </div>
      {allPulled && (
        <div className="corner-dock">
          <button className="primary" disabled={dealing} onClick={actions.proceedToSeason1}>
            {dealing ? 'Dealing…' : 'Continue'}
          </button>
        </div>
      )}
    </>
  );
}
