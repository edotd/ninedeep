import { useEffect, useRef, useState } from 'react';
import Header from './Header';
import PersistentBar from './PersistentBar';
import Sidebar from './Sidebar';
import DesktopBar from './DesktopBar';
import { useIsDesktop } from '../hooks/useIsDesktop';
import GlossaryScreen from '../screens/GlossaryScreen';
import LeagueScreen from '../screens/LeagueScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CardOverviewScreen from '../screens/CardOverviewScreen';
import PullCardsScreen from '../screens/PullCardsScreen';
import DealScreen from '../screens/DealScreen';
import TeamSummaryScreen from '../screens/TeamSummaryScreen';
import PullModifierScreen from '../screens/PullModifierScreen';
import StandingsScreen from '../screens/StandingsScreen';
import PlayoffsScreen from '../screens/PlayoffsScreen';
import ResultsScreen from '../screens/ResultsScreen';
import SeasonRecapScreen from '../screens/SeasonRecapScreen';
import DraftScreen from '../screens/DraftScreen';
import EraEndScreen from '../screens/EraEndScreen';
import ConstructingScreen from '../screens/ConstructingScreen';
import SimulatingSeasonScreen from '../screens/SimulatingSeasonScreen';
import SeasonTransitionScreen from '../screens/SeasonTransitionScreen';
import ContractsScreen from '../screens/ContractsScreen';
import FreeAgencyScreen from '../screens/FreeAgencyScreen';
import FranchiseMasthead from './FranchiseMasthead';
import { rosterSalary } from '../game/economy';
import { hasPendingBidDecision } from '../game/bidding';

const SCREENS = {
  cardoverview: CardOverviewScreen,
  pullcards: PullCardsScreen,
  pullhand: DealScreen,
  pullmodifier: PullModifierScreen,
  seasontransition: SeasonTransitionScreen,
  constructing: ConstructingScreen,
  teamsummary: TeamSummaryScreen,
  standings: StandingsScreen,
  playoffs: PlayoffsScreen,
  results: ResultsScreen,
  seasonrecap: SeasonRecapScreen,
  contracts: ContractsScreen,
  draft: DraftScreen,
  simulating: SimulatingSeasonScreen,
  era_end: EraEndScreen,
};

// The persistent bar is up from the very start of the onboarding sequence now — its slots
// read as empty (see PersistentBar/DesktopBar) until each card type is actually dealt, so the
// bar filling in phase by phase (hand, then front office, then matchup cards) IS the deal
// animation's payoff rather than something hidden until Team Summary. It's still hidden during
// the Simulating Season loading beat and the season transition — full-screen loading treatment,
// same as Constructing.
const HIDE_BAR_PHASES = new Set(['simulating', 'seasontransition']);

