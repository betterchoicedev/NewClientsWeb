import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../supabase/supabaseClient';
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
      // Get user_code from auth metadata or fetch from clients table
      let userCode = user.user_metadata?.user_code;
      
      if (!userCode) {
        // Try to get from clients table using email
        const { data: clientData } = await supabase
          .from('clients')
          .select('user_code')
          .eq('email', user.email)
          .single();
        
        if (clientData) {
          userCode = clientData.user_code;
        }
      }

      if (!userCode) {
        setSettings(prev => ({ ...prev, loading: false }));
        return;
      }

      const { data, error } = await supabase
        .from('clients')
        .select('show_calories, show_macros, portion_display, measurement_system, weight_unit, decimal_places')
        .eq('user_code', userCode)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching settings:', error);
        setSettings(prev => ({ ...prev, loading: false }));
        return;
      }

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
      // Update local state immediately for instant UI feedback
      setSettings(prev => ({
        ...prev,
        [settingName]: newValue,
      }));

      // Get user_code
      let userCode = user.user_metadata?.user_code;
      
      if (!userCode) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('user_code')
          .eq('email', user.email)
          .single();
        
        if (clientData) {
          userCode = clientData.user_code;
        }
      }

      if (!userCode) {
        console.error('No user_code found');
        await fetchSettings();
        return;
      }

      // Convert camelCase to snake_case for database columns
      const columnName = settingName.replace(/([A-Z])/g, '_$1').toLowerCase();
      
      const { error } = await supabase
        .from('clients')
        .update({ [columnName]: newValue })
        .eq('user_code', userCode);

      if (error) {
        console.error('Error updating setting:', error);
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
      // Update local state immediately
      setSettings(prev => ({
        ...prev,
        ...newSettings,
      }));

      // Get user_code
      let userCode = user.user_metadata?.user_code;
      
      if (!userCode) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('user_code')
          .eq('email', user.email)
          .single();
        
        if (clientData) {
          userCode = clientData.user_code;
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

      // Update database
      const { error } = await supabase
        .from('clients')
        .update(dbSettings)
        .eq('user_code', userCode);

      if (error) {
        console.error('Error updating settings:', error);
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

