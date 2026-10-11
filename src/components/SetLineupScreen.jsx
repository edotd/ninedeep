import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { effectiveStat, findSkillPair, teamSynergy, skillsetFor } from '../game/skillsets';
import { playerGrade } from '../game/cards';
import { validateLineup } from '../game/roster';
import { sortPlayers } from '../game/playerFilters';
import PlayerCard from './PlayerCard';
import CardReveal from './CardReveal';
import PlayerCardMenu from './PlayerCardMenu';
import PickerDeck from './PickerDeck';
import CoachmarkTour from './CoachmarkTour';
import BonusIcon from './BonusIcon';
import { BONUS_SIDE } from './bonusIcons';
import { gameplanEffects } from '../game/strategyCards';
import { completedTeamYears } from '../game/chemistry';
import { setLeaveGuard } from '../hooks/leaveGuard';

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
// "belongs" in; a Guard, Forward and Big all starting earns the Floor Balance bonus.
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

// Seasons with this club, as pips under a slot's player: up to five filled pips, a "+" past that,
// and a "NEW" tag for a player who hasn't completed a season here yet.
function TenurePips({ years }) {
  const shown = Math.min(5, years);
  return (
    <span className="lb-tenure" title={years ? `${years} season${years === 1 ? '' : 's'} with the club` : 'New to the club'} aria-label={years ? `${years} seasons with the club` : 'New to the club'}>
      {years === 0 ? <i className="new">NEW</i> : Array.from({ length: shown }, (_, i) => <i key={i} />)}
      {years > 5 && <i className="more">+</i>}
    </span>
  );
}

const roleLabel = (slot) => (!slot ? undefined : slot.startsWith('S') ? 'Starter' : slot === 'B6' ? 'Sixth Man' : 'Depth');

const sortRoster = (cards, sort) => (sort === 'cost' ? [...cards].sort((a, b) => a.salary - b.salary) : sortPlayers(cards, sort));

