import { useMemo } from 'react';
import PlayerCard from '../components/PlayerCard';
import FrontOfficeCard from '../components/FrontOfficeCard';
import MatchupCard from '../components/MatchupCard';
import CardTypeMark from '../components/CardTypeMark';
import CardAnnotation from '../components/CardAnnotation';
import StrategyCard from '../components/StrategyCard';
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
  team.market = gm.market;
  team.gmType = gm.type;
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
  { key: 'header', selector: '.pcard-header', label: 'Header plate', side: 'left',
    text: 'Position at a glance, reinforced by a fixed plate color — cream Guard, yellow Forward, navy Big.' },
  { key: 'name', selector: '.pcard-name-block', label: 'Number and archetype', side: 'left',
    text: "No portraits in this game, so this block is the card. The number is how the persistent bar shows this player in their slot." },
  { key: 'stats', selector: '.pcard-stats', label: 'Stat block', side: 'left',
    text: 'Four fixed cells so all nine cards scan as one table. These drive offense, defense, and rebounding rolls.' },
  { key: 'footer', selector: '.pcard-footer', label: 'Tier and card ID', side: 'left',
    text: 'The tier name and a stable card number — collectible information only, no effect in play.' },
  { key: 'budgethit', selector: '.pcard-budgethit-row', circleSelector: '.pcard-budgethit', circle: true, label: 'Cost', side: 'right',
    text: 'The largest figure on the card, and the one this player gets traded on. It charges the budget every season the contract runs.' },
  { key: 'years', selector: '.pcard-years-row', label: 'Turns remaining',
    text: 'Each filled dot is one turn left on the contract. At zero, the player enters free agency.' },
  { key: 'level', selector: '.pcard-age-row', circleSelector: '.pcard-level', circle: true, label: 'Career stage', side: 'right',
    text: 'The career stage and a fixed career roll set the bonus or penalty on every stat.' },
];

const FRONTOFFICE_NOTES = [
  { key: 'department', selector: '.fo2-header', label: 'Department', side: 'left',
    text: 'Which part of the front office this is — Coach, Fanbase, or GM. Fanbase cards show the current modifier here.' },
  { key: 'name', selector: '.fo2-name-col', label: 'Name and tenure', side: 'left',
    text: 'Who or what it is, and how long it has held. Landscape and ink, so it can never be read as a player.' },
  { key: 'effects', selector: '.fo2-effects', label: 'Effect lines', side: 'left',
    text: 'The effect lines show the card’s current bonuses and modifiers.' },
  { key: 'disposition', selector: '.fo2-disposition', circle: true, label: 'Disposition', side: 'right',
    text: 'One word for the whole card, in colour. Amber is a structural trait, green is favorable to you.' },
  { key: 'duration', selector: '.fo2-footer', circleSelector: '.fo2-duration', circle: true, label: 'Duration', side: 'right',
    text: 'How long it holds. This is what separates a front office card from everything else — seasons, not possessions.' },
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

const STRATEGY_NOTES = [
  { key: 'type', selector: '.strategy-card-kicker', label: 'Card type', text: 'Identifies whether this is a permanent Development card or a one-use seasonal Gameplan.' },
  { key: 'name', selector: '.strategy-card-name', label: 'Card name', text: 'The program or plan you are choosing to use.' },
  { key: 'effect', selector: '.strategy-card-description', label: 'Effect', text: 'The exact stat, output, opponent, or seeding change this card applies.' },
  { key: 'rule', selector: '.strategy-card-rule', label: 'Career limit', text: 'A player can receive only one Development card during their career.' },
];

const GAMEPLAN_NOTES = STRATEGY_NOTES.filter((note) => note.key !== 'rule');

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
  const developmentExample = { id: 'dev-preview', kind: 'development', name: 'Shooting Lab', description: '+2 SCO permanently.', statChanges: { SCO: 2 }, used: false };
  const gameplanExample = { id: 'gp-preview', kind: 'gameplan', name: 'Run And Gun', description: '+8% team Offense.', target: 'self', contexts: ['season', 'playoff'], used: false };

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
                <div className="co-meta-value accent">Five</div>
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
            body="A standing arrangement that shapes everything else — a coach, a fanbase, a market. It never takes a possession. It changes the terms every possession is played under, and it holds across seasons."
            howLabel="How It Plays" howText="It does not get played. It is in force from the moment it is dealt."
            costLabel="How It Ends" costText="It holds for the stated duration. Read the footer before you build around it."
            notes={FRONTOFFICE_NOTES}
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

          <CardOverviewSection
            accent="var(--approved-file)" markType="frontoffice" eyebrow="Coach Development" title="Development Cards"
            body="A permanent training program applied to one player. Each coach rolls two to four every season, and each player can receive only one Development card during their career."
            howLabel="How It Plays" howText="Choose an eligible player and apply the card directly to their stats."
            costLabel="How It Ends" costText="Consumed when applied. The player keeps the improvement for their career."
            notes={STRATEGY_NOTES}
          >
            <StrategyCard card={developmentExample} />
          </CardOverviewSection>

          <CardOverviewSection
            accent="var(--franchise)" markType="matchup" eyebrow="Two Per Season" title="Gameplan Cards"
            body="A coach's plan for the season or a playoff matchup. It can strengthen your team, disrupt an opponent, or improve your regular-season seeding roll."
            howLabel="How It Plays" howText="Play before summing the regular season or before a playoff matchup begins."
            costLabel="How It Ends" costText="Consumed after one use. Unused cards expire when the next season is dealt."
            notes={GAMEPLAN_NOTES}
          >
            <StrategyCard card={gameplanExample} />
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
