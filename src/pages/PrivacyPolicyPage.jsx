import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Navigation from '../components/Navigation';
import * as CookieConsent from 'vanilla-cookieconsent';

const PrivacyPolicyPage = () => {
  const navigate = useNavigate();
  const { language, direction } = useLanguage();
  const { isDarkMode, themeClasses } = useTheme();

  const content = {
    hebrew: {
      title: "מדיניות פרטיות",
      lastUpdated: "עדכון אחרון: יוני 2026",
      sections: [
        {
          title: "1. מבוא",
          content: `ברוכים הבאים ל-BetterChoice. אנו מחויבים להגן על הפרטיות שלך ולטפל בנתונים האישיים שלך באחריות. מדיניות פרטיות זו מסבירה כיצד אנו אוספים, משתמשים, חולקים ומגנים על המידע האישי שלך.`
        },
        {
          title: "2. מידע שאנו אוספים",
          content: `אנו עשויים לאסוף את סוגי המידע הבאים:`,
          list: [
            "מידע אישי: שם, כתובת אימייל, מספר טלפון, תאריך לידה",
            "מידע בריאותי: משקל, גובה, מטרות תזונתיות, העדפות תזונה, אלרגיות ורגישויות למזון",
            "מידע תשלום: פרטי כרטיס אשראי (מעובדים באופן מאובטח דרך Stripe)",
            "נתוני שימוש: כיצד אתה משתמש באתר ובאפליקציות הנייד שלנו, עמודים ומסכים שבהם ביקרת, זמן שהייה",
            "עוגיות ונתוני מעקב: אנו משתמשים בעוגיות לשיפור חווית המשתמש",
            "תמונות באפליקציה לנייד: בעת השימוש בתכונת תמונת ה-AI ביומן הבריאות, תמונת הארוחה שאתה מצלם (או בוחר מספריית התמונות), תווית הארוחה (למשל \"ארוחת בוקר\") וכל כיתוב אופציונלי שתקליד",
            "נתוני בריאות באפליקציה לנייד: באישורך, ספירת צעדים ונתוני שינה הנקראים מ-Apple Health (iOS) או Health Connect (Android). האפליקציה עשויה גם לכתוב בחזרה ל-Apple Health / Health Connect את הארוחות והמים שאתה מתעד, כרשומות תזונה והידרציה",
            "הרשאות מכשיר: גישה למצלמה (לסריקת ברקודים ותמונות ארוחה), גישה לספריית התמונות (לבחירת תמונות ארוחה קיימות), ואסימוני התראות (לתזכורות ארוחה שתבחר להפעיל)"
          ]
        },
        {
          title: "3. כיצד אנו משתמשים במידע שלך",
          content: `אנו משתמשים במידע שלך למטרות הבאות:`,
          list: [
            "מתן שירותי תכנון ארוחות ומעקב תזונה מותאמים אישית",
            "עיבוד תשלומים ושמירה על מידע חשבון",
            "שיפור השירותים והאתר שלנו",
            "תקשורת איתך לגבי החשבון והשירותים שלך",
            "ניתוח נתונים כדי להבין כיצד משתמשים אינטראקציה עם האתר",
            "שמירה על אבטחה ומניעת הונאה"
          ]
        },
        {
          title: "4. שיתוף מידע",
          content: `אנו לא מוכרים את המידע האישי שלך לצדדים שלישיים. אנו עשויים לשתף מידע עם:`,
          list: [
            "ספקי שירות: כמו Stripe (לעיבוד תשלומים) ו-Supabase (לאחסון נתונים מאובטח)",
            "Microsoft Azure (Azure OpenAI Service ו-Azure AI Foundry): מארח את מודלי ה-AI המשמשים בתכונות הבינה המלאכותית של האפליקציה. ראה סעיף 8א לפרטים",
            "דיאטנים מוסמכים: רק אם בחרת לעבוד עם דיאטן מומחה דרך השירות שלנו",
            "רשויות משפטיות: אם נדרש על פי חוק או כדי להגן על הזכויות שלנו"
          ],
          footer: `כל ספקי השירות הצד-שלישי שאנו משתמשים בהם (Stripe, Supabase, Microsoft Azure) מחויבים בהסכמי עיבוד נתונים (DPA) המחייבים אותם חוזית לספק רמת הגנת נתונים השווה או עולה על המתואר במדיניות פרטיות זו, ולא להשתמש בנתונים האישיים שלך למטרות אחרות מלבד אספקת השירות עבורנו.`
        },
        {
          title: "5. אבטחת נתונים",
          content: `אנו מיישמים אמצעי אבטחה מתאימים כדי להגן על המידע האישי שלך, כולל הצפנה, אחסון מאובטח ובקרות גישה. עם זאת, שום שיטת העברה דרך האינטרנט או שיטת אחסון אלקטרוני אינה 100% מאובטחת.`
        },
        {
          title: "6. הזכויות שלך",
          content: `יש לך את הזכויות הבאות לגבי הנתונים האישיים שלך:`,
          list: [
            "גישה: לבקש גישה לנתונים האישיים שלך",
            "תיקון: לתקן נתונים לא מדויקים או לא שלמים",
            "מחיקה: לבקש מחיקה של הנתונים האישיים שלך",
            "הגבלה: להגביל עיבוד הנתונים שלך",
            "ניידות: לקבל את הנתונים שלך בפורמט מובנה ונפוץ",
            "התנגדות: להתנגד לעיבוד הנתונים שלך"
          ]
        },
        {
          title: "7. עוגיות",
          content: `אנו משתמשים בעוגיות לשיפור חווית הגלישה שלך. עוגיות הן קבצי טקסט קטנים המאוחסנים במכשיר שלך. אתה יכול לשלוט בעוגיות דרך הגדרות העוגיות שלנו או בהגדרות הדפדפן שלך.`
        },
        {
          title: "8. שירותי צד שלישי",
          content: `אנו משתמשים בשירותי צד שלישי כולל:`,
          list: [
            "Google Analytics: לניתוח שימוש באתר (רק עם הסכמתך)",
            "Stripe: לעיבוד תשלומים מאובטח",
            "Supabase: לאחסון נתונים מאובטח",
            "Microsoft Azure AI (Azure OpenAI Service ו-Azure AI Foundry): משמש להפעלת תכונות ה-AI הפנימיות באפליקציה (ניתוח תמונות מזון והמרת מידות מרכיבים). ההסקה רצה במרכזי נתונים של Microsoft באיחוד האירופי תחת הסכם עיבוד נתונים ארגוני של Microsoft. Microsoft אינה משתמשת בנתונים שנשלחו לאימון מודלים, והנתונים אינם נשמרים לאחר החזרת התשובה"
          ]
        },
        {
          title: "8א. אפליקציה לנייד — תכונות AI והסכמה",
          content: `אפליקציות ה-iOS וה-Android שלנו כוללות תכונות AI אופציונליות השולחות חלק מצומצם של תוכן שנוצר על-ידי המשתמש לספק AI צד-שלישי לעיבוד:`,
          list: [
            "מה נשלח: תמונת הארוחה שצילמת או בחרת, תווית הארוחה (למשל \"ארוחת בוקר\"), והכיתוב החופשי האופציונלי שהקלדת. עבור תכונת המרת מידות המרכיבים, רק שם המרכיב, המותג (אם יש), המידה המקורית, והעדפת השפה/אזור שלך",
            "מה אינו נשלח: שמך, האימייל, מספר הטלפון, הכתובת, מזהה החשבון, הגיל, המין, הגובה, המשקל, היסטוריית המשקל, BMR/TDEE, מאקרו-נוטריינטים, העדפות תזונה, אלרגיות מזון, מגבלות מזון, מצבים רפואיים, מידע תשלום, נתוני Apple Health / Health Connect, רשומות יומן, או כל שדה פרופיל אחר",
            "מי מקבל את הנתונים: הנתונים מועברים על-ידי שרת ה-Backend שלנו ל-Microsoft Azure (Azure OpenAI Service ו-Azure AI Foundry) הפועל באזור האיחוד האירופי. אנחנו לא שולחים נתונים אלה לאף ספק AI אחר (OpenAI, Anthropic, Google וכו')",
            "כיצד הנתונים מוגנים: Microsoft מעבדת את הנתונים תחת אותו הסכם עיבוד נתונים ארגוני המחיל את שאר תשתית הענן שלנו. Microsoft אינה משתמשת בנתונים שנשלחו לאימון מודלים, והנתונים אינם נשמרים לאחר הניתוח. אף צד שלישי אחר אינו מקבל נתונים אלה",
            "ההסכמה שלך: בפעם הראשונה שתשתמש בתכונת AI, האפליקציה תציג מסך הסכמה ייעודי בתוך האפליקציה, המפרט את הנתונים, הנמען (Microsoft Azure AI), והאפשרויות שלך. תכונת ה-AI לא תפעל עד שתאשר באופן פעיל. ניתן לסרב בכל עת ולהמשיך להשתמש בשאר האפליקציה כרגיל. כדי לבטל הסכמה שניתנה בעבר, מחק והתקן מחדש את האפליקציה — פעולה שתנקה את ההרשאה השמורה מקומית"
          ]
        },
        {
          title: "8ב. אפליקציה לנייד — Apple Health ו-Health Connect",
          content: `ב-iOS, האפליקציה משתלבת עם Apple HealthKit. ב-Android, האפליקציה משתלבת עם Google Health Connect. באישורך המפורש (הניתן דרך הודעת ההרשאה של המערכת), האפליקציה:`,
          list: [
            "קוראת: ספירת צעדים יומית ומשך שינה מ-7 הימים האחרונים, המוצגים במסך הבריאות בתוך האפליקציה",
            "כותבת: את הארוחות והמים שאתה מתעד ביומן הבריאות, נרשמים כרשומות תזונה והידרציה כדי שהמידע המלא שלך יישאר מאוחד בפלטפורמת הבריאות שלך"
          ],
          footer: `נתוני בריאות הנקראים מ-Apple Health / Health Connect או נכתבים אליהם נשארים במכשיר שלך או בחשבון Apple / Google האישי שלך. הם אינם מועברים בשום מקרה לשרתים שלנו, ל-Microsoft Azure AI, או לכל צד שלישי אחר.`
        },
        {
          title: "8ג. אפליקציה לנייד — כניסה עם Apple",
          content: `אם תיכנס באמצעות Apple, אנו מקבלים רק את השם וכתובת האימייל שתבחר לשתף. אם תשתמש בשירות "Hide My Email" של Apple, נראה רק את כתובת הרילי (relay) ולעולם לא את כתובת האימייל האמיתית שלך.`
        },
        {
          title: "9. שמירת נתונים ומחיקת חשבון",
          content: `אנו שומרים על הנתונים האישיים שלך כל עוד החשבון שלך פעיל או כפי שנדרש לספק לך שירותים. אם תבקש למחוק את החשבון שלך, נמחק את הנתונים שלך תוך 30 יום.`,
          footer: `ניתן למחוק לצמיתות את חשבון BetterChoice שלך ואת כל הנתונים המשויכים אליו בכל עת מתוך האפליקציה: פתח את התפריט הצדדי ← מחק חשבון.`
        },
        {
          title: "10. פרטיות ילדים",
          content: `השירותים שלנו אינם מיועדים לאנשים מתחת לגיל 18. אנו לא אוספים במודע מידע אישי מילדים מתחת לגיל 18.`
        },
        {
          title: "11. שינויים במדיניות זו",
          content: `אנו עשויים לעדכן מדיניות פרטיות זו מעת לעת. נודיע לך על כל שינויים על ידי פרסום המדיניות החדשה בעמוד זה ועדכון תאריך "עדכון אחרון".`
        },
        {
          title: "12. צור קשר",
          content: `אם יש לך שאלות לגבי מדיניות הפרטיות הזו או נוהלי הנתונים שלנו, אנא צור קשר איתנו:`,
          contact: {
            email: "info@betterchoice.live"
          }
        }
      ]
    },
    english: {
      title: "Privacy Policy",
      lastUpdated: "Last Updated: June 2026",
      sections: [
        {
          title: "1. Introduction",
          content: `Welcome to BetterChoice. We are committed to protecting your privacy and handling your personal data responsibly. This Privacy Policy explains how we collect, use, share, and protect your personal information.`
        },
        {
          title: "2. Information We Collect",
          content: `We may collect the following types of information:`,
          list: [
            "Personal Information: Name, email address, phone number, date of birth",
            "Health Information: Weight, height, nutritional goals, dietary preferences, food allergies and sensitivities",
            "Payment Information: Credit card details (processed securely through Stripe)",
            "Usage Data: How you use our website and mobile apps, pages and screens visited, time spent",
            "Cookies and Tracking Data: We use cookies to enhance user experience",
            "Mobile App Photos: When you use the AI Photo feature in the Health Diary, the meal photo you capture (or pick from your library), the meal label (e.g. \"Breakfast\"), and any optional caption you type",
            "Mobile App Health Data: With your permission, step count and sleep data read from Apple Health (iOS) or Health Connect (Android). The app may also write the meals and water you log back to Apple Health / Health Connect as Nutrition and Hydration entries",
            "Device Permissions: Camera access (for barcode scanning and meal photos), photo library access (for picking existing meal photos), and notification tokens (for meal-time reminders you opt into)"
          ]
        },
        {
          title: "3. How We Use Your Information",
          content: `We use your information for the following purposes:`,
          list: [
            "Providing personalized meal planning and nutrition tracking services",
            "Processing payments and maintaining account information",
            "Improving our services and website",
            "Communicating with you about your account and services",
            "Analyzing data to understand how users interact with the site",
            "Maintaining security and preventing fraud"
          ]
        },
        {
          title: "4. Information Sharing",
          content: `We do not sell your personal information to third parties. We may share information with:`,
          list: [
            "Service Providers: Such as Stripe (for payment processing) and Supabase (for secure data storage)",
            "Microsoft Azure (Azure OpenAI Service and Azure AI Foundry): Hosts the AI models used by the app's AI features. See Section 8a for details",
            "Licensed Dietitians: Only if you choose to work with an expert dietitian through our service",
            "Legal Authorities: If required by law or to protect our rights"
          ],
          footer: `All third-party service providers we use (Stripe, Supabase, Microsoft Azure) are bound by Data Processing Agreements that contractually require them to provide a level of data protection equal to or exceeding what is described in this Privacy Policy, and not to use your personal data for purposes other than providing the service to us.`
        },
        {
          title: "5. Data Security",
          content: `We implement appropriate security measures to protect your personal information, including encryption, secure storage, and access controls. However, no method of transmission over the Internet or electronic storage is 100% secure.`
        },
        {
          title: "6. Your Rights",
          content: `You have the following rights regarding your personal data:`,
          list: [
            "Access: Request access to your personal data",
            "Correction: Correct inaccurate or incomplete data",
            "Deletion: Request deletion of your personal data",
            "Restriction: Restrict processing of your data",
            "Portability: Receive your data in a structured, commonly used format",
            "Objection: Object to processing of your data"
          ]
        },
        {
          title: "7. Cookies",
          content: `We use cookies to enhance your browsing experience. Cookies are small text files stored on your device. You can control cookies through our cookie settings or your browser settings.`
        },
        {
          title: "8. Third-Party Services",
          content: `We use third-party services including:`,
          list: [
            "Google Analytics: For website usage analysis (only with your consent)",
            "Stripe: For secure payment processing",
            "Supabase: For secure data storage",
            "Microsoft Azure AI (Azure OpenAI Service and Azure AI Foundry): Used to power the in-app AI features (food-photo analysis and ingredient-measurement conversion). Inference runs in Microsoft data centers in the EU under Microsoft's Enterprise Data Processing Agreement. Microsoft does not use submitted data to train any model, and data is not retained after the response is returned"
          ]
        },
        {
          title: "8a. Mobile App - AI Features and Consent",
          content: `Our iOS and Android apps include optional AI features that send a limited subset of user-generated content to a third-party AI provider for processing:`,
          list: [
            "What is sent: The meal photo you capture or select, the meal label (e.g. \"Breakfast\"), and the optional free-text caption you type. For the ingredient-measurement conversion feature, only the ingredient name, brand (if any), the source measurement, and your language/region preference",
            "What is not sent: Your name, email, phone number, address, account ID, age, gender, height, weight, weight history, BMR/TDEE, macros, dietary preferences, food allergies, food limitations, medical conditions, payment information, Apple Health / Health Connect data, calendar entries, or any other profile field",
            "Who receives it: The data is forwarded by our backend server to Microsoft Azure (Azure OpenAI Service and Azure AI Foundry) running in the EU region. We do not send this data to any other AI provider (OpenAI, Anthropic, Google, etc.)",
            "How it is protected: Microsoft processes the data under the same enterprise Data Processing Agreement that governs the rest of our cloud infrastructure. Microsoft does not use submitted data for model training, and the data is not retained after analysis. No other third party receives this data",
            "Your consent: The app will show you a dedicated in-app consent screen the first time you use an AI feature, naming the data, the recipient (Microsoft Azure AI), and your options. The AI feature will not run until you actively agree. You can decline at any time and continue using the rest of the app normally. To revoke a previously granted consent, delete and reinstall the app, which clears the locally stored permission"
          ]
        },
        {
          title: "8b. Mobile App - Apple Health and Health Connect",
          content: `On iOS, the app integrates with Apple HealthKit. On Android, it integrates with Google Health Connect. With your explicit permission (granted through the system permission prompt), the app:`,
          list: [
            "Reads: Daily step count and sleep duration from the last 7 days, displayed in the in-app Health screen",
            "Writes: The meals and water you log in the Health Diary, recorded as Nutrition and Hydration entries so your full record stays consolidated in your health platform"
          ],
          footer: `Health data read from or written to Apple Health / Health Connect stays on your device or in your personal Apple / Google account. It is never transmitted to our servers, to Microsoft Azure AI, or to any other third party.`
        },
        {
          title: "8c. Mobile App - Sign in with Apple",
          content: `If you sign in using Apple, we receive only the name and email address you choose to share. If you use Apple's "Hide My Email" relay, we will only ever see the relay address and never your real email address.`
        },
        {
          title: "9. Data Retention and Account Deletion",
          content: `We retain your personal data for as long as your account is active or as needed to provide you services. If you request to delete your account, we will delete your data within 30 days.`,
          footer: `You can permanently delete your BetterChoice account and all associated data at any time from within the app: open the side menu → Delete account.`
        },
        {
          title: "10. Children's Privacy",
          content: `Our services are not intended for individuals under 18 years of age. We do not knowingly collect personal information from children under 18.`
        },
        {
          title: "11. Changes to This Policy",
          content: `We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date.`
        },
        {
          title: "12. Contact Us",
          content: `If you have questions about this Privacy Policy or our data practices, please contact us:`,
          contact: {
            email: "info@betterchoice.live"
          }
        }
      ]
    }
  };

  const currentContent = content[language] || content.english;

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
            {currentContent.title}
          </h1>
          <p className={`${themeClasses.textSecondary} mb-6 sm:mb-8 text-sm sm:text-base`}>
            {currentContent.lastUpdated}
          </p>

          <div className="space-y-6 sm:space-y-8">
            {currentContent.sections.map((section, index) => (
              <div key={index} className={`border-b ${themeClasses.borderSecondary} pb-4 sm:pb-6 last:border-b-0`}>
                <h2 className={`text-lg sm:text-xl md:text-2xl font-semibold ${themeClasses.textPrimary} mb-2 sm:mb-3`}>
                  {section.title}
                </h2>
                <p className={`${themeClasses.textSecondary} mb-2 sm:mb-3 leading-relaxed text-sm sm:text-base`}>
                  {section.content}
                </p>
                
                {section.list && (
                  <ul className={`list-disc ${direction === 'rtl' ? 'list-inside mr-4' : 'list-inside ml-4'} space-y-2 ${themeClasses.textSecondary}`}>
                    {section.list.map((item, idx) => (
                      <li key={idx} className="leading-relaxed">{item}</li>
                    ))}
                  </ul>
                )}

                {section.footer && (
                  <p className={`${themeClasses.textSecondary} mt-3 sm:mt-4 leading-relaxed text-sm sm:text-base`}>
                    {section.footer}
                  </p>
                )}

                {section.contact && (
                  <div className={`mt-4 ${themeClasses.sectionBg} p-4 rounded-lg`}>
                    <p className={themeClasses.textSecondary}>
                      <strong>{language === 'hebrew' ? 'אימייל:' : 'Email:'}</strong>{' '}
                      <a href={`mailto:${section.contact.email}`} className="text-green-600 hover:text-green-700 dark:text-green-400 transition-colors">
                        {section.contact.email}
                      </a>
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Cookie Preferences Button */}
          <div className={`mt-6 sm:mt-8 p-4 sm:p-6 ${themeClasses.sectionBg} rounded-lg border ${themeClasses.borderSecondary} text-center`}>
            <h3 className={`text-lg sm:text-xl font-semibold ${themeClasses.textPrimary} mb-2 sm:mb-3`}>
              {language === 'hebrew' ? 'נהל את העדפות העוגיות שלך' : 'Manage Your Cookie Preferences'}
            </h3>
            <p className={`${themeClasses.textSecondary} mb-3 sm:mb-4 text-sm sm:text-base`}>
              {language === 'hebrew' 
                ? 'לחץ על הכפתור למטה כדי לשנות את הגדרות העוגיות שלך בכל עת.'
                : 'Click the button below to change your cookie settings at any time.'}
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
              {language === 'hebrew' ? '🍪 הגדרות עוגיות' : '🍪 Cookie Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;