export default function SetLineupScreen({ team, actions, myTeamId, canEdit, onPreviewChange }) {
  // slot key -> card id (S0..S4 starters, B6 sixth man, BD depth). A fresh season opens empty
  // because the generated active five is only a placeholder until a human reviews it; an
  // already-saved lineup opens with its current five intact.
  const [assign, setAssign] = useState(() => {
    const next = {};
    const inHand = (id) => (id && team.hand.some((c) => c.id === id) ? id : null);
    const slots = team.lineupSlots;
    if (slots) {
      // The remembered slot layout (kept across seasons): every player still on the roster sits
      // in the slot they held, and a slot whose player left is open.
      (slots.starters || []).slice(0, 5).forEach((id, i) => { if (inHand(id)) next[`S${i}`] = id; });
      if (inHand(slots.sixth)) next.B6 = slots.sixth;
      if (inHand(slots.depth)) next.BD = slots.depth;
    } else if (team.lineupSet) {
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
  // The pairing table names the Skillsets involved rather than the players holding them.
  const who = (card) => skillsetFor(card)?.name || 'No Skillset';
  const bonusRows = [];
  for (const { i, j, pair } of pairings) bonusRows.push({ name: pair.name, side: pair.side, value: tag(pair.side, pair.percent), players: `${who(starters[i])} + ${who(starters[j])}` });
  for (const rule of synergy?.statBonuses || []) {
    bonusRows.push({ name: rule.name, side: rule.side, value: tag(rule.side, rule.percent), players: `2+ starters at ${rule.threshold}+ ${rule.stat}` });
  }
  for (const rule of synergy?.positionBonuses || []) {
    const holder = starters.find((card) => card.skillsetId === rule.skillsetId && card.position === rule.position);
    bonusRows.push({ name: rule.name, side: rule.side, value: tag(rule.side, rule.percent), players: holder ? `${who(holder)} at ${rule.position}` : rule.position });
  }
  if (synergy?.floorBalance) {
    bonusRows.push({ name: 'Floor Balance', side: 'both', value: `+${synergy.floorBalance}% OFF & DEF`, players: 'Guard + Forward + Big starting' });
  }
  if (synergy?.leadership) {
    const vet = team.hand.find((card) => card.skillsetId === 'skill-03');
    bonusRows.push({ name: 'Wise Veteran', side: 'both', value: '+1% OFF & DEF', players: vet ? who(vet) : 'On your roster' });
  }

  // What the court draws for those bonuses, in each bonus's own colour: a line between every
  // starter pair that earns a named pairing (all of them, not just the first the table lists), a
  // dashed line between the starters clearing a stat threshold, and a ring round the player a
  // position or leadership bonus rests on.
  const sideColor = (side) => (side === 'offense' ? BONUS_SIDE.o : side === 'defense' ? BONUS_SIDE.d : BONUS_SIDE.b).bg;
  const wires = [];
  for (let i = 0; i < starters.length; i++) {
    for (let j = i + 1; j < starters.length; j++) {
      const pair = findSkillPair(starters[i], starters[j]);
      if (pair) wires.push({ key: `${pair.name}:${i}-${j}`, i, j, color: sideColor(pair.side) });
    }
  }
  for (const rule of synergy?.statBonuses || []) {
    const idx = starters.map((card, i) => (card && effectiveStat(card, rule.stat) >= rule.threshold ? i : -1)).filter((i) => i >= 0);
    for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) wires.push({ key: `${rule.name}:${idx[a]}-${idx[b]}`, i: idx[a], j: idx[b], color: sideColor(rule.side), dashed: true });
  }
  // Lines sharing the same two players fan out sideways so none hides another.
  const pairCount = {}, pairSeen = {};
  for (const w of wires) pairCount[`${w.i}-${w.j}`] = (pairCount[`${w.i}-${w.j}`] || 0) + 1;
  for (const w of wires) {
    const k = `${w.i}-${w.j}`, n = pairSeen[k] = (pairSeen[k] ?? -1) + 1;
    const dx = COURT[w.j].x - COURT[w.i].x, dy = COURT[w.j].y - COURT[w.i].y, len = Math.hypot(dx, dy) || 1;
    const off = (n - (pairCount[k] - 1) / 2) * 2.2;
    w.ox = (-dy / len) * off; w.oy = (dx / len) * off;
  }
  // Tapping a row in the bonus table selects it: its line (or ring) goes yellow and pulses.
  const [selBonus, setSelBonus] = useState(null);
  const isSel = (w) => selBonus != null && w.key.startsWith(selBonus + ':');
  const rings = starters.map(() => []);
  for (const rule of synergy?.positionBonuses || []) {
    starters.forEach((card, i) => { if (card && card.skillsetId === rule.skillsetId && card.position === rule.position) rings[i].push({ color: sideColor(rule.side), name: rule.name }); });
  }
  if (synergy?.leadership) {
    starters.forEach((card, i) => { if (card?.skillsetId === 'skill-03') rings[i].push({ color: sideColor('both'), name: 'Wise Veteran' }); });
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
  const depthCard = benchCards.BD || null;
  const signature = JSON.stringify([starterIds, sixthMan?.id || null, depthCard?.id || null, planId]);
  const [savedSignature, setSavedSignature] = useState(() => (team.lineupSet ? signature : null));
  const dirty = signature !== savedSignature;
  const canSave = canEdit && complete && dirty;

  // The lineup saves itself the moment all five starters are in place and anything changes.
  const save = () => {
    const check = validateLineup({ ...team, activeIds: starterIds });
    if (!check.valid) return check;
    const result = actions.saveLineup(myTeamId, starterIds, planId, sixthMan?.id || '', depthCard?.id || '');
    return result && result.valid === false ? result : null;
  };
  useEffect(() => {
    if (!canSave) return;
    const failure = save();
    if (failure) { flash(failure.msg); return; }
    setSavedSignature(signature);
    flash('LINEUP SAVED');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSave, signature]);

  // Leaving the page (another tab, the sidebar, closing the browser) with unsaved changes asks
  // whether to save first. Navigation points go through hooks/leaveGuard.js's guardedNavigate.
  const hasUnsaved = canEdit && dirty && (starterIds.length > 0 || Boolean(team.lineupSet));
  const [leavePrompt, setLeavePrompt] = useState(null); // { proceed }
  useEffect(() => {
    if (!hasUnsaved) return undefined;
    const release = setLeaveGuard((proceed) => setLeavePrompt({ proceed }));
    const beforeUnload = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { release(); window.removeEventListener('beforeunload', beforeUnload); };
  }, [hasUnsaved]);
  const leaveWith = (doSave) => {
    const { proceed } = leavePrompt;
    if (doSave) {
      const failure = save();
      if (failure) { alert(failure.msg); return; }
    }
    setLeavePrompt(null);
    proceed();
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
  // The cards sit in a fanned deck (see PickerDeck). Transitions stay off for the first frames after
  // the picker opens, so nothing glides into place.
  const [deckLive, setDeckLive] = useState(false);
  // Tapping a card in the picker presses it in (scaled down while the finger is on it) and opens
  // its menu: Select, Develop, Release, Learn More (the onboarding card screen).
  const [menu, setMenu] = useState(null); // card whose menu is open
  const [learnCard, setLearnCard] = useState(null);
  const closeMenu = () => setMenu(null);
  useEffect(() => { if (!sheetSlot) { setMenu(null); setLearnCard(null); } }, [sheetSlot]);
  // The cards are drawn at their natural 264px width and scaled up to fill the screen — as wide
  // as the screen allows, or as tall as fits above the status line and SELECT button.
  const [pickerFit, setPickerFit] = useState({ s: 1.3, h: 405 });
  useEffect(() => {
    if (!sheetSlot) return undefined;
    const fit = () => {
      const el = carouselRef.current;
      if (!el) return;
      const nodes = [...document.querySelectorAll('.lb-measure .lb-natural')];
      const natural = nodes.reduce((m, node) => Math.max(m, node.offsetHeight), 0) || 405;
      // Each card's own height, so every frame hugs its card instead of the tallest one.
      const hs = Object.fromEntries(nodes.map((node) => [node.dataset.cardId, node.offsetHeight]));
      // The fan peeks out either side of the top card, so it leaves a little width; height is
      // everything the deck area has (the status line and BACK/NEXT sit below it).
      const availW = el.clientWidth - 40;
      const availH = el.clientHeight - 44 - 18;
      setPickerFit({ s: Math.max(1, Math.min(availW / 264, availH / natural)), h: natural, hs });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [sheetSlot]);
  // Start on the player already in this slot (or the first card), and keep the page behind the
  // picker from scrolling while it's up.
  useLayoutEffect(() => {
    if (!sheetSlot) { setDeckLive(false); return; }
    setCardIndex(Math.max(0, roster.findIndex((card) => slotOf(card.id) === sheetSlot)));
    setDeckLive(false);
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setDeckLive(true)));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetSlot]);
  useEffect(() => {
    if (!sheetSlot) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetSlot]);

  const pairNames = bonusRows.map((row) => row.name).join(' · ');

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
            {[...wires].sort((a, b) => Number(isSel(a)) - Number(isSel(b))).map((w) => (
              <line className={isSel(w) ? 'selected' : undefined} key={w.key} x1={COURT[w.i].x + w.ox} y1={COURT[w.i].y + w.oy} x2={COURT[w.j].x + w.ox} y2={COURT[w.j].y + w.oy} stroke={isSel(w) ? '#F0A03D' : w.color} strokeDasharray={w.dashed ? '7 6' : undefined} vectorEffect="non-scaling-stroke" />
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
                {rings[i].map(({ color, name }, r) => <span key={r} className={'lb-slot-ring' + (selBonus === name ? ' selected' : '')} style={{ borderColor: selBonus === name ? '#F0A03D' : color, inset: -(4 + r * 5) }} aria-hidden="true" />)}
                {card ? (
                  <span className="lb-slot-card" style={{ borderTopColor: RARITY_COLOR[card.rarity] || RARITY_COLOR.Core }}>
                    <b>{playerGrade(card)}</b>
                    <em>{card.archetype}</em>
                    <small>{card.position}</small>
                    <TenurePips years={completedTeamYears(card, team.id)} />
                  </span>
                ) : (
                  <span className="lb-slot-empty"><b>+</b><small>{slot.n}</small></span>
                )}
              </div>
            );
          })}
        </div>

        <div className="lb-bench-wrap">
          {bonusRows.length > 0 && <div className="lb-bench-head"><span className="lb-pairnames">{pairNames}</span></div>}
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
                      <span><em>{card.archetype}</em><small>{b.label}</small><TenurePips years={completedTeamYears(card, team.id)} /></span>
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
            <div className="lb-pairs-row head"><span>ACTIVE PAIRINGS</span><span>SKILLSETS</span></div>
            {bonusRows.length ? bonusRows.map((row) => (
              <div
                className={'lb-pairs-row selectable' + (selBonus === row.name ? ' selected' : '')}
                key={row.name}
                role="button"
                tabIndex={0}
                aria-pressed={selBonus === row.name}
                onClick={() => setSelBonus((v) => (v === row.name ? null : row.name))}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelBonus((v) => (v === row.name ? null : row.name)); } }}
              >
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

      </div>


      {sheetSlot && createPortal(
        <div className={'lb-picker' + (pickerOpen ? ' open' : '')} role="dialog" aria-modal="true" aria-label="Select a player">
          <div className="lb-picker-head">
            <div><span>SELECT PLAYER</span><strong>{slotLabel(sheetSlot)}</strong></div>
            <button type="button" aria-label="Close" onClick={closeSheet}>×</button>
          </div>
          <div className="lb-picker-tools" style={{ width: 264 * pickerFit.s }}>
            <label className="lb-sort">
              <span>SORT BY</span>
              <select value={sort} onChange={(event) => { setSort(event.target.value); setCardIndex(0); }}>
                {SORTS.map(([label, key]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
          </div>
          <PickerDeck
            containerRef={carouselRef}
            roster={roster}
            index={cardIndex}
            onIndex={setCardIndex}
            fit={pickerFit}
            live={deckLive}
            labelFor={(card) => roleLabel(slotOf(card.id))}
            onOpen={setMenu}
          />
          <div className="lb-measure" aria-hidden="true">{roster.map((card) => <div className="lb-natural" key={card.id} data-card-id={card.id} style={{ width: 264 }}><PlayerCard card={card} /></div>)}</div>
          {menu && (
            <PlayerCardMenu
              card={menu}
              team={team}
              actions={actions}
              myTeamId={myTeamId}
              canEdit={canEdit}
              selectLabel={slotOf(menu.id) === sheetSlot ? 'Selected — Close' : 'Select'}
              onSelect={(card) => (slotOf(card.id) === sheetSlot ? closeSheet() : place(sheetSlot, card.id))}
              onLearn={setLearnCard}
              onClose={closeMenu}
              onReleased={() => setCardIndex((i) => Math.max(0, Math.min(i, roster.length - 2)))}
            />
          )}
          {learnCard && createPortal(<CardReveal kind="player" card={learnCard} learn onContinue={() => setLearnCard(null)} />, document.body)}
          <div className="lb-picker-pager" aria-live="polite">
            <span>{Math.min(cardIndex + 1, roster.length)} / {roster.length}</span>
            <i>{roster.map((card, index) => <b key={card.id} className={index === cardIndex ? 'on' : ''} onClick={() => setCardIndex(index)} />)}</i>
          </div>
        </div>,
        document.body,
      )}

      {createPortal(
        <>
          <div className={'lb-dim' + (sheet?.type === 'plan' ? ' open' : '')} onClick={closeSheet} />
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
        </>,
        document.body,
      )}

      {leavePrompt && createPortal(
        <div className="lb-card-backdrop" role="dialog" aria-modal="true" aria-label="Unsaved lineup changes" onClick={() => setLeavePrompt(null)}>
          <div className="lb-leave" onClick={(event) => event.stopPropagation()}>
            <strong>Unsaved lineup changes</strong>
            <p>{complete ? 'You have changes to your lineup that haven’t been saved. Save before leaving?' : 'Your lineup has changes that haven’t been saved, and it isn’t complete yet. Leave without saving?'}</p>
            <div className="lb-leave-actions">
              {complete && <button type="button" onClick={() => leaveWith(true)}>Save &amp; leave</button>}
              <button type="button" className="secondary" onClick={() => leaveWith(false)}>Discard</button>
              <button type="button" className="secondary" onClick={() => setLeavePrompt(null)}>Keep editing</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <div className={'lb-toast' + (toast ? ' show' : '')} aria-live="polite">{toast}</div>

      {viewCard && (
        <div className="lb-card-backdrop" onClick={() => setViewCard(null)}>
          <div className="lb-card-modal" role="dialog" aria-modal="true" aria-label="Player card" onClick={(e) => e.stopPropagation()}>
            <PlayerCard card={viewCard} rosterLabel={roleLabel(slotOf(viewCard.id))} />
            <button type="button" className="secondary" onClick={() => setViewCard(null)}>Close</button>
          </div>
        </div>
      )}

      {canEdit && (
        <CoachmarkTour
          storageKey={LINEUP_TOUR_KEY}
          steps={[
            { targetRef: courtRef, title: 'Set Your Lineup', body: 'Tap an open spot to add a starter. Start a Guard, a Forward and a Big together to earn the Floor Balance bonus.' },
            ...(plans.length > 0 ? [{ targetRef: gameplanBtnRef, title: 'Pick a Gameplan', body: 'Choose your coach’s primary or secondary Gameplan for a team-wide bonus this season.' }] : []),
            { targetRef: courtRef, title: 'Saved Automatically', body: 'Two starters sharing a Skillset pairing light up a bonus — look for the lines between them. Your lineup saves itself as soon as all five spots are filled.' },
          ]}
        />
      )}
    </div>
  );
}
