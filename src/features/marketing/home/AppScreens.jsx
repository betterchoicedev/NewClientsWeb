import React, { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';

// Real BetterApp screens (current main, dark mode, the demo account), captured
// from the app's web build at iPhone size (393x795 app area @3x, saved at 2x as
// webp in public/app-screens). The day's data is example data served to the
// capture browser only. The phone's status bar is drawn here, above the app area.
// Nutrition plays "lunch gets logged": breakfast only, then breakfast + lunch.

const STATUS = `${(57 / 852) * 100}%`;
const APP_BG = '#121915';
const FILES = { nutrition: 'nutrition', training: 'training', chat: 'chat' };
const ALT = {
  hebrew: { nutrition: 'מסך התזונה באפליקציה: היום, נותר, חלבון, פחמימות, שומן, מים והארוחות שתועדו', training: 'מסך תוכנית האימונים: השבוע, האימון של היום והתרגילים', chat: 'צ׳אט עם המאמנת: שאלה על פיצה ותשובה עם מספרים מהשבוע' },
  english: { nutrition: 'The app’s nutrition screen: today, remaining calories, protein, carbs, fat, water and logged meals', training: 'The training plan screen: the week, today’s workout and the exercises', chat: 'A chat with the coach: a question about pizza, answered with numbers from the week' },
};
const src = (lang, name) => `${process.env.PUBLIC_URL || ''}/app-screens/${lang}-${name}.webp`;

function StatusBar() {
  return (
    <div aria-hidden="true" className="absolute inset-x-0 top-0 flex items-center justify-between px-[7%] text-white" style={{ height: STATUS, backgroundColor: APP_BG }} dir="ltr">
      <span className="text-[11px] sm:text-[12px] font-semibold tabular-nums">9:41</span>
      <span className="flex items-center gap-[4px]">
        <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor"><rect x="0" y="7" width="3" height="3" rx="0.7" /><rect x="4.3" y="5" width="3" height="5" rx="0.7" /><rect x="8.6" y="2.5" width="3" height="7.5" rx="0.7" /><rect x="12.9" y="0" width="3" height="10" rx="0.7" /></svg>
        <svg width="22" height="11" viewBox="0 0 24 11" fill="none"><rect x="0.5" y="0.5" width="20" height="10" rx="3" stroke="currentColor" opacity="0.4" /><rect x="2" y="2" width="15" height="7" rx="1.6" fill="currentColor" /></svg>
      </span>
    </div>
  );
}

/** One real app screen, filling a PhoneFrame's screen area. */
export function AppScreen({ screen = 'nutrition', language, eager = false }) {
  const lang = language === 'hebrew' ? 'he' : 'en';
  const alt = (ALT[language] || ALT.english)[screen] || '';
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.5 });
  const reduce = useReducedMotion();
  const [after, setAfter] = useState(true);

  // Nutrition: show the day before lunch, then lunch lands; repeats while on screen.
  useEffect(() => {
    if (screen !== 'nutrition' || reduce || !inView) { setAfter(true); return undefined; }
    let on = false;
    setAfter(false);
    const id = setInterval(() => { on = !on; setAfter(on); }, 3200);
    return () => clearInterval(id);
  }, [screen, reduce, inView]);

  const loading = eager ? 'eager' : 'lazy';
  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden" style={{ backgroundColor: APP_BG }}>
      <StatusBar />
      <div className="absolute inset-x-0 bottom-0" style={{ top: STATUS }}>
        {screen === 'nutrition' ? (
          <>
            <img src={src(lang, 'nutrition-before')} alt="" aria-hidden="true" loading={loading} decoding="async" draggable={false}
              className="absolute inset-0 h-full w-full object-cover object-top" />
            <img src={src(lang, 'nutrition')} alt={alt} loading={loading} decoding="async" draggable={false}
              className="absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-700" style={{ opacity: after ? 1 : 0 }} />
          </>
        ) : (
          <img src={src(lang, FILES[screen] || 'nutrition')} alt={alt} loading={loading} decoding="async" draggable={false}
            className="absolute inset-0 h-full w-full object-cover object-top" />
        )}
      </div>
    </div>
  );
}
