import { skillsetFor } from '../game/skillsets';
import { jerseyNumber, playerGrade } from '../game/cards';
import { formatCoins } from '../game/economy';

// Shared with SeasonRecapScreen's "Contracts On The Books" section — same row shape as the
// franchise page's own Budget Ledger, so a contract reads the same wherever it's shown.
export function PlayerLedgerIdentity({ card, role }) {
  const skillset = skillsetFor(card);
  return (
    <div className="ts-ledger-identity">
      <strong>#{jerseyNumber(card)}</strong>
      <span className="ts-ledger-grade">{playerGrade(card)}</span>
      <span>{skillset?.name || 'No Skillset'}</span>
      {role && <em>{role}</em>}
    </div>
  );
}

export function CostBlocks({ turns, amount }) {
  return (
    <div className="ts-cost-blocks" aria-label={`${turns} turns remaining at ${formatCoins(amount)} each`}>
      {Array.from({ length: Math.max(0, turns || 0) }, (_, index) => (
        <div className="ts-cost-block" key={index}><span>{formatCoins(amount)}</span><small>T{index + 1}</small></div>
      ))}
    </div>
  );
}
