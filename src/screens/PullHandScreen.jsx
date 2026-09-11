import PlayerCard from '../components/PlayerCard';

export default function PullHandScreen({ state, actions, myTeamId }) {
  const team = state.teams[myTeamId];
  return (
    <>
      <div className="screen">
        <h1>Your Hand — Season {state.season}</h1>
        <p className="lede">Your 9-card hand has been dealt. Review it here — you'll pick your starting five on the Team screen next.</p>
        {team.hand.map((c) => <PlayerCard key={c.id} card={c} />)}
      </div>
      <div className="bottombar">
        <button className="primary" onClick={actions.proceedFromHand}>Continue to Matchup Card</button>
      </div>
    </>
  );
}
