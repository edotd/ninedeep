# Nine Deep — Playoff Match Flow (design brief)

Everything a designer needs to know about how a playoff match works today, from entering the postseason to the season results screen. Written from the code, so the rules and states below are the real ones. Target is **phone first** (a 390 × 844 viewport); desktop has its own, older layouts.

Source files, if the other agent wants to read the behaviour: `src/screens/PlayoffsScreen.jsx` (router), `PlayoffBracketScreen.jsx` / `MobilePlayoffBracket.jsx` (bracket), `PlayoffSeriesScreen.jsx` (match wrapper), `src/components/TurnPanel.jsx` (the live match board), `src/components/MatchupBox.jsx` (finished-match breakdown), `src/game/turn.js` (the turn engine), `src/game/engine.js` (open / simulate / finish), `src/game/season.js` (seeding, results).

---

## 1. The big picture

```
Season ends → Standings / seeding
   → PLAYOFF BRACKET (7 matches)
        ├─ pick a match → LIVE MATCH BOARD (turn by turn)  → match result
        ├─ or SIM a match instantly                          → match result
        ├─ or SIMULATE CPU SERIES (fast-forward everything the human isn't in)
        └─ REVIEW a finished match → MATCH BREAKDOWN
   → all 7 matches decided → SEE RESULTS
   → SEASON RESULTS screen (standings + every match + champion banner) → Continue → next phase
```

A "series" in the UI is really **one match**, not a best-of-seven. Each match is exactly **two possessions** and one winner. There is no game-by-game record.

## 2. The bracket

Eight playoff teams, seeded 1–8 by the regular-season rating. Seven matches, single elimination:

| Match | Teams | Feeds |
|---|---|---|
| Quarterfinal 1 | seed 1 vs seed 8 | Semifinal 1 |
| Quarterfinal 2 | seed 4 vs seed 5 | Semifinal 1 |
| Quarterfinal 3 | seed 2 vs seed 7 | Semifinal 2 |
| Quarterfinal 4 | seed 3 vs seed 6 | Semifinal 2 |
| Semifinal 1 | winner QF1 vs winner QF2 | Final |
| Semifinal 2 | winner QF3 vs winner QF4 | Final |
| Final | winner SF1 vs winner SF2 | — |

Rules that matter for design:

