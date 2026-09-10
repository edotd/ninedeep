function ModifierCard({ card }) {
  const catColor = card.category === 'debuff' ? 'var(--bad)' : 'var(--good)';
  const catLabel = card.category === 'debuff' ? 'Debuff' : 'Buff';
  let roleNote;
  if (card.reactive) roleNote = 'Reactive — auto-triggers if an opponent targets you with Injury.';
  else if (card.passive === 'bench') roleNote = 'Passive — boosts your bench score every matchup this season.';
  else if (card.passive === 'seeding') roleNote = 'Passive — boosts your seeding roll this season.';
  else roleNote = 'Playable — choose to use it against your opponent during a playoff matchup.';
  return (
    <div className="matchup-box">
      <div className="matchup-title">{card.name} <span className="tier-pill" style={{ color: catColor, borderColor: catColor }}>{catLabel}</span></div>
      <p className="lede" style={{ margin: '8px 0' }}>{card.flavor}</p>
      {card.value !== null && (
        <div className="meta-row" style={{ borderTop: 'none', paddingTop: 0 }}>
          <div className="meta-cell"><b>{card.value}</b><span>Value</span></div>
        </div>
      )}
      <div className="statusline" style={{ marginTop: 4 }}>{roleNote}</div>
    </div>
  );
}

export default function PullModifierScreen({ state, actions }) {
  const team = state.teams[0];
  return (
    <>
      <div className="screen">
        <h1>Matchup Card — Season {state.season}</h1>
        <p className="lede">Pull one Matchup Modifier card for the season. It stays with you the whole season, can't be traded or returned, and a fresh one is dealt next season.</p>
        {!team.matchupCard ? (
          <button className="primary" style={{ width: '100%', padding: 18, margin: '16px 0', fontSize: 16 }} onClick={actions.pullMatchupCard}>Pull Card</button>
        ) : (
          <ModifierCard card={team.matchupCard} />
        )}
      </div>
      {team.matchupCard && (
        <div className="bottombar">
          <button className="primary" onClick={actions.proceedToLineupFromModifier}>Continue to Lineup</button>
        </div>
      )}
    </>
  );
}
