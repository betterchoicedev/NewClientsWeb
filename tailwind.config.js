/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      // BetterApp tokens (NAV_THEME). Values live as CSS variables in index.css
      // so light/dark switch with the `dark` class on <html>.
      colors: {
        bc: {
          canvas: 'var(--bc-canvas)',
          band: 'var(--bc-band)',
          surface: 'var(--bc-surface)',
          surface2: 'var(--bc-surface-2)',
          border: 'var(--bc-border)',
          accent: 'var(--bc-accent)',
          'accent-text': 'var(--bc-accent-text)',
          'on-accent': 'var(--bc-on-accent)',
          text: 'var(--bc-text)',
          muted: 'var(--bc-muted)',
          wellness: 'var(--bc-wellness)',
          'wellness-well': 'var(--bc-wellness-well)',
          danger: 'var(--bc-danger)',
          'danger-well': 'var(--bc-danger-well)',
        },
      },
      borderRadius: {
        'bc-card': '32px',
        'bc-button': '24px',
        'bc-field': '16px',
      },
      fontFamily: {
        // Choice Sans is Basic Latin only; Hebrew falls through to the system face.
        choice: ['"Choice Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'],
        // System face for body and Hebrew. Arial is there so Windows has a Hebrew sans before the generic fallback.
        system: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
