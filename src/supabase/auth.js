import { supabase, supabaseSecondary } from './supabaseClient'

// Check if email already exists in both databases
export const checkEmailExists = async (email) => {
  try {
    const normalizedEmail = email.toLowerCase();
    
    // Check PRIMARY database (clients table)
    const { data: primaryData, error: primaryError } = await supabase
      .from('clients')
      .select('email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (primaryError && primaryError.code !== 'PGRST116') {
      return { exists: false, error: primaryError };
    }

    if (primaryData) {
      return { exists: true, error: null };
    }

    // Check SECONDARY database (chat_users table) if available
    if (supabaseSecondary) {
      const { data: secondaryData, error: secondaryError } = await supabaseSecondary
        .from('chat_users')
        .select('email')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (secondaryError && secondaryError.code !== 'PGRST116') {
        return { exists: false, error: secondaryError };
      }

      if (secondaryData) {
        return { exists: true, error: null };
      }
    }

    return { exists: false, error: null };
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
    // Normalize phone number (remove spaces and dashes) before checking
    // This ensures we check against the format we store in the database
    const normalizedPhone = normalizePhoneForDatabase(phone);

    // Check PRIMARY database (clients table) with normalized phone
    const { data: primaryData, error: primaryError } = await supabase
      .from('clients')
      .select('phone')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (primaryError && primaryError.code !== 'PGRST116') {
      return { exists: false, error: primaryError };
    }

    if (primaryData) {
      return { exists: true, error: null };
    }

    // Check SECONDARY database (chat_users table) - check both phone_number and whatsapp_number
    if (supabaseSecondary) {
      // Check phone_number column with normalized phone
      const { data: secondaryDataByPhone, error: secondaryError1 } = await supabaseSecondary
        .from('chat_users')
        .select('phone_number, whatsapp_number')
        .eq('phone_number', normalizedPhone)
        .maybeSingle();

      if (secondaryError1 && secondaryError1.code !== 'PGRST116') {
        return { exists: false, error: secondaryError1 };
      }

      if (secondaryDataByPhone) {
        return { exists: true, error: null };
      }

      // Check whatsapp_number column with normalized phone
      const { data: secondaryDataByWhatsApp, error: secondaryError2 } = await supabaseSecondary
        .from('chat_users')
        .select('phone_number, whatsapp_number')
        .eq('whatsapp_number', normalizedPhone)
        .maybeSingle();

      if (secondaryError2 && secondaryError2.code !== 'PGRST116') {
        return { exists: false, error: secondaryError2 };
      }

      if (secondaryDataByWhatsApp) {
        return { exists: true, error: null };
      }
    }

    return { exists: false, error: null };
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
        redirectTo: window.location.origin,
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
        redirectTo: window.location.origin
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

  while (attempts < maxAttempts) {
    // Generate random 6-letter code
    let userCode = '';
    for (let i = 0; i < 6; i++) {
      userCode += letters.charAt(Math.floor(Math.random() * letters.length));
    }

    // Check if this code already exists in PRIMARY database (clients table)
    try {
      const { data: primaryData, error: primaryError } = await supabase
        .from('clients')
        .select('user_code')
        .eq('user_code', userCode)
        .maybeSingle();

      // If found in primary database, code exists - try again
      if (primaryData) {
        attempts++;
        continue;
      }

      // If error other than "not found", throw it
      if (primaryError && primaryError.code !== 'PGRST116') {
        throw primaryError;
      }

      // Check SECONDARY database (chat_users table) if available
      if (supabaseSecondary) {
        const { data: secondaryData, error: secondaryError } = await supabaseSecondary
          .from('chat_users')
          .select('user_code')
          .eq('user_code', userCode)
          .maybeSingle();

        // If found in secondary database, code exists - try again
        if (secondaryData) {
          attempts++;
          continue;
        }

        // If error other than "not found", throw it
        if (secondaryError && secondaryError.code !== 'PGRST116') {
          throw secondaryError;
        }
      }

      // Code is unique in both databases
      return userCode;
    } catch (error) {
      console.error('Error checking user code uniqueness:', error);
      throw error;
    }
  }

  throw new Error('Failed to generate unique user code after maximum attempts');
};

// Create client record in clients table and chat_users table
export const createClientRecord = async (userId, userData) => {
  try {
    // Generate unique user code
    const userCode = await generateUniqueUserCode();
    
    // Normalize phone number before saving (remove spaces and dashes)
    const normalizedPhone = userData.phone ? normalizePhoneForDatabase(userData.phone) : null;
    
    // Use the service role key for this operation
    const serviceRoleKey = process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY;
    
    if (!serviceRoleKey) {
      // Fallback to regular client
      const clientInsertData = {
        user_id: userId,
        full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
        email: userData.email,
        phone: normalizedPhone,
        user_code: userCode,
        status: 'active'
      };

      const { data, error } = await supabase
        .from('clients')
        .insert([clientInsertData])
        .select()

      if (error) {
        console.error('Client record creation error:', error);
        throw error;
      }
      
      // Also create record in chat_users table (secondary database)
      let chatUserCreated = false;
      let chatUserDataResult = null;
      if (supabaseSecondary && data && data[0]) {
        try {
          const chatUserData = {
            user_code: userCode,
            full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
            email: userData.email,
            phone_number: normalizedPhone,
            whatsapp_number: normalizedPhone, // Also set whatsapp_number for WhatsApp registrations
            platform: userData.platform || 'whatsapp',
            activated: false,
            is_verified: false,
            language: 'en',
            created_at: new Date().toISOString()
          };

          const { data: chatUserResult, error: chatUserError } = await supabaseSecondary
            .from('chat_users')
            .insert([chatUserData])
            .select();

          if (chatUserError) {
            // Don't throw - continue even if chat_users creation fails
          } else {
            chatUserCreated = true;
            chatUserDataResult = chatUserResult;
          }
        } catch (chatError) {
          // Don't throw - continue even if chat_users creation fails
        }
      }
      
      return { 
        data, 
        error: null,
        chatUserCreated,
        chatUserData: chatUserDataResult
      }
    }

    // Use service role client for admin operations
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.REACT_APP_SUPABASE_URL,
      serviceRoleKey
    );

    const clientInsertData = {
      user_id: userId,
      full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
      email: userData.email,
      phone: normalizedPhone,
      user_code: userCode,
      status: 'active'
    };

    const { data, error } = await supabaseAdmin
      .from('clients')
      .insert([clientInsertData])
      .select()

    if (error) {
      console.error('Client record creation error:', error);
      throw error;
    }
    
    // Also create record in chat_users table (secondary database)
    let chatUserCreated = false;
    let chatUserDataResult = null;
    if (supabaseSecondary && data && data[0]) {
      try {
        const chatUserData = {
          user_code: userCode,
          full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
          email: userData.email,
          phone_number: normalizedPhone,
          whatsapp_number: normalizedPhone, // Also set whatsapp_number for WhatsApp registrations
          platform: userData.platform || 'whatsapp',
          activated: false,
          is_verified: false,
          language: 'en',
          created_at: new Date().toISOString()
        };

        const { data: chatUserResult, error: chatUserError } = await supabaseSecondary
          .from('chat_users')
          .insert([chatUserData])
          .select();

        if (chatUserError) {
          // Don't throw - continue even if chat_users creation fails
        } else {
          chatUserCreated = true;
          chatUserDataResult = chatUserResult;
        }
      } catch (chatError) {
        // Don't throw - continue even if chat_users creation fails
      }
    }
    
    return { 
      data, 
      error: null,
      chatUserCreated,
      chatUserData: chatUserDataResult
    }
  } catch (error) {
    console.error('Create client record error:', error)
    return { data: null, error }
  }
}

