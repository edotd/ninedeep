import { teamSynergy } from '../game/skillsets';
import { useRef, useState } from 'react';
import { formatCoins, rosterSalary } from '../game/economy';
import { teamOutput } from '../game/matchup';
import { teamExperience } from '../game/aging';
import { cardTier, rawOverall } from '../game/cards';
import { validateLineup } from '../game/roster';
import { MATCHUP_CARD_DRAW_COUNT } from '../game/constants';
import PlayerCard from './PlayerCard';
import FrontOfficeCard from './FrontOfficeCard';
import MatchupCard from './MatchupCard';

// Full-width desktop persistent bar, per the brand handoff's "Component: Persistent Bar" —
// web variant. Seven sections: starters, bench, front office, matchup, then the three
// metric blocks (chemistry, cap, projected output). Fixed to the very bottom of the
// viewport, spanning under both the Sidebar and the content pane.
//
// Hovering any card slot floats the real, full-size card above the bar (see db-card-preview
// below) — `.desktop-bar` has overflow-x:auto for horizontal scrolling on narrow desktop
// widths, which per the CSS overflow spec forces overflow-y to clip too, so a preview
// positioned as a normal descendant would get cut off at the bar's own top edge. Using
// `position: fixed` for the preview sidesteps that: a fixed element's containing block is the
// viewport unless an ancestor sets transform/perspective/filter, and `.desktop-bar` sets
// none of those, so the preview escapes the bar's clipping entirely.
const PREVIEW_WIDTH = { player: 264, frontoffice: 340, matchup: 280 };

// Substitution ("stamped in place", per the persistent bar's Bar behaviour spec): click one
// starter then one bench player (either order) to swap them. Nothing translates — each slot
// rotates on its own Y axis to 84° and back while a SUB stamp holds over both, then the
// incoming slot rings for a moment. Slots are matched by player id, not array position, so
// the animation tracks the two actual players even though the bench array's order (fixed by
// original deal order, not by slot index) doesn't generally give the outgoing player back the
// exact slot the incoming one vacated.
const FLIP_MS = 200;
const RING_MS = 600;

function PlayerSlot({ card, swap, onHover, onLeave, onSelect }) {
  if (!card) return <div className="db-slot db-player-slot empty"><span className="db-slot-empty-plus">+</span></div>;
  const tier = cardTier(card);
  const isSwapping = swap && (card.id === swap.outgoingId || card.id === swap.incomingId);
  const flipping = isSwapping && (swap.phase === 'flip1' || swap.phase === 'flip2');
  const ringing = swap && swap.phase === 'ring' && card.id === swap.incomingId;
  const selected = swap && swap.phase === 'selecting' && card.id === swap.selectedId;
  const rejected = swap && swap.phase === 'reject' && (card.id === swap.outgoingId || card.id === swap.incomingId);
  const cls = 'db-slot db-player-slot'
    + (tier === 'EXP' ? ' expiring' : '') + ' tier-' + tier.toLowerCase()
    + (selected ? ' selected' : '') + (flipping ? ' flipping' : '') + (ringing ? ' ringing' : '') + (rejected ? ' rejected' : '');
  return (
    <div
      className={cls}
      onMouseEnter={(e) => onHover(e.currentTarget, 'player', <PlayerCard card={card} />)}
      onMouseLeave={onLeave}
      onClick={(e) => onSelect(e.currentTarget, card)}
    >
      <div className="db-slot-tier-strip" />
      <div className="db-slot-number">{rawOverall(card)}</div>
      <div className="db-slot-position">{card.position}</div>
    </div>
  );
}

function FrontOfficeSlot({ label, value, tone, kind, team, onHover, onLeave }) {
  return (
    <div
      className="db-slot db-fo-slot"
      onMouseEnter={team ? (e) => onHover(e.currentTarget, 'frontoffice', <FrontOfficeCard kind={kind} team={team} />) : undefined}
      onMouseLeave={team ? onLeave : undefined}
    >
      <div className="db-fo-label">{label}</div>
      <div className={'db-fo-value' + (tone ? ' ' + tone : '')}>{value || '—'}</div>
    </div>
  );
}

function MatchupSlot({ card, onHover, onLeave }) {
  if (!card) return <div className="db-slot db-matchup-slot empty"><span className="db-slot-empty-plus">+</span></div>;
  return (
    <div
      className="db-slot db-matchup-slot"
      onMouseEnter={(e) => onHover(e.currentTarget, 'matchup', <MatchupCard card={card} />)}
      onMouseLeave={onLeave}
    >
      <div className="db-matchup-label">{card.used ? 'Used' : 'Card'}</div>
      <div className="db-matchup-value">{card.name}</div>
    </div>
  );
}

