import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import MarketingShell from '../components/brand/MarketingShell';
import { focusClass, titleFont } from '../components/brand/ui';

const sectionClass = 'py-8 first:pt-0 last:pb-0';
const h2Class = 'text-[19px] font-bold text-bc-text mb-4';
const h3Class = 'text-[15px] font-bold text-bc-text mb-3';
const bodyClass = 'text-[15px] leading-relaxed text-bc-text';
const listClass = 'list-disc ps-5 space-y-2 text-[15px] leading-relaxed text-bc-text marker:text-bc-accent';
const wellClass = 'bg-bc-surface2 rounded-bc-field p-4 sm:p-5 space-y-2';
const linkClass = `rounded underline underline-offset-4 text-bc-text decoration-bc-border hover:decoration-bc-accent transition-colors ${focusClass}`;


/**
 * Accessibility Statement Page
 * REQUIRED BY ISRAELI LAW (תקנות נגישות 2013)
 * Must be publicly available on all Israeli websites
 */
const AccessibilityStatementPage = () => {
  const { language, direction } = useLanguage();

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
    <MarketingShell>
      <div id="main-content" className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        {/* Page Header */}
        <h1 className={`text-[32px] sm:text-[40px] leading-tight font-bold text-bc-text text-start ${titleFont(language)}`}>
          {content.title}
        </h1>
        <p className="mt-4 text-[13px] font-semibold text-bc-muted">
          {content.lastUpdated}
        </p>

        <article className="mt-8 bg-bc-surface border border-bc-border rounded-bc-card p-6 sm:p-10 text-start">
          <div className="divide-y divide-bc-border">
            {/* Commitment Section */}
            <section className={sectionClass}>
              <h2 className={h2Class}>
                {content.commitment.title}
              </h2>
              <div className="space-y-3">
                {content.commitment.paragraphs.map((para, idx) => (
                  <p key={idx} className={bodyClass}>
                    {para}
                  </p>
                ))}
              </div>
            </section>

            {/* Standards Section */}
            <section className={sectionClass}>
              <h2 className={h2Class}>
                {content.standards.title}
              </h2>
              <p className={`${bodyClass} mb-4`}>
                {content.standards.intro}
              </p>
              <ul className={listClass}>
                {content.standards.items.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </section>

            {/* Features Section */}
            <section className={sectionClass}>
              <h2 className={h2Class}>
                {content.features.title}
              </h2>

              <h3 className={h3Class}>
                {content.features.mandatory}
              </h3>
              <ul className={`${listClass} mb-6`}>
                {content.features.mandatoryItems.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>

              <h3 className={h3Class}>
                {content.features.additional}
              </h3>
              <ul className={listClass}>
                {content.features.additionalItems.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </section>

            {/* Implementation Section */}
            <section className={sectionClass}>
              <h2 className={h2Class}>
                {content.implementation.title}
              </h2>
              <p className="mb-4 text-[13px] font-semibold text-bc-muted">
                {content.implementation.date}
              </p>
              <ul className={listClass}>
                {content.implementation.items.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </section>

            {/* Known Limitations Section */}
            <section className={sectionClass}>
              <h2 className={h2Class}>
                {content.known.title}
              </h2>
              <p className={`${bodyClass} mb-4`}>
                {content.known.intro}
              </p>
              <ul className={listClass}>
                {content.known.items.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </section>

            {/* Contact Section */}
            <section className={sectionClass}>
              <h2 className={h2Class}>
                {content.contact.title}
              </h2>
              <p className={`${bodyClass} mb-4`}>
                {content.contact.intro}
              </p>
              <div className={wellClass}>
                <p className="text-[15px] font-bold text-bc-text">
                  {content.contact.coordinator}
                </p>
                <p className={bodyClass}>
                  <strong className="font-bold">{content.contact.email}</strong>{' '}
                  <a href="mailto:info@betterchoice.live" className={linkClass}>
                    {content.contact.emailAddress}
                  </a>
                </p>
                <p className={bodyClass}>
                  {content.contact.phone}
                </p>
                <p className="text-[13px] font-semibold text-bc-text">
                  {content.contact.response}
                </p>
                <p className="pt-2 text-[13px] leading-relaxed text-bc-muted">
                  {content.contact.note}
                </p>
              </div>
            </section>

            {/* Complaints Section */}
            <section className={sectionClass}>
              <h2 className={h2Class}>
                {content.complaints.title}
              </h2>
              <p className={`${bodyClass} mb-4`}>
                {content.complaints.intro}
              </p>
              <div className={wellClass}>
                <p className="text-[15px] font-bold text-bc-text">
                  {content.complaints.commissioner}
                </p>
                <p className={bodyClass}>
                  {content.complaints.ministry}
                </p>
                <p className={bodyClass}>
                  {content.complaints.phone}
                </p>
                <p className={bodyClass}>
                  {content.complaints.email}
                </p>
                <p className={bodyClass}>
                  {content.complaints.website}
                </p>
                <p className="pt-2 text-[13px] leading-relaxed text-bc-muted">
                  {content.complaints.note}
                </p>
              </div>
            </section>

            {/* Updates Section */}
            <section className={sectionClass}>
              <h2 className={h2Class}>
                {content.updates.title}
              </h2>
              <p className={bodyClass}>
                {content.updates.text}
              </p>
              <div className="mt-4 space-y-1">
                <p className="text-[13px] font-semibold text-bc-muted">
                  {content.updates.lastAudit}
                </p>
                <p className="text-[13px] font-semibold text-bc-muted">
                  {content.updates.nextAudit}
                </p>
              </div>
            </section>
          </div>
        </article>

        {/* Back to Home Link */}
        <div className="mt-8">
          <Link
            to="/"
            className={`inline-flex items-center gap-2 text-[15px] font-semibold ${linkClass}`}
          >
            <svg
              className={`w-4 h-4 ${direction === 'rtl' ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
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
      </div>
    </MarketingShell>
  );
};

export default AccessibilityStatementPage;
