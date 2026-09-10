import MatchupBox from '../components/MatchupBox';

export default function PlayoffsScreen({ state, actions }) {
  const p = state.playoff;
  const idx = p.stage;
  const m = p.matches[idx];
  const lastStage = p.matches.length - 1;
  // Derive the resolved teams for display without mutating match state during render —
  // actions.rollCurrentMatchup is what actually commits m.a/m.b once the dice are rolled.
  const teamA = m.a || (m.from && p.matches[m.from[0]].result.winner);
  const teamB = m.b || (m.from && p.matches[m.from[1]].result.winner);
  const human = state.teams[0];
  const humanInMatch = teamA === human || teamB === human;

  return (
    <div className="screen">
      <h1>{m.label}</h1>
      {p.matches.slice(0, idx).map((match, i) => (
        <MatchupBox key={i} title={match.label} m={match.result} />
      ))}
      <p className="lede">{teamA.name} vs {teamB.name}</p>
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
          <button className="primary" style={{ width: '100%', padding: 18, margin: '16px 0', fontSize: 16 }} onClick={actions.rollCurrentMatchup}>Roll Dice</button>
        </>
      ) : (
        <>
          <MatchupBox title={m.label} m={m.result} />
          <button className="primary" style={{ width: '100%', padding: 16, margin: '16px 0' }} onClick={actions.advancePlayoff}>
            {idx < lastStage ? 'Next Matchup' : 'See Results'}
          </button>
        </>
      )}
    </div>
  );
}
