import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { supabase, supabaseSecondary } from '../supabase/supabaseClient';
import { normalizePhoneForDatabase } from '../supabase/auth';

const OnboardingModal = ({ isOpen, onClose, user, userCode }) => {
  const { language, t, direction, toggleLanguage } = useLanguage();
  const { isDarkMode, themeClasses } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checkingData, setCheckingData] = useState(true);
  const [error, setError] = useState('');
  const [filteredSteps, setFilteredSteps] = useState([]);
  const [invalidFields, setInvalidFields] = useState([]); // Track fields with validation errors
  const [fieldErrors, setFieldErrors] = useState({}); // Track which fields have errors

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    phoneCountryCode: '+972',
    language: 'en',
    city: '',
    date_of_birth: '',
    gender: '',
    weight_kg: '',
    target_weight: '',
    height_cm: '',
    food_allergies: '',
    food_limitations: '',
    activity_level: '',
    goal: '',
    client_preference: '',
    region: '',
    medical_conditions: '',
    timezone: ''
  });

  // Popular country codes with phone number validation rules
  const countryCodes = [
    { code: '+1', country: '🇺🇸 US/CA', minLength: 10, maxLength: 10 },
    { code: '+44', country: '🇬🇧 UK', minLength: 10, maxLength: 10 },
    { code: '+49', country: '🇩🇪 Germany', minLength: 10, maxLength: 12 },
    { code: '+33', country: '🇫🇷 France', minLength: 9, maxLength: 9 },
    { code: '+39', country: '🇮🇹 Italy', minLength: 9, maxLength: 10 },
    { code: '+34', country: '🇪🇸 Spain', minLength: 9, maxLength: 9 },
    { code: '+31', country: '🇳🇱 Netherlands', minLength: 9, maxLength: 9 },
    { code: '+32', country: '🇧🇪 Belgium', minLength: 9, maxLength: 9 },
    { code: '+41', country: '🇨🇭 Switzerland', minLength: 9, maxLength: 9 },
    { code: '+43', country: '🇦🇹 Austria', minLength: 10, maxLength: 13 },
    { code: '+46', country: '🇸🇪 Sweden', minLength: 9, maxLength: 9 },
    { code: '+47', country: '🇳🇴 Norway', minLength: 8, maxLength: 8 },
    { code: '+45', country: '🇩🇰 Denmark', minLength: 8, maxLength: 8 },
    { code: '+358', country: '🇫🇮 Finland', minLength: 5, maxLength: 10 },
    { code: '+353', country: '🇮🇪 Ireland', minLength: 9, maxLength: 9 },
    { code: '+351', country: '🇵🇹 Portugal', minLength: 9, maxLength: 9 },
    { code: '+30', country: '🇬🇷 Greece', minLength: 10, maxLength: 10 },
    { code: '+972', country: '🇮🇱 Israel', minLength: 9, maxLength: 9 },
    { code: '+971', country: '🇦🇪 UAE', minLength: 9, maxLength: 9 },
    { code: '+7', country: '🇷🇺 Russia', minLength: 10, maxLength: 10 },
    { code: '+86', country: '🇨🇳 China', minLength: 11, maxLength: 11 },
    { code: '+81', country: '🇯🇵 Japan', minLength: 10, maxLength: 10 },
    { code: '+82', country: '🇰🇷 South Korea', minLength: 9, maxLength: 11 },
    { code: '+91', country: '🇮🇳 India', minLength: 10, maxLength: 10 },
    { code: '+61', country: '🇦🇺 Australia', minLength: 9, maxLength: 9 },
    { code: '+64', country: '🇳🇿 New Zealand', minLength: 8, maxLength: 10 },
    { code: '+27', country: '🇿🇦 South Africa', minLength: 9, maxLength: 9 },
    { code: '+55', country: '🇧🇷 Brazil', minLength: 10, maxLength: 11 },
    { code: '+52', country: '🇲🇽 Mexico', minLength: 10, maxLength: 10 },
    { code: '+54', country: '🇦🇷 Argentina', minLength: 10, maxLength: 10 },
    { code: '+60', country: '🇲🇾 Malaysia', minLength: 9, maxLength: 11 },
    { code: '+65', country: '🇸🇬 Singapore', minLength: 8, maxLength: 8 },
    { code: '+66', country: '🇹🇭 Thailand', minLength: 9, maxLength: 9 },
    { code: '+90', country: '🇹🇷 Turkey', minLength: 10, maxLength: 10 }
  ];

  // Common timezones list
  const timezones = [
    { value: 'Asia/Jerusalem', label: '🇮🇱 Israel (Asia/Jerusalem)', offset: 'GMT+2/+3' },
    { value: 'Europe/London', label: '🇬🇧 London (Europe/London)', offset: 'GMT+0/+1' },
    { value: 'Europe/Paris', label: '🇫🇷 Paris (Europe/Paris)', offset: 'GMT+1/+2' },
    { value: 'Europe/Berlin', label: '🇩🇪 Berlin (Europe/Berlin)', offset: 'GMT+1/+2' },
    { value: 'Europe/Rome', label: '🇮🇹 Rome (Europe/Rome)', offset: 'GMT+1/+2' },
    { value: 'Europe/Madrid', label: '🇪🇸 Madrid (Europe/Madrid)', offset: 'GMT+1/+2' },
    { value: 'Europe/Amsterdam', label: '🇳🇱 Amsterdam (Europe/Amsterdam)', offset: 'GMT+1/+2' },
    { value: 'Europe/Brussels', label: '🇧🇪 Brussels (Europe/Brussels)', offset: 'GMT+1/+2' },
    { value: 'Europe/Zurich', label: '🇨🇭 Zurich (Europe/Zurich)', offset: 'GMT+1/+2' },
    { value: 'Europe/Vienna', label: '🇦🇹 Vienna (Europe/Vienna)', offset: 'GMT+1/+2' },
    { value: 'Europe/Stockholm', label: '🇸🇪 Stockholm (Europe/Stockholm)', offset: 'GMT+1/+2' },
    { value: 'Europe/Oslo', label: '🇳🇴 Oslo (Europe/Oslo)', offset: 'GMT+1/+2' },
    { value: 'Europe/Copenhagen', label: '🇩🇰 Copenhagen (Europe/Copenhagen)', offset: 'GMT+1/+2' },
    { value: 'Europe/Helsinki', label: '🇫🇮 Helsinki (Europe/Helsinki)', offset: 'GMT+2/+3' },
    { value: 'Europe/Dublin', label: '🇮🇪 Dublin (Europe/Dublin)', offset: 'GMT+0/+1' },
    { value: 'Europe/Lisbon', label: '🇵🇹 Lisbon (Europe/Lisbon)', offset: 'GMT+0/+1' },
    { value: 'Europe/Athens', label: '🇬🇷 Athens (Europe/Athens)', offset: 'GMT+2/+3' },
    { value: 'Europe/Moscow', label: '🇷🇺 Moscow (Europe/Moscow)', offset: 'GMT+3' },
    { value: 'Asia/Dubai', label: '🇦🇪 Dubai (Asia/Dubai)', offset: 'GMT+4' },
    { value: 'Asia/Shanghai', label: '🇨🇳 Shanghai (Asia/Shanghai)', offset: 'GMT+8' },
    { value: 'Asia/Tokyo', label: '🇯🇵 Tokyo (Asia/Tokyo)', offset: 'GMT+9' },
    { value: 'Asia/Seoul', label: '🇰🇷 Seoul (Asia/Seoul)', offset: 'GMT+9' },
    { value: 'Asia/Kolkata', label: '🇮🇳 Kolkata (Asia/Kolkata)', offset: 'GMT+5:30' },
    { value: 'Asia/Singapore', label: '🇸🇬 Singapore (Asia/Singapore)', offset: 'GMT+8' },
    { value: 'Asia/Bangkok', label: '🇹🇭 Bangkok (Asia/Bangkok)', offset: 'GMT+7' },
    { value: 'Asia/Kuala_Lumpur', label: '🇲🇾 Kuala Lumpur (Asia/Kuala_Lumpur)', offset: 'GMT+8' },
    { value: 'Asia/Istanbul', label: '🇹🇷 Istanbul (Asia/Istanbul)', offset: 'GMT+3' },
    { value: 'Australia/Sydney', label: '🇦🇺 Sydney (Australia/Sydney)', offset: 'GMT+10/+11' },
    { value: 'Australia/Melbourne', label: '🇦🇺 Melbourne (Australia/Melbourne)', offset: 'GMT+10/+11' },
    { value: 'Pacific/Auckland', label: '🇳🇿 Auckland (Pacific/Auckland)', offset: 'GMT+12/+13' },
    { value: 'Africa/Johannesburg', label: '🇿🇦 Johannesburg (Africa/Johannesburg)', offset: 'GMT+2' },
    { value: 'America/New_York', label: '🇺🇸 New York (America/New_York)', offset: 'GMT-5/-4' },
    { value: 'America/Chicago', label: '🇺🇸 Chicago (America/Chicago)', offset: 'GMT-6/-5' },
    { value: 'America/Denver', label: '🇺🇸 Denver (America/Denver)', offset: 'GMT-7/-6' },
    { value: 'America/Los_Angeles', label: '🇺🇸 Los Angeles (America/Los_Angeles)', offset: 'GMT-8/-7' },
    { value: 'America/Toronto', label: '🇨🇦 Toronto (America/Toronto)', offset: 'GMT-5/-4' },
    { value: 'America/Vancouver', label: '🇨🇦 Vancouver (America/Vancouver)', offset: 'GMT-8/-7' },
    { value: 'America/Mexico_City', label: '🇲🇽 Mexico City (America/Mexico_City)', offset: 'GMT-6/-5' },
    { value: 'America/Sao_Paulo', label: '🇧🇷 São Paulo (America/Sao_Paulo)', offset: 'GMT-3/-2' },
    { value: 'America/Buenos_Aires', label: '🇦🇷 Buenos Aires (America/Buenos_Aires)', offset: 'GMT-3' }
  ];

  // Common regions list (bilingual - values always in English)
  const regions = [
    { value: 'israel', labelHe: 'ישראל', labelEn: 'Israel' },
    { value: 'japan', labelHe: 'יפן', labelEn: 'Japan' },
    { value: 'korea', labelHe: 'קוריאה', labelEn: 'Korea' },
    { value: 'greater_china', labelHe: 'סין/הונג קונג/טאיוואן', labelEn: 'Greater China (China/Hong Kong/Taiwan)' },
    { value: 'india_south_asia', labelHe: 'הודו / דרום אסיה', labelEn: 'India / South Asia' },
    { value: 'southeast_asia', labelHe: 'דרום־מזרח אסיה', labelEn: 'Southeast Asia' },
    { value: 'indonesia_malaysia', labelHe: 'אינדונזיה/מלזיה', labelEn: 'Indonesia/Malaysia' },
    { value: 'turkey', labelHe: 'טורקיה', labelEn: 'Turkey' },
    { value: 'persian_iranian', labelHe: 'איראן/פרס', labelEn: 'Persian/Iranian' },
    { value: 'gulf_arabia', labelHe: 'העולם הערבי–מפרץ', labelEn: 'Gulf Arabia' },
    { value: 'north_africa', labelHe: 'צפון אפריקה', labelEn: 'North Africa' },
    { value: 'east_africa', labelHe: 'אפריקה מזרחית', labelEn: 'East Africa' },
    { value: 'europe_mediterranean', labelHe: 'אירופה – ים תיכוני', labelEn: 'Europe – Mediterranean' },
    { value: 'europe_west', labelHe: 'אירופה – מרכז/מערב', labelEn: 'Europe – Central/West' },
    { value: 'europe_east_russian', labelHe: 'אירופה – מזרח/רוסי', labelEn: 'Europe – East/Russian' },
    { value: 'mexico', labelHe: 'אמריקה לטינית – מקסיקו', labelEn: 'Latin America – Mexico' },
    { value: 'latam_south_america', labelHe: 'אמריקה לטינית – דרום אמריקה', labelEn: 'Latin America – South America' },
    { value: 'caribbean', labelHe: 'קריביים', labelEn: 'Caribbean' },
    { value: 'north_america', labelHe: 'צפון אמריקה', labelEn: 'North America' },
    { value: 'other', labelHe: 'אחר', labelEn: 'Other' }
  ];

  // Function to validate phone number based on country code
  const validatePhoneNumber = (phone, countryCode) => {
    // Normalize phone number (remove spaces, dashes, parentheses, dots, etc.)
    let phoneDigits = normalizePhoneForDatabase(phone);
    
    // Find the country code rules
    const countryRule = countryCodes.find(c => c.code === countryCode);
    
    if (!countryRule) {
      return { valid: true, error: '' }; // No rule means we don't validate strictly
    }
    
    // Special handling for Israeli numbers: if user enters number starting with 0 (like 0544455656)
    // We need to count it as 10 digits total, but after removing the leading 0 it becomes 9
    // So for validation purposes, we check the digits after potentially removing the leading 0
    if (countryCode === '+972' && phoneDigits.startsWith('0')) {
      phoneDigits = phoneDigits.substring(1); // Remove leading 0 for Israel
    }
    
    // Check length
    if (phoneDigits.length < countryRule.minLength) {
      const normalizedInput = normalizePhoneForDatabase(phone);
      const expected = countryCode === '+972' && normalizedInput.startsWith('0') 
        ? `10 (05X-XXX-XXXX)` 
        : `${countryRule.minLength} digits`;
      return { 
        valid: false, 
        error: `Phone number must be ${expected} for ${countryRule.country.replace(/🇺🇸|🇬🇧|🇩🇪|🇫🇷|🇮🇹|🇪🇸|🇳🇱|🇧🇪|🇨🇭|🇦🇹|🇸🇪|🇳🇴|🇩🇰|🇫🇮|🇮🇪|🇵🇹|🇬🇷|🇮🇱|🇦🇪|🇷🇺|🇨🇳|🇯🇵|🇰🇷|🇮🇳|🇦🇺|🇳🇿|🇿🇦|🇧🇷|🇲🇽|🇦🇷|🇲🇾|🇸🇬|🇹🇭|🇹🇷/g, '')}` 
      };
    }
    if (phoneDigits.length > countryRule.maxLength) {
      return { 
        valid: false, 
        error: `Phone number must be no more than ${countryRule.maxLength} digits` 
      };
    }
    
    return { valid: true, error: '' };
  };

  // All possible fields organized by step
  const allSteps = [
    {
      title: language === 'hebrew' ? 'מידע אישי בסיסי' : 'Basic Personal Information',
      fields: ['first_name', 'last_name', 'phone', 'language', 'city', 'region', 'timezone']
    },
    {
      title: language === 'hebrew' ? 'פרטי בריאות' : 'Health Information',
      fields: ['date_of_birth', 'gender', 'weight_kg', 'target_weight', 'height_cm', 'medical_conditions']
    },
    {
      title: language === 'hebrew' ? 'תזונה ומטרות' : 'Nutrition & Goals',
      fields: ['food_allergies', 'food_limitations', 'activity_level', 'goal', 'client_preference']
    }
  ];

  const steps = filteredSteps;

  // Auto-detect timezone on mount
  useEffect(() => {
    if (isOpen && !formData.timezone) {
      try {
        const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        // Check if detected timezone is in our list
        const isInList = timezones.some(tz => tz.value === detectedTimezone);
        setFormData(prev => ({
          ...prev,
          timezone: isInList ? detectedTimezone : ''
        }));
      } catch (error) {
        console.error('Error detecting timezone:', error);
      }
    }
  }, [isOpen]);

  // Load existing data and determine which fields to show
  useEffect(() => {
    if (isOpen && user) {
      loadExistingData();
    }
  }, [isOpen, user]);

  const loadExistingData = async () => {
    setCheckingData(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('first_name, last_name, phone, user_language, city, region, timezone, birth_date, age, gender, current_weight, target_weight, height, food_allergies, food_limitations, activity_level, goal, client_preference, dietary_preferences, medical_conditions')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading existing data:', error);
        setCheckingData(false);
        return;
      }

      // Pre-fill form with existing data
      if (data) {
        setFormData(prev => ({
          ...prev,
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          phone: data.phone || '',
          language: data.user_language || 'en',
          city: data.city || '',
          region: data.region || '',
          timezone: data.timezone || '',
          date_of_birth: data.birth_date || '',
          gender: data.gender || '',
          weight_kg: data.current_weight ? data.current_weight.toString() : '',
          target_weight: data.target_weight ? data.target_weight.toString() : '',
          height_cm: data.height ? data.height.toString() : '',
          food_allergies: data.food_allergies || '',
          food_limitations: data.food_limitations || '',
          activity_level: data.activity_level || '',
          goal: data.goal || '',
          client_preference: typeof data.client_preference === 'string' ? data.client_preference : (data.client_preference?.preference || '') || (typeof data.dietary_preferences === 'string' ? data.dietary_preferences : (data.dietary_preferences?.preference || '')),
          medical_conditions: data.medical_conditions || ''
        }));
      }

      // Determine which fields are missing
      const missingFields = [];
      
      // Helper function to check if a field is empty
      const isEmpty = (value) => {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string' && value.trim() === '') return true;
        if (typeof value === 'number' && value === 0) return false; // 0 is valid
        return !value;
      };

      // Check each field individually
      console.log('Checking existing data from DB:', data);
      
      // Check each field with detailed logging
      if (isEmpty(data?.first_name)) {
        missingFields.push('first_name');
      } else {
        console.log('✓ First name has value:', data?.first_name);
      }
      
      if (isEmpty(data?.last_name)) {
        missingFields.push('last_name');
      } else {
        console.log('✓ Last name has value:', data?.last_name);
      }
      
      if (isEmpty(data?.phone)) {
        missingFields.push('phone');
      } else {
        console.log('✓ Phone has value:', data?.phone);
      }
      
      if (isEmpty(data?.user_language)) {
        missingFields.push('language');
      } else {
        console.log('✓ Language has value:', data?.user_language);
      }
      
      if (isEmpty(data?.city)) {
        missingFields.push('city');
      } else {
        console.log('✓ City has value:', data?.city);
      }
      
      if (isEmpty(data?.region)) {
        missingFields.push('region');
      } else {
        console.log('✓ Region has value:', data?.region);
      }
      
      if (isEmpty(data?.timezone)) {
        missingFields.push('timezone');
      } else {
        console.log('✓ Timezone has value:', data?.timezone);
      }
      
      if (isEmpty(data?.birth_date)) {
        missingFields.push('date_of_birth');
      } else {
        console.log('✓ Birth date has value:', data?.birth_date);
      }
      
      if (isEmpty(data?.gender)) {
        missingFields.push('gender');
      } else {
        console.log('✓ Gender has value:', data?.gender);
      }
      
      if (isEmpty(data?.current_weight)) {
        missingFields.push('weight_kg');
      } else {
        console.log('✓ Weight has value:', data?.current_weight);
      }
      
      if (isEmpty(data?.target_weight)) {
        missingFields.push('target_weight');
      } else {
        console.log('✓ Target weight has value:', data?.target_weight);
      }
      
      if (isEmpty(data?.height)) {
        missingFields.push('height_cm');
      } else {
        console.log('✓ Height has value:', data?.height);
      }
      
      if (isEmpty(data?.food_allergies)) {
        missingFields.push('food_allergies');
      } else {
        console.log('✓ Food allergies has value:', data?.food_allergies);
      }
      
      if (isEmpty(data?.food_limitations)) {
        missingFields.push('food_limitations');
      } else {
        console.log('✓ Food limitations has value:', data?.food_limitations);
      }
      
      if (isEmpty(data?.activity_level)) {
        missingFields.push('activity_level');
      } else {
        console.log('✓ Activity level has value:', data?.activity_level);
      }
      
      if (isEmpty(data?.goal)) {
        missingFields.push('goal');
      } else {
        console.log('✓ Goal has value:', data?.goal);
      }
      
      if (isEmpty(data?.client_preference)) {
        missingFields.push('client_preference');
      } else {
        console.log('✓ Client preference has value:', data?.client_preference);
      }
      
      if (isEmpty(data?.medical_conditions)) {
        missingFields.push('medical_conditions');
      } else {
        console.log('✓ Medical conditions has value:', data?.medical_conditions);
      }

      console.log('📋 Missing fields to fill:', missingFields);

      // No need to store availableFields, we only need to set filteredSteps

      // Filter steps to only show steps with missing fields
      const filtered = allSteps
        .map(step => ({
          ...step,
          fields: step.fields.filter(field => missingFields.includes(field))
        }))
        .filter(step => step.fields.length > 0);

      setFilteredSteps(filtered);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setCheckingData(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    // Clear generic error message when user types (especially for phone validation errors)
    if (error && name === 'phone') {
      setError('');
    }
  };

  const handleNoneClick = (fieldName) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: ''
    }));
    // Clear error for this field when clicking None
    if (fieldErrors[fieldName]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };
  
  // Helper function to get border class based on field error
  const getBorderClass = (fieldName) => {
    if (fieldErrors[fieldName]) {
      return 'border-red-500 border-2';
    }
    return 'border-gray-600/50 border-2';
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Check if phone number exists in both clients and chat_users tables
  const checkPhoneExistsInBothTables = async (phoneNumber) => {
    try {
      // Normalize phone number first (remove spaces, dashes, etc.)
      let formattedPhone = normalizePhoneForDatabase(phoneNumber.trim());
      
      // If phone starts with 0 and country code is +972 (Israel), remove the 0 and add +972
      if (formattedPhone.startsWith('0') && formData.phoneCountryCode === '+972') {
        formattedPhone = formData.phoneCountryCode + formattedPhone.substring(1);
      } else if (!formattedPhone.startsWith('+')) {
        // If it doesn't start with +, prepend the country code
        formattedPhone = formData.phoneCountryCode + formattedPhone;
      }

      // Check in clients table
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('phone, user_id')
        .eq('phone', formattedPhone)
        .maybeSingle();

      // If found and it's not the current user's phone, it exists
      if (clientData) {
        if (clientData.user_id !== user?.id) {
          return { exists: true, table: 'clients' };
        }
        // If it's the current user's phone, it's okay - they're keeping their existing number
      }

      // Check in chat_users table (if secondary DB is available)
      if (supabaseSecondary) {
        // Check phone_number column
        const { data: chatUserDataByPhone, error: chatUserError1 } = await supabaseSecondary
          .from('chat_users')
          .select('phone_number, whatsapp_number, user_code')
          .eq('phone_number', formattedPhone)
          .maybeSingle();

        // Check whatsapp_number column
        const { data: chatUserDataByWhatsApp, error: chatUserError2 } = await supabaseSecondary
          .from('chat_users')
          .select('phone_number, whatsapp_number, user_code')
          .eq('whatsapp_number', formattedPhone)
          .maybeSingle();

        const chatUserData = chatUserDataByPhone || chatUserDataByWhatsApp;

        // If found and it's not the current user's phone (check by user_code if available)
        if (chatUserData) {
          // If we have userCode, check if it matches
          if (userCode && chatUserData.user_code === userCode) {
            // It's the same user, so it's okay
            return { exists: false };
          } else if (!userCode || chatUserData.user_code !== userCode) {
            // Different user has this phone number
            return { exists: true, table: 'chat_users' };
          }
        }
      }

      return { exists: false };
    } catch (error) {
      console.error('Error checking phone number:', error);
      // On error, don't block - let it proceed but log the error
      return { exists: false, error };
    }
  };

  const handleNext = async () => {
    // Validate current step fields
    const currentStepFields = filteredSteps[currentStep]?.fields || [];
    
    // Fields that can be empty (None is a valid selection or auto-filled)
    const optionalFields = ['medical_conditions', 'food_allergies', 'food_limitations', 'client_preference'];
    
    // Track field errors for this step
    const newFieldErrors = {};
    let hasErrors = false;
    
    currentStepFields.forEach(field => {
      // Skip validation for optional fields (empty string means "None" is selected)
      if (optionalFields.includes(field)) {
        return;
      }
      // For other fields, empty value means missing
      if (!formData[field]) {
        newFieldErrors[field] = true;
        hasErrors = true;
      }
    });

    if (hasErrors) {
      // Update field errors state to highlight empty fields
      setFieldErrors(prev => ({ ...prev, ...newFieldErrors }));
      // Clear generic error message
      setError('');
      // Scroll to first invalid field
      setTimeout(() => {
        const firstInvalidField = document.querySelector(`[name="${Object.keys(newFieldErrors)[0]}"]`);
        if (firstInvalidField) {
          firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstInvalidField.focus();
        }
      }, 100);
      return;
    }
    
    // Clear field errors if validation passes
    setFieldErrors({});

    // Validate phone number if it's in the current step
    if (currentStepFields.includes('phone') && formData.phone) {
      const phoneValidation = validatePhoneNumber(formData.phone, formData.phoneCountryCode);
      if (!phoneValidation.valid) {
        setFieldErrors(prev => ({ ...prev, phone: true }));
        setError(phoneValidation.error);
        // Scroll to phone field
        setTimeout(() => {
          const phoneField = document.querySelector(`[name="phone"]`);
          if (phoneField) {
            phoneField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            phoneField.focus();
          }
        }, 100);
        return;
      }

      // Check if phone number already exists in both tables
      setLoading(true);
      const phoneCheck = await checkPhoneExistsInBothTables(formData.phone);
      setLoading(false);
      
      if (phoneCheck.exists) {
        setFieldErrors(prev => ({ ...prev, phone: true }));
        setError(
          language === 'hebrew'
            ? 'מספר הטלפון כבר קיים במערכת. אנא השתמש במספר אחר.'
            : 'This phone number is already registered. Please use a different number.'
        );
        return;
      }
    }

    setError('');

    if (currentStep < filteredSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Last step - save data
      await handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setError('');
      // Clear field errors when going back
      setFieldErrors({});
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      // Collect all fields that were shown in the onboarding form
      const allOnboardingFields = filteredSteps.flatMap(step => step.fields);
      
      // Check if phone number already exists in both tables before saving
      if (allOnboardingFields.includes('phone') && formData.phone && formData.phone.trim()) {
        const phoneCheck = await checkPhoneExistsInBothTables(formData.phone);
        if (phoneCheck.exists) {
          setError(
            language === 'hebrew'
              ? 'מספר הטלפון כבר קיים במערכת. אנא השתמש במספר אחר.'
              : 'This phone number is already registered. Please use a different number.'
          );
          setLoading(false);
          return;
        }
      }

      // Calculate age from date_of_birth
      const age = calculateAge(formData.date_of_birth);
      console.log('📝 Fields shown in onboarding:', allOnboardingFields);
      console.log('📋 Current formData:', formData);
      console.log('🔍 Age calculation:', {
        date_of_birth: formData.date_of_birth,
        calculated_age: age,
        date_of_birth_in_fields: allOnboardingFields.includes('date_of_birth')
      });
      console.log('🔍 Gender check:', { 
        inFields: allOnboardingFields.includes('gender'), 
        value: formData.gender,
        willSave: allOnboardingFields.includes('gender') && formData.gender 
      });
      console.log('🔍 Phone check:', { 
        inFields: allOnboardingFields.includes('phone'), 
        value: formData.phone,
        countryCode: formData.phoneCountryCode,
        willSave: allOnboardingFields.includes('phone') && formData.phone 
      });
      
      // Prepare data for clients - include all fields from onboarding
      const clientData = {
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      };

      // Calculate full_name from first_name and last_name
      let fullName = null;
      if (allOnboardingFields.includes('first_name') && allOnboardingFields.includes('last_name')) {
        if (formData.first_name || formData.last_name) {
          fullName = `${formData.first_name || ''} ${formData.last_name || ''}`.trim();
        }
      }

      // Save all fields that were part of the onboarding, regardless of whether they have values
      if (allOnboardingFields.includes('first_name') && formData.first_name) {
        clientData.first_name = formData.first_name;
      }
      if (allOnboardingFields.includes('last_name') && formData.last_name) {
        clientData.last_name = formData.last_name;
      }
      if (fullName) {
        clientData.full_name = fullName;
      }
      
      // Format phone number with country code
      if (allOnboardingFields.includes('phone')) {
        if (formData.phone && formData.phone.trim()) {
          // First normalize (remove spaces, dashes, etc.)
          let phoneNumber = normalizePhoneForDatabase(formData.phone.trim());
          
          // If phone starts with 0 and country code is +972 (Israel), remove the 0 and add +972
          if (phoneNumber.startsWith('0') && formData.phoneCountryCode === '+972') {
            phoneNumber = formData.phoneCountryCode + phoneNumber.substring(1);
          } else if (!phoneNumber.startsWith('+')) {
            // If it doesn't start with +, prepend the country code
            phoneNumber = formData.phoneCountryCode + phoneNumber;
          }
          
          clientData.phone = phoneNumber;
        }
      }
      
      if (allOnboardingFields.includes('language') && formData.language) {
        clientData.user_language = formData.language;
      }
      if (allOnboardingFields.includes('city') && formData.city) {
        clientData.city = formData.city;
      }
      if (allOnboardingFields.includes('region') && formData.region) {
        clientData.region = formData.region;
      }
      if (allOnboardingFields.includes('timezone') && formData.timezone) {
        clientData.timezone = formData.timezone;
      }
      if (allOnboardingFields.includes('date_of_birth') && formData.date_of_birth) {
        clientData.birth_date = formData.date_of_birth;
      }
      if (allOnboardingFields.includes('date_of_birth') && age !== null && age !== undefined) {
        clientData.age = age;
        console.log('✅ Age will be saved to clients:', age);
      } else if (allOnboardingFields.includes('date_of_birth')) {
        console.log('⚠️ Age not calculated - date_of_birth:', formData.date_of_birth, 'calculated age:', age);
      }
      if (allOnboardingFields.includes('gender')) {
        if (formData.gender) {
          clientData.gender = formData.gender;
          console.log('✅ Gender will be saved:', formData.gender);
        } else {
          console.log('⚠️ Gender field is in onboarding but empty');
        }
      }
      if (allOnboardingFields.includes('weight_kg') && formData.weight_kg) {
        clientData.current_weight = parseFloat(formData.weight_kg);
      }
      if (allOnboardingFields.includes('target_weight') && formData.target_weight) {
        clientData.target_weight = parseFloat(formData.target_weight);
      }
      if (allOnboardingFields.includes('height_cm') && formData.height_cm) {
        clientData.height = parseFloat(formData.height_cm);
      }
      if (allOnboardingFields.includes('food_allergies')) {
        clientData.food_allergies = formData.food_allergies || null;
      }
      if (allOnboardingFields.includes('food_limitations')) {
        clientData.food_limitations = formData.food_limitations || null;
      }
      if (allOnboardingFields.includes('activity_level') && formData.activity_level) {
        clientData.activity_level = formData.activity_level;
      }
      if (allOnboardingFields.includes('goal') && formData.goal) {
        clientData.goal = formData.goal;
      }
      if (allOnboardingFields.includes('client_preference')) {
        clientData.client_preference = formData.client_preference || null;
        clientData.dietary_preferences = formData.client_preference || null; // Also save to dietary_preferences column
      }
      if (allOnboardingFields.includes('medical_conditions')) {
        clientData.medical_conditions = formData.medical_conditions || null;
      }

      // Prepare data for chat_users
      // Format phone for chat_users (same format as clients) - use the same normalized phone from clientData
      let formattedPhone = null;
      if (allOnboardingFields.includes('phone') && clientData.phone) {
        formattedPhone = clientData.phone; // Already normalized and formatted with country code
      }
      
      const chatUserData = {
        language: formData.language,
        user_language: formData.language,
        city: formData.city,
        region: formData.region,
        timezone: formData.timezone,
        date_of_birth: allOnboardingFields.includes('date_of_birth') ? formData.date_of_birth : undefined,
        age: (allOnboardingFields.includes('date_of_birth') && age !== null && age !== undefined) ? age : undefined,
        gender: formData.gender,
        weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
        height_cm: formData.height_cm ? parseFloat(formData.height_cm) : null,
        food_allergies: formData.food_allergies || null,
        food_limitations: formData.food_limitations || null,
        medical_conditions: allOnboardingFields.includes('medical_conditions') ? (formData.medical_conditions || null) : undefined,
        Activity_level: formData.activity_level,
        goal: formData.goal,
        client_preference: formData.client_preference || null,
        onboarding_done: true,
        updated_at: new Date().toISOString()
      };
      
      // Log age saving for debugging
      if (allOnboardingFields.includes('date_of_birth')) {
        console.log('🔍 Age check for chat_users:', {
          date_of_birth: formData.date_of_birth,
          calculated_age: age,
          will_save_age: age !== null && age !== undefined,
          age_value: chatUserData.age
        });
      }

      // Set full_name if we have it
      if (fullName) {
        chatUserData.full_name = fullName;
      }

      // Set phone_number and whatsapp_number if phone was collected during onboarding
      if (formattedPhone) {
        chatUserData.phone_number = formattedPhone;
        chatUserData.whatsapp_number = formattedPhone;
      }

      console.log('💾 Saving to clients:', clientData);
      
      // Update clients
      const { error: profileError } = await supabase
        .from('clients')
        .update(clientData)
        .eq('user_id', user.id);

      if (profileError) {
        console.error('Error updating clients:', profileError);
        throw profileError;
      }

      // Update chat_users if secondary DB is available
      if (supabaseSecondary && userCode) {
        try {
          const { data: chatUser, error: chatUserError } = await supabaseSecondary
            .from('chat_users')
            .select('id')
            .eq('user_code', userCode)
            .single();

          if (!chatUserError && chatUser) {
            const { error: chatUpdateError } = await supabaseSecondary
              .from('chat_users')
              .update(chatUserData)
              .eq('id', chatUser.id);

            if (chatUpdateError) {
              console.error('Error updating chat_users:', chatUpdateError);
              // Don't throw - continue even if chat_users update fails
            }
          }
        } catch (syncError) {
          console.error('Error syncing to chat_users:', syncError);
          // Don't throw - continue even if sync fails
        }
      }

      // Onboarding complete - close modal with completion status
      onClose(true);
    } catch (err) {
      console.error('Error saving onboarding data:', err);
      setError(language === 'hebrew' ? 'שגיאה בשמירת הנתונים. אנא נסה שוב.' : 'Error saving data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      // Don't mark onboarding as completed when skipped
      // This allows the onboarding to show again when they return to the profile page
      // Just close the modal without updating onboarding_completed
      // Pass false to indicate it was skipped (not completed)
      onClose(false);
    } catch (err) {
      console.error('Error skipping onboarding:', err);
      // Close anyway, but indicate it was skipped
      onClose(false);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (checkingData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn" dir={direction}>
        <div className={`${themeClasses.bgCard} rounded-xl shadow-2xl p-6 sm:p-8 max-w-md w-full mx-4 animate-scaleIn`}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-emerald-500 mx-auto mb-3 sm:mb-4"></div>
            <p className={`${themeClasses.textPrimary} text-sm sm:text-base`}>
              {language === 'hebrew' ? 'בודק נתונים...' : 'Checking data...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (filteredSteps.length === 0) {
    return null;
  }

  const currentFields = filteredSteps[currentStep]?.fields || [];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-2 sm:p-4" dir={direction}>
      <div className={`${themeClasses.bgCard} rounded-xl sm:rounded-2xl shadow-2xl border border-white/10 p-4 sm:p-6 md:p-8 max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto animate-scaleIn relative`}>
        {/* Decorative gradient overlay */}
        <div className="absolute top-0 left-0 right-0 h-20 sm:h-32 bg-gradient-to-br from-established-500/20 via-emerald-500/10 to-transparent rounded-t-xl sm:rounded-t-2xl pointer-events-none"></div>
        
        {/* Language Toggle Button */}
        <button
          onClick={toggleLanguage}
          className={`absolute top-2 right-2 sm:top-4 sm:right-4 md:top-6 ${direction === 'rtl' ? 'md:left-6 md:right-auto' : 'md:right-6'} z-10 px-2 py-1.5 sm:px-3 sm:py-1.5 md:px-4 md:py-2 rounded-lg ${themeClasses.bgCard} border-2 border-gray-600/50 hover:border-emerald-500/50 transition-all duration-200 text-xs sm:text-sm font-semibold ${themeClasses.textPrimary} hover:bg-emerald-500/10`}
          title={language === 'hebrew' ? 'Switch to English' : 'עברית'}
        >
          <span className="hidden sm:inline">{language === 'hebrew' ? '🇬🇧 English' : '🇮🇱 עברית'}</span>
          <span className="sm:hidden">{language === 'hebrew' ? 'EN' : 'ע'}</span>
        </button>
        
        {/* Header */}
        <div className="mb-4 sm:mb-6 md:mb-8 relative mt-8 sm:mt-0">
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-gradient-to-br from-emerald-400 to-established-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg text-sm sm:text-base md:text-lg">
              {(currentStep + 1)}
            </div>
            <h2 className={`text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-400 to-established-400 bg-clip-text text-transparent ${themeClasses.textPrimary} leading-tight`}>
              {language === 'hebrew' ? 'בואו נעשה כמה שאלות התחלה' : "Let's get started"}
            </h2>
          </div>
          <p className={`${themeClasses.textSecondary} text-xs sm:text-sm ml-10 sm:ml-12 md:ml-14`}>
            {language === 'hebrew' ? `שלב ${currentStep + 1} מתוך ${filteredSteps.length}` : `Step ${currentStep + 1} of ${filteredSteps.length}`}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <div className="w-full bg-gray-700/50 rounded-full h-2 sm:h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-400 to-established-500 h-2 sm:h-2.5 rounded-full transition-all duration-500 ease-out shadow-lg shadow-emerald-500/50"
              style={{ width: `${((currentStep + 1) / filteredSteps.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-4 sm:space-y-5 md:space-y-6">
          {currentFields.includes('first_name') && (
            <div className="group">
              <label className={`block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2 ${themeClasses.textPrimary}`}>
                {language === 'hebrew' ? 'שם פרטי' : 'First Name'}
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                className={`w-full px-3 py-2.5 sm:px-4 sm:py-3 md:py-3.5 text-sm sm:text-base ${themeClasses.bgCard} ${getBorderClass('first_name')} rounded-lg sm:rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 ${themeClasses.textPrimary} placeholder:text-gray-400 hover:border-emerald-500/50`}
                placeholder={language === 'hebrew' ? 'יוסי' : 'John'}
              />
            </div>
          )}

          {currentFields.includes('last_name') && (
            <div className="group">
              <label className={`block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2 ${themeClasses.textPrimary}`}>
                {language === 'hebrew' ? 'שם משפחה' : 'Last Name'}
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                className={`w-full px-3 py-2.5 sm:px-4 sm:py-3 md:py-3.5 text-sm sm:text-base ${themeClasses.bgCard} ${getBorderClass('last_name')} rounded-lg sm:rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 ${themeClasses.textPrimary} placeholder:text-gray-400 hover:border-emerald-500/50`}
                placeholder={language === 'hebrew' ? 'כהן' : 'Doe'}
              />
            </div>
          )}

          {currentFields.includes('phone') && (
            <div className="group">
              <label className={`block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2 ${themeClasses.textPrimary}`}>
                {language === 'hebrew' ? 'מספר טלפון' : 'Phone Number'}
              </label>
              <div className="flex gap-2">
                <select
                  name="phoneCountryCode"
                  value={formData.phoneCountryCode}
                  onChange={handleInputChange}
                  className={`px-2 py-2.5 sm:px-3 sm:py-3 md:py-3.5 text-xs sm:text-sm ${themeClasses.bgCard} ${getBorderClass('phone')} rounded-lg sm:rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 ${themeClasses.textPrimary} hover:border-emerald-500/50 cursor-pointer`}
                >
                  {countryCodes.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.country} {country.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className={`flex-1 px-3 py-2.5 sm:px-4 sm:py-3 md:py-3.5 text-sm sm:text-base ${themeClasses.bgCard} ${getBorderClass('phone')} rounded-lg sm:rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 ${themeClasses.textPrimary} placeholder:text-gray-400 hover:border-emerald-500/50`}
                  placeholder={language === 'hebrew' ? '50-123-4567' : '50-123-4567'}
                />
              </div>
            </div>
          )}

          {currentFields.includes('language') && (
            <div className="group">
              <label className={`block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2 ${themeClasses.textPrimary}`}>
                {language === 'hebrew' ? 'שפה מועדפת' : 'Preferred Language'}
              </label>
              <select
                name="language"
                value={formData.language}
                onChange={handleInputChange}
                className={`w-full px-3 py-2.5 sm:px-4 sm:py-3 md:py-3.5 text-sm sm:text-base ${themeClasses.bgCard} ${getBorderClass('language')} rounded-lg sm:rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 ${themeClasses.textPrimary} hover:border-emerald-500/50 cursor-pointer`}
              >
                <option value="en">🇬🇧 English (en)</option>
                <option value="he">🇮🇱 עברית (he)</option>
              </select>
            </div>
          )}

          {currentFields.includes('city') && (
            <div className="group">
              <label className={`block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2 ${themeClasses.textPrimary}`}>
                {language === 'hebrew' ? 'עיר' : 'City'}
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                className={`w-full px-3 py-2.5 sm:px-4 sm:py-3 md:py-3.5 text-sm sm:text-base ${themeClasses.bgCard} ${getBorderClass('city')} rounded-lg sm:rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 ${themeClasses.textPrimary} placeholder:text-gray-400 hover:border-emerald-500/50`}
                placeholder={language === 'hebrew' ? 'תל אביב' : 'Tel Aviv'}
              />
            </div>
          )}

          {currentFields.includes('region') && (
            <div className="group">
              <label className={`block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2 ${themeClasses.textPrimary}`}>
                {language === 'hebrew' ? 'אזור' : 'Region'}
              </label>
              <select
                name="region"
                value={formData.region}
                onChange={handleInputChange}
                className={`w-full px-3 py-2.5 sm:px-4 sm:py-3 md:py-3.5 text-sm sm:text-base ${themeClasses.bgCard} ${getBorderClass('region')} rounded-lg sm:rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 ${themeClasses.textPrimary} hover:border-emerald-500/50 cursor-pointer`}
              >
                <option value="">{language === 'hebrew' ? 'בחר אזור' : 'Select Region'}</option>
                {regions.map((region) => (
                  <option key={region.value} value={region.value}>
                    {language === 'hebrew' ? region.labelHe : region.labelEn}
                  </option>
                ))}
              </select>
            </div>
          )}

          {currentFields.includes('timezone') && (
            <div className="group">
              <label className={`block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2 ${themeClasses.textPrimary}`}>
                {language === 'hebrew' ? 'אזור זמן' : 'Timezone'}
              </label>
              <select
                name="timezone"
                value={formData.timezone}
                onChange={handleInputChange}
                className={`w-full px-3 py-2.5 sm:px-4 sm:py-3 md:py-3.5 text-sm sm:text-base ${themeClasses.bgCard} ${getBorderClass('timezone')} rounded-lg sm:rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 ${themeClasses.textPrimary} hover:border-emerald-500/50 cursor-pointer`}
              >
                <option value="">{language === 'hebrew' ? 'בחר אזור זמן' : 'Select timezone'}</option>
                {timezones.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {currentFields.includes('date_of_birth') && (
            <div className="group">
              <label className={`block text-xs sm:text-sm font-semibold ${themeClasses.textPrimary} mb-1.5 sm:mb-2`}>
                {language === 'hebrew' ? 'תאריך לידה' : 'Date of Birth'}
              </label>
              <input
                type="date"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleInputChange}
                className={`w-full px-4 py-3.5 ${themeClasses.bgCard} ${getBorderClass('date_of_birth')} rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 ${themeClasses.textPrimary} hover:border-emerald-500/50`}
              />
            </div>
          )}

          {currentFields.includes('gender') && (
            <div className="group">
              <label className={`block text-xs sm:text-sm font-semibold ${themeClasses.textPrimary} mb-1.5 sm:mb-2`}>
                {language === 'hebrew' ? 'מין' : 'Gender'}
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                className={`w-full px-4 py-3.5 ${themeClasses.bgCard} ${getBorderClass('gender')} rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 ${themeClasses.textPrimary} hover:border-emerald-500/50`}
              >
                <option value="">{language === 'hebrew' ? 'בחר' : 'Select'}</option>
                <option value="male">{language === 'hebrew' ? 'זכר' : 'Male'}</option>
                <option value="female">{language === 'hebrew' ? 'נקבה' : 'Female'}</option>
                <option value="other">{language === 'hebrew' ? 'אחר' : 'Other'}</option>
              </select>
            </div>
          )}

          {currentFields.includes('weight_kg') && (
            <div className="group">
              <label className={`block text-xs sm:text-sm font-semibold ${themeClasses.textPrimary} mb-1.5 sm:mb-2`}>
                {language === 'hebrew' ? 'משקל נוכחי (ק"ג)' : 'Current Weight (kg)'}
              </label>
              <input
                type="number"
                name="weight_kg"
                value={formData.weight_kg}
                onChange={handleInputChange}
                min="0"
                step="0.1"
                className={`w-full px-4 py-3.5 ${themeClasses.bgCard} ${getBorderClass('weight_kg')} rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 ${themeClasses.textPrimary} hover:border-emerald-500/50`}
                placeholder={language === 'hebrew' ? '70' : '70'}
              />
            </div>
          )}

          {currentFields.includes('target_weight') && (
            <div className="group">
              <label className={`block text-xs sm:text-sm font-semibold ${themeClasses.textPrimary} mb-1.5 sm:mb-2`}>
                {language === 'hebrew' ? 'משקל מטרה (ק"ג)' : 'Target Weight (kg)'}
              </label>
              <input
                type="number"
                name="target_weight"
                value={formData.target_weight}
                onChange={handleInputChange}
                min="0"
                step="0.1"
                className={`w-full px-4 py-3.5 ${themeClasses.bgCard} ${getBorderClass('target_weight')} rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 ${themeClasses.textPrimary} hover:border-emerald-500/50`}
                placeholder={language === 'hebrew' ? '65' : '65'}
              />
            </div>
          )}

          {currentFields.includes('height_cm') && (
            <div className="group">
              <label className={`block text-xs sm:text-sm font-semibold ${themeClasses.textPrimary} mb-1.5 sm:mb-2`}>
                {language === 'hebrew' ? 'גובה (ס"מ)' : 'Height (cm)'}
              </label>
              <input
                type="number"
                name="height_cm"
                value={formData.height_cm}
                onChange={handleInputChange}
                min="0"
                step="1"
                className={`w-full px-4 py-3.5 ${themeClasses.bgCard} ${getBorderClass('height_cm')} rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 ${themeClasses.textPrimary} hover:border-emerald-500/50`}
                placeholder={language === 'hebrew' ? '175' : '175'}
              />
            </div>
          )}

          {currentFields.includes('medical_conditions') && (
            <div className="group">
              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                <label className={`block text-xs sm:text-sm font-semibold ${themeClasses.textPrimary}`}>
                  {language === 'hebrew' ? 'מצבים רפואיים' : 'Medical Conditions'}
                </label>
                <button
                  type="button"
                  onClick={() => handleNoneClick('medical_conditions')}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-1.5 md:px-4 md:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                    !formData.medical_conditions
                      ? 'bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-400'
                      : 'bg-gray-700/50 border-2 border-gray-600/50 text-gray-400 hover:bg-gray-600/50 hover:border-emerald-500/30 hover:text-emerald-400'
                  }`}
                >
                  {!formData.medical_conditions ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {language === 'hebrew' ? 'אין' : 'None'}
                </button>
              </div>
              <textarea
                name="medical_conditions"
                value={formData.medical_conditions}
                onChange={handleInputChange}
                rows="3"
                className={`w-full px-3 py-2.5 sm:px-4 sm:py-3 md:py-3.5 text-sm sm:text-base ${themeClasses.bgCard} border-2 ${!formData.medical_conditions ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gray-600/50'} rounded-lg sm:rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 ${themeClasses.textPrimary} hover:border-emerald-500/50`}
                placeholder={!formData.medical_conditions ? (language === 'hebrew' ? 'לא נבחר - לחץ כדי להוסיף' : 'None selected - click to add') : (language === 'hebrew' ? 'לדוגמה: סוכרת, לחץ דם...' : 'e.g., diabetes, hypertension...')}
              />
            </div>
          )}

          {currentFields.includes('food_allergies') && (
            <div className="group">
              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                <label className={`block text-xs sm:text-sm font-semibold ${themeClasses.textPrimary}`}>
                  {language === 'hebrew' ? 'אלרגיות למזון' : 'Food Allergies'}
                </label>
                <button
                  type="button"
                  onClick={() => handleNoneClick('food_allergies')}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-1.5 md:px-4 md:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                    !formData.food_allergies
                      ? 'bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-400'
                      : 'bg-gray-700/50 border-2 border-gray-600/50 text-gray-400 hover:bg-gray-600/50 hover:border-emerald-500/30 hover:text-emerald-400'
                  }`}
                >
                  {!formData.food_allergies ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {language === 'hebrew' ? 'אין' : 'None'}
                </button>
              </div>
              <textarea
                name="food_allergies"
                value={formData.food_allergies}
                onChange={handleInputChange}
                rows="3"
                className={`w-full px-3 py-2.5 sm:px-4 sm:py-3 md:py-3.5 text-sm sm:text-base ${themeClasses.bgCard} border-2 ${!formData.food_allergies ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gray-600/50'} rounded-lg sm:rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 ${themeClasses.textPrimary} hover:border-emerald-500/50`}
                placeholder={!formData.food_allergies ? (language === 'hebrew' ? 'לא נבחר - לחץ כדי להוסיף' : 'None selected - click to add') : (language === 'hebrew' ? 'לדוגמה: בוטנים, חלב...' : 'e.g., peanuts, dairy...')}
              />
            </div>
          )}

          {currentFields.includes('food_limitations') && (
            <div className="group">
              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                <label className={`block text-xs sm:text-sm font-semibold ${themeClasses.textPrimary}`}>
                  {language === 'hebrew' ? 'הגבלות תזונתיות' : 'Food Limitations'}
                </label>
                <button
                  type="button"
                  onClick={() => handleNoneClick('food_limitations')}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-1.5 md:px-4 md:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                    !formData.food_limitations
                      ? 'bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-400'
                      : 'bg-gray-700/50 border-2 border-gray-600/50 text-gray-400 hover:bg-gray-600/50 hover:border-emerald-500/30 hover:text-emerald-400'
                  }`}
                >
                  {!formData.food_limitations ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {language === 'hebrew' ? 'אין' : 'None'}
                </button>
              </div>
              <textarea
                name="food_limitations"
                value={formData.food_limitations}
                onChange={handleInputChange}
                rows="3"
                className={`w-full px-3 py-2.5 sm:px-4 sm:py-3 md:py-3.5 text-sm sm:text-base ${themeClasses.bgCard} border-2 ${!formData.food_limitations ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gray-600/50'} rounded-lg sm:rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 ${themeClasses.textPrimary} hover:border-emerald-500/50`}
                placeholder={!formData.food_limitations ? (language === 'hebrew' ? 'לא נבחר - לחץ כדי להוסיף' : 'None selected - click to add') : (language === 'hebrew' ? 'לדוגמה: צמחוני, כשר...' : 'e.g., vegetarian, kosher...')}
              />
            </div>
          )}

          {currentFields.includes('activity_level') && (
            <div className="group">
              <label className={`block text-xs sm:text-sm font-semibold ${themeClasses.textPrimary} mb-1.5 sm:mb-2`}>
                {language === 'hebrew' ? 'רמת פעילות' : 'Activity Level'}
              </label>
              <select
                name="activity_level"
                value={formData.activity_level}
                onChange={handleInputChange}
                className={`w-full px-4 py-3.5 ${themeClasses.bgCard} ${getBorderClass('activity_level')} rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 ${themeClasses.textPrimary} hover:border-emerald-500/50`}
              >
                <option value="">{language === 'hebrew' ? 'בחר' : 'Select'}</option>
                <option value="sedentary">{language === 'hebrew' ? 'יושבני - מעט או ללא פעילות גופנית' : 'Sedentary - Little or no exercise'}</option>
                <option value="light">{language === 'hebrew' ? 'פעילות קלה - 1-3 פעמים בשבוע' : 'Light Activity - 1-3 days/week'}</option>
                <option value="moderate">{language === 'hebrew' ? 'פעילות בינונית - 3-5 פעמים בשבוע' : 'Moderate Activity - 3-5 days/week'}</option>
                <option value="active">{language === 'hebrew' ? 'פעיל - 6-7 פעמים בשבוע' : 'Active - 6-7 days/week'}</option>
                <option value="extreme">{language === 'hebrew' ? 'קיצוני - פעילות אינטנסיבית/עבודה פיזית' : 'Extreme - Very hard exercise/physical job'}</option>
              </select>
            </div>
          )}

          {currentFields.includes('goal') && (
            <div className="group">
              <label className={`block text-xs sm:text-sm font-semibold ${themeClasses.textPrimary} mb-1.5 sm:mb-2`}>
                {language === 'hebrew' ? 'מטרה' : 'Goal'}
              </label>
              <select
                name="goal"
                value={formData.goal}
                onChange={handleInputChange}
                className={`w-full px-3 py-2.5 sm:px-4 sm:py-3 md:py-3.5 text-sm sm:text-base ${themeClasses.bgCard} ${getBorderClass('goal')} rounded-lg sm:rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 ${themeClasses.textPrimary} hover:border-emerald-500/50 cursor-pointer`}
              >
                <option value="">{language === 'hebrew' ? 'בחר מטרה' : 'Select a goal'}</option>
                <option value="lose">{language === 'hebrew' ? 'ירידה במשקל' : 'Lose Weight'}</option>
                <option value="cut">{language === 'hebrew' ? 'CUT' : 'CUT'}</option>
                <option value="maintain">{language === 'hebrew' ? 'שמירה על משקל' : 'Maintain Weight'}</option>
                <option value="gain">{language === 'hebrew' ? 'עלייה במשקל' : 'Gain Weight'}</option>
                <option value="muscle">{language === 'hebrew' ? 'בניית שרירים' : 'Build Muscle'}</option>
                <option value="improve_performance">{language === 'hebrew' ? 'שיפור ביצועים' : 'Improve Performance'}</option>
                <option value="improve_health">{language === 'hebrew' ? 'שיפור בריאות' : 'Improve Health'}</option>
              </select>
            </div>
          )}

          {currentFields.includes('client_preference') && (
            <div className="group">
              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                <label className={`block text-xs sm:text-sm font-semibold ${themeClasses.textPrimary}`}>
                  {language === 'hebrew' ? 'העדפות אישיות' : 'Personal Preferences'}
                </label>
                <button
                  type="button"
                  onClick={() => handleNoneClick('client_preference')}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-1.5 md:px-4 md:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                    !formData.client_preference
                      ? 'bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-400'
                      : 'bg-gray-700/50 border-2 border-gray-600/50 text-gray-400 hover:bg-gray-600/50 hover:border-emerald-500/30 hover:text-emerald-400'
                  }`}
                >
                  {!formData.client_preference ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {language === 'hebrew' ? 'אין' : 'None'}
                </button>
              </div>
              <textarea
                name="client_preference"
                value={formData.client_preference}
                onChange={handleInputChange}
                rows="4"
                className={`w-full px-3 py-2.5 sm:px-4 sm:py-3 md:py-3.5 text-sm sm:text-base ${themeClasses.bgCard} border-2 ${!formData.client_preference ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gray-600/50'} rounded-lg sm:rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 ${themeClasses.textPrimary} hover:border-emerald-500/50`}
                placeholder={!formData.client_preference ? (language === 'hebrew' ? 'לא נבחר - לחץ כדי להוסיף' : 'None selected - click to add') : (language === 'hebrew' ? 'מה אתה אוהב לאכול? מה אתה לא אוהב לאכול?' : 'What do you like to eat? What don\'t you like to eat?')}
              />
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-red-500/10 border-2 border-red-500/30 text-red-400 rounded-lg sm:rounded-xl backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-xs sm:text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-between items-center mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-white/10 gap-2 sm:gap-3">
          <div>
            {currentStep > 0 && (
              <button
                onClick={handlePrevious}
                disabled={loading}
                className={`px-4 py-2 sm:px-6 sm:py-2.5 md:px-8 md:py-3.5 border-2 border-gray-600/50 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm md:text-base ${themeClasses.textSecondary} hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all duration-200 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                ← {language === 'hebrew' ? 'קודם' : 'Previous'}
              </button>
            )}
            {currentStep === 0 && (
              <button
                onClick={handleSkip}
                disabled={loading}
                className={`px-3 py-2 sm:px-4 sm:py-2.5 md:px-6 md:py-3.5 text-xs sm:text-sm md:text-base text-gray-400 hover:text-white font-semibold transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {language === 'hebrew' ? 'דלג' : 'Skip'}
              </button>
            )}
          </div>
          <div className="flex gap-2 sm:gap-3">
            {currentStep < filteredSteps.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={loading}
                className={`px-4 py-2 sm:px-5 sm:py-2.5 md:px-6 md:py-3 bg-emerald-500 text-white rounded-lg font-semibold text-xs sm:text-sm md:text-base hover:bg-emerald-600 transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {language === 'hebrew' ? 'הבא' : 'Next'} →
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={loading}
                className={`px-4 py-2 sm:px-5 sm:py-2.5 md:px-6 md:py-3 bg-emerald-500 text-white rounded-lg font-semibold text-xs sm:text-sm md:text-base hover:bg-emerald-600 transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? (language === 'hebrew' ? 'שומר...' : 'Saving...') : (language === 'hebrew' ? 'סיום' : 'Finish')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;

