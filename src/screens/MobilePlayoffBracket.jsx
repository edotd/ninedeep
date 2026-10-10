import { useEffect, useRef, useState } from 'react';
import { matchTeams, isMatchUnlocked, teamOutput } from '../game/matchup';

// The phone playoff bracket (design: "Rounds as pages"). One page per round — First Round,
// Semis, Final — swiped sideways or picked from the tabs, with the next round peeking in at the
// edge. Your own series leads each page. The screen never scrolls vertically: every page's series
// share its height. Tapping a series selects it and the footer carries that series' actions
// (Begin / Sim / Review …), the same ones the desktop nodes have.

const GAP = 12; // between pages
const ROUNDS = [
  { key: 'first', label: 'FIRST ROUND', title: 'FIRST ROUND', indices: [0, 1, 2, 3] },
  { key: 'semis', label: 'SEMIS', title: 'SEMIS', indices: [4, 5] },
  { key: 'final', label: 'FINAL', title: 'THE FINAL', indices: [6] },
];
const NAMES = { 0: 'Quarterfinal 1', 1: 'Quarterfinal 2', 2: 'Quarterfinal 3', 3: 'Quarterfinal 4', 4: 'Semifinal 1', 5: 'Semifinal 2', 6: 'The Final' };

const fmt = (n) => (n === null || n === undefined ? '—' : n.toFixed(2));
const outputOf = (team) => (team && team.coach && team.activeIds && team.activeIds.length > 0 ? teamOutput(team).total : null);

