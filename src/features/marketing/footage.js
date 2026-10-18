// BetterApp screen recordings for the landing page phones.
//
// Clips were recorded from the real BetterApp (Expo web build, dark
// mode, 393x795: the iPhone app area below the status bar the frame draws) on a
// demo account, encoded as muted H.264 .mp4 with a first-frame
// poster. To replace one, drop a new portrait recording into public/footage/
// under the same name. A null entry, or a file that fails to load, shows a
// marked placeholder.
//
// Wellness and Journey are "Coming soon" in the app; add their clips here when they ship.
// Do not use NewDietitianWeb's public/mascot clips here: those are dietitian
// tour videos, not BetterApp.
const clip = (name) => ({ src: `/footage/${name}.mp4`, poster: `/footage/${name}.jpg` });

export const FOOTAGE = {
  hero: clip('hero'), // Nutrition daily log
  nutrition: clip('nutrition'), // Breakfast expanded with logged foods and macros
  training: clip('training'), // Today's workout and planned exercises
  chat: clip('chat'), // AI chat conversation
  diary: clip('diary'), // Analytics: logged calories vs plan over time
};

// Per-language clips. The Hebrew page should show the app in Hebrew: record the
// same five screens with the app set to Hebrew, save them as e.g.
// public/footage/hero.he.mp4 + hero.he.jpg, and list them here. Keys left out
// fall back to FOOTAGE above (no request is made for files that aren't listed).
export const FOOTAGE_BY_LANGUAGE = {
  hebrew: {
    // hero: { src: '/footage/hero.he.mp4', poster: '/footage/hero.he.jpg' },
  },
};

/** The clip for a screen in the page's language, falling back to the default. */
export const footageFor = (key, language) => FOOTAGE_BY_LANGUAGE[language]?.[key] || FOOTAGE[key] || null;

/** Where each clip is expected to live, shown inside the placeholder. */
export const footagePathHint = (key) => `public/footage/${key}.mp4`;
