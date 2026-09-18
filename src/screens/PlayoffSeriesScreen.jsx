import { teamSynergy } from '../game/skillsets';
import { useEffect, useRef, useState } from 'react';
import MatchupBox, { buildMatchEvents } from '../components/MatchupBox';
import TurnPanel from '../components/TurnPanel';
import BallMark from '../components/BallMark';
import { matchTeams, cardChoicesFor, teamOutput, hasHomeCourt } from '../game/matchup';
import { ACTION_LOG_SPEEDS } from '../game/constants';
import { teamExperience } from '../game/aging';
import { formatCoins, rosterSalary } from '../game/economy';

export default function PlayoffSeriesScreen({ state, actions, myTeamId }) {
  const p = state.playoff;
  const idx = p.activeMatchIndex;
  const m = p.matches[idx];
  const [revealIndex, setRevealIndex] = useState(m.result ? Infinity : 0);
  // Tip-off (design brand handoff, 2B) — a one-time reveal beat before the match starts,
  // showing both clubs' projected output and matchup-card counts (the opponent's held face
  // down). Purely presentational, derived straight from m — once actions.beginTurn() commits
  // m.turn there's no separate "Start Match" confirmation screen anymore, so tip-off ends the
  // moment the match actually begins.
  const showTipoff = !m.result && !m.turn;
  const [vsShowingLogo, setVsShowingLogo] = useState(false);
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

  useEffect(() => {
    if (!showTipoff) return undefined;
    const iv = setInterval(() => setVsShowingLogo((v) => !v), 2000);
    return () => clearInterval(iv);
  }, [showTipoff]);

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

  if (showTipoff) {
    const outputA = teamA.coach && teamA.activeIds && teamA.activeIds.length > 0 ? teamOutput(teamA) : null;
    const outputB = teamB.coach && teamB.activeIds && teamB.activeIds.length > 0 ? teamOutput(teamB) : null;
    const TipoffTeam = ({ team, opponent, output, mine, away }) => {
      const hca = hasHomeCourt(team, opponent);
      return (
      <div className={'tipoff-team' + (mine ? ' mine' : '') + (away ? ' away' : '')}>
        <div className="tipoff-team-tags">
          {!away && <span className="tipoff-seed-badge">{team.seed ? `${team.seed} Seed` : 'Seed —'}</span>}
          {(hca || mine) && (
            <span className="tipoff-team-tag">{hca ? 'Home Court' : ''}{hca && mine ? ' · ' : ''}{mine ? 'Your Club' : ''}</span>
          )}
          {away && <span className="tipoff-seed-badge outline">{team.seed ? `${team.seed} Seed` : 'Seed —'}</span>}
        </div>
        <div className="tipoff-name">{team.name}</div>
        <div className="tipoff-output-label">Projected Output</div>
        <div className={'tipoff-output' + (mine ? ' mine' : '')}>{output ? output.total : '—'}</div>
        <div className="tipoff-substats">Chemistry {teamSynergy(team).grade} · Experience {team.coach ? teamExperience(team) : '—'} · Budget {team.seasonCap !== undefined ? formatCoins(rosterSalary(team)) : '—'}</div>
      </div>
      );
    };
    const CardSlot = ({ card, mine }) => {
      if (!card) return <div className="tipoff-card empty">None held</div>;
      if (mine) {
        return (
          <div className="tipoff-card faceup">
            <div className="tipoff-card-header"><span>Matchup Card</span><span>{card.rarity || 'One Game'}</span></div>
            <div className="tipoff-card-name">{card.name}</div>
            <div className="tipoff-card-footer"><span>{card.targetsPlayer ? 'Targeted' : 'Team-Wide'}</span><span>{card.used ? 'Used' : card.passive === 'seeding' ? 'Seeding' : 'Ready'}</span></div>
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
            <TipoffTeam team={teamA} opponent={teamB} output={outputA} mine={humanInMatch && teamA === myTeam} />
            <div className="tipoff-vs">
              <span className={'tipoff-vs-text' + (vsShowingLogo ? ' hidden' : '')}>VS</span>
              <span className={'tipoff-vs-logo' + (vsShowingLogo ? '' : ' hidden')}><BallMark size={58} variant="onInk" /></span>
            </div>
            <TipoffTeam team={teamB} opponent={teamA} output={outputB} mine={humanInMatch && teamB === myTeam} away />
          </div>
          <div className="tipoff-cards-row">
            <div className="tipoff-cards-col">
              <div className="tipoff-cards-heading"><span>Matchup Slots</span></div>
              <div className="tipoff-cards-list">
                {cardsFor(teamA).length ? cardsFor(teamA).map((c, i) => <CardSlot key={c.id ?? i} card={c} mine={humanInMatch && teamA === myTeam} />) : <div className="tipoff-card empty">None held</div>}
              </div>
            </div>
            <div className="tipoff-cards-col away">
              <div className="tipoff-cards-heading"><span>Matchup Slots</span></div>
              <div className="tipoff-cards-list">
                {cardsFor(teamB).length ? cardsFor(teamB).map((c, i) => <CardSlot key={c.id ?? i} card={c} mine={humanInMatch && teamB === myTeam} />) : <div className="tipoff-card empty">None held</div>}
              </div>
            </div>
          </div>
          {humanInMatch && myTeam.advantageAvailable && (
            <div className={'pull-slot' + (myChoices.useAdvantage ? ' revealed' : '')} style={{ cursor: 'pointer', margin: '8px 0 0' }} onClick={() => actions.toggleAdvantage(myTeamId)}>
              <div className="pull-label">Die Hard Ability — once per season</div>
              <div className="pull-value" style={{ fontSize: 15 }}>
                {myChoices.useAdvantage ? '✓ Advantage will be used this matchup' : 'Tap to use Advantage — roll twice, keep the higher'}
              </div>
            </div>
          )}
          <button className="primary" style={{ width: '100%', padding: 18, margin: '8px 0 0', fontSize: 16 }} onClick={() => actions.beginTurn()}>
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
      ) : (
        <TurnPanel state={state} actions={actions} m={m} myTeamId={myTeamId} />
      )}
    </div>
  );
}
