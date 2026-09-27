import { useEffect, useRef, useState } from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import TeamChemistry from '../components/TeamChemistry';
import SetLineupScreen from '../components/SetLineupScreen';
import FrontOfficeCard from '../components/FrontOfficeCard';
import { PlayerLedgerIdentity, CostBlocks } from '../components/LedgerRow';
import { formatCoins, rosterSalary, gmCost } from '../game/economy';
import { FANBASE_BOOST_COST } from '../game/constants';
import MatchupCard from '../components/MatchupCard';
import CardBack from '../components/CardBack';
import CoachmarkTour from '../components/CoachmarkTour';
import { teamOutput } from '../game/matchup';
import { teamSynergy } from '../game/skillsets';

const tabForSection = (section) => ['gameplan', 'office', 'adjustment'].includes(section) ? 'chemistry' : section || 'office';

// Front Office / Development / Gameplan / Adjustment each render as one horizontally-scrolling
// row of same-kind cards on mobile. Two or fewer fit the screen outright (no scrolling needed,
// so no hint either) — more than that scrolls, with the same peek-style chevron hint used
// elsewhere in the Team File so it's clear there's more to swipe to. atEnd starts true for a
// row that never needed scrolling in the first place. threshold defaults to 2 (Front Office's
// three-distinct-kind row, which stretches to fit 1-2 cards evenly and only scrolls past that);
// Development/Gameplan/Adjustments pass 1 instead, since those rows are always one-card-at-a-
// time now (see ts-swipe-row) — any more than a single card of the same kind means there's
// something to swipe to.
function useRowEnd(count, threshold = 2) {
  const [atEnd, setAtEnd] = useState(count <= threshold);
  useEffect(() => { setAtEnd(count <= threshold); }, [count, threshold]);
  const onScroll = (event) => {
    const el = event.currentTarget;
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  };
  return { atEnd, onScroll, scrolls: count > threshold };
}

