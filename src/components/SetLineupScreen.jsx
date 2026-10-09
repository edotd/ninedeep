import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { findSkillPair, teamSynergy } from '../game/skillsets';
import { jerseyNumber, playerGrade } from '../game/cards';
import { autoValidFive, validateLineup } from '../game/roster';
import { sortPlayers } from '../game/playerFilters';
import PlayerCard from './PlayerCard';
import { CardRevealPlayer } from './CardReveal';
import CoachmarkTour from './CoachmarkTour';
import BonusIcon from './BonusIcon';
import { gameplanEffects } from '../game/strategyCards';

// Shown once per browser — the first time anyone opens this editor, not once per team/era, so
// re-explaining after a fresh solo game or a new room would be redundant.
const LINEUP_TOUR_KEY = 'nine-deep-lineup-coachmark-v2-seen';

// Lineup & Chemistry (design: Lineup Builder). The starting five sit on a half-court diagram,
// wired together wherever two of them share a live Skillset pairing (game/skillsets.js's
// SKILLSET_PAIRS); the two bench roles sit under it; the live pairings are tabulated below.
// Tapping a slot opens a bottom sheet of the roster to fill it, and the Gameplan row opens its
// own sheet. Everything here is a local draft — the shared team changes exactly once, on Save.
//
// The five court spots are a fixed, purely cosmetic layout (this game only tracks
// Guard/Forward/Big, so a starter can occupy any spot) — nothing enforces which spot a position
// "belongs" in beyond what saveLineup already requires: one of each Guard/Forward/Big.
const COURT = [
  { key: 'S0', n: 1, x: 50, y: 80 },
  { key: 'S1', n: 2, x: 16, y: 54 },
  { key: 'S2', n: 3, x: 84, y: 54 },
  { key: 'S3', n: 4, x: 24, y: 22 },
  { key: 'S4', n: 5, x: 76, y: 22 },
];
const BENCH = [{ key: 'B6', label: '6TH MAN' }, { key: 'BD', label: 'DEPTH' }];
const SLOT_KEYS = [...COURT.map((s) => s.key), ...BENCH.map((b) => b.key)];
const RARITY_COLOR = { Legendary: '#F0A03D', Signature: '#8E9BB5', Prime: '#C9BC9C', Core: '#A79A78' };
const SORTS = [['Position', 'position'], ['Grade', 'grade'], ['Scoring', 'SCO'], ['Playmaking', 'PLM'], ['Rebounding', 'REB'], ['Defense', 'DEF'], ['Cost', 'cost']];

const sortRoster = (cards, sort) => (sort === 'cost' ? [...cards].sort((a, b) => a.salary - b.salary) : sortPlayers(cards, sort));

