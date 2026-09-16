import { useState } from 'react';
import { playableCards, injuryPreventionCard } from '../game/matchup';
import { PLAYER_STATS } from '../game/supplementalEffects';
import { STEP_PLAN } from '../game/turn';

const KIND_LABEL = { offense: 'Offense', defense: 'Defense', bench: 'Bench' };

function sideOf(m, team) { return team === m.a ? 'a' : 'b'; }

// Pulls the numbers a just-finished roll produced (from m.turn's accumulated fields) so the
// 'stepdone' stage can show it as a resolution report before the player continues on.
function reportForStep(turn, m, stepIdx) {
  const plan = STEP_PLAN[stepIdx];
  const team = plan.who === 'first' ? turn.order[0] : turn.order[1];
  const side = sideOf(m, team);
  if (plan.kind === 'bench') {
    return { team, kind: 'bench', bench: turn[`${side}Bench`] };
  }
  const label = plan.kind === 'offense' ? 'Off' : 'Def';
  return {
    team, kind: plan.kind,
    die: turn[`${side}${label}Die`], dieOther: turn[`${side}${label}DieOther`], sides: turn[`${side}${label}Sides`],
    mod: turn[`${side}${label}Mod`], total: turn[`${side}${label}Total`],
    mode: turn[`${side}${label}Mode`],
  };
}

