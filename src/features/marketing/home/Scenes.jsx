import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useSceneIds, SceneDefs, Finish, HexDust, hexD, useOffscreenPause, Person, Arm, HexCell, HexLamp, Leafy, SKIN, HAIR, SHIRT, darken } from './Illustrations';

// Goal scenes for the home page cards: people and food in the brand's flat
// style (hexagon weights, hex tiles). Theme tokens where the scene meets the
// page, fixed food colors elsewhere, so they work in warm light and dark.

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

// Wall in hex tiles, light falling from the left, a wooden table, and a
// framed hexagon on the wall.
function Table({ ids }) {
  return (
    <g>
      <rect x="0" y="0" width="600" height="400" fill="var(--scene-bg, #F1E6D6)" />
      <rect x="0" y="120" width="600" height="130" fill={`url(#${ids.tiles})`} />
      <rect x="0" y="116" width="600" height="6" fill={C.woodDark} />
      <path d="M0 0 L240 0 L420 250 L0 250 Z" fill={`url(#${ids.beam})`} style={{ opacity: 'var(--scene-beam)' }} />
      <path d={hexD(540, 62, 30)} fill={C.woodDark} />
      <path d={hexD(540, 62, 24)} fill="var(--scene-cloth)" />
      <path d={hexD(540, 62, 11)} fill="none" stroke={C.green} strokeWidth="4" />
      <rect x="0" y="250" width="600" height="150" fill={C.wood} />
      <rect x="0" y="250" width="600" height="8" fill={C.woodDark} />
      <rect x="0" y="258" width="600" height="3" fill="#FFFFFF" opacity="0.25" />
      {[90, 230, 370, 510].map((x) => <rect key={x} x={x} y="262" width="2" height="138" fill="var(--scene-shade)" />)}
    </g>
  );
}

function PlateBalanced({ x = 250, y = 285, r = 105 }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 10} rx={r * 1.05} ry={r * 0.36} fill="var(--scene-shade)" />
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

// One person per goal, in the home page's style: wall in hex tiles with light
// from the left, decor (shelves, a lamp, a window, a hex clock), the person
// behind a wooden table doing the goal, and the goal's food on the table.
// recomp: curling a hex dumbbell over a balanced plate; muscle: a shake after
// training, eggs and a kettlebell; lose: a big salad, water and an apple;
// maintain: a slow coffee with toast and a banana.
const SCENE_PEOPLE = {
  recomp: { x: 405, skin: SKIN[1], hair: HAIR[1], hairStyle: 'bun', shirt: SHIRT.sage, turn: -5, earring: true },
  muscle: { x: 410, skin: SKIN[2], hair: HAIR[0], hairStyle: 'short', shirt: SHIRT.navy, turn: -4, beard: true },
  lose: { x: 185, skin: SKIN[0], hair: HAIR[2], hairStyle: 'long', shirt: SHIRT.clay, turn: 6, earring: true },
  maintain: { x: 425, skin: SKIN[3], hair: HAIR[3], hairStyle: 'curly', shirt: SHIRT.mustard, turn: -4 },
};
const PY = 150; // neck base
const PS = 0.95;

