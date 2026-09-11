import { matchTeams, isMatchUnlocked, teamOutput } from '../game/matchup';

function TeamColumn({ team, isMine }) {
  if (!team) {
    return <div style={{ flex: 1, minWidth: 0 }}><p className="lede" style={{ marginBottom: 0 }}>TBD</p></div>;
  }
  const output = teamOutput(team);
  const starters = team.activeIds.map((id) => team.hand.find((h) => h.id === id));
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="card-name-lg" style={{ marginBottom: 6, fontSize: 16, color: isMine ? 'var(--accent)' : undefined }}>{team.name}</div>
      <div className="active-tile-row" style={{ marginBottom: 8, gap: 5 }}>
        {starters.map((c) => (
          <div key={c.id} className={'active-tile pos-' + c.position} style={{ width: 50, height: 50, borderRadius: 10 }}>
            <div className="active-tile-pos" style={{ fontSize: 14 }}>{c.position.slice(0, 1)}</div>
            <div className="active-tile-name" style={{ fontSize: 7 }}>{c.archetype}</div>
          </div>
        ))}
      </div>
      <div className="statusline" style={{ fontSize: 11 }}>Projected Output: <b>{output.total}</b></div>
      {team.matchupCard && (
        <div className="statusline" style={{ fontSize: 11 }}>
          🃏 {team.matchupCard.name}{team.matchupCard.used ? ' (used)' : ''}
        </div>
      )}
    </div>
  );
}

export default function PlayoffBracketScreen({ state, actions, myTeamId }) {
  const matches = state.playoff.matches;
  const allDone = matches.every((m) => m.result);

  return (
    <div className="screen">
      <h1>Playoff Bracket</h1>
      <p className="lede">Start any unlocked series in whatever order you like — later rounds unlock once both feeder matchups are decided.</p>
      {matches.map((m, i) => {
        const { a, b } = matchTeams(matches, m);
        const unlocked = isMatchUnlocked(matches, m);
        return (
          <div key={i} className="matchup-box">
            <div className="matchup-title">{m.label}</div>
            {!unlocked ? (
              <p className="lede" style={{ marginBottom: 0 }}>Waiting on earlier matchups to be decided.</p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 14 }}>
                  <TeamColumn team={a} isMine={a && a.id === myTeamId} />
                  <TeamColumn team={b} isMine={b && b.id === myTeamId} />
                </div>
                {m.result ? (
                  <>
                    <div className="statusline" style={{ marginTop: 10 }}>
                      Final: {a.name} {m.result.aSum} — {m.result.bSum} {b.name} · Winner: <b>{m.result.winner.name}</b>
                    </div>
                    <button className="secondary" style={{ width: '100%', marginTop: 8 }} onClick={() => actions.openSeries(i)}>Review Series</button>
                  </>
                ) : (
                  <button className="primary" style={{ width: '100%', marginTop: 10 }} onClick={() => actions.openSeries(i)}>Begin Series</button>
                )}
              </>
            )}
          </div>
        );
      })}
      {allDone && (
        <button className="primary" style={{ width: '100%', padding: 16, margin: '16px 0' }} onClick={actions.finishPlayoffs}>See Results</button>
      )}
    </div>
  );
}
