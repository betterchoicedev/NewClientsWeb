require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Main project: Stripe, clients, etc. Uses service-role key when available.
const clientDB = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY
);

// Anon client used only for authentication (sign-in / token verification)
const supabaseAuth = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// Chat/admin project: chat_users, meal_plans_and_schemas, etc.
const adminDBUrl = process.env.CHAT_SUPABASE_URL;
const adminDBServiceRoleKey = process.env.CHAT_SUPABASE_SERVICE_ROLE_KEY;

const adminDB = adminDBUrl && adminDBServiceRoleKey
  ? createClient(adminDBUrl, adminDBServiceRoleKey)
  : null;

console.log('ClientDB connection:', process.env.REACT_APP_SUPABASE_URL ? 'Configured' : 'Missing URL');
console.log('AdminDB connection:', adminDB ? 'Configured' : 'Not configured – set CHAT_SUPABASE_URL and CHAT_SUPABASE_SERVICE_ROLE_KEY');

module.exports = { clientDB, supabaseAuth, adminDB, adminDBServiceRoleKey };
