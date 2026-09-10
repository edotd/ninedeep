import { effectiveRating } from '../game/roster';
import { CHAMPIONSHIP_BAR_MULT } from '../game/constants';

export default function StandingsScreen({ state, actions }) {
  const team = state.teams[0];
  return (
    <>
      <div className="screen">
        <h1>Season {state.season} Standings</h1>
        <p className="lede">Top 8 of {state.seeds.length} teams make the playoffs. Final ratings set the seeding below.</p>
        <div className="statusline">
          Championship bar this season: <b>{Math.round(state.bar)}</b> rating (league average {Math.round(state.leagueAvg)} &times; {CHAMPIONSHIP_BAR_MULT}) — the Finals winner must clear this to be crowned.
        </div>
        {state.seeds.map((s) => (
          <div key={s.t.name} className={'standing-row' + (s.t === team ? ' you' : '')}>
            <span>#{s.t.seed} {s.t.name}{s.t.seed > 8 && <span style={{ color: 'var(--muted)' }}> — out</span>}</span>
            <span>{Math.round(effectiveRating(s.t))}</span>
          </div>
        ))}
      </div>
      <div className="bottombar">
        <button className="primary" onClick={actions.beginPlayoffs}>Begin Playoffs</button>
      </div>
    </>
  );
}
