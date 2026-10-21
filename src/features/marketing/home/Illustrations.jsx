import React, { useEffect, useId, useRef, useState } from 'react';

// Editorial illustrations for /test: everyday moments with people in them
// (faceless, varied), dressed in the BetterChoice hexagon: honeycomb shelves,
// hex tiles, hex lamps, a hex rug, hex placemats. Window and lamp light, soft
// focus on the background and a fine grain push them toward a photo; daylight
// in light mode, lamps on in dark mode. Motion is CSS (.hx-* in index.css),
// so it is cheap and stops for reduced motion.

const SKIN = ['#F1C9A5', '#E3B08A', '#C68E68', '#8D5A3B'];
const HAIR = ['#2B1D16', '#5A3A22', '#C9A06A', '#151515', '#8A4B2A'];
const SHIRT = { sage: '#8FB59A', clay: '#D07A5A', mustard: '#E2B24F', navy: '#3D5A80', cream: '#EFE6D6', plum: '#8E5A7A', pine: '#2F6B4F' };
const WOOD = 'var(--scene-wood)';
const WOOD_DARK = 'var(--scene-wood-dark)';
const GREEN = 'var(--bc-accent)';
const MARK = 'M-229,-132 L-229,132 L0,265 L229,132 L229,-132 L0,-265 L-84,-216.5 L-84,-146.5 L0,-195 L169,-97.5 L169,97.5 L0,195 L-169,97.5 L-169,-167.5 Z';

/** Pointy-top hexagon (the brand mark's orientation). `sy` squashes it for floors and tables. */
export const hexD = (cx, cy, r, sy = 1) =>
  `${[0, 1, 2, 3, 4, 5]
    .map((k) => {
      const a = ((-90 + 60 * k) * Math.PI) / 180;
      return `${k ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a) * sy).toFixed(1)}`;
    })
    .join(' ')} Z`;

function darken(hex, f = 0.82) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.round(v * f).toString(16).padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

const v = (o) => o; // style helper for CSS custom properties

/* ---------- shared defs ---------- */

/**
 * Ref for a scene's <svg>, plus whether it has come near the screen yet. Scenes
 * draw nothing until then (they are big SVGs), and their CSS loops pause while
 * offscreen. `eager` draws at once (the hero).
 */
export function useOffscreenPause(eager = false) {
  const ref = useRef(null);
  const [near, setNear] = useState(eager || typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => {
      el.setAttribute('data-paused', e.isIntersecting ? 'false' : 'true');
      if (e.isIntersecting) setNear(true);
    }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, near];
}

export function useSceneIds() {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '');
  return ['grain', 'soft', 'blur', 'sky', 'glow', 'vignette', 'wall', 'vol', 'side', 'tiles', 'beam', 'clip'].reduce(
    (o, k) => ({ ...o, [k]: `${k}${raw}` }),
    {},
  );
}

export function SceneDefs({ ids }) {
  const r = 16, w = Math.sqrt(3) * r;
  return (
    <defs>
      <filter id={ids.grain} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncA type="table" tableValues="0 0.09" />
        </feComponentTransfer>
      </filter>
      <filter id={ids.soft}>
        <feGaussianBlur stdDeviation="0.9" />
      </filter>
      <filter id={ids.blur} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="8" />
      </filter>
      <linearGradient id={ids.sky} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--scene-sky-top)" />
        <stop offset="1" stopColor="var(--scene-sky-bottom)" />
      </linearGradient>
      <radialGradient id={ids.glow}>
        <stop offset="0" stopColor="#FFD58A" stopOpacity="0.9" />
        <stop offset="1" stopColor="#FFD58A" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={ids.vignette} cx="0.5" cy="0.45" r="0.75">
        <stop offset="0.6" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.2" />
      </radialGradient>
      <linearGradient id={ids.wall} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.10" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.07" />
      </linearGradient>
      <radialGradient id={ids.vol} cx="0.36" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.28" />
        <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.16" />
      </radialGradient>
      <linearGradient id={ids.side} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.14" />
        <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.18" />
      </linearGradient>
      <linearGradient id={ids.beam} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFF4D6" stopOpacity="0.55" />
        <stop offset="1" stopColor="#FFF4D6" stopOpacity="0" />
      </linearGradient>
      <pattern id={ids.tiles} width={w} height={3 * r} patternUnits="userSpaceOnUse">
        <rect width={w} height={3 * r} fill="var(--scene-tile)" />
        {[[w / 2, r], [0, 2.5 * r], [w, 2.5 * r], [0, -0.5 * r], [w, -0.5 * r]].map(([cx, cy]) => (
          <path key={`${cx}-${cy}`} d={hexD(cx, cy, r - 1.5)} fill="none" stroke="var(--scene-tile-line)" strokeWidth="1.6" />
        ))}
      </pattern>
    </defs>
  );
}

export function Finish({ ids, w, h }) {
  return (
    <g pointerEvents="none">
      <rect width={w} height={h} fill={`url(#${ids.vignette})`} />
      <rect width={w} height={h} filter={`url(#${ids.grain})`} />
    </g>
  );
}

/** Tiny hexagons drifting up through the light, like dust in a sunbeam. */
export function HexDust({ items, color = GREEN, h = -140 }) {
  return (
    <g pointerEvents="none">
      {items.map(([x, y, r, d, dur = 7], i) => (
        <path
          key={i}
          className="hx-rise"
          style={v({ '--d': `${d}s`, '--dur': `${dur}s`, '--h': `${h}px`, '--op': 0.7 })}
          d={hexD(x, y, r)}
          fill="none"
          stroke={color}
          strokeWidth={r > 6 ? 2.2 : 1.6}
        />
      ))}
    </g>
  );
}

function Shadow({ ids, cx, cy, rx, ry }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="var(--scene-shade)" filter={`url(#${ids.blur})`} />;
}

