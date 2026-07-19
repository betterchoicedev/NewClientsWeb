import {
  apiFetch,
  getApiUrl,
  setStoredSession,
  clearStoredSession,
  getStoredSession,
  saveSessionFromAuthResponse,
} from '../lib/apiClient';

// Check if email already exists
export const checkEmailExists = async (email) => {
  try {
    const result = await apiFetch('/api/auth/check-email', {
      method: 'POST',
      body: JSON.stringify({ email: email.toLowerCase() }),
      skipAuth: true,
    });
    return { exists: result.exists, error: null };
  } catch (error) {
    console.error('Error checking email:', error);
    return { exists: false, error };
  }
};

export const normalizePhoneForDatabase = (phone) => {
  if (!phone) return '';
  return phone.replace(/[\s\-().]/g, '');
};

export const checkPhoneExists = async (phone) => {
  try {
    const result = await apiFetch('/api/auth/check-phone', {
      method: 'POST',
      body: JSON.stringify({ phone: normalizePhoneForDatabase(phone) }),
      skipAuth: true,
    });
    return { exists: result.exists, error: null };
  } catch (error) {
    console.error('Error checking phone:', error);
    return { exists: false, error };
  }
};

export const signUp = async (email, password, userData = {}, extras = {}) => {
  try {
    const result = await apiFetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        userData,
        invitationToken: extras.invitationToken,
        providerId: extras.providerId,
        managerLinkData: extras.managerLinkData,
      }),
      skipAuth: true,
    });
    if (result.data?.session) {
      saveSessionFromAuthResponse(result.data);
    }
    return { data: result.data, error: null };
  } catch (error) {
    console.error('Sign up error:', error);
    return { data: null, error: { message: error.message } };
  }
};

export const signIn = async (email, password) => {
  try {
    const result = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });
    if (result.data?.session) {
      saveSessionFromAuthResponse(result.data);
    }
    return { data: result.data, error: null, language: result.language };
  } catch (error) {
    console.error('Sign in error:', error);
    return { data: null, error: { message: error.message } };
  }
};

export const signInWithGoogle = async () => {
  const redirectTo = `${window.location.origin}/auth/callback`;
  window.location.href = `${getApiUrl()}/api/auth/google?redirectTo=${encodeURIComponent(redirectTo)}`;
  return { data: null, error: null };
};

export const signInWithFacebook = async () => {
  return {
    data: null,
    error: { message: 'Facebook sign-in is not configured. Use Google or email.' },
  };
};

export const signOut = async () => {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    clearStoredSession();
    return { error: null };
  } catch (error) {
    clearStoredSession();
    return { error };
  }
};

export const getCurrentUser = async () => {
  try {
    const session = getStoredSession();
    if (!session?.access_token) {
      return { user: null, error: null };
    }
    const result = await apiFetch('/api/auth/me');
    return { user: result.user, error: null };
  } catch (error) {
    clearStoredSession();
    return { user: null, error };
  }
};

export const resetPassword = async (email) => {
  try {
    await apiFetch('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
      skipAuth: true,
    });
    return { error: null };
  } catch (error) {
    console.error('Reset password error:', error);
    return { error: { message: error.message } };
  }
};

export const establishRecoverySession = async (access_token, refresh_token) => {
  try {
    const result = await apiFetch('/api/auth/recovery/session', {
      method: 'POST',
      body: JSON.stringify({ access_token, refresh_token }),
      skipAuth: true,
    });
    if (result.session) {
      saveSessionFromAuthResponse(result);
    }
    return { error: null };
  } catch (error) {
    return { error: { message: error.message } };
  }
};

export const updatePassword = async (newPassword) => {
  try {
    const result = await apiFetch('/api/auth/update-password', {
      method: 'POST',
      body: JSON.stringify({ password: newPassword }),
    });
    return { data: result.data, error: null };
  } catch (error) {
    console.error('Update password error:', error);
    return { data: null, error: { message: error.message } };
  }
};

export const updateProfile = async (updates) => {
  try {
    const { user } = await getCurrentUser();
    if (!user?.id) {
      throw new Error('Not authenticated');
    }
    return updateClientRecord(user.id, updates);
  } catch (error) {
    console.error('Update profile error:', error);
    return { data: null, error };
  }
};

export const onAuthStateChange = (callback) => {
  const handler = () => {
    getCurrentUser().then(({ user }) => {
      callback('SIGNED_IN', user ? { user } : null);
    });
  };
  window.addEventListener('bc-auth-changed', handler);
  getCurrentUser().then(({ user }) => {
    callback(user ? 'INITIAL_SESSION' : 'SIGNED_OUT', user ? { user } : null);
  });
  return {
    data: {
      subscription: {
        unsubscribe: () => window.removeEventListener('bc-auth-changed', handler),
      },
    },
  };
};

export const generateUniqueUserCode = async () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    let userCode = '';
    for (let i = 0; i < 6; i++) {
      userCode += letters.charAt(Math.floor(Math.random() * letters.length));
    }

    const result = await apiFetch('/api/auth/check-user-code', {
      method: 'POST',
      body: JSON.stringify({ userCode }),
      skipAuth: true,
    });

    if (!result.exists) {
      return userCode;
    }
    attempts++;
  }

  throw new Error('Failed to generate unique user code after maximum attempts');
};

