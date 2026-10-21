import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { PhoneFrame } from './PhoneFrame';

// The scan, shown with the real app: four screens captured from BetterApp
// main's add-meal flow at iPhone size (photo preview, analyzing, what we
// found, the scores). The AI's answer in the captures is example data.
// Changing step slides the next screen in once, then it holds: no loops.

const STATUS = `${(57 / 852) * 100}%`;
const APP_BG = '#121915';
const ALT = {
  hebrew: {
    snap: 'תצוגה מקדימה של צילום הצלחת, מוכן לניתוח AI',
    identify: 'מסך הניתוח: מזהים מזונות בצלחת, מעריכים משקלים וכמויות',
    measure: 'מה מצאנו: חמישה רכיבים עם קלוריות וגרמים לכל אחד',
    plan: 'התוצאה: 652 קלוריות, ציון בריאות 9 והתאמה למטרה 9',
  },
  english: {
    snap: 'Photo preview of the plate, ready for AI analysis',
    identify: 'The analysis screen: identifying foods, estimating weights and portions',
    measure: 'What we found: five items, each with calories and grams',
    plan: 'The result: 652 kcal, a health score of 9 and a goal fit of 9',
  },
};
const src = (language, step) => `${process.env.PUBLIC_URL || ''}/app-screens/${language === 'hebrew' ? 'he' : 'en'}-scan-${step}.webp`;

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

export default function ScanMotion({ stepKey, language, className = '', eager = false }) {
  const reduce = useReducedMotion();
  const alt = (ALT[language] || ALT.english)[stepKey] || '';
  return (
    <div className={`flex items-center justify-center rounded-bc-card py-8 ${className}`} style={{ backgroundColor: 'var(--scene-bg)' }}>
      <PhoneFrame label={alt}>
        <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: APP_BG }}>
          <StatusBar />
          <div className="absolute inset-x-0 bottom-0 overflow-hidden" style={{ top: STATUS }}>
            <AnimatePresence initial={false}>
              <motion.img
                key={stepKey}
                src={src(language, stepKey)}
                alt=""
                loading={eager ? 'eager' : 'lazy'}
                decoding="async"
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover object-top"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0.2 : 0.5, ease: 'easeOut' }}
              />
            </AnimatePresence>
          </div>
        </div>
      </PhoneFrame>
    </div>
  );
}
