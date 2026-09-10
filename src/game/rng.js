// Shared randomness helpers, ported verbatim from nine-deep.html.
// NOTE: in the multiplayer build these must only ever be called from the single
// "resolver" write path (see /firebase/gameSync.js), never independently on every client.

export function rollWithVariance(center, variance) {
  const min = center - variance, max = center + variance;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function weightedPick(arr) {
  const total = arr.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const item of arr) {
    if (r < item.weight) return item;
    r -= item.weight;
  }
  return arr[arr.length - 1];
}

export function rollDie(sides) {
  sides = sides || 6;
  return 1 + Math.floor(Math.random() * sides);
}

export function rollDieWithAdvantage(sides, advantage) {
  return advantage ? Math.max(rollDie(sides), rollDie(sides)) : rollDie(sides);
}