function Wall({ ids, goal }) {
  return (
    <g>
      <rect x="0" y="0" width="600" height="400" fill="var(--scene-bg)" />
      <rect x="0" y="0" width="600" height="400" fill={`url(#${ids.wall})`} />
      <rect x="0" y="112" width="600" height="160" fill={`url(#${ids.tiles})`} />
      <rect x="0" y="108" width="600" height="6" fill={C.woodDark} />
      <path d="M0 0 L240 0 L430 270 L0 270 Z" fill={`url(#${ids.beam})`} style={{ opacity: 'var(--scene-beam)' }} />
      {goal === 'recomp' ? (
        <g>
          <HexCell cx={110} cy={66} r={34}><Leafy x={110} y={88} s={0.5} d={0.4} /></HexCell>
          <HexCell cx={170} cy={66} r={34}>
            <rect x="160" y="62" width="20" height="24" rx="5" fill="#F2DE8F" />
            <rect x="158" y="57" width="24" height="7" rx="3" fill={C.woodDark} />
          </HexCell>
          <HexLamp ids={ids} x={280} drop={12} r={20} />
        </g>
      ) : null}
      {goal === 'muscle' ? (
        <g>
          {/* barbell on wall pegs, hex plates */}
          <rect x="60" y="78" width="12" height="16" rx="3" fill={C.woodDark} />
          <rect x="228" y="78" width="12" height="16" rx="3" fill={C.woodDark} />
          <rect x="40" y="72" width="220" height="7" rx="3.5" fill="#7E8A84" />
          {[52, 248].map((x) => (
            <g key={x}>
              <path d={hexD(x, 75, 26)} fill={C.iron} />
              <path d={hexD(x, 75, 11)} fill="none" stroke={C.green} strokeWidth="3.5" />
            </g>
          ))}
          <HexLamp ids={ids} x={310} drop={4} r={18} />
        </g>
      ) : null}
      {goal === 'lose' ? (
        <g>
          {/* window with the day outside */}
          <rect x="370" y="18" width="200" height="182" rx="6" fill={C.woodDark} />
          <rect x="380" y="28" width="180" height="162" fill={`url(#${ids.sky})`} />
          <circle className="hx-bob" style={{ '--a': '-4px', '--dur': '6s' }} cx="520" cy="66" r="16" fill="var(--scene-orb)" />
          <path d="M380 150 q 50 -26 100 -6 q 50 -18 80 2 v 44 h -180 z" fill="#5BAE4B" opacity="0.5" />
          <rect x="467" y="28" width="6" height="162" fill={C.woodDark} />
          <rect x="370" y="198" width="210" height="9" rx="3" fill={C.woodDark} />
          <Leafy x={540} y={196} s={0.5} d={0.8} />
        </g>
      ) : null}
      {goal === 'maintain' ? (
        <g>
          {/* hex wall clock, the hands turn */}
          <path d={hexD(150, 72, 42)} fill="var(--scene-cloth)" stroke={C.woodDark} strokeWidth="6" />
          <circle cx="150" cy="72" r="3.5" fill={C.iron} />
          <line className="hx-spin" style={{ '--dur': '60s', transformOrigin: '150px 72px', transformBox: 'view-box' }} x1="150" y1="72" x2="150" y2="44" stroke={C.iron} strokeWidth="3" strokeLinecap="round" />
          <line className="hx-spin" style={{ '--dur': '720s', transformOrigin: '150px 72px', transformBox: 'view-box' }} x1="150" y1="72" x2="170" y2="72" stroke={C.green} strokeWidth="4" strokeLinecap="round" />
          <HexCell cx={250} cy={66} r={32}><Leafy x={250} y={88} s={0.46} trailing d={0.3} /></HexCell>
        </g>
      ) : null}
    </g>
  );
}

function TableTop() {
  return (
    <g>
      <rect x="0" y="262" width="600" height="138" fill={C.wood} />
      <rect x="0" y="262" width="600" height="8" fill={C.woodDark} />
      <rect x="0" y="270" width="600" height="3" fill="#FFFFFF" opacity="0.25" />
      {[90, 230, 370, 510].map((x) => <rect key={x} x={x} y="273" width="2" height="127" fill="var(--scene-shade)" />)}
    </g>
  );
}

const L = (p, lx, ly) => [p.x + lx * PS, PY + ly * PS];

