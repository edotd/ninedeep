import { SKILLSETS, SKILLSET_PAIRS } from '../game/skillsets';
import { ARCHETYPES, POSITIONS, POSITION_MOD, TIERS, LEAGUE_ACCOLADES, COACH_ARCHETYPES, COACH_MODIFIERS, FANBASE_ARCHETYPES, FANBASE_MODS, MARKETS, GM_TYPES, GM_BONUS_RATE, HANDS_OFF_BONUS_CAP, FIRE_GM_COST, MATCHUP_MODIFIER_TYPES } from '../game/constants';
import { formatCoins } from '../game/economy';
import { CAREER_LEVELS } from '../game/aging';
import { matchupCardEffectNote } from '../game/summaries';

function archetypeStatRange(archetype, stat) {
  const values = POSITIONS.map((p) => archetype.base[stat] + POSITION_MOD[p][stat]);
  return [Math.min(...values), Math.max(...values)];
}

const STAT_NAMES = { SCO: 'Scoring', PLM: 'Playmaking', REB: 'Rebounding', DEF: 'Defense' };
const SECTIONS = [
  ['matchup-scoring', 'How Matchup Scoring Works'],
  ['archetypes', 'Archetypes'],
  ['player-modifiers', 'Player Modifiers'],
  ['league-accolades', 'League Accolades'],
  ['aging-experience', 'Aging & Experience'],
  ['coach-archetypes', 'Coach Archetypes'],
  ['coach-modifiers', 'Coach Modifiers'],
  ['fanbase', 'Fanbase'],
  ['season-milestones', 'Season Milestones'],
  ['fanbase-mods', 'Fanbase Mods'],
  ['market', 'GM & Market Size'],
  ['front-office-moves', 'Front Office Moves'],
  ['skillsets-chemistry', 'Player Skillsets and Team Chemistry'],
  ['matchup-modifier-cards', 'Matchup Modifier Cards'],
];

function GlossaryStat({ label, val }) {
  return <div className="meta-cell"><b>{val}</b><span>{label}</span></div>;
}

function forceStatNames(t) {
  const keys = t.forceStats || (t.forceStat ? [t.forceStat] : null);
  return keys ? keys.map((k) => STAT_NAMES[k]).join(' + ') : null;
}

function TierBlock({ t }) {
  const contractMin = Math.max(1, t.contract - 1), contractMax = t.contract + 1;
  const boosts = forceStatNames(t);
  return (
    <div className="matchup-box">
      <div className="matchup-title">{t.name}</div>
      <div className="meta-row" style={{ borderTop: 'none', paddingTop: 0 }}>
        <GlossaryStat label="Base" val={'x' + t.uniform.toFixed(2)} />
        <GlossaryStat label="Peak Stat" val={'x' + t.peak.toFixed(2)} />
        <GlossaryStat label="Contract" val={`${contractMin}–${contractMax} Turns`} />
        <GlossaryStat label="In Pool" val={t.count} />
      </div>
      {boosts && <div className="statusline" style={{ marginTop: 8 }}>Always boosts: {boosts} (regardless of archetype)</div>}
      {t.allowedPositions && <div className="statusline" style={{ marginTop: 4 }}>Only appears at: {t.allowedPositions.join(', ')}</div>}
      {t.accolade && (
        <div className="statusline" style={{ marginTop: 4 }}>
          {t.primeExempt ? 'Can roll at any career stage.' : 'Only rolls on a player in the Prime career stage.'}
        </div>
      )}
      <div className="statusline" style={{ marginTop: 4 }}>A shorter-than-typical roll costs more per season; a longer roll costs less.</div>
    </div>
  );
}