export default function SetLineupScreen({ team, actions, myTeamId, canEdit, onPreviewChange }) {
  // slot key -> card id (S0..S4 starters, B6 sixth man, BD depth). A fresh season opens empty
  // because the generated active five is only a placeholder until a human reviews it; an
  // already-saved lineup opens with its current five intact.
  const [assign, setAssign] = useState(() => {
    const next = {};
    if (team.lineupSet) {
      (team.activeIds || []).slice(0, 5).forEach((id, i) => { next[`S${i}`] = id; });
      const bench = team.hand.filter((c) => !(team.activeIds || []).includes(c.id));
      const sixth = bench.find((c) => c.id === team.sixthManId) || bench[0];
      if (sixth) next.B6 = sixth.id;
      const depth = bench.find((c) => c.id !== sixth?.id);
      if (depth) next.BD = depth.id;
    }
    return next;
  });
  const [planId, setPlanId] = useState(() => team.activeGameplanId || '');
  const [sheet, setSheet] = useState(null); // { type: 'player', slot } | { type: 'plan' }
  const [sort, setSort] = useState('position');
  const [toast, setToast] = useState('');
  const [viewCard, setViewCard] = useState(null);
  const toastTimer = useRef(null);
  const flash = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1400);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const cardById = (id) => (id ? team.hand.find((c) => c.id === id) || null : null);
  const starters = COURT.map((s) => cardById(assign[s.key]));
  const starterIds = starters.filter(Boolean).map((c) => c.id);

  // Once all five are in, an empty bench role fills itself from whoever's left over, so a plain
  // seven-man roster never needs the bench picked by hand. An explicit pick always wins.
  const resolveBench = () => {
    const out = {};
    const used = new Set();
    for (const { key } of BENCH) {
      const picked = cardById(assign[key]);
      if (picked && !starterIds.includes(picked.id) && !used.has(picked.id)) { out[key] = picked; used.add(picked.id); }
    }
    if (starterIds.length === 5) {
      for (const { key } of BENCH) {
        if (out[key]) continue;
        const fill = team.hand.find((c) => !starterIds.includes(c.id) && !used.has(c.id));
        if (fill) { out[key] = fill; used.add(fill.id); }
      }
    }
    return out;
  };
  const benchCards = resolveBench();
  const sixthMan = benchCards.B6 || null;
  const cardFor = (key) => (key.startsWith('S') ? starters[Number(key.slice(1))] : benchCards[key] || null);

  const plans = team.coach?.gameplans || [];
  const activePlan = plans.find((plan) => plan.id === planId) || null;

  // Live pairings. A named pairing pays out once no matter how many starter pairs satisfy it
  // (see teamSynergy in game/skillsets.js — it dedupes by rule, not by player pair), so only
  // the first starter pair found for a given rule is drawn and listed.
  const pairings = [];
  const seenRules = new Set();
  for (let i = 0; i < starters.length; i++) {
    for (let j = i + 1; j < starters.length; j++) {
      const pair = findSkillPair(starters[i], starters[j]);
      if (!pair || seenRules.has(pair.name)) continue;
      seenRules.add(pair.name);
      pairings.push({ i, j, pair });
    }
  }

  // Every live lineup bonus for the table (and its icons): the named pairings above, plus the
  // stat-threshold bonuses, the position bonus and Wise Veteran's leadership — the same set
  // teamSynergy folds into the team's Offense/Defense.
  const synergy = starterIds.length === 5 ? teamSynergy({ ...team, activeIds: starterIds }, starterIds) : null;
  const tag = (side, percent) => `+${percent}% ${side === 'offense' ? 'OFF' : 'DEF'}`;
  const who = (card) => `#${jerseyNumber(card)} ${card.archetype}`;
  const bonusRows = [];
  for (const { i, j, pair } of pairings) bonusRows.push({ name: pair.name, side: pair.side, value: tag(pair.side, pair.percent), players: `${who(starters[i])} + ${who(starters[j])}` });
  for (const rule of synergy?.statBonuses || []) {
    bonusRows.push({ name: rule.name, side: rule.side, value: tag(rule.side, rule.percent), players: `2+ starters at ${rule.threshold}+ ${rule.stat}` });
  }
  for (const rule of synergy?.positionBonuses || []) {
    const holder = starters.find((card) => card.skillsetId === rule.skillsetId && card.position === rule.position);
    bonusRows.push({ name: rule.name, side: rule.side, value: tag(rule.side, rule.percent), players: holder ? `${who(holder)} at ${rule.position}` : rule.position });
  }
  if (synergy?.leadership) {
    const vet = team.hand.find((card) => card.skillsetId === 'skill-03');
    bonusRows.push({ name: 'Wise Veteran', side: 'both', value: '+1% OFF & DEF', players: vet ? who(vet) : 'On your roster' });
  }

  // Feed the masthead's live Offense/Defense/Bench preview.
  const previewSignature = starters.map((card) => card?.id ?? 'open').join(',');
  useEffect(() => {
    const stats = starters.reduce((totals, card) => {
      if (!card) return totals;
      for (const stat of ['SCO', 'PLM', 'REB', 'DEF']) totals[stat] += card.stats?.[stat] || 0;
      return totals;
    }, { SCO: 0, PLM: 0, REB: 0, DEF: 0 });
    const previewTeam = { ...team, activeIds: starterIds, activeGameplanId: planId };
    const effects = gameplanEffects(previewTeam, activePlan);
    const adjusted = {
      SCO: Math.round(stats.SCO * (1 + (effects.offPercent || 0) / 100) * 10) / 10,
      PLM: Math.round(stats.PLM * (1 + (effects.offPercent || 0) / 100) * 10) / 10,
      REB: Math.round(stats.REB * (1 + (effects.defPercent || 0) / 100) * 10) / 10,
      DEF: Math.round(stats.DEF * (1 + (effects.defPercent || 0) / 100) * 10) / 10,
    };
    onPreviewChange?.({ teamId: team.id, stats: adjusted });
    // The player ids are the source of every stat total; card objects themselves remain stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewSignature, planId, team, team.id, onPreviewChange]);
  useEffect(() => () => onPreviewChange?.(null), [onPreviewChange]);

  // Which slot (if any) currently holds a card.
  const slotOf = (cardId) => SLOT_KEYS.find((key) => cardFor(key)?.id === cardId) || null;
  const slotLabel = (key) => (key.startsWith('S') ? `STARTER ${Number(key.slice(1)) + 1}` : BENCH.find((b) => b.key === key).label);

  const place = (key, cardId) => {
    setAssign((prev) => {
      const next = { ...prev };
      for (const k of SLOT_KEYS) if (next[k] === cardId) delete next[k];
      next[key] = cardId;
      return next;
    });
    closeSheet();
  };

  const complete = starterIds.length === 5;
  const signature = JSON.stringify([starterIds, sixthMan?.id || null, planId]);
  const [savedSignature, setSavedSignature] = useState(() => (team.lineupSet ? signature : null));
  const dirty = signature !== savedSignature;
  const canSave = canEdit && complete && dirty;

  const handleSave = () => {
    if (!canSave) return;
    const check = validateLineup({ ...team, activeIds: starterIds });
    if (!check.valid) { alert(check.msg); return; }
    const result = actions.saveLineup(myTeamId, starterIds, planId, sixthMan?.id || '');
    if (result && result.valid === false) { alert(result.msg); return; }
    setSavedSignature(signature);
    flash('LINEUP SAVED');
  };

  // A valid five, never the strongest one (see roster.js's autoValidFive) — an escape hatch for
  // someone who doesn't want to hand-pick, not a "set my best lineup" shortcut.
  const handleAutoSet = () => {
    const ids = autoValidFive(team.hand);
    const next = {};
    ids.forEach((id, i) => { next[`S${i}`] = id; });
    setAssign(next);
    flash('LINEUP SET');
  };

  const openSlot = (key) => {
    const card = cardFor(key);
    if (!canEdit) { if (card) setViewCard(card); return; }
    setSort('position');
    clearTimeout(pickerTimer.current);
    setSheet({ type: 'player', slot: key, entering: true });
    requestAnimationFrame(() => requestAnimationFrame(() => setSheet((cur) => (cur && cur.type === 'player' ? { ...cur, entering: false } : cur))));
  };

  const courtRef = useRef(null);
  const gameplanBtnRef = useRef(null);
  const saveBtnRef = useRef(null);

  const sheetSlot = sheet?.type === 'player' ? sheet.slot : null;
  const roster = sortRoster(team.hand, sort);
  // The full-screen player picker is dealt in from the right (the same slide the Team page's sub
  // pages use) and thrown back off the same way, so closing waits out the animation.
  const PICKER_MS = 460;
  const pickerTimer = useRef(null);
  useEffect(() => () => clearTimeout(pickerTimer.current), []);
  const closeSheet = () => {
    if (sheet?.type !== 'player') { setSheet(null); return; }
    clearTimeout(pickerTimer.current);
    setSheet((cur) => (cur ? { ...cur, closing: true } : cur));
    pickerTimer.current = setTimeout(() => setSheet(null), PICKER_MS);
  };
  const pickerOpen = sheet?.type === 'player' && !sheet.closing && !sheet.entering;
  const carouselRef = useRef(null);
  const [cardIndex, setCardIndex] = useState(0);
  // The cards are drawn at their natural 264px width and scaled up to fill the screen — as wide
  // as the screen allows, or as tall as fits above the status line and SELECT button.
  const [pickerFit, setPickerFit] = useState({ s: 1.3, h: 405 });
  useEffect(() => {
    if (!sheetSlot) return undefined;
    const fit = () => {
      const el = carouselRef.current;
      if (!el) return;
      const natural = [...document.querySelectorAll('.lb-measure .lb-natural')].reduce((m, node) => Math.max(m, node.offsetHeight), 0) || 405;
      const availW = el.clientWidth - 28;
      const availH = el.clientHeight - 44 - 104;
      setPickerFit({ s: Math.max(1, Math.min(availW / 264, availH / natural)), h: natural });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [sheetSlot]);
  // Each card plays the onboarding reveal (1.5x) when it's swiped to, and again every time it
  // comes back. A card that has played and been swiped past rests on its finished frame.
  const [plays, setPlays] = useState({});
  useEffect(() => { if (!sheetSlot) setPlays({}); }, [sheetSlot]);
  useEffect(() => {
    if (!sheetSlot) return;
    const card = roster[cardIndex];
    if (card) setPlays((prev) => ({ ...prev, [card.id]: (prev[card.id] || 0) + 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetSlot, cardIndex]);
  // Start on the player already in this slot (or the first card), and keep the page behind the
  // picker from scrolling while it's up.
  useEffect(() => {
    if (!sheetSlot) return undefined;
    const el = carouselRef.current;
    if (el) {
      const at = Math.max(0, roster.findIndex((card) => slotOf(card.id) === sheetSlot));
      el.scrollLeft = at * el.clientWidth;
      setCardIndex(at);
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetSlot]);

  const missing = 5 - starterIds.length;
  const saveLabel = !complete ? `FILL ${missing} MORE` : dirty ? 'SAVE LINEUP' : 'SAVED';
  const pairNames = bonusRows.length ? bonusRows.map((row) => row.name).join(' · ') : 'NO PAIRINGS LIVE';

  return (
    <div className="lb" role="region" aria-label="Your Lineup">
      <div className="lb-body">
        {plans.length > 0 && (
          <button type="button" ref={gameplanBtnRef} className="lb-plan" disabled={!canEdit} onClick={() => setSheet({ type: 'plan' })}>
            <span>GAMEPLAN</span>
            <strong>{activePlan?.name || 'None'}<i>▾</i></strong>
          </button>
        )}

        <div className="lb-court" ref={courtRef}>
          <div className="lb-key" />
          <div className="lb-ft" />
          <div className="lb-arc" />
          <div className="lb-rim" />
          <div className="lb-board" />
          <div className="lb-center" />
          <svg className="lb-wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {pairings.map(({ i, j, pair }) => (
              <line key={pair.name} x1={COURT[i].x} y1={COURT[i].y} x2={COURT[j].x} y2={COURT[j].y} className={pair.side} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          {COURT.map((slot, i) => {
            const card = starters[i];
            return (
              <div
                key={slot.key}
                role="button"
                tabIndex={0}
                className="lb-slot"
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                aria-label={card ? `${card.archetype} ${card.position}, grade ${playerGrade(card)}` : `Open starter spot ${slot.n}`}
                onClick={() => openSlot(slot.key)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSlot(slot.key); } }}
              >
                {card ? (
                  <span className="lb-slot-card" style={{ borderTopColor: RARITY_COLOR[card.rarity] || RARITY_COLOR.Core }}>
                    <b>{playerGrade(card)}</b>
                    <em>{card.archetype}</em>
                    <small>{card.position}</small>
                  </span>
                ) : (
                  <span className="lb-slot-empty"><b>+</b><small>{slot.n}</small></span>
                )}
              </div>
            );
          })}
        </div>

        <div className="lb-bench-wrap">
          <div className="lb-bench-head"><span>BENCH</span><span className="lb-pairnames">{pairNames}</span></div>
          <div className="lb-bench">
            {BENCH.map((b) => {
              const card = benchCards[b.key];
              return (
                <div
                  key={b.key}
                  role="button"
                  tabIndex={0}
                  className="lb-bench-slot"
                  onClick={() => openSlot(b.key)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSlot(b.key); } }}
                >
                  {card ? (
                    <span className="lb-bench-card" style={{ borderLeftColor: RARITY_COLOR[card.rarity] || RARITY_COLOR.Core }}>
                      <b>{playerGrade(card)}</b>
                      <span><em>{card.archetype}</em><small>{b.label}</small></span>
                    </span>
                  ) : (
                    <span className="lb-bench-empty"><b>+</b><small>{b.label}</small></span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="lb-pairs">
          <div className="lb-pairs-table">
            <div className="lb-pairs-row head"><span>ACTIVE PAIRINGS</span><span>PLAYERS</span></div>
            {bonusRows.length ? bonusRows.map((row) => (
              <div className="lb-pairs-row" key={row.name}>
                <span className={'lb-bonus ' + row.side}>
                  <BonusIcon name={row.name} size={40} />
                  <span><b>{row.name}</b><em>{row.value}</em></span>
                </span>
                <span>{row.players}</span>
              </div>
            )) : (
              <div className="lb-pairs-row"><span className="none">N/A</span><span>—</span></div>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="lb-actions">
            <button type="button" className="lb-auto" onClick={handleAutoSet}>AUTO-SET</button>
            <button type="button" ref={saveBtnRef} className={'lb-save' + (canSave ? ' ready' : '')} disabled={!canSave} onClick={handleSave}>{saveLabel}</button>
          </div>
        )}
      </div>

      <div className={'lb-dim' + (sheet?.type === 'plan' ? ' open' : '')} onClick={closeSheet} />

      {sheetSlot && createPortal(
        <div className={'lb-picker' + (pickerOpen ? ' open' : '')} role="dialog" aria-modal="true" aria-label="Select a player">
          <div className="lb-picker-head">
            <div><span>SELECT PLAYER</span><strong>{slotLabel(sheetSlot)}</strong></div>
            <button type="button" aria-label="Close" onClick={closeSheet}>×</button>
          </div>
          <div className="lb-picker-tools">
            <label className="lb-sort">
              <span>SORT BY</span>
              <select value={sort} onChange={(event) => { setSort(event.target.value); if (carouselRef.current) carouselRef.current.scrollLeft = 0; setCardIndex(0); }}>
                {SORTS.map(([label, key]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
          </div>
          <div
            className="lb-cards"
            ref={carouselRef}
            onScroll={(event) => setCardIndex(Math.round(event.currentTarget.scrollLeft / (event.currentTarget.clientWidth || 1)))}
          >
            {roster.map((card) => {
              const where = slotOf(card.id);
              const here = where === sheetSlot;
              return (
                <div className="lb-slide" key={card.id}>
                  <div className="lb-slide-card" style={{ width: 264 * pickerFit.s }}>
                    <div className="lb-reveal-box" style={{ height: pickerFit.h * pickerFit.s + 44 }}>
                      {plays[card.id] > 0 && <CardRevealPlayer key={plays[card.id]} card={card} up={pickerFit.s} cardHeight={pickerFit.h} speed={1.5} delay={250} />}
                    </div>
                    <div className="lb-card-foot">
                      <span className={where && !here ? 'warn' : ''}>{here ? 'IN THIS SLOT' : where ? `NOW AT ${slotLabel(where)} · WILL MOVE` : 'AVAILABLE'}</span>
                      <button type="button" className={here ? 'on' : ''} onClick={() => (here ? closeSheet() : place(sheetSlot, card.id))}>{here ? 'SELECTED' : 'SELECT'}</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="lb-measure" aria-hidden="true">{roster.map((card) => <div className="lb-natural" key={card.id} style={{ width: 264 }}><PlayerCard card={card} /></div>)}</div>
          <div className="lb-picker-pager" aria-live="polite">
            <span>{Math.min(cardIndex + 1, roster.length)} / {roster.length}</span>
            <i>{roster.map((card, index) => <b key={card.id} className={index === cardIndex ? 'on' : ''} />)}</i>
          </div>
        </div>,
        document.body,
      )}

      <div className={'lb-sheet plan' + (sheet?.type === 'plan' ? ' open' : '')} role="dialog" aria-modal="true" aria-label="Select a Gameplan" aria-hidden={sheet?.type !== 'plan'}>
        <div className="lb-sheet-head"><strong className="title">GAMEPLAN</strong><button type="button" aria-label="Close" onClick={closeSheet}>×</button></div>
        <button type="button" className={'lb-plan-row' + (!planId ? ' on' : '')} onClick={() => { setPlanId(''); closeSheet(); }}>
          <span><strong>None</strong><small>No Gameplan bonus applies this season.</small></span>
        </button>
        {plans.map((plan, index) => (
          <button type="button" key={plan.id} className={'lb-plan-row' + (planId === plan.id ? ' on' : '')} onClick={() => { setPlanId(plan.id); closeSheet(); }}>
            <span><strong>{plan.name}</strong><small>{plan.description}</small></span>
            <em>{index === 0 ? 'PRIMARY' : 'SECONDARY'}</em>
          </button>
        ))}
      </div>

      <div className={'lb-toast' + (toast ? ' show' : '')} aria-live="polite">{toast}</div>

      {viewCard && (
        <div className="lb-card-backdrop" onClick={() => setViewCard(null)}>
          <div className="lb-card-modal" role="dialog" aria-modal="true" aria-label="Player card" onClick={(e) => e.stopPropagation()}>
            <PlayerCard card={viewCard} />
            <button type="button" className="secondary" onClick={() => setViewCard(null)}>Close</button>
          </div>
        </div>
      )}

      {canEdit && (
        <CoachmarkTour
          storageKey={LINEUP_TOUR_KEY}
          steps={[
            { targetRef: courtRef, title: 'Set Your Lineup', body: 'Tap an open spot to add a starter. You need at least one Guard, one Forward, and one Big among your five.' },
            ...(plans.length > 0 ? [{ targetRef: gameplanBtnRef, title: 'Pick a Gameplan', body: 'Choose your coach’s primary or secondary Gameplan for a team-wide bonus this season.' }] : []),
            { targetRef: saveBtnRef, title: 'Save Your Lineup', body: 'Two starters sharing a Skillset pairing light up a bonus — look for the lines between them. When you’re happy with your five, Save Lineup to lock it in.' },
          ]}
        />
      )}
    </div>
  );
}
