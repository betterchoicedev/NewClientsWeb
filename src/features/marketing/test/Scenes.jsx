import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Flat vector "lifestyle" scenes for the /test page: everyday moments drawn in
// the brand's flat style (hexagon weights, the scan-story food), no stock
// photos and no faces. Colors use theme tokens where the scene meets the page,
// fixed food colors elsewhere, so they work in warm light and warm dark.

const C = {
  wood: 'var(--scene-wood, #E6CDA8)',
  woodDark: 'var(--scene-wood-dark, #D2B48A)',
  plate: 'var(--scene-plate, #FFFFFF)',
  plateRim: 'var(--scene-plate-rim, #EDE6DA)',
  ink: 'var(--bc-text)',
  green: 'var(--bc-accent)',
  rice: '#F3EEDC',
  riceDot: '#E2D9BE',
  chicken: '#D9A066',
  chickenLine: '#B97E45',
  leaf: '#5BAE4B',
  leafDark: '#3F8E3A',
  tomato: '#E0533D',
  corn: '#F2DE8F',
  tahini: '#E9D6AE',
  yolk: '#F2B43C',
  egg: '#FFFDF7',
  coffee: '#6B4A32',
  banana: '#F4D35E',
  iron: 'var(--scene-iron, #2E3A34)',
  water: 'rgba(120, 190, 235, 0.45)',
  skin: '#D9A07A',
  skinShade: '#C18763',
};

function Steam({ x, y, delay = 0 }) {
  const reduce = useReducedMotion();
  return (
    <motion.path
      d={`M${x} ${y} q -8 -14 0 -28 q 8 -14 0 -28`}
      fill="none"
      stroke="var(--bc-muted)"
      strokeWidth="3"
      strokeLinecap="round"
      initial={{ opacity: 0.25 }}
      animate={reduce ? { opacity: 0.35 } : { opacity: [0.1, 0.45, 0.1], y: [0, -10, 0] }}
      transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

function Float({ children, delay = 0, amount = 6 }) {
  const reduce = useReducedMotion();
  return (
    <motion.g animate={reduce ? {} : { y: [0, -amount, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay }}>
      {children}
    </motion.g>
  );
}

function Table() {
  return (
    <g>
      <rect x="0" y="0" width="600" height="400" fill="var(--scene-bg, #F1E6D6)" />
      <rect x="0" y="250" width="600" height="150" fill={C.wood} />
      <rect x="0" y="250" width="600" height="8" fill={C.woodDark} />
    </g>
  );
}

function PlateBalanced({ x = 250, y = 285, r = 105 }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={r} ry={r * 0.42} fill={C.plateRim} />
      <ellipse cx={x} cy={y - 4} rx={r * 0.86} ry={r * 0.34} fill={C.plate} />
      {/* rice */}
      <path d={`M${x - 70} ${y - 2} q 8 -42 42 -40 q 30 2 30 32 q -6 18 -34 20 q -30 0 -38 -12 z`} fill={C.rice} />
      {[[-48, -20], [-36, -30], [-26, -14], [-58, -10]].map(([dx, dy]) => (
        <rect key={`${dx}${dy}`} x={x + dx} y={y + dy} width="8" height="3" rx="1.5" fill={C.riceDot} />
      ))}
      {/* chicken */}
      <path d={`M${x + 4} ${y - 20} q 10 -30 48 -26 q 30 4 26 26 q -6 18 -40 18 q -34 0 -34 -18 z`} fill={C.chicken} />
      <path d={`M${x + 16} ${y - 26} l 50 -4 M${x + 14} ${y - 12} l 56 -4`} stroke={C.chickenLine} strokeWidth="4" strokeLinecap="round" />
      {/* salad cubes */}
      {[[-10, 8, C.tomato], [8, 12, C.leaf], [26, 6, C.corn], [44, 12, C.tomato], [62, 4, C.leaf], [-26, 12, C.leaf]].map(([dx, dy, f]) => (
        <rect key={`${dx}${dy}`} x={x + dx} y={y + dy} width="14" height="9" rx="2.5" fill={f} />
      ))}
    </g>
  );
}

function Dumbbell({ x, y, s = 1 }) {
  // hexagon plates: the brand mark's shape
  const hex = (cx, cy, r) => `M${cx} ${cy - r} L${cx + r * 0.87} ${cy - r / 2} L${cx + r * 0.87} ${cy + r / 2} L${cx} ${cy + r} L${cx - r * 0.87} ${cy + r / 2} L${cx - r * 0.87} ${cy - r / 2} Z`;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-46" y="-6" width="92" height="12" rx="6" fill={C.iron} opacity="0.85" />
      <path d={hex(-50, 0, 30)} fill={C.iron} />
      <path d={hex(50, 0, 30)} fill={C.iron} />
      <path d={hex(-50, 0, 14)} fill="none" stroke={C.green} strokeWidth="4" />
      <path d={hex(50, 0, 14)} fill="none" stroke={C.green} strokeWidth="4" />
    </g>
  );
}

function Glass({ x, y }) {
  return (
    <g>
      <path d={`M${x - 22} ${y - 70} h44 l -6 70 h -32 z`} fill={C.water} stroke="var(--bc-border)" strokeWidth="2" />
      <path d={`M${x - 18} ${y - 46} h36 l -3 46 h -30 z`} fill="rgba(120,190,235,0.55)" />
      <circle cx={x + 6} cy={y - 50} r="8" fill={C.corn} opacity="0.9" />
    </g>
  );
}

function Shaker({ x, y }) {
  return (
    <g>
      <rect x={x - 26} y={y - 120} width="52" height="120" rx="12" fill="var(--scene-shaker, #FFFFFF)" stroke="var(--bc-border)" strokeWidth="2" />
      <rect x={x - 26} y={y - 70} width="52" height="70" rx="10" fill="#C9A27A" opacity="0.65" />
      <rect x={x - 22} y={y - 140} width="44" height="24" rx="8" fill={C.green} />
      <rect x={x - 8} y={y - 152} width="16" height="14" rx="4" fill={C.green} />
    </g>
  );
}

function Eggs({ x, y }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx="34" ry="22" fill={C.egg} stroke="var(--bc-border)" strokeWidth="2" />
      <circle cx={x + 2} cy={y - 2} r="11" fill={C.yolk} />
      <ellipse cx={x + 64} cy={y + 4} rx="22" ry="28" fill={C.egg} stroke="var(--bc-border)" strokeWidth="2" />
    </g>
  );
}

