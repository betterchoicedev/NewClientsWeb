// Translation service for meal plans
const CACHE_PREFIX = 'meal_translation';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get cached translation from localStorage
 */
const getCachedTranslation = (cacheKey) => {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is expired
    if (now - timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error reading cached translation:', error);
    return null;
  }
};

/**
 * Cache translation in localStorage
 */
const cacheTranslation = (cacheKey, data) => {
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error caching translation:', error);
    // If localStorage is full, try to clear old translations
    try {
      clearOldTranslations();
      localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (retryError) {
      console.error('Failed to cache translation after cleanup:', retryError);
    }
  }
};

/**
 * Clear old translations from cache
 */
const clearOldTranslations = () => {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const cached = localStorage.getItem(key);
          const { timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp > CACHE_EXPIRY_MS) {
            keysToRemove.push(key);
          }
        } catch (e) {
          // Remove corrupted cache entries
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`🧹 Cleared ${keysToRemove.length} old translation cache entries`);
  } catch (error) {
    console.error('Error clearing old translations:', error);
  }
};

/**
 * Generate cache key from menu data
 */
const generateCacheKey = (menu, targetLang) => {
  try {
    // Create a simplified version of the menu for cache key
    const keyData = {
      mealsCount: menu.meals?.length || 0,
      mealNames: menu.meals?.map(m => m.meal).join('_'),
      targetLang
    };
    const keyString = JSON.stringify(keyData);
    return `${CACHE_PREFIX}_${targetLang}_${btoa(keyString).substring(0, 20)}`;
  } catch (error) {
    console.error('Error generating cache key:', error);
    return `${CACHE_PREFIX}_${targetLang}_${Date.now()}`;
  }
};

/**
 * Translate meal plan menu
 * @param {Object} menu - The menu object to translate
 * @param {string} targetLang - Target language code ('he' for Hebrew, 'en' for English)
 * @returns {Promise<Object>} - Translated menu object
 */
export const translateMenu = async (menu, targetLang = 'he') => {
  // If target language is English or menu is empty, return original
  if (targetLang === 'en' || !menu || !menu.meals || menu.meals.length === 0) {
    return menu;
  }

  try {
    // Generate cache key
    const cacheKey = generateCacheKey(menu, targetLang);
    
    // Check cache first
    const cachedTranslation = getCachedTranslation(cacheKey);
    if (cachedTranslation) {
      console.log('✅ Using cached menu translation');
      return cachedTranslation;
    }

    console.log('🌐 Translating menu to', targetLang);

    // Prepare menu for translation
    const menuToTranslate = {
      meals: menu.meals || [],
      note: menu.note || ''
    };

    // Call translation API
    const translateApiUrl = process.env.REACT_APP_TRANSLATE_API_URL || 'https://dietitian-be.azurewebsites.net/api/translate';
    
    if (!process.env.REACT_APP_TRANSLATE_API_URL) {
      console.warn('⚠️ REACT_APP_TRANSLATE_API_URL is not set in environment variables. Using fallback URL.');
      console.warn('💡 To fix: Add REACT_APP_TRANSLATE_API_URL to your .env file and restart the dev server.');
    }

    console.log('🌐 Calling translation API:', translateApiUrl);
    console.log('📤 Request payload:', { 
      mealsCount: menuToTranslate.meals?.length || 0, 
      targetLang 
    });

    const response = await fetch(translateApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        menu: menuToTranslate, 
        targetLang 
      }),
    });

    if (!response.ok) {
      // Try to get error details from response
      let errorDetails = {};
      try {
        errorDetails = await response.json();
      } catch (e) {
        // If response is not JSON, try to get text
        try {
          const text = await response.text();
          errorDetails = { message: text, status: response.status, statusText: response.statusText };
        } catch (e2) {
          errorDetails = { status: response.status, statusText: response.statusText };
        }
      }
      
      console.error('❌ Translation API error:', {
        status: response.status,
        statusText: response.statusText,
        errorDetails
      });
      
      throw new Error(
        errorDetails.error || 
        errorDetails.message || 
        `Translation failed: ${response.status} ${response.statusText}`
      );
    }
    
    const result = await response.json();
    
    // Cache the successful translation
    cacheTranslation(cacheKey, result);
    
    console.log('✅ Menu translated successfully');
    return result;
  } catch (error) {
    console.error('Error translating menu:', error);
    
    // Try to use fallback cached translation
    try {
      const fallbackCacheKey = `${CACHE_PREFIX}_${targetLang}_fallback`;
      const fallbackTranslation = getCachedTranslation(fallbackCacheKey);
      if (fallbackTranslation) {
        console.log('🔄 Using fallback cached menu translation');
        return fallbackTranslation;
      }
    } catch (fallbackError) {
      console.warn('Failed to load fallback translation:', fallbackError);
    }
    
    // Return original menu if translation fails
    console.warn('⚠️ Translation failed, using original menu');
    return menu;
  }
};

/**
 * Clear all translation cache
 */
export const clearTranslationCache = () => {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`🧹 Cleared ${keysToRemove.length} translation cache entries`);
  } catch (error) {
    console.error('Error clearing translation cache:', error);
  }
};

export default translateMenu;

