import { matchTeams, isMatchUnlocked, teamOutput } from '../game/matchup';

const ERA_LENGTH = 8;

function outputFor(team) {
  return team && team.coach && team.activeIds && team.activeIds.length > 0 ? teamOutput(team) : null;
}

// Before a series is played, the row shows Projected Output alone. Once it's decided, the
// projection steps back to a small label and the actual final score (team.result.aSum/bSum,
// from playMatchup/finishTurn) takes over as the headline figure — the winner's in `approved`.
function TeamRow({ seed, team, isMine, output, result }) {
  if (!team) {
    return (
      <div className="bracket-team-row">
        <div className="bracket-team-seed">—</div>
        <div className="bracket-team-name muted">TBD</div>
      </div>
    );
  }
  const final = result ? (team === result.a ? result.aSum : result.bSum) : null;
  const isWinner = result && result.winner === team;
  return (
    <div className="bracket-team-row">
      <div className="bracket-team-seed">{seed}</div>
      <div className={'bracket-team-name' + (isMine ? ' mine' : '')}>{team.name}</div>
      <div className="bracket-team-scores">
        {result ? (
          <>
            <span className="bracket-team-proj small">Proj {output ? output.total : '—'}</span>
            <span className={'bracket-team-final' + (isWinner ? ' win' : '')}>{final}</span>
          </>
        ) : (
          <span className="bracket-team-proj">{output ? output.total : '—'}</span>
        )}
      </div>
    </div>
  );
}

// A quarterfinal, semifinal, or the Final — same node shape throughout the tree, per the
// design doc's bracket (2A). A semifinal/Final not yet fed by its earlier round shows a
// single centered "TBD" until both feeder matches are decided.
function BracketNode({ label, m, matches, index, myTeamId, actions, big, narrow }) {
  const { a, b } = matchTeams(matches, m);
  const unlocked = isMatchUnlocked(matches, m);
  const isFinal = m.label === 'Final';
  return (
    <div className={'bracket-node' + (isFinal ? ' final' : '') + (big ? ' big' : '') + (narrow ? ' narrow' : '')}>
      <div className="bracket-match-header">
        <span>{label}</span>
        <span>{unlocked ? (m.result ? 'Filed' : 'Ready') : 'Pending'}</span>
      </div>
      {!unlocked ? (
        <div className="bracket-team-tbd">TBD</div>
      ) : (
        <>
          <TeamRow seed={a ? a.seed : null} team={a} isMine={a && a.id === myTeamId} output={outputFor(a)} result={m.result} />
          <TeamRow seed={b ? b.seed : null} team={b} isMine={b && b.id === myTeamId} output={outputFor(b)} result={m.result} />
        </>
      )}
      {unlocked && (
        m.result ? (
          <button className="secondary bracket-node-btn" onClick={() => actions.openSeries(index)}>Review</button>
        ) : (
          <div className="bracket-node-btn-row">
            <button className="primary bracket-node-btn" onClick={() => actions.openSeries(index)}>{isFinal ? 'Begin The Final' : 'Begin'}</button>
            <button className="secondary bracket-node-btn" onClick={() => actions.simulateOneMatch(index)}>Sim</button>
          </div>
        )
      )}
    </div>
  );
}

export default function PlayoffBracketScreen({ state, actions, myTeamId }) {
  const matches = state.playoff.matches;
  const allDone = matches.every((m) => m.result);
  const seasonNum = Math.min(state.season, ERA_LENGTH);

  return (
    <div className="screen bracket-screen">
      <div className="bracket-masthead">
        <div>
          <div className="bracket-eyebrow">Era 01 · Season {seasonNum} · Postseason Field</div>
          <h1 className="bracket-title">The Bracket</h1>
        </div>
        <div className="bracket-meta">
          <div>
            <div className="bracket-meta-label">Rounds</div>
            <div className="bracket-meta-value">Three</div>
          </div>
          <div>
            <div className="bracket-meta-label">Format</div>
            <div className="bracket-meta-value accent">Single Elimination</div>
          </div>
        </div>
      </div>

      <p className="bracket-lede">Start any unlocked match in whatever order you like — later rounds unlock once both feeder matches are decided. Projected output is each rotation's expected points, before matchup cards and front office effects.</p>

      <div className="bracket-tree-scroll">
        <div className="bracket-tree">
          <div className="bracket-half">
            <div className="bracket-round quarter">
              <div className="bracket-round-item">
                <BracketNode label="Quarterfinal 1" m={matches[0]} matches={matches} index={0} myTeamId={myTeamId} actions={actions} />
              </div>
              <div className="bracket-round-item">
                <BracketNode label="Quarterfinal 2" m={matches[1]} matches={matches} index={1} myTeamId={myTeamId} actions={actions} />
              </div>
            </div>
            <div className="bracket-round semi">
              <div className="bracket-round-item">
                <BracketNode label="SF 1" m={matches[4]} matches={matches} index={4} myTeamId={myTeamId} actions={actions} narrow />
              </div>
            </div>
          </div>

          <div className="bracket-centre">
            <BracketNode label="The Final" m={matches[6]} matches={matches} index={6} myTeamId={myTeamId} actions={actions} big />
          </div>

          <div className="bracket-half right">
            <div className="bracket-round quarter">
              <div className="bracket-round-item">
                <BracketNode label="Quarterfinal 3" m={matches[2]} matches={matches} index={2} myTeamId={myTeamId} actions={actions} />
              </div>
              <div className="bracket-round-item">
                <BracketNode label="Quarterfinal 4" m={matches[3]} matches={matches} index={3} myTeamId={myTeamId} actions={actions} />
              </div>
            </div>
            <div className="bracket-round semi">
              <div className="bracket-round-item">
                <BracketNode label="SF 2" m={matches[5]} matches={matches} index={5} myTeamId={myTeamId} actions={actions} narrow />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bracket-footer">
        {!allDone && (
          <button className="reset-link" onClick={actions.simulateAllPlayoffs}>Simulate All ▸▸</button>
        )}
        {allDone && (
          <button className="primary" style={{ width: '100%', padding: 16 }} onClick={actions.finishPlayoffs}>See Results</button>
        )}
      </div>
    </div>
  );
}
