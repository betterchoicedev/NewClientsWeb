// Run: node --test tests/companyOfferWebhook.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Keep the real Stripe client out of this test.
const stripePath = require.resolve(path.join(__dirname, '..', 'config', 'stripe.js'));
require.cache[stripePath] = { id: stripePath, filename: stripePath, loaded: true, exports: {} };

const { resolveSubscriptionType, removeUserFromStripeUsageLog } = require('../services/stripe.service');

test('subscriptions with offer metadata are company_offer', () => {
  assert.equal(resolveSubscriptionType('prod_x', 'price_x', { metadata: { offer_company_id: 'c1' } }), 'company_offer');
  assert.equal(resolveSubscriptionType('prod_x', 'price_x', { metadata: {} }), 'unknown');
  assert.equal(resolveSubscriptionType('prod_x', 'price_x'), 'unknown');
});

test('removeUserFromStripeUsageLog deletes by user_code', async () => {
  const calls = [];
  const clientDB = {
    from(table) {
      const q = {
        select: () => q,
        delete: () => { calls.push(['delete', table]); return q; },
        eq: (col, val) => {
          calls.push(['eq', table, col, val]);
          return table === 'stripe_usage_log' ? Promise.resolve({ error: null }) : q;
        },
        maybeSingle: async () => ({ data: { user_code: 'ABC' } }),
      };
      return q;
    },
  };
  await removeUserFromStripeUsageLog('u1', clientDB);
  assert.deepEqual(calls.filter((c) => c[1] === 'stripe_usage_log'), [
    ['delete', 'stripe_usage_log'],
    ['eq', 'stripe_usage_log', 'user_code', 'ABC'],
  ]);
});
