import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import META from './stickers.json';

// Food stickers from the dietitian meal-plan builder (NewDietitianWeb,
// MealStickerTile), bundled under public/stickers so the landing page has no
// external dependency. A meal is a "plated stack": the first sticker is the
// main item, large and low; the others rest on its top edge, smaller and
// tilted; a container (bowl, glass) holds its toppings behind its front wall.
// Here the stack is "plated" with motion: the main item lands, then the
// toppings drop on.

const HEX = 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)';
const src = (slug) => `${process.env.PUBLIC_URL || ''}/stickers/${slug}.webp`;

export const stickerName = (slug, language) => {
  const m = META[slug];
  return m ? (language === 'hebrew' ? m.he : m.en) : '';
};

function place(box, contentW, maxH, centerX, contentTop) {
  const [bx, by, bw, bh] = box || [0, 0, 1, 1];
  const w = Math.min(contentW, (maxH * bw) / bh);
  const imgW = w / bw;
  return { left: centerX - w / 2 - bx * imgW, top: contentTop - by * imgW, width: imgW, contentH: (w * bh) / bw };
}

function plate(stickers) {
  if (stickers.length === 1) {
    const p = place(stickers[0].box, 72, 72, 50, 0);
    return [{ ...p, top: p.top + (100 - p.contentH) / 2, rotate: 0 }];
  }
  const tuckIn = !!stickers[0].vessel;
  const baseTop = 94 - place(stickers[0].box, 76, 56, 50, 0).contentH;
  const out = [{ ...place(stickers[0].box, 76, 56, 50, baseTop), rotate: 0 }];
  const tops = stickers.slice(1);
  const centers = tops.length === 1 ? [64] : [32, 68];
  const rotations = tops.length === 1 ? [8] : [-10, 9];
  const width = tops.length === 1 ? 46 : 40;
  tops.forEach((s, i) => {
    const probe = place(s.box, width, 42, centers[i], 0);
    const contentTop = Math.max(2, baseTop - probe.contentH * (tuckIn ? 0.72 : 0.65));
    out.push({ ...place(s.box, width, 42, centers[i], contentTop), rotate: rotations[i] });
  });
  return out;
}

/**
 * `slugs`: main item first, up to 3. `animate`: play the plating when it
 * mounts (or `whileInView` when `inView`). Decorative: the dish name next to
 * it says what it is.
 */
export default function StickerTile({ slugs, size = 48, className = '', play = true, inView = false, delay = 0, hex = true }) {
  const reduce = useReducedMotion();
  const [broken, setBroken] = useState({});
  const list = (slugs || []).filter((s) => META[s] && !broken[s]).slice(0, 3).map((slug) => ({ slug, ...META[slug] }));
  if (!list.length) return null;
  const spots = plate(list);
  const shadow = size >= 56 ? '0 3px 4px rgba(0,0,0,.22)' : '0 1px 1.5px rgba(0,0,0,.25)';
  const animated = play && !reduce;
  const imgs = list.map((s, i) => {
    const from = i === 0 ? { opacity: 0, scale: 0.6, y: 6 } : { opacity: 0, y: -26, rotate: spots[i].rotate * 2.5 };
    const to = { opacity: 1, scale: 1, y: 0, rotate: spots[i].rotate };
    const transition = { type: 'spring', damping: 13, stiffness: 220, delay: delay + (i === 0 ? 0 : 0.18 + i * 0.12) };
    const motionProps = animated
      ? inView
        ? { initial: from, whileInView: to, viewport: { once: true, amount: 0.6 }, transition }
        : { initial: from, animate: to, transition }
      : { initial: false, animate: { rotate: spots[i].rotate } };
    return (
      <motion.img
        key={`${s.slug}-${i}`}
        src={src(s.slug)}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setBroken((b) => ({ ...b, [s.slug]: true }))}
        className="absolute max-w-none select-none"
        style={{ left: `${spots[i].left}%`, top: `${spots[i].top}%`, width: `${spots[i].width}%`, filter: `drop-shadow(${shadow})` }}
        {...motionProps}
      />
    );
  });
  const tuckIn = list.length > 1 && list[0].vessel;
  return (
    <span aria-hidden="true" className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      {hex ? <span className="absolute" style={{ inset: '4% 10%', clipPath: HEX, backgroundColor: 'var(--bc-accent-well)' }} /> : null}
      {tuckIn ? [...imgs.slice(1), imgs[0]] : imgs}
    </span>
  );
}
