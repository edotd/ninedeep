import { useEffect, useState } from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import TeamChemistry from '../components/TeamChemistry';
import PlayerCard from '../components/PlayerCard';
import FrontOfficeCard from '../components/FrontOfficeCard';
import { formatCoins, rosterSalary, gmCost } from '../game/economy';
import { teamOutput } from '../game/matchup';
import { teamExperience } from '../game/aging';
import { cardTier } from '../game/cards';
import { FANBASE_BOOST_COST } from '../game/constants';
import MatchupCard from '../components/MatchupCard';
import StrategyCard from '../components/StrategyCard';

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
  const context = playoffReady ? 'playoff' : seasonOpen ? 'season' : null;
  const opponents = state.teams.filter((candidate) => candidate.id !== team.id);
  const needsTarget = card.target === 'opponent' && context === 'season';
  return (
    <div className="strategy-card-action">
      {needsTarget && <select value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">Choose opponent</option>{opponents.map((opponent) => <option key={opponent.id} value={opponent.id}>{opponent.name}</option>)}</select>}
      <button className="secondary" disabled={!context || (needsTarget && !targetId)} onClick={() => actions.playGameplanCard(myTeamId, card.id, context, needsTarget ? targetId : null)}>{context === 'playoff' ? 'Use In Matchup' : context === 'season' ? 'Use This Season' : 'Unavailable'}</button>
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
export default function TeamSummaryScreen({ state, actions, myTeamId, viewTeamId, onBack }) {
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
  const openSlots = 9 - team.hand.length;
  const otherHumans = state.teams.filter((t) => t.human && t.id !== team.id);
  const waitingOn = otherHumans.filter((t) => !t.lineupConfirmed);

  const committed = rosterSalary(team);
  const cap = team.seasonCap || 0;
  const room = cap - committed;
  const expiring = team.hand.filter((c) => c.contract <= 1);
  const expiringTotal = expiring.reduce((s, c) => s + c.salary, 0);

  const output = team.coach && team.activeIds && team.activeIds.length > 0 ? teamOutput(team) : null;
  const chemistry = team.coach ? teamExperience(team) : null;

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
  const [tab, setTab] = useState('rotation');
  const showSection = (key) => isDesktop || tab === key;

  // Substitutions: click a starter then a bench player (either order) to swap them, click the
  // same card again to deselect, or a different card in the same group to move the selection
  // instead. If a starting slot is actually open (activeIds under 5 — only reachable right
  // after releasing an active starter), there's no outgoing player to pick, so a bare click on
  // any bench card fills it directly via promoteToStarter instead of requiring a selection.
  const [selectedId, setSelectedId] = useState(null);
  const [developPlayer, setDevelopPlayer] = useState(null);
  useEffect(() => { setSelectedId(null); }, [team.id, canEdit]);
  const handleCardClick = (card) => {
    if (!canEdit) return;
    const isStarter = activeSet.has(card.id);
    if (activeSet.size < 5 && !isStarter) {
      setSelectedId(null);
      const res = actions.promoteToStarter(myTeamId, card.id);
      if (res && res.ok === false) alert(res.msg);
      return;
    }
    if (!selectedId) { setSelectedId(card.id); return; }
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
        : `Release ${card.archetype} · ${card.position}? Leaves ${formatCoins(deadCapCharge)} in dead cap against your budget for each of the next ${years} seasons, starting this one.`;
    if (!window.confirm(msg)) return;
    const res = actions.releasePlayer(myTeamId, card.id);
    if (res && res.ok === false) alert(res.msg);
  };

  return (
    <>
      <div className="screen ts-screen">
        <div className="ts-tabbar">
          <button className={'ts-tab' + (tab === 'rotation' ? ' active' : '')} onClick={() => setTab('rotation')}>Rotation</button>
          <button className={'ts-tab' + (tab === 'chemistry' ? ' active' : '')} onClick={() => setTab('chemistry')}>Chemistry</button>
          {team.coach && team.market && (
            <button className={'ts-tab' + (tab === 'office' ? ' active' : '')} onClick={() => setTab('office')}>Office</button>
          )}
          <button className={'ts-tab' + (tab === 'ledger' ? ' active' : '')} onClick={() => setTab('ledger')}>Ledger</button>
          <button className={'ts-tab' + (tab === 'cards' ? ' active' : '')} onClick={() => setTab('cards')}>Cards</button>
        </div>

        <div className="ts-body">
          {showSection('chemistry') && <TeamChemistry team={team} />}

          {showSection('rotation') && (
            <div className="ts-section">
              <div className="ts-heading">Rotation</div>
              <div className="ts-roto-scroll">
                <div className="ts-roto-grid">
                  {starters.map((c) => (
                    <PlayerCard
                      key={c.id}
                      card={c}
                      selected={selectedId === c.id}
                      onClick={canEdit ? () => handleCardClick(c) : undefined}
                      onRelease={canEdit ? handleRelease : undefined}
                      onDevelop={!readOnly && !c.development ? setDevelopPlayer : undefined}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {showSection('rotation') && (
            <div className="ts-section">
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
                  {Array.from({ length: Math.max(0, openSlots) }, (_, i) => (
                    <div key={'open' + i} className="ts-bench-open">OPEN</div>
                  ))}
                  {openSlots <= 0 && bench.length < 4 && (
                    <div className="ts-bench-open">ROSTER FULL</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {showSection('ledger') && (
            <div className="ts-section">
              <div className="ts-heading">Budget Ledger</div>
              <div className="ts-budget-figures">
                <span className="committed">{formatCoins(committed).replace('🪙', '')}</span>
                <span className="slash"> / </span>
                <span className="limit">{formatCoins(cap).replace('🪙', '')}</span>
                <span className={'ts-budget-room' + (room < 0 ? ' bad' : '')}>{room >= 0 ? '+' : ''}{Math.round(room * 10) / 10} ROOM</span>
              </div>
              <div className="ts-budget-bar">
                {team.hand.map((c) => (
                  <div
                    key={c.id}
                    className={'ts-budget-seg' + (cardTier(c) === 'EXP' ? ' exp' : activeSet.has(c.id) ? '' : ' bench')}
                    style={{ width: `${cap ? Math.max(2, (c.salary / cap) * 100) : 100 / (team.hand.length || 1)}%` }}
                  />
                ))}
              </div>
              <div className="ts-ledger-row"><span>Committed This Season</span><span>{formatCoins(committed)}</span></div>
              <div className="ts-ledger-row"><span>GM Budget Hit</span><span>{formatCoins(gmCost(team.gmType))}</span></div>
              {deadCapDue > 0 && <div className="ts-ledger-row"><span>Dead Cap</span><span className="bad">{formatCoins(deadCapDue)}</span></div>}
              <div className="ts-ledger-row"><span>Expiring This Season</span><span className={expiring.length ? 'bad' : ''}>{expiring.length ? `${formatCoins(expiringTotal)} · ${expiring.map((c) => c.archetype).join(', ')}` : 'None'}</span></div>
              <div className="ts-metrics">
                <div><div className="ts-metric-label">Experience</div><div className="ts-metric-value">{chemistry !== null ? chemistry : '—'}</div></div>
                <div><div className="ts-metric-label">Proj Off</div><div className="ts-metric-value accent">{output ? output.total : '—'}</div></div>
              </div>
            </div>
          )}

          {team.coach && team.market && showSection('office') && (
            <div className="ts-section">
              <div className="ts-heading">Front Office</div>
              <div className="fo-deal-row" style={{ margin: 0 }}>
                <div className="ts-fo-col">
                  <FrontOfficeCard kind="coach" team={team} />
                  {!readOnly && (
                    <button
                      className="secondary ts-fo-action"
                      style={{ width: '100%' }}
                      onClick={() => {
                        const res = actions.fireCoach(myTeamId);
                        if (res && res.ok === false) alert(res.msg);
                      }}
                    >
                      Fire Coach — {formatCoins(fireCoachDeadCap)} Dead Cap
                    </button>
                  )}
                </div>
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
                      {team.gmChangeSeason === state.season ? 'GM Replaced This Season' : `Fire GM — ${formatCoins(Math.round((gmCost(team.gmType) / 2) * 100) / 100)} Dead Cap`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {showSection('cards') && (
            <div className="ts-section">
              <div className="ts-heading">Development Cards</div>
              <div className="strategy-deal-row">
                {(team.developmentCards || []).map((card) => <div className="strategy-card-wrap" key={card.id}><StrategyCard card={card} /><StrategyAction card={card} team={team} state={state} actions={actions} myTeamId={myTeamId} readOnly={readOnly} /></div>)}
                {(team.developmentCards || []).length === 0 && <div className="strategy-empty">New cards are dealt at the start of each season.</div>}
              </div>
            </div>
          )}

          {showSection('cards') && (
            <div className="ts-section">
              <div className="ts-heading">Gameplan Cards</div>
              <div className="strategy-deal-row">
                {(team.gameplanCards || []).map((card) => <div className="strategy-card-wrap" key={card.id}><StrategyCard card={card} /><StrategyAction card={card} team={team} state={state} actions={actions} myTeamId={myTeamId} readOnly={readOnly} /></div>)}
                {(team.gameplanCards || []).length === 0 && <div className="strategy-empty">New cards are dealt at the start of each season.</div>}
              </div>
            </div>
          )}

          {(team.matchupCards || []).length > 0 && showSection('cards') && (
            <div className="ts-section">
              <div className="ts-heading">Adjustment Cards</div>
              <div className="mu-deal-row" style={{ margin: 0 }}>
                {team.matchupCards.map((c) => <MatchupCard key={c.id} card={c} />)}
              </div>
            </div>
          )}
        </div>

        {preSeason && team.hand.length !== 9 && (
          <div className="statusline" style={{ marginTop: 16 }}>
            Resolve your roster before the season begins: {team.hand.length > 9 ? `release ${team.hand.length - 9} player${team.hand.length - 9 === 1 ? '' : 's'}` : `sign ${9 - team.hand.length} player${9 - team.hand.length === 1 ? '' : 's'} from Free Agency`}.
          </div>
        )}
        {preSeason && team.hand.length === 9 && committed > cap && (
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
      </div>
      <div className="bottombar">
        {onBack ? (
          <button className="primary" onClick={onBack}>Back</button>
        ) : (
          <button
            className="primary"
            disabled={team.lineupConfirmed}
            onClick={() => {
              const res = actions.confirmLineup(myTeamId);
              if (res && res.valid === false) alert(res.msg);
            }}
          >
            {team.lineupConfirmed
              ? (waitingOn.length > 0 ? `Waiting For ${waitingOn.length} User${waitingOn.length === 1 ? '' : 's'} To Continue` : 'Waiting…')
              : team.hand.length !== 9 ? `Resolve Roster · ${team.hand.length}/9`
              : committed > cap ? 'Resolve Budget'
              : 'Begin Season'}
          </button>
        )}
      </div>
    </>
  );
}
