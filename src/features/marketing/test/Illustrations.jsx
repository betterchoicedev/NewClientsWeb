import React, { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Editorial illustrations for /test: real everyday moments with people in
// them (faceless, varied), drawn rather than photographed. Light comes from
// windows and lamps, the background sits slightly out of focus, and a fine
// grain sits on top, so the scenes read closer to a photo than a flat icon.
// Daylight in light mode, evening (lamps on) in dark mode.

const SKIN = ['#F1C9A5', '#E3B08A', '#C68E68', '#8D5A3B'];
const HAIR = ['#2B1D16', '#5A3A22', '#C9A06A', '#151515'];
const SHIRT = { sage: '#8FB59A', clay: '#D07A5A', mustard: '#E2B24F', navy: '#3D5A80', cream: '#EFE6D6', plum: '#8E5A7A' };
const WOOD = 'var(--scene-wood)';
const WOOD_DARK = 'var(--scene-wood-dark)';

/** Shared filters and gradients, ids made unique per scene. */
function useIds() {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ids = ['grain', 'soft', 'blur', 'sky', 'glow', 'vignette', 'wall', 'vol', 'side'].reduce((o, k) => ({ ...o, [k]: `${k}${raw}` }), {});
  return ids;
}

function Defs({ ids }) {
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
        <feGaussianBlur stdDeviation="1" />
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
        <stop offset="1" stopColor="#000" stopOpacity="0.18" />
      </radialGradient>
      <radialGradient id={ids.vol} cx="0.36" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.28" />
        <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.16" />
      </radialGradient>
      <linearGradient id={ids.side} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.14" />
        <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.16" />
      </linearGradient>
      <linearGradient id={ids.wall} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.10" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.06" />
      </linearGradient>
    </defs>
  );
}

function Finish({ ids, w, h }) {
  return (
    <g pointerEvents="none">
      <rect width={w} height={h} fill={`url(#${ids.vignette})`} />
      <rect width={w} height={h} filter={`url(#${ids.grain})`} />
    </g>
  );
}

function Shadow({ ids, cx, cy, rx, ry }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="var(--scene-shade)" filter={`url(#${ids.blur})`} />;
}

function Lamp({ ids, x, top = 0, drop = 90, color = SHIRT.mustard }) {
  return (
    <g>
      <circle cx={x} cy={top + drop + 30} r="170" fill={`url(#${ids.glow})`} style={{ opacity: 'var(--scene-lamp)' }} />
      <line x1={x} y1={top} x2={x} y2={top + drop} stroke="var(--bc-text)" strokeOpacity="0.5" strokeWidth="2" />
      <path d={`M${x - 36} ${top + drop + 34} q 36 -46 72 0 z`} fill={color} />
      <ellipse cx={x} cy={top + drop + 34} rx="20" ry="5" fill="#FFF1C9" />
    </g>
  );
}

function Plant({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[[-18, -40, -30], [0, -52, 0], [18, -40, 30], [-10, -30, -55], [12, -28, 55]].map(([dx, dy, r]) => (
        <ellipse key={`${dx}${r}`} cx={dx} cy={dy} rx="9" ry="22" fill={r % 2 ? '#4F9A55' : '#5BAE4B'} transform={`rotate(${r} ${dx} ${dy})`} />
      ))}
      <path d="M-18 -14 h36 l-4 26 h-28 z" fill="#C9785B" />
    </g>
  );
}

/**
 * A seated or standing figure from the waist up, faceless. Origin is the base
 * of the neck. `arms` draws the arms in the figure's local coordinates.
 */
