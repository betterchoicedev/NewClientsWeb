import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import * as CookieConsent from 'vanilla-cookieconsent';
import Navigation from '../components/Navigation';
import { supabase, supabaseSecondary } from '../supabase/supabaseClient';

function HomePage() {
  const { language, direction, toggleLanguage, t } = useLanguage();
  const { user, isAuthenticated, userDisplayName, loading } = useAuth();
  const { isDarkMode, toggleTheme, themeClasses } = useTheme();
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  const [commitmentPeriod, setCommitmentPeriod] = useState(3);
  const [showUSD, setShowUSD] = useState(false);
  
  // Contact form state
  const [contactForm, setContactForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    message: ''
  });
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);

  // Format price based on currency
  const formatPrice = (priceILS, priceUSD) => {
    if (showUSD) {
      return `$${Math.round(priceUSD / 100)}`;
    } else {
      return `₪${Math.round(priceILS / 100)}`;
    }
  };

  // Handle plan selection - redirect to login if not authenticated
  const handlePlanSelect = (planType) => {
    if (!isAuthenticated) {
      // Redirect to login page
      window.location.href = '/login';
    } else {
      // Handle plan selection for authenticated users
      // You can add plan selection logic here
      console.log(`Selected plan: ${planType}`);
    }
  };


  // Contact form handlers
  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setContactForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingContact(true);

    try {
      // Normalize phone number if provided (remove spaces and dashes)
      const normalizedPhone = contactForm.phone ? contactForm.phone.replace(/[\s\-\(\)\.]/g, '') : null;
      
      // Send directly to Supabase
      const { data, error } = await supabase
        .from('contact_messages')
        .insert([
          {
            full_name: contactForm.fullName,
            email: contactForm.email,
            phone: normalizedPhone,
            message: contactForm.message,
            user_agent: navigator.userAgent,
            created_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw new Error('Failed to save message');
      }

      alert(language === 'hebrew' ? 
        'הודעתך נשלחה בהצלחה! נחזור אליך בהקדם.' : 
        'Your message has been sent successfully! We will get back to you soon.'
      );
      
      // Reset form
      setContactForm({
        fullName: '',
        email: '',
        phone: '',
        message: ''
      });

    } catch (error) {
      console.error('Error sending contact message:', error);
      alert(language === 'hebrew' ? 
        'שגיאה בשליחת ההודעה. אנא נסה שוב או צור קשר בטלפון.' : 
        'Error sending message. Please try again or contact us by phone.'
      );
    } finally {
      setIsSubmittingContact(false);
    }
  };

  // Prevent body scrolling to avoid double scrollbars
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div className={`min-h-screen ${themeClasses.bgPrimary} language-transition language-text-transition flex flex-col`} dir={direction} style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar" style={{ minHeight: 0 }}>
        {/* Hero Section */}
        <section data-tour="hero-section" className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold ${themeClasses.textPrimary} mb-4 sm:mb-6`}>
              <span className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">{t.hero.welcome}</span>
              <br />
              <span className="bg-gradient-to-r from-green-500 to-teal-600 bg-clip-text text-transparent">{t.hero.subtitle}</span>
              <br />
              <span className="bg-gradient-to-r from-green-500 to-teal-600 bg-clip-text text-transparent">{t.hero.description}</span>
              <br />
              <span className="bg-gradient-to-r from-purple-500 to-orange-600 bg-clip-text text-transparent">{t.hero.mainDescription}</span>
            </h2>
            <p className={`text-base sm:text-lg md:text-xl lg:text-2xl ${themeClasses.textSecondary} mb-6 sm:mb-8 md:mb-10 leading-relaxed px-2`}>
              {t.hero.fullDescription}
            </p>
            <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8 md:mb-10">
              {t.hero.features.map((feature, index) => (
                <div key={index} className="flex items-start px-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  <p className={`text-sm sm:text-base md:text-lg ${themeClasses.textSecondary} text-left`}>{feature}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-6 sm:mb-8 px-2">
              <button 
                onClick={() => {
                  if (!isAuthenticated) {
                    window.location.href = '/login';
                  } else {
                    // Handle authenticated user action
                    console.log('User is authenticated - handle join today action');
                  }
                }}
                className={`${themeClasses.btnPrimary} text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full text-base sm:text-lg font-semibold transform hover:-translate-y-1 transition-all duration-300 ${themeClasses.shadowCard} ${themeClasses.shadowHover} flex items-center justify-center w-full sm:w-auto`}
              >
                <span className="mr-2">✨</span>
                {t.hero.buttons.joinToday}
                <span className="ml-2">←</span>
              </button>
              <button 
                onClick={() => {
                  alert(language === 'hebrew' ? 'תכונה זו נמצאת בפיתוח - בקרוב!' : 'This feature is currently in development - coming soon!');
                }}
                className={`border-2 border-gray-400 ${isDarkMode ? 'text-gray-400 hover:bg-gray-600 hover:text-white' : 'text-gray-500 hover:bg-gray-500 hover:text-white'} px-6 sm:px-8 py-3 sm:py-4 rounded-full text-base sm:text-lg font-semibold transition-all duration-300 flex items-center justify-center relative w-full sm:w-auto`}
              >
                <span className="mr-2">🏋️</span>
                {t.hero.buttons.joinGym}
                <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                  {language === 'hebrew' ? 'בפיתוח' : 'Dev'}
                </span>
              </button>
            </div>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6 md:gap-8 px-2">
              <div className="flex items-center">
                <span className="text-red-500 mr-2 text-lg sm:text-base">❤️</span>
                <span className={`${themeClasses.textSecondary} text-xs sm:text-sm md:text-base`}>{t.hero.footer.satisfiedClients}</span>
              </div>
              <div className="flex items-center">
                <span className="text-yellow-500 mr-2 text-lg sm:text-base">✨</span>
                <span className={`${themeClasses.textSecondary} text-xs sm:text-sm md:text-base`}>{t.hero.footer.beginJourney}</span>
              </div>
              <div className="flex items-center">
                <span className="text-green-500 mr-2 text-lg sm:text-base">✅</span>
                <span className={`${themeClasses.textSecondary} text-xs sm:text-sm md:text-base`}>{t.hero.footer.verifiedSuccess}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Pain Section */}
        <section className={`py-12 sm:py-16 md:py-20 ${themeClasses.sectionBg}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12 md:mb-16">
              <h3 className={`text-2xl sm:text-3xl md:text-4xl font-bold ${themeClasses.textPrimary} mb-3 sm:mb-4`}>
                <span className="text-blue-500">We see</span> <span className="text-white">your pain</span>
              </h3>
              <p className={`text-base sm:text-lg md:text-xl ${themeClasses.textSecondary} max-w-3xl mx-auto px-2`}>
                {t.painSection.subtitle}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mb-8 sm:mb-12 md:mb-16">
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                <div className="flex items-center mb-4">
                  <div className="w-16 h-16 bg-teal-500 rounded-full flex items-center justify-center mr-4">
                    <span className="text-white font-bold text-xl">{t.painSection.challenges.unbalancedNutrition.percentage}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-xl font-bold ${themeClasses.textPrimary}`}>{t.painSection.challenges.unbalancedNutrition.title}</h4>
                  </div>
                  <div className="text-orange-500 text-2xl">🍽️</div>
                </div>
                <p className={themeClasses.textSecondary}>{t.painSection.challenges.unbalancedNutrition.description}</p>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                <div className="flex items-center mb-4">
                  <div className="w-16 h-16 bg-teal-500 rounded-full flex items-center justify-center mr-4">
                    <span className="text-white font-bold text-xl">{t.painSection.challenges.lackOfMotivation.percentage}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-xl font-bold ${themeClasses.textPrimary}`}>{t.painSection.challenges.lackOfMotivation.title}</h4>
                  </div>
                  <div className="text-red-500 text-2xl">🎯</div>
                </div>
                <p className={themeClasses.textSecondary}>{t.painSection.challenges.lackOfMotivation.description}</p>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                <div className="flex items-center mb-4">
                  <div className="w-16 h-16 bg-teal-500 rounded-full flex items-center justify-center mr-4">
                    <span className="text-white font-bold text-xl">{t.painSection.challenges.noTimeForWorkouts.percentage}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-xl font-bold ${themeClasses.textPrimary}`}>{t.painSection.challenges.noTimeForWorkouts.title}</h4>
                  </div>
                  <div className="text-yellow-500 text-2xl">⏰</div>
                </div>
                <p className={themeClasses.textSecondary}>{t.painSection.challenges.noTimeForWorkouts.description}</p>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                <div className="flex items-center mb-4">
                  <div className="w-16 h-16 bg-teal-500 rounded-full flex items-center justify-center mr-4">
                    <span className="text-white font-bold text-xl">{t.painSection.challenges.noResults.percentage}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-xl font-bold ${themeClasses.textPrimary}`}>{t.painSection.challenges.noResults.title}</h4>
                  </div>
                  <div className="text-blue-500 text-2xl">❌</div>
                </div>
                <p className={themeClasses.textSecondary}>{t.painSection.challenges.noResults.description}</p>
              </div>
            </div>
            
            <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-8 mb-16`}>
              <div className="text-center">
                <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4 flex items-center justify-center`}>
                  <span className="text-yellow-500 mr-2">⏰</span>
                  {t.painSection.frustration.title}
                </h4>
                <p className={`text-lg ${themeClasses.textSecondary} mb-4`}>
                  {t.painSection.frustration.description}
                </p>
                <p className={`text-xl font-bold text-blue-500 mb-6`}>
                  {t.painSection.frustration.callToAction}
                </p>
                <div className="flex justify-center items-center space-x-8 space-x-reverse">
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-red-500 rounded-full mr-2"></div>
                    <span className={themeClasses.textSecondary}>{t.painSection.frustration.legend.frustration}</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-yellow-500 rounded-full mr-2"></div>
                    <span className={themeClasses.textSecondary}>{t.painSection.frustration.legend.hope}</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-teal-500 rounded-full mr-2"></div>
                    <span className={themeClasses.textSecondary}>{t.painSection.frustration.legend.results}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
              <div className="text-center">
                <div className={`text-3xl sm:text-4xl font-bold ${isDarkMode ? 'text-red-400' : 'text-red-600'} mb-2`}>
                  {t.painSection.statistics.dietFailure.percentage}
                </div>
                <p className={themeClasses.textSecondary}>{t.painSection.statistics.dietFailure.description}</p>
                <p className={`text-sm ${themeClasses.textMuted} mt-2`}>{t.painSection.statistics.dietFailure.source}</p>
                <a 
                  href="https://doi.org/10.1056/NEJMoa1800389" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-emerald-500 hover:text-emerald-400 text-sm flex items-center justify-center mt-2 transition-colors duration-300"
                >
                  {t.painSection.statistics.dietFailure.link} ↗️
                </a>
              </div>
              <div className="text-center">
                <div className={`text-4xl font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'} mb-2`}>
                  {t.painSection.statistics.motivationLoss.percentage}
                </div>
                <p className={themeClasses.textSecondary}>{t.painSection.statistics.motivationLoss.description}</p>
                <p className={`text-sm ${themeClasses.textMuted} mt-2`}>{t.painSection.statistics.motivationLoss.source}</p>
                <a 
                  href="https://pubmed.ncbi.nlm.nih.gov/7707624/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-emerald-500 hover:text-emerald-400 text-sm flex items-center justify-center mt-2 transition-colors duration-300"
                >
                  {t.painSection.statistics.motivationLoss.link} ↗️
                </a>
              </div>
              <div className="text-center">
                <div className={`text-4xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'} mb-2`}>
                  {t.painSection.statistics.noWorkoutTime.percentage}
                </div>
                <p className={themeClasses.textSecondary}>{t.painSection.statistics.noWorkoutTime.description}</p>
                <p className={`text-sm ${themeClasses.textMuted} mt-2`}>{t.painSection.statistics.noWorkoutTime.source}</p>
                <a 
                  href="https://doi.org/10.1016/S1389-9457%2802%2900016-3" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-emerald-500 hover:text-emerald-400 text-sm flex items-center justify-center mt-2 transition-colors duration-300"
                >
                  {t.painSection.statistics.noWorkoutTime.link} ↗️
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section data-tour="features-section" className={`py-20 ${themeClasses.bgSecondary}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h3 className={`text-4xl font-bold ${themeClasses.textPrimary} mb-4`}>
                {t.features.title}
              </h3>
              <p className={`text-xl ${themeClasses.textSecondary} max-w-3xl mx-auto`}>
                {t.features.subtitle}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-8 ${themeClasses.shadowHover} transition-shadow duration-300 hover:-translate-y-2`}>
                <div className="text-center">
                  <div className="text-6xl mb-6">🍎</div>
                  <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>{t.features.nutrition.title}</h4>
                  <p className={`${themeClasses.textSecondary} leading-relaxed`}>
                    {t.features.nutrition.description}
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-8 ${themeClasses.shadowHover} transition-shadow duration-300 hover:-translate-y-2`}>
                <div className="text-center">
                  <div className="text-6xl mb-6">💪</div>
                  <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>{t.features.fitness.title}</h4>
                  <p className={`${themeClasses.textSecondary} leading-relaxed`}>
                    {t.features.fitness.description}
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-8 ${themeClasses.shadowHover} transition-shadow duration-300 hover:-translate-y-2`}>
                <div className="text-center">
                  <div className="text-6xl mb-6">📊</div>
                  <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>{t.features.tracking.title}</h4>
                  <p className={`${themeClasses.textSecondary} leading-relaxed`}>
                    {t.features.tracking.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Athletes & Professionals Section */}
        <section className={`py-12 sm:py-16 md:py-20 ${themeClasses.sectionBg}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12 md:mb-16">
              <h3 className={`text-2xl sm:text-3xl md:text-4xl font-bold ${themeClasses.textPrimary} mb-3 sm:mb-4`}>
                {t.athletesSection.title}
              </h3>
              <p className={`text-base sm:text-lg md:text-xl ${themeClasses.textSecondary} max-w-3xl mx-auto px-2`}>
                {t.athletesSection.subtitle}
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8 mb-8 sm:mb-12 md:mb-16">
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                <div className="text-center mb-4">
                  <div className="text-4xl mb-4">🔗</div>
                  <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.athletesSection.features.advancedNutrition.title}</h4>
                  <p className={`${themeClasses.textSecondary} mb-4`}>{t.athletesSection.features.advancedNutrition.description}</p>
                  <div className={`text-2xl font-bold text-green-500`}>{t.athletesSection.features.advancedNutrition.metric}</div>
                </div>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                <div className="text-center mb-4">
                  <div className="text-4xl mb-4">📈</div>
                  <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.athletesSection.features.performanceTracking.title}</h4>
                  <p className={`${themeClasses.textSecondary} mb-4`}>{t.athletesSection.features.performanceTracking.description}</p>
                  <div className={`text-2xl font-bold text-green-500`}>{t.athletesSection.features.performanceTracking.metric}</div>
                </div>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                <div className="text-center mb-4">
                  <div className="text-4xl mb-4">👥</div>
                  <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.athletesSection.features.professionalSupport.title}</h4>
                  <p className={`${themeClasses.textSecondary} mb-4`}>{t.athletesSection.features.professionalSupport.description}</p>
                  <div className={`text-2xl font-bold text-green-500`}>{t.athletesSection.features.professionalSupport.metric}</div>
                </div>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                <div className="text-center mb-4">
                  <div className="text-4xl mb-4">🏆</div>
                  <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.athletesSection.features.competitionPrograms.title}</h4>
                  <p className={`${themeClasses.textSecondary} mb-4`}>{t.athletesSection.features.competitionPrograms.description}</p>
                  <div className={`text-2xl font-bold text-green-500`}>{t.athletesSection.features.competitionPrograms.metric}</div>
                </div>
              </div>
            </div>
            
            <div className="text-center mb-16">
              <h4 className={`text-3xl font-bold ${themeClasses.textPrimary} mb-8`}>{t.athletesSection.whyChooseUs.title}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                  <div className="text-4xl mb-4">🧠</div>
                  <h5 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.athletesSection.whyChooseUs.reasons.scientificKnowledge.title}</h5>
                  <p className={themeClasses.textSecondary}>{t.athletesSection.whyChooseUs.reasons.scientificKnowledge.description}</p>
                </div>
                <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                  <div className="text-4xl mb-4">⚙️</div>
                  <h5 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.athletesSection.whyChooseUs.reasons.fullPersonalization.title}</h5>
                  <p className={themeClasses.textSecondary}>{t.athletesSection.whyChooseUs.reasons.fullPersonalization.description}</p>
                </div>
                <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                  <div className="text-4xl mb-4">💭</div>
                  <h5 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.athletesSection.whyChooseUs.reasons.mentalSupport.title}</h5>
                  <p className={themeClasses.textSecondary}>{t.athletesSection.whyChooseUs.reasons.mentalSupport.description}</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mr-4">
                    <span className="text-white font-bold text-lg">{t.athletesSection.testimonials.david.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h5 className={`font-bold ${themeClasses.textPrimary}`}>{t.athletesSection.testimonials.david.name}</h5>
                    <p className={`${themeClasses.textSecondary} text-sm`}>{t.athletesSection.testimonials.david.profession}</p>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} italic mb-4`}>
                  "{t.athletesSection.testimonials.david.quote}"
                </p>
                <div className={`text-lg font-bold text-green-500`}>{t.athletesSection.testimonials.david.metric}</div>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mr-4">
                    <span className="text-white font-bold text-lg">{t.athletesSection.testimonials.sarah.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h5 className={`font-bold ${themeClasses.textPrimary}`}>{t.athletesSection.testimonials.sarah.name}</h5>
                    <p className={`${themeClasses.textSecondary} text-sm`}>{t.athletesSection.testimonials.sarah.profession}</p>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} italic mb-4`}>
                  "{t.athletesSection.testimonials.sarah.quote}"
                </p>
                <div className={`text-lg font-bold text-green-500`}>{t.athletesSection.testimonials.sarah.metric}</div>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-green-500 to-teal-600 rounded-xl p-8 text-white text-center relative">
              <div className="absolute top-4 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                {language === 'hebrew' ? 'בפיתוח' : 'In Development'}
              </div>
              <h4 className="text-3xl font-bold mb-4">{t.athletesSection.callToAction.title}</h4>
              <p className="text-xl mb-6">{t.athletesSection.callToAction.subtitle}</p>
              <button 
                onClick={() => {
                  alert(language === 'hebrew' ? 'תכנית הספורטאים נמצאת בפיתוח - בקרוב!' : 'Athlete Program is currently in development - coming soon!');
                }}
                className="bg-white text-green-600 px-8 py-4 rounded-full text-lg font-semibold hover:bg-gray-100 transition-colors duration-300 mb-4 opacity-75 cursor-not-allowed"
              >
                {t.athletesSection.callToAction.button}
              </button>
              <p className="text-sm opacity-80">{t.athletesSection.callToAction.details}</p>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className={`py-12 sm:py-16 md:py-20 ${themeClasses.sectionBg}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12 md:mb-16">
              <h3 className={`text-2xl sm:text-3xl md:text-4xl font-bold ${themeClasses.textPrimary} mb-3 sm:mb-4`}>{t.services.title}</h3>
              <p className={`text-base sm:text-lg md:text-xl ${themeClasses.textSecondary} max-w-3xl mx-auto px-2`}>
                {t.services.subtitle}
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 ${themeClasses.shadowHover} transition-shadow duration-300`}>
                <div className="text-4xl mb-4">🥗</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.services.nutrition.title}</h4>
                <p className={themeClasses.textSecondary}>{t.services.nutrition.description}</p>
              </div>
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 ${themeClasses.shadowHover} transition-shadow duration-300`}>
                <div className="text-4xl mb-4">🏃‍♂️</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.services.training.title}</h4>
                <p className={themeClasses.textSecondary}>{t.services.training.description}</p>
              </div>
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 ${themeClasses.shadowHover} transition-shadow duration-300`}>
                <div className="text-4xl mb-4">🧘‍♀️</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.services.mental.title}</h4>
                <p className={themeClasses.textSecondary}>{t.services.mental.description}</p>
              </div>
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 ${themeClasses.shadowHover} transition-shadow duration-300`}>
                <div className="text-4xl mb-4">📱</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.services.app.title}</h4>
                <p className={themeClasses.textSecondary}>{t.services.app.description}</p>
              </div>
            </div>
          </div>
        </section>


        {/* About Section */}
        <section className={`py-20 ${themeClasses.bgSecondary}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className={`text-4xl font-bold ${themeClasses.textPrimary} mb-6`}>{t.about.title}</h3>
                <p className={`text-lg ${themeClasses.textSecondary} mb-6 leading-relaxed`}>
                  {t.about.description1}
                </p>
                <p className={`text-lg ${themeClasses.textSecondary} mb-8 leading-relaxed`}>
                  {t.about.description2}
                </p>
                <div className="flex flex-wrap gap-4">
                  {t.about.features.map((feature, index) => (
                    <div key={index} className="flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                      <span className={themeClasses.textPrimary}>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`${isDarkMode ? 'bg-gradient-to-br from-gray-700 to-gray-800' : 'bg-gradient-to-br from-indigo-100 to-purple-100'} rounded-2xl p-8`}>
                <div className="text-center">
                  <div className="text-6xl mb-6">🏆</div>
                  <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>{t.about.achievements.title}</h4>
                  <div className="space-y-4">
                    <div className={`${themeClasses.bgCard} rounded-lg p-4 ${themeClasses.shadowCard}`}>
                      <div className={`text-3xl font-bold ${isDarkMode ? 'text-emerald-400' : 'text-indigo-600'}`}>15,000+</div>
                      <div className={themeClasses.textSecondary}>{t.about.achievements.clients}</div>
                    </div>
                    <div className={`${themeClasses.bgCard} rounded-lg p-4 ${themeClasses.shadowCard}`}>
                      <div className={`text-3xl font-bold ${isDarkMode ? 'text-emerald-400' : 'text-indigo-600'}`}>98%</div>
                      <div className={themeClasses.textSecondary}>{t.about.achievements.success}</div>
                    </div>
                    <div className={`${themeClasses.bgCard} rounded-lg p-4 ${themeClasses.shadowCard}`}>
                      <div className={`text-3xl font-bold ${isDarkMode ? 'text-emerald-400' : 'text-indigo-600'}`}>5+</div>
                      <div className={themeClasses.textSecondary}>{t.about.achievements.experience}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className={`py-20 ${themeClasses.sectionBg}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h3 className={`text-4xl font-bold ${themeClasses.textPrimary} mb-4`}>{t.testimonials.title}</h3>
              <p className={`text-xl ${themeClasses.textSecondary}`}>{t.testimonials.subtitle}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                <div className="flex items-center mb-4">
                  <div className={`w-12 h-12 ${isDarkMode ? 'bg-gray-700' : 'bg-indigo-100'} rounded-full flex items-center justify-center mr-4`}>
                    <span className={`${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} font-bold text-lg`}>{t.testimonials.sarah.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h5 className={`font-bold ${themeClasses.textPrimary}`}>{t.testimonials.sarah.name}</h5>
                    <p className={`${themeClasses.textSecondary} text-sm`}>{t.testimonials.sarah.location}</p>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} italic`}>
                  "{t.testimonials.sarah.text}"
                </p>
                <div className="flex text-yellow-400 mt-4">
                  ⭐⭐⭐⭐⭐
                </div>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                <div className="flex items-center mb-4">
                  <div className={`w-12 h-12 ${isDarkMode ? 'bg-gray-700' : 'bg-indigo-100'} rounded-full flex items-center justify-center mr-4`}>
                    <span className={`${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} font-bold text-lg`}>{t.testimonials.michael.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h5 className={`font-bold ${themeClasses.textPrimary}`}>{t.testimonials.michael.name}</h5>
                    <p className={`${themeClasses.textSecondary} text-sm`}>{t.testimonials.michael.location}</p>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} italic`}>
                  "{t.testimonials.michael.text}"
                </p>
                <div className="flex text-yellow-400 mt-4">
                  ⭐⭐⭐⭐⭐
                </div>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                <div className="flex items-center mb-4">
                  <div className={`w-12 h-12 ${isDarkMode ? 'bg-gray-700' : 'bg-indigo-100'} rounded-full flex items-center justify-center mr-4`}>
                    <span className={`${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} font-bold text-lg`}>{t.testimonials.rachel.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h5 className={`font-bold ${themeClasses.textPrimary}`}>{t.testimonials.rachel.name}</h5>
                    <p className={`${themeClasses.textSecondary} text-sm`}>{t.testimonials.rachel.location}</p>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} italic`}>
                  "{t.testimonials.rachel.text}"
                </p>
                <div className="flex text-yellow-400 mt-4">
                  ⭐⭐⭐⭐⭐
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section data-tour="pricing-section" className={`py-20 ${themeClasses.bgSecondary}`} id="know-your-numbers">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h3 className={`text-4xl font-bold ${themeClasses.textPrimary} mb-4`}>
                {language === 'hebrew' ? 'תוכניות המנוי שלנו' : 'Our Subscription Plans'}
              </h3>
              <p className={`text-xl ${themeClasses.textSecondary} mb-8`}>
                {language === 'hebrew' ? 'בחר את התוכנית המתאימה לך' : 'Choose the plan that fits you best'}
              </p>
              
              {/* Toggle Controls */}
              <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-8 sm:mb-12`}>
                {/* Commitment Toggle */}
                <div className={`${themeClasses.bgCard} rounded-2xl p-2 border-2 ${themeClasses.borderPrimary} w-full sm:w-auto`}>
                  <div className="flex">
                    <button 
                      onClick={() => setCommitmentPeriod && setCommitmentPeriod(3)}
                      className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 ${
                        (commitmentPeriod || 3) === 3 
                          ? 'bg-emerald-500 text-white shadow-lg' 
                          : `${themeClasses.textSecondary} hover:${themeClasses.textPrimary}`
                      }`}
                    >
                      {language === 'hebrew' ? '3 חודשים' : '3 Months'}
                    </button>
                    <button 
                      onClick={() => setCommitmentPeriod && setCommitmentPeriod(6)}
                      className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 relative ${
                        (commitmentPeriod || 3) === 6 
                          ? 'bg-emerald-500 text-white shadow-lg' 
                          : `${themeClasses.textSecondary} hover:${themeClasses.textPrimary}`
                      }`}
                    >
                      {language === 'hebrew' ? '6 חודשים' : '6 Months'}
                      <span className="absolute -top-2 -right-2 bg-orange-400 text-white text-xs px-2 py-1 rounded-full">
                        {language === 'hebrew' ? 'חסכון' : 'Save'}
                      </span>
                    </button>
                  </div>
                </div>
                
                {/* Currency Toggle */}
                <div className={`${themeClasses.bgCard} rounded-2xl p-2 border-2 ${themeClasses.borderPrimary} w-full sm:w-auto`}>
                  <div className="flex">
                    <button 
                      onClick={() => setShowUSD(false)}
                      className={`flex-1 sm:flex-none px-4 py-2 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 ${
                        !showUSD 
                          ? 'bg-blue-500 text-white shadow-lg' 
                          : `${themeClasses.textSecondary} hover:${themeClasses.textPrimary}`
                      }`}
                    >
                      ₪ ILS
                    </button>
                    <button 
                      onClick={() => setShowUSD(true)}
                      className={`flex-1 sm:flex-none px-4 py-2 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 ${
                        showUSD 
                          ? 'bg-blue-500 text-white shadow-lg' 
                          : `${themeClasses.textSecondary} hover:${themeClasses.textPrimary}`
                      }`}
                    >
                      $ USD
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {/* Basic Plan - Nutrition Only */}
              <div className={`${themeClasses.bgCard} border-2 ${themeClasses.borderPrimary} rounded-xl p-6 md:p-8 hover:border-emerald-500 transition-colors duration-300`}>
                <div className="text-center">
                  <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>
                    {language === 'hebrew' ? 'בסיסי' : 'Basic'}
                  </h4>
                  <div className={`text-4xl font-bold ${themeClasses.textPrimary} mb-6`}>
                    {formatPrice(58000, 16600)}
                    <span className={`text-lg ${themeClasses.textSecondary}`}>
                      {language === 'hebrew' ? '/חודש' : '/month'}
                    </span>
                  </div>
                  <ul className="space-y-3 mb-8 text-right" dir={language === 'hebrew' ? 'rtl' : 'ltr'}>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-3">✓</span>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'תוכניות ארוחות מותאמות' : 'Custom meal plans'}
                      </span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-3">✓</span>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'ניתוח תזונתי' : 'Nutritional analysis'}
                      </span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-3">✓</span>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'מעקב התקדמות' : 'Progress tracking'}
                      </span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-3">✓</span>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'תמיכה במייל' : 'Email support'}
                      </span>
                    </li>
                  </ul>
                  <button 
                    onClick={() => handlePlanSelect('basic')}
                    className={`w-full ${themeClasses.btnSecondary} py-3 rounded-lg font-semibold transition-colors duration-300`}
                  >
                    {language === 'hebrew' ? 'בחר תוכנית' : 'Select Plan'}
                  </button>
                </div>
              </div>
              
              {/* Professional Plan - Nutrition + Training */}
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-6 md:p-8 text-white relative mt-8 md:mt-0">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-sm font-bold">
                    {language === 'hebrew' ? 'הכי פופולרי' : 'Most Popular'}
                  </span>
                </div>
                <div className="text-center">
                  <h4 className="text-2xl font-bold mb-4">
                    {language === 'hebrew' ? 'מקצועי' : 'Professional'}
                  </h4>
                  <div className="text-4xl font-bold mb-6">
                    {formatPrice(83000, 23700)}
                    <span className="text-lg opacity-80">
                      {language === 'hebrew' ? '/חודש' : '/month'}
                    </span>
                  </div>
                  <ul className="space-y-3 mb-8 text-right" dir={language === 'hebrew' ? 'rtl' : 'ltr'}>
                    <li className="flex items-center">
                      <span className="text-green-300 mr-3">✓</span>
                      <span>{language === 'hebrew' ? 'כל מה שיש בבסיסי +' : 'Everything in Basic +'}</span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-300 mr-3">✓</span>
                      <span>{language === 'hebrew' ? 'תוכניות אימון מותאמות' : 'Custom workout plans'}</span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-300 mr-3">✓</span>
                      <span>{language === 'hebrew' ? 'תמיכת מאמן אישי' : 'Personal trainer support'}</span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-300 mr-3">✓</span>
                      <span>{language === 'hebrew' ? 'מפגשים חודשיים' : 'Monthly sessions'}</span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-300 mr-3">✓</span>
                      <span>{language === 'hebrew' ? 'תמיכה בצ׳אט' : 'Chat support'}</span>
                    </li>
                  </ul>
                  <button 
                    onClick={() => handlePlanSelect('professional')}
                    className="w-full bg-white text-emerald-600 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors duration-300"
                  >
                    {language === 'hebrew' ? 'בחר תוכנית' : 'Select Plan'}
                  </button>
                </div>
              </div>
              
              {/* Premium Plan - BetterPro with commitment pricing */}
              <div className={`${themeClasses.bgCard} border-2 border-purple-500 rounded-xl p-6 md:p-8 hover:border-purple-400 transition-colors duration-300 relative overflow-hidden`}>
                <div className="absolute top-0 right-0 bg-purple-500 text-white px-3 py-1 text-xs font-bold">
                  {language === 'hebrew' ? 'פרימיום' : 'Premium'}
                </div>
                <div className="text-center">
                  <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>
                    {language === 'hebrew' ? 'BetterPro' : 'BetterPro'}
                  </h4>
                  <div className={`mb-6`}>
                    <div className={`text-4xl font-bold ${themeClasses.textPrimary}`}>
                      {(commitmentPeriod || 3) === 3 
                        ? formatPrice(68000, 19400) 
                        : formatPrice(60000, 17100)
                      }
                    </div>
                    <span className={`text-lg ${themeClasses.textSecondary}`}>
                      {language === 'hebrew' ? '/חודש' : '/month'}
                    </span>
                    {(commitmentPeriod || 3) === 6 && (
                      <div className="text-sm text-green-500 font-semibold mt-1">
                        {language === 'hebrew' 
                          ? (showUSD ? 'חסכון של $23 לחודש' : 'חסכון של ₪80 לחודש')
                          : (showUSD ? 'Save $23/month' : 'Save ₪80/month')
                        }
                      </div>
                    )}
                  </div>
                  <ul className="space-y-3 mb-8 text-right" dir={language === 'hebrew' ? 'rtl' : 'ltr'}>
                    <li className="flex items-center">
                      <span className="text-purple-500 mr-3">✓</span>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'כל מה שיש במקצועי +' : 'Everything in Professional +'}
                      </span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-purple-500 mr-3">✓</span>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'תכנון ארוחות מתקדם' : 'Advanced meal planning'}
                      </span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-purple-500 mr-3">✓</span>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'תמיכה בעדיפות' : 'Priority support'}
                      </span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-purple-500 mr-3">✓</span>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'מפגשים שבועיים' : 'Weekly sessions'}
                      </span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-purple-500 mr-3">✓</span>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'גישה לכל התכונות' : 'Access to all features'}
                      </span>
                    </li>
                  </ul>
                  <div className={`text-xs ${themeClasses.textMuted} mb-4`}>
                    {language === 'hebrew' 
                      ? `התחייבות ל-${(commitmentPeriod || 3)} חודשים` 
                      : `${(commitmentPeriod || 3)}-month commitment`
                    }
                  </div>
                  <button 
                    onClick={() => handlePlanSelect('betterpro')}
                    className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all duration-300 shadow-lg"
                  >
                    {language === 'hebrew' ? 'בחר תוכנית' : 'Select Plan'}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="text-center mt-12">
              <p className={`${themeClasses.textMuted} text-sm`}>
                {language === 'hebrew' 
                  ? 'כל התוכניות כוללות אפשרות ביטול בכל עת' 
                  : 'All plans include cancellation option at any time'
                }
              </p>
            </div>
          </div>
        </section>


        {/* Stats Section */}
        <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-r from-emerald-600 to-teal-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8 text-center">
              <div className="text-white">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-1 sm:mb-2">15K+</div>
                <div className="text-sm sm:text-base md:text-xl opacity-90">{t.stats.users}</div>
              </div>
              <div className="text-white">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-1 sm:mb-2">98%</div>
                <div className="text-sm sm:text-base md:text-xl opacity-90">{t.stats.success}</div>
              </div>
              <div className="text-white">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-1 sm:mb-2">24/7</div>
                <div className="text-sm sm:text-base md:text-xl opacity-90">{t.stats.support}</div>
              </div>
              <div className="text-white">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-1 sm:mb-2">50+</div>
                <div className="text-sm sm:text-base md:text-xl opacity-90">{t.stats.experts}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Learning Library Section */}
        <section className={`py-20 ${themeClasses.bgPrimary}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h3 className={`text-4xl font-bold ${themeClasses.textPrimary} mb-4`}>{t.learning.title}</h3>
              <p className={`text-xl ${themeClasses.textSecondary}`}>{t.learning.subtitle}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 ${themeClasses.shadowHover} transition-shadow duration-300 relative`}>
                <div className="absolute top-4 right-4 bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                  {language === 'hebrew' ? 'בקרוב' : 'Soon'}
                </div>
                <div className="text-4xl mb-4">📚</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.learning.nutrition.title}</h4>
                <p className={`${themeClasses.textSecondary} mb-4`}>{t.learning.nutrition.description}</p>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${themeClasses.textMuted}`}>{t.learning.nutrition.lessons}</span>
                  <button 
                    onClick={() => {
                      alert(language === 'hebrew' ? 'שיעורי התזונה יגיעו בקרוב!' : 'Nutrition lessons coming soon!');
                    }}
                    className="bg-gray-400 text-white px-4 py-2 rounded-lg text-sm transition-colors duration-300 opacity-75 cursor-not-allowed"
                  >
                    {language === 'hebrew' ? 'בקרוב' : 'Coming Soon'}
                  </button>
                </div>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 ${themeClasses.shadowHover} transition-shadow duration-300 relative`}>
                <div className="absolute top-4 right-4 bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                  {language === 'hebrew' ? 'בקרוב' : 'Soon'}
                </div>
                <div className="text-4xl mb-4">🏃‍♀️</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.learning.fitness.title}</h4>
                <p className={`${themeClasses.textSecondary} mb-4`}>{t.learning.fitness.description}</p>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${themeClasses.textMuted}`}>{t.learning.fitness.lessons}</span>
                  <button 
                    onClick={() => {
                      alert(language === 'hebrew' ? 'שיעורי הכושר יגיעו בקרוב!' : 'Fitness lessons coming soon!');
                    }}
                    className="bg-gray-400 text-white px-4 py-2 rounded-lg text-sm transition-colors duration-300 opacity-75 cursor-not-allowed"
                  >
                    {language === 'hebrew' ? 'בקרוב' : 'Coming Soon'}
                  </button>
                </div>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 ${themeClasses.shadowHover} transition-shadow duration-300 relative`}>
                <div className="absolute top-4 right-4 bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                  {language === 'hebrew' ? 'בקרוב' : 'Soon'}
                </div>
                <div className="text-4xl mb-4">🧠</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.learning.mental.title}</h4>
                <p className={`${themeClasses.textSecondary} mb-4`}>{t.learning.mental.description}</p>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${themeClasses.textMuted}`}>{t.learning.mental.lessons}</span>
                  <button 
                    onClick={() => {
                      alert(language === 'hebrew' ? 'שיעורי הבריאות הנפשית יגיעו בקרוב!' : 'Mental health lessons coming soon!');
                    }}
                    className="bg-gray-400 text-white px-4 py-2 rounded-lg text-sm transition-colors duration-300 opacity-75 cursor-not-allowed"
                  >
                    {language === 'hebrew' ? 'בקרוב' : 'Coming Soon'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Discussion Center Section */}
        <section className={`py-20 ${themeClasses.bgSecondary}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h3 className={`text-4xl font-bold ${themeClasses.textPrimary} mb-4`}>{t.discussion.title}</h3>
              <p className={`text-xl ${themeClasses.textSecondary}`}>{t.discussion.subtitle}</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className={`${themeClasses.bgCard} rounded-xl p-6`}>
                <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>{t.discussion.forums.title}</h4>
                <div className="space-y-4">
                  <div className={`${themeClasses.bgSecondary} rounded-lg p-4 ${themeClasses.shadowCard}`}>
                    <h5 className={`font-semibold ${themeClasses.textPrimary}`}>{t.discussion.forums.nutrition.title}</h5>
                    <p className={`${themeClasses.textSecondary} text-sm`}>{t.discussion.forums.nutrition.stats}</p>
                  </div>
                  <div className={`${themeClasses.bgSecondary} rounded-lg p-4 ${themeClasses.shadowCard}`}>
                    <h5 className={`font-semibold ${themeClasses.textPrimary}`}>{t.discussion.forums.fitness.title}</h5>
                    <p className={`${themeClasses.textSecondary} text-sm`}>{t.discussion.forums.fitness.stats}</p>
                  </div>
                  <div className={`${themeClasses.bgSecondary} rounded-lg p-4 ${themeClasses.shadowCard}`}>
                    <h5 className={`font-semibold ${themeClasses.textPrimary}`}>{t.discussion.forums.mental.title}</h5>
                    <p className={`${themeClasses.textSecondary} text-sm`}>{t.discussion.forums.mental.stats}</p>
                  </div>
                </div>
              </div>
              
              <div className={`${isDarkMode ? 'bg-gradient-to-br from-gray-700 to-gray-800' : 'bg-gradient-to-br from-indigo-50 to-purple-50'} rounded-xl p-6`}>
                <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>{t.discussion.recent.title}</h4>
                <div className="space-y-4">
                  <div className={`${themeClasses.bgCard} rounded-lg p-4 ${themeClasses.shadowCard}`}>
                    <div className="flex items-center mb-2">
                      <div className={`w-8 h-8 ${isDarkMode ? 'bg-gray-700' : 'bg-indigo-100'} rounded-full flex items-center justify-center mr-3`}>
                        <span className={`${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} font-bold text-sm`}>{t.discussion.recent.sarah.name.charAt(0)}</span>
                      </div>
                      <div>
                        <div className={`font-semibold ${themeClasses.textPrimary} text-sm`}>{t.discussion.recent.sarah.name}</div>
                        <div className={`${themeClasses.textMuted} text-xs`}>{t.discussion.recent.sarah.time}</div>
                      </div>
                    </div>
                    <p className={`${themeClasses.textSecondary} text-sm`}>"{t.discussion.recent.sarah.message}"</p>
                  </div>
                  <div className={`${themeClasses.bgCard} rounded-lg p-4 ${themeClasses.shadowCard}`}>
                    <div className="flex items-center mb-2">
                      <div className={`w-8 h-8 ${isDarkMode ? 'bg-gray-700' : 'bg-indigo-100'} rounded-full flex items-center justify-center mr-3`}>
                        <span className={`${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} font-bold text-sm`}>{t.discussion.recent.michael.name.charAt(0)}</span>
                      </div>
                      <div>
                        <div className={`font-semibold ${themeClasses.textPrimary} text-sm`}>{t.discussion.recent.michael.name}</div>
                        <div className={`${themeClasses.textMuted} text-xs`}>{t.discussion.recent.michael.time}</div>
                      </div>
                    </div>
                    <p className={`${themeClasses.textSecondary} text-sm`}>"{t.discussion.recent.michael.message}"</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Action Plan Board Section */}
        <section className={`py-20 ${themeClasses.sectionBg}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h3 className={`text-4xl font-bold ${themeClasses.textPrimary} mb-4`}>{t.actionPlan.title}</h3>
              <p className={`text-xl ${themeClasses.textSecondary}`}>{t.actionPlan.subtitle}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                <div className="text-center mb-6">
                  <div className={`w-16 h-16 ${isDarkMode ? 'bg-red-900' : 'bg-red-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <span className="text-red-600 text-2xl">🎯</span>
                  </div>
                  <h4 className={`text-xl font-bold ${themeClasses.textPrimary}`}>{t.actionPlan.weekly.title}</h4>
                </div>
                <div className="space-y-3">
                  {t.actionPlan.weekly.goals.map((goal, index) => (
                    <div key={index} className={`flex items-center justify-between p-3 ${themeClasses.bgSecondary} rounded-lg`}>
                      <span className={themeClasses.textSecondary}>{goal}</span>
                      <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                <div className="text-center mb-6">
                  <div className={`w-16 h-16 ${isDarkMode ? 'bg-blue-900' : 'bg-blue-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <span className="text-blue-600 text-2xl">📅</span>
                  </div>
                  <h4 className={`text-xl font-bold ${themeClasses.textPrimary}`}>{t.actionPlan.monthly.title}</h4>
                </div>
                <div className="space-y-3">
                  <div className={`p-3 ${isDarkMode ? 'bg-blue-900' : 'bg-blue-50'} rounded-lg`}>
                    <div className={`font-semibold ${themeClasses.textPrimary} text-sm`}>{t.actionPlan.monthly.week1.period}</div>
                    <div className={`${themeClasses.textSecondary} text-sm`}>{t.actionPlan.monthly.week1.task}</div>
                  </div>
                  <div className={`p-3 ${isDarkMode ? 'bg-blue-900' : 'bg-blue-50'} rounded-lg`}>
                    <div className={`font-semibold ${themeClasses.textPrimary} text-sm`}>{t.actionPlan.monthly.week3.period}</div>
                    <div className={`${themeClasses.textSecondary} text-sm`}>{t.actionPlan.monthly.week3.task}</div>
                  </div>
                </div>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                <div className="text-center mb-6">
                  <div className={`w-16 h-16 ${isDarkMode ? 'bg-green-900' : 'bg-green-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <span className="text-green-600 text-2xl">📊</span>
                  </div>
                  <h4 className={`text-xl font-bold ${themeClasses.textPrimary}`}>{t.actionPlan.progress.title}</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className={themeClasses.textSecondary}>{t.actionPlan.progress.weight}</span>
                    <span className="font-bold text-green-600">-3 ק"ג</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={themeClasses.textSecondary}>{t.actionPlan.progress.workouts}</span>
                    <span className="font-bold text-blue-600">12/15</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={themeClasses.textSecondary}>{t.actionPlan.progress.water}</span>
                    <span className="font-bold text-indigo-600">85%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Private Messages Section */}
        <section className={`py-20 ${themeClasses.bgSecondary}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h3 className={`text-4xl font-bold ${themeClasses.textPrimary} mb-4`}>{t.messages.title}</h3>
              <p className={`text-xl ${themeClasses.textSecondary}`}>{t.messages.subtitle}</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className={`${isDarkMode ? 'bg-gradient-to-br from-gray-700 to-gray-800' : 'bg-gradient-to-br from-indigo-50 to-purple-50'} rounded-xl p-8`}>
                <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-6`}>{t.messages.guides.title}</h4>
                <div className="space-y-4">
                  <div className={`${themeClasses.bgCard} rounded-lg p-4 ${themeClasses.shadowCard} flex items-center`}>
                    <div className={`w-12 h-12 ${isDarkMode ? 'bg-gray-700' : 'bg-indigo-100'} rounded-full flex items-center justify-center mr-4`}>
                      <span className={`${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} font-bold`}>{t.messages.guides.ronit.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1">
                      <div className={`font-semibold ${themeClasses.textPrimary}`}>{t.messages.guides.ronit.name}</div>
                      <div className={`${themeClasses.textSecondary} text-sm`}>{t.messages.guides.ronit.specialty}</div>
                    </div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <div className={`${themeClasses.bgCard} rounded-lg p-4 ${themeClasses.shadowCard} flex items-center`}>
                    <div className={`w-12 h-12 ${isDarkMode ? 'bg-gray-700' : 'bg-indigo-100'} rounded-full flex items-center justify-center mr-4`}>
                      <span className={`${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} font-bold`}>{t.messages.guides.alon.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1">
                      <div className={`font-semibold ${themeClasses.textPrimary}`}>{t.messages.guides.alon.name}</div>
                      <div className={`${themeClasses.textSecondary} text-sm`}>{t.messages.guides.alon.specialty}</div>
                    </div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <div className={`${themeClasses.bgCard} rounded-lg p-4 ${themeClasses.shadowCard} flex items-center`}>
                    <div className={`w-12 h-12 ${isDarkMode ? 'bg-gray-700' : 'bg-indigo-100'} rounded-full flex items-center justify-center mr-4`}>
                      <span className={`${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} font-bold`}>{t.messages.guides.yael.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1">
                      <div className={`font-semibold ${themeClasses.textPrimary}`}>{t.messages.guides.yael.name}</div>
                      <div className={`${themeClasses.textSecondary} text-sm`}>{t.messages.guides.yael.specialty}</div>
                    </div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  </div>
                </div>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-8`}>
                <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-6`}>{t.messages.recentMessages.title}</h4>
                <div className="space-y-4">
                  <div className="border-l-4 border-indigo-500 pl-4">
                    <div className={`font-semibold ${themeClasses.textPrimary}`}>{t.messages.recentMessages.ronit.name}</div>
                    <div className={`${themeClasses.textMuted} text-sm mb-2`}>{t.messages.recentMessages.ronit.time}</div>
                    <p className={themeClasses.textSecondary}>"{t.messages.recentMessages.ronit.message}"</p>
                  </div>
                  <div className="border-l-4 border-blue-500 pl-4">
                    <div className={`font-semibold ${themeClasses.textPrimary}`}>{t.messages.recentMessages.alon.name}</div>
                    <div className={`${themeClasses.textMuted} text-sm mb-2`}>{t.messages.recentMessages.alon.time}</div>
                    <p className={themeClasses.textSecondary}>"{t.messages.recentMessages.alon.message}"</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    alert(language === 'hebrew' ? 
                      'לשליחת הודעה, אנא פנה לבוט שלנו בווטסאפ!' : 
                      'To send a message, please contact our WhatsApp bot!'
                    );
                  }}
                  className={`w-full mt-6 bg-gradient-to-r from-green-500 to-teal-600 text-white py-3 rounded-lg font-semibold transition-colors duration-300 hover:from-green-600 hover:to-teal-700 flex items-center justify-center`}
                >
                  <span className="mr-2">📱</span>
                  {language === 'hebrew' ? 'שלח הודעה בווטסאפ' : 'Send Message via WhatsApp'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Celebrations Section */}
        <section className={`py-20 ${isDarkMode ? 'bg-gradient-to-r from-gray-800 to-gray-900' : 'bg-gradient-to-r from-yellow-50 to-orange-50'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h3 className={`text-4xl font-bold ${themeClasses.textPrimary} mb-4`}>{t.celebrations.title}</h3>
              <p className={`text-xl ${themeClasses.textSecondary}`}>{t.celebrations.subtitle}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 ${themeClasses.shadowHover} transition-shadow duration-300`}>
                <div className="flex items-center mb-4">
                  <div className={`w-12 h-12 ${isDarkMode ? 'bg-yellow-900' : 'bg-yellow-100'} rounded-full flex items-center justify-center mr-4`}>
                    <span className="text-yellow-600 text-2xl">🎉</span>
                  </div>
                  <div>
                    <div className={`font-bold ${themeClasses.textPrimary}`}>{t.celebrations.sarah.name}</div>
                    <div className={`${themeClasses.textMuted} text-sm`}>{t.celebrations.sarah.time}</div>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} mb-4`}>"{t.celebrations.sarah.message}"</p>
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2 space-x-reverse">
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                  </div>
                  <span className={`${themeClasses.textMuted} text-sm`}>{t.celebrations.sarah.comments}</span>
                </div>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 ${themeClasses.shadowHover} transition-shadow duration-300`}>
                <div className="flex items-center mb-4">
                  <div className={`w-12 h-12 ${isDarkMode ? 'bg-green-900' : 'bg-green-100'} rounded-full flex items-center justify-center mr-4`}>
                    <span className="text-green-600 text-2xl">🏃‍♂️</span>
                  </div>
                  <div>
                    <div className={`font-bold ${themeClasses.textPrimary}`}>{t.celebrations.michael.name}</div>
                    <div className={`${themeClasses.textMuted} text-sm`}>{t.celebrations.michael.time}</div>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} mb-4`}>"{t.celebrations.michael.message}"</p>
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2 space-x-reverse">
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                  </div>
                  <span className={`${themeClasses.textMuted} text-sm`}>{t.celebrations.michael.comments}</span>
                </div>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 ${themeClasses.shadowHover} transition-shadow duration-300`}>
                <div className="flex items-center mb-4">
                  <div className={`w-12 h-12 ${isDarkMode ? 'bg-blue-900' : 'bg-blue-100'} rounded-full flex items-center justify-center mr-4`}>
                    <span className="text-blue-600 text-2xl">💪</span>
                  </div>
                  <div>
                    <div className={`font-bold ${themeClasses.textPrimary}`}>{t.celebrations.rachel.name}</div>
                    <div className={`${themeClasses.textMuted} text-sm`}>{t.celebrations.rachel.time}</div>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} mb-4`}>"{t.celebrations.rachel.message}"</p>
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2 space-x-reverse">
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                  </div>
                  <span className={`${themeClasses.textMuted} text-sm`}>{t.celebrations.rachel.comments}</span>
                </div>
              </div>
            </div>
            
            <div className="text-center mt-12">
              <button 
                onClick={() => {
                  alert(language === 'hebrew' ? 'תכונת שיתוף ההישגים תגיע בקרוב!' : 'Achievement sharing feature coming soon!');
                }}
                className={`bg-gray-400 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300 shadow-lg opacity-75 cursor-not-allowed relative`}
              >
                <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                  {language === 'hebrew' ? 'בקרוב' : 'Soon'}
                </span>
                {language === 'hebrew' ? 'שיתוף הישגים - בקרוב' : 'Share Achievement - Coming Soon'}
              </button>
            </div>
          </div>
        </section>

        {/* Resources Section */}
        <section className={`py-20 ${themeClasses.sectionBg}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h3 className={`text-4xl font-bold ${themeClasses.textPrimary} mb-4`}>{t.resources.title}</h3>
              <p className={`text-xl ${themeClasses.textSecondary}`}>{t.resources.subtitle}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 ${themeClasses.shadowHover} transition-shadow duration-300`}>
                <div className="text-4xl mb-4">📋</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.resources.worksheets.title}</h4>
                <p className={`${themeClasses.textSecondary} mb-4`}>{t.resources.worksheets.description}</p>
                <button className={`w-full ${themeClasses.btnPrimary} text-white py-2 rounded-lg font-semibold transition-colors duration-300`}>
                  {t.buttons.download}
                </button>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 ${themeClasses.shadowHover} transition-shadow duration-300`}>
                <div className="text-4xl mb-4">🔗</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.resources.links.title}</h4>
                <p className={`${themeClasses.textSecondary} mb-4`}>{t.resources.links.description}</p>
                <button className={`w-full ${themeClasses.btnPrimary} text-white py-2 rounded-lg font-semibold transition-colors duration-300`}>
                  {t.buttons.viewLinks}
                </button>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 ${themeClasses.shadowHover} transition-shadow duration-300`}>
                <div className="text-4xl mb-4">📱</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.resources.apps.title}</h4>
                <p className={`${themeClasses.textSecondary} mb-4`}>{t.resources.apps.description}</p>
                <button className={`w-full ${themeClasses.btnPrimary} text-white py-2 rounded-lg font-semibold transition-colors duration-300`}>
                  {t.buttons.discoverApps}
                </button>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 ${themeClasses.shadowHover} transition-shadow duration-300`}>
                <div className="text-4xl mb-4">📖</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.resources.books.title}</h4>
                <p className={`${themeClasses.textSecondary} mb-4`}>{t.resources.books.description}</p>
                <button className={`w-full ${themeClasses.btnPrimary} text-white py-2 rounded-lg font-semibold transition-colors duration-300`}>
                  {t.buttons.browseBooks}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Professional Platform Section */}
        <section className={`py-20 ${themeClasses.sectionBg}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h3 className={`text-4xl font-bold ${themeClasses.textPrimary} mb-4`}>
                {t.professionalPlatform.title}
              </h3>
              <h4 className={`text-4xl font-bold ${themeClasses.textPrimary} mb-8`}>
                <span className="text-blue-400">{t.professionalPlatform.subtitle}</span>
              </h4>
            </div>
            
            <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-8 mb-16`}>
              <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-8 text-center`}>{t.professionalPlatform.challenges.title}</h4>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h5 className={`text-xl font-bold text-blue-400 mb-4`}>{t.professionalPlatform.challenges.oldReality.title}</h5>
                  <div className="space-y-3">
                    {t.professionalPlatform.challenges.oldReality.points.map((point, index) => (
                      <div key={index} className="flex items-start">
                        <div className="w-2 h-2 bg-red-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                        <p className={`${themeClasses.textSecondary}`}>{point}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h5 className={`text-xl font-bold text-green-500 mb-4`}>{t.professionalPlatform.challenges.newReality.title}</h5>
                  <div className="space-y-3">
                    {t.professionalPlatform.challenges.newReality.points.map((point, index) => (
                      <div key={index} className="flex items-start">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                        <p className={`${themeClasses.textSecondary}`}>{point}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 text-center`}>
                <div className="text-4xl mb-4">⏰</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.professionalPlatform.benefits.savesTime.title}</h4>
                <p className={themeClasses.textSecondary}>{t.professionalPlatform.benefits.savesTime.description}</p>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 text-center`}>
                <div className="text-4xl mb-4">📈</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.professionalPlatform.benefits.improvesResults.title}</h4>
                <p className={themeClasses.textSecondary}>{t.professionalPlatform.benefits.improvesResults.description}</p>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 text-center`}>
                <div className="text-4xl mb-4">👥</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.professionalPlatform.benefits.expandsAudience.title}</h4>
                <p className={themeClasses.textSecondary}>{t.professionalPlatform.benefits.expandsAudience.description}</p>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 text-center`}>
                <div className="text-4xl mb-4">🎯</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.professionalPlatform.benefits.focusesOnGoals.title}</h4>
                <p className={themeClasses.textSecondary}>{t.professionalPlatform.benefits.focusesOnGoals.description}</p>
              </div>
            </div>
            
            <div className={`bg-gradient-to-r from-blue-500 to-green-500 rounded-xl p-8 mb-16`}>
              <h4 className={`text-3xl font-bold text-white mb-8 text-center`}>{t.professionalPlatform.platform.title}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center">
                  <h5 className={`text-xl font-bold text-blue-200 mb-3`}>{t.professionalPlatform.platform.features.contentCreation.title}</h5>
                  <p className="text-white">{t.professionalPlatform.platform.features.contentCreation.description}</p>
                </div>
                <div className="text-center">
                  <h5 className={`text-xl font-bold text-green-200 mb-3`}>{t.professionalPlatform.platform.features.wideDistribution.title}</h5>
                  <p className="text-white">{t.professionalPlatform.platform.features.wideDistribution.description}</p>
                </div>
                <div className="text-center">
                  <h5 className={`text-xl font-bold text-purple-200 mb-3`}>{t.professionalPlatform.platform.features.performanceTracking.title}</h5>
                  <p className="text-white">{t.professionalPlatform.platform.features.performanceTracking.description}</p>
                </div>
              </div>
            </div>
            
            <div className="text-center mb-8">
              <h4 className={`text-3xl font-bold ${themeClasses.textPrimary} mb-4`}>
                {t.professionalPlatform.callToAction.question}
              </h4>
              <h5 className={`text-3xl font-bold text-blue-400 mb-8`}>
                {t.professionalPlatform.callToAction.highlightedQuestion}
              </h5>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button className={`${themeClasses.btnPrimary} text-white px-8 py-4 rounded-full text-lg font-semibold transform hover:-translate-y-1 transition-all duration-300 ${themeClasses.shadowCard} ${themeClasses.shadowHover} flex items-center justify-center`}>
                  <span className="mr-2">←</span>
                  {t.professionalPlatform.callToAction.buttons.requestDemo}
                </button>
                <button className={`border-2 border-blue-500 ${isDarkMode ? 'text-blue-400 hover:bg-blue-500 hover:text-white' : 'text-blue-500 hover:bg-blue-500 hover:text-white'} px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300 flex items-center justify-center`}>
                  <span className="mr-2">🎯</span>
                  {t.professionalPlatform.callToAction.buttons.contactUs}
                </button>
              </div>
            </div>
            
            <div className="text-center">
              <p className={`${themeClasses.textSecondary} text-sm`}>{t.professionalPlatform.footer}</p>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className={`py-12 sm:py-16 md:py-20 ${themeClasses.bgSecondary}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12 md:mb-16">
              <h3 className={`text-2xl sm:text-3xl md:text-4xl font-bold ${themeClasses.textPrimary} mb-3 sm:mb-4`}>{t.contact.title}</h3>
              <p className={`text-base sm:text-lg md:text-xl ${themeClasses.textSecondary} px-2`}>{t.contact.subtitle}</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 md:gap-12">
              <div>
                <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-6`}>{t.contact.form.title}</h4>
                <form className="space-y-6" onSubmit={handleContactSubmit}>
                  <div>
                    <label className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>{t.contact.form.fullName}</label>
                    <input 
                      type="text" 
                      name="fullName"
                      value={contactForm.fullName}
                      onChange={handleContactChange}
                      required
                      className={`w-full px-4 py-3 ${themeClasses.bgCard} ${themeClasses.borderPrimary} border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${themeClasses.textPrimary}`} 
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>{t.contact.form.email}</label>
                    <input 
                      type="email" 
                      name="email"
                      value={contactForm.email}
                      onChange={handleContactChange}
                      required
                      className={`w-full px-4 py-3 ${themeClasses.bgCard} ${themeClasses.borderPrimary} border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${themeClasses.textPrimary}`} 
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>{t.contact.form.phone}</label>
                    <input 
                      type="tel" 
                      name="phone"
                      value={contactForm.phone}
                      onChange={handleContactChange}
                      className={`w-full px-4 py-3 ${themeClasses.bgCard} ${themeClasses.borderPrimary} border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${themeClasses.textPrimary}`} 
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>{t.contact.form.message}</label>
                    <textarea 
                      rows="4" 
                      name="message"
                      value={contactForm.message}
                      onChange={handleContactChange}
                      required
                      className={`w-full px-4 py-3 ${themeClasses.bgCard} ${themeClasses.borderPrimary} border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${themeClasses.textPrimary}`}
                    ></textarea>
                  </div>
                  <button 
                    type="submit" 
                    disabled={isSubmittingContact}
                    className={`w-full ${isSubmittingContact ? 'bg-gray-400 cursor-not-allowed' : themeClasses.btnPrimary} text-white py-3 rounded-lg font-semibold transition-all duration-300`}
                  >
                    {isSubmittingContact ? 
                      (language === 'hebrew' ? 'שולח...' : 'Sending...') : 
                      t.buttons.sendMessage
                    }
                  </button>
                </form>
              </div>
              
              <div className="space-y-8">
                <div className={`${themeClasses.bgCard} rounded-xl p-6`}>
                  <h5 className={`text-xl font-bold ${themeClasses.textPrimary} mb-4`}>{t.contact.details.title}</h5>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mr-4">
                        <span className="text-white text-lg">📞</span>
                      </div>
                      <div>
                        <div className={`font-semibold ${themeClasses.textPrimary}`}>{t.contact.details.phone}</div>
                        <div className={themeClasses.textSecondary}>050-2420905</div>
                        <div className={`${themeClasses.textMuted} text-sm`}>{language === 'hebrew' ? 'זמינים א-ה 8:00-18:00' : 'Available Sun-Thu 8:00-18:00'}</div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mr-4">
                        <span className="text-white text-lg">✉️</span>
                      </div>
                      <div>
                        <div className={`font-semibold ${themeClasses.textPrimary}`}>{t.contact.details.email}</div>
                        <div className={themeClasses.textSecondary}>
                          <a href="mailto:info@betterchoice.live" className="hover:text-emerald-600">
                            info@betterchoice.live
                          </a>
                        </div>
                        <div className={`${themeClasses.textMuted} text-sm`}>{language === 'hebrew' ? 'מענה תוך 24 שעות' : 'Response within 24 hours'}</div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mr-4">
                        <span className="text-white text-lg">📍</span>
                      </div>
                      <div>
                        <div className={`font-semibold ${themeClasses.textPrimary}`}>{t.contact.details.address}</div>
                        <div className={themeClasses.textSecondary}>{language === 'hebrew' ? 'משכית 10, הרצליה, ישראל' : 'Maskit 10, Herzliya, Israel'}</div>
                        <div className={`${themeClasses.textMuted} text-sm`}>{language === 'hebrew' ? 'ביקור לפי תיאום מראש' : 'Visit by appointment only'}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className={`${themeClasses.bgCard} rounded-xl p-6`}>
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mr-4">
                      <span className="text-white text-lg">🕒</span>
                    </div>
                    <h5 className={`text-xl font-bold ${themeClasses.textPrimary}`}>{t.contact.hours.title}</h5>
                  </div>
                  <div className={`space-y-2 ${themeClasses.textSecondary}`}>
                    <div className="flex justify-between">
                      <span>{language === 'hebrew' ? 'א-ה' : 'Sun-Thu'}</span>
                      <span>{language === 'hebrew' ? '8:00-18:00' : '8:00-18:00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'hebrew' ? 'ו' : 'Fri'}</span>
                      <span>{language === 'hebrew' ? '8:00-14:00' : '8:00-14:00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'hebrew' ? 'ש' : 'Sat'}</span>
                      <span>{language === 'hebrew' ? 'סגור' : 'Closed'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className={`${themeClasses.footerBg} text-white py-8 sm:py-10 md:py-12`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 md:gap-8 mb-4 md:mb-0 text-center sm:text-left">
                <Link 
                  to="/privacy-policy" 
                  className="text-gray-300 hover:text-white transition-colors duration-300 text-sm sm:text-base"
                >
                  {t.footer.privacy}
                </Link>
                <Link 
                  to="/terms" 
                  className="text-gray-300 hover:text-white transition-colors duration-300 text-sm sm:text-base"
                >
                  {t.footer.terms}
                </Link>
                <button
                  onClick={() => {
                    try {
                      CookieConsent.showPreferences();
                    } catch (error) {
                      console.error('Cookie consent error:', error);
                    }
                  }}
                  className="text-gray-300 hover:text-white transition-colors duration-300 cursor-pointer text-sm sm:text-base"
                >
                  {language === 'hebrew' ? 'הגדרות עוגיות' : 'Cookie Settings'}
                </button>
              </div>
              <div className="text-gray-400 text-center">
                <p className="text-xs sm:text-sm">{t.footer.copyright}</p>
              </div>
            </div>
          </div>
        </footer>
      </main>

    </div>
  );
}

export default HomePage;
