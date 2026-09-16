import { useState } from 'react';
import { SKILLSETS, teamSynergy, skillsetFor } from '../game/skillsets';
import { teamExperience } from '../game/aging';
import { validateLineup } from '../game/roster';

const nameFor = (id) => SKILLSETS.find((s) => s.id === id)?.name || id;
const signed = (n) => `${n >= 0 ? '+' : ''}${n}`;

export default function TeamChemistry({ team, canEdit, onSwap }) {
  const [incomingId, setIncomingId] = useState('');
  const [error, setError] = useState('');
  const current = teamSynergy(team);
  const experience = team.coach ? teamExperience(team) : null;
  const ids = team.activeIds || [];
  const bench = team.hand.filter((p) => !ids.includes(p.id));
  return (
    <section className="team-chemistry">
      <h2>Team Chemistry</h2>
      <div className="chemistry-totals">
        <span>Experience <strong>{experience ?? '—'}/10</strong></span>
        <span>Offense <strong>+{current.offense}%{current.flat ? ' +1 flat' : ''}</strong></span>
        <span>Defense <strong>+{current.defense}%{current.flat ? ' +1 flat' : ''}</strong></span>
      </div>
      <p>Elite Fit +3% · Good Fit +1% · maximum +12% per side. Repeated Skillset pairings count once.</p>
      {current.pairs.length ? <ul>{current.pairs.map((pair) => (
        <li key={pair.skills.join(':')}><strong>{pair.skills.map(nameFor).join(' + ')}</strong> — {pair.percent === 3 ? 'Elite Fit' : 'Good Fit'} · +{pair.percent}% {pair.side}</li>
      ))}</ul> : <p>No active Skillset pairings in this starting five.</p>}
      {(current.rawOffense > 12 || current.rawDefense > 12) && <p>The +12% cap is applied to the totals above.</p>}
      {current.flat > 0 && <p>Locker Room Guy: +1 flat Offense and Defense from your roster, including the bench. Applies once.</p>}
      {canEdit && bench.length > 0 && <div className="chemistry-swaps">
        <label>Preview a bench player in the starting five
          <select value={incomingId} onChange={(e) => { setIncomingId(e.target.value); setError(''); }}>
            <option value="">Choose a player</option>
            {bench.map((p) => <option key={p.id} value={p.id}>{p.position} · {p.archetype} · {skillsetFor(p)?.name || 'No Skillset'} · #{p.id}</option>)}
          </select>
        </label>
        {bench.some((p) => p.id === incomingId) && ids.map((outgoingId) => {
          const outgoing = team.hand.find((p) => p.id === outgoingId);
          const nextIds = ids.map((id) => id === outgoingId ? incomingId : id);
          const validation = validateLineup({ ...team, activeIds: nextIds });
          const next = teamSynergy(team, nextIds);
          return <button key={outgoingId} className="secondary" disabled={!validation.valid} onClick={async () => {
            const result = await onSwap(outgoingId, incomingId);
            if (result?.ok === false) setError(result.msg); else { setIncomingId(''); setError(''); }
          }}>
            Replace {outgoing.archetype} · {outgoing.position} · {skillsetFor(outgoing)?.name || 'No Skillset'} · #{outgoing.id}
            <br />{validation.valid ? `Chemistry change: ${signed(next.offense-current.offense)}% Offense · ${signed(next.defense-current.defense)}% Defense` : validation.msg}
          </button>;
        })}
        {error && <p role="alert">{error}</p>}
      </div>}
    </section>
  );
}
