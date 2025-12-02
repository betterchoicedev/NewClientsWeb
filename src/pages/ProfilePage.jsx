import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useStripe } from '../context/StripeContext';
import { useSettings } from '../context/SettingsContext';
import { supabase, supabaseSecondary } from '../supabase/supabaseClient';
import { debugMealPlans, getFoodLogs, createFoodLog, updateFoodLog, deleteFoodLog, getChatMessages, createChatMessage, getCompaniesWithManagers, getClientCompanyAssignment, assignClientToCompany } from '../supabase/secondaryClient';
import { normalizePhoneForDatabase } from '../supabase/auth';
import { getAllProducts, getProductsByCategory, getProduct } from '../config/stripe-products';
import PricingCard from '../components/PricingCard';
import OnboardingModal from '../components/OnboardingModal';
import AddIngredientModal from '../components/AddIngredientModal';
import IngredientPortionModal from '../components/IngredientPortionModal';
import { translateMenu } from '../services/translateService';

// Function to get active meal plan from client_meal_plans table
const getClientMealPlan = async (userCode) => {
  try {
    const { data, error } = await supabase
      .from('client_meal_plans')
      .select('*')
      .eq('user_code', userCode)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No active meal plan found
        return { data: null, error: null };
      }
      return { data: null, error };
    }

    // Check if today is in the active_days
    // active_days: array of numbers 0-6 where 0=Sunday, 1=Monday, etc.
    // If active_days is null, it's an everyday plan
    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const isActiveToday = data.active_days === null || data.active_days.includes(today);

    if (!isActiveToday) {
      // Meal plan exists but not active for today
      console.log(`Meal plan found but not active for today (day ${today}). Active days:`, data.active_days);
      return { data: null, error: null };
    }

    // Check if edited plan is from today
    const todayDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const editedPlanDate = data.edited_plan_date ? data.edited_plan_date.split('T')[0] : null;
    const hasEditedPlanFromToday = data.client_edited_meal_plan && editedPlanDate === todayDate;

    // If there's an edited plan from a previous day, clear it from the database
    if (data.client_edited_meal_plan && editedPlanDate && editedPlanDate !== todayDate) {
      console.log(`Clearing old edited meal plan from ${editedPlanDate} (today is ${todayDate})`);
      
      // Clear the old edited plan
      const { error: clearError } = await supabase
        .from('client_meal_plans')
        .update({
          client_edited_meal_plan: null,
          edited_plan_date: null,
        })
        .eq('id', data.id);

      if (clearError) {
        console.error('Error clearing old edited meal plan:', clearError);
        // Continue anyway - we'll just use the original plan
      } else {
        console.log('✅ Cleared old edited meal plan from database');
      }
    }

    // Prioritize client_edited_meal_plan if it's from today, otherwise use dietitian_meal_plan
    const mealPlan = hasEditedPlanFromToday ? data.client_edited_meal_plan : data.dietitian_meal_plan;

    // If we cleared an old edited plan, set these to null in the return
    const finalEditedPlan = hasEditedPlanFromToday ? data.client_edited_meal_plan : null;
    const finalEditedDate = hasEditedPlanFromToday ? data.edited_plan_date : null;

    return {
      data: {
        id: data.id,
        meal_plan: mealPlan,
        dietitian_meal_plan: data.dietitian_meal_plan,
        client_edited_meal_plan: finalEditedPlan,
        edited_plan_date: finalEditedDate,
        daily_total_calories: data.daily_total_calories,
        macros_target: data.macros_target,
        meal_plan_name: data.meal_plan_name,
        active_from: data.active_from,
        active_until: data.active_until,
        active_days: data.active_days,
        isClientEdited: hasEditedPlanFromToday
      },
      error: null
    };
  } catch (err) {
    console.error('Error fetching client meal plan:', err);
    return { data: null, error: err };
  }
};

