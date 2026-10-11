// Shown on the landing page. The app reads live prices from Stripe
// (/api/stripe/membership-prices, login required), so keep these in sync by hand.
// Source: campaign plan (first month free, then ₪69/month or ₪49/month yearly)
// and BetterApp PlanPaywall TRIAL_DAYS = 30.
export const PRICING = {
  trialDays: 30,
  monthly: 69,
  yearlyPerMonth: 49,
  currency: '₪',
};
