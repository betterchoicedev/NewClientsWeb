require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// These clients are shared by every request, so they must never refresh a user's
// session on their own. A background refresh rotates that user's refresh token and
// the copy on their phone stops working, which signs them out.
const SHARED_AUTH_OPTIONS = { auth: { autoRefreshToken: false } };

// Main project: Stripe, clients, etc. Uses service-role key when available.
const clientDB = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY,
  SHARED_AUTH_OPTIONS
);

// Anon client used only for authentication (sign-in / token verification)
const supabaseAuth = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY,
  SHARED_AUTH_OPTIONS
);

/**
 * A fresh anon auth client that holds no state, for calls that return a user's
 * session (token refresh, Apple sign-in). On a shared client the session would be
 * kept in memory, refreshed later for the wrong request, and (on clientDB) used in
 * place of the service-role key.
 */
function createStatelessAuthClient() {
  return createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
}

// Chat/admin project: chat_users, meal_plans_and_schemas, etc.
const adminDBUrl = process.env.CHAT_SUPABASE_URL;
const adminDBServiceRoleKey = process.env.CHAT_SUPABASE_SERVICE_ROLE_KEY;

const adminDB = adminDBUrl && adminDBServiceRoleKey
  ? createClient(adminDBUrl, adminDBServiceRoleKey, SHARED_AUTH_OPTIONS)
  : null;

console.log('ClientDB connection:', process.env.REACT_APP_SUPABASE_URL ? 'Configured' : 'Missing URL');
console.log('AdminDB connection:', adminDB ? 'Configured' : 'Not configured – set CHAT_SUPABASE_URL and CHAT_SUPABASE_SERVICE_ROLE_KEY');

module.exports = { clientDB, supabaseAuth, adminDB, adminDBServiceRoleKey, createStatelessAuthClient };
