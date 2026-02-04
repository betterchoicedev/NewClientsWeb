import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useStripe } from '../context/StripeContext';
import { useSettings } from '../context/SettingsContext';
import { supabase } from '../supabase/supabaseClient';
import { debugMealPlans, getFoodLogs, createFoodLog, updateFoodLog, deleteFoodLog, getChatMessages, createChatMessage, getCompaniesWithManagers, getClientCompanyAssignment, assignClientToCompany, getWeightLogs, createWeightLog } from '../supabase/secondaryClient';
import { normalizePhoneForDatabase, signOut } from '../supabase/auth';
import { getAllProducts, getProductsByCategory, getProduct } from '../config/stripe-products';
import PricingCard from '../components/PricingCard';
import OnboardingModal from '../components/OnboardingModal';
import AddIngredientModal from '../components/AddIngredientModal';
import IngredientPortionModal from '../components/IngredientPortionModal';
import { translateMenu } from '../services/translateService';

// Function to get training plan from training_plans table
const getTrainingPlan = async (userCode) => {
  try {
    const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb.onrender.com';
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
const getClientMealPlan = async (userCode) => {
  try {
    const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb.onrender.com';
    const response = await fetch(`${apiUrl}/api/profile/meal-plan?userCode=${encodeURIComponent(userCode)}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch meal plan');
    }

    const data = result.data;
    if (!data) {
      return { data: null, error: null };
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
      try {
        const clearResponse = await fetch(`${apiUrl}/api/profile/meal-plan/clear-edited`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: data.id })
        });

        if (!clearResponse.ok) {
          console.error('Error clearing old edited meal plan');
        } else {
          console.log('✅ Cleared old edited meal plan from database');
        }
      } catch (clearError) {
        console.error('Error clearing old edited meal plan:', clearError);
        // Continue anyway - we'll just use the original plan
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
        isClientEdited: hasEditedPlanFromToday,
        dietitian_id: data.dietitian_id
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
    medicalConditions: '',
    userCode: '',
    region: '',
    city: '',
    timezone: '',
    userLanguage: '',
    companyId: '',
    profileImageUrl: ''
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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isModalAnimating, setIsModalAnimating] = useState(false);
  const [showWhatsAppPopup, setShowWhatsAppPopup] = useState(false);
  const [isProfileDataReady, setIsProfileDataReady] = useState(false);

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
  const checkOnboardingStatus = useCallback(async () => {
    try {
      // First check if profile tour is completed
      const profileTourCompleted = localStorage.getItem('profileTourCompleted');
      
      // Don't show onboarding until profile tour is finished
      if (profileTourCompleted !== 'true') {
        console.log('⏸️ Onboarding delayed - waiting for profile tour to complete...');
        return;
      }

      if (!user) return;

      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb.onrender.com';
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
        // No profile data at all - show onboarding (but only after tour is done)
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

  // Show WhatsApp popup only after onboarding is completed
  useEffect(() => {
    if (!user) return;
    
    // Only show popup if:
    // 1. Onboarding is completed
    // 2. Profile tour is completed (required for onboarding to run)
    // 3. Popup hasn't been shown before
    if (onboardingCompleted) {
      const profileTourCompleted = localStorage.getItem('profileTourCompleted');
      const whatsappPopupShown = localStorage.getItem('whatsappPopupShown');
      
      if (profileTourCompleted === 'true' && whatsappPopupShown !== 'true') {
        setTimeout(() => {
          setShowWhatsAppPopup(true);
        }, 1000); // Show after 1 second delay
      }
    }
  }, [onboardingCompleted, user]);

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
      
      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb.onrender.com';
      
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
          companyId: prev.companyId || '',
          profileImageUrl: data?.profile_image_url || ''
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

      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb.onrender.com';
      
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
      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb.onrender.com';
      
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
    <>
      <style>{`
        @keyframes modalPopUp {
          0% {
            transform: scale(0.7) translateY(20px);
            opacity: 0;
          }
          50% {
            transform: scale(1.05) translateY(-5px);
            opacity: 0.9;
          }
          100% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes flicker {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
        @keyframes slideInFromButton {
          from {
            opacity: 0;
            transform: scale(0.8) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        @keyframes shake {
          0%, 100% {
            transform: translateX(0);
          }
          10%, 30%, 50%, 70%, 90% {
            transform: translateX(-4px);
          }
          20%, 40%, 60%, 80% {
            transform: translateX(4px);
          }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`flex flex-col items-center ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`}>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-teal-400/20 rounded-xl blur-md group-hover:blur-lg transition-all duration-300"></div>
                  <img src="/favicon.ico" alt="BetterChoice Logo" className="relative w-20 h-20 rounded-xl shadow-xl ring-2 ring-emerald-500/30 group-hover:ring-emerald-400/50 transition-all duration-300" />
                  <div className={`absolute -top-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse ${direction === 'rtl' ? '-left-1' : '-right-1'} shadow-lg shadow-emerald-500/50`} />
                </div>
                <a
                  href={language === 'hebrew' ? 'https://wa.me/message/B2LIFC7FLCCMN1' : 'https://wa.me/message/YH4IM5MWPY4HI1'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-3 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-br from-green-500 via-green-600 to-green-700 hover:from-green-600 hover:via-green-700 hover:to-green-800 text-white shadow-lg hover:shadow-xl hover:shadow-green-500/30 transition-all duration-300 hover:scale-105 active:scale-95 text-xs font-semibold min-w-[90px]`}
                  aria-label={language === 'hebrew' ? 'צור קשר ב-WhatsApp' : 'Contact us on WhatsApp'}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  <span className="whitespace-nowrap">{language === 'hebrew' ? 'ל-AI שלנו' : 'AI Chat'}</span>
                </a>
              </div>
              <div className={`${direction === 'rtl' ? 'text-right' : 'text-left'} -mt-8`}>
                <h1 className={`${themeClasses.textPrimary} text-2xl font-bold bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 bg-clip-text text-transparent leading-tight`}>BetterChoice</h1>
                <p className={`${themeClasses.textSecondary} text-sm mt-0.5 opacity-90`}>{t.profile.title}</p>
              </div>
            </div>
            
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
                data-tour={tab.id === 'profile' ? 'profile-tab' : tab.id === 'myPlan' ? 'myplan-tab' : tab.id === 'dailyLog' ? 'dailylog-tab' : tab.id === 'messages' ? 'messages-tab' : tab.id === 'pricing' ? 'pricing-tab' : null}
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
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
              {/* Language Control */}
              <div className="flex items-center justify-between">
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
                  <span className={`${themeClasses.textSecondary} text-sm ${direction === 'rtl' ? 'mr-4' : 'ml-4'}`}>{language === 'hebrew' ? 'שפה' : 'Language'}</span>
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
                  <span className={`${themeClasses.textSecondary} text-sm ${direction === 'rtl' ? 'mr-4' : 'ml-4'}`}>{language === 'hebrew' ? 'ערכת נושא' : 'Theme'}</span>
                </div>
              </div>

              {/* Settings and Logout Controls */}
              <div className="flex items-center justify-between gap-3">
                {/* Settings Control - Gear Icon */}
                <div className="flex items-center">
                  <button 
                    data-tour="settings-button"
                    onClick={() => setActiveTab('settings')}
                    className={`${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} rounded-xl p-3 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 border border-gray-400/20 hover:border-gray-400/40`}
                  >
                    <svg className={`w-5 h-5 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <span className={`${themeClasses.textSecondary} text-sm ${direction === 'rtl' ? 'mr-4' : 'ml-4'}`}>{language === 'hebrew' ? 'הגדרות' : 'Settings'}</span>
                </div>

                {/* Logout Button */}
                <button
                  onClick={() => {
                    setIsModalAnimating(true);
                    setShowLogoutConfirm(true);
                    setTimeout(() => setIsModalAnimating(false), 600);
                  }}
                  className={`flex items-center ${direction === 'rtl' ? 'flex-row-reverse' : ''} p-3 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 ${themeClasses.bgSecondary} border border-red-500/20 hover:border-red-500/40 hover:shadow-md`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-red-500/20 to-pink-500/20 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`}>
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <span className={`${themeClasses.textSecondary} text-sm`}>{language === 'hebrew' ? 'התנתק' : 'Logout'}</span>
                </button>
              </div>
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
            <div className="flex items-center justify-between relative">
              {/* Menu button */}
              <button
                data-tour="mobile-menu-button"
                onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
                className={`p-2 rounded-xl transition-all duration-300 ${themeClasses.bgSecondary} border border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-lg hover:scale-105 active:scale-95`}
                aria-label={language === 'hebrew' ? 'תפריט' : 'Menu'}
              >
                <div className="w-6 h-6 flex flex-col justify-center gap-1.5">
                  <span className={`block h-0.5 w-6 ${themeClasses.textPrimary} transition-all duration-300 ${isMobileNavOpen ? 'rotate-45 translate-y-2' : ''}`} style={{ backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}></span>
                  <span className={`block h-0.5 w-6 ${themeClasses.textPrimary} transition-all duration-300 ${isMobileNavOpen ? 'opacity-0' : 'opacity-100'}`} style={{ backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}></span>
                  <span className={`block h-0.5 w-6 ${themeClasses.textPrimary} transition-all duration-300 ${isMobileNavOpen ? '-rotate-45 -translate-y-2' : ''}`} style={{ backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}></span>
                </div>
              </button>
              
              {/* Centered logo and text */}
              <div className="flex items-center flex-1 justify-center gap-2.5">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-teal-400/20 rounded-lg blur-sm group-hover:blur-md transition-all duration-300"></div>
                  <img src="/favicon.ico" alt="BetterChoice Logo" className="relative w-12 h-12 rounded-lg shadow-lg ring-2 ring-emerald-500/30 group-hover:ring-emerald-400/50 transition-all duration-300" />
                  <div className={`absolute -top-0.5 ${direction === 'rtl' ? '-left-0.5' : '-right-0.5'} w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse shadow-md shadow-emerald-500/50`} />
                </div>
                <div className={direction === 'rtl' ? 'text-right' : 'text-left'}>
                  <h1 className={`${themeClasses.textPrimary} text-lg font-bold bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 bg-clip-text text-transparent leading-tight`}>BetterChoice</h1>
                  <p className={`${themeClasses.textSecondary} text-xs mt-0.5 opacity-90`}>{t.profile.title}</p>
                </div>
              </div>
              
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
              <div className={`flex items-center justify-between ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-3 ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex flex-col items-center ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`}>
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-teal-400/20 rounded-xl blur-md group-hover:blur-lg transition-all duration-300"></div>
                      <img src="/favicon.ico" alt="BetterChoice Logo" className="relative w-16 h-16 rounded-xl shadow-xl ring-2 ring-emerald-500/30 group-hover:ring-emerald-400/50 transition-all duration-300" />
                      <div className={`absolute -top-1 ${direction === 'rtl' ? '-left-1' : '-right-1'} w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse shadow-lg shadow-emerald-500/50`} />
                    </div>
                    <a
                      href={language === 'hebrew' ? 'https://wa.me/message/B2LIFC7FLCCMN1' : 'https://wa.me/message/YH4IM5MWPY4HI1'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`mt-2 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-green-500 via-green-600 to-green-700 hover:from-green-600 hover:via-green-700 hover:to-green-800 text-white shadow-lg hover:shadow-xl hover:shadow-green-500/30 transition-all duration-300 hover:scale-105 active:scale-95 text-xs font-semibold min-w-[70px]`}
                      aria-label={language === 'hebrew' ? 'צור קשר ב-WhatsApp' : 'Contact us on WhatsApp'}
                    >
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      <span className="whitespace-nowrap">{language === 'hebrew' ? 'ל-AI שלנו' : 'AI Chat'}</span>
                    </a>
                  </div>
                  <div className={`${direction === 'rtl' ? 'text-right' : 'text-left'} -mt-1`}>
                    <h1 className={`${themeClasses.textPrimary} text-lg font-bold bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 bg-clip-text text-transparent leading-tight`}>BetterChoice</h1>
                    <p className={`${themeClasses.textSecondary} text-xs mt-0.5 opacity-90`}>{t.profile.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
              </div>
            </div>

            {/* Mobile Tab Navigation */}
            <div className="flex-1 overflow-y-auto px-4 py-3 bg-gradient-to-b from-emerald-500/5 to-transparent">
              <div className="space-y-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    data-tour={tab.id === 'profile' ? 'profile-tab' : tab.id === 'myPlan' ? 'myplan-tab' : tab.id === 'dailyLog' ? 'dailylog-tab' : tab.id === 'messages' ? 'messages-tab' : tab.id === 'pricing' ? 'pricing-tab' : null}
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
            <div className="px-4 py-3 border-t-2 border-emerald-500/20 bg-gradient-to-b from-transparent to-emerald-500/5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
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
                    data-tour="settings-button"
                    onClick={() => {
                      setActiveTab('settings');
                      setIsMobileNavOpen(false);
                    }}
                    className={`${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} rounded-xl p-2.5 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 border border-gray-400/20 hover:border-gray-400/40 active:scale-95`}
                    aria-label={language === 'hebrew' ? 'הגדרות' : 'Settings'}
                  >
                    <svg className={`w-5 h-5 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>

                  {/* Logout Button - Mobile */}
                  <button
                    onClick={() => {
                      setIsModalAnimating(true);
                      setShowLogoutConfirm(true);
                      setIsMobileNavOpen(false);
                      setTimeout(() => setIsModalAnimating(false), 600);
                    }}
                    className={`${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} rounded-xl p-2.5 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 border border-red-500/20 hover:border-red-500/40 active:scale-95`}
                    aria-label={language === 'hebrew' ? 'התנתק' : 'Logout'}
                  >
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>

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
      </div>

      {/* Main Content */}
      <div className={`flex-1 p-4 sm:p-6 md:p-8 ${activeTab === 'messages' ? 'overflow-hidden' : 'overflow-y-auto'} custom-scrollbar relative ${themeClasses.bgCard} ${themeClasses.shadowCard}`} style={{
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
        
        <div className={`rounded-xl ${activeTab === 'messages' ? 'p-0 h-full flex flex-col' : 'p-6'} language-transition language-text-transition relative z-10`}>
          {!isProfileDataReady ? (
            <div className="flex flex-col items-center justify-center min-h-[320px] gap-4">
              <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" aria-hidden="true" />
              <p className={`${themeClasses.textSecondary} text-lg`}>
                {language === 'hebrew' ? 'טוען נתונים...' : 'Loading your data...'}
              </p>
            </div>
          ) : (
            <>
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
                <PricingTab themeClasses={themeClasses} user={user} language={language} />
              )}
              {activeTab === 'settings' && (
                <SettingsTab themeClasses={themeClasses} language={language} userCode={profileData.userCode} />
              )}
            </>
          )}
        </div>

        {/* Onboarding Modal */}
        <OnboardingModal
          isOpen={showOnboarding}
          onClose={handleOnboardingComplete}
          user={user}
          userCode={userCode}
        />

        {/* WhatsApp Popup Modal - Shows after tour completion - IMPORTANT */}
        {showWhatsAppPopup && (
          <div className="fixed inset-0 z-[100] overflow-y-auto" aria-labelledby="whatsapp-modal-title" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen pt-2 px-2 pb-2 text-center sm:block sm:p-0 sm:pt-4 sm:px-4 sm:pb-20">
              {/* Background overlay - darker and more prominent */}
              <div 
                className="fixed inset-0 bg-black backdrop-blur-md transition-opacity duration-300 bg-opacity-80"
                aria-hidden="true"
              ></div>

              {/* Center modal */}
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              
              {/* Modal panel - larger and more prominent, fully responsive */}
              <div className={`inline-block align-bottom ${themeClasses.bgCard} rounded-2xl sm:rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl w-full max-w-[calc(100vw-1rem)] border-2 sm:border-4 border-emerald-500/50`} style={{ animation: 'slideInFromButton 0.5s ease-out' }} dir={direction}>
                {/* Animated gradient header */}
                <div className="bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 px-4 py-5 sm:px-8 sm:pt-8 sm:pb-6 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 via-green-400/20 to-teal-400/20 animate-pulse"></div>
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-3 sm:mb-4 gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 sm:gap-3 mb-2">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm animate-bounce flex-shrink-0">
                            <span className="text-2xl sm:text-4xl">🤖</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-xl sm:text-3xl md:text-4xl font-bold text-white leading-tight break-words" id="whatsapp-modal-title">
                              {language === 'hebrew' ? 'הבוט AI שלכם מחכה!' : 'Your AI Bot is Waiting!'}
                            </h3>
                            <p className="text-emerald-100 text-xs sm:text-sm mt-1 font-medium">
                              {language === 'hebrew' ? 'הכלי החשוב ביותר שלכם' : 'Your Most Important Tool'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setShowWhatsAppPopup(false);
                          localStorage.setItem('whatsappPopupShown', 'true');
                        }}
                        className="text-white/80 hover:text-white transition-colors text-2xl sm:text-3xl font-bold hover:scale-110 active:scale-95 flex-shrink-0"
                        aria-label={language === 'hebrew' ? 'סגור' : 'Close'}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Content section */}
                <div className={`${themeClasses.bgCard} px-4 py-4 sm:px-8 sm:py-6`}>
                  {/* Key features */}
                  <div className="mb-4 sm:mb-6">
                    <p className={`${themeClasses.textPrimary} text-base sm:text-xl font-semibold mb-3 sm:mb-4`}>
                      {language === 'hebrew' 
                        ? 'הבוט AI שלכם עושה הכל:'
                        : 'Your AI Bot Does Everything:'}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                      {/* Feature 1 - Food Logging */}
                      <div className={`${themeClasses.bgSecondary} rounded-lg sm:rounded-xl p-3 sm:p-4 border-2 border-emerald-500/30`}>
                        <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">📝</div>
                        <h4 className={`${themeClasses.textPrimary} font-bold mb-1 text-sm sm:text-base`}>
                          {language === 'hebrew' ? 'רישום מזון' : 'Food Logging'}
                        </h4>
                        <p className={`${themeClasses.textSecondary} text-xs sm:text-sm leading-relaxed`}>
                          {language === 'hebrew' 
                            ? 'תיעוד כל ארוחה בקלות'
                            : 'Log every meal easily'}
                        </p>
                      </div>
                      
                      {/* Feature 2 - Weight Tracking */}
                      <div className={`${themeClasses.bgSecondary} rounded-lg sm:rounded-xl p-3 sm:p-4 border-2 border-emerald-500/30`}>
                        <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">⚖️</div>
                        <h4 className={`${themeClasses.textPrimary} font-bold mb-1 text-sm sm:text-base`}>
                          {language === 'hebrew' ? 'מעקב משקל' : 'Weight Tracking'}
                        </h4>
                        <p className={`${themeClasses.textSecondary} text-xs sm:text-sm leading-relaxed`}>
                          {language === 'hebrew' 
                            ? 'עקוב אחר ההתקדמות שלך'
                            : 'Track your progress'}
                        </p>
                      </div>
                      
                      {/* Feature 3 - Dietitian Consultations */}
                      <div className={`${themeClasses.bgSecondary} rounded-lg sm:rounded-xl p-3 sm:p-4 border-2 border-emerald-500/30`}>
                        <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">👩‍⚕️</div>
                        <h4 className={`${themeClasses.textPrimary} font-bold mb-1 text-sm sm:text-base`}>
                          {language === 'hebrew' ? 'ייעוץ דיאטני' : 'Dietitian Consultations'}
                        </h4>
                        <p className={`${themeClasses.textSecondary} text-xs sm:text-sm leading-relaxed`}>
                          {language === 'hebrew' 
                            ? 'כמו דיאטנית אמיתית'
                            : 'Like a real dietitian'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Compelling message */}
                  <div className={`${isDarkMode ? 'bg-emerald-900/30' : 'bg-emerald-50'} rounded-lg sm:rounded-xl p-3 sm:p-5 mb-4 sm:mb-6 border-2 ${isDarkMode ? 'border-emerald-500/50' : 'border-emerald-200'}`}>
                    <p className={`${themeClasses.textPrimary} text-sm sm:text-base md:text-lg font-medium leading-relaxed`}>
                      {language === 'hebrew' 
                        ? '💚 זה הכלי המרכזי של BetterChoice - הבוט AI שלכם זמין 24/7 לעזור לכם עם כל שאלה, תיעוד מזון, מעקב משקל, והמלצות מותאמות אישית. התחילו עכשיו!'
                        : '💚 This is BetterChoice\'s core tool - Your AI Bot is available 24/7 to help with any question, food logging, weight tracking, and personalized recommendations. Start now!'}
                    </p>
                  </div>
                  
                  {/* CTA Button - Large and prominent, responsive */}
                  <div className="flex flex-col gap-2 sm:gap-3">
                    <a
                      href={language === 'hebrew' ? 'https://wa.me/message/B2LIFC7FLCCMN1' : 'https://wa.me/message/YH4IM5MWPY4HI1'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        setShowWhatsAppPopup(false);
                        localStorage.setItem('whatsappPopupShown', 'true');
                      }}
                      className="flex items-center justify-center gap-2 sm:gap-3 px-4 py-3 sm:px-8 sm:py-5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-500 via-green-600 to-green-700 hover:from-green-600 hover:via-green-700 hover:to-green-800 text-white shadow-2xl hover:shadow-green-500/50 transition-all duration-300 hover:scale-105 active:scale-95 font-bold text-base sm:text-lg md:text-xl relative overflow-hidden group"
                      aria-label={language === 'hebrew' ? 'התחל עכשיו ב-WhatsApp' : 'Start Now on WhatsApp'}
                    >
                      {/* Animated background effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                      
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 relative z-10" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      <span className="relative z-10 text-center break-words">
                        {language === 'hebrew' ? '🚀 התחילו עכשיו - דברו עם ה-AI' : '🚀 Start Now - Chat with AI'}
                      </span>
                      <span className="relative z-10 animate-pulse flex-shrink-0">→</span>
                    </a>
                    
                    {/* Smaller dismiss button */}
                    <button
                      onClick={() => {
                        setShowWhatsAppPopup(false);
                        localStorage.setItem('whatsappPopupShown', 'true');
                      }}
                      className={`px-4 py-2 rounded-lg ${themeClasses.textSecondary} hover:${themeClasses.textPrimary} transition-all text-xs sm:text-sm opacity-60 hover:opacity-100`}
                    >
                      {language === 'hebrew' ? 'אני אתחיל מאוחר יותר' : 'I\'ll start later'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logout Confirmation Modal */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              {/* Background overlay */}
              <div 
                className={`fixed inset-0 bg-gray-900 backdrop-blur-sm transition-opacity duration-300 ${
                  isModalAnimating ? 'bg-opacity-0 animate-[fadeIn_0.3s_ease-out_forwards]' : 'bg-opacity-75'
                }`}
                aria-hidden="true"
                onClick={() => setShowLogoutConfirm(false)}
              ></div>

              {/* Center modal */}
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

              {/* Modal panel */}
              <div className={`inline-block align-bottom ${themeClasses.bgCard} rounded-2xl text-left overflow-hidden shadow-2xl transform sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border-2 border-emerald-500/30`} dir={direction} style={{
                animation: isModalAnimating ? 'modalPopUp 0.5s ease-out forwards' : 'none',
                transform: isModalAnimating ? 'scale(0.7) translateY(20px)' : 'scale(1) translateY(0)',
                opacity: isModalAnimating ? 0 : 1,
                transition: isModalAnimating ? 'none' : 'all 0.3s ease-out'
              }}>
                {/* Header with Gradient */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-8 text-center">
                  <div className="text-5xl mb-3">🚪</div>
                  <h3 className="text-2xl font-bold text-white mb-2" id="modal-title">
                    {language === 'hebrew' ? 'התנתקות?' : 'Logout?'}
                  </h3>
                  <p className="text-emerald-100 text-sm">
                    {language === 'hebrew' 
                      ? 'האם אתה בטוח שברצונך להתנתק?' 
                      : 'Are you sure you want to logout?'}
                  </p>
                </div>

                {/* Modal Content */}
                <div className="px-6 py-6">
                  <p className={`${themeClasses.textSecondary} mb-6 text-center`}>
                    {language === 'hebrew' 
                      ? 'תתנתק מהחשבון שלך ותועבר לעמוד הבית.' 
                      : 'You will be logged out and redirected to the homepage.'}
                  </p>

                  {/* Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 px-6 rounded-xl font-bold hover:from-emerald-600 hover:to-teal-600 focus:outline-none focus:ring-4 focus:ring-emerald-300 dark:focus:ring-emerald-800 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-emerald-500/50"
                    >
                      {language === 'hebrew' ? 'כן, התנתק' : 'Yes, Logout'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLogoutConfirm(false)}
                      className={`flex-1 ${themeClasses.btnSecondary} py-3 px-6 rounded-xl font-semibold transition-all duration-300 hover:scale-105 border border-emerald-500/20 hover:border-emerald-500/40`}
                    >
                      {language === 'hebrew' ? 'ביטול' : 'Cancel'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

// Helper functions to normalize food items from different formats
// Supports both old format (cals, p, c, f) and new format (macros object)
const normalizeFoodItem = (item) => {
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
const parseFoodItems = (log) => {
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
const WeightProgressComponent = ({ userCode, themeClasses, language, isDarkMode }) => {
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
      
      // Check if mobile device (width or height less than 768px)
      const isMobileDevice = width < 768 || height < 768;
      setIsMobile(isMobileDevice);
      
      // Check if portrait (height > width) - opposite of landscape
      const isPortraitMode = height > width;
      
      // Show message if mobile AND portrait (ask to rotate to landscape)
      const shouldShowMessage = isMobileDevice && isPortraitMode;
      
      setIsLandscape(shouldShowMessage);
    };

    // Check immediately
    checkOrientation();
    
    // Use multiple event listeners for better compatibility
    const handleResize = () => {
      setTimeout(checkOrientation, 100);
    };
    
    const handleOrientationChange = () => {
      setTimeout(checkOrientation, 200);
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Also use media query listener if available
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(orientation: portrait)');
      const handleMediaChange = () => {
        setTimeout(checkOrientation, 100);
      };
      
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

  const hasData = chartData.length > 0;

  return (
    <div className={`${themeClasses.bgCard} rounded-2xl p-3 sm:p-4 md:p-6 mb-6 shadow-lg border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
      {/* Mobile Note - Suggest using computer */}
      {isMobile && (
        <div className={`${themeClasses.bgSecondary} rounded-lg p-3 mb-4 border border-emerald-500/20`}>
          <div className="flex items-start gap-2">
            <span className="text-lg">💻</span>
            <p className={`${themeClasses.textSecondary} text-xs sm:text-sm flex-1`}>
              {language === 'hebrew' 
                ? 'לצפייה טובה יותר, פתח את האתר במחשב' 
                : 'For better viewing, open the website on a computer'}
            </p>
          </div>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 sm:mb-4 gap-3 overflow-hidden">
        <div className="flex-1 min-w-0">
          <h3 className={`${themeClasses.textPrimary} text-lg sm:text-xl font-bold`}>
            {language === 'hebrew' ? 'מעקב משקל והתקדמות' : 'Weight & Progress Tracking'}
          </h3>
          <div className="flex flex-wrap gap-2 sm:gap-4 mt-1">
            {currentValue != null && (
              <p className={`${themeClasses.textSecondary} text-xs sm:text-sm whitespace-nowrap`}>
                {language === 'hebrew' ? 'ערך נוכחי: ' : 'Current: '}
                <span className="font-semibold">
                  {currentValue.toFixed(selectedMetric === 'weight' || selectedMetric === 'body_fat' ? 1 : 0)} {getMetricUnit()}
                </span>
              </p>
            )}
            {averageValue != null && (
              <p className={`${themeClasses.textSecondary} text-xs sm:text-sm whitespace-nowrap`}>
                {language === 'hebrew' ? 'ממוצע: ' : 'Average: '}
                <span className="font-semibold">
                  {averageValue.toFixed(selectedMetric === 'weight' || selectedMetric === 'body_fat' ? 1 : 0)} {getMetricUnit()}
                </span>
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto sm:flex-shrink-0 min-w-0">
          <button
            onClick={() => setShowAddMeasurementModal(true)}
            className={`flex-1 sm:flex-none px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors text-xs sm:text-sm font-medium whitespace-nowrap min-w-0`}
          >
            {language === 'hebrew' ? 'הוסף מדידה' : 'Add Measurement'}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className={`flex-1 sm:flex-none px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg ${themeClasses.bgSecondary} ${themeClasses.textPrimary} hover:${themeClasses.bgPrimary} transition-colors text-xs sm:text-sm font-medium whitespace-nowrap min-w-0`}
          >
            {expanded 
              ? (language === 'hebrew' ? 'סגור' : 'Hide Options')
              : (language === 'hebrew' ? 'מידות נוספות' : 'More Measurements')
            }
          </button>
        </div>
      </div>

      {/* Time Period Filter */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4 items-center">
        {[
          { key: '1m', label: language === 'hebrew' ? 'חודש 1' : '1 Month' },
          { key: '3m', label: language === 'hebrew' ? '3 חודשים' : '3 Months' },
          { key: '6m', label: language === 'hebrew' ? '6 חודשים' : '6 Months' },
          { key: 'all', label: language === 'hebrew' ? 'כל הזמן' : 'All Time' }
        ].map(period => (
          <button
            key={period.key}
            onClick={() => setTimePeriod(period.key)}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
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
          className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
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

      {/* Portrait Orientation Message - Ask to rotate to landscape */}
      {isLandscape && (
        <div className={`${themeClasses.bgCard} rounded-xl p-8 mb-6 border-2 border-emerald-500/50 shadow-xl`} style={{ minHeight: '200px' }}>
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

      {/* Simple Line & Area Chart */}
      {!isLandscape && (
      <div className="relative h-64 w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-900/40 via-slate-900/10 to-slate-900/40">
        {!hasData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <div className="text-4xl mb-3">📊</div>
            <p className={`${themeClasses.textSecondary} text-sm sm:text-base mb-4 text-center px-4`}>
              {language === 'hebrew' ? 'אין לך רשומות מדידות גוף' : "You don't have any Body Measurements Log"}
            </p>
          </div>
        )}
        <div
          style={{
            opacity: isTransitioning ? 0.5 : (hasData ? 1 : 0.3),
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
          {hasData && chartData.length > 1 && (() => {
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
          {hasData && chartData.map((d, index) => {
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
          {hasData && chartData.length > 0 && chartData.map((d, index) => {
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
      )}

      {/* Add Measurement Modal */}
      {showAddMeasurementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => !saving && setShowAddMeasurementModal(false)}>
          <div className={`${themeClasses.bgCard} rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`${themeClasses.textPrimary} text-xl font-bold`}>
                {language === 'hebrew' ? 'הוסף מדידה' : 'Add Measurement'}
              </h3>
              <button
                onClick={() => !saving && setShowAddMeasurementModal(false)}
                disabled={saving}
                className={`${themeClasses.textSecondary} hover:${themeClasses.textPrimary} transition-colors`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Measurement Type */}
              <div>
                <label className={`block ${themeClasses.textPrimary} text-sm font-medium mb-2`}>
                  {language === 'hebrew' ? 'סוג מדידה' : 'Measurement Type'}
                </label>
                <select
                  value={measurementForm.measurementType}
                  onChange={(e) => setMeasurementForm(prev => ({ ...prev, measurementType: e.target.value, value: '' }))}
                  className={`w-full px-3 py-2 rounded-lg ${themeClasses.bgSecondary} ${themeClasses.textPrimary} border ${isDarkMode ? 'border-slate-700' : 'border-slate-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
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

              {/* Value */}
              <div>
                <label className={`block ${themeClasses.textPrimary} text-sm font-medium mb-2`}>
                  {language === 'hebrew' ? 'ערך' : 'Value'}
                </label>
                <input
                  type="number"
                  step={measurementForm.measurementType === 'weight' || measurementForm.measurementType === 'body_fat' ? '0.1' : '0.1'}
                  value={measurementForm.value}
                  onChange={(e) => setMeasurementForm(prev => ({ ...prev, value: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg ${themeClasses.bgSecondary} ${themeClasses.textPrimary} border ${isDarkMode ? 'border-slate-700' : 'border-slate-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                  placeholder={language === 'hebrew' ? 'הכנס ערך' : 'Enter value'}
                  disabled={saving}
                />
              </div>

              {/* Date */}
              <div>
                <label className={`block ${themeClasses.textPrimary} text-sm font-medium mb-2`}>
                  {language === 'hebrew' ? 'תאריך' : 'Date'}
                </label>
                <input
                  type="date"
                  value={measurementForm.date}
                  onChange={(e) => setMeasurementForm(prev => ({ ...prev, date: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg ${themeClasses.bgSecondary} ${themeClasses.textPrimary} border ${isDarkMode ? 'border-slate-700' : 'border-slate-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                  disabled={saving}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => !saving && setShowAddMeasurementModal(false)}
                  disabled={saving}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${themeClasses.bgSecondary} ${themeClasses.textPrimary} hover:${themeClasses.bgPrimary} ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {language === 'hebrew' ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  onClick={handleAddMeasurement}
                  disabled={saving || !measurementForm.value || !measurementForm.date}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors bg-emerald-500 hover:bg-emerald-600 text-white ${saving || !measurementForm.value || !measurementForm.date ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {saving ? (language === 'hebrew' ? 'שומר...' : 'Saving...') : (language === 'hebrew' ? 'שמור' : 'Save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Food Log Progress Component
const FoodLogProgressComponent = ({ userCode, themeClasses, language, isDarkMode, onAddLog }) => {
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

  // Check for mobile device and portrait orientation
  useEffect(() => {
    const checkOrientation = () => {
      const width = window.innerWidth || window.screen.width;
      const height = window.innerHeight || window.screen.height;
      
      // Check if mobile device (width or height less than 768px)
      const isMobileDevice = width < 768 || height < 768;
      setIsMobile(isMobileDevice);
      
      // Check if portrait (height > width) - opposite of landscape
      const isPortraitMode = height > width;
      
      // Show message if mobile AND portrait (ask to rotate to landscape)
      const shouldShowMessage = isMobileDevice && isPortraitMode;
      
      setIsLandscape(shouldShowMessage);
    };

    // Check immediately
    checkOrientation();
    
    // Use multiple event listeners for better compatibility
    const handleResize = () => {
      setTimeout(checkOrientation, 100);
    };
    
    const handleOrientationChange = () => {
      setTimeout(checkOrientation, 200);
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Also use media query listener if available
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(orientation: portrait)');
      const handleMediaChange = () => {
        setTimeout(checkOrientation, 100);
      };
      
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
      
      // Sum up values from food_items array using normalized format
      const foodItems = parseFoodItems(log);
      foodItems.forEach(item => {
        dailyTotals[date].calories += item.cals || 0;
        dailyTotals[date].protein += item.p || 0;
        dailyTotals[date].carbs += item.c || 0;
        dailyTotals[date].fat += item.f || 0;
      });
      
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

  const hasData = chartData.length > 0;

  return (
    <div className={`${themeClasses.bgCard} rounded-2xl p-3 sm:p-4 md:p-6 mb-6 shadow-lg border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
      {/* Mobile Note - Suggest using computer */}
      {isMobile && (
        <div className={`${themeClasses.bgSecondary} rounded-lg p-3 mb-4 border border-emerald-500/20`}>
          <div className="flex items-start gap-2">
            <span className="text-lg">💻</span>
            <p className={`${themeClasses.textSecondary} text-xs sm:text-sm flex-1`}>
              {language === 'hebrew' 
                ? 'לצפייה טובה יותר, פתח את האתר במחשב' 
                : 'For better viewing, open the website on a computer'}
            </p>
          </div>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 sm:mb-4 gap-3">
        <div className="flex-1 min-w-0">
          <h3 className={`${themeClasses.textPrimary} text-lg sm:text-xl font-bold`}>
            {language === 'hebrew' ? 'מעקב תזונה' : 'Nutrition Tracking'}
          </h3>
          <div className="flex flex-wrap gap-2 sm:gap-4 mt-1">
            {currentValue != null && (
              <p className={`${themeClasses.textSecondary} text-xs sm:text-sm whitespace-nowrap`}>
                {language === 'hebrew' ? 'ערך נוכחי: ' : 'Current: '}
                <span className="font-semibold">
                  {Math.round(currentValue)} {getMetricUnit()}
                </span>
              </p>
            )}
            {averageValue != null && (
              <p className={`${themeClasses.textSecondary} text-xs sm:text-sm whitespace-nowrap`}>
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
      <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4 items-center">
        {[
          { key: '1m', label: language === 'hebrew' ? 'חודש 1' : '1 Month' },
          { key: '3m', label: language === 'hebrew' ? '3 חודשים' : '3 Months' },
          { key: '6m', label: language === 'hebrew' ? '6 חודשים' : '6 Months' },
          { key: 'all', label: language === 'hebrew' ? 'כל הזמן' : 'All Time' }
        ].map(period => (
          <button
            key={period.key}
            onClick={() => setTimePeriod(period.key)}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
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
          className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
            showAverage
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/40'
              : `${themeClasses.bgSecondary} ${themeClasses.textSecondary} hover:${themeClasses.bgPrimary}`
          }`}
        >
          {language === 'hebrew' ? 'ממוצע' : 'Average'}
        </button>
      </div>

      {/* Metric Selector */}
      <div className="mb-3 sm:mb-4 flex flex-wrap gap-1.5 sm:gap-2">
        {[
          { key: 'calories', label: language === 'hebrew' ? 'קלוריות' : 'Calories', color: '#10b981' },
          { key: 'protein', label: language === 'hebrew' ? 'חלבון' : 'Protein', color: '#a855f7' },
          { key: 'carbs', label: language === 'hebrew' ? 'פחמימות' : 'Carbs', color: '#3b82f6' },
          { key: 'fat', label: language === 'hebrew' ? 'שומן' : 'Fat', color: '#f59e0b' }
        ].map(metric => (
          <button
            key={metric.key}
            onClick={() => setSelectedMetric(metric.key)}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
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

      {/* Portrait Orientation Message - Ask to rotate to landscape */}
      {isLandscape && (
        <div className={`${themeClasses.bgCard} rounded-xl p-8 mb-6 border-2 border-emerald-500/50 shadow-xl`} style={{ minHeight: '200px' }}>
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

      {/* Simple Line & Area Chart */}
      {!isLandscape && (
      <div className="relative h-64 w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-900/40 via-slate-900/10 to-slate-900/40">
        {!hasData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <div className="text-4xl mb-3">📊</div>
            <p className={`${themeClasses.textSecondary} text-sm sm:text-base mb-4 text-center px-4`}>
              {language === 'hebrew' ? 'אין לך רשומות יומן תזונה' : "You don't have any Food Log entries"}
            </p>
            <button
              onClick={() => {
                if (onAddLog) {
                  onAddLog();
                }
              }}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium text-sm transition-colors shadow-md hover:shadow-lg"
            >
              {language === 'hebrew' ? 'הוסף יומן תזונה' : 'Add Food Log'}
            </button>
          </div>
        )}
        <div
          style={{
            opacity: isTransitioning ? 0.5 : (hasData ? 1 : 0.3),
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
            {hasData && chartData.length > 1 && (() => {
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
            {hasData && chartData.map((d, index) => {
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
          {hasData && chartData.length > 0 && chartData.map((d, index) => {
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
      )}
    </div>
  );
};

const ProfileTab = ({ profileData, onInputChange, onSave, isSaving, saveStatus, errorMessage, themeClasses, t, companyOptions, isLoadingCompanies, companyError, language, onboardingCompleted = false, user, onSaveProfileImageUrl }) => {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [cropImage, setCropImage] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  // Helper function to check if a field should be shown (if onboarding not completed, only show non-null fields)
  const shouldShowField = (fieldValue) => {
    if (onboardingCompleted === true) return true; // Show all fields if onboarding is completed
    return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''; // Only show non-null fields if skipped
  };

  // Personal Information fields are always read-only - cannot be edited
  const isReadOnly = true;

  // Handle image selection - show crop modal
  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setImageError(language === 'hebrew' ? 'הקובץ חייב להיות תמונה' : 'File must be an image');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setImageError(language === 'hebrew' ? 'התמונה גדולה מדי (מקסימום 5MB)' : 'Image is too large (max 5MB)');
      return;
    }

    setImageError('');
    
    // Create image preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageToCrop(e.target.result);
      setShowCropModal(true);
      setCropImage({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle mouse events for dragging
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - cropImage.x, y: e.clientY - cropImage.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setCropImage(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };


  // Crop and upload the image
  const handleCropAndUpload = async () => {
    if (!imageToCrop || !imageRef.current || !containerRef.current) return;

    setUploadingImage(true);
    setImageError('');

    try {
      // Get container and image dimensions
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const containerSize = Math.min(containerRect.width, containerRect.height);
      
      // Create canvas for cropping
      const canvas = document.createElement('canvas');
      canvas.width = 400; // Output size
      canvas.height = 400;
      const ctx = canvas.getContext('2d');

      // Load image
      const img = new Image();
      img.onload = async () => {
        const container = containerRef.current;
        if (!container) return;
        
        const containerRect = container.getBoundingClientRect();
        const containerSize = Math.min(containerRect.width, containerRect.height);
        const cropCircleSize = containerSize * 0.75; // 75% - the visible circle
        const circleRadius = cropCircleSize / 2;
        
        // Calculate how image is displayed with object-fit: cover
        const imgAspect = img.width / img.height;
        let coverScale;
        
        if (imgAspect > 1) {
          // Wider image - height fills container
          coverScale = containerSize / img.height;
        } else {
          // Taller image - width fills container
          coverScale = containerSize / img.width;
        }
        
        // Image element dimensions after object-fit: cover
        const displayedWidth = img.width * coverScale;
        const displayedHeight = img.height * coverScale;
        
        // Offset to center the image (object-fit: cover centers it)
        const offsetX = (containerSize - displayedWidth) / 2;
        const offsetY = (containerSize - displayedHeight) / 2;
        
        // Circle center in container coordinates
        const circleCenterX = containerSize / 2;
        const circleCenterY = containerSize / 2;
        
        // Transform origin is top-left of the image element
        // We need to find what point in the original image corresponds to the circle center
        // Step 1: Convert circle center to coordinates relative to image element (before transform)
        let relativeX = circleCenterX - offsetX;
        let relativeY = circleCenterY - offsetY;
        
        // Step 2: Account for the transform (translate only, no scale)
        // The transform is: translate(x, y)
        // First undo the translation
        relativeX = relativeX - cropImage.x;
        relativeY = relativeY - cropImage.y;
        
        // Step 3: Add back the offset to get position in displayed image
        relativeX = relativeX + offsetX;
        relativeY = relativeY + offsetY;
        
        // Step 4: Convert to original image pixel coordinates
        const imageX = relativeX / coverScale;
        const imageY = relativeY / coverScale;
        
        // Calculate crop size in original image coordinates
        const cropSizeInImage = cropCircleSize / coverScale;
        
        // Calculate crop rectangle centered on the calculated position
        let cropX = imageX - cropSizeInImage / 2;
        let cropY = imageY - cropSizeInImage / 2;
        
        // Ensure crop stays within image bounds
        cropX = Math.max(0, Math.min(cropX, img.width - cropSizeInImage));
        cropY = Math.max(0, Math.min(cropY, img.height - cropSizeInImage));
        const finalCropSize = Math.min(cropSizeInImage, img.width - cropX, img.height - cropY);

        // Draw cropped image
        ctx.drawImage(
          img,
          cropX, cropY, finalCropSize, finalCropSize,
          0, 0, 400, 400
        );

        // Convert to blob
        canvas.toBlob(async (blob) => {
          if (!blob) {
            setImageError(language === 'hebrew' ? 'שגיאה בעיבוד התמונה' : 'Error processing image');
            setUploadingImage(false);
            return;
          }

          // Get user_code from clients table
          const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb.onrender.com';
          const userCodeResponse = await fetch(`${apiUrl}/api/profile/user-code?userId=${encodeURIComponent(user.id)}`);
          const userCodeResult = await userCodeResponse.json();

          if (!userCodeResponse.ok) {
            console.error('Error fetching user_code:', userCodeResult.error);
            setImageError(language === 'hebrew' ? 'שגיאה בטעינת פרטי המשתמש' : 'Error loading user information');
            setUploadingImage(false);
            setShowCropModal(false);
            return;
          }

          const userCode = userCodeResult.user_code;
          if (!userCode) {
            setImageError(language === 'hebrew' ? 'קוד משתמש לא נמצא. אנא השלם את הגדרת הפרופיל תחילה.' : 'User code not found. Please complete your profile setup first.');
            setUploadingImage(false);
            setShowCropModal(false);
            return;
          }

          // Generate unique filename
          const timestamp = Date.now();
          const filename = `${userCode}/${timestamp}.jpeg`;

          // Check if user is authenticated
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            setImageError(language === 'hebrew' ? 'נא להתחבר כדי להעלות תמונה' : 'Please sign in to upload an image');
            setUploadingImage(false);
            setShowCropModal(false);
            return;
          }

          // Upload to Supabase Storage
          const bucketName = process.env.REACT_APP_SUPABASE_STORAGE_BUCKET_NAME || 'profile-pictures';
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(filename, blob, {
              contentType: 'image/jpeg',
              upsert: false,
              cacheControl: '3600',
              metadata: {
                userId: user.id,
                userCode: userCode,
                uploadedAt: new Date().toISOString()
              }
            });

          if (uploadError) {
            console.error('Error uploading to Supabase Storage:', uploadError);
            if (uploadError.message?.includes('row-level security policy') || 
                uploadError.message?.includes('RLS') ||
                uploadError.statusCode === 400 ||
                uploadError.message?.includes('violates')) {
              const rlsErrorMsg = language === 'hebrew' 
                ? `שגיאת הרשאות: מדיניות האבטחה חוסמת את ההעלאה.`
                : `Permission error: Security policy is blocking the upload.`;
              setImageError(rlsErrorMsg);
            } else {
              setImageError(uploadError.message || (language === 'hebrew' ? 'שגיאה בהעלאת התמונה' : 'Error uploading image'));
            }
            setUploadingImage(false);
            setShowCropModal(false);
            return;
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(uploadData.path);

          const publicUrl = urlData.publicUrl;

          // Update profile data
          onInputChange('profileImageUrl', publicUrl);
          
          // Save to database
          if (onSaveProfileImageUrl) {
            const saveResult = await onSaveProfileImageUrl(publicUrl);
            if (saveResult.error) {
              console.error('Error saving profile image URL to database:', saveResult.error);
              setImageError(language === 'hebrew' ? 'התמונה הועלתה אך לא נשמרה. אנא נסה לשמור ידנית.' : 'Image uploaded but not saved. Please try saving manually.');
            } else {
              setImageError('');
            }
          } else {
            setImageError('');
          }

          setShowCropModal(false);
          setImageToCrop(null);
          setUploadingImage(false);
        }, 'image/jpeg', 0.9);
      };
      img.src = imageToCrop;
    } catch (error) {
      console.error('Error processing image:', error);
      setImageError(error.message || (language === 'hebrew' ? 'שגיאה בעיבוד התמונה' : 'Error processing image'));
      setUploadingImage(false);
      setShowCropModal(false);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

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
        {/* Profile Photo Section */}
        <div className={`${themeClasses.bgCard} border border-emerald-500/20 rounded-2xl p-5 shadow-lg shadow-emerald-500/5`}>
          <div className="flex items-start gap-4">
            {/* Profile Photo Display */}
            <div className="relative flex-shrink-0">
              <div 
                onClick={handleImageClick}
                className={`relative w-24 h-24 rounded-full overflow-hidden cursor-pointer transition-all duration-300 ${
                uploadingImage 
                  ? 'ring-2 ring-gray-400/50' 
                  : 'ring-2 ring-emerald-500/30 hover:ring-emerald-500/50 shadow-lg'
              }`}
              >
                {profileData.profileImageUrl ? (
                  <img 
                    src={profileData.profileImageUrl} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                    <svg className="w-10 h-10 text-white/90" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                    </svg>
                  </div>
                )}
                
                {/* Upload overlay */}
                {uploadingImage && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center backdrop-blur-sm">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/30 border-t-white"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className={`${themeClasses.textPrimary} text-base font-semibold mb-3`}>
                {language === 'hebrew' ? 'תמונת פרופיל' : 'Profile Photo'}
              </h3>
              
              <button
                onClick={handleImageClick}
                disabled={uploadingImage}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                  uploadingImage 
                    ? 'bg-gray-400/50 cursor-not-allowed text-gray-600' 
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {uploadingImage ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {language === 'hebrew' ? 'מעלה...' : 'Uploading...'}
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {language === 'hebrew' ? 'העלה תמונה' : 'Upload Photo'}
                  </span>
                )}
              </button>

              {/* Info Text */}
              <p className={`${themeClasses.textSecondary} text-xs mt-3`}>
                {language === 'hebrew' 
                  ? 'JPG, PNG, GIF, WebP (מקסימום 5MB)'
                  : 'JPG, PNG, GIF, WebP (max 5MB)'}
              </p>

              {/* Error Message */}
              {imageError && (
                <div className="mt-3 px-3 py-2 bg-red-500/10 dark:bg-red-900/20 border border-red-400/30 dark:border-red-600/30 text-red-600 dark:text-red-400 rounded-lg text-xs">
                  {imageError}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Crop Modal */}
        {showCropModal && imageToCrop && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => !uploadingImage && setShowCropModal(false)}>
            <div className={`${themeClasses.bgCard} rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-2xl`} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`${themeClasses.textPrimary} text-xl font-bold`}>
                  {language === 'hebrew' ? 'התאם את התמונה' : 'Adjust Your Photo'}
                </h3>
                <button
                  onClick={() => {
                    setShowCropModal(false);
                    setImageToCrop(null);
                  }}
                  className={`${themeClasses.textSecondary} hover:${themeClasses.textPrimary} transition-colors`}
                  disabled={uploadingImage}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <p className={`${themeClasses.textSecondary} text-sm mb-4`}>
                  {language === 'hebrew' 
                    ? 'גרור את התמונה כדי למקם את הפנים במרכז.'
                    : 'Drag the image to position your face in the center.'}
                </p>
                
                <div 
                  ref={containerRef}
                  className="relative w-full aspect-square bg-gray-900 rounded-lg overflow-hidden border-2 border-emerald-500/50"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                >
                  <img
                    ref={imageRef}
                    src={imageToCrop}
                    alt="Crop preview"
                    className="absolute select-none"
                    style={{
                      transform: `translate(${cropImage.x}px, ${cropImage.y}px)`,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      pointerEvents: 'none'
                    }}
                    draggable={false}
                  />
                  
                  {/* Crop overlay circle */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-3/4 h-3/4 rounded-full border-4 border-emerald-500 shadow-lg ring-4 ring-black/50"></div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => {
                    setShowCropModal(false);
                    setImageToCrop(null);
                    setCropImage({ x: 0, y: 0 });
                  }}
                  className={`px-4 py-2 rounded-lg ${themeClasses.bgSecondary} ${themeClasses.textPrimary} hover:opacity-80 transition-opacity`}
                  disabled={uploadingImage}
                >
                  {language === 'hebrew' ? 'ביטול' : 'Cancel'}
                </button>
                
                <button
                  onClick={handleCropAndUpload}
                  disabled={uploadingImage}
                  className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 ${
                    uploadingImage
                      ? 'bg-gray-400 cursor-not-allowed text-gray-600'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg hover:shadow-xl'
                  }`}
                >
                  {uploadingImage ? (
                    <span className="flex items-center">
                      <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {language === 'hebrew' ? 'מעלה...' : 'Uploading...'}
                    </span>
                  ) : (
                    language === 'hebrew' ? 'שמור והעלה' : 'Save & Upload'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

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
                <option value="israel">{language === 'hebrew' ? 'ישראל' : 'Israel'}</option>
                <option value="japan">{language === 'hebrew' ? 'יפן' : 'Japan'}</option>
                <option value="korea">{language === 'hebrew' ? 'קוריאה' : 'Korea'}</option>
                <option value="greater_china">{language === 'hebrew' ? 'סין/הונג קונג/טאיוואן' : 'Greater China (China/Hong Kong/Taiwan)'}</option>
                <option value="india_south_asia">{language === 'hebrew' ? 'הודו / דרום אסיה' : 'India / South Asia'}</option>
                <option value="southeast_asia">{language === 'hebrew' ? 'דרום־מזרח אסיה' : 'Southeast Asia'}</option>
                <option value="indonesia_malaysia">{language === 'hebrew' ? 'אינדונזיה/מלזיה' : 'Indonesia/Malaysia'}</option>
                <option value="turkey">{language === 'hebrew' ? 'טורקיה' : 'Turkey'}</option>
                <option value="persian_iranian">{language === 'hebrew' ? 'איראן/פרס' : 'Persian/Iranian'}</option>
                <option value="gulf_arabia">{language === 'hebrew' ? 'העולם הערבי-מפרץ' : 'Gulf Arabia'}</option>
                <option value="north_africa">{language === 'hebrew' ? 'צפון אפריקה' : 'North Africa'}</option>
                <option value="east_africa">{language === 'hebrew' ? 'אפריקה מזרחית' : 'East Africa'}</option>
                <option value="europe_mediterranean">{language === 'hebrew' ? 'אירופה - ים תיכוני' : 'Europe - Mediterranean'}</option>
                <option value="europe_west">{language === 'hebrew' ? 'אירופה - מרכז/מערב' : 'Europe - Central/West'}</option>
                <option value="europe_east_russian">{language === 'hebrew' ? 'אירופה - מזרח/רוסי' : 'Europe - East/Russian'}</option>
                <option value="mexico">{language === 'hebrew' ? 'אמריקה לטינית - מקסיקו' : 'Latin America - Mexico'}</option>
                <option value="latam_south_america">{language === 'hebrew' ? 'אמריקה לטינית - דרום אמריקה' : 'Latin America - South America'}</option>
                <option value="caribbean">{language === 'hebrew' ? 'קריביים' : 'Caribbean'}</option>
                <option value="north_america">{language === 'hebrew' ? 'צפון אמריקה' : 'North America'}</option>
                <option value="other">{language === 'hebrew' ? 'אחר' : 'Other'}</option>
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
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('mealPlan'); // 'mealPlan' or 'trainingPlan'
  const [loading, setLoading] = useState(true);
  const [planData, setPlanData] = useState(null);
  const [originalPlanData, setOriginalPlanData] = useState(null);
  const [error, setError] = useState('');
  const [expandedMeals, setExpandedMeals] = useState({});
  const [expandedAlternatives, setExpandedAlternatives] = useState({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [trainingPlanData, setTrainingPlanData] = useState(null);
  const [trainingPlanLoading, setTrainingPlanLoading] = useState(false);
  const [trainingPlanError, setTrainingPlanError] = useState('');
  
  // Menu generation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState('');
  const [clientData, setClientData] = useState(null);
  const [isContactingDietitian, setIsContactingDietitian] = useState(false);
  
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
  // Alternative meal editing state
  const [selectedAlternativeMealIndex, setSelectedAlternativeMealIndex] = useState(null);
  const [selectedAlternativeType, setSelectedAlternativeType] = useState(null); // 'alternative' or 'alternatives'
  const [selectedAlternativeIndex, setSelectedAlternativeIndex] = useState(null); // For alternatives array
  const [isAddAlternativeIngredientModalVisible, setIsAddAlternativeIngredientModalVisible] = useState(false);
  const [isEditAlternativePortionModalVisible, setIsEditAlternativePortionModalVisible] = useState(false);

  // Load training plan when trainingPlan sub-tab is active
  useEffect(() => {
    const loadTrainingPlan = async () => {
      if (!userCode || activeSubTab !== 'trainingPlan') {
        return;
      }

      if (trainingPlanData) {
        return; // Already loaded
      }

      try {
        setTrainingPlanLoading(true);
        setTrainingPlanError('');
        const { data, error } = await getTrainingPlan(userCode);
        
        if (error) {
          console.error('Error loading training plan:', error);
          setTrainingPlanError(error.message);
        } else {
          setTrainingPlanData(data);
        }
      } catch (err) {
        console.error('Error loading training plan:', err);
        setTrainingPlanError(err.message || 'Failed to load training plan');
      } finally {
        setTrainingPlanLoading(false);
      }
    };

    loadTrainingPlan();
  }, [userCode, activeSubTab, trainingPlanData]);

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

  // Load client data for menu generation
  useEffect(() => {
    const loadClientData = async () => {
      if (!userCode) return;
      
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb.onrender.com';
        const response = await fetch(`${apiUrl}/api/profile/client-data-full?userCode=${encodeURIComponent(userCode)}`);
        const result = await response.json();
        
        if (!response.ok) {
          console.error('Error loading client data:', result.error);
          return;
        }
        
        setClientData(result.data);
      } catch (err) {
        console.error('Error fetching client data:', err);
      }
    };
    
    loadClientData();
  }, [userCode]);

  // Function to calculate totals from meals
  const calculateMainTotals = (menu) => {
    if (!menu || !menu.meals) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    
    return menu.meals.reduce((acc, meal) => {
      if (meal.main && meal.main.nutrition) {
        acc.calories += meal.main.nutrition.calories || 0;
        acc.protein += meal.main.nutrition.protein || 0;
        acc.carbs += meal.main.nutrition.carbs || 0;
        acc.fat += meal.main.nutrition.fat || 0;
      }
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  // Generate menu function
  const generateMenu = async () => {
    if (!userCode || !clientData) {
      setError(language === 'hebrew' ? 'נתוני משתמש חסרים' : 'User data missing');
      return;
    }

    // Check if client has daily_target_total_calories
    if (!clientData.daily_target_total_calories) {
      setError(language === 'hebrew' 
        ? 'אנא השלם את תהליך ההזנה הראשוני כדי לחשב יעדים תזונתיים'
        : 'Please complete the onboarding process to calculate nutritional targets');
      return;
    }

    // Check meal plan structure
    const mealPlanStructure = clientData.meal_plan_structure || [];
    if (mealPlanStructure.length === 0) {
      setError(language === 'hebrew'
        ? 'אנא הגדר את מבנה הארוחות שלך בתהליך ההזנה הראשוני'
        : 'Please set up your meal structure in the onboarding process');
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);
      setGenerationProgress(0);
      setGenerationStep(language === 'hebrew' ? 'מתחיל...' : 'Initializing...');

      console.log('🧠 Generating menu for user:', userCode);
      console.log('🔍 Client data:', clientData);

      // Step 1: Get meal template from API (25% progress)
      setGenerationProgress(5);
      setGenerationStep(language === 'hebrew' ? '🎯 מנתח העדפות...' : '🎯 Analyzing preferences...');

      const templateRes = await fetch("https://dietitian-be.azurewebsites.net/api/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          user_code: userCode,
          meal_structure: mealPlanStructure 
        })
      });

      console.log('📡 Template API response status:', templateRes.status);

      if (!templateRes.ok) {
        const errorText = await templateRes.text();
        console.error('❌ Template API error response:', errorText);
        if (templateRes.status === 404) {
          throw new Error(language === 'hebrew' 
            ? 'לא נמצא משתמש במערכת'
            : 'Client not found in the database');
        } else if (templateRes.status === 500) {
          throw new Error(language === 'hebrew' 
            ? 'שגיאת שרת בניתוח העדפות'
            : 'Server error while analyzing preferences');
        } else {
          throw new Error(language === 'hebrew'
            ? 'אנא השלם את כל פרטי הלקוח בעמוד הלקוח ונסה שוב'
            : 'Please complete all client data and try again');
        }
      }

      const templateData = await templateRes.json();
      console.log('📋 Template API response data:', templateData);

      if (templateData.error) {
        throw new Error(templateData.error);
      }

      if (!templateData.template) {
        throw new Error(language === 'hebrew' 
          ? 'לא נוצרה תבנית ארוחות'
          : 'No meal template was generated');
      }

      const template = templateData.template;
      console.log('✅ Template received:', template);
      setGenerationProgress(25);
      setGenerationStep(language === 'hebrew' ? '✅ ניתוח הושלם!' : '✅ Analysis complete!');

      // Step 2: Build menu (progress 30-99%)
      setGenerationProgress(30);
      setGenerationStep(language === 'hebrew' ? '🍽️ יוצר ארוחות מותאמות אישית...' : '🍽️ Creating personalized meals...');

      // Gradual progress animation
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev >= 99) {
            clearInterval(progressInterval);
            return 99;
          }
          return prev + 1;
        });
      }, 2000);

      const buildRes = await fetch("https://dietitian-be.azurewebsites.net/api/build-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template, user_code: userCode }),
      });

      clearInterval(progressInterval);

      if (!buildRes.ok) {
        const errText = await buildRes.text().catch(() => '');
        throw new Error(language === 'hebrew'
          ? `שגיאה ביצירת תפריט (${buildRes.status})`
          : `Unable to create menu (Error ${buildRes.status})`);
      }

      const buildData = await buildRes.json();

      if (buildData.error) {
        throw new Error(buildData.error);
      }

      if (!buildData.menu) {
        throw new Error(language === 'hebrew' ? 'לא נוצרו ארוחות' : 'No meals were created');
      }

      setGenerationProgress(60);
      setGenerationStep(language === 'hebrew' ? '🔢 מחשב ערכים תזונתיים...' : '🔢 Calculating nutrition values...');

      const menuData = {
        meals: buildData.menu,
        totals: calculateMainTotals({ meals: buildData.menu }),
        note: buildData.note || ''
      };

      setGenerationProgress(70);
      setGenerationStep(language === 'hebrew' ? '💾 שומר תפריט...' : '💾 Saving menu...');

      // Auto-save to both databases immediately
      console.log('💾 Auto-saving menu data:', menuData);
      
      const newPlanId = crypto.randomUUID();
      const now = new Date().toISOString();
      const dailyCalories = clientData.daily_target_total_calories || null;
      const macros = clientData.macros || null;
      
      // Get client name for meal plan name
      const clientName = clientData.full_name || 
                        (clientData.first_name && clientData.last_name ? `${clientData.first_name} ${clientData.last_name}`.trim() : '') ||
                        clientData.first_name || 
                        clientData.last_name || 
                        'Client';
      const mealPlanName = `${clientName}'s Meal Plan`;

      // Save to both databases via API
      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb.onrender.com';
      const saveResponse = await fetch(`${apiUrl}/api/profile/meal-plan/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: newPlanId,
          userCode,
          mealPlanName,
          template,
          menuData,
          dailyCalories,
          macros
        })
      });

      const saveResult = await saveResponse.json();

      if (!saveResponse.ok) {
        console.error('❌ Error saving meal plan:', saveResult.error);
        throw new Error(language === 'hebrew' 
          ? 'שגיאה בשמירת תוכנית התזונה'
          : 'Error saving meal plan');
      }

      console.log('✅ Menu saved successfully to both databases!');

      setGenerationProgress(85);
      setGenerationStep(language === 'hebrew' ? '🌐 מכין תצוגה...' : '🌐 Preparing display...');

      // Translate if needed
      if (language === 'hebrew') {
        setGenerationStep(language === 'hebrew' ? '🌐 מתרגם לעברית...' : '🌐 Translating to Hebrew...');
        const translatedMenu = await translateMenu(menuData, 'he');
        setPlanData({
          meal_plan: translatedMenu,
          totals: menuData.totals,
          meals: translatedMenu.meals
        });
      } else {
        setPlanData({
          meal_plan: menuData,
          totals: menuData.totals,
          meals: menuData.meals
        });
      }

      setGenerationProgress(100);
      setGenerationStep(language === 'hebrew' ? '🎉 התפריט מוכן ונשמר!' : '🎉 Menu saved successfully!');

      // Clear progress and reload to show the saved meal plan
      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationStep('');
        setError(null);
        window.location.reload();
      }, 1500);

    } catch (err) {
      console.error("Error generating menu:", err);
      setError(err.message || (language === 'hebrew' 
        ? 'שגיאה ביצירת תפריט. אנא נסה שוב.'
        : 'Error generating menu. Please try again.'));
      setGenerationProgress(0);
      setGenerationStep('');
    } finally {
      setIsGenerating(false);
    }
  };

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
            
      </div>

          {/* Generate Menu Button - Only show if onboarding is fully completed */}
          {clientData && 
           clientData.onboarding_completed && 
           clientData.meal_plan_structure && 
           clientData.meal_plan_structure.length > 0 && (
            <div className="mb-8">
              <button
                onClick={generateMenu}
                disabled={isGenerating}
                className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg ${
                  isGenerating
                    ? 'bg-gray-600 cursor-not-allowed opacity-60'
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 transform hover:scale-105'
                } text-white flex items-center justify-center gap-3`}
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    <span>{generationStep || (language === 'hebrew' ? 'יוצר תפריט...' : 'Generating Menu...')}</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">🎯</span>
                    <span>{language === 'hebrew' ? 'צור תפריט אוטומטי' : 'Generate Automatic Menu'}</span>
                  </>
                )}
              </button>
              
              {/* Progress Bar */}
              {isGenerating && generationProgress > 0 && (
                <div className="mt-4">
                  <div className="w-full bg-gray-700/50 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-3 rounded-full transition-all duration-500 ease-out shadow-lg shadow-emerald-500/50"
                      style={{ width: `${generationProgress}%` }}
                    ></div>
                  </div>
                  <p className={`${themeClasses.textSecondary} text-sm text-center mt-2`}>
                    {Math.round(generationProgress)}% - {generationStep}
                  </p>
                </div>
              )}
              
              {/* Error Message */}
              {error && !isGenerating && (
                <div className="mt-4 p-4 bg-red-500/10 border-2 border-red-500/30 text-red-400 rounded-xl backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">{error}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Onboarding Required Message */}
          {clientData && !clientData.onboarding_completed && (
            <div className="mb-8">
              <div className={`${themeClasses.bgSecondary} rounded-xl p-6 border-2 border-amber-500/50 shadow-lg`}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className={`${themeClasses.textPrimary} font-bold text-lg mb-2`}>
                      {language === 'hebrew' ? 'השלם את תהליך ההזנה הראשוני' : 'Complete Your Onboarding'}
                    </h3>
                    <p className={`${themeClasses.textSecondary} text-sm mb-3`}>
                      {language === 'hebrew'
                        ? 'כדי ליצור תפריט אוטומטי, אנא השלם את כל השדות בתהליך ההזנה הראשוני בעמוד הפרופיל.'
                        : 'To generate an automatic menu, please complete all fields in the onboarding process on your profile page.'}
                    </p>
                    <p className={`${themeClasses.textSecondary} text-xs`}>
                      {language === 'hebrew'
                        ? 'דרוש: פרטים אישיים, משקל וגובה, מטרות, העדפות תזונתיות, ומבנה ארוחות.'
                        : 'Required: Personal details, weight & height, goals, dietary preferences, and meal structure.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
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

  // Toggle alternatives expansion
  const toggleAlternativesExpansion = (mealIndex) => {
    setExpandedAlternatives(prev => ({
      ...prev,
      [mealIndex]: !prev[mealIndex]
    }));
  };

  // Open add ingredient modal
  const handleOpenAddIngredient = (mealIndex) => {
    setSelectedMealIndex(mealIndex);
    setIsAddIngredientModalVisible(true);
  };

  // Open add ingredient modal for alternative meal
  const handleOpenAddAlternativeIngredient = (mealIndex, alternativeType, alternativeIndex = null) => {
    setSelectedAlternativeMealIndex(mealIndex);
    setSelectedAlternativeType(alternativeType);
    setSelectedAlternativeIndex(alternativeIndex);
    setIsAddAlternativeIngredientModalVisible(true);
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

      // Save via API
      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb.onrender.com';
      const response = await fetch(`${apiUrl}/api/profile/meal-plan/save-edited`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: updatedPlanData.id,
          mealPlan: mealPlanToSave
        })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error saving meal plan:', result.error);
        throw new Error(result.error);
      }

      console.log('✅ Meal plan saved successfully for today');
    } catch (error) {
      console.error('Error in saveMealPlanToDatabase:', error);
      throw error;
    }
  };

  // Add ingredient to alternative meal
  const handleAddAlternativeIngredient = async (ingredient) => {
    if (selectedAlternativeMealIndex === null || !planData || selectedAlternativeType === null) return;

    try {
      ensureOriginalPlanData();

      const updatedPlanData = { ...planData };
      const updatedMeals = [...updatedPlanData.meals];
      const mealToUpdate = { ...updatedMeals[selectedAlternativeMealIndex] };

      let alternativeMeal;
      if (selectedAlternativeType === 'alternative') {
        alternativeMeal = mealToUpdate.alternative;
      } else if (selectedAlternativeType === 'alternatives' && selectedAlternativeIndex !== null) {
        alternativeMeal = mealToUpdate.alternatives[selectedAlternativeIndex];
      }

      if (!alternativeMeal) return;

      // Initialize ingredients array if it doesn't exist
      if (!alternativeMeal.ingredients) {
        alternativeMeal.ingredients = [];
      }

      // Add the new ingredient
      alternativeMeal.ingredients = [...alternativeMeal.ingredients, ingredient];

      // Update nutrition values
      const currentNutrition = alternativeMeal.nutrition || {};
      alternativeMeal.nutrition = {
        calories: (currentNutrition.calories || 0) + ingredient.calories,
        protein: (currentNutrition.protein || 0) + ingredient.protein,
        carbs: (currentNutrition.carbs || 0) + ingredient.carbs,
        fat: (currentNutrition.fat || 0) + ingredient.fat,
      };

      // Update the meal in the meals array
      updatedMeals[selectedAlternativeMealIndex] = mealToUpdate;
      updatedPlanData.meals = updatedMeals;

      // Recalculate totals (only from main meals)
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
      updatedPlanData.isClientEdited = true;

      setPlanData(updatedPlanData);
      await saveMealPlanToDatabase(updatedPlanData, updatedMeals);

      setIsAddAlternativeIngredientModalVisible(false);
      setSelectedAlternativeMealIndex(null);
      setSelectedAlternativeType(null);
      setSelectedAlternativeIndex(null);

      alert(
        language === 'hebrew'
          ? 'המרכיב נוסף בהצלחה לארוחה החלופית'
          : 'Ingredient added successfully to the alternative meal'
      );
    } catch (error) {
      console.error('Error adding alternative ingredient:', error);
      alert(
        language === 'hebrew'
          ? 'לא ניתן להוסיף את המרכיב. נסה שוב.'
          : 'Failed to add ingredient. Please try again.'
      );
    }
  };

  // Handle edit alternative ingredient
  const handleEditAlternativeIngredient = (mealIndex, alternativeType, alternativeIndex, ingredientIndex, ingredient) => {
    setSelectedAlternativeMealIndex(mealIndex);
    setSelectedAlternativeType(alternativeType);
    setSelectedAlternativeIndex(alternativeIndex);
    setEditingIngredientIndex(ingredientIndex);
    setEditingIngredient({
      ...ingredient,
      displayName: ingredient.item || ingredient.name || 'Unknown item',
      calories: ingredient.calories || 0,
      protein: ingredient.protein || 0,
      carbs: ingredient.carbs || 0,
      fat: ingredient.fat || 0,
    });
    setIsEditAlternativePortionModalVisible(true);
  };

  // Handle update alternative ingredient portion
  const handleUpdateAlternativeIngredientPortion = async ({ quantity: quantityNum, householdMeasure }) => {
    if (selectedAlternativeMealIndex === null || editingIngredientIndex === null || !planData || !editingIngredient || selectedAlternativeType === null) return;

    try {
      ensureOriginalPlanData();

      const updatedPlanData = { ...planData };
      const updatedMeals = [...updatedPlanData.meals];
      const mealToUpdate = { ...updatedMeals[selectedAlternativeMealIndex] };

      let alternativeMeal;
      if (selectedAlternativeType === 'alternative') {
        alternativeMeal = mealToUpdate.alternative;
      } else if (selectedAlternativeType === 'alternatives' && selectedAlternativeIndex !== null) {
        alternativeMeal = mealToUpdate.alternatives[selectedAlternativeIndex];
      }

      if (!alternativeMeal || !alternativeMeal.ingredients) return;

      const oldIngredient = alternativeMeal.ingredients[editingIngredientIndex];

      const originalScale = (oldIngredient['portionSI(gram)'] || 100) / 100;
      const original100gCalories = oldIngredient.calories / originalScale;
      const original100gProtein = oldIngredient.protein / originalScale;
      const original100gCarbs = oldIngredient.carbs / originalScale;
      const original100gFat = oldIngredient.fat / originalScale;

      const newScale = quantityNum / 100;
      const updatedIngredient = {
        UPC: oldIngredient.UPC || null,
        item: oldIngredient.item,
        'brand of product': oldIngredient['brand of product'] || '',
        household_measure: householdMeasure,
        'portionSI(gram)': quantityNum,
        calories: Math.round(original100gCalories * newScale),
        protein: Math.round(original100gProtein * newScale * 10) / 10,
        carbs: Math.round(original100gCarbs * newScale * 10) / 10,
        fat: Math.round(original100gFat * newScale * 10) / 10,
      };

      alternativeMeal.ingredients[editingIngredientIndex] = updatedIngredient;

      // Recalculate alternative meal nutrition
      alternativeMeal.nutrition = alternativeMeal.ingredients.reduce(
        (acc, ing) => ({
          calories: acc.calories + (ing.calories || 0),
          protein: acc.protein + (ing.protein || 0),
          carbs: acc.carbs + (ing.carbs || 0),
          fat: acc.fat + (ing.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      updatedMeals[selectedAlternativeMealIndex] = mealToUpdate;
      updatedPlanData.meals = updatedMeals;

      // Recalculate totals (only from main meals)
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
      updatedPlanData.isClientEdited = true;

      setPlanData(updatedPlanData);
      await saveMealPlanToDatabase(updatedPlanData, updatedMeals);

      setIsEditAlternativePortionModalVisible(false);
      setEditingIngredient(null);
      setEditingIngredientIndex(null);
      setSelectedAlternativeMealIndex(null);
      setSelectedAlternativeType(null);
      setSelectedAlternativeIndex(null);

      alert(
        language === 'hebrew'
          ? 'המרכיב עודכן בהצלחה'
          : 'Ingredient updated successfully'
      );
    } catch (error) {
      console.error('Error updating alternative ingredient:', error);
      alert(
        language === 'hebrew'
          ? 'לא ניתן לעדכן את המרכיב. נסה שוב.'
          : 'Failed to update ingredient. Please try again.'
      );
    }
  };

  // Handle delete alternative ingredient
  const handleDeleteAlternativeIngredient = async (mealIndex, alternativeType, alternativeIndex, ingredientIndex) => {
    if (!planData) return;

    if (!window.confirm(
      language === 'hebrew'
        ? 'האם אתה בטוח שברצונך למחוק מרכיב זה?'
        : 'Are you sure you want to delete this ingredient?'
    )) {
      return;
    }

    try {
      ensureOriginalPlanData();

      const updatedPlanData = { ...planData };
      const updatedMeals = [...updatedPlanData.meals];
      const mealToUpdate = { ...updatedMeals[mealIndex] };

      let alternativeMeal;
      if (alternativeType === 'alternative') {
        alternativeMeal = mealToUpdate.alternative;
      } else if (alternativeType === 'alternatives' && alternativeIndex !== null) {
        alternativeMeal = mealToUpdate.alternatives[alternativeIndex];
      }

      if (!alternativeMeal || !alternativeMeal.ingredients) return;

      alternativeMeal.ingredients.splice(ingredientIndex, 1);

      // Recalculate alternative meal nutrition
      alternativeMeal.nutrition = alternativeMeal.ingredients.reduce(
        (acc, ing) => ({
          calories: acc.calories + (ing.calories || 0),
          protein: acc.protein + (ing.protein || 0),
          carbs: acc.carbs + (ing.carbs || 0),
          fat: acc.fat + (ing.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      updatedMeals[mealIndex] = mealToUpdate;
      updatedPlanData.meals = updatedMeals;

      // Recalculate totals (only from main meals)
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
      updatedPlanData.isClientEdited = true;

      setPlanData(updatedPlanData);
      await saveMealPlanToDatabase(updatedPlanData, updatedMeals);

      alert(
        language === 'hebrew'
          ? 'המרכיב נמחק בהצלחה'
          : 'Ingredient deleted successfully'
      );
    } catch (error) {
      console.error('Error deleting alternative ingredient:', error);
      alert(
        language === 'hebrew'
          ? 'לא ניתן למחוק את המרכיב. נסה שוב.'
          : 'Failed to delete ingredient. Please try again.'
      );
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
      // Clear the edited plan from database via API
      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb.onrender.com';
      const response = await fetch(`${apiUrl}/api/profile/meal-plan/clear-edited`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: planData.id })
      });

      if (!response.ok) {
        console.error('Error clearing edited plan');
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

  // Handle contact dietitian button click
  const handleContactDietitian = async () => {
    if (!userCode || !user) {
      alert(
        language === 'hebrew'
          ? 'שגיאה: לא ניתן לזהות את המשתמש'
          : 'Error: Unable to identify user'
      );
      return;
    }

    try {
      setIsContactingDietitian(true);

      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb.onrender.com';

      // Get provider_id from chat_users table
      const providerResponse = await fetch(`${apiUrl}/api/profile/provider?userCode=${encodeURIComponent(userCode)}`);
      const providerResult = await providerResponse.json();

      if (!providerResponse.ok) {
        throw new Error(
          language === 'hebrew'
            ? 'לא נמצא דיאטנית משויכת'
            : 'No associated dietitian found'
        );
      }

      const providerId = providerResult.provider_id;
      if (!providerId) {
        throw new Error(
          language === 'hebrew'
            ? 'לא נמצא דיאטנית משויכת'
            : 'No associated dietitian found'
        );
      }

      // Check if a request already exists for this client
      const requestTitle = language === 'hebrew'
        ? 'בקשה לתוכנית תזונה מותאמת'
        : 'Request for Personalized Meal Plan';
      
      const checkResponse = await fetch(
        `${apiUrl}/api/profile/system-message-exists?` + 
        `providerId=${encodeURIComponent(providerId)}&` +
        `userCode=${encodeURIComponent(userCode)}&` +
        `title=${encodeURIComponent(requestTitle)}`
      );
      const checkResult = await checkResponse.json();

      if (checkResponse.ok && checkResult.exists) {
        // Request already exists
        alert(
          language === 'hebrew'
            ? 'הבקשה כבר נשלחה בעבר. ניצור איתכם קשר בקרוב!'
            : 'Request already sent. We will contact you soon!'
        );
        setIsContactingDietitian(false);
        return;
      }

      // Create system message in secondary database
      const messageResponse = await fetch(`${apiUrl}/api/profile/system-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: requestTitle,
          content: language === 'hebrew'
            ? `הלקוח ${userCode} מבקש תוכנית תזונה מותאמת ומדויקת יותר.`
            : `Client ${userCode} is requesting a better and more precise personalized meal plan.`,
          messageType: 'info',
          priority: 'medium',
          directedTo: providerId
        })
      });

      const messageResult = await messageResponse.json();

      if (!messageResponse.ok) {
        console.error('Error creating system message:', messageResult.error);
        throw new Error(
          language === 'hebrew'
            ? `שגיאה בשליחת הבקשה: ${messageResult.error || 'שגיאה לא ידועה'}`
            : `Error sending request: ${messageResult.error || 'Unknown error'}`
        );
      }

      // Show success message
      alert(
        language === 'hebrew'
          ? 'ניצור איתכם קשר בקרוב!'
          : 'We will contact you soon!'
      );
    } catch (error) {
      console.error('Error contacting dietitian:', error);
      alert(
        error.message ||
        (language === 'hebrew'
          ? 'שגיאה בשליחת הבקשה. אנא נסה שוב מאוחר יותר.'
          : 'Error sending request. Please try again later.')
      );
    } finally {
      setIsContactingDietitian(false);
    }
  };

  return (
    <div className={`min-h-screen p-4 sm:p-6 md:p-8 animate-fadeIn`}>
      {/* Sub-tabs Navigation */}
      <div className={`mb-4 sm:mb-6 flex gap-1 sm:gap-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <button
          onClick={() => setActiveSubTab('mealPlan')}
          className={`px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all duration-300 border-b-2 ${
            activeSubTab === 'mealPlan'
              ? `${themeClasses.textPrimary} border-emerald-500`
              : `${themeClasses.textSecondary} border-transparent hover:border-emerald-500/50`
          }`}
        >
          {language === 'hebrew' ? 'תוכנית תזונה' : 'Meal Plan'}
        </button>
        <button
          onClick={() => setActiveSubTab('trainingPlan')}
          className={`px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all duration-300 border-b-2 ${
            activeSubTab === 'trainingPlan'
              ? `${themeClasses.textPrimary} border-emerald-500`
              : `${themeClasses.textSecondary} border-transparent hover:border-emerald-500/50`
          }`}
        >
          {language === 'hebrew' ? 'תוכנית אימונים' : 'Training Plan'}
        </button>
      </div>

      {/* Training Plan Sub-tab Content */}
      {activeSubTab === 'trainingPlan' && (
        <TrainingPlanTab
          themeClasses={themeClasses}
          language={language}
          trainingPlanData={trainingPlanData}
          loading={trainingPlanLoading}
          error={trainingPlanError}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Meal Plan Sub-tab Content */}
      {activeSubTab === 'mealPlan' && (
        <>
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
        
 {/* Show message for auto-made plans (when dietitian_id is null) */}
 {planData.dietitian_id === null && (
          <div className="mb-8 sm:mb-10 md:mb-12 animate-slideInUp" style={{ animationDelay: '0.6s' }}>
            <div className="relative rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 border-4 border-blue-500/60 shadow-2xl overflow-hidden" style={{
              background: isDarkMode 
                ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.2) 100%)'
                : 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.15) 100%)',
              backdropFilter: 'blur(10px)'
            }}>
              {/* Decorative gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-indigo-500/10 pointer-events-none" />
              
              <div className="relative z-10 flex items-start gap-5 sm:gap-6 md:gap-8">
                <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/50 animate-pulse">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 pt-1 sm:pt-2">
                  <h4 className={`${themeClasses.textPrimary} text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4 tracking-tight`}>
                    {language === 'hebrew' ? '💡 רוצים תוכנית תזונה מותאמת יותר?' : '💡 Want a More Personalized Meal Plan?'}
                  </h4>
                  <p className={`${themeClasses.textPrimary} text-base sm:text-lg md:text-xl leading-relaxed font-medium mb-4 sm:mb-6`}>
                    {language === 'hebrew'
                      ? 'אם תרצו תוכנית תזונה טובה ומדויקת יותר, תוכלו ליצור קשר עם הדיאטניות שלנו.'
                      : 'If you want a better and more precise meal plan, you can contact our dietitians.'}
                  </p>
                  <button
                    onClick={handleContactDietitian}
                    disabled={isContactingDietitian}
                    className={`w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all duration-200 shadow-lg transform hover:scale-105 ${
                      isContactingDietitian
                        ? 'bg-gray-600 cursor-not-allowed opacity-60'
                        : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white'
                    } flex items-center justify-center gap-2 sm:gap-3`}
                  >
                    {isContactingDietitian ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>{language === 'hebrew' ? 'שולח...' : 'Sending...'}</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>{language === 'hebrew' ? 'צור קשר עם דיאטנית' : 'Contact Dietitian'}</span>
                      </>
                    )}
                  </button>
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
                className={`${themeClasses.bgCard} border border-emerald-500/30 rounded-2xl p-4 sm:p-6 md:p-8 shadow-xl shadow-emerald-500/10 transform hover:scale-[1.02] transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/20 animate-slideInUp group`}
                style={{ animationDelay: `${0.6 + index * 0.1}s` }}
              >
                {/* Meal Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
                  <div className="flex items-center">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mr-3 sm:mr-4 shadow-lg shadow-emerald-500/25">
                      <span className="text-xl sm:text-2xl group-hover:animate-bounce transition-transform duration-300">{getMealIcon(meal.meal)}</span>
                  </div>
                    <div className="text-left">
                      <p className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium mb-1`}>
                        {meal.meal}
                      </p>
                      <h4 className={`${themeClasses.textPrimary} text-base sm:text-lg md:text-xl font-bold tracking-tight`}>
                        {meal.main?.meal_title || meal.main?.meal_name || meal.main?.title || meal.meal}
                      </h4>
                    </div>
                    </div>
                  <div className="flex items-center gap-2 sm:gap-4 self-end sm:self-auto">
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
                <div className={`transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                  {/* Macro Breakdown Bars */}
                  {settings.showMacros && (
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
                  )}

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
                            className={`flex flex-col sm:flex-row items-start sm:items-center ${themeClasses.textSecondary} text-xs sm:text-sm md:text-base group`}
                          >
                            <div className="flex items-center w-full sm:w-auto">
                              <div className="w-2 h-2 sm:w-3 sm:h-3 bg-emerald-500 rounded-full mr-2 sm:mr-4 animate-pulse flex-shrink-0 mt-1.5 sm:mt-0"></div>
                              <span className="font-medium flex-1 sm:flex-none">
                                {ingredient.item || ingredient.name || 'Unknown item'}
                                {language === 'hebrew' && ' - '}
                              </span>
                            </div>
                            <div className={`flex items-center justify-between sm:justify-end w-full sm:w-auto mt-1 sm:mt-0 ${language === 'hebrew' ? 'sm:mr-2' : 'sm:ml-2'}`}>
                              <span className="font-semibold sm:whitespace-nowrap">
                                {ingredient.household_measure ? (
                                  <>
                                    {ingredient.household_measure}
                                    <span className="text-xs opacity-70 ml-1">({formatWeight(ingredient['portionSI(gram)'] || 0)})</span>
                                  </>
                                ) : (
                                  formatPortion(ingredient)
                                )}
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

                  {/* Alternative Meal Button */}
                  {(meal.alternative || (meal.alternatives && meal.alternatives.length > 0)) && (
                    <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-emerald-500/20">
                      <button
                        onClick={() => toggleAlternativesExpansion(index)}
                        className={`w-full flex items-center justify-between ${themeClasses.bgSecondary} rounded-xl p-4 sm:p-5 hover:${themeClasses.bgPrimary} transition-all duration-300 group`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                            <svg 
                              className={`w-5 h-5 text-white transition-transform duration-300 ${expandedAlternatives[index] ? 'rotate-180' : ''}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                          <div className="text-left">
                            <span className={`${themeClasses.textPrimary} text-sm sm:text-base font-bold`}>
                              {(() => {
                                const altCount = (meal.alternative ? 1 : 0) + (meal.alternatives ? meal.alternatives.length : 0);
                                const hasMultiple = altCount > 1;
                                return hasMultiple 
                                  ? (language === 'hebrew' ? 'ארוחות חלופיות' : 'Alternative Meals')
                                  : (language === 'hebrew' ? 'ארוחה חלופית' : 'Alternative Meal');
                              })()}
                            </span>
                            <p className={`${themeClasses.textSecondary} text-xs sm:text-sm mt-0.5`}>
                              {meal.alternative 
                                ? (language === 'hebrew' ? 'לחץ כדי לראות' : 'Click to view')
                                : `${meal.alternatives.length} ${language === 'hebrew' ? 'אפשרויות' : 'options'}`
                              }
                            </p>
                          </div>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Alternative Meal(s) Display */}
                  {expandedAlternatives[index] && (meal.alternative || (meal.alternatives && meal.alternatives.length > 0)) && (
                    <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
                      {/* Single alternative */}
                      {meal.alternative && (
                        <div className={`${themeClasses.bgSecondary} border border-blue-500/30 rounded-2xl p-4 sm:p-6 shadow-lg`}>
                          <div className="mb-4">
                            <h5 className={`${themeClasses.textPrimary} text-base sm:text-lg font-bold mb-2`}>
                              {meal.alternative.meal_title || meal.alternative.meal_name || meal.meal}
                            </h5>
                            {meal.alternative.nutrition && (settings.showCalories || settings.showMacros) && (
                              <div className="flex flex-wrap gap-3 sm:gap-4 text-sm sm:text-base">
                                {settings.showCalories && (
                                  <span className="text-emerald-400 font-bold">{meal.alternative.nutrition.calories || 0} {language === 'hebrew' ? 'קלוריות' : 'cal'}</span>
                                )}
                                {settings.showMacros && (
                                  <>
                                    <span className={`${themeClasses.textSecondary}`}>
                                      {formatWeight(meal.alternative.nutrition.protein || 0)} {language === 'hebrew' ? 'חלבון' : 'P'}
                                    </span>
                                    <span className={`${themeClasses.textSecondary}`}>
                                      {formatWeight(meal.alternative.nutrition.carbs || 0)} {language === 'hebrew' ? 'פחמימות' : 'C'}
                                    </span>
                                    <span className={`${themeClasses.textSecondary}`}>
                                      {formatWeight(meal.alternative.nutrition.fat || 0)} {language === 'hebrew' ? 'שומן' : 'F'}
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          <div className={`${themeClasses.bgSecondary} rounded-2xl p-4 sm:p-6`}>
                            <div className="flex items-center justify-between mb-3 sm:mb-4">
                              <div className="flex items-center">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-2 sm:mr-3 shadow-lg shadow-blue-500/25">
                                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                                  </svg>
                                </div>
                                <span className={`${themeClasses.textPrimary} text-base sm:text-lg font-bold tracking-tight`}>
                                  {language === 'hebrew' ? 'מרכיבים' : 'Ingredients'}
                                </span>
                                {meal.alternative && meal.alternative.ingredients && (
                                  <span className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium ml-2 sm:ml-3`}>
                                    {meal.alternative.ingredients.length} {language === 'hebrew' ? 'פריטים' : 'Items'}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleOpenAddAlternativeIngredient(index, 'alternative')}
                                className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors shadow-md hover:shadow-lg"
                                title={language === 'hebrew' ? 'הוסף מרכיב' : 'Add ingredient'}
                              >
                                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                            </div>
                            
                            {meal.alternative && meal.alternative.ingredients && meal.alternative.ingredients.length > 0 ? (
                              <div className="space-y-2 sm:space-y-3">
                                {meal.alternative.ingredients.map((ingredient, idx) => (
                                  <div 
                                    key={idx}
                                    className={`flex flex-col sm:flex-row items-start sm:items-center ${themeClasses.textSecondary} text-xs sm:text-sm md:text-base group`}
                                  >
                                    <div className="flex items-center w-full sm:w-auto">
                                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded-full mr-2 sm:mr-4 animate-pulse flex-shrink-0 mt-1.5 sm:mt-0"></div>
                                      <span className="font-medium flex-1 sm:flex-none">
                                        {ingredient.item || ingredient.name || 'Unknown item'}
                                        {language === 'hebrew' && ' - '}
                                      </span>
                                    </div>
                                    <div className={`flex items-center justify-between sm:justify-end w-full sm:w-auto mt-1 sm:mt-0 ${language === 'hebrew' ? 'sm:mr-2' : 'sm:ml-2'}`}>
                                      <span className="font-semibold sm:whitespace-nowrap">
                                        {ingredient.household_measure ? (
                                          <>
                                            {ingredient.household_measure}
                                            <span className="text-xs opacity-70 ml-1">({formatWeight(ingredient['portionSI(gram)'] || 0)})</span>
                                          </>
                                        ) : (
                                          formatPortion(ingredient)
                                        )}
                                      </span>
                                      <div className="flex items-center gap-1 ml-2 sm:ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => handleEditAlternativeIngredient(index, 'alternative', null, idx, ingredient)}
                                          className="w-6 h-6 sm:w-7 sm:h-7 bg-blue-500 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors"
                                          title={language === 'hebrew' ? 'ערוך' : 'Edit'}
                                        >
                                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={() => handleDeleteAlternativeIngredient(index, 'alternative', null, idx)}
                                          className="w-6 h-6 sm:w-7 sm:h-7 bg-red-500 rounded-lg flex items-center justify-center hover:bg-red-600 transition-colors"
                                          title={language === 'hebrew' ? 'מחק' : 'Delete'}
                                        >
                                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </div>
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
                      )}

                      {/* Multiple alternatives */}
                      {meal.alternatives && meal.alternatives.length > 0 && meal.alternatives.map((alt, altIdx) => (
                        <div key={altIdx} className={`${themeClasses.bgSecondary} border border-blue-500/30 rounded-2xl p-4 sm:p-6 shadow-lg`}>
                          <div className="mb-4">
                            <h5 className={`${themeClasses.textPrimary} text-base sm:text-lg font-bold mb-2`}>
                              {alt.meal_title || alt.meal_name || meal.meal}
                            </h5>
                            {alt.nutrition && (settings.showCalories || settings.showMacros) && (
                              <div className="flex flex-wrap gap-3 sm:gap-4 text-sm sm:text-base">
                                {settings.showCalories && (
                                  <span className="text-emerald-400 font-bold">{alt.nutrition.calories || 0} {language === 'hebrew' ? 'קלוריות' : 'cal'}</span>
                                )}
                                {settings.showMacros && (
                                  <>
                                    <span className={`${themeClasses.textSecondary}`}>
                                      {formatWeight(alt.nutrition.protein || 0)} {language === 'hebrew' ? 'חלבון' : 'P'}
                                    </span>
                                    <span className={`${themeClasses.textSecondary}`}>
                                      {formatWeight(alt.nutrition.carbs || 0)} {language === 'hebrew' ? 'פחמימות' : 'C'}
                                    </span>
                                    <span className={`${themeClasses.textSecondary}`}>
                                      {formatWeight(alt.nutrition.fat || 0)} {language === 'hebrew' ? 'שומן' : 'F'}
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          <div className={`${themeClasses.bgSecondary} rounded-2xl p-4 sm:p-6`}>
                            <div className="flex items-center justify-between mb-3 sm:mb-4">
                              <div className="flex items-center">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-2 sm:mr-3 shadow-lg shadow-blue-500/25">
                                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                                  </svg>
                                </div>
                                <span className={`${themeClasses.textPrimary} text-base sm:text-lg font-bold tracking-tight`}>
                                  {language === 'hebrew' ? 'מרכיבים' : 'Ingredients'}
                                </span>
                                {alt.ingredients && (
                                  <span className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium ml-2 sm:ml-3`}>
                                    {alt.ingredients.length} {language === 'hebrew' ? 'פריטים' : 'Items'}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleOpenAddAlternativeIngredient(index, 'alternatives', altIdx)}
                                className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors shadow-md hover:shadow-lg"
                                title={language === 'hebrew' ? 'הוסף מרכיב' : 'Add ingredient'}
                              >
                                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                            </div>
                            
                            {alt.ingredients && alt.ingredients.length > 0 ? (
                              <div className="space-y-2 sm:space-y-3">
                                {alt.ingredients.map((ingredient, idx) => (
                                  <div 
                                    key={idx}
                                    className={`flex flex-col sm:flex-row items-start sm:items-center ${themeClasses.textSecondary} text-xs sm:text-sm md:text-base group`}
                                  >
                                    <div className="flex items-center w-full sm:w-auto">
                                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded-full mr-2 sm:mr-4 animate-pulse flex-shrink-0 mt-1.5 sm:mt-0"></div>
                                      <span className="font-medium flex-1 sm:flex-none">
                                        {ingredient.item || ingredient.name || 'Unknown item'}
                                        {language === 'hebrew' && ' - '}
                                      </span>
                                    </div>
                                    <div className={`flex items-center justify-between sm:justify-end w-full sm:w-auto mt-1 sm:mt-0 ${language === 'hebrew' ? 'sm:mr-2' : 'sm:ml-2'}`}>
                                      <span className="font-semibold sm:whitespace-nowrap">
                                        {ingredient.household_measure ? (
                                          <>
                                            {ingredient.household_measure}
                                            <span className="text-xs opacity-70 ml-1">({formatWeight(ingredient['portionSI(gram)'] || 0)})</span>
                                          </>
                                        ) : (
                                          formatPortion(ingredient)
                                        )}
                                      </span>
                                      <div className="flex items-center gap-1 ml-2 sm:ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => handleEditAlternativeIngredient(index, 'alternatives', altIdx, idx, ingredient)}
                                          className="w-6 h-6 sm:w-7 sm:h-7 bg-blue-500 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors"
                                          title={language === 'hebrew' ? 'ערוך' : 'Edit'}
                                        >
                                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={() => handleDeleteAlternativeIngredient(index, 'alternatives', altIdx, idx)}
                                          className="w-6 h-6 sm:w-7 sm:h-7 bg-red-500 rounded-lg flex items-center justify-center hover:bg-red-600 transition-colors"
                                          title={language === 'hebrew' ? 'מחק' : 'Delete'}
                                        >
                                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </div>
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
                      ))}
                    </div>
                  )}
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
        userCode={userCode}
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

      {/* Add Alternative Ingredient Modal */}
      <AddIngredientModal
        visible={isAddAlternativeIngredientModalVisible}
        onClose={() => {
          setIsAddAlternativeIngredientModalVisible(false);
          setSelectedAlternativeMealIndex(null);
          setSelectedAlternativeType(null);
          setSelectedAlternativeIndex(null);
        }}
        onAddIngredient={handleAddAlternativeIngredient}
        mealName={selectedAlternativeMealIndex !== null && planData?.meals[selectedAlternativeMealIndex]?.meal}
        clientRegion={clientRegion}
        userCode={userCode}
      />

      {/* Edit Alternative Ingredient Portion Modal */}
      <IngredientPortionModal
        visible={isEditAlternativePortionModalVisible}
        onClose={() => {
          setIsEditAlternativePortionModalVisible(false);
          setEditingIngredient(null);
          setEditingIngredientIndex(null);
          setSelectedAlternativeMealIndex(null);
          setSelectedAlternativeType(null);
          setSelectedAlternativeIndex(null);
        }}
        onConfirm={handleUpdateAlternativeIngredientPortion}
        ingredient={editingIngredient}
        clientRegion={clientRegion}
      />
        </>
      )}
    </div>
  );
};

// Training Plan Tab Component
const TrainingPlanTab = ({ themeClasses, language, trainingPlanData, loading, error, isDarkMode }) => {
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [expandedDays, setExpandedDays] = useState({});

  const toggleWeek = (weekNumber) => {
    setExpandedWeeks(prev => ({
      ...prev,
      [weekNumber]: !prev[weekNumber]
    }));
  };

  const toggleDay = (weekNumber, dayNumber) => {
    const key = `${weekNumber}-${dayNumber}`;
    setExpandedDays(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className={themeClasses.textSecondary}>
            {language === 'hebrew' ? 'טוען תוכנית אימונים...' : 'Loading training plan...'}
          </p>
        </div>
      </div>
    );
  }

  if (error || !trainingPlanData) {
    return (
      <div className={`min-h-screen p-4 sm:p-6 md:p-8 animate-fadeIn flex items-center justify-center`}>
        <div className="max-w-2xl w-full text-center">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/25">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h2 className={`${themeClasses.textPrimary} text-3xl sm:text-4xl font-bold mb-4`}>
            {language === 'hebrew' ? 'אין תוכנית אימונים זמינה' : 'No Training Plan Available'}
          </h2>
          <p className={`${themeClasses.textSecondary} text-lg sm:text-xl`}>
            {error 
              ? (language === 'hebrew' ? `שגיאה: ${error}` : `Error: ${error}`)
              : (language === 'hebrew' 
                  ? 'עדיין לא נוצרה עבורך תוכנית אימונים. אנא צור קשר עם המאמן שלך.'
                  : 'No training plan has been created for you yet. Please contact your trainer.')
            }
          </p>
        </div>
      </div>
    );
  }

  const planStructure = trainingPlanData.plan_structure || {};
  const weeks = planStructure.weeks || [];

  return (
    <div className={`min-h-screen p-4 sm:p-6 md:p-8 animate-fadeIn`}>
      {/* Plan Header */}
      <div className="mb-6 sm:mb-8 animate-slideInUp relative rounded-xl p-4 sm:p-6" style={{
        borderLeft: '3px solid',
        borderLeftColor: isDarkMode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)',
        borderRight: '2px solid',
        borderRightColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)',
        borderTop: '2px solid',
        borderTopColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)',
        borderBottom: '2px solid',
        borderBottomColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)',
        boxShadow: isDarkMode 
          ? 'inset 1px 0 0 rgba(59, 130, 246, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)' 
          : 'inset 1px 0 0 rgba(59, 130, 246, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 pointer-events-none rounded-xl" />
        <div className="relative z-10">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4 shadow-lg shadow-blue-500/25">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className={`${themeClasses.textPrimary} text-2xl sm:text-3xl font-bold tracking-tight`}>
                {trainingPlanData.plan_name || (language === 'hebrew' ? 'תוכנית אימונים' : 'Training Plan')}
              </h2>
              {trainingPlanData.description && (
                <p className={`${themeClasses.textSecondary} text-sm sm:text-base mt-1`}>
                  {trainingPlanData.description}
                </p>
              )}
            </div>
          </div>

          {/* Plan Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            {trainingPlanData.goal && (
              <div>
                <p className={`${themeClasses.textSecondary} text-xs sm:text-sm mb-1`}>
                  {language === 'hebrew' ? 'מטרה' : 'Goal'}
                </p>
                <p className={`${themeClasses.textPrimary} text-sm sm:text-base font-semibold`}>
                  {trainingPlanData.goal}
                </p>
              </div>
            )}
            {trainingPlanData.difficulty_level && (
              <div>
                <p className={`${themeClasses.textSecondary} text-xs sm:text-sm mb-1`}>
                  {language === 'hebrew' ? 'רמת קושי' : 'Difficulty'}
                </p>
                <p className={`${themeClasses.textPrimary} text-sm sm:text-base font-semibold`}>
                  {trainingPlanData.difficulty_level}
                </p>
              </div>
            )}
            {trainingPlanData.duration_weeks && (
              <div>
                <p className={`${themeClasses.textSecondary} text-xs sm:text-sm mb-1`}>
                  {language === 'hebrew' ? 'משך זמן' : 'Duration'}
                </p>
                <p className={`${themeClasses.textPrimary} text-sm sm:text-base font-semibold`}>
                  {trainingPlanData.duration_weeks} {language === 'hebrew' ? 'שבועות' : 'weeks'}
                </p>
              </div>
            )}
            {trainingPlanData.weekly_frequency && (
              <div>
                <p className={`${themeClasses.textSecondary} text-xs sm:text-sm mb-1`}>
                  {language === 'hebrew' ? 'תדירות שבועית' : 'Weekly Frequency'}
                </p>
                <p className={`${themeClasses.textPrimary} text-sm sm:text-base font-semibold`}>
                  {trainingPlanData.weekly_frequency} {language === 'hebrew' ? 'פעמים' : 'times/week'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Weeks */}
      {weeks.length > 0 ? (
        <div className="space-y-4">
          {weeks.map((week, weekIndex) => {
            const weekNumber = week.week_number || weekIndex + 1;
            const isWeekExpanded = expandedWeeks[weekNumber];
            
            return (
              <div
                key={weekIndex}
                className={`${themeClasses.bgCard} rounded-xl p-4 sm:p-6 shadow-lg border ${themeClasses.borderPrimary} animate-slideInUp`}
                style={{ animationDelay: `${weekIndex * 0.1}s` }}
              >
                {/* Week Header */}
                <button
                  onClick={() => toggleWeek(weekNumber)}
                  className="w-full flex items-center justify-between mb-4"
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mr-3 shadow-md">
                      <span className="text-white font-bold text-lg">{weekNumber}</span>
                    </div>
                    <div className="text-left">
                      <h3 className={`${themeClasses.textPrimary} text-lg sm:text-xl font-bold`}>
                        {language === 'hebrew' ? `שבוע ${weekNumber}` : `Week ${weekNumber}`}
                      </h3>
                      {week.focus && (
                        <p className={`${themeClasses.textSecondary} text-sm mt-1`}>
                          {week.focus}
                        </p>
                      )}
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 ${themeClasses.textSecondary} transition-transform duration-300 ${isWeekExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Week Days */}
                {isWeekExpanded && week.days && week.days.length > 0 && (
                  <div className="space-y-3 mt-4">
                    {week.days.map((day, dayIndex) => {
                      const dayNumber = day.day_number || dayIndex + 1;
                      const dayKey = `${weekNumber}-${dayNumber}`;
                      const isDayExpanded = expandedDays[dayKey];
                      
                      return (
                        <div
                          key={dayIndex}
                          className={`${themeClasses.bgSecondary} rounded-lg p-4 border ${themeClasses.borderPrimary}`}
                        >
                          {/* Day Header */}
                          <button
                            onClick={() => toggleDay(weekNumber, dayNumber)}
                            className="w-full flex items-center justify-between"
                          >
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                                <span className="text-white font-bold text-sm">{dayNumber}</span>
                              </div>
                              <h4 className={`${themeClasses.textPrimary} text-base sm:text-lg font-semibold`}>
                                {day.day_name || (language === 'hebrew' ? `יום ${dayNumber}` : `Day ${dayNumber}`)}
                              </h4>
                            </div>
                            <svg
                              className={`w-5 h-5 ${themeClasses.textSecondary} transition-transform duration-300 ${isDayExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {/* Exercises */}
                          {isDayExpanded && day.exercises && day.exercises.length > 0 && (
                            <div className="mt-4 space-y-3">
                              {day.exercises
                                .sort((a, b) => (a.order || 0) - (b.order || 0))
                                .map((exercise, exerciseIndex) => (
                                  <div
                                    key={exerciseIndex}
                                    className={`${themeClasses.bgCard} rounded-lg p-4 border ${themeClasses.borderPrimary}`}
                                  >
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1">
                                        <h5 className={`${themeClasses.textPrimary} font-bold text-base mb-1`}>
                                          {exercise.exercise_name}
                                        </h5>
                                        <div className="flex flex-wrap gap-3 text-sm">
                                          <span className={`${themeClasses.textSecondary}`}>
                                            <span className="font-semibold">{language === 'hebrew' ? 'סטים:' : 'Sets:'}</span> {exercise.sets}
                                          </span>
                                          <span className={`${themeClasses.textSecondary}`}>
                                            <span className="font-semibold">{language === 'hebrew' ? 'חזרות:' : 'Reps:'}</span> {exercise.reps}
                                          </span>
                                          {exercise.rest_seconds && (
                                            <span className={`${themeClasses.textSecondary}`}>
                                              <span className="font-semibold">{language === 'hebrew' ? 'מנוחה:' : 'Rest:'}</span> {exercise.rest_seconds}s
                                            </span>
                                          )}
                                          {exercise.target_weight_kg && (
                                            <span className={`${themeClasses.textSecondary}`}>
                                              <span className="font-semibold">{language === 'hebrew' ? 'משקל:' : 'Weight:'}</span> {exercise.target_weight_kg}kg
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    {exercise.notes && (
                                      <p className={`${themeClasses.textSecondary} text-sm mt-2 italic`}>
                                        {exercise.notes}
                                      </p>
                                    )}
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`${themeClasses.bgCard} rounded-xl p-8 text-center`}>
          <p className={themeClasses.textSecondary}>
            {language === 'hebrew' ? 'אין שבועות זמינים בתוכנית' : 'No weeks available in plan'}
          </p>
        </div>
      )}

      {/* Notes */}
      {trainingPlanData.notes && (
        <div className={`${themeClasses.bgCard} rounded-xl p-4 sm:p-6 mt-6 border ${themeClasses.borderPrimary}`}>
          <h3 className={`${themeClasses.textPrimary} font-bold text-lg mb-2`}>
            {language === 'hebrew' ? 'הערות' : 'Notes'}
          </h3>
          <p className={themeClasses.textSecondary}>
            {trainingPlanData.notes}
          </p>
        </div>
      )}
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
                style={{ animation: 'flicker 1.5s ease-in-out infinite' }}
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
                style={{ animation: 'flicker 1.5s ease-in-out infinite' }}
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
                style={{ animation: 'flicker 1.5s ease-in-out infinite' }}
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
                style={{ animation: 'flicker 1.5s ease-in-out infinite' }}
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
                style={{ animation: 'flicker 1.5s ease-in-out infinite' }}
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
                style={{ animation: 'flicker 1.5s ease-in-out infinite' }}
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
                style={{ animation: 'flicker 1.5s ease-in-out infinite' }}
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

// Calendar Picker Component - Compact Design
const CalendarPicker = ({ selectedDate, onDateSelect, themeClasses, isDarkMode, language, direction, clientRegion }) => {
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
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const days = getDaysInMonth();
  const today = new Date();
  const selectedDateObj = new Date(selectedDate);

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Compact Month/Year Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => navigateYear('prev')}
          className={`w-7 h-7 ${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} rounded-md flex items-center justify-center transition-all duration-200 active:scale-95`}
          aria-label={language === 'hebrew' ? 'שנה קודמת' : 'Previous year'}
        >
          <svg className={`w-3 h-3 ${themeClasses.textPrimary} ${direction === 'rtl' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => navigateMonth('prev')}
          className={`w-7 h-7 ${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} rounded-md flex items-center justify-center transition-all duration-200 active:scale-95`}
          aria-label={language === 'hebrew' ? 'חודש קודם' : 'Previous month'}
        >
          <svg className={`w-4 h-4 ${themeClasses.textPrimary} ${direction === 'rtl' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div className={`${themeClasses.textPrimary} font-semibold text-sm sm:text-base px-2`}>
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </div>
        
        <button
          onClick={() => navigateMonth('next')}
          className={`w-7 h-7 ${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} rounded-md flex items-center justify-center transition-all duration-200 active:scale-95`}
          aria-label={language === 'hebrew' ? 'חודש הבא' : 'Next month'}
        >
          <svg className={`w-4 h-4 ${themeClasses.textPrimary} ${direction === 'rtl' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={() => navigateYear('next')}
          className={`w-7 h-7 ${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} rounded-md flex items-center justify-center transition-all duration-200 active:scale-95`}
          aria-label={language === 'hebrew' ? 'שנה הבאה' : 'Next year'}
        >
          <svg className={`w-3 h-3 ${themeClasses.textPrimary} ${direction === 'rtl' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Compact Day Names Header */}
      <div className="grid grid-cols-7 gap-0.5 mb-1.5">
        {dayNames.map((dayName, index) => (
          <div
            key={index}
            className={`${themeClasses.textSecondary} text-[10px] sm:text-xs font-medium text-center py-1`}
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* Compact Calendar Grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const dayDate = day.toISOString().split('T')[0];
          const isToday = day.toDateString() === today.toDateString();
          const isSelected = day.toDateString() === selectedDateObj.toDateString();
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();

          return (
            <button
              key={dayDate}
              onClick={() => onDateSelect(dayDate)}
              className={`aspect-square rounded-md transition-all duration-150 active:scale-90 text-xs sm:text-sm ${
                isSelected
                  ? 'bg-emerald-500 text-white font-bold shadow-md'
                  : isToday
                  ? `${themeClasses.bgSecondary} border border-emerald-500 ${themeClasses.textPrimary} font-semibold`
                  : isCurrentMonth
                  ? `${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} ${themeClasses.textPrimary} hover:bg-emerald-500/20`
                  : `${themeClasses.bgCard} ${themeClasses.textMuted} opacity-40`
              }`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Weekly Summary Component
const WeeklySummaryComponent = ({ userCode, themeClasses, language, isDarkMode, settings, clientRegion, direction, selectedDate, setSelectedDate, onDateClick }) => {
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

  // Generate week dates
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

  // Sync weekStartDate when selectedDate changes externally
  useEffect(() => {
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
    const newWeekStart = startOfWeek.toISOString().split('T')[0];
    setWeekStartDate(prev => {
      if (prev !== newWeekStart) {
        return newWeekStart;
      }
      return prev;
    });
  }, [selectedDate, clientRegion]);

  // Navigate weeks
  const navigateWeek = (direction) => {
    const currentDate = new Date(weekStartDate);
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    setWeekStartDate(newDate.toISOString().split('T')[0]);
  };

  // Load meal plan targets
  useEffect(() => {
    const loadMealPlanTargets = async () => {
      if (!userCode) return;
      try {
        const { data: mealPlanData, error } = await getClientMealPlan(userCode);
        if (!error && mealPlanData) {
          let targets = {
            calories: mealPlanData.daily_total_calories || 2000,
            protein: 150,
            carbs: 250,
            fat: 65
          };
          if (mealPlanData.macros_target) {
            targets = {
              calories: mealPlanData.daily_total_calories || 2000,
              protein: mealPlanData.macros_target.protein || 150,
              carbs: mealPlanData.macros_target.carbs || 250,
              fat: mealPlanData.macros_target.fat || 65
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

  // Load food logs for all days in the week
  useEffect(() => {
    const loadWeekFoodLogs = async () => {
      if (!userCode) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const logsByDate = {};
        
        // Load logs for each day in parallel
        const logPromises = weekDates.map(async (date) => {
          const { data, error } = await getFoodLogs(userCode, date);
          if (!error && data) {
            logsByDate[date] = data || [];
          } else {
            logsByDate[date] = [];
          }
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

  // Calculate totals for a specific date
  const calculateDayTotals = (date) => {
    const logs = weekFoodLogs[date] || [];
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    logs.forEach((log) => {
      const foodItems = parseFoodItems(log);
      const logCaloriesFromItems = foodItems.reduce((sum, item) => sum + (item.cals || 0), 0);
      const logProteinFromItems = foodItems.reduce((sum, item) => sum + (item.p || 0), 0);
      const logCarbsFromItems = foodItems.reduce((sum, item) => sum + (item.c || 0), 0);
      const logFatFromItems = foodItems.reduce((sum, item) => sum + (item.f || 0), 0);
      // Use food_items totals if available, otherwise fallback to old columns
      totalCalories += logCaloriesFromItems > 0 ? logCaloriesFromItems : (log.total_calories || 0);
      totalProtein += logProteinFromItems > 0 ? logProteinFromItems : (log.total_protein_g || 0);
      totalCarbs += logCarbsFromItems > 0 ? logCarbsFromItems : (log.total_carbs_g || 0);
      totalFat += logFatFromItems > 0 ? logFatFromItems : (log.total_fat_g || 0);
    });

    return { totalCalories, totalProtein, totalCarbs, totalFat };
  };

  // Helper functions
  const formatNumber = (num) => {
    const number = typeof num === 'number' ? num : parseFloat(num);
    if (isNaN(number) || number === null || number === undefined) {
      return '0';
    }
    if (settings.decimalPlaces === 0) {
      return Math.round(number).toString();
    }
    return number.toFixed(settings.decimalPlaces);
  };

  const convertWeight = (grams) => {
    const number = typeof grams === 'number' ? grams : parseFloat(grams);
    if (isNaN(number) || number === null || number === undefined) {
      return 0;
    }
    if (settings.weightUnit === 'ounces') {
      return number * 0.035274;
    }
    return number;
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

  const dailyGoals = mealPlanTargets || {
    calories: 2000,
    protein: 150,
    carbs: 250,
    fat: 65
  };

  // Mini SVG Circle Component for each day
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
      <div 
        className={`${themeClasses.bgCard} rounded-xl sm:rounded-2xl p-3 sm:p-4 border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'} hover:border-emerald-500/50 transition-all duration-300 cursor-pointer active:scale-95 overflow-hidden`}
        onClick={() => {
          setSelectedDate(date);
          if (onDateClick) {
            onDateClick();
          }
        }}
      >
        <div className="text-center mb-2 sm:mb-3">
          <div className={`${themeClasses.textSecondary} text-xs font-medium mb-1`}>{dayName}</div>
          <div className={`${themeClasses.textPrimary} text-base sm:text-lg font-bold`}>{dayNumber}</div>
          <div className={`${themeClasses.textMuted} text-xs`}>{monthName}</div>
        </div>
        
        <div className="flex justify-center mb-2 sm:mb-3">
          <svg 
            className="transform -rotate-90 w-24 h-24 sm:w-32 sm:h-32" 
            viewBox="0 0 120 120"
          >
            {/* Outer Circle Background */}
            <circle
              cx="60"
              cy="60"
              r={outerRadius}
              fill="none"
              stroke={isDarkMode ? 'rgba(100, 100, 100, 0.15)' : 'rgba(200, 200, 200, 0.2)'}
              strokeWidth="4"
            />
            
            {/* Inner Circle Background */}
            <circle
              cx="60"
              cy="60"
              r={innerRadius}
              fill="none"
              stroke={isDarkMode ? 'rgba(100, 100, 100, 0.15)' : 'rgba(200, 200, 200, 0.2)'}
              strokeWidth="4"
            />
            
            {/* Outer Circle - Calories */}
            {settings.showCalories && caloriesNormalLength > 0 && (
              <circle
                cx="60"
                cy="60"
                r={outerRadius}
                fill="none"
                stroke="#10b981"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${caloriesNormalLength} ${outerCircumference}`}
                className="transition-all duration-1000 ease-out"
              />
            )}
            
            {/* Inner Circle - Macros */}
            {settings.showMacros && (
              <>
                {proteinNormalLength > 0 && (
                  <circle
                    cx="60"
                    cy="60"
                    r={innerRadius}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${proteinNormalLength} ${circumference}`}
                    strokeDashoffset="0"
                    className="transition-all duration-1000 ease-out"
                  />
                )}
                {carbsNormalLength > 0 && (
                  <circle
                    cx="60"
                    cy="60"
                    r={innerRadius}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${carbsNormalLength} ${circumference}`}
                    strokeDashoffset={-segmentLength}
                    className="transition-all duration-1000 ease-out"
                  />
                )}
                {fatNormalLength > 0 && (
                  <circle
                    cx="60"
                    cy="60"
                    r={innerRadius}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${fatNormalLength} ${circumference}`}
                    strokeDashoffset={-segmentLength * 2}
                    className="transition-all duration-1000 ease-out"
                  />
                )}
              </>
            )}
          </svg>
        </div>

        {/* Center Calories */}
        <div className="text-center mb-2">
          <div className={`${themeClasses.textPrimary} text-lg sm:text-xl font-bold`}>
            {totals.totalCalories.toLocaleString()}
          </div>
          <div className={`${themeClasses.textMuted} text-xs`}>
            {language === 'hebrew' ? 'קלוריות' : 'calories'}
          </div>
        </div>

        {/* Macro Summary */}
        {settings.showMacros && (
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0"></div>
                <span className={`${themeClasses.textMuted} text-xs`}>P</span>
              </div>
              <div className="text-purple-400 font-medium text-xs">
                {formatWeight(totals.totalProtein)}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0"></div>
                <span className={`${themeClasses.textMuted} text-xs`}>C</span>
              </div>
              <div className="text-blue-400 font-medium text-xs">
                {formatWeight(totals.totalCarbs)}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"></div>
                <span className={`${themeClasses.textMuted} text-xs`}>F</span>
              </div>
              <div className="text-amber-400 font-medium text-xs">
                {formatWeight(totals.totalFat)}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className={themeClasses.textSecondary}>
            {language === 'hebrew' ? 'טוען סיכום שבועי...' : 'Loading weekly summary...'}
          </p>
        </div>
      </div>
    );
  }

  const weekStartObj = new Date(weekStartDate);
  const weekEndObj = new Date(weekStartDate);
  weekEndObj.setDate(weekStartObj.getDate() + 6);

  return (
    <div className="animate-fadeIn">
      {/* Week Navigation */}
      <div className={`mb-6 ${themeClasses.bgCard} rounded-xl p-3 sm:p-4 border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        {/* Title */}
        <div className="mb-3 sm:mb-4">
          <h2 className={`${themeClasses.textPrimary} text-xl sm:text-2xl font-bold`}>
            {language === 'hebrew' ? 'סיכום שבועי' : 'Weekly Summary'}
          </h2>
        </div>
        
        {/* Navigation Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-2">
          {/* Date Navigation */}
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-1">
            <button 
              onClick={() => navigateWeek('prev')}
              className={`w-10 h-10 sm:w-10 sm:h-10 ${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} rounded-lg flex items-center justify-center transition-all duration-300 active:scale-95 flex-shrink-0`}
              aria-label={language === 'hebrew' ? 'שבוע קודם' : 'Previous week'}
            >
              <svg className={`w-5 h-5 ${themeClasses.textPrimary} ${direction === 'rtl' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className={`${themeClasses.textPrimary} text-xs sm:text-sm font-medium px-2 sm:px-4 text-center sm:text-left min-w-0 flex-1`}>
              <div className="block sm:hidden">
                {weekStartObj.getDate()}/{weekStartObj.getMonth() + 1} - {weekEndObj.getDate()}/{weekEndObj.getMonth() + 1}
              </div>
              <div className="hidden sm:block">
                {weekStartObj.getDate()} {monthNames[weekStartObj.getMonth()]} - {weekEndObj.getDate()} {monthNames[weekEndObj.getMonth()]}
              </div>
            </div>
            <button 
              onClick={() => navigateWeek('next')}
              className={`w-10 h-10 sm:w-10 sm:h-10 ${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} rounded-lg flex items-center justify-center transition-all duration-300 active:scale-95 flex-shrink-0`}
              aria-label={language === 'hebrew' ? 'שבוע הבא' : 'Next week'}
            >
              <svg className={`w-5 h-5 ${themeClasses.textPrimary} ${direction === 'rtl' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          {/* Calendar and This Week Buttons */}
          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={() => setShowCalendar(!showCalendar)}
              className={`${showCalendar ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-600 hover:bg-gray-700'} text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-300 text-sm active:scale-95 flex-1 sm:flex-initial flex items-center justify-center gap-2`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="hidden sm:inline">{language === 'hebrew' ? 'לוח שנה' : 'Calendar'}</span>
            </button>
            <button 
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                const dayOfWeek = new Date(today).getDay();
                const sundayStartRegions = [
                  'north_america', 'mexico', 'latam_south_america', 'japan', 'korea',
                  'india_south_asia', 'indonesia_malaysia', 'southeast_asia', 'israel'
                ];
                const startFromSunday = clientRegion && sundayStartRegions.some(region => 
                  region.toLowerCase() === clientRegion.toLowerCase()
                );
                const startOfWeek = new Date(today);
                if (startFromSunday) {
                  startOfWeek.setDate(new Date(today).getDate() - dayOfWeek);
                } else {
                  startOfWeek.setDate(new Date(today).getDate() - dayOfWeek + 1);
                }
                setWeekStartDate(startOfWeek.toISOString().split('T')[0]);
                setShowCalendar(false);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-300 text-sm active:scale-95 flex-1 sm:flex-initial"
            >
              {language === 'hebrew' ? 'השבוע' : 'This Week'}
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Picker */}
      {showCalendar && (
        <div className={`mb-6 ${themeClasses.bgCard} rounded-xl p-4 border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'} animate-slideInUp`}>
          <CalendarPicker
            selectedDate={weekStartDate}
            onDateSelect={(date) => {
              const dayOfWeek = new Date(date).getDay();
              const sundayStartRegions = [
                'north_america', 'mexico', 'latam_south_america', 'japan', 'korea',
                'india_south_asia', 'indonesia_malaysia', 'southeast_asia', 'israel'
              ];
              const startFromSunday = clientRegion && sundayStartRegions.some(region => 
                region.toLowerCase() === clientRegion.toLowerCase()
              );
              const startOfWeek = new Date(date);
              if (startFromSunday) {
                startOfWeek.setDate(new Date(date).getDate() - dayOfWeek);
              } else {
                startOfWeek.setDate(new Date(date).getDate() - dayOfWeek + 1);
              }
              setWeekStartDate(startOfWeek.toISOString().split('T')[0]);
              setShowCalendar(false);
            }}
            themeClasses={themeClasses}
            isDarkMode={isDarkMode}
            language={language}
            direction={direction}
            clientRegion={clientRegion}
          />
        </div>
      )}

      {/* 7 Day Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
        {weekDates.map((date, index) => {
          const totals = calculateDayTotals(date);
          return (
            <DaySummarySVG 
              key={date} 
              date={date} 
              totals={totals}
            />
          );
        })}
      </div>
    </div>
  );
};

// Daily Log Tab Component
const DailyLogTab = ({ themeClasses, t, userCode, language, clientRegion, direction }) => {
  const { settings } = useSettings();
  const { isDarkMode } = useTheme();
  const [activeSubTab, setActiveSubTab] = useState('dailyLog'); // 'dailyLog', 'analytics', or 'weeklySummary'
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
  const [isEditPortionModalVisible, setIsEditPortionModalVisible] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [editingLogId, setEditingLogId] = useState(null);
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  
  // Helper function to format numbers with decimal places
  const formatNumber = (num) => {
    // Convert to number and handle invalid values
    const number = typeof num === 'number' ? num : parseFloat(num);
    if (isNaN(number) || number === null || number === undefined) {
      return '0';
    }
    if (settings.decimalPlaces === 0) {
      return Math.round(number).toString();
    }
    return number.toFixed(settings.decimalPlaces);
  };
  
  // Helper function to convert weight based on weightUnit setting
  const convertWeight = (grams) => {
    // Convert to number and handle invalid values
    const number = typeof grams === 'number' ? grams : parseFloat(grams);
    if (isNaN(number) || number === null || number === undefined) {
      return 0;
    }
    if (settings.weightUnit === 'ounces') {
      // Convert grams to ounces (1 gram = 0.035274 ounces)
      return number * 0.035274;
    }
    return number; // Return grams if weightUnit is 'grams'
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

      // Parse food_items - preserve original format for saving
      let foodItems = [];
      if (log.food_items) {
        try {
          foodItems = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
        } catch (e) {
          console.error('Error parsing food_items:', e);
          return;
        }
      }

      // Remove the ingredient - work with original array structure
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

  // Handle edit ingredient portion
  const handleEditIngredient = (logId, itemIndex, item) => {
    // Convert food item format to ingredient format expected by IngredientPortionModal
    // Extract grams from quantity string (e.g., "100g" -> 100)
    // Daily log only uses grams, no household measure
    const quantityStr = item.quantity || '100g';
    const gramsMatch = quantityStr.toString().match(/(\d+(?:\.\d+)?)/);
    const grams = gramsMatch ? parseFloat(gramsMatch[1]) : 100;
    
    // Calculate original 100g values to properly scale nutrition
    const originalScale = grams / 100;
    const original100gCalories = (item.cals || 0) / originalScale;
    const original100gProtein = (item.p || 0) / originalScale;
    const original100gCarbs = (item.c || 0) / originalScale;
    const original100gFat = (item.f || 0) / originalScale;
    
    // Create ingredient object in the format expected by IngredientPortionModal
    // Daily log only uses grams, so household_measure is empty
    const ingredient = {
      item: item.name || 'Unknown Item',
      name: item.name || 'Unknown Item',
      'portionSI(gram)': grams,
      household_measure: '', // Daily log doesn't use household measure
      calories: item.cals || 0,
      protein: item.p || 0,
      carbs: item.c || 0,
      fat: item.f || 0,
      // Store original 100g values for proper scaling
      _original100gCalories: original100gCalories,
      _original100gProtein: original100gProtein,
      _original100gCarbs: original100gCarbs,
      _original100gFat: original100gFat
    };
    
    setEditingLogId(logId);
    setEditingItemIndex(itemIndex);
    setEditingIngredient(ingredient);
    setIsEditPortionModalVisible(true);
  };

  // Handle update ingredient portion
  const handleUpdateIngredientPortion = async ({ quantity: quantityNum, householdMeasure }) => {
    if (editingLogId === null || editingItemIndex === null || !editingIngredient) return;

    try {
      setProcessing(true);
      
      // Find the log entry
      const log = foodLogs.find(l => l.id === editingLogId);
      if (!log) return;

      // Parse food_items - preserve original format for saving
      let foodItems = [];
      if (log.food_items) {
        try {
          foodItems = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
        } catch (e) {
          console.error('Error parsing food_items:', e);
          return;
        }
      }

      // Get the old ingredient and normalize it for calculations
      const oldItemRaw = foodItems[editingItemIndex];
      if (!oldItemRaw) return;
      const oldItem = normalizeFoodItem(oldItemRaw);

      // Calculate new nutrition values
      // Use original 100g values if available, otherwise calculate from current values
      const originalScale = (editingIngredient['portionSI(gram)'] || 100) / 100;
      const original100gCalories = editingIngredient._original100gCalories || (oldItem.cals || 0) / originalScale;
      const original100gProtein = editingIngredient._original100gProtein || (oldItem.p || 0) / originalScale;
      const original100gCarbs = editingIngredient._original100gCarbs || (oldItem.c || 0) / originalScale;
      const original100gFat = editingIngredient._original100gFat || (oldItem.f || 0) / originalScale;

      // Calculate new values with the new quantity
      // Daily log only uses grams, so always save as "Xg" format
      const newScale = quantityNum / 100;
      
      // Preserve original format structure when updating
      // If original had macros object, keep that structure; otherwise use flat structure
      const updatedItem = oldItemRaw.macros ? {
        ...oldItemRaw,
        macros: {
          ...oldItemRaw.macros,
          calories: Math.round(original100gCalories * newScale),
          protein_g: Math.round(original100gProtein * newScale * 10) / 10,
          carbs_g: Math.round(original100gCarbs * newScale * 10) / 10,
          fat_g: Math.round(original100gFat * newScale * 10) / 10
        },
        portion_estimate: `${quantityNum}g`
      } : {
        ...oldItemRaw,
        cals: Math.round(original100gCalories * newScale),
        p: Math.round(original100gProtein * newScale * 10) / 10,
        c: Math.round(original100gCarbs * newScale * 10) / 10,
        f: Math.round(original100gFat * newScale * 10) / 10,
        quantity: `${quantityNum}g` // Daily log always uses grams format
      };

      // Update the item in the array
      foodItems[editingItemIndex] = updatedItem;

      // Update the food log
      const { error } = await updateFoodLog(editingLogId, {
        food_items: foodItems,
        meal_label: log.meal_label || 'snacks',
        image_url: log.image_url || null,
        log_date: log.log_date || selectedDate
      });

      if (error) {
        console.error('Error updating food log:', error);
        alert(
          language === 'hebrew'
            ? 'שגיאה בעדכון המרכיב'
            : 'Error updating ingredient'
        );
      } else {
        // Reload food logs
        const { data: foodLogsData, error: foodLogsError } = await getFoodLogs(userCode, selectedDate);
        if (!foodLogsError) {
          setFoodLogs(foodLogsData || []);
        }
        alert(
          language === 'hebrew'
            ? 'המרכיב עודכן בהצלחה'
            : 'Ingredient updated successfully'
        );
      }

      // Close modal and reset
      setIsEditPortionModalVisible(false);
      setEditingIngredient(null);
      setEditingLogId(null);
      setEditingItemIndex(null);
    } catch (err) {
      console.error('Unexpected error updating ingredient:', err);
      alert(
        language === 'hebrew'
          ? 'שגיאה בעדכון המרכיב'
          : 'Error updating ingredient'
      );
    } finally {
      setProcessing(false);
    }
  };

  // Calculate totals from food logs using food_items JSON column
  const totalCalories = foodLogs.reduce((sum, log) => {
    const foodItems = parseFoodItems(log);
    const logCalories = foodItems.reduce((itemSum, item) => itemSum + (item.cals || 0), 0);
    // Fallback to old column only if food_items is empty or not available
    return sum + (logCalories > 0 ? logCalories : (log.total_calories || 0));
  }, 0);
  
  const totalProtein = foodLogs.reduce((sum, log) => {
    const foodItems = parseFoodItems(log);
    const logProtein = foodItems.reduce((itemSum, item) => itemSum + (item.p || 0), 0);
    // Fallback to old column only if food_items is empty or not available
    return sum + (logProtein > 0 ? logProtein : (log.total_protein_g || 0));
  }, 0);
  
  const totalCarbs = foodLogs.reduce((sum, log) => {
    const foodItems = parseFoodItems(log);
    const logCarbs = foodItems.reduce((itemSum, item) => itemSum + (item.c || 0), 0);
    // Fallback to old column only if food_items is empty or not available
    return sum + (logCarbs > 0 ? logCarbs : (log.total_carbs_g || 0));
  }, 0);
  
  const totalFat = foodLogs.reduce((sum, log) => {
    const foodItems = parseFoodItems(log);
    const logFat = foodItems.reduce((itemSum, item) => itemSum + (item.f || 0), 0);
    // Fallback to old column only if food_items is empty or not available
    return sum + (logFat > 0 ? logFat : (log.total_fat_g || 0));
  }, 0);

  // Get meals from meal plan, or fallback to default meals
  // Always add "other" as the last meal regardless of how many meals exist
  const meals = mealPlanMeals.length > 0 
    ? [...mealPlanMeals.map(meal => meal.meal), 'other'] // Extract meal categories from meal plan and add "other"
    : ['breakfast', 'lunch', 'dinner', 'snacks', 'other']; // Fallback to default with "other"
  
  // Create a map of meal category to meal title
  const mealTitleMap = mealPlanMeals.reduce((acc, meal) => {
    if (meal && meal.meal) {
      const mealName = meal.main?.meal_title || meal.main?.meal_name || meal.main?.title || meal.meal;
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

  // Group all food logs by meal_label
  // meal_label will have first letter capitalized, exactly as in meal plan
  foodLogs.forEach(log => {
    const logMealLabel = (log.meal_label || '').trim();
    const logMealLabelLower = logMealLabel.toLowerCase();
    
    // First try exact match (case-sensitive) - meal_label matches meal plan format exactly
    let matchedMeal = meals.find(meal => meal.trim() === logMealLabel);
    
    // If no exact match, try case-insensitive match
    if (!matchedMeal) {
      matchedMeal = meals.find(meal => meal.trim().toLowerCase() === logMealLabelLower);
    }
    
    // If still no match, check for Hebrew variations
    if (!matchedMeal) {
      if (logMealLabelLower === 'בוקר' || logMealLabelLower === 'ארוחת בוקר') matchedMeal = 'breakfast';
      else if (logMealLabelLower === 'צהריים' || logMealLabelLower === 'צהרים' || logMealLabelLower === 'ארוחת צהריים') matchedMeal = 'lunch';
      else if (logMealLabelLower === 'ערב' || logMealLabelLower === 'ארוחת ערב') matchedMeal = 'dinner';
      else if (logMealLabelLower === 'חטיפים' || logMealLabelLower === 'חטיף') matchedMeal = 'snacks';
      else if (logMealLabelLower === 'אחר') matchedMeal = 'other';
    }
    
    if (matchedMeal && groupedLogs[matchedMeal]) {
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
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const startOfWeek = new Date(date);
    
    // Regions that start the week on Sunday:
    // United States, Canada, most of the Americas (like Brazil, Mexico, Colombia), 
    // Japan, South Korea, India, Indonesia, Pakistan, the Philippines, Israel
    const sundayStartRegions = [
      'north_america',      // United States, Canada
      'mexico',             // Mexico
      'latam_south_america', // Brazil, Colombia, South America
      'japan',              // Japan
      'korea',              // South Korea
      'india_south_asia',   // India, Pakistan
      'indonesia_malaysia', // Indonesia
      'southeast_asia',     // Philippines
      'israel'              // Israel
    ];
    
    // Check if region should start from Sunday (case-insensitive)
    const startFromSunday = clientRegion && sundayStartRegions.some(region => 
      region.toLowerCase() === clientRegion.toLowerCase()
    );
    
    if (startFromSunday) {
      // Start from Sunday (dayOfWeek 0)
      startOfWeek.setDate(date.getDate() - dayOfWeek);
    } else {
      // Start from Monday (dayOfWeek 1)
      startOfWeek.setDate(date.getDate() - dayOfWeek + 1);
    }
    
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
      <div className={`mb-4 sm:mb-6 flex gap-1 sm:gap-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <button
          onClick={() => setActiveSubTab('dailyLog')}
          className={`px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all duration-300 border-b-2 ${
            activeSubTab === 'dailyLog'
              ? `${themeClasses.textPrimary} border-emerald-500`
              : `${themeClasses.textSecondary} border-transparent hover:border-emerald-500/50`
          }`}
        >
          {language === 'hebrew' ? 'יומן יומי' : 'Daily Log'}
        </button>
        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all duration-300 border-b-2 ${
            activeSubTab === 'analytics'
              ? `${themeClasses.textPrimary} border-emerald-500`
              : `${themeClasses.textSecondary} border-transparent hover:border-emerald-500/50`
          }`}
        >
          {language === 'hebrew' ? 'אנליטיקה' : 'Analytics'}
        </button>
        <button
          onClick={() => setActiveSubTab('weeklySummary')}
          className={`px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all duration-300 border-b-2 ${
            activeSubTab === 'weeklySummary'
              ? `${themeClasses.textPrimary} border-emerald-500`
              : `${themeClasses.textSecondary} border-transparent hover:border-emerald-500/50`
          }`}
        >
          {language === 'hebrew' ? 'סיכום שבועי' : 'Weekly Summary'}
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
            onAddLog={() => setActiveSubTab('dailyLog')}
          />
        </>
      )}

      {/* Weekly Summary Sub-tab Content */}
      {activeSubTab === 'weeklySummary' && (
        <WeeklySummaryComponent
          userCode={userCode}
          themeClasses={themeClasses}
          language={language}
          isDarkMode={isDarkMode}
          settings={settings}
          clientRegion={clientRegion}
          direction={direction}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          onDateClick={() => setActiveSubTab('dailyLog')}
        />
      )}

      {/* Daily Log Sub-tab Content */}
      {activeSubTab === 'dailyLog' && (
        <>
      {/* Date Selector Section */}
      <div className="mb-6 sm:mb-8 md:mb-10 lg:mb-12 animate-slideInUp relative rounded-xl p-3 sm:p-4 md:p-6" style={{
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
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h2 className={`${themeClasses.textPrimary} text-xl sm:text-2xl md:text-3xl font-bold tracking-tight mb-1 sm:mb-2`}>
            {dayNames[selectedDateObj.getDay()]}, {monthNames[selectedDateObj.getMonth()]} {selectedDateObj.getDate()}
          </h2>
          <p className={`${themeClasses.textSecondary} text-xs sm:text-sm md:text-base`}>
            {language === 'hebrew' ? 'בחר תאריך כדי לראות את יומן התזונה שלך' : 'Choose a date to view your nutrition log'}
          </p>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => navigateWeek('prev')}
              className={`w-8 h-8 sm:w-10 sm:h-10 ${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} rounded-lg flex items-center justify-center transition-all duration-300 active:scale-95`}
            >
              <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${themeClasses.textPrimary} ${direction === 'rtl' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button 
              onClick={() => navigateWeek('next')}
              className={`w-8 h-8 sm:w-10 sm:h-10 ${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} rounded-lg flex items-center justify-center transition-all duration-300 active:scale-95`}
            >
              <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${themeClasses.textPrimary} ${direction === 'rtl' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <button 
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 sm:py-2 sm:px-4 rounded-lg transition-all duration-300 text-xs sm:text-sm active:scale-95"
          >
            {language === 'hebrew' ? 'היום' : 'Today'}
          </button>
        </div>

        {/* Week Calendar - Scrollable on mobile */}
        <div className="overflow-x-auto -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 mb-4 sm:mb-6 md:mb-8">
          <div className="flex gap-2 sm:gap-3 min-w-max sm:min-w-0">
            {weekDates.map((date, index) => {
              const isSelected = date.toISOString().split('T')[0] === selectedDate;
              const dayName = dayNames[date.getDay()];
              const dayNumber = date.getDate();
              
              return (
                <button
                  key={index}
                  onClick={() => setSelectedDate(date.toISOString().split('T')[0])}
                  className={`flex-shrink-0 w-14 sm:w-16 md:flex-1 md:min-w-0 p-2 sm:p-3 md:p-4 rounded-xl transition-all duration-300 active:scale-95 ${
                    isSelected 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' 
                      : `${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} ${themeClasses.textSecondary}`
                  }`}
                >
                  <div className="text-center">
                    <div className="text-xs sm:text-sm font-medium">{dayName}</div>
                    <div className="text-base sm:text-lg md:text-xl font-bold mt-0.5 sm:mt-1">{dayNumber}</div>
                  </div>
                </button>
              );
            })}
          </div>
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
                className={`${themeClasses.bgCard} border border-blue-500/30 rounded-2xl p-6 shadow-xl shadow-blue-500/10 transform hover:scale-[1.01] transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20 animate-slideInUp lg:relative group`}
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
                    <span className="text-3xl sm:text-4xl lg:text-2xl group-hover:animate-bounce transition-transform duration-300">{getMealIcon(meal)}</span>
                  </div>
                      <div className="flex-1">
                    <p className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium mb-1 uppercase tracking-wide`}>
                      {meal}
                    </p>
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
                    {meal !== 'other' && (
                      <p className={`text-emerald-400 font-bold text-base sm:text-lg md:text-xl mb-4 mt-2 ${language === 'hebrew' ? 'text-right' : 'text-left'} border-b-2 border-emerald-500/30 pb-2`}>
                        {language === 'hebrew' ? 'מה שאכלת' : 'What You Ate'}
                      </p>
                    )}
                    {mealLogs.map((log, logIndex) => {
                      // Parse food_items JSON using helper function
                      const foodItems = parseFoodItems(log);
                      const logCaloriesFromItems = foodItems.reduce((sum, item) => sum + (item.cals || 0), 0);
                      const logProteinFromItems = foodItems.reduce((sum, item) => sum + (item.p || 0), 0);
                      const logCarbsFromItems = foodItems.reduce((sum, item) => sum + (item.c || 0), 0);
                      const logFatFromItems = foodItems.reduce((sum, item) => sum + (item.f || 0), 0);
                      // Use food_items totals if available, otherwise fallback to old columns
                      const logCalories = logCaloriesFromItems > 0 ? logCaloriesFromItems : (log.total_calories || 0);
                      const logProtein = logProteinFromItems > 0 ? logProteinFromItems : (log.total_protein_g || 0);
                      const logCarbs = logCarbsFromItems > 0 ? logCarbsFromItems : (log.total_carbs_g || 0);
                      const logFat = logFatFromItems > 0 ? logFatFromItems : (log.total_fat_g || 0);
                      
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
                                    {t.profile.dailyLogTab.meals[mealCategory] || mealCategory}
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
                                      <div className="flex items-center gap-1 ml-2">
                                        {/* Edit ingredient button */}
                                        <button
                                          onClick={() => handleEditIngredient(log.id, itemIndex, item)}
                                          disabled={processing}
                                          className="w-5 h-5 flex items-center justify-center rounded bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 hover:border-blue-500/50 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                          title={language === 'hebrew' ? 'ערוך כמות' : 'Edit portion'}
                                        >
                                          <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                          </svg>
                                        </button>
                                        {/* Delete ingredient button */}
                                        <button
                                          onClick={() => handleDeleteIngredient(log.id, itemIndex)}
                                          disabled={processing}
                                          className="w-5 h-5 flex items-center justify-center rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 hover:border-red-500/50 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                          title={language === 'hebrew' ? 'מחק מרכיב' : 'Delete ingredient'}
                                        >
                                          <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
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
                              /* Empty meal entry fallback - no food items logged yet (matches health diary empty state) */
                              <div className={`${language === 'hebrew' ? 'text-right' : 'text-left'}`}>
                                <p className={`${themeClasses.textPrimary} font-medium text-sm mb-2`}>
                                  {language === 'hebrew' ? 'רשומת מזון' : 'Food Log'}
                                </p>
                                {log.image_url && (
                                  <div className="inline-flex w-6 h-6 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded flex items-center justify-center border border-emerald-500/30 mb-2">
                                    <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"/>
                                    </svg>
                                  </div>
                                )}
                                <div className="flex flex-wrap items-center gap-3 text-xs">
                                  {settings.showCalories && (
                                    <span className="text-emerald-400 font-medium">0 {language === 'hebrew' ? 'קל' : 'cal'}</span>
                                  )}
                                  {settings.showMacros && (
                                    <>
                                      <span className="text-purple-400 font-medium">{formatWeight(0)} {language === 'hebrew' ? 'חלבון' : 'protein'}</span>
                                      <span className="text-amber-400 font-medium">{formatWeight(0)} {language === 'hebrew' ? 'שומן' : 'fat'}</span>
                                      <span className="text-blue-400 font-medium">{formatWeight(0)} {language === 'hebrew' ? 'פחמימות' : 'carbs'}</span>
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
                        const foodItems = parseFoodItems(log);
                        const logCaloriesFromItems = foodItems.reduce((sum, item) => sum + (item.cals || 0), 0);
                        const logProteinFromItems = foodItems.reduce((sum, item) => sum + (item.p || 0), 0);
                        const logCarbsFromItems = foodItems.reduce((sum, item) => sum + (item.c || 0), 0);
                        const logFatFromItems = foodItems.reduce((sum, item) => sum + (item.f || 0), 0);
                        // Use food_items totals if available, otherwise fallback to old columns
                        mealTotalCalories += logCaloriesFromItems > 0 ? logCaloriesFromItems : (log.total_calories || 0);
                        mealTotalProtein += logProteinFromItems > 0 ? logProteinFromItems : (log.total_protein_g || 0);
                        mealTotalCarbs += logCarbsFromItems > 0 ? logCarbsFromItems : (log.total_carbs_g || 0);
                        mealTotalFat += logFatFromItems > 0 ? logFatFromItems : (log.total_fat_g || 0);
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
                <h4 className={`${themeClasses.textPrimary} text-lg sm:text-xl md:text-2xl lg:text-base sm:text-lg md:text-xl font-bold tracking-tight mt-4`}>
                  {language === 'hebrew' ? 'על פי התוכנית שלך - ' : 'Your Plan - '}{mealTitleMap[meal] || t.profile.dailyLogTab.meals[meal] || meal}
                </h4>
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
        mealName={selectedMealForIngredient ? (t.profile.dailyLogTab.meals[selectedMealForIngredient] || selectedMealForIngredient) : null}
        clientRegion={clientRegion}
        userCode={userCode}
      />

      {/* Edit Ingredient Portion Modal */}
      <IngredientPortionModal
        visible={isEditPortionModalVisible}
        onClose={() => {
          setIsEditPortionModalVisible(false);
          setEditingIngredient(null);
          setEditingLogId(null);
          setEditingItemIndex(null);
        }}
        onConfirm={handleUpdateIngredientPortion}
        ingredient={editingIngredient}
        clientRegion={clientRegion}
        hideHouseholdMeasure={true}
      />
    </div>
  );
};

// Use our backend proxy to avoid CORS (boi.org.il does not send Access-Control-Allow-Origin)

// Pricing Tab Component
const PricingTab = ({ themeClasses, user, language }) => {
  const { getCustomerSubscriptions, error } = useStripe();
  const [activeCategory, setActiveCategory] = useState('all');
  const [userSubscriptions, setUserSubscriptions] = useState([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [usdExchangeRate, setUsdExchangeRate] = useState(null); // ILS per 1 USD (Bank of Israel)

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

  // Fetch Bank of Israel USD exchange rate when Pricing tab is shown (ILS per 1 USD)
  // Via backend proxy to avoid CORS (boi.org.il does not allow browser cross-origin requests)
  useEffect(() => {
    let cancelled = false;
    const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb.onrender.com';
    const fetchUsdRate = async () => {
      try {
        const url = apiUrl ? `${apiUrl}/api/exchange-rates` : '/api/exchange-rates';
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled || !data?.exchangeRates) return;
        const usd = data.exchangeRates.find((r) => r.key === 'USD');
        if (usd?.currentExchangeRate) {
          setUsdExchangeRate(usd.currentExchangeRate);
        }
      } catch (err) {
        console.warn('BOI exchange rate fetch failed:', err);
      }
    };
    fetchUsdRate();
    return () => { cancelled = true; };
  }, []);

  // Manual refresh function for subscriptions (call after successful purchase)
  const refreshSubscriptions = async () => {
    setSubscriptionsLastFetched(null); // Reset timestamp to force refresh
    await fetchUserSubscriptions();
  };

  const [cancellingSubscriptionId, setCancellingSubscriptionId] = useState(null);
  const [cancelError, setCancelError] = useState(null);

  const handleCancelPlan = async (subscriptionId) => {
    if (!subscriptionId) return;
    const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb.onrender.com';
    setCancelError(null);
    setCancellingSubscriptionId(subscriptionId);
    try {
      const res = await fetch(`${apiUrl}/api/stripe/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelAtPeriodEnd: false })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel');
      await refreshSubscriptions();
    } catch (err) {
      setCancelError(err.message || (language === 'hebrew' ? 'שגיאה בביטול המנוי' : 'Error cancelling subscription'));
    } finally {
      setCancellingSubscriptionId(null);
    }
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
                  {subscription.items?.data?.[0]?.price?.product === 'prod_TrcVkwBC0wmqKp' && (
                    <div className="mt-3 pt-3 border-t border-gray-500/30">
                      {cancelError && (
                        <p className="text-red-500 dark:text-red-400 text-sm mb-2" role="alert">{cancelError}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCancelPlan(subscription.id)}
                        disabled={cancellingSubscriptionId === subscription.id}
                        className="text-sm font-medium text-red-500 hover:text-red-400 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {cancellingSubscriptionId === subscription.id
                          ? (language === 'hebrew' ? 'מבטל...' : 'Cancelling...')
                          : (language === 'hebrew' ? 'ביטול מנוי' : 'Cancel plan')}
                      </button>
                    </div>
                  )}
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

      {/* What Every Plan Includes */}
      <div className="mb-8 animate-slideInUp" style={{ animationDelay: '0.3s' }}>
        <div className={`${themeClasses.bgCard} border ${themeClasses.borderPrimary} rounded-2xl p-6 md:p-8 shadow-lg`}>
          <h3 className={`${themeClasses.textPrimary} text-xl font-bold mb-4 ${language === 'hebrew' ? 'text-right' : 'text-left'}`}>
            {language === 'hebrew' ? 'מה כל סוג תוכנית כולל' : 'What Every Plan Includes'}
          </h3>
          {language === 'hebrew' ? (
            <div className="space-y-4 text-right">
              <div>
                <h4 className={`${themeClasses.textPrimary} font-semibold mb-2`}>פגישה ראשונה מקיפה:</h4>
                <ul className={`${themeClasses.textSecondary} space-y-1 text-sm list-disc list-inside`}>
                  <li>היכרות מעמיקה</li>
                  <li>בניית תכנית תזונה אישית</li>
                  <li>ובבחירה בתכנית משולבת - גם בניית תכנית אימונים</li>
                </ul>
              </div>
              <div>
                <h4 className={`${themeClasses.textPrimary} font-semibold mb-2`}>פגישות מעקב:</h4>
                <ul className={`${themeClasses.textSecondary} space-y-2 text-sm`}>
                  <li>
                    <span className="font-medium">פגישה אחת לשבועיים:</span> מתאימה למי שרוצה ליווי צמוד יותר, דיוק ונוכחות גבוהה של הדיאטן/נית שלנו לאורך הדרך
                  </li>
                  <li>
                    <span className="font-medium">פגישה אחת לחודש:</span> מתאימה למי שמעדיף מרווחים, עבודה הדרגתית ועצמאות גבוהה יותר
                  </li>
                </ul>
              </div>
              <div>
                <h4 className={`${themeClasses.textPrimary} font-semibold mb-2`}>ליווי אישי ב־WhatsApp לאורך כל התהליך:</h4>
                <ul className={`${themeClasses.textSecondary} space-y-1 text-sm list-disc list-inside`}>
                  <li>מענה על שאלות</li>
                  <li>התייעצויות שוטפות</li>
                  <li>דיוקים בזמן אמת (ארוחות, סיטואציות ושגרה)</li>
                </ul>
              </div>
              <div>
                <h4 className={`${themeClasses.textPrimary} font-semibold mb-2`}>התאמות ושינויים אישיים:</h4>
                <p className={`${themeClasses.textSecondary} text-sm`}>
                  בהתאם להתקדמות, לתחושות ולמציאות המשתנה
                </p>
              </div>
              <div>
                <h4 className={`${themeClasses.textPrimary} font-semibold mb-2`}>תקופות מחויבות:</h4>
                <ul className={`${themeClasses.textSecondary} space-y-1 text-sm list-disc list-inside`}>
                  <li><span className="font-medium">3 חודשים:</span> תהליך ממוקד, יצירת בסיס והנעה</li>
                  <li><span className="font-medium">6 חודשים:</span> תהליך עמוק, יציב ומבוסס הרגלים לאורך זמן</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-left">
              <div>
                <h4 className={`${themeClasses.textPrimary} font-semibold mb-2`}>Comprehensive First Session:</h4>
                <ul className={`${themeClasses.textSecondary} space-y-1 text-sm list-disc list-inside`}>
                  <li>In-depth introduction</li>
                  <li>Building a personalized nutrition plan</li>
                  <li>For combined plans - also building a training plan</li>
                </ul>
              </div>
              <div>
                <h4 className={`${themeClasses.textPrimary} font-semibold mb-2`}>Follow-up Sessions:</h4>
                <ul className={`${themeClasses.textSecondary} space-y-2 text-sm`}>
                  <li>
                    <span className="font-medium">One session every two weeks:</span> Suitable for those who want closer guidance, precision and high presence of our dietician/nutritionist throughout the process.
                  </li>
                  <li>
                    <span className="font-medium">One session per month:</span> Suitable for those who prefer intervals, gradual work and higher independence.
                  </li>
                </ul>
              </div>
              <div>
                <h4 className={`${themeClasses.textPrimary} font-semibold mb-2`}>Personal WhatsApp Guidance Throughout the Process:</h4>
                <ul className={`${themeClasses.textSecondary} space-y-1 text-sm list-disc list-inside`}>
                  <li>Answering questions</li>
                  <li>Ongoing consultations</li>
                  <li>Real-time adjustments (meals, situations and routine)</li>
                </ul>
              </div>
              <div>
                <h4 className={`${themeClasses.textPrimary} font-semibold mb-2`}>Personal Adjustments and Changes:</h4>
                <p className={`${themeClasses.textSecondary} text-sm`}>
                  According to progress, feelings and changing reality
                </p>
              </div>
              <div>
                <h4 className={`${themeClasses.textPrimary} font-semibold mb-2`}>Commitment Periods:</h4>
                <ul className={`${themeClasses.textSecondary} space-y-1 text-sm list-disc list-inside`}>
                  <li><span className="font-medium">3 months:</span> Focused process, creating foundation and momentum</li>
                  <li><span className="font-medium">6 months:</span> Deep process, stable and habit-based over time</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* USD conversion note (Bank of Israel rate) */}
      {usdExchangeRate != null && (
        <div className={`mb-6 animate-slideInUp ${themeClasses.bgCard} border ${themeClasses.borderPrimary} rounded-xl px-4 py-3 shadow-sm`} style={{ animationDelay: '0.35s' }}>
          <p className={`${themeClasses.textSecondary} text-xs sm:text-sm ${language === 'hebrew' ? 'text-right' : 'text-left'}`}>
            {language === 'hebrew' ? (
              <>מתעדכן רק פעם ביום (בימי חול סביב 15:30–16:00, ובימי שישי סביב 12:30). אין עדכונים בשבת ובראשון. שער המרה לדולר: בנק ישראל.</>
            ) : (
              <>Exchange rate to USD from Bank of Israel. Updated once a day (weekdays around 15:30–16:00, Fridays around 12:30). No updates on Saturday and Sunday.</>
            )}
          </p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 items-stretch">
            {filteredProducts.map((product, index) => (
              <div
                key={product.id}
                className="flex flex-col animate-slideInUp"
                style={{ animationDelay: `${0.5 + index * 0.1}s` }}
              >
                <div className="flex-1 flex flex-col min-h-0">
                  <PricingCard
                    product={product}
                    hasActiveSubscription={hasActiveSubscription(product.id)}
                    hasAnyActiveSubscription={hasAnyActiveSubscription()}
                    usdExchangeRate={usdExchangeRate}
                    className={`h-full flex flex-col transform hover:scale-[1.02] transition-all duration-300 ${
                      hasActiveSubscription(product.id) ? 'ring-2 ring-emerald-500' : ''
                    }`}
                  />
                </div>
                {hasActiveSubscription(product.id) && (
                  <div className="mt-3 text-center flex-shrink-0">
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
  const [selectedImage, setSelectedImage] = useState(null); // Track selected image for modal

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
            topic: msg.topic,
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
            topic: msg.topic,
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
          topic: msg.topic,
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

  // Helper function to normalize data URIs with proper MIME types
  const normalizeDataUri = (dataUri, mediaType) => {
    if (!dataUri || !dataUri.startsWith('data:')) {
      return dataUri;
    }
    
    // If it already has a proper MIME type, return as is
    if (dataUri.match(/^data:[a-z]+\/[a-z0-9+-]+;base64,/)) {
      return dataUri;
    }
    
    // Fix data:audio;base64, to have a proper MIME type
    if (mediaType === 'audio' && dataUri.startsWith('data:audio;base64,')) {
      try {
        const base64Data = dataUri.substring(dataUri.indexOf(',') + 1);
        const binaryString = atob(base64Data.substring(0, 100));
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Detect audio format from file headers
        // Ogg/Opus (most common for WhatsApp): bytes start with 0x4F 0x67 0x67 0x53 ("OggS")
        if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
          return dataUri.replace('data:audio;base64,', 'data:audio/ogg;base64,');
        }
        // MP3 detection
        if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || 
            (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)) {
          return dataUri.replace('data:audio;base64,', 'data:audio/mpeg;base64,');
        }
        // WAV detection
        if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
          return dataUri.replace('data:audio;base64,', 'data:audio/wav;base64,');
        }
        // Default to ogg for unknown (most compatible)
        return dataUri.replace('data:audio;base64,', 'data:audio/ogg;base64,');
      } catch (e) {
        // Fallback to ogg if detection fails
        return dataUri.replace('data:audio;base64,', 'data:audio/ogg;base64,');
      }
    }
    
    // Fix data:image;base64, to have a proper MIME type
    if (mediaType === 'image' && dataUri.startsWith('data:image;base64,')) {
      return dataUri.replace('data:image;base64,', 'data:image/png;base64,');
    }
    
    return dataUri;
  };

  // Function to handle image click (open in modal)
  const handleImageClick = (imageSrc) => {
    setSelectedImage(imageSrc);
  };

  // Function to close image modal
  const handleCloseImageModal = () => {
    setSelectedImage(null);
  };

  // Handle ESC key to close modal
  useEffect(() => {
    if (!selectedImage) return;
    
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setSelectedImage(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedImage]);

  // Function to render message content with attachments and formatting (same logic as Chat.jsx)
  const renderMessageContent = (msg) => {
    // Check both message and content columns for base64 data
    const messageData = msg.message || msg.content || '';
    const trimmedMessageData = messageData.trim();
    const topic = msg.topic;
    const topicLower = topic ? topic.toLowerCase() : '';
    
    // Detect base64 image
    const hasBase64Image = topicLower === 'image' && trimmedMessageData.startsWith('data:image');
    
    // Detect base64 audio  
    const hasBase64Audio = topicLower === 'audio' && trimmedMessageData.startsWith('data:audio');
    
    // Normalize the data before rendering
    const normalizedImageData = hasBase64Image ? normalizeDataUri(trimmedMessageData, 'image') : null;
    const normalizedAudioData = hasBase64Audio ? normalizeDataUri(trimmedMessageData, 'audio') : null;
    
    // Get content from message or content field
    let content = msg.message || msg.content || '';
    
    // For assistant role messages, extract only response_text from JSON
    if (msg.role === 'assistant' && content.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.response_text) {
          content = parsed.response_text;
        } else {
          // If no response_text, use empty string to show nothing
          content = '';
        }
      } catch (e) {
        // Not valid JSON, use as is
        console.error('Error parsing assistant message JSON:', e);
      }
    }
    
    // Handle system_reply topic: extract response_text from agent_response JSON
    if (topic === 'system_reply' && content.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.agent_response) {
          // agent_response is a JSON string, parse it to get response_text
          const agentResponseParsed = JSON.parse(parsed.agent_response);
          if (agentResponseParsed.response_text) {
            content = agentResponseParsed.response_text;
          }
        }
      } catch (e) {
        // Not valid JSON or parsing failed, use as is
        console.error('Error parsing system_reply JSON:', e);
      }
    }
    // Parse JSON if message starts with { (for non-system_reply messages)
    else if (content.trim().startsWith('{')) {
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
    
    // Filter out base64 data from text rendering
    // Only show text if it's not base64 data and not empty
    const isBase64Data = hasBase64Image || hasBase64Audio || 
                         content.startsWith('data:image') || content.startsWith('data:audio');
    const text = content && content.trim() && !isBase64Data ? content : '';
    
    // Render base64 media before attachments
    const base64MediaElements = [];
    
    // Render base64 images
    if (hasBase64Image) {
      base64MediaElements.push(
        <div key="base64-image" className="mb-3">
          {normalizedImageData ? (
            <img
              src={normalizedImageData}
              alt="Client image"
              className="rounded-lg max-w-full max-h-64 object-cover shadow-sm border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity duration-200"
              onClick={() => handleImageClick(normalizedImageData)}
              onError={(e) => {
                console.error('Failed to load base64 image', e);
              }}
            />
          ) : (
            <div>Image data not found</div>
          )}
        </div>
      );
    }
    
    // Render base64 audio with enhanced UI
    if (hasBase64Audio) {
      base64MediaElements.push(
        <div key="base64-audio" className="mb-3">
          {normalizedAudioData ? (
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-sm">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700 mb-2">
                  🎵 Audio Message
                </div>
                <audio
                  src={normalizedAudioData}
                  controls
                  className="w-full h-10"
                  preload="metadata"
                  onError={(e) => {
                    console.error('Failed to load base64 audio', e);
                  }}
                  onLoadedMetadata={(e) => {
                    console.log('Audio loaded successfully');
                  }}
                >
                  Your browser does not support the audio tag.
                </audio>
              </div>
            </div>
          ) : (
            <div>Audio data not found</div>
          )}
        </div>
      );
    }
    
    // Handle attachments if they exist
    if (msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
      return (
        <div className="space-y-2">
          {/* Render base64 media first */}
          {base64MediaElements}
          
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
                  onClick={() => handleImageClick(url)}
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
          {/* Only show text if it's not base64 data */}
          {text && (
            <div className="whitespace-pre-wrap break-words">{text}</div>
          )}
        </div>
      );
    }
    
    // If we have base64 media but no attachments, render base64 media
    if (base64MediaElements.length > 0) {
      return (
        <div className="space-y-2">
          {base64MediaElements}
          {/* Only show text if it's not base64 data */}
          {text && (
            <div className="whitespace-pre-wrap break-words">{text}</div>
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
            onClick={() => handleImageClick(part)}
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
    <div className={`h-full flex flex-col animate-fadeIn overflow-hidden`}>
      {/* Header Section */}
      <div className="p-4 sm:p-6 pb-4 animate-slideInUp flex-shrink-0">
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
        className={`p-4 sm:p-6 flex-1 overflow-y-auto animate-slideInUp custom-scrollbar`} 
        style={{ animationDelay: '0.2s' }}
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

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
          onClick={handleCloseImageModal}
          style={{ backdropFilter: 'blur(4px)' }}
        >
          <div className="relative max-w-7xl max-h-full">
            {/* Close Button */}
            <button
              onClick={handleCloseImageModal}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors duration-200 z-10"
              aria-label="Close image"
            >
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            
            {/* Image */}
            <img
              src={selectedImage}
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              onError={(e) => {
                console.error('Failed to load image in modal', e);
                handleCloseImageModal();
              }}
            />
          </div>
        </div>
      )}
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
          const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb.onrender.com';
          const response = await fetch(`${apiUrl}/api/profile/update-language`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userCode, language: value })
          });

          if (!response.ok) {
            console.error('Error updating language');
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
                    ? 'איך להציג כמויות מזון בארוחות באתר'
                    : 'How to display food quantities in meals on the website'}
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  {['grams', 'household', 'both'].map((option) => (
                    <button
                      key={option}
                      onClick={() => handleToggle('portion_display', option)}
                      disabled={saving}
                      className={`flex-1 px-4 py-3 sm:py-2 rounded-lg border-2 transition-all text-sm sm:text-base font-medium min-h-[44px] sm:min-h-0 ${
                        portionDisplay === option
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                          : `${themeClasses.borderPrimary} ${themeClasses.bgSecondary} ${themeClasses.textPrimary} hover:border-emerald-300`
                      }`}
                    >
                      {option === 'grams' 
                        ? (language === 'hebrew' ? 'יחידות מידה נפוצות' : 'Common Units')
                        : option === 'household'
                        ? (language === 'hebrew' ? 'מידות מטבח' : 'Kitchen Measurements')
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
