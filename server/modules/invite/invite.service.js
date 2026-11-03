/**
 * Dietitian invite codes: the landing lookup, attaching a client to a dietitian by code,
 * and the client's "My dietitian" card. Settings and presets: services/dietitian-invite.js.
 */
const {
  normalizeInviteCode,
  findDietitianByCode,
  loadDietitianSettings,
  toPublicInvite,
  toPublicDietitian,
} = require('../../services/dietitian-invite');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}

async function loadProfileWithCompany(profileId, { adminDB }) {
  const { data: profile } = await adminDB
    .from('profiles')
    .select('id, name, company_id')
    .eq('id', profileId)
    .maybeSingle();
  if (!profile) return null;
  let company = null;
  if (profile.company_id) {
    const { data } = await adminDB.from('companies').select('id, name, config').eq('id', profile.company_id).maybeSingle();
    company = data || null;
  }
  return { profile, company };
}

function presentable(settings, owner) {
  return {
    settings,
    profileName: owner.profile.name,
    companyName: owner.company?.name,
    companyConfig: owner.company?.config,
  };
}

// Public: what the landing page shows for a code, or null when the code is unknown.
async function lookupInvite(rawCode, { adminDB }) {
  if (!adminDB) return null;
  const settings = await findDietitianByCode(rawCode, { adminDB });
  if (!settings) return null;
  const owner = await loadProfileWithCompany(settings.profile_id, { adminDB });
  if (!owner) return null;
  return toPublicInvite(presentable(settings, owner));
}

// Provider for a new signup: the dietitian behind the invite code, else a providerId sent by
// older app versions (from #d= links) but only when it is a real staff profile. Null lets
// signup fall back to the default BetterChoice manager.
async function resolveSignupProvider({ inviteCode, providerId }, { adminDB }) {
  if (!adminDB) return null;
  if (inviteCode) {
    const settings = await findDietitianByCode(inviteCode, { adminDB });
    if (settings) return settings.profile_id;
  }
  const candidate = typeof providerId === 'string' ? providerId.trim() : '';
  if (!UUID_RE.test(candidate)) return null;
  const { data } = await adminDB.from('profiles').select('id').eq('id', candidate).maybeSingle();
  return data?.id || null;
}

const ENTITLED = new Set(['active', 'trialing']);

// Attaches the signed-in client to the dietitian behind the code. Allowed until the client
// has finished onboarding or started a plan, so nobody switches to a cheaper plan later.
async function claimInviteCode(userId, rawCode, { clientDB, adminDB, ensureClientAndChatUser }) {
  if (!adminDB) throw httpError(503, 'Invite codes are not available');
  if (!normalizeInviteCode(rawCode)) throw httpError(400, 'Invalid code', 'invalid_code');

  const settings = await findDietitianByCode(rawCode, { adminDB });
  if (!settings) throw httpError(404, 'Code not found', 'code_not_found');
  const owner = await loadProfileWithCompany(settings.profile_id, { adminDB });
  if (!owner) throw httpError(404, 'Code not found', 'code_not_found');

  const client = await ensureClientAndChatUser(userId, { clientDB, adminDB });
  if (!client?.user_code) throw httpError(500, 'user_code is missing');

  const { data: chatUser } = await adminDB
    .from('chat_users')
    .select('provider_id, subscription_status')
    .eq('user_code', client.user_code)
    .maybeSingle();

  const alreadyTheirs = chatUser?.provider_id === settings.profile_id;
  const started = client.onboarding_completed === true
    || ENTITLED.has(client.subscription_status)
    || ENTITLED.has(chatUser?.subscription_status);
  if (started && !alreadyTheirs) {
    throw httpError(409, 'This account already has a plan', 'already_started');
  }

  if (!alreadyTheirs) {
    const now = new Date().toISOString();
    const { error } = await adminDB
      .from('chat_users')
      .update({ provider_id: settings.profile_id, updated_at: now })
      .eq('user_code', client.user_code);
    if (error) throw error;
    const { error: mirrorErr } = await clientDB
      .from('clients')
      .update({ provider_id: settings.profile_id, updated_at: now })
      .eq('user_id', userId);
    if (mirrorErr) console.warn('Could not mirror provider_id on clients', mirrorErr.message);
  }

  return toPublicInvite(presentable(settings, owner));
}

// The welcome message is for clients who just joined through a code. There is no claim
// timestamp, so "joined" is the newest of the client's account rows; a code can only be
// claimed before onboarding ends, so that is close to when they joined. Existing clients of a
// dietitian who adds a message later never get it.
const WELCOME_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function joinedRecently(timestamps, nowMs) {
  const times = timestamps.map((t) => Date.parse(t)).filter(Number.isFinite);
  if (!times.length) return false;
  const joined = Math.max(...times);
  return nowMs - joined <= WELCOME_WINDOW_MS;
}

// The signed-in client's dietitian for the "My dietitian" card, or null until their dietitian
// has set up a public profile (a display name or photo). Every coach has a code, including the
// default BetterChoice manager that normal signups belong to, so a code alone is not enough.
async function getMyDietitian(userId, { clientDB, adminDB, now = () => Date.now() }) {
  if (!adminDB) return null;
  let { data: client, error: clientErr } = await clientDB.from('clients').select('user_code, created_at').eq('user_id', userId).maybeSingle();
  if (clientErr) {
    // Never lose the card over the join date: chat_users.created_at still decides.
    ({ data: client } = await clientDB.from('clients').select('user_code').eq('user_id', userId).maybeSingle());
  }
  if (!client?.user_code) return null;
  const { data: chatUser } = await adminDB.from('chat_users').select('provider_id, created_at').eq('user_code', client.user_code).maybeSingle();
  if (!chatUser?.provider_id) return null;
  const settings = await loadDietitianSettings(chatUser.provider_id, { adminDB });
  if (!settings || !(settings.display_name || settings.photo_url)) return null;
  const owner = await loadProfileWithCompany(chatUser.provider_id, { adminDB });
  if (!owner) return null;
  const card = toPublicDietitian(presentable(settings, owner));
  if (!joinedRecently([client.created_at, chatUser.created_at], now())) card.welcomeMessage = null;
  return card;
}

module.exports = { WELCOME_WINDOW_MS, lookupInvite, resolveSignupProvider, claimInviteCode, getMyDietitian };
