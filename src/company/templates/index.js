import CenteredLayout from './CenteredLayout';
import SplitLayout from './SplitLayout';
import TacticalLayout from './TacticalLayout';

// The centralized registry. 
// When you build a new layout, you ONLY add it to this file.
const TEMPLATE_REGISTRY = {
  centered: CenteredLayout,
  split: SplitLayout,
  tactical: TacticalLayout,
  default: CenteredLayout
};

/**
 * Retrieves the requested layout component safely.
 * @param {string} layoutName - The layout string from the Supabase config
 * @returns {React.Component} - The matched template or the safe default
 */
export const getTemplate = (layoutName = 'default') => {
  const normalizedName = String(layoutName).toLowerCase().trim();
  return TEMPLATE_REGISTRY[normalizedName] || TEMPLATE_REGISTRY.default;
};