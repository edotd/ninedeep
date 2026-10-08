import { formatCoins, gmCost } from '../game/economy';
import { retentionBonus, relationshipBonus } from '../game/cards';
import CardTypeMark from './CardTypeMark';
import BallMark from './BallMark';
import { offenseDieSize, defenseDieSize, matchupCardCountFor } from '../game/roster';
import { RARITY_CORNERS } from '../game/constants';
import RarityGhost from './RarityGhost';
import { ensureCoachSystems } from '../game/strategyCards';

// Front Office card, per the brand handoff's "Components: Front Office & Matchup Cards" —
// landscape, ink ground, told apart from a Player card by shape alone. One component covers
// all three kinds (coach/fanbase/market); the per-kind content below maps this game's actual
// data onto the card's fixed slots (name, qualifier, disposition word, three effect rows,
// duration). The disposition word and per-kind flavor mappings (e.g. "Fickle" for a Casual
// fanbase) are new copy authored to fit the template — the game data itself only has
// name/attendance/ability, not a one-word disposition, so these are a judgment call.
const KIND_META = {
  coach: { label: 'Coach' },
  fanbase: { label: 'Fanbase' },
  market: { label: 'GM' },
};

// Gives every effect row a stable, semantic class (e.g. "fo2-effect-off-bonus") derived from its
// own label, rather than depending on row order — Card Types' annotation hotspots (see
// CardOverviewScreen.jsx) target these individually.
const slugify = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function coachContent(team) {
  const coach = team.coach;
  const bonus = retentionBonus(team) + relationshipBonus(team);
  // Every coach permanently rolls exactly two gameplans (see ensureCoachSystems) — this card
  // always shows those two, not whichever one (if any) the user has actively selected for the
  // current lineup via team.activeGameplanId. That's a separate, per-season choice shown
  // elsewhere (Set Lineup's own Gameplan picker); the coach's own card is about who they are,
  // not what's currently active.
  ensureCoachSystems(team);
  const [primaryGameplan, secondaryGameplan] = coach.gameplans || [];
  // Always one gameplan per line, never joined into a single run-on string.
  const gameplanLines = [
    primaryGameplan && `Primary: ${primaryGameplan.name}`,
    secondaryGameplan && `Secondary: ${secondaryGameplan.name}`,
  ].filter(Boolean);
  return {
    name: coach.archetype,
    qualifier: team.retainedStreak ? `Retained ${team.retainedStreak} season${team.retainedStreak === 1 ? '' : 's'}` : null,
    disposition: coach.modifier,
    dispositionTone: 'approved-ink',
    effects: [
      { label: 'Cost', value: formatCoins(coach.salary), tone: 'file' },
      { label: 'Off Bonus', value: `+${Math.round((coach.offBonus + bonus) * 100)}%`, tone: 'approved-ink' },
      { label: 'Def Bonus', value: `+${Math.round((coach.defBonus + bonus) * 100)}%`, tone: 'approved-ink' },
      { label: 'Player Relations', value: coach.playerRelationship, tone: 'file' },
      { label: 'Development Points', value: team.developmentPoints || 0, tone: 'approved-ink' },
      { label: 'In-Game Adjustments', value: `${matchupCardCountFor(team)} per match`, tone: 'approved-ink' },
    ],
    detail: `${coach.modifier} — ${coach.ability || 'Improves the coach’s base Offense and Defense bonuses.'}`,
    rarityLead: { label: 'Gameplans', lines: gameplanLines.length ? gameplanLines : ['None'] },
    duration: 'Holds Through Era 01',
  };
}

const FANBASE_DISPOSITION = { Steady: 'Reliable', 'Fair Weather': 'Fickle', 'Die Hard': 'Devoted' };

function fanbaseContent(team) {
  const archetype = team.fanbaseArchetype;
  const attendance = Math.round((team.attendance !== undefined ? team.attendance : 0.5) * 100);
  const isDieHard = archetype.name === 'Die Hard';
  const mod = team.fanbaseMod;
  return {
    name: archetype.name,
    qualifier: `Attendance ${attendance}%`,
    // This season's rolled mood swing is the headline (the big teal word, same slot every
    // other card uses for its own headline trait) — the archetype's own fixed disposition is
    // a season-independent fact about the fanbase, so it moves down into the effects list
    // instead of sharing top billing with something that actually changes every season.
    disposition: mod ? mod.name : 'No Modifier',
    dispositionTone: 'approved-ink',
    effects: [
      { label: 'Disposition', value: FANBASE_DISPOSITION[archetype.name] || archetype.name, tone: archetype.name === 'Fair Weather' ? 'franchise' : 'file' },
      { label: 'Attendance', value: `${attendance}%`, tone: 'file' },
      { label: 'Modifier Effect', value: mod ? `${mod.value ? mod.value : 'Active'}` : 'Pending', tone: mod ? 'approved-ink' : 'file' },
      { label: 'Advantage', value: isDieHard ? (team.advantageAvailable ? 'Available' : 'Used') : '—', tone: isDieHard && team.advantageAvailable ? 'approved-ink' : 'file' },
    ],
    // The archetype itself holds for the whole era, like Coach — only attendance and the
    // season mod (shown above) actually re-evaluate every season.
    duration: 'Holds Through Era 01',
    detail: mod ? `${mod.name} — ${mod.flavor}` : null,
  };
}

