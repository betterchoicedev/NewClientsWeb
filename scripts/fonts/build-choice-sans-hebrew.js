// Choice Sans Hebrew (draft): draws Hebrew letters in Choice Sans' construction
// (monoline straight strokes, flat ends, 30-degree hexagon cuts) and writes a
// merged Latin + Hebrew font per weight.
//
// Run from NewClientsWeb/:  npx -y -p opentype.js@1 -p polygon-clipping@0.15 node scripts/fonts/build-choice-sans-hebrew.js
// Reads src/assets/fonts/ChoiceSans-*.ttf (Latin source, from BetterApp) and writes
// src/assets/fonts/ChoiceSans-*.otf (Latin + Hebrew).
const ot = require('opentype.js');
const pc = require('polygon-clipping');
const fs = require('fs');

const path = require('path');
const SRC = path.join(__dirname, '../../src/assets/fonts/');
const OUT = process.argv[2] || SRC;
const T30 = Math.tan(Math.PI / 6); // 0.577: the font's hexagon slope

// Thicken a polyline into a polygon: miter joins, flat (butt) ends.
function stroke(pts, w) {
  const h = w / 2;
  const n = pts.length;
  const norm = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    return [-dy / l, dx / l];
  };
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    let nx, ny;
    if (i === 0) [nx, ny] = norm(pts[0], pts[1]);
    else if (i === n - 1) [nx, ny] = norm(pts[n - 2], pts[n - 1]);
    else {
      const [ax, ay] = norm(pts[i - 1], pts[i]);
      const [bx, by] = norm(pts[i], pts[i + 1]);
      let mx = ax + bx, my = ay + by;
      const ml = Math.hypot(mx, my);
      mx /= ml; my /= ml;
      const scale = 1 / Math.max(0.25, mx * ax + my * ay); // miter length
      nx = mx * scale; ny = my * scale;
    }
    left.push([pts[i][0] + nx * h, pts[i][1] + ny * h]);
    right.push([pts[i][0] - nx * h, pts[i][1] - ny * h]);
  }
  const ring = [...left, ...right.reverse()];
  ring.push(ring[0]);
  return [ring];
}

// Closed polygon outline as a ring (for the samekh hexagon), stroked inward/outward.
function ringStroke(pts, w) {
  const closed = [...pts, pts[0], pts[1]];
  // stroke the closed path then fill via union of segments (simple + robust)
  const parts = [];
  for (let i = 0; i < pts.length; i++) parts.push(stroke([pts[i], pts[(i + 1) % pts.length]], w));
  // add joint squares so corners are filled
  for (const p of pts) parts.push([[[p[0] - w / 2, p[1] - w / 2], [p[0] + w / 2, p[1] - w / 2], [p[0] + w / 2, p[1] + w / 2], [p[0] - w / 2, p[1] + w / 2], [p[0] - w / 2, p[1] - w / 2]]]);
  return pc.union(...parts);
}

