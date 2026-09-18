// A matchup roll is narrated as an ordered list of events — advantage declarations,
// injuries, card plays, each team's dice rolls, bench, then the final total. `revealIndex`
// (how many events have played out so far) drives both the score-cell reveal in each
// MatchupRow and the Action Log below it, so the two stay in lockstep.
export function buildMatchEvents(m) {
  const events = [];
  if (m.hcaA) events.push({ kind: 'hca', team: 'a' });
  if (m.hcaB) events.push({ kind: 'hca', team: 'b' });
  if (m.advA) events.push({ kind: 'advantage', team: 'a' });
  if (m.advB) events.push({ kind: 'advantage', team: 'b' });
  if (m.injA && m.injA.out) events.push({ kind: 'injury', team: 'a' });
  if (m.injB && m.injB.out) events.push({ kind: 'injury', team: 'b' });
  (m.cardNotes || []).forEach((note) => events.push({ kind: 'card', note }));
  events.push({ kind: 'roll', team: 'a', stat: 'off' });
  events.push({ kind: 'roll', team: 'b', stat: 'off' });
  events.push({ kind: 'roll', team: 'a', stat: 'def' });
  events.push({ kind: 'roll', team: 'b', stat: 'def' });
  events.push({ kind: 'bench', team: 'a' });
  events.push({ kind: 'bench', team: 'b' });
  events.push({ kind: 'total' });
  return events;
}

function dieText(roll, sides) {
  return '🎲 ' + roll + ` 1d${sides}`;
}

function eventLogEntry(m, ev) {
  if (ev.kind === 'hca') {
    const team = ev.team === 'a' ? m.a : m.b;
    return { icon: '🏟️', text: `${team.name} has Home Court Advantage this matchup — +1% Offense, +1% Defense.`, highlight: team.name };
  }
  if (ev.kind === 'advantage') {
    const team = ev.team === 'a' ? m.a : m.b;
    return { icon: '⚡', text: `${team.name} rolls with Advantage this matchup — best of two on each die.`, highlight: team.name };
  }
  if (ev.kind === 'injury') {
    const team = ev.team === 'a' ? m.a : m.b;
    const inj = ev.team === 'a' ? m.injA : m.injB;
    const subText = inj.sub ? `${inj.sub.archetype} subs in` : 'no bench coverage, playing shorthanded';
    return { icon: '⚠', text: `${team.name}: ${inj.out.archetype} (${inj.out.position}) is injured — ${subText}.`, highlight: team.name };
  }
  if (ev.kind === 'card') {
    return { icon: '🃏', text: ev.note.text, highlight: ev.note.cardName };
  }
  if (ev.kind === 'roll') {
    const team = ev.team === 'a' ? m.a : m.b;
    const off = ev.stat === 'off';
    const die = ev.team === 'a' ? (off ? m.aOffDie : m.aDefDie) : (off ? m.bOffDie : m.bDefDie);
    const sides = ev.team === 'a' ? (off ? m.aOffSides : m.aDefSides) : (off ? m.bOffSides : m.bDefSides);
    const mod = ev.team === 'a' ? (off ? m.aOffMod : m.aDefMod) : (off ? m.bOffMod : m.bDefMod);
    const label = off ? 'Offense' : 'Defense';
    return { icon: '🎲', text: `${team.name} rolls ${dieText(die, sides)} on ${label} — +${mod} = ${die + mod}.`, highlight: team.name };
  }
  if (ev.kind === 'bench') {
    const team = ev.team === 'a' ? m.a : m.b;
    const bench = ev.team === 'a' ? m.aBench : m.bBench;
    return { icon: '🪑', text: `Bench contributes +${bench} for ${team.name}.`, highlight: team.name };
  }
  // total
  return { icon: '🏆', text: `Final: ${m.a.name} ${m.aSum} — ${m.bSum} ${m.b.name}. ${m.winner.name} wins!`, highlight: m.winner.name };
}

function bonusBullets(extra) {
  if (!extra) return [];
  const list = [];
  if (extra.offDelta > 0) list.push(`+${extra.offDelta} Offense`);
  if (extra.defDelta > 0) list.push(`+${extra.defDelta} Defense`);
  if (extra.leagueMod > 0) list.push(`+${extra.leagueMod} League Modifier`);
  return list;
}

