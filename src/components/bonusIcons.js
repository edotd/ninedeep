// Bonus icons for the Lineup & Chemistry page (design: Bonus Icons). Every lineup bonus — the 25
// named skillset pairings, the four stat thresholds, the position bonus (Pace) and Wise Veteran's
// leadership — has its own glyph: a small tapered-stroke drawing built from the helpers below,
// on a tile coloured by what it boosts (offense red, defense navy, both green), with three pips
// for its tier (Core +5, Prime +10, Signature +15). Stat thresholds wear a gold frame; position
// and leadership bonuses are round. The glyph markup is SVG path data in a 24×24 box.

const r2 = n => Math.round(n * 100) / 100;
const prof = {
  mid: t => Math.min(1, t / 0.14, (1 - t) / 0.14),
  start: t => Math.min(1, 0.55 + t / 0.12 * 0.45, (1 - t) / 0.4),
  end: t => Math.min(1, t / 0.4, 0.55 + (1 - t) / 0.12 * 0.45),
};
const sweep = (fn, w = 2.4, p = 'mid', op = 1) => {
  const N = 32, L = [], R = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, [x, y] = fn(t), [xa, ya] = fn(Math.max(0, t - 0.01)), [xb, yb] = fn(Math.min(1, t + 0.01));
    const dx = xb - xa, dy = yb - ya, l = Math.hypot(dx, dy) || 1, hw = Math.max(0.06, w * 0.9 * prof[p](t)) / 2;
    L.push(r2(x - dy / l * hw) + ' ' + r2(y + dx / l * hw)); R.unshift(r2(x + dy / l * hw) + ' ' + r2(y - dx / l * hw));
  }
  return '<path d="M' + L.join(' L') + ' L' + R.join(' L') + ' Z"' + (op < 1 ? ' opacity="' + op + '"' : '') + '/>';
};
const C = (x0, y0, x1, y1, x2, y2, x3, y3, w, p, op) => sweep(t => { const u = 1 - t; return [u*u*u*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3, u*u*u*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3]; }, w, p, op);
const Q = (x0, y0, cx, cy, x2, y2, w, p, op) => sweep(t => { const u = 1 - t; return [u*u*x0 + 2*u*t*cx + t*t*x2, u*u*y0 + 2*u*t*cy + t*t*y2]; }, w, p, op);
const Arc = (cx, cy, r, a0, a1, w, p, op) => sweep(t => { const a = (a0 + (a1 - a0) * t) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }, w, p, op);
const O = (x, y, r = 2.5, op) => Arc(x, y, r, -60, 250, 1.7, 'mid', op);
const X = (x, y, s = 2.5, w = 2.2) => Q(x - s, y - s, x + 0.45 * s, y - 0.45 * s, x + s, y + s, w, 'mid') + Q(x + s, y - s, x + 0.45 * s, y + 0.45 * s, x - s, y + s, w, 'mid');
const dot = (x, y, r = 1.9) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"/>';
const Ar = (x1, y1, x2, y2, w = 2, op = 1, hl = 4.6, hw = 6) => {
  const l = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / l, uy = (y2 - y1) / l, nx = -uy, ny = ux, bx = x2 - ux * hl, by = y2 - uy * hl, s = w / 2, h = hw / 2;
  const pt = (x, y) => r2(x) + ' ' + r2(y);
  return '<path d="M' + [pt(x1 + nx * s, y1 + ny * s), pt(bx + nx * s, by + ny * s), pt(bx + nx * h, by + ny * h), pt(x2, y2), pt(bx - nx * h, by - ny * h), pt(bx - nx * s, by - ny * s), pt(x1 - nx * s, y1 - ny * s)].join(' L') + ' Z"' + (op < 1 ? ' opacity="' + op + '"' : '') + '/>';
};
const box = (x, y, w, h, t = 1.8, op = 1) => '<path fill-rule="evenodd" d="M' + x + ' ' + y + ' h' + w + ' v' + h + ' h' + (-w) + ' Z M' + (x + t) + ' ' + (y + t) + ' v' + (h - 2 * t) + ' h' + (w - 2 * t) + ' v' + (-(h - 2 * t)) + ' Z"' + (op < 1 ? ' opacity="' + op + '"' : '') + '/>';
const hand = (tx = 0, ty = 0, s = 1) => '<g transform="translate(' + tx + ' ' + ty + ') scale(' + s + ')">' +
  '<rect x="7.9" y="5" width="2" height="8" rx="1"/><rect x="10.3" y="3.4" width="2" height="9.6" rx="1"/><rect x="12.7" y="4" width="2" height="9" rx="1"/><rect x="15.1" y="6.2" width="1.9" height="7.4" rx="0.95"/>' +
  '<path d="M7.9 11 H17 V15.5 C17 19.2 15.2 21.5 12.4 21.5 C9.6 21.5 7.9 19.6 7.9 16.5 Z"/>' +
  '<rect x="5.6" y="9.6" width="2.1" height="7" rx="1.05" transform="rotate(-32 6.65 16.6)"/></g>';
