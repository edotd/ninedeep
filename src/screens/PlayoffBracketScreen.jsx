import { matchTeams, isMatchUnlocked, teamOutput } from '../game/matchup';

const ERA_LENGTH = 8;

function outputFor(team) {
  return team && team.coach && team.activeIds && team.activeIds.length > 0 ? teamOutput(team) : null;
}

function TeamRow({ seed, team, isMine, output }) {
  if (!team) {
    return (
      <div className="bracket-team-row">
        <div className="bracket-team-seed">—</div>
        <div className="bracket-team-name muted">TBD</div>
      </div>
    );
  }
  return (
    <div className="bracket-team-row">
      <div className="bracket-team-seed">{seed}</div>
      <div className={'bracket-team-name' + (isMine ? ' mine' : '')}>{team.name}</div>
      <div className="bracket-team-proj">{output ? output.total : '—'}</div>
    </div>
  );
}

// A quarterfinal, semifinal, or the Final — same node shape throughout the tree, per the
// design doc's bracket (2A). A semifinal/Final not yet fed by its earlier round shows a named
// placeholder ("Winner QF1") instead of the plain "TBD" a first-round node uses when somehow
// still locked.
function BracketNode({ label, m, matches, index, myTeamId, actions, pendingA, pendingB, big, narrow }) {
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
        <>
          <div className="bracket-team-row"><div className="bracket-team-seed">—</div><div className="bracket-team-name muted">{pendingA}</div></div>
          <div className="bracket-team-row"><div className="bracket-team-seed">—</div><div className="bracket-team-name muted">{pendingB}</div></div>
        </>
      ) : (
        <>
          <TeamRow seed={a ? a.seed : null} team={a} isMine={a && a.id === myTeamId} output={outputFor(a)} />
          <TeamRow seed={b ? b.seed : null} team={b} isMine={b && b.id === myTeamId} output={outputFor(b)} />
        </>
      )}
      {unlocked && (
        m.result ? (
          <button className="secondary bracket-node-btn" onClick={() => actions.openSeries(index)}>Review</button>
        ) : (
          <button className="primary bracket-node-btn" onClick={() => actions.openSeries(index)}>{isFinal ? 'Begin The Final' : 'Begin'}</button>
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
            <div className="bracket-node-slot top">
              <BracketNode label="Quarterfinal 1" m={matches[0]} matches={matches} index={0} myTeamId={myTeamId} actions={actions} />
            </div>
            <div className="bracket-node-slot bottom">
              <BracketNode label="Quarterfinal 2" m={matches[1]} matches={matches} index={1} myTeamId={myTeamId} actions={actions} />
            </div>
            <div className="bracket-line bracket-line-h top" />
            <div className="bracket-line bracket-line-h bottom" />
            <div className="bracket-line bracket-line-v" />
            <div className="bracket-line bracket-line-h mid" />
            <div className="bracket-sf-slot">
              <BracketNode label="SF 1" m={matches[4]} matches={matches} index={4} myTeamId={myTeamId} actions={actions} pendingA="Winner QF1" pendingB="Winner QF2" narrow />
            </div>
            <div className="bracket-line bracket-line-h to-final" />
          </div>

          <div className="bracket-centre">
            <BracketNode label="The Final" m={matches[6]} matches={matches} index={6} myTeamId={myTeamId} actions={actions} pendingA="Winner SF1" pendingB="Winner SF2" big />
          </div>

          <div className="bracket-half right">
            <div className="bracket-node-slot top">
              <BracketNode label="Quarterfinal 3" m={matches[2]} matches={matches} index={2} myTeamId={myTeamId} actions={actions} />
            </div>
            <div className="bracket-node-slot bottom">
              <BracketNode label="Quarterfinal 4" m={matches[3]} matches={matches} index={3} myTeamId={myTeamId} actions={actions} />
            </div>
            <div className="bracket-line bracket-line-h top" />
            <div className="bracket-line bracket-line-h bottom" />
            <div className="bracket-line bracket-line-v" />
            <div className="bracket-line bracket-line-h mid" />
            <div className="bracket-sf-slot">
              <BracketNode label="SF 2" m={matches[5]} matches={matches} index={5} myTeamId={myTeamId} actions={actions} pendingA="Winner QF3" pendingB="Winner QF4" narrow />
            </div>
            <div className="bracket-line bracket-line-h to-final" />
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
