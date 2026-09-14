import MatchupBox from '../components/MatchupBox';
import { effectiveRating } from '../game/roster';

export default function ResultsScreen({ state, actions, myTeamId }) {
  const r = state.lastResult;
  const team = state.teams[myTeamId];
  return (
    <>
      <div className="screen">
        <h1>Season {state.season} Results</h1>
        <h2>Standings</h2>
        {r.seeds.map((s) => (
          <div key={s.t.name} className={'standing-row' + (s.t === team ? ' you' : '')}>
            <span>#{s.t.seed} {s.t.name}{s.t.seed > 8 && <span style={{ color: 'var(--muted)' }}> — out</span>}</span>
            <span>{Math.round(s.val)}</span>
          </div>
        ))}
        {r.outright ? (
          <div className="statusline">Win condition this season: <b>Win the playoffs outright</b> — no championship bar to clear.</div>
        ) : (
          <div className="statusline">Championship bar this season: <b>{Math.round(r.bar)}</b> rating (playoff-field average {Math.round(r.leagueAvg)} &times; {r.barMult})</div>
        )}
        <h2>Playoffs</h2>
        {r.matches.map((m, i) => <MatchupBox key={i} title={m.label} m={m.result} />)}
        <div className={'banner ' + (r.champion ? 'good' : 'bad')}>
          {r.outright
            ? `${r.winner.name} wins the championship outright!`
            : r.champion
              ? `${r.champion.name} wins the championship! Rating ${Math.round(effectiveRating(r.champion))} cleared the ${Math.round(r.bar)} bar.`
              : `No champion this season. ${r.winner.name} won the Finals with a rating of ${Math.round(effectiveRating(r.winner))}, short of the ${Math.round(r.bar)} championship bar.`}
        </div>
      </div>
      <div className="bottombar">
        <button className="primary" onClick={actions.proceedFromResults}>Continue</button>
      </div>
    </>
  );
}
