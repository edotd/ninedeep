# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Matchup deck

The canonical 97-card list is in `src/game/supplementalCards.js`. Every definition has a stable ID, fixed value, category and rarity. A shuffled deck is stored in game state, deals three cards per team without replacement, and resets each season. Existing saved legacy cards keep their original effects until the next deal.

Positive effects target the holder, negative effects target the opponent. Seeding bonuses are additive and consumed automatically at seeding. All other cards are single-use. Player/stat selection covers SCO, PLM, REB and DEF; changes are matchup-local, with stats floored at 1. Ability percentages apply to the offense/defense modifier and retain fractional points. Dice adjustments affect the offense or defense roll corresponding to the action window and cannot reduce a die below 1. Advantage and Disadvantage affect both matchup rolls, cancel each other, and recalculate already-resolved rolls. Extra draws skip seeding cards after seeding; discards remove a random unused playable opposing card. Exhausted decks do not reshuffle midseason.

Run `npm test` (Node 22.15+), `npm run lint`, and `npm run build`. Tests cover every playable definition, shared-deck serialization, temporary effects, seeding, and both match resolvers. The game continues using its existing Firestore state synchronization; no database seed or schema migration is needed.

### Roster-dependent expansion

Seven additional cards retain the original 90 definitions and three Legendaries. Earn Your Contract (Signature) adds the selected starter's exact salary, including fractional cap hits, to a chosen stat without changing salary. Three-Guard Attack, Switchable Wings, Own the Paint, and Interior Pressure (Prime) grant +5% per matching starter. Positionless Basketball (Prime) grants +10% Offense with all three positions starting. Bargain Production (Core) grants +2 to a chosen stat only on a starter with salary <= 1.

Position counts use the active matchup lineup when the card resolves, including injury substitutions and excluding the bench. Bonuses are fixed for that matchup after play and stack additively with existing ability percentages. New definitions enter existing games at the next season's deck reset.

## Player Skillsets and Team Chemistry

New player cards roll one permanent `skillsetId` from 24 definitions. Favored positions have 3× draw weight; all Skillsets remain eligible for every position. The ID travels with the player through roster moves, contracts, aging and saved game state. Existing players without an ID remain neutral; start a new game to see Skillsets throughout the roster.

Team Chemistry retains the existing experience score and reports 35 mutual Skillset pairings. Elite Fit grants +3% and Good Fit +1% to the corresponding offense/defense modifier, each side capped at +12%. Only the active lineup counts, including injury substitutions. Duplicate Skillset combinations count once. Locker Room Guy grants +1 flat offense and defense from anywhere on the roster, at most once. These bonuses feed projected output, regular-season simulated averages, and both playoff resolvers; the existing seeding rating formula is unchanged.

Before season confirmation, the Team Chemistry panel previews valid starter/bench swaps and their bonus changes. Swaps preserve a five-player lineup with Guard, Forward and Big coverage and are rejected after the season locks. Pair definitions, eligibility and bonuses come from `src/game/skillsets.js`; the glossary lists every connection.
