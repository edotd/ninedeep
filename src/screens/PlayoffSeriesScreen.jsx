import { useEffect, useRef, useState } from 'react';
import MatchupBox, { FULL_REVEAL } from '../components/MatchupBox';
import { matchTeams } from '../game/matchup';

// Delays (ms after clicking Roll Dice) at which each successive reveal stage appears —
// die, then its bonus, category by category, so the roll reads as a sequence rather than
// a single instant result.
const STAGE_DELAYS = [300, 650, 1000, 1350, 1700, 2050];

export default function PlayoffSeriesScreen({ state, actions }) {
  const p = state.playoff;
  const idx = p.activeMatchIndex;
  const m = p.matches[idx];
  const [revealStage, setRevealStage] = useState(m.result ? FULL_REVEAL : 0);
  const timersRef = useRef([]);

  useEffect(() => {
    setRevealStage(m.result ? FULL_REVEAL : 0);
    return () => timersRef.current.forEach(clearTimeout);
  }, [idx]);

  // Derive the resolved teams for display without mutating match state during render —
  // actions.rollCurrentMatchup is what actually commits m.a/m.b once the dice are rolled.
  const { a: teamA, b: teamB } = matchTeams(p.matches, m);
  const human = state.teams[0];
  const humanInMatch = teamA === human || teamB === human;

  const handleRoll = () => {
    actions.rollCurrentMatchup();
    setRevealStage(0);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = STAGE_DELAYS.map((delay, i) => setTimeout(() => setRevealStage(i + 1), delay));
  };

  const rolling = m.result && revealStage < FULL_REVEAL;

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
          <MatchupBox title={m.label} m={m.result} revealStage={revealStage} />
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