const lock = (cx, cy, s = 1) => '<g transform="translate(' + cx + ' ' + cy + ') scale(' + s + ')">' +
  '<path fill-rule="evenodd" d="M-3.6 -1 V-3.4 A3.6 3.6 0 0 1 3.6 -3.4 V-1 H1.9 V-3.4 A1.9 1.9 0 0 0 -1.9 -3.4 V-1 Z"/>' +
  '<path fill-rule="evenodd" d="M-5 -1 H5 V6.5 H-5 Z M-0.8 1.4 A1.2 1.2 0 1 0 0.8 1.4 L0.6 4.4 H-0.6 Z"/></g>';
const F = 0.45;

const G = {
  second: O(4.5, 17.5, 2.3) + O(19.5, 17.5, 2.3) + Q(4.5, 13, 12, 0, 19.5, 13, 2.8, 'mid') + Q(17, 21, 12, 23, 7, 21, 1.6, 'mid', F),
  early: Arc(13, 14, 7.5, -65, 245, 2.4, 'mid') + Q(13, 14.5, 13.5, 12, 16, 10, 2, 'start') + Q(10.5, 3, 13, 2, 15.5, 3, 1.8, 'mid') + Q(1, 10, 3, 9.5, 4.5, 10.5, 1.4, 'mid', F) + Q(0.5, 15, 2.5, 14.5, 4, 15.5, 1.4, 'mid', F),
  extra: Q(13.5, 6, 18, 8, 22.5, 6, 2, 'mid') + Q(15, 7, 16, 10, 17.5, 12.5, 1.3, 'start') + Q(21, 7, 20, 10, 18.5, 12.5, 1.3, 'start') + Q(2, 22, 3, 3, 13.5, 5, 2.8, 'start') + Q(7, 22.5, 9, 9.5, 15.5, 9, 2.2, 'start', F),
  drive: O(12, 3, 1.7) + Q(8.5, 1, 12, 0.7, 15.5, 1, 1.2, 'mid', F) + dot(12, 21.5, 2) + Ar(12, 19, 12, 8.6, 2.2) + Ar(13.6, 9.6, 21.5, 15, 1.7, F) + dot(21.5, 18, 1.8),
  paint: O(12, 3.4, 1.6) + Q(7.5, 1.2, 12, 0.9, 16.5, 1.2, 1.2, 'mid', F) + '<path fill-rule="evenodd" d="M7.6 2.6 H9.2 V13.4 H14.8 V2.6 H16.4 V15 H7.6 Z"/>' + Arc(12, 15, 4.4, 0, 180, 1.5, 'mid', F) + dot(12, 9.5, 2) + Ar(2, 21.5, 9.8, 10.6, 2) + Ar(14.2, 11, 22, 19.5, 1.7, F),
  film: Arc(12, 12, 10, -40, 290, 2.2, 'mid') + '<path d="M8.5 6 Q20 12 8.5 18 Q10.5 12 8.5 6 Z"/>',
  fiveOut: Arc(12, 19, 10.5, 180, 360, 1.3, 'mid', F) + Q(1, 22, 12, 21.6, 23, 22, 1.2, 'mid', F) + O(12, 19, 1.6) + dot(1.8, 18.5) + dot(4.6, 9.6) + dot(12, 4.2) + dot(19.4, 9.6) + dot(22.2, 18.5),
  hot: C(12, 22.5, 4.5, 21.5, 4.5, 12, 10.5, 2, 2.8, 'start') + C(12, 22.5, 19.5, 21.5, 19.5, 13, 15.5, 7.5, 2.4, 'start') + C(12, 19.5, 9.5, 18.5, 9.5, 15, 13, 11.5, 1.6, 'start', 0.7),
  paceSpace: Q(2.5, 12, 12, 12.5, 21.5, 12, 3, 'start') + Q(4, 13, 11, 7, 20, 3.5, 2, 'start', F) + Q(4, 11, 11, 17, 20, 20.5, 2, 'start', F),
  half: Arc(12, 3, 10.5, 15, 165, 1.4, 'mid', F) + Q(1, 22.5, 12, 21.8, 23, 22.5, 1.4, 'mid', F) + Q(9.5, 4.2, 12, 6, 14.5, 4.2, 1.8, 'mid') + Q(10.3, 5, 11, 7.5, 11.6, 9, 1, 'start', 0.7) + Q(13.7, 5, 13, 7.5, 12.4, 9, 1, 'start', 0.7) + dot(3.5, 14.5) + dot(11, 19) + dot(20, 13.5) + Q(5, 16.5, 6.5, 19.5, 9, 19.5, 2, 'start', F) + Q(13, 18.5, 18.5, 18, 19.8, 15.8, 2, 'start', F) + Q(19.5, 11, 18.5, 5, 15, 5.8, 2.8, 'start'),
  empty: Q(10, 1.5, 10, 12, 10, 22.5, 1.3, 'mid', F) + dot(4.5, 5) + dot(4.5, 12) + dot(4.5, 19) + hand(6.6, 1.4, 0.72) + Q(20.5, 3, 22.3, 5.5, 21.6, 8.5, 1.2, 'mid', F),
  twoMan: O(5.5, 17.5) + O(18.5, 6.5) + Q(7.5, 14, 6, 5, 15.5, 5.5, 2.6, 'start') + Q(17, 10, 18.5, 18.5, 9, 18.5, 2, 'start', F),
  hands: hand(0, 0.5) + Q(19.5, 4, 21.5, 7.5, 20.2, 11.5, 1.4, 'mid', F) + Q(4.5, 3.5, 2.6, 6.5, 3.6, 9.5, 1.3, 'mid', F),
  closeout: X(5, 19.5, 2.6) + C(7.5, 16.5, 8.5, 12, 12, 9.5, 15.5, 8.5, 2.8, 'start') + O(18.5, 5.5),
  protect: Q(7, 2, 6.5, 9.5, 7.5, 17, 1.8, 'end') + Q(17, 2, 17.5, 9.5, 16.5, 17, 1.8, 'end') + O(12, 5.2, 1.6) + X(12, 12.5, 2.6) + Q(1.5, 21.5, 12, 19, 22.5, 21.5, 2.2, 'mid', F),
  pressure: Arc(12, 12, 5.6, 0, 360, 1.9, 'mid') + Q(12, 6.4, 9.6, 12, 12, 17.6, 1.4, 'mid') + Q(6.4, 12, 12, 9.8, 17.6, 12, 1.4, 'mid') + Q(12, 1, 12, 2.8, 12, 4.6, 2, 'end') + Q(12, 23, 12, 21.2, 12, 19.4, 2, 'end') + Q(1, 12, 2.8, 12, 4.6, 12, 2, 'end') + Q(23, 12, 21.2, 12, 19.4, 12, 2, 'end') + Q(3.6, 3.6, 4.6, 4.6, 5.8, 5.8, 1.6, 'end', F) + Q(20.4, 3.6, 19.4, 4.6, 18.2, 5.8, 1.6, 'end', F) + Q(3.6, 20.4, 4.6, 19.4, 5.8, 18.2, 1.6, 'end', F) + Q(20.4, 20.4, 19.4, 19.4, 18.2, 18.2, 1.6, 'end', F),
  deny: Q(2.5, 21.5, 5.5, 16, 9.5, 13, 2.2, 'start', F) + Q(8.5, 8.5, 12.5, 10, 14.5, 15, 2.6, 'mid') + lock(17.5, 6.2, 0.95),
  switch: Q(4.5, 9, 12, -0.5, 20, 9.5, 2.6, 'start') + Q(19.5, 15, 12, 24.5, 4, 14.5, 2.6, 'start', 0.7) + X(4, 12, 1.9, 1.8) + X(20, 12, 1.9, 1.8),
  physical: X(7, 12, 3.6, 2.6) + O(17.5, 12, 3.6) + Q(12.25, 4.5, 11, 12, 12.25, 19.5, 2, 'mid', F),
  shrink: Ar(12, 1, 12, 8.6, 2.2) + Ar(12, 23, 12, 15.4, 2.2) + Ar(1, 12, 8.6, 12, 2.2) + Ar(23, 12, 15.4, 12, 2.2) + dot(12, 12, 1.7),
  ice: Q(12, 1.5, 13.2, 12, 12, 22.5, 2.4, 'mid') + Q(2.8, 6.8, 11.5, 11, 21.2, 17.2, 2.4, 'mid') + Q(2.8, 17.2, 12.5, 13, 21.2, 6.8, 2.4, 'mid') + Q(9, 3, 12, 6.5, 15, 3, 1.4, 'mid', F) + Q(9, 21, 12, 17.5, 15, 21, 1.4, 'mid', F),
  weak: Q(12, 1.5, 12.8, 12, 12, 22.5, 1.4, 'mid', F) + O(5.5, 5, 1.7) + X(18.5, 17.5, 2.6) + Q(16, 15, 12.5, 8, 6.5, 9.5, 2.8, 'start'),
  clamp: Q(7.5, 2.5, 0.5, 12, 7.5, 21.5, 2.6, 'mid') + Q(16.5, 2.5, 23.5, 12, 16.5, 21.5, 2.6, 'mid') + lock(12, 11.6, 1),
  eye: Q(1.5, 12.5, 12, 1, 22.5, 12.5, 2.4, 'mid') + Q(1.5, 11.5, 12, 23, 22.5, 11.5, 2.4, 'mid') + O(12, 12, 3) + Q(3, 21.5, 10, 14.5, 21, 2.5, 2.2, 'mid', 0.7),
  fortress: '<path d="M3 20.5 V8.5 H6.6 V11.5 H10.2 V8.5 H13.8 V11.5 H17.4 V8.5 H21 V20.5 H14.6 V16.5 L12 14 L9.4 16.5 V20.5 Z"/>' + Q(1, 22.6, 12, 22.2, 23, 22.6, 1.4, 'mid', F) + Q(12, 2, 12, 4, 12, 6.5, 1.6, 'end', F),
  onslaught: Q(8.5, 2.5, 12, 2, 15.5, 2.5, 1.8, 'mid') + Q(9.2, 3.8, 12, 4.8, 14.8, 3.8, 2, 'mid') + Q(9.6, 4.6, 10.6, 7.5, 11.2, 9.5, 1.2, 'start', 0.7) + Q(14.4, 4.6, 13.4, 7.5, 12.8, 9.5, 1.2, 'start', 0.7) + dot(2.5, 21.5, 1.8) + dot(21.5, 21.5, 1.8) + Q(3.5, 19, 4, 7, 9.2, 5.2, 2.8, 'start') + Q(20.5, 19, 20, 7, 14.8, 5.2, 2.8, 'start') + Q(7, 22.5, 7.5, 13, 10.5, 9.5, 2, 'start', F) + Q(17, 22.5, 16.5, 13, 13.5, 9.5, 2, 'start', F),
  prClinic: Q(8.5, 2, 12, 1.6, 15.5, 2, 1.8, 'mid') + O(12, 4.8, 1.8) + O(5, 20) + O(15, 14) + Q(12.6, 16.6, 15, 18.4, 17.4, 16.6, 2.4, 'mid') + C(6.5, 17.5, 9, 12, 10, 10.5, 7.5, 6.5, 2.8, 'start') + Q(16.5, 11.5, 15.5, 8.5, 13, 7, 2.4, 'start', F),
  glass: '<g transform="rotate(-10 12 9)">' + '<rect x="5" y="3" width="14" height="10" opacity="0.3"/>' + box(5, 3, 14, 10, 1.6) + '<path d="M8 10.5 L11.5 5.5 L12.6 5.5 L9.1 10.5 Z M11 10.5 L13.8 6.5 L14.6 6.5 L11.8 10.5 Z" opacity="0.75"/>' + '</g>' + Ar(12, 23, 12, 15.2, 2.4) + Q(6, 22.5, 6, 19.5, 6, 16.5, 1.4, 'end', F) + Q(18, 22.5, 18, 19.5, 18, 16.5, 1.4, 'end', F),
  iron: Q(1.5, 6.5, 12, 4.5, 22.5, 6.5, 2.6, 'mid') + Q(1.5, 12, 12, 10, 22.5, 12, 2.6, 'mid') + Q(1.5, 17.5, 12, 15.5, 22.5, 17.5, 2.6, 'mid') + Q(12, 6.5, 12.4, 8.5, 12, 11, 1.3, 'mid', F) + Q(7, 12, 7.4, 14, 7, 16.5, 1.3, 'mid', F) + Q(17, 12, 17.4, 14, 17, 16.5, 1.3, 'mid', F),
  pace: Q(3, 3, 9, 8, 11, 12, 2.6, 'start', F) + Q(3, 21, 9, 16, 11, 12, 2.6, 'start', F) + Q(10, 3, 16, 8, 19.5, 12, 2.8, 'start') + Q(10, 21, 16, 16, 19.5, 12, 2.8, 'start'),
  balance: dot(12, 5, 2.4) + dot(5.5, 17.5, 2.4) + dot(18.5, 17.5, 2.4) + Q(12, 7.6, 8, 12, 6.4, 15.1, 1.4, 'mid') + Q(12, 7.6, 16, 12, 17.6, 15.1, 1.4, 'mid') + Q(8.2, 17.5, 12, 17.5, 15.8, 17.5, 1.4, 'mid'),
  veteran: dot(12, 4.4, 2.3) + '<path d="M9.4 7.6 H14.6 L13.8 14.6 H10.2 Z"/>' + Q(9.6, 8.4, 6.2, 10.5, 5.2, 15.6, 1.8, 'mid') + Q(14.4, 8.4, 17.8, 10.5, 18.8, 15.6, 1.8, 'mid') + '<path d="M2.5 17.2 Q12 13.4 21.5 17.2 Q21.5 20.2 12 20.2 Q2.5 20.2 2.5 17.2 Z"/>' + Arc(12, 11, 11, 200, 340, 1.3, 'mid', F) + Q(4, 22.6, 12, 22, 20, 22.6, 1.2, 'mid', F),
};


