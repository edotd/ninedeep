import { useState } from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { matchTeams, isMatchUnlocked, teamOutput } from '../game/matchup';
import { ERA_LENGTH } from '../game/constants';


function outputFor(team) {
  return team && team.coach && team.activeIds && team.activeIds.length > 0 ? teamOutput(team) : null;
}

function fmt(n) {
  return n === null || n === undefined ? '—' : n.toFixed(2);
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
      <div className={'bracket-team-name' + (isMine ? ' mine' : '')} title={team.name}>{team.tricode || team.name}</div>
      <div className="bracket-team-scores">
        {result ? (
          <>
            <span className="bracket-team-proj small">Proj {fmt(output ? output.total : null)}</span>
            <span className={'bracket-team-final' + (isWinner ? ' win' : '')}>{fmt(final)}</span>
          </>
        ) : (
          <span className="bracket-team-proj">{fmt(output ? output.total : null)}</span>
        )}
      </div>
    </div>
  );
}

// A quarterfinal, semifinal, or the Final — same node shape throughout the tree, per the
// design doc's bracket (2A). A semifinal/Final not yet fed by its earlier round shows a
// single centered "TBD" until both feeder matches are decided. `onSelect`, when given, makes
// the whole card clickable (used by the overview to zoom into whichever cluster the clicked
// series belongs to) — the action buttons stop that click from bubbling so Begin/Sim/Review
// still just do their own thing.
function BracketNode({ label, m, matches, index, myTeamId, actions, big, narrow, zoomed, onSelect }) {
  const { a, b } = matchTeams(matches, m);
  const unlocked = isMatchUnlocked(matches, m);
  const isFinal = m.label === 'Final';
  const humanTeams = [a, b].filter((team) => team?.human);
  const isParticipant = humanTeams.some((team) => team.id === myTeamId);
  const isReady = (m.readyTeamIds || []).includes(myTeamId);
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  return (
    <div
      className={'bracket-node' + (isFinal ? ' final' : '') + (big ? ' big' : '') + (narrow ? ' narrow' : '') + (zoomed ? ' zoomed' : '') + (onSelect ? ' selectable' : '')}
      onClick={onSelect}
    >
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
          <button className="secondary bracket-node-btn" onClick={stop(() => actions.openSeries(index, myTeamId))}>Review</button>
        ) : humanTeams.length === 2 ? (
          isParticipant ? <button className="primary bracket-node-btn" disabled={isReady} onClick={stop(() => actions.openSeries(index, myTeamId))}>{isReady ? 'Waiting For Opponent' : 'Ready Up'}</button>
            : <div className="bracket-node-status">Players Must Ready Up</div>
        ) : humanTeams.length === 1 ? (
          isParticipant ? (
            <div className="bracket-node-btn-row">
              <button className="primary bracket-node-btn" onClick={stop(() => actions.openSeries(index, myTeamId))}>{isFinal ? 'Begin The Final' : 'Begin'}</button>
              <button className="secondary bracket-node-btn" onClick={stop(() => actions.simulateOneMatch(index, myTeamId))}>Sim</button>
            </div>
          ) : <div className="bracket-node-status">Waiting For Player</div>
        ) : (
          <div className="bracket-node-btn-row">
            <button className="primary bracket-node-btn" onClick={stop(() => actions.openSeries(index, myTeamId))}>{isFinal ? 'Begin The Final' : 'Begin'}</button>
            <button className="secondary bracket-node-btn" onClick={stop(() => actions.simulateOneMatch(index, myTeamId))}>Sim</button>
          </div>
        )
      )}
    </div>
  );
}

// Which zoomed segment a clicked series belongs to — the two quarterfinals feeding a
// semifinal zoom to that semifinal's side; the Final zooms to the Final Four in the middle.
function segmentForIndex(index) {
  if (index === 0 || index === 1 || index === 4) return 'left';
  if (index === 2 || index === 3 || index === 5) return 'right';
  return 'middle';
}

const SEGMENTS = [
  { key: 'left', label: 'Left Bracket', sub: 'QF1 · QF2 · SF1' },
  { key: 'middle', label: 'Final Four', sub: 'SF1 · SF2 · Final' },
  { key: 'right', label: 'Right Bracket', sub: 'QF3 · QF4 · SF2' },
];