function Steam({ x, y, n = 3, gap = 14, d = 0 }) {
  return (
    <g pointerEvents="none">
      {Array.from({ length: n }, (_, i) => (
        <path
          key={i}
          className="hx-steam"
          style={v({ '--d': `${d + i * 0.9}s` })}
          d={`M${x + i * gap} ${y} q -7 -12 0 -24 q 7 -12 0 -24`}
          fill="none"
          stroke="var(--bc-muted)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

/** Hexagon pendant lamp with a breathing glow. */
function HexLamp({ ids, x, drop = 80, color = SHIRT.mustard, r = 26 }) {
  return (
    <g>
      <circle className="hx-glow" cx={x} cy={drop + r} r="180" fill={`url(#${ids.glow})`} />
      <line x1={x} y1="0" x2={x} y2={drop} stroke="var(--bc-text)" strokeOpacity="0.5" strokeWidth="2" />
      <path d={hexD(x, drop + r * 0.7, r, 0.75)} fill={color} />
      <path d={hexD(x, drop + r * 0.7, r * 0.55, 0.75)} fill="none" stroke="#FFF1C9" strokeOpacity="0.55" strokeWidth="2.5" />
      <ellipse cx={x} cy={drop + r * 1.3} rx={r * 0.6} ry="4" fill="#FFF1C9" />
    </g>
  );
}

/** Honeycomb shelf cell: a thick wooden hexagon. */
function HexCell({ cx, cy, r = 40, children }) {
  return (
    <g>
      <path d={hexD(cx, cy, r)} fill="var(--scene-shade)" opacity="0.35" />
      {children}
      <path d={hexD(cx, cy, r)} fill="none" stroke={WOOD_DARK} strokeWidth="8" strokeLinejoin="round" />
    </g>
  );
}

function Leafy({ x, y, s = 1, d = 0, trailing = false }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="hx-sway" style={v({ '--d': `${d}s`, '--dur': '5s', '--o': trailing ? '50% 0%' : '50% 100%' })}>
        {(trailing
          ? [[-10, 14, 20], [0, 26, 0], [10, 18, -20], [-4, 40, 10], [6, 52, -10]]
          : [[-18, -40, -30], [0, -52, 0], [18, -40, 30], [-10, -30, -55], [12, -28, 55]]
        ).map(([dx, dy, r], i) => (
          <ellipse key={i} cx={dx} cy={dy} rx="9" ry={trailing ? 13 : 22} fill={i % 2 ? '#4F9A55' : '#5BAE4B'} transform={`rotate(${r} ${dx} ${dy})`} />
        ))}
      </g>
      {trailing ? null : <path d="M-18 -14 h36 l-4 26 h-28 z" fill="#C9785B" />}
      {trailing ? null : <path d="M-18 -14 h36 v5 h-36 z" fill={darken('#C9785B')} />}
    </g>
  );
}

function Curtain({ x, y, w, h, flip = false, d = 0 }) {
  const dir = flip ? -1 : 1;
  return (
    <g className="hx-sway" style={v({ '--d': `${d}s`, '--dur': '7s', '--o': '50% 0%', '--a1': '-1deg', '--a2': '1.2deg' })}>
      <path
        d={`M${x} ${y} h${w * dir} q ${-8 * dir} ${h * 0.5} ${4 * dir} ${h} h${-w * dir} q ${-10 * dir} ${-h * 0.5} 0 ${-h} z`}
        fill={SHIRT.cream}
      />
      {[0.3, 0.6].map((f) => (
        <path key={f} d={`M${x + w * f * dir} ${y + 4} q ${-6 * dir} ${h * 0.5} ${2 * dir} ${h - 6}`} stroke="var(--scene-shade)" strokeWidth="3" fill="none" />
      ))}
    </g>
  );
}

/**
 * A figure from the waist up, faceless. Origin is the base of the neck.
 * Arms are drawn by each scene in scene coordinates (so they can move).
 */
function Person({ ids, x, y, s = 1, skin, hair, hairStyle = 'short', shirt, torso = 120, turn = 0, glasses, beard, earring, apron, breathe = true }) {
  const hx = turn * 1.4;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={breathe ? 'hx-breathe' : undefined}>
        {hairStyle === 'long' ? <rect x={-32 + turn} y="-66" width="64" height="86" rx="28" fill={hair} /> : null}
        <path d={`M-48 ${torso} L-46 24 Q-44 2 -22 0 L22 0 Q44 2 46 24 L48 ${torso} Z`} fill={shirt} />
        <path d={`M-48 ${torso} L-46 24 Q-44 2 -22 0 L22 0 Q44 2 46 24 L48 ${torso} Z`} fill={`url(#${ids.side})`} />
        <path d="M-14 0 Q0 14 14 0" fill="none" stroke={darken(shirt, 0.75)} strokeWidth="3" />
        {apron ? (
          <g>
            <path d="M-26 36 h52 l8 96 h-68 z" fill={SHIRT.cream} />
            <path d="M-20 36 L-9 2 M20 36 L9 2" stroke={SHIRT.cream} strokeWidth="4" />
            <path d="M-14 74 h28 v20 h-28 z" fill="none" stroke="var(--scene-shade)" strokeWidth="2" />
            <path d={hexD(0, 84, 7)} fill="none" stroke="#1FB25A" strokeWidth="2.4" />
          </g>
        ) : null}
        <rect x="-8" y="-12" width="16" height="15" fill={skin} />
        <rect x="-8" y="-12" width="16" height="6" fill="#000" opacity="0.08" />
      </g>
      {hairStyle === 'curly'
        ? [[-22, -50], [-8, -62], [8, -62], [22, -50], [-28, -34], [28, -34], [0, -56]].map(([cx, cy]) => <circle key={`${cx}${cy}`} cx={cx + turn} cy={cy} r="14" fill={hair} />)
        : <circle cx={turn} cy="-38" r="30" fill={hair} />}
      <circle cx={hx - (turn >= 0 ? 25 : -25)} cy="-30" r="6" fill={skin} />
      {earring ? <circle cx={hx - (turn >= 0 ? 25 : -25)} cy="-21" r="3" fill="#E7C14A" /> : null}
      <circle cx={hx} cy="-32" r="27" fill={skin} />
      <circle cx={hx} cy="-32" r="27" fill={`url(#${ids.vol})`} />
      {beard ? <path d={`M${hx - 24} -30 q 2 30 24 34 q 22 -4 24 -34 q -8 12 -24 12 q -16 0 -24 -12 z`} fill={hair} /> : null}
      {hairStyle === 'bun' ? (
        <g>
          <circle cx={turn - 6} cy="-70" r="14" fill={hair} />
          <rect x={turn - 16} y="-60" width="20" height="5" rx="2.5" fill={SHIRT.clay} />
        </g>
      ) : null}
      {hairStyle !== 'curly' ? <path d={`M${hx - 27} -38 q ${10} -26 ${36} -22 q 14 2 18 14 q -14 -10 -30 -4 q -14 6 -24 12 z`} fill={hair} /> : null}
      {glasses ? (
        <g fill="none" stroke="#2B2B2B" strokeWidth="2.6">
          <circle cx={hx - 10} cy="-32" r="8" />
          <circle cx={hx + 10} cy="-32" r="8" />
          <path d={`M${hx - 2} -32 h4`} />
        </g>
      ) : null}
    </g>
  );
}

/** Upper arm in the sleeve, forearm in skin (rolled) or sleeve, then the hand. */
function Arm({ from, elbow, to, sleeve, skin, rolled = false, w = 17 }) {
  return (
    <g>
      <path d={`M${from[0]} ${from[1]} L${elbow[0]} ${elbow[1]}`} stroke={sleeve} strokeWidth={w} strokeLinecap="round" />
      <path d={`M${elbow[0]} ${elbow[1]} L${to[0]} ${to[1]}`} stroke={rolled ? skin : sleeve} strokeWidth={w - 3} strokeLinecap="round" />
      {rolled ? <circle cx={elbow[0]} cy={elbow[1]} r={w / 2 + 0.5} fill={darken(sleeve, 0.85)} /> : null}
      <circle cx={to[0]} cy={to[1]} r={w / 2 + 1} fill={skin} />
    </g>
  );
}

/* ---------- Kitchen: someone cooking, the plan on the counter ---------- */

export function KitchenScene({ className = '' }) {
  const ids = useSceneIds();
  const [pauseRef, near] = useOffscreenPause(true);
  if (!near) return <svg ref={pauseRef} viewBox="0 0 800 600" className={className} aria-hidden="true" />;
  const cook = { skin: SKIN[1], hair: HAIR[1] };
  const P = { x: 250, y: 238, s: 1.15 };
  const L = (lx, ly) => [P.x + lx * P.s, P.y + ly * P.s];
  return (
    <svg ref={pauseRef} viewBox="0 0 800 600" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <SceneDefs ids={ids} />
      <clipPath id={ids.clip}>
        <rect x="74" y="64" width="262" height="242" />
      </clipPath>
      <g>
        <rect width="800" height="600" fill="var(--scene-bg)" />
        <rect width="800" height="600" fill={`url(#${ids.wall})`} />
        {/* hex tile backsplash */}
        <rect x="350" y="236" width="450" height="136" fill={`url(#${ids.tiles})`} />
        {/* window with the day outside */}
        <rect x="60" y="50" width="290" height="270" rx="8" fill={WOOD_DARK} />
        <g clipPath={`url(#${ids.clip})`}>
          <rect x="74" y="64" width="262" height="242" fill={`url(#${ids.sky})`} />
          <circle className="hx-bob" style={v({ '--a': '-4px', '--dur': '6s' })} cx="270" cy="128" r="22" fill="var(--scene-orb)" />
          <path d="M74 250 q 70 -34 140 -10 q 70 -26 122 4 v 62 h -262 z" fill="#5BAE4B" opacity="0.5" />
          <path d="M74 276 q 90 -22 170 -2 q 50 -14 92 0 v 32 h -262 z" fill="#3F8E3A" opacity="0.4" />
          {[[96, 238, 16], [130, 226, 22], [300, 236, 18]].map(([tx, ty, tr]) => (
            <g key={tx}>
              <rect x={tx - 2} y={ty} width="4" height="22" fill="#5A3A22" opacity="0.6" />
              <circle cx={tx} cy={ty - 4} r={tr * 0.7} fill="#3F8E3A" opacity="0.55" />
            </g>
          ))}
          {[0, 6].map((d) => (
            <g key={d} className="hx-fly" style={v({ '--d': `${d}s` })}>
              <g transform={`translate(100 ${110 + d * 4})`}>
                <path className="hx-flap" d="M0 0 q 6 -6 12 0 q 6 -6 12 0" fill="none" stroke="#2B2B2B" strokeWidth="2.2" strokeLinecap="round" />
              </g>
            </g>
          ))}
        </g>
        <rect x="202" y="64" width="7" height="242" fill={WOOD_DARK} />
        <rect x="74" y="182" width="262" height="7" fill={WOOD_DARK} />
        <Curtain x={48} y={40} w={46} h={290} d={0} />
        <Curtain x={362} y={40} w={46} h={290} flip d={1.5} />
        <rect x="36" y="34" width="340" height="8" rx="4" fill={WOOD_DARK} />
        <rect x="48" y="316" width="314" height="12" rx="3" fill={WOOD_DARK} />
        {/* herbs on the sill */}
        <Leafy x={100} y={312} s={0.65} d={0.2} />
        <Leafy x={140} y={312} s={0.55} d={1.1} />
        {/* light through the window */}
        <path d="M350 80 L600 140 L640 372 L372 372 Z" fill={`url(#${ids.beam})`} style={{ mixBlendMode: 'screen', opacity: 'var(--scene-beam)' }} />
        <path d="M350 80 L600 140 L640 372 L372 372 Z" fill="var(--scene-sun)" />
        {/* honeycomb shelves */}
        <HexCell cx={654} cy={140} r={40}>
          <rect x="640" y="134" width="28" height="30" rx="6" fill="#F2DE8F" />
          <rect x="638" y="128" width="32" height="8" rx="3" fill={WOOD_DARK} />
        </HexCell>
        <HexCell cx={724} cy={140} r={40}>
          <Leafy x={724} y={166} s={0.55} d={0.7} />
        </HexCell>
        <HexCell cx={689} cy={201} r={40}>
          <ellipse cx="689" cy="222" rx="22" ry="5" fill="#EFE6D6" />
          <ellipse cx="689" cy="216" rx="20" ry="5" fill="#E9D6AE" />
          <ellipse cx="689" cy="210" rx="18" ry="5" fill="#8FB59A" />
        </HexCell>
        <Leafy x={762} y={176} s={0.6} trailing d={0.4} />
        <HexLamp ids={ids} x={520} drop={60} />
        {/* utensil rail */}
        <rect x="392" y="250" width="110" height="5" rx="2.5" fill="#9AA39E" />
        {[
          ['M0 0 v34 m-7 0 h14 v12 h-14 z', 404],
          ['M0 0 v40 m0 0 a9 9 0 1 0 0.1 0', 434],
          ['M0 0 v20 m0 0 q -9 12 0 28 q 9 -16 0 -28', 464],
        ].map(([d, ux], i) => (
          <g key={ux} transform={`translate(${ux} 255)`}>
            <path className="hx-sway" style={v({ '--o': '50% 0%', '--d': `${i * 0.6}s`, '--dur': '3.5s', '--a1': '-4deg', '--a2': '4deg' })} d={d} fill="none" stroke="#7E8A84" strokeWidth="3.4" strokeLinecap="round" />
          </g>
        ))}
        <HexDust items={[[420, 330, 4, 0], [480, 300, 3, 2], [540, 340, 5, 4], [450, 260, 3, 5.5], [580, 310, 4, 1.2], [510, 280, 3, 3.3]]} color="#FFF4D6" h={-110} />
      </g>
      {/* the cook */}
      <Person ids={ids} {...P} {...cook} hairStyle="bun" shirt={SHIRT.sage} torso={130} turn={6} earring apron />
      {/* counter */}
      <rect x="0" y="372" width="800" height="18" fill={WOOD} />
      <rect x="0" y="372" width="800" height="4" fill="#FFFFFF" opacity="0.25" />
      <rect x="0" y="390" width="800" height="210" fill="var(--scene-cabinet)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x={14 + i * 160} y="408" width="132" height="176" rx="6" fill="none" stroke="var(--scene-shade)" strokeWidth="3" />
          <path d={hexD(80 + i * 160, 424, 6)} fill={WOOD_DARK} />
        </g>
      ))}
      {/* towel on a handle */}
      <g className="hx-sway" style={v({ '--o': '50% 0%', '--dur': '5s', '--a1': '-2deg', '--a2': '2deg' })}>
        <path d="M228 420 h34 v64 h-34 z" fill={SHIRT.pine} />
        {[436, 450, 464].map((ty) => <rect key={ty} x="228" y={ty} width="34" height="3" fill={SHIRT.cream} opacity="0.6" />)}
      </g>
      {/* stove and pot */}
      <rect x="470" y="364" width="170" height="10" rx="3" fill="#2A2A2A" />
      <Shadow ids={ids} cx={560} cy={366} rx={60} ry={6} />
      <rect x="516" y="318" width="88" height="48" rx="10" fill={SHIRT.pine} />
      <rect x="516" y="318" width="88" height="48" rx="10" fill={`url(#${ids.side})`} />
      <rect x="500" y="330" width="18" height="7" rx="3" fill="#1F4A36" />
      <rect x="602" y="330" width="18" height="7" rx="3" fill="#1F4A36" />
      <g className="hx-bob" style={v({ '--a': '-2px', '--dur': '0.8s' })}>
        <ellipse cx="560" cy="318" rx="46" ry="8" fill="#9AA39E" />
        <circle cx="560" cy="310" r="6" fill="#2A2A2A" />
      </g>
      <Steam x={538} y={300} n={3} gap={20} />
      {/* fruit bowl and oil */}
      <Shadow ids={ids} cx={712} cy={374} rx={60} ry={7} />
      <circle cx="694" cy="342" r="15" fill="#E0533D" />
      <circle cx="720" cy="338" r="16" fill="#F2B43C" />
      <circle cx="736" cy="352" r="12" fill="#5BAE4B" />
      <path d="M664 348 q 50 46 100 0 z" fill="var(--scene-bowl)" />
      <rect x="646" y="304" width="22" height="68" rx="7" fill="#B9A24A" opacity="0.9" />
      <rect x="652" y="290" width="10" height="18" rx="3" fill="#7A6A2A" />
      {/* the board */}
      <Shadow ids={ids} cx={350} cy={376} rx={95} ry={7} />
      <rect x="262" y="360" width="180" height="14" rx="5" fill="#E8C99A" />
      <rect x="262" y="360" width="180" height="4" rx="2" fill="#FFFFFF" opacity="0.3" />
      <circle cx="288" cy="352" r="11" fill="#E0533D" />
      <path d="M284 342 q 4 -6 8 0" stroke="#3F8E3A" strokeWidth="3" fill="none" />
      {[392, 404, 416, 428].map((cx, i) => (
        <circle key={cx} className="hx-bob" style={v({ '--a': '-3px', '--dur': '0.9s', '--d': `${i * 0.05}s` })} cx={cx} cy="356" r="6" fill="#B5DB86" stroke="#5B8E3A" strokeWidth="2" />
      ))}
      <path d="M318 360 l 30 -5 l 2 5 z" fill="#F08A3C" />
      {/* arms: the far hand steadies, the near hand chops */}
      <Arm from={L(-40, 22)} elbow={L(-30, 74)} to={[300, 350]} sleeve={darken(SHIRT.sage, 0.88)} skin={cook.skin} rolled />
      <Arm from={L(42, 22)} elbow={L(66, 70)} to={L(66, 70)} sleeve={SHIRT.sage} skin={cook.skin} />
      <g className="hx-rot" style={v({ '--o': '0% 0%', '--a': '-9deg', '--dur': '0.9s' })}>
        <path d={`M${L(66, 70)[0]} ${L(66, 70)[1]} L372 346`} stroke={cook.skin} strokeWidth="14" strokeLinecap="round" />
        <circle cx={L(66, 70)[0]} cy={L(66, 70)[1]} r="9" fill={darken(SHIRT.sage, 0.85)} />
        <circle cx="372" cy="346" r="9.5" fill={cook.skin} />
        <path d="M376 340 L410 350 L380 352 Z" fill="#C9D1CD" />
      </g>
      <Finish ids={ids} w={800} h={600} />
    </svg>
  );
}