function Kettlebell({ x, y }) {
  return (
    <g>
      <path d={`M${x - 26} ${y - 66} q 26 -34 52 0`} fill="none" stroke={C.iron} strokeWidth="12" strokeLinecap="round" />
      <path d={`M${x - 46} ${y - 36} L${x} ${y - 62} L${x + 46} ${y - 36} L${x + 46} ${y + 4} L${x} ${y + 26} L${x - 46} ${y + 4} Z`} fill={C.iron} />
      <path d={`M${x - 16} ${y - 20} L${x} ${y - 29} L${x + 16} ${y - 20} L${x + 16} ${y - 2} L${x} ${y + 7} L${x - 16} ${y - 2} Z`} fill="none" stroke={C.green} strokeWidth="4" />
    </g>
  );
}

function SaladBowl({ x, y }) {
  return (
    <g>
      <path d={`M${x - 120} ${y - 40} q 120 120 240 0 z`} fill="var(--scene-bowl, #FFFFFF)" stroke="var(--bc-border)" strokeWidth="2" />
      {[
        [-90, -52, C.leaf], [-60, -62, C.leafDark], [-30, -58, C.tomato], [0, -66, C.leaf], [30, -58, C.corn],
        [60, -62, C.leafDark], [90, -52, C.tomato], [-45, -46, C.corn], [15, -48, C.leaf], [70, -44, C.leaf],
      ].map(([dx, dy, f]) => (
        <ellipse key={`${dx}${dy}`} cx={x + dx} cy={y + dy} rx="20" ry="11" fill={f} transform={`rotate(${(dx % 30) - 10} ${x + dx} ${y + dy})`} />
      ))}
    </g>
  );
}

function Apple({ x, y }) {
  return (
    <g>
      <circle cx={x} cy={y} r="26" fill={C.tomato} />
      <path d={`M${x} ${y - 26} q 2 -12 10 -16`} stroke={C.coffee} strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse cx={x + 14} cy={y - 34} rx="10" ry="5" fill={C.leaf} transform={`rotate(-25 ${x + 14} ${y - 34})`} />
    </g>
  );
}