function RowSwipeHint({ row }) {
  if (!row.scrolls || row.atEnd) return null;
  return <div className="row-swipe-hint" aria-hidden="true"><span className="row-swipe-hint-chevron">›</span></div>;
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
// Browsing a specific player's card lives on the separate Team Rosters screen (reached from
// the League tab here) — this screen is organised by category: The League, Gameplan/Chemistry,
// Budget ledger, front office. No nine-slot navigation here (that's the persistent bar's job on
// every other screen).
export default function TeamSummaryScreen({ state, actions, myTeamId, viewTeamId, onBack, focusSection, onFreeAgency, onDraftClass, onTeamRosters, onLineupPreviewChange }) {
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
  const otherHumans = state.teams.filter((t) => t.human && t.id !== team.id);
  const waitingOn = otherHumans.filter((t) => !t.lineupConfirmed);
  const readyHumans = state.teams.filter((t) => t.human && t.lineupConfirmed);

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

  // Mobile-only tab bar (per the brand handoff's mobile Team File — The League/Gameplan/
  // Budget) — on desktop every section still shows stacked in one scroll, same as before;
  // `isDesktop` just decides whether `tab` actually filters anything.
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState(() => tabForSection(focusSection?.section));
  const showSection = (key) => isDesktop || tab === key;
  const showStaffCards = isDesktop || tab === 'chemistry';
  const adjRow = useRowEnd((team.matchupCards || []).length, 1);
  const leagueOutputs = state.teams.map((candidate) => ({ team: candidate, output: candidate.coach ? teamOutput(candidate) : { total: 0, off: 0, def: 0, bench: 0 } }));
  const leagueTotal = leagueOutputs.reduce((sum, entry) => sum + entry.output.total, 0);
  const bestFor = (key) => leagueOutputs.reduce((best, entry) => entry.output[key] > best.output[key] ? entry : best, leagueOutputs[0]);
  const leagueStandings = [...leagueOutputs].sort((a, b) => b.output.total - a.output.total);
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

  const [lineupScreenOpen, setLineupScreenOpen] = useState(false);
  // Onboarding anchors: the Gameplan tab (opens Team Chemistry, where Set Lineup lives) before
  // a lineup has ever been set, and Begin Season once one has. Both coachmarks are gated by
  // their own CoachmarkTour storageKey (shown once ever, ignoring later seasons where the same
  // "active" condition is true again) — no separate transition-tracking needed here.
  const gameplanTabRef = useRef(null);
  const beginSeasonBtnRef = useRef(null);
  const [showSeasonIssues, setShowSeasonIssues] = useState(false);
  useEffect(() => {
    if (!showSeasonIssues) return undefined;
    const timer = window.setTimeout(() => setShowSeasonIssues(false), 4000);
    return () => window.clearTimeout(timer);
  }, [showSeasonIssues]);

  // Swipe anywhere in the body to move between tabs. Bails out for a touch that starts inside a
  // child modal or horizontal scroller (their gestures belong to that surface, even though they
  // bubble through this body handler) — an earlier version tried gating this by requiring the
  // touch to START within ~32px of the screen edge instead, which also blocked the ordinary case
  // of swiping between tabs from the middle of the screen, where nothing actually conflicts.
  const TAB_ORDER = [team.market ? 'office' : null, 'chemistry', 'ledger'].filter(Boolean);
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
      '.development-picker, .tsx-overlay, .row-scroll, .strategy-deal-row, .ts-cost-blocks, .league-standings-table',
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
    // A light or partial swipe shouldn't change tabs — this needs a deliberate, most-of-the-way
    // gesture, not just a passing touch-drag while scrolling the page vertically.
    if (Math.abs(deltaX) < 110) { positionUnderline(idx, true); return; }
    if (deltaX > 0 && idx < TAB_ORDER.length - 1) setTab(TAB_ORDER[idx + 1]);
    else if (deltaX < 0 && idx > 0) setTab(TAB_ORDER[idx - 1]);
    else positionUnderline(idx, true);
  };

  const handleRelease = (card) => {
    if (card.freeAgentSignedSeason === state.season) {
      alert('You cannot release a free agent you signed this season.');
      return;
    }
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

  // The Begin Season button always reads "Begin Season" now — what used to be separate button
  // labels (Hire A Coach, Resolve Budget, ...) are collected here instead and surfaced as a
  // list on click, so the button itself never changes shape.
  const seasonIssues = [];
  if (!team.coach) seasonIssues.push('Hire a coach');
  if (team.hand.length > 9) seasonIssues.push(`Resolve your roster (${team.hand.length}/9)`);
  if (committed > cap) seasonIssues.push('Resolve team budget');
  if (!team.lineupSet || starters.length !== 5) seasonIssues.push('Set your lineup');
  if (!state.offseason?.freeAgencyClosed?.[team.id]) seasonIssues.push('Close out free agency');

  return (
    <>
      <div className="screen ts-screen">
        <div className="ts-viewing-franchise"><span>{readOnly ? 'Viewing Franchise' : 'Your Franchise'}</span><strong>{team.name}</strong></div>
        <div className="ts-tabbar" ref={tabbarRef}>
          {team.market && (
            <button className={'ts-tab' + (tab === 'office' ? ' active' : '')} onClick={() => setTab('office')}>The League{!readOnly && !state.offseason?.freeAgencyClosed?.[team.id] && <span className="alert-badge" aria-label="League requires attention">!</span>}</button>
          )}
          <button ref={gameplanTabRef} className={'ts-tab' + (tab === 'chemistry' ? ' active' : '')} onClick={() => setTab('chemistry')}>
            Gameplan
            {!readOnly && !team.lineupSet && <span className="alert-badge" aria-label="Lineup not set">!</span>}
          </button>
          <button className={'ts-tab' + (tab === 'ledger' ? ' active' : '')} onClick={() => setTab('ledger')}>
            Budget
            {!readOnly && preSeason && committed > cap && <span className="alert-badge" aria-label="Team is over budget">!</span>}
          </button>
          {!isDesktop && <span className="ts-tab-underline" ref={underlineRef} aria-hidden="true" />}
        </div>

        <div className="ts-body" onTouchStart={!isDesktop ? handleBodyTouchStart : undefined} onTouchMove={!isDesktop ? handleBodyTouchMove : undefined} onTouchEnd={!isDesktop ? handleBodyTouchEnd : undefined}>
          {showSection('chemistry') && (
            <TeamChemistry team={team} canEdit={canEdit} onEditLineup={() => setLineupScreenOpen(true)} />
          )}

          {showSection('office') && (
            <div className="ts-section league-overview">
              <div className="ts-heading">The League</div>
              <div className="league-jump-actions">
                <button type="button" className="league-jump-button free-agency" onClick={onFreeAgency}>Free Agency{!readOnly && !state.offseason?.freeAgencyClosed?.[team.id] && <span className="alert-badge" aria-label="Free Agency requires attention">!</span>}</button>
                <button type="button" className="league-jump-button draft" onClick={onDraftClass}>Draft Class</button>
                {onTeamRosters && <button type="button" className="league-jump-button rosters" onClick={onTeamRosters}>Team Rosters</button>}
              </div>
              <div className="league-output-grid">
                <div><span>League Output</span><strong>{Math.round(leagueTotal * 100) / 100}</strong><small>Total collective output from all teams</small></div>
                <div><span>Best Offense</span><strong>{bestFor('off').output.off}</strong><small>{bestFor('off').team.name}</small></div>
                <div><span>Best Defense</span><strong>{bestFor('def').output.def}</strong><small>{bestFor('def').team.name}</small></div>
                <div><span>Best Bench</span><strong>{bestFor('bench').output.bench}</strong><small>{bestFor('bench').team.name}</small></div>
              </div>
              <div className="ts-heading league-standings-heading">Standings</div>
              <div className="league-standings-table">
                <div className="league-standings-row head">
                  <span>Team</span><span>Chemistry</span><span>Projected Output</span><span>Offense</span><span>Defense</span>
                </div>
                {leagueStandings.map(({ team: t, output }, index) => (
                  <div key={t.id} className={'league-standings-row' + (t.id === team.id ? ' you' : '')}>
                    <span className="league-team"><i>{index + 1}</i><b>{t.name}</b></span>
                    <span>{teamSynergy(t).grade}</span>
                    <span className="league-output">{output.total}</span>
                    <span>{output.off}</span>
                    <span>{output.def}</span>
                  </div>
                ))}
              </div>
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
                {budgetSources.map((source) => <span key={source.key} className={source.key}><i />{source.label} {formatCoins(source.amount).replace('🪙', '')}</span>)}
              </div>

              <div className="ts-ledger-group">
                <div className="ts-ledger-group-title">Committed</div>
                <div className="ts-ledger-subtitle">Starters</div>
                <div className="ts-ledger-list">
                  {team.hand.filter((card) => activeSet.has(card.id)).map((card) => (
                    <div className={'ts-ledger-person' + (canEdit ? ' releasable' : '')} key={card.id}>
                      <PlayerLedgerIdentity card={card} />
                      <CostBlocks turns={card.contract} amount={card.salary} />
                      {canEdit && <button className="ts-ledger-release" onClick={() => handleRelease(card)}>Release</button>}
                    </div>
                  ))}
                </div>
                <div className="ts-ledger-subtitle">Bench</div>
                <div className="ts-ledger-list">
                  {team.hand.filter((card) => !activeSet.has(card.id)).map((card) => (
                    <div className={'ts-ledger-person' + (canEdit ? ' releasable' : '')} key={card.id}>
                      <PlayerLedgerIdentity card={card} />
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

          {team.market && showSection('chemistry') && (
            <div className="ts-section" id="team-office">
              <div className="ts-heading">Coach & GM</div>
              {/* Coach gets its own row, GM (and Fanbase, the other front-office role) a second
                  row below it — kept apart rather than sharing one swipeable row of up to three
                  cards. Neither row ever holds more than two cards, so both stay a plain
                  stretch-to-fit row (see useRowEnd's own "1-2 cards" comment) with no scroll
                  tracking needed. */}
              <div className="fo-deal-row row-fit" style={{ margin: 0 }}>
                <div className="ts-fo-col" id="team-coach-card">
                  {team.coach ? <FrontOfficeCard kind="coach" team={team} /> : <div className="ts-empty-coach"><span>Coach</span><strong>Open Slot</strong><small>Choose a replacement in Free Agency.</small></div>}
                  {!readOnly && team.coach && state.settings.coachChangesEnabled && (
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
              </div>
              <div className="fo-deal-row row-fit" style={{ margin: '12px 0 0' }}>
                <div className="ts-fo-col">
                  <FrontOfficeCard kind="market" team={team} />
                  {!readOnly && state.settings.coachChangesEnabled && (
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
            </div>
          )}

          {state.settings.fanbaseCardsEnabled !== false && showSection('office') && (
            <div className="ts-section">
              <div className="ts-heading">Fanbase</div>
              <div className="fo-deal-row row-fit" style={{ margin: 0 }}>
                <div className="ts-fo-col">
                  <FrontOfficeCard kind="fanbase" team={team} />
                  {!readOnly && (
                    <button className="secondary ts-fo-action" style={{ width: '100%' }} disabled={team.financeBoostUsedThisSeason} onClick={() => {
                      const res = actions.investInFanbase(myTeamId);
                      if (res && res.ok === false) alert(res.msg);
                    }}>
                      {team.financeBoostUsedThisSeason ? 'Already Invested This Season' : `Invest — ${formatCoins(FANBASE_BOOST_COST)}`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {(team.matchupCards || []).length > 0 && showStaffCards && (
            <div className="ts-section" id="team-adjustment-cards">
              <div className="ts-heading">Adjustments</div>
              <div className="row-swipe-wrap">
              <div className={'mu-deal-row ts-swipe-row' + (adjRow.scrolls ? ' row-scroll' : ' row-fit')} style={{ margin: 0 }} onScroll={adjRow.scrolls ? adjRow.onScroll : undefined}>
                {team.matchupCards.map((c) => readOnly ? <CardBack key={c.id} shape="adjustment" /> : <MatchupCard key={c.id} card={c} />)}
              </div>
              <RowSwipeHint row={adjRow} />
              </div>
            </div>
          )}
        </div>

        {preSeason && team.hand.length > 9 && (
          <div className="statusline" style={{ marginTop: 16 }}>
            Resolve your roster before the season begins: release {team.hand.length - 9} player{team.hand.length - 9 === 1 ? '' : 's'}.
          </div>
        )}
        {preSeason && team.hand.length === 9 && committed > cap && (
          <div className="statusline" style={{ marginTop: 16 }}>Get under budget before the season begins. Reduce committed costs by {formatCoins(committed - cap)}.</div>
        )}
        {lineupScreenOpen && (
          <SetLineupScreen
            team={team}
            actions={actions}
            myTeamId={myTeamId}
            canEdit={canEdit}
            onPreviewChange={onLineupPreviewChange}
            onClose={() => { onLineupPreviewChange?.(null); setLineupScreenOpen(false); }}
          />
        )}
        <CoachmarkTour
          storageKey="nine-deep-onboard-gameplan-tab-seen"
          active={!lineupScreenOpen && !readOnly && !team.lineupSet}
          steps={[{ targetRef: gameplanTabRef, title: 'Build Your Team', body: 'Set your starting five here — tap Gameplan to get started.' }]}
        />
        <CoachmarkTour
          storageKey="nine-deep-onboard-begin-season-seen"
          active={!lineupScreenOpen && !readOnly && !onBack && team.lineupSet}
          steps={[{ targetRef: beginSeasonBtnRef, title: 'Lineup Set', body: 'Free Agency stays open if you want to upgrade — Begin Season locks it in when you’re ready.' }]}
        />
      </div>
      <div className="bottombar">
        {onBack ? (
          <button className="primary" onClick={onBack}>Back</button>
        ) : (
          <div className="bottombar-action">
            {readyHumans.length > 0 && (
              <div className="season-ready-status" aria-live="polite">
                <span className="season-ready-label">Ready</span>
                <span className="season-ready-teams">{readyHumans.map((readyTeam) => readyTeam.tricode).join(' · ')}</span>
              </div>
            )}
            <button
              ref={beginSeasonBtnRef}
              className={'primary' + (!lineupScreenOpen && !team.lineupConfirmed && seasonIssues.length > 0 ? ' needs-attention' : '')}
              disabled={!lineupScreenOpen && team.lineupConfirmed}
              aria-expanded={showSeasonIssues}
              onClick={() => {
                if (lineupScreenOpen) { setLineupScreenOpen(false); return; }
                if (seasonIssues.length > 0) {
                  setShowSeasonIssues(true);
                  return;
                }
                if (team.hand.length < 9 && !window.confirm(`Start the season with an incomplete roster (${team.hand.length}/9)? This will negatively affect your franchise's output`)) return;
                const res = actions.confirmLineup(myTeamId);
                if (res && res.valid === false) alert(res.msg);
              }}
            >
              {lineupScreenOpen ? 'Back' : team.lineupConfirmed
                ? (waitingOn.length > 0 ? `Waiting For ${waitingOn.length} User${waitingOn.length === 1 ? '' : 's'} To Continue` : 'Waiting…')
                : 'Begin Season'}
              {!lineupScreenOpen && !team.lineupConfirmed && seasonIssues.length > 0 && <span className="bottombar-warn-icon" aria-hidden="true">!</span>}
            </button>
            {!lineupScreenOpen && !team.lineupConfirmed && seasonIssues.length > 0 && showSeasonIssues && (
              <div className="bottombar-issues">
                <div className="bottombar-issues-head">Before you begin you must resolve:</div>
                <ul>
                  {seasonIssues.map((msg) => (
                    <li key={msg}>
                      {msg === 'Set your lineup' ? (
                        <button type="button" onClick={() => { setShowSeasonIssues(false); setTab('chemistry'); setLineupScreenOpen(true); }}>Lineup</button>
                      ) : msg === 'Resolve team budget' ? (
                        <button type="button" onClick={() => { setShowSeasonIssues(false); setTab('ledger'); }}>Budget</button>
                      ) : msg.startsWith('Resolve your roster') ? (
                        <button type="button" onClick={() => { setShowSeasonIssues(false); setTab('ledger'); }}>{msg}</button>
                      ) : msg === 'Close out free agency' ? (
                        <button type="button" onClick={() => { setShowSeasonIssues(false); onFreeAgency?.(); }}>Free Agency</button>
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
