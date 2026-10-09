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

  if (location.pathname === '/') {
    const scrollToBadges = (event) => {
      const target = document.getElementById('download');
      if (!target) return;
      event.preventDefault();
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
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