/* ---------- Couch: the evening check-in ---------- */

export function CouchScene({ className = '' }) {
  const ids = useSceneIds();
  const [pauseRef, near] = useOffscreenPause();
  if (!near) return <svg ref={pauseRef} viewBox="0 0 800 500" className={className} aria-hidden="true" />;
  const p = { skin: SKIN[2], hair: HAIR[3] };
  const P = { x: 420, y: 198, s: 1.05 };
  const L = (lx, ly) => [P.x + lx * P.s, P.y + ly * P.s];
  const phone = L(4, 54);
  return (
    <svg ref={pauseRef} viewBox="0 0 800 500" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <SceneDefs ids={ids} />
      <clipPath id={ids.clip}>
        <rect x="52" y="62" width="126" height="196" />
      </clipPath>
      <g>
        <rect width="800" height="500" fill="var(--scene-bg)" />
        <rect width="800" height="500" fill={`url(#${ids.wall})`} />
        {/* window: sun by day, moon and stars at night */}
        <rect x="40" y="50" width="150" height="220" rx="6" fill={WOOD_DARK} />
        <g clipPath={`url(#${ids.clip})`}>
          <rect x="52" y="62" width="126" height="196" fill={`url(#${ids.sky})`} />
          <circle cx="140" cy="104" r="16" fill="var(--scene-orb)" />
          {[[70, 80, 0], [100, 120, 0.8], [160, 150, 1.6], [80, 160, 0.4], [120, 76, 1.2]].map(([sx, sy, d]) => (
            <circle key={sx + sy} className="hx-twinkle" style={v({ '--d': `${d}s`, opacity: 'var(--scene-stars)' })} cx={sx} cy={sy} r="2" fill="#FFFFFF" />
          ))}
          <path d="M52 220 l 18 -30 l 18 30 z M84 230 l 22 -40 l 22 40 z M120 226 l 18 -28 l 18 28 z" fill="#3F8E3A" opacity="0.55" />
          <rect x="52" y="226" width="126" height="40" fill="#3F8E3A" opacity="0.35" />
        </g>
        <rect x="112" y="62" width="6" height="196" fill={WOOD_DARK} />
        <Curtain x={30} y={40} w={34} h={250} d={0.5} />
        <Curtain x={200} y={40} w={34} h={250} flip d={2} />
        <rect x="24" y="34" width="216" height="7" rx="3.5" fill={WOOD_DARK} />
        {/* gallery wall: the mark, framed */}
        <rect x="262" y="70" width="110" height="110" rx="4" fill={WOOD_DARK} />
        <rect x="270" y="78" width="94" height="94" fill="var(--scene-cloth)" />
        <path d={MARK} transform="translate(317 125) scale(0.13)" fill="none" stroke={GREEN} strokeWidth="38" />
        <path d={hexD(408, 96, 24)} fill={SHIRT.clay} stroke={WOOD_DARK} strokeWidth="5" />
        <path d={hexD(408, 152, 20)} fill={SHIRT.sage} stroke={WOOD_DARK} strokeWidth="5" />
        <path d={hexD(408, 152, 9)} fill="none" stroke={SHIRT.cream} strokeWidth="3" />
        {/* honeycomb shelves with books */}
        <HexCell cx={540} cy={104} r={34}>
          {[0, 1, 2, 3].map((i) => <rect key={i} x={524 + i * 8} y={96 - (i % 2) * 4} width="7" height={30 + (i % 2) * 4} fill={[SHIRT.clay, SHIRT.navy, SHIRT.mustard, SHIRT.sage][i]} />)}
        </HexCell>
        <HexCell cx={600} cy={104} r={34}>
          <Leafy x={600} y={128} s={0.48} d={1} />
        </HexCell>
        <HexCell cx={570} cy={156} r={34}>
          <rect x="562" y="160" width="16" height="16" rx="3" fill="#FFF8EA" />
          <path className="hx-flicker" d="M570 160 q -5 -7 0 -15 q 5 8 0 15 z" fill="#F7B733" />
        </HexCell>
        {/* floor lamp with a hex shade */}
        <circle className="hx-glow" cx="700" cy="160" r="220" fill={`url(#${ids.glow})`} />
        <rect x="696" y="160" width="7" height="250" fill="var(--bc-text)" opacity="0.55" />
        <path d={hexD(700, 140, 38, 0.7)} fill={SHIRT.mustard} />
        <ellipse cx="700" cy="410" rx="30" ry="6" fill="var(--bc-text)" opacity="0.45" />
        {/* floor and hex rug */}
        <rect x="0" y="400" width="800" height="100" fill={WOOD} />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x={i * 110} y="400" width="2" height="100" fill="var(--scene-shade)" />)}
        <path d={hexD(420, 452, 300, 0.16)} fill={SHIRT.clay} opacity="0.4" />
        <path d={hexD(420, 452, 220, 0.16)} fill="none" stroke={SHIRT.cream} strokeOpacity="0.6" strokeWidth="4" />
        <path d={hexD(420, 452, 120, 0.16)} fill="none" stroke={SHIRT.cream} strokeOpacity="0.5" strokeWidth="3" />
        {/* monstera in the corner */}
        <g transform="translate(70 400)">
          <g className="hx-sway" style={v({ '--dur': '6s', '--a1': '-2deg', '--a2': '2deg' })}>
            {[[-26, -90, -30, 34], [8, -120, 10, 40], [32, -76, 40, 30], [-6, -60, -10, 26]].map(([dx, dy, r, rx], i) => (
              <g key={i}>
                <path d={`M0 -10 Q ${dx / 2} ${dy / 2} ${dx} ${dy}`} stroke="#3F8E3A" strokeWidth="3" fill="none" />
                <ellipse cx={dx} cy={dy} rx={rx} ry={rx * 0.7} fill={i % 2 ? '#3F8E3A' : '#4F9A55'} transform={`rotate(${r} ${dx} ${dy})`} />
              </g>
            ))}
          </g>
          <path d="M-26 -20 h52 l-6 40 h-40 z" fill={SHIRT.cream} />
          <path d={hexD(0, 0, 9)} fill="none" stroke={GREEN} strokeWidth="2.4" />
        </g>
        {/* sofa back */}
        <Shadow ids={ids} cx={410} cy={404} rx={250} ry={12} />
        <rect x="190" y="200" width="440" height="130" rx="34" fill="var(--scene-sofa)" />
        <rect x="190" y="200" width="440" height="130" rx="34" fill={`url(#${ids.wall})`} />
      </g>
      {/* the person */}
      <Person ids={ids} {...P} {...p} hairStyle="curly" shirt={SHIRT.mustard} torso={108} turn={4} />
      {/* legs folded on the seat */}
      <path d={`M${L(-14, 104)[0]} ${L(-14, 104)[1]} L${L(92, 112)[0]} ${L(92, 112)[1]}`} stroke={SHIRT.navy} strokeWidth="40" strokeLinecap="round" />
      <path d={`M${L(92, 112)[0]} ${L(92, 112)[1]} L${L(104, 196)[0]} ${L(104, 196)[1]}`} stroke={SHIRT.navy} strokeWidth="32" strokeLinecap="round" />
      <ellipse cx={L(114, 200)[0]} cy={L(114, 200)[1]} rx="22" ry="10" fill="#F4EEE4" />
      {/* arms and phone */}
      <Arm from={L(-40, 22)} elbow={L(-42, 70)} to={[phone[0] - 10, phone[1] + 6]} sleeve={darken(SHIRT.mustard, 0.86)} skin={p.skin} rolled />
      <rect x={phone[0] - 12} y={phone[1] - 22} width="26" height="42" rx="5" fill="#0B0F0D" transform={`rotate(-8 ${phone[0]} ${phone[1]})`} />
      <rect x={phone[0] - 9} y={phone[1] - 18} width="20" height="34" rx="3" fill="#81C784" opacity="0.9" transform={`rotate(-8 ${phone[0]} ${phone[1]})`} />
      <Arm from={L(42, 22)} elbow={L(46, 72)} to={[phone[0] + 10, phone[1] + 8]} sleeve={SHIRT.mustard} skin={p.skin} rolled />
      <circle className="hx-twinkle" style={v({ '--dur': '3s' })} cx={phone[0]} cy={phone[1] - 4} r="46" fill="#81C784" fillOpacity="0.16" filter={`url(#${ids.blur})`} />
      {/* little hex badges rising from the phone */}
      {[['🔥', 0], ['✓', 1.6], ['🌿', 3.2]].map(([t, d], i) => (
        <g key={t} className="hx-rise" style={v({ '--d': `${d}s`, '--dur': '4.8s', '--h': '-120px', '--op': 1 })}>
          <path d={hexD(phone[0] + 58 + i * 20, phone[1] - 6, 14)} fill="#1A241F" stroke={GREEN} strokeWidth="2" />
          <text x={phone[0] + 58 + i * 20} y={phone[1] - 1} textAnchor="middle" fontSize="13" fill="#81C784" fontWeight="800">{t}</text>
        </g>
      ))}
      {/* sofa seat, arms, cushions, blanket, cat */}
      <g>
        <rect x="176" y="296" width="468" height="70" rx="22" fill="var(--scene-sofa-dark)" />
        <rect x="160" y="240" width="60" height="132" rx="26" fill="var(--scene-sofa)" />
        <rect x="600" y="240" width="60" height="132" rx="26" fill="var(--scene-sofa)" />
        <path d="M150 248 h70 v96 q -18 10 -36 0 q -18 10 -34 0 z" fill={SHIRT.pine} />
        {[270, 290, 310].map((by) => <rect key={by} x="150" y={by} width="70" height="4" fill={SHIRT.cream} opacity="0.55" />)}
        <g transform="rotate(-8 268 263)">
          <rect x="226" y="228" width="84" height="70" rx="20" fill={SHIRT.sage} />
          <path d={hexD(268, 263, 16)} fill="none" stroke={SHIRT.cream} strokeWidth="3" />
        </g>
        <rect x="200" y="372" width="10" height="28" fill={WOOD_DARK} />
        <rect x="610" y="372" width="10" height="28" fill={WOOD_DARK} />
      </g>
      <g>
        <ellipse cx="560" cy="290" rx="34" ry="16" fill="#E2A15A" />
        <circle cx="584" cy="276" r="13" fill="#E2A15A" />
        <path d="M576 266 l 3 -10 l 6 8 z M588 266 l 5 -9 l 3 10 z" fill="#E2A15A" />
        <path d="M546 286 q 6 -4 12 0 M556 292 q 6 -4 12 0" stroke="#C9813F" strokeWidth="2.4" fill="none" />
        <path className="hx-sway" style={v({ '--o': '100% 50%', '--dur': '2.2s', '--a1': '-14deg', '--a2': '12deg' })} d="M528 292 q -24 -4 -26 -24" stroke="#E2A15A" strokeWidth="7" strokeLinecap="round" fill="none" />
      </g>
      {/* coffee table */}
      <Shadow ids={ids} cx={300} cy={430} rx={90} ry={8} />
      <path d={hexD(300, 404, 84, 0.18)} fill={WOOD_DARK} />
      <rect x="230" y="406" width="8" height="24" fill={WOOD_DARK} />
      <rect x="362" y="406" width="8" height="24" fill={WOOD_DARK} />
      <rect x="258" y="378" width="22" height="22" rx="6" fill={GREEN} />
      <Steam x={264} y={372} n={2} gap={10} />
      <rect x="300" y="390" width="46" height="7" rx="2" fill={SHIRT.navy} />
      <rect x="304" y="383" width="40" height="7" rx="2" fill={SHIRT.clay} />
      <Finish ids={ids} w={800} h={500} />
    </svg>
  );
}

