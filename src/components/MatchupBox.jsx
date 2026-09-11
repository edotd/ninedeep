// Reveal stages for the roll animation: 0 = nothing yet (dice spinning), then each stat
// category's die appears, followed a beat later by its bonus, until everything (including
// the winner highlight and card notes) is shown at FULL_REVEAL.
export const FULL_REVEAL = 6;
export const REVEAL_STAGES = {
  OFF_DIE: 1, OFF_MOD: 2, DEF_DIE: 3, DEF_MOD: 4, BENCH: 5, TOTAL: 6,
};

function dieText(roll, sides) {
  return '🎲 ' + roll + (sides !== 6 ? ` d${sides}` : '');
}

function MatchupRow({ side, name, isWinner, advantage, injury, revealStage }) {
  const showOffDie = revealStage >= REVEAL_STAGES.OFF_DIE;
  const showOffMod = revealStage >= REVEAL_STAGES.OFF_MOD;
  const showDefDie = revealStage >= REVEAL_STAGES.DEF_DIE;
  const showDefMod = revealStage >= REVEAL_STAGES.DEF_MOD;
  const showBench = revealStage >= REVEAL_STAGES.BENCH;
  const showTotal = revealStage >= REVEAL_STAGES.TOTAL;
  return (
    <div className={'dice-row' + (isWinner && showTotal ? ' winner' : '')} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div className="dice-name" style={{ flex: 1 }}>
          {name}{advantage && <span className="tier-pill" style={{ marginLeft: 6 }}>Advantage</span>}
        </div>
        <div className="dice-cell">
          <div className="roll-line">
            {showOffDie ? <span className="die-val">{dieText(side.OffDie, side.OffSides)}</span> : <span className="die-val dice-rolling">🎲</span>}
            {showOffMod && <span className="mod-val">+{side.OffMod}</span>}
          </div>
          <span>🏀 Offense</span>
        </div>
        <div className="dice-cell">
          <div className="roll-line">
            {showDefDie ? <span className="die-val">{dieText(side.DefDie, side.DefSides)}</span> : <span className="die-val dice-rolling">🎲</span>}
            {showDefMod && <span className="mod-val">+{side.DefMod}</span>}
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
      {showTotal && injury && injury.out && (
        <div className="statusline bad" style={{ margin: '6px 0 0', fontSize: 11 }}>
          ⚠ {injury.out.archetype} ({injury.out.position}) injured
          {injury.sub ? ` — ${injury.sub.archetype} subs in` : ' — no bench coverage, playing shorthanded'}
        </div>
      )}
    </div>
  );
}

export default function MatchupBox({ title, m, revealStage = FULL_REVEAL }) {
  return (
    <div className="matchup-box">
      <div className="matchup-title">{title}</div>
      <MatchupRow
        side={{ OffDie: m.aOffDie, OffMod: m.aOffMod, OffSides: m.aOffSides, DefDie: m.aDefDie, DefMod: m.aDefMod, DefSides: m.aDefSides, Bench: m.aBench, LeagueMod: m.aLeagueMod, Sum: m.aSum }}
        name={m.a.name} isWinner={m.winner === m.a} advantage={m.advA} injury={m.injA} revealStage={revealStage}
      />
      <MatchupRow
        side={{ OffDie: m.bOffDie, OffMod: m.bOffMod, OffSides: m.bOffSides, DefDie: m.bDefDie, DefMod: m.bDefMod, DefSides: m.bDefSides, Bench: m.bBench, LeagueMod: m.bLeagueMod, Sum: m.bSum }}
        name={m.b.name} isWinner={m.winner === m.b} advantage={m.advB} injury={m.injB} revealStage={revealStage}
      />
      {revealStage >= FULL_REVEAL && m.cardNotes && m.cardNotes.length > 0 && m.cardNotes.map((n, i) => (
        <div key={i} className="statusline bad" style={{ marginTop: 6 }}>🃏 {n}</div>
      ))}
    </div>
  );
}
