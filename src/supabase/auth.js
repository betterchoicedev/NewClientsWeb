import { supabase, supabaseSecondary } from './supabaseClient'

// API URL helper
const getApiUrl = () => process.env.REACT_APP_API_URL || 'https://newclientsweb.onrender.com';

// Check if email already exists in both databases
export const checkEmailExists = async (email) => {
  try {
    const normalizedEmail = email.toLowerCase();
    
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/auth/check-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail })
    });

    const result = await response.json();

    if (!response.ok) {
      return { exists: false, error: { message: result.error } };
    }

    return { exists: result.exists, error: null };
  } catch (error) {
    console.error('Error checking email:', error);
    return { exists: false, error };
  }
};

// Helper function to normalize phone number (remove spaces and dashes)
// Export this so it can be used globally across the app
export const normalizePhoneForDatabase = (phone) => {
  if (!phone) return '';
  // Remove all spaces, dashes, and other common separators
  return phone.replace(/[\s\-\(\)\.]/g, '');
};

// Check if phone number already exists in both databases
export const checkPhoneExists = async (phone) => {
  try {
    const normalizedPhone = normalizePhoneForDatabase(phone);
    
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/auth/check-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalizedPhone })
    });

    const result = await response.json();

    if (!response.ok) {
      return { exists: false, error: { message: result.error } };
    }

    return { exists: result.exists, error: null };
  } catch (error) {
    console.error('Error checking phone:', error);
    return { exists: false, error };
  }
};

// Sign up with email and password
export const signUp = async (email, password, userData = {}) => {
  try {
    console.log('Attempting signup with:', { email, userData });
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_na : userData.first_name,
          last_name: userData.last_name,
          phone: userData.phone,
          newsletter: userData.newsletter,
          full_name: `${userData.first_name} ${userData.last_name}`.trim()
        }
      }
    })
    
    console.log('Signup response:', { data, error });
    
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Sign up error:', error)
    return { data: null, error }
  }
}

// Sign in with email and password
export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Sign in error:', error)
    return { data: null, error }
  }
}

// Sign in with Google OAuth
export const signInWithGoogle = async () => {
  try {
    console.log('Attempting Google OAuth login...');
    console.log('Current origin:', window.location.origin);
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/profile`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    })
    
    if (error) {
      console.error('Google OAuth error:', error);
      throw error;
    }
    
    console.log('Google OAuth initiated successfully');
    return { data, error: null }
  } catch (error) {
    console.error('Google sign in error:', error);
    return { data: null, error }
  }
}

// Sign in with Facebook OAuth
export const signInWithFacebook = async () => {
  try {
    console.log('Attempting Facebook OAuth login...');
    console.log('Current origin:', window.location.origin);
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: `${window.location.origin}/profile`
      }
    })
    
    if (error) {
      console.error('Facebook OAuth error:', error);
      throw error;
    }
    
    console.log('Facebook OAuth initiated successfully');
    return { data, error: null }
  } catch (error) {
    console.error('Facebook sign in error:', error);
    return { data: null, error }
  }
}

// Sign out
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return { error: null }
  } catch (error) {
    console.error('Sign out error:', error)
    return { error }
  }
}

// Get current user
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return { user, error: null }
  } catch (error) {
    console.error('Get current user error:', error)
    return { user: null, error }
  }
}

// Reset password - send email with link
export const resetPassword = async (email) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) throw error
    return { error: null }
  } catch (error) {
    console.error('Reset password error:', error)
    return { error }
  }
}

// Update password after reset
export const updatePassword = async (newPassword) => {
  try {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    })
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Update password error:', error)
    return { data: null, error }
  }
}

// Update user profile
export const updateProfile = async (updates) => {
  try {
    const { data, error } = await supabase.auth.updateUser({
      data: updates
    })
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Update profile error:', error)
    return { data: null, error }
  }
}

// Listen to auth changes
export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange(callback)
}

// Generate a unique 6-letter user code
export const generateUniqueUserCode = async () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let attempts = 0;
  const maxAttempts = 100; // Prevent infinite loops
  const apiUrl = getApiUrl();

  while (attempts < maxAttempts) {
    // Generate random 6-letter code
    let userCode = '';
    for (let i = 0; i < 6; i++) {
      userCode += letters.charAt(Math.floor(Math.random() * letters.length));
    }

    try {
      const response = await fetch(`${apiUrl}/api/auth/check-user-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userCode })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to check user code');
      }

      // If code doesn't exist, we can use it
      if (!result.exists) {
        return userCode;
      }

      // Code exists, try again
      attempts++;
    } catch (error) {
      console.error('Error checking user code uniqueness:', error);
      throw error;
    }
  }

  throw new Error('Failed to generate unique user code after maximum attempts');
};

// Create client record in clients table and chat_users table
export const createClientRecord = async (userId, userData, providerId = null) => {
  try {
    // Generate unique user code
    const userCode = await generateUniqueUserCode();
    
    // Normalize phone number before saving (remove spaces and dashes)
    const normalizedPhone = userData.phone ? normalizePhoneForDatabase(userData.phone) : null;
    
    // Check for manager link data in sessionStorage (for OAuth flows)
    let managerLinkData = null;
    try {
      const managerLinkDataStr = sessionStorage.getItem('manager_link_data');
      if (managerLinkDataStr) {
        managerLinkData = JSON.parse(managerLinkDataStr);
      }
    } catch (e) {
      console.error('Error parsing manager link data:', e);
    }

    // Determine final provider ID
    // Priority: manager_id from manager link > provided providerId > default provider
    let finalProviderId = providerId;
    
    if (managerLinkData && managerLinkData.manager_id) {
      finalProviderId = managerLinkData.manager_id;
      console.log('✅ Using manager ID from link:', finalProviderId);
    } else if (!finalProviderId || (typeof finalProviderId === 'string' && finalProviderId.trim().length === 0)) {
      try {
        const apiUrl = getApiUrl();
        const providerResponse = await fetch(`${apiUrl}/api/auth/default-provider`);
        const providerResult = await providerResponse.json();
        
        if (providerResponse.ok && providerResult.provider_id) {
          finalProviderId = providerResult.provider_id;
        }
      } catch (providerError) {
        console.error('Error finding default provider:', providerError);
      }
    }
    
    // Create client record via API
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/auth/create-client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        userData: {
          ...userData,
          phone: normalizedPhone
        },
        userCode,
        providerId: finalProviderId
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Client record creation error:', result.error);
      throw new Error(result.error);
    }

    return { 
      data: result.data, 
      error: null,
      chatUserCreated: result.chatUserCreated,
      chatUserData: result.chatUserData
    };
  } catch (error) {
    console.error('Create client record error:', error);
    return { data: null, error };
  }
}

// Get client record by user ID
export const getClientRecord = async (userId) => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/auth/client/${userId}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to get client record');
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Get client record error:', error);
    return { data: null, error };
  }
}

// Update client record in clients and optionally sync to chat_users
export const updateClientRecord = async (userId, updates) => {
  try {
    // Normalize phone number if it's being updated
    const normalizedUpdates = { ...updates };
    if (normalizedUpdates.phone) {
      normalizedUpdates.phone = normalizePhoneForDatabase(normalizedUpdates.phone);
    }
    
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/auth/client/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: normalizedUpdates })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to update client record');
    }

    console.log('Chat user synced successfully');
    return { data: result.data, error: null };
  } catch (error) {
    console.error('Update client record error:', error);
    return { data: null, error };
  }
}
