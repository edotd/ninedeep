import { useEffect, useRef, useState } from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import PlayerCard from '../components/PlayerCard';
import PlayerFilterBar from '../components/PlayerFilterBar';
import { formatCoins } from '../game/economy';
import { jerseyNumber, playerGrade } from '../game/cards';
import { sortPlayers } from '../game/playerFilters';
import { DEVELOPMENT_STATS_BY_STYLE } from '../game/strategyCards';

const ROSTER_TABLE_COLUMNS = [
  { key: 'role', label: 'Role' },
  { key: 'position', label: 'Pos' },
  { key: 'number', label: '#' },
  { key: 'grade', label: 'Grd' },
  { key: 'SCO', label: 'SCO' },
  { key: 'PLM', label: 'PLM' },
  { key: 'REB', label: 'REB' },
  { key: 'DEF', label: 'DEF' },
  { key: 'cost', label: 'Cost' },
];

function PlayerRosterTable({ starters, bench, sixthManId, sort, starterOpenSlots, benchOpenSlots, showActions, onRelease, onDevelop }) {
  const starterIds = new Set(starters.map((card) => card.id));
  const sorted = sortPlayers(starters.concat(bench), sort).map((card) => ({ card, role: starterIds.has(card.id) ? 'Starter' : card.id === sixthManId ? 'Sixth Man' : 'Depth' }));
  const openColSpan = ROSTER_TABLE_COLUMNS.length - 1 + (showActions ? 1 : 0);
  return (
    <div className="ts-roto-table-wrap">
      <table className="ts-roto-table">
        <thead>
          <tr>
            {ROSTER_TABLE_COLUMNS.map((col) => <th key={col.key}>{col.label}</th>)}
            {showActions && <th className="ts-roto-actions-head">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ card, role }) => (
            <tr key={card.id} className={'ts-roto-row ' + role.toLowerCase()}>
              <td className={'ts-roto-role ' + role.toLowerCase()}>{role}</td>
              <td>{card.position[0]}</td>
              <td>{jerseyNumber(card)}</td>
              <td>{playerGrade(card)}</td>
              <td>{card.stats.SCO}</td>
              <td>{card.stats.PLM}</td>
              <td>{card.stats.REB}</td>
              <td>{card.stats.DEF}</td>
              <td>{formatCoins(card.salary)}</td>
              {showActions && (
                <td className="ts-roto-actions">
                  {onRelease && <button type="button" onClick={(e) => { e.stopPropagation(); onRelease(card); }}>Release</button>}
                  {onDevelop && <button type="button" onClick={(e) => { e.stopPropagation(); onDevelop(card); }}>Dev</button>}
                </td>
              )}
            </tr>
          ))}
          {Array.from({ length: starterOpenSlots }, (_, i) => (
            <tr className="ts-roto-row open" key={'starter-open-' + i}><td className="ts-roto-role starter">Starter</td><td colSpan={openColSpan}>OPEN</td></tr>
          ))}
          {Array.from({ length: benchOpenSlots }, (_, i) => (
            <tr className="ts-roto-row open" key={'bench-open-' + i}><td className="ts-roto-role bench">Bench</td><td colSpan={openColSpan}>OPEN</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// A league-wide roster browser reached from the League page's "Rosters" button — the same
// card carousel/list that used to live on the Team File's own Players tab, but not tied to any
// one team: a switcher up top lets you page through every team in the league. Only the viewer's
// own team can Release/Develop (still gated by the same pre-season/lineup-unconfirmed window as
// everywhere else); every other team's roster is a pure read-only lookup, same spirit as
// clicking into a team from Standings.
export default function TeamRostersScreen({ state, actions, myTeamId, onBack }) {
  const isDesktop = useIsDesktop();
  const [selectedTeamId, setSelectedTeamId] = useState(myTeamId);
  const team = state.teams[selectedTeamId] || state.teams[myTeamId];
  const isOwnTeam = team.id === myTeamId;
  const preSeason = state.phase === 'teamsummary' || state.phase === 'pullhand';
  const canEdit = isOwnTeam && preSeason && !team.lineupConfirmed;
  const viewerTeam = state.teams[myTeamId];
  const toggleScout = (card) => {
    const result = actions.toggleScouting(myTeamId, card.id);
    if (result?.ok === false) alert(result.msg);
  };

  const activeSet = new Set(team.activeIds || []);
  const starters = team.hand.filter((c) => activeSet.has(c.id));
  const bench = team.hand.filter((c) => !activeSet.has(c.id));
  const starterOpenSlots = Math.max(0, 5 - starters.length);
  const benchOpenSlots = Math.max(0, 2 - bench.length);

  const [playerSort, setPlayerSort] = useState('position');
  const [viewMode, setViewMode] = useState('carousel');
  const [rotationIndex, setRotationIndex] = useState(0);
  const [developPlayer, setDevelopPlayer] = useState(null);
  const sortedRoster = sortPlayers(team.hand, playerSort);
  const mobileCardCount = sortedRoster.length + starterOpenSlots + benchOpenSlots;
  const rotoScrollRef = useRef(null);

  useEffect(() => { setRotationIndex(0); rotoScrollRef.current?.scrollTo({ left: 0 }); }, [selectedTeamId, playerSort]);

  useEffect(() => {
    if (isDesktop || viewMode !== 'carousel' || !rotoScrollRef.current) return undefined;
    const FILL_RATIO = 0.96;
    const MAX_UPSCALE = 1;
    const container = rotoScrollRef.current;
    const applyScales = () => {
      const containerRect = container.getBoundingClientRect();
      const lowerChrome = [document.querySelector('.persistent-bar'), document.querySelector('.bottombar')]
        .filter(Boolean)
        .map((element) => element.getBoundingClientRect().top)
        .filter((top) => top > containerRect.top);
      const visibleBottom = lowerChrome.length ? Math.min(...lowerChrome) : containerRect.bottom;
      const available = Math.min(container.clientHeight, visibleBottom - containerRect.top);
      if (!available) return;
      container.querySelectorAll('.ts-roto-grid .pcard').forEach((el) => {
        const natural = Math.max(el.scrollHeight, el.offsetHeight);
        if (!natural) return;
        const scale = Math.min(MAX_UPSCALE, (available * FILL_RATIO) / natural);
        el.style.transform = Math.abs(scale - 1) < 0.001 ? 'none' : `scale(${scale})`;
      });
    };
    applyScales();
    const firstFrame = requestAnimationFrame(() => requestAnimationFrame(applyScales));
    const observer = new ResizeObserver(applyScales);
    observer.observe(container);
    return () => { cancelAnimationFrame(firstFrame); observer.disconnect(); };
  }, [isDesktop, viewMode, team.hand, selectedTeamId, mobileCardCount]);

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

  return (
    <div className="screen ts-screen">
      <div className="ts-viewing-franchise"><span>Rosters</span><strong>{team.name}</strong></div>

      <div className="team-roster-switcher">
        {state.teams.map((t) => (
          <button
            key={t.id}
            type="button"
            className={'team-roster-pill' + (t.id === team.id ? ' active' : '')}
            onClick={() => setSelectedTeamId(t.id)}
          >
            {t.tricode || t.name}{t.id === myTeamId ? ' •' : ''}
          </button>
        ))}
      </div>

      <div className="ts-section ts-player-carousel">
        <div className="ts-heading team-roster-heading-row">
          <span>Roster</span>
          {!isDesktop && (
            <span className="team-roster-view-toggle">
              <button type="button" className={viewMode === 'carousel' ? 'active' : ''} onClick={() => setViewMode('carousel')}>Carousel</button>
              <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>List</button>
            </span>
          )}
        </div>
        <PlayerFilterBar sort={playerSort} onChange={setPlayerSort} />

        {!isDesktop && viewMode === 'list' ? (
          <PlayerRosterTable
            starters={starters}
            bench={bench}
            sixthManId={team.sixthManId}
            sort={playerSort}
            starterOpenSlots={starterOpenSlots}
            benchOpenSlots={benchOpenSlots}
            showActions={canEdit}
            onRelease={canEdit ? handleRelease : undefined}
            onDevelop={canEdit && team.developmentPoints > 0 ? setDevelopPlayer : undefined}
          />
        ) : (
          <div className="ts-roto-viewport">
            <div
              className="ts-roto-scroll"
              ref={rotoScrollRef}
              onScroll={!isDesktop ? (event) => {
                const width = event.currentTarget.scrollWidth / mobileCardCount;
                if (width) setRotationIndex(Math.round(event.currentTarget.scrollLeft / width));
              } : undefined}
            >
              <div className="ts-roto-grid">
                {(isDesktop ? sortedRoster : sortedRoster).map((c) => (
                  <div className="ts-roto-slot" key={c.id}>
                    <PlayerCard
                      card={c}
                      rosterLabel={activeSet.has(c.id) ? 'Starter' : c.id === team.sixthManId ? 'Sixth Man' : 'Depth'}
                      onRelease={canEdit ? handleRelease : undefined}
                      onDevelop={canEdit && team.developmentPoints > 0 ? setDevelopPlayer : undefined}
                      alwaysShowOptions={!isDesktop}
                      onScout={!isOwnTeam ? toggleScout : undefined}
                      scouted={viewerTeam.scoutingReport?.includes(c.id)}
                      revealPeak={!isOwnTeam && viewerTeam.gmTrait?.name === 'Third Eye' && viewerTeam.scoutingReport?.includes(c.id)}
                    />
                  </div>
                ))}
                {Array.from({ length: starterOpenSlots }, (_, i) => <div className="ts-roto-slot" key={'starter-open-' + i}><div className="ts-bench-open starter">OPEN STARTER</div></div>)}
                {Array.from({ length: benchOpenSlots }, (_, i) => <div className="ts-roto-slot" key={'open-' + i}><div className="ts-bench-open">OPEN</div></div>)}
              </div>
            </div>
            {!isDesktop && (() => {
              const onLastCard = rotationIndex >= mobileCardCount - 1;
              if (onLastCard) return null;
              return <div className="ts-hand-peek-tab" aria-hidden="true"><span className="ts-hand-peek-chevron">›</span></div>;
            })()}
          </div>
        )}
      </div>

      {developPlayer && (
        <div className="development-picker-backdrop" onClick={() => setDevelopPlayer(null)}>
          <div className="development-picker" role="dialog" aria-modal="true" aria-label={`Develop ${developPlayer.archetype}`} onClick={(event) => event.stopPropagation()}>
            <div className="development-picker-head"><div><div className="ts-heading">Develop Player</div><div className="development-picker-player">#{developPlayer.id} · {developPlayer.position} · {developPlayer.archetype}</div></div><button className="secondary" onClick={() => setDevelopPlayer(null)}>Close</button></div>
            <div className="development-picker-cards">
              <div className="development-points-summary"><strong>{team.developmentPoints || 0}</strong><span>Development Points Available</span><small>{team.coach?.archetype} coaches develop {DEVELOPMENT_STATS_BY_STYLE[team.coach?.archetype]?.join(' or ')}.</small></div>
              {(DEVELOPMENT_STATS_BY_STYLE[team.coach?.archetype] || []).map((stat) => (
                <button key={stat} className="development-stat-button" disabled={!team.developmentPoints} onClick={() => { const result = actions.applyDevelopmentPoint(myTeamId, developPlayer.id, stat); if (result?.ok === false) alert(result.msg); else setDevelopPlayer(null); }}>+1 {stat}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bottombar"><button className="primary" onClick={onBack}>Back</button></div>
    </div>
  );
}
