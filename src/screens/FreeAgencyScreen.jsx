import { useState } from 'react';
import PlayerCard from '../components/PlayerCard';
import FrontOfficeCard from '../components/FrontOfficeCard';
import BiddingModal from '../components/BiddingModal';
import { formatCoins, rosterSalary } from '../game/economy';
import { wasReleasedByTeamThisSeason } from '../game/season';
import { freeAgentPriority, hasPendingBidDecision } from '../game/bidding';

export default function FreeAgencyScreen({ state, actions, myTeamId, onBack }) {
  const team = state.teams[myTeamId];
  const openSlots = Math.max(0, 9 - team.hand.length);
  const closed = state.offseason?.freeAgencyClosed?.[team.id];
  const overBudget = rosterSalary(team) > team.seasonCap;
  const pendingDecision = hasPendingBidDecision(state, team);
  // Holds the actual card object, not just an id looked up live in state.freeAgents — a
  // resolved auction splices the winning card out of freeAgents immediately, and the modal
  // still needs to render its own reveal screen for a beat after that.
  const [biddingCard, setBiddingCard] = useState(null);

  const closeOut = () => {
    if (!window.confirm('Are you sure? This will close out the free agency period for this turn and process all open bids. You will not be able to sign or release players until next season.')) return;
    const res = actions.closeFreeAgency(myTeamId);
    if (res && res.ok === false) alert(res.msg);
  };

  return (
    <div className="screen">
      <div className="screen-kicker">League Personnel Wire</div>
      <h1>Free Agency</h1>
      <p className="lede">Browse available players and coaches at any time. Signing is optional.</p>
      <div className="fa-close-panel">
        <button className="primary" disabled={closed || overBudget} onClick={closeOut}>
          {closed ? 'Closed For This Turn' : overBudget ? 'Over Budget — Fix Roster To Close' : 'Close Out Free Agency'}
        </button>
        {!closed && <p>Closing free agency locks signings and releases until next season.</p>}
        {pendingDecision && !closed && <div className="fa-alert">You have an open bid waiting on your raise or stand pat.</div>}
      </div>
      {state.settings?.coachChangesEnabled && (
        <>
          <h2>Coaches</h2>
          {(state.freeAgentCoaches || []).length ? (
            <div className="fa-coach-grid">
              {state.freeAgentCoaches.map((coach) => {
                const firedHere = coach.firedByTeamId === team.id && coach.firedSeason === state.season;
                const hasCoach = Boolean(team.coach);
                const hire = () => {
                  const result = actions.hireFreeAgentCoach(myTeamId, coach.id);
                  if (result && result.ok === false) alert(result.msg);
                };
                return (
                  <div key={coach.id}>
                    <FrontOfficeCard kind="coach" team={{ ...team, coach, retainedStreak: 0 }} />
                    <button className="pcard-renew" disabled={hasCoach || firedHere || closed} onClick={hire}>
                      {firedHere ? 'Fired This Season' : hasCoach ? 'Fire Coach To Hire' : `Hire — ${formatCoins(coach.salary)}`}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : <p className="lede">No coaches are currently available.</p>}
        </>
      )}
      <h2>Players</h2>
      <div className="statusline">Roster {team.hand.length}/9 · {openSlots ? `${openSlots} open spot${openSlots === 1 ? '' : 's'}` : 'No open roster spots'}</div>
      {state.freeAgents.length ? (
        <div className="fa-grid">
          {state.freeAgents.map((card) => {
            const releasedHere = wasReleasedByTeamThisSeason(card, team, state.season);
            const bid = state.offseason?.bidding?.[card.id]?.bids?.[team.id];
            const offerCount = Object.keys(state.offseason?.bidding?.[card.id]?.bids || {}).length;
            const sign = () => setBiddingCard(card);
            return (
              <div key={card.id}>
                <PlayerCard card={card} contractLabel="Requested Contract Length" signingNote={`VALUES ${freeAgentPriority(card).toUpperCase()} · ${offerCount ? `${offerCount} OFFER${offerCount === 1 ? '' : 'S'} MADE` : 'NO OFFERS'}`} />
                <button className="pcard-renew" disabled={(!openSlots && !bid) || releasedHere || closed} onClick={sign}>
                  {releasedHere ? 'Released This Season' : bid ? `Bidding — ${formatCoins(bid.salary)}` : `Offer — ${formatCoins(card.salary)}`}
                </button>
              </div>
            );
          })}
        </div>
      ) : <p className="lede">No players are currently available.</p>}
      <div className="bottombar"><button className="primary" onClick={onBack}>Back</button></div>
      {biddingCard && (
        <BiddingModal state={state} actions={actions} myTeamId={myTeamId} card={biddingCard} onClose={() => setBiddingCard(null)} />
      )}
    </div>
  );
}
