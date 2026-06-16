import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { debugMealPlans, getFoodLogs, createFoodLog, updateFoodLog, deleteFoodLog, createChatMessage, getCompaniesWithManagers, getClientCompanyAssignment, assignClientToCompany, getWeightLogs, createWeightLog } from '../supabase/secondaryClient';
import { normalizePhoneForDatabase, signOut } from '../supabase/auth';
import OnboardingModal from '../components/OnboardingModal';
import DailyLogTab from '../components/profile/DailyLogTab';
import PricingTab from '../components/profile/PricingTab';
import MessagesTab from '../components/profile/MessagesTab';
import SettingsTab from '../components/profile/SettingsTab';
import TrainingPlanTab from '../components/profile/TrainingPlanTab';
import MyPlanTab from '../components/profile/MyPlanTab';
import ProfileTab from '../components/profile/ProfileTab';

export const CREATE_MEAL_PLAN_API_URL =
  'https://meal-plan-builder-615263253386.europe-west3.run.app/api/create-meal-plan';

// Function to get training plan from training_plans table
export const getTrainingPlan = async (userCode) => {
  try {
    const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
    const response = await fetch(`${apiUrl}/api/training-plan?userCode=${encodeURIComponent(userCode)}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch training plan');
    }

    return { data: result.data, error: null };
  } catch (err) {
    console.error('Error fetching training plan:', err);
    return { data: null, error: err };
  }
};

// Function to get active meal plan from client_meal_plans table
export const getClientMealPlan = async (userCode) => {
  try {
    const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
    const response = await fetch(`${apiUrl}/api/profile/meal-plan?userCode=${encodeURIComponent(userCode)}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch meal plan');
    }

    const plansArray = result.data;
    if (!plansArray || !Array.isArray(plansArray) || plansArray.length === 0) {
      return { data: null, error: null };
    }

    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const todayDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Process all meal plans
    const processedPlans = plansArray.map((data) => {
      // Check if today is in the active_days
      // active_days: array of numbers 0-6 where 0=Sunday, 1=Monday, etc.
      // If active_days is null or undefined, it's an everyday plan
      const isActiveToday = data.active_days == null || (Array.isArray(data.active_days) && data.active_days.includes(today));

      // Check if edited plan is from today
      const editedPlanDate = data.edited_plan_date ? data.edited_plan_date.split('T')[0] : null;
      const hasEditedPlanFromToday = data.client_edited_meal_plan && editedPlanDate === todayDate;

      // If there's an edited plan from a previous day, clear it from the database
      if (data.client_edited_meal_plan && editedPlanDate && editedPlanDate !== todayDate) {
        console.log(`Clearing old edited meal plan from ${editedPlanDate} (today is ${todayDate})`);
        
        // Clear the old edited plan
        fetch(`${apiUrl}/api/profile/meal-plan/clear-edited`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: data.id })
        }).then(clearResponse => {
          if (clearResponse.ok) {
            console.log('✅ Cleared old edited meal plan from database');
          } else {
            console.error('Error clearing old edited meal plan');
          }
        }).catch(clearError => {
          console.error('Error clearing old edited meal plan:', clearError);
        });
      }

      // Prioritize client_edited_meal_plan if it's from today, otherwise use dietitian_meal_plan
      const mealPlan = hasEditedPlanFromToday ? data.client_edited_meal_plan : data.dietitian_meal_plan;

      // If we cleared an old edited plan, set these to null in the return
      const finalEditedPlan = hasEditedPlanFromToday ? data.client_edited_meal_plan : null;
      const finalEditedDate = hasEditedPlanFromToday ? data.edited_plan_date : null;

      return {
        id: data.id,
        meal_plan: mealPlan,
        dietitian_meal_plan: data.dietitian_meal_plan,
        client_edited_meal_plan: finalEditedPlan,
        edited_plan_date: finalEditedDate,
        ai_plan_change_used: data.ai_plan_change_used,
        ai_plan_change_used_at: data.ai_plan_change_used_at,
        daily_total_calories: data.daily_total_calories,
        macros_target: data.macros_target,
        meal_plan_name: data.meal_plan_name,
        active_from: data.active_from,
        active_until: data.active_until,
        active_days: data.active_days,
        isActiveToday: isActiveToday,
        isClientEdited: hasEditedPlanFromToday,
        dietitian_id: data.dietitian_id
      };
    });

    // Find the meal plan active for today (for backward compatibility)
    const todayPlan = processedPlans.find(plan => plan.isActiveToday) || processedPlans[0];

    return {
      data: {
        allPlans: processedPlans, // All meal plans
        currentPlan: todayPlan, // Plan for today (for backward compatibility)
        // Legacy fields for backward compatibility
        id: todayPlan.id,
        meal_plan: todayPlan.meal_plan,
        dietitian_meal_plan: todayPlan.dietitian_meal_plan,
        client_edited_meal_plan: todayPlan.client_edited_meal_plan,
        edited_plan_date: todayPlan.edited_plan_date,
        ai_plan_change_used: todayPlan.ai_plan_change_used,
        ai_plan_change_used_at: todayPlan.ai_plan_change_used_at,
        daily_total_calories: todayPlan.daily_total_calories,
        macros_target: todayPlan.macros_target,
        meal_plan_name: todayPlan.meal_plan_name,
        active_from: todayPlan.active_from,
        active_until: todayPlan.active_until,
        active_days: todayPlan.active_days,
        isActiveToday: todayPlan.isActiveToday,
        isClientEdited: todayPlan.isClientEdited,
        dietitian_id: todayPlan.dietitian_id
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
  const location = useLocation();
  const { companySlug: routeCompanySlug } = useParams();
  const { language, t, direction, toggleLanguage, isTransitioning } = useLanguage();
  const { isDarkMode, toggleTheme, themeClasses } = useTheme();
  const [activeTab, setActiveTab] = useState('dailyLog');
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
    foodLimitations: '',
    medicalConditions: '',
    userCode: '',
    region: '',
    city: '',
    timezone: '',
    userLanguage: '',
    isBlocked: false,
    companyId: '',
    profileImageUrl: '',
    activityLevel: '',
    bmrCalories: null,
    targetCalories: null,
    macros: null,
    heightCm: null,
    weightKg: null,
    measurementSystem: 'metric'
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
  const [assignedCompanyName, setAssignedCompanyName] = useState('');
  const [assignedCompanyConfig, setAssignedCompanyConfig] = useState(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isProfileDataReady, setIsProfileDataReady] = useState(false);

  const toCompanySlug = useCallback((companyName) => {
    const normalized = String(companyName || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    return normalized;
  }, []);

  const loadCompanyOptions = useCallback(async () => {
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
    if (!currentUserCode) return;

    try {
      const { data, error } = await getClientCompanyAssignment(currentUserCode);

      if (error) {
        console.error('Error fetching company assignment:', error);
        return;
      }

      const companyId = data?.provider?.company_id || data?.company?.id || '';
      const companyName = data?.company?.name || '';
      const companyConfig = data?.company?.config || null;
      setAssignedCompanyId(companyId || '');
      setAssignedCompanyName(companyName || '');
      setAssignedCompanyConfig(companyConfig);
      setProfileData((prev) => ({
        ...prev,
        companyId: companyId || ''
      }));
    } catch (error) {
      console.error('Unexpected error fetching company assignment:', error);
    }
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) return;
    if (!assignedCompanyName) return;

    const resolvedSlug = toCompanySlug(assignedCompanyName);
    if (!resolvedSlug) return;

    const expectedTenantPath = `/c/${resolvedSlug}/profile`;
    const isOnLegacyProfilePath = location.pathname === '/profile';
    const isOnTenantProfilePath = /^\/c\/[^/]+\/profile\/?$/.test(location.pathname);

    if (isOnLegacyProfilePath) {
      navigate(expectedTenantPath, { replace: true });
      return;
    }

    if (isOnTenantProfilePath && routeCompanySlug && routeCompanySlug !== resolvedSlug) {
      navigate(expectedTenantPath, { replace: true });
    }
  }, [
    assignedCompanyName,
    isAuthenticated,
    loading,
    location.pathname,
    navigate,
    routeCompanySlug,
    toCompanySlug
  ]);

  // Check onboarding status
  const checkOnboardingStatus = useCallback(async () => {
    try {
      if (!user) return;

      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
      const response = await fetch(`${apiUrl}/api/profile/client?userId=${encodeURIComponent(user.id)}`);
      const result = await response.json();

      if (!response.ok) {
        console.error('Error checking onboarding status:', result.error);
        return;
      }

      const data = result.data;

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
  }, [user]);

  // Callback to handle onboarding completion
  const handleOnboardingComplete = async (completed = true) => {
    if (completed) {
      // Onboarding was completed - close the modal first to prevent reopening
      setShowOnboarding(false);
      
      // Set state immediately to allow editing
      setOnboardingCompleted(true);
      
      // Reload profile data to show the updated information
      // Don't call checkOnboardingStatus() here since we know onboarding is complete
      // This prevents the modal from reopening
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

  // Reset profile data ready when user logs out (so next login shows loading until API returns)
  useEffect(() => {
    if (!user) {
      setIsProfileDataReady(false);
    }
  }, [user]);

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

  // Listen for profile tour completion to show onboarding
  useEffect(() => {
    if (!user) return;

    // Check if tour is already completed
    const profileTourCompleted = localStorage.getItem('profileTourCompleted');
    if (profileTourCompleted === 'true') {
      // Tour already completed, check onboarding
      checkOnboardingStatus();
      return;
    }

    // Listen for storage changes (works across tabs)
    const handleStorageChange = (e) => {
      if (e.key === 'profileTourCompleted' && e.newValue === 'true') {
        console.log('✅ Profile tour completed (detected via storage event), checking onboarding...');
        checkOnboardingStatus();
      }
    };

    // Listen for custom event from WebsiteTour
    const handleTourComplete = () => {
      console.log('✅ Profile tour completed (detected via custom event), checking onboarding...');
      checkOnboardingStatus();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('profileTourCompleted', handleTourComplete);

    // Also poll periodically as a fallback (check every 1 second)
    const pollInterval = setInterval(() => {
      const tourCompleted = localStorage.getItem('profileTourCompleted');
      if (tourCompleted === 'true') {
        console.log('✅ Profile tour completed (detected via polling), checking onboarding...');
        clearInterval(pollInterval);
        checkOnboardingStatus();
      }
    }, 1000);

    // Clean up after 5 minutes (safety timeout)
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
    }, 300000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('profileTourCompleted', handleTourComplete);
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [user, checkOnboardingStatus]);

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
      
      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
      
      // First, load from clients table (primary database) to get user_code
      const response = await fetch(`${apiUrl}/api/profile/load?userId=${encodeURIComponent(user.id)}`);
      const result = await response.json();

      if (!response.ok && response.status !== 404) {
        console.error('Detailed error loading profile:', result.error);
        return;
      }

      const data = result.data;
      
      // Then, try to load from chat_users table (secondary database) if user_code exists
      let chatUserData = null;
      const userCode = data?.user_code || profileData.userCode;
      if (userCode) {
        try {
          const chatResponse = await fetch(`${apiUrl}/api/profile/chat-user?userCode=${encodeURIComponent(userCode)}`);
          const chatResult = await chatResponse.json();
          
          if (chatResponse.ok && chatResult.data) {
            chatUserData = chatResult.data;
            if (process.env.NODE_ENV === 'development') {
              console.log('Profile data loaded from chat_users:', chatUserData);
            }
          }
        } catch (chatError) {
          console.error('Error loading from chat_users:', chatError);
        }
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
          foodLimitations: chatUserData.food_limitations || '',
          medicalConditions: chatUserData.medical_conditions || ''
        } : {
          dietaryPreferences: data?.dietary_preferences || '',
          foodAllergies: data?.food_allergies || '',
          foodLimitations: data?.food_limitations || '',
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
          foodLimitations: healthData.foodLimitations,
          medicalConditions: healthData.medicalConditions,
          userCode: data?.user_code || prev.userCode || '',
          region: (chatUserData?.region || data?.region) || '',
          city: (chatUserData?.city || data?.city) || '',
          timezone: (chatUserData?.timezone || data?.timezone) || '',
          userLanguage: (chatUserData?.language || data?.user_language) || '',
          isBlocked: chatUserData?.is_blocked === true || chatUserData?.is_blocked === 1 || chatUserData?.is_blocked === 'true',
          companyId: prev.companyId || '',
          profileImageUrl: data?.profile_image_url || '',
          activityLevel: chatUserData?.Activity_level || '',
          bmrCalories: chatUserData?.base_daily_total_calories ?? null,
          targetCalories: chatUserData?.daily_target_total_calories ?? null,
          macros: chatUserData?.macros ?? null,
          heightCm: chatUserData?.height_cm ?? null,
          weightKg: chatUserData?.weight_kg ?? null,
          measurementSystem: data?.measurement_system ?? prev.measurementSystem ?? 'metric'
        }));

        // Sync web language: site is EN/HE only; default to English when preference is not en/he (e.g. es, fr).
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
    } finally {
      setIsProfileDataReady(true);
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
        food_limitations: profileData.foodLimitations?.trim() || null,
        medical_conditions: profileData.medicalConditions?.trim() || null,
        user_code: profileData.userCode?.trim() || null,
        region: profileData.region?.trim() || null,
        city: profileData.city?.trim() || null,
        timezone: profileData.timezone || null,
        user_language: profileData.userLanguage || null,
        profile_image_url: profileData.profileImageUrl || null,
        updated_at: new Date().toISOString()
      };

      console.log('Attempting to save profile data:', dataToSave);

      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
      
      // Save to clients table
      const response = await fetch(`${apiUrl}/api/profile/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, profileData: dataToSave })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Detailed error saving profile:', result.error);
        
        // Provide more specific error messages based on error type
        let errorMessage = 'Error saving profile';
        if (result.code === '23505') {
          errorMessage = 'Email address already exists. Please use a different email.';
        } else if (result.code === '23503') {
          errorMessage = 'Invalid user reference. Please try logging in again.';
        } else if (result.error && result.error.includes('permission')) {
          errorMessage = 'Permission denied. Please check your account status.';
        } else if (result.error && (result.error.includes('network') || result.error.includes('timeout'))) {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
        
        setErrorMessage(errorMessage);
        setSaveStatus('error');
        console.error('User-friendly error:', errorMessage);
      } else {
        const data = result.data;
        console.log('Profile saved successfully:', data);
        
        // Sync to chat_users table (secondary database)
        if (data && data[0] && profileData.userCode) {
          try {
            console.log('Syncing profile to chat_users for user_code:', profileData.userCode);
            
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
              food_limitations: dataToSave.food_limitations, // text field
              client_preference: dataToSave.dietary_preferences || null, // jsonb field - save value directly
              medical_conditions: dataToSave.medical_conditions, // text field
              language: dataToSave.user_language, // Map user_language to language
              updated_at: dataToSave.updated_at
            };

            const syncResponse = await fetch(`${apiUrl}/api/profile/sync-chat-user`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userCode: profileData.userCode, chatUserData: chatUpdates })
            });

            if (!syncResponse.ok) {
              console.error('Error updating chat_users');
            } else {
              console.log('Chat user synced successfully with all fields');
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

  // Function to save only the profile image URL (called after image upload)
  const saveProfileImageUrl = async (imageUrl) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
      
      const response = await fetch(`${apiUrl}/api/profile/save-image-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, imageUrl })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error saving profile image URL:', result.error);
        return { error: new Error(result.error) };
      }

      // Update local state
      setProfileData(prev => ({ ...prev, profileImageUrl: imageUrl }));
      return { success: true };
    } catch (error) {
      console.error('Unexpected error saving profile image URL:', error);
      return { error };
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Logout error:', error);
        setErrorMessage(language === 'hebrew' ? 'שגיאה בהתנתקות' : 'Error logging out');
      } else {
        // Navigate to homepage after successful logout
        navigate('/');
      }
    } catch (err) {
      console.error('Logout error:', err);
      setErrorMessage(language === 'hebrew' ? 'שגיאה בהתנתקות' : 'Error logging out');
    }
  };

  const tabs = [
    { 
      id: 'dailyLog', 
      label: language === 'hebrew' ? 'יומן בריאות' : 'Health Diary',
      icon: '📝',
      description: language === 'hebrew' ? 'מעקב, הבנה והתקדמות' : 'Tracking, Understanding, and Progress'
    },
    { 
      id: 'myPlan', 
      label: t.profile.tabs.myPlan,
      icon: '🍽️',
      description: language === 'hebrew' ? 'תוכנית תזונה וכושר מותאמת אישית' : 'Personalized nutrition and fitness plan'
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
      id: 'profile', 
      label: t.profile.tabs.profile,
      icon: '👤',
      description: language === 'hebrew' ? 'נהל את הפרטים האישיים שלך' : 'Manage your personal information'
    }
  ];

  // Prevent body scrolling to avoid double scrollbars
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

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
      <div data-tour="profile-sidebar" className={`hidden lg:flex flex-col ${language === 'english' ? 'w-96' : 'w-80'} ${themeClasses.bgCard} backdrop-blur-xl bg-opacity-80 dark:bg-opacity-80 shadow-2xl border-r ${isDarkMode ? 'border-slate-700/50' : 'border-emerald-100/50'} relative z-20`} dir={direction}>
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none" />
        
        {/* Header */}
        <div className="p-6 border-b border-emerald-500/10 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`flex flex-col items-center ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`}>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-teal-400/20 rounded-2xl blur-md group-hover:blur-lg transition-all duration-300"></div>
                  <img src="/favicon.ico" alt="BetterChoice Logo" className="relative w-20 h-20 rounded-2xl shadow-xl ring-1 ring-emerald-500/20 group-hover:ring-emerald-400/40 transition-all duration-300" />
                  <div className={`absolute -top-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800 animate-pulse ${direction === 'rtl' ? '-left-1' : '-right-1'} shadow-lg shadow-emerald-500/50`} />
                </div>
                <a
                  href={language === 'hebrew' ? 'https://wa.me/message/B2LIFC7FLCCMN1' : 'https://wa.me/message/YH4IM5MWPY4HI1'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-3 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:scale-105 active:scale-95 text-xs font-bold min-w-[90px]`}
                  aria-label={language === 'hebrew' ? 'צור קשר ב-WhatsApp' : 'Contact us on WhatsApp'}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  <span className="whitespace-nowrap">{language === 'hebrew' ? 'ל-AI שלנו' : 'AI Chat'}</span>
                </a>
              </div>
              <div className={`${direction === 'rtl' ? 'text-right' : 'text-left'} -mt-8`}>
                <h1 className={`${themeClasses.textPrimary} text-2xl font-extrabold bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent leading-tight tracking-tight`}>BetterChoice</h1>
                <p className={`${themeClasses.textSecondary} text-sm mt-0.5 font-medium`}>{t.profile.title}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="p-4 relative flex-1 overflow-y-auto overflow-x-hidden" id="nav-container">
          <nav className="space-y-2 relative z-10">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                data-tour={tab.id === 'profile' ? 'profile-tab' : tab.id === 'myPlan' ? 'myplan-tab' : tab.id === 'dailyLog' ? 'dailylog-tab' : tab.id === 'messages' ? 'messages-tab' : tab.id === 'pricing' ? 'pricing-tab' : null}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center p-4 rounded-2xl transition-all duration-300 relative overflow-hidden group ${direction === 'rtl' ? 'flex-row-reverse' : ''} ${
                  activeTab === tab.id
                    ? `${themeClasses.bgSecondary} shadow-md`
                    : `hover:${themeClasses.bgSecondary} hover:bg-opacity-50`
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className={`absolute top-0 bottom-0 w-1.5 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)] ${direction === 'rtl' ? 'right-0' : 'left-0'}`}
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${direction === 'rtl' ? 'ml-4' : 'mr-4'} ${
                  activeTab === tab.id 
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/40 scale-105' 
                    : `${themeClasses.bgCard} shadow-sm border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'} group-hover:scale-105`
                }`}>
                  <span className="text-xl">{tab.icon}</span>
                </div>
                <div className={`flex-1 min-w-0 overflow-hidden ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                  <div className={`font-bold transition-colors duration-300 ${
                    activeTab === tab.id ? themeClasses.textPrimary : themeClasses.textSecondary
                  } truncate`}>
                    {tab.label}
                  </div>
                  <div className={`text-xs mt-0.5 transition-colors duration-300 font-medium ${
                    activeTab === tab.id ? themeClasses.textSecondary : themeClasses.textMuted
                  } line-clamp-2 leading-relaxed`}>
                    {tab.description}
                  </div>
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Bottom Controls */}
        <div className="p-6 border-t border-emerald-500/10 relative z-10">
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
              {/* Language & Theme Config */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <motion.button 
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={toggleLanguage}
                    className={`${themeClasses.bgCard} shadow-sm border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'} hover:border-blue-400/50 rounded-xl p-3 transition-colors duration-300`}
                  >
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd"/>
                      </svg>
                      <span className="text-blue-500 text-sm font-bold">{language === 'hebrew' ? 'עב' : 'En'}</span>
                    </div>
                  </motion.button>
                </div>

                <div className="flex items-center">
                  <motion.button 
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={toggleTheme}
                    className={`${themeClasses.bgCard} shadow-sm border ${isDarkMode ? 'border-emerald-500/50 text-yellow-400' : 'border-slate-200 text-slate-700 hover:border-emerald-400/50'} rounded-xl p-3 transition-colors duration-300`}
                  >
                    {isDarkMode ? '☀️' : '🌙'}
                  </motion.button>
                </div>
              </div>

              {/* Settings and Logout Controls */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <motion.button 
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  data-tour="settings-button"
                  onClick={() => setActiveTab('settings')}
                  className={`flex items-center justify-center flex-1 ${themeClasses.bgCard} shadow-sm border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'} rounded-xl p-3 transition-colors`}
                >
                  <svg className={`w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className={`ml-2 rtl:mr-2 font-bold text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{language === 'hebrew' ? 'הגדרות' : 'Settings'}</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setShowLogoutConfirm(true)}
                  className={`flex items-center justify-center flex-1 ${themeClasses.bgCard} shadow-sm border border-red-500/30 hover:bg-red-500/10 rounded-xl p-3 transition-colors`}
                >
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="ml-2 rtl:mr-2 font-bold text-sm text-red-500">{language === 'hebrew' ? 'התנתק' : 'Logout'}</span>
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header - Shows on mobile only */}
      <div className={`lg:hidden ${themeClasses.bgCard} backdrop-blur-xl bg-opacity-90 dark:bg-opacity-90 shadow-sm border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} relative z-20`}>
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none" />
        <div className="relative z-10">
          <div className="p-4 relative">
            <div className="flex items-center justify-between relative">
              <button
                data-tour="mobile-menu-button"
                onClick={() => setIsMobileNavOpen(true)}
                className={`p-2.5 rounded-xl transition-all duration-300 ${themeClasses.bgSecondary} border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'} hover:shadow-md active:scale-95`}
                aria-label={language === 'hebrew' ? 'תפריט' : 'Menu'}
              >
                <div className="w-6 h-6 flex flex-col justify-center gap-1.5">
                  <span className={`block h-0.5 w-6 ${themeClasses.bgPrimary} bg-slate-800 dark:bg-white rounded-full`}></span>
                  <span className={`block h-0.5 w-6 ${themeClasses.bgPrimary} bg-slate-800 dark:bg-white rounded-full`}></span>
                  <span className={`block h-0.5 w-4 ${themeClasses.bgPrimary} bg-slate-800 dark:bg-white rounded-full`}></span>
                </div>
              </button>
              
              <div className="flex items-center flex-1 justify-center gap-3">
                <div className="relative">
                  <img src="/favicon.ico" alt="BetterChoice Logo" className="relative w-10 h-10 rounded-xl shadow-md ring-1 ring-emerald-500/20" />
                </div>
                <div className={direction === 'rtl' ? 'text-right' : 'text-left'}>
                  <h1 className={`${themeClasses.textPrimary} text-lg font-extrabold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent leading-tight`}>BetterChoice</h1>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer (AnimatePresence) */}
      <AnimatePresence>
        {isMobileNavOpen && (
          <div className="lg:hidden fixed inset-0 z-50 overflow-hidden" dir={direction}>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsMobileNavOpen(false)}
            />
            
            {/* Navigation Panel */}
            <motion.div 
              initial={{ x: direction === 'rtl' ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: direction === 'rtl' ? '100%' : '-100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={`absolute top-0 h-full w-80 max-w-[85vw] ${direction === 'rtl' ? 'right-0' : 'left-0'} ${themeClasses.bgCard} shadow-2xl flex flex-col`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none" />
              
              <div className="relative z-10 p-5 border-b border-emerald-500/10">
                <div className={`flex items-center justify-between ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center gap-3 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
                    <img src="/favicon.ico" alt="Logo" className="w-12 h-12 rounded-xl shadow-md ring-1 ring-emerald-500/20" />
                    <div className={`${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                      <h1 className="text-lg font-extrabold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">BetterChoice</h1>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsMobileNavOpen(false)}
                    className={`p-2 rounded-xl ${themeClasses.bgSecondary} border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}
                  >
                    <svg className={`w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-6 z-10">
                <div className="space-y-3">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setIsMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center ${direction === 'rtl' ? 'flex-row-reverse' : ''} gap-4 px-4 py-3.5 rounded-2xl transition-all font-bold ${
                        activeTab === tab.id
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30'
                          : `${themeClasses.bgSecondary} ${themeClasses.textSecondary} hover:bg-opacity-80`
                      }`}
                    >
                      <span className="text-2xl">{tab.icon}</span>
                      <span className="flex-1 text-left rtl:text-right">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 border-t border-emerald-500/10 z-10 space-y-3">
                <div className="flex gap-3">
                  <button onClick={toggleLanguage} className={`flex-1 ${themeClasses.bgSecondary} rounded-xl py-3 text-blue-500 font-bold border border-slate-200 dark:border-slate-700 shadow-sm`}>
                    {language === 'hebrew' ? 'English' : 'עברית'}
                  </button>
                  <button onClick={toggleTheme} className={`flex-1 ${themeClasses.bgSecondary} rounded-xl py-3 font-bold border border-slate-200 dark:border-slate-700 shadow-sm ${isDarkMode ? 'text-yellow-400' : 'text-slate-700'}`}>
                    {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                  </button>
                </div>
                <button
                  onClick={() => {
                    setShowLogoutConfirm(true);
                    setIsMobileNavOpen(false);
                  }}
                  className="w-full flex justify-center items-center gap-2 bg-red-500/10 text-red-500 font-bold py-3 rounded-xl border border-red-500/20"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  {language === 'hebrew' ? 'התנתק' : 'Logout'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className={`flex-1 ${activeTab === 'messages' ? 'overflow-hidden' : 'overflow-y-auto'} custom-scrollbar relative lg:${themeClasses.bgCard} z-10`}>
        <div className={`${activeTab === 'messages' ? 'h-full overflow-hidden' : 'min-h-full'} w-full max-w-7xl mx-auto ${themeClasses.bgCard} rounded-t-[2rem] lg:rounded-none mt-2 sm:mt-3 lg:mt-0 shadow-[0_-8px_20px_-10px_rgba(0,0,0,0.1)] lg:shadow-none border-t border-x lg:border-none ${isDarkMode ? 'border-slate-700/50' : 'border-white/80'} ${activeTab === 'messages' ? '' : 'p-5 sm:p-8 md:p-12'} transition-all duration-300`}>
          {!isProfileDataReady ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
              <div className="w-14 h-14 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" aria-hidden="true" />
              <p className={`${themeClasses.textSecondary} text-lg font-medium`}>
                {language === 'hebrew' ? 'טוען נתונים...' : 'Loading your data...'}
              </p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className={activeTab === 'messages' ? 'h-full' : ''}
              >
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
                    user={user}
                    onSaveProfileImageUrl={saveProfileImageUrl}
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
                  <PricingTab
                    themeClasses={themeClasses}
                    user={{
                      ...user,
                      user_code: profileData.userCode || user?.user_code,
                      is_blocked: profileData.isBlocked,
                      full_name: `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim() || user?.full_name || ''
                    }}
                    language={language}
                    companyName={assignedCompanyName}
                  />
                )}
                {activeTab === 'settings' && (
                  <SettingsTab themeClasses={themeClasses} language={language} userCode={profileData.userCode} />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Onboarding Modal */}
        <OnboardingModal
          isOpen={showOnboarding}
          onClose={handleOnboardingComplete}
          user={user}
          userCode={userCode}
          companyName={assignedCompanyName}
          companyConfig={assignedCompanyConfig}
        />

        {/* Logout Confirmation Modal (AnimatePresence) */}
        <AnimatePresence>
          {showLogoutConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0" dir={direction}>
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
                onClick={() => setShowLogoutConfirm(false)}
              />

              {/* Modal Body */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className={`relative w-full max-w-md overflow-hidden rounded-[2rem] shadow-2xl ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-white'}`}
              >
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-6 py-8 text-center">
                  <div className="text-5xl mb-4 drop-shadow-lg">🚪</div>
                  <h3 className="text-2xl font-extrabold text-white tracking-tight mb-2">
                    {language === 'hebrew' ? 'התנתקות?' : 'Logout?'}
                  </h3>
                </div>

                <div className="px-6 py-8">
                  <p className={`text-base font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'} text-center mb-8`}>
                    {language === 'hebrew' 
                      ? 'האם אתה בטוח שברצונך להתנתק מהחשבון? תועבר למסך הבית.' 
                      : 'Are you sure you want to logout? You will be redirected to the homepage.'}
                  </p>

                  <div className="flex gap-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={handleLogout}
                      className="flex-1 bg-gradient-to-r from-red-500 to-rose-600 text-white py-3.5 px-6 rounded-xl font-bold shadow-lg shadow-red-500/25 transition-all"
                    >
                      {language === 'hebrew' ? 'כן, התנתק' : 'Yes, Logout'}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => setShowLogoutConfirm(false)}
                      className={`flex-1 py-3.5 px-6 rounded-xl font-bold border transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    >
                      {language === 'hebrew' ? 'ביטול' : 'Cancel'}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Helper functions to normalize food items from different formats
// Supports both old format (cals, p, c, f) and new format (macros object)
export const normalizeFoodItem = (item) => {
  if (!item) return null;
  
  // Check if item has the new format with macros object
  if (item.macros && typeof item.macros === 'object') {
    return {
      name: item.name || 'Unknown Item',
      cals: item.macros.calories || 0,
      p: item.macros.protein_g || 0,
      c: item.macros.carbs_g || 0,
      f: item.macros.fat_g || 0,
      quantity: item.portion_estimate || item.quantity || null,
      confidence: item.confidence || null,
      visual_evidence: item.visual_evidence || null,
      portion_estimate: item.portion_estimate || null
    };
  }
  
  // Old format - return as-is but ensure all fields exist
  return {
    name: item.name || 'Unknown Item',
    cals: item.cals || 0,
    p: item.p || 0,
    c: item.c || 0,
    f: item.f || 0,
    quantity: item.quantity || null,
    confidence: item.confidence || null,
    visual_evidence: item.visual_evidence || null,
    portion_estimate: item.portion_estimate || null
  };
};

// Helper function to parse and normalize food items from a log
export const parseFoodItems = (log) => {
  if (!log.food_items) return [];
  
  try {
    const foodItems = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
    if (Array.isArray(foodItems)) {
      return foodItems.map(normalizeFoodItem).filter(item => item !== null);
    }
  } catch (e) {
    console.error('Error parsing food_items:', e);
  }
  
  return [];
};

// Profile Tab Component
// Weight Progress Component
export const WeightProgressComponent = ({ userCode, themeClasses, language, isDarkMode }) => {
  const [weightLogs, setWeightLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState('weight'); // 'weight', 'body_fat', 'waist', 'hip', etc.
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [timePeriod, setTimePeriod] = useState('all'); // '1m', '3m', '6m', 'all'
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showAverage, setShowAverage] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showAddMeasurementModal, setShowAddMeasurementModal] = useState(false);
  const [measurementForm, setMeasurementForm] = useState({
    measurementType: 'weight',
    value: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [saving, setSaving] = useState(false);

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

  const handleAddMeasurement = async () => {
    if (!measurementForm.value || !measurementForm.date) {
      return;
    }

    setSaving(true);
    try {
      const weightLogData = {
        measurement_date: measurementForm.date
      };

      // Add the value to the appropriate field based on measurement type
      switch (measurementForm.measurementType) {
        case 'weight':
          weightLogData.weight_kg = parseFloat(measurementForm.value);
          break;
        case 'body_fat':
          weightLogData.body_fat_percentage = parseFloat(measurementForm.value);
          break;
        case 'waist':
          weightLogData.waist_circumference_cm = parseFloat(measurementForm.value);
          break;
        case 'hip':
          weightLogData.hip_circumference_cm = parseFloat(measurementForm.value);
          break;
        case 'arm':
          weightLogData.arm_circumference_cm = parseFloat(measurementForm.value);
          break;
        case 'neck':
          weightLogData.neck_circumference_cm = parseFloat(measurementForm.value);
          break;
        default:
          break;
      }

      const { data, error } = await createWeightLog(userCode, weightLogData);

      if (error) {
        console.error('Error creating weight log:', error);
        alert(language === 'hebrew' ? 'שגיאה בשמירת המדידה. נסה שוב.' : 'Error saving measurement. Please try again.');
      } else {
        // Reload weight logs
        const { data: updatedLogs, error: reloadError } = await getWeightLogs(userCode);
        if (!reloadError) {
          setWeightLogs(updatedLogs || []);
        }
        setShowAddMeasurementModal(false);
        setMeasurementForm({
          measurementType: 'weight',
          value: '',
          date: new Date().toISOString().split('T')[0]
        });
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      alert(language === 'hebrew' ? 'שגיאה בשמירת המדידה. נסה שוב.' : 'Error saving measurement. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Check for mobile device and portrait orientation
  useEffect(() => {
    const checkOrientation = () => {
      const width = window.innerWidth || window.screen.width;
      const height = window.innerHeight || window.screen.height;
      
      const isMobileDevice = width < 768 || height < 768;
      setIsMobile(isMobileDevice);
      
      const isPortraitMode = height > width;
      const shouldShowMessage = isMobileDevice && isPortraitMode;
      
      setIsLandscape(shouldShowMessage);
    };

    checkOrientation();
    const handleResize = () => setTimeout(checkOrientation, 100);
    const handleOrientationChange = () => setTimeout(checkOrientation, 200);
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(orientation: portrait)');
      const handleMediaChange = () => setTimeout(checkOrientation, 100);
      
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleMediaChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleMediaChange);
      }
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  useEffect(() => {
    setHoveredPoint(null);
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 400);
    return () => clearTimeout(timer);
  }, [timePeriod, selectedMetric]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return language === 'hebrew' 
      ? date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDateFull = (dateString) => {
    const date = new Date(dateString);
    return language === 'hebrew'
      ? date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
      : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getChartData = () => {
    if (!weightLogs || weightLogs.length === 0) return [];
    let filteredLogs = [...weightLogs];

    if (timePeriod !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (timePeriod) {
        case '1m': cutoffDate.setMonth(now.getMonth() - 1); break;
        case '3m': cutoffDate.setMonth(now.getMonth() - 3); break;
        case '6m': cutoffDate.setMonth(now.getMonth() - 6); break;
        default: break;
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
  const isRtl = language === 'hebrew';
  const getChartX = (index, total) => {
    if (!total || total <= 1) return 50;
    const ratio = index / (total - 1);
    return isRtl ? 750 - ratio * 700 : 50 + ratio * 700;
  };

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

  const getCurrentValue = () => {
    if (chartData.length === 0) return null;
    const latest = chartData[chartData.length - 1];
    return getMetricValue(latest);
  };

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

  const getAverageValue = () => {
    if (chartData.length === 0) return null;
    const values = chartData.map(d => getMetricValue(d)).filter(v => v != null);
    if (values.length === 0) return null;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  };

  const averageValue = getAverageValue();

  const handlePointMouseEnter = (d, index, value, x, y) => setHoveredPoint({ index, data: d, value, x, y });
  const handlePointMouseLeave = () => setHoveredPoint(null);

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
    
    if (mouseX < chartStartX || mouseX > chartEndX) {
      setHoveredPoint(null);
      return;
    }
    
    let closestIndex = 0;
    let minDistance = Infinity;
    const n = chartData.length;

    chartData.forEach((d, index) => {
      const value = getMetricValue(d);
      if (value == null) return;
      const x = getChartX(index, n);
      const distance = Math.abs(mouseX - x);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    const closestData = chartData[closestIndex];
    const closestValue = getMetricValue(closestData);
    if (closestValue == null) return;

    const normalizedValue = closestValue - min;
    const ratio = normalizedValue / range;
    const x = getChartX(closestIndex, n);
    const y = 180 - (ratio * 160);

    setHoveredPoint({ index: closestIndex, data: closestData, value: closestValue, x, y });
  };

  const handleChartMouseLeave = () => setHoveredPoint(null);

  if (loading) {
    return (
      <div className={`${themeClasses.bgCard} backdrop-blur-xl bg-opacity-70 dark:bg-opacity-70 rounded-[2rem] p-6 mb-6 shadow-xl border ${isDarkMode ? 'border-slate-700/50' : 'border-white'} animate-pulse`}>
        <div className="h-48 bg-gray-500/20 rounded-xl"></div>
      </div>
    );
  }

  const hasData = chartData.length > 0;

  return (
    <div className={`${themeClasses.bgCard} backdrop-blur-md bg-opacity-80 dark:bg-opacity-80 rounded-[2rem] p-4 sm:p-6 mb-6 shadow-xl border ${isDarkMode ? 'border-slate-700/50' : 'border-white/50'}`}>
      {isMobile && (
        <div className={`${themeClasses.bgSecondary} rounded-xl p-3 mb-5 border border-emerald-500/20`}>
          <div className="flex items-start gap-2">
            <span className="text-lg">💻</span>
            <p className={`${themeClasses.textSecondary} text-xs sm:text-sm flex-1 font-medium`}>
              {language === 'hebrew' 
                ? 'לצפייה טובה יותר, פתח את האתר במחשב' 
                : 'For better viewing, open the website on a computer'}
            </p>
          </div>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-5 gap-4">
        <div className="flex-1 min-w-0">
          <h3 className={`${themeClasses.textPrimary} text-xl sm:text-2xl font-extrabold tracking-tight`}>
            {language === 'hebrew' ? 'מעקב משקל והתקדמות' : 'Weight & Progress Tracking'}
          </h3>
          <div className="flex flex-wrap gap-2 sm:gap-4 mt-2">
            {currentValue != null && (
              <p className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium`}>
                {language === 'hebrew' ? 'ערך נוכחי: ' : 'Current: '}
                <span className="font-bold text-emerald-500">
                  {currentValue.toFixed(selectedMetric === 'weight' || selectedMetric === 'body_fat' ? 1 : 0)} {getMetricUnit()}
                </span>
              </p>
            )}
            {averageValue != null && (
              <p className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium`}>
                {language === 'hebrew' ? 'ממוצע: ' : 'Average: '}
                <span className="font-bold text-blue-500">
                  {averageValue.toFixed(selectedMetric === 'weight' || selectedMetric === 'body_fat' ? 1 : 0)} {getMetricUnit()}
                </span>
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto sm:flex-shrink-0">
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddMeasurementModal(true)}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold shadow-lg shadow-emerald-500/25 whitespace-nowrap"
          >
            {language === 'hebrew' ? 'הוסף מדידה' : 'Add Measurement'}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setExpanded(!expanded)}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl ${themeClasses.bgSecondary} border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'} font-bold shadow-sm whitespace-nowrap`}
          >
            {expanded 
              ? (language === 'hebrew' ? 'סגור' : 'Hide Options')
              : (language === 'hebrew' ? 'מידות נוספות' : 'More Measurements')
            }
          </motion.button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {[
          { key: '1m', label: language === 'hebrew' ? 'חודש 1' : '1 Month' },
          { key: '3m', label: language === 'hebrew' ? '3 חודשים' : '3 Months' },
          { key: '6m', label: language === 'hebrew' ? '6 חודשים' : '6 Months' },
          { key: 'all', label: language === 'hebrew' ? 'כל הזמן' : 'All Time' }
        ].map(period => (
          <button
            key={period.key}
            onClick={() => setTimePeriod(period.key)}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              timePeriod === period.key
                ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-md'
                : `${themeClasses.bgSecondary} ${themeClasses.textSecondary} hover:bg-slate-200 dark:hover:bg-slate-700`
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="mb-6 flex flex-wrap gap-2 overflow-hidden"
          >
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
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  selectedMetric === metric.key
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/40'
                    : `${themeClasses.bgSecondary} ${themeClasses.textSecondary} border border-transparent hover:border-emerald-500/30`
                }`}
              >
                {metric.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {isLandscape && (
        <div className={`${themeClasses.bgCard} rounded-2xl p-8 mb-6 border-2 border-emerald-500/50 shadow-xl`} style={{ minHeight: '200px' }}>
          <div className="flex flex-col items-center justify-center text-center h-full">
            <div className="text-6xl mb-4 animate-bounce">📱</div>
            <h3 className={`${themeClasses.textPrimary} text-xl sm:text-2xl font-bold mb-3`}>
              {language === 'hebrew' ? 'סובב את הטלפון' : 'Rotate Your Phone'}
            </h3>
            <p className={`${themeClasses.textSecondary} text-base sm:text-lg max-w-md`}>
              {language === 'hebrew' 
                ? 'אנא סובב את הטלפון שלך למצב אופקי (Landscape) כדי לראות את הגרף' 
                : 'Please rotate your phone to landscape mode (horizontal) to view the chart'}
            </p>
          </div>
        </div>
      )}

      {!isLandscape && (
      <div className={`rounded-2xl border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200'} ${themeClasses.bgCard} p-4 shadow-sm overflow-visible`}>
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-4xl mb-4 opacity-50">📊</div>
            <p className={`${themeClasses.textSecondary} text-sm sm:text-base font-medium text-center`}>
              {language === 'hebrew' ? 'אין לך רשומות מדידות גוף' : "You don't have any Body Measurements Log"}
            </p>
          </div>
        ) : (
          (() => {
            const rechartsData = chartData
              .map((d) => ({ date: d.date, dateFull: d.dateFull, value: getMetricValue(d) }))
              .filter((d) => d.value != null);
            const yRange = getYAxisRange();
            const isRtl = language === 'hebrew';
            const chartMargin = isRtl
              ? { top: 10, right: 30, bottom: 5, left: 5 }
              : { top: 10, left: 30, right: 5, bottom: 5 };
            const axisEdgeStyle = isRtl ? { marginRight: -30 } : { marginLeft: -30 };
            return rechartsData.length > 0 ? (
              <div style={axisEdgeStyle} className="w-full">
                <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={rechartsData} margin={chartMargin}>
                  <defs>
                    <linearGradient id="gradWeight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0,0,0,0.05)'} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 600 }} reversed={isRtl} axisLine={false} tickLine={false} dy={10} />
                  <YAxis domain={[yRange.min, yRange.max]} tick={{ fontSize: 11, fill: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 600 }} orientation={isRtl ? 'right' : 'left'} axisLine={false} tickLine={false} dx={isRtl ? 10 : -10} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }}
                    formatter={(value) => [
                      (selectedMetric === 'weight' || selectedMetric === 'body_fat' ? Number(value).toFixed(1) : Math.round(value)) + ' ' + getMetricUnit(),
                      getMetricLabel()
                    ]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.dateFull ? formatDateFull(payload[0].payload.dateFull) : _}
                  />
                  <Area type="monotone" dataKey="value" name={getMetricLabel()} stroke="#10b981" fill="url(#gradWeight)" strokeWidth={3} animationDuration={1000} animationEasing="ease-out" />
                </AreaChart>
              </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-12 text-center text-gray-400 font-medium">No data for selected metric</p>
            );
          })()
        )}
      </div>
      )}

      {/* Add Measurement Modal */}
      <AnimatePresence>
        {showAddMeasurementModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" dir={language === 'hebrew' ? 'rtl' : 'ltr'}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !saving && setShowAddMeasurementModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className={`${themeClasses.bgCard} rounded-[2rem] p-8 max-w-md w-full mx-4 shadow-2xl relative z-10 border ${isDarkMode ? 'border-slate-700' : 'border-white'}`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={`${themeClasses.textPrimary} text-2xl font-extrabold tracking-tight`}>
                  {language === 'hebrew' ? 'הוסף מדידה' : 'Add Measurement'}
                </h3>
              </div>

              <div className="space-y-5">
                <div>
                  <label className={`block ${themeClasses.textSecondary} text-sm font-bold mb-2`}>{language === 'hebrew' ? 'סוג מדידה' : 'Measurement Type'}</label>
                  <select
                    value={measurementForm.measurementType}
                    onChange={(e) => setMeasurementForm(prev => ({ ...prev, measurementType: e.target.value, value: '' }))}
                    className={`w-full px-4 py-3.5 rounded-xl ${themeClasses.bgSecondary} ${themeClasses.textPrimary} border border-transparent focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all font-medium`}
                    disabled={saving}
                  >
                    <option value="weight">{language === 'hebrew' ? 'משקל (ק"ג)' : 'Weight (kg)'}</option>
                    <option value="body_fat">{language === 'hebrew' ? 'אחוז שומן (%)' : 'Body Fat (%)'}</option>
                    <option value="waist">{language === 'hebrew' ? 'היקף מותניים (ס"מ)' : 'Waist (cm)'}</option>
                    <option value="hip">{language === 'hebrew' ? 'היקף ירכיים (ס"מ)' : 'Hip (cm)'}</option>
                    <option value="arm">{language === 'hebrew' ? 'היקף זרוע (ס"מ)' : 'Arm (cm)'}</option>
                    <option value="neck">{language === 'hebrew' ? 'היקף צוואר (ס"מ)' : 'Neck (cm)'}</option>
                  </select>
                </div>

                <div>
                  <label className={`block ${themeClasses.textSecondary} text-sm font-bold mb-2`}>{language === 'hebrew' ? 'ערך' : 'Value'}</label>
                  <input
                    type="number"
                    step={measurementForm.measurementType === 'weight' || measurementForm.measurementType === 'body_fat' ? '0.1' : '0.1'}
                    value={measurementForm.value}
                    onChange={(e) => setMeasurementForm(prev => ({ ...prev, value: e.target.value }))}
                    className={`w-full px-4 py-3.5 rounded-xl ${themeClasses.bgSecondary} ${themeClasses.textPrimary} border border-transparent focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all font-medium`}
                    placeholder={language === 'hebrew' ? 'הכנס ערך' : 'Enter value'}
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className={`block ${themeClasses.textSecondary} text-sm font-bold mb-2`}>{language === 'hebrew' ? 'תאריך' : 'Date'}</label>
                  <input
                    type="date"
                    value={measurementForm.date}
                    onChange={(e) => setMeasurementForm(prev => ({ ...prev, date: e.target.value }))}
                    className={`w-full px-4 py-3.5 rounded-xl ${themeClasses.bgSecondary} ${themeClasses.textPrimary} border border-transparent focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all font-medium`}
                    disabled={saving}
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => !saving && setShowAddMeasurementModal(false)}
                    disabled={saving}
                    className={`flex-1 px-4 py-3.5 rounded-xl font-bold transition-all border ${themeClasses.bgSecondary} ${themeClasses.textPrimary} ${isDarkMode ? 'border-slate-700' : 'border-slate-200'} ${saving ? 'opacity-50' : ''}`}
                  >
                    {language === 'hebrew' ? 'ביטול' : 'Cancel'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={handleAddMeasurement}
                    disabled={saving || !measurementForm.value || !measurementForm.date}
                    className={`flex-1 px-4 py-3.5 rounded-xl font-bold transition-all bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 ${saving || !measurementForm.value || !measurementForm.date ? 'opacity-50 grayscale' : ''}`}
                  >
                    {saving ? (language === 'hebrew' ? 'שומר...' : 'Saving...') : (language === 'hebrew' ? 'שמור' : 'Save')}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Food Log Progress Component
export const FoodLogProgressComponent = ({ userCode, themeClasses, language, isDarkMode, onAddLog }) => {
  const [foodLogs, setFoodLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState('calories'); // 'calories', 'protein', 'carbs', 'fat'
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [timePeriod, setTimePeriod] = useState('all'); // '1m', '3m', '6m', 'all'
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showAverage, setShowAverage] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const loadFoodLogs = async () => {
      if (!userCode) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await getFoodLogs(userCode); 
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

  useEffect(() => {
    const checkOrientation = () => {
      const width = window.innerWidth || window.screen.width;
      const height = window.innerHeight || window.screen.height;
      const isMobileDevice = width < 768 || height < 768;
      setIsMobile(isMobileDevice);
      const isPortraitMode = height > width;
      setIsLandscape(isMobileDevice && isPortraitMode);
    };

    checkOrientation();
    const handleResize = () => setTimeout(checkOrientation, 100);
    const handleOrientationChange = () => setTimeout(checkOrientation, 200);
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(orientation: portrait)');
      const handleMediaChange = () => setTimeout(checkOrientation, 100);
      if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', handleMediaChange);
      else if (mediaQuery.addListener) mediaQuery.addListener(handleMediaChange);
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  useEffect(() => {
    setHoveredPoint(null);
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 400);
    return () => clearTimeout(timer);
  }, [timePeriod, selectedMetric]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return language === 'hebrew' 
      ? date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDateFull = (dateString) => {
    const date = new Date(dateString);
    return language === 'hebrew'
      ? date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
      : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const aggregateByDate = (logs) => {
    const dailyTotals = {};
    logs.forEach(log => {
      const date = log.log_date;
      if (!date) return;
      if (!dailyTotals[date]) dailyTotals[date] = { date, calories: 0, protein: 0, carbs: 0, fat: 0 };
      
      const foodItems = parseFoodItems(log);
      foodItems.forEach(item => {
        dailyTotals[date].calories += item.cals || 0;
        dailyTotals[date].protein += item.p || 0;
        dailyTotals[date].carbs += item.c || 0;
        dailyTotals[date].fat += item.f || 0;
      });
      
      if (log.total_calories) dailyTotals[date].calories += log.total_calories;
      if (log.total_protein_g) dailyTotals[date].protein += log.total_protein_g;
      if (log.total_carbs_g) dailyTotals[date].carbs += log.total_carbs_g;
      if (log.total_fat_g) dailyTotals[date].fat += log.total_fat_g;
    });
    return Object.values(dailyTotals).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const getChartData = () => {
    if (!foodLogs || foodLogs.length === 0) return [];
    const aggregated = aggregateByDate(foodLogs);
    let filteredData = [...aggregated];

    if (timePeriod !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      switch (timePeriod) {
        case '1m': cutoffDate.setMonth(now.getMonth() - 1); break;
        case '3m': cutoffDate.setMonth(now.getMonth() - 3); break;
        case '6m': cutoffDate.setMonth(now.getMonth() - 6); break;
        default: break;
      }
      filteredData = aggregated.filter(d => new Date(d.date) >= cutoffDate);
    }
    return filteredData.map(d => ({ date: formatDate(d.date), dateFull: d.date, calories: d.calories, protein: d.protein, carbs: d.carbs, fat: d.fat }));
  };

  const chartData = getChartData();
  const isRtl = language === 'hebrew';
  const getChartX = (index, total) => {
    if (!total || total <= 1) return 50;
    const ratio = index / (total - 1);
    return isRtl ? 760 - ratio * 710 : 50 + ratio * 710;
  };

  const getMetricValue = (d) => {
    switch(selectedMetric) {
      case 'calories': return d.calories;
      case 'protein': return d.protein;
      case 'carbs': return d.carbs;
      case 'fat': return d.fat;
      default: return d.calories;
    }
  };

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

  const getCurrentValue = () => {
    if (chartData.length === 0) return null;
    return getMetricValue(chartData[chartData.length - 1]);
  };

  const getMetricUnit = () => {
    switch(selectedMetric) {
      case 'calories': return 'kcal';
      case 'protein': case 'carbs': case 'fat': return 'g';
      default: return 'kcal';
    }
  };

  const getMetricLabel = () => {
    switch(selectedMetric) {
      case 'calories': return language === 'hebrew' ? 'קלוריות' : 'Calories';
      case 'protein': return language === 'hebrew' ? 'חלבון' : 'Protein';
      case 'carbs': return language === 'hebrew' ? 'פחמימות' : 'Carbs';
      case 'fat': return language === 'hebrew' ? 'שומן' : 'Fat';
      default: return language === 'hebrew' ? 'קלוריות' : 'Calories';
    }
  };

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

  const getAverageValue = () => {
    if (chartData.length === 0) return null;
    const values = chartData.map(d => getMetricValue(d)).filter(v => v != null && v > 0);
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  const averageValue = getAverageValue();

  const handlePointMouseEnter = (d, index, value, x, y) => setHoveredPoint({ index, data: d, value, x, y });
  const handlePointMouseLeave = () => setHoveredPoint(null);

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
    const chartStartX = 50;
    const chartWidth = 710;
    const chartEndX = chartStartX + chartWidth;
    if (mouseX < chartStartX || mouseX > chartEndX) {
      setHoveredPoint(null);
      return;
    }
    let closestIndex = 0;
    let minDistance = Infinity;
    const n = chartData.length;
    chartData.forEach((d, index) => {
      const value = getMetricValue(d);
      if (value == null || value <= 0) return;
      const x = getChartX(index, n);
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
    const x = getChartX(closestIndex, n);
    const y = 180 - (ratio * 160);
    setHoveredPoint({ index: closestIndex, data: closestData, value: closestValue, x, y });
  };

  const handleChartMouseLeave = () => setHoveredPoint(null);

  if (loading) {
    return (
      <div className={`${themeClasses.bgCard} backdrop-blur-xl bg-opacity-70 dark:bg-opacity-70 rounded-[2rem] p-6 mb-6 shadow-xl border ${isDarkMode ? 'border-slate-700/50' : 'border-white'} animate-pulse`}>
        <div className="h-48 bg-gray-500/20 rounded-xl"></div>
      </div>
    );
  }

  const hasData = chartData.length > 0;

  return (
    <div className={`${themeClasses.bgCard} backdrop-blur-md bg-opacity-80 dark:bg-opacity-80 rounded-[2rem] p-4 sm:p-6 mb-6 shadow-xl border ${isDarkMode ? 'border-slate-700/50' : 'border-white/50'}`}>
      {isMobile && (
        <div className={`${themeClasses.bgSecondary} rounded-xl p-3 mb-5 border border-emerald-500/20`}>
          <div className="flex items-start gap-2">
            <span className="text-lg">💻</span>
            <p className={`${themeClasses.textSecondary} text-xs sm:text-sm flex-1 font-medium`}>
              {language === 'hebrew' 
                ? 'לצפייה טובה יותר, פתח את האתר במחשב' 
                : 'For better viewing, open the website on a computer'}
            </p>
          </div>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-5 gap-4">
        <div className="flex-1 min-w-0">
          <h3 className={`${themeClasses.textPrimary} text-xl sm:text-2xl font-extrabold tracking-tight`}>
            {language === 'hebrew' ? 'מעקב תזונה' : 'Nutrition Tracking'}
          </h3>
          <div className="flex flex-wrap gap-2 sm:gap-4 mt-2">
            {currentValue != null && (
              <p className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium`}>
                {language === 'hebrew' ? 'ערך נוכחי: ' : 'Current: '}
                <span className="font-bold text-emerald-500">
                  {Math.round(currentValue)} {getMetricUnit()}
                </span>
              </p>
            )}
            {averageValue != null && (
              <p className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium`}>
                {language === 'hebrew' ? 'ממוצע: ' : 'Average: '}
                <span className="font-bold text-blue-500">
                  {Math.round(averageValue)} {getMetricUnit()}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {[
          { key: '1m', label: language === 'hebrew' ? 'חודש 1' : '1 Month' },
          { key: '3m', label: language === 'hebrew' ? '3 חודשים' : '3 Months' },
          { key: '6m', label: language === 'hebrew' ? '6 חודשים' : '6 Months' },
          { key: 'all', label: language === 'hebrew' ? 'כל הזמן' : 'All Time' }
        ].map(period => (
          <button
            key={period.key}
            onClick={() => setTimePeriod(period.key)}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              timePeriod === period.key
                ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-md'
                : `${themeClasses.bgSecondary} ${themeClasses.textSecondary} hover:bg-slate-200 dark:hover:bg-slate-700`
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { key: 'calories', label: language === 'hebrew' ? 'קלוריות' : 'Calories', color: '#10b981' },
          { key: 'protein', label: language === 'hebrew' ? 'חלבון' : 'Protein', color: '#a855f7' },
          { key: 'carbs', label: language === 'hebrew' ? 'פחמימות' : 'Carbs', color: '#3b82f6' },
          { key: 'fat', label: language === 'hebrew' ? 'שומן' : 'Fat', color: '#f59e0b' }
        ].map(metric => (
          <button
            key={metric.key}
            onClick={() => setSelectedMetric(metric.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
              selectedMetric === metric.key
                ? 'text-white shadow-md'
                : `${themeClasses.bgSecondary} ${themeClasses.textSecondary} border border-transparent hover:border-slate-300 dark:hover:border-slate-600`
            }`}
            style={selectedMetric === metric.key ? { backgroundColor: metric.color, boxShadow: `0 4px 14px ${metric.color}40` } : {}}
          >
            {metric.label}
          </button>
        ))}
      </div>

      {isLandscape && (
        <div className={`${themeClasses.bgCard} rounded-2xl p-8 mb-6 border-2 border-emerald-500/50 shadow-xl`} style={{ minHeight: '200px' }}>
          <div className="flex flex-col items-center justify-center text-center h-full">
            <div className="text-6xl mb-4 animate-bounce">📱</div>
            <h3 className={`${themeClasses.textPrimary} text-xl sm:text-2xl font-bold mb-3`}>
              {language === 'hebrew' ? 'סובב את הטלפון' : 'Rotate Your Phone'}
            </h3>
            <p className={`${themeClasses.textSecondary} text-base sm:text-lg max-w-md`}>
              {language === 'hebrew' 
                ? 'אנא סובב את הטלפון שלך למצב אופקי (Landscape) כדי לראות את הגרף' 
                : 'Please rotate your phone to landscape mode (horizontal) to view the chart'}
            </p>
          </div>
        </div>
      )}

      {!isLandscape && (
      <div className={`rounded-2xl border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200'} ${themeClasses.bgCard} p-4 shadow-sm overflow-visible`}>
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-4xl mb-4 opacity-50">📊</div>
            <p className={`${themeClasses.textSecondary} text-sm sm:text-base font-medium text-center mb-6`}>
              {language === 'hebrew' ? 'אין לך רשומות יומן תזונה' : "You don't have any Food Log entries"}
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => { if (onAddLog) onAddLog(); }}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/30"
            >
              {language === 'hebrew' ? 'הוסף יומן תזונה' : 'Add Food Log'}
            </motion.button>
          </div>
        ) : (
          (() => {
            const rechartsData = chartData
              .map((d) => ({ date: d.date, dateFull: d.dateFull, value: getMetricValue(d) }))
              .filter((d) => d.value != null && d.value > 0);
            const yRange = getYAxisRange();
            const isRtl = language === 'hebrew';
            const chartMargin = isRtl
              ? { top: 10, right: 30, bottom: 5, left: 5 }
              : { top: 10, left: 30, right: 5, bottom: 5 };
            const axisEdgeStyle = isRtl ? { marginRight: -30 } : { marginLeft: -30 };
            return rechartsData.length > 0 ? (
              <div style={axisEdgeStyle} className="w-full">
                <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={rechartsData} margin={chartMargin}>
                  <defs>
                    <linearGradient id="gradNutrition" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={metricColor} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={metricColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0,0,0,0.05)'} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 600 }} reversed={isRtl} axisLine={false} tickLine={false} dy={10} />
                  <YAxis domain={[yRange.min, yRange.max]} tick={{ fontSize: 11, fill: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 600 }} orientation={isRtl ? 'right' : 'left'} axisLine={false} tickLine={false} dx={isRtl ? 10 : -10} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }}
                    formatter={(value) => [Math.round(value) + ' ' + getMetricUnit(), getMetricLabel()]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.dateFull ? formatDateFull(payload[0].payload.dateFull) : _}
                  />
                  <Area type="monotone" dataKey="value" name={getMetricLabel()} stroke={metricColor} fill="url(#gradNutrition)" strokeWidth={3} animationDuration={1000} animationEasing="ease-out" />
                </AreaChart>
              </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-12 text-center text-gray-400 font-medium">No data for selected metric</p>
            );
          })()
        )}
      </div>
      )}
    </div>
  );
};

// Weekly Meal Schedule Component
export const WeeklyMealSchedule = ({ allPlans, selectedDay, onDaySelect, language, themeClasses }) => {
  const days = language === 'hebrew' 
    ? ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'ש\''] 
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const segmentPalette = [
    { base: 'border-emerald-400/70 bg-emerald-100/90 text-emerald-900 hover:bg-emerald-200/90 dark:border-emerald-500/40 dark:bg-emerald-950/45 dark:text-emerald-100 dark:hover:bg-emerald-900/55', sel: 'border-emerald-500 bg-emerald-500 text-white shadow-md ring-2 ring-emerald-400/40 dark:bg-emerald-500 dark:ring-emerald-400/30' },
    { base: 'border-sky-400/70 bg-sky-100/90 text-sky-900 hover:bg-sky-200/90 dark:border-sky-500/40 dark:bg-sky-950/45 dark:text-sky-100 dark:hover:bg-sky-900/55', sel: 'border-sky-500 bg-sky-500 text-white shadow-md ring-2 ring-sky-400/40 dark:bg-sky-500 dark:ring-sky-400/30' },
    { base: 'border-violet-400/70 bg-violet-100/90 text-violet-900 hover:bg-violet-200/90 dark:border-violet-500/40 dark:bg-violet-950/45 dark:text-violet-100 dark:hover:bg-violet-900/55', sel: 'border-violet-500 bg-violet-500 text-white shadow-md ring-2 ring-violet-400/40 dark:bg-violet-500 dark:ring-violet-400/30' },
    { base: 'border-amber-400/70 bg-amber-100/90 text-amber-900 hover:bg-amber-200/90 dark:border-amber-500/40 dark:bg-amber-950/45 dark:text-amber-100 dark:hover:bg-amber-900/55', sel: 'border-amber-500 bg-amber-500 text-white shadow-md ring-2 ring-amber-400/40 dark:bg-amber-500 dark:ring-amber-400/30' },
    { base: 'border-rose-400/70 bg-rose-100/90 text-rose-900 hover:bg-rose-200/90 dark:border-rose-500/40 dark:bg-rose-950/45 dark:text-rose-100 dark:hover:bg-rose-900/55', sel: 'border-rose-500 bg-rose-500 text-white shadow-md ring-2 ring-rose-400/40 dark:bg-rose-500 dark:ring-rose-400/30' },
  ];

  const getDayPlan = (dayIndex) => {
    if (!allPlans || !Array.isArray(allPlans)) return null;
    return allPlans.find(plan => {
      if (plan.active_days === null) return true;
      const activeDays = Array.isArray(plan.active_days) ? plan.active_days.map(day => typeof day === 'string' ? parseInt(day, 10) : day) : [];
      return activeDays.includes(dayIndex);
    }) ?? null;
  };

  const planGroups = (() => {
    if (!allPlans || !Array.isArray(allPlans)) return [];
    const byId = new Map();
    for (const plan of allPlans) if (plan && plan.id != null) byId.set(plan.id, { plan, dayIndices: [] });
    for (let d = 0; d < 7; d++) {
      const p = getDayPlan(d);
      if (p && byId.has(p.id)) byId.get(p.id).dayIndices.push(d);
    }
    return allPlans.map(p => (p && p.id != null ? byId.get(p.id) : null)).filter(g => g && g.dayIndices.length > 0);
  })();

  const planColorIndex = (plan) => {
    if (!plan || plan.id == null) return 0;
    const idx = planGroups.findIndex(g => g.plan.id === plan.id);
    return idx >= 0 ? idx % segmentPalette.length : 0;
  };

  const weekSegments = (() => {
    const segments = [];
    for (let d = 0; d < 7; d++) {
      const plan = getDayPlan(d);
      const key = plan?.id ?? `__empty_${d}`;
      const last = segments[segments.length - 1];
      if (last && last.key === key) {
        last.dayIndices.push(d);
      } else {
        segments.push({ key, plan, dayIndices: [d] });
      }
    }
    return segments;
  })();

  const formatSegmentLabel = (dayIndices) => {
    if (dayIndices.length === 1) return days[dayIndices[0]];
    const a = days[dayIndices[0]];
    const b = days[dayIndices[dayIndices.length - 1]];
    return `${a}\u2009–\u2009${b}`;
  };

  const planCount = planGroups.length;
  const countLabel = language === 'hebrew' ? (planCount === 1 ? 'תוכנית תזונה אחת' : `${planCount} תוכניות תזונה`) : (planCount === 1 ? '1 meal plan' : `${planCount} meal plans`);
  const defaultPlanTitle = (idx) => language === 'hebrew' ? `תפריט ${idx + 1}` : `Meal plan ${idx + 1}`;

  return (
    <div className={`mt-4 mb-6 p-4 rounded-2xl border ${themeClasses.borderPrimary} ${themeClasses.bgCard} shadow-sm backdrop-blur-md bg-opacity-80`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 mb-4">
        <h4 className={`${themeClasses.textPrimary} font-extrabold text-sm uppercase tracking-wider`}>
          {language === 'hebrew' ? 'בחר יום לצפייה בתפריט:' : 'Select Day to View Meal Plan:'}
        </h4>
        <span className={`inline-flex items-center self-start rounded-full px-3 py-1 text-xs font-bold ${themeClasses.bgSecondary} ${themeClasses.textSecondary} shadow-sm`}>
          {countLabel}
        </span>
      </div>

      <div className="overflow-x-auto pb-1" dir={language === 'hebrew' ? 'rtl' : 'ltr'}>
        <div className="flex min-w-min flex-nowrap items-stretch gap-2">
          {weekSegments.map((seg, segIdx) => {
            const hasPlan = seg.plan != null;
            const isSelected = hasPlan && seg.dayIndices.some((i) => i === selectedDay);
            const cIdx = hasPlan ? planColorIndex(seg.plan) : 0;
            const pal = segmentPalette[cIdx];
            const planIdxInList = hasPlan ? planGroups.findIndex((g) => g.plan.id === seg.plan.id) : -1;
            const planTitle = hasPlan && ((seg.plan.meal_plan_name && String(seg.plan.meal_plan_name).trim()) || defaultPlanTitle(planIdxInList >= 0 ? planIdxInList : 0));
            const label = formatSegmentLabel(seg.dayIndices);

            return (
              <motion.button
                whileHover={hasPlan ? { scale: 1.02 } : {}}
                whileTap={hasPlan ? { scale: 0.98 } : {}}
                key={`${seg.key}-${segIdx}`}
                type="button"
                disabled={!hasPlan}
                title={hasPlan ? planTitle : undefined}
                onClick={() => hasPlan && onDaySelect(seg.dayIndices[0])}
                className={`flex min-h-[3rem] min-w-0 flex-1 items-center justify-center rounded-xl border-2 px-3 py-2 text-center transition-all sm:min-w-[4.5rem] sm:px-4 ${
                  !hasPlan
                    ? `cursor-not-allowed opacity-40 ${themeClasses.bgSecondary} border-transparent`
                    : isSelected
                    ? pal.sel
                    : pal.base
                }`}
              >
                <span className={`text-xs font-bold leading-none sm:text-sm ${!hasPlan ? themeClasses.textMuted : ''}`}>
                  {label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
};



// Calendar Picker Component - Compact Design
export const CalendarPicker = ({ selectedDate, onDateSelect, themeClasses, isDarkMode, language, direction, clientRegion }) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = new Date(selectedDate);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  const sundayStartRegions = [
    'north_america', 'mexico', 'latam_south_america', 'japan', 'korea',
    'india_south_asia', 'indonesia_malaysia', 'southeast_asia', 'israel'
  ];
  const startFromSunday = clientRegion && sundayStartRegions.some(region => 
    region.toLowerCase() === clientRegion.toLowerCase()
  );

  const dayNames = startFromSunday
    ? (language === 'hebrew' 
        ? ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
        : ['S', 'M', 'T', 'W', 'T', 'F', 'S'])
    : (language === 'hebrew'
        ? ['ב', 'ג', 'ד', 'ה', 'ו', 'ש', 'א']
        : ['M', 'T', 'W', 'T', 'F', 'S', 'S']);

  const monthNames = language === 'hebrew'
    ? ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const navigateYear = (direction) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setFullYear(prev.getFullYear() - 1);
      } else {
        newDate.setFullYear(prev.getFullYear() + 1);
      }
      return newDate;
    });
  };

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    let startingDay = firstDay.getDay();
    if (!startFromSunday) {
      startingDay = startingDay === 0 ? 6 : startingDay - 1;
    }

    const days = [];
    for (let i = 0; i < startingDay; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(new Date(year, month, day));
    
    return days;
  };

  const days = getDaysInMonth();
  const today = new Date();
  const selectedDateObj = new Date(selectedDate);

  return (
    <div className="w-full max-w-sm mx-auto p-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigateYear('prev')} className={`w-8 h-8 ${themeClasses.bgSecondary} hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors`}>
            <svg className={`w-3.5 h-3.5 ${themeClasses.textPrimary} ${direction === 'rtl' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigateMonth('prev')} className={`w-8 h-8 ${themeClasses.bgSecondary} hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors`}>
            <svg className={`w-4 h-4 ${themeClasses.textPrimary} ${direction === 'rtl' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </motion.button>
        </div>
        
        <div className={`${themeClasses.textPrimary} font-extrabold text-sm sm:text-base tracking-wide px-2`}>
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </div>
        
        <div className="flex gap-1">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigateMonth('next')} className={`w-8 h-8 ${themeClasses.bgSecondary} hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors`}>
            <svg className={`w-4 h-4 ${themeClasses.textPrimary} ${direction === 'rtl' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigateYear('next')} className={`w-8 h-8 ${themeClasses.bgSecondary} hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors`}>
            <svg className={`w-3.5 h-3.5 ${themeClasses.textPrimary} ${direction === 'rtl' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((dayName, index) => (
          <div key={index} className={`${themeClasses.textSecondary} text-xs font-bold text-center py-1 opacity-70 uppercase tracking-wider`}>
            {dayName}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} className="aspect-square" />;
          const dayDate = day.toISOString().split('T')[0];
          const isToday = day.toDateString() === today.toDateString();
          const isSelected = day.toDateString() === selectedDateObj.toDateString();
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();

          return (
            <motion.button
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              key={dayDate}
              onClick={() => onDateSelect(dayDate)}
              className={`aspect-square rounded-xl transition-all font-semibold text-sm ${
                isSelected
                  ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/40 border-none'
                  : isToday
                  ? `${themeClasses.bgSecondary} border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400`
                  : isCurrentMonth
                  ? `${themeClasses.bgCard} hover:${themeClasses.bgSecondary} ${themeClasses.textPrimary} border border-transparent hover:border-slate-300 dark:hover:border-slate-600 shadow-sm`
                  : `${themeClasses.bgCard} ${themeClasses.textMuted} opacity-30`
              }`}
            >
              {day.getDate()}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

// Weekly Summary Component
export const WeeklySummaryComponent = ({ userCode, themeClasses, language, isDarkMode, settings, clientRegion, direction, selectedDate, setSelectedDate, onDateClick }) => {
  const [weekFoodLogs, setWeekFoodLogs] = useState({});
  const [loading, setLoading] = useState(true);
  const [mealPlanTargets, setMealPlanTargets] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [weekStartDate, setWeekStartDate] = useState(() => {
    const date = new Date(selectedDate);
    const dayOfWeek = date.getDay();
    const sundayStartRegions = [
      'north_america', 'mexico', 'latam_south_america', 'japan', 'korea',
      'india_south_asia', 'indonesia_malaysia', 'southeast_asia', 'israel'
    ];
    const startFromSunday = clientRegion && sundayStartRegions.some(region => 
      region.toLowerCase() === clientRegion.toLowerCase()
    );
    const startOfWeek = new Date(date);
    if (startFromSunday) {
      startOfWeek.setDate(date.getDate() - dayOfWeek);
    } else {
      startOfWeek.setDate(date.getDate() - dayOfWeek + 1);
    }
    return startOfWeek.toISOString().split('T')[0];
  });

  const generateWeekDates = (startDate) => {
    const date = new Date(startDate);
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(date);
      currentDate.setDate(date.getDate() + i);
      weekDates.push(currentDate.toISOString().split('T')[0]);
    }
    return weekDates;
  };

  const weekDates = generateWeekDates(weekStartDate);

  useEffect(() => {
    const date = new Date(selectedDate);
    const dayOfWeek = date.getDay();
    const sundayStartRegions = ['north_america', 'mexico', 'latam_south_america', 'japan', 'korea', 'india_south_asia', 'indonesia_malaysia', 'southeast_asia', 'israel'];
    const startFromSunday = clientRegion && sundayStartRegions.some(region => region.toLowerCase() === clientRegion.toLowerCase());
    const startOfWeek = new Date(date);
    if (startFromSunday) startOfWeek.setDate(date.getDate() - dayOfWeek);
    else startOfWeek.setDate(date.getDate() - dayOfWeek + 1);
    
    const newWeekStart = startOfWeek.toISOString().split('T')[0];
    setWeekStartDate(prev => prev !== newWeekStart ? newWeekStart : prev);
  }, [selectedDate, clientRegion]);

  const navigateWeek = (direction) => {
    const currentDate = new Date(weekStartDate);
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    setWeekStartDate(newDate.toISOString().split('T')[0]);
  };

  useEffect(() => {
    const loadMealPlanTargets = async () => {
      if (!userCode) return;
      try {
        const { data: mealPlanData, error } = await getClientMealPlan(userCode);
        if (!error && mealPlanData) {
          let targets = { calories: mealPlanData.daily_total_calories || 2000, protein: 150, carbs: 250, fat: 65 };
          if (mealPlanData.macros_target) {
            const toGramNum = (val) => {
              if (val === null || val === undefined) return 0;
              if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
              const m = String(val).match(/[\d.]+/);
              return m ? parseFloat(m[0]) : 0;
            };
            const proteinNum = toGramNum(mealPlanData.macros_target.protein);
            const carbsNum   = toGramNum(mealPlanData.macros_target.carbs);
            const fatNum     = toGramNum(mealPlanData.macros_target.fat);
            targets = {
              calories: Number(mealPlanData.daily_total_calories) || 2000,
              protein: proteinNum > 0 ? proteinNum : 150,
              carbs:   carbsNum   > 0 ? carbsNum   : 250,
              fat:     fatNum     > 0 ? fatNum     : 65,
            };
          }
          setMealPlanTargets(targets);
        }
      } catch (err) {
        console.error('Error loading meal plan targets:', err);
      }
    };
    loadMealPlanTargets();
  }, [userCode]);

  useEffect(() => {
    const loadWeekFoodLogs = async () => {
      if (!userCode) return setLoading(false);
      try {
        setLoading(true);
        const logsByDate = {};
        const logPromises = weekDates.map(async (date) => {
          const { data, error } = await getFoodLogs(userCode, date);
          logsByDate[date] = (!error && data) ? data : [];
        });
        await Promise.all(logPromises);
        setWeekFoodLogs(logsByDate);
      } catch (err) {
        console.error('Error loading week food logs:', err);
      } finally {
        setLoading(false);
      }
    };
    loadWeekFoodLogs();
  }, [userCode, weekStartDate]);

  const calculateDayTotals = (date) => {
    const logs = weekFoodLogs[date] || [];
    let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
    logs.forEach((log) => {
      const foodItems = parseFoodItems(log);
      const logCaloriesFromItems = foodItems.reduce((sum, item) => sum + (item.cals || 0), 0);
      const logProteinFromItems = foodItems.reduce((sum, item) => sum + (item.p || 0), 0);
      const logCarbsFromItems = foodItems.reduce((sum, item) => sum + (item.c || 0), 0);
      const logFatFromItems = foodItems.reduce((sum, item) => sum + (item.f || 0), 0);
      totalCalories += logCaloriesFromItems > 0 ? logCaloriesFromItems : (log.total_calories || 0);
      totalProtein += logProteinFromItems > 0 ? logProteinFromItems : (log.total_protein_g || 0);
      totalCarbs += logCarbsFromItems > 0 ? logCarbsFromItems : (log.total_carbs_g || 0);
      totalFat += logFatFromItems > 0 ? logFatFromItems : (log.total_fat_g || 0);
    });
    return { totalCalories, totalProtein, totalCarbs, totalFat };
  };

  const formatNumber = (num) => {
    const number = typeof num === 'number' ? num : parseFloat(num);
    if (isNaN(number) || number === null || number === undefined) return '0';
    if (settings.decimalPlaces === 0) return Math.round(number).toString();
    return number.toFixed(settings.decimalPlaces);
  };

  const convertWeight = (grams) => {
    const number = typeof grams === 'number' ? grams : parseFloat(grams);
    if (isNaN(number) || number === null || number === undefined) return 0;
    return settings.weightUnit === 'ounces' ? number * 0.035274 : number;
  };

  const formatWeight = (grams) => {
    const value = convertWeight(grams);
    const unit = settings.weightUnit === 'ounces' ? 'oz' : 'g';
    return `${formatNumber(value)}${unit}`;
  };

  const dayNames = language === 'hebrew' 
    ? ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'יום שבת']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const monthNames = language === 'hebrew'
    ? ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const dailyGoals = mealPlanTargets || { calories: 2000, protein: 150, carbs: 250, fat: 65 };

  const DaySummarySVG = ({ date, totals }) => {
    const caloriesPercent = Math.round((totals.totalCalories / dailyGoals.calories) * 100);
    const proteinPercent = Math.round((totals.totalProtein / dailyGoals.protein) * 100);
    const carbsPercent = Math.round((totals.totalCarbs / dailyGoals.carbs) * 100);
    const fatPercent = Math.round((totals.totalFat / dailyGoals.fat) * 100);

    const outerRadius = 45;
    const innerRadius = 35;
    const outerCircumference = 2 * Math.PI * outerRadius;
    const circumference = 2 * Math.PI * innerRadius;
    const segmentLength = circumference / 3;

    const caloriesNormalLength = Math.min(caloriesPercent, 100) / 100 * outerCircumference;
    const proteinNormalLength = Math.min(proteinPercent, 100) / 100 * segmentLength;
    const carbsNormalLength = Math.min(carbsPercent, 100) / 100 * segmentLength;
    const fatNormalLength = Math.min(fatPercent, 100) / 100 * segmentLength;

    const dateObj = new Date(date);
    const dayName = dayNames[dateObj.getDay()];
    const dayNumber = dateObj.getDate();
    const monthName = monthNames[dateObj.getMonth()];

    return (
      <motion.div 
        whileHover={{ scale: 1.02, y: -5 }} whileTap={{ scale: 0.98 }}
        className={`${themeClasses.bgCard} backdrop-blur-md bg-opacity-80 dark:bg-opacity-80 rounded-2xl sm:rounded-3xl p-4 border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200'} hover:border-emerald-500/50 hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden relative group`}
        onClick={() => { setSelectedDate(date); if (onDateClick) onDateClick(); }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="text-center mb-3 relative z-10">
          <div className={`${themeClasses.textSecondary} text-xs font-bold uppercase tracking-wider mb-1`}>{dayName}</div>
          <div className={`${themeClasses.textPrimary} text-xl sm:text-2xl font-extrabold`}>{dayNumber}</div>
          <div className={`${themeClasses.textMuted} text-xs font-medium`}>{monthName}</div>
        </div>
        
        <div className="flex justify-center mb-4 relative z-10">
          <svg className="transform -rotate-90 w-28 h-28 sm:w-32 sm:h-32 drop-shadow-md" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={outerRadius} fill="none" stroke={isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'} strokeWidth="5" />
            <circle cx="60" cy="60" r={innerRadius} fill="none" stroke={isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'} strokeWidth="5" />
            
            {settings.showCalories && caloriesNormalLength > 0 && (
              <motion.circle
                cx="60" cy="60" r={outerRadius} fill="none" stroke="#10b981" strokeWidth="5" strokeLinecap="round"
                initial={{ strokeDasharray: `0 ${outerCircumference}` }}
                animate={{ strokeDasharray: `${caloriesNormalLength} ${outerCircumference}` }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
            
            {settings.showMacros && (
              <>
                {proteinNormalLength > 0 && (
                  <motion.circle cx="60" cy="60" r={innerRadius} fill="none" stroke="#a855f7" strokeWidth="5" strokeLinecap="round" strokeDashoffset="0"
                    initial={{ strokeDasharray: `0 ${circumference}` }} animate={{ strokeDasharray: `${proteinNormalLength} ${circumference}` }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
                {carbsNormalLength > 0 && (
                  <motion.circle cx="60" cy="60" r={innerRadius} fill="none" stroke="#3b82f6" strokeWidth="5" strokeLinecap="round" strokeDashoffset={-segmentLength}
                    initial={{ strokeDasharray: `0 ${circumference}` }} animate={{ strokeDasharray: `${carbsNormalLength} ${circumference}` }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
                {fatNormalLength > 0 && (
                  <motion.circle cx="60" cy="60" r={innerRadius} fill="none" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round" strokeDashoffset={-segmentLength * 2}
                    initial={{ strokeDasharray: `0 ${circumference}` }} animate={{ strokeDasharray: `${fatNormalLength} ${circumference}` }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
              </>
            )}
          </svg>
        </div>

        <div className="text-center mb-3 relative z-10">
          <div className={`${themeClasses.textPrimary} text-xl sm:text-2xl font-extrabold tracking-tight`}>{totals.totalCalories.toLocaleString()}</div>
          <div className={`${themeClasses.textMuted} text-xs font-semibold uppercase tracking-wider`}>{language === 'hebrew' ? 'קלוריות' : 'calories'}</div>
        </div>

        {settings.showMacros && (
          <div className="flex flex-col gap-1.5 text-xs relative z-10 bg-black/5 dark:bg-white/5 rounded-xl p-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)] flex-shrink-0"></div>
                <span className={`${themeClasses.textSecondary} text-[11px] font-bold`}>P</span>
              </div>
              <div className="text-purple-500 dark:text-purple-400 font-extrabold">{formatWeight(totals.totalProtein)}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.6)] flex-shrink-0"></div>
                <span className={`${themeClasses.textSecondary} text-[11px] font-bold`}>C</span>
              </div>
              <div className="text-blue-500 dark:text-blue-400 font-extrabold">{formatWeight(totals.totalCarbs)}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)] flex-shrink-0"></div>
                <span className={`${themeClasses.textSecondary} text-[11px] font-bold`}>F</span>
              </div>
              <div className="text-amber-500 dark:text-amber-400 font-extrabold">{formatWeight(totals.totalFat)}</div>
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          <p className={`${themeClasses.textSecondary} font-medium`}>{language === 'hebrew' ? 'טוען סיכום שבועי...' : 'Loading weekly summary...'}</p>
        </div>
      </div>
    );
  }

  const weekStartObj = new Date(weekStartDate);
  const weekEndObj = new Date(weekStartDate);
  weekEndObj.setDate(weekStartObj.getDate() + 6);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="animate-fadeIn">
      <div className={`mb-6 ${themeClasses.bgCard} backdrop-blur-xl bg-opacity-80 dark:bg-opacity-80 rounded-[2rem] p-4 sm:p-6 shadow-lg border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200'}`}>
        <div className="mb-4 sm:mb-6">
          <h2 className={`${themeClasses.textPrimary} text-2xl sm:text-3xl font-extrabold tracking-tight`}>
            {language === 'hebrew' ? 'סיכום שבועי' : 'Weekly Summary'}
          </h2>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-1 bg-black/5 dark:bg-white/5 rounded-2xl p-1.5 border border-black/5 dark:border-white/5">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => navigateWeek('prev')} className={`w-10 h-10 ${themeClasses.bgCard} rounded-xl shadow-sm flex items-center justify-center transition-all`}>
              <svg className={`w-5 h-5 ${themeClasses.textPrimary} ${direction === 'rtl' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            </motion.button>
            <div className={`${themeClasses.textPrimary} font-bold px-4 text-center min-w-[140px]`}>
              <div className="block sm:hidden tracking-wider">{weekStartObj.getDate()}/{weekStartObj.getMonth() + 1} - {weekEndObj.getDate()}/{weekEndObj.getMonth() + 1}</div>
              <div className="hidden sm:block tracking-wide">{weekStartObj.getDate()} {monthNames[weekStartObj.getMonth()]} - {weekEndObj.getDate()} {monthNames[weekEndObj.getMonth()]}</div>
            </div>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => navigateWeek('next')} className={`w-10 h-10 ${themeClasses.bgCard} rounded-xl shadow-sm flex items-center justify-center transition-all`}>
              <svg className={`w-5 h-5 ${themeClasses.textPrimary} ${direction === 'rtl' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
            </motion.button>
          </div>
          
          <div className="flex gap-3 w-full sm:w-auto">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowCalendar(!showCalendar)} className={`${showCalendar ? 'bg-emerald-600' : 'bg-slate-700 dark:bg-slate-600'} text-white font-bold py-3 px-5 rounded-xl shadow-md transition-colors flex-1 sm:flex-initial flex items-center justify-center gap-2`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span className="hidden sm:inline">{language === 'hebrew' ? 'לוח שנה' : 'Calendar'}</span>
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                const dayOfWeek = new Date(today).getDay();
                const sundayStartRegions = ['north_america', 'mexico', 'latam_south_america', 'japan', 'korea', 'india_south_asia', 'indonesia_malaysia', 'southeast_asia', 'israel'];
                const startFromSunday = clientRegion && sundayStartRegions.some(region => region.toLowerCase() === clientRegion.toLowerCase());
                const startOfWeek = new Date(today);
                if (startFromSunday) startOfWeek.setDate(new Date(today).getDate() - dayOfWeek);
                else startOfWeek.setDate(new Date(today).getDate() - dayOfWeek + 1);
                setWeekStartDate(startOfWeek.toISOString().split('T')[0]);
                setShowCalendar(false);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-xl shadow-md shadow-blue-600/20 flex-1 sm:flex-initial"
            >
              {language === 'hebrew' ? 'השבוע' : 'This Week'}
            </motion.button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showCalendar && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className={`mb-6 ${themeClasses.bgCard} rounded-3xl p-6 shadow-xl border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200'} overflow-hidden`}>
            <CalendarPicker selectedDate={weekStartDate} onDateSelect={(date) => {
                const dayOfWeek = new Date(date).getDay();
                const sundayStartRegions = ['north_america', 'mexico', 'latam_south_america', 'japan', 'korea', 'india_south_asia', 'indonesia_malaysia', 'southeast_asia', 'israel'];
                const startFromSunday = clientRegion && sundayStartRegions.some(region => region.toLowerCase() === clientRegion.toLowerCase());
                const startOfWeek = new Date(date);
                if (startFromSunday) startOfWeek.setDate(new Date(date).getDate() - dayOfWeek);
                else startOfWeek.setDate(new Date(date).getDate() - dayOfWeek + 1);
                setWeekStartDate(startOfWeek.toISOString().split('T')[0]);
                setShowCalendar(false);
              }} themeClasses={themeClasses} isDarkMode={isDarkMode} language={language} direction={direction} clientRegion={clientRegion} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {weekDates.map((date) => {
          const totals = calculateDayTotals(date);
          return <DaySummarySVG key={date} date={date} totals={totals} />;
        })}
      </div>
    </motion.div>
  );
};

export default ProfilePage;