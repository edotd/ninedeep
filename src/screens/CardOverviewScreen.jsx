import { useMemo } from 'react';
import PlayerCard from '../components/PlayerCard';
import FrontOfficeCard from '../components/FrontOfficeCard';
import MatchupCard from '../components/MatchupCard';
import CardTypeMark from '../components/CardTypeMark';
import CardAnnotation from '../components/CardAnnotation';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { drawCoachCard, applyCoachRetention } from '../game/cards';
import { weightedPick } from '../game/rng';
import { FANBASE_ARCHETYPES, MARKETS, MATCHUP_MODIFIER_TYPES } from '../game/constants';
import { rollMarketCapAdj } from '../game/economy';
import { initAttendance } from '../game/fanbase';

// A throwaway team, built with the same generators the real Front Office pull uses, purely so
// this screen has something real to show in the Front Office example — never written to
// state.teams, so it has no effect on the actual game.
function buildSampleTeam() {
  const team = { hand: [], activeIds: [], retainedStreak: 0, lastCoachName: null };
  team.coach = drawCoachCard();
  applyCoachRetention(team, team.coach);
  team.fanbaseArchetype = weightedPick(FANBASE_ARCHETYPES);
  const marketDef = weightedPick(MARKETS);
  team.market = { name: marketDef.name, capAdj: rollMarketCapAdj(marketDef) };
  initAttendance(team);
  team.advantageAvailable = team.fanbaseArchetype.name === 'Die Hard';
  return team;
}

// Same shape drawMatchupModifierCard (game/cards.js) produces, minus the state-backed id
// counter — this is a display-only example, never dealt into any real hand.
function sampleMatchupCard() {
  const t = weightedPick(MATCHUP_MODIFIER_TYPES);
  const value = t.needsValue ? 1 + Math.floor(Math.random() * (t.valueDie || 10)) : null;
  return {
    id: 'preview-0', name: t.name, category: t.category, flavor: t.flavor,
    playable: !!t.playable, reactive: !!t.reactive, passive: t.passive || null,
    targetsPlayer: !!t.targetsPlayer, valueDie: t.valueDie || 10, value, used: false,
  };
}

const PLAYER_NOTES = [
  { key: 'header', selector: '.pcard-header', label: 'Header plate', side: 'left',
    text: 'Position and archetype, tier read by the plate colour behind them — amber franchise, ink standard, cream depth, stamp expiring.' },
  { key: 'name', selector: '.pcard-name-block', label: 'Number and archetype', side: 'left',
    text: "No portraits in this game, so this block is the card. The number is how the persistent bar shows this player in their slot." },
  { key: 'stats', selector: '.pcard-stats', label: 'Stat block', side: 'left',
    text: 'Four fixed cells so all nine cards scan as one table. These drive offense, defense, and rebounding rolls.' },
  { key: 'footer', selector: '.pcard-footer', label: 'Tier and card ID', side: 'left',
    text: 'The tier name and a stable card number — collectible information only, no effect in play.' },
  { key: 'caphit', selector: '.pcard-caphit-row', circleSelector: '.pcard-caphit', circle: true, label: 'Cap hit', side: 'right',
    text: 'The largest figure on the card, and the one this player gets traded on. It charges the cap every season the contract runs.' },
  { key: 'years', selector: '.pcard-years-row', circleSelector: '.pcard-dots', circle: true, label: 'Years left', side: 'right',
    text: 'Filled dots are years already served against the contract. Reaches zero and the player expires.' },
  { key: 'level', selector: '.pcard-age-row', circleSelector: '.pcard-level', circle: true, label: 'Career stage', side: 'right',
    text: 'Age and career roll combine into a bonus or penalty on every stat — read it before you plan around this player long-term.' },
];

const FRONTOFFICE_NOTES = [
  { key: 'department', selector: '.fo2-header', label: 'Department', side: 'left',
    text: 'Which part of the front office this is — Coach, Fanbase, or Market — and a three-letter code for its class.' },
  { key: 'name', selector: '.fo2-name-col', label: 'Name and tenure', side: 'left',
    text: 'Who or what it is, and how long it has held. Landscape and ink, so it can never be read as a player.' },
  { key: 'effects', selector: '.fo2-effects', label: 'Effect lines', side: 'left',
    text: 'Always three lines, always in this order. This is the entire mechanical effect.' },
  { key: 'disposition', selector: '.fo2-disposition', circle: true, label: 'Disposition', side: 'right',
    text: 'One word for the whole card, in colour. Amber is a structural trait, green is favorable to you.' },
  { key: 'duration', selector: '.fo2-footer', circleSelector: '.fo2-duration', circle: true, label: 'Duration', side: 'right',
    text: 'How long it holds. This is what separates a front office card from everything else — seasons, not possessions.' },
];

const MATCHUP_NOTES = [
  { key: 'header', selector: '.mu2-header', label: 'Stamp header', side: 'left',
    text: 'Marks it as a matchup and states how long it lasts. Playoff matchups invert to ink and read Series.' },
  { key: 'condition', selector: '.mu2-name', circle: true, label: 'The condition', side: 'left',
    text: 'What this card does, named. This is the headline of the card.' },
  { key: 'unanswered', selector: '.mu2-row-bad', circleSelector: '.mu2-row-bad .mu2-row-value', circle: true, label: 'If unanswered', side: 'left',
    text: 'What it costs if you play it and nothing counters it. Always the first of the two rows.' },
  { key: 'statement', selector: '.mu2-statement', label: 'The situation', side: 'right',
    text: 'One or two sentences of plain-language context — no numbers, just the situation.' },
  { key: 'counter', selector: '.mu2-row-good', label: 'Counter', side: 'right',
    text: 'What answers it. Meet this and the cost above never lands.' },
  { key: 'torn', selector: '.mu2-torn', label: 'Torn edge', side: 'right',
    text: 'The tell that this card is temporary. No other card type has it — it leaves the table after one game.' },
];

function CardOverviewSection({ accent, markType, eyebrow, title, body, howLabel, howText, costLabel, costText, notes, children }) {
  const isDesktop = useIsDesktop();
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
        {isDesktop ? (
          <CardAnnotation accent={accent} notes={notes}>{children}</CardAnnotation>
        ) : (
          <div className="co2-mobile">
            {children}
            <ul className="co2-mobile-notes">
              {notes.map((n) => <li key={n.key}><b>{n.label}.</b> {n.text}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// "Before the Deal" (design brand handoff, 3A, rewritten) — a one-time overview of the three
// card types, shown before any dealing starts. One real card per type, hand-annotated. Player
// example is drawn straight from the real season pool (safe to preview — dealing hasn't
// touched it yet); Front Office and Matchup examples are built from the same generators the
// real pulls use, on throwaway data never written to any real team, since neither has
// actually been pulled yet at this point in the flow.
export default function CardOverviewScreen({ state, actions }) {
  const playerExample = state.starPool[0];
  const sampleTeam = useMemo(() => buildSampleTeam(), []);
  const matchupExample = useMemo(() => sampleMatchupCard(), []);

  return (
    <>
      <div className="screen co-screen">
        <div className="co-inner">
          <div className="co-masthead">
            <div>
              <div className="co-eyebrow">{state.teamName || 'Your Franchise'} · Before The Deal</div>
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
            costLabel="What It Costs" costText="Cap hit every season it is on the books, minutes every time you use it."
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
            accent="var(--depth)" markType="matchup" eyebrow="Three Of Your Nine" title="Matchup Cards"
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
        <button className="primary" onClick={actions.proceedFromCardOverview}>Deal The Nine</button>
      </div>
    </>
  );
}
