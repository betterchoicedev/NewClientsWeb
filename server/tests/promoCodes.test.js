// Run: node --test tests/promoCodes.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const { validateCompanyPromo } = require('../modules/onboarding/onboarding.service');

const BETTERCHOICE = {
  id: 'co-betterchoice',
  name: 'BetterChoice',
  config: { pricing: { bypassCodes: [{ code: 'BETTERFREE', active: true, expiresAt: null }] } },
};
const HOME4SPORT = {
  id: 'co-home4sport',
  name: 'Home4sport',
  config: {
    pricing: {
      bypassCodes: [],
      promoCodes: [{ code: 'H4S10', percentageOff: 10, productIds: ['prod_h4s'] }],
    },
  },
};
const OLDCO = {
  id: 'co-old',
  name: 'Old',
  config: { pricing: { bypassCodes: [{ code: 'GONE', active: true, expiresAt: '2020-01-01T00:00:00Z' }, { code: 'OFF', active: false }] } },
};

/** Minimal Supabase stand-in for `from('companies').select(...)[.eq('id', x)]`. */
function fakeDb(rows) {
  return {
    from() {
      return {
        select() {
          const all = Promise.resolve({ data: rows, error: null });
          all.eq = (_col, id) => Promise.resolve({ data: rows.filter((r) => r.id === id), error: null });
          return all;
        },
      };
    },
  };
}

const dbs = { adminDB: fakeDb([BETTERCHOICE, HOME4SPORT, OLDCO]), clientDB: null };

test('a free code from another company works for a user attached to a different company', async () => {
  const result = await validateCompanyPromo('u1', { code: ' betterfree ', companyId: HOME4SPORT.id }, dbs);
  assert.equal(result.valid, true);
  assert.equal(result.type, 'bypass');
  assert.equal(result.code, 'BETTERFREE');
  assert.equal(result.companyId, BETTERCHOICE.id);
});

test('a free code still works with no company', async () => {
  const result = await validateCompanyPromo('u1', { code: 'BETTERFREE' }, dbs);
  assert.equal(result.valid, true);
  assert.equal(result.companyId, BETTERCHOICE.id);
});

test("the user's own company discount code still works", async () => {
  const result = await validateCompanyPromo('u1', { code: 'H4S10', companyId: HOME4SPORT.id, productIds: ['prod_h4s'] }, dbs);
  assert.equal(result.valid, true);
  assert.equal(result.type, 'discount');
});

test("another company's discount code does not cross over", async () => {
  const result = await validateCompanyPromo('u1', { code: 'H4S10', companyId: BETTERCHOICE.id }, dbs);
  assert.equal(result.valid, false);
});

test('expired, inactive and unknown free codes are rejected everywhere', async () => {
  for (const code of ['GONE', 'OFF', 'NOPE']) {
    const result = await validateCompanyPromo('u1', { code, companyId: HOME4SPORT.id }, dbs);
    assert.equal(result.valid, false, code);
  }
});
