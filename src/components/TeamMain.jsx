import { jerseyNumber, retentionBonus, relationshipBonus } from '../game/cards';
import { formatCoins } from '../game/economy';
import { teamOutput } from '../game/matchup';
import { teamSynergy } from '../game/skillsets';

// The Team page's main index (design: Team · Main) — one screen that answers "how good are we
// and what does it cost", then hands off to the sub pages: Lineup & Chemistry, Coach, GM and
// Budget. Each tile opens its page via `onOpen`. The franchise name, era clock and titles the
// design also shows in its header already live in the persistent masthead above every screen,
// so they aren't repeated here.

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

const ordinal = (n) => {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? 'TH' : ({ 1: 'ST', 2: 'ND', 3: 'RD' }[n % 10] || 'TH');
  return `${n}${suffix}`;
};

const initials = (name) => name.replace(/&/g, ' ').split(/[\s-]+/).filter((w) => w && !/^(the|of|and)$/i.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
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

const colX = (i) => `calc((100% - 30px) / 7 * ${i + 0.5} + ${4 * i}px)`;

function gmHeadline(team) {
  const trait = team.gmTrait;
  if (!trait) return { name: 'Neutral', stat: '—' };
  const stat = trait.name === 'Third Eye' ? 'PEAK VIEW'
    : trait.name === 'Cap Architect' ? `+${trim(trait.value)} BUDGET`
      : trait.name === 'Talent Hawk' ? `+${trait.value} SCOUTED`
        : `+${(trait.value || 0) * 2}%`;
  return { name: trait.name, stat };
}

function Tile({ sub, onOpen, className = '', children, label }) {
  return <button type="button" className={`tm-tile ${className}`} onClick={() => onOpen(sub)} aria-label={label}>{children}</button>;
}

export default function TeamMain({ state, team, readOnly, onOpen, committed, cap, budgetSources }) {
  const activeSet = new Set(team.activeIds || []);
  const starters = (team.hand || []).filter((card) => activeSet.has(card.id))
    .sort((a, b) => (POSITION_ORDER[a.position] ?? 9) - (POSITION_ORDER[b.position] ?? 9));
  const bench = (team.hand || []).filter((card) => !activeSet.has(card.id));
  const sixth = bench.find((card) => card.id === team.sixthManId) || bench[0] || null;
  const depth = bench.find((card) => card !== sixth) || null;
  const lineupReady = !!team.coach && starters.length === 5 && team.lineupSet;

  const synergy = lineupReady ? teamSynergy(team) : null;
  const seal = synergy ? gradeSeal(synergy.grade) : { color: '#A79A78', ink: '#F2EBDC' };

  // Rank this franchise among every franchise with a set lineup.
  const outputs = state.teams.map((t) => (t.coach && t.activeIds?.length === 5 && t.lineupSet ? teamOutput(t) : null));
  const mine = lineupReady ? teamOutput(team) : null;
  const projection = (key, label) => {
    if (!mine) return { label, value: '—', rank: null };
    const field = outputs.filter(Boolean);
    const rank = field.filter((o) => o[key] > mine[key]).length + 1;
    return { label, value: mine[key], rank, of: field.length, good: rank <= Math.ceil(field.length / 2) };
  };
  const projections = [projection('off', 'PROJ OFF'), projection('def', 'PROJ DEF'), projection('bench', 'BENCH')];
  const topStarter = mine ? starters.reduce((best, card, i) => ((card.stats?.SCO + card.stats?.PLM + card.stats?.REB + card.stats?.DEF) > best.total ? { i, total: card.stats.SCO + card.stats.PLM + card.stats.REB + card.stats.DEF } : best), { i: -1, total: -1 }).i : -1;

  const indexOfSkill = (skillId) => starters.findIndex((card) => card.skillsetId === skillId);
  const pairs = (synergy?.pairs || []).map((rule) => ({ rule, at: rule.skills.map(indexOfSkill) })).filter((p) => p.at.every((i) => i >= 0));
  const brackets = bracketLayout(pairs.map((p) => p.at));
  const maxLevel = brackets.reduce((m, b) => Math.max(m, b.level), 0);
  const shownPairs = [...pairs].sort((a, b) => b.rule.percent - a.rule.percent).slice(0, 3);

  const coach = team.coach;
  const bonus = coach ? retentionBonus(team) + relationshipBonus(team) : 0;
  const gm = team.gmType ? gmHeadline(team) : null;

  const room = cap - committed;
  const span = Math.max(cap, committed) || 1;
  const budgetSegments = [
    ...budgetSources.map((s) => ({ key: s.key, amount: s.amount })),
    ...(room > 0 ? [{ key: 'room', amount: room }] : []),
  ];

  return (
    <div className="tm-main">
      <div className="tm-projections">
        {projections.map((p) => (
          <div className="tm-proj" key={p.label}>
            <span className="tm-proj-label">{p.label}</span>
            <strong>{p.value}</strong>
            <small className={p.rank == null ? '' : p.good ? 'good' : 'bad'}>{p.rank == null ? 'SET LINEUP' : `${ordinal(p.rank)} OF ${p.of}`}</small>
          </div>
        ))}
      </div>

      <div className="tm-tiles">
        <Tile onOpen={onOpen} sub="lineup" className="tm-lineup" label="Lineup and chemistry">
          <span className="tm-seal" style={{ background: seal.color, color: seal.ink }}>{synergy ? synergy.grade : '—'}</span>
          <span className="tm-tile-head"><b>Lineup &amp; Chemistry</b><i>›</i></span>
          <span className="tm-roster">
            <span className="tm-roster-row">
              {Array.from({ length: 5 }, (_, i) => {
                const card = starters[i];
                return <span key={i} className={'tm-num' + (i === topStarter ? ' top' : '') + (card ? '' : ' empty')}>{card ? jerseyNumber(card) : '—'}</span>;
              })}
              <span className="tm-gap" />
              <span className="tm-bench"><span className="tm-num bench">{sixth ? jerseyNumber(sixth) : '—'}</span><small>6TH</small></span>
              <span className="tm-bench"><span className="tm-num bench">{depth ? jerseyNumber(depth) : '—'}</span><small>DEPTH</small></span>
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
            <span className="tm-chips">
              {shownPairs.length ? shownPairs.map(({ rule }) => (
                <span className="tm-chip" key={rule.name}><b className={rule.side}>{initials(rule.name)}</b><em>{rule.name}</em></span>
              )) : <span className="tm-chip none">{lineupReady ? 'No pairings active' : 'Set your lineup to see pairings'}</span>}
            </span>
          </span>
        </Tile>

        <div className="tm-pair">
          <Tile onOpen={onOpen} sub="coach" className={'tm-fo coach' + (coach ? ` rarity-${coach.rarity || 'Core'}` : '')} label="Coach">
            <span className="tm-fo-head"><b>COACH</b><i>›</i></span>
            <strong>{coach ? coach.archetype : 'Open Slot'}</strong>
            <span className="tm-fo-stat">{coach ? <><span>{`+${Math.round((coach.offBonus + bonus) * 100)}% OFF`}</span><span>{`+${Math.round((coach.defBonus + bonus) * 100)}% DEF`}</span></> : 'Hire in Free Agency'}</span>
          </Tile>
          <Tile onOpen={onOpen} sub="gm" className="tm-fo gm" label="General manager">
            <span className="tm-fo-head"><b>GM</b><i>›</i></span>
            <strong>{gm ? gm.name : 'Open Slot'}</strong>
            <span className="tm-fo-stat">{gm ? gm.stat : '—'}</span>
          </Tile>
        </div>

        <Tile onOpen={onOpen} sub="budget" className="tm-budget" label="Budget">
          <span className="tm-tile-head"><b>BUDGET</b><i>›</i></span>
          <span className={'tm-budget-nums' + (room < 0 ? ' over' : '')}><strong>{trim(committed)}</strong><em>/ {trim(cap)}</em></span>
          <span className="tm-budget-bar">
            {budgetSegments.map((s) => <i key={s.key} className={s.key} style={{ width: `${(s.amount / span) * 100}%` }} />)}
          </span>
          {room < 0 && <small className="tm-over">Over budget by {formatCoins(-room)}</small>}
        </Tile>
      </div>
      {readOnly && <p className="tm-readonly">Viewing another franchise — read only.</p>}
    </div>
  );
}
