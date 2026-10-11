// The plate shown in the scan story.
//
// EXAMPLE DATA until the real iPhone Pro recording arrives: replace these
// values with the exact foods, grams and macros from that scan, then set
// IS_EXAMPLE to false so the "illustrative example" label disappears.
export const IS_EXAMPLE = true;

// Positions are in the stage's 400x400 SVG space.
export const FOODS = [
  {
    key: 'rice',
    name: { hebrew: 'אורז לבן', english: 'White rice' },
    confidence: 92,
    mounded: true, // depth refines mounded foods (rice, pasta, salad)
    grams: 150,
    kcal: 195,
    p: 4,
    c: 42,
    f: 0.5,
    box: { x: 70, y: 150, w: 130, h: 110 },
    // volume x density = grams (shown in the "calculate" step)
    volumeMl: 180,
    density: 0.83,
  },
  {
    key: 'chicken',
    name: { hebrew: 'חזה עוף', english: 'Chicken breast' },
    confidence: 88,
    mounded: false,
    grams: 120,
    kcal: 198,
    p: 37,
    c: 0,
    f: 4,
    box: { x: 205, y: 100, w: 125, h: 95 },
  },
  {
    key: 'salad',
    name: { hebrew: 'סלט קצוץ', english: 'Chopped salad' },
    confidence: 90,
    mounded: true,
    grams: 110,
    kcal: 25,
    p: 1,
    c: 5,
    f: 0.2,
    box: { x: 195, y: 205, w: 120, h: 100 },
  },
  {
    key: 'tahini',
    name: { hebrew: 'טחינה', english: 'Tahini' },
    confidence: 84,
    mounded: false,
    grams: 20,
    kcal: 120,
    p: 3.4,
    c: 2,
    f: 10.8,
    box: { x: 120, y: 268, w: 70, h: 55 },
  },
];

export const TOTALS = FOODS.reduce(
  (t, f) => ({ kcal: t.kcal + f.kcal, p: t.p + f.p, c: t.c + f.c, f: t.f + f.f }),
  { kcal: 0, p: 0, c: 0, f: 0 }
);

export const PLAN = {
  // the lunch slot target this example meal is scored against
  slotKcal: 600,
  tip: {
    hebrew: 'מצוין לצהריים. בערב השאירו מקום לעוד 30 ג׳ חלבון.',
    english: 'Right on for lunch. Leave room for 30 g more protein tonight.',
  },
};
