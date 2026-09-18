import { skillsetFor } from '../game/skillsets';
import { formatCoins } from '../game/economy';
import { careerLevel, careerBonus } from '../game/aging';
import { cardTier, jerseyNumber, playerGrade } from '../game/cards';
import CardTypeMark from './CardTypeMark';

export default function PlayerCard({ card, onClick, selected, draftStyle, rosterLabel, compact, onRelease }) {
  const pillLabel = rosterLabel || (selected ? 'Selected' : null);
  const tier = cardTier(card);
  const skillset = skillsetFor(card);
  const yearsServed = Math.max(0, card.maxContract - card.contract);
  const level = careerLevel(card);
  const bonus = careerBonus(card, card.careerRoll);
  // The EXP card inverts to a dark ground, so the level indicator needs a light-on-dark
  // palette instead of the light-ground colors used everywhere else — otherwise Prime/
  // Declining/Young all read as illegibly dim navy-on-navy.
  const levelColor = tier === 'EXP'
    ? (level === 'Prime' ? '#8FD9B0' : level === 'Declining' ? 'var(--franchise)' : 'var(--ink-muted)')
    : (level === 'Prime' ? 'var(--approved)' : level === 'Declining' ? 'var(--stamp)' : 'var(--depth)');

  return (
    <div className={`pcard tier-${tier}${compact ? ' pcard-compact' : ''}${selected ? ' selected' : ''}`} onClick={onClick}>
      <CardTypeMark
        type="player"
        size={compact ? 90 : 170}
        className="pcard-watermark"
        color={tier === 'EXP' ? 'var(--ink-rule)' : 'var(--depth-nontext)'}
      />
      <div className="pcard-header">
        <span className="pcard-header-pos">{card.position} · {card.archetype}</span>
        <span className="pcard-grade" aria-label={`Player grade ${playerGrade(card)}`}>{playerGrade(card)}</span>
      </div>
      <div className="pcard-name-block">
        <div className="pcard-jersey" aria-label={`Jersey number ${jerseyNumber(card)}`}>#{jerseyNumber(card)}</div>
        <div className="pcard-name">{card.archetype}</div>
      </div>
      <div className="pcard-contract pcard-budgethit-row">
        <span className="pcard-microlabel">Budget Hit</span>
        <span className="pcard-budgethit">{formatCoins(card.salary)}</span>
      </div>
      {!compact && (
        <div className="pcard-contract pcard-years-row">
          <span className="pcard-microlabel">Years Left</span>
          <div className="pcard-dots">
            {Array.from({ length: card.maxContract }, (_, i) => (
              <div key={i} className={'pcard-dot' + (i < yearsServed ? '' : ' empty')} />
            ))}
          </div>
        </div>
      )}
      {!compact && (
        <div className="pcard-stats">
          <div className="pcard-stat"><b>{card.stats.SCO}</b><span>SCO</span></div>
          <div className="pcard-stat"><b>{card.stats.PLM}</b><span>PLM</span></div>
          <div className="pcard-stat"><b>{card.stats.REB}</b><span>REB</span></div>
          <div className="pcard-stat"><b>{card.stats.DEF}</b><span>DEF</span></div>
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
            <span className="pcard-microlabel">Rolled At Print</span>
          </div>
          <div className="pcard-skillset-name" title={skillset?.description}>{skillset?.name || 'None · Legacy Card'}</div>
        </div>
      )}
      {!compact && (
        <div className="pcard-contract pcard-age-row" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="pcard-microlabel" style={{ marginBottom: 3 }}>Career Stage{draftStyle ? '' : ` · Yr ${yearsServed + 1}/${card.maxContract}`}</div>
            <div className="pcard-microlabel pcard-level" style={{ color: levelColor }}>
              {level} ({bonus >= 0 ? '+' : ''}{bonus.toFixed(2)})
            </div>
          </div>
          {pillLabel && <span className="pcard-stamp">{pillLabel}</span>}
        </div>
      )}
      {!compact && (
        <div className="pcard-footer">
          <span>{card.tierName}</span>
          <span>#{card.id}</span>
        </div>
      )}
      {!compact && onRelease && (
        <button className="pcard-release" onClick={(e) => { e.stopPropagation(); onRelease(card); }}>
          Release <span className="pcard-release-cost">{formatCoins(card.salary)} Dead</span>
        </button>
      )}
    </div>
  );
}
