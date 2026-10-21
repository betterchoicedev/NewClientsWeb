import React, { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { focusClass } from '../../../components/brand/ui';
import StickerTile, { stickerName } from './StickerTile';

// "Real food, every kitchen": two rows of food stickers (from the dietitian
// meal-plan builder) drifting in opposite directions. Pauses on hover; with
// reduced motion the rows sit still and scroll by hand.

const ROW_A = ['shakshuka', 'avocado-toast', 'poke-bowl', 'hummus-plate', 'falafel-in-pita', 'greek-salad', 'sushi-roll-plate', 'yogurt-parfait', 'malawach', 'acai-bowl', 'grilled-salmon-plate', 'pancakes'];
const ROW_B = ['overnight-oats', 'chicken-and-rice', 'israeli-salad', 'sabich', 'majadra', 'stuffed-peppers', 'schnitzel-in-pita', 'ramen', 'caesar-salad', 'challah', 'smoothie', 'cappuccino', 'watermelon', 'pomegranate'];

const copy = {
  hebrew: {
    title: 'אוכל אמיתי. מכל המטבחים.',
    body: 'שקשוקה בבוקר, סושי בחמישי, מלאווח בשבת. התפריט נבנה מהאוכל שאתם באמת אוכלים.',
  },
  english: {
    title: 'Real food. Every kitchen.',
    body: 'Shakshuka in the morning, sushi on Thursday, malawach on Saturday. The plan is built from the food you actually eat.',
  },
};

function Row({ items, language, reverse }) {
  const loop = [...items, ...items];
  return (
    <div className="hx-marquee-mask overflow-hidden" dir="ltr">
      <ul className={`hx-marquee flex w-max py-3 ${reverse ? 'hx-marquee-rev' : ''}`} style={{ '--dur': `${items.length * 5}s` }}>
        {loop.map((slug, i) => (
          <li key={`${slug}-${i}`} aria-hidden={i >= items.length ? 'true' : undefined} className="mr-4 sm:mr-6 flex w-[104px] sm:w-[124px] flex-col items-center gap-2">
            <StickerTile slugs={[slug]} size={96} play={false} className="sm:!w-[116px] sm:!h-[116px]" />
            <span className="text-center text-[13px] font-semibold text-bc-muted leading-tight" dir={language === 'hebrew' ? 'rtl' : 'ltr'}>{stickerName(slug, language)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function FoodBand({ language }) {
  const c = copy[language] || copy.english;
  const he = language === 'hebrew';
  const [paused, setPaused] = useState(false);
  return (
    <section className={`bg-bc-canvas border-t border-bc-border py-16 sm:py-24 overflow-hidden ${paused ? 'hx-marquee-paused' : ''}`}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
        <h2 className="font-choice font-medium text-[32px] sm:text-[48px] leading-[1.08] text-bc-text">{c.title}</h2>
        <p className="mt-4 text-[17px] sm:text-[19px] font-semibold text-bc-muted">{c.body}</p>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          className={`hx-marquee-toggle mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-bc-border px-4 text-[14px] font-semibold text-bc-muted hover:text-bc-text ${focusClass}`}
        >
          {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
          {paused ? (he ? 'המשך תנועה' : 'Play') : (he ? 'עצירת התנועה' : 'Pause')}
        </button>
      </div>
      <div className="mt-10 flex flex-col gap-2">
        <Row items={ROW_A} language={language} />
        <Row items={ROW_B} language={language} reverse />
      </div>
    </section>
  );
}
