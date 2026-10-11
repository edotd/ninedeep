import { useEffect, useRef, useState } from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import SetLineupScreen from '../components/SetLineupScreen';
import FrontOfficeCard from '../components/FrontOfficeCard';
import { PlayerLedgerIdentity, CostBlocks } from '../components/LedgerRow';
import { formatCoins, rosterSalary, gmCost, isOverLimit, overageAllowance } from '../game/economy';
import { FANBASE_BOOST_COST, ROSTER_SIZE } from '../game/constants';
import CoachmarkTour from '../components/CoachmarkTour';
import TeamMain from '../components/TeamMain';
import { teamOutput } from '../game/matchup';
import { teamSynergy } from '../game/skillsets';
import { jerseyNumber, playerGrade } from '../game/cards';
import { guardedNavigate } from '../hooks/leaveGuard';

// The Team page opens on its main index; its sub pages (lineup, coach, GM, budget) are dealt in
// over it. League is its own tab beside Team. A
// section request from elsewhere (the persistent bar's Coach / Gameplan boxes) lands straight
// on the matching sub page.
const subForSection = (section) => (section === 'office' ? 'coach' : section === 'gameplan' ? 'lineup' : section === 'ledger' || section === 'budget' ? 'budget' : null);
// Page names for the title bar.
const SUB_TITLES = { lineup: 'Team', coach: 'Coach', gm: 'GM', budget: 'Manage Budget', scouting: 'Scouting Report' };

