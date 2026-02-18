import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    showCalories: true,
    showMacros: true,
    portionDisplay: 'both',
    measurementSystem: 'metric',
    weightUnit: 'grams',
    decimalPlaces: 1,
    loading: true,
  });

  // Fetch settings from database
  const fetchSettings = async () => {
    if (!user?.id) {
      setSettings(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
      
      // Get user_code from auth metadata or fetch via API
      let userCode = user.user_metadata?.user_code;
      
      if (!userCode && user.email) {
        // Try to get from clients table using email via API
        const userCodeResponse = await fetch(`${apiUrl}/api/user/user-code?email=${encodeURIComponent(user.email)}`);
        
        if (userCodeResponse.ok) {
          const result = await userCodeResponse.json();
          if (result.data) {
            userCode = result.data.user_code;
          }
        }
      }

      if (!userCode) {
        setSettings(prev => ({ ...prev, loading: false }));
        return;
      }

      // Fetch settings via API
      const settingsResponse = await fetch(`${apiUrl}/api/user/settings?user_code=${encodeURIComponent(userCode)}`);

      if (!settingsResponse.ok) {
        console.error('Error fetching settings:', settingsResponse.statusText);
        setSettings(prev => ({ ...prev, loading: false }));
        return;
      }

      const settingsResult = await settingsResponse.json();
      const data = settingsResult.data;

      if (data) {
        setSettings({
          showCalories: data.show_calories ?? true,
          showMacros: data.show_macros ?? true,
          portionDisplay: data.portion_display || 'both',
          measurementSystem: data.measurement_system || 'metric',
          weightUnit: data.weight_unit || 'grams',
          decimalPlaces: data.decimal_places ?? 1,
          loading: false,
        });
      } else {
        setSettings(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error('Unexpected error fetching settings:', err);
      setSettings(prev => ({ ...prev, loading: false }));
    }
  };

  // Update a single setting
  const updateSetting = async (settingName, newValue) => {
    if (!user?.id) return;

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
      
      // Update local state immediately for instant UI feedback
      setSettings(prev => ({
        ...prev,
        [settingName]: newValue,
      }));

      // Get user_code
      let userCode = user.user_metadata?.user_code;
      
      if (!userCode && user.email) {
        const userCodeResponse = await fetch(`${apiUrl}/api/user/user-code?email=${encodeURIComponent(user.email)}`);
        
        if (userCodeResponse.ok) {
          const result = await userCodeResponse.json();
          if (result.data) {
            userCode = result.data.user_code;
          }
        }
      }

      if (!userCode) {
        console.error('No user_code found');
        await fetchSettings();
        return;
      }

      // Convert camelCase to snake_case for database columns
      const columnName = settingName.replace(/([A-Z])/g, '_$1').toLowerCase();
      
      // Update via API
      const response = await fetch(`${apiUrl}/api/user/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_code: userCode,
          settings: { [columnName]: newValue }
        })
      });

      if (!response.ok) {
        console.error('Error updating setting:', response.statusText);
        // Revert on error
        await fetchSettings();
      }
    } catch (err) {
      console.error('Unexpected error updating setting:', err);
      // Revert on error
      await fetchSettings();
    }
  };

  // Update multiple settings at once
  const updateSettings = async (newSettings) => {
    if (!user?.id) return;

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
      
      // Update local state immediately
      setSettings(prev => ({
        ...prev,
        ...newSettings,
      }));

      // Get user_code
      let userCode = user.user_metadata?.user_code;
      
      if (!userCode && user.email) {
        const userCodeResponse = await fetch(`${apiUrl}/api/user/user-code?email=${encodeURIComponent(user.email)}`);
        
        if (userCodeResponse.ok) {
          const result = await userCodeResponse.json();
          if (result.data) {
            userCode = result.data.user_code;
          }
        }
      }

      if (!userCode) {
        console.error('No user_code found');
        await fetchSettings();
        return;
      }

      // Convert camelCase to snake_case for database columns
      const dbSettings = {};
      Object.keys(newSettings).forEach(key => {
        const columnName = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        dbSettings[columnName] = newSettings[key];
      });

      // Update database via API
      const response = await fetch(`${apiUrl}/api/user/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_code: userCode,
          settings: dbSettings
        })
      });

      if (!response.ok) {
        console.error('Error updating settings:', response.statusText);
        // Revert on error
        await fetchSettings();
      }
    } catch (err) {
      console.error('Unexpected error updating settings:', err);
      // Revert on error
      await fetchSettings();
    }
  };

  // Load settings when user changes
  useEffect(() => {
    fetchSettings();
  }, [user?.id]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        updateSettings,
        refreshSettings: fetchSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

