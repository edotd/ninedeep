import PlayerCard from '../components/PlayerCard';
import { cardTotal } from '../game/cards';

// A read-only preview of this season's actual upcoming draft class — the exact pool startDraft
// will use once the season plays out (see game/draft.js's prepareDraftClass), not a throwaway
// guess, so scouting a prospect here is real prep, not flavor. Reachable from the sidebar/menu
// at any time, same as Free Agency; there's nothing to click here since no pick has opened yet.
export default function DraftClassScreen({ state, onBack }) {
  const pool = state.upcomingDraftPool || [];
  const sorted = [...pool].sort((a, b) => cardTotal(b) - cardTotal(a));
  return (
    <div className="screen">
      <div className="screen-kicker">League Personnel Wire</div>
      <h1>Draft Class</h1>
      {state.phase === 'draft' ? (
        <p className="lede">The draft is underway — see Draft Order for who's on the clock and what's left in the pool.</p>
      ) : (
        <>
          <p className="lede">This year's actual prospects, set the moment the season began. Scout now — the pool won't change before the draft opens.</p>
          {sorted.length ? (
            <div className="fa-grid">
              {sorted.map((card) => <PlayerCard key={card.id} card={card} />)}
            </div>
          ) : <p className="lede">The next class hasn't been drawn yet.</p>}
        </>
      )}
      <div className="bottombar"><button className="primary" onClick={onBack}>Back</button></div>
    </div>
  );
}
