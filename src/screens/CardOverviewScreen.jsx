import { useMemo } from 'react';
import PlayerCard from '../components/PlayerCard';
import FrontOfficeCard from '../components/FrontOfficeCard';
import MatchupCard from '../components/MatchupCard';
import CardTypeMark from '../components/CardTypeMark';
import CardAnnotation from '../components/CardAnnotation';
import { drawCoachCard, applyCoachRetention } from '../game/cards';
import { weightedPick } from '../game/rng';
import { FANBASE_ARCHETYPES, MATCHUP_MODIFIER_TYPES } from '../game/constants';
import { drawGM } from '../game/gm';
import { initAttendance } from '../game/fanbase';
import { rollFanbaseMod } from '../game/fanbase';

// A throwaway team, built with the same generators the real Front Office pull uses, purely so
// this screen has something real to show in the Front Office example — never written to
// state.teams, so it has no effect on the actual game.
function buildSampleTeam() {
  const team = { hand: [], activeIds: [], retainedStreak: 0, lastCoachName: null };
  team.coach = drawCoachCard();
  applyCoachRetention(team, team.coach);
  team.fanbaseArchetype = weightedPick(FANBASE_ARCHETYPES);
  rollFanbaseMod(team);
  const gm = drawGM();
  team.gmType = gm.type;
  team.gmRarity = gm.rarity;
  team.gmTrait = gm.trait;
  initAttendance(team);
  team.advantageAvailable = team.fanbaseArchetype.name === 'Die Hard';
  return team;
}

// Same shape drawMatchupModifierCard (game/cards.js) produces, minus the state-backed id
// counter — this is a display-only example, never dealt into any real hand.
function sampleMatchupCard() {
  const t = weightedPick(MATCHUP_MODIFIER_TYPES);
  return { ...t, id: 'preview-0', used: false };
}

const PLAYER_NOTES = [
  { key: 'archetype', selector: '.pcard-name', label: 'Archetype',
    text: 'What this player excels at. There are four total archetypes: Scorer, Playmaker, Rebounder and Defender.' },
  { key: 'stats', selector: '.pcard-stats', label: 'Stats',
    text: "Player stats determine your team's output. Scoring and Playmaking contribute to offense. Defense and Rebounding contribute to defense." },
  { key: 'skillset', selector: '.pcard-skillset', label: 'Skillset',
    text: 'A permanent trait rolled once at creation. Specific skillsets apply bonuses to your team chemistry when paired together.' },
  { key: 'years', selector: '.pcard-years-row', label: 'Turns Remaining',
    text: 'Each dot represents the amount of turns this player will be on your roster.' },
  { key: 'stage', selector: '.pcard-header-stage', label: 'Career Stage',
    text: 'Where the player is at in their career. Different stat bonuses may apply depending on where the player is in their career.' },
  { key: 'tier', selector: '.pcard-header-tier', label: 'Tier',
    text: "The player's ceiling. Applies bonuses to specific stats." },
  { key: 'position', selector: '.pcard-header-pos', label: 'Position',
    text: 'Guard, Forward, or Big. Your starting five needs at least one of each.' },
  { key: 'grade', selector: '.pcard-grade', label: 'Grade',
    text: "A single letter summarizing this player's overall quality, at a glance." },
  { key: 'cost', selector: '.pcard-budgethit-row', label: 'Cost',
    text: 'How much the player counts towards your budget every turn.' },
];

const COACH_NOTES = [
  { key: 'type', selector: '.fo2-name', label: 'Type',
    text: "The coach's archetype — who they are, independent of the specific trait rolled below." },
  { key: 'modifier', selector: '.fo2-disposition', label: 'Modifier',
    text: 'The one trait that makes this coach distinct — the headline word for the whole card, explained in full at the bottom.' },
  { key: 'offbonus', selector: '.fo2-effect-off-bonus', label: 'Offensive Bonus and Die',
    text: "This coach's Offense bonus, shown here as a percentage — and as a die size (Off/Def) next to the Coach label at the top of the card." },
  { key: 'defbonus', selector: '.fo2-effect-def-bonus', label: 'Defensive Bonus and Die',
    text: "This coach's Defense bonus, shown here as a percentage — and as a die size (Off/Def) next to the Coach label at the top of the card." },
  { key: 'gameplan', selector: '.fo2-rarity-lead', label: 'Gameplan',
    text: 'Every coach permanently holds two Gameplans, Primary and Secondary — pick one per season on the Set Lineup screen for a team-wide bonus.' },
  { key: 'relations', selector: '.fo2-effect-player-relations', label: 'Player Relations',
    text: "How well this coach works with the roster — a stronger relationship adds to both the Offense and Defense bonus above." },
  { key: 'development', selector: '.fo2-effect-development-points', label: 'Development Points',
    text: 'Points awarded each season to permanently improve a player’s stats, in whichever categories this coach’s style favors.' },
  { key: 'adjustments', selector: '.fo2-effect-in-game-adjustments', label: 'In-Game Adjustments',
    text: 'How many Adjustment cards this coach rolls fresh at the start of every playoff match.' },
];

