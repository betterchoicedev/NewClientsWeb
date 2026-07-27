import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

/** Hero fills at least one screen below nav; grows with content on smaller viewports */
export const HERO_VIEWPORT_CLASS = 'relative w-full shrink-0';

export const HERO_CONTENT_CLASS =
  'flex flex-col justify-center px-4 sm:px-6 md:px-8 py-6 md:py-10 pb-16 md:pb-12 min-h-[calc(100dvh-5rem)]';

const SCROLL_ROOT_SELECTOR = '[data-landing-scroll]';

/** Fixed scroll cue — visible on first screen, fades once user scrolls */
export default function HeroFlowBridge() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const scrollEl = document.querySelector(SCROLL_ROOT_SELECTOR);
    if (!scrollEl) return undefined;

    const onScroll = () => {
      setVisible(scrollEl.scrollTop < 80);
    };

    onScroll();
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25 }}
          className="fixed bottom-4 sm:bottom-5 md:bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
        >
          <div
            className={[
              'inline-flex flex-col items-center gap-1.5',
              'px-4 py-2 rounded-full',
              'border border-[color-mix(in_srgb,var(--theme-primary)_40%,transparent)]',
              'bg-[color-mix(in_srgb,var(--theme-surface)_92%,#000_8%)] backdrop-blur-xl backdrop-saturate-150',
              'shadow-[0_4px_20px_var(--theme-glow-primary),inset_0_1px_0_var(--theme-glass-sheen)]',
            ].join(' ')}
          >
            <div className="relative flex flex-col items-center h-6 overflow-hidden">
              <motion.div
                animate={{ y: [0, 5, 0], opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className="flex flex-col items-center -space-y-2"
              >
                <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-accent)]" strokeWidth={2.5} />
                <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-accent)] opacity-55" strokeWidth={2.5} />
              </motion.div>
            </div>

            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--theme-text)] leading-none">
              Scroll
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
