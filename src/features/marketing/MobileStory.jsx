import React, { useEffect, useRef, useState } from 'react';

// Below lg, a scroll story becomes one swipeable row (step text + its card per
// slide) instead of the same card stacked four times. Desktop keeps the sticky
// scroll. Active slide is tracked with an IntersectionObserver so it works in RTL.
export default function MobileStory({ steps, renderSlide, language, className = '' }) {
  const rowRef = useRef(null);
  const slideRefs = useRef([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const row = rowRef.current;
    if (!row || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) setActive(Number(e.target.dataset.index));
        });
      },
      { root: row, threshold: [0.6] }
    );
    slideRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [steps.length]);

  const goTo = (i) => slideRefs.current[i]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  const he = language === 'hebrew';

  return (
    <div className={className}>
      <div
        ref={rowRef}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-roledescription="carousel"
      >
        {steps.map((step, i) => (
          <div
            key={i}
            ref={(el) => (slideRefs.current[i] = el)}
            data-index={i}
            className="w-[88%] flex-none snap-center"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${steps.length}`}
          >
            {renderSlide(step, i, i === active)}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-2" role="tablist" aria-label={he ? 'שלבים' : 'Steps'}>
        {steps.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={`${i + 1}`}
            onClick={() => goTo(i)}
            className="flex h-11 w-8 items-center justify-center"
          >
            <span
              className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: i === active ? 22 : 7, backgroundColor: i === active ? 'var(--bc-accent)' : 'var(--bc-border)' }}
            />
          </button>
        ))}
      </div>
      <p className="mt-1 text-center text-[12px] font-semibold text-bc-muted">{he ? 'החליקו לשלב הבא' : 'Swipe for the next step'}</p>
    </div>
  );
}
