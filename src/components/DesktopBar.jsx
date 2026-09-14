import { formatCoins, rosterSalary } from '../game/economy';
import { teamOutput } from '../game/matchup';
import { teamExperience } from '../game/aging';
import { cardTier, rawOverall } from '../game/cards';
import { MATCHUP_CARD_DRAW_COUNT } from '../game/constants';

// Full-width desktop persistent bar, per the brand handoff's "Component: Persistent Bar" —
// web variant. Seven sections: starters, bench, front office, matchup, then the three
// metric blocks (chemistry, cap, projected output). Fixed to the very bottom of the
// viewport, spanning under both the Sidebar and the content pane.
function PlayerSlot({ card }) {
  if (!card) return <div className="db-slot db-player-slot empty"><span className="db-slot-empty-plus">+</span></div>;
  const tier = cardTier(card);
  const cls = 'db-slot db-player-slot' + (tier === 'EXP' ? ' expiring' : '') + ' tier-' + tier.toLowerCase();
  return (
    <div className={cls} title={`${card.archetype} (${card.position})`}>
      <div className="db-slot-tier-strip" />
      <div className="db-slot-number">{rawOverall(card)}</div>
      <div className="db-slot-position">{card.position}</div>
    </div>
  );
}

function FrontOfficeSlot({ label, value, tone }) {
  return (
    <div className="db-slot db-fo-slot">
      <div className="db-fo-label">{label}</div>
      <div className={'db-fo-value' + (tone ? ' ' + tone : '')}>{value || '—'}</div>
    </div>
  );
}

function MatchupSlot({ card }) {
  if (!card) return <div className="db-slot db-matchup-slot empty"><span className="db-slot-empty-plus">+</span></div>;
  return (
    <div className="db-slot db-matchup-slot" title={card.name}>
      <div className="db-matchup-label">{card.used ? 'Used' : 'Card'}</div>
      <div className="db-matchup-value">{card.name}</div>
    </div>
  );
}

export default function DesktopBar({ state, myTeamId }) {
  const team = state.teams[myTeamId];
  const hand = team.hand || [];
  const activeIds = team.activeIds || [];
  const starters = activeIds.map((id) => hand.find((c) => c.id === id)).filter(Boolean);
  const bench = hand.filter((c) => !activeIds.includes(c.id));
  const matchupCards = team.matchupCards || [];

  const canShowOutput = team.coach && hand.length > 0 && activeIds.length > 0;
  const output = canShowOutput ? teamOutput(team) : null;
  const chemistry = teamExperience(team);
  const cap = team.seasonCap;
  const salary = hand.length ? rosterSalary(team) : 0;
  const overCap = cap !== undefined && salary > cap;

  return (
    <div className="desktop-bar">
      <div className="db-section db-slots-fixed">
        <div className="db-heading starters">Starters</div>
        <div className="db-slots">
          {Array.from({ length: 5 }, (_, i) => <PlayerSlot key={i} card={starters[i]} />)}
        </div>
      </div>
      <div className="db-section db-slots-fixed">
        <div className="db-heading">Bench</div>
        <div className="db-slots">
          {Array.from({ length: 4 }, (_, i) => <PlayerSlot key={i} card={bench[i]} />)}
        </div>
      </div>
      <div className="db-section db-slots-fixed">
        <div className="db-heading">Front Office</div>
        <div className="db-slots">
          <FrontOfficeSlot label="Coach" value={team.coach ? team.coach.modifier : null} />
          <FrontOfficeSlot label="Fans" value={team.fanbaseArchetype ? team.fanbaseArchetype.name : null} tone={team.fanbaseArchetype && team.fanbaseArchetype.name === 'Die Hard' ? 'notable' : null} />
          <FrontOfficeSlot label="Market" value={team.market ? team.market.name : null} />
        </div>
      </div>
      <div className="db-section db-slots-fixed">
        <div className="db-heading matchup">Matchup</div>
        <div className="db-slots">
          {Array.from({ length: MATCHUP_CARD_DRAW_COUNT }, (_, i) => <MatchupSlot key={i} card={matchupCards[i]} />)}
        </div>
      </div>
      <div className="db-section db-metric chemistry">
        <div className="db-heading">Chemistry</div>
        <div className="db-metric-value">{chemistry !== null ? chemistry : '—'}</div>
      </div>
      <div className="db-section db-metric cap">
        <div className="db-heading">Salary Cap</div>
        <div className={'db-cap-figures' + (overCap ? ' over' : '')}>
          <span className="committed">{formatCoins(salary)}</span>
          <span className="slash"> / </span>
          <span className="limit">{cap !== undefined ? formatCoins(cap) : '—'}</span>
        </div>
      </div>
      <div className="db-section db-metric output">
        <div className="db-heading">Projected</div>
        <div className="db-metric-value accent">{output ? output.total : '—'}</div>
        <div className="db-output-breakdown">
          <span>Offense {output ? output.off : '—'}</span>
          <span>Defense {output ? output.def : '—'}</span>
        </div>
      </div>
    </div>
  );
}
