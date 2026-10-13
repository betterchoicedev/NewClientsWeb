// Run: node --test tests/deleteAccountStripe.test.js
// The app's "Delete Account" must stop Stripe billing and remove stripe_usage_log.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// In-memory Supabase: supports the chain calls the delete flow makes.
function fakeDB(tables) {
  return {
    tables,
    auth: { admin: { deleteUser: async () => ({ error: null }) } },
    from(table) {
      const filters = [];
      let op = 'select';
      let countMode = false;
      const rows = () => (tables[table] ||= []);
      const match = (r) => filters.every(([col, test]) => test(r[col]));
      const run = () => {
        const matched = rows().filter(match);
        if (op === 'delete') {
          tables[table] = rows().filter((r) => !match(r));
          return { data: matched, error: null };
        }
        return countMode ? { count: matched.length, data: null, error: null } : { data: matched, error: null };
      };
      const q = new Proxy({}, {
        get(_t, prop) {
          if (prop === 'then') return (resolve, reject) => Promise.resolve(run()).then(resolve, reject);
          if (prop === 'select') return (_cols, opts) => { if (opts?.count) countMode = true; return q; };
          if (prop === 'delete') return () => { op = 'delete'; return q; };
          if (prop === 'eq') return (col, val) => { filters.push([col, (v) => v === val]); return q; };
          if (prop === 'in') return (col, vals) => { filters.push([col, (v) => vals.includes(v)]); return q; };
          if (prop === 'maybeSingle' || prop === 'single') return async () => ({ data: run().data?.[0] || null, error: null });
          return () => q; // order, limit, or, is, ... are no-ops here
        },
      });
      return q;
    },
  };
}

function fakeStripe({ failCancel = false } = {}) {
  const canceled = [];
  return {
    canceled,
    customers: {
      search: async ({ query }) => ({ data: query.includes("'u1'") ? [{ id: 'cus_meta' }] : [] }),
    },
    subscriptions: {
      list: async ({ customer }) => ({
        data: customer === 'cus_meta'
          ? [{ id: 'sub_offer', status: 'trialing' }, { id: 'sub_old', status: 'canceled' }]
          : [],
      }),
      cancel: async (id) => {
        if (failCancel) throw Object.assign(new Error('card network down'), { code: 'api_error' });
        canceled.push(id);
        return { id, status: 'canceled' };
      },
    },
  };
}

function stubModule(relPath, exportsValue) {
  const full = require.resolve(path.join(__dirname, '..', relPath));
  require.cache[full] = { id: full, filename: full, loaded: true, exports: exportsValue };
}

function loadController({ stripe, clientDB, adminDB }) {
  stubModule('config/stripe.js', stripe);
  stubModule('config/db.js', { clientDB, adminDB, supabaseAuth: clientDB });
  const ctrlPath = require.resolve('../modules/auth/auth.controller');
  delete require.cache[ctrlPath];
  return require(ctrlPath);
}

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

function seed() {
  const clientDB = fakeDB({
    clients: [{ user_id: 'u1', user_code: 'ABC', email: 'a@b.c' }],
    stripe_subscriptions: [
      { user_id: 'u1', stripe_customer_id: 'cus_db', stripe_subscription_id: 'sub_db', status: 'active' },
    ],
    stripe_usage_log: [{ user_code: 'ABC', quantity: 7 }, { user_code: 'OTHER', quantity: 3 }],
  });
  const adminDB = fakeDB({ chat_users: [{ id: 'c1', user_code: 'ABC', email: 'a@b.c' }] });
  return { clientDB, adminDB };
}

const req = { authUser: { id: 'u1', email: 'a@b.c' } };

test('delete account cancels Stripe subscriptions and removes stripe_usage_log', async () => {
  const { clientDB, adminDB } = seed();
  const stripe = fakeStripe();
  const ctrl = loadController({ stripe, clientDB, adminDB });
  const res = fakeRes();
  await ctrl.deleteAccount(req, res);

  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.deepEqual(stripe.canceled.sort(), ['sub_db', 'sub_offer']);
  assert.deepEqual(clientDB.tables.stripe_usage_log, [{ user_code: 'OTHER', quantity: 3 }]);
  assert.deepEqual(clientDB.tables.stripe_subscriptions, []);
  assert.deepEqual(clientDB.tables.clients, []);
  assert.deepEqual(adminDB.tables.chat_users, []);
});

test('if Stripe cancel fails, nothing is deleted', async () => {
  const { clientDB, adminDB } = seed();
  const ctrl = loadController({ stripe: fakeStripe({ failCancel: true }), clientDB, adminDB });
  const res = fakeRes();
  await ctrl.deleteAccount(req, res);

  assert.equal(res.statusCode, 500);
  assert.match(res.body.error, /not deleted/);
  assert.equal(clientDB.tables.clients.length, 1);
  assert.equal(clientDB.tables.stripe_usage_log.length, 2);
  assert.equal(adminDB.tables.chat_users.length, 1);
});
