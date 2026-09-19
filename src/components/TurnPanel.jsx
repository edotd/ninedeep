import { useEffect, useState } from 'react';
import { playableCards } from '../game/matchup';
import { PLAYER_STATS, eligibleStatTargets } from '../game/supplementalEffects';
import { cardTier, jerseyNumber } from '../game/cards';

// Decision clock for a blind matchup-card choice — long enough to read your hand, short
// enough to put real pressure on the pick. Auto-passes on timeout so a stalled player can't
// freeze the match for their opponent.
const CARD_TIMER_SECONDS = 8;

// Every sub-stage the engine (game/turn.js) can be in, in order, each tagged with which
// numbered rail item it belongs to — drives both the "STAGE n / total" counter and which rail
// row is highlighted. coinflip/coinflipped share rail item 1 (the coin only "advances" once,
// from the player's point of view, even though the engine models the flip and its reveal as
// two stages); 'card' appears twice per exchange (offense's window, then defense's).
const STAGE_ORDER = ['coinflip', 'coinflipped', 'card-offense-0', 'card-defense-0', 'resolved-0', 'card-offense-1', 'card-defense-1', 'resolved-1', 'bench'];

function stageKey(turn) {
  if (turn.stage === 'card') return `card-${turn.current.role}-${turn.exchangeIndex}`;
  if (turn.stage === 'resolved') return `resolved-${turn.exchangeIndex}`;
  return turn.stage;
}

function stageNumber(turn) {
  const idx = STAGE_ORDER.indexOf(stageKey(turn));
  // coinflip and coinflipped both read as stage 1.
  return Math.max(1, idx === 0 ? 1 : idx);
}

const RAIL_ITEMS = [
  { num: '01', label: 'Coin Flip', meta: '' },
  { num: '02', label: 'Exchange 1', meta: '3 stages' },
  { num: '03', label: 'Exchange 2', meta: '3 stages' },
  { num: '04', label: 'Bench', meta: '1 stage' },
];

function PlayerChip({ card }) {
  if (!card) return <div className="t2-chip t2-chip-player empty" />;
  const tier = cardTier(card);
  return (
    <div className={`t2-chip t2-chip-player tier-${tier.toLowerCase()}`}>
      <div className="t2-chip-number">{jerseyNumber(card)}</div>
      <div className="t2-chip-position">{card.position[0]}</div>
    </div>
  );
}

// Face-down until the card has actually been played (card.used) — never the moment a team is
// mid-decision, so a live human opponent's blind pick can't be read off this strip before it
// resolves. Once used it flips face-up for the rest of the match — this strip is meant to
// persist across every stage, so a card revealed in Exchange 1 stays revealed through Bench.
function MatchupChip({ card }) {
  if (!card) return <div className="t2-chip t2-chip-matchup empty" />;
  if (!card.used) return <div className="t2-chip t2-chip-matchup facedown">?</div>;
  return <div className="t2-chip t2-chip-matchup used">{card.name}</div>;
}

function chipSlots(cards, count) {
  return Array.from({ length: count }, (_, i) => cards[i] || null);
}

// One team's persistent card strip — Offense/Defense (the same active five under both, since
// both rolls draw on it), Bench, and Matchup rows. Rendered above and below the stage body so
// both rosters stay visible through the whole turn, not just at tip-off; the row matching this
// team's role for the *current* exchange is highlighted.
function TeamStrip({ team, ids, activeRole }) {
  const hand = team.hand || [];
  const activeIds = ids || team.activeIds || [];
  const starters = activeIds.map((id) => hand.find((c) => c.id === id)).filter(Boolean);
  const bench = hand.filter((c) => !activeIds.includes(c.id));
  const matchupCards = team.matchupCards || [];
  return (
    <div className="t2-teamstrip">
      <div className="t2-teamstrip-name">{team.name}</div>
      <div className="t2-teamstrip-rows">
        <div className={'t2-teamstrip-row' + (activeRole === 'offense' ? ' active-role' : '')}>
          <span className="t2-teamstrip-label">Offense</span>
          <div className="t2-teamstrip-chips">{chipSlots(starters, 5).map((c, i) => <PlayerChip key={i} card={c} />)}</div>
        </div>
        <div className={'t2-teamstrip-row' + (activeRole === 'defense' ? ' active-role' : '')}>
          <span className="t2-teamstrip-label">Defense</span>
          <div className="t2-teamstrip-chips">{chipSlots(starters, 5).map((c, i) => <PlayerChip key={i} card={c} />)}</div>
        </div>
        <div className="t2-teamstrip-row">
          <span className="t2-teamstrip-label">Bench</span>
          <div className="t2-teamstrip-chips">{chipSlots(bench, 4).map((c, i) => <PlayerChip key={i} card={c} />)}</div>
        </div>
        <div className="t2-teamstrip-row">
          <span className="t2-teamstrip-label">Matchup</span>
          <div className="t2-teamstrip-chips">{chipSlots(matchupCards, 3).map((c, i) => <MatchupChip key={i} card={c} />)}</div>
        </div>
      </div>
    </div>
  );
}

