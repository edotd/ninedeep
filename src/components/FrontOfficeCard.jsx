import { formatCoins } from '../game/economy';
import { retentionBonus, relationshipBonus } from '../game/cards';
import CardTypeMark from './CardTypeMark';
import { GM_BONUS_RATE, HANDS_OFF_BONUS_CAP } from '../game/constants';
import { handsOffBonus } from '../game/gm';

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

function coachContent(team) {
  const coach = team.coach;
  const bonus = retentionBonus(team) + relationshipBonus(team);
  return {
    name: coach.archetype,
    qualifier: team.retainedStreak ? `Retained ${team.retainedStreak} season${team.retainedStreak === 1 ? '' : 's'}` : 'League appointment',
    disposition: coach.modifier,
    dispositionTone: 'approved-ink',
    badgeTone: 'approved-ink',
    effects: [
      { label: 'Off Bonus', value: `+${Math.round((coach.offBonus + bonus) * 100)}%`, tone: 'approved-ink' },
      { label: 'Def Bonus', value: `+${Math.round((coach.defBonus + bonus) * 100)}%`, tone: 'approved-ink' },
      { label: 'Player Relations', value: coach.playerRelationship, tone: 'file' },
    ],
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
    disposition: FANBASE_DISPOSITION[archetype.name] || archetype.name,
    dispositionTone: archetype.name === 'Fair Weather' ? 'franchise' : 'approved-ink',
    badge: mod ? mod.name : 'NO MODIFIER',
    badgeTone: 'franchise',
    effects: [
      { label: 'Attendance', value: `${attendance}%`, tone: 'file' },
      { label: 'Season Modifier', value: mod ? `${mod.name}${mod.value ? ` · ${mod.value}` : ''}` : 'Pending', tone: mod ? 'approved-ink' : 'file' },
      { label: 'Advantage', value: isDieHard ? (team.advantageAvailable ? 'Available' : 'Used') : '—', tone: isDieHard && team.advantageAvailable ? 'approved-ink' : 'file' },
    ],
    // The archetype itself holds for the whole era, like Coach — only attendance and the
    // season mod (shown above) actually re-evaluate every season.
    duration: 'Holds Through Era 01',
    detail: mod?.flavor,
  };
}

function marketContent(team) {
  const m = team.market;
  const type = team.gmType || 'Neutral';
  return {
    name: type,
    qualifier: 'General Manager',
    disposition: null,
    dispositionTone: 'approved-ink',
    badgeTone: 'approved-ink',
    effects: [
      { label: 'Budget Increase', value: `+${formatCoins(m.capAdj)}`, tone: 'approved-ink' },
      { label: 'Market Size', value: m.name, tone: 'file' },
      { label: 'GM Bonus', value: type === 'Aggressive' ? `${GM_BONUS_RATE * 100}% off offseason requests` : type === 'Hands-Off' ? `+${Math.round(handsOffBonus(team) * 100)}% continuity` : 'None', tone: type === 'Neutral' ? 'file' : 'approved-ink' },
    ],
    detail: type === 'Hands-Off' ? `Coach tenure + starting-five continuity: +${GM_BONUS_RATE * 100}% per year, capped at ${HANDS_OFF_BONUS_CAP * 100}%.` : null,
    duration: 'Holds Until Fired',
  };
}

export default function FrontOfficeCard({ kind, team }) {
  const meta = KIND_META[kind];
  const content = kind === 'coach' ? coachContent(team) : kind === 'fanbase' ? fanbaseContent(team) : marketContent(team);
  return (
    <div className="fo2-wrap">
      <div className="fo2-card">
        <CardTypeMark type="frontoffice" className="fo2-watermark" color="var(--ink-rule)" size={190} />
        <div className="fo2-header">
          <span className="fo2-kind-group">
            <CardTypeMark type="frontoffice" size={16} />
            <span className="fo2-kind-label">{meta.label}</span>
          </span>
          {content.badge && <span className={'fo2-kind-badge ' + content.badgeTone}>{content.badge}</span>}
        </div>
        <div className="fo2-name-row">
          <div className="fo2-name-col">
            <div className="fo2-name">{content.name}</div>
            <div className="fo2-qualifier">{content.qualifier}</div>
          </div>
          {content.disposition && <div className={'fo2-disposition ' + content.dispositionTone}>{content.disposition}</div>}
        </div>
        <div className="fo2-effects">
          {content.effects.map((e, i) => (
            <div className="fo2-effect-row" key={i}>
              <span className="fo2-effect-label">{e.label}</span>
              <span className={'fo2-effect-value ' + e.tone}>{e.value}</span>
            </div>
          ))}
        </div>
        {content.detail && <div className="fo2-mod-detail">{content.detail}</div>}
        <div className="fo2-footer">
          <span className="fo2-duration">{content.duration}</span>
          <span>Nine Deep</span>
        </div>
      </div>
      <ul className="fo2-bullets">
        {content.disposition && <li>Disposition: {content.disposition}</li>}
        {content.effects.map((e, i) => <li key={i}>{e.label}: {e.value}</li>)}
        {content.detail && <li>{content.detail}</li>}
      </ul>
    </div>
  );
}
