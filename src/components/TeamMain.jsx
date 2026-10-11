import { useRef, useState } from 'react';
import { playerGrade } from '../game/cards';
import PlayerCard from './PlayerCard';
import { formatCoins } from '../game/economy';
import { teamSynergy, SKILLSETS } from '../game/skillsets';
import BonusIcon from './BonusIcon';
import BallMark from './BallMark';

// The Team page's main index (design: Team · Main) — one tile per sub page: Lineup & Chemistry,
// Scouting Report and Manage Budget (Coach and GM live in the bottom bar). Each tile opens its page via `onOpen`. The design's header (franchise
// name, era clock, titles, projected output / defense / bench) already lives in the persistent
// masthead above every screen, so it isn't repeated here.

const POSITION_ORDER = { Guard: 0, Forward: 1, Big: 2 };
// The chemistry grades the game produces (game/chemistry.js), lowest to highest.
const GRADE_SCALE = ['F', 'D−', 'D', 'D+', 'C−', 'C', 'C+', 'B−', 'B', 'B+', 'A−', 'A', 'A+'];

// Red -> green by grade, light in the middle of the scale (the design's own formula).
function gradeSeal(grade) {
  const t = Math.max(0, GRADE_SCALE.indexOf(grade)) / (GRADE_SCALE.length - 1);
  const hue = 28 + t * (148 - 28);
  const L = 0.62 + 0.2 * Math.sin(Math.PI * t);
  const C = 0.19 - 0.03 * Math.sin(Math.PI * t);
  return { color: `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${hue.toFixed(0)})`, ink: L > 0.72 ? '#1E2B47' : '#F2EBDC' };
}

// What a pairing needs, in words: the two Skillsets that have to start together.
const skillName = (id) => SKILLSETS.find((s) => s.id === id)?.name || id;
const pairDescription = (rule) => `Earned when a starter with ${skillName(rule.skills[0])} and a starter with ${skillName(rule.skills[1])} are in your lineup together. Adds ${rule.percent}% to your team's ${rule.side}.`;
const trim = (n) => `${Number(Number(n).toFixed(2))}`;

// Pairing brackets under the starters: a stub down from each paired starter joined by a bar,
// nested so brackets that span others sit lower and never cross.
function bracketLayout(pairs) {
  const items = pairs.map(([a, b]) => ({ lo: Math.min(a, b), hi: Math.max(a, b) })).sort((x, y) => (x.hi - x.lo) - (y.hi - y.lo));
  const placed = [];
  for (const item of items) {
    const level = placed.filter((p) => p.lo <= item.hi && item.lo <= p.hi).reduce((m, p) => Math.max(m, p.level + 1), 0);
    placed.push({ ...item, level });
  }
  return placed;
}

// Centre of starter box i in the left-aligned row of five (box width --w, gap --g, set on .tm-roster).
const colX = (i) => `calc(${i} * (var(--w) + var(--g)) + var(--w) / 2)`;


// One lineup box: empty outline until the lineup is set, then the player's letter grade — tap it
// to pull up their card.
function PlayerBox({ card, top, bench, onPick }) {
  if (!card) return <span className={'tm-num empty' + (bench ? ' bench' : '')} aria-hidden="true" />;
  return (
    <button
      type="button"
      className={'tm-num' + (top ? ' top' : '') + (bench ? ' bench' : '')}
      aria-label={`${card.archetype} ${card.position}, grade ${playerGrade(card)}. Show card.`}
      onClick={(event) => { event.stopPropagation(); onPick(card); }}
    >{playerGrade(card)}</button>
  );
}

// A touch only counts as a tap if the finger stays put. Once it travels past this many pixels it
// is a swipe (page scroll, or the Team/League tab swipe): the press scale lifts and the click
// that may follow is ignored.
const TAP_SLOP = 10;

// Press feedback + tap/swipe separation shared by every tile. Returns the props to spread on the
// tile element; `onActivate` only fires for a real tap.
function usePressable(onActivate) {
  const [pressed, setPressed] = useState(false);
  const origin = useRef(null);
  const swiped = useRef(false);
  return {
    pressed,
    props: {
      onPointerDown: (event) => {
        if (event.target.closest('.tm-num, .tm-pair-icon, .tm-pair-desc')) return;
        origin.current = { x: event.clientX, y: event.clientY };
        swiped.current = false;
        setPressed(true);
      },
      onPointerMove: (event) => {
        if (!origin.current || swiped.current) return;
        if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > TAP_SLOP) {
          swiped.current = true;
          setPressed(false);
        }
      },
      onPointerUp: () => { origin.current = null; setPressed(false); },
      onPointerCancel: () => { swiped.current = true; origin.current = null; setPressed(false); },
      onPointerLeave: () => { origin.current = null; setPressed(false); },
      onClick: (event) => {
        if (swiped.current) { swiped.current = false; return; }
        onActivate(event);
      },
    },
  };
}

