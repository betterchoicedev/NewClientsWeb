import { useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import * as CookieConsent from 'vanilla-cookieconsent';
import 'vanilla-cookieconsent/dist/cookieconsent.css';

const CookieConsentComponent = () => {
  const { language } = useLanguage();

  useEffect(() => {
    // Expose CookieConsent to window for external access
    window.CookieConsent = CookieConsent;
    
    // Determine the language to use
    const cookieLanguage = language === 'hebrew' ? 'he' : 'en';
    
    // Initialize CookieConsent
    CookieConsent.run({
      cookie: {
        name: 'cc_cookie',
        domain: window.location.hostname,
        path: '/',
        sameSite: "Lax",
        expiresAfterDays: 365
      },
      guiOptions: {
        consentModal: {
          layout: "box",
          position: "bottom right",
          equalWeightButtons: true,
          flipButtons: false
        },
        preferencesModal: {
          layout: "box",
          position: "right",
          equalWeightButtons: true,
          flipButtons: false
        }
      },
      categories: {
        necessary: {
          readOnly: true
        },
        analytics: {
          autoClear: {
            cookies: [
              {
                name: /^(_ga|_gid)/
              }
            ]
          }
        }
      },
      language: {
        default: cookieLanguage,
        autoDetect: "browser",
        translations: {
          he: {
            consentModal: {
              title: "אנחנו משתמשים בעוגיות",
              description: "אנו משתמשים בעוגיות כדי להבטיח שאתה מקבל את החוויה הטובה ביותר באתר שלנו. עוגיות אלו עוזרות לנו לשפר את השירות ולהבין כיצד המשתמשים משתמשים באתר.",
              acceptAllBtn: "קבל הכל",
              acceptNecessaryBtn: "דחה הכל",
              showPreferencesBtn: "נהל העדפות",
              footer: `
                <a href="/privacy-policy">מדיניות פרטיות</a>
                <a href="/terms">תנאי שימוש</a>
                <div style="margin-top: 10px;">
                  <button type="button" id="cc-lang-toggle-he" style="background: none; border: none; color: inherit; text-decoration: underline; cursor: pointer; font-size: 0.9em;">English</button>
                </div>
              `
            },
            preferencesModal: {
              title: "העדפות עוגיות",
              acceptAllBtn: "קבל הכל",
              acceptNecessaryBtn: "דחה הכל",
              savePreferencesBtn: "שמור העדפות",
              closeIconLabel: "סגור",
              serviceCounterLabel: "שירות|שירותים",
              sections: [
                {
                  title: "שימוש בעוגיות",
                  description: "אנו משתמשים בעוגיות כדי להבטיח את הפונקציונליות הבסיסית של האתר ולשפר את חווית המשתמש שלך. אתה יכול לבחור כל קטגוריה כדי להסכים או לסרב. למידע נוסף על עוגיות ונתונים רגישים אחרים."
                },
                {
                  title: "עוגיות הכרחיות",
                  description: "עוגיות אלו חיוניות לתפקוד תקין של האתר ואינן ניתנות לביטול.",
                  linkedCategory: "necessary"
                },
                {
                  title: "עוגיות אנליטיות",
                  description: "עוגיות אלו עוזרות לנו להבין כיצד מבקרים משתמשים באתר שלנו על ידי איסוף וניתוח נתונים אנונימיים.",
                  linkedCategory: "analytics",
                  cookieTable: {
                    headers: {
                      name: "שם",
                      domain: "דומיין",
                      description: "תיאור",
                      expiration: "תפוגה"
                    },
                    body: [
                      {
                        name: "_ga",
                        domain: window.location.hostname,
                        description: "Google Analytics - מזהה משתמשים",
                        expiration: "שנתיים"
                      },
                      {
                        name: "_gid",
                        domain: window.location.hostname,
                        description: "Google Analytics - מזהה סשן",
                        expiration: "24 שעות"
                      }
                    ]
                  }
                },
                {
                  title: "מידע נוסף",
                  description: 'לכל שאלה בנוגע למדיניות העוגיות שלנו והבחירות שלך, אנא <a class="cc__link" href="mailto:info@betterchoice.live">צור קשר</a>.'
                }
              ]
            }
          },
          en: {
            consentModal: {
              title: "We use cookies",
              description: "We use cookies to ensure you get the best experience on our website. These cookies help us improve our service and understand how users interact with our site.",
              acceptAllBtn: "Accept all",
              acceptNecessaryBtn: "Reject all",
              showPreferencesBtn: "Manage preferences",
              footer: `
                <a href="/privacy-policy">Privacy Policy</a>
                <a href="/terms">Terms of Service</a>
                <div style="margin-top: 10px;">
                  <button type="button" id="cc-lang-toggle-en" style="background: none; border: none; color: inherit; text-decoration: underline; cursor: pointer; font-size: 0.9em;">עברית</button>
                </div>
              `
            },
            preferencesModal: {
              title: "Cookie Preferences",
              acceptAllBtn: "Accept all",
              acceptNecessaryBtn: "Reject all",
              savePreferencesBtn: "Save preferences",
              closeIconLabel: "Close",
              serviceCounterLabel: "Service|Services",
              sections: [
                {
                  title: "Cookie Usage",
                  description: "We use cookies to ensure the basic functionalities of the website and to enhance your online experience. You can choose for each category to opt-in/out whenever you want. For more details about cookies and other sensitive data."
                },
                {
                  title: "Strictly Necessary Cookies",
                  description: "These cookies are essential for the proper functioning of the website and cannot be disabled.",
                  linkedCategory: "necessary"
                },
                {
                  title: "Analytics Cookies",
                  description: "These cookies help us understand how visitors interact with our website by collecting and reporting anonymous information.",
                  linkedCategory: "analytics",
                  cookieTable: {
                    headers: {
                      name: "Name",
                      domain: "Domain",
                      description: "Description",
                      expiration: "Expiration"
                    },
                    body: [
                      {
                        name: "_ga",
                        domain: window.location.hostname,
                        description: "Google Analytics - User identifier",
                        expiration: "2 years"
                      },
                      {
                        name: "_gid",
                        domain: window.location.hostname,
                        description: "Google Analytics - Session identifier",
                        expiration: "24 hours"
                      }
                    ]
                  }
                },
                {
                  title: "More information",
                  description: 'For any queries in relation to our policy on cookies and your choices, please <a class="cc__link" href="mailto:info@betterchoice.live">contact us</a>.'
                }
              ]
            }
          }
        }
      }
    });

    // Add event listener for language toggle after CookieConsent loads
    const setupLanguageToggle = () => {
      setTimeout(() => {
        // Hebrew to English toggle
        const heToggle = document.getElementById('cc-lang-toggle-he');
        if (heToggle && !heToggle.hasAttribute('data-listener')) {
          heToggle.setAttribute('data-listener', 'true');
          heToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            CookieConsent.setLanguage('en');
          });
        }

        // English to Hebrew toggle
        const enToggle = document.getElementById('cc-lang-toggle-en');
        if (enToggle && !enToggle.hasAttribute('data-listener')) {
          enToggle.setAttribute('data-listener', 'true');
          enToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            CookieConsent.setLanguage('he');
          });
        }
      }, 200);
    };

    // Initial setup
    setupLanguageToggle();

    // Re-attach listeners when modal opens/changes
    const observer = new MutationObserver(() => {
      setupLanguageToggle();
    });

    // Observe the consent modal
    setTimeout(() => {
      const consentModal = document.getElementById('cc-main');
      if (consentModal) {
        observer.observe(consentModal, { 
          childList: true, 
          subtree: true,
          attributes: true
        });
      }
    }, 100);

    // Update CookieConsent language when site language changes
    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, []);

  // Update cookie consent language when site language changes
  useEffect(() => {
    const cookieLanguage = language === 'hebrew' ? 'he' : 'en';
    if (window.CookieConsent && typeof window.CookieConsent.setLanguage === 'function') {
      try {
        window.CookieConsent.setLanguage(cookieLanguage);
        console.log('Cookie consent language updated to:', cookieLanguage);
      } catch (error) {
        console.error('Error updating cookie consent language:', error);
      }
    }
  }, [language]);

  return null;
};

export default CookieConsentComponent;

