// Run: node --test server/tests/sessionRefresh.test.js
// POST /api/auth/refresh: 401 (the app signs out) only for a dead refresh token,
// 503 (the app keeps the user signed in) when Supabase could not answer.
const test = require('node:test');
const assert = require('node:assert/strict');
const { AuthApiError, AuthRetryableFetchError, AuthUnknownError } = require('@supabase/supabase-js');

const { createRefreshHandler, isInvalidRefreshTokenError } = require('../modules/auth/session-refresh');

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

function handlerReturning(result) {
  const seen = [];
  const handler = createRefreshHandler(() => ({
    auth: {
      refreshSession: async (args) => {
        seen.push(args);
        if (result instanceof Error) throw result;
        return result;
      },
    },
  }));
  return { handler, seen };
}

async function call(result, body = { refresh_token: 'rt-1' }) {
  const { handler, seen } = handlerReturning(result);
  const res = fakeRes();
  await handler({ body }, res);
  return { res, seen };
}

test('a good refresh returns the new session', async () => {
  const session = { access_token: 'at-2', refresh_token: 'rt-2' };
  const { res, seen } = await call({ data: { session, user: { id: 'u1' } }, error: null });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { session, user: { id: 'u1' }, error: null });
  assert.deepEqual(seen, [{ refresh_token: 'rt-1' }]);
});

test('an already-used refresh token is 401 refresh_invalid', async () => {
  const error = new AuthApiError('Invalid Refresh Token: Already Used', 400, 'refresh_token_already_used');
  const { res } = await call({ data: { session: null, user: null }, error });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'refresh_invalid');
});

test('an unknown refresh token without an error code is 401 refresh_invalid', async () => {
  const error = new AuthApiError('Invalid Refresh Token: Refresh Token Not Found', 400, undefined);
  const { res } = await call({ data: { session: null, user: null }, error });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'refresh_invalid');
});

test('Supabase unreachable is 503 refresh_unavailable', async () => {
  const error = new AuthRetryableFetchError('fetch failed', 0);
  const { res } = await call({ data: { session: null, user: null }, error });
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'refresh_unavailable');
});

test('a Supabase 5xx is 503, even with an invalid-sounding message', async () => {
  const error = new AuthApiError('Refresh Token Not Found (upstream)', 502, undefined);
  const { res } = await call({ data: { session: null, user: null }, error });
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'refresh_unavailable');
});

test('rate limiting is 503, not a sign-out', async () => {
  const error = new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit');
  const { res } = await call({ data: { session: null, user: null }, error });
  assert.equal(res.statusCode, 503);
});

test('a thrown error or a missing session is 503', async () => {
  const thrown = await call(new TypeError('fetch failed'));
  assert.equal(thrown.res.statusCode, 503);
  assert.equal(thrown.res.body.code, 'refresh_unavailable');

  const empty = await call({ data: { session: null, user: null }, error: null });
  assert.equal(empty.res.statusCode, 503);
});

test('a missing refresh_token is 400', async () => {
  const { res, seen } = await call({ data: {}, error: null }, {});
  assert.equal(res.statusCode, 400);
  assert.equal(seen.length, 0);
});

test('isInvalidRefreshTokenError only trusts Supabase API answers', () => {
  assert.equal(isInvalidRefreshTokenError(new AuthApiError('x', 400, 'session_not_found')), true);
  assert.equal(isInvalidRefreshTokenError(new AuthApiError('Session Expired', 403, undefined)), true);
  assert.equal(isInvalidRefreshTokenError(new AuthApiError('Invalid Refresh Token', 500, undefined)), false);
  assert.equal(isInvalidRefreshTokenError(new AuthUnknownError('Invalid Refresh Token', null)), false);
  assert.equal(isInvalidRefreshTokenError(new Error('Invalid Refresh Token')), false);
  assert.equal(isInvalidRefreshTokenError(null), false);
});