// Get client record by user ID
export const getClientRecord = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Get client record error:', error)
    return { data: null, error }
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
    
    const { data, error } = await supabase
      .from('clients')
      .update(normalizedUpdates)
      .eq('user_id', userId)
      .select()

    if (error) throw error
    
    // If secondary DB is available and we have user_code, also update chat_users
    if (supabaseSecondary && data && data[0] && data[0].user_code) {
      try {
        // Get the chat_users id using user_code
        const { data: chatUser, error: chatUserError } = await supabaseSecondary
          .from('chat_users')
          .select('id')
          .eq('user_code', data[0].user_code)
          .single();

        if (!chatUserError && chatUser) {
          // Map updates to chat_users fields
          const chatUpdates = {};
          
          // Map fields that exist in both tables
          if (updates.full_name) chatUpdates.full_name = updates.full_name;
          if (updates.email) chatUpdates.email = updates.email;
          // Normalize phone number before saving to chat_users
          if (updates.phone) {
            const normalizedPhone = normalizePhoneForDatabase(updates.phone);
            chatUpdates.phone_number = normalizedPhone;
            chatUpdates.whatsapp_number = normalizedPhone;
          }
          if (updates.region) chatUpdates.region = updates.region;
          if (updates.city) chatUpdates.city = updates.city;
          if (updates.timezone) chatUpdates.timezone = updates.timezone;
          if (updates.age) chatUpdates.age = updates.age;
          if (updates.gender) chatUpdates.gender = updates.gender;
          if (updates.birth_date) chatUpdates.date_of_birth = updates.birth_date;
          if (updates.food_allergies) chatUpdates.food_allergies = updates.food_allergies;
          if (updates.updated_at) chatUpdates.updated_at = updates.updated_at;

          // Only update if there are fields to update
          if (Object.keys(chatUpdates).length > 0) {
            await supabaseSecondary
              .from('chat_users')
              .update(chatUpdates)
              .eq('id', chatUser.id);
            
            console.log('Chat user synced successfully');
          }
        }
      } catch (syncError) {
        console.error('Error syncing to chat_users:', syncError);
        // Don't throw - continue even if sync fails
      }
    }
    
    return { data, error: null }
  } catch (error) {
    console.error('Update client record error:', error)
    return { data: null, error }
  }
}
