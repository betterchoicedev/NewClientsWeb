import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Navigation from '../components/Navigation';

/**
 * Accessibility Statement Page
 * REQUIRED BY ISRAELI LAW (תקנות נגישות 2013)
 * Must be publicly available on all Israeli websites
 */
const AccessibilityStatementPage = () => {
  const { language, direction } = useLanguage();
  const { themeClasses } = useTheme();

  const content = language === 'hebrew' ? {
    title: 'הצהרת נגישות',
    lastUpdated: 'עדכון אחרון: 6 בנובמבר 2025',
    
    commitment: {
      title: 'התחייבות BetterChoice לנגישות',
      paragraphs: [
        'BetterChoice מחויבת להנגיש את האתר והשירותים שלנו לכלל האוכלוסייה, לרבות אנשים עם מוגבלויות.',
        'אנו פועלים ליישום מלא של תקנות הנגישות בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות, התשנ"ח-1998, ולתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע"ג-2013.'
      ]
    },

    standards: {
      title: 'תקנים והנחיות',
      intro: 'האתר עומד בדרישות התקנים הבאים:',
      items: [
        'תקן ישראלי ת"י 5568 לנגישות תכנים באינטרנט ברמה AA',
        'WCAG 2.1 (Web Content Accessibility Guidelines) ברמת AA',
        'תקנות נגישות לשירות (2013)',
        'חוק שוויון זכויות לאנשים עם מוגבלות (1998)'
      ]
    },

    features: {
      title: 'תכונות נגישות באתר',
      mandatory: 'תכונות חובה:',
      mandatoryItems: [
        'התאמת גודל גופן - הגדלה עד 200%',
        'התאמת ניגודיות - רגיל, גבוה, הפוך צבעים',
        'ניווט מלא באמצעות מקלדת',
        'תמיכה בקוראי מסך',
        'הדגשת קישורים',
        'עצירת אנימציות',
        'גופן קריא',
        'סמן עכבר מוגדל'
      ],
      additional: 'תכונות נוספות:',
      additionalItems: [
        'מצב כהה/בהיר להפחתת עומס עיניים',
        'תמיכה מלאה בשפות עברית ואנגלית',
        'כפתור נגישות צף בכל עמוד',
        'שמירת העדפות משתמש',
        'הדגשת כותרות לקלות ניווט',
        'עיצוב רספונסיבי למכשירים שונים'
      ]
    },

    implementation: {
      title: 'יישום נגישות',
      date: 'תאריך סקר נגישות אחרון: נובמבר 2025',
      items: [
        'בדיקת נגישות אוטומטית באמצעות כלי axe ו-WAVE',
        'בדיקות ידניות עם קוראי מסך (NVDA, JAWS)',
        'בדיקות ניווט עם מקלדת בלבד',
        'בדיקות ניגודיות צבעים',
        'תיעוד והדרכת צוות הפיתוח'
      ]
    },

    known: {
      title: 'מגבלות נגישות ידועות',
      intro: 'אנו עובדים כל הזמן לשיפור הנגישות. מגבלות ידועות כרגע:',
      items: [
        'חלק מתכני צד שלישי (סרטונים, קבצים מוטמעים) עשויים להיות בתהליך התאמה',
        'חלק מתמונות ישנות בתהליך הוספת תיאורים חלופיים',
        'תכונות חדשות נבדקות לנגישות לפני פרסום'
      ]
    },

    contact: {
      title: 'יצירת קשר בנושא נגישות',
      intro: 'אם נתקלתם בבעיית נגישות באתר, או שיש לכם הצעה לשיפור, נשמח לשמוע:',
      coordinator: 'רכז נגישות: BetterChoice',
      email: 'דוא"ל:',
      emailAddress: 'info@betterchoice.live',
      response: 'זמן תגובה: תוך 5 ימי עבודה',
      note: 'בפנייה אנא פרטו: את הדפדפן בו אתם משתמשים, תיאור הבעיה, וקישור לעמוד הרלוונטי.'
    },

    complaints: {
      title: 'הליך תלונות',
      intro: 'אם אינכם מרוצים מהטיפול בפנייתכם, תוכלו לפנות ל:',
      commissioner: 'נציבות שוויון זכויות לאנשים עם מוגבלות',
      ministry: 'משרד המשפטים',
      phone: 'טלפון: 02-6467011',
      email: 'דוא"ל: sar@justice.gov.il',
      website: 'אתר: www.justice.gov.il/Units/NetzivutShivyon',
      note: 'התלונה תועבר לבחינה ותקבלו מענה בהתאם לנהלי משרד המשפטים.'
    },

    updates: {
      title: 'עדכונים ושיפורים',
      text: 'אנו ממשיכים לשפר את נגישות האתר באופן שוטף. הצהרה זו תתעדכן לפחות אחת לשנה או עם כל שינוי משמעותי באתר.',
      lastAudit: 'סקר נגישות אחרון: נובמבר 2025',
      nextAudit: 'סקר נגישות מתוכנן הבא: נובמבר 2026'
    }
  } : {
    title: 'Accessibility Statement',
    lastUpdated: 'Last Updated: November 6, 2025',
    
    commitment: {
      title: 'BetterChoice Commitment to Accessibility',
      paragraphs: [
        'BetterChoice is committed to making our website and services accessible to all people, including individuals with disabilities.',
        'We work to fully implement accessibility regulations in accordance with the Equal Rights for Persons with Disabilities Law, 1998, and the Equal Rights for Persons with Disabilities Regulations (Accessibility Adjustments to Service), 2013.'
      ]
    },

    standards: {
      title: 'Standards and Guidelines',
      intro: 'Our website complies with the following standards:',
      items: [
        'Israeli Standard 5568 for Web Content Accessibility at Level AA',
        'WCAG 2.1 (Web Content Accessibility Guidelines) Level AA',
        'Accessibility to Service Regulations (2013)',
        'Equal Rights for Persons with Disabilities Law (1998)'
      ]
    },

    features: {
      title: 'Accessibility Features on Our Site',
      mandatory: 'Mandatory Features:',
      mandatoryItems: [
        'Font size adjustment - increase up to 200%',
        'Contrast adjustment - normal, high, invert colors',
        'Full keyboard navigation',
        'Screen reader support',
        'Link highlighting',
        'Stop animations',
        'Readable font',
        'Large cursor'
      ],
      additional: 'Additional Features:',
      additionalItems: [
        'Dark/Light mode to reduce eye strain',
        'Full support for Hebrew and English',
        'Floating accessibility button on every page',
        'User preference persistence',
        'Heading highlighting for easy navigation',
        'Responsive design for different devices'
      ]
    },

    implementation: {
      title: 'Accessibility Implementation',
      date: 'Last accessibility audit: November 2025',
      items: [
        'Automated accessibility testing using axe and WAVE tools',
        'Manual testing with screen readers (NVDA, JAWS)',
        'Keyboard-only navigation testing',
        'Color contrast verification',
        'Development team documentation and training'
      ]
    },

    known: {
      title: 'Known Accessibility Limitations',
      intro: 'We continuously work to improve accessibility. Current known limitations:',
      items: [
        'Some third-party content (videos, embedded files) may be in the process of adaptation',
        'Some older images are in the process of adding alternative descriptions',
        'New features are tested for accessibility before publication'
      ]
    },

    contact: {
      title: 'Contact Regarding Accessibility',
      intro: 'If you encountered an accessibility issue on our site, or have a suggestion for improvement, we\'d love to hear from you:',
      coordinator: 'Accessibility Coordinator: BetterChoice',
      email: 'Email:',
      emailAddress: 'info@betterchoice.live',
      response: 'Response time: Within 5 business days',
      note: 'When contacting, please include: the browser you\'re using, description of the issue, and link to the relevant page.'
    },

    complaints: {
      title: 'Complaints Procedure',
      intro: 'If you are not satisfied with how your inquiry was handled, you may contact:',
      commissioner: 'Commission for Equal Rights of Persons with Disabilities',
      ministry: 'Ministry of Justice',
      phone: 'Phone: 02-6467011',
      email: 'Email: sar@justice.gov.il',
      website: 'Website: www.justice.gov.il/Units/NetzivutShivyon',
      note: 'The complaint will be reviewed and you will receive a response according to Ministry of Justice procedures.'
    },

    updates: {
      title: 'Updates and Improvements',
      text: 'We continue to improve website accessibility on an ongoing basis. This statement will be updated at least once a year or with any significant site changes.',
      lastAudit: 'Last accessibility audit: November 2025',
      nextAudit: 'Next planned accessibility audit: November 2026'
    }
  };

  return (
    <div className={`min-h-screen ${themeClasses.bgPrimary}`} dir={direction}>
      <Navigation />
      
      <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`text-3xl sm:text-4xl font-bold ${themeClasses.textPrimary} mb-3`}>
            ♿ {content.title}
          </h1>
          <p className={`text-sm ${themeClasses.textSecondary} italic`}>
            {content.lastUpdated}
          </p>
        </div>

        {/* Commitment Section */}
        <section className={`${themeClasses.bgCard} rounded-xl p-6 sm:p-8 mb-6 shadow-md`}>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4 flex items-center gap-2`}>
            <span>✓</span>
            {content.commitment.title}
          </h2>
          {content.commitment.paragraphs.map((para, idx) => (
            <p key={idx} className={`${themeClasses.textSecondary} mb-3 leading-relaxed`}>
              {para}
            </p>
          ))}
        </section>

        {/* Standards Section */}
        <section className={`${themeClasses.bgCard} rounded-xl p-6 sm:p-8 mb-6 shadow-md`}>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>
            📜 {content.standards.title}
          </h2>
          <p className={`${themeClasses.textSecondary} mb-4`}>
            {content.standards.intro}
          </p>
          <ul className={`${direction === 'rtl' ? 'mr-6' : 'ml-6'} space-y-2`}>
            {content.standards.items.map((item, idx) => (
              <li key={idx} className={`${themeClasses.textSecondary} flex items-start gap-2`}>
                <span className="text-emerald-600 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Features Section */}
        <section className={`${themeClasses.bgCard} rounded-xl p-6 sm:p-8 mb-6 shadow-md`}>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>
            ⚙️ {content.features.title}
          </h2>
          
          <h3 className={`text-lg font-semibold ${themeClasses.textPrimary} mb-3 mt-4`}>
            {content.features.mandatory}
          </h3>
          <ul className={`${direction === 'rtl' ? 'mr-6' : 'ml-6'} space-y-2 mb-6`}>
            {content.features.mandatoryItems.map((item, idx) => (
              <li key={idx} className={`${themeClasses.textSecondary} flex items-start gap-2`}>
                <span className="text-red-600 font-bold">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <h3 className={`text-lg font-semibold ${themeClasses.textPrimary} mb-3`}>
            {content.features.additional}
          </h3>
          <ul className={`${direction === 'rtl' ? 'mr-6' : 'ml-6'} space-y-2`}>
            {content.features.additionalItems.map((item, idx) => (
              <li key={idx} className={`${themeClasses.textSecondary} flex items-start gap-2`}>
                <span className="text-emerald-600 font-bold">+</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Implementation Section */}
        <section className={`${themeClasses.bgCard} rounded-xl p-6 sm:p-8 mb-6 shadow-md`}>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>
            🔍 {content.implementation.title}
          </h2>
          <p className={`${themeClasses.textSecondary} mb-4 font-medium`}>
            {content.implementation.date}
          </p>
          <ul className={`${direction === 'rtl' ? 'mr-6' : 'ml-6'} space-y-2`}>
            {content.implementation.items.map((item, idx) => (
              <li key={idx} className={`${themeClasses.textSecondary} flex items-start gap-2`}>
                <span className="text-blue-600 font-bold">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Known Limitations Section */}
        <section className={`${themeClasses.bgCard} rounded-xl p-6 sm:p-8 mb-6 shadow-md`}>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>
            ⚠️ {content.known.title}
          </h2>
          <p className={`${themeClasses.textSecondary} mb-4`}>
            {content.known.intro}
          </p>
          <ul className={`${direction === 'rtl' ? 'mr-6' : 'ml-6'} space-y-2`}>
            {content.known.items.map((item, idx) => (
              <li key={idx} className={`${themeClasses.textSecondary} flex items-start gap-2`}>
                <span className="text-yellow-600 font-bold">⚠</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Contact Section */}
        <section className={`${themeClasses.bgCard} rounded-xl p-6 sm:p-8 mb-6 shadow-md border-2 border-emerald-500`}>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>
            📧 {content.contact.title}
          </h2>
          <p className={`${themeClasses.textSecondary} mb-4`}>
            {content.contact.intro}
          </p>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 space-y-2">
            <p className={`${themeClasses.textPrimary} font-semibold`}>
              {content.contact.coordinator}
            </p>
            <p className={themeClasses.textSecondary}>
              <strong>{content.contact.email}</strong>{' '}
              <a 
                href="mailto:info@betterchoice.live"
                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 underline font-medium"
              >
                {content.contact.emailAddress}
              </a>
            </p>
            <p className={themeClasses.textSecondary}>
              {content.contact.phone}
            </p>
            <p className={`${themeClasses.textSecondary} text-sm font-medium text-emerald-700 dark:text-emerald-400`}>
              {content.contact.response}
            </p>
            <p className={`${themeClasses.textSecondary} text-sm italic mt-3`}>
              {content.contact.note}
            </p>
          </div>
        </section>

        {/* Complaints Section */}
        <section className={`${themeClasses.bgCard} rounded-xl p-6 sm:p-8 mb-6 shadow-md`}>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>
            ⚖️ {content.complaints.title}
          </h2>
          <p className={`${themeClasses.textSecondary} mb-4`}>
            {content.complaints.intro}
          </p>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
            <p className={`${themeClasses.textPrimary} font-semibold`}>
              {content.complaints.commissioner}
            </p>
            <p className={themeClasses.textSecondary}>
              {content.complaints.ministry}
            </p>
            <p className={themeClasses.textSecondary}>
              {content.complaints.phone}
            </p>
            <p className={themeClasses.textSecondary}>
              {content.complaints.email}
            </p>
            <p className={themeClasses.textSecondary}>
              {content.complaints.website}
            </p>
            <p className={`${themeClasses.textSecondary} text-sm italic mt-3`}>
              {content.complaints.note}
            </p>
          </div>
        </section>

        {/* Updates Section */}
        <section className={`${themeClasses.bgCard} rounded-xl p-6 sm:p-8 mb-8 shadow-md`}>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>
            🔄 {content.updates.title}
          </h2>
          <p className={`${themeClasses.textSecondary} mb-3 leading-relaxed`}>
            {content.updates.text}
          </p>
          <div className="space-y-1 mt-4">
            <p className={`${themeClasses.textSecondary} text-sm`}>
              <strong>{content.updates.lastAudit}</strong>
            </p>
            <p className={`${themeClasses.textSecondary} text-sm`}>
              <strong>{content.updates.nextAudit}</strong>
            </p>
          </div>
        </section>

        {/* Back to Home Link */}
        <div className="text-center">
          <Link 
            to="/"
            className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold text-lg"
          >
            <svg 
              className={`w-5 h-5 ${direction === 'rtl' ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M10 19l-7-7m0 0l7-7m-7 7h18" 
              />
            </svg>
            {language === 'hebrew' ? 'חזרה לעמוד הבית' : 'Back to Home'}
          </Link>
        </div>
      </main>
    </div>
  );
};

export default AccessibilityStatementPage;

