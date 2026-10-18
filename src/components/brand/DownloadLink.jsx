import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getDirectStoreUrl } from './storeLinks';

/**
 * The one download action. On a phone it opens that platform's store directly;
 * on desktop it goes to the badge row (#download) so people can pick a store.
 */
export default function DownloadLink({ className = '', children, ...rest }) {
  const location = useLocation();
  const storeUrl = getDirectStoreUrl();

  if (storeUrl) {
    return (
      <a href={storeUrl} target="_blank" rel="noopener noreferrer" className={className} {...rest}>
        {children}
      </a>
    );
  }

  // Pages with their own badge row (#download) scroll to it; others go to the home page's.
  const pageHasBadges = ['/', '/test'].includes(location.pathname);
  if (pageHasBadges) {
    const scrollToBadges = (event) => {
      const target = document.getElementById('download');
      if (!target) return;
      event.preventDefault();
      // Pages that mount sections lazily mount them all first, so the badges don't move mid-scroll.
      window.dispatchEvent(new Event('bc:reveal-all'));
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(() => target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }), 60);
      window.history.replaceState(null, '', '#download');
    };
    return (
      <a href="#download" onClick={scrollToBadges} className={className} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <Link to="/#download" className={className} {...rest}>
      {children}
    </Link>
  );
}
