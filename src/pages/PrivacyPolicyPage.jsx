import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Navigation from '../components/Navigation';
import * as CookieConsent from 'vanilla-cookieconsent';

const content = {
  "hebrew": {
    "lastUpdated": "תאריך פרסום ותחילת תוקף: 30/9/2026",
    "version": "גרסה: 1",
    "note": "הנוסח העברי של מדיניות זו הוא הנוסח המחייב. הנוסח האנגלי הוא תרגום בלבד.",
    "sections": [
      {
        "title": "1. מי אנחנו",
        "blocks": [
          {
            "type": "p",
            "text": "האפליקציה BetterChoice AI (ל-iOS ול-Android) והאתר betterchoice.one מופעלים על ידי Better Choice AI, Co., שכתובתה הרשומה היא 1111B S Governors Ave STE 26347, Dover, Delaware 19904, ארצות הברית (\"אנחנו\")."
          },
          {
            "type": "p",
            "text": "אנחנו בעלי השליטה במאגר המידע שבו נשמר המידע שלכם."
          },
          {
            "type": "p",
            "text": "איש הקשר לענייני פרטיות: Roy Ramon, מייסד ומנכ\"ל, info@betterchoice.live."
          }
        ]
      },
      {
        "title": "2. על מה חלה המדיניות",
        "blocks": [
          {
            "type": "p",
            "text": "המדיניות חלה על האפליקציה BetterChoice AI ועל האתר betterchoice.one. סעיף 13 עוסק באתר בלבד. כל שאר הסעיפים עוסקים באפליקציה."
          },
          {
            "type": "p",
            "text": "האפליקציה היא אפליקציית וולנס (אורח חיים). היא לא מרפאה, לא נותנת שירות רפואי ולא מאובחנת כאביזר רפואי."
          }
        ]
      },
      {
        "title": "3. האם אתם חייבים למסור מידע",
        "blocks": [
          {
            "type": "p",
            "text": "אין חובה בחוק למסור לנו מידע. בלי מידע מסוים חלק מהתכונות לא יעבדו. למשל: בלי תאריך לידה אי אפשר להירשם, ובלי משקל וגובה אי אפשר לחשב יעדי קלוריות."
          },
          {
            "type": "p",
            "text": "שדות רגישים הם לפי בחירתכם, והשירות הבסיסי יעבוד גם בלעדיהם. השדות האלה הם: מצבים רפואיים, אלרגיות, הריון, הנקה וגיל המעבר."
          }
        ]
      },
      {
        "title": "4. איזה מידע אנחנו אוספים, למה, ועל איזה בסיס",
        "blocks": [
          {
            "type": "p",
            "text": "**בסיס חוקי.** בישראל, אנחנו מסתמכים על ההסכמה המדעת שאתם נותנים כשאתם נרשמים וכשאתם מפעילים כל תכונה. אנחנו מסתמכים גם על חובות שחלות עלינו לפי דין, למשל חובות מס."
          },
          {
            "type": "p",
            "text": "אם אתם באזור הכלכלי האירופי או בבריטניה, ראו גם סעיף 11."
          },
          {
            "type": "table",
            "headers": [
              "קטגוריה",
              "מה בדיוק",
              "למה"
            ],
            "rows": [
              [
                "זהות ופרטי קשר",
                "שם פרטי ושם משפחה, דוא\"ל, טלפון, קידומת מדינה, עיר, אזור, אזור זמן, שפה מועדפת, תאריך לידה, מגדר",
                "יצירת החשבון, אימות גיל (18+), התאמת שפה ושעות, יצירת קשר בענייני החשבון"
              ],
              [
                "גוף ותזונה",
                "גובה, משקל, משקל יעד, רמת פעילות ותיאורה, מטרה, סגנון תזונה, חלון אכילה, יעדי קלוריות ומאקרו, מספר ארוחות ומבנה ארוחות",
                "חישוב הערכות של יעדים, בניית תפריטים ותוכניות אימון"
              ],
              [
                "**מידע רגיש**",
                "אלרגיות, מגבלות מזון, מצבים רפואיים שאתם כותבים בטקסט חופשי, מצב פיזיולוגי (הריון, הנקה, גיל המעבר), סטטוס הנקה",
                "התאמת תפריטים ותשובות צ'אט, והצגת אזהרות. **הסינון לפי אלרגיות הוא מאמץ סביר בלבד. הוא לא מבטיח שמזון בטוח לכם** (ראו תנאי השימוש)"
              ],
              [
                "יומן",
                "ארוחות, מים, קלוריות ומאקרו, כיתובים לארוחה (תמונת הארוחה לא נשמרת ביומן), משקל, אימונים, אירועי יומן, הגדרות תזכורות תוספים",
                "הצגת היומן, גרפים והתקדמות"
              ],
              [
                "צ'אט",
                "ההודעות שלכם, תשובות ה-AI וההיסטוריה",
                "ניהול השיחה והמשכיות"
              ],
              [
                "נתוני בריאות מהטלפון (iOS בלבד בגרסה זו)",
                "צעדים ושינה של 7 הימים האחרונים",
                "הצגה במסך הבריאות ושמירה בשרת (ראו סעיף 5.5)"
              ],
              [
                "מסחרי",
                "מזהה לקוח ומצב מנוי ב-Stripe, קודי גישה והטבות שמימשתם",
                "ניהול המנוי. **אנחנו לא מקבלים את מספר כרטיס האשראי שלכם**. Stripe מעבדת אותו"
              ],
              [
                "קשר לאיש מקצוע או לארגון",
                "מזהה המנהל שהזמין אתכם (manager_id), קישור ההזמנה, מזהה הארגון, תשובות לשאלות הרשמה שהארגון הוסיף",
                "שיוך החשבון לאיש המקצוע או לארגון שהזמין אתכם (ראו סעיף 5.10)"
              ],
              [
                "טכני",
                "אסימוני התחברות, אסימון התראות (Expo push token), לוגים של שגיאות בשרת",
                "התחברות, התראות, אבטחה ותיקון תקלות"
              ]
            ]
          },
          {
            "type": "p",
            "text": "אנחנו לא משתמשים במידע שלכם לפרסום. אנחנו לא בונים פרופיל פרסומי ולא אוספים מזהה פרסום."
          }
        ]
      },
      {
        "title": "5. תכונות מסוימות — מה נשלח ולאן",
        "blocks": [
          {
            "type": "h",
            "text": "5.1 הרשמה והתחברות"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "**דוא\"ל וסיסמה.** ההתחברות מנוהלת דרך Supabase. הודעות איפוס סיסמה נשלחות דרך Supabase.",
                "children": []
              },
              {
                "text": "**Sign in with Apple.** אנחנו מקבלים מ-Apple מזהה, ואת השם והדוא\"ל שבחרתם לשתף. אם בחרתם \"Hide My Email\", נקבל כתובת ממסר (relay) של Apple.",
                "children": []
              },
              {
                "text": "**Google.** Supabase מקבלת מ-Google את זהות חשבון Google שלכם: מזהה, שם, דוא\"ל ותמונת פרופיל אם קיימת.",
                "children": []
              }
            ]
          },
          {
            "type": "h",
            "text": "5.2 ניתוח תמונת ארוחה בבינה מלאכותית"
          },
          {
            "type": "p",
            "text": "התכונה פועלת רק אחרי שאישרתם אותה במסך הסכמה ייעודי."
          },
          {
            "type": "p",
            "text": "**מה נשלח:**"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "התמונה, תווית הארוחה והכיתוב שהוספתם. **התמונה לא נשמרת ביומן.**",
                "children": []
              },
              {
                "text": "בניתוח טקסט, בניקוד ובתקון ארוחה: תיאור הארוחה, תווית הארוחה, היומן של היום, והתפריט שהוקצה. אם יש כיתוב, גם הוא. **לא** נשלחים אלרגיות, מצבים רפואיים, גיל או מגדר.",
                "children": []
              },
              {
                "text": "בהמרת מידות מרכיבים: שם המרכיב, המותג, המידה המקורית, והעדפת השפה והאזור שלכם.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "**מי מקבל:** השרת שלנו שולח את הבקשה אל BetterProxy, שרץ על השרתים שלנו. BetterProxy קורא למודלים של Anthropic ושל Google כדי להחזיר את התוצאה."
          },
          {
            "type": "p",
            "text": "**שמירה ואימון:** אנחנו לא משתמשים במידע כדי לאמן מודלים. הספקים האלה מקבלים את הבקשה רק כדי להחזיר תוצאה. אנחנו לא מתירים להם לאמן מודלים על המידע או לשמור אותו מעבר ליצירת התוצאה."
          },
          {
            "type": "p",
            "text": "**ביטול:** אפשר לבטל את ההסכמה בכל עת בהגדרות, תחת \"איפוס הרשאות AI\". ההסכמה נשמרת רק במכשיר שלכם. לכן היא לא עוברת למכשיר אחר, ומחיקת האפליקציה מוחקת אותה."
          },
          {
            "type": "h",
            "text": "5.3 צ'אט AI והודעות קוליות"
          },
          {
            "type": "p",
            "text": "הצ'אט פועל רק אחרי הסכמה במסך ייעודי. כדי שהתשובות יתאימו לכם, השרת שולח:"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "את ההודעה ואת היסטוריית השיחה;",
                "children": []
              },
              {
                "text": "את פרופיל התזונה שלכם, **כולל אלרגיות, מצבים רפואיים, גיל, מגדר, עיר, אזור וסטטוס הנקה**, וכן מטרות ויעדי מאקרו;",
                "children": []
              },
              {
                "text": "את הצריכה היומית ואת הצריכה של 7 הימים האחרונים;",
                "children": []
              },
              {
                "text": "את התפריט ואת תוכנית האימון.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "מי מקבל: BetterProxy, שרץ על השרתים שלנו, וקורא למודלים של Anthropic ושל Google."
          },
          {
            "type": "p",
            "text": "**הודעה קולית:** ההקלטה נשלחת לשרת שלנו, ומשם אל Google Cloud Speech-to-Text, שהופך אותה לטקסט. אנחנו מוחקים את עותק ההקלטה מהשרת שלנו כשהטקסט חוזר. אנחנו לא משתמשים בהקלטה כדי לאמן מודלים. אחרי זה הטקסט מטופל כמו הודעה כתובה ונשמר בהיסטוריית הצ'אט."
          },
          {
            "type": "p",
            "text": "המיקרופון פועל רק כשאתם מקליטים הודעה."
          },
          {
            "type": "p",
            "text": "היסטוריית הצ'אט נשמרת בשרתים שלנו (ראו סעיף 9). ההסכמה נשמרת רק במכשיר, ואפשר לבטל אותה בהגדרות תחת \"איפוס הרשאות AI\"."
          },
          {
            "type": "h",
            "text": "5.4 כתיבה ל-Apple Health ול-Health Connect"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "**iOS:** אם תאשרו, האפליקציה כותבת ל-Apple Health את הארוחות שתיעדתם כנתוני תזונה, ואת המים כנתוני שתייה.",
                "children": []
              },
              {
                "text": "**Android:** אם תאשרו, האפליקציה כותבת ל-Health Connect את המים בלבד, כנתוני שתייה. היא לא כותבת ארוחות.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "אפליקציות אחרות שקיבלו מכם הרשאה ב-Apple Health או ב-Health Connect, למשל Samsung Health, עשויות לקרוא את הנתונים האלה. זה נעשה לפי הגדרות הטלפון שלכם, לא דרכנו."
          },
          {
            "type": "h",
            "text": "5.5 קריאה מ-Apple Health ושליחה לשרת שלנו"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "**iOS:** אם תאשרו, האפליקציה קוראת מ-Apple Health את מספר הצעדים ואת נתוני השינה של 7 הימים האחרונים. **כשפותחים את מסך יומן הבריאות, הנתונים האלה נשלחים לשרת שלנו ונשמרים בחשבון שלכם.**",
                "children": []
              },
              {
                "text": "**Android:** בגרסה זו האפליקציה לא קוראת צעדים ושינה מ-Health Connect.",
                "children": []
              },
              {
                "text": "האפליקציה לא ניגשת לרשומות קליניות ב-Apple Health.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "נתונים שמגיעים מ-Apple Health או מ-Health Connect משמשים רק להפעלת תכונות הבריאות באפליקציה. אנחנו לא משתמשים בהם לפרסום או לשיווק, ולא מוכרים אותם."
          },
          {
            "type": "p",
            "text": "אפשר לבטל את הגישה בכל עת. ב-iOS: הגדרות ← בריאות ← גישה לנתונים ומכשירים. ב-Android: הגדרות Health Connect. ביטול הגישה לא מוחק נתונים שכבר נשלחו לשרת שלנו. כדי למחוק אותם, פנו אלינו (סעיף 10)."
          },
          {
            "type": "h",
            "text": "5.6 סריקת ברקוד"
          },
          {
            "type": "p",
            "text": "כשאתם סורקים ברקוד, **הטלפון שולח את מספר הברקוד ישירות ל-Open Food Facts** (world.openfoodfacts.org). Open Food Facts הוא מאגר מזון פתוח שמופעל מצרפת. כמו בכל פנייה לאתר, השירות מקבל גם את כתובת ה-IP של הטלפון. אנחנו לא שולחים ל-Open Food Facts את השם שלכם או פרטי חשבון."
          },
          {
            "type": "h",
            "text": "5.7 מיקום"
          },
          {
            "type": "p",
            "text": "האפליקציה לא מבקשת גישה למיקום ואין בה חנות."
          },
          {
            "type": "h",
            "text": "5.8 התראות"
          },
          {
            "type": "p",
            "text": "האפליקציה יוצרת במכשיר תזכורות ליומן, לתוספים ולחוסר פעילות. בנוסף, אסימון ההתראות של המכשיר נשמר בשרת שלנו, כדי שנוכל לשלוח התראות כמו \"הניתוח מוכן\". ההתראות האלה עוברות דרך Expo, ומשם דרך שירותי ההתראות של Apple ושל Google."
          },
          {
            "type": "p",
            "text": "אפשר לכבות התראות בהגדרות הטלפון."
          },
          {
            "type": "h",
            "text": "5.9 תשלום"
          },
          {
            "type": "p",
            "text": "התשלום מתבצע בדף תשלום של Stripe בדפדפן. Stripe מקבלת את פרטי הכרטיס ואת פרטי החיוב, ומעבדת אותם לפי מדיניות הפרטיות שלה. היא עושה זאת גם כגורם עצמאי, למשל למניעת הונאות. אנחנו מקבלים מ-Stripe רק מזהה לקוח, את מצב המנוי ואת היסטוריית החיובים. החשבון שגובה את התשלום הוא Better Choice AI, Co. בארצות הברית."
          },
          {
            "type": "h",
            "text": "5.10 איש מקצוע או ארגון שהזמינו אתכם"
          },
          {
            "type": "p",
            "text": "אם הצטרפתם דרך קישור הזמנה של דיאטנית, מאמן, מנהל או ארגון, **אותו אדם או ארגון יכולים לראות את נתוני הלקוחות שלהם:** הפרופיל, היומן, המשקל, המידע הרגיש, הצ'אט והתוכניות. הם יכולים לראות גם את התשובות שלכם לשאלות שהארגון הוסיף להרשמה."
          },
          {
            "type": "p",
            "text": "אנחנו לא נותנים שירות של דיאטנית מוסמכת. איש המקצוע או הארגון משתמשים במידע במסגרת הקשר שלהם אתכם."
          },
          {
            "type": "p",
            "text": "אם לא הצטרפתם דרך הזמנה, אף איש מקצוע לא מקבל גישה לחשבון שלכם."
          },
          {
            "type": "h",
            "text": "5.11 מה נשאר רק במכשיר"
          },
          {
            "type": "p",
            "text": "הדברים הבאים נשמרים רק במכשיר ונמחקים כשמוחקים את האפליקציה:"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "ההסכמות ל-AI;",
                "children": []
              },
              {
                "text": "אישור ההודעה הרפואית וגרסת המסמכים המשפטיים שאישרתם;",
                "children": []
              },
              {
                "text": "מזהי התראות וסימניות סנכרון.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "**לכן אין לנו תיעוד בשרת של האישורים האלה.**"
          },
          {
            "type": "p",
            "text": "אם השתמשתם בתכונת שמירת תמונה, התמונה נשמרת גם בספריית התמונות שלכם."
          }
        ]
      },
      {
        "title": "6. למי אנחנו מעבירים מידע",
        "blocks": [
          {
            "type": "p",
            "text": "אנחנו לא מוכרים מידע אישי. אלה הגורמים שמקבלים מידע:"
          },
          {
            "type": "table",
            "headers": [
              "גורם",
              "תפקיד",
              "איזה מידע",
              "מדינה או אזור"
            ],
            "rows": [
              [
                "Supabase, Inc.",
                "אחסון מסד הנתונים והתחברות (מעבד מטעמנו). מסד החשבון, ומסד היומן והצ'אט",
                "כל נתוני החשבון, היומן, הצ'אט ונתוני הבריאות שנשלחו",
                "חברה אמריקאית. האחסון בפרנקפורט, גרמניה"
              ],
              [
                "Google Cloud",
                "הפעלת השרתים שלנו (Cloud Run), ואתר betterchoice.one",
                "כל מידע שעובר דרך השרתים",
                "ישראל (me-west1): השרת הראשי. גרמניה (europe-west3): ממשק הדיאטנים. הולנד (europe-west4): צ'אט AI. בלגיה (europe-west1): שירות התוכניות LifeOS"
              ],
              [
                "Google Cloud Speech-to-Text",
                "תמלול הודעות קוליות",
                "הקלטה ושפה",
                "Google Cloud"
              ],
              [
                "BetterProxy, עם מודלים של Anthropic ושל Google",
                "ניתוח תמונות וטקסט, וצ'אט",
                "ראו סעיפים 5.2 ו-5.3",
                "BetterProxy רץ על השרתים שלנו. המודלים הם של Anthropic ושל Google"
              ],
              [
                "LifeOS, מופעל על ידינו ב-Google Cloud",
                "שיוך לתוכניות לפי ארגון",
                "מזהה משתמש, מזהה ארגון, תוכנית",
                "בלגיה (europe-west1)"
              ],
              [
                "Stripe, Inc., עבור Better Choice AI, Co.",
                "תשלומים",
                "שם, דוא\"ל, פרטי כרטיס וחיוב, מנוי",
                "ארצות הברית"
              ],
              [
                "Expo (650 Industries, Inc.)",
                "שליחת התראות",
                "אסימון התראות ותוכן ההתראה",
                "ארצות הברית"
              ],
              [
                "Apple",
                "Sign in with Apple, התראות, Apple Health (במכשיר)",
                "כמתואר בסעיף 5",
                "ארצות הברית / גלובלי"
              ],
              [
                "Google",
                "התחברות עם Google, התראות ב-Android, Health Connect (במכשיר)",
                "כמתואר בסעיף 5",
                "ארצות הברית / גלובלי"
              ],
              [
                "Open Food Facts",
                "חיפוש מוצר לפי ברקוד (ישירות מהטלפון)",
                "מספר ברקוד וכתובת IP",
                "צרפת"
              ],
              [
                "Slack",
                "התראות תקלה לצוות, כשההתראה מופעלת",
                "הודעת שגיאה, חריגה, הקשר טכני קצר, והערת מודל. זה לא היומן",
                "ארצות הברית"
              ],
              [
                "איש מקצוע או ארגון שהזמינו אתכם",
                "ראו סעיף 5.10",
                "ראו סעיף 5.10",
                "לפי מקום פעילותם"
              ],
              [
                "רשויות ובתי משפט",
                "רק כשהחוק מחייב או לפי צו",
                "מה שנדרש",
                "—"
              ]
            ]
          },
          {
            "type": "p",
            "text": "אם נצרף גורם חדש שיקבל מידע רגיש, נעדכן את הטבלה ונודיע לכם מראש (סעיף 14)."
          }
        ]
      },
      {
        "title": "7. העברת מידע לחו\"ל",
        "blocks": [
          {
            "type": "p",
            "text": "המידע נשמר ומעובד בישראל, באיחוד האירופי ובארצות הברית. הוא עשוי להיות מעובד גם במדינות נוספות שבהן פועלים הספקים שבטבלה."
          },
          {
            "type": "p",
            "text": "מסדי הנתונים של החשבון ושל היומן והצ'אט נמצאים בפרנקפורט, גרמניה. אנחנו מעבירים מידע לחו\"ל לפי תקנות הגנת הפרטיות (העברת מידע למאגרי מידע שמחוץ לגבולות המדינה), התשס\"א-2001, אל הגורמים שבטבלה בסעיף 6."
          },
          {
            "type": "p",
            "text": "אם אתם באזור הכלכלי האירופי או בבריטניה, ראו סעיף 11."
          }
        ]
      },
      {
        "title": "8. אבטחה",
        "blocks": [
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "התקשורת בין האפליקציה לשרתים בסביבת הייצור מוצפנת (HTTPS).",
                "children": []
              },
              {
                "text": "הגישה למסד הנתונים מוגבלת.",
                "children": []
              },
              {
                "text": "Supabase מצפינה את מסד הנתונים במנוחה.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "אף מערכת לא מאובטחת לחלוטין, ואנחנו לא מבטיחים שלא תהיה פריצה."
          },
          {
            "type": "p",
            "text": "אם תהיה אצלנו אירוע אבטחה חמור שנוגע למידע שלכם, נדווח לרשות להגנת הפרטיות ונעדכן אתכם כפי שהדין מחייב."
          }
        ]
      },
      {
        "title": "9. כמה זמן אנחנו שומרים מידע, ומחיקת חשבון",
        "blocks": [
          {
            "type": "p",
            "text": "**כל עוד החשבון פעיל,** אנחנו שומרים את המידע."
          },
          {
            "type": "p",
            "text": "**מחיקת האפליקציה מהטלפון לא מוחקת את החשבון ואת המידע בשרת.**"
          },
          {
            "type": "p",
            "text": "**מחיקת חשבון:** בהגדרות ← מחיקת חשבון, או בפנייה אלינו (סעיף 10). מה קורה אחרי הבקשה:"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "חשבון ההתחברות והמידע החי במסד הנתונים נמחקים עם הטיפול בבקשה. זה כולל פרופיל, יומן, צ'אט, נתוני בריאות, אסימון התראות, והשיוך לאיש מקצוע או לארגון. תמונת ארוחה לא נשמרת ביומן.",
                "children": []
              },
              {
                "text": "גיבוי יומי נשמר 7 ימים. אחרי זה העותק שבגיבוי נעלם.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "**מה נשאר גם אחרי מחיקה:**"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "מסמכי חיוב וחשבוניות, כל עוד דיני המס מחייבים. בישראל זה בדרך כלל שבע שנים.",
                "children": []
              },
              {
                "text": "הרשומות ש-Stripe שומרת לפי המדיניות שלה.",
                "children": []
              },
              {
                "text": "לוגים של שגיאות שנמצאים בגיבוי היומי נמחקים איתו, אחרי 7 ימים.",
                "children": []
              },
              {
                "text": "מידע שנחוץ למחלוקת משפטית או לטענה משפטית פתוחה, עד שהעניין מסתיים.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "מחיקת החשבון לא מבטלת לבד מנוי ב-Stripe. ביטול המנוי מתואר בתנאי השימוש."
          },
          {
            "type": "p",
            "text": "ייתכן שאיש מקצוע או ארגון שהזמינו אתכם שמרו עותק אצלם. לעותק כזה פנו אליהם."
          }
        ]
      },
      {
        "title": "10. הזכויות שלכם",
        "blocks": [
          {
            "type": "p",
            "text": "לפי חוק הגנת הפרטיות, התשמ\"א-1981, אתם יכולים:"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "**לעיין** במידע שמוחזק עליכם.",
                "children": []
              },
              {
                "text": "לבקש **לתקן או למחוק** מידע שגוי, חסר, לא ברור או לא מעודכן.",
                "children": []
              },
              {
                "text": "**לבטל הסכמה** לתכונה מסוימת בכל עת. הביטול חל מכאן והלאה.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "בנוסף, גם מעבר למה שהחוק דורש, אנחנו מתחייבים **למחוק את החשבון** לפי בקשתכם, כמתואר בסעיף 9. אנחנו לא שולחים עותק של המידע בקובץ."
          },
          {
            "type": "p",
            "text": "**איך מבקשים:** כתבו ל-info@betterchoice.live מהכתובת שרשומה בחשבון. לא צריך להתקין את האפליקציה מחדש. נענה תוך 30 יום. ייתכן שנבקש לאמת את זהותכם."
          },
          {
            "type": "p",
            "text": "ביטול הסכמות במכשיר: הסכמות ל-AI בהגדרות האפליקציה, תחת \"איפוס הרשאות AI\". גישה לנתוני בריאות, מצלמה, מיקרופון והתראות בהגדרות הטלפון."
          },
          {
            "type": "p",
            "text": "אם אתם לא מרוצים מהתשובה שלנו, אפשר להתלונן לרשות להגנת הפרטיות במשרד המשפטים."
          }
        ]
      },
      {
        "title": "11. משתמשים באזור הכלכלי האירופי ובבריטניה",
        "blocks": [
          {
            "type": "p",
            "text": "אם אתם באזור הכלכלי האירופי או בבריטניה, חלים עליכם גם ה-GDPR או ה-UK GDPR. אנחנו לא חוסמים את השירות באזורים האלה."
          },
          {
            "type": "p",
            "text": "**בסיסים חוקיים:**"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "ביצוע החוזה איתכם: חשבון, יומן ותשלום.",
                "children": []
              },
              {
                "text": "**הסכמה מפורשת** (סעיף 9(2)(a)): מידע בריאותי ורגיש, צ'אט ה-AI, ניתוח תמונות, ושליחת נתוני Apple Health לשרת.",
                "children": []
              },
              {
                "text": "חובה חוקית: שמירת חשבוניות.",
                "children": []
              },
              {
                "text": "אינטרס לגיטימי: אבטחה ומניעת הונאה.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "**זכויות נוספות:** בנוסף לזכויות שבסעיף 10, יש לכם זכות להגביל עיבוד, זכות להתנגד לעיבוד שמבוסס על אינטרס לגיטימי, וזכות לניידות מידע. יש לכם גם זכות להתלונן לרשות הפיקוח במדינה שלכם."
          },
          {
            "type": "p",
            "text": "**העברות מידע:** לישראל יש החלטת הלימות של האיחוד האירופי. מסדי הנתונים בפרנקפורט נמצאים באיחוד האירופי. העברה לארה\"ב נעשית אל הגורמים שבטבלה בסעיף 6."
          },
          {
            "type": "p",
            "text": "לפניות בנושא פרטיות מהאזור הכלכלי האירופי ומבריטניה: info@betterchoice.live."
          }
        ]
      },
      {
        "title": "12. קטינים",
        "blocks": [
          {
            "type": "p",
            "text": "השירות מיועד רק לבני 18 ומעלה. ההרשמה חוסמת תאריך לידה מתחת לגיל 18, ואין אפשרות הרשמה בהסכמת הורה. אנחנו לא אוספים ביודעין מידע על קטינים."
          },
          {
            "type": "p",
            "text": "אם נגלה שמשתמש הוא מתחת לגיל 18, נסגור את החשבון ונמחק את המידע כמתואר בסעיף 9. אם שולם עבור מנוי, נטפל בהחזר לפי הדין."
          }
        ]
      },
      {
        "title": "13. האתר betterchoice.one",
        "blocks": [
          {
            "type": "p",
            "text": "הסעיף הזה חל על האתר בלבד. **האפליקציה לא משתמשת בעוגיות ולא ב-Google Analytics.**"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "**עוגיות הכרחיות:** האתר שומר עוגייה בשם cc_cookie כדי לזכור את הבחירה שלכם לגבי עוגיות, למשך 365 יום.",
                "children": []
              },
              {
                "text": "**Google Analytics:** רק אם אישרתם עוגיות סטטיסטיקה, האתר טוען את Google Analytics (מזהה G-8GHW73KZVM). Google Analytics שומר עוגיות בשם _ga ו-_ga_*, שמתחילות ב-_ga, למשך עד שנתיים. המידע נשלח ל-Google בארה\"ב.",
                "children": []
              },
              {
                "text": "אפשר לשנות את הבחירה בכל עת בכפתור \"הגדרות עוגיות\" בדף הזה.",
                "children": []
              },
              {
                "text": "הדומיין betterchoice.one רשום ב-GoDaddy. האתר עצמו מאוחסן ב-Google Cloud. דף התשלום נפתח אצל Stripe, כמתואר בסעיף 5.9.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "14. שינויים במדיניות",
        "blocks": [
          {
            "type": "p",
            "text": "אם נשנה את המדיניות באופן מהותי, נודיע לכם בדוא\"ל ובהודעה באפליקציה 30 יום לפני שהשינוי ייכנס לתוקף. דוגמאות לשינוי מהותי: שימוש חדש במידע רגיש, או גורם חדש שיקבל מידע רגיש."
          },
          {
            "type": "p",
            "text": "אם השינוי מחייב הסכמה חדשה, נבקש אותה, ולא נפעיל את השינוי עליכם עד שתסכימו."
          }
        ]
      },
      {
        "title": "15. יצירת קשר",
        "blocks": [
          {
            "type": "p",
            "text": "Better Choice AI, Co., 1111B S Governors Ave STE 26347, Dover, Delaware 19904, ארצות הברית."
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "פרטיות: Roy Ramon, info@betterchoice.live.",
                "children": []
              },
              {
                "text": "תמיכה: info@betterchoice.live.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "---"
          }
        ]
      }
    ]
  },
  "english": {
    "lastUpdated": "Publication and effective date: 30 September 2026",
    "version": "Version: 1",
    "note": "The Hebrew version of this policy controls. This English text is a translation.",
    "sections": [
      {
        "title": "1. Who we are",
        "blocks": [
          {
            "type": "p",
            "text": "The BetterChoice AI app (iOS and Android) and the website betterchoice.one are operated by Better Choice AI, Co., registered office 1111B S Governors Ave STE 26347, Dover, Delaware 19904, United States (\"we\")."
          },
          {
            "type": "p",
            "text": "We are the controller of the database that holds your information."
          },
          {
            "type": "p",
            "text": "Privacy contact: Roy Ramon, Founder and CEO, info@betterchoice.live."
          }
        ]
      },
      {
        "title": "2. What this policy covers",
        "blocks": [
          {
            "type": "p",
            "text": "This policy covers the BetterChoice AI app and the website betterchoice.one. Section 13 is about the website only. Every other section is about the app."
          },
          {
            "type": "p",
            "text": "The app is a wellness app. It is not a clinic, it does not provide medical services, and it is not a certified medical device."
          }
        ]
      },
      {
        "title": "3. Do you have to give us information?",
        "blocks": [
          {
            "type": "p",
            "text": "No law requires you to give us information. Without some information, some features will not work. For example, you cannot register without a date of birth, and we cannot calculate calorie targets without your weight and height."
          },
          {
            "type": "p",
            "text": "Sensitive fields are your choice, and the basic service works without them. These fields are: medical conditions, allergies, pregnancy, breastfeeding, and menopause."
          }
        ]
      },
      {
        "title": "4. What we collect, why, and on what basis",
        "blocks": [
          {
            "type": "p",
            "text": "**Legal basis.** In Israel, we rely on the informed consent you give when you register and when you turn on each feature. We also rely on legal duties that apply to us, such as tax duties."
          },
          {
            "type": "p",
            "text": "If you are in the EEA or the UK, see also Section 11."
          },
          {
            "type": "table",
            "headers": [
              "Category",
              "What exactly",
              "Why"
            ],
            "rows": [
              [
                "Identity and contact",
                "First and last name, email, phone, country code, city, region, time zone, preferred language, date of birth, gender",
                "Creating your account, checking your age (18+), setting language and times, contacting you about your account"
              ],
              [
                "Body and diet",
                "Height, weight, target weight, activity level and description, goal, diet style, eating window, calorie and macro targets, number and structure of meals",
                "Estimating targets, building meal and training plans"
              ],
              [
                "**Sensitive information**",
                "Allergies, food limitations, medical conditions you type as free text, physiological state (pregnancy, breastfeeding, menopause), nursing status",
                "Adjusting plans and chat replies, and showing warnings. **Allergy filtering is best-effort only. It does not guarantee that a food is safe for you** (see the Terms)"
              ],
              [
                "Diary",
                "Meals, water, calories and macros, meal captions (the meal photo is not stored in the diary), weight, workouts, calendar events, supplement reminder settings",
                "Showing your diary, charts, and progress"
              ],
              [
                "Chat",
                "Your messages, AI replies, and chat history",
                "Running the conversation and keeping it continuous"
              ],
              [
                "Phone health data (iOS only in this version)",
                "Steps and sleep for the last 7 days",
                "Showing it on the Health screen and storing it on our server (see Section 5.5)"
              ],
              [
                "Commercial",
                "Stripe customer ID and subscription status, access codes and promotions you redeemed",
                "Managing your membership. **We do not receive your card number.** Stripe processes it"
              ],
              [
                "Link to a professional or organization",
                "The ID of the manager who invited you (manager_id), the invitation link, the organization ID, answers to onboarding questions the organization added",
                "Linking your account to the professional or organization that invited you (see Section 5.10)"
              ],
              [
                "Technical",
                "Login tokens, push token (Expo push token), server error logs",
                "Sign-in, notifications, security, and fixing bugs"
              ]
            ]
          },
          {
            "type": "p",
            "text": "We do not use your information for advertising. We do not build advertising profiles or collect an advertising ID."
          }
        ]
      },
      {
        "title": "5. Specific features: what is sent and where",
        "blocks": [
          {
            "type": "h",
            "text": "5.1 Sign-up and sign-in"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "**Email and password.** Sign-in is handled through Supabase. Password-reset emails are sent through Supabase.",
                "children": []
              },
              {
                "text": "**Sign in with Apple.** We receive an identifier from Apple, plus the name and email you chose to share. If you chose \"Hide My Email,\" we receive an Apple relay address.",
                "children": []
              },
              {
                "text": "**Google.** Supabase receives your Google account identity from Google: identifier, name, email, and profile picture if there is one.",
                "children": []
              }
            ]
          },
          {
            "type": "h",
            "text": "5.2 AI meal-photo analysis"
          },
          {
            "type": "p",
            "text": "This feature runs only after you agree on a dedicated consent screen."
          },
          {
            "type": "p",
            "text": "**What is sent:**"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "The photo, the meal label, and any caption you added. **The photo is not stored in the diary.**",
                "children": []
              },
              {
                "text": "For text analysis, scoring, and meal correction: the meal description, the meal label, today's diary, and the assigned meal plan. A caption is included if you added one. **Allergies, medical conditions, age, and gender are not sent.**",
                "children": []
              },
              {
                "text": "For ingredient measurement conversion: the ingredient name, brand, original measurement, and your language and region preference.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "**Who receives it:** Our server sends the request to BetterProxy, which runs on our servers. BetterProxy calls Anthropic and Google models to return the result."
          },
          {
            "type": "p",
            "text": "**Retention and training:** We do not use this information to train models. Those providers receive the request only to return a result. We do not permit them to train models on the information or to keep it beyond producing the result."
          },
          {
            "type": "p",
            "text": "**Withdrawing consent:** You can withdraw consent at any time in Settings, under \"Reset AI permissions.\" Consent is stored only on your device. So it does not carry over to another device, and deleting the app erases it."
          },
          {
            "type": "h",
            "text": "5.3 AI chat and voice messages"
          },
          {
            "type": "p",
            "text": "The chat runs only after you agree on a dedicated consent screen. To tailor the replies to you, our server sends:"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "your message and the chat history;",
                "children": []
              },
              {
                "text": "your nutrition profile, **including allergies, medical conditions, age, gender, city, region, and nursing status**, plus your goals and macro targets;",
                "children": []
              },
              {
                "text": "your intake for today and for the last 7 days;",
                "children": []
              },
              {
                "text": "your meal plan and your training plan.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "Who receives it: BetterProxy, which runs on our servers and calls Anthropic and Google models."
          },
          {
            "type": "p",
            "text": "**Voice message:** The recording is sent to our server, and from there to Google Cloud Speech-to-Text, which turns it into text. We delete our copy of the recording when the text comes back. We do not use the recording to train models. After that, the text is handled like a typed message and stored in your chat history."
          },
          {
            "type": "p",
            "text": "The microphone is on only while you record a message."
          },
          {
            "type": "p",
            "text": "Chat history is stored on our servers (see Section 9). Consent is stored only on your device, and you can withdraw it in Settings under \"Reset AI permissions.\""
          },
          {
            "type": "h",
            "text": "5.4 Writing to Apple Health and Health Connect"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "**iOS:** If you allow it, the app writes the meals you log to Apple Health as nutrition data, and your water as hydration data.",
                "children": []
              },
              {
                "text": "**Android:** If you allow it, the app writes only your water to Health Connect, as hydration data. It does not write meals.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "Other apps you have allowed in Apple Health or Health Connect, such as Samsung Health, may read this data. That happens under your phone's settings, not through us."
          },
          {
            "type": "h",
            "text": "5.5 Reading from Apple Health and sending it to our server"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "**iOS:** If you allow it, the app reads your step count and sleep data for the last 7 days from Apple Health. **When you open the Health Diary screen, this data is sent to our server and stored with your account.**",
                "children": []
              },
              {
                "text": "**Android:** In this version, the app does not read steps or sleep from Health Connect.",
                "children": []
              },
              {
                "text": "The app does not access clinical health records in Apple Health.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "Data from Apple Health or Health Connect is used only to run the app's health features. We do not use it for advertising or marketing, and we do not sell it."
          },
          {
            "type": "p",
            "text": "You can turn off access at any time. On iOS: Settings → Health → Data Access & Devices. On Android: Health Connect settings. Turning off access does not delete data already sent to our server. To delete it, contact us (Section 10)."
          },
          {
            "type": "h",
            "text": "5.6 Barcode scanning"
          },
          {
            "type": "p",
            "text": "When you scan a barcode, **your phone sends the barcode number directly to Open Food Facts** (world.openfoodfacts.org). Open Food Facts is an open food database run from France. As with any website request, it also receives your phone's IP address. We do not send your name or account details to Open Food Facts."
          },
          {
            "type": "h",
            "text": "5.7 Location"
          },
          {
            "type": "p",
            "text": "The app does not ask for location access, and it has no store."
          },
          {
            "type": "h",
            "text": "5.8 Notifications"
          },
          {
            "type": "p",
            "text": "The app creates reminders on your device for calendar events, supplements, and inactivity. In addition, your device's push token is stored on our server so that we can send notifications such as \"analysis ready.\" These notifications go through Expo, and from there through Apple's and Google's notification services."
          },
          {
            "type": "p",
            "text": "You can turn off notifications in your phone's settings."
          },
          {
            "type": "h",
            "text": "5.9 Payment"
          },
          {
            "type": "p",
            "text": "You pay on a Stripe checkout page in your browser. Stripe receives your card and billing details and processes them under its own privacy policy. It also does so as an independent party, for example to prevent fraud. We receive from Stripe only a customer ID, your subscription status, and your billing history. The account that charges you is Better Choice AI, Co. in the United States."
          },
          {
            "type": "h",
            "text": "5.10 A professional or organization that invited you"
          },
          {
            "type": "p",
            "text": "If you joined through an invitation link from a dietitian, coach, manager, or organization, **that person or organization can see their own clients' data:** the profile, the diary, weight, sensitive information, chat, and plans. They can also see your answers to any onboarding questions the organization added."
          },
          {
            "type": "p",
            "text": "We do not provide a licensed dietitian service. The professional or organization uses this information as part of their relationship with you."
          },
          {
            "type": "p",
            "text": "If you did not join through an invitation, no professional gets access to your account."
          },
          {
            "type": "h",
            "text": "5.11 What stays only on your device"
          },
          {
            "type": "p",
            "text": "The following are stored only on your device and are erased when you delete the app:"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "your AI consents;",
                "children": []
              },
              {
                "text": "your acceptance of the medical notice, and the version of the legal documents you accepted;",
                "children": []
              },
              {
                "text": "notification IDs and sync bookmarks.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "**So we have no server record of these acceptances.**"
          },
          {
            "type": "p",
            "text": "If you used the save-photo feature, the photo is also saved in your photo library."
          }
        ]
      },
      {
        "title": "6. Who we share information with",
        "blocks": [
          {
            "type": "p",
            "text": "We do not sell personal information. These are the parties that receive information:"
          },
          {
            "type": "table",
            "headers": [
              "Party",
              "Role",
              "What information",
              "Country or region"
            ],
            "rows": [
              [
                "Supabase, Inc.",
                "Database hosting and sign-in (processor on our behalf). The account database, and the diary and chat database",
                "All account, diary, and chat data, and health data that was sent",
                "US company. Storage in Frankfurt, Germany"
              ],
              [
                "Google Cloud",
                "Runs our servers (Cloud Run), and the website betterchoice.one",
                "Any information that passes through our servers",
                "Israel (me-west1): main server. Germany (europe-west3): dietitian dashboard. Netherlands (europe-west4): AI chat. Belgium (europe-west1): LifeOS programs service"
              ],
              [
                "Google Cloud Speech-to-Text",
                "Transcribing voice messages",
                "Recording and language",
                "Google Cloud"
              ],
              [
                "BetterProxy, with Anthropic and Google models",
                "Photo and text analysis, and chat",
                "See Sections 5.2 and 5.3",
                "BetterProxy runs on our servers. The models are Anthropic's and Google's"
              ],
              [
                "LifeOS, operated by us on Google Cloud",
                "Assigning programs by organization",
                "User ID, organization ID, program",
                "Belgium (europe-west1)"
              ],
              [
                "Stripe, Inc., for Better Choice AI, Co.",
                "Payments",
                "Name, email, card and billing details, subscription",
                "United States"
              ],
              [
                "Expo (650 Industries, Inc.)",
                "Sending notifications",
                "Push token and notification content",
                "United States"
              ],
              [
                "Apple",
                "Sign in with Apple, notifications, Apple Health (on device)",
                "As described in Section 5",
                "United States / global"
              ],
              [
                "Google",
                "Google sign-in, Android notifications, Health Connect (on device)",
                "As described in Section 5",
                "United States / global"
              ],
              [
                "Open Food Facts",
                "Product lookup by barcode (directly from your phone)",
                "Barcode number and IP address",
                "France"
              ],
              [
                "Slack",
                "Error alerts to our team, when alerts are turned on",
                "The error message, the exception, a short technical context, and a model note. Not the diary",
                "United States"
              ],
              [
                "A professional or organization that invited you",
                "See Section 5.10",
                "See Section 5.10",
                "Where they operate"
              ],
              [
                "Authorities and courts",
                "Only when the law requires it or under a court order",
                "What is required",
                "—"
              ]
            ]
          },
          {
            "type": "p",
            "text": "If we add a new party that will receive sensitive information, we will update this table and notify you in advance (Section 14)."
          }
        ]
      },
      {
        "title": "7. International transfers",
        "blocks": [
          {
            "type": "p",
            "text": "Your information is stored and processed in Israel, the EU, and the United States. It may also be processed in other countries where the vendors in the table operate."
          },
          {
            "type": "p",
            "text": "The account database and the diary and chat database are in Frankfurt, Germany. We transfer information abroad under the Privacy Protection (Transfer of Data to Databases Abroad) Regulations, 5761-2001, to the parties in the table in Section 6."
          },
          {
            "type": "p",
            "text": "If you are in the EEA or the UK, see Section 11."
          }
        ]
      },
      {
        "title": "8. Security",
        "blocks": [
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "Traffic between the app and our production servers is encrypted (HTTPS).",
                "children": []
              },
              {
                "text": "Access to the database is restricted.",
                "children": []
              },
              {
                "text": "Supabase encrypts the database at rest.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "No system is completely secure, and we do not promise there will never be a breach."
          },
          {
            "type": "p",
            "text": "If we have a serious security incident involving your information, we will report it to the Privacy Protection Authority and tell you, as the law requires."
          }
        ]
      },
      {
        "title": "9. How long we keep information, and deleting your account",
        "blocks": [
          {
            "type": "p",
            "text": "**While your account is active,** we keep your information."
          },
          {
            "type": "p",
            "text": "**Deleting the app from your phone does not delete your account or the information on our server.**"
          },
          {
            "type": "p",
            "text": "**Deleting your account:** Go to Settings → Delete account, or contact us (Section 10). What happens after your request:"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "Your sign-in account and the live information in the database are deleted when we process the request. This includes your profile, diary, chat, health data, push token, and any link to a professional or organization. Meal photos are not stored in the diary.",
                "children": []
              },
              {
                "text": "A daily backup is kept for 7 days. After that, the backup copy is gone.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "**What remains even after deletion:**"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "Billing records and invoices, for as long as tax law requires. In Israel, this is generally seven years.",
                "children": []
              },
              {
                "text": "Records Stripe keeps under its own policy.",
                "children": []
              },
              {
                "text": "Error logs that sit in the daily backup are deleted with it, after 7 days.",
                "children": []
              },
              {
                "text": "Information needed for an open legal dispute or claim, until the matter ends.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "Deleting your account does not by itself cancel a Stripe membership. Cancellation is described in the Terms."
          },
          {
            "type": "p",
            "text": "A professional or organization that invited you may have kept its own copy. For that copy, contact them."
          }
        ]
      },
      {
        "title": "10. Your rights",
        "blocks": [
          {
            "type": "p",
            "text": "Under the Privacy Protection Law, 5741-1981, you can:"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "**See** the information held about you.",
                "children": []
              },
              {
                "text": "Ask us to **correct or delete** information that is wrong, incomplete, unclear, or out of date.",
                "children": []
              },
              {
                "text": "**Withdraw consent** to a specific feature at any time. The withdrawal applies from then on.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "In addition, beyond what the law requires, we commit to **delete your account** when you ask, as described in Section 9. We do not send a copy of your information in a file."
          },
          {
            "type": "p",
            "text": "**How to ask:** Email info@betterchoice.live from the address registered on your account. You do not need to reinstall the app. We will reply within 30 days. We may ask you to verify your identity."
          },
          {
            "type": "p",
            "text": "Withdrawing consents on your device: AI consents in the app's Settings, under \"Reset AI permissions.\" Access to health data, the camera, the microphone, and notifications in your phone's settings."
          },
          {
            "type": "p",
            "text": "If you are not satisfied with our reply, you can complain to the Privacy Protection Authority at the Ministry of Justice."
          }
        ]
      },
      {
        "title": "11. Users in the EEA and the UK",
        "blocks": [
          {
            "type": "p",
            "text": "If you are in the EEA or the UK, the GDPR or UK GDPR also applies to you. We do not block the service in these regions."
          },
          {
            "type": "p",
            "text": "**Legal bases:**"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "Performing our contract with you: your account, diary, and payment.",
                "children": []
              },
              {
                "text": "**Explicit consent** (Article 9(2)(a)): health and sensitive information, the AI chat, photo analysis, and sending Apple Health data to our server.",
                "children": []
              },
              {
                "text": "Legal obligation: keeping invoices.",
                "children": []
              },
              {
                "text": "Legitimate interests: security and fraud prevention.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "**Additional rights:** In addition to the rights in Section 10, you have the right to restrict processing, the right to object to processing based on legitimate interests, and the right to data portability. You also have the right to complain to the supervisory authority in your country."
          },
          {
            "type": "p",
            "text": "**Transfers:** Israel has an EU adequacy decision. The databases in Frankfurt are in the European Union. Transfers to the United States are made to the parties in the table in Section 6."
          },
          {
            "type": "p",
            "text": "Privacy requests from the EEA and the UK: info@betterchoice.live."
          }
        ]
      },
      {
        "title": "12. Children",
        "blocks": [
          {
            "type": "p",
            "text": "The service is only for people aged 18 and over. Sign-up blocks any date of birth under 18, and there is no way to register with a parent's consent. We do not knowingly collect information about minors."
          },
          {
            "type": "p",
            "text": "If we learn that a user is under 18, we will close the account and delete the information as described in Section 9. If a subscription was paid for, we will handle any refund as the law requires."
          }
        ]
      },
      {
        "title": "13. The website betterchoice.one",
        "blocks": [
          {
            "type": "p",
            "text": "This section applies to the website only. **The app does not use cookies or Google Analytics.**"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "**Necessary cookie:** The website stores a cookie named cc_cookie to remember your cookie choice, for 365 days.",
                "children": []
              },
              {
                "text": "**Google Analytics:** Only if you accept analytics cookies, the website loads Google Analytics (ID G-8GHW73KZVM). Google Analytics stores cookies whose names start with _ga (_ga and _ga_*) for up to two years. This data is sent to Google in the US.",
                "children": []
              },
              {
                "text": "You can change your choice at any time with the \"Cookie Settings\" button on this page.",
                "children": []
              },
              {
                "text": "The domain betterchoice.one is registered with GoDaddy. The website itself is hosted on Google Cloud. The payment page opens at Stripe, as described in Section 5.9.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "14. Changes to this policy",
        "blocks": [
          {
            "type": "p",
            "text": "If we make a material change to this policy, we will notify you by email and in the app 30 days before the change takes effect. Examples of a material change: a new use of sensitive information, or a new party that will receive sensitive information."
          },
          {
            "type": "p",
            "text": "If the change requires new consent, we will ask for it, and we will not apply the change to you until you agree."
          }
        ]
      },
      {
        "title": "15. Contact",
        "blocks": [
          {
            "type": "p",
            "text": "Better Choice AI, Co., 1111B S Governors Ave STE 26347, Dover, Delaware 19904, United States."
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "Privacy: Roy Ramon, info@betterchoice.live.",
                "children": []
              },
              {
                "text": "Support: info@betterchoice.live.",
                "children": []
              }
            ]
          }
        ]
      }
    ]
  }
};
function Rich({ text }) {
  const nodes = [];
  const source = String(text);
  const pattern = /(\*\*[^*]+\*\*)/g;
  let last = 0;
  let match;
  let key = 0;
  while ((match = pattern.exec(source))) {
    if (match.index > last) nodes.push(<PlaceholderText key={key++} text={source.slice(last, match.index)} />);
    nodes.push(<strong key={key++}>{match[0].slice(2, -2)}</strong>);
    last = match.index + match[0].length;
  }
  if (last < source.length) nodes.push(<PlaceholderText key={key++} text={source.slice(last)} />);
  return <>{nodes}</>;
}

