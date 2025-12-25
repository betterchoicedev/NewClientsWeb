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
      lastUpdated: "עדכון אחרון: נובמבר 2025",
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
            "נתוני שימוש: כיצד אתה משתמש באתר שלנו, עמודים שבהם ביקרת, זמן שהייה",
            "עוגיות ונתוני מעקב: אנו משתמשים בעוגיות לשיפור חווית המשתמש"
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
            "דיאטנים מוסמכים: רק אם בחרת לעבוד עם דיאטן מומחה דרך השירות שלנו",
            "רשויות משפטיות: אם נדרש על פי חוק או כדי להגן על הזכויות שלנו"
          ]
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
            "Supabase: לאחסון נתונים מאובטח"
          ]
        },
        {
          title: "9. שמירת נתונים",
          content: `אנו שומרים על הנתונים האישיים שלך כל עוד החשבון שלך פעיל או כפי שנדרש לספק לך שירותים. אם תבקש למחוק את החשבון שלך, נמחק את הנתונים שלך תוך 30 יום.`
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
      lastUpdated: "Last Updated: November 2025",
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
            "Usage Data: How you use our website, pages visited, time spent",
            "Cookies and Tracking Data: We use cookies to enhance user experience"
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
            "Licensed Dietitians: Only if you choose to work with an expert dietitian through our service",
            "Legal Authorities: If required by law or to protect our rights"
          ]
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
            "Supabase: For secure data storage"
          ]
        },
        {
          title: "9. Data Retention",
          content: `We retain your personal data for as long as your account is active or as needed to provide you services. If you request to delete your account, we will delete your data within 30 days.`
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

