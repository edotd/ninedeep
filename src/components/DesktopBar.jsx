import { useRef, useState } from 'react';
import { playableCards } from '../game/matchup';
import { PLAYER_STATS, eligibleStatTargets } from '../game/supplementalEffects';
import { cardTier, jerseyNumber } from '../game/cards';
import { validateLineup } from '../game/roster';
import { MATCHUP_CARD_DRAW_COUNT } from '../game/constants';
import PlayerCard from './PlayerCard';
import FrontOfficeCard from './FrontOfficeCard';
import MatchupCard from './MatchupCard';
import StrategyCard from './StrategyCard';

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
const PREVIEW_WIDTH = { player: 264, frontoffice: 340, matchup: 280, strategy: 260 };

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
      <div className="db-slot-number">#{jerseyNumber(card)}</div>
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

function MatchupSlot({ card, onHover, onLeave, onSelect, playable, picking }) {
  if (!card) return <div className="db-slot db-matchup-slot empty"><span className="db-slot-empty-plus">+</span></div>;
  return (
    <div
      className={'db-slot db-matchup-slot' + (card.used ? ' used' : '') + (playable ? ' playable' : '') + (picking ? ' picking' : '')}
      onMouseEnter={(e) => onHover(e.currentTarget, 'matchup', <MatchupCard card={card} />)}
      onMouseLeave={onLeave}
      onClick={playable ? (e) => onSelect(e.currentTarget, card) : undefined}
    >
      <div className="db-matchup-label">{card.used ? 'Used' : playable ? 'Play' : 'Card'}</div>
      <div className="db-matchup-value">{card.name}</div>
    </div>
  );
}

function StrategySlot({ card, onHover, onLeave, onSelect, picking }) {
  if (!card) return <div className="db-slot db-strategy-slot empty"><span className="db-slot-empty-plus">+</span></div>;
  return (
    <div
      className={`db-slot db-strategy-slot ${card.kind}${card.used ? ' used' : ''}${picking ? ' picking' : ''}`}
      onMouseEnter={(e) => onHover(e.currentTarget, 'strategy', <StrategyCard card={card} />)}
      onMouseLeave={onLeave}
      onClick={!card.used ? (e) => onSelect(e.currentTarget, card) : undefined}
    >
      <div className="db-strategy-label">{card.used ? 'Used' : card.kind === 'development' ? 'Apply' : 'Play'}</div>
      <div className="db-strategy-value">{card.name}</div>
    </div>
  );
}