export const createClientRecord = async (userId, userData, providerId = null) => {
  try {
    const userCode = await generateUniqueUserCode();
    const normalizedPhone = userData.phone ? normalizePhoneForDatabase(userData.phone) : null;

    let managerLinkData = null;
    let invitationToken = null;
    try {
      const managerLinkDataStr = sessionStorage.getItem('manager_link_data');
      if (managerLinkDataStr) managerLinkData = JSON.parse(managerLinkDataStr);
      invitationToken = sessionStorage.getItem('invitation_token');
    } catch (e) {
      console.error('Error parsing manager link data:', e);
    }

    let finalProviderId = providerId;
    if (managerLinkData?.manager_id) {
      finalProviderId = managerLinkData.manager_id;
    } else if (!finalProviderId || (typeof finalProviderId === 'string' && !finalProviderId.trim())) {
      try {
        const providerResult = await apiFetch('/api/auth/default-provider', { skipAuth: true });
        if (providerResult.provider_id) {
          finalProviderId = providerResult.provider_id;
        }
      } catch (providerError) {
        console.error('Error finding default provider:', providerError);
      }
    }

    const result = await apiFetch('/api/auth/create-client', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        userData: { ...userData, phone: normalizedPhone },
        userCode,
        providerId: finalProviderId,
        invitationToken: invitationToken || undefined,
        managerLinkData: managerLinkData || undefined,
      }),
    });

    return {
      data: result.data,
      error: null,
      chatUserCreated: result.chatUserCreated,
      chatUserData: result.chatUserData,
    };
  } catch (error) {
    console.error('Create client record error:', error);
    return { data: null, error: { message: error.message } };
  }
};

export const getClientRecord = async (userId) => {
  try {
    const result = await apiFetch(`/api/auth/client/${userId}`);
    return { data: result.data, error: null };
  } catch (error) {
    console.error('Get client record error:', error);
    return { data: null, error };
  }
};

/**
 * Ensure a `clients` row (and matching `chat_users` row with provider_id) exists for
 * the currently authenticated user. Called from the OAuth callback path so that
 * Google sign-ups have a user_code + company assignment by the time the
 * OnboardingGate opens. Safe to call when a row already exists — returns early.
 *
 * Returns: { ok: boolean, alreadyExisted?: boolean, data?: any, error?: any }
 */
export const bootstrapClientRecordIfMissing = async () => {
  try {
    const { user } = await getCurrentUser();
    if (!user?.id) {
      return { ok: false, error: { message: 'No authenticated user' } };
    }

    const existing = await getClientRecord(user.id);
    if (existing?.data?.user_id) {
      return { ok: true, alreadyExisted: true, data: existing.data };
    }

    // Pull a best-effort first/last name out of the OAuth provider's user_metadata.
    // Google fills user_metadata.full_name and user_metadata.name; manual sign-ups won't
    // hit this path so the fallback to empty strings is fine.
    const meta = user.user_metadata || {};
    const fullName =
      meta.full_name ||
      meta.name ||
      `${meta.given_name || ''} ${meta.family_name || ''}`.trim() ||
      '';
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    const first_name = meta.given_name || parts[0] || null;
    const last_name =
      meta.family_name || (parts.length > 1 ? parts.slice(1).join(' ') : null);

    const result = await createClientRecord(user.id, {
      email: user.email || null,
      first_name,
      last_name,
      phone: null,
      user_language: meta.locale && String(meta.locale).startsWith('he') ? 'he' : 'en',
    });

    if (result.error) {
      // Treat "already exists" as success — another tab / a previous bootstrap call won the race.
      const msg = String(result.error.message || '').toLowerCase();
      if (msg.includes('already exists')) {
        return { ok: true, alreadyExisted: true };
      }
      return { ok: false, error: result.error };
    }

    // Clear the OAuth handoff context now that the row exists. Both the email/password
    // and pre-bootstrap-Google paths used to leave these around until onboarding completion;
    // we no longer need them after bootstrap, and stale values can confuse later sign-ups.
    try {
      sessionStorage.removeItem('invitation_token');
      sessionStorage.removeItem('manager_link_data');
      sessionStorage.removeItem('referral_dietitian_id');
    } catch (_) {}

    return { ok: true, alreadyExisted: false, data: result.data };
  } catch (error) {
    console.error('[bootstrapClientRecordIfMissing] exception:', error);
    return { ok: false, error: { message: error?.message || 'bootstrap_failed' } };
  }
};

export const updateClientRecord = async (userId, updates) => {
  try {
    const normalizedUpdates = { ...updates };
    if (normalizedUpdates.phone) {
      normalizedUpdates.phone = normalizePhoneForDatabase(normalizedUpdates.phone);
    }

    const result = await apiFetch(`/api/auth/client/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ updates: normalizedUpdates }),
    });

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Update client record error:', error);
    return { data: null, error };
  }
};
