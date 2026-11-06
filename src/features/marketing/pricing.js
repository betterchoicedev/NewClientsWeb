// Shown on the landing page. The app reads live prices from Stripe
// (/api/stripe/membership-prices, login required), so keep these in sync by hand.
// Source: confirmed by the team 2026-10-11 ($15 monthly, $12/month on the yearly plan).
// Trial: normal signups get a free month with no card (paywall_settings flow "free_month", checked 2026-11-06).
export const PRICING = {
  trialDays: 30,
  trialNeedsCard: false,
  monthly: 15,
  yearlyPerMonth: 12,
  currency: '$',
};