// The zoomed-in view — one cluster of the bracket at a time, filling the screen, switched via
// a scrollbar-styled control that only ever snaps to one of its three segments rather than
// scrolling freely (there's nothing to scroll: each segment is its own fixed layout, not a
// window onto one continuous strip).
function ZoomedBracket({ matches, myTeamId, actions, segment, onSegmentChange, onZoomOut, allDone }) {
  const segIndex = SEGMENTS.findIndex((s) => s.key === segment);
  const node = (index, label, extra) => (
    <BracketNode key={index} label={label} m={matches[index]} matches={matches} index={index} myTeamId={myTeamId} actions={actions} zoomed {...extra} />
  );

  return (
    <div className="screen bracket-zoomed-screen">
      <div className="bracket-zoom-header">
        <button className="bracket-zoom-back" onClick={onZoomOut}>⤢ Full Bracket</button>
        <div className="bracket-zoom-label">{SEGMENTS[segIndex].label}</div>
      </div>

      <div className="bracket-zoom-content">
        {segment === 'left' && (
          <div className="bracket-zoom-cluster">
            <div className="bracket-zoom-quarters">
              {node(0, 'Quarterfinal 1')}
              {node(1, 'Quarterfinal 2')}
            </div>
            <div className="bracket-zoom-arrow">→</div>
            {node(4, 'Semifinal 1', { big: true })}
          </div>
        )}
        {segment === 'middle' && (
          <div className="bracket-zoom-cluster middle">
            {node(4, 'Semifinal 1')}
            <div className="bracket-zoom-arrow">→</div>
            {node(6, 'The Final', { big: true })}
            <div className="bracket-zoom-arrow rev">→</div>
            {node(5, 'Semifinal 2')}
          </div>
        )}
        {segment === 'right' && (
          <div className="bracket-zoom-cluster reverse">
            {node(5, 'Semifinal 2', { big: true })}
            <div className="bracket-zoom-arrow rev">→</div>
            <div className="bracket-zoom-quarters">
              {node(2, 'Quarterfinal 3')}
              {node(3, 'Quarterfinal 4')}
            </div>
          </div>
        )}
      </div>

      <div className="bracket-zoom-scrollbar">
        <div className="bracket-zoom-track">
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              className={'bracket-zoom-seg' + (s.key === segment ? ' active' : '')}
              onClick={() => onSegmentChange(s.key)}
            >
              <span className="bracket-zoom-seg-label">{s.label}</span>
              <span className="bracket-zoom-seg-sub">{s.sub}</span>
            </button>
          ))}
          <div className="bracket-zoom-thumb" style={{ left: `calc(${segIndex} * 33.333% + 2px)` }} />
        </div>
      </div>

      <div className="bracket-footer">
        {!allDone && (
          <button className="reset-link" onClick={() => actions.simulateAllPlayoffs(myTeamId)}>Simulate CPU Series ▸▸</button>
        )}
        {allDone && (
          <button className="primary" style={{ width: '100%', padding: 16 }} onClick={actions.finishPlayoffs}>See Results</button>
        )}
      </div>
    </div>
  );
}

// Mobile round tabs (per the brand handoff's mobile Bracket) — one round at a time, series
// stacked full-width instead of the desktop tree, each still the same BracketNode so Begin/
// Sim/Review keep working exactly as they do on desktop. Reached instead of the desktop
// tree+zoom flow, not on top of it — a phone screen has no room for the tree at all.
const ROUNDS = [
  { key: 'first', label: 'First Round', indices: [0, 1, 2, 3] },
  { key: 'semis', label: 'Semis', indices: [4, 5] },
  { key: 'final', label: 'Final', indices: [6] },
];
const LABELS = { 0: 'Quarterfinal 1', 1: 'Quarterfinal 2', 2: 'Quarterfinal 3', 3: 'Quarterfinal 4', 4: 'Semifinal 1', 5: 'Semifinal 2', 6: 'The Final' };