// Letter shapes. Coordinates are stroke CENTERLINES in font units (y up).
// x: 0..W (advance adds side bearings), baseline 0, top line at H.
function letters(w) {
  const sb = 56;                 // side bearing: a touch more air than the Latin (Hebrew strokes are denser)
  const H = 600;                 // Hebrew letter height: between x-height (507) and cap (657); 600 reads at body sizes
  const T = H - w / 2;           // top centerline
  const B = w / 2;               // bottom centerline
  const D = -210;                // descender (final forms, qof)
  const A = 800;                 // ascender (lamed)
  const c = 96;                  // 30-degree corner cut width
  const ct = c * T30;            // ...and its height
  const L = (x) => x;            // readability
  const g = {};
  // Each entry: [advance width, [polylines...]]  (x measured from left bearing)
  const W = 470;                 // standard letter body width (centerline span)
  const lx = w / 2, rx = W - w / 2;

  // Round-cornered right side (top-right turning down), the Hebrew "bet" corner
  const topRight = (x0, x1) => [[x0, T], [x1 - c, T], [x1, T - ct]];

  g['א'] = [W + 40, [
    [[lx, T], [rx + 30, B]],                                 // main diagonal
    [[rx + 20, T], [rx + 20, T - 150], [W * 0.62, T * 0.5]],   // upper-right arm
    [[W * 0.36, T * 0.42], [lx + 10, T * 0.18], [lx + 10, B]], // lower-left leg
  ]];
  g['ב'] = [W + 50, [[...topRight(lx, rx), [rx, B]], [[lx, B], [rx + 60, B]]]];
  g['ג'] = [W * 0.7, [[...topRight(lx, W * 0.7 - w / 2 - 10), [W * 0.7 - w / 2 - 10, B]], [[W * 0.7 - w / 2 - 10, T * 0.42], [lx, B]]]];
  g['ד'] = [W + 30, [[[lx, T], [rx + 50, T]], [[rx - 20, T], [rx - 20, B]]]];
  g['ה'] = [W + 20, [[...topRight(lx, rx), [rx, B]], [[lx + 10, T * 0.62], [lx + 10, B]]]];
  g['ו'] = [190, [[[lx, T], [190 - w / 2 - 30 - c * 0.5, T], [190 - w / 2 - 30, T - ct * 0.5], [190 - w / 2 - 30, B]]]];
  g['ז'] = [W * 0.62, [[[lx, T], [W * 0.62 - w / 2, T]], [[W * 0.31, T], [W * 0.31, B]]]];
  g['ח'] = [W + 20, [[...topRight(lx, rx), [rx, B]], [[lx, T], [lx, B]]]];
  g['ט'] = [W + 20, [[[W * 0.5, T - 150], [W * 0.5, T], [rx - c, T], [rx, T - ct], [rx, B + ct], [rx - c, B], [lx + c, B], [lx, B + ct], [lx, T]]]];
  g['י'] = [200, [[[lx, T], [200 - w / 2 - 30 - c * 0.5, T], [200 - w / 2 - 30, T - ct * 0.5], [200 - w / 2 - 30, T - 230]]]];
  g['כ'] = [W, [[[lx, T], [rx - c, T], [rx, T - ct], [rx, B + ct], [rx - c, B], [lx, B]]]];
  g['ך'] = [W, [[[lx, T], [rx - c, T], [rx, T - ct], [rx, D]]]];
  g['ל'] = [W, [[[lx, A], [lx, T * 0.82], [rx - c, T * 0.82], [rx, T * 0.82 - ct], [rx, T * 0.38], [W * 0.42, B]]]];
  g['מ'] = [W + 50, [[[lx, T], [rx - c, T], [rx, T - ct], [rx + 10, B], [W * 0.38, B]], [[lx, T], [lx, B]]]];
  g['ם'] = [W + 30, [[[lx, B], [lx, T], [rx - c, T], [rx, T - ct], [rx, B], [lx - w / 2, B]]]];
  g['נ'] = [W * 0.66, [[[lx, T], [W * 0.66 - w / 2 - c * 0.7, T], [W * 0.66 - w / 2, T - ct * 0.7], [W * 0.66 - w / 2, B], [lx, B]]]];
  g['ן'] = [200, [[[lx, T], [200 - w / 2 - 30 - c * 0.5, T], [200 - w / 2 - 30, T - ct * 0.5], [200 - w / 2 - 30, D]]]];
  g['ע'] = [W + 30, [[[rx + 10, T], [rx + 10, T * 0.5], [lx - 10, B]], [[lx, T], [W * 0.56, T * 0.36]]]];
  g['פ'] = [W, [[[lx, T], [rx - c, T], [rx, T - ct], [rx, B + ct], [rx - c, B], [lx, B]], [[lx, T], [lx, T - 190], [W * 0.38, T - 190]]]];
  g['ף'] = [W, [[[lx, T], [rx - c, T], [rx, T - ct], [rx, D]], [[lx, T], [lx, T - 190], [W * 0.38, T - 190]]]];
  g['צ'] = [W + 20, [[[lx, T], [rx - 40, B + 10]], [[rx + 10, T], [rx + 10, T * 0.55], [W * 0.62, T * 0.4]], [[lx, B], [rx + 20, B]]]];
  g['ץ'] = [W, [[[lx, T], [rx, T * 0.36]], [[rx, T], [rx, D]]]];
  g['ק'] = [W + 20, [[...topRight(lx, rx), [rx, B]], [[lx + 10, T * 0.62], [lx + 10, D]]]];
  g['ר'] = [W, [[...topRight(lx, rx), [rx, B]]]];
  g['ש'] = [W + 70, [[[lx, T], [lx, B + ct], [lx + c, B], [rx + 70 - c, B], [rx + 70, B + ct], [rx + 70, T]], [[(rx + 70 + lx) / 2, T], [(rx + 70 + lx) / 2, B + 60]]]];
  g['ת'] = [W + 20, [[...topRight(lx + 30, rx), [rx, B]], [[lx + 70, T], [lx + 70, B], [lx - 10, B]]]];
  // samekh: the hexagon, Hebrew height
  g['ס'] = [W + 30, 'hex'];

  // Punctuation
  g['\u05F3'] = [170, [[[110, H + 40], [70, H - 120]]]];                          // geresh
  g['\u05F4'] = [250, [[[110, H + 40], [70, H - 120]], [[190, H + 40], [150, H - 120]]]]; // gershayim
  g['\u05BE'] = [300, [[[40, T], [260, T]]]];                                      // maqaf (top dash)
  // Shekel sign: two interlocking hooks, squared
  g['\u20AA'] = [W + 120, [
    [[lx, B - w / 2], [lx, T], [W * 0.62 - c, T], [W * 0.62, T - ct], [W * 0.62, T * 0.32]],
    [[W * 0.38, T * 0.68], [W * 0.38, B], [rx + 120 - c, B], [rx + 120, B + ct], [rx + 120, T + w / 2]],
  ]];
  return { g, sb, H, w };
}