export default function MobilePlayoffBracket({ state, actions, myTeamId, onOpenSeries, onViewTeam }) {
  const matches = state.playoff.matches;
  const allDone = matches.every((m) => m.result);
  const trackRef = useRef(null);
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState(null);

  const infos = matches.map((m) => {
    const { a, b } = matchTeams(matches, m);
    const humans = [a, b].filter((t) => t?.human);
    return {
      m, a, b, unlocked: isMatchUnlocked(matches, m), humans,
      mine: [a, b].some((t) => t && t.id === myTeamId),
      participant: humans.some((t) => t.id === myTeamId),
      live: Boolean(m.turn && !m.result),
      ready: (m.readyTeamIds || []).includes(myTeamId),
    };
  });

  const defaultIdx = (() => {
    const open = infos.map((x, i) => ({ x, i })).filter(({ x }) => x.unlocked && !x.m.result);
    return (open.find(({ x }) => x.participant) || open[0] || { i: 6 }).i;
  })();
  const selected = picked ?? defaultIdx;
  const panel = () => (trackRef.current?.firstElementChild?.offsetWidth || 354) + GAP;
  const roundOf = (i) => (i < 4 ? 0 : i < 6 ? 1 : 2);

  useEffect(() => {
    const el = trackRef.current;
    if (el) el.scrollLeft = roundOf(defaultIdx) * panel();
    setPage(roundOf(defaultIdx));
    // Only on first show: afterwards the user is the one moving between rounds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (i) => { trackRef.current?.scrollTo({ left: i * panel(), behavior: 'smooth' }); setPage(i); };
  const onScroll = (event) => {
    const i = Math.min(ROUNDS.length - 1, Math.round(event.currentTarget.scrollLeft / panel()));
    if (i !== page) setPage(i);
  };

  // When the last series of a round is decided, swipe on to the next round (after a beat so the
  // result can be read) and let the selection fall back to the next playable series.
  const doneKey = ROUNDS.map((r) => (r.indices.every((n) => matches[n].result) ? '1' : '0')).join('');
  const prevDone = useRef(doneKey);
  useEffect(() => {
    const before = prevDone.current;
    prevDone.current = doneKey;
    const finished = [...doneKey].findIndex((d, i) => d === '1' && before[i] === '0');
    if (finished < 0 || finished >= ROUNDS.length - 1) return undefined;
    const timer = setTimeout(() => { setPicked(null); goTo(finished + 1); }, 650);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneKey]);

  const statusOf = (x) => (!x.unlocked ? 'PENDING' : x.m.result ? 'FINAL' : x.live ? 'LIVE' : 'READY');
  const roundStatus = (r) => {
    const done = r.indices.filter((i) => matches[i].result).length;
    return done === r.indices.length ? 'ALL DECIDED' : `${done} OF ${r.indices.length} DECIDED`;
  };

  const card = (i) => {
    const x = infos[i];
    const result = x.m.result;
    const row = (team) => {
      if (!team) return { seed: '—', name: 'TBD', score: '', empty: true };
      const win = Boolean(result && result.winner === team);
      return {
        seed: team.seed ?? '', name: team.name, win, lost: Boolean(result && !win),
        score: result ? fmt(team === result.a ? result.aSum : result.bSum) : fmt(outputOf(team)),
      };
    };
    const rows = x.unlocked ? [row(x.a), row(x.b)] : [row(null), row(null)];
    const champion = i === 6 && result ? result.winner : null;
    return (
      <button
        key={i}
        type="button"
        className={'pb-card' + (x.mine ? ' mine' : '') + (selected === i ? ' picked' : '')}
        onClick={() => setPicked(i)}
        aria-pressed={selected === i}
        aria-label={`${NAMES[i]}, ${statusOf(x).toLowerCase()}`}
      >
        <span className="pb-card-top"><span>{x.mine ? 'YOUR SERIES · ' : ''}{NAMES[i].toUpperCase()}</span><span className={'pb-status ' + statusOf(x).toLowerCase()}>{champion ? `CHAMPION · ${champion.tricode || champion.name}` : statusOf(x)}</span></span>
        {rows.map((r, k) => (
          <span key={k} className={'pb-row' + (r.win ? ' win' : '') + (r.lost ? ' lost' : '') + (r.empty ? ' empty' : '')}>
            <span className="pb-seed">{r.seed}</span>
            <span className="pb-name">{r.name}</span>
            <span className={'pb-score' + (result ? '' : ' proj')}>{r.score}</span>
          </span>
        ))}
      </button>
    );
  };

  const sel = infos[selected];
  const btn = (() => {
    const { m, unlocked, humans, participant, live, ready } = sel;
    const open = () => onOpenSeries(selected);
    if (!unlocked) return { primary: { label: 'LOCKED', disabled: true } };
    if (m.result) return { primary: { label: 'REVIEW', run: open } };
    if (live) return { primary: { label: 'JOIN LIVE SERIES', run: open } };
    if (humans.length === 2) return participant ? { primary: { label: ready ? 'WAITING FOR OPPONENT' : 'READY UP', disabled: ready, run: open } } : { primary: { label: 'PLAYERS MUST READY UP', disabled: true } };
    if (humans.length === 1 && !participant) return { primary: { label: 'WAITING FOR PLAYER', disabled: true } };
    return { primary: { label: selected === 6 ? 'BEGIN THE FINAL' : 'BEGIN', run: open }, secondary: { label: 'SIM', run: () => actions.simulateOneMatch(selected, myTeamId) } };
  })();

  return (
    <div className="screen bracket-screen pb-screen" role="region" aria-label="Playoff bracket">
      <div className="pb-tabs">
        {ROUNDS.map((r, i) => <button key={r.key} type="button" className={page === i ? 'on' : ''} onClick={() => goTo(i)}>{r.label}{r.indices.every((n) => matches[n].result) ? ' ✓' : ''}</button>)}
      </div>

      <div className="pb-track" ref={trackRef} onScroll={onScroll}>
        {ROUNDS.map((r) => (
          <div className="pb-page" key={r.key}>
            <div className="pb-page-head"><span>{r.title} · {r.indices.length === 1 ? 'ONE SERIES' : `${r.indices.length} SERIES`}</span><span>{roundStatus(r)}</span></div>
            {/* Your own series leads the page; the rest keep bracket order. */}
            {r.indices.slice().sort((p, q) => Number(infos[q].mine) - Number(infos[p].mine)).map(card)}
          </div>
        ))}
      </div>

      <div className="pb-foot">
        <div className="pb-foot-line">
          <span>{NAMES[selected].toUpperCase()}</span>
          {!allDone ? <button type="button" className="pb-link" onClick={() => actions.simulateAllPlayoffs(myTeamId)}>SIMULATE CPU SERIES ▸▸</button> : <span className="pb-foot-done">ALL SERIES DECIDED</span>}
        </div>
        <div className="pb-foot-btns">
          {onViewTeam && <button type="button" className="pb-btn ghost" onClick={() => onViewTeam(myTeamId)}>TEAM FILE</button>}
          {btn.secondary && <button type="button" className="pb-btn ghost" onClick={btn.secondary.run}>{btn.secondary.label}</button>}
          <button type="button" className="pb-btn solid" disabled={btn.primary.disabled} onClick={btn.primary.run}>{btn.primary.label}</button>
          {allDone && <button type="button" className="pb-btn accent" onClick={actions.finishPlayoffs}>SEE RESULTS</button>}
        </div>
      </div>
    </div>
  );
}