const MATCHUP_NOTES = [
  { key: 'header', selector: '.mu2-header', label: 'Stamp header', side: 'left',
    text: 'Shows the effect category and fixed rarity: Core, Prime, Signature, or Legendary.' },
  { key: 'condition', selector: '.mu2-name', circle: true, label: 'The condition', side: 'left',
    text: 'What this card does, named. This is the headline of the card.' },
  { key: 'unanswered', selector: '.mu2-row:first-child', circleSelector: '.mu2-row:first-child .mu2-row-value', circle: true, label: 'Target', side: 'left',
    text: 'Positive effects help your team; negative effects target the opponent. Player cards let you choose a player and stat.' },
  { key: 'statement', selector: '.mu2-statement', label: 'The situation', side: 'right',
    text: 'The exact effect and fixed value. A card with this name always has this effect.' },
  { key: 'counter', selector: '.mu2-row:last-child', label: 'Timing', side: 'right',
    text: 'Seeding cards apply automatically. Other cards are played once and apply to this matchup.' },
  { key: 'torn', selector: '.mu2-torn', label: 'Torn edge', side: 'right',
    text: 'The tell that this card is temporary. No other card type has it — it leaves the table after one game.' },
];

function CardOverviewSection({ accent, markType, eyebrow, title, body, howLabel, howText, costLabel, costText, notes, children }) {
  return (
    <div className="co2-section">
      <div className="co2-left">
        <CardTypeMark type={markType} size={200} color={accent} className="co2-left-ghost" />
        <div className="co2-eyebrow" style={{ color: accent }}>{eyebrow}</div>
        <div className="co2-title">{title}</div>
        <p className="co2-body">{body}</p>
        <div className="co2-rules">
          <div>
            <div className="co2-rule-label" style={{ color: accent }}>{howLabel}</div>
            <div className="co2-rule-value">{howText}</div>
          </div>
          <div>
            <div className="co2-rule-label" style={{ color: accent }}>{costLabel}</div>
            <div className="co2-rule-value">{costText}</div>
          </div>
        </div>
      </div>
      <div className="co2-stage-wrap">
        <CardAnnotation accent={accent} notes={notes}>{children}</CardAnnotation>
      </div>
    </div>
  );
}

// An always-available reference for the three card types. Existing saved games can still
// enter the old cardoverview phase, so the original deal action remains as a fallback.
export default function CardOverviewScreen({ state, actions, myTeamId = 0, onBack }) {
  const playerExample = state.teams?.[myTeamId]?.hand?.[0] || state.starPool?.[0];
  const sampleTeam = useMemo(() => buildSampleTeam(), []);
  const matchupExample = useMemo(() => sampleMatchupCard(), []);

  return (
    <>
      <div className="screen co-screen">
        <div className="co-inner">
          <div className="co-masthead">
            <div>
              <div className="co-eyebrow">{state.teamName || 'Your Franchise'} · {onBack ? 'Card Types' : 'Before The Deal'}</div>
              <h1 className="co-title">Your Nine</h1>
            </div>
            <div className="co-meta">
              <div>
                <div className="co-meta-label">Hand Size</div>
                <div className="co-meta-value">Nine Cards</div>
              </div>
              <div>
                <div className="co-meta-label">Card Types</div>
                <div className="co-meta-value accent">Three</div>
              </div>
            </div>
          </div>

          <CardOverviewSection
            accent="var(--stamp)" markType="player" eyebrow="Five Of Your Nine" title="Player Cards"
            body="An asset you own and pay for. Five of them make the rotation you play the game with, and every number on the card is either what they do on the floor or what they cost you to keep."
            howLabel="How It Plays" howText="Played into the roll to take a possession, or held back to answer one."
            costLabel="What It Costs" costText="Cost every season it is on the books, minutes every time you use it."
            notes={PLAYER_NOTES}
          >
            {playerExample && <PlayerCard card={playerExample} />}
          </CardOverviewSection>

          <CardOverviewSection
            accent="var(--stamp-text)" markType="frontoffice" eyebrow="Three Of Your Nine" title="Front Office Cards"
            body="A standing arrangement that shapes everything else — a coach, a fanbase, and a GM. Coaches provide Development Points and two Gameplans in addition to their team bonuses."
            howLabel="How It Plays" howText="It does not get played. It is in force from the moment it is dealt."
            costLabel="How It Ends" costText="It holds for the stated duration. Read the footer before you build around it."
            notes={COACH_NOTES}
          >
            <FrontOfficeCard kind="coach" team={sampleTeam} />
          </CardOverviewSection>

          <CardOverviewSection
            accent="var(--depth)" markType="matchup" eyebrow="Three Of Your Nine" title="Adjustment Cards"
            body="A condition you bring into a single playoff matchup, then it's discarded. It is the only card type that leaves the table. Square stock, heavy stamp border, torn bottom edge — you can tell one at any size."
            howLabel="How It Plays" howText="Played during your own offense or defense roll, one card per roll."
            costLabel="How It Ends" costText="Discarded once played. Unplayed cards are replaced next season."
            notes={MATCHUP_NOTES}
          >
            <MatchupCard card={matchupExample} />
          </CardOverviewSection>

          <div className="co2-footer">
            <div className="co2-footer-note">
              <div className="co2-footer-label">One More Thing</div>
              <div className="co2-footer-text">You draw back to nine at the end of every quarter. Anything unplayed stays in hand — the deal does not reset it.</div>
            </div>
          </div>
        </div>
      </div>
      <div className="bottombar">
        <button className="primary" onClick={onBack || actions.proceedFromCardOverview}>{onBack ? 'Back' : 'Deal The Nine'}</button>
      </div>
    </>
  );
}