function hexRing(W, H) {
  // same proportions as the Latin 'o': flat sides, 30-degree top/bottom
  const cx = W / 2, rx = W / 2, rise = rx * T30;
  return [[0, rise], [0, H - rise], [cx, H], [W, H - rise], [W, rise], [cx, 0]];
}

function pathFromMulti(multi, dx) {
  const p = new ot.Path();
  for (const poly of multi) for (const ring of poly) {
    ring.slice(0, -1).forEach(([x, y], i) => (i === 0 ? p.moveTo(x + dx, y) : p.lineTo(x + dx, y)));
    p.close();
  }
  return p;
}

for (const weight of ['Regular', 'Medium']) {
  const src = ot.loadSync(SRC + 'ChoiceSans-' + weight + '.ttf');
  const w = weight === 'Regular' ? 68 : 86;
  const { g, sb, H } = letters(w);
  const glyphs = [];
  for (let i = 0; i < src.glyphs.length; i++) {
    const s = src.glyphs.get(i);
    glyphs.push(new ot.Glyph({ name: s.name || 'g' + i, unicode: s.unicode, unicodes: s.unicodes, advanceWidth: s.advanceWidth, path: s.path }));
  }
  for (const [ch, [adv, lines]] of Object.entries(g)) {
    let multi;
    if (lines === 'hex') {
      const inner = adv - 2 * sb;
      const outer = hexRing(inner, H);
      const t = w; // ring thickness
      const hole = hexRing(inner - 2 * t, H - 2 * t * 1.05).map(([x, y]) => [x + t, y + t * 1.05]);
      multi = pc.difference([[...outer, outer[0]]], [[...hole, hole[0]]]);
    } else {
      multi = pc.union(...lines.map((l) => stroke(l, w)));
    }
    let minX = Infinity, maxX = -Infinity;
    for (const poly of multi) for (const ring of poly) for (const [x] of ring) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    const path = pathFromMulti(multi, sb - minX);
    glyphs.push(new ot.Glyph({ name: 'uni' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'), unicode: ch.codePointAt(0), advanceWidth: Math.round(maxX - minX + sb * 2), path }));
  }
  const font = new ot.Font({
    familyName: 'Choice Sans',
    styleName: weight,
    unitsPerEm: 1000,
    ascender: 900,
    descender: -260,
    glyphs,
    copyright: 'Prototype for BetterChoice, 2026',
    version: '0.2 (Hebrew draft)',
  });
  fs.writeFileSync(path.join(OUT, 'ChoiceSans-' + weight + '.otf'), Buffer.from(font.toArrayBuffer()));
  console.log('wrote', weight, glyphs.length, 'glyphs');
}
