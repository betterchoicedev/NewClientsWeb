import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Navigation from '../components/Navigation';

const TermsOfServicePage = () => {
  const navigate = useNavigate();
  const { language, direction } = useLanguage();
  const { isDarkMode, themeClasses } = useTheme();

  const content = {
    hebrew: {
      title: "תנאי שימוש",
      lastUpdated: "עדכון אחרון: נובמבר 2025",
      sections: [
        {
          title: "1. קבלת התנאים",
          content: `ברוכים הבאים ל-BetterChoice. על ידי גישה לאתר זה ושימוש בו, אתה מקבל להיות כפוף לתנאי שימוש אלה, לכל החוקים והתקנות החלות, ומסכים שאתה אחראי לציות לכל חוק מקומי חל. אם אינך מסכים לאף אחד מתנאים אלה, אסור לך להשתמש באתר זה או לגשת אליו.`
        },
        {
          title: "2. שירותים",
          content: `BetterChoice מספקת שירותי תכנון ארוחות, מעקב תזונה וייעוץ מקצועי מדיאטנים מוסמכים. השירותים שלנו כוללים:`,
          list: [
            "תכניות ארוחות מותאמות אישית המבוססות על המטרות והעדפות התזונתיות שלך",
            "מעקב מקרו-נוטריינטים וקלוריות",
            "גישה למסד נתונים של מתכונים בריאים",
            "התייעצות עם דיאטנים מוסמכים (בתוכניות פרימיום)",
            "כלי ניתוח התקדמות ומעקב"
          ]
        },
        {
          title: "3. חשבון משתמש",
          content: `כדי להשתמש בשירותים מסוימים, עליך ליצור חשבון. אתה מסכים:`,
          list: [
            "לספק מידע מדויק, עדכני ושלם",
            "לשמור על אבטחת סיסמת החשבון שלך",
            "להודיע לנו מיד על כל שימוש לא מורשה בחשבון שלך",
            "לקבל אחריות על כל הפעילויות המתרחשות תחת החשבון שלך",
            "שאתה בן 18 לפחות או שיש לך הסכמת הורה/אפוטרופוס"
          ]
        },
        {
          title: "4. תשלום ומנויים",
          content: `אנו מציעים מספר תוכניות מנוי:`,
          list: [
            "תוכנית בסיסית: תכנון ארוחות בסיסי וכלי מעקב",
            "תוכנית פרימיום: תכונות מתקדמות וגישה לדיאטנים",
            "תוכנית ארגונית: פתרונות מותאמים לעסקים"
          ],
          additional: `התשלום מעובד באופן מאובטח דרך Stripe. מנויים מתחדשים אוטומטית אלא אם כן בוטלו. החזרים זמינים בהתאם למדיניות ההחזר שלנו (תוך 14 יום ממועד הרכישה אם לא השתמשת בשירות).`
        },
        {
          title: "5. כתב ויתור רפואי",
          content: `חשוב: BetterChoice מספקת מידע תזונתי כללי ולא תחליף לייעוץ רפואי מקצועי, אבחון או טיפול. תמיד התייעץ עם רופא או מטפל בריאות מוסמך אחר לגבי כל שאלה שיש לך לגבי מצב רפואי או יעדי בריאות.`,
          list: [
            "התוכן שלנו הוא למטרות מידע כללי בלבד",
            "אנו לא מציעים אבחון או טיפול רפואי",
            "התוכניות שלנו אינן מיועדות לטיפול במצבים רפואיים ספציפיים",
            "תמיד התייעץ עם איש מקצוע בתחום הבריאות לפני ביצוע שינויים משמעותיים בתזונה",
            "אם יש לך אלרגיות למזון או מצבים רפואיים, השתמש בשירותים שלנו בזהירות"
          ]
        },
        {
          title: "6. התנהגות משתמש",
          content: `אתה מסכים לא לעשות שימוש בשירות:`,
          list: [
            "למטרות בלתי חוקיות או לא מורשות",
            "להעלות תוכן מזיק, פוגעני או לא הולם",
            "להתחזות לאדם או ישות אחרת",
            "להפריע לשירות או לשרתים",
            "לאסוף מידע על משתמשים אחרים ללא הסכמה",
            "להעתיק, לשנות או להפיץ את התוכן שלנו ללא רשות"
          ]
        },
        {
          title: "7. קניין רוחני",
          content: `כל התוכן, התכונות והפונקציונליות (כולל אך לא מוגבל לטקסט, גרפיקה, לוגואים, תמונות ותוכנה) הם בבעלות BetterChoice ומוגנים על ידי חוקי זכויות יוצרים בינלאומיים, סימני מסחר, פטנטים וזכויות קניין רוחני או זכויות בעלות אחרות.`
        },
        {
          title: "8. ביטול והפסקה",
          content: `אתה יכול לבטל את המנוי שלך בכל עת דרך הגדרות החשבון שלך. אנו שומרים לעצמנו את הזכות להשעות או לסיים את הגישה שלך לשירותים עבור:`,
          list: [
            "הפרה של תנאי שימוש אלה",
            "פעילות הונאה או בלתי חוקית",
            "התנהגות פוגעת כלפי הצוות או משתמשים אחרים שלנו",
            "אי תשלום עבור שירותים"
          ]
        },
        {
          title: "9. הגבלת אחריות",
          content: `BetterChoice והשותפים שלה לא יהיו אחראים לכל נזקים ישירים, עקיפים, מקריים, מיוחדים, תוצאתיים או עונשיים הנובעים מ:`,
          list: [
            "השימוש או חוסר היכולת להשתמש בשירותים שלנו",
            "עלות רכישת סחורות ושירותים חלופיים",
            "גישה לא מורשית לנתונים שלך או שינוי שלהם",
            "טעויות או השמטות בתוכן שלנו",
            "כל עניין אחר הקשור לשירות"
          ]
        },
        {
          title: "10. שיפוי",
          content: `אתה מסכים לשפות ולהגן על BetterChoice, עובדיה, שותפיה ונותני השירותים שלה מפני כל תביעות, נזקים, התחייבויות, הפסדים, חבויות, עלויות או חוב, והוצאות (כולל שכר טרחת עורכי דין) הנובעים מ:`,
          list: [
            "השימוש שלך בשירותים",
            "הפרה של תנאים אלה",
            "הפרה של כל זכות של צד שלישי"
          ]
        },
        {
          title: "11. שינויים לשירות ולתנאים",
          content: `אנו שומרים לעצמנו את הזכות לשנות או להפסיק, באופן זמני או קבוע, את השירות (או כל חלק ממנו) עם או בלי הודעה. אנו גם יכולים לעדכן תנאי שימוש אלה מעת לעת. השימוש המתמשך שלך בשירות מהווה הסכמה לתנאים המעודכנים.`
        },
        {
          title: "12. דין חל ושיפוט",
          content: `תנאים אלה יהיו כפופים ומפורשים בהתאם לחוקי מדינת ישראל. כל מחלוקות הנובעות מתנאים אלה או השימוש בשירות יהיו בשיפוט הבלעדי של בתי המשפט בישראל.`
        },
        {
          title: "13. צור קשר",
          content: `אם יש לך שאלות לגבי תנאי שימוש אלה, אנא צור קשר איתנו:`,
          contact: {
            email: "info@betterchoice.live",
            address: "ישראל"
          }
        }
      ]
    },
    english: {
      title: "Terms of Service",
      lastUpdated: "Last Updated: November 2025",
      sections: [
        {
          title: "1. Acceptance of Terms",
          content: `Welcome to BetterChoice. By accessing and using this website, you accept and agree to be bound by these Terms of Service, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws. If you do not agree with any of these terms, you are prohibited from using or accessing this site.`
        },
        {
          title: "2. Services",
          content: `BetterChoice provides meal planning, nutrition tracking, and professional consultation services from licensed dietitians. Our services include:`,
          list: [
            "Personalized meal plans based on your nutritional goals and preferences",
            "Macronutrient and calorie tracking",
            "Access to a database of healthy recipes",
            "Consultation with licensed dietitians (premium plans)",
            "Progress analysis and tracking tools"
          ]
        },
        {
          title: "3. User Account",
          content: `To use certain services, you must create an account. You agree to:`,
          list: [
            "Provide accurate, current, and complete information",
            "Maintain the security of your account password",
            "Notify us immediately of any unauthorized use of your account",
            "Accept responsibility for all activities that occur under your account",
            "Be at least 18 years old or have parental/guardian consent"
          ]
        },
        {
          title: "4. Payment and Subscriptions",
          content: `We offer several subscription plans:`,
          list: [
            "Basic Plan: Basic meal planning and tracking tools",
            "Premium Plan: Advanced features and dietitian access",
            "Enterprise Plan: Custom solutions for businesses"
          ],
          additional: `Payment is processed securely through Stripe. Subscriptions renew automatically unless canceled. Refunds are available according to our refund policy (within 14 days of purchase if the service has not been used).`
        },
        {
          title: "5. Medical Disclaimer",
          content: `Important: BetterChoice provides general nutritional information and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult with a physician or other qualified healthcare provider about any questions you may have regarding a medical condition or health objectives.`,
          list: [
            "Our content is for general informational purposes only",
            "We do not provide medical diagnosis or treatment",
            "Our plans are not designed to treat specific medical conditions",
            "Always consult with a healthcare professional before making significant dietary changes",
            "If you have food allergies or medical conditions, use our services with caution"
          ]
        },
        {
          title: "6. User Conduct",
          content: `You agree not to use the service to:`,
          list: [
            "Use for any unlawful or unauthorized purpose",
            "Upload harmful, offensive, or inappropriate content",
            "Impersonate any person or entity",
            "Interfere with the service or servers",
            "Collect information about other users without consent",
            "Copy, modify, or distribute our content without permission"
          ]
        },
        {
          title: "7. Intellectual Property",
          content: `All content, features, and functionality (including but not limited to text, graphics, logos, images, and software) are owned by BetterChoice and protected by international copyright, trademark, patent, trade secret, and other intellectual property or proprietary rights laws.`
        },
        {
          title: "8. Cancellation and Termination",
          content: `You may cancel your subscription at any time through your account settings. We reserve the right to suspend or terminate your access to the services for:`,
          list: [
            "Violation of these Terms of Service",
            "Fraudulent or illegal activity",
            "Abusive behavior towards our staff or other users",
            "Non-payment for services"
          ]
        },
        {
          title: "9. Limitation of Liability",
          content: `BetterChoice and its partners shall not be liable for any direct, indirect, incidental, special, consequential, or punitive damages resulting from:`,
          list: [
            "Your use or inability to use our services",
            "Cost of procurement of substitute goods and services",
            "Unauthorized access to or alteration of your data",
            "Errors or omissions in our content",
            "Any other matter relating to the service"
          ]
        },
        {
          title: "10. Indemnification",
          content: `You agree to indemnify and hold harmless BetterChoice, its employees, partners, and service providers from any claims, damages, obligations, losses, liabilities, costs or debt, and expenses (including attorney's fees) arising from:`,
          list: [
            "Your use of the services",
            "Violation of these terms",
            "Violation of any third-party right"
          ]
        },
        {
          title: "11. Changes to Service and Terms",
          content: `We reserve the right to modify or discontinue, temporarily or permanently, the service (or any part thereof) with or without notice. We may also update these Terms of Service from time to time. Your continued use of the service constitutes acceptance of the updated terms.`
        },
        {
          title: "12. Governing Law and Jurisdiction",
          content: `These Terms shall be governed by and construed in accordance with the laws of the State of Israel. Any disputes arising from these terms or use of the service shall be subject to the exclusive jurisdiction of the courts in Israel.`
        },
        {
          title: "13. Contact Us",
          content: `If you have questions about these Terms of Service, please contact us:`,
          contact: {
            email: "info@betterchoice.live",
            address: "Israel"
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

                {section.additional && (
                  <p className={`${themeClasses.textSecondary} mt-3 leading-relaxed`}>
                    {section.additional}
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
                    {section.contact.address && (
                      <p className={`${themeClasses.textSecondary} mt-2`}>
                        <strong>{language === 'hebrew' ? 'כתובת:' : 'Address:'}</strong>{' '}
                        {section.contact.address}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className={`mt-6 sm:mt-8 p-3 sm:p-4 ${themeClasses.sectionBg} rounded-lg border ${themeClasses.borderSecondary}`}>
            <p className={`text-xs sm:text-sm ${themeClasses.textSecondary}`}>
              {language === 'hebrew' 
                ? 'על ידי שימוש ב-BetterChoice, אתה מאשר שקראת, הבנת והסכמת לתנאי שימוש אלה.'
                : 'By using BetterChoice, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;

