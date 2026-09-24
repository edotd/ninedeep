import { useEffect, useRef, useState } from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import TeamChemistry from '../components/TeamChemistry';
import SetLineupScreen from '../components/SetLineupScreen';
import PlayerCard from '../components/PlayerCard';
import FrontOfficeCard from '../components/FrontOfficeCard';
import { PlayerLedgerIdentity, CostBlocks } from '../components/LedgerRow';
import { formatCoins, rosterSalary, gmCost } from '../game/economy';
import { FANBASE_BOOST_COST } from '../game/constants';
import MatchupCard from '../components/MatchupCard';
import StrategyCard from '../components/StrategyCard';
import CardBack from '../components/CardBack';

const tabForSection = (section) => ['gameplan', 'adjustment'].includes(section) ? 'office' : section || 'rotation';

// Front Office / Development / Gameplan / Adjustment each render as one horizontally-scrolling
// row of same-kind cards on mobile. Two or fewer fit the screen outright (no scrolling needed,
// so no hint either) — more than that scrolls, with the same peek-style chevron hint used
// elsewhere in the Team File so it's clear there's more to swipe to. atEnd starts true for a
// row that never needed scrolling in the first place (count <= 2).
function useRowEnd(count) {
  const [atEnd, setAtEnd] = useState(count <= 2);
  useEffect(() => { setAtEnd(count <= 2); }, [count]);
  const onScroll = (event) => {
    const el = event.currentTarget;
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  };
  return { atEnd, onScroll, scrolls: count > 2 };
}

function RowSwipeHint({ row }) {
  if (!row.scrolls || row.atEnd) return null;
  return <div className="row-swipe-hint" aria-hidden="true"><span className="row-swipe-hint-chevron">›</span></div>;
}