function PlaceholderText({ text }) {
  const parts = String(text).split(/(\[[^\]]+\])/g);
  return parts.map((part, index) =>
    part.startsWith('[') && part.endsWith(']')
      ? <span key={index} className="text-amber-800 dark:text-amber-300">{part}</span>
      : <React.Fragment key={index}>{part}</React.Fragment>
  );
}

function Blocks({ blocks, direction, themeClasses }) {
  return blocks.map((block, index) => {
    if (block.type === 'p') {
      return (
        <p key={index} className={`${themeClasses.textSecondary} leading-relaxed text-sm sm:text-base`}>
          <Rich text={block.text} />
        </p>
      );
    }
    if (block.type === 'h') {
      return (
        <h3 key={index} className={`text-base sm:text-lg font-semibold ${themeClasses.textPrimary} pt-2`}>
          <Rich text={block.text} />
        </h3>
      );
    }
    if (block.type === 'list') {
      const Tag = block.ordered ? 'ol' : 'ul';
      const marker = block.ordered ? 'list-decimal' : 'list-disc';
      return (
        <Tag key={index} className={`${marker} ${direction === 'rtl' ? 'mr-5' : 'ml-5'} space-y-2 ${themeClasses.textSecondary} text-sm sm:text-base`}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex} className="leading-relaxed">
              <Rich text={item.text} />
              {item.children.length > 0 && (
                <ul className={`list-disc ${direction === 'rtl' ? 'mr-5' : 'ml-5'} mt-2 space-y-1`}>
                  {item.children.map((child, childIndex) => (
                    <li key={childIndex} className="leading-relaxed"><Rich text={child} /></li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </Tag>
      );
    }
    if (block.type === 'table') {
      return (
        <div key={index} className="overflow-x-auto">
          <table className={`w-full text-xs sm:text-sm border-collapse ${themeClasses.textSecondary}`}>
            <thead>
              <tr>
                {block.headers.map((header, headerIndex) => (
                  <th key={headerIndex} className={`border ${themeClasses.borderSecondary} px-2 py-2 text-start font-semibold ${themeClasses.textPrimary} align-top`}>
                    <Rich text={header} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className={`border ${themeClasses.borderSecondary} px-2 py-2 align-top`}>
                      <Rich text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return null;
  });
}

const PrivacyPolicyPage = () => {
  const navigate = useNavigate();
  const { language, direction } = useLanguage();
  const { isDarkMode, themeClasses } = useTheme();
  const current = content[language] || content.english;

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900' : 'bg-gradient-to-br from-emerald-50 via-green-50 to-amber-50'} language-transition`} dir={direction}>
      <Navigation />

      <div className="container mx-auto px-4 py-8 sm:py-12 md:py-16 lg:py-24 max-w-4xl min-h-screen">
        <button
          onClick={() => navigate(-1)}
          className={`mb-4 sm:mb-6 ${themeClasses.textPrimary} hover:text-green-600 dark:hover:text-green-400 flex items-center gap-2 transition-colors text-sm sm:text-base`}
        >
          {direction === 'rtl' ? '→' : '←'} {language === 'hebrew' ? 'חזרה' : 'Back'}
        </button>

        <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-4 sm:p-6 md:p-8 lg:p-12`}>
          <h1 className={`text-2xl sm:text-3xl md:text-4xl font-bold ${themeClasses.textPrimary} mb-3 sm:mb-4`}>
            {language === 'hebrew' ? 'מדיניות פרטיות' : 'Privacy Policy'}
          </h1>
          <p className={`${themeClasses.textSecondary} text-sm sm:text-base`}>{current.lastUpdated}</p>
          <p className={`${themeClasses.textSecondary} mb-3 text-sm sm:text-base`}>{current.version}</p>
          <p className={`${themeClasses.textSecondary} mb-6 sm:mb-8 leading-relaxed text-sm sm:text-base`}>{current.note}</p>

          <div className="space-y-6 sm:space-y-8">
            {current.sections.map((section, index) => (
              <div key={index} className={`border-b ${themeClasses.borderSecondary} pb-4 sm:pb-6 last:border-b-0`}>
                <h2 className={`text-lg sm:text-xl md:text-2xl font-semibold ${themeClasses.textPrimary} mb-3`}>
                  {section.title}
                </h2>
                <div className="space-y-3">
                  <Blocks blocks={section.blocks} direction={direction} themeClasses={themeClasses} />
                </div>
              </div>
            ))}
          </div>

          <div className={`mt-6 sm:mt-8 p-4 sm:p-6 ${themeClasses.sectionBg} rounded-lg border ${themeClasses.borderSecondary} text-center`}>
            <h3 className={`text-lg sm:text-xl font-semibold ${themeClasses.textPrimary} mb-2 sm:mb-3`}>
              {language === 'hebrew' ? 'הגדרות עוגיות' : 'Cookie settings'}
            </h3>
            <p className={`${themeClasses.textSecondary} mb-3 sm:mb-4 text-sm sm:text-base`}>
              {language === 'hebrew'
                ? 'הכפתור הזה משנה את בחירת העוגיות באתר בלבד. האפליקציה לא משתמשת בעוגיות.'
                : 'This button changes your cookie choice on the website only. The app does not use cookies.'}
            </p>
            <button
              onClick={() => {
                try {
                  CookieConsent.showPreferences();
                } catch (error) {
                  console.error('Cookie consent error:', error);
                  alert(language === 'hebrew'
                    ? 'אנא רענן את העמוד ונסה שוב'
                    : 'Please refresh the page and try again');
                }
              }}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-xl cursor-pointer text-sm sm:text-base"
            >
              {language === 'hebrew' ? 'הגדרות עוגיות' : 'Cookie settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
