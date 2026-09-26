import { useState } from 'react';
import PlayerCard from '../components/PlayerCard';
import { cardTotal, playerGrade } from '../game/cards';
import { formatCoins } from '../game/economy';
import OffseasonFile from '../components/OffseasonFile';
import { offseasonPrice } from '../game/gm';
import { forfeitBonusForPosition, overallPickPosition } from '../game/draft';

function pickLine(card) {
  return `${card.archetype} | ${card.position}`;
}

// Matches the border colors PlayerCard's own .pcard.rarity-* classes use (see index.css) — a
// standalone map since this outline isn't a real .pcard and can't just add the rarity-* class
// to inherit --rarity-accent from there.
const RARITY_SWATCH_COLOR = { Core: '#C4715A', Prime: 'var(--stamp)', Signature: 'var(--stamp-text)', Legendary: 'var(--franchise)' };

// A pick's card, collapsed to just its rounded-corner silhouette (outlined in rarity color) and
// its grade letter centered inside — the fastest way to scan Draft Order without rendering (or
// fitting) a real PlayerCard in every row. Click reveals the actual card in a modal.
function DraftPickOutline({ card, onClick }) {
  return (
    <button
      type="button"
      className="draft-pick-outline"
      style={{ borderColor: RARITY_SWATCH_COLOR[card.rarity || 'Core'] }}
      onClick={onClick}
      aria-label={`View full card: ${playerGrade(card)} ${card.archetype} ${card.position}`}
    >
      {playerGrade(card)}
    </button>
  );
}

export default function DraftScreen({ state, actions, myTeamId }) {
  const draft = state.draft;
  const myTeam = state.teams[myTeamId];
  const sortedPool = [...draft.pool].sort((a, b) => cardTotal(b) - cardTotal(a));
  const onTheClock = draft.queue[0] === myTeam;
  const [viewedCard, setViewedCard] = useState(null);

  return (
    <OffseasonFile state={state} team={myTeam}>
      <div className="of-section-label">02 / DRAFT</div><h1>Draft — Season {state.season}</h1>
      <p className="lede">
        Every team gets one pick, worst record first.{' '}
        {onTheClock
          ? "You're on the clock - draft a player or forfeit your pick for a cap bonus next season."
          : draft.queue[0] ? `Waiting on ${draft.queue[0].name} to pick…` : ''}
      </p>
      <div className="statusline">{draft.queue.length} pick{draft.queue.length === 1 ? '' : 's'} remaining · {draft.pool.length} card{draft.pool.length === 1 ? '' : 's'} in the pool</div>

      {onTheClock && (
        <button
          className="secondary"
          style={{ width: '100%', marginTop: 6 }}
          onClick={() => {
            const res = actions.forfeitPick(myTeamId);
            if (res && res.ok === false) alert(res.msg);
          }}
        >
          Forfeit Pick — +{formatCoins(forfeitBonusForPosition(overallPickPosition(state)))} Cap Next Season
        </button>
      )}

      {(draft.picks.length > 0 || draft.queue.length > 0) && (
        <>
          <h2>Draft Order</h2>
          {[...draft.picks].reverse().map((p, i) => (
            <div key={'picked-' + p.card.id} className={'standing-row' + (p.teamId === myTeamId ? ' you' : '')}>
              <span>#{i + 1} {p.teamName}</span>
              <span className="standing-row-pick"><DraftPickOutline card={p.card} onClick={() => setViewedCard(p.card)} />{pickLine(p.card)}</span>
            </div>
          ))}
          {draft.queue.map((t, i) => (
            <div key={'pending-' + t.id} className={'standing-row' + (t === myTeam ? ' you' : '')}>
              <span>#{draft.picks.length + i + 1} {t.name}</span>
              <span>{i === 0 ? 'On the clock' : 'Pending'}</span>
            </div>
          ))}
        </>
      )}

      <h2>Available Cards ({sortedPool.length})</h2>
      <div className="fa-grid">
        {sortedPool.map((c) => {
          const priced = { ...c, salary: offseasonPrice(myTeam, c.salary) };
          const pick = () => actions.draftPick(myTeamId, c.id);
          return (
            <div key={c.id}>
              <PlayerCard card={priced} onClick={onTheClock ? pick : undefined} />
              {onTheClock && <button className="pcard-renew" onClick={pick}>Select</button>}
            </div>
          );
        })}
      </div>

      {viewedCard && (
        <div className="slf-card-modal-backdrop" onClick={() => setViewedCard(null)}>
          <div className="slf-card-modal" role="dialog" aria-modal="true" aria-label="Player card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="slf-picker-close" onClick={() => setViewedCard(null)} aria-label="Close">×</button>
            <PlayerCard card={viewedCard} />
          </div>
        </div>
      )}
    </OffseasonFile>
  );
}
