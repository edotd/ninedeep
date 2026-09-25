import { useState } from 'react';
import CardTypeMark from '../components/CardTypeMark';
import { effectiveRating } from '../game/roster';

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function StandingsScreen({ state, actions, myTeamId, onViewTeam }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const team = state.teams[myTeamId];
  const madeIt = team.seed <= 8;
  const outright = state.settings && state.settings.winCondition === 'outright';
  const savedByTeam = new Map((state.seasonBreakdown || []).map((row) => [row.teamId, row]));
  const breakdown = state.seeds.map((seed, index) => {
    const t = seed.t;
    const saved = savedByTeam.get(t.id);
    if (saved) return saved;
    const baseRating = effectiveRating(t);
    const gameplanSeedingPct = t.seasonGameplanEffects?.seedingPercent || 0;
    const oldSeedingPct = (t.matchupCards || []).filter((card) => card.effectType === 'SEEDING_PERCENT' && card.used).reduce((sum, card) => sum + card.value, 0);
    const knownMultiplier = (1 + gameplanSeedingPct / 100) * (1 + oldSeedingPct / 100);
    const seasonRollPct = baseRating && knownMultiplier ? ((seed.val / (baseRating * knownMultiplier)) - 1) * 100 : 0;
    return {
      teamId: t.id,
      teamName: t.name,
      seed: index + 1,
      baseRating: Math.round(baseRating * 10) / 10,
      seasonRollPct: Math.round(seasonRollPct * 10) / 10,
      gameplanSeedingPct,
      seedingCardPct: oldSeedingPct,
      favorableSchedulePct: 0,
      finalRating: Math.round(seed.val),
    };
  });
  const signedPct = (value) => `${value > 0 ? '+' : ''}${value || 0}%`;
  return (
    <>
      <div className="screen standings-screen">
        <div className="standings-inner">
          <div className="standings-masthead">
            <div className="standings-eyebrow">Season {state.season} · Regular Season Filed</div>
            <div className="standings-result">
              {madeIt
                ? <>You finished in <span className="accent">{ordinal(team.seed)}</span> place this season.</>
                : <>{team.name} did not make the playoffs this season.</>}
            </div>
            {!outright && (
              <div className="standings-bar-row">
                <span className="standings-bar-label">Clear Championship Bar</span>
                <span className="standings-bar-value">{Math.round(state.bar)}</span>
              </div>
            )}
            <button className="standings-breakdown-button" onClick={() => setShowBreakdown((open) => !open)}>
              {showBreakdown ? 'Hide Season Breakdown' : 'View Season Breakdown'}
            </button>
          </div>

          {showBreakdown && (
            <section className="season-breakdown" aria-label="Season breakdown">
              <div className="season-breakdown-intro">
                <h2>How the season was decided</h2>
                <p>Your base rating comes from the active five, coach and continuity bonuses, Synergy, and active output Gameplans. Every team then receives a season roll from −2.5% to +2.5%. Seeding Gameplans apply last. The highest final rating earns the top seed.</p>
              </div>
              <div className="season-breakdown-table">
                <div className="season-breakdown-row head">
                  <span>Team</span><span>Base</span><span>Season Roll</span><span>Gameplan</span><span>Final</span>
                </div>
                {breakdown.map((row) => {
                  const cardPct = (row.seedingCardPct || 0) + (row.favorableSchedulePct || 0);
                  const gameplanPct = (row.gameplanSeedingPct || 0) + cardPct;
                  return (
                    <div key={row.teamId} className={'season-breakdown-row' + (row.teamId === myTeamId ? ' you' : '')}>
                      <span className="season-breakdown-team"><b>#{row.seed}</b> {row.teamName}</span>
                      <span>{row.baseRating}</span>
                      <span className={(row.seasonRollPct || 0) < 0 ? 'negative' : 'positive'}>{signedPct(row.seasonRollPct)}</span>
                      <span>{gameplanPct ? signedPct(gameplanPct) : '—'}</span>
                      <span className="season-breakdown-final">{row.finalRating}</span>
                    </div>
                  );
                })}
              </div>
              <p className="season-breakdown-note">Off Avg and Def Avg describe simulated on-court output. Seeding uses the rating calculation above, so those averages do not directly determine playoff position.</p>
            </section>
          )}

          <div className="standings-table">
            <div className="standings-head-row">
              <span>Team</span>
              <span>Off Avg</span>
              <span>Def Avg</span>
              <span>Rating</span>
            </div>
            {state.seeds.map((s) => {
              const seedingCards = (s.t.matchupCards || []).filter((c) => c.effectType === 'SEEDING_PERCENT' && c.used);
              return (
              <div
                key={s.t.name}
                className={'standings-row' + (s.t === team ? ' you' : '') + (s.t.seed > 8 ? ' out' : '')}
                style={{ cursor: onViewTeam ? 'pointer' : undefined }}
                onClick={onViewTeam ? () => onViewTeam(s.t.id) : undefined}
              >
                <span className="standings-team">
                  <span className="standings-seed">#{s.t.seed}</span> {s.t.name}
                  {seedingCards.length > 0 && (
                    <span
                      className="standings-seeding-icon"
                      title={seedingCards.map((c) => `${c.name} +${c.value}%`).join(' · ') + ' Seeding Roll'}
                    >
                      <CardTypeMark type="matchup" size={13} />
                    </span>
                  )}
                  {s.t.seed > 8 && <span className="standings-out-tag"> — out</span>}
                </span>
                <span>{s.t.simOffenseAvg != null ? s.t.simOffenseAvg : '—'}</span>
                <span>{s.t.simDefenseAvg != null ? s.t.simDefenseAvg : '—'}</span>
                <span className="standings-rating">{Math.round(s.val)}</span>
              </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="bottombar">
        <button className="primary" onClick={actions.beginPlayoffs}>Begin Playoffs</button>
      </div>
    </>
  );
}
