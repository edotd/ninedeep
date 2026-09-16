import CardTypeMark from '../components/CardTypeMark';

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function StandingsScreen({ state, actions, myTeamId }) {
  const team = state.teams[myTeamId];
  const madeIt = team.seed <= 8;
  const outright = state.settings && state.settings.winCondition === 'outright';
  return (
    <>
      <div className="screen standings-screen">
        <div className="standings-inner">
          <div className="standings-masthead">
            <div className="standings-eyebrow">Season {state.season} · Regular Season Filed</div>
            <div className="standings-result">
              {madeIt
                ? <>You finished in <span className="accent">{ordinal(team.seed)}</span> place this season.</>
                : <>{team.name} did not make the playoffs this season.</>}
            </div>
            {!outright && (
              <div className="standings-bar-row">
                <span className="standings-bar-label">Championship Bar</span>
                <span className="standings-bar-value">{Math.round(state.bar)}</span>
              </div>
            )}
          </div>

          <div className="standings-table">
            <div className="standings-head-row">
              <span>Team</span>
              <span>Off Avg</span>
              <span>Def Avg</span>
              <span>Rating</span>
            </div>
            {state.seeds.map((s) => {
              const seedingCards = (s.t.matchupCards || []).filter((c) => c.effectType === 'SEEDING_PERCENT' && c.used);
              return (
              <div key={s.t.name} className={'standings-row' + (s.t === team ? ' you' : '') + (s.t.seed > 8 ? ' out' : '')}>
                <span className="standings-team">
                  <span className="standings-seed">#{s.t.seed}</span> {s.t.name}
                  {seedingCards.length > 0 && (
                    <span
                      className="standings-seeding-icon"
                      title={seedingCards.map((c) => `${c.name} +${c.value}%`).join(' · ') + ' Seeding Roll'}
                    >
                      <CardTypeMark type="matchup" size={13} />
                    </span>
                  )}
                  {s.t.seed > 8 && <span className="standings-out-tag"> — out</span>}
                </span>
                <span>{s.t.simOffenseAvg != null ? s.t.simOffenseAvg : '—'}</span>
                <span>{s.t.simDefenseAvg != null ? s.t.simDefenseAvg : '—'}</span>
                <span className="standings-rating">{Math.round(s.val)}</span>
              </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="bottombar">
        <button className="primary" onClick={actions.beginPlayoffs}>Begin Playoffs</button>
      </div>
    </>
  );
}
