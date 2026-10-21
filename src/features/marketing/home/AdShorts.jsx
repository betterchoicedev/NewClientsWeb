import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Play, Volume2, VolumeX } from 'lucide-react';
import { focusClass } from '../../../components/brand/ui';

// "The app in 20 seconds": the campaign shorts (9:16, Hebrew, real app UI),
// one per goal. A short plays muted while it is mostly on screen and pauses
// when it leaves; tapping the sound button unmutes that one. Posters load
// first and video only on demand (preload="none"). Hebrew only, like the ads.

const SHORTS = [
  { n: 1, label: 'ירידה במשקל' },
  { n: 2, label: 'אין כוח לחפש קלוריות' },
  { n: 3, label: 'עלייה במשקל' },
  { n: 4, label: 'בניית מסה' },
  { n: 5, label: 'בלי לחפש, בלי לשקול' },
];
const src = (n, ext) => `${process.env.PUBLIC_URL || ''}/ads/short-${n}.${ext}`;

function Short({ n, label, reduce, soundOn, onSound }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);

  // Play while mostly visible (unless reduced motion); pause when it leaves.
  useEffect(() => {
    const v = ref.current;
    if (!v || reduce || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.intersectionRatio >= 0.6) v.play().catch(() => {});
      else v.pause();
    }, { threshold: [0, 0.6, 1] });
    io.observe(v);
    return () => io.disconnect();
  }, [reduce]);

  useEffect(() => { if (ref.current) ref.current.muted = !soundOn; }, [soundOn]);

  const start = () => { const v = ref.current; if (v) v.play().catch(() => {}); };

  return (
    <figure className="relative w-[220px] sm:w-[250px] flex-none snap-center">
      <div className="relative aspect-[9/16] overflow-hidden rounded-[28px] border border-bc-border bg-bc-surface2">
        <video
          ref={ref}
          src={src(n, 'mp4')}
          poster={src(n, 'jpg')}
          muted={!soundOn}
          loop
          playsInline
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className="h-full w-full object-cover"
          aria-label={label}
        />
        {!playing ? (
          <button
            type="button"
            onClick={start}
            aria-label={`הפעלת הסרטון: ${label}`}
            className={`absolute inset-0 flex items-center justify-center ${focusClass}`}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white">
              <Play size={24} aria-hidden="true" className="ms-0.5" />
            </span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={onSound}
          aria-pressed={soundOn}
          aria-label={soundOn ? `השתקת הסרטון: ${label}` : `הפעלת סאונד: ${label}`}
          className={`absolute bottom-3 end-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white ${focusClass}`}
        >
          {soundOn ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
        </button>
      </div>
      <figcaption className="mt-3 text-center text-[14px] font-semibold text-bc-muted">{label}</figcaption>
    </figure>
  );
}

export default function AdShorts({ language }) {
  const reduce = useReducedMotion();
  const [sound, setSound] = useState(null); // which short has sound on
  if (language !== 'hebrew') return null;
  return (
    <section className="bg-bc-band border-t border-bc-border py-16 sm:py-24 overflow-hidden">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
        <p className="inline-flex rounded-full border border-bc-border px-3 py-1 text-[13px] font-bold text-bc-accent-text">ב-20 שניות</p>
        <h2 className="mt-4 font-choice font-medium text-[32px] sm:text-[48px] leading-[1.08] text-bc-text">האפליקציה, לפי המטרה שלכם.</h2>
        <p className="mt-4 text-[17px] sm:text-[19px] font-semibold text-bc-muted">צילום, תפריט, אימונים ומאמנת. כ-20 שניות לכל מטרה.</p>
      </div>
      <div className="mt-10 mx-auto max-w-6xl">
        <div className="flex snap-x snap-mandatory gap-4 sm:gap-6 overflow-x-auto px-4 sm:px-6 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:justify-center">
          {SHORTS.map((s) => (
            <Short key={s.n} {...s} reduce={reduce} soundOn={sound === s.n} onSound={() => setSound((cur) => (cur === s.n ? null : s.n))} />
          ))}
        </div>
      </div>
    </section>
  );
}