function StrategyAction({ card, team, state, actions, myTeamId, readOnly }) {
  const [targetId, setTargetId] = useState('');
  if (readOnly || card.used) return null;
  if (card.kind === 'development') {
    const eligible = team.hand.filter((player) => !player.development);
    return (
      <div className="strategy-card-action">
        <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
          <option value="">Choose player</option>
          {eligible.map((player) => <option key={player.id} value={player.id}>{player.position} · {player.archetype} · #{player.id}</option>)}
        </select>
        <button className="secondary" disabled={!targetId} onClick={() => actions.applyDevelopmentCard(myTeamId, card.id, targetId)}>Apply</button>
      </div>
    );
  }
  const liveMatch = (state.playoff?.matches || []).find((match) => match.turn && !match.result && (match.a === team || match.b === team));
  const playoffReady = liveMatch?.turn && ['coinflip', 'coinflipped'].includes(liveMatch.turn.stage);
  const seasonOpen = ['pullhand', 'pullmodifier', 'constructing', 'teamsummary'].includes(state.phase);
  const context = playoffReady && card.contexts.includes('playoff') ? 'playoff' : seasonOpen && card.contexts.includes('season') ? 'season' : null;
  const alreadyActive = (team.gameplanCards || []).some((c) => c.used && c.id !== card.id);
  const opponents = state.teams.filter((candidate) => candidate.id !== team.id);
  const needsTarget = card.target === 'opponent' && context === 'season';
  return (
    <div className="strategy-card-action">
      {needsTarget && <select value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">Choose opponent</option>{opponents.map((opponent) => <option key={opponent.id} value={opponent.id}>{opponent.name}</option>)}</select>}
      <button className="secondary" disabled={!context || alreadyActive || (needsTarget && !targetId)} onClick={() => actions.playGameplanCard(myTeamId, card.id, context, needsTarget ? targetId : null)}>{alreadyActive ? 'Another Is Active' : context === 'playoff' ? 'Use In Matchup' : context === 'season' ? 'Use Now' : 'Unavailable'}</button>
    </div>
  );
}

// The Team Summary screen — "the file the league keeps on you" (design brand handoff, 1a).
// Serves two roles from the same markup: as the 'teamsummary' phase (shown once per season,
// after the Adjustment Cards pull and the Constructing loading beat — its own button confirms
// the season on the auto-selected five, the last stop before the season locks), and — when
// passed `onBack` — as the "Team" overlay reachable from the sidebar/top bar on any phase,
// where the button instead just closes the overlay and the front-office moves (fire/hire
// coach, fire GM, invest in fanbase — all funded out of budget room) are available. Passing
// `viewTeamId` (set by clicking another team in Standings) shows that team's file instead of
// the caller's own — fully read-only, since every mutation here always targets `myTeamId`
// regardless of whose file is on screen.
// Read-only otherwise, organised by category: rotation, budget ledger, front office. No
// nine-slot navigation here (that's the persistent bar's job on every other screen).
export default function TeamSummaryScreen({ state, actions, myTeamId, viewTeamId, onBack, focusSection, onFreeAgency }) {
  // viewTeamId lets this screen show a DIFFERENT team's file — reached by clicking a team in
  // Standings — read-only: no substitutions, releases, or front-office moves, since those
  // actions always take myTeamId regardless of which file is on screen.
  const readOnly = viewTeamId != null && viewTeamId !== myTeamId;
  const team = state.teams[readOnly ? viewTeamId : myTeamId];
  // The outgoing coach's dead cap is exact; the incoming hire's salary (also charged this
  // season, on top of it) is drawn fresh when the button is clicked, so it isn't part of
  // this figure.
  const fireCoachDeadCap = team.coach ? Math.round((team.coach.salary / 2) * 100) / 100 : 0;
  const deadCapDue = (team.deadCap || []).reduce((s, c) => s + c.amount, 0);
  const activeSet = new Set(team.activeIds || []);
  const starters = team.hand.filter((c) => activeSet.has(c.id));
  const bench = team.hand.filter((c) => !activeSet.has(c.id));
  const starterOpenSlots = Math.max(0, 5 - starters.length);
  const benchOpenSlots = Math.max(0, 4 - bench.length);
  const otherHumans = state.teams.filter((t) => t.human && t.id !== team.id);
  const waitingOn = otherHumans.filter((t) => !t.lineupConfirmed);

  const committed = rosterSalary(team);
  const cap = team.seasonCap || 0;
  const room = cap - committed;
  const expiring = team.hand.filter((c) => c.contract <= 1);
  const playerCost = team.hand.reduce((sum, card) => sum + card.salary, 0);
  const coachCost = team.coach?.salary || 0;
  const managerCost = team.gmType ? gmCost(team.gmType) : 0;
  const budgetSources = [
    { key: 'players', label: 'Players', amount: playerCost },
    { key: 'coach', label: 'Coach', amount: coachCost },
    { key: 'gm', label: 'GM', amount: managerCost },
    { key: 'dead', label: 'Dead Cap', amount: deadCapDue },
  ].filter((source) => source.amount > 0);

  // Reached either as the 'teamsummary' phase screen proper, or — for the era-opening deal —
  // locally, the instant this client moves past its own DealScreen while state.phase is still
  // 'pullhand' (every other human may still be on their own deal animation; see GameShell's
  // pastDeal). Both are "the roster review before the season locks," so every phase check
  // below treats them the same.
  const preSeason = state.phase === 'teamsummary' || state.phase === 'pullhand';
  const canEdit = !readOnly && preSeason && !team.lineupConfirmed;

  // Mobile-only tab bar (per the brand handoff's mobile Team File — Rotation/Chemistry/
  // Office/Ledger) — on desktop every section still shows stacked in one scroll, same as
  // before; `isDesktop` just decides whether `tab` actually filters anything.
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState(() => tabForSection(focusSection?.section));
  const showSection = (key) => isDesktop || tab === key;
  const showStaffCards = isDesktop || tab === 'office';
  const foItemCount = 2 + (state.settings.fanbaseCardsEnabled !== false ? 1 : 0); // coach + market, plus fanbase when on
  const foRow = useRowEnd(foItemCount);
  const devRow = useRowEnd((team.developmentCards || []).length);
  const gameplanRow = useRowEnd((team.gameplanCards || []).length);
  const adjRow = useRowEnd((team.matchupCards || []).length);
  useEffect(() => {
    if (!focusSection) return;
    setTab(tabForSection(focusSection.section));
    const targetId = focusSection.section === 'office'
      ? 'team-coach-card'
      : ['gameplan', 'adjustment'].includes(focusSection.section) ? `team-${focusSection.section}-cards` : `team-${focusSection.section}`;
    requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({
      behavior: 'smooth',
      block: focusSection.section === 'office' ? 'center' : 'start',
      inline: 'center',
    }));
  }, [focusSection]);

  // Substitutions: click a starter then a bench player (either order) to swap them, click the
  // same card again to deselect, or a different card in the same group to move the selection
  // instead. If a starting slot is actually open (activeIds under 5 — only reachable right
  // after releasing an active starter), there's no outgoing player to pick, so a bare click on
  // any bench card fills it directly via promoteToStarter instead of requiring a selection.
  const [selectedId, setSelectedId] = useState(null);
  const [developPlayer, setDevelopPlayer] = useState(null);
  const [lineupScreenOpen, setLineupScreenOpen] = useState(false);
  const [rotationIndex, setRotationIndex] = useState(0);
  // Players tab view — 'carousel' is the existing one-card-per-swipe locked view; 'list' is a
  // plain scrolling stack of full cards (Release/Develop shown inline instead of behind a
  // hold/expand, since there's no scale-to-fit height to protect outside the carousel).
  const [viewMode, setViewMode] = useState('carousel');
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  useEffect(() => { if (tab !== 'rotation') setViewMenuOpen(false); }, [tab]);
  useEffect(() => { setSelectedId(null); setRotationIndex(0); }, [team.id, canEdit]);
  // Mobile's rotation carousel is one card per swipe (starters then bench, in that order —
  // see the JSX below) — this is how many pages it actually has, so the "more cards" chevron
  // knows when to disappear and the end-of-carousel swipe knows when it's actually at the end.
  const mobileCardCount = starters.length + starterOpenSlots + bench.length + benchOpenSlots;
  const rotationTouchStartX = useRef(null);
  const rotoScrollRef = useRef(null);
  // The scroll container unmounts whenever another tab is showing (showSection below), so its
  // native scrollLeft is gone by the time you swipe back — landing back on card one instead of
  // wherever you left off. Re-derive it from the persisted rotationIndex every time this tab
  // becomes active again, whether that's a tap on the Hand tab or a swipe back into it.
  useEffect(() => {
    if (isDesktop || tab !== 'rotation' || !rotoScrollRef.current) return;
    rotoScrollRef.current.scrollLeft = rotationIndex * (rotoScrollRef.current.scrollWidth / mobileCardCount);
    // Only ever needs to run when this tab becomes active, not on every rotationIndex tick
    // (that would fight the user's own in-progress swipe).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isDesktop]);
  // A card never stretches to fill its slot (see .ts-roto-slot in index.css) — it sits at its
  // own natural, capped width/height. But that natural height can still be taller than the
  // space the locked screen actually has for it (a dev-card note, an all-league tag, a longer
  // bio all add up), so measure every card's own natural (untransformed) height against what's
  // available and, only when it's taller, shrink the WHOLE card uniformly (never just one axis,
  // which would distort it) to fit exactly. Each card gets its OWN scale rather than one shared
  // worst-case value, so a short card stays at its natural size instead of shrinking to match
  // its tallest neighbor. offsetHeight/clientHeight are layout measurements, unaffected by a
  // transform already applied, so this is safe to re-run without resetting first.
  useEffect(() => {
    if (isDesktop || tab !== 'rotation' || !rotoScrollRef.current) return undefined;
    const container = rotoScrollRef.current;
    const applyScales = () => {
      const available = container.clientHeight;
      if (!available) return;
      container.querySelectorAll('.ts-roto-grid .pcard').forEach((el) => {
        const natural = el.offsetHeight;
        const scale = natural > available ? available / natural : 1;
        el.style.transform = scale < 1 ? `scale(${scale})` : 'none';
      });
    };
    applyScales();
    const observer = new ResizeObserver(applyScales);
    observer.observe(container);
    return () => observer.disconnect();
  }, [isDesktop, tab, team.hand]);
  const handleRotationTouchStart = (event) => { rotationTouchStartX.current = event.touches[0].clientX; };
  // Swiping further forward while already on the carousel's last card reads as "done with the
  // rotation" — hand it off to the Chemistry tab (the next one in the bar) instead of just
  // bouncing off the end of the scroll the way a native carousel would.
  const handleRotationTouchEnd = (event) => {
    const startX = rotationTouchStartX.current;
    rotationTouchStartX.current = null;
    if (startX == null) return;
    const el = event.currentTarget;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    if (!atEnd) return;
    const deltaX = startX - event.changedTouches[0].clientX;
    if (deltaX > 40) setTab('chemistry');
  };
  // Swipe anywhere in the body to move between tabs, on any tab except Rotation (that one
  // already owns left/right for its own card-to-card carousel, including the hand-off into
  // Chemistry past the last card — see handleRotationTouchStart/End above). Bails out for a
  // touch that starts inside a child modal or horizontal scroller (their gestures belong to
  // that surface, even though they bubble through this body handler) — an earlier
  // version tried gating this by requiring the touch to START within ~32px of the screen edge
  // instead, which also blocked the ordinary case of swiping back to Rotation from the middle
  // of the Chemistry tab, where nothing actually conflicts.
  const TAB_ORDER = ['rotation', 'chemistry', team.market ? 'office' : null, 'ledger'].filter(Boolean);
  const bodyTouchStartX = useRef(null);
  const tabbarRef = useRef(null);
  const underlineRef = useRef(null);
  // Moves the single sliding underline to sit under TAB_ORDER[index]. `animate` toggles the
  // CSS transition off for a live drag (where the underline should track the finger 1:1, with
  // no lag) and on for a settle — either a normal tap-to-switch, or the snap-to-rest at the end
  // of a drag (design ref Screen 05 swipe rule 04: "the amber underline tracks the finger").
  const positionUnderline = (index, animate) => {
    const bar = tabbarRef.current;
    const underline = underlineRef.current;
    if (!bar || !underline) return;
    const btn = bar.querySelectorAll(':scope > .ts-tab')[index];
    if (!btn) return;
    underline.style.transition = animate ? '' : 'none';
    underline.style.left = btn.offsetLeft + 'px';
    underline.style.width = btn.offsetWidth + 'px';
  };
  useEffect(() => {
    if (isDesktop) return;
    positionUnderline(TAB_ORDER.indexOf(tab), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isDesktop, team.market]);
  const handleBodyTouchStart = (event) => {
    const ownsHorizontalGesture = event.target.closest(
      '.ts-roto-scroll, .development-picker, .tsx-overlay, .row-scroll, .strategy-deal-row, .ts-cost-blocks',
    );
    if (ownsHorizontalGesture) {
      bodyTouchStartX.current = null;
      return;
    }
    bodyTouchStartX.current = event.touches[0].clientX;
  };
  const handleBodyTouchMove = (event) => {
    const startX = bodyTouchStartX.current;
    if (startX == null) return;
    const idx = TAB_ORDER.indexOf(tab);
    const deltaX = startX - event.touches[0].clientX;
    const targetIdx = deltaX > 0 ? idx + 1 : idx - 1;
    if (targetIdx < 0 || targetIdx >= TAB_ORDER.length) return;
    const bar = tabbarRef.current;
    const underline = underlineRef.current;
    if (!bar || !underline) return;
    const buttons = bar.querySelectorAll(':scope > .ts-tab');
    const cur = buttons[idx];
    const next = buttons[targetIdx];
    if (!cur || !next) return;
    const progress = Math.min(1, Math.abs(deltaX) / window.innerWidth);
    underline.style.transition = 'none';
    underline.style.left = (cur.offsetLeft + (next.offsetLeft - cur.offsetLeft) * progress) + 'px';
    underline.style.width = (cur.offsetWidth + (next.offsetWidth - cur.offsetWidth) * progress) + 'px';
  };
  const handleBodyTouchEnd = (event) => {
    const startX = bodyTouchStartX.current;
    bodyTouchStartX.current = null;
    if (startX == null) return;
    const deltaX = startX - event.changedTouches[0].clientX;
    const idx = TAB_ORDER.indexOf(tab);
    if (Math.abs(deltaX) < 50) { positionUnderline(idx, true); return; }
    if (deltaX > 0 && idx < TAB_ORDER.length - 1) setTab(TAB_ORDER[idx + 1]);
    else if (deltaX < 0 && idx > 0) setTab(TAB_ORDER[idx - 1]);
    else positionUnderline(idx, true);
  };

  const handleCardClick = (card) => {
    if (!canEdit) return;
    const isStarter = activeSet.has(card.id);
    if (activeSet.size < 5 && !isStarter) {
      setSelectedId(null);
      const res = actions.promoteToStarter(myTeamId, card.id);
      if (res && res.ok === false) alert(res.msg);
      return;
    }
    if (selectedId == null) { setSelectedId(card.id); return; }
    if (selectedId === card.id) { setSelectedId(null); return; }
    const selectedIsStarter = activeSet.has(selectedId);
    if (selectedIsStarter === isStarter) { setSelectedId(card.id); return; }
    const outgoingId = selectedIsStarter ? selectedId : card.id;
    const incomingId = selectedIsStarter ? card.id : selectedId;
    setSelectedId(null);
    const res = actions.swapStarter(myTeamId, outgoingId, incomingId);
    if (res && res.ok === false) alert(res.msg);
  };

  const handleRelease = (card) => {
    const years = card.contract;
    const deadCapCharge = Math.round((card.salary / 2) * 100) / 100;
    const msg = years <= 0
      ? `Release ${card.archetype} · ${card.position}? Their contract is already expired, so this leaves no dead cap.`
      : years === 1
        ? `Release ${card.archetype} · ${card.position}? Leaves ${formatCoins(deadCapCharge)} in dead cap against your budget this season.`
        : `Release ${card.archetype} · ${card.position}? Leaves ${formatCoins(deadCapCharge)} in dead cap against your budget for each of the next ${years} seasons, starting this season.`;
    if (!window.confirm(msg)) return;
    const res = actions.releasePlayer(myTeamId, card.id);
    if (res && res.ok === false) alert(res.msg);
  };

  // The Players tab's card carousel takes over the whole screen on mobile — no page scroll
  // competing with the horizontal card swipe (see ts-screen-lock in index.css). Only true in
  // the Carousel view — List is a plain scrolling stack, same as every other tab.
  const isRotationLocked = !isDesktop && tab === 'rotation' && viewMode === 'carousel';

  // The Begin Season button always reads "Begin Season" now — what used to be separate button
  // labels (Hire A Coach, Resolve Budget, ...) are collected here instead and surfaced as a
  // list on click, so the button itself never changes shape.
  const seasonIssues = [];
  if (!team.coach) seasonIssues.push('Hire a coach');
  if (team.hand.length !== 9) seasonIssues.push(`Resolve your roster (${team.hand.length}/9)`);
  if (committed > cap) seasonIssues.push('Resolve team budget');
  if (!team.lineupSet || starters.length !== 5) seasonIssues.push('Set your lineup');

  return (
    <>
      <div className={'screen ts-screen' + (isRotationLocked ? ' ts-screen-lock' : '')}>
        <div className="ts-viewing-franchise"><span>{readOnly ? 'Viewing Franchise' : 'Your Franchise'}</span><strong>{team.name}</strong></div>
        <div className="ts-tabbar" ref={tabbarRef}>
          <div className={'ts-tab ts-tab-players' + (tab === 'rotation' ? ' active' : '')}>
            <button className="ts-tab-main" onClick={() => { setTab('rotation'); setViewMenuOpen(false); }}>Players</button>
            {tab === 'rotation' && !isDesktop && (
              <button
                type="button"
                className="ts-tab-caret"
                aria-label="Choose view"
                aria-expanded={viewMenuOpen}
                onClick={(event) => { event.stopPropagation(); setViewMenuOpen((v) => !v); }}
              >
                <span className={'ts-tab-caret-icon' + (viewMenuOpen ? ' open' : '')}>▾</span>
              </button>
            )}
            {viewMenuOpen && (
              <>
                <div className="ts-view-menu-backdrop" onClick={() => setViewMenuOpen(false)} />
                <div className="ts-view-menu" onClick={(event) => event.stopPropagation()}>
                  <button className={viewMode === 'carousel' ? 'active' : ''} onClick={() => { setViewMode('carousel'); setViewMenuOpen(false); }}>Carousel</button>
                  <button className={viewMode === 'list' ? 'active' : ''} onClick={() => { setViewMode('list'); setViewMenuOpen(false); }}>List</button>
                </div>
              </>
            )}
          </div>
          <button className={'ts-tab' + (tab === 'chemistry' ? ' active' : '')} onClick={() => setTab('chemistry')}>
            Lineup & Chemistry
            {!readOnly && !team.lineupSet && <span className="ts-tab-dot" aria-label="Lineup not set" />}
          </button>
          {team.market && (
            <button className={'ts-tab' + (tab === 'office' ? ' active' : '')} onClick={() => setTab('office')}>Gameplan</button>
          )}
          <button className={'ts-tab' + (tab === 'ledger' ? ' active' : '')} onClick={() => setTab('ledger')}>
            Budget
            {!readOnly && preSeason && committed > cap && <span className="ts-tab-dot" aria-label="Team is over budget" />}
          </button>
          {!isDesktop && <span className="ts-tab-underline" ref={underlineRef} aria-hidden="true" />}
        </div>

        <div className="ts-body" onTouchStart={!isDesktop ? handleBodyTouchStart : undefined} onTouchMove={!isDesktop ? handleBodyTouchMove : undefined} onTouchEnd={!isDesktop ? handleBodyTouchEnd : undefined}>
          {showSection('chemistry') && (
            <>
              {!readOnly && (
                <div className="ts-set-lineup-cta">
                  <button className="secondary" onClick={() => setLineupScreenOpen(true)}>
                    {!canEdit ? 'View Lineup' : team.lineupSet ? 'Edit Lineup' : 'Set Lineup'}
                  </button>
                </div>
              )}
              <TeamChemistry team={team} />
            </>
          )}

          {showSection('rotation') && !isDesktop && viewMode === 'list' && (
            <div className="ts-section" id="team-rotation">
              <div className="ts-heading">Players</div>
              <div className="ts-roto-list">
                {starters.map((c) => (
                  <PlayerCard
                    key={c.id}
                    card={c}
                    rosterLabel="Starter"
                    selected={selectedId === c.id}
                    onClick={canEdit ? () => handleCardClick(c) : undefined}
                    onRelease={canEdit ? handleRelease : undefined}
                    onDevelop={!readOnly && !c.development ? setDevelopPlayer : undefined}
                    alwaysShowOptions
                  />
                ))}
                {Array.from({ length: starterOpenSlots }, (_, i) => <div className="ts-bench-open starter" key={'starter-open-' + i}>OPEN STARTER</div>)}
                {bench.map((c) => (
                  <PlayerCard
                    key={c.id}
                    card={c}
                    rosterLabel="Bench"
                    selected={selectedId === c.id}
                    onClick={canEdit ? () => handleCardClick(c) : undefined}
                    onRelease={canEdit ? handleRelease : undefined}
                    onDevelop={!readOnly && !c.development ? setDevelopPlayer : undefined}
                    alwaysShowOptions
                  />
                ))}
                {Array.from({ length: benchOpenSlots }, (_, i) => <div className="ts-bench-open" key={'open-' + i}>OPEN</div>)}
              </div>
            </div>
          )}

          {showSection('rotation') && !(!isDesktop && viewMode === 'list') && (
            <div className="ts-section ts-player-carousel" id="team-rotation">
              {!isRotationLocked && <div className="ts-heading ts-rotation-heading">Players <span>{rotationIndex < 5 ? 'Starters' : 'Bench'}</span></div>}
              <div className="ts-roto-viewport">
                <div
                  className="ts-roto-scroll"
                  ref={rotoScrollRef}
                  onScroll={!isDesktop ? (event) => {
                    const width = event.currentTarget.scrollWidth / mobileCardCount;
                    if (width) setRotationIndex(Math.round(event.currentTarget.scrollLeft / width));
                  } : undefined}
                  onTouchStart={!isDesktop ? handleRotationTouchStart : undefined}
                  onTouchEnd={!isDesktop ? handleRotationTouchEnd : undefined}
                >
                  <div className="ts-roto-grid">
                    {starters.map((c) => (
                      <div className="ts-roto-slot" key={c.id}>
                        <PlayerCard
                          card={c}
                          selected={selectedId === c.id}
                          onClick={canEdit ? () => handleCardClick(c) : undefined}
                          onRelease={canEdit ? handleRelease : undefined}
                          onDevelop={!readOnly && !c.development ? setDevelopPlayer : undefined}
                          alwaysShowOptions={!isDesktop}
                        />
                      </div>
                    ))}
                    {Array.from({ length: starterOpenSlots }, (_, i) => <div className="ts-roto-slot" key={'starter-open-' + i}><div className="ts-bench-open starter">OPEN STARTER</div></div>)}
                    {!isDesktop && bench.map((c) => (
                      <div className="ts-roto-slot" key={c.id}>
                        <PlayerCard
                          card={c}
                          selected={selectedId === c.id}
                          onClick={canEdit ? () => handleCardClick(c) : undefined}
                          onRelease={canEdit ? handleRelease : undefined}
                          onDevelop={!readOnly && !c.development ? setDevelopPlayer : undefined}
                          alwaysShowOptions
                        />
                      </div>
                    ))}
                    {!isDesktop && Array.from({ length: benchOpenSlots }, (_, i) => <div className="ts-roto-slot" key={'open-' + i}><div className="ts-bench-open">OPEN</div></div>)}
                  </div>
                </div>
                {!isDesktop && (() => {
                  const onLastCard = rotationIndex >= mobileCardCount - 1;
                  if (onLastCard) return null;
                  return (
                    <div className="ts-hand-peek-tab" aria-hidden="true">
                      <span className="ts-hand-peek-chevron">›</span>
                      <span className="ts-hand-peek-count">+{mobileCardCount - 1 - rotationIndex}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {isDesktop && showSection('rotation') && (
            <div className="ts-section ts-player-carousel" id="team-bench">
              <div className="ts-heading">Bench</div>
              <div className="ts-roto-scroll">
                <div className="ts-roto-grid">
                  {bench.map((c) => (
                    <PlayerCard
                      key={c.id}
                      card={c}
                      selected={selectedId === c.id}
                      onClick={canEdit ? () => handleCardClick(c) : undefined}
                      onRelease={canEdit ? handleRelease : undefined}
                      onDevelop={!readOnly && !c.development ? setDevelopPlayer : undefined}
                    />
                  ))}
                  {Array.from({ length: benchOpenSlots }, (_, i) => (
                    <div key={'open' + i} className="ts-bench-open">OPEN</div>
                  ))}
                </div>
              </div>
              {bench.length + benchOpenSlots > 1 && <div className="ts-card-stack-cue" aria-hidden="true"><i /><i /><i /></div>}
            </div>
          )}

          {showSection('ledger') && (
            <div className="ts-section ts-ledger">
              <div className="ts-ledger-topline">
                <div><div className="ts-heading">Budget</div><strong>{formatCoins(committed)} / {formatCoins(cap).replace('🪙', '')}</strong></div>
                <div className={'ts-ledger-room' + (room < 0 ? ' bad' : '')}><span>Room Available</span><strong>{formatCoins(room)}</strong></div>
              </div>
              <div className="ts-budget-bar">
                {budgetSources.map((source) => (
                  <div
                    key={source.key}
                    className={`ts-budget-seg ${source.key}`}
                    style={{ width: `${cap ? (source.amount / cap) * 100 : 0}%` }}
                    title={`${source.label}: ${formatCoins(source.amount)}`}
                  ><span>{source.label}</span></div>
                ))}
              </div>
              <div className="ts-budget-legend">
                {budgetSources.map((source) => <span key={source.key} className={source.key}><i />{source.label} {formatCoins(source.amount)}</span>)}
              </div>

              <div className="ts-ledger-group">
                <div className="ts-ledger-group-title">Committed</div>
                <div className="ts-ledger-subtitle">Players</div>
                <div className="ts-ledger-list">
                  {team.hand.map((card) => (
                    <div className={'ts-ledger-person' + (canEdit ? ' releasable' : '')} key={card.id}>
                      <PlayerLedgerIdentity card={card} role={activeSet.has(card.id) ? 'Starter' : 'Bench'} />
                      <CostBlocks turns={card.contract} amount={card.salary} />
                      {canEdit && <button className="ts-ledger-release" onClick={() => handleRelease(card)}>Release</button>}
                    </div>
                  ))}
                </div>
                <div className="ts-ledger-subtitle">Team</div>
                <div className="ts-team-costs">
                  <div><span>Coach</span><strong>{team.coach ? formatCoins(team.coach.salary) : '—'}</strong></div>
                  <div><span>GM</span><strong>{formatCoins(managerCost)}</strong></div>
                </div>
              </div>

              <div className="ts-ledger-group expiring">
                <div className="ts-ledger-group-title">Expiring</div>
                {expiring.length ? <div className="ts-ledger-list">{expiring.map((card) => (
                  <div className="ts-ledger-person" key={card.id}>
                    <PlayerLedgerIdentity card={card} role={activeSet.has(card.id) ? 'Starter' : 'Bench'} />
                    <CostBlocks turns={1} amount={card.salary} />
                  </div>
                ))}</div> : <div className="ts-ledger-empty">No contracts expire after this season.</div>}
              </div>

              <div className="ts-ledger-group dead-cap">
                <div className="ts-ledger-group-title">Dead Cap</div>
                {(team.deadCap || []).length ? <div className="ts-ledger-list">{team.deadCap.map((entry, index) => (
                  <div className="ts-ledger-person" key={`${entry.kind || 'legacy'}-${index}`}>
                    {entry.kind === 'player' && entry.player
                      ? <PlayerLedgerIdentity card={entry.player} role={entry.rosterRole || 'Released'} />
                      : <div className="ts-ledger-identity"><strong>{entry.label || 'Prior Obligation'}</strong><span>{entry.kind === 'coach' ? 'Coach' : entry.kind === 'gm' ? 'GM' : 'Released'}</span>{entry.detail && <em>{entry.detail}</em>}</div>}
                    <CostBlocks turns={entry.seasonsLeft} amount={entry.amount} />
                  </div>
                ))}</div> : <div className="ts-ledger-empty">No dead cap obligations.</div>}
              </div>
            </div>
          )}

          {team.market && showSection('office') && (
            <div className="ts-section" id="team-office">
              <div className="ts-heading">Coach & GM</div>
              <div className="row-swipe-wrap">
              <div className={'fo-deal-row' + (foRow.scrolls ? ' row-scroll' : ' row-fit')} style={{ margin: 0 }} onScroll={foRow.scrolls ? foRow.onScroll : undefined}>
                <div className="ts-fo-col" id="team-coach-card">
                  {team.coach ? <FrontOfficeCard kind="coach" team={team} /> : <div className="ts-empty-coach"><span>Coach</span><strong>Open Slot</strong><small>Choose a replacement in Free Agency.</small></div>}
                  {!readOnly && team.coach && (
                    <button
                      className="secondary ts-fo-action"
                      style={{ width: '100%' }}
                      onClick={() => {
                        const res = actions.fireCoach(myTeamId);
                        if (res && res.ok === false) alert(res.msg);
                      }}
                    >
                      Fire Coach ({formatCoins(fireCoachDeadCap)})
                    </button>
                  )}
                </div>
                {state.settings.fanbaseCardsEnabled !== false && (
                  <div className="ts-fo-col">
                    <FrontOfficeCard kind="fanbase" team={team} />
                    {!readOnly && (
                      <button
                        className="secondary ts-fo-action"
                        style={{ width: '100%' }}
                        disabled={team.financeBoostUsedThisSeason}
                        onClick={() => {
                          const res = actions.investInFanbase(myTeamId);
                          if (res && res.ok === false) alert(res.msg);
                        }}
                      >
                        {team.financeBoostUsedThisSeason ? 'Already Invested This Season' : `Invest — ${formatCoins(FANBASE_BOOST_COST)}`}
                      </button>
                    )}
                  </div>
                )}
                <div className="ts-fo-col">
                  <FrontOfficeCard kind="market" team={team} />
                  {!readOnly && (
                    <button
                      className="secondary ts-fo-action"
                      style={{ width: '100%' }}
                      disabled={team.gmChangeSeason === state.season}
                      onClick={() => {
                        const res = actions.fireGM(myTeamId);
                        if (res && res.ok === false) alert(res.msg);
                      }}
                    >
                      {team.gmChangeSeason === state.season ? 'GM Replaced This Season' : `Fire GM (${formatCoins(Math.round((gmCost(team.gmType) / 2) * 100) / 100)})`}
                    </button>
                  )}
                </div>
              </div>
              <RowSwipeHint row={foRow} />
              </div>
            </div>
          )}

          {showStaffCards && (
            <div className="ts-section" id="team-gameplan-cards">
              <div className="ts-heading">Development</div>
              <div className="row-swipe-wrap">
              <div className={'strategy-deal-row' + (devRow.scrolls ? ' row-scroll' : ' row-fit')} onScroll={devRow.scrolls ? devRow.onScroll : undefined}>
                {(team.developmentCards || []).map((card) => <div className="strategy-card-wrap" key={card.id}>{readOnly ? <CardBack /> : <><StrategyCard card={card} /><StrategyAction card={card} team={team} state={state} actions={actions} myTeamId={myTeamId} readOnly={readOnly} /></>}</div>)}
                {(team.developmentCards || []).length === 0 && <div className="strategy-empty">New cards are dealt at the start of each season.</div>}
              </div>
              <RowSwipeHint row={devRow} />
              </div>
            </div>
          )}

          {showStaffCards && (
            <div className="ts-section">
              <div className="ts-heading">Gameplan</div>
              <div className="row-swipe-wrap">
              <div className={'strategy-deal-row' + (gameplanRow.scrolls ? ' row-scroll' : ' row-fit')} onScroll={gameplanRow.scrolls ? gameplanRow.onScroll : undefined}>
                {(team.gameplanCards || []).map((card) => <div className="strategy-card-wrap" key={card.id}>{readOnly ? <CardBack /> : <><StrategyCard card={card} /><StrategyAction card={card} team={team} state={state} actions={actions} myTeamId={myTeamId} readOnly={readOnly} /></>}</div>)}
                {(team.gameplanCards || []).length === 0 && <div className="strategy-empty">New cards are dealt at the start of each season.</div>}
              </div>
              <RowSwipeHint row={gameplanRow} />
              </div>
            </div>
          )}

          {(team.matchupCards || []).length > 0 && showStaffCards && (
            <div className="ts-section" id="team-adjustment-cards">
              <div className="ts-heading">Adjustments</div>
              <div className="row-swipe-wrap">
              <div className={'mu-deal-row' + (adjRow.scrolls ? ' row-scroll' : ' row-fit')} style={{ margin: 0 }} onScroll={adjRow.scrolls ? adjRow.onScroll : undefined}>
                {team.matchupCards.map((c) => readOnly ? <CardBack key={c.id} shape="adjustment" /> : <MatchupCard key={c.id} card={c} />)}
              </div>
              <RowSwipeHint row={adjRow} />
              </div>
            </div>
          )}
        </div>

        {/* Hidden while the Rotation carousel owns the screen — as a flex sibling of .ts-body
            these would eat into its flex:1 share of the available height, which is exactly the
            space the carousel needs every pixel of. They still show on every other tab. */}
        {!isRotationLocked && preSeason && team.hand.length !== 9 && (
          <div className="statusline" style={{ marginTop: 16 }}>
            Resolve your roster before the season begins: {team.hand.length > 9 ? `release ${team.hand.length - 9} player${team.hand.length - 9 === 1 ? '' : 's'}` : `sign ${9 - team.hand.length} player${9 - team.hand.length === 1 ? '' : 's'} from Free Agency`}.
          </div>
        )}
        {!isRotationLocked && preSeason && team.hand.length === 9 && committed > cap && (
          <div className="statusline" style={{ marginTop: 16 }}>Get under budget before the season begins. Reduce committed costs by {formatCoins(committed - cap)}.</div>
        )}
        {developPlayer && (
          <div className="development-picker-backdrop" onClick={() => setDevelopPlayer(null)}>
            <div className="development-picker" role="dialog" aria-modal="true" aria-label={`Develop ${developPlayer.archetype}`} onClick={(event) => event.stopPropagation()}>
              <div className="development-picker-head"><div><div className="ts-heading">Develop Player</div><div className="development-picker-player">#{developPlayer.id} · {developPlayer.position} · {developPlayer.archetype}</div></div><button className="secondary" onClick={() => setDevelopPlayer(null)}>Close</button></div>
              <div className="development-picker-cards">
                {(team.developmentCards || []).filter((card) => !card.used).map((card) => (
                  <button key={card.id} className="development-picker-card" onClick={() => { const result = actions.applyDevelopmentCard(myTeamId, card.id, developPlayer.id); if (result?.ok === false) alert(result.msg); else setDevelopPlayer(null); }}>
                    <StrategyCard card={card} />
                  </button>
                ))}
                {(team.developmentCards || []).every((card) => card.used) && <div className="strategy-empty">No Development cards are available.</div>}
              </div>
            </div>
          </div>
        )}
        {lineupScreenOpen && (
          <SetLineupScreen
            team={team}
            actions={actions}
            myTeamId={myTeamId}
            canEdit={canEdit}
            onClose={() => setLineupScreenOpen(false)}
          />
        )}
      </div>
      <div className="bottombar">
        {onBack ? (
          <button className="primary" onClick={onBack}>Back</button>
        ) : (
          <div className="bottombar-action">
            <button
              className={'primary' + (!team.lineupConfirmed && seasonIssues.length > 0 ? ' needs-attention' : '')}
              disabled={team.lineupConfirmed || seasonIssues.length > 0}
              onClick={() => {
                const res = actions.confirmLineup(myTeamId);
                if (res && res.valid === false) alert(res.msg);
              }}
            >
              {team.lineupConfirmed
                ? (waitingOn.length > 0 ? `Waiting For ${waitingOn.length} User${waitingOn.length === 1 ? '' : 's'} To Continue` : 'Waiting…')
                : 'Begin Season'}
              {!team.lineupConfirmed && seasonIssues.length > 0 && <span className="bottombar-warn-icon" aria-hidden="true">!</span>}
            </button>
            {!team.lineupConfirmed && seasonIssues.length > 0 && (
              <div className="bottombar-issues">
                <div className="bottombar-issues-head">Before you begin</div>
                <ul>
                  {seasonIssues.map((msg) => (
                    <li key={msg}>
                      {msg === 'Set your lineup' ? (
                        <button type="button" onClick={() => { setTab('chemistry'); setLineupScreenOpen(true); }}>{msg}</button>
                      ) : msg === 'Resolve team budget' ? (
                        <button type="button" onClick={() => setTab('ledger')}>{msg}</button>
                      ) : msg.startsWith('Resolve your roster') ? (
                        <button type="button" onClick={() => onFreeAgency?.()}>{msg}</button>
                      ) : msg}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