function Mug({ x, y }) {
  return (
    <g>
      <rect x={x - 34} y={y - 70} width="68" height="70" rx="14" fill={C.green} />
      <path d={`M${x + 34} ${y - 52} q 26 0 26 20 q 0 20 -26 20`} fill="none" stroke={C.green} strokeWidth="10" />
      <ellipse cx={x} cy={y - 70} rx="30" ry="7" fill={C.coffee} />
      <Steam x={x - 10} y={y - 82} />
      <Steam x={x + 10} y={y - 86} delay={1.2} />
    </g>
  );
}

function Toast({ x, y }) {
  return (
    <g>
      <rect x={x - 54} y={y - 30} width="108" height="60" rx="16" fill="#D9A866" />
      <rect x={x - 46} y={y - 22} width="92" height="44" rx="12" fill="#F0D199" />
      <ellipse cx={x} cy={y} rx="36" ry="14" fill="#8BBF5A" />
      <circle cx={x - 12} cy={y - 2} r="5" fill={C.tomato} />
      <circle cx={x + 14} cy={y + 2} r="5" fill={C.tomato} />
    </g>
  );
}

function Banana({ x, y }) {
  return <path d={`M${x - 60} ${y - 10} q 60 50 120 -6 q -60 30 -120 6 z`} fill={C.banana} stroke="#D9B33E" strokeWidth="2" />;
}

export function GoalScene({ goal, className = '' }) {
  return (
    <svg viewBox="0 0 600 400" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <Table />
      {goal === 'recomp' ? (
        <>
          <Float amount={8}>
            <Dumbbell x={470} y={175} s={1.1} />
          </Float>
          <PlateBalanced x={250} y={300} r={130} />
          <Glass x={500} y={330} />
          <Steam x={300} y={240} />
        </>
      ) : null}
      {goal === 'muscle' ? (
        <>
          <Shaker x={150} y={330} />
          <Eggs x={280} y={320} />
          <Float amount={7}>
            <Kettlebell x={470} y={290} />
          </Float>
        </>
      ) : null}
      {goal === 'lose' ? (
        <>
          <SaladBowl x={290} y={320} />
          <Glass x={490} y={340} />
          <Float amount={6} delay={0.6}>
            <Apple x={110} y={300} />
          </Float>
        </>
      ) : null}
      {goal === 'maintain' ? (
        <>
          <Mug x={140} y={330} />
          <Toast x={300} y={320} />
          <Banana x={470} y={320} />
        </>
      ) : null}
    </svg>
  );
}

/* ---------- Hero: first-person hand holding the phone over a plate ---------- */

export function HeroTable({ className = '' }) {
  return (
    <svg viewBox="0 0 800 600" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="800" height="600" fill="var(--scene-bg, #F1E6D6)" />
      <rect x="0" y="330" width="800" height="270" fill={C.wood} />
      <rect x="0" y="330" width="800" height="10" fill={C.woodDark} />
      <PlateBalanced x={430} y={470} r={190} />
      <g transform="translate(60 40)">
        <Mug x={140} y={430} />
      </g>
      <g transform="translate(-10 30)">
        <Toast x={650} y={470} />
      </g>
    </svg>
  );
}

/** The hand behind the phone (fingers peeking out on the far side). */
export function HandBack({ className = '' }) {
  return (
    <svg viewBox="0 0 360 260" className={className} aria-hidden="true">
      <path d="M300 40 q 34 6 30 30 q -4 20 -34 18 z" fill={C.skin} />
      <path d="M306 96 q 34 6 30 30 q -4 20 -34 18 z" fill={C.skin} />
      <path d="M300 152 q 30 8 24 30 q -6 18 -32 12 z" fill={C.skin} />
      <path d="M60 210 q 120 -50 250 -40 l 40 90 h -310 z" fill={C.skin} />
    </svg>
  );
}

/** The thumb in front of the phone, plus the sleeve. */
export function HandFront({ className = '' }) {
  return (
    <svg viewBox="0 0 360 260" className={className} aria-hidden="true">
      <path d="M40 260 q 10 -110 70 -150 q 36 -24 54 2 q 14 22 -12 46 q -38 34 -46 102 z" fill={C.skin} />
      <path d="M128 112 q 20 -8 30 6" fill="none" stroke={C.skinShade} strokeWidth="5" strokeLinecap="round" />
      <path d="M0 260 l 30 -70 h 120 l -10 70 z" fill="var(--scene-sleeve, #13251D)" />
    </svg>
  );
}