- **Any unlocked match can be played in any order.** A quarterfinal is unlocked from the start. A semifinal or the Final unlocks only once **both** feeder matches have results. Locked matches show "TBD" teams.
- A match has one of these statuses: **Pending** (locked), **Ready** (unlocked, not started), **Live** (started, no result yet), **Filed/Final** (has a result).
- The human may or may not be in the bracket. If their team missed the playoffs, they are only a spectator (no Begin button for matches they aren't in; they can still Sim or watch).
- Multiplayer exists: a match can have 0, 1 or 2 human teams (see §8). Solo is always exactly one human.
- Only **one** match can be live at a time. Trying to open a second returns "Another series is currently live."

### What each match card shows
- Round/match name (Quarterfinal 1 … The Final)
- Two team rows: **seed, team name, score**
  - Before it's played the score is each team's **Projected Output** (their expected points).
  - After it's played the score is the **final score** and the loser is dimmed.
- Status (Pending / Ready / Live / Final), a "Your series" treatment if the human's team is in it, and the champion tag on a decided Final.

### Current phone bracket layout (what exists, to be redesigned)
- Three round tabs (First Round / Semis / Final), one page per round, swipe or tap tabs.
- The page itself never scrolls vertically.
- Tap a match card to **select** it; a footer then carries the actions: **Team File**, **Sim** (if allowed), the primary action (**Begin / Review / Join Live Series / Ready Up / Waiting …**), plus **Simulate CPU Series ▸▸** and, once everything is decided, **See Results**.
- The persistent bottom bar (Coach / Gameplan) sits under the footer.

### Bracket actions, exactly
| Action | When it appears | What it does |
|---|---|---|
| **Begin** | Unlocked, no result, human is in it (or it's CPU-vs-CPU) | Opens the live match board. |
| **Sim** | Same as Begin, but not for human-vs-human | Resolves the match instantly with no cards played and no advantage used; the result is filed. |
| **Review** | Match has a result | Opens the match breakdown. |
| **Join Live Series** | A match is live (e.g. a second viewer) | Opens the live board in progress. |
| **Ready Up** / **Waiting For Opponent** | Both teams are human | Each player taps Ready; the match starts when both have. |
| **Waiting For Player** / **Players Must Ready Up** | Human-in-a-match you aren't in | Disabled status. |
| **Simulate CPU Series** | Until all 7 are decided | Plays out every match with **no human team in it**, round by round. Human matches stay open for the player. |
| **See Results** | All 7 decided | Ends the playoffs and goes to the Season Results screen. |
| **Team File** (new) | Always | Opens the user's Team page; its back arrow returns to the bracket. |

## 3. Starting a match

Tapping **Begin** opens the **live match board** directly. There is no separate "tip-off" confirmation. The board always opens on the **coin flip** stage.

Before the first stage, the engine has already set up (invisible to the user unless shown):
- both teams' **Adjustment cards** were rolled/dealt;
- **Advantage** was applied if a team wanted it (a once-per-playoffs boost — rolls two dice and keeps the better, or the worse for Disadvantage);
- an **injury check** ran for each team (there is a chance each team loses one starter for the match; a bench player may step in, shown as an injury note);
- **Home Court** was decided: the higher (lower-numbered) seed gets a small bonus, **+1%** offense and defense, when the club is a top-4 seed (and only one side per match gets it);
- **Fanbase** and **Gameplan** effects were folded in.

## 4. The live match board (turn by turn)

A match is **exactly two exchanges** (possessions). The coin flip decides who opens on offense. In exchange 1 the flip winner is on offense; in exchange 2 the other team is. So each team gets exactly one offense roll and one defense roll, then a bench tally, then the result.

### Screen anatomy (phone)
- **Top team board** — the opponent (or, in a spectated CPU match, team "A"). The viewer's own team is always pinned to the **bottom** board when playing.
- **Roll zone** in the middle — shows the coin, the dice, the possession label and the reports. This is where most of the animation lives.
- **Bottom team board** — the user's team.
- **Game log** panel (collapsible) with a running text feed.
- Each **team board** shows: coach card (compact), team name, a "You" tag, a "Home Court" tag, a status line ("On Offense · Cards Face Down Until Played", "Offense Roll — 14", "Bench · No Cards"), the bench contribution once revealed, a **Gameplan slot** and an **Adjustment slot** (card mini-slots, with a "+" when one can be played), a **Pass** button when it's the user's card turn, and a countdown **timer bar** for whoever is deciding.

### Stage-by-stage

1. **Coin flip** (`coinflip`)
   - The roll zone shows a coin with a tap target: "Start — flip the coin / Coin Flip — Winner opens on offense."
   - **Optional here:** the user's **Gameplan card slot** is active during this stage. If they hold a playoff-eligible Gameplan card, tapping the slot opens a picker: "Play A Gameplan Card — choose one card to run for this matchup, or close this without playing one. Only one Gameplan card can be active per team."
   - Tap the coin → the coin spins → `coinflipped`: "{Team} Wins The Tip — Opens on offense for Exchange 1." A tap/continue moves on.

2. **Card window, offense** (`card`, role = offense)
   - The **offense team** chooses an **Adjustment card** or **passes**. It's blind: the other side can't see the choice until both have locked in.
   - If it's the user: their Adjustment slot shows "+", tapping opens "Play An Adjustment Card — Choose one available card or pass. Your selection stays hidden until both teams lock in." with a **12-second timer** (turns red at 3s). Some cards then ask for a **target**: a list of eligible players (and a stat for some cards). A **Pass** button is always available.
   - If it's the opponent and they're human: "Waiting on {team} to lock in a card…". If the opponent is CPU: the AI plays its first eligible card (or none) instantly.
   - When a card is played it appears on the board (a "{Team} played" reveal and a card mini in that team's Adjustment dock) and the log notes it.

3. **Card window, defense** (`card`, role = defense) — same as above for the defending team.

4. **The roll — resolve exchange** (`resolved`)
   - Staged reveal in the roll zone (the user can slow or speed it with the **Auto-progress** checkbox, default off):
     1. Possession label shows; **offense die** rolls and lands (shows e.g. `1d8`, the value, and a **"+mod" button** that opens an **Offense breakdown**: SCO + PLM, coach bonus, retention, relationships, GM approach, gameplan, roster base, skillset synergy, expected roll).
     2. **Defense die** rolls and lands (same breakdown idea with DEF + REB).
     3. **Possession report**, revealed in order: **winner line** ("{Team} Wins") → **offense row** tally-up → **defense row** tally-up → footer.
   - **Resolution rule:** if the offense's die ties or beats the defense's die, the **offense banks its full total**. If the defense's die is higher, the **offense's total is cut** by a haircut set by the defending team's coach (and their chemistry/synergy — "−X% from {team}'s defense"). **The defense's total always counts, win or lose.** The report shows the cut as a strikethrough (`~~+12~~ +10 (−17% from …)`).
   - Footer: a **Next Possession** button (or auto-advance if Auto-progress is on).

5. Between exchange 1 and 2 — a possible **"On The Fly"** coach trigger: a team with that coach modifier has a 30% chance to draw a new Adjustment card, announced in the log. Then exchange 2 starts and steps 2–4 repeat with the roles swapped.

6. **Bench contribution** (`bench`)
   - Two beats, first team then second team: a "BENCH — Contribution" coin, "Adding {team}'s bench", then the number counts in. Status line shows "Bench · No Cards" (no card play here).

7. **Final** (`complete`)
   - Totals: each team's score = offense output + defense output + bench + any league modifier. Higher wins; an exact tie is broken by a coin flip.
   - The roll zone shows a 🏆 "Final" coin, **"{Winner} Wins"** and a short result blurb, and (when a back handler exists) a **Back to Playoff Bracket** button.
   - The result is saved on the match; the bracket then shows it as Final and unlocks the next round if both feeders are done.

### Everything the board can show at once (inventory for the designer)
Coin; two dice of different sizes (the die size comes from the coach — e.g. d6/d8/d10/d12); possession label; offense and defense breakdown popovers; played-card reveal toast; Gameplan picker modal; Adjustment picker modal with target chips; card timer; waiting-on-opponent text; injury and Home Court tags; per-team Gameplan and Adjustment slots; auto-progress checkbox; game-log panel; bench coin; final trophy coin; back button.

## 5. Spectating a CPU match
Opening a CPU-vs-CPU match runs the same board (including coin flip and dice) with no card windows for the user: they only press the coin and Next Possession. They can also just **Sim** it.

## 6. Instant sim
**Sim** (one match) and **Simulate CPU Series** (all non-human matches) skip the board entirely and file results with no cards and no advantage used (except a card/advantage choice a human already queued for the match). The bracket card flips to Final immediately.

## 7. Reviewing a finished match
**Review** (or opening a decided match) shows a read-only **Matchup box**: a title ("Quarterfinal 2"), both teams with their final scores, and a roll-by-roll breakdown: offense die/mod/total and whether it won, defense die/mod/total, bench, league modifier, injuries, played cards with notes, Home Court, and the **turn log** replayed as events. A **Skip** control cuts the reveal short. Footer: **Back to Playoff Bracket**.

## 8. Multiplayer notes
- Two human teams in the same match: both must **Ready Up**; the board then runs with each human choosing their own cards and a "Waiting on {team}…" state for the other.
- Only a participant can start a match. Anyone can join a live match as a spectator.
- Navigation is per-browser: another player opening a match must not pull everybody else off the bracket.

## 9. After the playoffs — Season Results
Tap **See Results** once all seven matches are decided.
- **Season N Results** page.
- **Regular Season Standings** table (seed + team, with the right-hand column alternating every ~3.5s between **rating** and **playoff result**: Missed Playoffs / Round 1 Loss / Round 2 Loss / Finals Loss / Finals Win).
- **Playoffs** section: a Matchup box for every match.
- **Banner**: "Season N Champion – {team}". In the default mode the Final's winner is only champion if their rating clears the **championship bar**; otherwise "No champion this season. {winner} won the Finals with a rating of X, short of the Y championship bar." (An "outright" setting skips the bar.)
- **Continue** button → next phase (season recap, then offseason).

## 10. Open design questions worth settling
- The bracket calls these "series" but they are single two-possession matches. Decide on the right vocabulary (Match? Game?) and drop any best-of-seven imagery.
- Where do **Team File** and "view my coach/gameplan" live while a match is live? The board currently has no way back to the Team page mid-match.
- The Gameplan card can only be played at the **coin flip**, the Adjustment only in the **card windows** — the board needs to make that timing obvious.
- The 12-second card timer, Auto-progress, and the staged possession report all affect pacing; a spectated CPU match is slow with no cards to play.
- The bracket needs a clear "what do I do next" signal: the user's next playable match, whether they're still alive, and what a loss means (eliminated, but the bracket still plays out).
- Short-phone behaviour: the bracket page is locked from vertical scrolling, so four quarterfinals plus a footer must fit in roughly 290–475 px of height.