function Person({ ids, x, y, s = 1, skin, hair, hairStyle = 'short', shirt, torso = 120, children, turn = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {hairStyle === 'long' ? <rect x="-31" y="-64" width="62" height="78" rx="28" fill={hair} /> : null}
      <path d={`M-48 ${torso} L-46 24 Q-44 2 -22 0 L22 0 Q44 2 46 24 L48 ${torso} Z`} fill={shirt} />
      <path d={`M-48 ${torso} L-46 24 Q-44 2 -22 0 L22 0 Q44 2 46 24 L48 ${torso} Z`} fill={`url(#${ids.side})`} />
      <path d="M-9 -1 L0 12 L9 -1 Z" fill={skin} />
      <rect x="-8" y="-12" width="16" height="14" fill={skin} />
      <circle cx={turn} cy="-38" r="30" fill={hair} />
      <circle cx={turn * 1.4 - (turn >= 0 ? 24 : -24)} cy="-30" r="6" fill={skin} />
      <circle cx={turn * 1.4} cy="-32" r="27" fill={skin} />
      <circle cx={turn * 1.4} cy="-32" r="27" fill={`url(#${ids.vol})`} />
      <path d={`M${turn * 1.4 - 25} -42 q ${25} -22 50 -4 q -14 -20 -26 -20 q -16 2 -24 24 z`} fill={hair} />
      {hairStyle === 'bun' ? <circle cx={turn - 4} cy="-70" r="13" fill={hair} /> : null}
      {hairStyle === 'long' ? <path d={`M${-27 + turn} -40 q 27 -26 54 0 q -10 -16 -27 -18 q -17 2 -27 18 z`} fill={hair} /> : null}
      {children}
    </g>
  );
}

const Arm = ({ d, color, w = 17 }) => <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;

/* ---------- Kitchen: someone cooking in daylight / under the lamp ---------- */

export function KitchenScene({ className = '' }) {
  const ids = useIds();
  const reduce = useReducedMotion();
  const cook = { skin: SKIN[1], hair: HAIR[1] };
  return (
    <svg viewBox="0 0 800 600" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <Defs ids={ids} />
      <g filter={`url(#${ids.soft})`}>
        <rect width="800" height="600" fill="var(--scene-bg)" />
        <rect width="800" height="600" fill={`url(#${ids.wall})`} />
        {/* window */}
        <rect x="60" y="50" width="290" height="270" rx="8" fill={WOOD_DARK} />
        <rect x="74" y="64" width="262" height="242" fill={`url(#${ids.sky})`} />
        <path d="M74 262 q 70 -34 140 -10 q 70 -26 122 4 v 50 h -262 z" fill="#5BAE4B" opacity="0.45" />
        <path d="M74 282 q 90 -22 170 -2 q 50 -14 92 0 v 26 h -262 z" fill="#3F8E3A" opacity="0.35" />
        <rect x="202" y="64" width="7" height="242" fill={WOOD_DARK} />
        <rect x="74" y="182" width="262" height="7" fill={WOOD_DARK} />
        <rect x="48" y="316" width="314" height="12" rx="3" fill={WOOD_DARK} />
        {/* light through the window */}
        <path d="M350 90 L560 150 L610 372 L372 372 Z" fill="var(--scene-sun)" />
        <Plant x={110} y={312} s={0.9} />
        {/* shelf */}
        <rect x="610" y="190" width="170" height="9" rx="2" fill={WOOD_DARK} />
        {[[630, 34, '#E9D6AE'], [672, 44, '#F2DE8F'], [714, 30, '#C9785B']].map(([jx, jh, f]) => (
          <g key={jx}>
            <rect x={jx} y={190 - jh} width="30" height={jh} rx="6" fill={f} opacity="0.9" />
            <rect x={jx - 2} y={186 - jh} width="34" height="8" rx="3" fill={WOOD_DARK} />
          </g>
        ))}
        <Plant x={760} y={188} s={0.7} />
        <Lamp ids={ids} x={520} drop={70} />
        {/* the cook */}
        <Person ids={ids} x={250} y={238} s={1.15} {...cook} hairStyle="bun" shirt={SHIRT.sage} torso={150} turn={6}>
          <Arm d="M-40 18 Q-40 70 -10 96" color="#7FA58A" />
          <path d="M-22 40 h48 l6 110 h-60 z" fill={SHIRT.cream} opacity="0.95" />
          <Arm d="M40 18 Q64 60 74 92" color={SHIRT.sage} />
        </Person>
        {/* counter */}
        <rect x="0" y="372" width="800" height="18" fill={WOOD} />
        <rect x="0" y="390" width="800" height="210" fill="var(--scene-cabinet)" />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <rect x={14 + i * 160} y="408" width="132" height="176" rx="6" fill="none" stroke="var(--scene-shade)" strokeWidth="3" />
            <rect x={120 + i * 160} y="420" width="16" height="5" rx="2.5" fill={WOOD_DARK} />
          </g>
        ))}
        {/* fruit bowl and oil on the counter */}
        <Shadow ids={ids} cx={680} cy={374} rx={70} ry={8} />
        <circle cx="660" cy="340" r="17" fill="#E0533D" />
        <circle cx="690" cy="336" r="18" fill="#F2B43C" />
        <circle cx="706" cy="350" r="14" fill="#5BAE4B" />
        <path d="M624 344 q 56 52 112 0 z" fill="var(--scene-bowl)" />
        <rect x="560" y="300" width="26" height="72" rx="8" fill="#B9A24A" opacity="0.85" />
        <rect x="567" y="284" width="12" height="20" rx="3" fill="#7A6A2A" />
      </g>
      {/* the board and hands stay sharp: that's where the eye goes */}
      <Shadow ids={ids} cx={350} cy={376} rx={95} ry={7} />
      <rect x="262" y="360" width="180" height="14" rx="5" fill="#E8C99A" />
      <circle cx="292" cy="352" r="11" fill="#E0533D" />
      {[322, 338, 354, 370].map((cx) => (
        <circle key={cx} cx={cx} cy="356" r="6.5" fill="#B5DB86" stroke="#5B8E3A" strokeWidth="2" />
      ))}
      <path d="M392 360 l 40 -6 l 2 6 z" fill="#F08A3C" />
      <circle cx={250 - 10 * 1.15} cy={238 + 96 * 1.15} r="10" fill={cook.skin} />
      <motion.g
        animate={reduce ? {} : { y: [0, -5, 0] }}
        transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.25 }}
      >
        <rect x="335" y="338" width="44" height="6" rx="2" fill="#C9D1CD" transform="rotate(-12 335 338)" />
        <circle cx={250 + 74 * 1.15} cy={238 + 92 * 1.15} r="10" fill={cook.skin} />
      </motion.g>
      <Finish ids={ids} w={800} h={600} />
    </svg>
  );
}