function MatchupRow({ m, side, name, isWinner, advantage, extra, showOff, showDef, showBench, showTotal }) {
  const bonuses = bonusBullets(extra);
  return (
    <div className={'dice-row' + (isWinner && showTotal ? ' winner' : '')} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1 }}>
          <div className="dice-name">
            {name}{advantage && <span className="tier-pill" style={{ marginLeft: 6 }}>Advantage</span>}
          </div>
          {bonuses.length > 0 && (
            <ul className="bonus-bullets">
              {bonuses.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          )}
        </div>
        <div className="dice-cell">
          <div className="roll-line">
            {showOff ? <span className="die-val">{dieText(side.OffDie, side.OffSides)}</span> : <span className="die-val dice-rolling">🎲</span>}
            {showOff && <span className="mod-val">+{side.OffMod}</span>}
          </div>
          <span>🏀 Offense</span>
        </div>
        <div className="dice-cell">
          <div className="roll-line">
            {showDef ? <span className="die-val">{dieText(side.DefDie, side.DefSides)}</span> : <span className="die-val dice-rolling">🎲</span>}
            {showDef && <span className="mod-val">+{side.DefMod}</span>}
          </div>
          <span>🛡️ Defense</span>
        </div>
        <div className="dice-cell">
          <div className="roll-line">{showBench && <span className="mod-val">+{side.Bench}</span>}</div>
          <span>🪑 Bench</span>
        </div>
        <div className="dice-cell total">
          {showTotal ? <b>= {side.Sum}</b> : <b style={{ opacity: 0.3 }}>= —</b>}
          <span>Score{showTotal && side.LeagueMod ? ` (+${side.LeagueMod} League)` : ''}</span>
        </div>
      </div>
    </div>
  );
}

export default function MatchupBox({ title, m, revealIndex = Infinity, onSkip }) {
  const events = buildMatchEvents(m);
  const shown = Math.min(revealIndex, events.length);
  const isDone = shown >= events.length;

  const idxOf = (pred) => events.findIndex(pred);
  const aOffIdx = idxOf((e) => e.kind === 'roll' && e.team === 'a' && e.stat === 'off');
  const bOffIdx = idxOf((e) => e.kind === 'roll' && e.team === 'b' && e.stat === 'off');
  const aDefIdx = idxOf((e) => e.kind === 'roll' && e.team === 'a' && e.stat === 'def');
  const bDefIdx = idxOf((e) => e.kind === 'roll' && e.team === 'b' && e.stat === 'def');
  const aBenchIdx = idxOf((e) => e.kind === 'bench' && e.team === 'a');
  const bBenchIdx = idxOf((e) => e.kind === 'bench' && e.team === 'b');
  const totalIdx = idxOf((e) => e.kind === 'total');

  const logEntries = events.slice(0, shown).map((ev) => eventLogEntry(m, ev));

  return (
    <div className="matchup-box">
      <div className="matchup-title">{title}</div>
      <MatchupRow
        m={m} name={m.a.name} isWinner={m.winner === m.a} advantage={m.advA} extra={m.aExtra}
        side={{ OffDie: m.aOffDie, OffMod: m.aOffMod, OffSides: m.aOffSides, DefDie: m.aDefDie, DefMod: m.aDefMod, DefSides: m.aDefSides, Bench: m.aBench, LeagueMod: m.aLeagueMod, Sum: m.aSum }}
        showOff={shown > aOffIdx} showDef={shown > aDefIdx} showBench={shown > aBenchIdx} showTotal={shown > totalIdx}
      />
      <MatchupRow
        m={m} name={m.b.name} isWinner={m.winner === m.b} advantage={m.advB} extra={m.bExtra}
        side={{ OffDie: m.bOffDie, OffMod: m.bOffMod, OffSides: m.bOffSides, DefDie: m.bDefDie, DefMod: m.bDefMod, DefSides: m.bDefSides, Bench: m.bBench, LeagueMod: m.bLeagueMod, Sum: m.bSum }}
        showOff={shown > bOffIdx} showDef={shown > bDefIdx} showBench={shown > bBenchIdx} showTotal={shown > totalIdx}
      />
      {logEntries.length > 0 && (
        <div className="card-log">
          <div className="card-log-header">
            <span>Action Log</span>
            {!isDone && onSkip && <button className="reset-link" onClick={onSkip}>Skip ▸▸</button>}
          </div>
          {logEntries.map((n, i) => {
            const idx = n.highlight ? n.text.indexOf(n.highlight) : -1;
            const before = idx >= 0 ? n.text.slice(0, idx) : n.text;
            const after = idx >= 0 ? n.text.slice(idx + n.highlight.length) : '';
            return (
              <div key={i} className="card-log-entry">
                <span className="card-log-bullet">{n.icon}</span>
                <span>{before}{idx >= 0 && <span className="card-log-name">{n.highlight}</span>}{after}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