// Drives one turn (coin flip, then each team's offense/defense/bench cycle) stage by stage —
// see game/turn.js for the state machine this renders. Stays mounted until m.turn.stage
// becomes 'complete', at which point m.result exists and PlayoffSeriesScreen swaps back to the
// existing MatchupBox reveal. Laid out per the design doc's 2C screen (rail / stage panel /
// game log) collapsed to this app's single-column width.
export default function TurnPanel({ state, actions, m, myTeamId }) {
  const turn = m.turn;
  const teamA = m.a, teamB = m.b;
  const myTeam = state.teams[myTeamId];
  const humanInMatch = teamA === myTeam || teamB === myTeam;
  const [targetPickerCardId, setTargetPickerCardId] = useState(null);

  const cur = turn.current;
  const actingTeam = cur ? (cur.team === 'a' ? teamA : teamB) : null;
  const otherTeam = cur ? (cur.team === 'a' ? teamB : teamA) : null;

  const myTurnToAct = turn.stage === 'action' && humanInMatch && actingTeam === myTeam;
  const myTurnToReact = turn.stage === 'reaction' && humanInMatch && otherTeam === myTeam;
  const waitingOnOpponent =
    !myTurnToAct && !myTurnToReact && humanInMatch &&
    ((turn.stage === 'action' && actingTeam.human && actingTeam !== myTeam) ||
      (turn.stage === 'reaction' && otherTeam.human && otherTeam !== myTeam));

  const advance = (payload) => actions.advanceTurn(payload);

  // --- Rail: coin flip, then each of the 6 offense/defense/bench steps ---
  const railItems = [{ id: 'coinflip', label: 'Coin Flip' }].concat(
    STEP_PLAN.map((plan, i) => {
      const team = turn.order ? (plan.who === 'first' ? turn.order[0] : turn.order[1]) : null;
      return { id: i, label: `${team ? team.name : plan.who === 'first' ? 'First' : 'Second'} — ${KIND_LABEL[plan.kind]}` };
    })
  );
  const railStatus = (id) => {
    if (id === 'coinflip') return turn.order ? 'filed' : 'active';
    if (!turn.order) return 'pending';
    if (turn.stepIndex > id) return 'filed';
    if (turn.stepIndex === id) return 'active';
    return 'pending';
  };

  // --- Stage chips for whatever step is currently in progress ---
  const chipNames = turn.stage === 'coinflip'
    ? ['Coin Flip']
    : (cur ? cur.kind : STEP_PLAN[Math.max(0, turn.stepIndex - 1)].kind) === 'bench'
      ? ['Roll', 'Resolution']
      : ['Roll', 'Action', 'Reaction', 'Resolution'];
  const chipIndex = { coinflip: 0, roll: 0, action: 1, reaction: 2, stepdone: chipNames.length - 1 }[turn.stage] ?? 0;

  const myOptions = myTurnToAct ? playableCards(myTeam) : [];
  const myIP = myTurnToReact ? injuryPreventionCard(myTeam) : null;

  const headline = cur
    ? `${actingTeam.name} — ${KIND_LABEL[cur.kind]}`
    : turn.stage === 'stepdone'
      ? 'Resolution'
      : 'Coin Flip';

  return (
    <div className="turn-screen">
      <div className="turn-matchup-title">{m.label}</div>
      <div className="turn-heading">{teamA.name} vs {teamB.name}</div>

      <div className="turn-rail">
        {railItems.map((item) => (
          <div key={item.id} className={`turn-rail-item ${railStatus(item.id)}`}>{item.label}</div>
        ))}
      </div>

      <div className="turn-stage-panel">
        <div className="turn-stage-chips">
          {chipNames.map((name, i) => (
            <div key={name} className={`turn-chip ${i === chipIndex ? 'active' : i < chipIndex ? 'filed' : ''}`}>
              {i < chipIndex ? 'Filed' : name}
            </div>
          ))}
        </div>

        <div className="turn-stage-headline">{headline}</div>

        {turn.stage === 'coinflip' && (
          <div className="turn-coin-row">
            <div className="turn-coin">
              <div className="turn-coin-face">Toss</div>
              <div className="turn-coin-brand">Nine Deep</div>
            </div>
            <div className="turn-coin-sub">Winner opens on offense; the other team receives the ball after the bench roll.</div>
          </div>
        )}

        {cur && cur.die != null && (turn.stage === 'action' || turn.stage === 'reaction') && (
          <div className="turn-dice-row">
            <div className="turn-die-kept">{cur.die}</div>
            {cur.dieOther != null && <div className="turn-die-dropped">{cur.dieOther}</div>}
            <div className="turn-dice-note">
              <div>1d{cur.sides}{cur.dieOther != null ? ` — rolled twice, kept the ${cur.mode < 0 ? 'lower' : 'higher'}` : ''}</div>
              <div className="turn-dice-note-sub">Kept value carries into the action stage.</div>
            </div>
          </div>
        )}

        {turn.stage === 'stepdone' && (() => {
          const report = reportForStep(turn, m, turn.stepIndex - 1);
          return (
            <div className="turn-report">
              {report.kind === 'bench' ? (
                <div className="turn-report-row"><span className="turn-report-label">Bench</span><span>+{report.bench}</span></div>
              ) : (
                <>
                  <div className="turn-report-row"><span className="turn-report-label">Die</span><span>1d{report.sides}</span></div>
                  <div className="turn-report-row">
                    <span className="turn-report-label">Rolled</span>
                    <span>{report.mode && report.dieOther != null ? `${report.die} (rolled twice: ${report.die}, ${report.dieOther} — kept ${report.mode < 0 ? 'lower' : 'higher'})` : report.die}</span>
                  </div>
                  <div className="turn-report-row"><span className="turn-report-label">Bonuses</span><span>+{report.mod}</span></div>
                  <div className="turn-report-row"><span className="turn-report-label">Total</span><span>{report.total}</span></div>
                </>
              )}
              {turn.log.filter((e) => e.stepIndex === turn.stepIndex - 1 && e.tag !== 'resolution' && e.tag !== 'pregame').slice().reverse().map((e, i) => (
                <div key={i} className="turn-outcome-strip" style={{ fontSize: 13, padding: '8px 10px' }}>{e.text}</div>
              ))}
            </div>
          );
        })()}

        {myTurnToAct && (
          <>
            {myOptions.length === 0 && <div className="turn-waiting">No card to play this roll.</div>}
            {myOptions.map((c) => {
              const isPicking = targetPickerCardId === c.id;
              const targetTeam = c.target === 'self' ? myTeam : otherTeam;
              const targetIds = targetTeam === teamA ? turn.idsA : turn.idsB;
              const targetPlayers = targetIds.map((id) => targetTeam.hand.find((p) => p.id === id)).filter(Boolean);
              return (
                <div key={c.id}>
                  <button
                    className="turn-action-btn"
                    onClick={() => {
                      if (c.targetsPlayer) { setTargetPickerCardId(isPicking ? null : c.id); return; }
                      advance({ cardId: c.id });
                    }}
                  >
                    <span className="turn-action-name">{c.name}{c.rarity ? ` · ${c.rarity}` : ''}</span>
                    {c.description && <span>{c.description} · </span>}
                    {c.targetsPlayer ? `Choose a target on ${targetTeam.name}` : `Play on ${targetTeam.name}`}
                  </button>
                  {isPicking && (
                    <div style={{ marginBottom: 8 }}>
                      {targetPlayers.flatMap((oc) => (c.effectType === 'PLAYER_STAT_MOD' ? PLAYER_STATS : [null]).map((stat) => (
                        <button
                          key={`${oc.id}-${stat}`}
                          className="turn-action-btn"
                          onClick={() => { advance({ cardId: c.id, targetId: oc.id, stat }); setTargetPickerCardId(null); }}
                        >
                          {oc.position} · {oc.archetype}{stat ? ` · ${stat} (${oc.stats[stat]})` : ''}
                        </button>
                      )))}
                    </div>
                  )}
                </div>
              );
            })}
            <button className="turn-pass-btn" onClick={() => advance({ pass: true })}>Pass</button>
          </>
        )}

        {myTurnToReact && (
          <>
            <div className="turn-stage-sub">{actingTeam.name} played {cur.actionCard ? cur.actionCard.name : ''} on you.</div>
            {myIP ? (
              <>
                <button className="turn-primary-btn" style={{ marginBottom: 8 }} onClick={() => advance({ reacts: true })}>
                  Play Injury Prevention (value {myIP.value})
                </button>
                <button className="turn-pass-btn" onClick={() => advance({ reacts: false })}>Take it</button>
              </>
            ) : (
              <button className="turn-primary-btn" onClick={() => advance({ reacts: false })}>Continue</button>
            )}
          </>
        )}

        {waitingOnOpponent && (
          <div className="turn-waiting">Waiting for {(turn.stage === 'action' ? actingTeam : otherTeam).name}…</div>
        )}

        {!myTurnToAct && !myTurnToReact && !waitingOnOpponent && (
          <button className="turn-primary-btn" onClick={() => advance()}>
            {turn.stage === 'coinflip' ? 'Flip Coin' : turn.stage === 'roll' ? `Roll for ${KIND_LABEL[cur.kind]}` : 'Continue'}
          </button>
        )}
      </div>

      {turn.log.length > 0 && (
        <div className="turn-log">
          <div className="turn-log-header">Game Log</div>
          {turn.log.map((n, i) => (
            <div key={i} className={`turn-log-entry tag-${n.tag}`}>{n.text}</div>
          ))}
        </div>
      )}
    </div>
  );
}
