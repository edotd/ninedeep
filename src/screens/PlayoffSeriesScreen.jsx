import { useEffect, useRef, useState } from 'react';
import MatchupBox, { buildMatchEvents } from '../components/MatchupBox';
import { matchTeams } from '../game/matchup';
import { ACTION_LOG_SPEEDS } from '../game/constants';

export default function PlayoffSeriesScreen({ state, actions }) {
  const p = state.playoff;
  const idx = p.activeMatchIndex;
  const m = p.matches[idx];
  const [revealIndex, setRevealIndex] = useState(m.result ? Infinity : 0);
  const timersRef = useRef([]);

  useEffect(() => {
    setRevealIndex(m.result ? Infinity : 0);
    return () => timersRef.current.forEach(clearTimeout);
  }, [idx]);

  // Derive the resolved teams for display without mutating match state during render —
  // actions.rollCurrentMatchup is what actually commits m.a/m.b once the dice are rolled.
  const { a: teamA, b: teamB } = matchTeams(p.matches, m);
  const human = state.teams[0];
  const humanInMatch = teamA === human || teamB === human;

  const handleRoll = () => {
    actions.rollCurrentMatchup();
    // m is the same match object React already holds a reference to — rollCurrentMatchup
    // mutates m.result in place, so it's already populated here, before the next render.
    const events = buildMatchEvents(m.result);
    const delay = ACTION_LOG_SPEEDS[state.settings.actionLogSpeed] ?? ACTION_LOG_SPEEDS.normal;
    timersRef.current.forEach(clearTimeout);
    if (delay === 0) {
      setRevealIndex(events.length);
    } else {
      setRevealIndex(0);
      timersRef.current = events.map((_, i) => setTimeout(() => setRevealIndex(i + 1), delay * (i + 1)));
    }
  };

  const handleSkip = () => {
    timersRef.current.forEach(clearTimeout);
    setRevealIndex(Infinity);
  };

  const rolling = m.result && revealIndex < buildMatchEvents(m.result).length;

  return (
    <div className="screen">
      <button className="reset-link" style={{ marginBottom: 12 }} onClick={actions.closeSeries}>← Back to Playoff Bracket</button>
      <h1>{m.label}</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, margin: '4px 0 16px' }}>
        <div className="card-name-lg">{teamA.name}</div>
        <div style={{ color: 'var(--muted)', fontFamily: 'var(--serif)', flexShrink: 0 }}>vs</div>
        <div className="card-name-lg" style={{ textAlign: 'right' }}>{teamB.name}</div>
      </div>
      {!m.result ? (
        <>
          {humanInMatch && human.advantageAvailable && (
            <div className={'pull-slot' + (p.useAdvantage ? ' revealed' : '')} style={{ cursor: 'pointer' }} onClick={actions.toggleAdvantage}>
              <div className="pull-label">Die Hard Ability — once per season</div>
              <div className="pull-value" style={{ fontSize: 15 }}>
                {p.useAdvantage ? '✓ Advantage will be used this matchup' : 'Tap to use Advantage — roll twice, keep the higher'}
              </div>
            </div>
          )}
          {humanInMatch && human.matchupCard && !human.matchupCard.used && human.matchupCard.playable && (
            <div className={'pull-slot' + (p.useCard ? ' revealed' : '')} style={{ cursor: 'pointer' }} onClick={actions.toggleCardPlay}>
              <div className="pull-label">Matchup Card — {human.matchupCard.name}</div>
              <div className="pull-value" style={{ fontSize: 15 }}>
                {p.useCard ? `✓ Will be played against ${(teamA === human ? teamB : teamA).name}` : `Tap to play against ${(teamA === human ? teamB : teamA).name}`}
              </div>
            </div>
          )}
          {humanInMatch && human.matchupCard && !human.matchupCard.used && human.matchupCard.name === 'Injury Prevention' && (
            <div className={'pull-slot' + (p.useInjuryPrevention ? ' revealed' : '')} style={{ cursor: 'pointer' }} onClick={actions.toggleInjuryPrevention}>
              <div className="pull-label">Injury Prevention (value {human.matchupCard.value})</div>
              <div className="pull-value" style={{ fontSize: 15 }}>
                {p.useInjuryPrevention ? '✓ Held ready — will block a lower-value Injury card this matchup' : 'Tap to hold ready this matchup'}
              </div>
            </div>
          )}
          <button className="primary" style={{ width: '100%', padding: 18, margin: '16px 0', fontSize: 16 }} onClick={handleRoll}>Roll Dice</button>
        </>
      ) : (
        <>
          <MatchupBox title={m.label} m={m.result} revealIndex={revealIndex} onSkip={rolling ? handleSkip : undefined} />
          <button
            className="primary"
            disabled={rolling}
            style={{ width: '100%', padding: 16, margin: '16px 0' }}
            onClick={actions.closeSeries}
          >
            {rolling ? 'Rolling…' : 'Back to Playoff Bracket'}
          </button>
        </>
      )}
    </div>
  );
}