const ProfilePage = () => {
  const { user, isAuthenticated } = useAuth();
  const { language, t, direction, toggleLanguage, isTransitioning } = useLanguage();
  const { isDarkMode, toggleTheme, themeClasses } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    newsletter: false,
    status: 'active',
    birthDate: '',
    age: '',
    gender: '',
    dietaryPreferences: '',
    foodAllergies: '',
    medicalConditions: '',
    userCode: '',
    region: '',
    city: '',
    timezone: '',
    userLanguage: '',
    companyId: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userCode, setUserCode] = useState(null);
  const [companyOptions, setCompanyOptions] = useState([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [companyError, setCompanyError] = useState('');
  const [assignedCompanyId, setAssignedCompanyId] = useState('');
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  const loadCompanyOptions = useCallback(async () => {
    if (!supabaseSecondary) return;

    try {
      setIsLoadingCompanies(true);
      setCompanyError('');
      const { data, error } = await getCompaniesWithManagers();

      if (error) {
        setCompanyError(error.message || 'Failed to load companies');
        setCompanyOptions([]);
      } else {
        setCompanyOptions(data || []);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
      setCompanyError('Unexpected error while loading companies.');
    } finally {
      setIsLoadingCompanies(false);
    }
  }, []);

  const loadCompanyAssignment = useCallback(async (currentUserCode) => {
    if (!supabaseSecondary || !currentUserCode) return;

    try {
      const { data, error } = await getClientCompanyAssignment(currentUserCode);

      if (error) {
        console.error('Error fetching company assignment:', error);
        return;
      }

      const companyId = data?.provider?.company_id || '';
      setAssignedCompanyId(companyId || '');
      setProfileData((prev) => ({
        ...prev,
        companyId: companyId || ''
      }));
    } catch (error) {
      console.error('Unexpected error fetching company assignment:', error);
    }
  }, []);

  // Check onboarding status
  const checkOnboardingStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('user_code, onboarding_completed, phone, user_language, city, birth_date, age, gender, current_weight, target_weight, height, food_allergies, dietary_preferences, food_limitations, activity_level, goal, client_preference, region, medical_conditions')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking onboarding status:', error);
        return;
      }

      if (data) {
        setUserCode(data.user_code);
        
        // Track onboarding completion status
        setOnboardingCompleted(data.onboarding_completed === true);
        
        // Show onboarding ONLY if onboarding_completed is not true
        // Once onboarding is completed (onboarding_completed === true), never show it again
        // regardless of missing fields - user can fill them later in the profile
        if (data.onboarding_completed !== true) {
          setShowOnboarding(true);
        } else {
          // Onboarding is completed - don't show it again
          setShowOnboarding(false);
        }
      } else {
        // No profile data at all - show onboarding
        setOnboardingCompleted(false);
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    }
  };

  // Callback to handle onboarding completion
  const handleOnboardingComplete = async (completed = true) => {
    if (completed) {
      // Onboarding was completed - set state immediately to allow editing
      setOnboardingCompleted(true);
      setShowOnboarding(false);
      // Reload profile data and re-check status to ensure everything is in sync
      await loadProfileData();
      await checkOnboardingStatus();
    } else {
      // Onboarding was skipped - just close the modal without re-checking
      // This prevents the modal from immediately reopening
      setShowOnboarding(false);
      // Keep onboardingCompleted as false so fields remain read-only
      setOnboardingCompleted(false);
    }
  };

  // Load profile data on component mount
  useEffect(() => {
    if (user && !profileData.userCode) { // Only load if user exists and profile not already loaded
      loadProfileData();
      checkOnboardingStatus();
    }
  }, [user, profileData.userCode]);

  // Reload onboarding status when profile tab becomes active
  useEffect(() => {
    if (activeTab === 'profile' && user) {
      checkOnboardingStatus();
    }
  }, [activeTab, user]);

  useEffect(() => {
    loadCompanyOptions();
  }, [loadCompanyOptions]);

  useEffect(() => {
    if (profileData.userCode) {
      loadCompanyAssignment(profileData.userCode);
    }
  }, [profileData.userCode, loadCompanyAssignment]);

  // Sync web language with user's preferred language
  useEffect(() => {
    if (profileData.userLanguage) {
      // Map language codes to web language
      const languageMap = {
        'en': 'english',
        'he': 'hebrew',
        'english': 'english',
        'hebrew': 'hebrew'
      };
      
      const webLanguage = languageMap[profileData.userLanguage.toLowerCase()] || 'english';
      
      // Only change if different from current language
      if (language !== webLanguage) {
        toggleLanguage();
      }
    }
  }, [profileData.userLanguage]);

  const loadProfileData = async () => {
    try {
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Loading profile data for user:', user.id);
      }
      
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Detailed error loading profile:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return;
      }

      if (data) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Profile data loaded:', data);
        }
        // Split full_name into firstName and lastName
        const nameParts = (data.full_name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        setProfileData((prev) => ({
          ...prev,
          firstName: firstName,
          lastName: lastName,
          email: data.email || user.email || '',
          phone: data.phone || '',
          newsletter: false,
          status: 'active',
          birthDate: data.birth_date || '',
          age: data.age ? data.age.toString() : '',
          gender: data.gender || '',
          dietaryPreferences: data.dietary_preferences || '',
          foodAllergies: data.food_allergies || '',
          medicalConditions: data.medical_conditions || '',
          userCode: data.user_code || '',
          region: data.region || '',
          city: data.city || '',
          timezone: data.timezone || '',
          userLanguage: data.user_language || '',
          companyId: prev.companyId || ''
        }));

        // Sync web language immediately after loading profile
        if (data.user_language) {
          const languageMap = {
            'en': 'english',
            'he': 'hebrew',
            'english': 'english',
            'hebrew': 'hebrew'
          };
          
          const webLanguage = languageMap[data.user_language.toLowerCase()] || 'english';
          
          // Only change if different from current language
          if (language !== webLanguage) {
            toggleLanguage();
          }
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('No profile data found, initializing with user metadata');
        }
        // Initialize with user metadata if available
        setProfileData(prev => ({
          ...prev,
          firstName: user.user_metadata?.first_name || '',
          lastName: user.user_metadata?.last_name || '',
          email: user.email || '',
          newsletter: false,
          status: 'active',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          companyId: prev.companyId || ''
        }));
      }
    } catch (error) {
      console.error('Unexpected error loading profile:', error);
    }
  };

  const saveProfileData = async () => {
    setIsSaving(true);
    setSaveStatus('');
    setErrorMessage('');

    // Validate required fields
    const missingFields = [];
    if (!profileData.firstName.trim()) missingFields.push('First Name');
    if (!profileData.lastName.trim()) missingFields.push('Last Name');
    if (!profileData.email.trim()) missingFields.push('Email');
    if (!profileData.age && !profileData.birthDate) missingFields.push('Age or Birth Date');
    if (!profileData.gender) missingFields.push('Gender');
    if (!profileData.region.trim()) missingFields.push('Region');
    if (!profileData.city.trim()) missingFields.push('City');
    if (!profileData.timezone) missingFields.push('Timezone');
    // Health information fields are optional - no validation needed

    if (missingFields.length > 0) {
      console.error('Validation failed. Missing required fields:', missingFields);
      setErrorMessage(`Please fill in the following required fields: ${missingFields.join(', ')}`);
      setSaveStatus('error');
      setIsSaving(false);
      return;
    }

    try {
      // Calculate age if not provided but birth date is available
      let finalAge = profileData.age ? parseInt(profileData.age) : null;
      if (!finalAge && profileData.birthDate) {
        finalAge = calculateAge(profileData.birthDate);
      }

      // Prepare the data object - combine first_name and last_name into full_name
      const fullName = `${profileData.firstName.trim()} ${profileData.lastName.trim()}`.trim();
      
      // Normalize phone number (remove spaces and dashes) before saving
      const normalizedPhone = profileData.phone ? normalizePhoneForDatabase(profileData.phone) : null;
      
      const dataToSave = {
        user_id: user.id,
        full_name: fullName,
        email: profileData.email.trim(),
        phone: normalizedPhone || null,
        birth_date: profileData.birthDate || null,
        age: finalAge,
        gender: profileData.gender || null,
        dietary_preferences: profileData.dietaryPreferences?.trim() || null,
        food_allergies: profileData.foodAllergies?.trim() || null,
        medical_conditions: profileData.medicalConditions?.trim() || null,
        user_code: profileData.userCode?.trim() || null,
        region: profileData.region?.trim() || null,
        city: profileData.city?.trim() || null,
        timezone: profileData.timezone || null,
        user_language: profileData.userLanguage || null,
        updated_at: new Date().toISOString()
      };

      console.log('Attempting to save profile data:', dataToSave);

      // First, check if a record exists for this user
      const { data: existingData, error: checkError } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      let result;
      if (checkError && checkError.code === 'PGRST116') {
        // No existing record, insert new one
        result = await supabase
          .from('clients')
          .insert(dataToSave)
          .select();
      } else if (existingData) {
        // Record exists, update it
        result = await supabase
          .from('clients')
          .update({
            full_name: dataToSave.full_name,
            email: dataToSave.email,
            phone: dataToSave.phone,
            birth_date: dataToSave.birth_date,
            age: dataToSave.age,
            gender: dataToSave.gender,
            dietary_preferences: dataToSave.dietary_preferences,
            food_allergies: dataToSave.food_allergies,
            medical_conditions: dataToSave.medical_conditions,
            user_code: dataToSave.user_code,
            region: dataToSave.region,
            city: dataToSave.city,
            timezone: dataToSave.timezone,
            user_language: dataToSave.user_language,
            updated_at: dataToSave.updated_at
          })
          .eq('user_id', user.id)
          .select();
      } else {
        throw checkError;
      }

      const { data, error } = result;

      if (error) {
        console.error('Detailed error saving profile:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        
        // Provide more specific error messages based on error type
        let errorMessage = 'Error saving profile';
        if (error.code === '23505') {
          errorMessage = 'Email address already exists. Please use a different email.';
        } else if (error.code === '23503') {
          errorMessage = 'Invalid user reference. Please try logging in again.';
        } else if (error.message.includes('permission')) {
          errorMessage = 'Permission denied. Please check your account status.';
        } else if (error.message.includes('network') || error.message.includes('timeout')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
        
        setErrorMessage(errorMessage);
        setSaveStatus('error');
        console.error('User-friendly error:', errorMessage);
      } else {
        console.log('Profile saved successfully:', data);
        
        // Sync to chat_users table (secondary database)
        if (supabaseSecondary && data && data[0] && profileData.userCode) {
          try {
            console.log('Syncing profile to chat_users for user_code:', profileData.userCode);
            
            // Get the chat_users id using user_code
            const { data: chatUser, error: chatUserError } = await supabaseSecondary
              .from('chat_users')
              .select('id')
              .eq('user_code', profileData.userCode)
              .single();

            if (!chatUserError && chatUser) {
              // Map profile data to chat_users fields - sync all fields
              const chatUpdates = {
                full_name: dataToSave.full_name,
                email: dataToSave.email,
                phone_number: dataToSave.phone,
                whatsapp_number: dataToSave.phone, // Also update whatsapp_number
                region: dataToSave.region,
                city: dataToSave.city,
                timezone: dataToSave.timezone,
                age: dataToSave.age,
                gender: dataToSave.gender,
                date_of_birth: dataToSave.birth_date,
                food_allergies: dataToSave.food_allergies,
                food_limitations: dataToSave.dietary_preferences, // Map dietary_preferences to food_limitations
                medical_conditions: dataToSave.medical_conditions,
                language: dataToSave.user_language, // Map user_language to language
                updated_at: dataToSave.updated_at
              };

              const { error: chatUpdateError } = await supabaseSecondary
                .from('chat_users')
                .update(chatUpdates)
                .eq('id', chatUser.id);
              
              if (chatUpdateError) {
                console.error('Error updating chat_users:', chatUpdateError);
              } else {
                console.log('Chat user synced successfully with all fields');
              }
            }
          } catch (syncError) {
            console.error('Error syncing to chat_users:', syncError);
            // Don't throw - continue even if sync fails
          }
        }

        let assignmentErrorMessage = '';
        if (profileData.userCode && (profileData.companyId || '') !== (assignedCompanyId || '')) {
          const { error: assignmentError } = await assignClientToCompany(profileData.userCode, profileData.companyId || null);
          
          if (assignmentError) {
            assignmentErrorMessage = assignmentError.message || 'Failed to assign company manager. Please try again.';
            console.error('Error assigning client to company manager:', assignmentError);
          } else {
            setAssignedCompanyId(profileData.companyId || '');
          }
        }

        if (assignmentErrorMessage) {
          setErrorMessage(assignmentErrorMessage);
          setSaveStatus('error');
        } else {
          setSaveStatus('success');
          setTimeout(() => setSaveStatus(''), 3000);
        }
      }
    } catch (error) {
      console.error('Unexpected error saving profile:', error);
      setErrorMessage('An unexpected error occurred. Please try again.');
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  // Function to calculate age from birth date
  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age > 0 ? age : null;
  };

  const handleInputChange = (field, value) => {
    setProfileData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Auto-calculate age when birth date changes
      if (field === 'birthDate' && value) {
        const calculatedAge = calculateAge(value);
        if (calculatedAge) {
          newData.age = calculatedAge.toString();
        }
      }
      
      // Sync web language when user changes preferred language
      if (field === 'userLanguage' && value) {
        const languageMap = {
          'en': 'english',
          'he': 'hebrew',
          'english': 'english',
          'hebrew': 'hebrew'
        };
        
        const webLanguage = languageMap[value.toLowerCase()] || 'english';
        
        // Only change if different from current language
        if (language !== webLanguage) {
          toggleLanguage();
        }
      }
      
      return newData;
    });
  };

  const handleSave = () => {
    saveProfileData();
  };

  const tabs = [
    { 
      id: 'profile', 
      label: t.profile.tabs.profile,
      icon: '👤',
      description: language === 'hebrew' ? 'נהל את הפרטים האישיים שלך' : 'Manage your personal information'
    },
    { 
      id: 'myPlan', 
      label: t.profile.tabs.myPlan,
      icon: '🍽️',
      description: language === 'hebrew' ? 'תוכנית תזונה וכושר מותאמת אישית' : 'Personalized nutrition and fitness plan'
    },
    { 
      id: 'dailyLog', 
      label: t.profile.tabs.dailyLog,
      icon: '📝',
      description: language === 'hebrew' ? 'עקוב אחר צריכת המזון שלך' : 'Track your food intake'
    },
    { 
      id: 'messages', 
      label: t.profile.tabs.messages,
      icon: '💬',
      description: language === 'hebrew' ? 'תקשורת עם הדיאטנית שלך' : 'Communication with your dietitian'
    },
    { 
      id: 'pricing', 
      label: language === 'hebrew' ? 'תוכניות מנוי' : 'Subscription Plans',
      icon: '💳',
      description: language === 'hebrew' ? 'בחר את התוכנית המתאימה לך' : 'Choose your perfect plan'
    },
    { 
      id: 'settings', 
      label: language === 'hebrew' ? 'הגדרות' : 'Settings',
      icon: '⚙️',
      description: language === 'hebrew' ? 'התאם אישית את האפליקציה' : 'Customize your app experience'
    }
  ];

  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen ${themeClasses.bgPrimary} flex items-center justify-center`}>
        <div className={`${themeClasses.bgCard} ${themeClasses.shadowCard} rounded-lg p-8 max-w-md w-full mx-4`}>
          <h2 className={`${themeClasses.textPrimary} text-2xl font-bold text-center mb-4`}>
            {t.buttons.login}
          </h2>
          <p className={`${themeClasses.textSecondary} text-center`}>
            Please log in to access your profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClasses.bgPrimary} flex flex-col lg:flex-row language-transition language-text-transition`} dir={direction}>
      {/* Sidebar Navigation - Desktop */}
      <div className={`hidden lg:block lg:w-80 ${themeClasses.bgCard} ${themeClasses.shadowCard} border-r ${themeClasses.borderPrimary}`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-4">
            <img src="/favicon.ico" alt="BetterChoice Logo" className="w-12 h-12 mr-3 rounded-lg shadow-md" />
            <div>
              <h1 className={`${themeClasses.textPrimary} text-xl font-bold`}>BetterChoice</h1>
              <p className={`${themeClasses.textSecondary} text-sm`}>{t.profile.title}</p>
            </div>
          </div>
          
          {/* Control Buttons */}
          <div className="space-y-3">
            {/* Go Back to Home */}
            <Link 
              to="/"
              className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 hover:${themeClasses.bgSecondary} ${themeClasses.bgSecondary}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${themeClasses.bgSecondary} ${themeClasses.textPrimary}`}>
                <span className="text-sm">🏠</span>
              </div>
              <div className="flex-1 text-left">
                <div className={`font-semibold ${themeClasses.textPrimary} text-sm`}>
                  {language === 'hebrew' ? 'חזור לעמוד הבית' : 'Return to Home'}
                </div>
                <div className={`text-xs ${themeClasses.textMuted}`}>
                  {language === 'hebrew' ? 'חזור לעמוד הראשי' : 'Go back to the main homepage'}
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="p-4">
          <nav className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center p-4 rounded-lg transition-all duration-200 ${
                  activeTab === tab.id
                    ? `${themeClasses.bgSecondary} ${themeClasses.shadowCard}`
                    : `hover:${themeClasses.bgSecondary}`
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-4 ${
                  activeTab === tab.id 
                    ? 'bg-emerald-500 text-white' 
                    : `${themeClasses.bgSecondary} ${themeClasses.textPrimary}`
                }`}>
                  <span className="text-lg">{tab.icon}</span>
                </div>
                <div className="flex-1 text-left">
                  <div className={`font-semibold ${
                    activeTab === tab.id ? themeClasses.textPrimary : themeClasses.textSecondary
                  }`}>
                    {tab.label}
                  </div>
                  <div className={`text-sm ${
                    activeTab === tab.id ? themeClasses.textSecondary : themeClasses.textMuted
                  }`}>
                    {tab.description}
                  </div>
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Bottom Controls */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            {/* Language Control */}
            <div className="flex items-center">
              <button 
                onClick={toggleLanguage}
                className={`${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} rounded-xl p-3 transition-all duration-200 shadow-md`}
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-blue-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd"/>
                  </svg>
                  <span className="text-blue-400 text-sm font-medium">{language === 'hebrew' ? 'עב' : 'En'}</span>
                </div>
              </button>
              <span className={`${themeClasses.textSecondary} text-sm ml-3`}>Language</span>
            </div>

            {/* Theme Control */}
            <div className="flex items-center">
              <button 
                onClick={toggleTheme}
                className={`${themeClasses.bgCard} border border-emerald-500/20 rounded-full p-3 hover:${themeClasses.bgSecondary} transition-all duration-200 shadow-lg shadow-emerald-500/10`}
              >
                {isDarkMode ? (
                  <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
                  </svg>
                )}
              </button>
              <span className={`${themeClasses.textSecondary} text-sm ml-3`}>Theme</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header - Shows on mobile only */}
      <div className={`lg:hidden ${themeClasses.bgCard} ${themeClasses.shadowCard} border-b ${themeClasses.borderPrimary} p-4`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <img src="/favicon.ico" alt="BetterChoice Logo" className="w-10 h-10 mr-3 rounded-lg shadow-md" />
            <div>
              <h1 className={`${themeClasses.textPrimary} text-lg font-bold`}>BetterChoice</h1>
              <p className={`${themeClasses.textSecondary} text-xs`}>{t.profile.title}</p>
            </div>
          </div>
          
          <Link 
            to="/"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${themeClasses.bgSecondary} ${themeClasses.textPrimary} text-sm`}
          >
            <span>🏠</span>
            <span className="hidden sm:inline">{language === 'hebrew' ? 'בית' : 'Home'}</span>
          </Link>
        </div>

        {/* Mobile Tab Navigation - Horizontal Scroll */}
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex gap-2 min-w-max pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-emerald-500 text-white shadow-md'
                    : `${themeClasses.bgSecondary} ${themeClasses.textSecondary}`
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Theme and Language Controls - Mobile */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button 
            onClick={toggleLanguage}
            className={`${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} rounded-lg p-2 transition-all duration-200`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd"/>
              </svg>
              <span className="text-blue-400 text-xs font-medium">{language === 'hebrew' ? 'עב' : 'En'}</span>
            </div>
          </button>

          <button 
            onClick={toggleTheme}
            className={`${themeClasses.bgCard} border border-emerald-500/20 rounded-full p-2 hover:${themeClasses.bgSecondary} transition-all duration-200`}
          >
            {isDarkMode ? (
              <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd"/>
              </svg>
            ) : (
              <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 sm:p-6 md:p-8">
        <div className={`${themeClasses.bgCard} ${themeClasses.shadowCard} rounded-lg p-6 h-full language-transition language-text-transition`}>
          {activeTab === 'profile' && (
            <ProfileTab
              profileData={profileData}
              onInputChange={handleInputChange}
              onSave={handleSave}
              isSaving={isSaving}
              saveStatus={saveStatus}
              errorMessage={errorMessage}
              themeClasses={themeClasses}
            t={t}
            companyOptions={companyOptions}
            isLoadingCompanies={isLoadingCompanies}
            companyError={companyError}
            language={language}
            onboardingCompleted={onboardingCompleted}
            />
          )}
          {activeTab === 'myPlan' && (
            <MyPlanTab themeClasses={themeClasses} t={t} userCode={profileData.userCode} language={language} clientRegion={profileData.region} />
          )}
          {activeTab === 'dailyLog' && (
            <DailyLogTab themeClasses={themeClasses} t={t} userCode={profileData.userCode} language={language} />
          )}
          {activeTab === 'messages' && (
            <MessagesTab themeClasses={themeClasses} t={t} userCode={profileData.userCode} activeTab={activeTab} language={language} />
          )}
          {activeTab === 'pricing' && (
            <PricingTab themeClasses={themeClasses} user={user} language={language} />
          )}
          {activeTab === 'settings' && (
            <SettingsTab themeClasses={themeClasses} language={language} userCode={profileData.userCode} />
          )}
        </div>

        {/* Onboarding Modal */}
        <OnboardingModal
          isOpen={showOnboarding}
          onClose={handleOnboardingComplete}
          user={user}
          userCode={userCode}
        />
      </div>
    </div>
  );
};

// Profile Tab Component
const ProfileTab = ({ profileData, onInputChange, onSave, isSaving, saveStatus, errorMessage, themeClasses, t, companyOptions, isLoadingCompanies, companyError, language, onboardingCompleted = false }) => {
  // Helper function to check if a field should be shown (if onboarding not completed, only show non-null fields)
  const shouldShowField = (fieldValue) => {
    if (onboardingCompleted === true) return true; // Show all fields if onboarding is completed
    return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''; // Only show non-null fields if skipped
  };

  // Personal Information fields are always read-only - cannot be edited
  const isReadOnly = true;

  return (
    <div className={`${themeClasses.bgPrimary} min-h-screen p-4 sm:p-6 md:p-8 animate-fadeIn`}>
      {/* Header Section */}
      <div className="mb-8 sm:mb-10 md:mb-12 animate-slideInUp">
        <div className="flex items-center mb-6 sm:mb-8">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mr-3 sm:mr-4 shadow-lg shadow-indigo-500/25 animate-pulse">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
            </svg>
          </div>
    <div>
            <h2 className="text-white text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">{t.profile.profileTab.title}</h2>
            <p className="text-slate-400 text-sm sm:text-base mt-1">{t.profile.profileTab.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 sm:space-y-8">
        {/* Personal Information */}
        <div className={`${themeClasses.bgCard} border border-indigo-500/30 rounded-2xl p-4 sm:p-6 md:p-8 shadow-xl shadow-indigo-500/10 transform hover:scale-[1.01] transition-all duration-300 animate-slideInUp`} style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center mb-6 sm:mb-8">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mr-3 sm:mr-4 shadow-lg shadow-indigo-500/25">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
              </svg>
            </div>
            <div>
              <h3 className={`${themeClasses.textPrimary} text-lg sm:text-xl font-bold tracking-tight`}>
                {t.profile.profileTab.personalInfo}
              </h3>
              <p className={`${themeClasses.textSecondary} text-xs sm:text-sm mt-1`}>
                {language === 'hebrew' ? 'פרטים אישיים - לא ניתן לערוך' : 'Your basic personal details - Read only'}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {shouldShowField(profileData.firstName) && (
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {t.profile.profileTab.firstName} *
              </label>
              <input
                type="text"
                value={profileData.firstName}
                onChange={(e) => onInputChange('firstName', e.target.value)}
                readOnly={isReadOnly}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                  isReadOnly 
                    ? 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed' 
                    : `${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800`
                }`}
                required
              />
            </div>
            )}

            {shouldShowField(profileData.lastName) && (
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {t.profile.profileTab.lastName} *
              </label>
              <input
                type="text"
                value={profileData.lastName}
                onChange={(e) => onInputChange('lastName', e.target.value)}
                readOnly={isReadOnly}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                  isReadOnly 
                    ? 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed' 
                    : `${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800`
                }`}
                required
              />
            </div>
            )}

            {shouldShowField(profileData.email) && (
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {t.profile.profileTab.email} *
              </label>
              <input
                type="email"
                value={profileData.email}
                onChange={(e) => onInputChange('email', e.target.value)}
                readOnly={isReadOnly}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                  isReadOnly 
                    ? 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed' 
                    : `${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800`
                }`}
                required
              />
            </div>
            )}

            {shouldShowField(profileData.phone) && (
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {t.profile.profileTab.phone}
              </label>
              <input
                type="tel"
                value={profileData.phone}
                onChange={(e) => onInputChange('phone', e.target.value)}
                readOnly={isReadOnly}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                  isReadOnly 
                    ? 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed' 
                    : `${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800`
                }`}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            )}

            {shouldShowField(profileData.birthDate) && (
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                Birth Date
              </label>
              <input
                type="date"
                value={profileData.birthDate}
                onChange={(e) => onInputChange('birthDate', e.target.value)}
                readOnly={isReadOnly}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                  isReadOnly 
                    ? 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed' 
                    : `${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800`
                }`}
              />
            </div>
            )}

            {shouldShowField(profileData.age) && (
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                Age {profileData.birthDate ? '(Auto-calculated)' : ''}
              </label>
              <input
                type="number"
                value={profileData.age}
                onChange={(e) => onInputChange('age', e.target.value)}
                readOnly={isReadOnly || !!profileData.birthDate}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                  (isReadOnly || profileData.birthDate)
                    ? 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed' 
                    : `${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800`
                }`}
                placeholder="25"
                min="1"
                max="120"
              />
              {profileData.birthDate && (
                <p className={`${themeClasses.textMuted} text-xs mt-1`}>
                  Age is automatically calculated from your birth date
                </p>
              )}
            </div>
            )}

            {shouldShowField(profileData.gender) && (
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                Gender
              </label>
              <select
                value={profileData.gender}
                onChange={(e) => onInputChange('gender', e.target.value)}
                disabled={isReadOnly}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                  isReadOnly 
                    ? 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed' 
                    : `${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800`
                }`}
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
            )}

            <div className="md:col-span-2">
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                User Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={profileData.userCode}
                  readOnly
                  className={`w-full px-4 py-3 rounded-lg border-2 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed`}
                  placeholder="Auto-generated during signup"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Auto-generated</span>
                </div>
              </div>
              <p className={`${themeClasses.textMuted} text-xs mt-1`}>
                Your unique 6-letter user code (generated automatically)
              </p>
            </div>
          </div>
        </div>

        {/* Location Information */}
        <div className={`${themeClasses.bgSecondary} rounded-xl p-4 sm:p-6 border-l-4 border-purple-500`}>
          <div className="flex items-center mb-4 sm:mb-6">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mr-3">
              <span className="text-purple-600 dark:text-purple-400 text-base sm:text-lg">📍</span>
            </div>
            <div>
              <h3 className={`${themeClasses.textPrimary} text-lg sm:text-xl font-bold`}>
                Location Information
              </h3>
              <p className={`${themeClasses.textSecondary} text-xs sm:text-sm`}>
                Help us provide location-specific recommendations
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                Region
              </label>
              <select
                value={profileData.region}
                onChange={(e) => onInputChange('region', e.target.value)}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800`}
              >
                <option value="">Select Region</option>
                <option value="Israel">Israel</option>
                <option value="North America">North America</option>
                <option value="South America">South America</option>
                <option value="Europe">Europe</option>
                <option value="Asia">Asia</option>
                <option value="Africa">Africa</option>
                <option value="Oceania">Oceania</option>
                <option value="Middle East">Middle East</option>
                <option value="Caribbean">Caribbean</option>
                <option value="Central America">Central America</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                City
              </label>
              <input
                type="text"
                value={profileData.city}
                onChange={(e) => onInputChange('city', e.target.value)}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800`}
                placeholder="Tel Aviv"
              />
            </div>

            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                Timezone
              </label>
              <select
                value={profileData.timezone}
                onChange={(e) => onInputChange('timezone', e.target.value)}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800`}
              >
                <option value="">Select Timezone</option>
                <optgroup label="Israel & Middle East">
                  <option value="Asia/Jerusalem">Asia/Jerusalem (Israel)</option>
                  <option value="Asia/Dubai">Asia/Dubai (UAE)</option>
                  <option value="Asia/Riyadh">Asia/Riyadh (Saudi Arabia)</option>
                  <option value="Asia/Tehran">Asia/Tehran (Iran)</option>
                </optgroup>
                <optgroup label="Europe">
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="Europe/Paris">Europe/Paris (CET)</option>
                  <option value="Europe/Berlin">Europe/Berlin (CET)</option>
                  <option value="Europe/Rome">Europe/Rome (CET)</option>
                  <option value="Europe/Madrid">Europe/Madrid (CET)</option>
                  <option value="Europe/Amsterdam">Europe/Amsterdam (CET)</option>
                  <option value="Europe/Moscow">Europe/Moscow (MSK)</option>
                </optgroup>
                <optgroup label="North America">
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="America/Chicago">America/Chicago (CST)</option>
                  <option value="America/Denver">America/Denver (MST)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                  <option value="America/Toronto">America/Toronto (EST)</option>
                  <option value="America/Vancouver">America/Vancouver (PST)</option>
                </optgroup>
                <optgroup label="Asia">
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
                  <option value="Asia/Hong_Kong">Asia/Hong_Kong (HKT)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="Asia/Seoul">Asia/Seoul (KST)</option>
                  <option value="Asia/Bangkok">Asia/Bangkok (ICT)</option>
                </optgroup>
                <optgroup label="Oceania">
                  <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                  <option value="Australia/Melbourne">Australia/Melbourne (AEST)</option>
                  <option value="Australia/Perth">Australia/Perth (AWST)</option>
                  <option value="Pacific/Auckland">Pacific/Auckland (NZST)</option>
                </optgroup>
                <optgroup label="South America">
                  <option value="America/Sao_Paulo">America/Sao_Paulo (BRT)</option>
                  <option value="America/Buenos_Aires">America/Buenos_Aires (ART)</option>
                  <option value="America/Lima">America/Lima (PET)</option>
                </optgroup>
                <optgroup label="Africa">
                  <option value="Africa/Cairo">Africa/Cairo (EET)</option>
                  <option value="Africa/Johannesburg">Africa/Johannesburg (SAST)</option>
                  <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                </optgroup>
              </select>
            </div>
          </div>

          <div className="mt-6">
            <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
              {language === 'hebrew' ? 'חברה (לא חובה)' : 'Company (optional)'}
            </label>
            {companyError && (
              <p className="text-red-500 text-xs mb-2">
                {companyError}
              </p>
            )}
            <select
              value={profileData.companyId || ''}
              onChange={(e) => onInputChange('companyId', e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800`}
              disabled={isLoadingCompanies || (!isLoadingCompanies && companyOptions.length === 0)}
            >
              <option value="">{language === 'hebrew' ? 'ללא חברה' : 'No company'}</option>
              {companyOptions.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            {isLoadingCompanies && (
              <p className={`${themeClasses.textSecondary} text-xs mt-2`}>
                {language === 'hebrew' ? 'טוען רשימת חברות...' : 'Loading companies...'}
              </p>
            )}
            {!isLoadingCompanies && companyOptions.length === 0 && !companyError && (
              <p className={`${themeClasses.textSecondary} text-xs mt-2`}>
                {language === 'hebrew' ? 'לא נמצאו חברות זמינות' : 'No companies available'}
              </p>
            )}
            <p className={`${themeClasses.textMuted} text-xs mt-2`}>
              {language === 'hebrew'
                ? 'בחירת חברה תחבר אותך אוטומטית למנהל החברה בצ׳אט.'
                : 'Selecting a company automatically assigns you to that company’s manager in chat.'}
            </p>
          </div>

          {/* Preferred Language */}
          <div className="mt-6">
            <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
              Preferred Language
            </label>
            <select
              value={profileData.userLanguage}
              onChange={(e) => onInputChange('userLanguage', e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800`}
            >
              <option value="">Select Language</option>
              <option value="en">English</option>
              <option value="he">עברית (Hebrew)</option>
              <option value="es">Español (Spanish)</option>
              <option value="fr">Français (French)</option>
              <option value="de">Deutsch (German)</option>
              <option value="it">Italiano (Italian)</option>
              <option value="pt">Português (Portuguese)</option>
              <option value="ru">Русский (Russian)</option>
              <option value="ar">العربية (Arabic)</option>
              <option value="zh">中文 (Chinese)</option>
              <option value="ja">日本語 (Japanese)</option>
              <option value="ko">한국어 (Korean)</option>
            </select>
            <p className={`${themeClasses.textMuted} text-xs mt-1`}>
              This will be used for chat interactions and meal plan communications
            </p>
          </div>
        </div>

        {/* Health Information */}
        <div className={`${themeClasses.bgSecondary} rounded-xl p-4 sm:p-6 border-l-4 border-emerald-500`}>
          <div className="flex items-center mb-4 sm:mb-6">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-100 dark:bg-emerald-900 rounded-lg flex items-center justify-center mr-3">
              <span className="text-emerald-600 dark:text-emerald-400 text-base sm:text-lg">🏥</span>
            </div>
            <div>
              <h3 className={`${themeClasses.textPrimary} text-lg sm:text-xl font-bold`}>
                Health Information
              </h3>
              <p className={`${themeClasses.textSecondary} text-xs sm:text-sm`}>
                Optional - provide your health details if relevant
              </p>
            </div>
          </div>
          
          <div className="space-y-4 sm:space-y-6">
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-3`}>
                Dietary Preferences
              </label>
              <textarea
                value={profileData.dietaryPreferences}
                onChange={(e) => onInputChange('dietaryPreferences', e.target.value)}
                rows={3}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800`}
                placeholder="e.g., Vegetarian, Vegan, Gluten-free, Mediterranean diet..."
              />
            </div>

            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-3`}>
                Food Allergies
              </label>
              <textarea
                value={profileData.foodAllergies}
                onChange={(e) => onInputChange('foodAllergies', e.target.value)}
                rows={3}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800`}
                placeholder="e.g., Nuts, Shellfish, Dairy, Soy..."
              />
            </div>

            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-3`}>
                Medical Conditions
              </label>
              <textarea
                value={profileData.medicalConditions}
                onChange={(e) => onInputChange('medicalConditions', e.target.value)}
                rows={3}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800`}
                placeholder="e.g., Diabetes, Hypertension, Heart condition..."
              />
            </div>
          </div>
        </div>

      </div>

      {/* Save Button */}
      <div className="mt-6 sm:mt-8 flex justify-end">
        <button
          onClick={onSave}
          disabled={isSaving}
          className={`w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg transition-all duration-200 transform hover:scale-105 ${
            isSaving
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg hover:shadow-xl'
          } text-white`}
        >
          {isSaving ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              {t.profile.profileTab.saving}
            </div>
          ) : (
            <div className="flex items-center">
              <span className="mr-2">💾</span>
              {t.profile.profileTab.saveChanges}
            </div>
          )}
        </button>
      </div>

      {/* Save Status */}
      {saveStatus && (
        <div className={`mt-6 p-4 rounded-xl border-l-4 ${
          saveStatus === 'success' 
            ? 'bg-green-50 border-green-400 dark:bg-green-900/20 dark:border-green-500' 
            : 'bg-red-50 border-red-400 dark:bg-red-900/20 dark:border-red-500'
        }`}>
          <div className="flex items-center">
            <span className="text-2xl mr-3">
              {saveStatus === 'success' ? '✅' : '❌'}
            </span>
            <p className={`text-sm font-medium ${
              saveStatus === 'success' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
            }`}>
              {saveStatus === 'success' ? t.profile.profileTab.saved : (errorMessage || 'Error saving profile')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// My Plan Tab Component
const MyPlanTab = ({ themeClasses, t, userCode, language, clientRegion }) => {
  const { settings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [planData, setPlanData] = useState(null);
  const [originalPlanData, setOriginalPlanData] = useState(null);
  const [error, setError] = useState('');
  const [expandedMeals, setExpandedMeals] = useState({});
  const [isTranslating, setIsTranslating] = useState(false);
  
  // Helper function to format numbers with decimal places
  const formatNumber = (num) => {
    if (settings.decimalPlaces === 0) {
      return Math.round(num).toString();
    }
    return num.toFixed(settings.decimalPlaces);
  };
  
  // Helper function to convert weight based on weightUnit setting
  const convertWeight = (grams) => {
    if (settings.weightUnit === 'ounces') {
      // Convert grams to ounces (1 gram = 0.035274 ounces)
      return grams * 0.035274;
    }
    return grams; // Return grams if weightUnit is 'grams'
  };
  
  // Helper function to get weight unit label
  const getWeightUnit = () => {
    return settings.weightUnit === 'ounces' ? 'oz' : 'g';
  };
  
  // Helper function to format weight with unit
  const formatWeight = (grams) => {
    const value = convertWeight(grams);
    const unit = getWeightUnit();
    return `${formatNumber(value)}${unit}`;
  };
  
  // Helper function to format portion display
  const formatPortion = (ingredient) => {
    const portion = ingredient['portionSI(gram)'] || 0;
    const household = ingredient.household_measure || '';
    const convertedPortion = convertWeight(portion);
    const unit = getWeightUnit();
    
    if (settings.portionDisplay === 'grams') {
      return `${formatNumber(convertedPortion)}${unit}`;
    } else if (settings.portionDisplay === 'household') {
      return household || `${formatNumber(convertedPortion)}${unit}`;
    } else { // both
      if (household) {
        return `${household} (${formatNumber(convertedPortion)}${unit})`;
      }
      return `${formatNumber(convertedPortion)}${unit}`;
    }
  };
  const [isAddIngredientModalVisible, setIsAddIngredientModalVisible] = useState(false);
  const [selectedMealIndex, setSelectedMealIndex] = useState(null);
  const [isEditPortionModalVisible, setIsEditPortionModalVisible] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [editingIngredientIndex, setEditingIngredientIndex] = useState(null);

  useEffect(() => {
    const loadMealPlan = async () => {
      if (!userCode) {
        setError('User code not available');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await getClientMealPlan(userCode);
        
        if (error) {
          console.error('Error loading meal plan:', error);
          setError(error.message);
        } else if (data) {
          // Process the meal plan data
          let mealPlan = data.meal_plan;
          console.log('Processing meal plan data:', mealPlan);
          
          if (mealPlan && mealPlan.meals) {
            // Translate meal plan if language is Hebrew
            if (language === 'hebrew') {
              try {
                setIsTranslating(true);
                console.log('🌐 Starting translation for meal plan with', mealPlan.meals.length, 'meals');
                
                // Log sample data before translation
                if (mealPlan.meals[0]?.main) {
                  console.log('📝 Before translation - Sample meal:', {
                    meal: mealPlan.meals[0].meal,
                    title: mealPlan.meals[0].main.meal_title,
                    firstIngredient: mealPlan.meals[0].main.ingredients?.[0]
                  });
                }
                
                const translatedMealPlan = await translateMenu(mealPlan, 'he');
                
                if (translatedMealPlan && translatedMealPlan.meals) {
                  // Log sample data after translation
                  if (translatedMealPlan.meals[0]?.main) {
                    console.log('✅ After translation - Sample meal:', {
                      meal: translatedMealPlan.meals[0].meal,
                      title: translatedMealPlan.meals[0].main.meal_title,
                      firstIngredient: translatedMealPlan.meals[0].main.ingredients?.[0]
                    });
                  }
                  
                  mealPlan = translatedMealPlan;
                  console.log('✅ Meal plan translated to Hebrew successfully');
                }
              } catch (translateError) {
                console.error('❌ Translation error (using original):', translateError);
                // Continue with original meal plan
              } finally {
                setIsTranslating(false);
              }
            }

            // Calculate totals from the meals array
            const totals = mealPlan.meals.reduce((acc, meal) => {
              if (meal.main && meal.main.nutrition) {
                acc.calories += meal.main.nutrition.calories || 0;
                acc.protein += meal.main.nutrition.protein || 0;
                acc.carbs += meal.main.nutrition.carbs || 0;
                acc.fat += meal.main.nutrition.fat || 0;
              }
              return acc;
            }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

            setPlanData({
              ...data,
              totals,
              meals: mealPlan.meals
            });

            // Store original dietitian plan if user has edited plan from today
            if (data.dietitian_meal_plan && data.dietitian_meal_plan.meals && data.isClientEdited) {
              const originalTotals = data.dietitian_meal_plan.totals || data.dietitian_meal_plan.meals.reduce((acc, meal) => {
                if (meal.main && meal.main.nutrition) {
                  acc.calories += meal.main.nutrition.calories || 0;
                  acc.protein += meal.main.nutrition.protein || 0;
                  acc.carbs += meal.main.nutrition.carbs || 0;
                  acc.fat += meal.main.nutrition.fat || 0;
                }
                return acc;
              }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

              setOriginalPlanData({
                ...data,
                totals: originalTotals,
                meals: data.dietitian_meal_plan.meals,
                isClientEdited: false
              });
            }
          } else if (mealPlan && mealPlan.template) {
            // Fallback for template structure
            const totals = mealPlan.template.reduce((acc, meal) => {
              acc.calories += meal.main.calories;
              acc.protein += meal.main.protein;
              acc.carbs += meal.main.carbs;
              acc.fat += meal.main.fat;
              return acc;
            }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

            setPlanData({
              ...data,
              totals,
              meals: mealPlan.template
            });
          } else {
            console.error('No meals or template found in meal plan:', mealPlan);
            setError('No meal plan template found');
          }
        } else {
          setError('No active meal plan found');
        }
      } catch (err) {
        console.error('Unexpected error loading meal plan:', err);
        setError('Failed to load meal plan');
      } finally {
        setLoading(false);
      }
    };

    loadMealPlan();
  }, [userCode, language]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className={`${themeClasses.textSecondary}`}>
            {isTranslating 
              ? (language === 'hebrew' ? 'מתרגם תוכנית תזונה...' : 'Translating meal plan...') 
              : t.profile.myPlanTab.loading
            }
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className={`${themeClasses.textPrimary} text-xl font-semibold mb-2`}>
          {t.profile.myPlanTab.noPlan}
        </div>
        <p className={`${themeClasses.textSecondary} mb-4`}>
          {error}
        </p>
        <p className={`${themeClasses.textSecondary} text-sm`}>
          {t.profile.myPlanTab.noPlanDescription}
        </p>
      </div>
    );
  }

  if (!planData) {
    return (
      <div className="text-center py-12">
        <div className={`${themeClasses.textPrimary} text-xl font-semibold mb-2`}>
          {t.profile.myPlanTab.noPlan}
        </div>
        <p className={`${themeClasses.textSecondary}`}>
          {t.profile.myPlanTab.noPlanDescription}
        </p>
      </div>
    );
  }

  // Calculate macro percentages based on calories (not grams)
  // Protein: 4 calories per gram, Carbs: 4 calories per gram, Fat: 9 calories per gram
  const proteinCalories = planData.totals.protein * 4;
  const carbsCalories = planData.totals.carbs * 4;
  const fatCalories = planData.totals.fat * 9;
  const totalMacroCalories = proteinCalories + carbsCalories + fatCalories;
  
  const proteinPercentage = totalMacroCalories > 0 ? Math.round((proteinCalories / totalMacroCalories) * 100) : 0;
  const carbsPercentage = totalMacroCalories > 0 ? Math.round((carbsCalories / totalMacroCalories) * 100) : 0;
  const fatPercentage = totalMacroCalories > 0 ? Math.round((fatCalories / totalMacroCalories) * 100) : 0;

  // Get meal icons
  const getMealIcon = (mealName) => {
    const name = mealName.toLowerCase();
    if (name.includes('breakfast') || name.includes('בוקר')) return '🌅';
    if (name.includes('lunch') || name.includes('צהריים')) return '☀️';
    if (name.includes('dinner') || name.includes('ערב')) return '🌙';
    if (name.includes('snack') || name.includes('חטיף')) return '🍎';
    return '🍽️';
  };

  // Get meal color
  const getMealColor = (mealName) => {
    const name = mealName.toLowerCase();
    if (name.includes('breakfast') || name.includes('בוקר')) return 'text-yellow-400';
    if (name.includes('lunch') || name.includes('צהריים')) return 'text-orange-400';
    if (name.includes('dinner') || name.includes('ערב')) return 'text-blue-400';
    if (name.includes('snack') || name.includes('חטיף')) return 'text-purple-400';
    return 'text-emerald-400';
  };

  // Toggle meal expansion
  const toggleMealExpansion = (mealIndex) => {
    setExpandedMeals(prev => ({
      ...prev,
      [mealIndex]: !prev[mealIndex]
    }));
  };

  // Open add ingredient modal
  const handleOpenAddIngredient = (mealIndex) => {
    setSelectedMealIndex(mealIndex);
    setIsAddIngredientModalVisible(true);
  };

  // Helper function to ensure originalPlanData is set before making edits
  const ensureOriginalPlanData = () => {
    if (!originalPlanData && planData) {
      // Store the current plan as the original before first edit
      const originalTotals = planData.totals || planData.meals.reduce((acc, meal) => {
        if (meal.main && meal.main.nutrition) {
          acc.calories += meal.main.nutrition.calories || 0;
          acc.protein += meal.main.nutrition.protein || 0;
          acc.carbs += meal.main.nutrition.carbs || 0;
          acc.fat += meal.main.nutrition.fat || 0;
        }
        return acc;
      }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

      setOriginalPlanData({
        ...planData,
        totals: originalTotals,
        meals: JSON.parse(JSON.stringify(planData.meals)), // Deep clone
        isClientEdited: false
      });
    }
  };

  // Add ingredient to meal
  const handleAddIngredient = async (ingredient) => {
    if (selectedMealIndex === null || !planData) return;

    try {
      // Ensure original plan data is stored before making edits
      ensureOriginalPlanData();

      // Clone the current plan data
      const updatedPlanData = { ...planData };
      const updatedMeals = [...updatedPlanData.meals];
      const mealToUpdate = { ...updatedMeals[selectedMealIndex] };

      // Initialize ingredients array if it doesn't exist
      if (!mealToUpdate.main.ingredients) {
        mealToUpdate.main.ingredients = [];
      }

      // Add the new ingredient
      mealToUpdate.main.ingredients = [...mealToUpdate.main.ingredients, ingredient];

      // Update nutrition values
      const currentNutrition = mealToUpdate.main.nutrition || {};
      mealToUpdate.main.nutrition = {
        calories: (currentNutrition.calories || 0) + ingredient.calories,
        protein: (currentNutrition.protein || 0) + ingredient.protein,
        carbs: (currentNutrition.carbs || 0) + ingredient.carbs,
        fat: (currentNutrition.fat || 0) + ingredient.fat,
      };

      // Update the meal in the meals array
      updatedMeals[selectedMealIndex] = mealToUpdate;
      updatedPlanData.meals = updatedMeals;

      // Recalculate totals
      const newTotals = updatedMeals.reduce(
        (acc, meal) => {
          if (meal.main && meal.main.nutrition) {
            acc.calories += meal.main.nutrition.calories || 0;
            acc.protein += meal.main.nutrition.protein || 0;
            acc.carbs += meal.main.nutrition.carbs || 0;
            acc.fat += meal.main.nutrition.fat || 0;
          }
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      updatedPlanData.totals = newTotals;
      updatedPlanData.isClientEdited = true; // Mark as edited

      // Update local state
      setPlanData(updatedPlanData);

      // Save to database
      await saveMealPlanToDatabase(updatedPlanData, updatedMeals);

      // Show success message
      alert(
        language === 'hebrew'
          ? 'המרכיב נוסף בהצלחה לתוכנית'
          : 'Ingredient added successfully to the meal plan'
      );
    } catch (error) {
      console.error('Error adding ingredient:', error);
      alert(
        language === 'hebrew'
          ? 'לא ניתן להוסיף את המרכיב. נסה שוב.'
          : 'Failed to add ingredient. Please try again.'
      );
    }
  };

  // Handle edit ingredient
  const handleEditIngredient = (mealIndex, ingredientIndex, ingredient) => {
    setSelectedMealIndex(mealIndex);
    setEditingIngredientIndex(ingredientIndex);
    setEditingIngredient({
      ...ingredient,
      displayName: ingredient.item || ingredient.name || 'Unknown item',
      calories: ingredient.calories || 0,
      protein: ingredient.protein || 0,
      carbs: ingredient.carbs || 0,
      fat: ingredient.fat || 0,
    });
    setIsEditPortionModalVisible(true);
  };

  // Handle update ingredient portion
  const handleUpdateIngredientPortion = async ({ quantity: quantityNum, householdMeasure }) => {
    if (selectedMealIndex === null || editingIngredientIndex === null || !planData || !editingIngredient) return;

    try {
      // Ensure original plan data is stored before making edits
      ensureOriginalPlanData();

      // Clone the current plan data
      const updatedPlanData = { ...planData };
      const updatedMeals = [...updatedPlanData.meals];
      const mealToUpdate = { ...updatedMeals[selectedMealIndex] };

      // Get the old ingredient to subtract its nutrition
      const oldIngredient = mealToUpdate.main.ingredients[editingIngredientIndex];

      // Calculate new scaled nutrition values based on the original 100g values
      const originalScale = (oldIngredient['portionSI(gram)'] || 100) / 100;
      const original100gCalories = oldIngredient.calories / originalScale;
      const original100gProtein = oldIngredient.protein / originalScale;
      const original100gCarbs = oldIngredient.carbs / originalScale;
      const original100gFat = oldIngredient.fat / originalScale;

      // Now calculate new values with the new quantity
      const newScale = quantityNum / 100;
      const updatedIngredient = {
        UPC: oldIngredient.UPC || null,
        item: oldIngredient.item,
        'brand of pruduct': oldIngredient['brand of pruduct'] || '',
        household_measure: householdMeasure,
        'portionSI(gram)': quantityNum,
        calories: Math.round(original100gCalories * newScale),
        protein: Math.round(original100gProtein * newScale * 10) / 10,
        carbs: Math.round(original100gCarbs * newScale * 10) / 10,
        fat: Math.round(original100gFat * newScale * 10) / 10,
      };

      // Update the ingredient in the array
      mealToUpdate.main.ingredients[editingIngredientIndex] = updatedIngredient;

      // Recalculate meal nutrition (sum all ingredients)
      mealToUpdate.main.nutrition = mealToUpdate.main.ingredients.reduce(
        (acc, ing) => ({
          calories: acc.calories + (ing.calories || 0),
          protein: acc.protein + (ing.protein || 0),
          carbs: acc.carbs + (ing.carbs || 0),
          fat: acc.fat + (ing.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      // Update the meal in the meals array
      updatedMeals[selectedMealIndex] = mealToUpdate;
      updatedPlanData.meals = updatedMeals;

      // Recalculate totals
      const newTotals = updatedMeals.reduce(
        (acc, meal) => {
          if (meal.main && meal.main.nutrition) {
            acc.calories += meal.main.nutrition.calories || 0;
            acc.protein += meal.main.nutrition.protein || 0;
            acc.carbs += meal.main.nutrition.carbs || 0;
            acc.fat += meal.main.nutrition.fat || 0;
          }
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      updatedPlanData.totals = newTotals;
      updatedPlanData.isClientEdited = true; // Mark as edited

      // Update local state
      setPlanData(updatedPlanData);

      // Save to database
      await saveMealPlanToDatabase(updatedPlanData, updatedMeals);

      // Close modal and reset
      setIsEditPortionModalVisible(false);
      setEditingIngredient(null);
      setEditingIngredientIndex(null);

      // Show success message
      alert(
        language === 'hebrew'
          ? 'המרכיב עודכן בהצלחה'
          : 'Ingredient updated successfully'
      );
    } catch (error) {
      console.error('Error updating ingredient:', error);
      alert(
        language === 'hebrew'
          ? 'לא ניתן לעדכן את המרכיב. נסה שוב.'
          : 'Failed to update ingredient. Please try again.'
      );
    }
  };

  // Handle delete ingredient
  const handleDeleteIngredient = async (mealIndex, ingredientIndex) => {
    if (!planData) return;

    if (!window.confirm(
      language === 'hebrew'
        ? 'האם אתה בטוח שברצונך למחוק מרכיב זה?'
        : 'Are you sure you want to delete this ingredient?'
    )) {
      return;
    }

    try {
      // Ensure original plan data is stored before making edits
      ensureOriginalPlanData();

      // Clone the current plan data
      const updatedPlanData = { ...planData };
      const updatedMeals = [...updatedPlanData.meals];
      const mealToUpdate = { ...updatedMeals[mealIndex] };

      // Remove the ingredient
      mealToUpdate.main.ingredients.splice(ingredientIndex, 1);

      // Recalculate meal nutrition (sum remaining ingredients)
      mealToUpdate.main.nutrition = mealToUpdate.main.ingredients.reduce(
        (acc, ing) => ({
          calories: acc.calories + (ing.calories || 0),
          protein: acc.protein + (ing.protein || 0),
          carbs: acc.carbs + (ing.carbs || 0),
          fat: acc.fat + (ing.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      // Update the meal in the meals array
      updatedMeals[mealIndex] = mealToUpdate;
      updatedPlanData.meals = updatedMeals;

      // Recalculate totals
      const newTotals = updatedMeals.reduce(
        (acc, meal) => {
          if (meal.main && meal.main.nutrition) {
            acc.calories += meal.main.nutrition.calories || 0;
            acc.protein += meal.main.nutrition.protein || 0;
            acc.carbs += meal.main.nutrition.carbs || 0;
            acc.fat += meal.main.nutrition.fat || 0;
          }
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      updatedPlanData.totals = newTotals;
      updatedPlanData.isClientEdited = true; // Mark as edited

      // Update local state
      setPlanData(updatedPlanData);

      // Save to database
      await saveMealPlanToDatabase(updatedPlanData, updatedMeals);

      // Show success message
      alert(
        language === 'hebrew'
          ? 'המרכיב נמחק בהצלחה'
          : 'Ingredient deleted successfully'
      );
    } catch (error) {
      console.error('Error deleting ingredient:', error);
      alert(
        language === 'hebrew'
          ? 'לא ניתן למחוק את המרכיב. נסה שוב.'
          : 'Failed to delete ingredient. Please try again.'
      );
    }
  };

  // Save meal plan to database
  const saveMealPlanToDatabase = async (updatedPlanData, updatedMeals) => {
    if (!userCode || !updatedPlanData.id) return;

    try {
      // Prepare the meal plan object to save
      const mealPlanToSave = {
        meals: updatedMeals,
        totals: updatedPlanData.totals,
        note: updatedPlanData.note || '',
      };

      // Get today's date
      const today = new Date().toISOString();

      // Update the client_edited_meal_plan field with today's date
      const { error: updateError } = await supabase
        .from('client_meal_plans')
        .update({
          client_edited_meal_plan: mealPlanToSave,
          edited_plan_date: today,
        })
        .eq('id', updatedPlanData.id);

      if (updateError) {
        console.error('Error saving meal plan:', updateError);
        throw updateError;
      }

      console.log('✅ Meal plan saved successfully for today');
    } catch (error) {
      console.error('Error in saveMealPlanToDatabase:', error);
      throw error;
    }
  };

  // Switch to original plan (with confirmation and clearing edited plan)
  const handleViewOriginalPlan = async () => {
    if (!originalPlanData || !planData) return;

    if (!window.confirm(
      language === 'hebrew'
        ? 'השינויים שביצעת לא יישמרו. האם אתה בטוח?'
        : 'Your changes will not be saved. Are you sure?'
    )) {
      return;
    }

    try {
      // Clear the edited plan from database
      const { error: clearError } = await supabase
        .from('client_meal_plans')
        .update({
          client_edited_meal_plan: null,
          edited_plan_date: null,
        })
        .eq('id', planData.id);

      if (clearError) {
        console.error('Error clearing edited plan:', clearError);
      }

      // Update local state to show original plan
      setPlanData(originalPlanData);
      setOriginalPlanData(null); // Clear original data so button won't show

      alert(
        language === 'hebrew'
          ? 'חזרת לתפריט המקורי של הדיאטנית'
          : 'Returned to dietitian\'s original plan'
      );
    } catch (error) {
      console.error('Error returning to original:', error);
      alert(
        language === 'hebrew'
          ? 'לא ניתן לחזור לתפריט המקורי'
          : 'Could not return to original plan'
      );
    }
  };

  return (
    <div className={`${themeClasses.bgPrimary} min-h-screen p-4 sm:p-6 md:p-8 animate-fadeIn`}>
      {/* Daily Summary Section */}
      <div className="mb-6 sm:mb-8 md:mb-10 lg:mb-12 animate-slideInUp">
        <div className="flex items-center justify-between mb-4 sm:mb-6 md:mb-8">
          <div className="flex items-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mr-3 sm:mr-4 shadow-lg shadow-emerald-500/25 animate-pulse">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
              </svg>
            </div>
            <div>
              <h2 className={`${themeClasses.textPrimary} text-xl sm:text-2xl md:text-3xl font-bold tracking-tight`}>
                {language === 'hebrew' ? 'סיכום יומי' : 'Daily Summary'}
              </h2>
              <p className={`${themeClasses.textSecondary} text-sm sm:text-base mt-0.5 sm:mt-1`}>
                {planData.meal_plan_name || (language === 'hebrew' ? 'סה"כ ארוחות מתוכננות' : 'Total planned meals')}
                {planData.isClientEdited && (
                  <span className="text-emerald-500 font-bold ml-2">
                    • {language === 'hebrew' ? 'עריכה אישית' : 'Personalized'}
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
          {/* Translation Indicator */}
          {isTranslating && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span className="text-blue-400 text-xs sm:text-sm font-medium">
                {language === 'hebrew' ? 'מתרגם...' : 'Translating...'}
              </span>
            </div>
          )}
            
            {/* Reset Button */}
            {originalPlanData && (
              <button
                onClick={handleViewOriginalPlan}
                className="flex items-center gap-2 px-3 py-2 bg-red-500/15 border border-red-500/30 rounded-lg hover:bg-red-500/25 transition-colors"
              >
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-red-500 text-xs sm:text-sm font-semibold">
                  {language === 'hebrew' ? 'אפס' : 'Reset'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className={`grid gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8 ${
          settings.showCalories && settings.showMacros 
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' 
            : settings.showCalories || settings.showMacros
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            : 'grid-cols-1 sm:grid-cols-2'
        }`}>
          {/* Total Calories Card */}
          {settings.showCalories && (
          <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl sm:rounded-2xl p-5 sm:p-6 md:p-8 shadow-xl shadow-teal-500/20 transform hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-teal-500/30 animate-bounceIn text-center sm:text-left">
            <div className="text-white text-4xl sm:text-4xl md:text-5xl font-bold tracking-tight animate-countUp">{planData.totals.calories.toLocaleString()}</div>
            <div className="text-teal-100 text-base sm:text-lg font-semibold mt-1 sm:mt-2">
              {language === 'hebrew' ? 'קלוריות' : 'Calories'}
            </div>
          </div>
          )}

          {/* Protein Card */}
          {settings.showMacros && (
          <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-xl shadow-red-500/20 transform hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-red-500/30 animate-bounceIn text-center sm:text-left" style={{ animationDelay: '0.1s' }}>
              <div className="text-white text-3xl sm:text-3xl md:text-4xl font-bold tracking-tight">{formatWeight(planData.totals.protein)}</div>
            <div className="text-red-100 text-base sm:text-lg font-semibold mt-1">
              {language === 'hebrew' ? 'חלבון' : 'Protein'}
            </div>
            <div className="text-red-200 text-xs sm:text-sm mt-1 sm:mt-2">
              {proteinPercentage}% {language === 'hebrew' ? 'מהמקרו' : 'of macros'}
            </div>
          </div>
          )}

          {/* Carbs Card */}
          {settings.showMacros && (
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-xl shadow-blue-500/20 transform hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/30 animate-bounceIn text-center sm:text-left" style={{ animationDelay: '0.2s' }}>
              <div className="text-white text-3xl sm:text-3xl md:text-4xl font-bold tracking-tight">{formatWeight(planData.totals.carbs)}</div>
            <div className="text-blue-100 text-base sm:text-lg font-semibold mt-1">
              {language === 'hebrew' ? 'פחמימות' : 'Carbs'}
            </div>
            <div className="text-blue-200 text-xs sm:text-sm mt-1 sm:mt-2">
              {carbsPercentage}% {language === 'hebrew' ? 'מהמקרו' : 'of macros'}
            </div>
          </div>
          )}

          {/* Fat Card */}
          {settings.showMacros && (
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-xl shadow-amber-500/20 transform hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/30 animate-bounceIn text-center sm:text-left" style={{ animationDelay: '0.3s' }}>
              <div className="text-white text-3xl sm:text-3xl md:text-4xl font-bold tracking-tight">{formatWeight(planData.totals.fat)}</div>
            <div className="text-amber-100 text-base sm:text-lg font-semibold mt-1">
              {language === 'hebrew' ? 'שומן' : 'Fat'}
            </div>
            <div className="text-amber-200 text-xs sm:text-sm mt-1 sm:mt-2">
              {fatPercentage}% {language === 'hebrew' ? 'מהמקרו' : 'of macros'}
            </div>
          </div>
          )}
        </div>

        {/* Macro Distribution Bar */}
        {settings.showMacros && (
        <div className="animate-slideInUp" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <span className={`${themeClasses.textPrimary} text-base sm:text-lg md:text-xl font-semibold tracking-tight`}>
              {language === 'hebrew' ? 'התפלגות מקרו' : 'Macro Distribution'}
            </span>
            <span className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium`}>
              {language === 'hebrew' ? 'מקרו' : 'macros'}
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className={`${themeClasses.bgCard} rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg`}>
            <div className="flex h-8 sm:h-10 rounded-lg sm:rounded-xl overflow-hidden shadow-inner">
              <div 
                className="bg-gradient-to-r from-red-600 to-red-500 flex items-center justify-center text-white text-xs sm:text-sm font-semibold transition-all duration-1000 ease-out animate-progressBar"
                style={{ width: `${proteinPercentage}%` }}
              >
                {proteinPercentage > 15 && (
                  <div className="flex items-center">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full mr-1 sm:mr-2 animate-pulse"></div>
                    <span className="hidden sm:inline">{language === 'hebrew' ? 'חלבון' : 'Protein'} </span>{proteinPercentage}%
                  </div>
                )}
              </div>
              <div 
                className="bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-center text-white text-xs sm:text-sm font-semibold transition-all duration-1000 ease-out animate-progressBar"
                style={{ width: `${carbsPercentage}%` }}
              >
                {carbsPercentage > 15 && (
                  <div className="flex items-center">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full mr-1 sm:mr-2 animate-pulse"></div>
                    <span className="hidden sm:inline">{language === 'hebrew' ? 'פחמימות' : 'Carbs'} </span>{carbsPercentage}%
                  </div>
                )}
              </div>
              <div 
                className="bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-white text-xs sm:text-sm font-semibold transition-all duration-1000 ease-out animate-progressBar"
                style={{ width: `${fatPercentage}%` }}
              >
                {fatPercentage > 15 && (
                  <div className="flex items-center">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full mr-1 sm:mr-2 animate-pulse"></div>
                    <span className="hidden sm:inline">{language === 'hebrew' ? 'שומן' : 'Fat'} </span>{fatPercentage}%
                  </div>
                )}
              </div>
            </div>

            {/* Labels Below */}
            <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0 mt-3 sm:mt-4">
              <div className="flex items-center">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                <span className={`${themeClasses.textPrimary} text-xs sm:text-sm font-medium`}>
                  {language === 'hebrew' ? 'חלבון' : 'Protein'} {proteinPercentage}%
                </span>
              </div>
              <div className="flex items-center">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
                <span className={`${themeClasses.textPrimary} text-xs sm:text-sm font-medium`}>
                  {language === 'hebrew' ? 'פחמימות' : 'Carbs'} {carbsPercentage}%
                </span>
              </div>
              <div className="flex items-center">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-amber-500 rounded-full mr-2 animate-pulse"></div>
                <span className={`${themeClasses.textPrimary} text-xs sm:text-sm font-medium`}>
                  {language === 'hebrew' ? 'שומן' : 'Fat'} {fatPercentage}%
                </span>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Today Section */}
      <div className="animate-slideInUp" style={{ animationDelay: '0.5s' }}>
         <div className="flex items-center mb-6 sm:mb-8">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mr-3 sm:mr-4 shadow-lg shadow-emerald-500/25 animate-pulse">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
            </svg>
          </div>
      <div>
            <h3 className={`${themeClasses.textPrimary} text-2xl sm:text-3xl font-bold tracking-tight`}>
              {language === 'hebrew' ? 'היום' : 'Today'}
            </h3>
            <p className={`${themeClasses.textSecondary} text-sm sm:text-base mt-1`}>
              {planData.meals.length} {language === 'hebrew' ? 'ארוחות מתוכננות' : 'meals planned'}
            </p>
          </div>
        </div>

        {/* Meals */}
        <div className="space-y-3 sm:space-y-4">
          {planData.meals.map((meal, index) => {
            const mealCalories = meal.main.nutrition?.calories || meal.main.calories || 0;
            const mealProtein = meal.main.nutrition?.protein || meal.main.protein || 0;
            const mealCarbs = meal.main.nutrition?.carbs || meal.main.carbs || 0;
            const mealFat = meal.main.nutrition?.fat || meal.main.fat || 0;
            
            // Calculate meal macro percentages based on calories (not grams)
            const mealProteinCalories = mealProtein * 4;
            const mealCarbsCalories = mealCarbs * 4;
            const mealFatCalories = mealFat * 9;
            const mealTotalMacroCalories = mealProteinCalories + mealCarbsCalories + mealFatCalories;
            
            const mealProteinPercent = mealTotalMacroCalories > 0 ? Math.round((mealProteinCalories / mealTotalMacroCalories) * 100) : 0;
            const mealCarbsPercent = mealTotalMacroCalories > 0 ? Math.round((mealCarbsCalories / mealTotalMacroCalories) * 100) : 0;
            const mealFatPercent = mealTotalMacroCalories > 0 ? Math.round((mealFatCalories / mealTotalMacroCalories) * 100) : 0;
            const isExpanded = expandedMeals[index] === true; // Default to collapsed

            return (
              <div 
                key={index} 
                className={`${themeClasses.bgCard} border border-emerald-500/30 rounded-2xl p-4 sm:p-6 md:p-8 shadow-xl shadow-emerald-500/10 transform hover:scale-[1.02] transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/20 animate-slideInUp`}
                style={{ animationDelay: `${0.6 + index * 0.1}s` }}
              >
                {/* Meal Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
                  <div className="flex items-center">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mr-3 sm:mr-4 shadow-lg shadow-emerald-500/25">
                      <span className="text-xl sm:text-2xl animate-bounce" style={{ animationDelay: `${index * 0.2}s` }}>{getMealIcon(meal.meal)}</span>
                  </div>
                    <div>
                      <p className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium mb-1`}>
                        {meal.meal}
                      </p>
                      <h4 className={`${themeClasses.textPrimary} text-base sm:text-lg md:text-xl font-bold tracking-tight`}>
                        {meal.main?.meal_title || meal.main?.title || meal.meal}
                      </h4>
                    </div>
                    </div>
                  <div className="flex items-center gap-2 sm:gap-4 self-end sm:self-auto">
                    <button className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-700 rounded-xl flex items-center justify-center hover:bg-slate-600 transition-all duration-300 hover:scale-110 hover:shadow-lg shadow-md">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <span className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium hidden sm:inline`}>
                      {language === 'hebrew' ? 'החלף' : 'Replace'}
                    </span>
                    <button 
                      onClick={() => toggleMealExpansion(index)}
                      className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center hover:bg-slate-600 transition-all duration-300 hover:scale-110 shadow-md"
                    >
                      <svg 
                        className={`w-5 h-5 text-white transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    </div>
                </div>

                {/* Nutritional Summary */}
                <div className="mb-4 sm:mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                    {settings.showCalories && (
                      <div className="text-emerald-400 text-3xl sm:text-4xl font-bold tracking-tight animate-countUp">{mealCalories.toLocaleString()}</div>
                    )}
                    {settings.showMacros && (
                    <div className={`${themeClasses.textPrimary} text-sm sm:text-base`}>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                          <span className="font-semibold whitespace-nowrap">{formatWeight(mealProtein)} {language === 'hebrew' ? 'חלבון' : 'Protein'}</span>
                        <span className={`${themeClasses.textMuted} hidden sm:inline`}>•</span>
                          <span className="font-semibold whitespace-nowrap">{formatWeight(mealCarbs)} {language === 'hebrew' ? 'פחמימות' : 'Carbs'}</span>
                        <span className={`${themeClasses.textMuted} hidden sm:inline`}>•</span>
                          <span className="font-semibold whitespace-nowrap">{formatWeight(mealFat)} {language === 'hebrew' ? 'שומן' : 'Fat'}</span>
                      </div>
                    </div>
                    )}
                  </div>
                </div>

                {/* Collapsible Content */}
                <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  {/* Macro Breakdown Bars */}
                  <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                    <div className="flex items-center gap-2 sm:gap-0">
                      <div className="w-3 h-3 sm:w-4 sm:h-4 bg-red-500 rounded-full sm:mr-4 animate-pulse"></div>
                      <span className={`${themeClasses.textPrimary} text-sm sm:text-base font-semibold sm:mr-4 w-12 sm:w-16`}>
                        {language === 'hebrew' ? 'חלבון' : 'Protein'}
                      </span>
                      <div className="flex-1 bg-slate-700 rounded-full h-2 sm:h-3 shadow-inner">
                        <div 
                          className="bg-gradient-to-r from-red-600 to-red-500 h-2 sm:h-3 rounded-full transition-all duration-1000 ease-out shadow-sm"
                          style={{ width: `${mealProteinPercent}%` }}
                        ></div>
                  </div>
                      <span className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium ml-2 sm:ml-4 whitespace-nowrap`}>{formatWeight(mealProtein)} ({mealProteinPercent}%)</span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-0">
                      <div className="w-3 h-3 sm:w-4 sm:h-4 bg-blue-500 rounded-full sm:mr-4 animate-pulse"></div>
                      <span className={`${themeClasses.textPrimary} text-sm sm:text-base font-semibold sm:mr-4 w-12 sm:w-16`}>
                        {language === 'hebrew' ? 'פחמימות' : 'Carbs'}
                      </span>
                      <div className="flex-1 bg-slate-700 rounded-full h-2 sm:h-3 shadow-inner">
                        <div 
                          className="bg-gradient-to-r from-blue-600 to-blue-500 h-2 sm:h-3 rounded-full transition-all duration-1000 ease-out shadow-sm"
                          style={{ width: `${mealCarbsPercent}%` }}
                        ></div>
                    </div>
                      <span className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium ml-2 sm:ml-4 whitespace-nowrap`}>{formatWeight(mealCarbs)} ({mealCarbsPercent}%)</span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-0">
                      <div className="w-3 h-3 sm:w-4 sm:h-4 bg-amber-500 rounded-full sm:mr-4 animate-pulse"></div>
                      <span className={`${themeClasses.textPrimary} text-sm sm:text-base font-semibold sm:mr-4 w-12 sm:w-16`}>
                        {language === 'hebrew' ? 'שומן' : 'Fat'}
                      </span>
                      <div className="flex-1 bg-slate-700 rounded-full h-2 sm:h-3 shadow-inner">
                        <div 
                          className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 sm:h-3 rounded-full transition-all duration-1000 ease-out shadow-sm"
                          style={{ width: `${mealFatPercent}%` }}
                        ></div>
                    </div>
                      <span className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium ml-2 sm:ml-4 whitespace-nowrap`}>{formatWeight(mealFat)} ({mealFatPercent}%)</span>
                    </div>
                  </div>

                  {/* Ingredients */}
                  <div className={`${themeClasses.bgSecondary} rounded-2xl p-4 sm:p-6`}>
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className="flex items-center">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mr-2 sm:mr-3 shadow-lg shadow-emerald-500/25">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                        </svg>
                      </div>
                      <span className={`${themeClasses.textPrimary} text-base sm:text-lg font-bold tracking-tight`}>
                        {language === 'hebrew' ? 'מרכיבים' : 'Ingredients'}
                      </span>
                      {meal.main && meal.main.ingredients && (
                        <span className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium ml-2 sm:ml-3`}>
                          {meal.main.ingredients.length} {language === 'hebrew' ? 'פריטים' : 'Items'}
                        </span>
                      )}
                      </div>
                      <button
                        onClick={() => handleOpenAddIngredient(index)}
                        className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 rounded-full flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-md hover:shadow-lg"
                        title={language === 'hebrew' ? 'הוסף מרכיב' : 'Add ingredient'}
                      >
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Actual ingredients from meal data */}
                    {meal.main && meal.main.ingredients && meal.main.ingredients.length > 0 ? (
                      <div className="space-y-2 sm:space-y-3">
                        {meal.main.ingredients.map((ingredient, idx) => (
                          <div 
                            key={idx}
                            className={`flex items-start sm:items-center ${themeClasses.textSecondary} text-xs sm:text-sm md:text-base group`}
                          >
                            <div className="w-2 h-2 sm:w-3 sm:h-3 bg-emerald-500 rounded-full mr-2 sm:mr-4 animate-pulse flex-shrink-0 mt-1.5 sm:mt-0"></div>
                            <span className="font-medium flex-1">
                              {ingredient.item || ingredient.name || 'Unknown item'}
                            </span>
                            <span className="ml-2 font-semibold whitespace-nowrap">
                              {formatPortion(ingredient)}
                            </span>
                            <div className="flex items-center gap-1 ml-2 sm:ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEditIngredient(index, idx, ingredient)}
                                className="w-6 h-6 sm:w-7 sm:h-7 bg-blue-500 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors"
                                title={language === 'hebrew' ? 'ערוך' : 'Edit'}
                              >
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteIngredient(index, idx)}
                                className="w-6 h-6 sm:w-7 sm:h-7 bg-red-500 rounded-lg flex items-center justify-center hover:bg-red-600 transition-colors"
                                title={language === 'hebrew' ? 'מחק' : 'Delete'}
                              >
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className={`${themeClasses.textMuted} text-sm italic`}>
                          {language === 'hebrew' ? 'אין מרכיבים זמינים' : 'No ingredients available'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Ingredient Modal */}
      <AddIngredientModal
        visible={isAddIngredientModalVisible}
        onClose={() => {
          setIsAddIngredientModalVisible(false);
          setSelectedMealIndex(null);
        }}
        onAddIngredient={handleAddIngredient}
        mealName={selectedMealIndex !== null && planData?.meals[selectedMealIndex]?.meal}
        clientRegion={clientRegion}
      />

      {/* Edit Ingredient Portion Modal */}
      <IngredientPortionModal
        visible={isEditPortionModalVisible}
        onClose={() => {
          setIsEditPortionModalVisible(false);
          setEditingIngredient(null);
          setEditingIngredientIndex(null);
        }}
        onConfirm={handleUpdateIngredientPortion}
        ingredient={editingIngredient}
        clientRegion={clientRegion}
      />
    </div>
  );
};

// Daily Log Tab Component
const DailyLogTab = ({ themeClasses, t, userCode, language }) => {
  const { settings } = useSettings();
  const [foodLogs, setFoodLogs] = useState([]);
  const [mealPlanTargets, setMealPlanTargets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAddFood, setShowAddFood] = useState(false);
  
  // Helper function to format numbers with decimal places
  const formatNumber = (num) => {
    if (settings.decimalPlaces === 0) {
      return Math.round(num).toString();
    }
    return num.toFixed(settings.decimalPlaces);
  };
  
  // Helper function to convert weight based on weightUnit setting
  const convertWeight = (grams) => {
    if (settings.weightUnit === 'ounces') {
      // Convert grams to ounces (1 gram = 0.035274 ounces)
      return grams * 0.035274;
    }
    return grams; // Return grams if weightUnit is 'grams'
  };
  
  // Helper function to get weight unit label
  const getWeightUnit = () => {
    return settings.weightUnit === 'ounces' ? 'oz' : 'g';
  };
  
  // Helper function to format weight with unit
  const formatWeight = (grams) => {
    const value = convertWeight(grams);
    const unit = getWeightUnit();
    return `${formatNumber(value)}${unit}`;
  };

  const navigateWeek = (direction) => {
    const currentDate = new Date(selectedDate);
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    setSelectedDate(newDate.toISOString().split('T')[0]);
  };

  useEffect(() => {
    const loadData = async () => {
      if (!userCode) {
        setError('User code not available');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Load food logs
        const { data: foodLogsData, error: foodLogsError } = await getFoodLogs(userCode, selectedDate);
        
        if (foodLogsError) {
          console.error('Error loading food logs:', foodLogsError);
          setError(foodLogsError.message);
        } else {
          setFoodLogs(foodLogsData || []);
        }

        // Load meal plan targets
        const { data: mealPlanData, error: mealPlanError } = await getClientMealPlan(userCode);
        
        if (mealPlanError) {
          console.error('Error loading meal plan:', mealPlanError);
          // Don't set error for meal plan, just use defaults
        } else if (mealPlanData) {
          // Extract targets from meal plan
          const mealPlan = mealPlanData.meal_plan;
          let targets = {
            calories: mealPlanData.daily_total_calories || 2000,
            protein: 150,
            carbs: 250,
            fat: 65
          };

          // Try to get macros from macros_target field
          if (mealPlanData.macros_target) {
            targets = {
              calories: mealPlanData.daily_total_calories || 2000,
              protein: mealPlanData.macros_target.protein || 150,
              carbs: mealPlanData.macros_target.carbs || 250,
              fat: mealPlanData.macros_target.fat || 65
            };
          } else if (mealPlan && mealPlan.meals) {
            // Calculate targets from meal plan totals
            const totals = mealPlan.meals.reduce((acc, meal) => {
              if (meal.main && meal.main.nutrition) {
                acc.calories += meal.main.nutrition.calories || 0;
                acc.protein += meal.main.nutrition.protein || 0;
                acc.carbs += meal.main.nutrition.carbs || 0;
                acc.fat += meal.main.nutrition.fat || 0;
              }
              return acc;
            }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

            targets = {
              calories: totals.calories || mealPlanData.daily_total_calories || 2000,
              protein: totals.protein || 150,
              carbs: totals.carbs || 250,
              fat: totals.fat || 65
            };
          }

          setMealPlanTargets(targets);
        }
      } catch (err) {
        console.error('Unexpected error loading data:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userCode, selectedDate]);


  // Calculate totals from food logs
  const totalCalories = foodLogs.reduce((sum, log) => sum + (log.total_calories || 0), 0);
  const totalProtein = foodLogs.reduce((sum, log) => sum + (log.total_protein_g || 0), 0);
  const totalCarbs = foodLogs.reduce((sum, log) => sum + (log.total_carbs_g || 0), 0);
  const totalFat = foodLogs.reduce((sum, log) => sum + (log.total_fat_g || 0), 0);

  // Group food logs by meal
  const meals = ['breakfast', 'lunch', 'dinner', 'snacks'];
  const groupedLogs = meals.reduce((acc, meal) => {
    acc[meal] = foodLogs.filter(log => log.meal_label.toLowerCase() === meal.toLowerCase());
    return acc;
  }, {});

  if (loading) {
  return (
      <div className={`${themeClasses.bgPrimary} min-h-screen p-8 animate-fadeIn`}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className={`${themeClasses.textSecondary}`}>Loading food logs...</p>
      </div>
        </div>
        </div>
    );
  }

  // Calculate completion percentage using meal plan targets
  const dailyGoals = mealPlanTargets || {
    calories: 2000,
    protein: 150,
    carbs: 250,
    fat: 65
  };

  const caloriesPercent = Math.round((totalCalories / dailyGoals.calories) * 100);
  const proteinPercent = Math.round((totalProtein / dailyGoals.protein) * 100);
  const carbsPercent = Math.round((totalCarbs / dailyGoals.carbs) * 100);
  const fatPercent = Math.round((totalFat / dailyGoals.fat) * 100);

  const overallPercent = Math.round((caloriesPercent + proteinPercent + carbsPercent + fatPercent) / 4);

  // Generate week dates
  const generateWeekDates = (selectedDate) => {
    const date = new Date(selectedDate);
    const dayOfWeek = date.getDay();
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - dayOfWeek + 1); // Start from Monday
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      weekDates.push(currentDate);
    }
    return weekDates;
  };

  const weekDates = generateWeekDates(selectedDate);
  const selectedDateObj = new Date(selectedDate);
  const dayNames = language === 'hebrew' 
    ? ['ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳', 'א׳']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const monthNames = language === 'hebrew'
    ? ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className={`${themeClasses.bgPrimary} min-h-screen p-4 sm:p-6 md:p-8 animate-fadeIn`}>
      {/* Date Selector Section */}
      <div className="mb-8 sm:mb-10 md:mb-12 animate-slideInUp">
        <div className="mb-8">
          <h2 className={`${themeClasses.textPrimary} text-3xl font-bold tracking-tight mb-2`}>
            {dayNames[selectedDateObj.getDay()]}, {monthNames[selectedDateObj.getMonth()]} {selectedDateObj.getDate()}
          </h2>
          <p className={`${themeClasses.textSecondary} text-base`}>
            {language === 'hebrew' ? 'בחר תאריך כדי לראות את יומן התזונה שלך' : 'Choose a date to view your nutrition log'}
          </p>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigateWeek('prev')}
              className={`w-10 h-10 ${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} rounded-lg flex items-center justify-center transition-all duration-300`}
            >
              <svg className={`w-5 h-5 ${themeClasses.textPrimary}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button 
              onClick={() => navigateWeek('next')}
              className={`w-10 h-10 ${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} rounded-lg flex items-center justify-center transition-all duration-300`}
            >
              <svg className={`w-5 h-5 ${themeClasses.textPrimary}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
        </div>
          <button 
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300"
          >
            {language === 'hebrew' ? 'היום' : 'Today'}
          </button>
      </div>

        {/* Week Calendar */}
        <div className="flex gap-3 mb-8">
          {weekDates.map((date, index) => {
            const isSelected = date.toISOString().split('T')[0] === selectedDate;
            const dayName = dayNames[date.getDay()];
            const dayNumber = date.getDate();
            
            return (
        <button
                key={index}
                onClick={() => setSelectedDate(date.toISOString().split('T')[0])}
                className={`flex-1 p-4 rounded-xl transition-all duration-300 ${
                  isSelected 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' 
                    : `${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} ${themeClasses.textSecondary}`
                }`}
              >
                <div className="text-center">
                  <div className="text-sm font-medium">{dayName}</div>
                  <div className="text-lg font-bold mt-1">{dayNumber}</div>
                </div>
        </button>
            );
          })}
        </div>
      </div>

      {/* Macro Summary Section */}
      <div className="animate-slideInUp" style={{ animationDelay: '0.3s' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
              </svg>
            </div>
            <h3 className={`${themeClasses.textPrimary} text-2xl font-bold`}>
              {language === 'hebrew' ? 'סיכום מקרו' : 'Macro Summary'}
            </h3>
          </div>
          <div className={`${themeClasses.textSecondary} text-lg font-medium`}>
            {overallPercent}% {language === 'hebrew' ? 'הושלם' : 'complete'}
          </div>
        </div>

        {/* Macro Cards */}
        <div className={`grid gap-4 sm:gap-6 ${
          settings.showCalories && settings.showMacros 
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' 
            : settings.showCalories || settings.showMacros
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            : 'grid-cols-1 sm:grid-cols-2'
        }`}>
          {/* Calories Card */}
          {settings.showCalories && (
          <div className={`${themeClasses.bgCard} rounded-2xl p-6 shadow-lg animate-bounceIn`} style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center mb-4">
              <div className="w-4 h-4 bg-orange-500 rounded-full mr-3"></div>
              <h4 className={`${themeClasses.textPrimary} text-lg font-semibold`}>
                {language === 'hebrew' ? 'קלוריות' : 'Calories'}
              </h4>
            </div>
            <div className={`${themeClasses.textPrimary} text-2xl font-bold mb-2`}>
                {totalCalories.toLocaleString()} / {dailyGoals.calories.toLocaleString()}
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3 mb-2">
              <div 
                className="bg-orange-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(caloriesPercent, 100)}%` }}
              ></div>
            </div>
            <div className="text-orange-400 text-sm font-medium">{caloriesPercent}%</div>
          </div>
          )}

          {/* Protein Card */}
          {settings.showMacros && (
          <div className={`${themeClasses.bgCard} rounded-2xl p-6 shadow-lg animate-bounceIn`} style={{ animationDelay: '0.5s' }}>
            <div className="flex items-center mb-4">
              <div className="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
              <h4 className={`${themeClasses.textPrimary} text-lg font-semibold`}>
                {language === 'hebrew' ? 'חלבון' : 'Protein'}
              </h4>
            </div>
            <div className={`${themeClasses.textPrimary} text-2xl font-bold mb-2`}>
                {formatWeight(totalProtein)} / {formatWeight(dailyGoals.protein)}
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3 mb-2">
              <div 
                className="bg-green-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(proteinPercent, 100)}%` }}
              ></div>
            </div>
            <div className="text-green-400 text-sm font-medium">{proteinPercent}%</div>
          </div>
          )}

          {/* Fat Card */}
          {settings.showMacros && (
          <div className={`${themeClasses.bgCard} rounded-2xl p-6 shadow-lg animate-bounceIn`} style={{ animationDelay: '0.6s' }}>
            <div className="flex items-center mb-4">
              <div className="w-4 h-4 bg-yellow-500 rounded-full mr-3"></div>
              <h4 className={`${themeClasses.textPrimary} text-lg font-semibold`}>
                {language === 'hebrew' ? 'שומן' : 'Fat'}
              </h4>
            </div>
            <div className={`${themeClasses.textPrimary} text-2xl font-bold mb-2`}>
                {formatWeight(totalFat)} / {formatWeight(dailyGoals.fat)}
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3 mb-2">
              <div 
                className="bg-yellow-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(fatPercent, 100)}%` }}
              ></div>
            </div>
            <div className="text-yellow-400 text-sm font-medium">{fatPercent}%</div>
          </div>
          )}

          {/* Carbs Card */}
          {settings.showMacros && (
          <div className={`${themeClasses.bgCard} rounded-2xl p-6 shadow-lg animate-bounceIn`} style={{ animationDelay: '0.7s' }}>
            <div className="flex items-center mb-4">
              <div className="w-4 h-4 bg-blue-500 rounded-full mr-3"></div>
              <h4 className={`${themeClasses.textPrimary} text-lg font-semibold`}>
                {language === 'hebrew' ? 'פחמימות' : 'Carbs'}
              </h4>
            </div>
            <div className={`${themeClasses.textPrimary} text-2xl font-bold mb-2`}>
              {formatWeight(totalCarbs)} / {formatWeight(dailyGoals.carbs)}
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3 mb-2">
              <div 
                className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(carbsPercent, 100)}%` }}
              ></div>
            </div>
            <div className="text-blue-400 text-sm font-medium">{carbsPercent}%</div>
          </div>
          )}
        </div>
      </div>

      {/* Meals Section */}
      <div className="mt-12 animate-slideInUp" style={{ animationDelay: '0.8s' }}>
        <div className="flex items-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4 shadow-lg shadow-blue-500/25">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
            </svg>
          </div>
          <div>
            <h3 className={`${themeClasses.textPrimary} text-2xl font-bold tracking-tight`}>
              {language === 'hebrew' ? 'ארוחות' : 'Meals'}
            </h3>
            <p className={`${themeClasses.textSecondary} text-base mt-1`}>
              {language === 'hebrew' ? 'רשומות המזון שלך עבור' : 'Your food entries for'} {dayNames[selectedDateObj.getDay()]}, {monthNames[selectedDateObj.getMonth()]} {selectedDateObj.getDate()}
            </p>
          </div>
        </div>

      <div className="space-y-6">
          {meals.map((meal, index) => {
            const mealLogs = groupedLogs[meal] || [];
            const getMealIcon = (mealName) => {
              const name = mealName.toLowerCase();
              if (name.includes('breakfast') || name.includes('בוקר')) return '🌅';
              if (name.includes('lunch') || name.includes('צהריים')) return '☀️';
              if (name.includes('dinner') || name.includes('ערב')) return '🌙';
              if (name.includes('snack') || name.includes('חטיף')) return '🍎';
              return '🍽️';
            };

            const getMealColor = (mealName) => {
              const name = mealName.toLowerCase();
              if (name.includes('breakfast') || name.includes('בוקר')) return 'from-yellow-500 to-orange-500';
              if (name.includes('lunch') || name.includes('צהריים')) return 'from-orange-500 to-red-500';
              if (name.includes('dinner') || name.includes('ערב')) return 'from-blue-500 to-purple-500';
              if (name.includes('snack') || name.includes('חטיף')) return 'from-purple-500 to-pink-500';
              return 'from-emerald-500 to-teal-500';
            };

          return (
              <div 
                key={meal} 
                className={`${themeClasses.bgCard} border border-blue-500/30 rounded-2xl p-6 shadow-xl shadow-blue-500/10 transform hover:scale-[1.01] transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20 animate-slideInUp`}
                style={{ animationDelay: `${0.9 + index * 0.1}s` }}
              >
                <div className="flex items-center mb-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${getMealColor(meal)} rounded-xl flex items-center justify-center mr-4 shadow-lg`}>
                    <span className="text-2xl animate-bounce" style={{ animationDelay: `${index * 0.2}s` }}>{getMealIcon(meal)}</span>
                  </div>
                      <div>
                    <h4 className={`${themeClasses.textPrimary} text-xl font-bold tracking-tight`}>{t.profile.dailyLogTab.meals[meal]}</h4>
                    <p className={`${themeClasses.textSecondary} text-sm`}>{mealLogs.length} {language === 'hebrew' ? 'פריטים נרשמו' : 'items logged'}</p>
                  </div>
                </div>

                {mealLogs.length > 0 ? (
                  <div className="space-y-3">
                    {mealLogs.map((log, logIndex) => (
                      <div 
                        key={log.id} 
                        className={`${themeClasses.bgSecondary} rounded-xl p-4 transform hover:translate-x-2 transition-all duration-300 hover:${themeClasses.bgPrimary} animate-slideInUp`}
                        style={{ animationDelay: `${1.0 + index * 0.1 + logIndex * 0.05}s` }}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <p className={`${themeClasses.textPrimary} font-semibold text-lg`}>
                                {log.food_items && log.food_items.length > 0 
                                  ? log.food_items.map(item => item.name || item.food_name).join(', ')
                                  : language === 'hebrew' ? 'רשומת מזון' : 'Food Entry'
                                }
                              </p>
                              {log.image_url && (
                                <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center">
                                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"/>
                                  </svg>
                      </div>
                              )}
                            </div>
                            <div className="flex items-center gap-4">
                              {settings.showCalories && (
                              <span className="text-emerald-400 font-medium">{log.total_calories || 0} {language === 'hebrew' ? 'קל' : 'cal'}</span>
                              )}
                              {settings.showMacros && (
                                <>
                                  <span className="text-red-400 font-medium">{formatWeight(log.total_protein_g || 0)} {language === 'hebrew' ? 'חלבון' : 'protein'}</span>
                                  <span className="text-blue-400 font-medium">{formatWeight(log.total_carbs_g || 0)} {language === 'hebrew' ? 'פחמימות' : 'carbs'}</span>
                                  <span className="text-amber-400 font-medium">{formatWeight(log.total_fat_g || 0)} {language === 'hebrew' ? 'שומן' : 'fat'}</span>
                                </>
                              )}
                            </div>
                            <p className={`${themeClasses.textMuted} text-xs mt-2`}>
                              {language === 'hebrew' ? 'נרשם ב' : 'Logged at'} {new Date(log.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                    </div>
                  ))}
                </div>
              ) : (
                  <div className="text-center py-8">
                    <div className={`w-16 h-16 ${themeClasses.bgSecondary} rounded-xl flex items-center justify-center mx-auto mb-4`}>
                      <svg className={`w-8 h-8 ${themeClasses.textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <p className={`${themeClasses.textSecondary} italic text-lg`}>{t.profile.dailyLogTab.noEntries}</p>
                    <p className={`${themeClasses.textMuted} text-sm mt-2`}>{t.profile.dailyLogTab.addFirstEntry}</p>
                  </div>
              )}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
};

// Pricing Tab Component
const PricingTab = ({ themeClasses, user, language }) => {
  const { getCustomerSubscriptions, error } = useStripe();
  const [activeCategory, setActiveCategory] = useState('all');
  const [userSubscriptions, setUserSubscriptions] = useState([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);

  const allProducts = getAllProducts();
  
  // Get products by category
  const premiumProducts = getProductsByCategory('premium');
  const completeProducts = getProductsByCategory('complete');
  const nutritionProducts = getProductsByCategory('nutrition');
  const contentProducts = getProductsByCategory('content');
  const consultationProducts = getProductsByCategory('consultation');

  const [subscriptionsLastFetched, setSubscriptionsLastFetched] = useState(null);

  const fetchUserSubscriptions = async () => {
    try {
      setLoadingSubscriptions(true);
      const subscriptions = await getCustomerSubscriptions(user.id);
      setUserSubscriptions(subscriptions || []);
      setSubscriptionsLastFetched(Date.now()); // Set timestamp when data is fetched
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      setUserSubscriptions([]);
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  // Fetch user's current subscriptions
  useEffect(() => {
    const shouldFetch = user?.id && 
                       userSubscriptions.length === 0 && 
                       !loadingSubscriptions &&
                       (!subscriptionsLastFetched || Date.now() - subscriptionsLastFetched > 300000); // 5 minutes cache
    
    if (shouldFetch) {
      fetchUserSubscriptions();
    }
  }, [user, userSubscriptions.length, loadingSubscriptions, subscriptionsLastFetched]);

  // Manual refresh function for subscriptions (call after successful purchase)
  const refreshSubscriptions = async () => {
    setSubscriptionsLastFetched(null); // Reset timestamp to force refresh
    await fetchUserSubscriptions();
  };

  const hasActiveSubscription = (productId) => {
    return userSubscriptions.some(sub => {
      if (sub.status !== 'active') return false;
      
      // Check if any item in the subscription matches this product
      return sub.items?.data?.some(item => {
        const itemProductId = item.price?.product;
        return itemProductId === productId;
      });
    });
  };

  // Check if user has ANY active subscription (not consultation)
  const hasAnyActiveSubscription = () => {
    return userSubscriptions.some(sub => {
      if (sub.status !== 'active') return false;
      
      // Check if any item in the subscription is NOT a consultation
      return sub.items?.data?.some(item => {
        const itemProductId = item.price?.product;
        const product = getProduct(itemProductId);
        const isConsultation = product?.name?.toLowerCase().includes('consultation') || 
                              product?.nameHebrew?.includes('יעוץ');
        return !isConsultation; // Return true if it's NOT a consultation (meaning they have a non-consultation subscription)
      });
    });
  };

  const getFilteredProducts = () => {
    switch (activeCategory) {
      case 'premium':
        return premiumProducts;
      case 'complete':
        return completeProducts;
      case 'nutrition':
        return nutritionProducts;
      case 'content':
        return contentProducts;
      case 'consultation':
        return consultationProducts;
      default:
        return allProducts;
    }
  };

  const categories = [
    { id: 'all', label: language === 'hebrew' ? 'הכל' : 'All Plans', count: allProducts.length },
    { id: 'premium', label: language === 'hebrew' ? 'פרימיום' : 'Premium', count: premiumProducts.length },
    { id: 'complete', label: language === 'hebrew' ? 'מלא' : 'Complete', count: completeProducts.length },
    { id: 'nutrition', label: language === 'hebrew' ? 'תזונה' : 'Nutrition', count: nutritionProducts.length },
    { id: 'content', label: language === 'hebrew' ? 'תוכן' : 'Content', count: contentProducts.length },
    { id: 'consultation', label: language === 'hebrew' ? 'יעוץ' : 'Consultation', count: consultationProducts.length },
  ].filter(category => category.count > 0);

  const filteredProducts = getFilteredProducts();

  return (
    <div className={`${themeClasses.bgPrimary} min-h-screen p-4 sm:p-6 md:p-8 animate-fadeIn`}>
      {/* Header */}
      <div className="mb-8 sm:mb-10 md:mb-12 animate-slideInUp">
        <div className="flex items-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mr-4 shadow-lg shadow-blue-500/25 animate-pulse">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zM14 6a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2h6zM4 14a2 2 0 002 2h8a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2z"/>
            </svg>
          </div>
          <div>
            <h2 className={`${themeClasses.textPrimary} text-3xl font-bold tracking-tight`}>
              {language === 'hebrew' ? 'בחר את התוכנית המתאימה לך' : 'Choose Your Perfect Plan'}
            </h2>
            <p className={`${themeClasses.textSecondary} text-base mt-1`}>
              {language === 'hebrew' 
                ? 'השג את היעדים התזונתיים שלך עם המומחים שלנו. תוכניות מותאמות אישית לכל צורך ותקציב.'
                : 'Achieve your nutrition goals with our expert team. Personalized plans for every need and budget.'
              }
            </p>
          </div>
        </div>

        {/* Current Subscriptions Alert */}
        {userSubscriptions.length > 0 && (
          <div className={`${themeClasses.bgCard} border border-emerald-500/30 rounded-2xl p-6 mb-8 shadow-lg animate-slideInUp`}>
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
              </div>
              <h3 className={`${themeClasses.textPrimary} text-lg font-semibold`}>
                {language === 'hebrew' ? 'המנויים הפעילים שלך' : 'Your Active Subscriptions'}
              </h3>
            </div>
            <div className="grid gap-3">
              {userSubscriptions.filter(sub => sub.status === 'active').map((subscription, index) => (
                <div key={subscription.id} className={`${themeClasses.bgSecondary} rounded-lg p-4`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className={`${themeClasses.textPrimary} font-medium`}>
                        {(() => {
                          const productId = subscription.items?.data?.[0]?.price?.product;
                          const product = getProduct(productId);
                          if (!product) return productId || 'Subscription';
                          return language === 'hebrew' ? (product.nameHebrew || product.name) : product.name;
                        })()}
                      </p>
                      <p className={`${themeClasses.textSecondary} text-sm`}>
                        {language === 'hebrew' ? 'פעיל' : 'Active'} • 
                        {language === 'hebrew' ? ' מחדש ב-' : ' Renews '}{new Date(subscription.current_period_end * 1000).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-emerald-500 font-semibold">
                      {(() => {
                        const amount = subscription.items?.data?.[0]?.price?.unit_amount;
                        const currency = subscription.items?.data?.[0]?.price?.currency?.toUpperCase();
                        if (!amount) return '---';
                        
                        const price = amount / 100;
                        if (currency === 'ILS') {
                          return `₪${price.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
                        } else {
                          return `$${price.toFixed(2)}`;
                        }
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Category Filter */}
      {categories.length > 1 && (
        <div className="mb-8 animate-slideInUp" style={{ animationDelay: '0.2s' }}>
          <div className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                  activeCategory === category.id
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/25'
                    : `${themeClasses.bgCard} ${themeClasses.textSecondary} hover:${themeClasses.bgSecondary} border ${themeClasses.borderPrimary}`
                }`}
              >
                {category.label}
                <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                  activeCategory === category.id 
                    ? 'bg-white/20' 
                    : `${themeClasses.bgSecondary}`
                }`}>
                  {category.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Products Grid */}
      <div className="animate-slideInUp" style={{ animationDelay: '0.4s' }}>
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <div className={`w-20 h-20 ${themeClasses.bgCard} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
              <svg className={`w-10 h-10 ${themeClasses.textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
              </svg>
            </div>
            <p className={`${themeClasses.textSecondary} text-lg`}>
              {language === 'hebrew' ? 'אין תוכניות זמינות בקטגוריה זו' : 'No plans available in this category'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {filteredProducts.map((product, index) => (
              <div
                key={product.id}
                className="animate-slideInUp"
                style={{ animationDelay: `${0.5 + index * 0.1}s` }}
              >
                <PricingCard
                  product={product}
                  hasActiveSubscription={hasActiveSubscription(product.id)}
                  hasAnyActiveSubscription={hasAnyActiveSubscription()}
                  className={`transform hover:scale-105 transition-all duration-300 ${
                    hasActiveSubscription(product.id) ? 'ring-2 ring-emerald-500' : ''
                  }`}
                />
                {hasActiveSubscription(product.id) && (
                  <div className="mt-3 text-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                      </svg>
                      {language === 'hebrew' ? 'פעיל' : 'Active'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loadingSubscriptions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${themeClasses.bgCard} rounded-lg p-6`}>
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
              <span className={themeClasses.textPrimary}>
                {language === 'hebrew' ? 'טוען מנויים...' : 'Loading subscriptions...'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Messages Tab Component
const MessagesTab = ({ themeClasses, t, userCode, activeTab, language }) => {
  const [messages, setMessages] = useState([]);
  const [firstMessageId, setFirstMessageId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [messagesContainerRef, setMessagesContainerRef] = useState(null);

  useEffect(() => {
    const loadMessages = async () => {
      if (!userCode) {
      setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const { data, error } = await getChatMessages(userCode);
        
        if (error) {
          console.error('Error loading messages:', error);
        } else {
          // Transform database messages to UI format
          const transformedMessages = (data || []).map(msg => ({
            id: msg.id,
            message: msg.role === 'assistant' ? (msg.message || '') : (msg.content || ''),
            sender: msg.role === 'user' ? 'user' : 'bot',
            timestamp: new Date(msg.created_at),
            created_at: msg.created_at
          }));
          
          // Sort messages by timestamp (oldest first for chat display)
          const sortedMessages = transformedMessages.sort((a, b) => a.timestamp - b.timestamp);
          
          setMessages(sortedMessages);
          
          // Set the first message ID for pagination
          if (sortedMessages.length > 0) {
            setFirstMessageId(sortedMessages[0].id);
          }
          
          // Check if there are more messages to load (if we have 20+ messages)
          setHasMoreMessages(sortedMessages.length >= 20);
        }
      } catch (err) {
        console.error('Unexpected error loading messages:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [userCode]);

  // Auto-refresh messages every 5 seconds when messages tab is active
  useEffect(() => {
    if (activeTab !== 'messages' || !userCode) return;

    const refreshMessages = async () => {
      try {
        const { data, error } = await getChatMessages(userCode);
        
        if (error) {
          console.error('Error refreshing messages:', error);
        } else {
          // Transform database messages to UI format
          const transformedMessages = (data || []).map(msg => ({
            id: msg.id,
            message: msg.role === 'assistant' ? (msg.message || '') : (msg.content || ''),
            sender: msg.role === 'user' ? 'user' : 'bot',
            timestamp: new Date(msg.created_at),
            created_at: msg.created_at
          }));
          
          // Sort messages by timestamp (oldest first for chat display)
          const sortedMessages = transformedMessages.sort((a, b) => a.timestamp - b.timestamp);
          
          // Only update if messages have changed
          const currentMessageIds = messages.map(m => m.id).sort();
          const newMessageIds = sortedMessages.map(m => m.id).sort();
          
          if (JSON.stringify(currentMessageIds) !== JSON.stringify(newMessageIds)) {
            setMessages(sortedMessages);
            
            // Update firstMessageId if needed
            if (sortedMessages.length > 0) {
              setFirstMessageId(sortedMessages[0].id);
            }
            
            // Update hasMoreMessages
            setHasMoreMessages(sortedMessages.length >= 20);
          }
        }
      } catch (err) {
        console.error('Error refreshing messages:', err);
      }
    };

    // Set up interval for auto-refresh
    const interval = setInterval(refreshMessages, 5000); // 5 seconds

    // Cleanup interval on unmount or tab change
    return () => clearInterval(interval);
  }, [activeTab, userCode, messages]);

  // Function to scroll to bottom with multiple attempts
  const scrollToBottom = () => {
    if (messagesContainerRef) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        messagesContainerRef.scrollTop = messagesContainerRef.scrollHeight;
        
        // Double-check after a short delay to ensure it worked
    setTimeout(() => {
          if (messagesContainerRef) {
            messagesContainerRef.scrollTop = messagesContainerRef.scrollHeight;
          }
        }, 50);
      });
    }
  };

  // Scroll to bottom when messages change (but not when loading more)
  useEffect(() => {
    if (!isLoadingMore && messages.length > 0) {
      // Only scroll to bottom if we're not in the middle of loading more messages
      const isInitialLoad = messages.length <= 20; // Assume initial load if 20 or fewer messages
      if (isInitialLoad) {
        setTimeout(scrollToBottom, 100);
      }
    }
  }, [messages.length, isLoadingMore]);

  // Scroll to bottom when loading completes (only for initial load)
  useEffect(() => {
    if (!isLoading && messages.length > 0 && messages.length <= 20) {
      setTimeout(scrollToBottom, 200);
    }
  }, [isLoading, messages.length]);

  // Scroll to bottom when component mounts and messages are loaded (only for initial load)
  useEffect(() => {
    if (messages.length > 0 && messagesContainerRef && messages.length <= 20) {
      // Multiple attempts to ensure it scrolls
      setTimeout(scrollToBottom, 100);
      setTimeout(scrollToBottom, 300);
      setTimeout(scrollToBottom, 500);
    }
  }, [messagesContainerRef, messages.length]);

  // Function to load more messages (older messages)
  const handleLoadMore = async () => {
    if (!userCode || !firstMessageId || isLoadingMore) return;
    
    // Capture scroll position before loading
    const container = messagesContainerRef;
    const prevScrollHeight = container ? container.scrollHeight : 0;
    const prevScrollTop = container ? container.scrollTop : 0;
    setIsLoadingMore(true);
    
    try {
      // Find the current oldest message to use as reference point
      const firstMessage = messages.find(m => m.id === firstMessageId);
      if (!firstMessage) {
        console.error('❌ Could not find first message with ID:', firstMessageId);
        return;
      }
      
      // Fetch older messages using timestamp-based pagination
      const { data: olderMsgs, error } = await getChatMessages(userCode, firstMessage.created_at);
      
      if (error) {
        console.error('❌ Error loading more messages:', error);
        return;
      }
      
      if (olderMsgs && olderMsgs.length > 0) {
        // Transform database messages to UI format
        const transformedOlderMessages = olderMsgs.map(msg => ({
          id: msg.id,
          message: msg.role === 'assistant' ? (msg.message || '') : (msg.content || ''),
          sender: msg.role === 'user' ? 'user' : 'bot',
          timestamp: new Date(msg.created_at),
          created_at: msg.created_at
        }));
        
        // Sort messages by timestamp (oldest first for chat display)
        const sortedOlderMessages = transformedOlderMessages.sort((a, b) => a.timestamp - b.timestamp);
        
        // Prepend older messages to the beginning of the array
        setMessages(prev => {
          const newMessages = [...sortedOlderMessages, ...prev];
          console.log('📝 Updated messages array:', {
            oldCount: prev.length,
            newCount: newMessages.length,
            addedCount: sortedOlderMessages.length
          });
          return newMessages;
        });
        
        // Update tracking variables
        setFirstMessageId(sortedOlderMessages[0].id); // New oldest message
        setHasMoreMessages(olderMsgs.length === 20); // More available if we got full batch
        
        // Restore scroll position after DOM updates
        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            const heightDifference = newScrollHeight - prevScrollHeight;
            container.scrollTop = prevScrollTop + heightDifference;
            console.log('🔄 Restored scroll position:', {
              prevScrollTop,
              prevScrollHeight,
              newScrollHeight,
              heightDifference,
              newScrollTop: prevScrollTop + heightDifference
            });
          }
        }, 50);
      } else {
        setHasMoreMessages(false); // No more messages
      }
    } catch (err) {
      console.error('❌ Error loading more messages:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Function to handle scroll to top
  const handleScroll = (e) => {
    const { scrollTop } = e.target;
    if (scrollTop <= 50 && hasMoreMessages && !isLoadingMore && userCode && firstMessageId) {
      console.log('🔄 Auto-loading more messages at top...');
      handleLoadMore();
    }
  };

  // Function to render message content with images
  const renderMessageContent = (message) => {
    const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?[^\s]*)?)/gi;
    const parts = message.split(urlRegex);
    
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <img
            key={index}
            src={part}
            alt="Food analysis image"
            className="max-w-full h-auto rounded-lg mt-2 shadow-md"
            style={{ maxHeight: '200px' }}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        );
      }
      return part;
    });
  };

  // Function to format date for chat
  const formatChatDate = (date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
    
    if (messageDay.getTime() === today.getTime()) {
      return language === 'hebrew' ? 'היום' : 'Today';
    } else if (messageDay.getTime() === yesterday.getTime()) {
      return language === 'hebrew' ? 'אתמול' : 'Yesterday';
    } else {
      if (language === 'hebrew') {
        return messageDate.toLocaleDateString('he-IL', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      } else {
        return messageDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      }
    }
  };

  // Function to format time for chat
  const formatChatTime = (date) => {
    if (language === 'hebrew') {
      return new Date(date).toLocaleTimeString('he-IL', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } else {
      return new Date(date).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    }
  };

  // Group messages by date
  const groupMessagesByDate = (messages) => {
    const groups = {};
    
    messages.forEach(message => {
      const date = new Date(message.timestamp);
      const dateKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split('T')[0];
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });
    
    return groups;
  };

  if (isLoading) {
    return (
      <div className={`${themeClasses.bgPrimary} min-h-screen p-8 animate-fadeIn`}>
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
            <p className={`${themeClasses.textSecondary}`}>{t.profile.messagesTab.loading}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${themeClasses.bgPrimary} min-h-screen animate-fadeIn`}>
      {/* Header Section */}
      <div className="p-4 sm:p-6 pb-4 animate-slideInUp">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mr-4 shadow-lg shadow-purple-500/25 animate-pulse">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"/>
            </svg>
          </div>
    <div>
            <h2 className={`${themeClasses.textPrimary} text-3xl font-bold tracking-tight`}>{t.profile.messagesTab.title}</h2>
            <p className={`${themeClasses.textSecondary} text-base mt-1`}>{t.profile.messagesTab.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={setMessagesContainerRef}
        className={`${themeClasses.bgCard} rounded-t-2xl p-4 sm:p-6 h-full overflow-y-auto shadow-xl shadow-purple-500/10 animate-slideInUp`} 
        style={{ animationDelay: '0.2s', height: 'calc(100vh - 200px)' }}
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/25">
                      <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"/>
                      </svg>
                    </div>
                    <p className={`${themeClasses.textSecondary} text-lg font-medium`}>{t.profile.messagesTab.startConversation}</p>
                    <p className={`${themeClasses.textMuted} text-sm mt-2`}>Ask me anything about your nutrition and fitness journey!</p>
          </div>
        ) : (
          <div className="space-y-4">
                    {/* Load More Button */}
                    {hasMoreMessages && (
                      <div className="flex justify-center py-3">
                        <button
                          onClick={handleLoadMore}
                          disabled={isLoadingMore}
                          className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-purple-500/25"
                        >
                          {isLoadingMore ? (
                            <div className="flex items-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Loading more...
                            </div>
                          ) : (
                            'Load more'
                          )}
                        </button>
                      </div>
                    )}
                    
                    {Object.entries(groupMessagesByDate(messages)).map(([dateKey, dateMessages]) => (
                      <div key={dateKey}>
                        {/* Date Header */}
                        <div className="flex items-center justify-center my-4">
                          <div className={`${themeClasses.bgSecondary} ${themeClasses.textSecondary} px-3 py-1 rounded-full text-xs font-medium`}>
                            {formatChatDate(dateMessages[0].timestamp)}
                          </div>
                        </div>
                        
                        {/* Messages for this date */}
                        {dateMessages.map((message, index) => (
                          <div
                            key={message.id}
                            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-slideInUp mb-3`}
                            style={{ animationDelay: `${0.3 + index * 0.1}s` }}
                          >
                            <div
                              className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2 sm:py-3 rounded-2xl shadow-lg ${
                                message.sender === 'user'
                                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
                                  : `${themeClasses.bgSecondary} ${themeClasses.textPrimary} border ${themeClasses.borderPrimary}`
                              }`}
                            >
                              <div className="text-sm leading-relaxed">
                                {renderMessageContent(message.message)}
                              </div>
                              <p className={`text-xs mt-2 ${
                                message.sender === 'user' ? 'text-emerald-100' : themeClasses.textMuted
                              }`}>
                                {formatChatTime(message.timestamp)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
              </div>
            )}
      </div>
    </div>
  );
};

// Settings Tab Component
const SettingsTab = ({ themeClasses, language, userCode }) => {
  const { settings, updateSetting } = useSettings();
  const { isDarkMode, toggleTheme } = useTheme();
  const { toggleLanguage } = useLanguage();
  const [saving, setSaving] = useState(false);

  const {
    showCalories,
    showMacros,
    portionDisplay,
    measurementSystem,
    weightUnit,
    decimalPlaces,
    loading,
  } = settings;

  const handleToggle = async (key, value) => {
    try {
      setSaving(true);
      // Convert snake_case to camelCase for context
      const camelCaseKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      
      // For user_language, handle it specially
      if (key === 'user_language') {
        toggleLanguage(value);
        // Update in database via profile update
        if (userCode) {
          const { error } = await supabase
            .from('clients')
            .update({ user_language: value })
            .eq('user_code', userCode);
          
          if (error) {
            console.error('Error updating language:', error);
          }
        }
      } else {
        // Update via context (instant UI update)
        await updateSetting(camelCaseKey, value);
      }
    } catch (err) {
      console.error('Error updating setting:', err);
      alert(
        language === 'hebrew' ? 'שגיאה בשמירת ההגדרה' : 'Error saving setting'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-8">
        {/* Display Preferences */}
        <div>
          <h2 className={`${themeClasses.textPrimary} text-xl font-bold mb-4`}>
            {language === 'hebrew' ? 'העדפות תצוגה' : 'Display Preferences'}
          </h2>
          
          <div className="space-y-4">
            {/* Show Calories */}
            <div className={`${themeClasses.bgCard} rounded-lg p-4 border ${themeClasses.borderPrimary}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className={`${themeClasses.textPrimary} font-semibold block mb-1`}>
                    {language === 'hebrew' ? 'הצג קלוריות' : 'Show Calories'}
                  </label>
                  <p className={`${themeClasses.textSecondary} text-sm`}>
                    {language === 'hebrew' 
                      ? 'הצג את ספירת הקלוריות בארוחות'
                      : 'Display calorie count in meals'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCalories}
                    onChange={(e) => handleToggle('show_calories', e.target.checked)}
                    disabled={saving}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            {/* Show Macros */}
            <div className={`${themeClasses.bgCard} rounded-lg p-4 border ${themeClasses.borderPrimary}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className={`${themeClasses.textPrimary} font-semibold block mb-1`}>
                    {language === 'hebrew' ? 'הצג מקרו' : 'Show Macros'}
                  </label>
                  <p className={`${themeClasses.textSecondary} text-sm`}>
                    {language === 'hebrew'
                      ? 'הצג חלבון, פחמימות ושומן'
                      : 'Display protein, carbs, and fat'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showMacros}
                    onChange={(e) => handleToggle('show_macros', e.target.checked)}
                    disabled={saving}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            {/* Portion Display */}
            <div className={`${themeClasses.bgCard} rounded-lg p-4 border ${themeClasses.borderPrimary}`}>
              <div className="flex-1">
                <label className={`${themeClasses.textPrimary} font-semibold block mb-1`}>
                  {language === 'hebrew' ? 'תצוגת מנות' : 'Portion Display'}
                </label>
                <p className={`${themeClasses.textSecondary} text-sm mb-3`}>
                  {language === 'hebrew'
                    ? 'איך להציג כמויות מזון'
                    : 'How to display food quantities'}
                </p>
                <div className="flex gap-2">
                  {['grams', 'household', 'both'].map((option) => (
                    <button
                      key={option}
                      onClick={() => handleToggle('portion_display', option)}
                      disabled={saving}
                      className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                        portionDisplay === option
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                          : `${themeClasses.borderPrimary} ${themeClasses.bgSecondary} ${themeClasses.textPrimary} hover:border-emerald-300`
                      }`}
                    >
                      {option === 'grams' 
                        ? (language === 'hebrew' ? 'גרמים' : 'Grams')
                        : option === 'household'
                        ? (language === 'hebrew' ? 'ביתי' : 'Household')
                        : (language === 'hebrew' ? 'שניהם' : 'Both')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Measurement Units */}
        <div>
          <h2 className={`${themeClasses.textPrimary} text-xl font-bold mb-4`}>
            {language === 'hebrew' ? 'יחידות מדידה' : 'Measurement Units'}
          </h2>
          
          <div className="space-y-4">
            {/* Measurement System */}
            <div className={`${themeClasses.bgCard} rounded-lg p-4 border ${themeClasses.borderPrimary}`}>
              <div className="flex-1">
                <label className={`${themeClasses.textPrimary} font-semibold block mb-1`}>
                  {language === 'hebrew' ? 'מערכת מדידה' : 'Measurement System'}
                </label>
                <p className={`${themeClasses.textSecondary} text-sm mb-3`}>
                  {language === 'hebrew'
                    ? 'מטרי או אימפריאלי'
                    : 'Metric or Imperial'}
                </p>
                <div className="flex gap-2">
                  {['metric', 'imperial'].map((option) => (
                    <button
                      key={option}
                      onClick={() => handleToggle('measurement_system', option)}
                      disabled={saving}
                      className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                        measurementSystem === option
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                          : `${themeClasses.borderPrimary} ${themeClasses.bgSecondary} ${themeClasses.textPrimary} hover:border-emerald-300`
                      }`}
                    >
                      {option === 'metric'
                        ? (language === 'hebrew' ? 'מטרי' : 'Metric')
                        : (language === 'hebrew' ? 'אימפריאלי' : 'Imperial')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Weight Unit */}
            <div className={`${themeClasses.bgCard} rounded-lg p-4 border ${themeClasses.borderPrimary}`}>
              <div className="flex-1">
                <label className={`${themeClasses.textPrimary} font-semibold block mb-1`}>
                  {language === 'hebrew' ? 'יחידת משקל' : 'Weight Unit'}
                </label>
                <p className={`${themeClasses.textSecondary} text-sm mb-3`}>
                  {language === 'hebrew'
                    ? 'גרמים או אונקיות'
                    : 'Grams or ounces'}
                </p>
                <div className="flex gap-2">
                  {['grams', 'ounces'].map((option) => (
                    <button
                      key={option}
                      onClick={() => handleToggle('weight_unit', option)}
                      disabled={saving}
                      className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                        weightUnit === option
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                          : `${themeClasses.borderPrimary} ${themeClasses.bgSecondary} ${themeClasses.textPrimary} hover:border-emerald-300`
                      }`}
                    >
                      {option === 'grams'
                        ? (language === 'hebrew' ? 'גרמים (g)' : 'Grams (g)')
                        : (language === 'hebrew' ? 'אונקיות (oz)' : 'Ounces (oz)')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Number Format */}
        <div>
          <h2 className={`${themeClasses.textPrimary} text-xl font-bold mb-4`}>
            {language === 'hebrew' ? 'עיצוב מספרים' : 'Number Format'}
          </h2>
          
          <div className="space-y-4">
            {/* Decimal Places */}
            <div className={`${themeClasses.bgCard} rounded-lg p-4 border ${themeClasses.borderPrimary}`}>
              <div className="flex-1">
                <label className={`${themeClasses.textPrimary} font-semibold block mb-1`}>
                  {language === 'hebrew' ? 'ספרות אחרי הנקודה' : 'Decimal Places'}
                </label>
                <p className={`${themeClasses.textSecondary} text-sm mb-3`}>
                  {language === 'hebrew'
                    ? 'מספר ספרות לאחר הנקודה העשרונית'
                    : 'Number of digits after decimal point'}
                </p>
                <div className="flex gap-2">
                  {[0, 1, 2].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleToggle('decimal_places', num)}
                      disabled={saving}
                      className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                        decimalPlaces === num
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                          : `${themeClasses.borderPrimary} ${themeClasses.bgSecondary} ${themeClasses.textPrimary} hover:border-emerald-300`
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* App Settings */}
        <div>
          <h2 className={`${themeClasses.textPrimary} text-xl font-bold mb-4`}>
            {language === 'hebrew' ? 'הגדרות אפליקציה' : 'App Settings'}
          </h2>
          
          <div className="space-y-4">
            {/* Dark Mode */}
            <div className={`${themeClasses.bgCard} rounded-lg p-4 border ${themeClasses.borderPrimary}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className={`${themeClasses.textPrimary} font-semibold block mb-1`}>
                    {language === 'hebrew' ? 'מצב כהה' : 'Dark Mode'}
                  </label>
                  <p className={`${themeClasses.textSecondary} text-sm`}>
                    {language === 'hebrew'
                      ? 'החלף בין מצב כהה ומצב בהיר'
                      : 'Switch between dark and light mode'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDarkMode}
                    onChange={toggleTheme}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            {/* Language */}
            <div className={`${themeClasses.bgCard} rounded-lg p-4 border ${themeClasses.borderPrimary}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className={`${themeClasses.textPrimary} font-semibold block mb-1`}>
                    {language === 'hebrew' ? 'שפה' : 'Language'}
                  </label>
                  <p className={`${themeClasses.textSecondary} text-sm`}>
                    {language === 'hebrew' ? 'עברית / English' : 'Hebrew / English'}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const newLanguage = language === 'hebrew' ? 'english' : 'hebrew';
                    toggleLanguage();
                    await handleToggle('user_language', newLanguage);
                  }}
                  disabled={saving}
                  className={`px-6 py-2 rounded-lg border-2 ${themeClasses.borderPrimary} ${themeClasses.bgSecondary} ${themeClasses.textPrimary} hover:border-emerald-300 transition-all`}
                >
                  {language === 'hebrew' ? 'EN' : 'עב'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
