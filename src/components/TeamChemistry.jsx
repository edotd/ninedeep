import { SKILLSETS, SYNERGY_CAP, teamSynergy } from '../game/skillsets';
import { teamExperience } from '../game/aging';
import { relationshipBonus, retentionBonus } from '../game/cards';
import { teamOutput } from '../game/matchup';

const nameFor = (id) => SKILLSETS.find((s) => s.id === id)?.name || id;
const bonusValue = (n) => n > 0 ? `+${n}%` : 'N/A';

function teamProfile(team, chemistry, experience, coachOffense, coachDefense) {
  const output = team.coach && team.activeIds?.length ? teamOutput(team) : null;
  const strengths = [];
  const weaknesses = [];
  // Coaching is part of a team's identity, so choose one coherent identity statement. A
  // small projected-output edge should not label a team defensive when its defining lift
  // comes from a strong offensive coach (or vice versa).
  if (coachOffense >= 8 && coachDefense >= 8) {
    strengths.push(`Two-way coaching — the staff adds ${coachOffense}% offense and ${coachDefense}% defense before Skillset chemistry.`);
  } else if (coachOffense >= 8) {
    strengths.push(`Coach-driven offense — the staff adds ${coachOffense}% before Skillset chemistry.`);
  } else if (coachDefense >= 8) {
    strengths.push(`Coach-driven defense — the staff adds ${coachDefense}% before Skillset chemistry.`);
  } else if (output) {
    if (output.off >= output.def + 1) strengths.push(`Offensive identity — projected offense leads defense ${output.off} to ${output.def}.`);
    else if (output.def >= output.off + 1) strengths.push(`Defensive identity — projected defense leads offense ${output.def} to ${output.off}.`);
    else strengths.push('Balanced starting unit — offense and defense project within one point of each other.');
  }
  if (output) {
    if (output.bench >= 7) strengths.push(`Productive bench — the second unit contributes ${output.bench} projected output.`);
    if (output.bench <= 4) weaknesses.push(`Thin bench — only ${output.bench} projected output comes from reserves.`);
  }
  if (chemistry.score >= 75) strengths.push(`Strong cohesion — ${chemistry.grade} chemistry with ${chemistry.pairs.length} active pairing${chemistry.pairs.length === 1 ? '' : 's'}.`);
  else if (chemistry.score < 55) weaknesses.push(`Developing cohesion — ${chemistry.grade} chemistry limits the starting five's fit.`);
  if (chemistry.pairs.length === 0) weaknesses.push('No active Skillset pairings in the starting five.');
  if (experience != null && experience >= 7) strengths.push(`Experienced group — ${experience}/10 experience should provide consistency.`);
  else if (experience != null && experience <= 3) weaknesses.push(`Limited experience — the roster rates ${experience}/10.`);
  if (coachOffense <= 2 && coachDefense <= 2) weaknesses.push('Limited coaching lift on both sides of the ball.');
  if (!strengths.length) strengths.push('Balanced roster without a single dominant identity yet.');
  if (!weaknesses.length) weaknesses.push('No pronounced weakness in the current rotation.');
  return { strengths: strengths.slice(0, 4), weaknesses: weaknesses.slice(0, 4) };
}

export default function TeamChemistry({ team, canEdit, onEditLineup }) {
  const current = teamSynergy(team);
  const experience = team.coach ? teamExperience(team) : null;
  const coachOffense = team.coach ? Math.round((team.coach.offBonus + retentionBonus(team) + relationshipBonus(team)) * 100) : 0;
  const coachDefense = team.coach ? Math.round((team.coach.defBonus + retentionBonus(team) + relationshipBonus(team)) * 100) : 0;
  const profile = teamProfile(team, current, experience, coachOffense, coachDefense);

  return (
    <section className="tc2-panel">
      <div className="tc2-grid">
        <div className="tc2-grade-block">
          <div className="ts-heading">Team Chemistry</div>
          <div className="tc2-grade-row">
            <span className="tc2-grade">{current.grade}</span>
            <span className="tc2-score">{current.score}</span>
          </div>
          <p className="tc2-note">Your team's fit, continuity and bonuses from any chemistry-related card effects</p>
        </div>

        <div className="tc2-bonus-row">
          <div className="tc2-bonus">
            <div className="tc2-bonus-label">Offensive Bonus</div>
            <div className="tc2-bonus-value">{bonusValue(current.offense + coachOffense)}</div>
          </div>
          <div className="tc2-bonus">
            <div className="tc2-bonus-label">Defensive Bonus</div>
            <div className="tc2-bonus-value">{bonusValue(current.defense + coachDefense)}</div>
          </div>
          <div className="tc2-experience-inline">
            <div className="tc2-bonus-label">Experience</div>
            <div className="tc2-exp-value">{experience ?? '—'}<span className="tc2-exp-total"> / 10</span></div>
          </div>
        </div>
      </div>

      <div className="tc2-pairs-panel">
        <div className="tc2-pairs-head">
          <div className="ts-heading" style={{ marginBottom: 0 }}>Synergy</div>
          <span className="tc2-pairs-count">{current.pairs.length + current.statBonuses.length} Live</span>
        </div>
        <div className="tc2-synergy-total">
          <span className="tc2-synergy-total-value offense">+{current.skillOffense}% OFF</span>
          <span className="tc2-synergy-total-value defense">+{current.skillDefense}% DEF</span>
        </div>
        <button className="tc2-synergy-btn" onClick={onEditLineup}>
          {canEdit === false ? 'View Lineup' : team.lineupSet ? 'Edit Lineup' : 'Set Lineup'}
          {canEdit !== false && !team.lineupSet && <span className="tc2-lineup-dot" aria-label="Lineup not set" />}
        </button>
        {(current.pairs.length || current.statBonuses.length) ? (
          <div className="tc2-pairs-grid">
            {current.pairs.map((pair) => (
              <div key={pair.skills.join(':')} className="tc2-pair-row">
                <span className="tc2-pair-names">{pair.skills.map(nameFor).join(' + ')}</span>
                <span className={'tc2-pair-tag ' + pair.side}>{pair.name} +{pair.percent}% {pair.side === 'offense' ? 'OFF' : 'DEF'}</span>
              </div>
            ))}
            {current.statBonuses.map((bonus) => (
              <div key={bonus.name} className="tc2-pair-row">
                <span className="tc2-pair-names">{bonus.minCount}+ starters at {bonus.threshold}+ effective {bonus.stat} (in-season, career-stage adjusted)</span>
                <span className={'tc2-pair-tag ' + bonus.side}>{bonus.name} +{bonus.percent}% {bonus.side === 'offense' ? 'OFF' : 'DEF'}</span>
              </div>
            ))}
          </div>
        ) : <p className="tc2-note">No active Skillset pairings or stat-threshold bonuses in this starting five.</p>}
        {(current.rawOffense > SYNERGY_CAP || current.rawDefense > SYNERGY_CAP) && <p className="tc2-note">The +{SYNERGY_CAP}% Skillset cap is applied before adding tenure bonuses.</p>}
        {current.leadership > 0 && <p className="tc2-note">Wise Veteran adds +1% Offense and Defense from anywhere on the roster. Applies once.</p>}
      </div>

      <div className="tc2-profile">
        <div className="tc2-profile-column strengths">
          <div className="ts-heading">Strengths</div>
          <ul>{profile.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div className="tc2-profile-column weaknesses">
          <div className="ts-heading">Weaknesses</div>
          <ul>{profile.weaknesses.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </div>
    </section>
  );
}