export default function DesktopBar({ state, myTeamId, actions, dealProgress }) {
  const team = state.teams[myTeamId];
  // Each card type is written to state the instant its own dealing screen mounts, before
  // DealScreen's one-by-one reveal animation actually finishes — the bar has to deliberately
  // ignore cards not yet dealt, or slots would snap to full while the screen behind the bar is
  // still dealing them out one at a time. During 'pullhand', dealProgress (lifted in
  // GameShell, counted up by DealScreen itself) says how many of the hand/Front
  // Office/Matchup cards — in that fixed order — have actually landed so far; every other
  // phase reveals everything, same as before.
  const inDeal = state.phase === 'pullhand';
  const rawHand = team.hand || [];
  const rawActiveIds = team.activeIds || [];
  const rawStarters = rawActiveIds.map((id) => rawHand.find((c) => c.id === id)).filter(Boolean);
  const rawBench = rawHand.filter((c) => !rawActiveIds.includes(c.id));
  const rawMatchup = team.matchupCards || [];

  let remaining = inDeal ? (dealProgress ?? 0) : Infinity;
  const take = (arr) => {
    if (remaining === Infinity) return arr;
    const n = Math.max(0, Math.min(arr.length, remaining));
    remaining -= n;
    return arr.slice(0, n);
  };
  const starters = take(rawStarters);
  const bench = take(rawBench);
  const foCount = (() => { const n = Math.max(0, Math.min(3, remaining === Infinity ? 3 : remaining)); if (remaining !== Infinity) remaining -= n; return n; })();
  const matchupCards = take(rawMatchup);

  const activeIds = rawActiveIds;
  const coach = foCount >= 1 ? team.coach : null;
  const fanbaseArchetype = foCount >= 2 ? team.fanbaseArchetype : null;
  const market = foCount >= 3 ? team.market : null;
  const frontOfficeTeam = foCount >= 1 ? team : null;
  const fullyDealt = !inDeal || (dealProgress ?? 0) >= rawStarters.length + rawBench.length + 3 + rawMatchup.length;
  const gameplanCards = fullyDealt ? (team.gameplanCards || []).filter((card) => !card.used) : [];

  const [preview, setPreview] = useState(null); // { rect, type, content }
  const handleHover = (el, type, content) => setPreview({ rect: el.getBoundingClientRect(), type, content });
  const handleLeave = () => setPreview(null);

  // Matchup cards double as the "play a card" UI during a live turn-by-turn match — the board
  // itself just prompts "play a card or pass", the actual pick happens here in the bar. Found
  // independently from state rather than passed down from TurnPanel, since the two components
  // are siblings under GameShell, not parent/child.
  const liveMatch = (state.playoff?.matches || []).find((m) => m.turn && !m.result && (m.a === team || m.b === team));
  const liveTurn = liveMatch?.turn;
  const liveCur = liveTurn?.current;
  const actingTeam = liveCur ? (liveCur.team === 'a' ? liveMatch.a : liveMatch.b) : null;
  const myCardTurn = !!(liveTurn && liveTurn.stage === 'card' && actingTeam === team && team.human);
  const playableIds = new Set(myCardTurn ? playableCards(team).map((c) => c.id) : []);

  // targetPicker: null | { card, rect } — set when a targeting card (e.g. Injury Minor) is
  // clicked, cleared on pick or on clicking the same card again.
  const [targetPicker, setTargetPicker] = useState(null);
  const targetTeam = targetPicker && liveMatch
    ? (targetPicker.card.target === 'self' ? team : (actingTeam === liveMatch.a ? liveMatch.b : liveMatch.a))
    : null;
  const targetIds = targetPicker && targetTeam ? (targetTeam === liveMatch.a ? liveTurn.idsA : liveTurn.idsB) : [];
  const targetPlayers = targetPicker && targetTeam ? eligibleStatTargets(targetTeam, targetIds, targetPicker.card) : [];

  const handleMatchupClick = (el, card) => {
    if (!myCardTurn || !playableIds.has(card.id)) return;
    if (card.targetsPlayer) {
      setTargetPicker((tp) => (tp && tp.card.id === card.id ? null : { card, rect: el.getBoundingClientRect() }));
      return;
    }
    setTargetPicker(null);
    actions.advanceTurn({ cardId: card.id });
  };

  const [strategyPicker, setStrategyPicker] = useState(null);
  const handleStrategyClick = (el, card) => {
    const playoffReady = liveTurn && ['coinflip', 'coinflipped'].includes(liveTurn.stage);
    const seasonOpen = ['pullhand', 'pullmodifier', 'constructing', 'teamsummary'].includes(state.phase);
    const context = playoffReady ? 'playoff' : seasonOpen ? 'season' : null;
    if (!context) return;
    if (card.target === 'opponent' && context === 'season') {
      setStrategyPicker({ card, rect: el.getBoundingClientRect(), mode: 'opponent', context });
      return;
    }
    actions.playGameplanCard(myTeamId, card.id, context, null);
    setStrategyPicker(null);
  };

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
          <FrontOfficeSlot label="GM" value={market ? (team.gmType || 'Neutral') : null} kind="market" team={frontOfficeTeam} onHover={handleHover} onLeave={handleLeave} />
        </div>
      </div>
      <div className="db-section db-slots-fixed">
        <div className="db-heading gameplan">Gameplan</div>
        <div className="db-slots">
          {Array.from({ length: 2 }, (_, i) => <StrategySlot key={i} card={gameplanCards[i]} onHover={handleHover} onLeave={handleLeave} onSelect={handleStrategyClick} picking={strategyPicker?.card.id === gameplanCards[i]?.id} />)}
        </div>
      </div>
      <div className="db-section db-slots-fixed">
        <div className="db-heading matchup">Adjustment</div>
        <div className="db-slots">
          {Array.from({ length: MATCHUP_CARD_DRAW_COUNT }, (_, i) => {
            const card = matchupCards[i];
            return (
              <MatchupSlot
                key={i}
                card={card}
                onHover={handleHover}
                onLeave={handleLeave}
                onSelect={handleMatchupClick}
                playable={!!card && playableIds.has(card.id)}
                picking={!!card && targetPicker?.card.id === card.id}
              />
            );
          })}
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

      {targetPicker && (() => {
        const width = 280;
        const halfWidth = width / 2;
        const desiredLeft = targetPicker.rect.left + targetPicker.rect.width / 2;
        const left = Math.min(Math.max(desiredLeft, halfWidth + 8), window.innerWidth - halfWidth - 8);
        const bottom = window.innerHeight - targetPicker.rect.top + 12;
        const card = targetPicker.card;
        return (
          <div className="db-target-picker" style={{ left, bottom, width }}>
            <div className="db-target-picker-head">Choose a target — {card.name}</div>
            {targetPlayers.length === 0 && <div className="db-target-picker-empty">No eligible starter.</div>}
            {targetPlayers.flatMap((oc) => (card.targetsPlayer && card.effectType ? PLAYER_STATS : [null]).map((stat) => (
              <button
                key={`${oc.id}-${stat}`}
                className="db-target-btn"
                onClick={() => { actions.advanceTurn({ cardId: card.id, targetId: oc.id, stat }); setTargetPicker(null); }}
              >
                {oc.position} · {oc.archetype}{stat ? ` · ${stat} (${oc.stats[stat]})` : ''}{card.effectType === 'CAP_HIT_STAT' ? ` · +${oc.salary}` : ''}
              </button>
            )))}
          </div>
        );
      })()}
      {strategyPicker && (() => {
        const width = 300;
        const halfWidth = width / 2;
        const desiredLeft = strategyPicker.rect.left + strategyPicker.rect.width / 2;
        const left = Math.min(Math.max(desiredLeft, halfWidth + 8), window.innerWidth - halfWidth - 8);
        const bottom = window.innerHeight - strategyPicker.rect.top + 12;
        const eligible = state.teams.filter((candidate) => candidate.id !== team.id);
        return (
          <div className="db-target-picker" style={{ left, bottom, width }}>
            <div className="db-target-picker-head">Choose an opponent — {strategyPicker.card.name}</div>
            {eligible.length === 0 && <div className="db-target-picker-empty">No eligible target.</div>}
            {eligible.map((target) => (
              <button key={target.id} className="db-target-btn" onClick={() => {
                actions.playGameplanCard(myTeamId, strategyPicker.card.id, strategyPicker.context, target.id);
                setStrategyPicker(null);
              }}>
                {target.name}
              </button>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
