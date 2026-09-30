import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Navigation from '../components/Navigation';

const content = {
  "hebrew": {
    "lastUpdated": "תאריך פרסום ותחילת תוקף: 30/9/2026",
    "version": "גרסה: 1",
    "note": "הנוסח העברי של תנאים אלה הוא הנוסח המחייב. הנוסח האנגלי הוא תרגום בלבד.",
    "sections": [
      {
        "title": "1. מי אנחנו, ומתי התנאים חלים",
        "blocks": [
          {
            "type": "p",
            "text": "השירות BetterChoice AI (האפליקציה והאתר betterchoice.one) מופעל על ידי Better Choice AI, Co., שכתובתה הרשומה היא 1111B S Governors Ave STE 26347, Dover, Delaware 19904, ארצות הברית (\"אנחנו\")."
          },
          {
            "type": "p",
            "text": "התנאים חלים עליכם מהרגע שאתם מסמנים בהרשמה שקראתם אותם ומסכימים להם. הסימון נשמר במכשיר שלכם, לא בשרת."
          },
          {
            "type": "p",
            "text": "מדיניות הפרטיות מסבירה איך אנחנו מטפלים במידע שלכם. היא לא חלק מהחוזה, אבל כדאי לקרוא אותה."
          }
        ]
      },
      {
        "title": "2. מה השירות, ומה הוא לא",
        "blocks": [
          {
            "type": "p",
            "text": "**השירות הוא כלי וולנס לניהול תזונה, פעילות והרגלים.** הוא כולל:"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "יומן אוכל ומים, עם סריקת ברקוד, צילום ארוחה והזנה ידנית;",
                "children": []
              },
              {
                "text": "ניתוח תמונות וטקסט בבינה מלאכותית;",
                "children": []
              },
              {
                "text": "תפריטים ותוכניות אימון שנוצרים אוטומטית מהפרופיל שלכם;",
                "children": []
              },
              {
                "text": "תיעוד אימונים;",
                "children": []
              },
              {
                "text": "תזכורות ליומן ולתוספים;",
                "children": []
              },
              {
                "text": "צ'אט AI בטקסט ובקול;",
                "children": []
              },
              {
                "text": "גרפים של משקל והתקדמות.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "**השירות לא:**"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "מאבחן, מטפל או מרפא מחלה;",
                "children": []
              },
              {
                "text": "מחליף רופא, דיאטנית או איש מקצוע אחר;",
                "children": []
              },
              {
                "text": "מבטיח תזונה נטולת אלרגנים או תזונה טיפולית למצב רפואי מסוים;",
                "children": []
              },
              {
                "text": "מתאים למצבי חירום;",
                "children": []
              },
              {
                "text": "כולל ייעוץ של דיאטנית מוסמכת.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "3. מי יכול להשתמש",
        "blocks": [
          {
            "type": "p",
            "text": "השירות מיועד רק לבני 18 ומעלה. אין אפשרות להירשם בהסכמת הורה. אם אתם מתחת לגיל 18, אל תשתמשו בשירות. אם נגלה שמשתמש הוא קטין, נסגור את החשבון."
          }
        ]
      },
      {
        "title": "4. החשבון שלכם",
        "blocks": [
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "מסרו מידע נכון ועדכנו אותו כשהוא משתנה. **יעדי הקלוריות, התפריטים והאזהרות מבוססים על המידע שמסרתם.** אם המידע שגוי, גם הם יהיו שגויים.",
                "children": []
              },
              {
                "text": "שמרו על הסיסמה שלכם. אם אתם חושדים שמישהו אחר נכנס לחשבון, הודיעו לנו מיד.",
                "children": []
              },
              {
                "text": "אתם אחראים לפעולות בחשבון שלכם שנעשו בידיעתכם, או בגלל שלא שמרתם על הסיסמה באופן סביר.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "5. בריאות ובטיחות — חשוב לקרוא",
        "blocks": [
          {
            "type": "list",
            "ordered": true,
            "items": [
              {
                "text": "**כל המספרים הם הערכות.** זה כולל יעדי קלוריות, מאקרו ומים, חישובי נוסחאות, זיהוי מזון מתמונה, ערכים תזונתיים ממאגרים חיצוניים, תפריטים ותוכניות אימון. הם עלולים להיות שגויים.",
                "children": []
              },
              {
                "text": "**אלרגיות.** הסינון לפי אלרגיות ומגבלות מזון הוא מאמץ סביר בלבד. הוא לא מבטיח שמזון בטוח לכם. אם יש לכם אלרגיה, **בדקו כל רכיב בעצמכם לפי תווית המוצר**. אל תסתמכו על האפליקציה.",
                "children": []
              },
              {
                "text": "**הריון, הנקה, מצבים רפואיים, תרופות, הפרעות אכילה, ומשתמשים בגיל מבוגר:** התייעצו עם רופא או דיאטנית מוסמכת לפני שאתם משנים תזונה, פעילות גופנית או תוספים. התייעצו איתם גם אם האפליקציה הציעה את השינוי.",
                "children": []
              },
              {
                "text": "**תוספים.** אזכור של תוסף באפליקציה הוא לא המלצה רפואית. התייעצו עם רופא או רוקח.",
                "children": []
              },
              {
                "text": "**חירום.** אל תשתמשו באפליקציה במצב חירום. בישראל התקשרו למד\"א 101. מחוץ לישראל התקשרו למספר החירום המקומי, למשל 112.",
                "children": []
              },
              {
                "text": "**אם משהו מרגיש לא נכון, הפסיקו.** זה כולל סחרחורת, חולשה, כאב או תסמין אחר. פנו לאיש מקצוע.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "6. תכונות הבינה המלאכותית",
        "blocks": [
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "התשובות של ה-AI נוצרות אוטומטית. **איש מקצוע לא בודק אותן**, והן עלולות להיות שגויות, חלקיות או לא מתאימות לכם.",
                "children": []
              },
              {
                "text": "אל תשתמשו ב-AI כדי לאבחן, כדי לבדוק אם מזון בטוח לאלרגיה, או כדי לקבל החלטות בהריון, בהנקה או במצב רפואי.",
                "children": []
              },
              {
                "text": "ה-AI הוא לא דיאטנית ולא רופא, גם אם הוא כותב בצורה שנשמעת מקצועית.",
                "children": []
              },
              {
                "text": "כדי להפעיל את התכונות האלה, המידע שלכם נשלח כמתואר במדיניות הפרטיות. אתם יכולים לסרב ל-AI ולהמשיך להשתמש בשאר השירות.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "7. דיאטנית, מאמן או ארגון שהזמינו אתכם",
        "blocks": [
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "אנחנו לא נותנים שירות של דיאטנית מוסמכת.",
                "children": []
              },
              {
                "text": "אם הצטרפתם דרך קישור של דיאטנית, מאמן או ארגון, הקשר המקצועי הוא ביניכם לבינם, לא ביניכם לבינינו.",
                "children": []
              },
              {
                "text": "איש המקצוע או הארגון רואים את נתוני הלקוחות שלהם, כמתואר במדיניות הפרטיות.",
                "children": []
              },
              {
                "text": "האפליקציה וה-AI הם לא איש המקצוע שלכם. תפריט שנוצר אוטומטית לא נבדק על ידי איש המקצוע, אלא אם הוא אמר לכם במפורש שבדק אותו.",
                "children": []
              },
              {
                "text": "ארגון יכול להוסיף שאלות משלו להרשמה. התשובות שלכם יועברו אליו.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "8. מנוי ותשלום",
        "blocks": [
          {
            "type": "list",
            "ordered": true,
            "items": [
              {
                "text": "**מחיר.** המחיר, המטבע, תקופת החיוב והתנאים מוצגים לכם בדף התשלום של Stripe **לפני** שאתם מאשרים. המחיר שמוצג שם, בדולר ארה\"ב, הוא המחיר שנגבה.",
                "children": []
              },
              {
                "text": "**תוכניות.** יש מנוי חודשי ויש מנוי שנתי. במנוי הנוכחי אין תקופת התחייבות מינימלית. אם דף התשלום מציג התחייבות, התקופה מוצגת לפני התשלום.",
                "children": []
              },
              {
                "text": "**תקופת ניסיון.** תקופת הניסיון היא 30 יום.",
                "children": [
                  "נדרש כרטיס אשראי כבר בתחילת הניסיון.",
                  "החיוב הראשון מתבצע בתאריך שמוצג בדף התשלום, אלא אם ביטלתם לפני כן.",
                  "אנחנו לא שולחים תזכורת בדוא\"ל לפני סוף תקופת הניסיון."
                ]
              },
              {
                "text": "**חידוש אוטומטי.** המנוי מתחדש אוטומטית בסוף כל תקופה, ואתם מחויבים באמצעי התשלום שמסרתם, עד שתבטלו.",
                "children": []
              },
              {
                "text": "**איך מבטלים.** אפשר לבטל בכל אחת מהדרכים האלה:",
                "children": [
                  "באפליקציה: הגדרות ← מנוי ← לבטל את המנוי;",
                  "בפורטל הלקוחות של Stripe;",
                  "בדוא\"ל ל-info@betterchoice.live;",
                  "בכל דרך אחרת שחוק הגנת הצרכן מאפשר.",
                  "ביטול לא מחייב מחיקת חשבון. מחיקת האפליקציה לא מבטלת את המנוי."
                ]
              },
              {
                "text": "**מתי הביטול נכנס לתוקף.** הכפתור באפליקציה מסמן את המנוי כך שיסתיים בסוף תקופת החיוב הנוכחית. הדין חזק מהכפתור: ביטול של עסקה מתמשכת נכנס לתוקף לא יאוחר משלושה ימי עסקים מהיום שקיבלנו את ההודעה. לא נחייב אתכם על תקופה שאחרי מועד זה. אם כבר שילמתם על זמן שאחרי המועד הזה, נחזיר את החלק הזה. אם הכפתור לא עושה זאת, כתבו לנו.",
                "children": []
              },
              {
                "text": "**ביטול עסקה בתוך 14 יום (צרכנים בישראל).** אתם רשאים לבטל את העסקה תוך 14 יום מיום העסקה או מיום שקיבלתם את פרטי העסקה, לפי המאוחר ביניהם. הביטול ייעשה לפי חוק הגנת הצרכן, התשמ\"א-1981, ותקנות הגנת הצרכן (ביטול עסקה), התשע\"א-2010.",
                "children": [
                  "אנחנו לא גובים דמי ביטול.",
                  "החזר יינתן לפי מה שהדין קובע.",
                  "צרכנים באזור הכלכלי האירופי ובבריטניה זכאים לזכויות הביטול שהדין המקומי שלהם נותן."
                ]
              },
              {
                "text": "**החזרים.** מעבר למה שבסעיפים 6 ו-7, החזר ניתן רק כשהדין מחייב, או כשאנחנו לא סיפקנו את השירות.",
                "children": []
              },
              {
                "text": "**קודי גישה והטבות.** התנאים של כל קוד, כולל תוקף, מוצגים כשאתם מממשים אותו. קוד לא ניתן להמרה בכסף, אלא אם הדין מחייב.",
                "children": []
              },
              {
                "text": "**תשלום שנכשל.** אם החיוב נכשל, Stripe עשויה לנסות לחייב שוב, ונעדכן אתכם. אם החיוב עדיין לא יצליח, ייתכן שהגישה לתכונות בתשלום תיעצר. המידע שלכם לא יימחק בגלל זה. אם אין אמצעי תשלום בסוף תקופת הניסיון, המנוי מסתיים.",
                "children": []
              },
              {
                "text": "**שינוי מחיר.** נודיע לכם בדוא\"ל ובאפליקציה 30 יום לפני שינוי מחיר. המחיר החדש יחול רק מתקופת החיוב הבאה, ואתם יכולים לבטל לפני כן בלי תשלום נוסף.",
                "children": []
              },
              {
                "text": "**Apple ו-Google.** המנוי נמכר דרך Stripe ולא דרך App Store או Google Play. לכן Apple ו-Google לא מטפלות בחיוב, בביטול או בהחזר של המנוי.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "9. שימוש אסור",
        "blocks": [
          {
            "type": "p",
            "text": "אסור:"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "להשתמש בשירות בניגוד לדין;",
                "children": []
              },
              {
                "text": "להתחזות לאדם אחר, או להזין מידע על אדם אחר בלי רשותו;",
                "children": []
              },
              {
                "text": "לנסות לפרוץ לשירות, לעקוף מגבלות או חסימות, או להעמיס על השירות;",
                "children": []
              },
              {
                "text": "לאסוף מידע מהשירות באופן אוטומטי;",
                "children": []
              },
              {
                "text": "להעלות תוכן שמפר זכויות של אחרים, או תוכן פוגעני;",
                "children": []
              },
              {
                "text": "להשתמש ב-AI כדי ליצור תוכן בלתי חוקי;",
                "children": []
              },
              {
                "text": "למכור או להעביר את הגישה שלכם לאחרים.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "10. התוכן שלכם",
        "blocks": [
          {
            "type": "p",
            "text": "התוכן שאתם מעלים נשאר שלכם. זה כולל תמונות, טקסט, הודעות ויומן."
          },
          {
            "type": "p",
            "text": "אתם נותנים לנו רשות להשתמש בתוכן רק כדי להפעיל עבורכם את השירות: לאחסן אותו, להציג אותו, לנתח אותו, ולהעביר אותו לגורמים שמפורטים במדיניות הפרטיות."
          },
          {
            "type": "p",
            "text": "אנחנו לא משתמשים בתוכן שלכם לפרסום, ולא כדי לאמן מודלים."
          },
          {
            "type": "p",
            "text": "הרשות מסתיימת כשהתוכן נמחק, בכפוף לסעיף 9 במדיניות הפרטיות."
          }
        ]
      },
      {
        "title": "11. הקניין הרוחני שלנו",
        "blocks": [
          {
            "type": "p",
            "text": "האפליקציה, העיצוב, הקוד, הסימנים והתוכן שיצרנו שייכים לנו או למי שנתן לנו רישיון."
          },
          {
            "type": "p",
            "text": "אנחנו נותנים לכם רישיון אישי, לא בלעדי ולא ניתן להעברה, להשתמש באפליקציה במכשירים שלכם כל עוד החשבון שלכם פעיל."
          }
        ]
      },
      {
        "title": "12. שירותים של אחרים",
        "blocks": [
          {
            "type": "p",
            "text": "השירות משתמש בשירותים של גורמים אחרים, כמו Apple, Google, Stripe ו-Open Food Facts. התנאים של כל שירות כזה חלים על השימוש שלכם בו."
          },
          {
            "type": "p",
            "text": "מידע ממאגרים חיצוניים, למשל ערכים תזונתיים לפי ברקוד, עלול להיות שגוי או לא מעודכן."
          }
        ]
      },
      {
        "title": "13. שינויים בשירות וזמינות",
        "blocks": [
          {
            "type": "p",
            "text": "אנחנו מפתחים את השירות ועשויים לשנות תכונות. אם נסיר או נצמצם תכונה מרכזית שאתם משלמים עליה, נודיע לכם 30 יום מראש, ואתם תוכלו לבטל ולקבל החזר יחסי על התקופה ששולמה מראש."
          },
          {
            "type": "p",
            "text": "השירות עלול להיות לא זמין מדי פעם, למשל בזמן תחזוקה או בגלל תקלה אצל ספק."
          }
        ]
      },
      {
        "title": "14. השעיה, סיום ומחיקה",
        "blocks": [
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "**אתם** יכולים למחוק את החשבון בכל עת: בהגדרות ← מחיקת חשבון, או בפנייה אלינו. מחיקת החשבון לא מבטלת אוטומטית מנוי ב-Stripe. לכן בטלו את המנוי כמתואר בסעיף 8.",
                "children": []
              },
              {
                "text": "**אנחנו** רשאים להשעות או לסגור חשבון אם הפרתם את התנאים באופן מהותי, אם יש חשש סביר להונאה או לפגיעה באחרים, או אם החוק מחייב אותנו.",
                "children": [
                  "בדרך כלל נודיע לכם מראש ונאפשר לכם לתקן את ההפרה, אלא אם יש סיבה דחופה.",
                  "אם נסגור חשבון שלא בגלל הפרה שלכם, נחזיר לכם באופן יחסי את התשלום עבור התקופה שלא נוצלה."
                ]
              }
            ]
          }
        ]
      },
      {
        "title": "15. אחריות",
        "blocks": [
          {
            "type": "list",
            "ordered": true,
            "items": [
              {
                "text": "אנחנו מספקים את השירות במיומנות ובזהירות סבירות. מכיוון שהשירות נותן הערכות, אנחנו לא מתחייבים שכל ערך, זיהוי מזון או תשובת AI יהיו מדויקים (ראו סעיפים 5 ו-6).",
                "children": []
              },
              {
                "text": "**במקרה של תקלה רגילה בשירות,** למשל אם השירות לא זמין, יש שגיאה בתצוגה או מידע אבד, האחריות הכוללת שלנו כלפיכם מוגבלת לסכום ששילמתם לנו ב-12 החודשים שלפני האירוע.",
                "children": []
              },
              {
                "text": "**ההגבלה בסעיף 2 לא חלה על:**",
                "children": [
                  "נזק גוף או מוות שנגרם ברשלנות שלנו;",
                  "מרמה, זדון או רשלנות רבתי;",
                  "הפרה שלנו של חובות לפי דיני הגנת הפרטיות;",
                  "כל אחריות אחרת שהדין לא מאפשר להגביל."
                ]
              },
              {
                "text": "אנחנו לא אחראים לנזק שנגרם רק מהשירות של גורם אחר שאינו מטעמנו, או רק ממידע שגוי שמסרתם.",
                "children": []
              },
              {
                "text": "שום דבר בתנאים אלה לא גורע מזכויות שחוק הגנת הצרכן או דין אחר נותנים לכם, ושאי אפשר לוותר עליהן.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "16. שיפוי",
        "blocks": [
          {
            "type": "p",
            "text": "אם צד שלישי יתבע אותנו בגלל תוכן שהעליתם בניגוד לדין או בגלל הפרה מכוונת שלכם של סעיף 9, תשפו אותנו על הנזק שנגרם לנו כתוצאה מכך. במקרה כזה:"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "נודיע לכם על התביעה בהקדם;",
                "children": []
              },
              {
                "text": "ניתן לכם הזדמנות להתגונן;",
                "children": []
              },
              {
                "text": "לא נתפשר בלי הסכמתכם.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "החובה הזאת חלה רק ביחס לחלק שלכם באחריות לנזק."
          }
        ]
      },
      {
        "title": "17. שינוי התנאים",
        "blocks": [
          {
            "type": "p",
            "text": "**שינוי מהותי:** נודיע לכם בדוא\"ל ובהודעה באפליקציה לפחות 30 יום לפני שהשינוי ייכנס לתוקף. אם לא תסכימו, תוכלו לבטל את המנוי לפני מועד השינוי ולקבל החזר יחסי על התקופה ששולמה מראש. אם השינוי מחייב הסכמה מפורשת, נבקש אותה."
          },
          {
            "type": "p",
            "text": "**שינוי קטן או שינוי שהחוק מחייב:** למשל תיקון ניסוח או עדכון פרטי קשר. שינוי כזה ייכנס לתוקף עם הפרסום."
          },
          {
            "type": "p",
            "text": "**שימוש בשירות אחרי ההודעה לא ייחשב הסכמה לשינוי שפוגע בזכויותיכם.**"
          }
        ]
      },
      {
        "title": "18. הדין ובתי המשפט",
        "blocks": [
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "על תנאים אלה חל הדין הישראלי.",
                "children": []
              },
              {
                "text": "**צרכנים בישראל** רשאים להגיש תביעה לכל בית משפט מוסמך בישראל לפי הדין, כולל בית המשפט לתביעות קטנות. אנחנו לא נטען שבית משפט במקום מגוריכם אינו מוסמך אם הוא מוסמך לפי הדין. גם בית משפט באזור שבו נמצא משרדנו הרשום ב-Dover, Delaware מוסמך לדון.",
                "children": []
              },
              {
                "text": "**אם אנחנו נתבע אתכם,** נעשה זאת בבית המשפט המוסמך באזור מגוריכם.",
                "children": []
              },
              {
                "text": "**צרכנים באזור הכלכלי האירופי ובבריטניה** רשאים לתבוע במדינת מגוריהם. ההגנות הצרכניות של הדין שם ממשיכות לחול עליהם.",
                "children": []
              },
              {
                "text": "לפני שאתם פונים לבית משפט, אפשר לפנות אלינו ב-info@betterchoice.live. נשתדל לפתור את העניין. הפנייה אלינו לא חובה.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "19. תנאים לגבי Apple",
        "blocks": [
          {
            "type": "p",
            "text": "אם הורדתם את האפליקציה מ-App Store:"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "התנאים הם בינכם לבינינו, ולא עם Apple.",
                "children": []
              },
              {
                "text": "Apple לא אחראית לאפליקציה, לתמיכה בה או לטענות לגביה.",
                "children": []
              },
              {
                "text": "Apple והחברות הבנות שלה הן צד שלישי שנהנה מתנאים אלה, ורשאיות לאכוף אותם כלפיכם.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "20. כללי",
        "blocks": [
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "אם בית משפט יקבע שסעיף מסוים לא תקף, שאר הסעיפים ימשיכו לחול.",
                "children": []
              },
              {
                "text": "אנחנו רשאים להעביר את החוזה לגוף אחר רק אם הזכויות שלכם לא יפגעו. במקרה כזה נודיע לכם.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "21. יצירת קשר",
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
                "text": "דוא\"ל: info@betterchoice.live.",
                "children": []
              },
              {
                "text": "ביטול מנוי: info@betterchoice.live.",
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
    "note": "The Hebrew version of these terms controls. This English text is a translation.",
    "sections": [
      {
        "title": "1. Who we are, and when these terms apply",
        "blocks": [
          {
            "type": "p",
            "text": "The BetterChoice AI service (the app and the website betterchoice.one) is operated by Better Choice AI, Co., registered office 1111B S Governors Ave STE 26347, Dover, Delaware 19904, United States (\"we\")."
          },
          {
            "type": "p",
            "text": "These terms apply to you from the moment you confirm at sign-up that you have read them and agree. That confirmation is stored on your device, not on our server."
          },
          {
            "type": "p",
            "text": "The Privacy Policy explains how we handle your information. It is not part of this contract, but you should read it."
          }
        ]
      },
      {
        "title": "2. What the service is, and what it is not",
        "blocks": [
          {
            "type": "p",
            "text": "**The service is a wellness tool for managing food, activity, and habits.** It includes:"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "a food and water diary, with barcode scanning, meal photos, and manual entry;",
                "children": []
              },
              {
                "text": "AI analysis of photos and text;",
                "children": []
              },
              {
                "text": "meal plans and training plans generated automatically from your profile;",
                "children": []
              },
              {
                "text": "workout logging;",
                "children": []
              },
              {
                "text": "calendar and supplement reminders;",
                "children": []
              },
              {
                "text": "an AI chat in text and voice;",
                "children": []
              },
              {
                "text": "weight and progress charts.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "**The service does not:**"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "diagnose, treat, or cure any disease;",
                "children": []
              },
              {
                "text": "replace a doctor, a dietitian, or any other professional;",
                "children": []
              },
              {
                "text": "guarantee an allergen-free diet or a therapeutic diet for a specific medical condition;",
                "children": []
              },
              {
                "text": "work for emergencies;",
                "children": []
              },
              {
                "text": "include advice from a licensed dietitian.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "3. Who can use the service",
        "blocks": [
          {
            "type": "p",
            "text": "The service is only for people aged 18 and over. There is no way to register with a parent's consent. If you are under 18, do not use the service. If we learn that a user is a minor, we will close the account."
          }
        ]
      },
      {
        "title": "4. Your account",
        "blocks": [
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "Give accurate information, and update it when it changes. **Calorie targets, meal plans, and warnings are based on the information you give.** If that information is wrong, they will be wrong too.",
                "children": []
              },
              {
                "text": "Keep your password safe. If you suspect someone else has accessed your account, tell us right away.",
                "children": []
              },
              {
                "text": "You are responsible for actions in your account that were done with your knowledge, or because you did not take reasonable care of your password.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "5. Health and safety — please read",
        "blocks": [
          {
            "type": "list",
            "ordered": true,
            "items": [
              {
                "text": "**All numbers are estimates.** This includes calorie, macro, and water targets, formula calculations, food recognition from photos, nutrition values from outside databases, meal plans, and training plans. They can be wrong.",
                "children": []
              },
              {
                "text": "**Allergies.** Filtering by allergies and food limitations is best-effort only. It does not guarantee that a food is safe for you. If you have an allergy, **check every ingredient yourself on the product label**. Do not rely on the app.",
                "children": []
              },
              {
                "text": "**Pregnancy, breastfeeding, medical conditions, medications, eating disorders, and older users:** Talk to a doctor or a licensed dietitian before you change your diet, exercise, or supplements. Talk to them even if the app suggested the change.",
                "children": []
              },
              {
                "text": "**Supplements.** A mention of a supplement in the app is not medical advice. Ask a doctor or pharmacist.",
                "children": []
              },
              {
                "text": "**Emergencies.** Do not use the app in an emergency. In Israel, call Magen David Adom at 101. Outside Israel, call your local emergency number, such as 112.",
                "children": []
              },
              {
                "text": "**If something feels wrong, stop.** This includes dizziness, weakness, pain, or any other symptom. See a professional.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "6. AI features",
        "blocks": [
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "AI replies are generated automatically. **No professional reviews them**, and they can be wrong, incomplete, or unsuitable for you.",
                "children": []
              },
              {
                "text": "Do not use the AI to diagnose, to check whether a food is safe for an allergy, or to make decisions in pregnancy, breastfeeding, or a medical condition.",
                "children": []
              },
              {
                "text": "The AI is not a dietitian or a doctor, even when it sounds professional.",
                "children": []
              },
              {
                "text": "To run these features, your information is sent as the Privacy Policy describes. You can say no to AI and keep using the rest of the service.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "7. A dietitian, coach, or organization that invited you",
        "blocks": [
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "We do not provide a licensed dietitian service.",
                "children": []
              },
              {
                "text": "If you joined through a link from a dietitian, coach, or organization, the professional relationship is between you and them, not between you and us.",
                "children": []
              },
              {
                "text": "The professional or organization sees their own clients' data, as the Privacy Policy describes.",
                "children": []
              },
              {
                "text": "The app and the AI are not your professional. An automatically generated plan has not been reviewed by the professional, unless they told you directly that they reviewed it.",
                "children": []
              },
              {
                "text": "An organization can add its own onboarding questions. Your answers will be shared with it.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "8. Membership and payment",
        "blocks": [
          {
            "type": "list",
            "ordered": true,
            "items": [
              {
                "text": "**Price.** The price, currency, billing period, and conditions are shown to you on the Stripe checkout page **before** you confirm. The price shown there, in US dollars, is the price charged.",
                "children": []
              },
              {
                "text": "**Plans.** There is a monthly membership and a yearly membership. The current membership has no minimum commitment period. If a checkout page shows a commitment, that period is shown before you pay.",
                "children": []
              },
              {
                "text": "**Trial.** The trial is 30 days.",
                "children": [
                  "A card is required at the start of the trial.",
                  "The first charge is on the date shown at checkout, unless you cancel before then.",
                  "We do not send an email reminder before the trial ends."
                ]
              },
              {
                "text": "**Auto-renewal.** Your membership renews automatically at the end of each period, and we charge the payment method you gave, until you cancel.",
                "children": []
              },
              {
                "text": "**How to cancel.** You can cancel in any of these ways:",
                "children": [
                  "in the app: Settings → Subscription → Cancel plan;",
                  "in the Stripe customer portal;",
                  "by email to info@betterchoice.live;",
                  "in any other way the Consumer Protection Law allows.",
                  "Canceling does not require you to delete your account. Deleting the app does not cancel your membership."
                ]
              },
              {
                "text": "**When cancellation takes effect.** The button in the app marks the membership to end at the end of the current billing period. The law is stronger than that button: cancellation of an ongoing transaction takes effect no later than three business days after we receive your notice. We will not charge you for any period after that date. If you already paid for time after that date, we will refund that part. If the button does not do this, email us.",
                "children": []
              },
              {
                "text": "**Canceling within 14 days (consumers in Israel).** You may cancel within 14 days from the day of the transaction or the day you received the transaction details, whichever is later. Cancellation is made under the Consumer Protection Law, 5741-1981, and the Consumer Protection (Cancellation of Transaction) Regulations, 5771-2010.",
                "children": [
                  "We do not charge a cancellation fee.",
                  "Any refund is given as the law provides.",
                  "Consumers in the EEA and the UK get the cancellation rights their local law gives them."
                ]
              },
              {
                "text": "**Refunds.** Beyond Sections 6 and 7 above, refunds are given only when the law requires, or when we did not provide the service.",
                "children": []
              },
              {
                "text": "**Access codes and promotions.** The terms of each code, including any expiry, are shown when you redeem it. A code cannot be exchanged for cash, unless the law requires it.",
                "children": []
              },
              {
                "text": "**Failed payment.** If a charge fails, Stripe may retry it, and we will tell you. If the charge still does not succeed, access to paid features may be paused. Your information will not be deleted because of this. If there is no payment method at the end of the trial, the membership ends.",
                "children": []
              },
              {
                "text": "**Price changes.** We will notify you by email and in the app 30 days before any price change. The new price applies only from your next billing period, and you can cancel before then at no extra cost.",
                "children": []
              },
              {
                "text": "**Apple and Google.** Memberships are sold through Stripe, not through the App Store or Google Play. So Apple and Google do not handle billing, cancellation, or refunds for your membership.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "9. Prohibited use",
        "blocks": [
          {
            "type": "p",
            "text": "You must not:"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "use the service unlawfully;",
                "children": []
              },
              {
                "text": "impersonate someone else, or enter information about another person without their permission;",
                "children": []
              },
              {
                "text": "try to hack the service, get around limits or blocks, or overload the service;",
                "children": []
              },
              {
                "text": "collect information from the service automatically;",
                "children": []
              },
              {
                "text": "upload content that infringes other people's rights, or offensive content;",
                "children": []
              },
              {
                "text": "use the AI to create unlawful content;",
                "children": []
              },
              {
                "text": "sell or transfer your access to others.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "10. Your content",
        "blocks": [
          {
            "type": "p",
            "text": "The content you upload stays yours. This includes photos, text, messages, and your diary."
          },
          {
            "type": "p",
            "text": "You give us permission to use your content only to run the service for you: to store it, display it, analyze it, and send it to the parties listed in the Privacy Policy."
          },
          {
            "type": "p",
            "text": "We do not use your content for advertising, and we do not use it to train models."
          },
          {
            "type": "p",
            "text": "This permission ends when the content is deleted, subject to Section 9 of the Privacy Policy."
          }
        ]
      },
      {
        "title": "11. Our intellectual property",
        "blocks": [
          {
            "type": "p",
            "text": "The app, its design, code, marks, and the content we created belong to us or to whoever licensed them to us."
          },
          {
            "type": "p",
            "text": "We give you a personal, non-exclusive, non-transferable license to use the app on your devices while your account is active."
          }
        ]
      },
      {
        "title": "12. Other companies' services",
        "blocks": [
          {
            "type": "p",
            "text": "The service uses services from other companies, such as Apple, Google, Stripe, and Open Food Facts. Each service's own terms apply to your use of it."
          },
          {
            "type": "p",
            "text": "Information from outside databases, such as nutrition values by barcode, may be wrong or out of date."
          }
        ]
      },
      {
        "title": "13. Changes to the service, and availability",
        "blocks": [
          {
            "type": "p",
            "text": "We keep developing the service and may change features. If we remove or reduce a core feature you pay for, we will notify you 30 days in advance, and you can cancel and get a pro-rata refund for the prepaid period."
          },
          {
            "type": "p",
            "text": "The service may sometimes be unavailable, for example during maintenance or because of a problem at a vendor."
          }
        ]
      },
      {
        "title": "14. Suspension, termination, and deletion",
        "blocks": [
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "**You** can delete your account at any time: Settings → Delete account, or by contacting us. Deleting your account does not automatically cancel a Stripe membership. So cancel your membership as described in Section 8.",
                "children": []
              },
              {
                "text": "**We** may suspend or close an account if you materially breach these terms, if there is a reasonable concern of fraud or harm to others, or if the law requires us to.",
                "children": [
                  "We will usually notify you in advance and give you a chance to fix the breach, unless there is an urgent reason.",
                  "If we close an account for a reason other than your breach, we will refund you pro rata for any unused prepaid period."
                ]
              }
            ]
          }
        ]
      },
      {
        "title": "15. Liability",
        "blocks": [
          {
            "type": "list",
            "ordered": true,
            "items": [
              {
                "text": "We provide the service with reasonable skill and care. Because the service gives estimates, we do not promise that every value, food recognition, or AI reply will be accurate (see Sections 5 and 6).",
                "children": []
              },
              {
                "text": "**For ordinary service failures,** such as the service being unavailable, a display error, or lost data, our total liability to you is limited to what you paid us in the 12 months before the event.",
                "children": []
              },
              {
                "text": "**The limit in paragraph 2 does not apply to:**",
                "children": [
                  "bodily injury or death caused by our negligence;",
                  "fraud, willful misconduct, or gross negligence;",
                  "our breach of duties under privacy-protection law;",
                  "any other liability that the law does not allow us to limit."
                ]
              },
              {
                "text": "We are not responsible for harm caused only by a service of another company that is not acting for us, or only by wrong information you gave.",
                "children": []
              },
              {
                "text": "Nothing in these terms takes away rights that the Consumer Protection Law or any other law gives you and that cannot be waived.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "16. Indemnity",
        "blocks": [
          {
            "type": "p",
            "text": "If a third party sues us because of content you uploaded unlawfully, or because of your willful breach of Section 9, you will indemnify us for the resulting loss. In that case:"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "we will tell you about the claim promptly;",
                "children": []
              },
              {
                "text": "we will give you a chance to defend it;",
                "children": []
              },
              {
                "text": "we will not settle without your consent.",
                "children": []
              }
            ]
          },
          {
            "type": "p",
            "text": "This duty covers only your share of responsibility for the loss."
          }
        ]
      },
      {
        "title": "17. Changes to these terms",
        "blocks": [
          {
            "type": "p",
            "text": "**Material changes:** We will notify you by email and in the app at least 30 days before the change takes effect. If you do not agree, you can cancel your membership before the change date and get a pro-rata refund for the prepaid period. If the change requires express consent, we will ask for it."
          },
          {
            "type": "p",
            "text": "**Minor changes or changes the law requires:** For example, fixing wording or updating contact details. These take effect when published."
          },
          {
            "type": "p",
            "text": "**Continuing to use the service after the notice does not count as agreeing to a change that reduces your rights.**"
          }
        ]
      },
      {
        "title": "18. Governing law and courts",
        "blocks": [
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "Israeli law governs these terms.",
                "children": []
              },
              {
                "text": "**Consumers in Israel** may file a claim in any competent court in Israel under the law, including the Small Claims Court. We will not argue that a court where you live lacks jurisdiction if it has jurisdiction under the law. A court in the area of our registered office in Dover, Delaware also has jurisdiction.",
                "children": []
              },
              {
                "text": "**If we sue you,** we will do so in the competent court in the area where you live.",
                "children": []
              },
              {
                "text": "**Consumers in the EEA and the UK** may sue in their country of residence. The consumer protections of their local law continue to apply to them.",
                "children": []
              },
              {
                "text": "Before going to court, you can contact us at info@betterchoice.live. We will try to resolve the matter. Contacting us is not required.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "19. Terms about Apple",
        "blocks": [
          {
            "type": "p",
            "text": "If you downloaded the app from the App Store:"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "These terms are between you and us, not with Apple.",
                "children": []
              },
              {
                "text": "Apple is not responsible for the app, its support, or claims about it.",
                "children": []
              },
              {
                "text": "Apple and its subsidiaries are third-party beneficiaries of these terms and may enforce them against you.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "20. General",
        "blocks": [
          {
            "type": "list",
            "ordered": false,
            "items": [
              {
                "text": "If a court finds a section invalid, the other sections continue to apply.",
                "children": []
              },
              {
                "text": "We may transfer this contract to another entity only if your rights are not reduced. In that case, we will notify you.",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "title": "21. Contact",
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
                "text": "Email: info@betterchoice.live.",
                "children": []
              },
              {
                "text": "Membership cancellation: info@betterchoice.live.",
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

const TermsOfServicePage = () => {
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
            {language === 'hebrew' ? 'תנאי שימוש' : 'Terms of Service'}
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

        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
