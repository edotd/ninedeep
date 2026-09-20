import { useEffect, useRef, useState } from 'react';
import MatchupBox, { buildMatchEvents } from '../components/MatchupBox';
import TurnPanel from '../components/TurnPanel';
import { matchTeams } from '../game/matchup';
import { ACTION_LOG_SPEEDS } from '../game/constants';

export default function PlayoffSeriesScreen({ state, actions, myTeamId }) {
  const p = state.playoff;
  const idx = p.activeMatchIndex;
  const m = p.matches[idx];
  const [revealIndex, setRevealIndex] = useState(m.result ? Infinity : 0);
  const timersRef = useRef([]);
  // In online play, actions.* writes through a Firestore transaction and only resolves in
  // state once the onSnapshot listener delivers the update — it does NOT mutate this m in
  // place the way solo mode does. hadResultRef lets the effect below notice "a result just
  // showed up for this match" (from us or another viewer) and only animate then, instead of
  // assuming the mutation already happened synchronously.
  const hadResultRef = useRef(Boolean(m.result));

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    hadResultRef.current = Boolean(m.result);
    setRevealIndex(m.result ? Infinity : 0);
    return () => { timersRef.current.forEach(clearTimeout); };
  }, [idx]);

  // No separate tip-off confirmation screen any more — opening an unplayed match goes
  // straight into the turn engine, which opens on its own coin-flip stage.
  useEffect(() => {
    if (!m.result && !m.turn) actions.beginTurn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  useEffect(() => {
    if (!m.result || hadResultRef.current) {
      if (m.result) hadResultRef.current = true;
      return;
    }
    hadResultRef.current = true;
    const events = buildMatchEvents(m.result);
    const delay = ACTION_LOG_SPEEDS[state.settings.actionLogSpeed] ?? ACTION_LOG_SPEEDS.normal;
    timersRef.current.forEach(clearTimeout);
    if (delay === 0) {
      setRevealIndex(events.length);
    } else {
      setRevealIndex(0);
      timersRef.current = events.map((_, i) => setTimeout(() => setRevealIndex(i + 1), delay * (i + 1)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.result]);

  // Derive the resolved teams for display without mutating match state during render —
  // actions.beginTurn is what actually commits m.a/m.b once the match starts.
  const { a: teamA, b: teamB } = matchTeams(p.matches, m);

  const handleSkip = () => {
    timersRef.current.forEach(clearTimeout);
    setRevealIndex(Infinity);
  };

  const rolling = m.result && revealIndex < buildMatchEvents(m.result).length;

  return (
    <div className="screen">
      <button className="reset-link" style={{ marginBottom: 12 }} onClick={actions.closeSeries}>← Back to Playoff Bracket</button>
      {!(m.turn && !m.result) && (
        <>
          <h1>{m.label}</h1>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, margin: '4px 0 16px' }}>
            <div className="card-name-lg">{teamA.name}</div>
            <div style={{ color: 'var(--muted)', fontFamily: 'var(--serif)', flexShrink: 0 }}>vs</div>
            <div className="card-name-lg" style={{ textAlign: 'right' }}>{teamB.name}</div>
          </div>
        </>
      )}
      {m.result ? (
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
      ) : m.turn ? (
        <TurnPanel state={state} actions={actions} m={m} myTeamId={myTeamId} />
      ) : null}
    </div>
  );
}