export default function GlossaryScreen({ state, onBack }) {
  const injuryPct = Math.round(state.settings.injuryChance * 100);
  return (
    <>
      <div className="screen">
        <h1>Glossary</h1>
        <nav className="glossary-toc" aria-label="Glossary table of contents">
          <div className="glossary-toc-title">Contents <span>Jump to a section</span></div>
          <ol>{SECTIONS.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}</ol>
        </nav>
        <p className="lede">Base stats shown are before position adjustment and tier multiplier. Each stat gets a small ±1 roll applied after the tier bonus, so the tier's effect always comes through. Coach bonuses and Hall of Fame's die size are rolled fresh within their range each time the card is pulled. Coach, Fanbase, and GM are pulled once and kept for the whole era.</p>
        <p className="lede">Every 9-card hand splits into 5 starters and 4 bench players. The first hand is dealt automatically; later seasons include an offseason draft.</p>
        <p className="lede">Before every playoff matchup, each team has a small independent chance ({injuryPct}%, adjustable in Settings) that a random active player is injured for that game. A same-position bench card subs in automatically if you have one; otherwise the team plays that matchup one player short.</p>
        <p className="lede">Each team's 4 bench players also contribute directly to that matchup's score — their combined stat total (scaled down, same as the Offense/Defense modifiers) is added on top of the dice roll. A deep bench is worth points even when it isn't on the floor.</p>

        <h2 id="matchup-scoring">How Matchup Scoring Works</h2>
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
        <div className="matchup-box">
          <div className="matchup-title">🏟️ Home Court Advantage</div>
          <p className="lede" style={{ margin: 0 }}>The top 4 seeds get a flat +2 Offense / +2 Defense in every playoff matchup they play.</p>
        </div>

        <h2 id="archetypes">Archetypes</h2>
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

        <h2 id="player-modifiers">Player Modifiers</h2>
        <p className="lede">Base quality/trait tiers — no age restriction on who can roll them.</p>
        {TIERS.map((t) => <TierBlock key={t.name} t={t} />)}

        <h2 id="league-accolades">League Accolades</h2>
        <p className="lede">Elite, statistical-distinction tiers roll on players in the Prime career stage. Generational Talent is the exception and can appear at any stage.</p>
        {LEAGUE_ACCOLADES.map((t) => <TierBlock key={t.name} t={t} />)}

        <h2 id="aging-experience">Aging &amp; Experience</h2>
        <p className="lede">Players move through five career stages: Young, Established, Prime, Veteran, and Declining. Each stage has an output bonus or penalty that affects matchups and seeding. Printed stats stay the same.</p>
        {Object.entries(CAREER_LEVELS).map(([name, r]) => (
          <div key={name} className="matchup-box">
            <div className="matchup-title">{name}</div>
            <div className="meta-row" style={{ borderTop: 'none', paddingTop: 0 }}>
              <GlossaryStat label="Bonus Range" val={`${r.min >= 0 ? '+' : ''}${r.min.toFixed(2)} to ${r.max >= 0 ? '+' : ''}${r.max.toFixed(2)}`} />
            </div>
          </div>
        ))}
        <p className="lede">A player's career roll is fixed, so their relative place within each stage's bonus range stays consistent. Stages advance as seasons pass. Team Experience combines roster career stages, coach tenure, titles, and playoff appearances.</p>
        <div className="matchup-box">
          <div className="matchup-title">Player Relations <span className="tier-pill">1–10</span></div>
          <p className="lede" style={{ margin: '8px 0' }}>Every coach has a Player Relations rating — how well they connect with the roster. It adds a small Off/Def bonus on top of the coach's base bonuses: +0.5% per point, up to +5% at the maximum of 10.</p>
        </div>
        <div className="matchup-box">
          <div className="matchup-title">Chemistry <span className="tier-pill">1–10</span></div>
          <p className="lede" style={{ margin: '8px 0' }}>A scouting-style rating for the whole team, blending roster career stages and coach tenure with titles and playoff appearances. Visible on Standings and your Team screen once hands are dealt.</p>
        </div>

        <h2 id="coach-archetypes">Coach Archetypes</h2>
        {Object.entries(COACH_ARCHETYPES).map(([name, a]) => (
          <div key={name} className="matchup-box">
            <div className="matchup-title">{name}</div>
            <div className="meta-row" style={{ borderTop: 'none', paddingTop: 0 }}>
              <GlossaryStat label="Base Off" val={a.offBase + '%'} />
              <GlossaryStat label="Base Def" val={a.defBase + '%'} />
            </div>
          </div>
        ))}

        <h2 id="coach-modifiers">Coach Modifiers</h2>
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

        <h2 id="fanbase">Fanbase</h2>
        <p className="lede">Your Fanbase Archetype is drawn once and holds for the whole era, like Coach. Attendance itself is recalculated at the end of every season from your archetype's formula, your Market's floor, and how you finished — then a permanent, small baseline (built up from season milestones and any fanbase investment) is added on top. Attendance applies a small multiplier to your cap (0.9x–1.1x).</p>
        {FANBASE_ARCHETYPES.map((f) => (
          <div key={f.name} className="matchup-box">
            <div className="matchup-title">{f.name}</div>
            <div className="meta-row" style={{ borderTop: 'none', paddingTop: 0 }}>
              <GlossaryStat label="Draw Odds" val={f.weight + 'w'} />
            </div>
            <div className="statusline" style={{ marginTop: 8 }}>
              {f.name === 'Steady' && 'Attendance sits at your market floor plus a share of that band based on how you performed — predictable, no randomness.'}
              {f.name === 'Fair Weather' && 'Same market floor, but the swing band widens the worse you perform, and the actual number is rolled at random within it — boom or bust.'}
              {f.name === 'Die Hard' && 'Always a near-sellout — a flat 90–100% roll every season, regardless of market or performance.'}
            </div>
          </div>
        ))}

        <h2 id="season-milestones">Season Milestones</h2>
        <p className="lede">Small, permanent additions to your fanbase baseline — they never expire and never decrease. Season End scales with your final seed (best at #1, nothing if you miss the playoffs); the rest are flat: Playoff Berth, Home Court Clinch (seed ≤ 4), a Playoff Win (each series won), and a Championship.</p>

        <h2 id="fanbase-mods">Fanbase Mods</h2>
        <p className="lede">Re-rolled every season for every team, from one shared pool. Team Pride can only roll for a Steady or Die Hard fanbase.</p>
        {FANBASE_MODS.map((m) => (
          <div key={m.name} className="matchup-box">
            <div className="matchup-title">{m.name}</div>
            <div className="meta-row" style={{ borderTop: 'none', paddingTop: 0 }}>
              <GlossaryStat label="Draw Odds" val={m.weight + 'w'} />
              {m.needsValue && <GlossaryStat label="Value" val={`1–${m.valueDie}`} />}
            </div>
            {m.restrictTo && <div className="statusline" style={{ marginTop: 4 }}>Only rolls for: {m.restrictTo.join(', ')}</div>}
            <div className="statusline" style={{ marginTop: 4 }}>{m.flavor}</div>
          </div>
        ))}

        <h2 id="market">GM &amp; Market Size</h2>
        <p className="lede">Each GM card rolls a market size that sets the attendance floor and budget increase. Firing a GM draws a new type and market together. Aggressive reduces offseason player salary requests by {GM_BONUS_RATE * 100}% and costs +1 budget. Hands-Off adds {GM_BONUS_RATE * 100}% Offense and Defense for each completed year of coach tenure and starting-five continuity, capped at {HANDS_OFF_BONUS_CAP * 100}%, and costs +1 budget. Neutral has no bonus or extra budget hit.</p>
        <div className="statusline">GM types: {GM_TYPES.join(' · ')}</div>
        {MARKETS.map((m) => (
          <div key={m.name} className="matchup-box">
            <div className="matchup-title">{m.name}</div>
            <div className="meta-row" style={{ borderTop: 'none', paddingTop: 0 }}>
              <GlossaryStat label="Attendance Floor" val={Math.round(m.attendanceFloor * 100) + '%'} />
              <GlossaryStat label="Budget Increase" val={`+${formatCoins(m.capAdjMin)}–${formatCoins(m.capAdjMax)}`} />
              <GlossaryStat label="Draw Odds" val={m.weight + 'w'} />
            </div>
          </div>
        ))}

        <h2 id="front-office-moves">Front Office Moves</h2>
        <p className="lede">Fire and replace your coach, fire your GM, or invest in your fanbase — all spent from this season's budget room. Firing a coach pays both the outgoing and incoming salaries. Firing a GM costs {formatCoins(FIRE_GM_COST)}, is limited to once per season, and draws a random GM and market size.</p>

        <h2 id="skillsets-chemistry">Player Skillsets and Team Chemistry</h2>
        <p className="lede">Each new player rolls one permanent Skillset. Elite Fit pairs add +3% and Good Fit pairs +1% to Offense or Defense, capped at +12% on each side. Only the active five count; each distinct pairing counts once. Locker Room Guy adds +1 flat Offense and Defense from anywhere on the roster, without stacking. Team Chemistry uses a 0–100 score: 50 base points, up to 30 for Skillset fit (2.5 per percentage point across both sides), up to 15 for starter tenure (1 per completed player-year), and 5 for Locker Room Guy. Grades: A+ 97, A 93, A− 90, B+ 87, B 83, B− 80, C+ 77, C 73, C− 70, D+ 67, D 63, D− 60, F below 60. Each completed starter-year also adds +0.5% Offense and Defense beyond the Skillset cap. Bench players earn tenure but contribute only while starting. Joining a different team resets tenure. The experience rating stays separate. Legacy players without a Skillset remain unchanged.</p>
        {SKILLSETS.map((skill) => <div key={skill.id} className="matchup-box">
          <div className="matchup-title">{skill.name}</div><p>{skill.description}</p>
          <p>Favored positions: {skill.positions.join(', ')} (3× draw weight; all positions eligible).</p>
          <ul>{SKILLSET_PAIRS.filter((p) => p.skills.includes(skill.id)).map((p) => <li key={p.skills.join(':')}>
            {SKILLSETS.find((s) => s.id === p.skills.find((id) => id !== skill.id)).name} — {p.percent === 3 ? 'Elite Fit' : 'Good Fit'} · +{p.percent}% {p.side}
          </li>)}</ul>
        </div>)}
        <h2 id="matchup-modifier-cards">Matchup Modifier Cards</h2>
        <p className="lede">Every team receives three cards from a shared 97-card deck each season. Each name has a fixed effect and rarity: Core, Prime, Signature, or Legendary. Cards are single-use; seeding bonuses apply automatically. Positive cards help your team and negative cards target the opponent. Player-stat changes last one matchup, with stats floored at 1. Ability percentages retain fractional points. Dice cards change the selected offense or defense die (minimum 1). Advantage keeps the higher of two rolls; Disadvantage keeps the lower, and the two cancel. These affect both rolls for the matchup, including rolls already resolved. Extra-card effects draw one remaining playable card; negative card effects discard one random unused playable opponent card. Budget-hit bonuses add the selected starter’s exact salary to one stat without changing salary. Position bonuses count the active matchup lineup when played, excluding the bench. Bargain Production requires a starter with a budget hit of 1 or less. A fresh deck is shuffled next season.</p>
        {MATCHUP_MODIFIER_TYPES.map((t) => {
          const catColor = t.target === 'opponent' ? 'var(--bad)' : 'var(--good)';
          let roleNote;
          if (t.reactive) roleNote = "Reactive — its holder may play it in response to being targeted; playing it consumes it whether or not it works. If the attacking card needs a value, the reaction only blocks it on a roll that meets or beats that value.";
          else if (t.passive === 'bench') roleNote = 'Passive — boosts bench score all season.';
          else if (t.passive === 'seeding') roleNote = 'Passive — boosts seeding roll this season.';
          else roleNote = t.effectType ? t.description : matchupCardEffectNote(t);
          return (
            <div key={t.name} className="matchup-box">
              <div className="matchup-title" style={{ color: catColor }}>{t.name}</div>
              <p className="lede" style={{ margin: '8px 0' }}>{t.flavor}</p>
              <div className="meta-row" style={{ borderTop: 'none', paddingTop: 0 }}>
                <GlossaryStat label="Rarity" val={t.rarity} />
                {t.needsValue && <GlossaryStat label="Value" val={`1–${t.valueDie || 10}`} />}
              </div>
              {t.targetsPlayer && <div className="statusline" style={{ marginTop: 4 }}>Choose an active player on the target team and one of SCO, PLM, REB, or DEF.</div>}
              <div className="statusline" style={{ marginTop: 4 }}>{roleNote}</div>
            </div>
          );
        })}
      </div>
      <div className="bottombar">
        <button className="primary" onClick={onBack}>Back</button>
      </div>
    </>
  );
}
