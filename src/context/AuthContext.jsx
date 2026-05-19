import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getCurrentUser, signOut as authSignOut } from '../supabase/auth';
import { getStoredSession } from '../lib/apiClient';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const session = getStoredSession();
    if (!session?.access_token) {
      setUser(null);
      return;
    }
    const { user: currentUser } = await getCurrentUser();
    setUser(currentUser ?? null);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await refreshUser();
      } catch (error) {
        console.error('Error loading auth session:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    init();

    const onAuthChanged = () => {
      refreshUser();
    };
    window.addEventListener('bc-auth-changed', onAuthChanged);
    return () => window.removeEventListener('bc-auth-changed', onAuthChanged);
  }, [refreshUser]);

  const signOut = async () => {
    await authSignOut();
    setUser(null);
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    signOut,
    refreshUser,
    userDisplayName: user?.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
      : user?.email?.split('@')[0] || 'User',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
