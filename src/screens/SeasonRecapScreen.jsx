import { teamOutput } from '../game/matchup';
import { ERA_LENGTH } from '../game/constants';
import { teamSynergy } from '../game/skillsets';
import { PlayerLedgerIdentity, CostBlocks } from '../components/LedgerRow';

const RESULT_LABEL = { TITLE: 'TITLE', FINALS: 'FINALS', R2: 'R2', R1: 'R1', MISSED: null };
const OUTCOME_LABEL = { TITLE: 'CHAMPIONS', FINALS: 'FINALS', R2: 'ROUND 2', R1: 'ROUND 1', MISSED: 'MISSED' };

// Season Recap — "the era ledger" (design brand handoff, 1b) — filed once when a season
// closes, between the Results screen and the Draft. Organised by time: one column per era
// year, so the championship window and the contract cliff are both visible without doing
// the arithmetic yourself.
export default function SeasonRecapScreen({ state, actions, myTeamId }) {
  const team = state.teams[myTeamId];
  const history = team.seasonHistory || [];
  const latest = history[history.length - 1];
  const output = team.coach && team.activeIds && team.activeIds.length > 0 ? teamOutput(team) : null;
  const chemistry = team.coach ? teamSynergy(team).grade : null;

  const years = Array.from({ length: ERA_LENGTH }, (_, i) => i + 1);
  const byYear = {};
  history.forEach((h) => { byYear[h.season] = h; });

  return (
    <>
      <div className="screen sr-screen">
        <div className="sr-header">
          <div className="sr-verdict">
            <div className="sr-verdict-label">SEASON {state.season} · FILED</div>
            <div className="sr-verdict-outcome">{latest ? OUTCOME_LABEL[latest.result] : '—'}</div>
          </div>
          <div className="sr-header-figures">
            <div><div className="sr-figure-label">Budget Used</div><div className="sr-figure-value">{latest ? Math.round(latest.capUsed * 10) / 10 : '—'}</div></div>
            <div><div className="sr-figure-label">Off Rtg</div><div className="sr-figure-value accent">{output ? output.total : '—'}</div></div>
            <div><div className="sr-figure-label">Chemistry</div><div className="sr-figure-value">{chemistry !== null ? chemistry : '—'}</div></div>
          </div>
        </div>

        <div className="sr-grid" style={{ gridTemplateColumns: `92px repeat(${ERA_LENGTH}, 1fr)` }}>
          <div className="sr-grid-rowlabel">YEAR</div>
          {years.map((y) => <div key={y} className={'sr-grid-year' + (y === state.season ? ' current' : '')}>{y}</div>)}

          <div className="sr-grid-rowlabel">RESULT</div>
          {years.map((y) => {
            const h = byYear[y];
            if (!h) return <div key={y} className="sr-grid-cell unplayed">—</div>;
            const label = RESULT_LABEL[h.result];
            return <div key={y} className={'sr-grid-cell' + (h.result === 'TITLE' ? ' title' : '')}>{label || 'MISSED'}</div>;
          })}

          <div className="sr-grid-rowlabel">CAP USED</div>
          {years.map((y) => {
            const h = byYear[y];
            return <div key={y} className={'sr-grid-num' + (!h ? ' unplayed' : y === state.season ? ' current' : '')}>{h ? Math.round(h.capUsed * 10) / 10 : '—'}</div>;
          })}

          <div className="sr-grid-rowlabel">UNDER CONTRACT</div>
          {years.map((y) => {
            const h = byYear[y];
            const low = h && h.underContract < 5;
            return <div key={y} className={'sr-grid-num' + (!h ? ' unplayed' : low ? ' low' : y === state.season ? ' current' : '')}>{h ? h.underContract : '—'}</div>;
          })}
        </div>

        <div className="sr-section">
          <div className="sr-heading">Contracts On The Books</div>
          <div className="ts-ledger-list">
            {team.hand.map((c) => (
              <div className="ts-ledger-person" key={c.id}>
                <PlayerLedgerIdentity card={c} />
                <CostBlocks turns={c.contract} amount={c.salary} />
              </div>
            ))}
            {team.hand.length === 0 && <p className="lede">No players carrying a contract into next season.</p>}
          </div>
        </div>
      </div>
      <div className="bottombar">
        <button className="primary" onClick={actions.proceedFromSeasonRecap}>Expiring Contracts</button>
      </div>
    </>
  );
}