// The Team Summary screen — "the file the league keeps on you" (design brand handoff, 1a).
// Serves two roles from the same markup: as the 'teamsummary' phase (shown once per season,
// after the Constructing loading beat — its own button confirms the season on the auto-selected
// five, the last stop before the season locks), and — when passed `onBack` — as the "Team"
// overlay reachable from the sidebar/top bar on any phase,
// where the button instead just closes the overlay and the front-office moves (fire/hire
// coach, fire GM, invest in fanbase — all funded out of budget room) are available. Passing
// `viewTeamId` (set by clicking another team in Standings) shows that team's file instead of
// the caller's own — fully read-only, since every mutation here always targets `myTeamId`
// regardless of whose file is on screen.
// Browsing a specific player's card lives on the separate Team Rosters screen (reached from
// the League tab here) — this screen is organised by category: Team (Gameplan/Chemistry), League,
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

  // On a phone the Team page is one index plus sub pages (see `sub` below); on desktop every
  // section still shows stacked in one scroll.
  const isDesktop = useIsDesktop();
  // Which Team sub page is open (null = the main index): 'lineup' | 'coach' | 'gm' | 'budget'.
  const [tab, setTabRaw] = useState(() => (focusSection?.section === 'league' ? 'league' : 'team'));
  const setTab = (next) => guardedNavigate(() => setTabRaw(next));
  const [sub, setSubRaw] = useState(() => subForSection(focusSection?.section));
  // The sub page slides over the main page like a dealt card (design: page transitions, Deal).
  // `sub` is the page that's mounted, `subOpen` drives the slide, `subBusy` is true while it's
  // moving (the main page stays mounted underneath until it's done).
  const [subOpen, setSubOpen] = useState(() => !!subForSection(focusSection?.section));
  const [subBusy, setSubBusy] = useState(false);
  const subTimer = useRef(null);
  useEffect(() => () => clearTimeout(subTimer.current), []);
  // First visit to the Team page after the deal: a short welcome, shown once per era.
  const welcomeKey = `nine-deep-team-welcome-seen:${state.eraId}`;
  const [showWelcome, setShowWelcome] = useState(() => {
    if (readOnly || onBack || !(state.phase === 'teamsummary' || state.phase === 'pullhand')) return false;
    try { return localStorage.getItem(welcomeKey) !== '1'; } catch { return false; }
  });
  const dismissWelcome = () => {
    try { localStorage.setItem(welcomeKey, '1'); } catch { /* ignore */ }
    setShowWelcome(false);
  };
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // Instant (no animation) — used when something else changes the tab or the page outright.
  const setSub = (next) => { clearTimeout(subTimer.current); setSubBusy(false); setSubRaw(next); setSubOpen(!!next); };
  const SUB_MS = 460;
  const enterSub = (target) => {
    if (subBusy) return;
    if (reduceMotion) { setSub(target); return; }
    clearTimeout(subTimer.current);
    setSubRaw(target); setSubOpen(false); setSubBusy(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setSubOpen(true)));
    subTimer.current = setTimeout(() => setSubBusy(false), SUB_MS);
  };
  const leaveSub = () => {
    if (!sub || subBusy) return;
    guardedNavigate(leaveSubNow);
  };
  const leaveSubNow = () => {
    if (reduceMotion) { setSub(null); return; }
    clearTimeout(subTimer.current);
    setSubBusy(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setSubOpen(false)));
    subTimer.current = setTimeout(() => { setSubRaw(null); setSubBusy(false); }, SUB_MS);
  };
  const leagueOutputs = state.teams.map((candidate) => ({ team: candidate, output: candidate.coach ? teamOutput(candidate) : { total: 0, off: 0, def: 0, bench: 0 } }));
  const leagueTotal = leagueOutputs.reduce((sum, entry) => sum + entry.output.total, 0);
  const bestFor = (key) => leagueOutputs.reduce((best, entry) => entry.output[key] > best.output[key] ? entry : best, leagueOutputs[0]);
  const leagueStandings = [...leagueOutputs].sort((a, b) => b.output.total - a.output.total);
  const scoutingRows = (state.teams[myTeamId]?.scoutingReport || []).map((cardId) => {
    const current = state.teams.flatMap((candidate) => candidate.hand || []).concat(state.freeAgents || [], state.upcomingDraftPool || []).find((card) => card.id === cardId);
    const history = (state.teams[myTeamId]?.scoutingHistory || []).filter((entry) => entry.cardId === cardId);
    return { cardId, card: current || history.at(-1)?.card, history };
  }).filter((entry) => entry.card);
  useEffect(() => {
    if (!focusSection) return;
    setTabRaw(focusSection.section === 'league' ? 'league' : 'team');
    setSub(subForSection(focusSection.section));
    const targetId = focusSection.section === 'office'
      ? 'team-coach-card'
      : ['gameplan', 'adjustment'].includes(focusSection.section) ? `team-${focusSection.section}-cards` : `team-${focusSection.section}`;
    requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({
      behavior: 'smooth',
      block: focusSection.section === 'office' ? 'center' : 'start',
      inline: 'center',
    }));
  }, [focusSection]);

  // Onboarding anchor: Begin Season once a lineup is set, gated by its own CoachmarkTour
  // storageKey (shown once ever, ignoring later seasons where the same "active" condition is
  // true again) — no separate transition-tracking needed here.
  const beginSeasonBtnRef = useRef(null);
  const [showSeasonIssues, setShowSeasonIssues] = useState(false);
  useEffect(() => {
    if (!showSeasonIssues) return undefined;
    const timer = window.setTimeout(() => setShowSeasonIssues(false), 4000);
    return () => window.clearTimeout(timer);
  }, [showSeasonIssues]);

  // Swipe right anywhere on a sub page to go back to the Team page; on the top-level pages a
  // swipe moves between the Team and League tabs. Bails out for a touch that starts inside a
  // child modal or horizontal scroller (their gestures belong to that surface, even though
  // they bubble through this body handler).
  const swipeStart = useRef(null);
  const handleBodyTouchStart = (event) => {
    const ownsHorizontalGesture = event.target.closest(
      '.development-picker, .tsx-overlay, .row-scroll, .strategy-deal-row, .ts-cost-blocks, .league-standings-table, .lb-sheet, .lb-cards, .lb-picker',
    );
    swipeStart.current = ownsHorizontalGesture ? null : { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };
  const handleBodyTouchEnd = (event) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    // A deliberate, mostly-horizontal drag — not a passing touch while scrolling the page.
    if (Math.abs(dx) < 90 || Math.abs(touch.clientY - start.y) > 60) return;
    if (sub) { if (dx > 0) leaveSub(); return; }
    if (tab === 'team' && dx < 0) setTab('league');
    else if (tab === 'league' && dx > 0) setTab('team');
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
  if (team.hand.length > ROSTER_SIZE) seasonIssues.push(`Resolve your roster (${team.hand.length}/${ROSTER_SIZE})`);
  if (isOverLimit(team)) seasonIssues.push('Resolve team budget');
  if (!team.lineupSet || starters.length !== 5) seasonIssues.push('Set your lineup');

  // A Team main tile: sub pages are dealt in over the main page on a phone;
  // on desktop everything is already stacked on one page, so the tile scrolls to its section.
  const openSub = (target) => {
    if (isDesktop) {
      const id = { lineup: 'team-lineup', coach: 'team-coach-card', gm: 'team-gm-card', budget: 'team-ledger', scouting: 'team-league' }[target];
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    window.scrollTo(0, 0);
    enterSub(target);
  };

  const scoutingList = (
    scoutingRows.length ? <div className="scouting-report-list">{scoutingRows.map(({ cardId, card, history }) => (
                <div className="scouting-report-row" key={cardId}>
                  <strong>#{jerseyNumber(card)} · {playerGrade(card)} · {card.archetype} · {card.position}</strong>
                  {history.length ? history.map((entry) => <small key={`${entry.season}-${entry.game}`}>Season {entry.season}: Starter {entry.starterOutput} · Sixth Man {entry.sixthManOutput} · Depth {entry.depthOutput}</small>) : <small>Tracking begins with your next season simulation.</small>}
                </div>
              ))}</div> : <div className="ts-ledger-empty">Add players from Teams, Free Agency, or Draft Class.</div>
  );
  const scoutingPage = (
    <div className="ts-section" id="team-scouting">
      <div className="ts-heading">Scouting Report</div>
      {scoutingList}
    </div>
  );
  const leaguePage = (
    <>
            <div className="ts-section league-overview" id="team-league">
              <div className="ts-heading">League</div>
              <div className="league-jump-actions">
                {onTeamRosters && <button type="button" className="league-jump-button rosters" onClick={onTeamRosters}>Teams</button>}
                <button type="button" className="league-jump-button free-agency" onClick={onFreeAgency}>Free Agency</button>
                <button type="button" className="league-jump-button draft" onClick={onDraftClass}>Draft Class</button>
              </div>
              <div className="ts-heading league-standings-heading">Scouting Report</div>
              {scoutingList}
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
        {state.settings.fanbaseCardsEnabled !== false && (
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
    </>
  );
  const lineupPage = (
                <div id="team-lineup">
                  <SetLineupScreen
                    team={team}
                    actions={actions}
                    myTeamId={myTeamId}
                    canEdit={canEdit}
                    onPreviewChange={onLineupPreviewChange}
                  />
                </div>
  );
  const ledgerPage = (
            <div className="ts-section ts-ledger" id="team-ledger">
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
                      <PlayerLedgerIdentity card={card} role="Starter" />
                      <CostBlocks turns={card.contract} amount={card.salary} />
                      {canEdit && <button className="ts-ledger-release" onClick={() => handleRelease(card)}>Release</button>}
                    </div>
                  ))}
                </div>
                <div className="ts-ledger-subtitle">Bench</div>
                <div className="ts-ledger-list">
                  {team.hand.filter((card) => !activeSet.has(card.id)).map((card) => (
                    <div className={'ts-ledger-person' + (canEdit ? ' releasable' : '')} key={card.id}>
                      <PlayerLedgerIdentity card={card} role={card.id === team.sixthManId ? 'Sixth Man' : 'Depth'} />
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
  );
  const officePage = (which) => (
            <div className="ts-section" id="team-office">
              <div className="ts-heading">{which === 'both' ? 'Coach & GM' : which === 'coach' ? 'Coach' : 'GM'}</div>
              {/* Coach gets its own row, GM (and Fanbase, the other front-office role) a second
                  row below it — kept apart rather than sharing one swipeable row of up to three
                  cards. Neither row ever holds more than two cards, so both stay a plain
                  stretch-to-fit row with no scroll tracking needed. */}
              {(which === 'both' || which === 'coach') && <div className="fo-deal-row row-fit" style={{ margin: 0 }}>
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
              </div>}
              {(which === 'both' || which === 'gm') && <div className="fo-deal-row row-fit" style={{ margin: which === 'both' ? '12px 0 0' : 0 }}>
                <div className="ts-fo-col" id="team-gm-card">
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
              </div>}
            </div>
  );

  return (
    <>
      <div className={'screen ts-screen' + ''}>
        <div className="ts-viewing-franchise"><span>{readOnly ? 'Viewing Franchise' : 'Your Franchise'}</span><strong>{team.name}</strong></div>
        {sub ? (
          <div className="ts-pagebar">
            <button type="button" className="ts-pagebar-back" onClick={leaveSub} aria-label="Back to Team">‹</button>
            <h2>{SUB_TITLES[sub]}</h2>
            {sub === 'lineup' && <div className="ts-pagebar-actions" id="lineup-header-actions" />}
          </div>
        ) : (
          <div className="ts-tabbar">
            <button className={'ts-tab ts-tab-static' + (tab === 'team' ? ' active' : '')} onClick={() => setTab('team')}>Team</button>
            <button className={'ts-tab ts-tab-static' + (tab === 'league' ? ' active' : '')} onClick={() => setTab('league')}>League</button>
          </div>
        )}

        <div className={'ts-body' + (subBusy ? ' ts-stacking' : '')} onTouchStart={!isDesktop ? handleBodyTouchStart : undefined} onTouchEnd={!isDesktop ? handleBodyTouchEnd : undefined}>
          {isDesktop ? (
            <>
              <TeamMain team={team} readOnly={readOnly} committed={committed} cap={cap} budgetSources={budgetSources} onOpen={openSub} />
              {lineupPage}
              {leaguePage}
              {ledgerPage}
              {team.gmType && officePage('both')}
            </>
          ) : tab === 'league' ? (
            leaguePage
          ) : (
            <>
              {(!sub || subBusy) && (
                <div className={'ts-main-layer' + (subOpen ? ' away' : '')}>
                  <TeamMain team={team} readOnly={readOnly} committed={committed} cap={cap} budgetSources={budgetSources} onOpen={openSub} />
                  <div className="ts-main-dim" aria-hidden="true" />
                </div>
              )}
              {sub && (
                <div className={'ts-sub-layer' + (subOpen ? ' open' : '') + (subBusy ? '' : ' settled')}>
                  {sub === 'lineup' && lineupPage}
                  {(sub === 'coach' || sub === 'gm') && team.gmType && officePage(sub)}
                  {sub === 'budget' && ledgerPage}
                  {sub === 'scouting' && scoutingPage}
                </div>
              )}
            </>
          )}
        </div>

        {preSeason && team.hand.length > ROSTER_SIZE && (
          <div className="statusline" style={{ marginTop: 16 }}>
            Resolve your roster before the season begins: release {team.hand.length - ROSTER_SIZE} player{team.hand.length - ROSTER_SIZE === 1 ? '' : 's'}.
          </div>
        )}
        {preSeason && team.hand.length === ROSTER_SIZE && isOverLimit(team) && (
          <div className="statusline" style={{ marginTop: 16 }}>Get under budget before the season begins. Reduce committed costs by {formatCoins(committed - cap - overageAllowance(team))}.</div>
        )}
        {showWelcome && (
          <div className="tw-backdrop" role="presentation">
            <div className="tw-dialog" role="dialog" aria-modal="true" aria-labelledby="tw-title">
              <h2 id="tw-title">Welcome to Nine Deep!</h2>
              <p>This is your home page. You can set your lineups, study your scouting report and manage your budget here. Try setting your lineup now and see how you matchup against the league.</p>
              <button type="button" className="primary" autoFocus onClick={dismissWelcome}>Let's Go</button>
            </div>
          </div>
        )}
        <CoachmarkTour
          storageKey="nine-deep-onboard-begin-season-seen"
          active={!readOnly && !onBack && team.lineupSet}
          steps={[{ targetRef: beginSeasonBtnRef, title: 'Lineup Set', body: 'Free Agency stays open if you want to upgrade — Begin Season locks it in when you’re ready.' }]}
        />
      </div>
      {/* The lineup sub page has its own SAVE; Begin Season stays off it. */}
      {!(sub === 'lineup' && !onBack) && <div className="bottombar">
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
              className={'primary' + (!team.lineupConfirmed && seasonIssues.length > 0 ? ' needs-attention' : '')}
              disabled={team.lineupConfirmed}
              aria-expanded={showSeasonIssues}
              onClick={() => {
                if (seasonIssues.length > 0) {
                  setShowSeasonIssues(true);
                  return;
                }
                if (team.hand.length < ROSTER_SIZE && !window.confirm(`Start the season with an incomplete roster (${team.hand.length}/${ROSTER_SIZE})? This will negatively affect your franchise's output`)) return;
                const res = actions.confirmLineup(myTeamId);
                if (res && res.valid === false) alert(res.msg);
              }}
            >
              {team.lineupConfirmed
                ? (waitingOn.length > 0 ? `Waiting For ${waitingOn.length} User${waitingOn.length === 1 ? '' : 's'} To Continue` : 'Waiting…')
                : 'Begin Season'}
              {!team.lineupConfirmed && seasonIssues.length > 0 && <span className="bottombar-warn-icon" aria-hidden="true">!</span>}
            </button>
            {!team.lineupConfirmed && seasonIssues.length > 0 && showSeasonIssues && (
              <div className="bottombar-issues">
                <ul>
                  {seasonIssues.map((msg) => (
                    <li key={msg}>
                      {msg === 'Set your lineup' ? (
                        <button type="button" onClick={() => { setShowSeasonIssues(false); setSub('lineup'); }}>Set your lineups</button>
                      ) : msg === 'Resolve team budget' ? (
                        <button type="button" onClick={() => { setShowSeasonIssues(false); setSub('budget'); }}>Resolve your budget</button>
                      ) : msg.startsWith('Resolve your roster') ? (
                        <button type="button" onClick={() => { setShowSeasonIssues(false); setSub('budget'); }}>{msg}</button>
                      ) : msg}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>}
    </>
  );
}