function MobileBracket({ state, actions, myTeamId, matches, allDone, seasonNum }) {
  const [round, setRound] = useState('first');
  const active = ROUNDS.find((r) => r.key === round);
  const roundDone = (r) => r.indices.every((i) => matches[i].result);
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
        </div>
      </div>

      <div className="bracket-round-tabbar">
        {ROUNDS.map((r) => (
          <button key={r.key} className={'bracket-round-tab' + (r.key === round ? ' active' : '')} onClick={() => setRound(r.key)}>
            {r.label}{roundDone(r) && <span className="bracket-round-tab-done">✓</span>}
          </button>
        ))}
      </div>

      <div className="bracket-round-list">
        {active.indices.map((i) => (
          <BracketNode key={i} label={LABELS[i]} m={matches[i]} matches={matches} index={i} myTeamId={myTeamId} actions={actions} narrow />
        ))}
      </div>

      <div className="bracket-footer">
        {!allDone && (
          <button className="reset-link" onClick={() => actions.simulateAllPlayoffs(myTeamId)}>Simulate CPU Series ▸▸</button>
        )}
        {allDone && (
          <button className="primary" style={{ width: '100%', padding: 16 }} onClick={actions.finishPlayoffs}>See Results</button>
        )}
      </div>
    </div>
  );
}

export default function PlayoffBracketScreen({ state, actions, myTeamId }) {
  const matches = state.playoff.matches;
  const allDone = matches.every((m) => m.result);
  const seasonNum = Math.min(state.season, ERA_LENGTH);
  const [zoom, setZoom] = useState(null); // null = full-bracket overview, else 'left'|'middle'|'right'
  const isDesktop = useIsDesktop();

  if (!isDesktop) {
    return <MobileBracket state={state} actions={actions} myTeamId={myTeamId} matches={matches} allDone={allDone} seasonNum={seasonNum} />;
  }

  if (zoom) {
    return (
      <ZoomedBracket
        matches={matches}
        myTeamId={myTeamId}
        actions={actions}
        segment={zoom}
        onSegmentChange={setZoom}
        onZoomOut={() => setZoom(null)}
        allDone={allDone}
      />
    );
  }

  const zoomTo = (index) => () => setZoom(segmentForIndex(index));

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

      <p className="bracket-lede">Click any series to zoom in. Start any unlocked match in whatever order you like — later rounds unlock once both feeder matches are decided. Projected output is each rotation's expected points, before matchup cards and front office effects.</p>

      <div className="bracket-tree-scroll">
        <div className="bracket-tree">
          <div className="bracket-half">
            <div className="bracket-round quarter">
              <div className="bracket-round-item">
                <BracketNode label="Quarterfinal 1" m={matches[0]} matches={matches} index={0} myTeamId={myTeamId} actions={actions} onSelect={zoomTo(0)} />
              </div>
              <div className="bracket-round-item">
                <BracketNode label="Quarterfinal 2" m={matches[1]} matches={matches} index={1} myTeamId={myTeamId} actions={actions} onSelect={zoomTo(1)} />
              </div>
            </div>
            <div className="bracket-round semi">
              <div className="bracket-round-item">
                <BracketNode label="SF 1" m={matches[4]} matches={matches} index={4} myTeamId={myTeamId} actions={actions} narrow onSelect={zoomTo(4)} />
              </div>
            </div>
          </div>

          <div className="bracket-centre">
            <BracketNode label="The Final" m={matches[6]} matches={matches} index={6} myTeamId={myTeamId} actions={actions} big onSelect={zoomTo(6)} />
          </div>

          <div className="bracket-half right">
            <div className="bracket-round quarter">
              <div className="bracket-round-item">
                <BracketNode label="Quarterfinal 3" m={matches[2]} matches={matches} index={2} myTeamId={myTeamId} actions={actions} onSelect={zoomTo(2)} />
              </div>
              <div className="bracket-round-item">
                <BracketNode label="Quarterfinal 4" m={matches[3]} matches={matches} index={3} myTeamId={myTeamId} actions={actions} onSelect={zoomTo(3)} />
              </div>
            </div>
            <div className="bracket-round semi">
              <div className="bracket-round-item">
                <BracketNode label="SF 2" m={matches[5]} matches={matches} index={5} myTeamId={myTeamId} actions={actions} narrow onSelect={zoomTo(5)} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bracket-footer">
        {!allDone && (
          <button className="reset-link" onClick={() => actions.simulateAllPlayoffs(myTeamId)}>Simulate CPU Series ▸▸</button>
        )}
        {allDone && (
          <button className="primary" style={{ width: '100%', padding: 16 }} onClick={actions.finishPlayoffs}>See Results</button>
        )}
      </div>
    </div>
  );
}
