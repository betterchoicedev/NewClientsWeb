// Beti, the coach (mascot art from BetterApp assets/mascot, live on main).
//
// Reply format mirrors the app: after a logged meal Beti sends two short
// bubbles: how the meal sits against the plan, then a next step with an
// amount (backendapi/app/prompts/scoring_coach.py). Chat answers can carry a
// macro card.
//
// EXAMPLE COPY until real replies are captured from the demo account; then
// replace and set IS_EXAMPLE to false. The ASK.next reply is a real one seen
// in the app's chat (grilled fish / quinoa / salad, 360 kcal).
export const IS_EXAMPLE = true;

export const BETI_ART = {
  avatar: '/beti/avatar.png',
  wave: '/beti/wave.png',
  cheer: '/beti/cheer.png',
  thumb: '/beti/thumb.png',
};

// "When life happens": real moments, and how Beti answers them.
export const MOMENTS = [
  {
    key: 'pizza',
    time: '23:10',
    title: { hebrew: 'פיצה בלילה', english: 'Pizza at 11pm' },
    you: { hebrew: 'אכלתי שני משולשים פיצה', english: 'Had two slices of pizza' },
    beti: [
      { hebrew: 'בערך 560 קק״ל, קצת מעל יעד הערב. זה בסדר גמור.', english: 'About 560 kcal, a bit over your evening target. Totally fine.' },
      { hebrew: 'מחר נפתח בארוחת בוקר עם 30 ג׳ חלבון, ואתם בדיוק במסלול.', english: 'Start tomorrow with a breakfast with 30 g protein and you’re right back on track.' },
    ],
  },
  {
    key: 'wedding',
    time: 'שישי',
    timeEn: 'Friday',
    title: { hebrew: 'חתונה בשישי', english: 'A wedding on Friday' },
    you: { hebrew: 'יש לי חתונה בשישי. מה עושים?', english: 'I have a wedding on Friday. What do I do?' },
    beti: [
      { hebrew: 'נהנים! במהלך היום נשמור על ארוחות קלות עם חלבון.', english: 'You enjoy it! During the day we keep meals light, with protein.' },
      { hebrew: 'בחתונה: מנה עיקרית, הרבה ירקות, וקינוח אם בא לכם. ביום ראשון ממשיכים רגיל.', english: 'At the wedding: a main, plenty of veg, and dessert if you want it. Sunday, back to normal.' },
    ],
  },
  {
    key: 'lunch',
    time: '16:40',
    title: { hebrew: 'פספסתם צהריים', english: 'You skipped lunch' },
    you: { hebrew: 'לא הספקתי לאכול צהריים', english: 'Didn’t get to eat lunch' },
    beti: [
      { hebrew: 'נשארו לכם 1,050 קק״ל להיום. לא צריך לפצות על הכל בבת אחת.', english: 'You have 1,050 kcal left today. No need to make it all up at once.' },
      { hebrew: 'עכשיו: יוגורט עם פרי. בערב: חזה עוף 150 ג׳, אורז 150 ג׳ וסלט.', english: 'Now: yogurt with fruit. Tonight: 150 g chicken breast, 150 g rice and a salad.' },
    ],
  },
];

// "Ask Beti" demo: preset questions (the first is a real suggested prompt in the app).
export const ASK = [
  {
    key: 'next',
    q: { hebrew: 'מה לאכול בארוחה הבאה?', english: 'What should I eat for my next meal?' },
    a: {
      hebrew: 'לפי מה שאכלתם היום, משהו עשיר בחלבון: דג על הגריל (150 ג׳), קינואה (100 ג׳ מבושלת) וסלט ירוק עם כפית שמן זית.',
      english: 'Given your day so far, something protein-rich: grilled fish (150 g), quinoa (100 g cooked) and a green salad with a teaspoon of olive oil.',
    },
    card: { kcal: 360, p: 35, c: 25, f: 10 },
  },
  {
    key: 'protein',
    q: { hebrew: 'כמה חלבון נשאר לי היום?', english: 'How much protein do I have left today?' },
    a: {
      hebrew: 'נשארו לכם 48 ג׳ חלבון. ארוחת ערב עם חזה עוף וכוס יוגורט אחר כך סוגרים את זה.',
      english: 'You have 48 g of protein left. Chicken breast at dinner and a yogurt later covers it.',
    },
  },
  {
    key: 'sweet',
    q: { hebrew: 'בא לי משהו מתוק', english: 'I’m craving something sweet' },
    a: {
      hebrew: 'לגמרי מותר. שתי קוביות שוקולד מריר (כ-100 קק״ל) נכנסות לכם היום בלי בעיה.',
      english: 'Totally allowed. Two squares of dark chocolate (about 100 kcal) fit in your day with no problem.',
    },
  },
];

// The day loop: one day, four moments, a running total against the plan.
export const DAY = {
  targetKcal: 1800,
  steps: [
    {
      time: '08:30',
      meal: { hebrew: 'יוגורט, גרנולה ופירות', english: 'Yogurt, granola and fruit' },
      how: { hebrew: 'צילום', english: 'Photo' },
      kcal: 420,
      beti: { hebrew: 'פתיחה טובה. לצהריים כוונו ל-35 ג׳ חלבון.', english: 'Good start. Aim for 35 g protein at lunch.' },
    },
    {
      time: '13:30',
      meal: { hebrew: 'שווארמה בפיתה', english: 'Shawarma in pita' },
      how: { hebrew: 'צילום', english: 'Photo' },
      kcal: 850,
      beti: { hebrew: 'צהריים גדולים, בלי דרמה. הערב נעשה קליל יותר.', english: 'A bigger lunch, no drama. Dinner goes lighter.' },
    },
    {
      time: '19:00',
      meal: { hebrew: 'חביתה משתי ביצים וסלט', english: 'Two-egg omelette and salad' },
      how: { hebrew: 'הצעה של Beti', english: 'Beti’s suggestion' },
      kcal: 350,
      beti: { hebrew: 'בדיוק מה שהיום היה צריך.', english: 'Exactly what today needed.' },
    },
    {
      time: '22:00',
      meal: { hebrew: 'היום נסגר', english: 'Day closed' },
      how: { hebrew: 'סיכום', english: 'Wrap-up' },
      kcal: 0,
      beti: { hebrew: 'בתוך היעד, גם עם השווארמה. הרצף ממשיך.', english: 'On target, shawarma and all. The streak continues.' },
    },
  ],
};
