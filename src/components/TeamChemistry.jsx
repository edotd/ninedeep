import { CHEMISTRY_GRADES, completedTeamYears } from '../game/chemistry';
import { useState } from 'react';
import { SKILLSETS, teamSynergy, skillsetFor } from '../game/skillsets';
import { teamExperience, careerLevel, CAREER_STAGES } from '../game/aging';
import { validateLineup } from '../game/roster';

const nameFor = (id) => SKILLSETS.find((s) => s.id === id)?.name || id;
const signed = (n) => `${n >= 0 ? '+' : ''}${n}`;

export default function TeamChemistry({ team, canEdit, onSwap, onPromote }) {
  const [incomingId, setIncomingId] = useState('');
  const [error, setError] = useState('');
  const current = teamSynergy(team);
  const experience = team.coach ? teamExperience(team) : null;
  const ids = team.activeIds || [];
  const bench = team.hand.filter((p) => !ids.includes(p.id));
  const starters = team.hand.filter((p) => ids.includes(p.id));

  const totalTenure = starters.reduce((s, p) => s + completedTeamYears(p, team.id), 0);
  const avgTenure = starters.length ? Math.round((totalTenure / starters.length) * 10) / 10 : 0;
  const stageCounts = starters.reduce((acc, p) => {
    const stage = careerLevel(p);
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {});
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
          <p className="tc2-note">Grade is the roster's Skillset fit, continuity, and Locker Room leadership read as one figure. Score: 50 base + {current.fitPoints} fit + {current.tenurePoints} tenure + {current.leadershipPoints} leadership.</p>
          <details className="tc2-scale"><summary>Letter-grade scale</summary><p className="tc2-note">{CHEMISTRY_GRADES.map(([min, grade], i) => `${grade}: ${min}–${i ? CHEMISTRY_GRADES[i - 1][0] - 1 : 100}`).join(' · ')}</p></details>
        </div>

        <div className="tc2-bonus-row">
          <div className="tc2-bonus">
            <div className="tc2-bonus-label">Offensive Bonus</div>
            <div className="tc2-bonus-value">+{current.offense}%{current.flat ? ' +1 flat' : ''}</div>
            <div className="tc2-bonus-sub">from {offPairs.length} live pairing{offPairs.length === 1 ? '' : 's'}</div>
          </div>
          <div className="tc2-bonus">
            <div className="tc2-bonus-label">Defensive Bonus</div>
            <div className="tc2-bonus-value">+{current.defense}%{current.flat ? ' +1 flat' : ''}</div>
            <div className="tc2-bonus-sub">from {defPairs.length} live pairing{defPairs.length === 1 ? '' : 's'}</div>
          </div>
        </div>

        <div className="tc2-experience">
          <div className="ts-heading">Collective Experience</div>
          <div className="tc2-exp-figures">
            <div><span className="tc2-exp-value">{totalTenure}</span><span className="tc2-exp-label">Seasons Played</span></div>
            <div><span className="tc2-exp-value">{avgTenure}</span><span className="tc2-exp-label">Avg Per Man</span></div>
            <div><span className="tc2-exp-value">{experience ?? '—'}</span><span className="tc2-exp-label">Experience /10</span></div>
          </div>
          <div className="tc2-stage-rows">
            {CAREER_STAGES.filter((stage) => stageCounts[stage]).map((stage) => (
              <div key={stage} className="tc2-stage-row"><span>{stage}</span><span>{stageCounts[stage]}</span></div>
            ))}
          </div>
        </div>
      </div>

      <div className="tc2-pairs-panel">
        <div className="tc2-pairs-head">
          <div className="ts-heading" style={{ marginBottom: 0 }}>Skillset Pairings</div>
          <span className="tc2-pairs-count">{current.pairs.length} Live</span>
        </div>
        {current.pairs.length ? (
          <div className="tc2-pairs-grid">
            {current.pairs.map((pair) => (
              <div key={pair.skills.join(':')} className="tc2-pair-row">
                <span className="tc2-pair-names">{pair.skills.map(nameFor).join(' + ')}</span>
                <span className={'tc2-pair-tag ' + pair.side}>{pair.percent === 3 ? 'Elite Fit' : 'Good Fit'} +{pair.percent}% {pair.side === 'offense' ? 'OFF' : 'DEF'}</span>
              </div>
            ))}
          </div>
        ) : <p className="tc2-note">No active Skillset pairings in this starting five.</p>}
        {(current.rawOffense > 12 || current.rawDefense > 12) && <p className="tc2-note">The +12% Skillset cap is applied before adding tenure bonuses.</p>}
        {current.flat > 0 && <p className="tc2-note">Locker Room Guy: +1 flat Offense and Defense from your roster, including the bench. Applies once.</p>}
      </div>

      {canEdit && ids.length < 5 && (
        <p className="tc2-note" role="alert">Your starting five has an open slot — add a bench player below before you can begin the season.</p>
      )}

      {canEdit && bench.length > 0 && (
        <div className="tc2-swap-panel">
          <label className="tc2-swap-label">{ids.length < 5 ? 'Add a bench player to the starting five' : 'Preview a bench player in the starting five'}
            <select value={incomingId} onChange={(e) => { setIncomingId(e.target.value); setError(''); }}>
              <option value="">Choose a player</option>
              {bench.map((p) => <option key={p.id} value={p.id}>{p.position} · {p.archetype} · {skillsetFor(p)?.name || 'No Skillset'} · #{p.id}</option>)}
            </select>
          </label>
          {bench.some((p) => p.id === incomingId) && (ids.length < 5 ? (() => {
            const incoming = team.hand.find((p) => p.id === incomingId);
            const nextIds = [...ids, incomingId];
            const validation = nextIds.length === 5 ? validateLineup({ ...team, activeIds: nextIds }) : { valid: true };
            const next = teamSynergy(team, nextIds);
            return <button className="secondary tc2-swap-btn" disabled={!validation.valid} onClick={async () => {
              const result = await onPromote(incomingId);
              if (result?.ok === false) setError(result.msg); else { setIncomingId(''); setError(''); }
            }}>
              Add {incoming.archetype} · {incoming.position} · {skillsetFor(incoming)?.name || 'No Skillset'} · #{incoming.id} to the starting five
              <br />{validation.valid ? `Chemistry ${current.grade} → ${next.grade} (${signed(next.score - current.score)} points): ${signed(next.offense - current.offense)}% Offense · ${signed(next.defense - current.defense)}% Defense` : validation.msg}
            </button>;
          })() : ids.map((outgoingId) => {
            const outgoing = team.hand.find((p) => p.id === outgoingId);
            const nextIds = ids.map((id) => id === outgoingId ? incomingId : id);
            const validation = validateLineup({ ...team, activeIds: nextIds });
            const next = teamSynergy(team, nextIds);
            return <button key={outgoingId} className="secondary tc2-swap-btn" disabled={!validation.valid} onClick={async () => {
              const result = await onSwap(outgoingId, incomingId);
              if (result?.ok === false) setError(result.msg); else { setIncomingId(''); setError(''); }
            }}>
              Replace {outgoing.archetype} · {outgoing.position} · {skillsetFor(outgoing)?.name || 'No Skillset'} · #{outgoing.id}
              <br />{validation.valid ? `Chemistry ${current.grade} → ${next.grade} (${signed(next.score - current.score)} points): ${signed(next.offense - current.offense)}% Offense · ${signed(next.defense - current.defense)}% Defense` : validation.msg}
            </button>;
          }))}
          {error && <p role="alert" className="tc2-note">{error}</p>}
        </div>
      )}
    </section>
  );
}
