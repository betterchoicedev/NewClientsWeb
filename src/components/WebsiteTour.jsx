import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const WebsiteTour = () => {
  const { language, direction, toggleLanguage } = useLanguage();
  const { isDarkMode, themeClasses } = useTheme();
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(-1); // -1 = welcome screen, 0+ = tour steps
  const [isOpen, setIsOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [highlightedElement, setHighlightedElement] = useState(null);
  const [tooltipKey, setTooltipKey] = useState(0); // Force re-render on resize
  const highlightRef = useRef(null);

  // Detect which page we're on
  const isHomePage = location.pathname === '/';
  const isProfilePage = location.pathname === '/profile';

  // Handle window resize to reposition tooltip
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      setTooltipKey(prev => prev + 1);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  // Prevent scrolling when tour is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      
      // Prevent scrolling
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Restore scrolling
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // Add keyboard shortcuts to manually trigger tours
  useEffect(() => {
    const handleKeyPress = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        if (e.key === 'T') {
          e.preventDefault();
          // Reset home tour completion and open it
          localStorage.removeItem('websiteTourCompleted');
          setIsOpen(true);
          setShowWelcome(true);
          setCurrentStep(-1);
          console.log('Home tour manually triggered via keyboard shortcut');
        } else if (e.key === 'P') {
          e.preventDefault();
          // Reset profile tour completion and open it
          localStorage.removeItem('profileTourCompleted');
          setIsOpen(true);
          setShowWelcome(true);
          setCurrentStep(-1);
          console.log('Profile tour manually triggered via keyboard shortcut');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Home page tour steps configuration
  const getHomeTourSteps = () => [
    {
      target: 'theme-toggle',
      title: language === 'hebrew' ? 'כפתור מצב כהה/בהיר' : 'Dark/Light Mode Button',
      description: language === 'hebrew'
        ? 'כאן תוכלו להחליף בין מצב כהה למצב בהיר. לחצו על הכפתור כדי לשנות את ערכת הנושא של האתר.'
        : 'Here you can switch between dark and light mode. Click the button to change the website theme.',
      position: 'bottom'
    },
    {
      target: 'language-toggle',
      title: language === 'hebrew' ? 'כפתור שפה' : 'Language Button',
      description: language === 'hebrew'
        ? 'כאן תוכלו להחליף בין עברית לאנגלית. לחצו על הכפתור כדי לשנות את שפת הממשק.'
        : 'Here you can switch between Hebrew and English. Click the button to change the interface language.',
      position: 'bottom'
    },
    {
      target: 'mobile-menu-button',
      title: language === 'hebrew' ? 'כפתור תפריט' : 'Menu Button',
      description: language === 'hebrew'
        ? 'זהו כפתור התפריט. לחצו עליו כדי לפתוח את תפריט הניווט. התפריט יופיע ויאפשר לכם לגשת לכל חלקי האתר.'
        : 'This is the menu button. Click it to open the navigation menu. The menu will appear and allow you to access all parts of the website.',
      position: 'bottom'
    },
    {
      target: 'nav-links',
      title: language === 'hebrew' ? 'קישורי ניווט' : 'Navigation Links',
      description: language === 'hebrew'
        ? 'כאן תוכלו לנווט בין הדפים השונים: בית, ידע והשראה, מתכונים, אודות. השתמשו בתפריט זה כדי לגשת לכל חלקי האתר.'
        : 'Here you can navigate between different pages: Home, Knowledge & Inspiration, Recipes, About. Use this menu to access all parts of the website.',
      position: 'bottom',
      requiresMenu: true
    },
    {
      target: 'nav-home',
      title: language === 'hebrew' ? 'כפתור בית' : 'Home Button',
      description: language === 'hebrew'
        ? 'כפתור זה מוביל לדף הבית הראשי של האתר. כאן תוכלו לראות את כל המידע הכללי על Better Choice, התכונות העיקריות, תוכניות המנוי, ועוד.'
        : 'This button takes you to the main homepage of the website. Here you can see all general information about Better Choice, main features, subscription plans, and more.',
      position: 'bottom',
      requiresMenu: true
    },
    {
      target: 'nav-knowledge',
      title: language === 'hebrew' ? 'כפתור ידע והשראה' : 'Knowledge & Inspiration Button',
      description: language === 'hebrew'
        ? 'כפתור זה מוביל לדף הידע וההשראה. כאן תוכלו למצוא מאמרים, טיפים, ומידע מקצועי על תזונה, כושר, ואורח חיים בריא.'
        : 'This button takes you to the Knowledge & Inspiration page. Here you can find articles, tips, and professional information about nutrition, fitness, and healthy living.',
      position: 'bottom',
      requiresMenu: true
    },
    {
      target: 'nav-recipes',
      title: language === 'hebrew' ? 'כפתור מתכונים' : 'Recipes Button',
      description: language === 'hebrew'
        ? 'כפתור זה מוביל לדף המתכונים. כאן תוכלו למצוא מתכונים בריאים וטעימים, מותאמים אישית לפי המטרות וההעדפות שלכם.'
        : 'This button takes you to the Recipes page. Here you can find healthy and delicious recipes, personalized according to your goals and preferences.',
      position: 'bottom',
      requiresMenu: true
    },
    {
      target: 'nav-about',
      title: language === 'hebrew' ? 'כפתור אודות' : 'About Button',
      description: language === 'hebrew'
        ? 'כפתור זה מוביל לדף האודות. כאן תוכלו ללמוד עוד על Better Choice, הצוות שלנו, המטרות שלנו, והסיפור שלנו.'
        : 'This button takes you to the About page. Here you can learn more about Better Choice, our team, our goals, and our story.',
      position: 'bottom',
      requiresMenu: true
    },
    {
      target: 'auth-buttons',
      title: language === 'hebrew' ? 'כפתורי התחברות והרשמה' : 'Login & Signup Buttons',
      description: language === 'hebrew'
        ? 'כאן תוכלו להתחבר לחשבון הקיים שלכם או להירשם לחשבון חדש. לחצו על "התחבר" כדי להתחבר או על "הרשם" כדי ליצור חשבון חדש.'
        : 'Here you can log in to your existing account or sign up for a new account. Click "Login" to sign in or "Signup" to create a new account.',
      position: 'bottom',
      requiresMenu: true
    }
  ];

  // Check if we're on mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Profile page tour steps configuration
  const getProfileTourSteps = () => {
    // Mobile-specific tour steps
    if (isMobile) {
      return [
        {
          target: 'mobile-menu-button',
          title: language === 'hebrew' ? 'כפתור תפריט' : 'Menu Button',
          description: language === 'hebrew'
            ? 'זהו כפתור התפריט. לחצו עליו כדי לפתוח את תפריט הניווט. התפריט יופיע מהצד ויאפשר לכם לגשת לכל חלקי הפרופיל.'
            : 'This is the menu button. Click it to open the navigation menu. The menu will slide in from the side and allow you to access all parts of your profile.',
          position: 'bottom'
        },
        {
          target: 'profile-tab',
          title: language === 'hebrew' ? 'כרטיסיית פרופיל' : 'Profile Tab',
          description: language === 'hebrew'
            ? 'כאן תוכלו לנהל את הפרטים האישיים שלכם: שם, אימייל, טלפון, תאריך לידה, מיקום, והעדפות בריאות. כל המידע הזה עוזר לנו להתאים את התוכנית שלכם.'
            : 'Here you can manage your personal information: name, email, phone, birth date, location, and health preferences. This information helps us personalize your plan.',
          position: 'right',
          requiresDrawer: true
        },
        {
          target: 'myplan-tab',
          title: language === 'hebrew' ? 'כרטיסיית תוכנית תזונה' : 'Meal Plan Tab',
          description: language === 'hebrew'
            ? 'כאן תוכלו לראות את תוכנית התזונה היומית שלכם. תראו את כל הארוחות, המרכיבים, והערכים התזונתיים. תוכלו גם לערוך את התוכנית ולהוסיף מרכיבים.'
            : 'Here you can view your daily meal plan. You\'ll see all meals, ingredients, and nutritional values. You can also edit the plan and add ingredients.',
          position: 'right',
          requiresDrawer: true
        },
        {
          target: 'dailylog-tab',
          title: language === 'hebrew' ? 'כרטיסיית יומן יומי' : 'Daily Log Tab',
          description: language === 'hebrew'
            ? 'כאן תוכלו לעקוב אחר צריכת המזון היומית שלכם. רשמו מה אכלתם בכל ארוחה ועקבו אחר הקלוריות והמקרו-נוטריינטים שלכם.'
            : 'Here you can track your daily food intake. Log what you ate at each meal and track your calories and macronutrients.',
          position: 'right',
          requiresDrawer: true
        },
        {
          target: 'messages-tab',
          title: language === 'hebrew' ? 'כרטיסיית הודעות' : 'Messages Tab',
          description: language === 'hebrew'
            ? 'כאן תוכלו לתקשר עם הדיאטנית שלכם. שלחו שאלות, קבלו עצות, ועקבו אחר ההתקדמות שלכם. כל ההודעות נשמרות כאן.'
            : 'Here you can communicate with your dietitian. Send questions, receive advice, and track your progress. All messages are saved here.',
          position: 'right',
          requiresDrawer: true
        },
        {
          target: 'pricing-tab',
          title: language === 'hebrew' ? 'כרטיסיית תוכניות מנוי' : 'Subscription Plans Tab',
          description: language === 'hebrew'
            ? 'כאן תוכלו לראות ולבחור מתוך תוכניות המנוי השונות שלנו. כל תוכנית כוללת תכונות שונות ומחירים שונים.'
            : 'Here you can view and choose from our different subscription plans. Each plan includes different features and pricing.',
          position: 'right',
          requiresDrawer: true
        },
        {
          target: 'settings-tab',
          title: language === 'hebrew' ? 'כרטיסיית הגדרות' : 'Settings Tab',
          description: language === 'hebrew'
            ? 'כאן תוכלו להתאים אישית את ההגדרות של הפרופיל שלכם: תצוגת קלוריות ומקרו, יחידות מדידה, שפה, ומצב כהה.'
            : 'Here you can customize your profile settings: display calories and macros, measurement units, language, and dark mode.',
          position: 'right',
          requiresDrawer: true
        }
      ];
    }
    
    // Desktop tour steps
    return [
      {
        target: 'profile-sidebar',
        title: language === 'hebrew' ? 'תפריט הפרופיל' : 'Profile Menu',
        description: language === 'hebrew'
          ? 'זהו תפריט הניווט של הפרופיל שלכם. כאן תוכלו לגשת לכל חלקי הפרופיל: פרטים אישיים, תוכנית התזונה, יומן יומי, הודעות, תוכניות מנוי והגדרות.'
          : 'This is your profile navigation menu. Here you can access all parts of your profile: personal information, meal plan, daily log, messages, subscription plans, and settings.',
        position: 'right'
      },
      {
        target: 'profile-tab',
        title: language === 'hebrew' ? 'כרטיסיית פרופיל' : 'Profile Tab',
        description: language === 'hebrew'
          ? 'כאן תוכלו לנהל את הפרטים האישיים שלכם: שם, אימייל, טלפון, תאריך לידה, מיקום, והעדפות בריאות. כל המידע הזה עוזר לנו להתאים את התוכנית שלכם.'
          : 'Here you can manage your personal information: name, email, phone, birth date, location, and health preferences. This information helps us personalize your plan.',
        position: 'bottom'
      },
      {
        target: 'myplan-tab',
        title: language === 'hebrew' ? 'כרטיסיית תוכנית תזונה' : 'Meal Plan Tab',
        description: language === 'hebrew'
          ? 'כאן תוכלו לראות את תוכנית התזונה היומית שלכם. תראו את כל הארוחות, המרכיבים, והערכים התזונתיים. תוכלו גם לערוך את התוכנית ולהוסיף מרכיבים.'
          : 'Here you can view your daily meal plan. You\'ll see all meals, ingredients, and nutritional values. You can also edit the plan and add ingredients.',
        position: 'bottom'
      },
      {
        target: 'dailylog-tab',
        title: language === 'hebrew' ? 'כרטיסיית יומן יומי' : 'Daily Log Tab',
        description: language === 'hebrew'
          ? 'כאן תוכלו לעקוב אחר צריכת המזון היומית שלכם. רשמו מה אכלתם בכל ארוחה ועקבו אחר הקלוריות והמקרו-נוטריינטים שלכם.'
          : 'Here you can track your daily food intake. Log what you ate at each meal and track your calories and macronutrients.',
        position: 'bottom'
      },
      {
        target: 'messages-tab',
        title: language === 'hebrew' ? 'כרטיסיית הודעות' : 'Messages Tab',
        description: language === 'hebrew'
          ? 'כאן תוכלו לתקשר עם הדיאטנית שלכם. שלחו שאלות, קבלו עצות, ועקבו אחר ההתקדמות שלכם. כל ההודעות נשמרות כאן.'
          : 'Here you can communicate with your dietitian. Send questions, receive advice, and track your progress. All messages are saved here.',
        position: 'bottom'
      },
      {
        target: 'pricing-tab',
        title: language === 'hebrew' ? 'כרטיסיית תוכניות מנוי' : 'Subscription Plans Tab',
        description: language === 'hebrew'
          ? 'כאן תוכלו לראות ולבחור מתוך תוכניות המנוי השונות שלנו. כל תוכנית כוללת תכונות שונות ומחירים שונים.'
          : 'Here you can view and choose from our different subscription plans. Each plan includes different features and pricing.',
        position: 'bottom'
      },
      {
        target: 'settings-tab',
        title: language === 'hebrew' ? 'כרטיסיית הגדרות' : 'Settings Tab',
        description: language === 'hebrew'
          ? 'כאן תוכלו להתאים אישית את ההגדרות של הפרופיל שלכם: תצוגת קלוריות ומקרו, יחידות מדידה, שפה, ומצב כהה.'
          : 'Here you can customize your profile settings: display calories and macros, measurement units, language, and dark mode.',
        position: 'bottom'
      },
      {
        target: 'profile-home-button',
        title: language === 'hebrew' ? 'כפתור חזרה לבית' : 'Return to Home Button',
        description: language === 'hebrew'
          ? 'כפתור זה מחזיר אתכם לדף הבית הראשי של האתר.'
          : 'This button returns you to the main homepage of the website.',
        position: 'bottom'
      }
    ];
  };

  // Get tour steps based on current page
  const getTourSteps = () => {
    if (isProfilePage) {
      return getProfileTourSteps();
    }
    return getHomeTourSteps();
  };

  const tourSteps = getTourSteps();

  // Check if tour should be shown
  useEffect(() => {
    if (!loading) {
      if (isHomePage) {
        const tourCompleted = localStorage.getItem('websiteTourCompleted');
        
        // Debug logging
        console.log('WebsiteTour Debug (Home):', {
          loading,
          isAuthenticated,
          isHomePage,
          tourCompleted,
          pathname: location.pathname
        });
        
        if (!tourCompleted) {
          // Delay to ensure page is fully rendered
          setTimeout(() => {
            console.log('🎯 Opening Home Page Tour...');
            setIsOpen(true);
          }, 2000);
        } else {
          console.log('ℹ️ Home tour already completed. Press Ctrl+Shift+T (or Cmd+Shift+T on Mac) to restart it.');
        }
      } else if (isProfilePage && isAuthenticated) {
        const profileTourCompleted = localStorage.getItem('profileTourCompleted');
        
        // Debug logging
        console.log('WebsiteTour Debug (Profile):', {
          loading,
          isAuthenticated,
          isProfilePage,
          profileTourCompleted,
          pathname: location.pathname
        });
        
        if (!profileTourCompleted) {
          // Delay to ensure page is fully rendered
          setTimeout(() => {
            console.log('🎯 Opening Profile Page Tour...');
            setIsOpen(true);
          }, 2000);
        } else {
          console.log('ℹ️ Profile tour already completed. Press Ctrl+Shift+P (or Cmd+Shift+P on Mac) to restart it.');
        }
      } else if (!isHomePage && !isProfilePage && isOpen) {
        // Close tour if user navigates away from supported pages
        setIsOpen(false);
      }
    }
  }, [isAuthenticated, loading, isHomePage, isProfilePage, isOpen, location.pathname]);

  // Handle element highlighting
  useEffect(() => {
    // Don't highlight anything on welcome screen
    if (!isOpen || currentStep < 0 || currentStep >= tourSteps.length) {
      setHighlightedElement(null);
      return;
    }

    const step = tourSteps[currentStep];
    
    // Open mobile drawer if step requires it and drawer is not already open
    if (step.requiresDrawer) {
      // Check if drawer is already open
      const drawers = document.querySelectorAll('[class*="fixed"][class*="z-50"]');
      let drawerOpen = false;
      for (const drawer of drawers) {
        const style = window.getComputedStyle(drawer);
        if (style.opacity !== '0' && style.pointerEvents !== 'none') {
          const hasNavTabs = drawer.querySelector('[data-tour*="-tab"]');
          if (hasNavTabs) {
            drawerOpen = true;
            break;
          }
        }
      }
      
      if (!drawerOpen) {
        // Dispatch custom event to open drawer
        window.dispatchEvent(new CustomEvent('openMobileDrawer'));
      }
    }
    
    // Open mobile menu if step requires it
    if (step.requiresMenu) {
      // Check if mobile menu is already open
      // The mobile menu container has lg:hidden class and is conditionally rendered
      const mobileMenuContainer = document.querySelector('.lg\\:hidden[class*="border-t"]');
      let isMenuOpen = false;
      
      if (mobileMenuContainer) {
        const style = window.getComputedStyle(mobileMenuContainer);
        isMenuOpen = style.display !== 'none' && style.visibility !== 'hidden';
      }
      
      // Also check by looking for nav-links in mobile menu
      const allNavLinks = document.querySelectorAll('[data-tour="nav-links"]');
      for (const navLinks of allNavLinks) {
        let parent = navLinks.parentElement;
        while (parent && parent !== document.body) {
          const classes = parent.className;
          if (typeof classes === 'string' && classes.includes('lg:hidden')) {
            const style = window.getComputedStyle(parent);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
              isMenuOpen = true;
              break;
            }
          }
          parent = parent.parentElement;
        }
        if (isMenuOpen) break;
      }
      
      if (!isMenuOpen) {
        // Dispatch custom event to open mobile menu
        window.dispatchEvent(new CustomEvent('openMobileMenu'));
      }
    }
    
    // Function to check if drawer is open
    const isDrawerOpen = () => {
      if (!step.requiresDrawer) return true; // Not a drawer step, consider "open"
      // Look for the drawer container - it has fixed positioning and z-50
      const drawers = document.querySelectorAll('[class*="fixed"][class*="z-50"]');
      for (const drawer of drawers) {
        const style = window.getComputedStyle(drawer);
        // Check if it's the mobile drawer (has opacity transition and is visible)
        if (style.opacity !== '0' && style.pointerEvents !== 'none') {
          // Check if it contains navigation tabs (our target elements)
          const hasNavTabs = drawer.querySelector('[data-tour*="-tab"]');
          if (hasNavTabs) {
            return true;
          }
        }
      }
      return false;
    };
    
    // Function to check if mobile menu is open
    const isMenuOpen = () => {
      if (!step.requiresMenu) return true; // Not a menu step, consider "open"
      
      // Check if mobile menu container is visible
      const mobileMenuContainer = document.querySelector('.lg\\:hidden[class*="border-t"]');
      if (mobileMenuContainer) {
        const style = window.getComputedStyle(mobileMenuContainer);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          return true;
        }
      }
      
      // Also check by looking for nav-links in mobile menu
      const allNavLinks = document.querySelectorAll('[data-tour="nav-links"]');
      for (const navLinks of allNavLinks) {
        let parent = navLinks.parentElement;
        while (parent && parent !== document.body) {
          const classes = parent.className;
          if (typeof classes === 'string' && classes.includes('lg:hidden')) {
            const style = window.getComputedStyle(parent);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
              return true;
            }
          }
          parent = parent.parentElement;
        }
      }
      
      return false;
    };
    
    // Function to find and highlight element
    const findAndHighlight = () => {
      // If step requires drawer, make sure it's open first
      if (step.requiresDrawer && !isDrawerOpen()) {
        console.log(`Drawer not open yet for step: ${step.target}`);
        return false;
      }
      
      // If step requires menu, make sure it's open first
      if (step.requiresMenu && !isMenuOpen()) {
        console.log(`Menu not open yet for step: ${step.target}`);
        return false;
      }
      
      // Find element using data-tour attribute
      // Try all elements with this attribute (there might be duplicates in desktop/mobile)
      const allElements = document.querySelectorAll(`[data-tour="${step.target}"]`);
      let element = null;
      
      // Check if we're on mobile
      const isMobileView = window.innerWidth < 1024;
      
      // If step requires drawer, prefer element inside the drawer
      if (step.requiresDrawer && allElements.length > 0) {
        // Find the drawer container
        const drawers = document.querySelectorAll('[class*="fixed"][class*="z-50"]');
        for (const drawer of drawers) {
          const style = window.getComputedStyle(drawer);
          if (style.opacity !== '0' && style.pointerEvents !== 'none') {
            // Look for element inside this drawer
            const drawerElement = drawer.querySelector(`[data-tour="${step.target}"]`);
            if (drawerElement) {
              element = drawerElement;
              break;
            }
          }
        }
        // Fallback to first element if not found in drawer
        if (!element && allElements.length > 0) {
          element = allElements[0];
        }
      } else if (step.requiresMenu && allElements.length > 0) {
        // If step requires menu, prefer element inside the mobile menu
        // Find the mobile menu container (has lg:hidden and border-t classes)
        const mobileMenuContainer = document.querySelector('.lg\\:hidden[class*="border-t"]');
        
        if (mobileMenuContainer) {
          const style = window.getComputedStyle(mobileMenuContainer);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            // Look for element inside the mobile menu
            const menuElement = mobileMenuContainer.querySelector(`[data-tour="${step.target}"]`);
            if (menuElement) {
              element = menuElement;
            }
          }
        }
        
        // Also try finding by checking nav-links parent
        if (!element) {
          const allNavLinks = document.querySelectorAll('[data-tour="nav-links"]');
          for (const navLinks of allNavLinks) {
            let parent = navLinks.parentElement;
            while (parent && parent !== document.body) {
              const classes = parent.className;
              if (typeof classes === 'string' && classes.includes('lg:hidden')) {
                const style = window.getComputedStyle(parent);
                if (style.display !== 'none' && style.visibility !== 'hidden') {
                  const menuElement = parent.querySelector(`[data-tour="${step.target}"]`);
                  if (menuElement) {
                    element = menuElement;
                    break;
                  }
                }
              }
              parent = parent.parentElement;
            }
            if (element) break;
          }
        }
        
        // Fallback to first element if not found in menu
        if (!element && allElements.length > 0) {
          element = allElements[0];
        }
      } else if (allElements.length > 0) {
        // For mobile, prefer elements that are visible on mobile (not hidden by lg:hidden)
        if (isMobileView && allElements.length > 1) {
          // Look for element in mobile controls section
          // Mobile controls are in a div with "lg:hidden" class
          for (const el of allElements) {
            // Check if element is in a container with lg:hidden class (mobile section)
            let parent = el.parentElement;
            while (parent && parent !== document.body) {
              const classes = parent.className;
              // Check if parent has lg:hidden (mobile section)
              if (typeof classes === 'string' && classes.includes('lg:hidden')) {
                // Verify it's actually visible (not hidden by other means)
                const style = window.getComputedStyle(parent);
                if (style.display !== 'none' && style.visibility !== 'hidden') {
                  element = el;
                  break;
                }
              }
              parent = parent.parentElement;
            }
            if (element) break;
          }
        }
        // Fallback to first element
        if (!element) {
          element = allElements[0];
        }
      }
      
      console.log(`Looking for element with data-tour="${step.target}":`, element, `Found ${allElements.length} total`);

      if (element) {
        // Check if element is visible (not hidden by drawer animation)
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const isVisible = rect.width > 0 && rect.height > 0 && 
                         style.opacity !== '0' &&
                         style.visibility !== 'hidden' &&
                         style.display !== 'none';
        
        console.log(`Element visibility check:`, { 
          width: rect.width, 
          height: rect.height, 
          opacity: style.opacity, 
          visibility: style.visibility, 
          display: style.display,
          isVisible 
        });
        
        if (isVisible) {
          // Scroll element into view - use block: 'center' for drawer elements
          element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          
          // Also try scrolling the drawer container if element is inside one
          let parent = element.parentElement;
          while (parent && parent !== document.body) {
            const parentStyle = window.getComputedStyle(parent);
            if (parentStyle.overflowY === 'auto' || parentStyle.overflowY === 'scroll') {
              // Scroll within the scrollable container
              const containerRect = parent.getBoundingClientRect();
              const elementRect = element.getBoundingClientRect();
              const scrollTop = parent.scrollTop + (elementRect.top - containerRect.top) - (containerRect.height / 2) + (elementRect.height / 2);
              parent.scrollTo({ top: scrollTop, behavior: 'smooth' });
              break;
            }
            parent = parent.parentElement;
          }
          
          // Wait for smooth scroll animation to complete (typically 300-500ms)
          // Then set the highlighted element so tooltip position is calculated correctly
          setTimeout(() => {
            // Re-check element is still visible after scroll
            const newRect = element.getBoundingClientRect();
            if (newRect.width > 0 && newRect.height > 0) {
              setHighlightedElement(element);
            }
          }, 600); // Wait for scroll animation + buffer
          
          return true;
        }
      }
      return false;
    };

    // If step requires drawer or menu, wait for it to fully open and render
    // The handleNext function already ensures drawer/menu is ready, but we add a small buffer
    const delay = step.requiresDrawer ? 300 : (step.requiresMenu ? 400 : 0);

    setTimeout(() => {
      // Try immediately
      if (!findAndHighlight()) {
        // Fallback: try multiple times with increasing delays (in case page is still loading)
        let attempts = 0;
        const maxAttempts = 20; // Increased attempts for drawer elements
        
        const tryFind = () => {
          attempts++;
          const found = findAndHighlight();
          if (found || attempts >= maxAttempts) {
            if (attempts >= maxAttempts && !found) {
              console.warn(`Could not find element with data-tour="${step.target}" after ${maxAttempts} attempts`);
              // Try one more time with a longer delay
              setTimeout(() => {
                const lastTry = findAndHighlight();
                if (!lastTry) {
                  console.error(`Final attempt failed for element with data-tour="${step.target}"`);
                }
              }, 500);
            }
            return;
          }
          // Shorter interval for faster retries
          setTimeout(tryFind, 100);
        };
        
        setTimeout(tryFind, 100);
      }
    }, delay);
  }, [currentStep, isOpen, tourSteps]);

  // Recalculate tooltip position on scroll
  useEffect(() => {
    if (!highlightedElement || showWelcome) return;
    
    let scrollTimeout;
    const handleScroll = () => {
      // Debounce scroll events
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        // Force tooltip position recalculation by updating key
        setTooltipKey(prev => prev + 1);
      }, 100);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Also listen for scroll events on scrollable containers
    const scrollableContainers = document.querySelectorAll('[style*="overflow"], [class*="overflow"]');
    scrollableContainers.forEach(container => {
      container.addEventListener('scroll', handleScroll, { passive: true });
    });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      scrollableContainers.forEach(container => {
        container.removeEventListener('scroll', handleScroll);
      });
      clearTimeout(scrollTimeout);
    };
  }, [highlightedElement, showWelcome]);

  // Calculate position for tooltip
  const getTooltipPosition = () => {
    if (!highlightedElement) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const rect = highlightedElement.getBoundingClientRect();
    const step = tourSteps[currentStep];
    const tooltipHeight = 320; // Increased to account for content
    const tooltipWidth = Math.min(450, window.innerWidth * 0.9);
    const spacing = 20;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 20; // Padding from viewport edges

    // Check if element is inside a drawer (mobile navigation)
    let isInDrawer = false;
    let drawerDirection = 'ltr';
    if (step.requiresDrawer) {
      // Find the drawer container (fixed overlay)
      const drawerContainers = document.querySelectorAll('[class*="fixed"][class*="z-50"]');
      for (const container of drawerContainers) {
        const style = window.getComputedStyle(container);
        if (style.opacity !== '0' && style.pointerEvents !== 'none' && container.contains(highlightedElement)) {
          isInDrawer = true;
          // Find the actual drawer panel inside the container
          const drawerPanel = container.querySelector('[class*="absolute"][class*="top-0"][class*="h-full"]');
          if (drawerPanel) {
            const panelClasses = drawerPanel.className;
            // Check if drawer is on right (RTL) or left (LTR)
            if (panelClasses.includes('right-0')) {
              drawerDirection = 'rtl';
            } else if (panelClasses.includes('left-0')) {
              drawerDirection = 'ltr';
            }
          }
          break;
        }
      }
    }

    let top, left, transform;
    
    // Check if we're on mobile
    const isMobileView = window.innerWidth < 1024;

    // Special handling for drawer elements
    if (isInDrawer) {
      // For drawer elements, position tooltip to the right of drawer (LTR) or left (RTL)
      // Use more spacing to avoid overlap
      const drawerSpacing = 30;
      
      if (drawerDirection === 'rtl') {
        // Drawer is on right, position tooltip to the left of the element
        const leftPosition = rect.left - tooltipWidth - drawerSpacing;
        if (leftPosition > padding) {
          top = `${rect.top + rect.height / 2}px`;
          left = `${leftPosition}px`;
          transform = 'translate(0, -50%)';
        } else {
          // Not enough space on left, position below
          top = `${rect.bottom + drawerSpacing}px`;
          left = `${rect.left + rect.width / 2}px`;
          transform = 'translate(-50%, 0)';
        }
      } else {
        // Drawer is on left, position tooltip to the right of the element
        const rightPosition = rect.right + drawerSpacing;
        if (rightPosition + tooltipWidth < viewportWidth - padding) {
          top = `${rect.top + rect.height / 2}px`;
          left = `${rightPosition}px`;
          transform = 'translate(0, -50%)';
        } else {
          // Not enough space on right, position below
          top = `${rect.bottom + drawerSpacing}px`;
          left = `${rect.left + rect.width / 2}px`;
          transform = 'translate(-50%, 0)';
        }
      }
    } else if (isMobileView && (step.target === 'theme-toggle' || step.target === 'language-toggle' || step.target === 'mobile-menu-button')) {
      // Special positioning for mobile header buttons (top right corner)
      // Position tooltip below the button, centered
      const buttonSpacing = 15;
      if (rect.bottom + tooltipHeight + buttonSpacing < viewportHeight - padding) {
        top = `${rect.bottom + buttonSpacing}px`;
        left = `${rect.left + rect.width / 2}px`;
        transform = 'translate(-50%, 0)';
      } else {
        // Not enough space below, position above
        top = `${rect.top - tooltipHeight - buttonSpacing}px`;
        left = `${rect.left + rect.width / 2}px`;
        transform = 'translate(-50%, -100%)';
      }
    } else {
      // Try preferred position first for non-drawer elements
      switch (step.position) {
        case 'top':
          if (rect.top - tooltipHeight - spacing > padding) {
            top = `${rect.top - tooltipHeight - spacing}px`;
            left = `${rect.left + rect.width / 2}px`;
            transform = 'translate(-50%, -100%)';
          } else {
            // Fallback to bottom if no space on top
            top = `${rect.bottom + spacing}px`;
            left = `${rect.left + rect.width / 2}px`;
            transform = 'translate(-50%, 0)';
          }
          break;
        case 'bottom':
          if (rect.bottom + tooltipHeight + spacing < viewportHeight - padding) {
            top = `${rect.bottom + spacing}px`;
            left = `${rect.left + rect.width / 2}px`;
            transform = 'translate(-50%, 0)';
          } else {
            // Fallback to top if no space on bottom
            top = `${rect.top - tooltipHeight - spacing}px`;
            left = `${rect.left + rect.width / 2}px`;
            transform = 'translate(-50%, -100%)';
          }
          break;
        case 'right':
          if (rect.right + tooltipWidth + spacing < viewportWidth - padding) {
            top = `${rect.top + rect.height / 2}px`;
            left = `${rect.right + spacing}px`;
            transform = 'translate(0, -50%)';
          } else {
            // Fallback to left if no space on right
            top = `${rect.top + rect.height / 2}px`;
            left = `${rect.left - tooltipWidth - spacing}px`;
            transform = 'translate(-100%, -50%)';
          }
          break;
        default:
          // Default to bottom
          top = `${rect.bottom + spacing}px`;
          left = `${rect.left + rect.width / 2}px`;
          transform = 'translate(-50%, 0)';
      }
    }

    // Ensure tooltip stays within viewport horizontally
    const leftValue = parseFloat(left);
    const minLeft = tooltipWidth / 2 + padding;
    const maxLeft = viewportWidth - tooltipWidth / 2 - padding;
    
    if (leftValue < minLeft) {
      left = `${minLeft}px`;
      transform = transform.replace(/translate\([^)]+\)/, 'translate(-50%, 0)');
    } else if (leftValue > maxLeft) {
      left = `${maxLeft}px`;
      transform = transform.replace(/translate\([^)]+\)/, 'translate(-50%, 0)');
    }

    // Ensure tooltip stays within viewport vertically
    const topValue = parseFloat(top);
    if (topValue < padding) {
      top = `${padding}px`;
    } else if (topValue + tooltipHeight > viewportHeight - padding) {
      top = `${viewportHeight - tooltipHeight - padding}px`;
    }

    return { top, left, transform };
  };

  const handleStartTour = () => {
    setShowWelcome(false);
    setCurrentStep(0);
  };

  const handleSkipWelcome = () => {
    handleFinish();
  };

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      const nextStep = tourSteps[currentStep + 1];
      // If next step requires drawer, open it and wait for it to be ready
      if (nextStep && nextStep.requiresDrawer) {
        // Dispatch event to open drawer
        window.dispatchEvent(new CustomEvent('openMobileDrawer'));
        
        // Wait for drawer to open and be ready
        const checkDrawerReady = (attempts = 0) => {
          const drawers = document.querySelectorAll('[class*="fixed"][class*="z-50"]');
          let drawerReady = false;
          
          for (const drawer of drawers) {
            const style = window.getComputedStyle(drawer);
            if (style.opacity !== '0' && style.pointerEvents !== 'none') {
              const hasNavTabs = drawer.querySelector('[data-tour*="-tab"]');
              if (hasNavTabs) {
                drawerReady = true;
                break;
              }
            }
          }
          
          if (drawerReady || attempts >= 10) {
            // Drawer is ready or we've tried enough times, proceed to next step
            setCurrentStep(currentStep + 1);
          } else {
            // Check again after a short delay
            setTimeout(() => checkDrawerReady(attempts + 1), 100);
          }
        };
        
        // Start checking after initial delay
        setTimeout(() => checkDrawerReady(), 200);
      } else if (nextStep && nextStep.requiresMenu) {
        // If next step requires menu, open it and wait for it to be ready
        window.dispatchEvent(new CustomEvent('openMobileMenu'));
        
        // Wait for menu to open and be ready
        const checkMenuReady = (attempts = 0) => {
          const mobileMenuLinks = document.querySelector('[data-tour="nav-links"]');
          const isMenuOpen = mobileMenuLinks && 
            window.getComputedStyle(mobileMenuLinks.parentElement).display !== 'none';
          
          if (isMenuOpen || attempts >= 10) {
            // Menu is ready or we've tried enough times, proceed to next step
            setCurrentStep(currentStep + 1);
          } else {
            // Check again after a short delay
            setTimeout(() => checkMenuReady(attempts + 1), 100);
          }
        };
        
        // Start checking after initial delay
        setTimeout(() => checkMenuReady(), 200);
      } else {
        setCurrentStep(currentStep + 1);
      }
    } else {
      handleFinish();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      const previousStep = tourSteps[currentStep - 1];
      const currentStepData = tourSteps[currentStep];
      
      // If current step requires drawer but previous doesn't, close it
      if (currentStepData && currentStepData.requiresDrawer) {
        if (!previousStep || !previousStep.requiresDrawer) {
          window.dispatchEvent(new CustomEvent('closeMobileDrawer'));
        }
      }
      
      // If current step requires menu but previous doesn't, close it
      if (currentStepData && currentStepData.requiresMenu) {
        if (!previousStep || !previousStep.requiresMenu) {
          window.dispatchEvent(new CustomEvent('closeMobileMenu'));
        }
      }
      
      // If previous step requires drawer, open it
      if (previousStep && previousStep.requiresDrawer) {
        window.dispatchEvent(new CustomEvent('openMobileDrawer'));
        setTimeout(() => {
          setCurrentStep(currentStep - 1);
        }, 400);
      } else if (previousStep && previousStep.requiresMenu) {
        // If previous step requires menu, open it
        window.dispatchEvent(new CustomEvent('openMobileMenu'));
        setTimeout(() => {
          setCurrentStep(currentStep - 1);
        }, 400);
      } else {
        setCurrentStep(currentStep - 1);
      }
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = () => {
    setIsOpen(false);
    // Close mobile drawer if it was opened by tour
    if (isProfilePage && isMobile) {
      window.dispatchEvent(new CustomEvent('closeMobileDrawer'));
    }
    // Close mobile menu if it was opened by tour
    window.dispatchEvent(new CustomEvent('closeMobileMenu'));
    if (isProfilePage) {
      localStorage.setItem('profileTourCompleted', 'true');
    } else {
      localStorage.setItem('websiteTourCompleted', 'true');
    }
  };

  // Allow tour to show on home page (even if not authenticated for testing) or profile page (if authenticated)
  if (!isOpen || (!isHomePage && !isProfilePage)) {
    return null;
  }

  // For profile page, require authentication
  if (isProfilePage && !isAuthenticated) {
    return null;
  }

  const currentStepData = showWelcome ? null : tourSteps[currentStep];

  // Get blur overlay regions (everything except highlighted element)
  const getBlurRegions = () => {
    // On welcome screen, blur everything
    if (showWelcome || !highlightedElement) {
      return [{ top: 0, left: 0, width: '100%', height: '100%' }];
    }

    const rect = highlightedElement.getBoundingClientRect();
    const padding = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const regions = [];

    // Top region
    if (rect.top > padding) {
      regions.push({
        top: 0,
        left: 0,
        width: '100%',
        height: `${Math.max(0, rect.top - padding)}px`
      });
    }

    // Bottom region
    if (rect.bottom + padding < viewportHeight) {
      regions.push({
        top: `${rect.bottom + padding}px`,
        left: 0,
        width: '100%',
        height: `${Math.max(0, viewportHeight - rect.bottom - padding)}px`
      });
    }

    // Left region
    if (rect.left > padding) {
      regions.push({
        top: `${Math.max(0, rect.top - padding)}px`,
        left: 0,
        width: `${Math.max(0, rect.left - padding)}px`,
        height: `${rect.height + padding * 2}px`
      });
    }

    // Right region
    if (rect.right + padding < viewportWidth) {
      regions.push({
        top: `${Math.max(0, rect.top - padding)}px`,
        left: `${rect.right + padding}px`,
        width: `${Math.max(0, viewportWidth - rect.right - padding)}px`,
        height: `${rect.height + padding * 2}px`
      });
    }

    return regions.length > 0 ? regions : [{ top: 0, left: 0, width: '100%', height: '100%' }];
  };

  const blurRegions = getBlurRegions();
  const tooltipStyle = showWelcome 
    ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    : getTooltipPosition();

  return (
    <div className="fixed inset-0 z-[9999]" dir={direction}>
      {/* Blur overlay regions - blurs everything except highlighted element */}
      {blurRegions.map((region, index) => (
        <div
          key={index}
          className="absolute bg-black/40 backdrop-blur-sm transition-opacity duration-300 pointer-events-none"
          style={region}
        />
      ))}
      
      {/* Highlighted element overlay (only during tour) */}
      {!showWelcome && highlightedElement && (
        <>
          <div
            className="absolute border-4 border-emerald-400 rounded-lg shadow-2xl shadow-emerald-500/50 pointer-events-none z-[10000] transition-all duration-300"
            style={{
              top: `${highlightedElement.getBoundingClientRect().top - 4}px`,
              left: `${highlightedElement.getBoundingClientRect().left - 4}px`,
              width: `${highlightedElement.getBoundingClientRect().width + 8}px`,
              height: `${highlightedElement.getBoundingClientRect().height + 8}px`,
            }}
          />
          {/* Pulse animation */}
          <div
            className="absolute border-4 border-emerald-400 rounded-lg opacity-50 animate-ping pointer-events-none z-[10000]"
            style={{
              top: `${highlightedElement.getBoundingClientRect().top - 4}px`,
              left: `${highlightedElement.getBoundingClientRect().left - 4}px`,
              width: `${highlightedElement.getBoundingClientRect().width + 8}px`,
              height: `${highlightedElement.getBoundingClientRect().height + 8}px`,
            }}
          />
        </>
      )}

      {/* Welcome Screen or Tooltip */}
      <div
        key={tooltipKey}
        className="absolute z-[10001] pointer-events-auto"
        style={{
          ...tooltipStyle,
          width: showWelcome ? '90vw' : 'min(450px, 90vw)',
          maxWidth: showWelcome ? '600px' : '450px'
        }}
      >
        {showWelcome ? (
          /* Welcome Screen */
          <div className={`${themeClasses.bgCard} rounded-2xl shadow-2xl border-2 border-emerald-500/50 p-8 relative text-center`}>
            {/* Language Selector */}
            <div className="absolute top-6 right-6">
              <button
                onClick={toggleLanguage}
                className={`px-4 py-2 ${themeClasses.bgSecondary} ${themeClasses.textPrimary} rounded-lg font-semibold hover:${themeClasses.bgPrimary} transition-all border-2 border-emerald-500/50 hover:border-emerald-500 flex items-center gap-2`}
                title={language === 'hebrew' ? 'Switch to English' : 'עברית'}
              >
                {language === 'hebrew' ? (
                  <>
                    <span>🇬🇧</span>
                    <span>English</span>
                  </>
                ) : (
                  <>
                    <span>🇮🇱</span>
                    <span>עברית</span>
                  </>
                )}
              </button>
            </div>

            {/* Welcome Icon/Logo */}
            <div className="mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-4xl">✨</span>
              </div>
            </div>

            {/* Title */}
            <h2 className={`text-4xl font-bold ${themeClasses.textPrimary} mb-4`}>
              {isProfilePage 
                ? (language === 'hebrew' ? 'ברוכים הבאים לפרופיל שלכם!' : 'Welcome to Your Profile!')
                : (language === 'hebrew' ? 'ברוכים הבאים ל-Better Choice!' : 'Welcome to Better Choice!')
              }
            </h2>

            {/* Description */}
            <div className={`${themeClasses.textSecondary} mb-8 leading-relaxed space-y-4 ${language === 'hebrew' ? 'text-right' : 'text-left'}`}>
              {isProfilePage ? (
                <>
                  <p className="text-lg">
                    {language === 'hebrew' 
                      ? 'זהו הפרופיל האישי שלכם ב-Better Choice. כאן תוכלו לנהל את כל המידע האישי, תוכנית התזונה, מעקב יומי, ותקשורת עם הדיאטנית שלכם.'
                      : 'This is your personal profile on Better Choice. Here you can manage all your personal information, meal plan, daily tracking, and communication with your dietitian.'
                    }
                  </p>
                  <p>
                    {language === 'hebrew'
                      ? 'הסיור יראה לכם את כל התכונות העיקריות של הפרופיל: כרטיסיות הניווט, ניהול פרטים אישיים, צפייה בתוכנית התזונה, מעקב יומי, הודעות, תוכניות מנוי, והגדרות.'
                      : 'The tour will show you all the main features of your profile: navigation tabs, personal information management, meal plan viewing, daily tracking, messages, subscription plans, and settings.'
                    }
                  </p>
                  <p className="font-semibold text-lg">
                    {language === 'hebrew'
                      ? 'האם תרצו לסיור קצר בפרופיל?'
                      : 'Would you like to take a quick tour of your profile?'
                    }
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg">
                    {language === 'hebrew' 
                      ? 'Better Choice היא פלטפורמה מתקדמת לבריאות ואורח חיים בריא, המספקת לכם כלים מקצועיים להשגת המטרות שלכם.'
                      : 'Better Choice is an advanced platform for health and healthy living, providing you with professional tools to achieve your goals.'
                    }
                  </p>
                  <p>
                    {language === 'hebrew'
                      ? 'אצלנו תמצאו תוכניות תזונה מותאמות אישית, תוכניות אימון, מעקב התקדמות, ותמיכה מקצועית 24/7. אנו כאן כדי לעזור לכם להשיג את המטרות שלכם ולחיות חיים בריאים יותר.'
                      : 'With us, you\'ll find personalized nutrition plans, workout programs, progress tracking, and 24/7 professional support. We\'re here to help you achieve your goals and live a healthier life.'
                    }
                  </p>
                  <p className="font-semibold text-lg">
                    {language === 'hebrew'
                      ? 'האם תרצו לסיור קצר באתר?'
                      : 'Would you like to take a quick tour of the website?'
                    }
                  </p>
                </>
              )}
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={handleSkipWelcome}
                className={`px-8 py-3 ${themeClasses.bgSecondary} ${themeClasses.textPrimary} rounded-xl font-semibold hover:${themeClasses.bgPrimary} transition-all shadow-lg w-full sm:w-auto`}
              >
                {language === 'hebrew' ? 'דלג' : 'Skip'}
              </button>
              <button
                onClick={handleStartTour}
                className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg w-full sm:w-auto"
              >
                {language === 'hebrew' ? 'התחל סיור' : 'Start Tour'}
              </button>
            </div>
          </div>
        ) : (
          /* Tour Tooltip */
          <>
            <div className={`${themeClasses.bgCard} rounded-2xl shadow-2xl border-2 border-emerald-500/50 p-6 relative`}>
              {/* Step indicator */}
              <div className="absolute -top-4 -right-4 w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                {currentStep + 1}
              </div>

              {/* Title */}
              <h3 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-3 pr-8`}>
                {currentStepData.title}
              </h3>

              {/* Description */}
              <p className={`${themeClasses.textSecondary} mb-6 leading-relaxed`}>
                {currentStepData.description}
              </p>

              {/* Progress bar */}
              <div className="mb-6">
                <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
                  />
                </div>
                <p className={`text-xs ${themeClasses.textMuted} mt-2 text-center`}>
                  {language === 'hebrew' 
                    ? `שלב ${currentStep + 1} מתוך ${tourSteps.length}`
                    : `Step ${currentStep + 1} of ${tourSteps.length}`
                  }
                </p>
              </div>

              {/* Buttons */}
              <div className="flex justify-between items-center gap-3">
                <button
                  onClick={handleSkip}
                  className={`px-4 py-2 ${themeClasses.textSecondary} hover:${themeClasses.textPrimary} transition-colors text-sm font-medium`}
                >
                  {language === 'hebrew' ? 'דלג' : 'Skip'}
                </button>

                <div className="flex gap-3">
                  {currentStep > 0 && (
                    <button
                      onClick={handlePrevious}
                      className={`px-6 py-2 ${themeClasses.bgSecondary} ${themeClasses.textPrimary} rounded-lg font-semibold hover:${themeClasses.bgPrimary} transition-colors`}
                    >
                      {language === 'hebrew' ? '← קודם' : '← Previous'}
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg"
                  >
                    {currentStep < tourSteps.length - 1
                      ? (language === 'hebrew' ? 'הבא →' : 'Next →')
                      : (language === 'hebrew' ? 'סיום' : 'Finish')
                    }
                  </button>
                </div>
              </div>
            </div>

            {/* Arrow pointing to element */}
            {currentStepData.position === 'bottom' && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <div className="w-6 h-6 bg-emerald-500 rotate-45 transform"></div>
              </div>
            )}
            {currentStepData.position === 'top' && (
              <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
                <div className="w-6 h-6 bg-emerald-500 rotate-45 transform"></div>
              </div>
            )}
            {currentStepData.position === 'right' && (
              <div className="absolute -left-3 top-1/2 transform -translate-y-1/2">
                <div className="w-6 h-6 bg-emerald-500 rotate-45 transform"></div>
              </div>
            )}
            {currentStepData.position === 'left' && (
              <div className="absolute -right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-6 h-6 bg-emerald-500 rotate-45 transform"></div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WebsiteTour;