/* ---------- Couch: the evening check-in ---------- */

export function CouchScene({ className = '' }) {
  const ids = useIds();
  const p = { skin: SKIN[2], hair: HAIR[3] };
  return (
    <svg viewBox="0 0 800 500" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <Defs ids={ids} />
      <g filter={`url(#${ids.soft})`}>
        <rect width="800" height="500" fill="var(--scene-bg)" />
        <rect width="800" height="500" fill={`url(#${ids.wall})`} />
        {/* framed print: the hexagon */}
        <rect x="140" y="70" width="150" height="120" rx="4" fill={WOOD_DARK} />
        <rect x="150" y="80" width="130" height="100" fill="var(--scene-cloth)" />
        <path d="M215 102 l 24 14 v 28 l -24 14 l -24 -14 v -28 z" fill="none" stroke="var(--bc-accent)" strokeWidth="6" />
        <rect x="320" y="96" width="70" height="90" rx="3" fill={WOOD_DARK} />
        <rect x="328" y="104" width="54" height="74" fill={SHIRT.clay} opacity="0.75" />
        {/* floor lamp */}
        <circle cx="670" cy="150" r="220" fill={`url(#${ids.glow})`} style={{ opacity: 'var(--scene-lamp)' }} />
        <rect x="666" y="150" width="7" height="260" fill="var(--bc-text)" opacity="0.6" />
        <path d="M630 160 l 14 -60 h 52 l 14 60 z" fill={SHIRT.mustard} />
        <ellipse cx="670" cy="410" rx="34" ry="7" fill="var(--bc-text)" opacity="0.5" />
        {/* floor and rug */}
        <rect x="0" y="400" width="800" height="100" fill={WOOD} />
        <ellipse cx="410" cy="452" rx="300" ry="34" fill={SHIRT.clay} opacity="0.35" />
        {/* side table */}
        <rect x="88" y="300" width="70" height="10" rx="4" fill={WOOD_DARK} />
        <rect x="118" y="310" width="10" height="92" fill={WOOD_DARK} />
        <rect x="104" y="270" width="26" height="30" rx="7" fill="var(--bc-accent)" />
        <Plant x={142} y={286} s={0.55} />
        {/* sofa */}
        <Shadow ids={ids} cx={410} cy={404} rx={250} ry={12} />
        <rect x="190" y="200" width="440" height="130" rx="34" fill="var(--scene-sofa)" />
      </g>
      {/* person: sharp */}
      <Person ids={ids} x={420} y={198} s={1.05} {...p} hairStyle="short" shirt={SHIRT.mustard} torso={108} turn={4}>
        {/* legs folded on the seat */}
        <Arm d="M-10 104 L 92 112" color={SHIRT.navy} w={38} />
        <Arm d="M 92 112 L 104 196" color={SHIRT.navy} w={30} />
        <ellipse cx="114" cy="200" rx="20" ry="9" fill="#F4EEE4" />
        {/* arms to the phone */}
        <Arm d="M-38 22 Q-40 66 -4 66" color="#C99A3F" />
        <Arm d="M38 22 Q40 70 12 64" color={SHIRT.mustard} />
        <rect x="-8" y="34" width="24" height="40" rx="5" fill="#0B0F0D" transform="rotate(-8 4 54)" />
        <rect x="-5" y="38" width="18" height="32" rx="3" fill="#81C784" opacity="0.85" transform="rotate(-8 4 54)" />
        <circle cx="-4" cy="64" r="8" fill={p.skin} />
        <circle cx="14" cy="62" r="8" fill={p.skin} />
      </Person>
      <g filter={`url(#${ids.soft})`}>
        <rect x="176" y="296" width="468" height="70" rx="22" fill="var(--scene-sofa-dark)" />
        <rect x="160" y="240" width="60" height="132" rx="26" fill="var(--scene-sofa)" />
        <rect x="600" y="240" width="60" height="132" rx="26" fill="var(--scene-sofa)" />
        <rect x="226" y="228" width="84" height="70" rx="20" fill={SHIRT.sage} transform="rotate(-8 268 263)" />
        <rect x="200" y="372" width="10" height="28" fill={WOOD_DARK} />
        <rect x="610" y="372" width="10" height="28" fill={WOOD_DARK} />
      </g>
      {/* phone light on the person */}
      <circle cx="424" cy="258" r="70" fill="#81C784" opacity="0.12" filter={`url(#${ids.blur})`} />
      <Finish ids={ids} w={800} h={500} />
    </svg>
  );
}