export default function DesktopBar({ state, myTeamId, actions }) {
  const team = state.teams[myTeamId];
  // Each card type is written to state the instant its own dealing screen mounts, before that
  // screen's one-by-one reveal animation actually finishes — the bar has to deliberately
  // ignore a type while its own phase is still active, or slots would snap to full while the
  // screen behind the bar is still dealing them out one at a time. Slots un-hide the moment
  // the player moves on to the next phase, same beat as that screen's own Continue button.
  const handRevealed = state.phase !== 'pullhand';
  const frontOfficeRevealed = handRevealed && state.phase !== 'pullcards';
  const matchupRevealed = frontOfficeRevealed && state.phase !== 'pullmodifier';

  const hand = handRevealed ? (team.hand || []) : [];
  const activeIds = handRevealed ? (team.activeIds || []) : [];
  const starters = activeIds.map((id) => hand.find((c) => c.id === id)).filter(Boolean);
  const bench = hand.filter((c) => !activeIds.includes(c.id));
  const matchupCards = matchupRevealed ? (team.matchupCards || []) : [];
  const coach = frontOfficeRevealed ? team.coach : null;
  const fanbaseArchetype = frontOfficeRevealed ? team.fanbaseArchetype : null;
  const market = frontOfficeRevealed ? team.market : null;
  const frontOfficeTeam = frontOfficeRevealed ? team : null;

  const canShowOutput = coach && hand.length > 0 && activeIds.length > 0;
  const output = canShowOutput ? teamOutput(team) : null;
  const synergy = teamSynergy(team);
  const chemistry = coach ? teamExperience(team) : null;
  const cap = frontOfficeRevealed ? team.seasonCap : undefined;
  const salary = hand.length ? rosterSalary(team) : 0;
  const overCap = cap !== undefined && salary > cap;

  const [preview, setPreview] = useState(null); // { rect, type, content }
  const handleHover = (el, type, content) => setPreview({ rect: el.getBoundingClientRect(), type, content });
  const handleLeave = () => setPreview(null);

  // swap: null | { selectedId, phase: 'selecting' } | { outgoingId, incomingId, phase, stampRect }
  const [swap, setSwap] = useState(null);
  const timersRef = useRef([]);
  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };

  const runSwap = (outgoingId, incomingId, midRect) => {
    clearTimers();
    setSwap({ outgoingId, incomingId, phase: 'flip1', stampRect: midRect });
    timersRef.current.push(setTimeout(() => {
      actions.swapStarter(myTeamId, outgoingId, incomingId);
      setSwap((s) => (s ? { ...s, phase: 'flip2' } : s));
    }, FLIP_MS));
    timersRef.current.push(setTimeout(() => {
      setSwap((s) => (s ? { ...s, phase: 'ring' } : s));
    }, FLIP_MS * 2));
    timersRef.current.push(setTimeout(() => {
      setSwap(null);
    }, FLIP_MS * 2 + RING_MS));
  };

  const rejectSwap = (outgoingId, incomingId) => {
    clearTimers();
    setSwap({ outgoingId, incomingId, phase: 'reject' });
    timersRef.current.push(setTimeout(() => setSwap(null), 360));
  };

  // Click one starter then one bench player (either order) to swap them; click the same slot
  // again to deselect, or a different slot in the same group to move the selection instead.
  const handleSlotClick = (el, card) => {
    if (!actions || !actions.swapStarter) return;
    if (swap && swap.phase !== 'selecting') return; // an animation is already running
    const isStarter = activeIds.includes(card.id);
    const rect = el.getBoundingClientRect();
    if (!swap) {
      setSwap({ phase: 'selecting', selectedId: card.id, selectedIsStarter: isStarter, selectedRect: rect });
      return;
    }
    if (card.id === swap.selectedId) { setSwap(null); return; }
    if (isStarter === swap.selectedIsStarter) {
      setSwap({ phase: 'selecting', selectedId: card.id, selectedIsStarter: isStarter, selectedRect: rect });
      return;
    }
    const outgoingId = swap.selectedIsStarter ? swap.selectedId : card.id;
    const incomingId = swap.selectedIsStarter ? card.id : swap.selectedId;
    const nextIds = activeIds.map((id) => (id === outgoingId ? incomingId : id));
    const check = validateLineup({ ...team, activeIds: nextIds });
    // Midpoint between the two clicked slots, in viewport coordinates — position:fixed for
    // the same reason the hover preview is: the bar's overflow-x:auto would otherwise clip it.
    if (!check.valid) { rejectSwap(outgoingId, incomingId); return; }
    const midRect = { left: Math.min(swap.selectedRect.left, rect.left), right: Math.max(swap.selectedRect.right, rect.right), top: Math.min(swap.selectedRect.top, rect.top) };
    runSwap(outgoingId, incomingId, midRect);
  };

  return (
    <div className="desktop-bar">
      <div className="db-section db-slots-fixed">
        <div className="db-heading starters">Starters</div>
        <div className="db-slots">
          {Array.from({ length: 5 }, (_, i) => <PlayerSlot key={i} card={starters[i]} swap={swap} onHover={handleHover} onLeave={handleLeave} onSelect={handleSlotClick} />)}
        </div>
      </div>
      <div className="db-section db-slots-fixed">
        <div className="db-heading">Bench</div>
        <div className="db-slots">
          {Array.from({ length: 4 }, (_, i) => <PlayerSlot key={i} card={bench[i]} swap={swap} onHover={handleHover} onLeave={handleLeave} onSelect={handleSlotClick} />)}
        </div>
      </div>
      <div className="db-section db-slots-fixed">
        <div className="db-heading">Front Office</div>
        <div className="db-slots">
          <FrontOfficeSlot label="Coach" value={coach ? coach.modifier : null} kind="coach" team={frontOfficeTeam} onHover={handleHover} onLeave={handleLeave} />
          <FrontOfficeSlot label="Fans" value={fanbaseArchetype ? fanbaseArchetype.name : null} tone={fanbaseArchetype && fanbaseArchetype.name === 'Die Hard' ? 'notable' : null} kind="fanbase" team={frontOfficeTeam} onHover={handleHover} onLeave={handleLeave} />
          <FrontOfficeSlot label="Market" value={market ? market.name : null} kind="market" team={frontOfficeTeam} onHover={handleHover} onLeave={handleLeave} />
        </div>
      </div>
      <div className="db-section db-slots-fixed">
        <div className="db-heading matchup">Matchup</div>
        <div className="db-slots">
          {Array.from({ length: MATCHUP_CARD_DRAW_COUNT }, (_, i) => <MatchupSlot key={i} card={matchupCards[i]} onHover={handleHover} onLeave={handleLeave} />)}
        </div>
      </div>
      <div className="db-section db-metric chemistry">
        <div className="db-heading">Chemistry</div>
        <div className="db-metric-value">{chemistry !== null ? synergy.grade : '—'}</div>
        <div className="chemistry-bar-detail">{synergy.score}/100 · +{synergy.offense}% OFF · +{synergy.defense}% DEF{synergy.flat ? ' · +1 flat' : ''}</div>
      </div>
      <div className="db-section db-metric cap">
        <div className="db-heading">Salary Cap</div>
        <div className={'db-cap-figures' + (overCap ? ' over' : '')}>
          <span className="committed">{formatCoins(salary)}</span>
          <span className="slash"> / </span>
          <span className="limit">{cap !== undefined ? formatCoins(cap) : '—'}</span>
        </div>
      </div>
      <div className="db-section db-metric output">
        <div className="db-heading">Projected Output</div>
        <div className="db-metric-value accent">{output ? output.total : '—'}</div>
        <div className="db-output-breakdown">
          <span>Offense {output ? output.off : '—'}</span>
          <span>Defense {output ? output.def : '—'}</span>
        </div>
      </div>

      {swap && (swap.phase === 'flip1' || swap.phase === 'flip2') && swap.stampRect && (() => {
        const r = swap.stampRect;
        const left = (r.left + r.right) / 2;
        const bottom = window.innerHeight - r.top + 6;
        return <div className="db-sub-stamp" style={{ left, bottom }}>Sub</div>;
      })()}

      {preview && (() => {
        const width = PREVIEW_WIDTH[preview.type] || 264;
        const halfWidth = width / 2;
        const desiredLeft = preview.rect.left + preview.rect.width / 2;
        const left = Math.min(Math.max(desiredLeft, halfWidth + 8), window.innerWidth - halfWidth - 8);
        const bottom = window.innerHeight - preview.rect.top + 12;
        return (
          <div className="db-card-preview" style={{ left, bottom, width }}>
            {preview.content}
          </div>
        );
      })()}
    </div>
  );
}
