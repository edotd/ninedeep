import { useEffect, useRef, useState } from 'react';
import MatchupBox, { buildMatchEvents } from '../components/MatchupBox';
import TurnPanel from '../components/TurnPanel';
import { matchTeams, cardChoicesFor, teamOutput } from '../game/matchup';
import { ACTION_LOG_SPEEDS } from '../game/constants';
import { teamExperience } from '../game/aging';
import { formatCoins, rosterSalary } from '../game/economy';

export default function PlayoffSeriesScreen({ state, actions, myTeamId }) {
  const p = state.playoff;
  const idx = p.activeMatchIndex;
  const m = p.matches[idx];
  const [revealIndex, setRevealIndex] = useState(m.result ? Infinity : 0);
  // Tip-off (design brand handoff, 2B) — a one-time reveal beat before the pre-match panel,
  // showing both clubs' projected output and matchup-card counts (the opponent's held face
  // down). Purely presentational: resets per match, no engine change.
  const [tippedOff, setTippedOff] = useState(Boolean(m.result || m.turn));
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
    setTippedOff(Boolean(m.result || m.turn));
    return () => { timersRef.current.forEach(clearTimeout); };
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
  const myTeam = state.teams[myTeamId];
  const humanInMatch = teamA === myTeam || teamB === myTeam;
  const myChoices = humanInMatch ? cardChoicesFor(p, myTeam) : null;

  const handleSkip = () => {
    timersRef.current.forEach(clearTimeout);
    setRevealIndex(Infinity);
  };

  const rolling = m.result && revealIndex < buildMatchEvents(m.result).length;

  if (!m.result && !tippedOff) {
    const outputA = teamA.coach && teamA.activeIds && teamA.activeIds.length > 0 ? teamOutput(teamA) : null;
    const outputB = teamB.coach && teamB.activeIds && teamB.activeIds.length > 0 ? teamOutput(teamB) : null;
    const rotationDots = (team) => {
      const starters = (team.activeIds || []).length;
      const bench = Math.max(0, (team.hand || []).length - starters);
      return (
        <div className="tipoff-dots">
          {Array.from({ length: starters }, (_, i) => <span key={'s' + i} className="tipoff-dot filled" />)}
          {Array.from({ length: bench }, (_, i) => <span key={'b' + i} className="tipoff-dot" />)}
          <span className="tipoff-dots-label">{starters} Start · {bench} Bench</span>
        </div>
      );
    };
    const TipoffTeam = ({ team, output, mine, away }) => (
      <div className={'tipoff-team' + (mine ? ' mine' : '') + (away ? ' away' : '')}>
        <div className="tipoff-team-tags">
          {!away && <span className="tipoff-seed-badge">{team.seed ? `${team.seed} Seed` : 'Seed —'}</span>}
          {(team.seed <= 4 || mine) && (
            <span className="tipoff-team-tag">{team.seed <= 4 ? 'Home Court' : ''}{team.seed <= 4 && mine ? ' · ' : ''}{mine ? 'Your Club' : ''}</span>
          )}
          {away && <span className="tipoff-seed-badge outline">{team.seed ? `${team.seed} Seed` : 'Seed —'}</span>}
        </div>
        <div className="tipoff-name">{team.name}</div>
        <div className="tipoff-output-label">Projected Output</div>
        <div className={'tipoff-output' + (mine ? ' mine' : '')}>{output ? output.total : '—'}</div>
        <div className="tipoff-substats">Chemistry {team.coach ? teamExperience(team) : '—'} · Cap {team.seasonCap !== undefined ? formatCoins(rosterSalary(team)) : '—'}</div>
        {rotationDots(team)}
      </div>
    );
    const CardSlot = ({ card, mine }) => {
      if (!card) return <div className="tipoff-card empty">None held</div>;
      if (mine) {
        return (
          <div className="tipoff-card faceup">
            <div className="tipoff-card-header"><span>Matchup Card</span><span>One Game</span></div>
            <div className="tipoff-card-name">{card.name}</div>
            <div className="tipoff-card-footer"><span>{card.targetsPlayer ? 'Targeted' : 'Team-Wide'}</span><span>Ready</span></div>
          </div>
        );
      }
      return (
        <div className="tipoff-card facedown">
          <div className="tipoff-card-header"><span>Matchup Card</span><span>One Game</span></div>
          <div className="tipoff-facedown-dots">{Array.from({ length: 9 }, (_, i) => <span key={i} className={'tipoff-facedown-dot' + (i === 4 ? ' centre' : '')} />)}</div>
          <div className="tipoff-card-footer"><span>Held</span><span>Unknown</span></div>
        </div>
      );
    };
    const cardsFor = (team) => (team.matchupCards || []).filter((c) => !c.used);
    return (
      <div className="screen tipoff-screen">
        <div className="tipoff-inner">
          <button className="reset-link" style={{ marginBottom: 12 }} onClick={actions.closeSeries}>← Back to Playoff Bracket</button>
          <div className="tipoff-header-row">
            <div className="tipoff-label">{m.label} · Tip-Off</div>
            <div className="tipoff-tipoff-tag">Tip-Off</div>
          </div>
          <div className="tipoff-row">
            <TipoffTeam team={teamA} output={outputA} mine={humanInMatch && teamA === myTeam} />
            <div className="tipoff-vs">VS</div>
            <TipoffTeam team={teamB} output={outputB} mine={humanInMatch && teamB === myTeam} away />
          </div>
          <div className="tipoff-cards-row">
            <div className="tipoff-cards-col">
              <div className="tipoff-cards-heading"><span>{teamA.name} · Matchup Slots</span><span>One Per Roll</span></div>
              <div className="tipoff-cards-list">
                {cardsFor(teamA).length ? cardsFor(teamA).map((c, i) => <CardSlot key={c.id ?? i} card={c} mine={humanInMatch && teamA === myTeam} />) : <div className="tipoff-card empty">None held</div>}
              </div>
            </div>
            <div className="tipoff-cards-col">
              <div className="tipoff-cards-heading"><span>One Per Roll</span><span>{teamB.name} · Matchup Slots</span></div>
              <div className="tipoff-cards-list">
                {cardsFor(teamB).length ? cardsFor(teamB).map((c, i) => <CardSlot key={c.id ?? i} card={c} mine={humanInMatch && teamB === myTeam} />) : <div className="tipoff-card empty">None held</div>}
              </div>
            </div>
          </div>
          <p className="tipoff-fineprint">Held matchup cards get offered during your own offense and defense rolls this match — one per roll. Your opponent's cards stay face down until they're played.</p>
          <button className="primary" style={{ width: '100%', padding: 18, margin: '8px 0 0', fontSize: 16 }} onClick={() => setTippedOff(true)}>
            Tip Off
          </button>
        </div>
      </div>
    );
  }

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
      ) : (
        <>
          {humanInMatch && myTeam.advantageAvailable && (
            <div className={'pull-slot' + (myChoices.useAdvantage ? ' revealed' : '')} style={{ cursor: 'pointer' }} onClick={() => actions.toggleAdvantage(myTeamId)}>
              <div className="pull-label">Die Hard Ability — once per season</div>
              <div className="pull-value" style={{ fontSize: 15 }}>
                {myChoices.useAdvantage ? '✓ Advantage will be used this matchup' : 'Tap to use Advantage — roll twice, keep the higher'}
              </div>
            </div>
          )}
          <div className="pull-slot">
            <div className="pull-value" style={{ fontSize: 15 }}>
              Held matchup cards get offered during your own offense and defense rolls this match.
            </div>
          </div>
          <button
            className="primary"
            style={{ width: '100%', padding: 18, margin: '16px 0', fontSize: 16 }}
            onClick={() => actions.beginTurn()}
          >
            Start Match
          </button>
        </>
      )}
    </div>
  );
}
