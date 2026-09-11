import { matchupCardEffectNote } from '../game/summaries';

function ModifierCard({ card }) {
  const catColor = card.category === 'debuff' ? 'var(--bad)' : 'var(--good)';
  let roleNote;
  if (card.reactive) roleNote = "Reactive — hold it ready before a matchup; if you're targeted by an Injury card while ready, it blocks the removal (when its value clears the Injury's).";
  else if (card.passive === 'bench') roleNote = 'Passive — boosts your bench score every matchup this season.';
  else if (card.passive === 'seeding') roleNote = 'Passive — boosts your seeding roll this season.';
  else roleNote = matchupCardEffectNote(card);
  return (
    <div className="matchup-box">
      <div className="matchup-title" style={{ color: catColor }}>{card.name}</div>
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

export default function PullModifierScreen({ state, actions, myTeamId }) {
  const team = state.teams[myTeamId];
  return (
    <>
      <div className="screen">
        <h1>Matchup Card — Season {state.season}</h1>
        <p className="lede">Pull one Matchup Modifier card for the season. It stays with you the whole season, can't be traded or returned, and a fresh one is dealt next season.</p>
        {!team.matchupCard ? (
          <button className="primary" style={{ width: '100%', padding: 18, margin: '16px 0', fontSize: 16 }} onClick={() => actions.pullMatchupCard(myTeamId)}>Pull Card</button>
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