/* ---------- Friday dinner: the plan works at the family table too ---------- */

export function DinnerScene({ className = '' }) {
  const ids = useSceneIds();
  const [pauseRef, near] = useOffscreenPause();
  if (!near) return <svg ref={pauseRef} viewBox="0 0 900 360" className={className} aria-hidden="true" />;
  const people = [
    { x: 170, skin: SKIN[0], hair: HAIR[2], hairStyle: 'long', shirt: SHIRT.navy, turn: 8, earring: true },
    { x: 350, skin: SKIN[2], hair: HAIR[0], hairStyle: 'short', shirt: SHIRT.clay, turn: 4, beard: true },
    { x: 550, skin: SKIN[3], hair: HAIR[3], hairStyle: 'bun', shirt: SHIRT.sage, turn: -4, glasses: true },
    { x: 730, skin: SKIN[1], hair: HAIR[4], hairStyle: 'curly', shirt: SHIRT.plum, turn: -8 },
  ];
  const Y = 190;
  return (
    <svg ref={pauseRef} viewBox="0 0 900 360" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <SceneDefs ids={ids} />
      <g>
        <rect width="900" height="360" fill="var(--scene-bg)" />
        <rect width="900" height="360" fill={`url(#${ids.wall})`} />
        {/* lower wall in hex tiles */}
        <rect x="0" y="190" width="900" height="90" fill={`url(#${ids.tiles})`} />
        <rect x="0" y="186" width="900" height="6" fill={WOOD_DARK} />
        {/* gallery: the mark between two hex prints */}
        <path d={hexD(450, 104, 46)} fill={WOOD_DARK} />
        <path d={hexD(450, 104, 39)} fill="var(--scene-cloth)" />
        <path d={MARK} transform="translate(450 104) scale(0.095)" fill="none" stroke={GREEN} strokeWidth="44" />
        <path d={hexD(376, 118, 26)} fill={SHIRT.clay} stroke={WOOD_DARK} strokeWidth="5" />
        <path d={hexD(524, 118, 26)} fill={SHIRT.mustard} stroke={WOOD_DARK} strokeWidth="5" />
        <path d={hexD(524, 118, 11)} fill="none" stroke={SHIRT.cream} strokeWidth="3" />
        {/* string lights with hex bulbs */}
        <path d="M0 26 Q 225 70 450 30 Q 675 70 900 26" fill="none" stroke="var(--bc-text)" strokeOpacity="0.35" strokeWidth="1.6" />
        {Array.from({ length: 15 }, (_, i) => {
          const t = (i + 0.5) / 15;
          const half = t < 0.5 ? t * 2 : (t - 0.5) * 2;
          const bx = t * 900;
          const by = (t < 0.5 ? 26 : 30) + 4 * half * (1 - half) * 40 + 6;
          return <path key={i} className="hx-twinkle" style={v({ '--d': `${(i % 5) * 0.5}s` })} d={hexD(bx, by, 5)} fill="#FFD58A" />;
        })}
        <HexLamp ids={ids} x={260} drop={46} color={SHIRT.cream} r={22} />
        <HexLamp ids={ids} x={640} drop={46} color={SHIRT.cream} r={22} />
      </g>
      {people.map((pp) => (
        <Person key={pp.x} ids={ids} y={Y} s={1} torso={110} {...pp} />
      ))}
      {/* table */}
      <rect x="0" y="270" width="900" height="30" fill="var(--scene-cloth)" />
      <rect x="0" y="300" width="900" height="60" fill="var(--scene-cloth)" />
      <rect x="0" y="300" width="900" height="5" fill="var(--scene-shade)" />
      <rect x="0" y="318" width="900" height="16" fill={`url(#${ids.tiles})`} opacity="0.6" />
      {people.map((pp) => (
        <g key={`m${pp.x}`}>
          <path d={hexD(pp.x, 292, 50, 0.22)} fill={SHIRT.sage} opacity="0.35" />
          <ellipse cx={pp.x} cy="292" rx="36" ry="8" fill="var(--scene-plate-rim)" />
          <ellipse cx={pp.x} cy="290" rx="27" ry="5.5" fill="var(--scene-plate)" />
        </g>
      ))}
      {/* dishes */}
      <g>
        <ellipse cx="450" cy="284" rx="56" ry="10" fill={WOOD_DARK} />
        {[-30, -10, 10, 30].map((dx, i) => (
          <ellipse key={dx} cx={450 + dx} cy={274 - (i % 2) * 3} rx="16" ry="11" fill="#D9A04E" />
        ))}
        {[-30, -10, 10, 30].map((dx) => <path key={dx} d={`M${442 + dx} 270 q 8 -6 16 0`} stroke="#B97E3A" strokeWidth="2" fill="none" />)}
        <Steam x={436} y={258} n={2} gap={28} d={0.4} />
        {[400, 500].map((cx, i) => (
          <g key={cx}>
            <rect x={cx - 6} y="246" width="12" height="16" rx="2" fill="#C9CFCB" />
            <rect x={cx - 4} y="206" width="8" height="42" fill="#FFF8EA" />
            <path className="hx-flicker" style={v({ '--d': `${i * 0.4}s` })} d={`M${cx} 206 q -7 -10 0 -22 q 7 12 0 22 z`} fill="#F7B733" />
            <circle className="hx-twinkle" style={v({ '--dur': '1.6s', '--d': `${i * 0.3}s` })} cx={cx} cy="194" r="24" fill={`url(#${ids.glow})`} />
          </g>
        ))}
        <path d="M244 286 q 32 28 64 0 z" fill="var(--scene-bowl)" />
        {[252, 266, 280, 294].map((cx, i) => <ellipse key={cx} cx={cx} cy={283} rx="9" ry="5" fill={['#5BAE4B', '#E0533D', '#F2DE8F', '#3F8E3A'][i]} />)}
        <path d="M600 286 q 30 26 60 0 z" fill="var(--scene-bowl)" />
        <ellipse cx="630" cy="283" rx="26" ry="5" fill="#E9D6AE" />
        <path d="M618 283 q 12 -5 24 0" stroke="#B9A24A" strokeWidth="2.4" fill="none" />
        {[622, 632, 640].map((cx) => <circle key={cx} cx={cx} cy="282" r="1.6" fill="#C0392B" />)}
        <rect x="582" y="226" width="16" height="58" rx="6" fill="#4A2A36" />
        <rect x="586" y="212" width="8" height="18" rx="2" fill="#4A2A36" />
        <rect x="582" y="246" width="16" height="16" fill={SHIRT.cream} opacity="0.8" />
        <rect x="806" y="258" width="22" height="28" rx="4" fill="rgba(120,190,235,0.35)" />
        {[812, 818, 824].map((fx, i) => <circle key={fx} className="hx-sway" style={v({ '--d': `${i * 0.5}s` })} cx={fx} cy={248 - i * 6} r="6" fill={[SHIRT.clay, SHIRT.mustard, '#E7A0B4'][i]} />)}
      </g>
      {/* arms: resting, passing the salad, raising a glass */}
      {people.map((pp, i) => {
        const sl = darken(pp.shirt, 0.9);
        return (
          <g key={`a${pp.x}`}>
            <Arm from={[pp.x - 44, Y + 22]} elbow={[pp.x - 60, Y + 70]} to={[pp.x - 30, 286]} sleeve={sl} skin={pp.skin} />
            {i === 1 ? (
              <g className="hx-bob" style={v({ '--a': '-4px', '--dur': '3s' })}>
                <Arm from={[pp.x + 44, Y + 22]} elbow={[pp.x + 70, Y + 64]} to={[pp.x + 96, 276]} sleeve={sl} skin={pp.skin} />
              </g>
            ) : i === 3 ? (
              <g>
                <Arm from={[pp.x + 44, Y + 22]} elbow={[pp.x + 74, Y + 50]} to={[pp.x + 74, Y + 50]} sleeve={sl} skin={pp.skin} />
                <g className="hx-rot" style={v({ '--o': '0% 100%', '--a': '-16deg', '--dur': '3.2s' })}>
                  <path d={`M${pp.x + 74} ${Y + 50} L${pp.x + 66} ${Y - 28}`} stroke={sl} strokeWidth="14" strokeLinecap="round" />
                  <circle cx={pp.x + 66} cy={Y - 28} r="9" fill={pp.skin} />
                  <path d={`M${pp.x + 56} ${Y - 64} h20 l-4 28 h-12 z`} fill="#B0303F" opacity="0.85" stroke="var(--bc-border)" strokeWidth="1.5" />
                </g>
              </g>
            ) : (
              <Arm from={[pp.x + 44, Y + 22]} elbow={[pp.x + 60, Y + 70]} to={[pp.x + 30, 286]} sleeve={sl} skin={pp.skin} />
            )}
          </g>
        );
      })}
      {[214, 392, 590, 772].map((gx) => (
        <path key={gx} d={`M${gx} 256 h16 l-3 30 h-10 z`} fill="rgba(120,190,235,0.45)" stroke="var(--bc-border)" strokeWidth="1.5" />
      ))}
      <HexDust items={[[300, 230, 4, 0], [470, 200, 3, 1.5], [620, 230, 4, 3], [180, 210, 3, 4.2], [760, 220, 3, 2.4]]} color="#FFD58A" h={-120} />
      <Finish ids={ids} w={900} h={360} />
    </svg>
  );
}

