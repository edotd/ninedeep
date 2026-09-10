import { ARCHETYPES, POSITIONS, POSITION_MOD, TIERS, COACH_ARCHETYPES, COACH_MODIFIERS, FANBASE_TYPES, MATCHUP_MODIFIER_TYPES } from '../game/constants';
import { formatCoins } from '../game/economy';

function archetypeStatRange(archetype, stat) {
  const values = POSITIONS.map((p) => archetype.base[stat] + POSITION_MOD[p][stat]);
  return [Math.min(...values), Math.max(...values)];
}

const STAT_NAMES = { SCO: 'Scoring', PLM: 'Playmaking', REB: 'Rebounding', DEF: 'Defense' };

function GlossaryStat({ label, val }) {
  return <div className="meta-cell"><b>{val}</b><span>{label}</span></div>;
}

export default function GlossaryScreen({ state, actions }) {
  const injuryPct = Math.round(state.settings.injuryChance * 100);
  return (
    <>
      <div className="screen">
        <h1>Glossary</h1>
        <p className="lede">Base stats shown are before position adjustment and tier multiplier. Each stat gets a small ±1 roll applied after the tier bonus, so the tier's effect always comes through. Coach bonuses and Hall of Fame's die size are rolled fresh within their range each time the card is pulled. Coach, Fanbase, and Market are pulled once and kept for the whole era.</p>
        <p className="lede">Every 9-card hand splits into 5 starters and 4 bench players. There is no draft — hands are dealt automatically once your Coach, Fanbase, and Market cards are set.</p>
        <p className="lede">Before every playoff matchup, each team has a small independent chance ({injuryPct}%, adjustable in Settings) that a random active player is injured for that game. A same-position bench card subs in automatically if you have one; otherwise the team plays that matchup one player short.</p>
        <p className="lede">Each team's 4 bench players also contribute directly to that matchup's score — their combined stat total (scaled down, same as the Offense/Defense modifiers) is added on top of the dice roll. A deep bench is worth points even when it isn't on the floor.</p>

        <h2>How Matchup Scoring Works</h2>
        <p className="lede">Every playoff matchup comes down to one number per team: the higher score wins (an exact tie is a coin flip). Each side's score is built from four pieces:</p>
        <div className="matchup-box">
          <div className="matchup-title">🏀 Offense</div>
          <p className="lede" style={{ margin: '0 0 8px' }}>Offense Die + Offense Modifier</p>
          <div className="statusline">Modifier = round((Scoring + Playmaking of your active five) × (1 + Coach Off Bonus) ÷ 20)</div>
        </div>
        <div className="matchup-box">
          <div className="matchup-title">🛡️ Defense</div>
          <p className="lede" style={{ margin: '0 0 8px' }}>Defense Die + Defense Modifier</p>
          <div className="statusline">Modifier = round((Defense + Rebounding of your active five) × (1 + Coach Def Bonus) ÷ 20)</div>
        </div>
        <div className="matchup-box">
          <div className="matchup-title">🪑 Bench</div>
          <p className="lede" style={{ margin: '0 0 8px' }}>round(combined stat total of your 4 bench players ÷ 20) — added flat, no dice involved. Team Chemistry boosts this 50%.</p>
        </div>
        <div className="matchup-box">
          <div className="matchup-title">Total Score</div>
          <p className="lede" style={{ margin: 0 }}>Offense Total + Defense Total + Bench Score + League Modifier (from a played Divine Intervention card, if any).</p>
        </div>
        <p className="lede">Die size (d6 by default) and the Off/Def bonus percentages all come from your Coach card — a bigger die and higher bonus mean a stronger, swingier team. The Die Hard fanbase ability, if used, rolls each die twice and keeps the higher result. Matchup Modifier cards (see below) can shift these numbers up or down before the roll, and a {injuryPct}% independent injury chance per team can pull a random active player out beforehand.</p>

        <h2>Archetypes</h2>
        <p className="lede">Ranges below show how each archetype's stats shift by position (Guard/Forward/Big) before any tier multiplier or the final ±1 roll are applied.</p>
        {Object.entries(ARCHETYPES).map(([name, a]) => {
          const ranges = {
            SCO: archetypeStatRange(a, 'SCO'),
            PLM: archetypeStatRange(a, 'PLM'),
            REB: archetypeStatRange(a, 'REB'),
            DEF: archetypeStatRange(a, 'DEF'),
          };
          const peakStyle = { color: 'var(--good)' };
          return (
            <div key={name} className="matchup-box">
              <div className="matchup-title">{name} <span style={{ color: 'var(--muted)' }}>— peak stat: {a.peak}</span></div>
              <div className="stat-grid">
                <div className="stat"><b style={a.peak === 'SCO' ? peakStyle : undefined}>{ranges.SCO[0]}–{ranges.SCO[1]}</b><span>Scoring</span></div>
                <div className="stat"><b style={a.peak === 'PLM' ? peakStyle : undefined}>{ranges.PLM[0]}–{ranges.PLM[1]}</b><span>Playmaking</span></div>
                <div className="stat"><b style={a.peak === 'REB' ? peakStyle : undefined}>{ranges.REB[0]}–{ranges.REB[1]}</b><span>Rebounding</span></div>
                <div className="stat"><b style={a.peak === 'DEF' ? peakStyle : undefined}>{ranges.DEF[0]}–{ranges.DEF[1]}</b><span>Defense</span></div>
              </div>
            </div>
          );
        })}

        <h2>Player Modifiers</h2>
        {TIERS.map((t) => {
          const contractMin = Math.max(1, t.contract - 1), contractMax = t.contract + 1;
          return (
            <div key={t.name} className="matchup-box">
              <div className="matchup-title">{t.name}</div>
              <div className="meta-row" style={{ borderTop: 'none', paddingTop: 0 }}>
                <GlossaryStat label="Uniform" val={'x' + t.uniform.toFixed(2)} />
                <GlossaryStat label="Peak Stat" val={'x' + t.peak.toFixed(2)} />
                <GlossaryStat label="Contract" val={`${contractMin}–${contractMax} Turns`} />
                <GlossaryStat label="In Pool" val={t.count} />
              </div>
              {t.forceStat && <div className="statusline" style={{ marginTop: 8 }}>Always boosts: {STAT_NAMES[t.forceStat]} (regardless of archetype)</div>}
              {t.allowedPositions && <div className="statusline" style={{ marginTop: 4 }}>Only appears at: {t.allowedPositions.join(', ')}</div>}
              <div className="statusline" style={{ marginTop: 4 }}>A shorter-than-typical roll costs more per season; a longer roll costs less.</div>
            </div>
          );
        })}

        <h2>Coach Archetypes</h2>
        {Object.entries(COACH_ARCHETYPES).map(([name, a]) => (
          <div key={name} className="matchup-box">
            <div className="matchup-title">{name}</div>
            <div className="meta-row" style={{ borderTop: 'none', paddingTop: 0 }}>
              <GlossaryStat label="Base Off" val={a.offBase + '%'} />
              <GlossaryStat label="Base Def" val={a.defBase + '%'} />
            </div>
          </div>
        ))}

        <h2>Coach Modifiers</h2>
        {COACH_MODIFIERS.map((m) => (
          <div key={m.name} className="matchup-box">
            <div className="matchup-title">{m.name}</div>
            <div className="meta-row" style={{ borderTop: 'none', paddingTop: 0 }}>
              <GlossaryStat label="Multiplier" val={'x' + m.mult.toFixed(2)} />
              <GlossaryStat label="Die" val={m.hofDie ? 'd6–d9' : 'd' + m.die} />
              <GlossaryStat label="Salary" val={formatCoins(m.salary)} />
            </div>
            {m.ability && <div className="statusline" style={{ marginTop: 8 }}>Ability: {m.ability}</div>}
          </div>
        ))}

        <h2>Fanbase</h2>
        <p className="lede">Attendance drifts ±1-2% each season based on how your average playoff score compares to the league. It applies a small multiplier to your cap (0.9x–1.1x). Die Hard downgrades to Invested if your team scores below league average for the season.</p>
        {FANBASE_TYPES.map((f) => (
          <div key={f.name} className="matchup-box">
            <div className="matchup-title">{f.name}</div>
            <div className="meta-row" style={{ borderTop: 'none', paddingTop: 0 }}>
              <GlossaryStat label="Base Attendance" val={Math.round(f.attendanceBase * 100) + '%'} />
              <GlossaryStat label="Draw Odds" val={f.weight + 'w'} />
            </div>
            {f.ability && <div className="statusline" style={{ marginTop: 8 }}>Ability: {f.ability}</div>}
          </div>
        ))}

        <h2>Matchup Modifier Cards</h2>
        <p className="lede">Every team pulls one card each season, right after the Front Office pull. It stays for the whole season — it can't be traded or returned — and a new one is dealt next season.</p>
        {MATCHUP_MODIFIER_TYPES.map((t) => {
          const catColor = t.category === 'debuff' ? 'var(--bad)' : 'var(--good)';
          let roleNote;
          if (t.reactive) roleNote = "Reactive — its holder decides whether to hold it ready before a matchup; if targeted by an Injury card while ready, it blocks the removal (when its value clears the Injury's).";
          else if (t.passive === 'bench') roleNote = 'Passive — boosts bench score all season.';
          else if (t.passive === 'seeding') roleNote = 'Passive — boosts seeding roll this season.';
          else roleNote = 'Playable — choose when to use it against an opponent.';
          return (
            <div key={t.name} className="matchup-box">
              <div className="matchup-title" style={{ color: catColor }}>{t.name}</div>
              <p className="lede" style={{ margin: '8px 0' }}>{t.flavor}</p>
              <div className="meta-row" style={{ borderTop: 'none', paddingTop: 0 }}>
                <GlossaryStat label="Draw Odds" val={t.weight + 'w'} />
                {t.needsValue && <GlossaryStat label="Value" val={`1–${t.valueDie || 10}`} />}
              </div>
              <div className="statusline" style={{ marginTop: 4 }}>{roleNote}</div>
            </div>
          );
        })}
      </div>
      <div className="bottombar">
        <button className="primary" onClick={actions.closeGlossary}>Back</button>
      </div>
    </>
  );
}