function marketContent(team) {
  const type = 'General Manager';
  const trait = team.gmTrait || { name: 'Neutral', value: 0, description: 'No additional front-office effect.' };
  const percentValue = (trait.value || 0) * 2;
  const traitValue = trait.name === 'Third Eye'
    ? 'Peak projection'
    : trait.name === 'Cap Architect' ? `+${formatCoins(trait.value)}`
      : trait.name === 'Talent Hawk' ? `+${trait.value} scouted`
        : `+${trait.value * 2}%`;
  const traitDetail = trait.name === 'Cap Architect'
    ? `${trait.name} — Increases the franchise budget by ${formatCoins(trait.value || 0)}.`
    : trait.name === 'Third Eye'
      ? `${trait.name} — Reveals a scouted player's projected peak-prime stats.`
      : trait.name === 'Talent Hawk'
        ? `${trait.name} — Increases scouting capacity by ${trait.value || 0} player${trait.value === 1 ? '' : 's'}.`
        : trait.name === 'Hands-Off'
          ? `${trait.name} — Adds ${percentValue}% for every year the coach or starting five remains with the franchise.`
          : trait.name === 'Deal Maker'
            ? `${trait.name} — Reduces bidding and negotiation requests by ${percentValue}%.`
            : `${trait.name} — ${trait.description}`;
  return {
    name: type,
    qualifier: team.gmRarity || 'Core',
    disposition: trait.name,
    dispositionTone: 'approved-ink',
    effects: [
      { label: 'Cost', value: formatCoins(gmCost(type)), tone: 'file' },
      { label: 'Budget Increase', value: trait.name === 'Cap Architect' ? `+${formatCoins(trait.value)}` : '—', tone: trait.name === 'Cap Architect' ? 'approved-ink' : 'file' },
      { label: 'Trait', value: traitValue, tone: 'approved-ink' },
    ],
    detail: traitDetail,
    duration: 'Holds Until Fired',
  };
}

export default function FrontOfficeCard({ kind, team }) {
  const meta = KIND_META[kind];
  const content = kind === 'coach' ? coachContent(team) : kind === 'fanbase' ? fanbaseContent(team) : marketContent(team);
  const coachRarity = kind === 'coach' ? (team.coach.rarity || 'Core') : kind === 'market' ? (team.gmRarity || 'Core') : null;
  return (
    <div className="fo2-wrap">
      <div className={'fo2-card' + (coachRarity ? ` rarity-${coachRarity}` : '')}>
        {coachRarity && (RARITY_CORNERS[coachRarity] || []).map((c) => <span key={c} className={'rarity-corner ' + c} />)}
        {coachRarity && <RarityGhost rarity={coachRarity} />}
        <CardTypeMark type="frontoffice" className="fo2-watermark" color="var(--ink-rule)" size={190} />
        <div className="fo2-logo-mark"><BallMark size={44} variant="onInk" /></div>
        <div className="fo2-header">
          <span className="fo2-kind-group">
            <CardTypeMark type="frontoffice" size={16} />
            <span className="fo2-kind-label">{meta.label}</span>
          </span>
          {kind === 'coach' && <span className="fo2-dice">🎲 Off {offenseDieSize(team)} · Def {defenseDieSize(team)}</span>}
        </div>
        <div className="fo2-name-row">
          <div className="fo2-name-col">
            <div className="fo2-name">{content.name}</div>
            {content.qualifier && <div className="fo2-qualifier">{content.qualifier}</div>}
          </div>
          {content.disposition && <div className={'fo2-disposition ' + content.dispositionTone}>{content.disposition}</div>}
        </div>
        <div className="fo2-effects">
          {content.effects.map((e, i) => (
            <div className={`fo2-effect-row fo2-effect-${slugify(e.label)}`} key={i}>
              <span className="fo2-effect-label">{e.label}</span>
              <span className={'fo2-effect-value ' + e.tone}>{e.value}</span>
            </div>
          ))}
        </div>
        {coachRarity && <div className="fo2-rarity-row">{content.rarityLead && <div className="fo2-rarity-lead"><span>{content.rarityLead.label}</span>{content.rarityLead.lines.map((line) => <strong key={line}>{line}</strong>)}</div>}</div>}
        {content.detail && <div className="fo2-mod-detail">{content.detail}</div>}
      </div>
    </div>
  );
}