/* ---------- Empty plate: the 404 ---------- */

export function EmptyPlateScene({ className = '' }) {
  const ids = useSceneIds();
  return (
    <svg viewBox="0 0 600 320" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <SceneDefs ids={ids} />
      <rect width="600" height="320" fill="var(--scene-bg)" />
      <rect x="0" y="40" width="600" height="130" fill={`url(#${ids.tiles})`} />
      <rect x="0" y="166" width="600" height="6" fill={WOOD_DARK} />
      <rect x="0" y="172" width="600" height="148" fill={WOOD} />
      <path d={hexD(300, 236, 150, 0.32)} fill={SHIRT.sage} opacity="0.4" />
      <Shadow ids={ids} cx={300} cy={246} rx={118} ry={22} />
      <ellipse cx="300" cy="236" rx="112" ry="34" fill="var(--scene-plate-rim)" />
      <ellipse cx="300" cy="232" rx="88" ry="25" fill="var(--scene-plate)" />
      <circle cx="322" cy="228" r="2.5" fill="#D9A04E" />
      <circle cx="281" cy="236" r="2" fill="#5BAE4B" />
      <rect x="440" y="214" width="8" height="64" rx="4" fill="#9AA39E" transform="rotate(-8 444 246)" />
      <path d="M432 210 v18 M440 208 v20 M448 208 v20 M456 210 v18" stroke="#9AA39E" strokeWidth="3" strokeLinecap="round" transform="rotate(-8 444 246)" />
      <g className="hx-bob" style={{ '--a': '-8px', '--dur': '3.5s' }}>
        <path d={hexD(300, 120, 30)} fill="var(--bc-surface)" stroke={GREEN} strokeWidth="4" />
        <text x="300" y="132" textAnchor="middle" fontSize="34" fontWeight="800" fill={GREEN}>?</text>
      </g>
      <HexDust items={[[180, 200, 4, 0], [420, 190, 3, 2], [250, 160, 3, 3.5]]} color={GREEN} h={-120} />
      <Finish ids={ids} w={600} h={320} />
    </svg>
  );
}
