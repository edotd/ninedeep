// Resource icons from the "Resource Icons" design: in-game adjustments (1C whiteboard), scouts
// (1E lens on player) and development points (1H rising bars). Same tapered-stroke construction
// as bonusIcons.js — SVG path data in a 24×24 box, drawn with currentColor on a coloured tile.

const r2 = (n) => Math.round(n * 100) / 100;
const prof = {
  mid: (t) => Math.min(1, t / 0.14, (1 - t) / 0.14),
  start: (t) => Math.min(1, 0.55 + t / 0.12 * 0.45, (1 - t) / 0.4),
  end: (t) => Math.min(1, t / 0.4, 0.55 + (1 - t) / 0.12 * 0.45),
};
const sweep = (fn, w = 2.4, p = 'mid', op = 1) => {
  const N = 32, Lft = [], Rgt = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, [x, y] = fn(t), [xa, ya] = fn(Math.max(0, t - 0.01)), [xb, yb] = fn(Math.min(1, t + 0.01));
    const dx = xb - xa, dy = yb - ya, l = Math.hypot(dx, dy) || 1, hw = Math.max(0.06, w * 0.9 * prof[p](t)) / 2;
    Lft.push(r2(x - dy / l * hw) + ' ' + r2(y + dx / l * hw)); Rgt.unshift(r2(x + dy / l * hw) + ' ' + r2(y - dx / l * hw));
  }
  return '<path d="M' + Lft.join(' L') + ' L' + Rgt.join(' L') + ' Z"' + (op < 1 ? ' opacity="' + op + '"' : '') + '/>';
};
const Q = (x0, y0, cx, cy, x2, y2, w, p, op) => sweep((t) => { const u = 1 - t; return [u * u * x0 + 2 * u * t * cx + t * t * x2, u * u * y0 + 2 * u * t * cy + t * t * y2]; }, w, p, op);
const Ring = (cx, cy, r, w = 2) => '<path fill-rule="evenodd" d="M' + (cx - r) + ' ' + cy + ' a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0 a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0 Z M' + (cx - r + w) + ' ' + cy + ' a' + (r - w) + ' ' + (r - w) + ' 0 1 1 ' + 2 * (r - w) + ' 0 a' + (r - w) + ' ' + (r - w) + ' 0 1 1 ' + (-2 * (r - w)) + ' 0 Z"/>';
const X = (x, y, s = 2.5, w = 2.2) => Q(x - s, y - s, x + 0.45 * s, y - 0.45 * s, x + s, y + s, w, 'mid') + Q(x + s, y - s, x + 0.45 * s, y + 0.45 * s, x - s, y + s, w, 'mid');
const O = (x, y, r = 2.5, op) => sweep((t) => { const a = (-60 + 310 * t) * Math.PI / 180; return [x + r * Math.cos(a), y + r * Math.sin(a)]; }, 1.7, 'mid', op);
const dot = (x, y, r = 1.9, op) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"' + (op ? ' opacity="' + op + '"' : '') + '/>';
const rect = (x, y, w, h, op) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"' + (op ? ' opacity="' + op + '"' : '') + '/>';
const box = (x, y, w, h, t = 1.8) => '<path fill-rule="evenodd" d="M' + x + ' ' + y + ' h' + w + ' v' + h + ' h' + (-w) + ' Z M' + (x + t) + ' ' + (y + t) + ' v' + (h - 2 * t) + ' h' + (w - 2 * t) + ' v' + (-(h - 2 * t)) + ' Z"/>';
const Ar = (x1, y1, x2, y2, w = 2, op = 1, hl = 4.6, hw = 6) => {
  const l = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / l, uy = (y2 - y1) / l, nx = -uy, ny = ux, bx = x2 - ux * hl, by = y2 - uy * hl, s = w / 2, h = hw / 2;
  const pt = (x, y) => r2(x) + ' ' + r2(y);
  return '<path d="M' + [pt(x1 + nx * s, y1 + ny * s), pt(bx + nx * s, by + ny * s), pt(bx + nx * h, by + ny * h), pt(x2, y2), pt(bx - nx * h, by - ny * h), pt(bx - nx * s, by - ny * s), pt(x1 - nx * s, y1 - ny * s)].join(' L') + ' Z"' + (op < 1 ? ' opacity="' + op + '"' : '') + '/>';
};
const F = 0.45;
const clip = (x, y, w, h) => box(x, y, w, h, 1.7) + rect(x + w / 2 - 3.2, y - 2, 6.4, 3.6);

export const RESOURCE_GLYPHS = {
  // 1C — coach's whiteboard with an X-to-O redraw: in-game adjustments.
  adjustments: clip(4, 4, 16, 18.5) + X(9, 10.5, 2.1, 1.9) + O(15.5, 17.5, 2.1) + Q(10.5, 13, 11, 18, 13, 17.8, 1.6, 'start', F) + Ar(11.6, 11.6, 14.5, 14.8, 1.6, 1, 3.2, 4.4),
  // 1E — magnifier over a player: scouts.
  scouts: Ring(10, 10, 7.6, 2.1) + Q(15.4, 15.4, 18.4, 18.4, 21.8, 21.8, 3.4, 'end') + dot(10, 7.6, 1.9) + '<path d="M6.4 14.2 Q6.6 10.6 10 10.6 Q13.4 10.6 13.6 14.2 Z"/>',
  // 1H — rising bars with an up arrow: development points.
  development: rect(3, 16, 5, 6, F) + rect(9.5, 12, 5, 10, 0.7) + rect(16, 8, 5, 14) + Ar(2, 12.5, 16.5, 2, 2.2, 1, 4.6, 6),
};

// Tile colours from the design: bg behind the glyph, fg the glyph itself.
export const RESOURCE_META = {
  adjustments: { label: 'In-game adjustments', bg: '#B5431F', fg: '#F2EBDC' },
  scouts: { label: 'Scouts', bg: '#3F6B52', fg: '#F2EBDC' },
  development: { label: 'Development points', bg: '#F0A03D', fg: '#1E2B47' },
};