/* ---------- Friday dinner: the plan works at the family table too ---------- */

export function DinnerScene({ className = '' }) {
  const ids = useIds();
  const reduce = useReducedMotion();
  const people = [
    { x: 170, skin: SKIN[0], hair: HAIR[2], hairStyle: 'long', shirt: SHIRT.navy, turn: 8 },
    { x: 350, skin: SKIN[2], hair: HAIR[0], hairStyle: 'short', shirt: SHIRT.clay, turn: 3 },
    { x: 550, skin: SKIN[3], hair: HAIR[3], hairStyle: 'bun', shirt: SHIRT.sage, turn: -3 },
    { x: 730, skin: SKIN[1], hair: HAIR[1], hairStyle: 'short', shirt: SHIRT.plum, turn: -8 },
  ];
  const Flame = ({ x, y, d }) => (
    <motion.path
      d={`M${x} ${y} q -7 -10 0 -22 q 7 12 0 22 z`}
      fill="#F7B733"
      style={{ originX: `${x}px`, originY: `${y}px` }}
      animate={reduce ? {} : { scaleY: [1, 1.18, 0.92, 1], scaleX: [1, 0.9, 1.06, 1] }}
      transition={{ duration: 1.3, repeat: Infinity, delay: d }}
    />
  );
  return (
    <svg viewBox="0 0 900 360" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <Defs ids={ids} />
      <g filter={`url(#${ids.soft})`}>
        <rect width="900" height="360" fill="var(--scene-bg)" />
        <rect width="900" height="360" fill={`url(#${ids.wall})`} />
        <rect x="380" y="30" width="140" height="100" rx="4" fill={WOOD_DARK} />
        <rect x="390" y="40" width="120" height="80" fill={`url(#${ids.sky})`} />
        <Lamp ids={ids} x={260} drop={40} color={SHIRT.cream} />
        <Lamp ids={ids} x={640} drop={40} color={SHIRT.cream} />
      </g>
      {people.map((pp) => (
        <Person ids={ids} key={pp.x} x={pp.x} y={190} s={1} {...pp} torso={110} />
      ))}
      {/* table */}
      <path d="M0 270 H900 V300 H0 Z" fill="var(--scene-cloth)" />
      <rect x="0" y="300" width="900" height="60" fill="var(--scene-cloth)" />
      <rect x="0" y="300" width="900" height="6" fill="var(--scene-shade)" />
      {people.map((pp, i) => (
        <g key={`h${pp.x}`}>
          {/* arms: resting, passing the salad, raising a glass */}
          {i !== 3 ? <Arm d={`M${pp.x - 44} 212 Q${pp.x - 64} 262 ${pp.x - 30} 284`} color={pp.shirt} w={18} /> : null}
          {i === 1 ? <Arm d={`M${pp.x + 44} 212 Q${pp.x + 70} 250 ${pp.x + 96} 276`} color={pp.shirt} w={18} />
            : i === 3 ? <Arm d={`M${pp.x + 44} 212 Q${pp.x + 76} 196 ${pp.x + 66} 160`} color={pp.shirt} w={18} />
            : <Arm d={`M${pp.x + 44} 212 Q${pp.x + 64} 262 ${pp.x + 30} 284`} color={pp.shirt} w={18} />}
          {i === 3 ? <Arm d={`M${pp.x - 44} 212 Q${pp.x - 64} 262 ${pp.x - 30} 284`} color={pp.shirt} w={18} /> : null}
          <circle cx={pp.x - 30} cy="286" r="9" fill={pp.skin} />
          {i === 1 ? <circle cx={pp.x + 96} cy="278" r="9" fill={pp.skin} />
            : i === 3 ? (
              <g>
                <path d={`M${pp.x + 58} 126 h18 l-3 30 h-12 z`} fill="#B0303F" opacity="0.8" stroke="var(--bc-border)" strokeWidth="1.5" />
                <circle cx={pp.x + 66} cy="158" r="9" fill={pp.skin} />
              </g>
            ) : <circle cx={pp.x + 30} cy="286" r="9" fill={pp.skin} />}
          <ellipse cx={pp.x} cy="292" rx="40" ry="9" fill="var(--scene-plate-rim)" />
          <ellipse cx={pp.x} cy="290" rx="30" ry="6" fill="var(--scene-plate)" />
        </g>
      ))}
      {/* challah, candles, salads, glasses */}
      <g>
        <ellipse cx="450" cy="284" rx="56" ry="10" fill={WOOD_DARK} />
        {[-30, -10, 10, 30].map((dx, i) => (
          <ellipse key={dx} cx={450 + dx} cy={274 - (i % 2) * 3} rx="16" ry="11" fill="#D9A04E" />
        ))}
        {[-24, 0, 24].map((dx) => (
          <circle key={dx} cx={450 + dx} cy="270" r="1.6" fill="#F3EEDC" />
        ))}
        {[400, 500].map((cx, i) => (
          <g key={cx}>
            <rect x={cx - 6} y="246" width="12" height="16" rx="2" fill="#C9CFCB" />
            <rect x={cx - 4} y="206" width="8" height="42" fill="#FFF8EA" />
            <Flame x={cx} y={206} d={i * 0.4} />
            <circle cx={cx} cy="196" r="22" fill={`url(#${ids.glow})`} opacity="0.8" />
          </g>
        ))}
        <path d="M250 286 q 30 26 60 0 z" fill="var(--scene-bowl)" />
        {[258, 272, 286, 300].map((cx, i) => <ellipse key={cx} cx={cx} cy={283} rx="9" ry="5" fill={['#5BAE4B', '#E0533D', '#F2DE8F', '#3F8E3A'][i]} />)}
        <path d="M600 286 q 30 26 60 0 z" fill="var(--scene-bowl)" />
        {[608, 622, 636, 650].map((cx, i) => <ellipse key={cx} cx={cx} cy={283} rx="9" ry="5" fill={['#E9D6AE', '#5BAE4B', '#E0533D', '#E9D6AE'][i]} />)}
        {[214, 392, 590, 772].map((gx) => (
          <path key={gx} d={`M${gx} 254 h16 l-3 30 h-10 z`} fill="rgba(120,190,235,0.45)" stroke="var(--bc-border)" strokeWidth="1.5" />
        ))}
      </g>
      <Finish ids={ids} w={900} h={360} />
    </svg>
  );
}
