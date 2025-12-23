import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useStripe } from '../context/StripeContext';
import { useSettings } from '../context/SettingsContext';
import { supabase, supabaseSecondary } from '../supabase/supabaseClient';
import { debugMealPlans, getFoodLogs, createFoodLog, updateFoodLog, deleteFoodLog, getChatMessages, createChatMessage, getCompaniesWithManagers, getClientCompanyAssignment, assignClientToCompany, getWeightLogs } from '../supabase/secondaryClient';
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
  const { user, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
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
  const [indicatorPosition, setIndicatorPosition] = useState({ top: 0, height: 0 });
  const tabRefs = useRef({});
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

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

  // Redirect to home page if not authenticated (only after auth loading is complete)
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, loading, navigate]);

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
      
      // First, load from clients table (primary database) to get user_code
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      // Then, try to load from chat_users table (secondary database) if user_code exists
      let chatUserData = null;
      const userCode = data?.user_code || profileData.userCode;
      if (supabaseSecondary && userCode) {
        try {
          const { data: chatUser, error: chatUserError } = await supabaseSecondary
            .from('chat_users')
            .select('medical_conditions, client_preference, food_allergies, full_name, email, phone_number, region, city, timezone, age, gender, date_of_birth, language')
            .eq('user_code', userCode)
            .single();
          
          if (!chatUserError && chatUser) {
            chatUserData = chatUser;
            if (process.env.NODE_ENV === 'development') {
              console.log('Profile data loaded from chat_users:', chatUserData);
            }
          }
        } catch (chatError) {
          console.error('Error loading from chat_users:', chatError);
        }
      }

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Detailed error loading profile:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return;
      }

      if (data || chatUserData) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Profile data loaded from clients:', data);
        }
        
        // Use chat_users data for health information if available, otherwise use clients data
        const healthData = chatUserData ? {
          // Extract dietary_preferences from client_preference (can be object with dietary_preferences key, or direct value)
          dietaryPreferences: typeof chatUserData.client_preference === 'object' && chatUserData.client_preference !== null
            ? (chatUserData.client_preference.dietary_preferences || chatUserData.client_preference || '')
            : (chatUserData.client_preference || ''),
          foodAllergies: chatUserData.food_allergies || '',
          medicalConditions: chatUserData.medical_conditions || ''
        } : {
          dietaryPreferences: data?.dietary_preferences || '',
          foodAllergies: data?.food_allergies || '',
          medicalConditions: data?.medical_conditions || ''
        };
        
        // Use chat_users data for other fields if available, otherwise use clients data
        const profileSource = chatUserData || data;
        
        // Split full_name into firstName and lastName
        const nameParts = ((chatUserData?.full_name || data?.full_name) || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        setProfileData((prev) => ({
          ...prev,
          firstName: firstName,
          lastName: lastName,
          email: (chatUserData?.email || data?.email || user.email) || '',
          phone: (chatUserData?.phone_number || data?.phone) || '',
          newsletter: false,
          status: 'active',
          birthDate: (chatUserData?.date_of_birth || data?.birth_date) || '',
          age: (chatUserData?.age || data?.age) ? (chatUserData?.age || data?.age).toString() : '',
          gender: (chatUserData?.gender || data?.gender) || '',
          dietaryPreferences: healthData.dietaryPreferences,
          foodAllergies: healthData.foodAllergies,
          medicalConditions: healthData.medicalConditions,
          userCode: data?.user_code || prev.userCode || '',
          region: (chatUserData?.region || data?.region) || '',
          city: (chatUserData?.city || data?.city) || '',
          timezone: (chatUserData?.timezone || data?.timezone) || '',
          userLanguage: (chatUserData?.language || data?.user_language) || '',
          companyId: prev.companyId || ''
        }));

        // Sync web language immediately after loading profile
        const userLang = chatUserData?.language || data?.user_language;
        if (userLang) {
          const languageMap = {
            'en': 'english',
            'he': 'hebrew',
            'english': 'english',
            'hebrew': 'hebrew'
          };
          
          const webLanguage = languageMap[userLang.toLowerCase()] || 'english';
          
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
                food_allergies: dataToSave.food_allergies, // text field
                client_preference: dataToSave.dietary_preferences || null, // jsonb field - save value directly
                medical_conditions: dataToSave.medical_conditions, // text field
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
      description: language === 'hebrew' ? 'תקשורת עם הדיאטנית AI שלך' : 'Communication with your AI dietitian'
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
      description: language === 'hebrew' ? 'התאם אישית את האתר' : 'Customize your website experience'
    }
  ];

  // Prevent body scrolling to avoid double scrollbars
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Update indicator position when activeTab changes
  useEffect(() => {
    const updateIndicatorPosition = () => {
      const tabElement = tabRefs.current[activeTab];
      if (tabElement) {
        const navElement = tabElement.closest('nav');
        const navContainer = navElement?.parentElement; // The div with p-4
        if (navElement && navContainer) {
          const navContainerRect = navContainer.getBoundingClientRect();
          const tabRect = tabElement.getBoundingClientRect();
          setIndicatorPosition({
            top: tabRect.top - navContainerRect.top,
            height: tabRect.height
          });
        }
      }
    };

    // Update immediately
    updateIndicatorPosition();
    
    // Also update after a short delay to account for any layout shifts
    const timeoutId = setTimeout(updateIndicatorPosition, 100);
    
    return () => clearTimeout(timeoutId);
  }, [activeTab]);

  // Listen for tour to open/close mobile drawer
  useEffect(() => {
    const handleOpenDrawer = () => {
      setIsMobileNavOpen(true);
    };

    const handleCloseDrawer = () => {
      setIsMobileNavOpen(false);
    };

    window.addEventListener('openMobileDrawer', handleOpenDrawer);
    window.addEventListener('closeMobileDrawer', handleCloseDrawer);
    return () => {
      window.removeEventListener('openMobileDrawer', handleOpenDrawer);
      window.removeEventListener('closeMobileDrawer', handleCloseDrawer);
    };
  }, []);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={`min-h-screen ${themeClasses.bgPrimary} flex flex-col lg:flex-row language-transition language-text-transition`} dir={direction} style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar Navigation - Desktop */}
      <div data-tour="profile-sidebar" className={`hidden lg:block ${language === 'english' ? 'lg:w-96' : 'lg:w-80'} ${themeClasses.bgCard} ${themeClasses.shadowCard} border-r-2 ${themeClasses.borderPrimary} relative overflow-hidden flex flex-col`} dir={direction} style={{
        borderLeft: '3px solid',
        borderLeftColor: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
        boxShadow: isDarkMode 
          ? 'inset -1px 0 0 rgba(16, 185, 129, 0.1), 4px 0 12px rgba(0, 0, 0, 0.3)' 
          : 'inset -1px 0 0 rgba(16, 185, 129, 0.1), 4px 0 12px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none" />
        
        {/* Header */}
        <div className="p-6 border-b-2 border-emerald-500/20 relative z-10">
          <div className="flex items-center mb-4">
            <div className="relative">
              <img src="/favicon.ico" alt="BetterChoice Logo" className={`w-12 h-12 rounded-lg shadow-lg ring-2 ring-emerald-500/20 ${direction === 'rtl' ? 'ml-3' : 'mr-3'}`} />
              <div className={`absolute -top-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse ${direction === 'rtl' ? '-left-1' : '-right-1'}`} />
            </div>
            <div className={direction === 'rtl' ? 'text-right' : 'text-left'}>
              <h1 className={`${themeClasses.textPrimary} text-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent`}>BetterChoice</h1>
              <p className={`${themeClasses.textSecondary} text-sm`}>{t.profile.title}</p>
            </div>
          </div>
          
          {/* Control Buttons */}
          <div className="space-y-3">
            {/* Go Back to Home */}
            <Link 
              to="/"
              data-tour="profile-home-button"
              className={`w-full flex items-center p-3 rounded-xl transition-all duration-300 hover:scale-[1.02] ${themeClasses.bgSecondary} border border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-md ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-teal-500/20 ${themeClasses.textPrimary} ${direction === 'rtl' ? 'ml-3' : 'mr-3'}`}>
                <span className="text-sm">🏠</span>
              </div>
              <div className={`flex-1 min-w-0 overflow-hidden ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                <div className={`font-semibold ${themeClasses.textPrimary} text-sm`} style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {language === 'hebrew' ? 'חזור לעמוד הבית' : 'Return to Home'}
                </div>
                <div className={`text-xs ${themeClasses.textMuted}`} style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word'
                }}>
                  {language === 'hebrew' ? 'חזור לעמוד הראשי' : 'Go back to the main homepage'}
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="p-4 relative flex-1 overflow-y-auto overflow-x-hidden" id="nav-container">
          {/* Sliding Indicator */}
          <div 
            className="absolute left-0 w-1 bg-gradient-to-b from-emerald-400 via-emerald-500 to-teal-500 rounded-r-full shadow-lg shadow-emerald-500/50 z-10 transition-all duration-500 ease-out"
            style={{
              top: `${indicatorPosition.top}px`,
              height: `${indicatorPosition.height}px`,
            }}
          />
          
          <nav className="space-y-2 relative z-0">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                ref={(el) => {
                  if (el) tabRefs.current[tab.id] = el;
                }}
                data-tour={tab.id === 'profile' ? 'profile-tab' : tab.id === 'myPlan' ? 'myplan-tab' : tab.id === 'dailyLog' ? 'dailylog-tab' : tab.id === 'messages' ? 'messages-tab' : tab.id === 'pricing' ? 'pricing-tab' : tab.id === 'settings' ? 'settings-tab' : null}
                onClick={() => {
                  setActiveTab(tab.id);
                  // Update indicator position immediately on click
                  setTimeout(() => {
                    const tabElement = tabRefs.current[tab.id];
                    if (tabElement) {
                      const navContainer = tabElement.closest('div.relative'); // The parent div with p-4
                      if (navContainer) {
                        const containerRect = navContainer.getBoundingClientRect();
                        const tabRect = tabElement.getBoundingClientRect();
                        setIndicatorPosition({
                          top: tabRect.top - containerRect.top,
                          height: tabRect.height
                        });
                      }
                    }
                  }, 0);
                }}
                className={`w-full flex items-center p-4 rounded-xl transition-all duration-300 relative ${direction === 'rtl' ? 'flex-row-reverse' : ''} ${
                  activeTab === tab.id
                    ? `${themeClasses.bgSecondary} ${themeClasses.shadowCard} scale-[1.02]`
                    : `hover:${themeClasses.bgSecondary} hover:scale-[1.01]`
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${direction === 'rtl' ? 'ml-4' : 'mr-4'} ${
                  activeTab === tab.id 
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/50 scale-110' 
                    : `${themeClasses.bgSecondary} ${themeClasses.textPrimary}`
                }`}>
                  <span className="text-lg">{tab.icon}</span>
                </div>
                <div className={`flex-1 min-w-0 overflow-hidden ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                  <div className={`font-semibold transition-colors duration-300 ${
                    activeTab === tab.id ? themeClasses.textPrimary : themeClasses.textSecondary
                  }`} style={{ 
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {tab.label}
                  </div>
                  <div className={`text-sm transition-colors duration-300 ${
                    activeTab === tab.id ? themeClasses.textSecondary : themeClasses.textMuted
                  }`} style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    wordBreak: 'break-word'
                  }}>
                    {tab.description}
                  </div>
                </div>
                {activeTab === tab.id && (
                  <div className={`absolute w-2 h-2 bg-emerald-500 rounded-full animate-pulse ${direction === 'rtl' ? 'left-2' : 'right-2'}`} />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Bottom Controls */}
        <div className="p-6 border-t-2 border-emerald-500/20 relative z-10">
          <div className="flex items-center justify-between">
            {/* Language Control */}
            <div className="flex items-center">
              <button 
                onClick={toggleLanguage}
                className={`${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} rounded-xl p-3 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 border border-blue-400/20 hover:border-blue-400/40`}
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
                className={`${themeClasses.bgCard} border-2 border-emerald-500/30 rounded-full p-3 hover:${themeClasses.bgSecondary} transition-all duration-300 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-110`}
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
      <div className={`lg:hidden ${themeClasses.bgCard} ${themeClasses.shadowCard} relative overflow-hidden`} style={{
        borderLeft: '3px solid',
        borderLeftColor: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
        borderRight: '2px solid',
        borderRightColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
        borderTop: '2px solid',
        borderTopColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
        borderBottom: '2px solid',
        borderBottomColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
        boxShadow: isDarkMode 
          ? 'inset -1px 0 0 rgba(16, 185, 129, 0.1), 0 4px 12px rgba(0, 0, 0, 0.3)' 
          : 'inset -1px 0 0 rgba(16, 185, 129, 0.1), 0 4px 12px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none" />
        
        <div className="relative z-10">
          {/* Header Section */}
          <div className="p-4 pb-3 border-b-2 border-emerald-500/20 relative">
            <div className="flex items-center justify-center relative">
              {/* Menu button - positioned absolutely on the left */}
              <button
                data-tour="mobile-menu-button"
                onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
                className={`absolute left-0 p-2 rounded-xl transition-all duration-300 ${themeClasses.bgSecondary} border border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-lg hover:scale-105 active:scale-95`}
                aria-label={language === 'hebrew' ? 'תפריט' : 'Menu'}
              >
                <div className="w-6 h-6 flex flex-col justify-center gap-1.5">
                  <span className={`block h-0.5 w-6 ${themeClasses.textPrimary} transition-all duration-300 ${isMobileNavOpen ? 'rotate-45 translate-y-2' : ''}`} style={{ backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}></span>
                  <span className={`block h-0.5 w-6 ${themeClasses.textPrimary} transition-all duration-300 ${isMobileNavOpen ? 'opacity-0' : 'opacity-100'}`} style={{ backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}></span>
                  <span className={`block h-0.5 w-6 ${themeClasses.textPrimary} transition-all duration-300 ${isMobileNavOpen ? '-rotate-45 -translate-y-2' : ''}`} style={{ backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}></span>
                </div>
              </button>
              
              {/* Centered logo and text */}
              <div className="flex items-center">
                <div className="relative">
                  <img src="/favicon.ico" alt="BetterChoice Logo" className="w-12 h-12 mr-3 rounded-xl shadow-lg ring-2 ring-emerald-500/20" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse shadow-lg shadow-emerald-500/50" />
                </div>
                <div>
                  <h1 className={`${themeClasses.textPrimary} text-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent`}>BetterChoice</h1>
                  <p className={`${themeClasses.textSecondary} text-xs mt-0.5`}>{t.profile.title}</p>
                </div>
              </div>
              
              {/* Home button - positioned absolutely on the right */}
              <Link 
                to="/"
                className={`absolute right-0 flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all duration-300 hover:scale-[1.02] ${themeClasses.bgSecondary} border border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/20 ${themeClasses.textPrimary} text-sm font-medium`}
              >
                <span className="text-base">🏠</span>
                <span className="hidden sm:inline">{language === 'hebrew' ? 'בית' : 'Home'}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer - Slides in from left (English) or right (Hebrew) */}
      <div className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ${isMobileNavOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsMobileNavOpen(false)}
        />
        
        {/* Navigation Panel */}
        <div 
          className={`absolute top-0 h-full w-80 max-w-[85vw] ${direction === 'rtl' ? 'right-0' : 'left-0'} ${themeClasses.bgCard} ${themeClasses.shadowCard} transform transition-transform duration-300 ease-out ${
            isMobileNavOpen 
              ? 'translate-x-0' 
              : direction === 'rtl' 
                ? 'translate-x-full' 
                : '-translate-x-full'
          }`}
          style={{
            [direction === 'rtl' ? 'borderLeft' : 'borderRight']: '3px solid',
            [direction === 'rtl' ? 'borderLeftColor' : 'borderRightColor']: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
            boxShadow: isDarkMode 
              ? direction === 'rtl' 
                ? '-4px 0 12px rgba(0, 0, 0, 0.3)' 
                : '4px 0 12px rgba(0, 0, 0, 0.3)'
              : direction === 'rtl'
                ? '-4px 0 12px rgba(0, 0, 0, 0.1)'
                : '4px 0 12px rgba(0, 0, 0, 0.1)'
          }}
          dir={direction}
        >
          {/* Decorative gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none" />
          
          <div className="relative z-10 h-full flex flex-col">
            {/* Header in drawer */}
            <div className="p-4 pb-3 border-b-2 border-emerald-500/20">
              <div className={`flex items-center justify-between mb-4 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
                  <div className="relative">
                    <img src="/favicon.ico" alt="BetterChoice Logo" className={`w-12 h-12 ${direction === 'rtl' ? 'ml-3' : 'mr-3'} rounded-xl shadow-lg ring-2 ring-emerald-500/20`} />
                    <div className={`absolute -top-1 ${direction === 'rtl' ? '-left-1' : '-right-1'} w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse shadow-lg shadow-emerald-500/50`} />
                  </div>
                  <div className={direction === 'rtl' ? 'text-right' : 'text-left'}>
                    <h1 className={`${themeClasses.textPrimary} text-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent`}>BetterChoice</h1>
                    <p className={`${themeClasses.textSecondary} text-xs mt-0.5`}>{t.profile.title}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileNavOpen(false)}
                  className={`p-2 rounded-xl transition-all duration-300 ${themeClasses.bgSecondary} border border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-lg hover:scale-105 active:scale-95`}
                  aria-label={language === 'hebrew' ? 'סגור' : 'Close'}
                >
                  <svg className={`w-6 h-6 ${themeClasses.textPrimary}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <Link 
                to="/"
                onClick={() => setIsMobileNavOpen(false)}
                className={`w-full flex items-center ${direction === 'rtl' ? 'flex-row-reverse' : ''} gap-2 px-3 py-2.5 rounded-xl transition-all duration-300 hover:scale-[1.02] ${themeClasses.bgSecondary} border border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/20 ${themeClasses.textPrimary} text-sm font-medium`}
              >
                <span className="text-base">🏠</span>
                <span>{language === 'hebrew' ? 'חזור לעמוד הבית' : 'Return to Home'}</span>
              </Link>
            </div>

            {/* Mobile Tab Navigation */}
            <div className="flex-1 overflow-y-auto px-4 py-3 bg-gradient-to-b from-emerald-500/5 to-transparent">
              <div className="space-y-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    data-tour={tab.id === 'profile' ? 'profile-tab' : tab.id === 'myPlan' ? 'myplan-tab' : tab.id === 'dailyLog' ? 'dailylog-tab' : tab.id === 'messages' ? 'messages-tab' : tab.id === 'pricing' ? 'pricing-tab' : tab.id === 'settings' ? 'settings-tab' : null}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center ${direction === 'rtl' ? 'flex-row-reverse' : ''} gap-3 px-4 py-3 rounded-2xl transition-all duration-300 relative font-medium ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-emerald-500 via-emerald-500 to-teal-500 text-white shadow-xl shadow-emerald-500/50 scale-[1.02] border-2 border-emerald-400/50'
                        : `${themeClasses.bgSecondary} ${themeClasses.textSecondary} hover:scale-[1.01] hover:${themeClasses.bgPrimary} border border-transparent hover:border-emerald-500/20`
                    }`}
                  >
                    <span className="text-2xl">{tab.icon}</span>
                    <div className={`flex-1 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                      <div className={`text-sm font-semibold ${activeTab === tab.id ? 'text-white' : ''}`}>{tab.label}</div>
                      <div className={`text-xs mt-0.5 ${activeTab === tab.id ? 'text-emerald-100' : themeClasses.textMuted}`}>{tab.description}</div>
                    </div>
                    {activeTab === tab.id && (
                      <>
                        <div className={`absolute ${direction === 'rtl' ? 'left-2' : 'right-2'} w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-400/70 border-2 border-white dark:border-gray-800`} />
                        <div className={`absolute inset-0 rounded-2xl ${direction === 'rtl' ? 'bg-gradient-to-l' : 'bg-gradient-to-r'} from-white/20 to-transparent pointer-events-none`} />
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme and Language Controls - Mobile */}
            <div className="flex items-center justify-between px-4 py-3 border-t-2 border-emerald-500/20 bg-gradient-to-b from-transparent to-emerald-500/5">
              <button 
                onClick={toggleLanguage}
                className={`${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} rounded-xl px-4 py-2.5 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 border border-blue-400/20 hover:border-blue-400/40 active:scale-95`}
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd"/>
                  </svg>
                  <span className="text-blue-400 text-sm font-semibold">{language === 'hebrew' ? 'עב' : 'En'}</span>
                </div>
              </button>

              <button 
                onClick={toggleTheme}
                className={`${themeClasses.bgCard} border-2 border-emerald-500/30 rounded-full p-2.5 hover:${themeClasses.bgSecondary} transition-all duration-300 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-110 active:scale-95`}
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
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto custom-scrollbar relative ${themeClasses.bgCard} ${themeClasses.shadowCard}`} style={{
        minHeight: 0,
        borderLeft: '3px solid',
        borderLeftColor: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
        borderRight: '2px solid',
        borderRightColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
        borderTop: '2px solid',
        borderTopColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
        borderBottom: '2px solid',
        borderBottomColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
        boxShadow: isDarkMode 
          ? 'inset 1px 0 0 rgba(16, 185, 129, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2), 4px 0 12px rgba(0, 0, 0, 0.3)' 
          : 'inset 1px 0 0 rgba(16, 185, 129, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 4px 0 12px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none z-0" />
        
        <div className={`rounded-xl p-6 language-transition language-text-transition relative z-10`}>
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
            <DailyLogTab themeClasses={themeClasses} t={t} userCode={profileData.userCode} language={language} clientRegion={profileData.region} direction={direction} />
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
// Weight Progress Component
const WeightProgressComponent = ({ userCode, themeClasses, language, isDarkMode }) => {
  const [weightLogs, setWeightLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState('weight'); // 'weight', 'body_fat', 'waist', 'hip', etc.
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [timePeriod, setTimePeriod] = useState('all'); // '1m', '3m', '6m', 'all'
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showAverage, setShowAverage] = useState(false);

  useEffect(() => {
    const loadWeightLogs = async () => {
      if (!userCode) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await getWeightLogs(userCode);
      
      if (error) {
        console.error('Error loading weight logs:', error);
        setWeightLogs([]);
      } else {
        setWeightLogs(data || []);
      }
      setLoading(false);
    };

    loadWeightLogs();
  }, [userCode]);

  // Reset hovered point and trigger animation when time period or metric changes
  useEffect(() => {
    setHoveredPoint(null);
    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 400); // Match animation duration
    return () => clearTimeout(timer);
  }, [timePeriod, selectedMetric]);

  // Format date for display (short format)
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return language === 'hebrew' 
      ? date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Format date for tooltip (full format)
  const formatDateFull = (dateString) => {
    const date = new Date(dateString);
    return language === 'hebrew'
      ? date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
      : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Get chart data points with time period filtering
  const getChartData = () => {
    if (!weightLogs || weightLogs.length === 0) return [];

    let filteredLogs = [...weightLogs];

    // Filter by time period
    if (timePeriod !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (timePeriod) {
        case '1m':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case '3m':
          cutoffDate.setMonth(now.getMonth() - 3);
          break;
        case '6m':
          cutoffDate.setMonth(now.getMonth() - 6);
          break;
        default:
          break;
      }
      
      filteredLogs = weightLogs.filter(log => {
        const logDate = new Date(log.measurement_date);
        return logDate >= cutoffDate;
      });
    }

    return filteredLogs.map(log => ({
      date: formatDate(log.measurement_date),
      dateFull: log.measurement_date,
      weight: log.weight_kg,
      bodyFat: log.body_fat_percentage,
      waist: log.waist_circumference_cm,
      hip: log.hip_circumference_cm,
      arm: log.arm_circumference_cm,
      neck: log.neck_circumference_cm
    }));
  };

  const chartData = getChartData();

  // Helper function to get value for selected metric
  const getMetricValue = (d) => {
    switch(selectedMetric) {
      case 'weight': return d.weight;
      case 'body_fat': return d.bodyFat;
      case 'waist': return d.waist;
      case 'hip': return d.hip;
      case 'arm': return d.arm;
      case 'neck': return d.neck;
      default: return d.weight;
    }
  };

  // Calculate min/max for Y-axis
  const getYAxisRange = () => {
    if (chartData.length === 0) return { min: 0, max: 100 };
    
    const values = chartData.map(d => getMetricValue(d)).filter(v => v != null);

    if (values.length === 0) return { min: 0, max: 100 };
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1 || 1;
    
    return { min: Math.max(0, min - padding), max: max + padding };
  };

  const { min, max } = getYAxisRange();
  const range = max - min || 1;

  // Get current value for selected metric
  const getCurrentValue = () => {
    if (chartData.length === 0) return null;
    const latest = chartData[chartData.length - 1];
    return getMetricValue(latest);
  };

  // Get metric unit
  const getMetricUnit = () => {
    switch(selectedMetric) {
      case 'weight': return 'kg';
      case 'body_fat': return '%';
      case 'waist':
      case 'hip':
      case 'arm':
      case 'neck': return 'cm';
      default: return 'kg';
    }
  };

  // Get metric label
  const getMetricLabel = () => {
    switch(selectedMetric) {
      case 'weight': return language === 'hebrew' ? 'משקל' : 'Weight';
      case 'body_fat': return language === 'hebrew' ? 'אחוז שומן' : 'Body Fat';
      case 'waist': return language === 'hebrew' ? 'היקף מותניים' : 'Waist';
      case 'hip': return language === 'hebrew' ? 'היקף ירכיים' : 'Hip';
      case 'arm': return language === 'hebrew' ? 'היקף זרוע' : 'Arm';
      case 'neck': return language === 'hebrew' ? 'היקף צוואר' : 'Neck';
      default: return language === 'hebrew' ? 'משקל' : 'Weight';
    }
  };

  const currentValue = getCurrentValue();

  // Calculate average value for selected metric
  const getAverageValue = () => {
    if (chartData.length === 0) return null;
    const values = chartData.map(d => getMetricValue(d)).filter(v => v != null);
    if (values.length === 0) return null;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  };

  const averageValue = getAverageValue();

  // Handle point hover
  const handlePointMouseEnter = (d, index, value, x, y) => {
    setHoveredPoint({ index, data: d, value, x, y });
  };

  const handlePointMouseLeave = () => {
    setHoveredPoint(null);
  };

  // Handle mouse move over chart area to find closest point
  const handleChartMouseMove = (e) => {
    if (chartData.length === 0) return;
    
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const svgPoint = svg.createSVGPoint();
    svgPoint.x = e.clientX;
    svgPoint.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (ctm) {
      svgPoint.x = (e.clientX - rect.left) * (800 / rect.width);
      svgPoint.y = (e.clientY - rect.top) * (200 / rect.height);
    }
    
    const mouseX = svgPoint.x;
    const chartWidth = 700;
    const chartStartX = 50;
    const chartEndX = chartStartX + chartWidth;
    
    // Only process if mouse is within chart area
    if (mouseX < chartStartX || mouseX > chartEndX) {
      setHoveredPoint(null);
      return;
    }
    
    // Find closest data point based on X position
    let closestIndex = 0;
    let minDistance = Infinity;
    
    chartData.forEach((d, index) => {
      const value = getMetricValue(d);
      if (value == null) return;
      
      const x = chartStartX + (index / (chartData.length - 1 || 1)) * chartWidth;
      const distance = Math.abs(mouseX - x);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });
    
    // Get the closest point's data
    const closestData = chartData[closestIndex];
    const closestValue = getMetricValue(closestData);
    if (closestValue == null) return;
    
    const normalizedValue = closestValue - min;
    const ratio = normalizedValue / range;
    const x = chartStartX + (closestIndex / (chartData.length - 1 || 1)) * chartWidth;
    const y = 180 - (ratio * 160);
    
    setHoveredPoint({ index: closestIndex, data: closestData, value: closestValue, x, y });
  };

  const handleChartMouseLeave = () => {
    setHoveredPoint(null);
  };

  if (loading) {
    return (
      <div className={`${themeClasses.bgCard} rounded-2xl p-6 mb-6 animate-pulse`}>
        <div className="h-48 bg-gray-700 rounded-lg"></div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return null; // Don't show if no data
  }

  return (
    <div className={`${themeClasses.bgCard} rounded-2xl p-6 mb-6 shadow-lg border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={`${themeClasses.textPrimary} text-xl font-bold`}>
            {language === 'hebrew' ? 'מעקב משקל והתקדמות' : 'Weight & Progress Tracking'}
          </h3>
          <div className="flex gap-4 mt-1">
            {currentValue != null && (
              <p className={`${themeClasses.textSecondary} text-sm`}>
                {language === 'hebrew' ? 'ערך נוכחי: ' : 'Current: '}
                <span className="font-semibold">
                  {currentValue.toFixed(selectedMetric === 'weight' || selectedMetric === 'body_fat' ? 1 : 0)} {getMetricUnit()}
                </span>
              </p>
            )}
            {averageValue != null && (
              <p className={`${themeClasses.textSecondary} text-sm`}>
                {language === 'hebrew' ? 'ממוצע: ' : 'Average: '}
                <span className="font-semibold">
                  {averageValue.toFixed(selectedMetric === 'weight' || selectedMetric === 'body_fat' ? 1 : 0)} {getMetricUnit()}
                </span>
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`px-4 py-2 rounded-lg ${themeClasses.bgSecondary} ${themeClasses.textPrimary} hover:${themeClasses.bgPrimary} transition-colors text-sm font-medium`}
        >
          {expanded 
            ? (language === 'hebrew' ? 'סגור' : 'Hide Options')
            : (language === 'hebrew' ? 'מידות נוספות' : 'More Measurements')
          }
        </button>
      </div>

      {/* Time Period Filter */}
      <div className="flex gap-2 mb-4 items-center">
        {[
          { key: '1m', label: language === 'hebrew' ? 'חודש 1' : '1 Month' },
          { key: '3m', label: language === 'hebrew' ? '3 חודשים' : '3 Months' },
          { key: '6m', label: language === 'hebrew' ? '6 חודשים' : '6 Months' },
          { key: 'all', label: language === 'hebrew' ? 'כל הזמן' : 'All Time' }
        ].map(period => (
          <button
            key={period.key}
            onClick={() => setTimePeriod(period.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              timePeriod === period.key
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/40'
                : `${themeClasses.bgSecondary} ${themeClasses.textSecondary} hover:${themeClasses.bgPrimary}`
            }`}
          >
            {period.label}
          </button>
        ))}
        <button
          onClick={() => setShowAverage(!showAverage)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ml-auto ${
            showAverage
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/40'
              : `${themeClasses.bgSecondary} ${themeClasses.textSecondary} hover:${themeClasses.bgPrimary}`
          }`}
        >
          {language === 'hebrew' ? 'ממוצע' : 'Average'}
        </button>
      </div>

      {expanded && (
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { key: 'weight', label: language === 'hebrew' ? 'משקל' : 'Weight', unit: 'kg' },
            { key: 'body_fat', label: language === 'hebrew' ? 'אחוז שומן' : 'Body Fat', unit: '%' },
            { key: 'waist', label: language === 'hebrew' ? 'היקף מותניים' : 'Waist', unit: 'cm' },
            { key: 'hip', label: language === 'hebrew' ? 'היקף ירכיים' : 'Hip', unit: 'cm' },
            { key: 'arm', label: language === 'hebrew' ? 'היקף זרוע' : 'Arm', unit: 'cm' },
            { key: 'neck', label: language === 'hebrew' ? 'היקף צוואר' : 'Neck', unit: 'cm' }
          ].map(metric => (
            <button
              key={metric.key}
              onClick={() => setSelectedMetric(metric.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedMetric === metric.key
                  ? 'text-white shadow-md shadow-emerald-500/40'
                  : `${themeClasses.bgSecondary} ${themeClasses.textSecondary} hover:${themeClasses.bgPrimary}`
              }`}
              style={selectedMetric === metric.key ? { backgroundColor: '#10b981' } : {}}
            >
              {metric.label}
            </button>
          ))}
        </div>
      )}

      {/* Simple Line & Area Chart */}
      <div className="relative h-64 w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-900/40 via-slate-900/10 to-slate-900/40">
        <div
          style={{
            opacity: isTransitioning ? 0.5 : 1,
            transform: isTransitioning ? 'scale(0.97)' : 'scale(1)',
            transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <svg 
            className="w-full h-full" 
            viewBox="0 0 800 200" 
            preserveAspectRatio="none"
            onMouseMove={handleChartMouseMove}
            onMouseLeave={handleChartMouseLeave}
          >
          {/* Y-axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const value = min + (range * ratio);
            const y = 200 - (ratio * 180);
            return (
              <text
                key={ratio}
                x="5"
                y={y + 4}
                className={`text-xs ${themeClasses.textSecondary}`}
                fill="currentColor"
              >
                {value.toFixed(selectedMetric === 'weight' || selectedMetric === 'body_fat' ? 1 : 0)} {getMetricUnit()}
              </text>
            );
          })}

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = 200 - (ratio * 180);
            return (
              <line
                key={ratio}
                x1="50"
                y1={y}
                x2="750"
                y2={y}
                stroke={isDarkMode ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.2)'}
                strokeWidth="1"
                strokeDasharray="4,6"
              />
            );
          })}

          {/* Average line */}
          {showAverage && averageValue != null && (() => {
            const normalizedValue = averageValue - min;
            const ratio = normalizedValue / range;
            const y = 180 - (ratio * 160);
            return (
              <g>
                <line
                  x1="50"
                  y1={y}
                  x2="750"
                  y2={y}
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeDasharray="6,4"
                  opacity="0.6"
                  style={{
                    opacity: isTransitioning ? 0.3 : 0.6,
                    transition: 'opacity 0.3s ease-in-out'
                  }}
                />
                <text
                  x="755"
                  y={y + 4}
                  className={`text-xs font-semibold`}
                  fill="#10b981"
                  opacity="0.8"
                >
                  Avg
                </text>
              </g>
            );
          })()}

          {/* Data line + soft area */}
          {chartData.length > 1 && (() => {
            const chartWidth = 700;
            const linePoints = chartData
              .map((d, index) => {
                const value = getMetricValue(d);
                if (value == null) return null;
                const normalizedValue = value - min;
                const ratio = normalizedValue / range;
                const x = 50 + (index / (chartData.length - 1 || 1)) * chartWidth;
                const y = 180 - (ratio * 160);
                return { x, y };
              })
              .filter(p => p !== null);

            if (linePoints.length < 2) return null;

            const points = linePoints.map(p => `${p.x},${p.y}`).join(' ');
            const areaPath = [
              `M 50 180`,
              ...linePoints.map(p => `L ${p.x} ${p.y}`),
              `L 750 180`,
              'Z'
            ].join(' ');

            return (
              <>
                <path
                  d={areaPath}
                  fill="#10b981"
                  opacity={isDarkMode ? 0.14 : 0.18}
                  style={{
                    transition: 'opacity 0.3s ease-in-out'
                  }}
                />
                <polyline
                  points={points}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    opacity: isTransitioning ? 0.6 : 1,
                    filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.5))',
                    transition: 'opacity 0.3s ease-in-out'
                  }}
                />
              </>
            );
          })()}

          {/* Data points (sparser, with hover emphasis) */}
          {chartData.map((d, index) => {
            const value = getMetricValue(d);
            if (value == null) return null;
            const normalizedValue = value - min;
            const ratio = normalizedValue / range;
            const chartWidth = 700;
            const x = 50 + (index / (chartData.length - 1 || 1)) * chartWidth;
            const y = 180 - (ratio * 160);
            const isHovered = hoveredPoint && hoveredPoint.index === index;
            const step = Math.max(1, Math.floor(chartData.length / 80));
            const showPoint = isHovered || index % step === 0 || index === chartData.length - 1;
            if (!showPoint) return null;

            return (
              <circle
                key={`point-${index}`}
                cx={x}
                cy={y}
                r={isHovered ? 6 : 3}
                fill="#10b981"
                stroke={isDarkMode ? '#020617' : '#ffffff'}
                strokeWidth={isHovered ? 3 : 2}
                className="transition-all cursor-pointer"
                style={{ 
                  transition: 'r 0.2s, opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  opacity: isTransitioning ? 0.6 : 1
                }}
                onMouseEnter={() => handlePointMouseEnter(d, index, value, x, y)}
                onMouseLeave={handlePointMouseLeave}
              />
            );
          }).filter(Boolean)}

          {/* Tooltip */}
          {hoveredPoint && (() => {
            const tooltipWidth = 140;
            const tooltipHeight = 50;
            const padding = 10;
            const chartRightBound = 750; // 50 (left padding) + 700 (chart width)
            
            // Calculate tooltip X position (keep within bounds)
            let tooltipX = hoveredPoint.x - (tooltipWidth / 2);
            if (tooltipX < padding) {
              tooltipX = padding;
            } else if (tooltipX + tooltipWidth > chartRightBound - padding) {
              tooltipX = chartRightBound - tooltipWidth - padding;
            }
            
            // Center of tooltip rectangle (for text alignment)
            const tooltipCenterX = tooltipX + (tooltipWidth / 2);
            
            // Calculate tooltip Y position (above or below point)
            let tooltipY = hoveredPoint.y - tooltipHeight - 10; // Try above first
            let textY1 = tooltipY + 18; // Date text position
            let textY2 = tooltipY + 35; // Value text position
            
            // If tooltip would go above the chart, position it below
            if (tooltipY < padding) {
              tooltipY = hoveredPoint.y + 15;
              textY1 = tooltipY + 18;
              textY2 = tooltipY + 35;
            }
            
            // Ensure tooltip doesn't go below the chart
            if (tooltipY + tooltipHeight > 200 - padding) {
              tooltipY = 200 - tooltipHeight - padding;
              textY1 = tooltipY + 18;
              textY2 = tooltipY + 35;
            }
            
            return (
              <g
                style={{
                  opacity: isTransitioning ? 0 : 1,
                  transition: 'opacity 0.2s ease-in-out'
                }}
              >
                {/* Vertical line at hovered point */}
                <line
                  x1={hoveredPoint.x}
                  y1="20"
                  x2={hoveredPoint.x}
                  y2="180"
                  stroke="#10b981"
                  strokeWidth="1"
                  strokeDasharray="4,4"
                  opacity="0.5"
                />
                {/* Tooltip background */}
                <rect
                  x={tooltipX}
                  y={tooltipY}
                  width={tooltipWidth}
                  height={tooltipHeight}
                  rx="6"
                  fill={isDarkMode ? "rgba(30, 41, 59, 0.98)" : "rgba(255, 255, 255, 0.98)"}
                  stroke="#10b981"
                  strokeWidth="2"
                  filter="drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))"
                />
                {/* Tooltip text - Date */}
                <text
                  x={tooltipCenterX}
                  y={textY1}
                  textAnchor="middle"
                  className={`text-xs font-semibold ${themeClasses.textPrimary}`}
                  fill="currentColor"
                >
                  {formatDateFull(hoveredPoint.data.dateFull)}
                </text>
                {/* Tooltip text - Value */}
                <text
                  x={tooltipCenterX}
                  y={textY2}
                  textAnchor="middle"
                  className="text-base font-bold"
                  fill="#10b981"
                >
                  {hoveredPoint.value?.toFixed(selectedMetric === 'weight' || selectedMetric === 'body_fat' ? 1 : 0)} {getMetricUnit()}
                </text>
              </g>
            );
          })()}

          {/* X-axis labels */}
          {chartData.length > 0 && chartData.map((d, index) => {
            if (index % Math.ceil(chartData.length / 6) !== 0 && index !== chartData.length - 1) return null;
            const chartWidth = 700; // Match the chart width used for data points
            const x = 50 + (index / (chartData.length - 1 || 1)) * chartWidth;
            return (
              <text
                key={index}
                x={x}
                y="195"
                className={`text-xs ${themeClasses.textSecondary}`}
                fill="currentColor"
                textAnchor="middle"
              >
                {d.date}
              </text>
            );
          })}
        </svg>
        </div>
      </div>
    </div>
  );
};

// Food Log Progress Component
const FoodLogProgressComponent = ({ userCode, themeClasses, language, isDarkMode }) => {
  const [foodLogs, setFoodLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState('calories'); // 'calories', 'protein', 'carbs', 'fat'
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [timePeriod, setTimePeriod] = useState('all'); // '1m', '3m', '6m', 'all'
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showAverage, setShowAverage] = useState(false);

  useEffect(() => {
    const loadFoodLogs = async () => {
      if (!userCode) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await getFoodLogs(userCode); // Fetch all logs (no date filter)
      
      if (error) {
        console.error('Error loading food logs:', error);
        setFoodLogs([]);
      } else {
        setFoodLogs(data || []);
      }
      setLoading(false);
    };

    loadFoodLogs();
  }, [userCode]);

  // Reset hovered point and trigger animation when time period or metric changes
  useEffect(() => {
    setHoveredPoint(null);
    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [timePeriod, selectedMetric]);

  // Format date for display (short format)
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return language === 'hebrew' 
      ? date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Format date for tooltip (full format)
  const formatDateFull = (dateString) => {
    const date = new Date(dateString);
    return language === 'hebrew'
      ? date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
      : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Aggregate food logs by date
  const aggregateByDate = (logs) => {
    const dailyTotals = {};
    
    logs.forEach(log => {
      const date = log.log_date || log.created_at?.split('T')[0];
      if (!date) return;
      
      if (!dailyTotals[date]) {
        dailyTotals[date] = {
          date,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0
        };
      }
      
      // Sum up values from food_items array
      if (log.food_items && Array.isArray(log.food_items)) {
        log.food_items.forEach(item => {
          dailyTotals[date].calories += item.cals || 0;
          dailyTotals[date].protein += item.p || 0;
          dailyTotals[date].carbs += item.c || 0;
          dailyTotals[date].fat += item.f || 0;
        });
      }
      
      // Also add totals from the log itself if available (as fallback)
      if (log.total_calories) dailyTotals[date].calories += log.total_calories;
      if (log.total_protein_g) dailyTotals[date].protein += log.total_protein_g;
      if (log.total_carbs_g) dailyTotals[date].carbs += log.total_carbs_g;
      if (log.total_fat_g) dailyTotals[date].fat += log.total_fat_g;
    });
    
    return Object.values(dailyTotals).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  // Get chart data points with time period filtering
  const getChartData = () => {
    if (!foodLogs || foodLogs.length === 0) return [];

    const aggregated = aggregateByDate(foodLogs);
    let filteredData = [...aggregated];

    // Filter by time period
    if (timePeriod !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (timePeriod) {
        case '1m':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case '3m':
          cutoffDate.setMonth(now.getMonth() - 3);
          break;
        case '6m':
          cutoffDate.setMonth(now.getMonth() - 6);
          break;
        default:
          break;
      }
      
      filteredData = aggregated.filter(d => {
        const logDate = new Date(d.date);
        return logDate >= cutoffDate;
      });
    }

    return filteredData.map(d => ({
      date: formatDate(d.date),
      dateFull: d.date,
      calories: d.calories,
      protein: d.protein,
      carbs: d.carbs,
      fat: d.fat
    }));
  };

  const chartData = getChartData();

  // Helper function to get value for selected metric
  const getMetricValue = (d) => {
    switch(selectedMetric) {
      case 'calories': return d.calories;
      case 'protein': return d.protein;
      case 'carbs': return d.carbs;
      case 'fat': return d.fat;
      default: return d.calories;
    }
  };

  // Calculate min/max for Y-axis
  const getYAxisRange = () => {
    if (chartData.length === 0) return { min: 0, max: 100 };
    
    const values = chartData.map(d => getMetricValue(d)).filter(v => v != null && v > 0);

    if (values.length === 0) return { min: 0, max: 100 };
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1 || 1;
    
    return { min: Math.max(0, min - padding), max: max + padding };
  };

  const { min, max } = getYAxisRange();
  const range = max - min || 1;

  // Get current value for selected metric
  const getCurrentValue = () => {
    if (chartData.length === 0) return null;
    const latest = chartData[chartData.length - 1];
    return getMetricValue(latest);
  };

  // Get metric unit
  const getMetricUnit = () => {
    switch(selectedMetric) {
      case 'calories': return 'kcal';
      case 'protein':
      case 'carbs':
      case 'fat': return 'g';
      default: return 'kcal';
    }
  };

  // Get metric label
  const getMetricLabel = () => {
    switch(selectedMetric) {
      case 'calories': return language === 'hebrew' ? 'קלוריות' : 'Calories';
      case 'protein': return language === 'hebrew' ? 'חלבון' : 'Protein';
      case 'carbs': return language === 'hebrew' ? 'פחמימות' : 'Carbs';
      case 'fat': return language === 'hebrew' ? 'שומן' : 'Fat';
      default: return language === 'hebrew' ? 'קלוריות' : 'Calories';
    }
  };

  // Get metric color
  const getMetricColor = () => {
    switch(selectedMetric) {
      case 'calories': return '#10b981';
      case 'protein': return '#a855f7';
      case 'carbs': return '#3b82f6';
      case 'fat': return '#f59e0b';
      default: return '#10b981';
    }
  };

  const currentValue = getCurrentValue();
  const metricColor = getMetricColor();

  // Calculate average value for selected metric
  const getAverageValue = () => {
    if (chartData.length === 0) return null;
    const values = chartData.map(d => getMetricValue(d)).filter(v => v != null && v > 0);
    if (values.length === 0) return null;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  };

  const averageValue = getAverageValue();

  // Handle point hover
  const handlePointMouseEnter = (d, index, value, x, y) => {
    setHoveredPoint({ index, data: d, value, x, y });
  };

  const handlePointMouseLeave = () => {
    setHoveredPoint(null);
  };

  // Handle mouse move over chart area to find closest point
  const handleChartMouseMove = (e) => {
    if (chartData.length === 0) return;
    
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const svgPoint = svg.createSVGPoint();
    svgPoint.x = e.clientX;
    svgPoint.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (ctm) {
      svgPoint.x = (e.clientX - rect.left) * (800 / rect.width);
      svgPoint.y = (e.clientY - rect.top) * (200 / rect.height);
    }
    
    const mouseX = svgPoint.x;
    const chartStartX = 80;
    const chartWidth = 680;
    const chartEndX = chartStartX + chartWidth;
    
    if (mouseX < chartStartX || mouseX > chartEndX) {
      setHoveredPoint(null);
      return;
    }
    
    let closestIndex = 0;
    let minDistance = Infinity;
    
    chartData.forEach((d, index) => {
      const value = getMetricValue(d);
      if (value == null || value <= 0) return;
      
      const x = chartStartX + (index / (chartData.length - 1 || 1)) * chartWidth;
      const distance = Math.abs(mouseX - x);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });
    
    const closestData = chartData[closestIndex];
    const closestValue = getMetricValue(closestData);
    if (closestValue == null || closestValue <= 0) return;
    
    const normalizedValue = closestValue - min;
    const ratio = normalizedValue / range;
    const x = chartStartX + (closestIndex / (chartData.length - 1 || 1)) * chartWidth;
    const y = 180 - (ratio * 160);
    
    setHoveredPoint({ index: closestIndex, data: closestData, value: closestValue, x, y });
  };

  const handleChartMouseLeave = () => {
    setHoveredPoint(null);
  };

  if (loading) {
    return (
      <div className={`${themeClasses.bgCard} rounded-2xl p-6 mb-6 animate-pulse`}>
        <div className="h-48 bg-gray-700 rounded-lg"></div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className={`${themeClasses.bgCard} rounded-2xl p-6 mb-6 shadow-lg border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={`${themeClasses.textPrimary} text-xl font-bold`}>
            {language === 'hebrew' ? 'מעקב תזונה' : 'Nutrition Tracking'}
          </h3>
          <div className="flex gap-4 mt-1">
            {currentValue != null && (
              <p className={`${themeClasses.textSecondary} text-sm`}>
                {language === 'hebrew' ? 'ערך נוכחי: ' : 'Current: '}
                <span className="font-semibold">
                  {Math.round(currentValue)} {getMetricUnit()}
                </span>
              </p>
            )}
            {averageValue != null && (
              <p className={`${themeClasses.textSecondary} text-sm`}>
                {language === 'hebrew' ? 'ממוצע: ' : 'Average: '}
                <span className="font-semibold">
                  {Math.round(averageValue)} {getMetricUnit()}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Time Period Filter */}
      <div className="flex gap-2 mb-4 items-center">
        {[
          { key: '1m', label: language === 'hebrew' ? 'חודש 1' : '1 Month' },
          { key: '3m', label: language === 'hebrew' ? '3 חודשים' : '3 Months' },
          { key: '6m', label: language === 'hebrew' ? '6 חודשים' : '6 Months' },
          { key: 'all', label: language === 'hebrew' ? 'כל הזמן' : 'All Time' }
        ].map(period => (
          <button
            key={period.key}
            onClick={() => setTimePeriod(period.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              timePeriod === period.key
                ? 'bg-emerald-500 text-white'
                : `${themeClasses.bgSecondary} ${themeClasses.textSecondary} hover:${themeClasses.bgPrimary}`
            }`}
          >
            {period.label}
          </button>
        ))}
        <button
          onClick={() => setShowAverage(!showAverage)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ml-auto ${
            showAverage
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/40'
              : `${themeClasses.bgSecondary} ${themeClasses.textSecondary} hover:${themeClasses.bgPrimary}`
          }`}
        >
          {language === 'hebrew' ? 'ממוצע' : 'Average'}
        </button>
      </div>

      {/* Metric Selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { key: 'calories', label: language === 'hebrew' ? 'קלוריות' : 'Calories', color: '#10b981' },
          { key: 'protein', label: language === 'hebrew' ? 'חלבון' : 'Protein', color: '#a855f7' },
          { key: 'carbs', label: language === 'hebrew' ? 'פחמימות' : 'Carbs', color: '#3b82f6' },
          { key: 'fat', label: language === 'hebrew' ? 'שומן' : 'Fat', color: '#f59e0b' }
        ].map(metric => (
          <button
            key={metric.key}
            onClick={() => setSelectedMetric(metric.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedMetric === metric.key
                ? 'text-white'
                : `${themeClasses.bgSecondary} ${themeClasses.textSecondary} hover:${themeClasses.bgPrimary}`
            }`}
            style={selectedMetric === metric.key ? { backgroundColor: metric.color } : {}}
          >
            {metric.label}
          </button>
        ))}
      </div>

      {/* Simple Line & Area Chart */}
      <div className="relative h-64 w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-900/40 via-slate-900/10 to-slate-900/40">
        <div
          style={{
            opacity: isTransitioning ? 0.5 : 1,
            transform: isTransitioning ? 'scale(0.97)' : 'scale(1)',
            transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <svg 
            className="w-full h-full" 
            viewBox="0 0 800 200" 
            preserveAspectRatio="none"
            onMouseMove={handleChartMouseMove}
            onMouseLeave={handleChartMouseLeave}
          >
            {/* Y-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const value = min + (range * ratio);
              const y = 200 - (ratio * 180);
              return (
                <text
                  key={ratio}
                  x="5"
                  y={y + 4}
                  className={`text-xs ${themeClasses.textSecondary}`}
                  fill="currentColor"
                >
                  {Math.round(value).toLocaleString()} {getMetricUnit()}
                </text>
              );
            })}

            {/* Y-axis grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = 200 - (ratio * 180);
              return (
                <line
                  key={ratio}
                  x1="80"
                  y1={y}
                  x2="760"
                  y2={y}
                  stroke={isDarkMode ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.2)'}
                  strokeWidth="1"
                  strokeDasharray="4,6"
                />
              );
            })}

            {/* Average line */}
            {showAverage && averageValue != null && (() => {
              const normalizedValue = averageValue - min;
              const ratio = normalizedValue / range;
              const y = 180 - (ratio * 160);
              return (
                <g>
                  <line
                    x1="80"
                    y1={y}
                    x2="760"
                    y2={y}
                    stroke={metricColor}
                    strokeWidth="2"
                    strokeDasharray="6,4"
                    opacity="0.6"
                    style={{
                      opacity: isTransitioning ? 0.3 : 0.6,
                      transition: 'opacity 0.3s ease-in-out'
                    }}
                  />
                  <text
                    x="765"
                    y={y + 4}
                    className={`text-xs font-semibold`}
                    fill={metricColor}
                    opacity="0.8"
                  >
                    Avg
                  </text>
                </g>
              );
            })()}

            {/* Chart line + soft area */}
            {chartData.length > 1 && (() => {
              const chartStartX = 80;
              const chartWidth = 680;
              const linePoints = chartData
                .map((d, index) => {
                  const value = getMetricValue(d);
                  if (value == null || value <= 0) return null;
                  const normalizedValue = value - min;
                  const ratio = normalizedValue / range;
                  const x = chartStartX + (index / (chartData.length - 1 || 1)) * chartWidth;
                  const y = 180 - (ratio * 160);
                  return { x, y };
                })
                .filter(p => p !== null);

              if (linePoints.length < 2) return null;

              const points = linePoints.map(p => `${p.x},${p.y}`).join(' ');

              const firstX = linePoints.length > 0 ? linePoints[0].x : chartStartX;
              const areaPath = [
                `M ${firstX} 180`,
                ...linePoints.map(p => `L ${p.x} ${p.y}`),
                `L ${chartStartX + chartWidth} 180`,
                'Z'
              ].join(' ');

              return (
                <>
                  <path
                    d={areaPath}
                    fill={metricColor}
                    opacity={isDarkMode ? 0.14 : 0.18}
                    style={{
                      transition: 'opacity 0.3s ease-in-out'
                    }}
                  />
                  <polyline
                    points={points}
                    fill="none"
                    stroke={metricColor}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      opacity: isTransitioning ? 0.6 : 1,
                      filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.5))',
                      transition: 'opacity 0.3s ease-in-out'
                    }}
                  />
                </>
              );
            })()}

            {/* Data points (show fewer for cleaner look) */}
            {chartData.map((d, index) => {
              const value = getMetricValue(d);
              if (value == null || value <= 0) return null;
              
              const normalizedValue = value - min;
              const ratio = normalizedValue / range;
              const chartStartX = 80;
              const chartWidth = 680;
              const x = chartStartX + (index / (chartData.length - 1 || 1)) * chartWidth;
              const y = 180 - (ratio * 160);
              
              const isHovered = hoveredPoint?.index === index;
              const step = Math.max(1, Math.floor(chartData.length / 80)); // cap visible points
              const showPoint = isHovered || index % step === 0 || index === chartData.length - 1;
              if (!showPoint) return null;
              
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r={isHovered ? 6 : 3}
                  fill={metricColor}
                  stroke={isDarkMode ? '#020617' : '#ffffff'}
                  strokeWidth={isHovered ? 3 : 2}
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={() => handlePointMouseEnter(d, index, value, x, y)}
                  onMouseLeave={handlePointMouseLeave}
                  style={{
                    opacity: isTransitioning ? 0.6 : 1,
                    transition: 'opacity 0.3s ease-in-out, r 0.2s ease-in-out'
                  }}
                />
              );
            })}

            {/* Tooltip */}
            {hoveredPoint && (() => {
            const { data, value, x, y } = hoveredPoint;
            const tooltipWidth = 140;
            const tooltipHeight = 60;
            const padding = 10;
            
            let tooltipX = x - tooltipWidth / 2;
            if (tooltipX < padding) tooltipX = padding;
            if (tooltipX + tooltipWidth > 800 - padding) tooltipX = 800 - tooltipWidth - padding;
            
            let tooltipY = y - tooltipHeight - 15;
            if (tooltipY < padding) tooltipY = y + 25;
            
            const tooltipCenterX = tooltipX + tooltipWidth / 2;
            const textY1 = tooltipY + 18;
            const textY2 = tooltipY + 35;
            
            if (tooltipY + tooltipHeight > 200 - padding) {
              tooltipY = 200 - tooltipHeight - padding;
            }
            
            return (
              <g
                style={{
                  opacity: isTransitioning ? 0 : 1,
                  transition: 'opacity 0.2s ease-in-out'
                }}
              >
                <line
                  x1={hoveredPoint.x}
                  y1="20"
                  x2={hoveredPoint.x}
                  y2="180"
                  stroke={metricColor}
                  strokeWidth="1"
                  strokeDasharray="4,4"
                  opacity="0.5"
                />
                <rect
                  x={tooltipX}
                  y={tooltipY}
                  width={tooltipWidth}
                  height={tooltipHeight}
                  rx="6"
                  fill={isDarkMode ? "rgba(30, 41, 59, 0.98)" : "rgba(255, 255, 255, 0.98)"}
                  stroke={metricColor}
                  strokeWidth="2"
                  filter="drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))"
                />
                <text
                  x={tooltipCenterX}
                  y={textY1}
                  textAnchor="middle"
                  className={`text-xs font-semibold ${themeClasses.textPrimary}`}
                  fill="currentColor"
                >
                  {formatDateFull(data.dateFull)}
                </text>
                <text
                  x={tooltipCenterX}
                  y={textY2}
                  textAnchor="middle"
                  className="text-base font-bold"
                  fill={metricColor}
                >
                  {Math.round(value)} {getMetricUnit()}
                </text>
              </g>
            );
          })()}

          {/* X-axis labels */}
          {chartData.length > 0 && chartData.map((d, index) => {
            if (index % Math.ceil(chartData.length / 6) !== 0 && index !== chartData.length - 1) return null;
            const chartStartX = 80;
            const chartWidth = 680;
            const x = chartStartX + (index / (chartData.length - 1 || 1)) * chartWidth;
            return (
              <text
                key={index}
                x={x}
                y="195"
                className={`text-xs ${themeClasses.textSecondary}`}
                fill="currentColor"
                textAnchor="middle"
              >
                {d.date}
              </text>
            );
          })}
        </svg>
        </div>
      </div>
    </div>
  );
};

const ProfileTab = ({ profileData, onInputChange, onSave, isSaving, saveStatus, errorMessage, themeClasses, t, companyOptions, isLoadingCompanies, companyError, language, onboardingCompleted = false }) => {
  // Helper function to check if a field should be shown (if onboarding not completed, only show non-null fields)
  const shouldShowField = (fieldValue) => {
    if (onboardingCompleted === true) return true; // Show all fields if onboarding is completed
    return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''; // Only show non-null fields if skipped
  };

  // Personal Information fields are always read-only - cannot be edited
  const isReadOnly = true;

  return (
    <div className={`min-h-screen p-4 sm:p-6 md:p-8 animate-fadeIn`}>
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
                readOnly
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.textPrimary} cursor-not-allowed opacity-80`}
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
                readOnly
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.textPrimary} cursor-not-allowed opacity-80`}
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
                readOnly
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.textPrimary} cursor-not-allowed opacity-80`}
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
                readOnly
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.textPrimary} cursor-not-allowed opacity-80`}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            )}
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
                {language === 'hebrew' ? 'מידע מיקום' : 'Location Information'}
              </h3>
              <p className={`${themeClasses.textSecondary} text-xs sm:text-sm`}>
                {language === 'hebrew' ? 'עזרו לנו לספק המלצות מותאמות למיקום' : 'Help us provide location-specific recommendations'}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {language === 'hebrew' ? 'אזור' : 'Region'}
              </label>
              <select
                value={profileData.region}
                onChange={(e) => onInputChange('region', e.target.value)}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800`}
              >
                <option value="">{language === 'hebrew' ? 'בחר אזור' : 'Select Region'}</option>
                <option value="Israel">{language === 'hebrew' ? 'ישראל' : 'Israel'}</option>
                <option value="North America">{language === 'hebrew' ? 'צפון אמריקה' : 'North America'}</option>
                <option value="South America">{language === 'hebrew' ? 'דרום אמריקה' : 'South America'}</option>
                <option value="Europe">{language === 'hebrew' ? 'אירופה' : 'Europe'}</option>
                <option value="Asia">{language === 'hebrew' ? 'אסיה' : 'Asia'}</option>
                <option value="Africa">{language === 'hebrew' ? 'אפריקה' : 'Africa'}</option>
                <option value="Oceania">{language === 'hebrew' ? 'אוקיאניה' : 'Oceania'}</option>
                <option value="Middle East">{language === 'hebrew' ? 'המזרח התיכון' : 'Middle East'}</option>
                <option value="Caribbean">{language === 'hebrew' ? 'הקריביים' : 'Caribbean'}</option>
                <option value="Central America">{language === 'hebrew' ? 'מרכז אמריקה' : 'Central America'}</option>
                <option value="Other">{language === 'hebrew' ? 'אחר' : 'Other'}</option>
              </select>
            </div>

            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {language === 'hebrew' ? 'עיר' : 'City'}
              </label>
              <input
                type="text"
                value={profileData.city}
                onChange={(e) => onInputChange('city', e.target.value)}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800`}
                placeholder={language === 'hebrew' ? 'תל אביב' : 'Tel Aviv'}
              />
            </div>

            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {language === 'hebrew' ? 'אזור זמן' : 'Timezone'}
              </label>
              <select
                value={profileData.timezone}
                onChange={(e) => onInputChange('timezone', e.target.value)}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800`}
              >
                <option value="">{language === 'hebrew' ? 'בחר אזור זמן' : 'Select Timezone'}</option>
                <optgroup label={language === 'hebrew' ? 'ישראל והמזרח התיכון' : 'Israel & Middle East'}>
                  <option value="Asia/Jerusalem">{language === 'hebrew' ? 'ירושלים (ישראל)' : 'Asia/Jerusalem (Israel)'}</option>
                  <option value="Asia/Dubai">{language === 'hebrew' ? 'דובאי (איחוד האמירויות)' : 'Asia/Dubai (UAE)'}</option>
                  <option value="Asia/Riyadh">{language === 'hebrew' ? 'ריאד (ערב הסעודית)' : 'Asia/Riyadh (Saudi Arabia)'}</option>
                  <option value="Asia/Tehran">{language === 'hebrew' ? 'טהרן (איראן)' : 'Asia/Tehran (Iran)'}</option>
                </optgroup>
                <optgroup label={language === 'hebrew' ? 'אירופה' : 'Europe'}>
                  <option value="Europe/London">{language === 'hebrew' ? 'לונדון (GMT)' : 'Europe/London (GMT)'}</option>
                  <option value="Europe/Paris">{language === 'hebrew' ? 'פריז (CET)' : 'Europe/Paris (CET)'}</option>
                  <option value="Europe/Berlin">{language === 'hebrew' ? 'ברלין (CET)' : 'Europe/Berlin (CET)'}</option>
                  <option value="Europe/Rome">{language === 'hebrew' ? 'רומא (CET)' : 'Europe/Rome (CET)'}</option>
                  <option value="Europe/Madrid">{language === 'hebrew' ? 'מדריד (CET)' : 'Europe/Madrid (CET)'}</option>
                  <option value="Europe/Amsterdam">{language === 'hebrew' ? 'אמסטרדם (CET)' : 'Europe/Amsterdam (CET)'}</option>
                  <option value="Europe/Moscow">{language === 'hebrew' ? 'מוסקבה (MSK)' : 'Europe/Moscow (MSK)'}</option>
                </optgroup>
                <optgroup label={language === 'hebrew' ? 'צפון אמריקה' : 'North America'}>
                  <option value="America/New_York">{language === 'hebrew' ? 'ניו יורק (EST)' : 'America/New_York (EST)'}</option>
                  <option value="America/Chicago">{language === 'hebrew' ? 'שיקגו (CST)' : 'America/Chicago (CST)'}</option>
                  <option value="America/Denver">{language === 'hebrew' ? 'דנבר (MST)' : 'America/Denver (MST)'}</option>
                  <option value="America/Los_Angeles">{language === 'hebrew' ? 'לוס אנג\'לס (PST)' : 'America/Los_Angeles (PST)'}</option>
                  <option value="America/Toronto">{language === 'hebrew' ? 'טורונטו (EST)' : 'America/Toronto (EST)'}</option>
                  <option value="America/Vancouver">{language === 'hebrew' ? 'ונקובר (PST)' : 'America/Vancouver (PST)'}</option>
                </optgroup>
                <optgroup label={language === 'hebrew' ? 'אסיה' : 'Asia'}>
                  <option value="Asia/Tokyo">{language === 'hebrew' ? 'טוקיו (JST)' : 'Asia/Tokyo (JST)'}</option>
                  <option value="Asia/Shanghai">{language === 'hebrew' ? 'שנחאי (CST)' : 'Asia/Shanghai (CST)'}</option>
                  <option value="Asia/Hong_Kong">{language === 'hebrew' ? 'הונג קונג (HKT)' : 'Asia/Hong_Kong (HKT)'}</option>
                  <option value="Asia/Singapore">{language === 'hebrew' ? 'סינגפור (SGT)' : 'Asia/Singapore (SGT)'}</option>
                  <option value="Asia/Kolkata">{language === 'hebrew' ? 'קולקטה (IST)' : 'Asia/Kolkata (IST)'}</option>
                  <option value="Asia/Seoul">{language === 'hebrew' ? 'סיאול (KST)' : 'Asia/Seoul (KST)'}</option>
                  <option value="Asia/Bangkok">{language === 'hebrew' ? 'בנגקוק (ICT)' : 'Asia/Bangkok (ICT)'}</option>
                </optgroup>
                <optgroup label={language === 'hebrew' ? 'אוקיאניה' : 'Oceania'}>
                  <option value="Australia/Sydney">{language === 'hebrew' ? 'סידני (AEST)' : 'Australia/Sydney (AEST)'}</option>
                  <option value="Australia/Melbourne">{language === 'hebrew' ? 'מלבורן (AEST)' : 'Australia/Melbourne (AEST)'}</option>
                  <option value="Australia/Perth">{language === 'hebrew' ? 'פרת (AWST)' : 'Australia/Perth (AWST)'}</option>
                  <option value="Pacific/Auckland">{language === 'hebrew' ? 'אוקלנד (NZST)' : 'Pacific/Auckland (NZST)'}</option>
                </optgroup>
                <optgroup label={language === 'hebrew' ? 'דרום אמריקה' : 'South America'}>
                  <option value="America/Sao_Paulo">{language === 'hebrew' ? 'סאו פאולו (BRT)' : 'America/Sao_Paulo (BRT)'}</option>
                  <option value="America/Buenos_Aires">{language === 'hebrew' ? 'בואנוס איירס (ART)' : 'America/Buenos_Aires (ART)'}</option>
                  <option value="America/Lima">{language === 'hebrew' ? 'לימה (PET)' : 'America/Lima (PET)'}</option>
                </optgroup>
                <optgroup label={language === 'hebrew' ? 'אפריקה' : 'Africa'}>
                  <option value="Africa/Cairo">{language === 'hebrew' ? 'קהיר (EET)' : 'Africa/Cairo (EET)'}</option>
                  <option value="Africa/Johannesburg">{language === 'hebrew' ? 'יוהנסבורג (SAST)' : 'Africa/Johannesburg (SAST)'}</option>
                  <option value="Africa/Lagos">{language === 'hebrew' ? 'לאגוס (WAT)' : 'Africa/Lagos (WAT)'}</option>
                </optgroup>
              </select>
            </div>
          </div>

          <div className="mt-6">
            <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
              {language === 'hebrew' ? 'חברה' : 'Company'}
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
              disabled={true}
              readOnly={true}
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
                {language === 'hebrew' ? 'מידע בריאותי' : 'Health Information'}
              </h3>
              <p className={`${themeClasses.textSecondary} text-xs sm:text-sm`}>
                {language === 'hebrew' ? 'אופציונלי - ספקו פרטי בריאות אם רלוונטי' : 'Optional - provide your health details if relevant'}
              </p>
            </div>
          </div>
          
          <div className="space-y-4 sm:space-y-6">
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-3`}>
                {language === 'hebrew' ? 'העדפות תזונתיות' : 'Dietary Preferences'}
              </label>
              <textarea
                value={profileData.dietaryPreferences}
                onChange={(e) => onInputChange('dietaryPreferences', e.target.value)}
                rows={3}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800`}
                placeholder={language === 'hebrew' ? 'לדוגמה: צמחוני, טבעוני, ללא גלוטן, דיאטה ים תיכונית...' : 'e.g., Vegetarian, Vegan, Gluten-free, Mediterranean diet...'}
              />
            </div>

            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-3`}>
                {language === 'hebrew' ? 'אלרגיות למזון' : 'Food Allergies'}
              </label>
              <textarea
                value={profileData.foodAllergies}
                onChange={(e) => onInputChange('foodAllergies', e.target.value)}
                rows={3}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800`}
                placeholder={language === 'hebrew' ? 'לדוגמה: אגוזים, פירות ים, חלב, סויה...' : 'e.g., Nuts, Shellfish, Dairy, Soy...'}
              />
            </div>

            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-3`}>
                {language === 'hebrew' ? 'מצבים רפואיים' : 'Medical Conditions'}
              </label>
              <textarea
                value={profileData.medicalConditions}
                onChange={(e) => onInputChange('medicalConditions', e.target.value)}
                rows={3}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800`}
                placeholder={language === 'hebrew' ? 'לדוגמה: סוכרת, יתר לחץ דם, בעיות לב...' : 'e.g., Diabetes, Hypertension, Heart condition...'}
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
  const { isDarkMode } = useTheme();
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

  if (error || !planData) {
    return (
      <div className={`min-h-screen p-4 sm:p-6 md:p-8 animate-fadeIn flex items-center justify-center`}>
        <div className="max-w-2xl w-full">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/25 animate-pulse">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
        </div>
          </div>

          {/* Title */}
          <h2 className={`${themeClasses.textPrimary} text-3xl sm:text-4xl font-bold text-center mb-4`}>
            {language === 'hebrew' ? 'אין תוכנית תזונה זמינה' : 'No Meal Plan Available'}
          </h2>

          {/* Description */}
          <div className={`${themeClasses.textSecondary} text-center space-y-4 mb-8`}>
            <p className="text-lg sm:text-xl">
              {language === 'hebrew' 
                ? 'עדיין אין לכם תוכנית תזונה מותאמת אישית.'
                : 'You don\'t have a personalized meal plan yet.'
              }
            </p>
            <p className="text-base sm:text-lg">
              {language === 'hebrew'
                ? 'אנא פנו לספק שלכם (דיאטנית/מנהל) כדי לקבל תוכנית תזונה מותאמת אישית שתוצג כאן.'
                : 'Please contact your provider (dietitian/manager) to receive a personalized meal plan that will be displayed here.'
              }
        </p>
      </div>

          {/* Contact Info Card */}
          <div className={`${themeClasses.bgSecondary} rounded-xl p-6 border-l-4 border-emerald-500`}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
        </div>
              <div className="flex-1">
                <h3 className={`${themeClasses.textPrimary} font-semibold text-lg mb-2`}>
                  {language === 'hebrew' ? 'צרו קשר עם הספק שלכם' : 'Contact Your Provider'}
                </h3>
                <p className={`${themeClasses.textSecondary} text-sm`}>
                  {language === 'hebrew'
                    ? 'הספק שלכם יכול ליצור עבורכם תוכנית תזונה מותאמת אישית. לאחר יצירת התוכנית, היא תופיע כאן אוטומטית.'
                    : 'Your provider can create a personalized meal plan for you. Once created, it will appear here automatically.'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="mt-8 flex justify-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-emerald-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
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
    <div className={`min-h-screen p-4 sm:p-6 md:p-8 animate-fadeIn`}>
      {/* Daily Summary Section */}
      <div className="mb-6 sm:mb-8 md:mb-10 lg:mb-12 animate-slideInUp relative rounded-xl p-4 sm:p-6" style={{
        borderLeft: '3px solid',
        borderLeftColor: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
        borderRight: '2px solid',
        borderRightColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
        borderTop: '2px solid',
        borderTopColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
        borderBottom: '2px solid',
        borderBottomColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
        boxShadow: isDarkMode 
          ? 'inset 1px 0 0 rgba(16, 185, 129, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)' 
          : 'inset 1px 0 0 rgba(16, 185, 129, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}>
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none rounded-xl" />
        <div className="relative z-10">
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
          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-xl shadow-purple-500/20 transform hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/30 animate-bounceIn text-center sm:text-left" style={{ animationDelay: '0.1s' }}>
              <div className="text-white text-3xl sm:text-3xl md:text-4xl font-bold tracking-tight">{formatWeight(planData.totals.protein)}</div>
            <div className="text-purple-100 text-base sm:text-lg font-semibold mt-1">
              {language === 'hebrew' ? 'חלבון' : 'Protein'}
            </div>
            <div className="text-purple-200 text-xs sm:text-sm mt-1 sm:mt-2">
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
        </div>
        </div>

        {/* Macro Distribution Bar */}
        {settings.showMacros && (
        <div className="mb-6 sm:mb-8 md:mb-10 lg:mb-12 animate-slideInUp relative rounded-xl p-4 sm:p-6" style={{ animationDelay: '0.4s', 
          borderLeft: '3px solid',
          borderLeftColor: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
          borderRight: '2px solid',
          borderRightColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
          borderTop: '2px solid',
          borderTopColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
          borderBottom: '2px solid',
          borderBottomColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
          boxShadow: isDarkMode 
            ? 'inset 1px 0 0 rgba(16, 185, 129, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)' 
            : 'inset 1px 0 0 rgba(16, 185, 129, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}>
          {/* Decorative gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none rounded-xl" />
          <div className="relative z-10">
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
                className="bg-gradient-to-r from-purple-600 to-purple-500 flex items-center justify-center text-white text-xs sm:text-sm font-semibold transition-all duration-1000 ease-out animate-progressBar"
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
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-purple-500 rounded-full mr-2 animate-pulse"></div>
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
      </div>
        )}

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
                        {meal.main?.meal_name || meal.main?.meal_title || meal.main?.title || meal.meal}
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
                      <div className="w-3 h-3 sm:w-4 sm:h-4 bg-purple-500 rounded-full sm:mr-4 animate-pulse"></div>
                      <span className={`${themeClasses.textPrimary} text-sm sm:text-base font-semibold sm:mr-4 w-12 sm:w-16`}>
                        {language === 'hebrew' ? 'חלבון' : 'Protein'}
                      </span>
                      <div className="flex-1 bg-slate-700 rounded-full h-2 sm:h-3 shadow-inner">
                        <div 
                          className="bg-gradient-to-r from-purple-600 to-purple-500 h-2 sm:h-3 rounded-full transition-all duration-1000 ease-out shadow-sm"
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

// Macro Summary Circles Component with Tooltips
const MacroSummaryCircles = ({ 
  totalCalories, totalProtein, totalCarbs, totalFat, 
  dailyGoals, caloriesPercent, proteinPercent, carbsPercent, fatPercent,
  settings, isDarkMode, themeClasses, language, formatWeight 
}) => {
  const [hoveredElement, setHoveredElement] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);

  const handleMouseMove = (e) => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredElement(null);
  };

  const getTooltipContent = () => {
    if (!hoveredElement) return null;

    switch (hoveredElement) {
      case 'calories':
        return {
          label: language === 'hebrew' ? 'קלוריות' : 'Calories',
          current: totalCalories.toLocaleString(),
          target: dailyGoals.calories.toLocaleString(),
          percent: caloriesPercent,
          color: '#10b981'
        };
      case 'protein':
        return {
          label: language === 'hebrew' ? 'חלבון' : 'Protein',
          current: formatWeight(totalProtein),
          target: formatWeight(dailyGoals.protein),
          percent: proteinPercent,
          color: '#a855f7'
        };
      case 'carbs':
        return {
          label: language === 'hebrew' ? 'פחמימות' : 'Carbs',
          current: formatWeight(totalCarbs),
          target: formatWeight(dailyGoals.carbs),
          percent: carbsPercent,
          color: '#3b82f6'
        };
      case 'fat':
        return {
          label: language === 'hebrew' ? 'שומן' : 'Fat',
          current: formatWeight(totalFat),
          target: formatWeight(dailyGoals.fat),
          percent: fatPercent,
          color: '#f59e0b'
        };
      default:
        return null;
    }
  };

  const tooltipContent = getTooltipContent();

  const outerRadius = 120;
  const innerRadius = 100;
  const outerCircumference = 2 * Math.PI * outerRadius;
  const circumference = 2 * Math.PI * innerRadius;
  const segmentLength = circumference / 3;

  // Calculate lengths
  const caloriesNormalLength = Math.min(caloriesPercent, 100) / 100 * outerCircumference;
  const caloriesOverflowLength = caloriesPercent > 100 ? ((caloriesPercent - 100) / 100) * outerCircumference : 0;
  const proteinNormalLength = Math.min(proteinPercent, 100) / 100 * segmentLength;
  const proteinOverflowLength = proteinPercent > 100 ? (proteinPercent - 100) / 100 * segmentLength : 0;
  const carbsNormalLength = Math.min(carbsPercent, 100) / 100 * segmentLength;
  const carbsOverflowLength = carbsPercent > 100 ? (carbsPercent - 100) / 100 * segmentLength : 0;
  const fatNormalLength = Math.min(fatPercent, 100) / 100 * segmentLength;
  const fatOverflowLength = fatPercent > 100 ? (fatPercent - 100) / 100 * segmentLength : 0;

  return (
    <div className="relative w-64 h-64 sm:w-80 sm:h-80 mb-8">
      <svg 
        ref={svgRef}
        className="transform -rotate-90 w-full h-full" 
        viewBox="0 0 280 280"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Outer Circle Background (Calories) */}
        <circle
          cx="140"
          cy="140"
          r={outerRadius}
          fill="none"
          stroke={isDarkMode ? 'rgba(100, 100, 100, 0.15)' : 'rgba(200, 200, 200, 0.2)'}
          strokeWidth="16"
        />
        
        {/* Inner Circle Background (Macros) */}
        <circle
          cx="140"
          cy="140"
          r={innerRadius}
          fill="none"
          stroke={isDarkMode ? 'rgba(100, 100, 100, 0.15)' : 'rgba(200, 200, 200, 0.2)'}
          strokeWidth="16"
        />
        
        {/* Outer Circle - Calories Progress */}
        {settings.showCalories && (
          <>
            {caloriesNormalLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={outerRadius}
                fill="none"
                stroke="#10b981"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${caloriesNormalLength} ${outerCircumference}`}
                strokeDashoffset={0}
                opacity={1}
                className="transition-all duration-1000 ease-out"
              />
            )}
            {caloriesOverflowLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={outerRadius}
                fill="none"
                stroke="#059669"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${caloriesOverflowLength} ${outerCircumference}`}
                strokeDashoffset={0}
                opacity={1}
                className="transition-all duration-1000 ease-out"
              />
            )}
            {/* Invisible hover area for calories */}
            <circle
              cx="140"
              cy="140"
              r={outerRadius}
              fill="none"
              stroke="transparent"
              strokeWidth="24"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredElement('calories')}
            />
          </>
        )}
        
        {/* Inner Circle - Macros */}
        {settings.showMacros && (
          <>
            {/* Step 1: Render all normal portions (0-100%) */}
            {proteinNormalLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="#a855f7"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${proteinNormalLength} ${circumference}`}
                strokeDashoffset="0"
                opacity={1}
                className="transition-all duration-1000 ease-out"
              />
            )}
            {carbsNormalLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${carbsNormalLength} ${circumference}`}
                strokeDashoffset={-segmentLength}
                opacity={1}
                className="transition-all duration-1000 ease-out"
              />
            )}
            {fatNormalLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${fatNormalLength} ${circumference}`}
                strokeDashoffset={-segmentLength * 2}
                opacity={1}
                className="transition-all duration-1000 ease-out"
              />
            )}
            
            {/* Step 2: Render all overflow borders */}
            {proteinOverflowLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="20"
                strokeLinecap="round"
                strokeDasharray={`${proteinOverflowLength} ${circumference}`}
                strokeDashoffset={0 - proteinNormalLength}
                opacity={1}
                className="transition-all duration-1000 ease-out"
              />
            )}
            {carbsOverflowLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="20"
                strokeLinecap="round"
                strokeDasharray={`${carbsOverflowLength} ${circumference}`}
                strokeDashoffset={-segmentLength - carbsNormalLength}
                opacity={1}
                className="transition-all duration-1000 ease-out"
              />
            )}
            {fatOverflowLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="#a855f7"
                strokeWidth="20"
                strokeLinecap="round"
                strokeDasharray={`${fatOverflowLength} ${circumference}`}
                strokeDashoffset={0}
                opacity={1}
                className="transition-all duration-1000 ease-out"
              />
            )}
            
            {/* Step 3: Render all overflow main arcs */}
            {proteinOverflowLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="#a855f7"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${proteinOverflowLength} ${circumference}`}
                strokeDashoffset={0 - proteinNormalLength}
                opacity={1}
                className="transition-all duration-1000 ease-out"
              />
            )}
            {carbsOverflowLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${carbsOverflowLength} ${circumference}`}
                strokeDashoffset={-segmentLength - carbsNormalLength}
                opacity={1}
                className="transition-all duration-1000 ease-out"
              />
            )}
            {fatOverflowLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${fatOverflowLength} ${circumference}`}
                strokeDashoffset={0}
                opacity={1}
                className="transition-all duration-1000 ease-out"
              />
            )}

            {/* Invisible hover areas for macros - normal portions */}
            {proteinNormalLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="transparent"
                strokeWidth="24"
                strokeDasharray={`${proteinNormalLength} ${circumference}`}
                strokeDashoffset="0"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredElement('protein')}
              />
            )}
            {carbsNormalLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="transparent"
                strokeWidth="24"
                strokeDasharray={`${carbsNormalLength} ${circumference}`}
                strokeDashoffset={-segmentLength}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredElement('carbs')}
              />
            )}
            {fatNormalLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="transparent"
                strokeWidth="24"
                strokeDasharray={`${fatNormalLength} ${circumference}`}
                strokeDashoffset={-segmentLength * 2}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredElement('fat')}
              />
            )}
            {/* Invisible hover areas for macros - overflow portions */}
            {proteinOverflowLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="transparent"
                strokeWidth="24"
                strokeDasharray={`${proteinOverflowLength} ${circumference}`}
                strokeDashoffset={0 - proteinNormalLength}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredElement('protein')}
              />
            )}
            {carbsOverflowLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="transparent"
                strokeWidth="24"
                strokeDasharray={`${carbsOverflowLength} ${circumference}`}
                strokeDashoffset={-segmentLength - carbsNormalLength}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredElement('carbs')}
              />
            )}
            {fatOverflowLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="transparent"
                strokeWidth="24"
                strokeDasharray={`${fatOverflowLength} ${circumference}`}
                strokeDashoffset={0}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredElement('fat')}
              />
            )}
          </>
        )}
      </svg>
      
      {/* Center Score */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className={`${themeClasses.textPrimary} text-7xl sm:text-8xl font-extralight mb-3 tracking-tight`}>
          {totalCalories.toLocaleString()}
        </div>
      </div>

      {/* Tooltip */}
      {tooltipContent && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: `${mousePosition.x + 15}px`,
            top: `${mousePosition.y - 50}px`,
            transform: 'translateY(-50%)'
          }}
        >
          <div
            className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow-xl border-2 p-3 min-w-[160px]`}
            style={{ borderColor: tooltipContent.color }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: tooltipContent.color }}
              />
              <span className={`${themeClasses.textPrimary} font-semibold text-sm`}>
                {tooltipContent.label}
              </span>
            </div>
            <div className={`${themeClasses.textPrimary} text-lg font-bold mb-1`}>
              {tooltipContent.current} / {tooltipContent.target}
            </div>
            <div className={`${themeClasses.textSecondary} text-xs`}>
              {tooltipContent.percent}% {language === 'hebrew' ? 'הושלם' : 'complete'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Daily Log Tab Component
const DailyLogTab = ({ themeClasses, t, userCode, language, clientRegion, direction }) => {
  const { settings } = useSettings();
  const { isDarkMode } = useTheme();
  const [activeSubTab, setActiveSubTab] = useState('dailyLog'); // 'dailyLog' or 'analytics'
  const [foodLogs, setFoodLogs] = useState([]);
  const [mealPlanTargets, setMealPlanTargets] = useState(null);
  const [mealPlanMeals, setMealPlanMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAddFood, setShowAddFood] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isAddIngredientModalVisible, setIsAddIngredientModalVisible] = useState(false);
  const [selectedMealForIngredient, setSelectedMealForIngredient] = useState(null);
  
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

        // Load meal plan targets and meals
        const { data: mealPlanData, error: mealPlanError } = await getClientMealPlan(userCode);
        
        if (mealPlanError) {
          console.error('Error loading meal plan:', mealPlanError);
          // Don't set error for meal plan, just use defaults
          // Keep existing meals if available, otherwise set to empty
          if (mealPlanMeals.length === 0) {
            setMealPlanMeals([]);
          }
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
          
          // Store meal plan meals for displaying meal titles
          if (mealPlan && mealPlan.meals && mealPlan.meals.length > 0) {
            // Store original meal categories before translation (for matching with food logs)
            // Food logs use English categories: "breakfast", "lunch", "dinner", "snacks"
            const originalMealCategories = mealPlan.meals.map(m => m.meal);
            console.log('📝 DailyLogTab: Original meal categories:', originalMealCategories);
            
            // Translate meal plan if language is Hebrew
            let mealsToStore = mealPlan.meals;
            if (language === 'hebrew') {
              try {
                setIsTranslating(true);
                console.log('🌐 DailyLogTab: Starting translation for meal plan with', mealPlan.meals.length, 'meals');
                const translatedMealPlan = await translateMenu(mealPlan, 'he');
                
                // Only use translated meals if they exist and have the same structure
                if (translatedMealPlan && translatedMealPlan.meals && translatedMealPlan.meals.length > 0) {
                  console.log('✅ DailyLogTab: Translation successful');
                  console.log('📋 DailyLogTab: Translated meal categories:', translatedMealPlan.meals.map(m => m.meal));
                  console.log('📋 DailyLogTab: Sample translated meal_name:', translatedMealPlan.meals[0]?.main?.meal_name || translatedMealPlan.meals[0]?.main?.meal_title);
                  
                  // Verify the structure is correct before using
                  if (translatedMealPlan.meals[0]?.meal && translatedMealPlan.meals[0]?.main) {
                    // IMPORTANT: Preserve original English meal categories for matching with food logs
                    // Only translate the display name (meal_name), not the category (meal)
                    mealsToStore = translatedMealPlan.meals.map((translatedMeal, index) => {
                      const originalCategory = originalMealCategories[index];
                      console.log(`🔄 DailyLogTab: Restoring category ${index}: "${translatedMeal.meal}" -> "${originalCategory}"`);
                      return {
                        ...translatedMeal,
                        meal: originalCategory || translatedMeal.meal // Restore original English category
                      };
                    });
                    console.log('✅ DailyLogTab: Final meal categories after restore:', mealsToStore.map(m => m.meal));
                  } else {
                    console.warn('⚠️ DailyLogTab: Translated meals have incorrect structure, using original');
                  }
                } else {
                  console.warn('⚠️ DailyLogTab: Translation returned no meals or empty array, using original');
                }
              } catch (translateError) {
                console.error('❌ DailyLogTab: Translation error (using original):', translateError);
                // Continue with original meal plan
              } finally {
                setIsTranslating(false);
              }
            }
            
            console.log('💾 DailyLogTab: Storing meals:', mealsToStore.length, 'meals');
            console.log('💾 DailyLogTab: Final categories to store:', mealsToStore.map(m => m.meal));
            setMealPlanMeals(mealsToStore);
          } else {
            // Fallback to default meals if no meal plan
            console.log('📝 DailyLogTab: No meals in meal plan, keeping existing or using defaults');
            // Only clear if we don't have any meals already
            if (mealPlanMeals.length === 0) {
              setMealPlanMeals([]);
            }
          }
        } else {
          // No meal plan found, keep existing meals if available
          console.log('📝 DailyLogTab: No meal plan data found');
          if (mealPlanMeals.length === 0) {
            setMealPlanMeals([]);
          }
        }
      } catch (err) {
        console.error('Unexpected error loading data:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userCode, selectedDate, language]);

  // Delete entire meal (food log entry)
  const handleDeleteMeal = async (logId) => {
    if (!window.confirm(
      language === 'hebrew'
        ? 'האם אתה בטוח שברצונך למחוק את כל הרשומה?'
        : 'Are you sure you want to delete this entire log entry?'
    )) {
      return;
    }

    try {
      setProcessing(true);
      const { error } = await deleteFoodLog(logId);
      
      if (error) {
        console.error('Error deleting food log:', error);
        alert(
          language === 'hebrew'
            ? 'שגיאה במחיקת הרשומה'
            : 'Error deleting log entry'
        );
      } else {
        // Reload food logs
        const { data: foodLogsData, error: foodLogsError } = await getFoodLogs(userCode, selectedDate);
        if (!foodLogsError) {
          setFoodLogs(foodLogsData || []);
        }
      }
    } catch (err) {
      console.error('Unexpected error deleting food log:', err);
      alert(
        language === 'hebrew'
          ? 'שגיאה במחיקת הרשומה'
          : 'Error deleting log entry'
      );
    } finally {
      setProcessing(false);
    }
  };

  // Delete ingredient from a meal
  const handleDeleteIngredient = async (logId, itemIndex) => {
    try {
      setProcessing(true);
      
      // Find the log entry
      const log = foodLogs.find(l => l.id === logId);
      if (!log) return;

      // Parse food_items
      let foodItems = [];
      if (log.food_items) {
        try {
          foodItems = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
        } catch (e) {
          console.error('Error parsing food_items:', e);
          return;
        }
      }

      // Remove the ingredient
      if (Array.isArray(foodItems) && itemIndex >= 0 && itemIndex < foodItems.length) {
        foodItems.splice(itemIndex, 1);
      }

      // If no items left, delete the entire log
      if (foodItems.length === 0) {
        await handleDeleteMeal(logId);
        return;
      }

      // Preserve the original format - if it was an array, keep it as an array
      // Supabase JSONB will handle the conversion automatically
      // Don't stringify it - pass the array directly
      const foodItemsToSave = foodItems;

      // Update the food log
      const { error } = await updateFoodLog(logId, {
        food_items: foodItemsToSave,
        meal_label: log.meal_label || 'snacks',
        image_url: log.image_url || null,
        log_date: log.log_date || selectedDate
      });

      if (error) {
        console.error('Error updating food log:', error);
        alert(
          language === 'hebrew'
            ? 'שגיאה במחיקת המרכיב'
            : 'Error deleting ingredient'
        );
      } else {
        // Reload food logs
        const { data: foodLogsData, error: foodLogsError } = await getFoodLogs(userCode, selectedDate);
        if (!foodLogsError) {
          setFoodLogs(foodLogsData || []);
        }
      }
    } catch (err) {
      console.error('Unexpected error deleting ingredient:', err);
      alert(
        language === 'hebrew'
          ? 'שגיאה במחיקת המרכיב'
          : 'Error deleting ingredient'
      );
    } finally {
      setProcessing(false);
    }
  };

  // Move meal to different category
  const handleMoveMeal = async (logId, newMealLabel) => {
    try {
      setProcessing(true);
      
      // Find the log entry
      const log = foodLogs.find(l => l.id === logId);
      if (!log) return;

      // Only update the meal_label - don't touch any other fields
      const { error } = await updateFoodLog(logId, {
        meal_label: newMealLabel
      });

      if (error) {
        console.error('Error moving meal:', error);
        alert(
          language === 'hebrew'
            ? 'שגיאה בהעברת הארוחה'
            : 'Error moving meal'
        );
      } else {
        // Reload food logs
        const { data: foodLogsData, error: foodLogsError } = await getFoodLogs(userCode, selectedDate);
        if (!foodLogsError) {
          setFoodLogs(foodLogsData || []);
        }
      }
    } catch (err) {
      console.error('Unexpected error moving meal:', err);
      alert(
        language === 'hebrew'
          ? 'שגיאה בהעברת הארוחה'
          : 'Error moving meal'
      );
    } finally {
      setProcessing(false);
    }
  };

  // Open add ingredient modal
  const handleOpenAddIngredient = (mealCategory) => {
    setSelectedMealForIngredient(mealCategory);
    setIsAddIngredientModalVisible(true);
  };

  // Add ingredient to food log
  const handleAddIngredient = async (ingredient) => {
    if (!selectedMealForIngredient || !userCode) return;

    try {
      setProcessing(true);

      // Convert ingredient format from AddIngredientModal to food_items format
      // Structure must match: { c, f, p, cals, name, quantity }
      const foodItem = {
        c: Number(ingredient.carbs || 0),
        f: Number(ingredient.fat || 0),
        p: Number(ingredient.protein || 0),
        cals: Number(ingredient.calories || 0),
        name: ingredient.item || ingredient.name || 'Unknown Item',
        quantity: ingredient.household_measure || `${ingredient['portionSI(gram)'] || 0}g`
      };

      console.log('Converted food item:', JSON.stringify(foodItem, null, 2));

      // Find the most recent food log entry for this meal category and date
      const existingLogs = groupedLogs[selectedMealForIngredient] || [];
      const mostRecentLog = existingLogs.length > 0 ? existingLogs[0] : null; // Most recent is first (ordered by created_at desc)

      if (mostRecentLog) {
        // Add ingredient to existing log
        let foodItems = [];
        if (mostRecentLog.food_items) {
          try {
            foodItems = typeof mostRecentLog.food_items === 'string' 
              ? JSON.parse(mostRecentLog.food_items) 
              : mostRecentLog.food_items;
          } catch (e) {
            console.error('Error parsing food_items:', e);
            foodItems = [];
          }
        }

        // Add new food item
        foodItems.push(foodItem);

        // Update the food log
        const { error } = await updateFoodLog(mostRecentLog.id, {
          food_items: foodItems
        });

        if (error) {
          console.error('Error updating food log:', error);
          alert(
            language === 'hebrew'
              ? 'שגיאה בהוספת המרכיב'
              : 'Error adding ingredient'
          );
        } else {
          // Reload food logs
          const { data: foodLogsData, error: foodLogsError } = await getFoodLogs(userCode, selectedDate);
          if (!foodLogsError) {
            setFoodLogs(foodLogsData || []);
          }
          alert(
            language === 'hebrew'
              ? 'המרכיב נוסף בהצלחה'
              : 'Ingredient added successfully'
          );
        }
      } else {
        // Create new food log entry
        const newFoodLog = {
          meal_label: selectedMealForIngredient,
          food_items: [foodItem],
          log_date: selectedDate
        };

        console.log('Creating new food log with data:', JSON.stringify(newFoodLog, null, 2));
        console.log('User code:', userCode);
        console.log('Selected date:', selectedDate);

        const { data: createdLog, error } = await createFoodLog(userCode, newFoodLog);

        if (error) {
          console.error('Error creating food log:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          alert(
            language === 'hebrew'
              ? `שגיאה ביצירת רשומה חדשה: ${error.message || 'Unknown error'}`
              : `Error creating new log entry: ${error.message || 'Unknown error'}`
          );
        } else {
          // Reload food logs
          const { data: foodLogsData, error: foodLogsError } = await getFoodLogs(userCode, selectedDate);
          if (!foodLogsError) {
            setFoodLogs(foodLogsData || []);
          }
          alert(
            language === 'hebrew'
              ? 'המרכיב נוסף בהצלחה'
              : 'Ingredient added successfully'
          );
        }
      }
    } catch (err) {
      console.error('Unexpected error adding ingredient:', err);
      alert(
        language === 'hebrew'
          ? 'שגיאה בהוספת המרכיב'
          : 'Error adding ingredient'
      );
    } finally {
      setProcessing(false);
    }
  };

  // Calculate totals from food logs using food_items JSON column
  const totalCalories = foodLogs.reduce((sum, log) => {
    let logCalories = 0;
    if (log.food_items) {
      try {
        const foodItems = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
        if (Array.isArray(foodItems)) {
          logCalories = foodItems.reduce((itemSum, item) => itemSum + (item.cals || 0), 0);
        }
      } catch (e) {
        console.error('Error parsing food_items:', e);
      }
    }
    // Fallback to old column if food_items is not available
    return sum + logCalories + (log.total_calories || 0);
  }, 0);
  
  const totalProtein = foodLogs.reduce((sum, log) => {
    let logProtein = 0;
    if (log.food_items) {
      try {
        const foodItems = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
        if (Array.isArray(foodItems)) {
          logProtein = foodItems.reduce((itemSum, item) => itemSum + (item.p || 0), 0);
        }
      } catch (e) {
        console.error('Error parsing food_items:', e);
      }
    }
    // Fallback to old column if food_items is not available
    return sum + logProtein + (log.total_protein_g || 0);
  }, 0);
  
  const totalCarbs = foodLogs.reduce((sum, log) => {
    let logCarbs = 0;
    if (log.food_items) {
      try {
        const foodItems = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
        if (Array.isArray(foodItems)) {
          logCarbs = foodItems.reduce((itemSum, item) => itemSum + (item.c || 0), 0);
        }
      } catch (e) {
        console.error('Error parsing food_items:', e);
      }
    }
    // Fallback to old column if food_items is not available
    return sum + logCarbs + (log.total_carbs_g || 0);
  }, 0);
  
  const totalFat = foodLogs.reduce((sum, log) => {
    let logFat = 0;
    if (log.food_items) {
      try {
        const foodItems = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
        if (Array.isArray(foodItems)) {
          logFat = foodItems.reduce((itemSum, item) => itemSum + (item.f || 0), 0);
        }
      } catch (e) {
        console.error('Error parsing food_items:', e);
      }
    }
    // Fallback to old column if food_items is not available
    return sum + logFat + (log.total_fat_g || 0);
  }, 0);

  // Get meals from meal plan, or fallback to default meals
  // Always add "other" as the last meal regardless of how many meals exist
  const meals = mealPlanMeals.length > 0 
    ? [...mealPlanMeals.map(meal => meal.meal), 'other'] // Extract meal categories from meal plan and add "other"
    : ['breakfast', 'lunch', 'dinner', 'snacks', 'other']; // Fallback to default with "other"
  
  // Create a map of meal category to meal title
  const mealTitleMap = mealPlanMeals.reduce((acc, meal) => {
    if (meal && meal.meal) {
      const mealName = meal.main?.meal_name || meal.main?.meal_title || meal.main?.title || meal.meal;
      acc[meal.meal] = mealName;
      console.log(`📋 DailyLogTab: Meal mapping - ${meal.meal} -> ${mealName}`);
    }
    return acc;
  }, {});

  // Group food logs by meal
  // If a meal_label doesn't match any meal category, add it to "other"
  const groupedLogs = meals.reduce((acc, meal) => {
    acc[meal] = [];
    return acc;
  }, {});

  // Group all food logs
  foodLogs.forEach(log => {
    const logMealLabel = (log.meal_label || '').toLowerCase();
    const matchedMeal = meals.find(meal => meal.toLowerCase() === logMealLabel);
    
    if (matchedMeal) {
      // Add to the matched meal category
      groupedLogs[matchedMeal].push(log);
    } else {
      // If no match found, add to "other"
      if (groupedLogs['other']) {
        groupedLogs['other'].push(log);
      }
    }
  });

  if (loading || isTranslating) {
  return (
      <div className={`min-h-screen p-8 animate-fadeIn`}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className={`${themeClasses.textSecondary}`}>
              {isTranslating 
                ? (language === 'hebrew' ? 'מתרגם תוכנית תזונה...' : 'Translating meal plan...') 
                : 'Loading food logs...'
              }
            </p>
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
  // JavaScript getDay() returns: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
  const dayNames = language === 'hebrew' 
    ? ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'יום שבת'] // Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = language === 'hebrew'
    ? ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className={`min-h-screen p-4 sm:p-6 md:p-8 animate-fadeIn`}>
      {/* Sub-tabs Navigation */}
      <div className={`mb-6 flex gap-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <button
          onClick={() => setActiveSubTab('dailyLog')}
          className={`px-6 py-3 font-semibold transition-all duration-300 border-b-2 ${
            activeSubTab === 'dailyLog'
              ? `${themeClasses.textPrimary} border-emerald-500`
              : `${themeClasses.textSecondary} border-transparent hover:border-emerald-500/50`
          }`}
        >
          {language === 'hebrew' ? 'יומן יומי' : 'Daily Log'}
        </button>
        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`px-6 py-3 font-semibold transition-all duration-300 border-b-2 ${
            activeSubTab === 'analytics'
              ? `${themeClasses.textPrimary} border-emerald-500`
              : `${themeClasses.textSecondary} border-transparent hover:border-emerald-500/50`
          }`}
        >
          {language === 'hebrew' ? 'אנליטיקה' : 'Analytics'}
        </button>
      </div>

      {/* Analytics Sub-tab Content */}
      {activeSubTab === 'analytics' && (
        <>
          <WeightProgressComponent 
            userCode={userCode} 
            themeClasses={themeClasses} 
            language={language}
            isDarkMode={isDarkMode}
          />
          
          <FoodLogProgressComponent 
            userCode={userCode} 
            themeClasses={themeClasses} 
            language={language}
            isDarkMode={isDarkMode}
          />
        </>
      )}

      {/* Daily Log Sub-tab Content */}
      {activeSubTab === 'dailyLog' && (
        <>
      {/* Date Selector Section */}
      <div className="mb-8 sm:mb-10 md:mb-12 animate-slideInUp relative rounded-xl p-4 sm:p-6" style={{
        borderLeft: '3px solid',
        borderLeftColor: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
        borderRight: '2px solid',
        borderRightColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
        borderTop: '2px solid',
        borderTopColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
        borderBottom: '2px solid',
        borderBottomColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
        boxShadow: isDarkMode 
          ? 'inset 1px 0 0 rgba(16, 185, 129, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)' 
          : 'inset 1px 0 0 rgba(16, 185, 129, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}>
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none rounded-xl" />
        <div className="relative z-10">
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
              <svg className={`w-5 h-5 ${themeClasses.textPrimary} ${direction === 'rtl' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button 
              onClick={() => navigateWeek('next')}
              className={`w-10 h-10 ${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} rounded-lg flex items-center justify-center transition-all duration-300`}
            >
              <svg className={`w-5 h-5 ${themeClasses.textPrimary} ${direction === 'rtl' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      </div>

      {/* Macro Summary Section - Apple Style PAI */}
      <div className="mb-8 sm:mb-10 md:mb-12 animate-slideInUp" style={{ animationDelay: '0.3s' }}>
        <div className={`${themeClasses.bgCard} rounded-3xl p-8 sm:p-12 shadow-2xl border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h3 className={`${themeClasses.textPrimary} text-xl sm:text-2xl font-semibold`}>
              {language === 'hebrew' ? 'סיכום מקרו' : 'Macro Summary'}
            </h3>
            <div className={`${themeClasses.textSecondary} text-sm sm:text-base`}>
              {overallPercent}% {language === 'hebrew' ? 'הושלם' : 'complete'}
            </div>
          </div>

          {/* Circular Score Display */}
          <div className="flex flex-col items-center justify-center py-8">
            {/* Two Concentric Circles - Apple Style */}
            <MacroSummaryCircles
              totalCalories={totalCalories}
              totalProtein={totalProtein}
              totalCarbs={totalCarbs}
              totalFat={totalFat}
              dailyGoals={dailyGoals}
              caloriesPercent={caloriesPercent}
              proteinPercent={proteinPercent}
              carbsPercent={carbsPercent}
              fatPercent={fatPercent}
              settings={settings}
              isDarkMode={isDarkMode}
              themeClasses={themeClasses}
              language={language}
              formatWeight={formatWeight}
            />

            {/* Macro Details - Minimal List */}
            <div className="w-full max-w-md space-y-3 mt-4">
              {settings.showCalories && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full mr-3"></div>
                    <span className={`${themeClasses.textSecondary} text-sm`}>
                      {language === 'hebrew' ? 'קלוריות' : 'Calories'}
                    </span>
                  </div>
                  <span className={`${themeClasses.textPrimary} text-sm font-medium`}>
                    {totalCalories.toLocaleString()} / {dailyGoals.calories.toLocaleString()}
                  </span>
                </div>
              )}
              
              {settings.showMacros && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                      <span className={`${themeClasses.textSecondary} text-sm`}>
                        {language === 'hebrew' ? 'חלבון' : 'Protein'}
                      </span>
                    </div>
                    <span className={`${themeClasses.textPrimary} text-sm font-medium`}>
                      {formatWeight(totalProtein)} / {formatWeight(dailyGoals.protein)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                      <span className={`${themeClasses.textSecondary} text-sm`}>
                        {language === 'hebrew' ? 'פחמימות' : 'Carbs'}
                      </span>
                    </div>
                    <span className={`${themeClasses.textPrimary} text-sm font-medium`}>
                      {formatWeight(totalCarbs)} / {formatWeight(dailyGoals.carbs)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-amber-500 rounded-full mr-3"></div>
                      <span className={`${themeClasses.textSecondary} text-sm`}>
                        {language === 'hebrew' ? 'שומן' : 'Fat'}
                      </span>
                    </div>
                    <span className={`${themeClasses.textPrimary} text-sm font-medium`}>
                      {formatWeight(totalFat)} / {formatWeight(dailyGoals.fat)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Meals Section */}
      <div className="mt-12 animate-slideInUp" style={{ animationDelay: '0.8s' }}>
        <div className="flex items-center mb-8">
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
              if (name === 'other' || name.includes('אחר')) return '🍽️';
              return '🍽️';
            };

            const getMealColor = (mealName) => {
              const name = mealName.toLowerCase();
              if (name.includes('breakfast') || name.includes('בוקר')) return 'from-yellow-500 to-orange-500';
              if (name.includes('lunch') || name.includes('צהריים')) return 'from-orange-500 to-red-500';
              if (name.includes('dinner') || name.includes('ערב')) return 'from-blue-500 to-purple-500';
              if (name.includes('snack') || name.includes('חטיף')) return 'from-purple-500 to-pink-500';
              if (name === 'other' || name.includes('אחר')) return 'from-emerald-500 to-teal-500';
              return 'from-emerald-500 to-teal-500';
            };

          return (
              <div 
                key={meal} 
                className={`${themeClasses.bgCard} border border-blue-500/30 rounded-2xl p-6 shadow-xl shadow-blue-500/10 transform hover:scale-[1.01] transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20 animate-slideInUp lg:relative`}
                style={{ 
                  animationDelay: `${0.9 + index * 0.1}s`,
                }}
              >
                {/* Mobile-only enhanced styling */}
                <div className="lg:hidden absolute inset-0 rounded-2xl pointer-events-none" style={{
                  borderLeft: '4px solid',
                  borderLeftColor: meal.includes('breakfast') || meal.includes('בוקר') ? 'rgba(251, 191, 36, 0.4)' :
                                  meal.includes('lunch') || meal.includes('צהריים') ? 'rgba(249, 115, 22, 0.4)' :
                                  meal.includes('dinner') || meal.includes('ערב') ? 'rgba(59, 130, 246, 0.4)' :
                                  meal.includes('snack') || meal.includes('חטיף') ? 'rgba(168, 85, 247, 0.4)' :
                                  'rgba(16, 185, 129, 0.4)',
                  borderRight: '2px solid',
                  borderRightColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                  borderTop: '2px solid',
                  borderTopColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                  borderBottom: '2px solid',
                  borderBottomColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                  boxShadow: isDarkMode 
                    ? 'inset 1px 0 0 rgba(16, 185, 129, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)' 
                    : 'inset 1px 0 0 rgba(16, 185, 129, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                }} />
                
                {/* Decorative gradient overlay - Mobile only */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none lg:hidden rounded-2xl" />
                
                <div className="relative z-10">
                <div className="flex items-center mb-4 sm:mb-6">
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 lg:w-12 lg:h-12 bg-gradient-to-br ${getMealColor(meal)} rounded-2xl lg:rounded-xl flex items-center justify-center mr-4 shadow-xl lg:shadow-lg`}>
                    <span className="text-3xl sm:text-4xl lg:text-2xl animate-bounce" style={{ animationDelay: `${index * 0.2}s` }}>{getMealIcon(meal)}</span>
                  </div>
                      <div className="flex-1">
                    <p className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium mb-1 uppercase tracking-wide`}>
                      {meal}
                    </p>
                    <h4 className={`${themeClasses.textPrimary} text-lg sm:text-xl md:text-2xl lg:text-base sm:text-lg md:text-xl font-bold tracking-tight`}>
                      {mealTitleMap[meal] || t.profile.dailyLogTab.meals[meal] || meal}
                    </h4>
                  </div>
                  {/* Add Ingredient Button */}
                  <button
                    onClick={() => handleOpenAddIngredient(meal)}
                    disabled={processing}
                    className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500 rounded-full flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    title={language === 'hebrew' ? 'הוסף מרכיב' : 'Add ingredient'}
                  >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                {mealLogs.length > 0 ? (
                  <div className="space-y-2">
                    {mealLogs.map((log, logIndex) => {
                      // Parse food_items JSON
                      let foodItems = [];
                      let logCalories = 0;
                      let logProtein = 0;
                      let logCarbs = 0;
                      let logFat = 0;
                      
                      if (log.food_items) {
                        try {
                          foodItems = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
                          if (Array.isArray(foodItems)) {
                            logCalories = foodItems.reduce((sum, item) => sum + (item.cals || 0), 0);
                            logProtein = foodItems.reduce((sum, item) => sum + (item.p || 0), 0);
                            logCarbs = foodItems.reduce((sum, item) => sum + (item.c || 0), 0);
                            logFat = foodItems.reduce((sum, item) => sum + (item.f || 0), 0);
                          }
                        } catch (e) {
                          console.error('Error parsing food_items:', e);
                          // Fallback to old columns
                          logCalories = log.total_calories || 0;
                          logProtein = log.total_protein_g || 0;
                          logCarbs = log.total_carbs_g || 0;
                          logFat = log.total_fat_g || 0;
                        }
                      } else {
                        // Fallback to old columns if food_items doesn't exist
                        logCalories = log.total_calories || 0;
                        logProtein = log.total_protein_g || 0;
                        logCarbs = log.total_carbs_g || 0;
                        logFat = log.total_fat_g || 0;
                      }
                      
                      return (
                      <div 
                        key={log.id} 
                          className={`${themeClasses.bgSecondary} border-2 border-emerald-500/20 lg:border lg:border-gray-600/20 rounded-2xl lg:rounded-xl p-4 sm:p-5 lg:p-3 transform hover:scale-[1.01] transition-all duration-300 lg:duration-200 shadow-lg hover:shadow-xl lg:shadow-md lg:hover:shadow-lg hover:border-emerald-500/40 animate-slideInUp mb-3 relative overflow-hidden`}
                        style={{ 
                          animationDelay: `${1.0 + index * 0.1 + logIndex * 0.05}s`,
                        }}
                      >
                        {/* Mobile-only gradient background */}
                        <div className="lg:hidden absolute inset-0 rounded-2xl pointer-events-none" style={{
                          background: isDarkMode 
                            ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)'
                            : 'linear-gradient(135deg, rgba(241, 245, 249, 0.9) 0%, rgba(226, 232, 240, 0.9) 100%)'
                        }} />
                        
                        {/* Subtle gradient overlay - Mobile only */}
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none rounded-2xl lg:hidden" />
                        
                        <div className="relative z-10">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <p className={`${themeClasses.textMuted} text-xs`}>
                                {language === 'hebrew' ? 'נרשם ב' : 'Logged at'} {new Date(log.created_at).toLocaleTimeString()}
                              </p>
                              {log.image_url && (
                                <div className="w-6 h-6 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded flex items-center justify-center border border-emerald-500/30">
                                  <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"/>
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Move meal dropdown */}
                              <select
                                value={log.meal_label}
                                onChange={(e) => handleMoveMeal(log.id, e.target.value)}
                                disabled={processing}
                                className={`text-xs px-2 py-1 rounded ${themeClasses.bgSecondary} ${themeClasses.textPrimary} border border-gray-600/30 hover:border-emerald-500/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                {meals.map((mealCategory) => (
                                  <option key={mealCategory} value={mealCategory}>
                                    {mealTitleMap[mealCategory] || t.profile.dailyLogTab.meals[mealCategory] || mealCategory}
                                  </option>
                                ))}
                              </select>
                              {/* Delete meal button */}
                              <button
                                onClick={() => handleDeleteMeal(log.id)}
                                disabled={processing}
                                className="w-6 h-6 flex items-center justify-center rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 hover:border-red-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={language === 'hebrew' ? 'מחק רשומה' : 'Delete entry'}
                              >
                                <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex-1">
                            {foodItems.length > 0 ? (
                              <div className="space-y-1.5">
                                {foodItems.map((item, itemIndex) => (
                                  <div 
                                    key={itemIndex} 
                                    className={`${themeClasses.bgCard} rounded-lg p-2.5 border border-gray-600/20 hover:border-emerald-500/30 transition-all duration-200`}
                                  >
                                    <div className="flex items-start justify-between mb-1">
                                      <div className="flex-1 min-w-0">
                                        <p className={`${themeClasses.textPrimary} font-medium text-sm truncate`}>
                                          {item.name || 'Unknown Item'}
                                        </p>
                                        {item.quantity && (
                                          <p className={`${themeClasses.textMuted} text-xs mt-0.5`}>
                                            {item.quantity}
                                          </p>
                                        )}
                                      </div>
                                      {/* Delete ingredient button */}
                                      <button
                                        onClick={() => handleDeleteIngredient(log.id, itemIndex)}
                                        disabled={processing}
                                        className="ml-2 w-5 h-5 flex items-center justify-center rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 hover:border-red-500/50 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title={language === 'hebrew' ? 'מחק מרכיב' : 'Delete ingredient'}
                                      >
                                        <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-3 flex-wrap text-xs">
                                      {settings.showCalories && (
                                        <span className="text-emerald-400 font-medium">{item.cals || 0} {language === 'hebrew' ? 'קל' : 'cal'}</span>
                                      )}
                                      {settings.showMacros && (
                                        <>
                                          <span className="text-purple-400 font-medium">{formatWeight(item.p || 0)} {language === 'hebrew' ? 'חלבון' : 'protein'}</span>
                                          <span className="text-amber-400 font-medium">{formatWeight(item.f || 0)} {language === 'hebrew' ? 'שומן' : 'fat'}</span>
                                          <span className="text-blue-400 font-medium">{formatWeight(item.c || 0)} {language === 'hebrew' ? 'פחמימות' : 'carbs'}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {/* Total for this log entry */}
                                <div className={`${themeClasses.bgSecondary} rounded-lg lg:rounded-lg p-2.5 lg:p-2.5 border border-emerald-500/30 lg:border-emerald-500/30 mt-2 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 lg:from-transparent lg:to-transparent relative overflow-hidden rounded-xl lg:rounded-lg p-4 lg:p-2.5 mt-3 lg:mt-2 border-2 lg:border border-emerald-500/40 lg:border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 lg:from-emerald-500/10 lg:to-teal-500/10 shadow-lg lg:shadow-none`}>
                                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10 pointer-events-none rounded-xl lg:hidden" />
                                  <div className="relative z-10">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 lg:flex lg:items-center lg:justify-between">
                                      <p className={`${themeClasses.textPrimary} font-bold text-sm uppercase tracking-wider flex items-center gap-2 lg:text-xs lg:font-bold lg:uppercase lg:tracking-wide lg:flex lg:items-center lg:gap-0`}>
                                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse lg:hidden"></span>
                                        {language === 'hebrew' ? 'סה"כ' : 'Total'}
                                      </p>
                                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm lg:flex lg:items-center lg:gap-3 lg:text-xs">
                                        {settings.showCalories && (
                                          <div className="flex flex-col items-center sm:items-end lg:flex-row lg:items-center">
                                            <span className="text-emerald-400 font-bold text-lg lg:text-base">{logCalories}</span>
                                            <span className="text-emerald-500/70 text-xs font-medium lg:text-emerald-400 lg:ml-1 lg:font-bold">{language === 'hebrew' ? ' קל' : ' cal'}</span>
                                          </div>
                                        )}
                                        {settings.showMacros && (
                                          <>
                                            <div className="flex flex-col items-center sm:items-end lg:flex-row lg:items-center">
                                              <span className="text-purple-400 font-bold text-base">{formatWeight(logProtein)}</span>
                                              <span className="text-purple-500/70 text-xs font-medium lg:text-purple-400 lg:ml-1 lg:font-bold">{language === 'hebrew' ? ' חלבון' : ' protein'}</span>
                                            </div>
                                            <div className="flex flex-col items-center sm:items-end lg:flex-row lg:items-center">
                                              <span className="text-amber-400 font-bold text-base">{formatWeight(logFat)}</span>
                                              <span className="text-amber-500/70 text-xs font-medium lg:text-amber-400 lg:ml-1 lg:font-bold">{language === 'hebrew' ? ' שומן' : ' fat'}</span>
                                            </div>
                                            <div className="flex flex-col items-center sm:items-end lg:flex-row lg:items-center">
                                              <span className="text-blue-400 font-bold text-base">{formatWeight(logCarbs)}</span>
                                              <span className="text-blue-500/70 text-xs font-medium lg:text-blue-400 lg:ml-1 lg:font-bold">{language === 'hebrew' ? ' פחמימות' : ' carbs'}</span>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <p className={`${themeClasses.textPrimary} font-medium text-sm`}>
                                    {language === 'hebrew' ? 'רשומת מזון' : 'Food Entry'}
                              </p>
                              {log.image_url && (
                                    <div className="w-6 h-6 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded flex items-center justify-center border border-emerald-500/30">
                                      <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"/>
                                  </svg>
                      </div>
                              )}
                            </div>
                                <div className="flex items-center gap-3 text-xs">
                              {settings.showCalories && (
                                    <span className="text-emerald-400 font-medium">{logCalories} {language === 'hebrew' ? 'קל' : 'cal'}</span>
                              )}
                              {settings.showMacros && (
                                <>
                                      <span className="text-purple-400 font-medium">{formatWeight(logProtein)} {language === 'hebrew' ? 'חלבון' : 'protein'}</span>
                                      <span className="text-amber-400 font-medium">{formatWeight(logFat)} {language === 'hebrew' ? 'שומן' : 'fat'}</span>
                                      <span className="text-blue-400 font-medium">{formatWeight(logCarbs)} {language === 'hebrew' ? 'פחמימות' : 'carbs'}</span>
                                </>
                              )}
                            </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      );
                    })}
                    
                    {/* Total summary for this meal category - only show if more than 1 meal */}
                    {mealLogs.length > 1 && (() => {
                      let mealTotalCalories = 0;
                      let mealTotalProtein = 0;
                      let mealTotalCarbs = 0;
                      let mealTotalFat = 0;
                      
                      mealLogs.forEach((log) => {
                        if (log.food_items) {
                          try {
                            const foodItems = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
                            if (Array.isArray(foodItems)) {
                              mealTotalCalories += foodItems.reduce((sum, item) => sum + (item.cals || 0), 0);
                              mealTotalProtein += foodItems.reduce((sum, item) => sum + (item.p || 0), 0);
                              mealTotalCarbs += foodItems.reduce((sum, item) => sum + (item.c || 0), 0);
                              mealTotalFat += foodItems.reduce((sum, item) => sum + (item.f || 0), 0);
                            }
                          } catch (e) {
                            // Fallback to old columns
                            mealTotalCalories += log.total_calories || 0;
                            mealTotalProtein += log.total_protein_g || 0;
                            mealTotalCarbs += log.total_carbs_g || 0;
                            mealTotalFat += log.total_fat_g || 0;
                          }
                        } else {
                          // Fallback to old columns
                          mealTotalCalories += log.total_calories || 0;
                          mealTotalProtein += log.total_protein_g || 0;
                          mealTotalCarbs += log.total_carbs_g || 0;
                          mealTotalFat += log.total_fat_g || 0;
                        }
                      });
                      
                      return (
                        <div className={`${themeClasses.bgSecondary} rounded-xl lg:rounded-xl p-4 lg:p-4 border-2 border-emerald-500/40 lg:border-2 lg:border-emerald-500/40 mt-4 bg-gradient-to-r from-emerald-500/15 to-teal-500/15 lg:from-emerald-500/15 lg:to-teal-500/15 shadow-lg lg:shadow-lg relative overflow-hidden rounded-2xl lg:rounded-xl p-5 lg:p-4 border-2 lg:border-2 border-emerald-500/50 lg:border-emerald-500/40 bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-emerald-500/20 lg:from-emerald-500/15 lg:to-teal-500/15 shadow-xl lg:shadow-lg`}>
                          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 via-transparent to-teal-500/15 pointer-events-none rounded-2xl lg:hidden" />
                          <div className="relative z-10">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 lg:flex lg:items-center lg:justify-between">
                              <div className="flex items-center gap-2 lg:gap-2">
                                <div className={`w-8 h-8 lg:w-8 lg:h-8 bg-gradient-to-br ${getMealColor(meal)} rounded-lg lg:rounded-lg flex items-center justify-center lg:shadow-lg w-12 h-12 rounded-xl shadow-lg`}>
                                  <span className="text-lg lg:text-lg text-2xl">{getMealIcon(meal)}</span>
                                </div>
                                <p className={`${themeClasses.textPrimary} font-bold text-sm uppercase tracking-wide lg:text-sm lg:font-bold lg:uppercase lg:tracking-wide text-base`}>
                                  {mealTitleMap[meal] || t.profile.dailyLogTab.meals[meal] || meal} {language === 'hebrew' ? 'סה"כ' : 'Total'}
                                </p>
                              </div>
                              <div className="flex items-center gap-4 text-sm lg:flex lg:items-center lg:gap-4 lg:text-sm flex-wrap items-center gap-4 sm:gap-6">
                                {settings.showCalories && (
                                  <span className="text-emerald-400 font-bold lg:text-emerald-400 lg:font-bold flex flex-col items-center sm:items-end text-xl">
                                    <span className="lg:inline">{Math.round(mealTotalCalories)}</span>
                                    <span className="text-emerald-500/70 text-xs font-medium lg:text-emerald-400 lg:ml-1 lg:font-bold lg:inline">{language === 'hebrew' ? ' קל' : ' cal'}</span>
                                  </span>
                                )}
                                {settings.showMacros && (
                                  <>
                                    <span className="text-purple-400 font-bold lg:text-purple-400 lg:font-bold flex flex-col items-center sm:items-end text-lg">
                                      <span className="lg:inline">{formatWeight(mealTotalProtein)}</span>
                                      <span className="text-purple-500/70 text-xs font-medium lg:text-purple-400 lg:ml-1 lg:font-bold lg:inline">{language === 'hebrew' ? ' חלבון' : ' protein'}</span>
                                    </span>
                                    <span className="text-amber-400 font-bold lg:text-amber-400 lg:font-bold flex flex-col items-center sm:items-end text-lg">
                                      <span className="lg:inline">{formatWeight(mealTotalFat)}</span>
                                      <span className="text-amber-500/70 text-xs font-medium lg:text-amber-400 lg:ml-1 lg:font-bold lg:inline">{language === 'hebrew' ? ' שומן' : ' fat'}</span>
                                    </span>
                                    <span className="text-blue-400 font-bold lg:text-blue-400 lg:font-bold flex flex-col items-center sm:items-end text-lg">
                                      <span className="lg:inline">{formatWeight(mealTotalCarbs)}</span>
                                      <span className="text-blue-500/70 text-xs font-medium lg:text-blue-400 lg:ml-1 lg:font-bold lg:inline">{language === 'hebrew' ? ' פחמימות' : ' carbs'}</span>
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
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
              </div>
          );
        })}
        </div>
      </div>
        </>
      )}

      {/* Add Ingredient Modal */}
      <AddIngredientModal
        visible={isAddIngredientModalVisible}
        onClose={() => {
          setIsAddIngredientModalVisible(false);
          setSelectedMealForIngredient(null);
        }}
        onAddIngredient={handleAddIngredient}
        mealName={selectedMealForIngredient ? (mealTitleMap[selectedMealForIngredient] || t.profile.dailyLogTab.meals[selectedMealForIngredient] || selectedMealForIngredient) : null}
        clientRegion={clientRegion}
      />
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
    <div className={`min-h-screen p-4 sm:p-6 md:p-8 animate-fadeIn`}>
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
  const [isUserAtBottom, setIsUserAtBottom] = useState(true); // Track if user is at bottom of chat

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
            role: msg.role,
            message: msg.message,
            content: msg.content,
            attachments: msg.attachments,
            sender: msg.role === 'user' ? 'user' : 'bot',
            timestamp: new Date(msg.created_at),
            created_at: msg.created_at
          }));
          
          // Filter valid messages
          const validMessages = filterValidMessages(transformedMessages);
          
          // Sort messages by timestamp (oldest first for chat display)
          const sortedMessages = validMessages.sort((a, b) => a.timestamp - b.timestamp);
          
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
  // Only refresh if user is at bottom of chat
  useEffect(() => {
    if (activeTab !== 'messages' || !userCode || !isUserAtBottom) return;

    const refreshMessages = async () => {
      try {
        // Capture scroll position before refresh
        const prevScrollTop = messagesContainerRef ? messagesContainerRef.scrollTop : 0;
        const prevScrollHeight = messagesContainerRef ? messagesContainerRef.scrollHeight : 0;

        const { data, error } = await getChatMessages(userCode);
        
        if (error) {
          console.error('Error refreshing messages:', error);
        } else {
          // Transform database messages to UI format
          const transformedMessages = (data || []).map(msg => ({
            id: msg.id,
            role: msg.role,
            message: msg.message,
            content: msg.content,
            attachments: msg.attachments,
            sender: msg.role === 'user' ? 'user' : 'bot',
            timestamp: new Date(msg.created_at),
            created_at: msg.created_at
          }));
          
          // Filter valid messages
          const validMessages = filterValidMessages(transformedMessages);
          
          // Sort messages by timestamp (oldest first for chat display)
          const sortedMessages = validMessages.sort((a, b) => a.timestamp - b.timestamp);
          
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

            // Auto-scroll to bottom since user is at bottom
            if (messagesContainerRef && isUserAtBottom) {
              setTimeout(() => {
                if (messagesContainerRef) {
                  messagesContainerRef.scrollTop = messagesContainerRef.scrollHeight;
                }
              }, 100);
            }
          }
        }
      } catch (err) {
        console.error('Error refreshing messages:', err);
      }
    };

    // Set up interval for auto-refresh (only if user is at bottom)
    const interval = setInterval(refreshMessages, 5000); // 5 seconds

    // Cleanup interval on unmount or tab change
    return () => clearInterval(interval);
  }, [activeTab, userCode, messages, messagesContainerRef, isUserAtBottom]);

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

  // Check if user is near bottom of scroll (within 100px)
  const isNearBottom = () => {
    if (!messagesContainerRef) return true;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef;
    return scrollHeight - scrollTop - clientHeight < 100;
  };

  // Scroll to bottom when messages change (but not when loading more)
  useEffect(() => {
    if (!isLoadingMore && messages.length > 0) {
      // Only scroll to bottom if we're not in the middle of loading more messages
      const isInitialLoad = messages.length <= 20; // Assume initial load if 20 or fewer messages
      // Only auto-scroll if user is already at the bottom
      if (isInitialLoad && isUserAtBottom) {
        setTimeout(scrollToBottom, 100);
      }
    }
  }, [messages.length, isLoadingMore, messagesContainerRef, isUserAtBottom]);

  // Scroll to bottom when loading completes (only for initial load and if at bottom)
  useEffect(() => {
    if (!isLoading && messages.length > 0 && messages.length <= 20 && isUserAtBottom) {
      setTimeout(scrollToBottom, 200);
    }
  }, [isLoading, messages.length, messagesContainerRef, isUserAtBottom]);

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
          role: msg.role,
          message: msg.message,
          content: msg.content,
          attachments: msg.attachments,
          sender: msg.role === 'user' ? 'user' : 'bot',
          timestamp: new Date(msg.created_at),
          created_at: msg.created_at
        }));
        
        // Filter valid messages
        const validOlderMessages = filterValidMessages(transformedOlderMessages);
        
        // Sort messages by timestamp (oldest first for chat display)
        const sortedOlderMessages = validOlderMessages.sort((a, b) => a.timestamp - b.timestamp);
        
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

  // Function to handle scroll - update isUserAtBottom state
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distanceFromBottom < 100; // Within 100px of bottom
    setIsUserAtBottom(nearBottom);
    
    // Auto-load more messages when scrolling to top
    if (scrollTop <= 50 && hasMoreMessages && !isLoadingMore && userCode && firstMessageId) {
      console.log('🔄 Auto-loading more messages at top...');
      handleLoadMore();
    }
  };

  // Filter valid messages (same logic as Chat.jsx)
  const filterValidMessages = (messages) => {
    return messages.filter(msg => {
      // Show assistant messages only if message is not null
      if (msg.role === 'assistant') {
        return msg.message !== null && msg.message !== undefined;
      }
      // Show user messages
      if (msg.role === 'user') {
        return true;
      }
      // Show system messages only if they contain specific content
      if (msg.role === 'system') {
        const content = msg.content || msg.message || '';
        return content.includes('ANALYZED FOOD CONTEXT') || content.includes('Image URL');
      }
      // Filter out other roles
      return false;
    });
  };

  // Format message time (same logic as Chat.jsx)
  const formatMessageTime = (dateString) => {
    if (!dateString) return '';
    
    const now = new Date();
    const messageDate = new Date(dateString);
    const diffMs = now - messageDate;
    const diffMins = Math.floor(diffMs / 60000);
    
    // "Just now" for < 1 minute
    if (diffMins < 1) {
      return language === 'hebrew' ? 'עכשיו' : 'Just now';
    }
    
    // "X min ago" for < 1 hour
    if (diffMins < 60) {
      return language === 'hebrew' ? `לפני ${diffMins} דקות` : `${diffMins} min ago`;
    }
    
    // Time only if today
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
    
    if (messageDay.getTime() === today.getTime()) {
      return formatChatTime(dateString);
    }
    
    // "Yesterday + time" if yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (messageDay.getTime() === yesterday.getTime()) {
      const timeStr = formatChatTime(dateString);
      return language === 'hebrew' ? `אתמול ${timeStr}` : `Yesterday ${timeStr}`;
    }
    
    // Full date + time if older
    const dateStr = language === 'hebrew'
      ? messageDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
      : messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = formatChatTime(dateString);
    return `${dateStr} ${timeStr}`;
  };

  // Check if should show date separator
  const shouldShowDateSeparator = (currentMsg, previousMsg) => {
    if (!previousMsg) return true;
    
    const currentDate = new Date(currentMsg.timestamp);
    const previousDate = new Date(previousMsg.timestamp);
    
    const currentDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const previousDay = new Date(previousDate.getFullYear(), previousDate.getMonth(), previousDate.getDate());
    
    return currentDay.getTime() !== previousDay.getTime();
  };

  // Function to render message content with attachments and formatting (same logic as Chat.jsx)
  const renderMessageContent = (msg) => {
    // Get content from message or content field
    let content = msg.message || msg.content || '';
    
    // Parse JSON if message starts with {
    if (content.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.response_text) {
          content = parsed.response_text;
        }
        // Remove buttons from parsed JSON - don't render them
        if (parsed.buttons) {
          delete parsed.buttons;
        }
      } catch (e) {
        // Not valid JSON, use as is
      }
    }
    
    // Remove any button-related content from the text
    // Remove WhatsApp button patterns like [Button Text] or button: patterns
    content = content.replace(/\[.*?\]/g, ''); // Remove [button text] patterns
    content = content.replace(/button:\s*[^\n]+/gi, ''); // Remove button: patterns
    content = content.trim();
    
    // Handle attachments if they exist
    if (msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
      return (
        <div className="space-y-2">
          {msg.attachments.map((attachment, idx) => {
            const url = attachment.url || attachment;
            const type = attachment.type || attachment.mime_type || '';
            
            if (type.startsWith('image/') || url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i)) {
              return (
                <img
                  key={idx}
                  src={url}
                  alt="Attachment"
                  className="max-w-full h-auto rounded-lg mt-2 shadow-md cursor-pointer"
                  style={{ maxHeight: '300px' }}
                  onClick={() => window.open(url, '_blank')}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              );
            } else if (type.startsWith('video/') || url.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
              return (
                <video
                  key={idx}
                  src={url}
                  controls
                  className="max-w-full h-auto rounded-lg mt-2"
                  style={{ maxHeight: '300px' }}
                />
              );
            } else if (type.startsWith('audio/') || url.match(/\.(mp3|wav|ogg)(\?|$)/i)) {
              return (
                <audio
                  key={idx}
                  src={url}
                  controls
                  className="w-full mt-2"
                />
              );
            } else {
              return (
                <a
                  key={idx}
                  href={url}
                  download
                  className="block text-blue-400 hover:text-blue-300 underline mt-2"
                >
                  {language === 'hebrew' ? 'הורד קובץ' : 'Download file'}
                </a>
              );
            }
          })}
          {content && (
            <div className="whitespace-pre-wrap break-words">{content}</div>
          )}
        </div>
      );
    }
    
    // Handle legacy image URLs in text
    const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?[^\s]*)?)/gi;
    const parts = content.split(urlRegex);
    
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <img
            key={index}
            src={part}
            alt="Food analysis image"
            className="max-w-full h-auto rounded-lg mt-2 shadow-md cursor-pointer"
            style={{ maxHeight: '300px' }}
            onClick={() => window.open(part, '_blank')}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        );
      }
      return <span key={index} className="whitespace-pre-wrap break-words">{part}</span>;
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


  if (isLoading) {
    return (
      <div className={`min-h-screen p-8 animate-fadeIn`}>
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
    <div className={`min-h-screen animate-fadeIn`}>
      {/* Header Section */}
      <div className="p-4 sm:p-6 pb-4 animate-slideInUp">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mr-4 shadow-lg shadow-purple-500/25 animate-pulse">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"/>
            </svg>
          </div>
    <div>
            <h2 className={`${themeClasses.textPrimary} text-3xl font-bold tracking-tight`}>
              {language === 'hebrew' ? 'הודעות מ-WhatsApp' : 'Messages from WhatsApp'}
            </h2>
            <p className={`${themeClasses.textSecondary} text-base mt-1`}>
              {language === 'hebrew' 
                ? 'צפייה בהודעות מהבוט שלכם ב-WhatsApp. כדי לשלוח הודעה, פנו לבוט ישירות ב-WhatsApp.'
                : 'View messages from your WhatsApp bot. To send a message, contact the bot directly on WhatsApp.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={setMessagesContainerRef}
        className={`p-4 sm:p-6 h-full overflow-y-auto animate-slideInUp custom-scrollbar`} 
        style={{ animationDelay: '0.2s', height: 'calc(100vh - 200px)' }}
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/25">
                      <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                    </div>
                    <h3 className={`${themeClasses.textPrimary} text-2xl font-bold mb-4`}>
                      {language === 'hebrew' ? 'אין הודעות עדיין' : 'No Messages Yet'}
                    </h3>
                    <p className={`${themeClasses.textSecondary} text-lg mb-6`}>
                      {language === 'hebrew' 
                        ? 'ההודעות שלכם מהבוט ב-WhatsApp יופיעו כאן.'
                        : 'Your messages from the WhatsApp bot will appear here.'
                      }
                    </p>
                    <div className={`${themeClasses.bgSecondary} rounded-xl p-6 max-w-md mx-auto border-l-4 border-green-500`}>
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                          </svg>
                        </div>
                        <div className="flex-1 text-left">
                          <h4 className={`${themeClasses.textPrimary} font-semibold text-lg mb-2`}>
                            {language === 'hebrew' ? 'שלחו הודעה ב-WhatsApp' : 'Send a Message on WhatsApp'}
                          </h4>
                          <p className={`${themeClasses.textSecondary} text-sm`}>
                            {language === 'hebrew'
                              ? 'כדי לשלוח הודעה לבוט, פתחו את WhatsApp ופנו לבוט ישירות. ההודעות יופיעו כאן לאחר מכן.'
                              : 'To send a message to the bot, open WhatsApp and contact the bot directly. Messages will appear here afterwards.'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
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
                    
                    {messages.map((message, index) => (
                      <div key={message.id}>
                        {/* Date Separator */}
                        {shouldShowDateSeparator(message, messages[index - 1]) && (
                        <div className="flex items-center justify-center my-4">
                          <div className={`${themeClasses.bgSecondary} ${themeClasses.textSecondary} px-3 py-1 rounded-full text-xs font-medium`}>
                              {formatChatDate(message.timestamp)}
                          </div>
                        </div>
                        )}
                        
                        {/* Message */}
                        <div
                          className={`mb-2 flex animate-slideInUp`}
                          style={{ 
                            animationDelay: `${0.3 + index * 0.1}s`,
                            justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
                            direction: message.sender === 'user' ? 'ltr' : 'ltr'
                          }}
                          >
                            <div
                              className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2 sm:py-3 rounded-2xl shadow-lg relative ${
                                message.sender === 'user'
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white'
                                  : `${themeClasses.bgSecondary} ${themeClasses.textPrimary} border ${themeClasses.borderPrimary}`
                              }`}
                            >
                              <div className="text-sm leading-relaxed pr-12">
                                {renderMessageContent(message)}
                              </div>
                              <p className={`text-xs mt-1 absolute bottom-1 right-2 ${
                                message.sender === 'user' ? 'text-emerald-100' : themeClasses.textMuted
                              }`}>
                                {formatMessageTime(message.created_at)}
                              </p>
                            </div>
                          </div>
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