export const BONUS_GLYPHS = G;

const PAIRS = [
  [1, 5, 'o', 5, 'Second-Side Action', 'second'], [2, 7, 'o', 5, 'Early Offense', 'early'], [1, 24, 'o', 5, 'Extra Shooting Practice', 'extra'],
  [4, 5, 'o', 5, 'Drive and Kick', 'drive'], [4, 8, 'o', 5, 'Paint Touches', 'paint'], [9, 24, 'o', 10, 'Focused Film Session', 'film'],
  [4, 12, 'o', 10, 'Five-Out Attack', 'fiveOut'], [11, 14, 'o', 10, 'Hot Hand', 'hot'], [16, 17, 'o', 10, 'Pace and Space', 'paceSpace'],
  [9, 10, 'o', 15, 'Half-Court Clinic', 'half'], [12, 15, 'o', 15, 'Empty-Side Action', 'empty'], [2, 6, 'o', 15, 'Unstoppable Two-Man Game', 'twoMan'],
  [18, 23, 'd', 5, 'Active Hands', 'hands'], [22, 23, 'd', 5, 'Closeout Drill', 'closeout'], [18, 20, 'd', 5, 'Protect the Paint', 'protect'],
  [19, 23, 'd', 5, 'Ball Pressure', 'pressure'], [1, 23, 'd', 5, 'Deny the Wing', 'deny'], [1, 18, 'd', 10, 'Switch Everything', 'switch'],
  [19, 21, 'd', 10, 'Physical Coverage', 'physical'], [21, 22, 'd', 10, 'Shrink the Floor', 'shrink'], [18, 21, 'd', 10, 'Ice the Screen', 'ice'],
  [19, 22, 'd', 15, 'Weak-Side Help', 'weak'], [21, 23, 'd', 15, 'Clamp Down', 'clamp'], [20, 22, 'd', 15, 'No Easy Looks', 'eye'], [18, 19, 'd', 15, 'Fortress Defense', 'fortress'],
];
const STATS = [['Offensive Onslaught', 'SCO', 'o', 'onslaught'], ['Pick-and-Roll Clinic', 'PLM', 'o', 'prClinic'], ['Glass Control', 'REB', 'd', 'glass'], ['Iron Wall', 'DEF', 'd', 'iron']];
const SIDE = { o: { bg: '#B5431F', ink: '#B5431F', tag: 'OFF' }, d: { bg: '#1E2B47', ink: '#1E2B47', tag: 'DEF' }, b: { bg: '#3F6B52', ink: '#3F6B52', tag: 'OFF & DEF' } };


// name -> { glyph, side: 'o'|'d'|'b', pct, shape: 'square'|'framed'|'round' }
export const BONUS_META = {};
for (const [, , side, pct, name, glyph] of PAIRS) BONUS_META[name] = { glyph, side, pct, shape: 'square' };
for (const [name, , side, glyph] of STATS) BONUS_META[name] = { glyph, side, pct: 15, shape: 'framed' };
BONUS_META.Pace = { glyph: 'pace', side: 'o', pct: 5, shape: 'round' };
BONUS_META['Floor Balance'] = { glyph: 'balance', side: 'b', pct: 3, shape: 'round' };
BONUS_META['Wise Veteran'] = { glyph: 'veteran', side: 'b', pct: 1, shape: 'round' };

export const BONUS_SIDE = SIDE;
