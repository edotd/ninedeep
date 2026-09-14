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
      <div className="screen">
        <h1>Season {state.season} Standings</h1>
        <p className="lede">
          {madeIt
            ? `You finished in ${ordinal(team.seed)} place this season.`
            : `${team.name} did not make the playoffs this season.`}
        </p>
        {!outright && (
          <div className="statusline">Championship Bar: <b>{Math.round(state.bar)}</b></div>
        )}
        {state.seeds.map((s) => (
          <div key={s.t.name} className={'standing-row' + (s.t === team ? ' you' : '')}>
            <span>#{s.t.seed} {s.t.name}{s.t.seed > 8 && <span style={{ color: 'var(--muted)' }}> — out</span>}</span>
            <span>{Math.round(s.val)}</span>
          </div>
        ))}
      </div>
      <div className="bottombar">
        <button className="primary" onClick={actions.beginPlayoffs}>Begin Playoffs</button>
      </div>
    </>
  );
}