function railStatusFor(index, turn) {
  const inCoin = turn.stage === 'coinflip' || turn.stage === 'coinflipped';
  const inEx1 = turn.exchangeIndex === 0 && (turn.stage === 'card' || turn.stage === 'resolved');
  const inEx2 = turn.exchangeIndex === 1 && (turn.stage === 'card' || turn.stage === 'resolved');
  const inBench = turn.stage === 'bench';
  if (index === 0) return inCoin ? 'active' : 'done';
  if (index === 1) return inEx1 ? 'active' : inCoin ? 'pending' : 'done';
  if (index === 2) return inEx2 ? 'active' : inCoin || inEx1 ? 'pending' : 'done';
  return inBench ? 'active' : inCoin || inEx1 || inEx2 ? 'pending' : 'done';
}

// Drives one turn (coin flip, then two offense/defense exchanges, then bench) stage by stage —
// see game/turn.js for the state machine this renders. Stays mounted until m.turn.stage
// becomes 'complete', at which point m.result exists and PlayoffSeriesScreen swaps back to
// the existing MatchupBox reveal. Laid out per the "Nine Deep Match Flow" design's 2C screen:
// a header naming both clubs and who has possession, a turn-sequence rail, a stage panel, and
// a game log — collapsing to one column below the desktop breakpoint.
export default function TurnPanel({ state, actions, m, myTeamId }) {
  const turn = m.turn;
  const teamA = m.a, teamB = m.b;
  const myTeam = state.teams[myTeamId];
  const humanInMatch = teamA === myTeam || teamB === myTeam;
  const [targetPickerCardId, setTargetPickerCardId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(CARD_TIMER_SECONDS);

  const cur = turn.current;
  const actingTeam = cur ? (cur.team === 'a' ? teamA : teamB) : null;
  const offenseTeam = turn.offenseSide ? (turn.offenseSide === 'a' ? teamA : teamB) : null;
  const defenseTeam = turn.defenseSide ? (turn.defenseSide === 'a' ? teamA : teamB) : null;
  // Possession is decided the instant the coin lands (turn.order[0]) — offenseSide isn't set
  // until startExchange runs one stage later, so the header/result badge fall back to the
  // coin-flip winner directly instead of showing blank between 'coinflipped' and 'card'.
  const possessionTeam = offenseTeam || (turn.order ? turn.order[0] : null);

  const myTurnToAct = turn.stage === 'card' && humanInMatch && actingTeam === myTeam;
  // Only a live human opponent (online play) has nothing to prompt here — an AI's card choice
  // still needs this client to call advanceTurn() to actually process it, so that case falls
  // through to the generic Advance button instead of stalling on a wait message.
  const waitingOnOpponent = turn.stage === 'card' && humanInMatch && actingTeam !== myTeam && actingTeam.human;

  const advance = (payload) => actions.advanceTurn(payload);

  useEffect(() => {
    setTargetPickerCardId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn.exchangeIndex, cur?.team, cur?.role, turn.stage]);

  useEffect(() => {
    if (!myTurnToAct) { setTimeLeft(CARD_TIMER_SECONDS); return undefined; }
    setTimeLeft(CARD_TIMER_SECONDS);
    const start = Date.now();
    const iv = setInterval(() => {
      const remaining = CARD_TIMER_SECONDS - (Date.now() - start) / 1000;
      if (remaining <= 0) {
        clearInterval(iv);
        setTimeLeft(0);
        advance({ pass: true });
      } else {
        setTimeLeft(remaining);
      }
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTurnToAct, turn.exchangeIndex, cur?.team, cur?.role]);

  const myOptions = myTurnToAct ? playableCards(myTeam) : [];

  // Blind by convention: never surface an in-progress exchange's card-play log entries — only
  // entries from an already-resolved exchange (or the finished match) are shown, so a human
  // waiting on their own pick can't read what the opponent just locked in.
  const visibleLog = turn.log.filter((e) => e.stepIndex < turn.exchangeIndex || turn.stage === 'resolved' || turn.stage === 'bench');

  const stageBarLabel = turn.stage === 'coinflip' || turn.stage === 'coinflipped'
    ? 'Coin Flip'
    : turn.stage === 'card'
      ? `Exchange ${turn.exchangeIndex + 1} — ${cur.role === 'offense' ? 'Offense' : 'Defense'} Card`
      : turn.stage === 'resolved'
        ? `Exchange ${turn.exchangeIndex + 1} Result`
        : 'Bench';

  const advanceLabel = turn.stage === 'coinflip' ? 'Flip Coin' : 'Continue';
  const showGenericAdvance = (turn.stage !== 'card') || (!myTurnToAct && !waitingOnOpponent);

  return (
    <div className="t2-shell">
      <div className="t2-header">
        <div className="t2-header-team">
          <span className="t2-header-team-name">{teamA.name}</span>
          <span className="t2-header-team-tag">User A</span>
        </div>
        <div className="t2-header-possession">
          <span className="t2-header-possession-label">Possession</span>
          <span className="t2-header-possession-badge">
            {possessionTeam ? possessionTeam.name : 'Pending'}
          </span>
        </div>
        <div className="t2-header-team right">
          <span className="t2-header-team-tag">User B</span>
          <span className="t2-header-team-name">{teamB.name}</span>
        </div>
      </div>

      <div className="t2-body">
        <div className="t2-rail">
          <div className="t2-rail-heading">Turn Sequence</div>
          {RAIL_ITEMS.map((item, i) => {
            const status = railStatusFor(i, turn);
            return (
              <div key={item.num} className={`t2-rail-item ${status}`}>
                <span className="t2-rail-num">{item.num}</span>
                <span className="t2-rail-label">{item.label}</span>
                <span className="t2-rail-meta">{status === 'active' ? 'Active' : item.meta}</span>
              </div>
            );
          })}
          <div className="t2-rail-note">
            Each exchange is one team on offense against the other on defense — both lock in a
            matchup card blind, then roll. Bench resolves straight from each team's roster, no
            cards involved.
          </div>
        </div>

        <div className="t2-stage">
          <TeamStrip team={teamA} ids={turn.idsA} activeRole={turn.offenseSide === 'a' ? 'offense' : turn.defenseSide === 'a' ? 'defense' : null} />

          <div className="t2-stage-bar">
            <span>{stageBarLabel}</span>
            <span className="t2-stage-bar-dot" />
          </div>
          <div className="t2-stage-body">
            {(turn.stage === 'coinflip' || turn.stage === 'coinflipped') && (
              turn.order ? (
                <div className="t2-coin-row">
                  <div className="t2-coin">
                    <div className="t2-coin-face">{turn.coinFace}</div>
                    <div className="t2-coin-brand">Nine Deep</div>
                  </div>
                  <div className="t2-coin-result">
                    <div className="t2-coin-result-eyebrow">Pregame · Possession</div>
                    <div className="t2-coin-result-title">{turn.order[0].name} Wins Possession</div>
                    <div className="t2-coin-result-sub">
                      {turn.order[0].name} opens on offense for Exchange 1. Roles flip for
                      Exchange 2, so both teams get one offense possession and one defense
                      possession before Bench.
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="t2-stage-eyebrow">Pregame · Possession</div>
                  <div className="t2-stage-title">Coin Flip</div>
                  <div className="t2-stage-desc">
                    Winner opens on offense for Exchange 1; the loser opens on defense. Roles
                    flip for Exchange 2.
                  </div>
                  <div className="t2-coin-row">
                    <div className="t2-coin">
                      <div className="t2-coin-face">Toss</div>
                      <div className="t2-coin-brand">Nine Deep</div>
                    </div>
                  </div>
                </>
              )
            )}

            {turn.stage === 'card' && (
              <>
                <div className="t2-stage-eyebrow">Exchange {turn.exchangeIndex + 1} · Blind Card</div>
                <div className="t2-stage-desc">
                  {offenseTeam.name} is on offense, {defenseTeam.name} is on defense. Both teams
                  lock in a matchup card — or pass — blind, before either die is rolled.
                </div>

                {myTurnToAct && (
                  <>
                    <div className={'t2-timer' + (timeLeft <= 3 ? ' urgent' : '')}>{Math.ceil(timeLeft)}s to decide</div>
                    <div className="t2-cards">
                      {myOptions.length === 0 && <div className="t2-waiting">No card to play this possession.</div>}
                      {myOptions.map((c) => {
                        const isPicking = targetPickerCardId === c.id;
                        const targetTeam = c.target === 'self' ? myTeam : (actingTeam === teamA ? teamB : teamA);
                        const targetIds = targetTeam === teamA ? turn.idsA : turn.idsB;
                        const targetPlayers = eligibleStatTargets(targetTeam, targetIds, c);
                        return (
                          <div key={c.id}>
                            <button
                              className="t2-card-btn"
                              disabled={c.targetsPlayer && targetPlayers.length === 0}
                              onClick={() => {
                                if (c.targetsPlayer) { setTargetPickerCardId(isPicking ? null : c.id); return; }
                                advance({ cardId: c.id });
                              }}
                            >
                              <span className="t2-card-name">{c.name}{c.rarity ? ` · ${c.rarity}` : ''}</span>
                              {c.description && <span>{c.description} · </span>}
                              {c.targetsPlayer && targetPlayers.length === 0 && <span>No eligible starter · </span>}
                              {c.targetsPlayer ? `Choose a target on ${targetTeam.name}` : `Play on ${targetTeam.name}`}
                            </button>
                            {isPicking && (
                              <div style={{ marginTop: 6, marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {targetPlayers.flatMap((oc) => (c.targetsPlayer && c.effectType ? PLAYER_STATS : [null]).map((stat) => (
                                  <button
                                    key={`${oc.id}-${stat}`}
                                    className="t2-card-btn"
                                    onClick={() => { advance({ cardId: c.id, targetId: oc.id, stat }); setTargetPickerCardId(null); }}
                                  >
                                    {oc.position} · {oc.archetype}{stat ? ` · ${stat} (${oc.stats[stat]})` : ''}{c.effectType === 'CAP_HIT_STAT' ? ` · +${oc.salary}` : ''}
                                  </button>
                                )))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <button className="t2-pass-btn" onClick={() => advance({ pass: true })}>Pass</button>
                    </div>
                  </>
                )}

                {waitingOnOpponent && (
                  <div className="t2-waiting">Waiting on {actingTeam.name} to lock in a card…</div>
                )}
                {!myTurnToAct && !waitingOnOpponent && !actingTeam.human && (
                  <div className="t2-waiting">{actingTeam.name} is locking in a card.</div>
                )}
              </>
            )}

            {turn.stage === 'resolved' && (() => {
              const offSide = turn.offenseSide, defSide = turn.defenseSide;
              const offTeam = offSide === 'a' ? teamA : teamB;
              const defTeam = defSide === 'a' ? teamA : teamB;
              const offDie = turn[`${offSide}OffDie`], offSides = turn[`${offSide}OffSides`], offTotal = turn[`${offSide}OffTotal`], offWon = turn[`${offSide}OffWon`];
              const defDie = turn[`${defSide}DefDie`], defSides = turn[`${defSide}DefSides`], defTotal = turn[`${defSide}DefTotal`];
              return (
                <>
                  <div className="t2-stage-eyebrow">Exchange {turn.exchangeIndex + 1} · Result</div>
                  <div className="t2-report">
                    <div className="t2-report-row"><span className="t2-report-label">{offTeam.name} rolls (Offense)</span><span>{offDie} / 1d{offSides}</span></div>
                    <div className="t2-report-row"><span className="t2-report-label">{defTeam.name} rolls (Defense)</span><span>{defDie} / 1d{defSides}</span></div>
                    <div className="t2-report-row"><span className="t2-report-label">Possession</span><span>{offWon ? `${offTeam.name} wins` : `${defTeam.name} wins`}</span></div>
                    <div className="t2-report-row"><span className="t2-report-label">{offTeam.name} Offense</span><span>+{offTotal}{!offWon ? ' (reduced)' : ''}</span></div>
                    <div className="t2-report-row"><span className="t2-report-label">{defTeam.name} Defense</span><span>+{defTotal}</span></div>
                  </div>
                </>
              );
            })()}

            {turn.stage === 'bench' && (
              <>
                <div className="t2-stage-eyebrow">Bench · No Cards</div>
                <div className="t2-report">
                  <div className="t2-report-row"><span className="t2-report-label">{teamA.name} Bench</span><span>+{turn.aBench}</span></div>
                  <div className="t2-report-row"><span className="t2-report-label">{teamB.name} Bench</span><span>+{turn.bBench}</span></div>
                </div>
              </>
            )}
          </div>

          <div className="t2-stage-footer">
            <button className="t2-restart-btn" onClick={() => actions.beginTurn()}>Restart Turn</button>
            <span className="t2-stage-counter">Stage {stageNumber(turn)} / {STAGE_ORDER.length - 1}</span>
            {showGenericAdvance && (
              <button className="t2-advance-btn" onClick={() => advance()}>{advanceLabel}</button>
            )}
          </div>

          <TeamStrip team={teamB} ids={turn.idsB} activeRole={turn.offenseSide === 'b' ? 'offense' : turn.defenseSide === 'b' ? 'defense' : null} />
        </div>

        <div className="t2-log">
          <div className="t2-log-heading">Game Log</div>
          <div className="t2-log-body">
            {visibleLog.map((n, i) => (
              <div key={i} className="t2-log-entry">
                <span className="t2-log-entry-tag">{n.tag}</span>
                {n.text}
              </div>
            ))}
          </div>
          <div className="t2-log-footer">Every roll is filed. The log is the receipt a season recap is built from.</div>
        </div>
      </div>
    </div>
  );
}
