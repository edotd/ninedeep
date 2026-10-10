import { useContext, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LeagueStatsContext, RosterRolesContext } from './LeagueStatsContext';
import { skillsetFor, SKILLSETS, SKILLSET_PAIRS } from '../game/skillsets';
import { formatCoins } from '../game/economy';
import { careerLevel, careerMultiplier } from '../game/aging';
import { cardTier, baseCardTier, jerseyNumber, playerGrade } from '../game/cards';
import { useIsDark } from '../hooks/useDarkMode';
import { LEAGUE_ACCOLADES, RARITY_CORNERS } from '../game/constants';
import CardTypeMark from './CardTypeMark';
import BallMark from './BallMark';
import RarityGhost from './RarityGhost';

const LEGACY_DEVELOPMENT_CHANGES = {
  'Shooting Lab': { SCO: 2 },
  'Lead Guard Reps': { PLM: 2 },
  'Glass Work': { REB: 2 },
  'Defensive Camp': { DEF: 2 },
  'Complete Program': { SCO: 1, PLM: 1, REB: 1, DEF: 1 },
};

// How long a touch has to sit still before it counts as a hold rather than a tap — long enough
// that a normal card-select tap never trips it, short enough that it doesn't feel unresponsive.
const LONG_PRESS_MS = 500;
const STAT_KEYS = ['SCO', 'PLM', 'REB', 'DEF'];

