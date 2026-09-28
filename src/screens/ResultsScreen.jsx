import { useEffect, useState } from 'react';
import MatchupBox from '../components/MatchupBox';
import { effectiveRating } from '../game/roster';
import { seasonResultForTeam } from '../game/season';

const RESULT_DISPLAY = { MISSED: 'Missed Playoffs', R1: 'Round 1 Loss', R2: 'Round 2 Loss', FINALS: 'Finals Loss', TITLE: 'Finals Win' };
const SWAP_MS = 3500;

export default function ResultsScreen({ state, actions, myTeamId }) {
  const r = state.lastResult;
  const team = state.teams[myTeamId];
  // The standings list alternates its right-hand column between each team's seeding rating
  // (the same number Standings showed before the playoffs) and how far they actually got this
  // postseason — both are worth seeing, and there isn't room to show them side by side.
  const [showResult, setShowResult] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setShowResult((v) => !v), SWAP_MS);
    return () => clearInterval(timer);
  }, []);
  return (
    <>
      <div className="screen">
        <h1>Season {state.season} Results</h1>
        <h2>Regular Season Standings</h2>
        <div className="results-standings">
          <div className="standing-row head">
            <span>Team</span>
            <span>{showResult ? 'Result' : 'Rating'}</span>
          </div>
          {r.seeds.map((s) => (
            <div key={s.t.name} className={'standing-row' + (s.t === team ? ' you' : '')}>
              <span>#{s.t.seed} {s.t.name}</span>
              <span>{showResult ? RESULT_DISPLAY[seasonResultForTeam(state, s.t)] : Math.round(s.val)}</span>
            </div>
          ))}
        </div>
        <h2>Playoffs</h2>
        {r.matches.map((m, i) => <MatchupBox key={i} title={m.label} m={m.result} />)}
        <div className={'banner ' + (r.champion ? 'good' : 'bad')}>
          {r.outright
            ? `Season ${state.season} Champion – ${r.winner.name}`
            : r.champion
              ? `Season ${state.season} Champion – ${r.champion.name}`
              : `No champion this season. ${r.winner.name} won the Finals with a rating of ${Math.round(effectiveRating(r.winner))}, short of the ${Math.round(r.bar)} championship bar.`}
        </div>
      </div>
      <div className="bottombar">
        <button className="primary" onClick={actions.proceedFromResults}>Continue</button>
      </div>
    </>
  );
}
