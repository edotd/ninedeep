import { useRef, useState } from 'react';
import { skillsetFor } from '../game/skillsets';
import { formatCoins } from '../game/economy';
import { careerLevel } from '../game/aging';
import { cardTier, jerseyNumber, playerGrade } from '../game/cards';
import { LEAGUE_ACCOLADES, RARITY_CORNERS } from '../game/constants';
import CardTypeMark from './CardTypeMark';
import BallMark from './BallMark';

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

export default function PlayerCard({ card, onClick, selected, rosterLabel, compact, onRelease, onDevelop, alwaysShowOptions, contractLabel }) {
  const pillLabel = rosterLabel || (selected ? 'Selected' : null);
  const tier = cardTier(card);
  const skillset = skillsetFor(card);
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
        <span className="pcard-grade" aria-label={`Player grade ${playerGrade(card)}`}>{playerGrade(card)}</span>
      </div>
      <div className="pcard-name-block">
        <div className="pcard-jersey" aria-label={`Jersey number ${jerseyNumber(card)}`}>#{jerseyNumber(card)}</div>
        <div className="pcard-name">{card.archetype}</div>
      </div>
      <div className="pcard-contract pcard-budgethit-row">
        <span className="pcard-microlabel">Cost</span>
        <span className="pcard-budgethit">{formatCoins(card.salary)}</span>
      </div>
      {!compact && (
        <div className="pcard-contract pcard-years-row">
          <span className="pcard-microlabel">{contractLabel || 'Turns Remaining'}</span>
          <div className="pcard-dots">
            {Array.from({ length: card.contract }, (_, i) => <div key={i} className="pcard-dot" />)}
          </div>
        </div>
      )}
      {!compact && (
        <div className="pcard-stats">
          {['SCO', 'PLM', 'REB', 'DEF'].map((stat) => <div className="pcard-stat" key={stat}><div className="pcard-stat-value"><b>{card.stats[stat]}</b>{developmentChanges[stat] > 0 && <em>+{developmentChanges[stat]}</em>}</div><span>{stat}</span></div>)}
        </div>
      )}
      {/* Skillset module (brand handoff, Player Card §5) — a permanent trait rolled once at
          creation, never a stat. Sits below the stat block on the real card so it reads as
          "who this player is good next to," not another number; doesn't appear on the
          compact roster-grid card, where it would outrank the cap figure. */}
      {!compact && (
        <div className="pcard-skillset">
          <div className="pcard-skillset-head">
            <span className="pcard-microlabel">Skillset</span>
          </div>
          <div className="pcard-skillset-name" title={skillset?.description}>{skillset?.name || 'None · Legacy Card'}</div>
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
          <CardTypeMark type={rarity} size={22} className="rarity-icon-mark" />
          <div className="pcard-accolade-head">
            <span className="pcard-microlabel">Accolades</span>
            {(pillLabel || card.development) && (
              <div className="pcard-accolade-tags">
                {pillLabel && <span className="pcard-stamp">{pillLabel}</span>}
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
    </div>
  );
}