export default function PlayerCard({ card, onClick, selected, rosterLabel, compact, onRelease, onDevelop, onScout, scouted, revealPeak, alwaysShowOptions, contractLabel, signingNote }) {
  const leagueMax = useContext(LeagueStatsContext);
  const roles = useContext(RosterRolesContext);
  const roleLabel = rosterLabel || roles?.[card.id] || null;
  // Expiring contracts wear the navy treatment only in dark mode; otherwise they look like any other card.
  const dark = useIsDark();
  const tier = dark ? cardTier(card) : baseCardTier(card);
  const skillset = skillsetFor(card);
  // Every named pairing this card's Skillset can form, with the Skillset it needs beside it.
  const skillPairings = skillset
    ? SKILLSET_PAIRS.filter((rule) => rule.skills.includes(skillset.id)).map((rule) => ({
      rule, partner: SKILLSETS.find((s) => s.id === rule.skills.find((id) => id !== skillset.id))?.name || '',
    })).sort((a, b) => b.rule.percent - a.rule.percent)
    : [];
  const level = careerLevel(card);
  const positionClass = ` position-${card.position.toLowerCase()}`;
  const developmentChanges = card.development?.statChanges || LEGACY_DEVELOPMENT_CHANGES[card.development?.cardName] || {};
  // The EXP card inverts to a dark ground, so the level indicator needs a light-on-dark
  // palette instead of the light-ground colors used everywhere else — otherwise Prime/
  // Declining/Young all read as illegibly dim navy-on-navy.
  const levelColor = tier === 'EXP'
    ? (level === 'Prime' ? '#8FD9B0' : level === 'Declining' ? 'var(--franchise)' : 'var(--ink-muted)')
    : (level === 'Prime' ? 'var(--approved)' : level === 'Declining' ? 'var(--stamp)' : 'var(--depth)');
  const accolade = card.accolade || null;
  const topValue = Math.max(...STAT_KEYS.map((stat) => card.stats[stat]));

  // Release/Develop are destructive/rare actions, not something every glance at the roster
  // needs to see in the carousel/row contexts — they live behind a hold (mobile) or the expand
  // arrow (desktop, see .pcard-expand-arrow) there instead of sitting on the card permanently.
  // The Players tab's List view has no scale-to-fit height to protect (it's a plain scrolling
  // stack, not the carousel), so alwaysShowOptions skips the hold/arrow entirely and just
  // renders them as a normal footer. Only relevant at all when the caller actually wired up one
  // of the two actions (a read-only or compact context never gets any of this).
  const hasOptions = !compact && (onRelease || onDevelop);
  const [expanded, setExpanded] = useState(false);
  const [accoladeInfoOpen, setAccoladeInfoOpen] = useState(false);
  const [pairingsOpen, setPairingsOpen] = useState(false);
  const accoladeDef = accolade ? LEAGUE_ACCOLADES.find((a) => a.name === accolade) : null;
  const rarity = card.rarity || 'Core';
  const rarityCorners = compact ? [] : (RARITY_CORNERS[rarity] || []);
  const pressTimer = useRef(null);
  const longPressFired = useRef(false);

  const clearPressTimer = () => { clearTimeout(pressTimer.current); pressTimer.current = null; };
  const handleTouchStart = () => {
    if (!hasOptions || alwaysShowOptions) return;
    longPressFired.current = false;
    clearPressTimer();
    pressTimer.current = setTimeout(() => { longPressFired.current = true; setExpanded((v) => !v); }, LONG_PRESS_MS);
  };
  const handleClick = (event) => {
    // A long-press's own touchend still fires a synthetic click right after — swallow that one
    // click so it doesn't also trigger the card's normal select/swap behavior.
    if (longPressFired.current) { longPressFired.current = false; return; }
    onClick?.(event);
  };

  return (
    <div
      className={`pcard tier-${tier}${compact ? '' : ` rarity-${rarity}`}${positionClass}${compact ? ' pcard-compact' : ''}${selected ? ' selected' : ''}${expanded ? ' expanded' : ''}`}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearPressTimer}
      onTouchMove={clearPressTimer}
    >
      {rarityCorners.map((c) => <span key={c} className={'rarity-corner ' + c} />)}
      {!compact && <RarityGhost rarity={rarity} />}
      <CardTypeMark
        type="player"
        size={compact ? 90 : 170}
        className="pcard-watermark"
        color={tier === 'EXP' ? 'var(--ink-rule)' : 'var(--depth-nontext)'}
      />
      {!compact && (
        <div className="pcard-logo-mark">
          <BallMark size={44} variant={tier === 'EXP' ? 'onInk' : 'monoOutline'} />
        </div>
      )}
      <div className="pcard-header">
        {compact ? (
          <span className="pcard-header-pos">{card.position}</span>
        ) : (
          <div className="pcard-header-left">
            <div className="pcard-header-stack">
              <span className="pcard-header-stage" style={{ color: levelColor }}>{level}</span>
              <span className="pcard-header-tier">{card.tierName}</span>
            </div>
            <span className="pcard-header-sep">•</span>
            <span className="pcard-header-pos">{card.position}</span>
          </div>
        )}
        <div className="pcard-header-right">
          {!compact && <span className={`pcard-rarity-label r-${rarity}`}>{rarity.toUpperCase()}</span>}
          <span className="pcard-grade" aria-label={`Player grade ${playerGrade(card)}`}>{playerGrade(card)}</span>
        </div>
      </div>
      <div className="pcard-name-block">
        <div className="pcard-jersey" aria-label={`Jersey number ${jerseyNumber(card)}`}>#{jerseyNumber(card)}</div>
        <div className="pcard-name-col">
          <div className="pcard-name">{card.archetype}</div>
        </div>
      </div>
      <div className="pcard-contract pcard-budgethit-row">
        {/* Role (Starter / Sixth Man / Depth) sits left in the same row; Cost label and value
            stay right-aligned. Text for now; icons will replace it. */}
        {!compact && <span className="pcard-role-slot">{roleLabel && <span className="pcard-roster-badge">{roleLabel}</span>}</span>}
        <span className="pcard-cost-group">
          <span className="pcard-microlabel">Cost</span>
          <span className="pcard-budgethit">{formatCoins(card.salary)}</span>
        </span>
      </div>
      {!compact && (
        <div className="pcard-contract pcard-years-row">
          <span className="pcard-microlabel">{contractLabel || 'Turns Remaining'}</span>
          <div className="pcard-dots">
            {Array.from({ length: card.contract }, (_, i) => <div key={i} className="pcard-dot" />)}
          </div>
        </div>
      )}
      {/* One-line signing outlook for a free agent or an expiring contract — the negotiation
          band/chance while re-signing your own player, or the bidding priority and minimum
          terms for an open free agent (see ContractsScreen/FreeAgencyScreen). Not shown at all
          for a roster card with nothing to negotiate. */}
      {!compact && signingNote && <div className="pcard-signing-note">{signingNote}</div>}
      {!compact && scouted && <div className="pcard-scouted-mark" title="On your scouting report" aria-label="On your scouting report">⌖</div>}
      {!compact && (
        <div className="pcard-stats">
          {STAT_KEYS.map((stat) => {
            const value = card.stats[stat];
            const isTop = value === topValue;
            // Gold + shine: only a stat that matches the league-high for that stat (ties with the
            // league-high included). The card's own top stat is just colored.
            const gold = Boolean(leagueMax) && value > 0 && value >= leagueMax[stat];
            return <div className={'pcard-stat' + (gold ? ' gold' : isTop ? ' top' : '')} key={stat}><div className="pcard-stat-value"><b>{value}</b>{developmentChanges[stat] > 0 && <em>+{developmentChanges[stat]}</em>}</div><span>{stat}</span></div>;
          })}
        </div>
      )}
      {!compact && revealPeak && (
        <div className="pcard-peak-projection"><span>Peak Prime Projection</span><strong>{['SCO', 'PLM', 'REB', 'DEF'].map((stat) => `${stat} ${Math.round(card.stats[stat] * careerMultiplier({ ...card, careerStage: 'Prime' }, card.careerRoll))}`).join(' · ')}</strong></div>
      )}
      {/* Skillset module (brand handoff, Player Card §5) — a permanent trait rolled once at
          creation, never a stat. Sits below the stat block on the real card so it reads as
          "who this player is good next to," not another number; doesn't appear on the
          compact roster-grid card, where it would outrank the cap figure. */}
      {!compact && (
        <div className="pcard-skillset">
          <div className="pcard-skillset-head">
            <span className="pcard-microlabel">Skillset</span>
            {skillPairings.length > 0 && (
              <button
                type="button"
                className="pcard-pair-with"
                aria-haspopup="dialog"
                onClick={(event) => { event.stopPropagation(); setPairingsOpen(true); }}
              >Pair With</button>
            )}
          </div>
          <div className="pcard-skillset-name" title={skillset?.description}>{skillset?.name || 'None · Legacy Card'}</div>
          {pairingsOpen && skillPairings.length > 0 && createPortal(
            <div className="pcard-pairings-backdrop" role="presentation" onClick={(event) => { event.stopPropagation(); setPairingsOpen(false); }}>
              <div className="pcard-pairings-modal" role="dialog" aria-modal="true" aria-label={`${skillset.name} pairings`} onClick={(event) => event.stopPropagation()}>
                <div className="pcard-pairings-head"><span>Skillset</span><b>{skillset.name}</b></div>
                <p>Start a player with one of these Skillsets beside this one to earn the bonus.</p>
                <ul>
                  {skillPairings.map(({ rule, partner }) => (
                    <li key={rule.name}>
                      <span className={'pcard-pairing-pct ' + rule.side}>+{rule.percent}% {rule.side === 'offense' ? 'OFF' : 'DEF'}</span>
                      <span className="pcard-pairing-text"><b>{rule.name}</b><small>with {partner}</small></span>
                    </li>
                  ))}
                </ul>
                <button type="button" className="secondary" onClick={() => setPairingsOpen(false)}>Close</button>
              </div>
            </div>,
            document.body,
          )}
        </div>
      )}
      {/* Career Stage and Tier moved up into the header; this row (Release/Develop's old
          neighborhood) is now reserved for League Accolades — same label-then-value shape as
          Skillset above it, always present (even for the common case of no accolade, which
          reads "None") so every card in a swipeable row is the same height. Shown as a single
          icon (game/constants.js's LEAGUE_ACCOLADES, one mark per honor via CardTypeMark)
          rather than the full name, which is still available on hover/hold via the native
          title tooltip. */}
      {!compact && (
        <div className="pcard-accolade-block">
          <div className="pcard-accolade-head">
            <span className="pcard-microlabel">Accolades</span>
            {(selected || card.development) && (
              <div className="pcard-accolade-tags">
                {selected && <span className="pcard-stamp pcard-stamp-selected">Selected</span>}
                {card.development && <span className="pcard-development" title={`Developed · ${card.development.cardName}`}>Developed</span>}
              </div>
            )}
          </div>
          <div className="pcard-accolade-value">
            {accolade
              ? (
                <button
                  type="button"
                  className="pcard-accolade"
                  title={accolade}
                  onClick={(event) => { event.stopPropagation(); setAccoladeInfoOpen((v) => !v); }}
                >
                  <CardTypeMark type={accolade} size={26} />
                </button>
              )
              : <span className="pcard-accolade-none">None</span>}
          </div>
          {accoladeInfoOpen && accoladeDef && (
            <>
              <div className="pcard-accolade-info-backdrop" onClick={(event) => { event.stopPropagation(); setAccoladeInfoOpen(false); }} />
              <div className="pcard-accolade-info" onClick={(event) => event.stopPropagation()}>
                <div className="pcard-accolade-info-name">{accoladeDef.name}</div>
                <p className="pcard-accolade-info-desc">{accoladeDef.description}</p>
                <button type="button" className="pcard-accolade-info-close" onClick={() => setAccoladeInfoOpen(false)}>Close</button>
              </div>
            </>
          )}
        </div>
      )}
      {hasOptions && alwaysShowOptions && (
        <div className="pcard-options pcard-options-static" onClick={(event) => event.stopPropagation()}>
          {onRelease && (
            <button className="pcard-release" onClick={() => onRelease(card)}>
              Release <span className="pcard-release-cost">{card.contract > 0 ? `${formatCoins(Math.round((card.salary / 2) * 100) / 100)} Dead × ${card.contract}yr` : 'No Dead Cap'}</span>
            </button>
          )}
          {onDevelop && (
            <button className="pcard-develop" onClick={() => onDevelop(card)}>
              Develop
            </button>
          )}
        </div>
      )}
      {hasOptions && !alwaysShowOptions && (
        <>
          <button
            type="button"
            className="pcard-expand-arrow"
            onClick={(event) => { event.stopPropagation(); setExpanded((v) => !v); }}
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide roster options' : 'Show roster options'}
          >
            <span className="pcard-expand-chevron">▾</span>
          </button>
          {expanded && (
            <div className="pcard-options" onClick={(event) => event.stopPropagation()}>
              {onRelease && (
                <button className="pcard-release" onClick={() => onRelease(card)}>
                  Release <span className="pcard-release-cost">{card.contract > 0 ? `${formatCoins(Math.round((card.salary / 2) * 100) / 100)} Dead × ${card.contract}yr` : 'No Dead Cap'}</span>
                </button>
              )}
              {onDevelop && (
                <button className="pcard-develop" onClick={() => onDevelop(card)}>
                  Develop
                </button>
              )}
            </div>
          )}
        </>
      )}
      {!compact && onScout && <button type="button" className={'pcard-scout' + (scouted ? ' active' : '')} onClick={(event) => { event.stopPropagation(); onScout(card); }}>{scouted ? 'Remove From Report' : 'Add To Scouting Report'}</button>}
    </div>
  );
}
