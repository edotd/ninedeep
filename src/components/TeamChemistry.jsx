import { useState } from 'react';
import { SKILLSETS, SYNERGY_CAP, teamSynergy } from '../game/skillsets';
import { teamExperience } from '../game/aging';
import { relationshipBonus, retentionBonus } from '../game/cards';
import TeamSynergyModal from './TeamSynergyModal';

const nameFor = (id) => SKILLSETS.find((s) => s.id === id)?.name || id;
const bonusValue = (n) => n > 0 ? `+${n}%` : 'N/A';

export default function TeamChemistry({ team }) {
  const current = teamSynergy(team);
  const [synergyOpen, setSynergyOpen] = useState(false);
  const experience = team.coach ? teamExperience(team) : null;
  const coachOffense = team.coach ? Math.round((team.coach.offBonus + retentionBonus(team) + relationshipBonus(team)) * 100) : 0;
  const coachDefense = team.coach ? Math.round((team.coach.defBonus + retentionBonus(team) + relationshipBonus(team)) * 100) : 0;
  const offPairs = current.pairs.filter((p) => p.side === 'offense');
  const defPairs = current.pairs.filter((p) => p.side === 'defense');

  return (
    <section className="tc2-panel">
      <div className="tc2-grid">
        <div className="tc2-grade-block">
          <div className="ts-heading">Team Chemistry</div>
          <div className="tc2-grade-row">
            <span className="tc2-grade">{current.grade}</span>
            <span className="tc2-score">{current.score}</span>
          </div>
          <p className="tc2-note">Grade is the roster's Skillset fit, continuity, and Wise Veteran leadership read as one figure. Score: 50 base + {current.fitPoints} fit + {current.tenurePoints} tenure + {current.leadershipPoints} leadership.</p>
        </div>

        <div className="tc2-bonus-row">
          <div className="tc2-bonus">
            <div className="tc2-bonus-label">Offensive Bonus</div>
            <div className="tc2-bonus-value">{bonusValue(current.offense + coachOffense)}</div>
            <div className="tc2-bonus-sub">Chemistry {bonusValue(current.offense)} · Coach {bonusValue(coachOffense)} · {offPairs.length} live pairing{offPairs.length === 1 ? '' : 's'}</div>
          </div>
          <div className="tc2-bonus">
            <div className="tc2-bonus-label">Defensive Bonus</div>
            <div className="tc2-bonus-value">{bonusValue(current.defense + coachDefense)}</div>
            <div className="tc2-bonus-sub">Chemistry {bonusValue(current.defense)} · Coach {bonusValue(coachDefense)} · {defPairs.length} live pairing{defPairs.length === 1 ? '' : 's'}</div>
          </div>
          <div className="tc2-experience-inline">
            <div className="tc2-bonus-label">Experience</div>
            <div className="tc2-exp-value">{experience ?? '—'}<span className="tc2-exp-total"> / 10</span></div>
          </div>
        </div>
      </div>

      <div className="tc2-pairs-panel">
        <div className="tc2-pairs-head">
          <div className="ts-heading" style={{ marginBottom: 0 }}>Team Synergy</div>
          <span className="tc2-pairs-count">{current.pairs.length} Live</span>
        </div>
        <div className="tc2-synergy-total">
          <span className="tc2-synergy-total-value offense">+{current.skillOffense}% OFF</span>
          <span className="tc2-synergy-total-value defense">+{current.skillDefense}% DEF</span>
        </div>
        <button className="tc2-synergy-btn" onClick={() => setSynergyOpen(true)}>Open Team Synergy Table</button>
        {current.pairs.length ? (
          <div className="tc2-pairs-grid">
            {current.pairs.map((pair) => (
              <div key={pair.skills.join(':')} className="tc2-pair-row">
                <span className="tc2-pair-names">{pair.skills.map(nameFor).join(' + ')}</span>
                <span className={'tc2-pair-tag ' + pair.side}>{pair.name} +{pair.percent}% {pair.side === 'offense' ? 'OFF' : 'DEF'}</span>
              </div>
            ))}
          </div>
        ) : <p className="tc2-note">No active Skillset pairings in this starting five.</p>}
        {(current.rawOffense > SYNERGY_CAP || current.rawDefense > SYNERGY_CAP) && <p className="tc2-note">The +{SYNERGY_CAP}% Skillset cap is applied before adding tenure bonuses.</p>}
        {current.leadership > 0 && <p className="tc2-note">Wise Veteran adds +1% Offense and Defense from anywhere on the roster. Applies once.</p>}
      </div>

      {synergyOpen && <TeamSynergyModal team={team} onClose={() => setSynergyOpen(false)} />}
    </section>
  );
}