export function GoalScene({ goal, className = '' }) {
  const ids = useSceneIds();
  const [pauseRef, near] = useOffscreenPause();
  if (!near) return <svg ref={pauseRef} viewBox="0 0 600 400" className={className} aria-hidden="true" />;
  const p = SCENE_PEOPLE[goal] || SCENE_PEOPLE.recomp;
  const sleeve = darken(p.shirt, 0.9);
  return (
    <svg ref={pauseRef} viewBox="0 0 600 400" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <SceneDefs ids={ids} />
      <Wall ids={ids} goal={goal} />
      <Person ids={ids} x={p.x} y={PY} s={PS} torso={128} {...p} />
      <TableTop />

      {goal === 'recomp' ? (
        <g>
          <PlateBalanced x={195} y={318} r={112} />
          <Steam x={225} y={268} />
          <Glass x={78} y={338} />
          <Arm from={L(p, -42, 20)} elbow={L(p, -56, 84)} to={[p.x - 78, 296]} sleeve={sleeve} skin={p.skin} rolled />
          <Arm from={L(p, 42, 20)} elbow={L(p, 62, 92)} to={L(p, 62, 92)} sleeve={p.shirt} skin={p.skin} />
          {/* the curl: forearm + hex dumbbell turn at the elbow */}
          <g className="hx-curl" style={{ '--o': '0% 100%', '--a': '-38deg', '--dur': '2.6s' }}>
            <path d={`M${L(p, 62, 92)[0]} ${L(p, 62, 92)[1]} L${p.x + 72} ${PY + 30}`} stroke={p.skin} strokeWidth="14" strokeLinecap="round" />
            <circle cx={p.x + 72} cy={PY + 30} r="9.5" fill={p.skin} />
            <Dumbbell x={p.x + 72} y={PY + 28} s={0.36} />
          </g>
        </g>
      ) : null}

      {goal === 'muscle' ? (
        <g>
          <Eggs x={120} y={322} />
          <Kettlebell x={250} y={322} />
          <Banana x={530} y={330} />
          <Arm from={L(p, -42, 20)} elbow={L(p, -60, 86)} to={[p.x - 70, 298]} sleeve={sleeve} skin={p.skin} />
          {/* the shake, raised and tilting */}
          <g className="hx-curl" style={{ '--o': '50% 100%', '--a': '-14deg', '--dur': '3.4s' }}>
            <Arm from={L(p, 42, 20)} elbow={L(p, 66, 80)} to={[p.x + 40, PY + 12]} sleeve={p.shirt} skin={p.skin} />
            <g transform={`translate(${p.x + 40} ${PY + 30}) rotate(-24) scale(0.42) translate(${-p.x - 40} ${-PY - 30})`}>
              <Shaker x={p.x + 40} y={PY + 30} />
            </g>
          </g>
        </g>
      ) : null}

      {goal === 'lose' ? (
        <g>
          <SaladBowl x={330} y={328} />
          <Glass x={500} y={340} />
          <Float amount={6} delay={0.6}><Apple x={560} y={318} /></Float>
          <Arm from={L(p, -42, 20)} elbow={L(p, -58, 86)} to={[p.x - 62, 298]} sleeve={sleeve} skin={p.skin} />
          <Arm from={L(p, 42, 20)} elbow={L(p, 72, 84)} to={L(p, 72, 84)} sleeve={p.shirt} skin={p.skin} />
          {/* fork into the salad */}
          <g className="hx-curl" style={{ '--o': '0% 0%', '--a': '-12deg', '--dur': '1.8s' }}>
            <path d={`M${L(p, 72, 84)[0]} ${L(p, 72, 84)[1]} L${p.x + 104} ${PY + 128}`} stroke={p.skin} strokeWidth="14" strokeLinecap="round" />
            <circle cx={p.x + 104} cy={PY + 128} r="9.5" fill={p.skin} />
            <path d={`M${p.x + 104} ${PY + 128} l 26 22 m 0 0 l 6 -2 m -6 2 l 2 6`} stroke="#C9D1CD" strokeWidth="4" strokeLinecap="round" fill="none" />
          </g>
        </g>
      ) : null}

      {goal === 'maintain' ? (
        <g>
          <Toast x={160} y={322} />
          <Banana x={290} y={330} />
          <Glass x={560} y={340} />
          <Arm from={L(p, -42, 20)} elbow={L(p, -48, 84)} to={[p.x - 16, PY + 96]} sleeve={sleeve} skin={p.skin} />
          <Arm from={L(p, 42, 20)} elbow={L(p, 48, 84)} to={[p.x + 16, PY + 96]} sleeve={p.shirt} skin={p.skin} />
          <g className="hx-bob" style={{ '--a': '-3px', '--dur': '4s' }}>
            <Mug x={p.x} y={PY + 118} />
            <circle cx={p.x - 30} cy={PY + 92} r="9.5" fill={p.skin} />
            <circle cx={p.x + 30} cy={PY + 92} r="9.5" fill={p.skin} />
          </g>
        </g>
      ) : null}

      <HexDust items={[[110, 240, 4, 0], [200, 200, 3, 1.8], [300, 240, 5, 3.4], [380, 210, 3, 5], [480, 235, 4, 2.6]]} color="var(--bc-accent)" h={-150} />
      <Finish ids={ids} w={600} h={400} />
    </svg>
  );
}
