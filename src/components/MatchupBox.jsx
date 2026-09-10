function dieText(roll, sides) {
  return '🎲 ' + roll + (sides !== 6 ? ` d${sides}` : '');
}

function MatchupRow({ side, name, isWinner, advantage, injury }) {
  return (
    <div className={'dice-row' + (isWinner ? ' winner' : '')} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div className="dice-name" style={{ flex: 1 }}>
          {name}{advantage && <span className="tier-pill" style={{ marginLeft: 6 }}>Advantage</span>}
        </div>
        <div className="dice-cell">
          <div className="roll-line"><span className="die-val">{dieText(side.OffDie, side.OffSides)}</span><span className="mod-val">+{side.OffMod}</span></div>
          <span>🏀 Offense</span>
        </div>
        <div className="dice-cell">
          <div className="roll-line"><span className="die-val">{dieText(side.DefDie, side.DefSides)}</span><span className="mod-val">+{side.DefMod}</span></div>
          <span>🛡️ Defense</span>
        </div>
        <div className="dice-cell">
          <div className="roll-line"><span className="mod-val">+{side.Bench}</span></div>
          <span>🪑 Bench</span>
        </div>
        <div className="dice-cell total"><b>= {side.Sum}</b><span>Score{side.LeagueMod ? ` (+${side.LeagueMod} League)` : ''}</span></div>
      </div>
      {injury && injury.out && (
        <div className="statusline bad" style={{ margin: '6px 0 0', fontSize: 11 }}>
          ⚠ {injury.out.archetype} ({injury.out.position}) injured
          {injury.sub ? ` — ${injury.sub.archetype} subs in` : ' — no bench coverage, playing shorthanded'}
        </div>
      )}
    </div>
  );
}

export default function MatchupBox({ title, m }) {
  return (
    <div className="matchup-box">
      <div className="matchup-title">{title}</div>
      <MatchupRow
        side={{ OffDie: m.aOffDie, OffMod: m.aOffMod, OffSides: m.aOffSides, DefDie: m.aDefDie, DefMod: m.aDefMod, DefSides: m.aDefSides, Bench: m.aBench, LeagueMod: m.aLeagueMod, Sum: m.aSum }}
        name={m.a.name} isWinner={m.winner === m.a} advantage={m.advA} injury={m.injA}
      />
      <MatchupRow
        side={{ OffDie: m.bOffDie, OffMod: m.bOffMod, OffSides: m.bOffSides, DefDie: m.bDefDie, DefMod: m.bDefMod, DefSides: m.bDefSides, Bench: m.bBench, LeagueMod: m.bLeagueMod, Sum: m.bSum }}
        name={m.b.name} isWinner={m.winner === m.b} advantage={m.advB} injury={m.injB}
      />
      {m.cardNotes && m.cardNotes.length > 0 && m.cardNotes.map((n, i) => (
        <div key={i} className="statusline bad" style={{ marginTop: 6 }}>🃏 {n}</div>
      ))}
    </div>
  );
}