function Tile({ sub, onOpen, className = '', children, label }) {
  const { pressed, props } = usePressable(() => onOpen(sub));
  return <button type="button" className={`tm-tile ${className}${pressed ? ' pressed' : ''}`} aria-label={label} {...props}>{children}</button>;
}

export default function TeamMain({ team, readOnly, onOpen, committed, cap, budgetSources }) {
  const lineupPress = usePressable(() => onOpen('lineup'));
  const [picked, setPicked] = useState(null);
  const [openPair, setOpenPair] = useState(null);
  const [lastPair, setLastPair] = useState(null);
  const togglePair = (name) => { setLastPair(name); setOpenPair((v) => (v === name ? null : name)); };
  const activeSet = new Set(team.activeIds || []);
  const starters = (team.hand || []).filter((card) => activeSet.has(card.id))
    .sort((a, b) => (POSITION_ORDER[a.position] ?? 9) - (POSITION_ORDER[b.position] ?? 9));
  const bench = (team.hand || []).filter((card) => !activeSet.has(card.id));
  const sixth = bench.find((card) => card.id === team.sixthManId) || bench[0] || null;
  const depth = bench.find((card) => card !== sixth) || null;
  const lineupReady = !!team.coach && starters.length === 5 && team.lineupSet;

  const synergy = lineupReady ? teamSynergy(team) : null;
  const seal = synergy ? gradeSeal(synergy.grade) : { color: '#A79A78', ink: '#F2EBDC' };

  const topStarter = lineupReady
    ? starters.reduce((best, card, i) => {
      const total = card.stats.SCO + card.stats.PLM + card.stats.REB + card.stats.DEF;
      return total > best.total ? { i, total } : best;
    }, { i: -1, total: -1 }).i
    : -1;

  const indexOfSkill = (skillId) => starters.findIndex((card) => card.skillsetId === skillId);
  const pairs = (synergy?.pairs || []).map((rule) => ({ rule, at: rule.skills.map(indexOfSkill) })).filter((p) => p.at.every((i) => i >= 0));
  const brackets = bracketLayout(pairs.map((p) => p.at));
  const maxLevel = brackets.reduce((m, b) => Math.max(m, b.level), 0);
  // Wise Veteran and Floor Balance aren't skillset pairings, so they're added after the pairings
  // (no bracket) as icons of their own.
  const extras = [
    synergy?.floorBalance ? { rule: { name: 'Floor Balance', side: 'both', percent: synergy.floorBalance, description: 'A Guard, a Forward and a Big are all starting.' }, at: [] } : null,
    synergy?.leadership ? { rule: { name: 'Wise Veteran', side: 'both', percent: synergy.leadership, description: 'A Wise Veteran is on your roster. Doesn’t stack.' }, at: [] } : null,
  ].filter(Boolean);
  const shownPairs = [...[...pairs].sort((a, b) => b.rule.percent - a.rule.percent), ...extras];
  const openPairRule = shownPairs.find(({ rule }) => rule.name === openPair)?.rule || null;
  const shownRule = shownPairs.find(({ rule }) => rule.name === (openPair || lastPair))?.rule || null;

  const room = cap - committed;
  const span = Math.max(cap, committed) || 1;
  const budgetSegments = [
    ...budgetSources.map((s) => ({ key: s.key, amount: s.amount })),
    ...(room > 0 ? [{ key: 'room', amount: room }] : []),
  ];

  return (
    <div className="tm-main">
      <div className="tm-tiles">
        <div className={'tm-tile tm-lineup' + (lineupPress.pressed ? ' pressed' : '')} role="button" tabIndex={0} aria-label="Team" {...lineupPress.props} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen('lineup'); } }}>
          <span className="tm-roster">
            <span className="tm-grade" style={{ color: seal.color }} aria-label={synergy ? `Team grade ${synergy.grade}` : 'No team grade yet'}>{synergy ? synergy.grade : <BallMark size={64} variant="onFile" />}</span>
            <span className="tm-roster-row">
              {Array.from({ length: 5 }, (_, i) => <PlayerBox key={i} card={lineupReady ? starters[i] : null} top={i === topStarter} onPick={setPicked} />)}
            </span>
            {brackets.length > 0 && (
              <span className="tm-brackets" style={{ height: 14 + maxLevel * 12 + 14 }}>
                {brackets.map((b, i) => {
                  const h = 14 + b.level * 12;
                  return (
                    <span key={i}>
                      <i className="tm-stub" style={{ left: colX(b.lo), height: h }} />
                      <i className="tm-stub" style={{ left: colX(b.hi), height: h }} />
                      <i className="tm-bar" style={{ left: colX(b.lo), width: `calc(${colX(b.hi)} - ${colX(b.lo)} + 2px)`, top: h - 1 }} />
                    </span>
                  );
                })}
              </span>
            )}
            <span className="tm-roster-row tm-bench-row">
              <span className="tm-bench"><PlayerBox card={lineupReady ? sixth : null} bench onPick={setPicked} /><small>6TH</small></span>
              <span className="tm-bench"><PlayerBox card={lineupReady ? depth : null} bench onPick={setPicked} /><small>DEPTH</small></span>
            </span>
            <span className="tm-chips-wrap">
            <span className="tm-chips">
              {shownPairs.length ? shownPairs.map(({ rule }) => (
                <span
                  className={'tm-pair-icon' + (openPair === rule.name ? ' open' : '')}
                  key={rule.name}
                  role="button"
                  tabIndex={0}
                  aria-label={`${rule.name}. Show description.`}
                  aria-pressed={openPair === rule.name}
                  onClick={(event) => { event.stopPropagation(); togglePair(rule.name); }}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); togglePair(rule.name); } }}
                ><BonusIcon name={rule.name} size={44} /></span>
              )) : lineupReady ? <span className="tm-chip none">No pairings active</span> : null}
            </span>
            {/* A flyout under the icons: it overlays what follows instead of pushing the page taller,
                and slides open/closed. It keeps the last pairing's text so it can slide away. */}
            <span className={'tm-pair-desc' + (openPairRule ? ' open' : '')} aria-hidden={!openPairRule} onClick={(event) => event.stopPropagation()}>
              {shownRule && (
                <>
                  <b className={shownRule.side}>{shownRule.name}</b>
                  <em>+{shownRule.percent}% {shownRule.side === 'offense' ? 'Offense' : shownRule.side === 'defense' ? 'Defense' : 'Offense & Defense'}</em>
                  <small>{shownRule.description || pairDescription(shownRule)}</small>
                </>
              )}
            </span>
            </span>
          </span>
        </div>

        <Tile onOpen={onOpen} sub="scouting" className="tm-scout" label="Scouting report">
          <span className="tm-tile-head"><b>SCOUTING REPORT</b><i>›</i></span>
          <span className="tm-scout-count"><strong>{(team.scoutingReport || []).length}</strong><em>{(team.scoutingReport || []).length === 1 ? 'player tracked' : 'players tracked'}</em></span>
        </Tile>

        <Tile onOpen={onOpen} sub="budget" className="tm-budget" label="Manage budget">
          <span className="tm-tile-head"><b>BUDGET</b><i>›</i></span>
          <span className={'tm-budget-nums' + (room < 0 ? ' over' : '')}><strong>{trim(committed)}</strong><em>/ {trim(cap)}</em></span>
          <span className="tm-budget-bar">
            {budgetSegments.map((s) => <i key={s.key} className={s.key} style={{ width: `${(s.amount / span) * 100}%` }} />)}
          </span>
          {room < 0 && <small className="tm-over">Over budget by {formatCoins(-room)}</small>}
        </Tile>

      </div>
      {picked && (
        <div className="tm-card-backdrop" role="presentation" onClick={() => setPicked(null)}>
          <div className="tm-card-modal" role="dialog" aria-modal="true" aria-label={`${picked.archetype} card`} onClick={(event) => event.stopPropagation()}>
            <PlayerCard card={picked} />
            <button type="button" className="secondary" onClick={() => setPicked(null)}>Close</button>
          </div>
        </div>
      )}
      {readOnly && <p className="tm-readonly">Viewing another franchise — read only.</p>}
    </div>
  );
}
