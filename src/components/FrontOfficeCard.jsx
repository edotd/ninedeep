import { formatCoins } from '../game/economy';
import { retentionBonus, relationshipBonus } from '../game/cards';
import CardTypeMark from './CardTypeMark';

// Front Office card, per the brand handoff's "Components: Front Office & Matchup Cards" —
// landscape, ink ground, told apart from a Player card by shape alone. One component covers
// all three kinds (coach/fanbase/market); the per-kind content below maps this game's actual
// data onto the card's fixed slots (name, qualifier, disposition word, three effect rows,
// duration). The disposition word and per-kind flavor mappings (e.g. "Fickle" for a Casual
// fanbase) are new copy authored to fit the template — the game data itself only has
// name/attendance/ability, not a one-word disposition, so these are a judgment call.
const KIND_META = {
  coach: { label: 'Coach', badge: 'SYS' },
  fanbase: { label: 'Fanbase', badge: 'MOOD' },
  market: { label: 'Market', badge: 'ECON' },
};

function coachContent(team) {
  const coach = team.coach;
  const bonus = retentionBonus(team) + relationshipBonus(team);
  return {
    name: coach.archetype,
    qualifier: `Age ${coach.age}` + (team.retainedStreak ? ` · Retained ${team.retainedStreak} season${team.retainedStreak === 1 ? '' : 's'}` : ''),
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
    badgeTone: 'franchise',
    effects: [
      { label: 'Attendance', value: `${attendance}%`, tone: 'file' },
      { label: 'Season Mod', value: mod ? mod.name : '—', tone: mod ? 'approved-ink' : 'file' },
      { label: 'Advantage', value: isDieHard ? (team.advantageAvailable ? 'Available' : 'Used') : '—', tone: isDieHard && team.advantageAvailable ? 'approved-ink' : 'file' },
    ],
    // The archetype itself holds for the whole era, like Coach — only attendance and the
    // season mod (shown above) actually re-evaluate every season.
    duration: 'Holds Through Era 01',
  };
}

const MARKET_DISPOSITION = { Small: 'Modest', Medium: 'Steady', Large: 'Lucrative', Massive: 'Booming' };

function marketContent(team) {
  const m = team.market;
  return {
    name: m.name,
    qualifier: 'Market Size',
    disposition: MARKET_DISPOSITION[m.name] || m.name,
    dispositionTone: 'approved-ink',
    badgeTone: 'approved-ink',
    effects: [
      { label: 'Cap Boost', value: `+${formatCoins(m.capAdj)}`, tone: 'approved-ink' },
      { label: 'Size', value: m.name, tone: 'file' },
      { label: 'Status', value: 'Current', tone: 'file' },
    ],
    // Relocatable via Team Finances (see TeamScreen) — "fixed" only in that it doesn't
    // drift or get re-rolled on its own the way attendance does.
    duration: 'Holds Until Relocated',
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
          <span className={'fo2-kind-badge ' + content.badgeTone}>{meta.badge}</span>
        </div>
        <div className="fo2-name-row">
          <div>
            <div className="fo2-name">{content.name}</div>
            <div className="fo2-qualifier">{content.qualifier}</div>
          </div>
          <div className={'fo2-disposition ' + content.dispositionTone}>{content.disposition}</div>
        </div>
        <div className="fo2-effects">
          {content.effects.map((e, i) => (
            <div className="fo2-effect-row" key={i}>
              <span className="fo2-effect-label">{e.label}</span>
              <span className={'fo2-effect-value ' + e.tone}>{e.value}</span>
            </div>
          ))}
        </div>
        <div className="fo2-footer">
          <span>{content.duration}</span>
          <span>Nine Deep</span>
        </div>
      </div>
      <ul className="fo2-bullets">
        <li>Disposition: {content.disposition}</li>
        {content.effects.map((e, i) => <li key={i}>{e.label}: {e.value}</li>)}
      </ul>
    </div>
  );
}
