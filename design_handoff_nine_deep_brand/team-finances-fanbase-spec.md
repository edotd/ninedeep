# Team Finances / Fanbase / Matchup Card rework — implementation spec

## Team Finances (new currency, separate from salary cap)
- `team.finances`, starts at 10 for a new era.
- Each season start: `finances += SEASON_STIPEND (3) + round(team.attendance * 10)`.
- **Fire/hire coach**: pay `oldCoach.salary + newCoach.salary` from finances (buyout + new hire cost). New coach is a normal random draw — no guaranteed upgrade. Resets retention streak.
- **Relocate market**: pay `RELOCATION_BASE (15) + RELOCATION_PER_TIER (10) * tierDistance`. Any tier reachable from any tier for a bigger fee (no forced stepping).
- **Fanbase investment**: pay `FANBASE_BOOST_COST (8)` for a permanent `+0.02` to `team.fanbaseBaseline`. Once per season (`team.financeBoostUsedThisSeason`, reset each season).

## Markets (replaces old Small/Basic/Large pool)
Small / Medium / Large / Massive, each with an attendance floor and a cap-adj range. Order matters (tier index used for relocation distance/cost).

## Fanbase archetypes (replaces FANBASE_TYPES; drawn once per era like Coach)
- **Steady** (80%): `attendance = floor + percentile * BAND (0.20)`. Deterministic.
- **Fair Weather** (15%): band width = `0.15 * (1 + (1-percentile))`; value = random within `[floor, floor+band]`.
- **Die Hard** (5%): flat random `0.90–1.00`, ignores floor/percentile.
- `percentile` = this team's rank among all teams by `lastSeasonAvgScore` (existing post-season metric), 0=worst..1=best.
- Final attendance = clamp01(formula value + `team.fanbaseBaseline`), then mods applied relative to *previous* attendance, then clamped again.

## Season milestones (permanent additive bumps to `team.fanbaseBaseline`)
- Season End: by final seed, +1.0% (seed 1) sliding to +0.2% (seed 8), +0 if missed playoffs.
- Playoff Berth: +0.5%
- Home Court Clinch (seed <= 4): +0.5%
- Playoff Win: +0.75% per series win
- Championship: +2%

## Fanbase mods (one rolled per season, weighted, shared pool)
- Team Pride (5w, Steady/Die Hard only): nullify any decrease vs. last season's attendance.
- Invested (30w): cap the decrease (max -10pts/season).
- Corporate (30w): cap the increase (max +10pts/season).
- Sixth Man (20w, value 1-10): opponent must roll 1d10 >= value or this team gets +1 to score.
- Mind Games (15w, value 1-10): opponent must roll 1d10 >= value or a random opposing active player is treated as injured-out for the matchup (reuses forceRemovePlayer).

## Matchup card rework
- Playing a card now requires picking the target player (for player-targeting cards: Injury Minor/Major, Player Suspension). Distraction/Biased Officiating stay team-level (no single player to pick).
- Target (defender) may react with their own held reactive card (Injury Prevention) if they have one — their choice, not automatic. If the played card `needsValue`, reacting requires a roll: 1d(reactive card's valueDie) >= attacking card's value to nullify. No held reactive card = no defense possible.
