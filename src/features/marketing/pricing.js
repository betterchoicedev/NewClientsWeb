// Shown on the landing page. The app reads live prices from Stripe
// (/api/stripe/membership-prices, login required), so keep these in sync by hand.
// Source: confirmed by the team 2026-10-11 ($15 monthly, $12/month on the yearly
// plan, 3-day free trial). Note: BetterApp PlanPaywall has TRIAL_DAYS = 30; check the app matches.
export const PRICING = {
  trialDays: 3,
  monthly: 15,
  yearlyPerMonth: 12,
  currency: '$',
};