// Glossary/Standings/Settings/Team/Card Types are client-local overlays, not part of the shared game
// phase — a room's `state.phase` drives what everyone in the room sees, so if opening the
// Glossary changed it, one player checking a rule would yank every other player's screen
// to the Glossary too. Overlay state lives here instead and never touches Firestore.
//
// The game's *flow* (Hand -> Front Office -> Matchup Cards -> Team Summary ->
// Playoffs -> Results -> Contracts -> Draft -> Team) is identical on mobile and desktop — only the surrounding
// shell changes at the desktop breakpoint: a Sidebar + full-width persistent bar per the
// brand handoff, instead of the phone-width top bar + collapsed bottom bar. Same
// `overlay`/`Screen` resolution feeds both shells so the two never drift out of sync.
export default function GameShell({ state, actions, myTeamId, onNewEra, roomCode }) {
  const mobileTopRef = useRef(null);
  const [mobileTopHeight, setMobileTopHeight] = useState(0);
  const persistentBarRef = useRef(null);
  const [persistentBarHeight, setPersistentBarHeight] = useState(0);
  const [overlay, setOverlay] = useState(null); // null | 'glossary' | 'settings' | 'standings' | 'team' | 'freeagency' | 'cardtypes'
  const navAttentionKey = `nine-deep-nav-seen:${state.eraId || state.teamName || state.teams?.map((team) => team.name).join('|')}:${myTeamId}`;
  const [navNeedsAttention, setNavNeedsAttention] = useState(() => {
    try { return localStorage.getItem(navAttentionKey) !== '1'; } catch { return true; }
  });
  const acknowledgeNav = () => {
    setNavNeedsAttention(false);
    try { localStorage.setItem(navAttentionKey, '1'); } catch { /* storage can be unavailable */ }
  };
  // Clicking another team in Standings opens the Team overlay on THEIR file instead of the
  // caller's own (viewTeamId), remembering whatever overlay (or none, for a phase screen like
  // StandingsScreen) was showing so Back returns there rather than dumping out to the base game.
  const [viewTeamId, setViewTeamId] = useState(null);
  const [returnOverlay, setReturnOverlay] = useState(null);
  const [teamFocus, setTeamFocus] = useState(null);
  const toggleOverlay = (name) => setOverlay((o) => (o === name ? null : name));
  // Navigating to 'team' via the sidebar/header (as opposed to jumping in from Standings)
  // always means "show my own file" — reset any leftover viewTeamId from a prior jump. If
  // the base phase screen is already showing that same file (see onOwnTeamPage above), this
  // is a no-op instead of re-navigating to a page the user is already looking at.
  const handleNav = (name) => {
    if (name === 'team') {
      if (onOwnTeamPage) return;
      setViewTeamId(null);
      setTeamFocus(null);
    }
    toggleOverlay(name);
  };
  const openTeamSection = (section) => {
    setViewTeamId(null);
    setTeamFocus({ section, request: Date.now() });
    setOverlay('team');
  };
  const isDesktop = useIsDesktop();
  const showChrome = state.teams && state.teams.length > 0;
  useEffect(() => {
    if (isDesktop || !mobileTopRef.current) return undefined;
    const updateHeight = () => setMobileTopHeight(mobileTopRef.current?.getBoundingClientRect().height || 0);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(mobileTopRef.current);
    return () => observer.disconnect();
  }, [isDesktop, showChrome]);

  // The Rotation tab's locked carousel now keeps the persistent bar on screen (it used to hide
  // it entirely), so it needs this bar's real height to reserve space for it, the same way it
  // already reserves space for the header via --mobile-persistent-top-height.
  useEffect(() => {
    if (isDesktop || !persistentBarRef.current) return undefined;
    const updateHeight = () => setPersistentBarHeight(persistentBarRef.current?.getBoundingClientRect().height || 0);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(persistentBarRef.current);
    return () => observer.disconnect();
  }, [isDesktop, showChrome]);

  // The live match board and the Rotation tab's locked carousel both need to know the TRUE
  // visible viewport height and the real safe-area inset sizes, in px, to fit their content
  // exactly between the screen's true edges. CSS `100dvh`/`env(safe-area-inset-*)` were the
  // first attempt, but a phone screenshot showed them silently not being honored in at least
  // one real mobile browser (WebKit-based but not Safari itself) — the board rendered under
  // the status bar with a large dead gap at the bottom, even though every other check (DOM
  // structure, selector specificity, cascade order) came back clean in this session's own
  // testing. window.visualViewport + a live env() probe are what production apps reach for
  // once the raw CSS units prove unreliable across the real range of mobile browsers, so
  // that's the fallback here rather than a third guess at more CSS.
  const [viewportPx, setViewportPx] = useState(null);
  useEffect(() => {
    if (isDesktop) return undefined;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;height:0;width:0;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden;';
    document.body.appendChild(probe);
    const measure = () => {
      const cs = getComputedStyle(probe);
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      setViewportPx({ vh, safeTop: parseFloat(cs.paddingTop) || 0, safeBottom: parseFloat(cs.paddingBottom) || 0 });
    };
    measure();
    window.visualViewport?.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    window.addEventListener('resize', measure);
    return () => {
      probe.remove();
      window.visualViewport?.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      window.removeEventListener('resize', measure);
    };
  }, [isDesktop]);

  // How many cards of the opening deal (hand, then Front Office, then Matchup Cards, in that
  // fixed order) have visibly landed so far — DealScreen counts these up as it deals, and
  // DesktopBar/PersistentBar slice their real slots down to this count while state.phase is
  // 'pullhand', so the persistent bar filling in slot by slot IS the deal animation's payoff
  // (see DesktopBar's own comment) rather than something that only snaps to full on Continue.
  const [dealProgress, setDealProgress] = useState(0);
  useEffect(() => { if (state.phase === 'pullhand') setDealProgress(0); }, [state.phase]);

  // Whether THIS client has clicked (or auto-advanced, on mobile) past its own DealScreen —
  // purely local, never written to the shared doc. state.phase stays 'pullhand' for every
  // player until every human has confirmed their lineup (see TeamSummaryScreen/confirmLineup);
  // a single player finishing their own deal animation used to flip the shared phase and yank
  // everyone else's screen to Team Summary too. Now each player moves on at their own pace,
  // and TeamSummaryScreen treats 'pullhand' the same as 'teamsummary' once reached this way.
  const [pastDeal, setPastDeal] = useState(false);
  useEffect(() => { if (state.phase !== 'pullhand') setPastDeal(false); }, [state.phase]);
  const effectivePhase = state.phase === 'pullhand' && pastDeal ? 'teamsummary' : state.phase;

  // TeamSummaryScreen renders two ways: as the base phase screen once the flow reaches
  // 'teamsummary' (overlay stays null the whole time), or as the 'team' overlay opened from
  // the sidebar/header. Both are "the franchise page" to look at, but only the second sets
  // `overlay`, so the nav item never highlighted — and clicking it while already on the base
  // phase screen re-navigated to the exact same page via the overlay path instead of no-op'ing.
  // navOverlay folds the base-phase case into 'team' for nav highlighting only; the real
  // `overlay` state (and everything that opens/closes it) is untouched.
  const onOwnTeamPage = overlay === null && viewTeamId == null && effectivePhase === 'teamsummary';
  const navOverlay = onOwnTeamPage ? 'team' : overlay;

  const openTeamView = (teamId, fromOverlay) => {
    setReturnOverlay(fromOverlay);
    setViewTeamId(teamId);
    setTeamFocus(null);
    setOverlay('team');
  };
  const closeTeamView = () => {
    setOverlay(returnOverlay);
    setReturnOverlay(null);
    setViewTeamId(null);
  };

  const headerProps = {
    state,
    myTeamId,
    overlay: navOverlay,
    onGlossary: () => toggleOverlay('glossary'),
    onStandings: () => toggleOverlay('standings'),
    onSettings: () => toggleOverlay('settings'),
    onTeam: () => handleNav('team'),
    onFreeAgency: () => toggleOverlay('freeagency'),
    freeAgencyAlert,
    navNeedsAttention,
    onAcknowledgeNav: acknowledgeNav,
    roomCode,
  };

  const showBar = showChrome && !HIDE_BAR_PHASES.has(state.phase);
  // Free Agency needs a visit before the draft/season can start (see closeFreeAgency,
  // game/season.js) — flag the nav item while it's still open for this team, this team is over
  // budget, or a bid this team placed is waiting on its own raise/stand-pat decision.
  const myTeam = myTeamId != null ? state.teams?.[myTeamId] : null;
  const freeAgencyAlert = Boolean(myTeam && showChrome && (
    (state.phase === 'contracts' && !state.offseason?.freeAgencyClosed?.[myTeam.id])
    || rosterSalary(myTeam) > (myTeam.seasonCap || 0)
    || hasPendingBidDecision(state, myTeam)
  ));
  const mastheadTeamId = overlay === 'team' && viewTeamId != null ? viewTeamId : myTeamId;

  const close = () => setOverlay(null);
  let overlayBody = null;
  if (overlay === 'glossary') overlayBody = <GlossaryScreen state={state} onBack={close} />;
  else if (overlay === 'settings') overlayBody = <SettingsScreen state={state} actions={actions} onBack={close} onNewEra={onNewEra} />;
  else if (overlay === 'standings') overlayBody = <LeagueScreen state={state} myTeamId={myTeamId} onBack={close} onViewTeam={(id) => openTeamView(id, 'standings')} />;
  else if (overlay === 'team') overlayBody = <TeamSummaryScreen key={teamFocus?.request || 'team'} state={state} actions={actions} myTeamId={myTeamId} viewTeamId={viewTeamId} onBack={closeTeamView} focusSection={teamFocus} onFreeAgency={() => setOverlay('freeagency')} />;
  else if (overlay === 'freeagency') overlayBody = <FreeAgencyScreen state={state} actions={actions} myTeamId={myTeamId} onBack={close} />;
  else if (overlay === 'cardtypes') overlayBody = <CardOverviewScreen state={state} actions={actions} myTeamId={myTeamId} onBack={close} />;

  const Screen = SCREENS[effectivePhase];
  const mainBody = overlayBody || (Screen
    ? <Screen state={state} actions={actions} myTeamId={myTeamId} onViewTeam={(id) => openTeamView(id, null)} onFreeAgency={() => setOverlay('freeagency')} onEndGame={onNewEra} dealProgress={dealProgress} onDealProgress={setDealProgress} onDealDone={() => setPastDeal(true)} />
    : (
      <div className="screen">
        <h1>Something broke</h1>
        <p className="lede">Unknown phase: {state.phase}</p>
        <button className="secondary" style={{ width: '100%', marginTop: 14 }} onClick={onNewEra}>Reset Game</button>
      </div>
    ));

  if (isDesktop && showChrome) {
    return (
      <div className="desktop-shell">
        <Sidebar state={state} myTeamId={myTeamId} overlay={navOverlay} viewTeamId={viewTeamId} onNav={handleNav} onViewTeam={(id) => openTeamView(id, overlay)} onAcknowledgeNav={acknowledgeNav} roomCode={roomCode} freeAgencyAlert={freeAgencyAlert} />
        <div className="desktop-content">
          <FranchiseMasthead state={state} teamId={mastheadTeamId} />
          {mainBody}
        </div>
        {showBar && <DesktopBar state={state} myTeamId={myTeamId} actions={actions} dealProgress={dealProgress} />}
      </div>
    );
  }

  return (
    <div className="mobile-shell" style={{
      '--mobile-persistent-top-height': `${mobileTopHeight}px`,
      '--mobile-persistent-bar-height': `${persistentBarHeight}px`,
      ...(viewportPx ? {
        '--app-vh': `${viewportPx.vh}px`,
        '--app-safe-top': `${viewportPx.safeTop}px`,
        '--app-safe-bottom': `${viewportPx.safeBottom}px`,
      } : {}),
    }}>
      {showChrome && <div className="mobile-persistent-top" ref={mobileTopRef}><Header {...headerProps} /><FranchiseMasthead state={state} teamId={mastheadTeamId} /></div>}
      {mainBody}
      {showBar && <PersistentBar ref={persistentBarRef} state={state} myTeamId={myTeamId} onNavigate={openTeamSection} dealProgress={dealProgress} />}
    </div>
  );
}
