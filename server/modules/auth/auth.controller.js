const { clientDB, supabaseAuth, adminDB } = require('../../config/db');
const { decodeJwtPayloadServer } = require('../../utils/helpers');

// ─── Auth helper functions ────────────────────────────────────────────────────

async function emailHasBetterChoiceAccount(email) {
  if (!email) return false;
  try {
    const { data: clientRow } = await clientDB.from('clients').select('user_id').eq('email', email).maybeSingle();
    if (clientRow?.user_id) return true;
  } catch (e) {
    console.warn('emailHasBetterChoiceAccount: clients lookup failed:', e?.message);
  }
  if (adminDB) {
    try {
      const { data: chatRow } = await adminDB.from('chat_users').select('id').eq('email', email).maybeSingle();
      if (chatRow?.id) return true;
    } catch (e) {
      console.warn('emailHasBetterChoiceAccount: chat_users lookup failed:', e?.message);
    }
  }
  return false;
}

async function ensureClientLinkedToAuthUser(authUserId, email) {
  if (!authUserId || !email) return;
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const { data: byUserId } = await clientDB.from('clients').select('id, user_code').eq('user_id', authUserId).maybeSingle();
    if (byUserId?.user_code) return;

    const { data: byEmail } = await clientDB.from('clients').select('id, user_id, user_code').eq('email', normalizedEmail).maybeSingle();
    if (!byEmail?.user_code) return;

    if (byEmail.user_id !== authUserId) {
      const { error } = await clientDB.from('clients').update({ user_id: authUserId, updated_at: new Date().toISOString() }).eq('id', byEmail.id);
      if (error) console.warn('ensureClientLinkedToAuthUser: link failed for', normalizedEmail, error.message);
      else console.log('✅ Linked clients.user_id for', normalizedEmail, '→', authUserId);
    }
  } catch (e) {
    console.warn('ensureClientLinkedToAuthUser failed:', e?.message);
  }
}

async function resolveUserCodeForAuthUser(authUserId, email) {
  if (!authUserId) return null;
  const { data: byUserId, error } = await clientDB.from('clients').select('id, user_code, user_id, email').eq('user_id', authUserId).maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  if (byUserId?.user_code) return byUserId.user_code;

  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const { data: byEmail, error: emailErr } = await clientDB.from('clients').select('id, user_code, user_id, email').eq('email', normalizedEmail).maybeSingle();
  if (emailErr && emailErr.code !== 'PGRST116') throw emailErr;
  if (!byEmail?.user_code) return null;

  if (byEmail.user_id !== authUserId) {
    const { error: linkErr } = await clientDB.from('clients').update({ user_id: authUserId, updated_at: new Date().toISOString() }).eq('id', byEmail.id);
    if (linkErr) console.warn('resolveUserCodeForAuthUser: link failed for', normalizedEmail, linkErr.message);
    else console.log('✅ Linked clients.user_id via user-code lookup for', normalizedEmail);
  }
  return byEmail.user_code;
}

// ─── Route handlers ───────────────────────────────────────────────────────────

async function refreshSession(req, res) {
  try {
    const { refresh_token } = req.body || {};
    if (!refresh_token || typeof refresh_token !== 'string') {
      return res.status(400).json({ error: 'refresh_token is required' });
    }
    const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token });
    if (error || !data?.session?.access_token) {
      console.warn('🔁 Refresh failed:', error?.message || 'no session returned');
      return res.status(401).json({ error: error?.message || 'Failed to refresh session' });
    }
    res.json({ session: data.session, user: data.user, error: null });
  } catch (error) {
    console.error('❌ POST /api/auth/refresh error:', error);
    res.status(401).json({ error: error.message || 'Failed to refresh session' });
  }
}

async function appleVerify(req, res) {
  try {
    const { identityToken, fullName } = req.body || {};
    if (!identityToken || typeof identityToken !== 'string') {
      return res.status(400).json({ error: 'identityToken is required' });
    }

    const payload = decodeJwtPayloadServer(identityToken);
    const claimedEmail = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    if (!claimedEmail) {
      return res.status(401).json({ error: 'Apple did not return an email for this account' });
    }

    const accountExists = await emailHasBetterChoiceAccount(claimedEmail);
    if (!accountExists) {
      return res.status(404).json({ error: 'no_account', email: claimedEmail });
    }

    const { data, error } = await clientDB.auth.signInWithIdToken({ provider: 'apple', token: identityToken });
    if (error) {
      console.error('❌ Apple signInWithIdToken error:', error);
      return res.status(401).json({ error: error.message || 'Apple sign-in rejected' });
    }
    if (!data?.user || !data?.session) {
      return res.status(401).json({ error: 'Apple sign-in returned no session' });
    }

    const verifiedEmail = (data.user.email || '').trim().toLowerCase();
    if (verifiedEmail && verifiedEmail !== claimedEmail) {
      const verifiedExists = await emailHasBetterChoiceAccount(verifiedEmail);
      if (!verifiedExists) {
        try { await clientDB.auth.admin.deleteUser(data.user.id); } catch (e) { console.warn('Apple verify: orphan cleanup failed:', e?.message); }
        return res.status(404).json({ error: 'no_account', email: verifiedEmail });
      }
    }

    const finalEmail = verifiedEmail || claimedEmail;
    await ensureClientLinkedToAuthUser(data.user.id, finalEmail);

    if (fullName && (fullName.givenName || fullName.familyName)) {
      try {
        const patch = {};
        if (fullName.givenName)  patch.first_name = fullName.givenName;
        if (fullName.familyName) patch.last_name  = fullName.familyName;
        await clientDB.from('clients').update(patch).eq('email', finalEmail);
      } catch { /* best-effort */ }
    }

    let language = null;
    try {
      if (adminDB) {
        const { data: lang } = await adminDB.from('chat_users').select('user_language').eq('email', finalEmail).maybeSingle();
        if (lang) language = lang;
      }
    } catch { /* non-critical */ }

    return res.json({ data: { user: data.user, session: data.session }, language, error: null });
  } catch (error) {
    console.error('POST /api/auth/oauth/apple/verify error:', error);
    res.status(500).json({ error: error.message || 'Apple sign-in failed' });
  }
}

async function appleExchange(req, res) {
  try {
    const { identityToken, fullName } = req.body || {};
    if (!identityToken || typeof identityToken !== 'string') {
      return res.status(400).json({ error: 'identityToken is required' });
    }

    const payload = decodeJwtPayloadServer(identityToken);
    const claimedEmail =
      typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';

    if (claimedEmail && (await emailHasBetterChoiceAccount(claimedEmail))) {
      return res.status(409).json({ error: 'account_exists', email: claimedEmail });
    }

    const { data, error } = await clientDB.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
    });

    if (error) {
      console.error('❌ Apple signup signInWithIdToken error:', error);
      return res.status(401).json({ error: error.message || 'Apple sign-in rejected' });
    }

    if (!data?.user || !data?.session) {
      return res.status(401).json({ error: 'Apple sign-in returned no session' });
    }

    const verifiedEmail = (data.user.email || claimedEmail || '').trim().toLowerCase();
    if (
      verifiedEmail &&
      verifiedEmail !== claimedEmail &&
      (await emailHasBetterChoiceAccount(verifiedEmail))
    ) {
      try {
        await clientDB.auth.admin.deleteUser(data.user.id);
      } catch (e) {
        console.warn('Apple exchange: orphan cleanup failed:', e?.message);
      }
      return res.status(409).json({ error: 'account_exists', email: verifiedEmail });
    }

    if (fullName && (fullName.givenName || fullName.familyName)) {
      try {
        const patch = {};
        if (fullName.givenName) patch.first_name = fullName.givenName;
        if (fullName.familyName) patch.last_name = fullName.familyName;
        await clientDB.auth.admin.updateUserById(data.user.id, {
          user_metadata: patch,
        });
      } catch {
        /* best-effort — Apple only shares the name on first sign-in */
      }
    }

    return res.json({
      userId: data.user.id,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? undefined,
      expiresIn: data.session.expires_in ?? undefined,
      email: data.user.email || claimedEmail || '',
    });
  } catch (error) {
    console.error('POST /api/auth/oauth/apple/exchange error:', error);
    res.status(500).json({ error: error.message || 'Apple sign-up failed' });
  }
}

async function googleFinalize(req, res) {
  try {
    const { accessToken } = req.body || {};
    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({ error: 'accessToken is required' });
    }

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      console.warn('Google finalize: getUser failed:', userError?.message);
      return res.status(401).json({ error: 'Invalid or expired Google session token' });
    }

    const userId = userData.user.id;
    const email = (userData.user.email || '').trim().toLowerCase();
    if (!email) {
      try { await clientDB.auth.admin.deleteUser(userId); } catch (e) { console.warn('Google finalize: cleanup of email-less auth row failed:', e?.message); }
      return res.status(404).json({ error: 'no_account', email: '' });
    }

    const accountExists = await emailHasBetterChoiceAccount(email);
    if (!accountExists) {
      try { await clientDB.auth.admin.deleteUser(userId); } catch (e) { console.error('Google finalize: failed to delete orphan auth user:', e?.message); }
      return res.status(404).json({ error: 'no_account', email });
    }

    await ensureClientLinkedToAuthUser(userId, email);

    let language = null;
    try {
      if (adminDB) {
        const { data: lang } = await adminDB.from('chat_users').select('user_language').eq('email', email).maybeSingle();
        if (lang) language = lang;
      }
    } catch { /* non-critical */ }

    return res.json({ ok: true, exists: true, language });
  } catch (error) {
    console.error('POST /api/auth/oauth/google/finalize error:', error);
    res.status(500).json({ error: error.message || 'Failed to finalize Google sign-in' });
  }
}

async function googleStart(req, res) {
  try {
    const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http')
      .toString()
      .split(',')[0]
      .trim();
    const host = (req.headers['x-forwarded-host'] || req.get('host') || '')
      .toString()
      .split(',')[0]
      .trim();
    if (!host) {
      return res.status(500).json({ error: 'Could not resolve callback host' });
    }
    const mobileCallbackUrl = `${proto}://${host}/api/auth/oauth/mobile-callback`;

    const { data, error } = await supabaseAuth.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: mobileCallbackUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      console.error('❌ Google OAuth start error:', error.message);
      return res.status(500).json({ error: error.message || 'Failed to start Google sign-in' });
    }
    if (!data?.url) {
      return res.status(500).json({ error: 'Supabase returned no OAuth URL' });
    }

    res.json({ url: data.url });
  } catch (error) {
    console.error('POST /api/auth/oauth/google/start error:', error);
    res.status(500).json({ error: error.message || 'Failed to start Google sign-in' });
  }
}

async function deleteAccount(req, res) {
  try {
    const authUserId = req.authUser?.id;
    if (!authUserId) return res.status(401).json({ error: 'Not authenticated' });

    const email = (req.authUser?.email || '').trim().toLowerCase();

    let userCode = req.userCode || null;
    if (!userCode && email) {
      try {
        const { data: clientRow } = await clientDB.from('clients').select('user_code').eq('email', email).maybeSingle();
        if (clientRow?.user_code) userCode = clientRow.user_code;
      } catch (e) { console.warn('Account deletion: user_code lookup by email failed:', e?.message); }
    }

    let chatUserId = null;
    if (adminDB && email) {
      try {
        const { data: chatUser } = await adminDB.from('chat_users').select('id, user_code').eq('email', email).maybeSingle();
        if (chatUser?.id) chatUserId = chatUser.id;
        if (!userCode && chatUser?.user_code) userCode = chatUser.user_code;
      } catch (e) { console.warn('Account deletion: chat_users lookup by email failed:', e?.message); }
    }

    // Delete reminders, meal plans, food logs, etc.
    if (adminDB && userCode) {
      const { data: mealPlans } = await adminDB.from('meal_plans_and_schemas').select('id').eq('user_code', userCode).eq('record_type', 'meal_plan');
      if (mealPlans && mealPlans.length > 0) {
        const mealPlanIds = mealPlans.map((p) => p.id);
        const { data: reminderDefs } = await adminDB.from('reminder_definitions').select('reminder_definition_id').in('user_plan_id', mealPlanIds);
        if (reminderDefs && reminderDefs.length > 0) {
          const definitionIds = reminderDefs.map((r) => r.reminder_definition_id);
          const { error: instancesError } = await adminDB.from('reminder_instances').delete().in('definition_id', definitionIds);
          if (instancesError) return res.status(500).json({ error: `Failed to delete reminder instances: ${instancesError.message}` });
          const { error: defsError } = await adminDB.from('reminder_definitions').delete().in('reminder_definition_id', definitionIds);
          if (defsError) return res.status(500).json({ error: `Failed to delete reminder definitions: ${defsError.message}` });
        }
        const { error: plansError } = await adminDB.from('meal_plans_and_schemas').delete().in('id', mealPlanIds);
        if (plansError) return res.status(500).json({ error: `Failed to delete meal plans: ${plansError.message}` });
      }
      await adminDB.from('food_logs').delete().eq('user_code', userCode).catch(() => {});
    }

    if (adminDB && chatUserId) {
      await adminDB.from('food_logs').delete().eq('user_id', chatUserId).catch(() => {});
      await adminDB.from('weight_logs').delete().eq('user_code', userCode || chatUserId).catch(() => {});
      await adminDB.from('calendar_events').delete().eq('user_id', chatUserId).catch(() => {});
      await adminDB.from('chat_users').delete().eq('id', chatUserId).catch(() => {});
    }

    if (userCode) {
      await clientDB.from('client_meal_plans').delete().eq('user_code', userCode).catch(() => {});
      await clientDB.from('stripe_subscriptions').delete().eq('user_id', authUserId).catch(() => {});
      await clientDB.from('stripe_payments').delete().eq('user_id', authUserId).catch(() => {});
      await clientDB.from('clients').delete().eq('user_code', userCode).catch(() => {});
    }

    const { error: authDeleteError } = await clientDB.auth.admin.deleteUser(authUserId);
    if (authDeleteError) {
      console.error('❌ Error deleting auth user:', authDeleteError);
      return res.status(500).json({ error: `Failed to delete auth account: ${authDeleteError.message}` });
    }

    console.log('✅ Account deleted for user:', authUserId);
    res.json({ success: true, message: 'Account and all associated data deleted' });
  } catch (error) {
    console.error('DELETE /api/auth/account error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete account' });
  }
}

async function signup(req, res) {
  try {
    const { email, password, userData = {}, invitationToken, providerId, managerLinkData } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const normalizedEmail = email.toLowerCase().trim();
    const { data: existingClient } = await clientDB.from('clients').select('email').eq('email', normalizedEmail).maybeSingle();
    if (existingClient) return res.status(400).json({ error: 'This email is already registered. Please use a different email or login.', code: 400 });

    const regDb = adminDB;
    let managerId = null;
    let registrationRule = null;
    let linkIdFromToken = null;
    let managerIdFromToken = null;

    if (invitationToken) {
      try {
        const decoded = Buffer.from(invitationToken, 'base64').toString('utf-8');
        try {
          const obj = JSON.parse(decoded);
          if (obj?.link_id) { linkIdFromToken = obj.link_id; managerIdFromToken = obj.manager_id || null; }
          else if (obj?.manager_id) managerIdFromToken = obj.manager_id;
        } catch { managerIdFromToken = decoded; }
      } catch { /* ignore */ }
    }
    if (!linkIdFromToken && managerLinkData?.link_id) linkIdFromToken = managerLinkData.link_id;
    if (!managerIdFromToken && managerLinkData?.manager_id) managerIdFromToken = managerLinkData.manager_id;

    if (linkIdFromToken || managerIdFromToken) {
      if (!regDb) return res.status(503).json({ error: 'Registration links require CHAT_SUPABASE_URL and CHAT_SUPABASE_SERVICE_ROLE_KEY' });
      try {
        let row = null;
        if (linkIdFromToken) {
          const { data, error } = await regDb.from('registration_rules').select('id, link_id, manager_id, max_slots, current_count, expires_at, is_active').eq('link_id', linkIdFromToken).maybeSingle();
          if (!error) row = data;
        } else {
          const numericId = /^\d+$/.test(String(managerIdFromToken)) ? parseInt(managerIdFromToken, 10) : null;
          if (numericId != null) {
            const { data } = await regDb.from('registration_rules').select('id, manager_id, max_slots, current_count, expires_at, is_active').eq('id', numericId).maybeSingle();
            row = data;
          }
          if (!row) {
            const { data } = await regDb.from('registration_rules').select('id, manager_id, max_slots, current_count, expires_at, is_active').eq('manager_id', managerIdFromToken).maybeSingle();
            row = data;
          }
        }
        if (row) {
          if (!row.is_active) return res.status(400).json({ error: 'This registration link is no longer active', code: 400 });
          if (row.expires_at && new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'This registration link has expired', code: 400 });
          if (row.max_slots != null && (row.current_count || 0) >= row.max_slots) return res.status(400).json({ error: `This registration link has reached the maximum number of slots (${row.max_slots})`, code: 400 });
          registrationRule = row;
          managerId = row.manager_id;
        } else if (managerIdFromToken) {
          managerId = managerIdFromToken;
        }
      } catch (e) { console.error('⚠️ Error resolving registration link:', e); }
    }

    if (invitationToken && !registrationRule && !managerId) {
      try {
        const decodedToken = Buffer.from(invitationToken, 'base64').toString('utf-8');
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(decodedToken) && adminDB) {
          const { data: invitationData } = await adminDB.from('waiting_list').select('id, email, invitation_used_at').eq('invitation_token', decodedToken).maybeSingle();
          if (!invitationData) return res.status(400).json({ error: 'Invalid invitation token', code: 400 });
          if (invitationData.invitation_used_at) return res.status(400).json({ error: 'This invitation has already been used', code: 400 });
        }
      } catch (tokenError) { console.error('⚠️ Error validating invitation token:', tokenError); }
    }

    const { data: signupData, error: signupError } = await supabaseAuth.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          first_name: userData.first_name,
          last_name: userData.last_name,
          phone: userData.phone,
          newsletter: userData.newsletter,
          full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
        },
      },
    });

    if (signupError) {
      console.error('❌ Signup error:', signupError.message);
      return res.status(400).json({ error: signupError.message || 'Failed to create account', code: signupError.status || 400 });
    }
    if (!signupData?.user) return res.status(400).json({ error: 'Failed to create user account', code: 400 });
    console.log('✅ Signup successful for user:', signupData.user.id);

    // Increment registration rule slot
    if (registrationRule && regDb) {
      try {
        const linkIdToUse = linkIdFromToken || registrationRule.link_id;
        const useLinkId = !!linkIdToUse;
        let q = regDb.from('registration_rules').select('current_count, max_slots, is_active');
        if (useLinkId) q = q.eq('link_id', linkIdToUse); else q = q.eq('id', registrationRule.id);
        const { data: cur } = await q.maybeSingle();
        if (cur != null) {
          const newCount = (cur.current_count || 0) + 1;
          const updatePayload = { current_count: newCount };
          if (cur.max_slots != null && newCount >= cur.max_slots) updatePayload.is_active = false;
          let upd = regDb.from('registration_rules').update(updatePayload);
          if (useLinkId) upd = upd.eq('link_id', linkIdToUse); else upd = upd.eq('id', registrationRule.id);
          await upd;
        }
      } catch (e) { console.error('❌ Exception incrementing registration link:', e); }
    }

    // Generate unique user code
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let userCode = null;
    for (let attempts = 0; attempts < 100 && !userCode; attempts++) {
      let code = '';
      for (let i = 0; i < 6; i++) code += letters.charAt(Math.floor(Math.random() * letters.length));
      const { data: codeCheck } = await clientDB.from('clients').select('user_code').eq('user_code', code).maybeSingle();
      if (!codeCheck) userCode = code;
    }
    if (!userCode) return res.status(500).json({ error: 'Failed to generate unique user code', code: 500 });

    // Determine provider ID
    let finalProviderId = null;
    if (managerId) {
      finalProviderId = managerId;
    } else if (providerId && typeof providerId === 'string' && providerId.trim().length > 0) {
      finalProviderId = providerId.trim();
    } else if (adminDB) {
      const betterChoiceCompanyId = '4ab37b7b-dff1-4ee5-9920-0281e0c6468a';
      const { data: defaultManagerData } = await adminDB.from('profiles').select('id').eq('company_id', betterChoiceCompanyId).eq('role', 'company_manager').order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (defaultManagerData) finalProviderId = defaultManagerData.id;
    }

    const normalizePhone = (phone) => phone ? phone.replace(/[\s\-\(\)\.]/g, '') : null;
    const normalizedPhone = normalizePhone(userData.phone);

    const { data: clientData, error: clientError } = await clientDB.from('clients').insert([{
      user_id: signupData.user.id,
      full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      user_code: userCode,
      status: 'active',
    }]).select();

    if (clientError) {
      console.error('❌ Error creating client record:', clientError);
      return res.status(500).json({ error: 'Account created but failed to create client record. Please contact support.', code: 500 });
    }

    let chatUserCreated = false;
    let chatUserDataResult = null;
    if (adminDB && clientData?.[0]) {
      try {
        const { data: chatUserResult, error: chatUserError } = await adminDB.from('chat_users').insert([{
          user_code: userCode,
          full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
          email: normalizedEmail,
          phone_number: normalizedPhone,
          whatsapp_number: normalizedPhone,
          platform: userData.platform || 'whatsapp',
          provider_id: finalProviderId || null,
          activated: true,
          is_verified: false,
          language: 'en',
          created_at: new Date().toISOString(),
        }]).select();

        if (!chatUserError) { chatUserCreated = true; chatUserDataResult = chatUserResult; }
      } catch (chatError) { console.error('⚠️ Error creating chat user (non-critical):', chatError); }
    }

    if (invitationToken && !registrationRule && adminDB) {
      try {
        const decodedToken = Buffer.from(invitationToken, 'base64').toString('utf-8');
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(decodedToken)) {
          await adminDB.from('waiting_list').update({ invitation_used_at: new Date().toISOString() }).eq('invitation_token', decodedToken);
        }
      } catch (tokenError) { console.error('⚠️ Error marking invitation as used:', tokenError); }
    }

    res.json({ data: { user: signupData.user, session: signupData.session }, client: clientData?.[0] || null, chatUserCreated, chatUserData: chatUserDataResult, error: null });
  } catch (error) {
    console.error('❌ Unexpected signup error:', error);
    res.status(500).json({ error: error.message || 'An error occurred during signup', code: 500 });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email: email.toLowerCase().trim(), password });
    if (error) return res.status(401).json({ error: error.message || 'Invalid email or password', code: error.status || 401 });
    if (!data?.user) return res.status(401).json({ error: 'Authentication failed', code: 401 });

    console.log('✅ Login successful for user:', data.user.id);
    await ensureClientLinkedToAuthUser(data.user.id, data.user.email);

    let languageData = null;
    try {
      const { data: clientData, error: clientError } = await clientDB.from('clients').select('user_language').eq('user_id', data.user.id).maybeSingle();
      if (!clientError && clientData) languageData = clientData;
    } catch { /* non-critical */ }

    res.json({ data: { user: data.user, session: data.session }, language: languageData, error: null });
  } catch (error) {
    console.error('❌ Unexpected login error:', error);
    res.status(500).json({ error: error.message || 'An error occurred during login', code: 500 });
  }
}

async function checkEmail(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const normalizedEmail = email.toLowerCase();

    const { data: primaryData, error: primaryError } = await clientDB.from('clients').select('email').eq('email', normalizedEmail).maybeSingle();
    if (primaryError && primaryError.code !== 'PGRST116') throw primaryError;
    if (primaryData) return res.json({ exists: true });

    if (adminDB) {
      const { data: secondaryData, error: secondaryError } = await adminDB.from('chat_users').select('email').eq('email', normalizedEmail).maybeSingle();
      if (secondaryError && secondaryError.code !== 'PGRST116') throw secondaryError;
      if (secondaryData) return res.json({ exists: true });
    }

    res.json({ exists: false });
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({ error: error.message });
  }
}

async function checkPhone(req, res) {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone is required' });

    const { data: primaryData, error: primaryError } = await clientDB.from('clients').select('phone').eq('phone', phone).maybeSingle();
    if (primaryError && primaryError.code !== 'PGRST116') throw primaryError;
    if (primaryData) return res.json({ exists: true });

    if (adminDB) {
      const { data: byPhone } = await adminDB.from('chat_users').select('phone_number').eq('phone_number', phone).maybeSingle();
      if (byPhone) return res.json({ exists: true });
      const { data: byWA } = await adminDB.from('chat_users').select('whatsapp_number').eq('whatsapp_number', phone).maybeSingle();
      if (byWA) return res.json({ exists: true });
    }

    res.json({ exists: false });
  } catch (error) {
    console.error('Error checking phone:', error);
    res.status(500).json({ error: error.message });
  }
}

async function checkUserCode(req, res) {
  try {
    const { userCode } = req.body;
    if (!userCode) return res.status(400).json({ error: 'User code is required' });

    const { data: primaryData, error: primaryError } = await clientDB.from('clients').select('user_code').eq('user_code', userCode).maybeSingle();
    if (primaryError && primaryError.code !== 'PGRST116') throw primaryError;
    if (primaryData) return res.json({ exists: true });

    if (adminDB) {
      const { data: secondaryData } = await adminDB.from('chat_users').select('user_code').eq('user_code', userCode).maybeSingle();
      if (secondaryData) return res.json({ exists: true });
    }

    res.json({ exists: false });
  } catch (error) {
    console.error('Error checking user code:', error);
    res.status(500).json({ error: error.message });
  }
}

async function checkRegistrationRule(req, res) {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    try {
      const decodedToken = Buffer.from(token, 'base64').toString('utf-8');
      const integerId = parseInt(decodedToken, 10);
      let registrationRule = null;

      if (!isNaN(integerId) && integerId > 0) {
        const { data, error } = await adminDB.from('registration_rules').select('id, manager_id, max_slots, current_count, expires_at, is_active').eq('id', integerId).maybeSingle();
        if (!error && data) registrationRule = data;
      } else {
        const { data, error } = await adminDB.from('registration_rules').select('id, manager_id, max_slots, current_count, expires_at, is_active').eq('manager_id', decodedToken).maybeSingle();
        if (!error && data) registrationRule = data;
      }

      if (!registrationRule) return res.status(404).json({ error: 'Registration rule not found', available: false });
      if (!registrationRule.is_active) return res.status(400).json({ error: 'This registration link is no longer active', available: false, is_active: false });
      if (registrationRule.expires_at && new Date(registrationRule.expires_at) < new Date()) return res.status(400).json({ error: 'This registration link has expired', available: false, expired: true });

      const isAvailable = registrationRule.max_slots === null || registrationRule.current_count < registrationRule.max_slots;
      return res.json({ available: isAvailable, registration_rule: { id: registrationRule.id, manager_id: registrationRule.manager_id, max_slots: registrationRule.max_slots, current_count: registrationRule.current_count, remaining_slots: registrationRule.max_slots !== null ? Math.max(0, registrationRule.max_slots - registrationRule.current_count) : null, expires_at: registrationRule.expires_at, is_active: registrationRule.is_active }, error: isAvailable ? null : `Maximum slots reached (${registrationRule.max_slots})` });
    } catch (decodeError) {
      return res.status(400).json({ error: 'Invalid token format' });
    }
  } catch (error) {
    console.error('Error checking registration rule:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getDefaultProvider(req, res) {
  try {
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });
    const betterChoiceCompanyId = '4ab37b7b-dff1-4ee5-9920-0281e0c6468a';
    const { data: managerData, error: managerError } = await adminDB.from('profiles').select('id').eq('company_id', betterChoiceCompanyId).eq('role', 'company_manager').order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (managerError && managerError.code !== 'PGRST116') throw managerError;
    res.json({ provider_id: managerData?.id || null });
  } catch (error) {
    console.error('Error getting default provider:', error);
    res.status(500).json({ error: error.message });
  }
}

function buildCreateClientResponse({
  userId,
  userData,
  clientRows,
  providerToken,
  alreadyExisted,
  chatUserCreated,
  chatUserData,
}) {
  const clientRow = clientRows?.[0] ?? null;
  const email = clientRow?.email || userData?.email || '';

  if (providerToken) {
    return {
      data: {
        user: { id: userId, email },
        session: {
          access_token: providerToken.accessToken || null,
          refresh_token: providerToken.refreshToken || null,
          expires_at: providerToken.expiresAt ?? undefined,
          expires_in: providerToken.expiresIn ?? undefined,
          token_type: 'bearer',
        },
      },
      language: null,
      error: null,
      ...(alreadyExisted ? { alreadyExisted: true } : {}),
      chatUserCreated: chatUserCreated ?? false,
      chatUserData: chatUserData ?? null,
    };
  }

  return {
    data: clientRows ?? [],
    ...(alreadyExisted ? { alreadyExisted: true } : {}),
    chatUserCreated: chatUserCreated ?? false,
    chatUserData: chatUserData ?? null,
  };
}

async function createClient(req, res) {
  try {
    const {
      userId,
      userData,
      userCode: requestedUserCode,
      providerId,
      invitationToken,
      managerLinkData,
      providerToken,
    } = req.body;

    if (!userId || !userData) {
      return res.status(400).json({ error: 'User ID and user data are required' });
    }

    if (req.userId && userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data: authUserData, error: authUserError } = await clientDB.auth.admin.getUserById(userId);
    if (authUserError || !authUserData?.user) {
      return res.status(400).json({ error: 'Invalid user' });
    }

    const { data: existingClient } = await clientDB
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingClient) {
      return res.json(
        buildCreateClientResponse({
          userId,
          userData,
          clientRows: [existingClient],
          providerToken,
          alreadyExisted: true,
          chatUserCreated: false,
          chatUserData: null,
        }),
      );
    }

    const normalizedSignupEmail = (userData.email || '').trim().toLowerCase();
    if (normalizedSignupEmail && (await emailHasBetterChoiceAccount(normalizedSignupEmail))) {
      try {
        await clientDB.auth.admin.deleteUser(userId);
      } catch (e) {
        console.warn('create-client: orphan cleanup failed:', e?.message);
      }
      return res.status(409).json({ error: 'account_exists', email: normalizedSignupEmail });
    }

    let userCode = requestedUserCode || null;
    if (!userCode) {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let attempts = 0;
      while (attempts < 100 && !userCode) {
        let code = '';
        for (let i = 0; i < 6; i++) {
          code += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        const { data: codeCheck } = await clientDB
          .from('clients')
          .select('user_code')
          .eq('user_code', code)
          .maybeSingle();
        if (!codeCheck) userCode = code;
        attempts++;
      }
      if (!userCode) {
        return res.status(500).json({ error: 'Failed to generate unique user code' });
      }
    }

    const clientInsertData = {
      user_id: userId,
      full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
      email: userData.email,
      phone: userData.phone,
      user_code: userCode,
      status: 'active',
    };

    const { data, error } = await clientDB.from('clients').insert([clientInsertData]).select();
    if (error) throw error;

    const regDb = adminDB;
    let registrationRule = null;
    let linkIdFromToken = null;
    let managerIdFromToken = null;

    if (invitationToken) {
      try {
        const decoded = Buffer.from(invitationToken, 'base64').toString('utf-8');
        try {
          const obj = JSON.parse(decoded);
          if (obj?.link_id) {
            linkIdFromToken = obj.link_id;
            managerIdFromToken = obj.manager_id || null;
          } else if (obj?.manager_id) managerIdFromToken = obj.manager_id;
        } catch {
          managerIdFromToken = decoded;
        }
      } catch {
        /* ignore */
      }
    }
    if (!linkIdFromToken && managerLinkData?.link_id) linkIdFromToken = managerLinkData.link_id;
    if (!managerIdFromToken && managerLinkData?.manager_id) {
      managerIdFromToken = managerLinkData.manager_id;
    }

    if (linkIdFromToken || managerIdFromToken) {
      if (!regDb) {
        return res.status(503).json({
          error: 'Registration links require CHAT_SUPABASE_URL and CHAT_SUPABASE_SERVICE_ROLE_KEY',
        });
      }
      try {
        let row = null;
        if (linkIdFromToken) {
          const { data: r, error: re } = await regDb
            .from('registration_rules')
            .select('id, link_id, manager_id, max_slots, current_count, expires_at, is_active')
            .eq('link_id', linkIdFromToken)
            .maybeSingle();
          if (!re) row = r;
        } else {
          const numericId = /^\d+$/.test(String(managerIdFromToken))
            ? parseInt(managerIdFromToken, 10)
            : null;
          if (numericId != null) {
            const { data: r } = await regDb
              .from('registration_rules')
              .select('id, manager_id, max_slots, current_count, expires_at, is_active')
              .eq('id', numericId)
              .maybeSingle();
            row = r;
          }
          if (!row) {
            const { data: r } = await regDb
              .from('registration_rules')
              .select('id, manager_id, max_slots, current_count, expires_at, is_active')
              .eq('manager_id', managerIdFromToken)
              .maybeSingle();
            row = r;
          }
        }
        if (row) registrationRule = row;
      } catch (e) {
        console.error('⚠️ create-client: resolve registration link:', e);
      }
    }

    if (registrationRule && regDb) {
      try {
        const linkIdToUse = linkIdFromToken || registrationRule.link_id;
        const useLinkId = !!linkIdToUse;
        let q = regDb.from('registration_rules').select('current_count, max_slots, is_active');
        if (useLinkId) q = q.eq('link_id', linkIdToUse);
        else q = q.eq('id', registrationRule.id);
        const { data: cur, error: fe } = await q.maybeSingle();
        if (!fe && cur != null) {
          const newCount = (cur.current_count || 0) + 1;
          const setInactive = cur.max_slots != null && newCount >= cur.max_slots;
          const updatePayload = { current_count: newCount };
          if (setInactive) updatePayload.is_active = false;
          let upd = regDb.from('registration_rules').update(updatePayload);
          if (useLinkId) upd = upd.eq('link_id', linkIdToUse);
          else upd = upd.eq('id', registrationRule.id);
          const { error: ue } = await upd;
          if (ue) console.error('❌ create-client: increment registration link:', ue.message);
        }
      } catch (e) {
        console.error('❌ create-client: exception incrementing registration link:', e);
      }
    }

    let chatUserCreated = false;
    let chatUserDataResult = null;

    if (adminDB && data?.[0]) {
      try {
        const chatUserData = {
          user_code: userCode,
          full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
          email: userData.email,
          phone_number: userData.phone,
          whatsapp_number: userData.phone,
          platform: userData.platform || 'whatsapp',
          provider_id: providerId || null,
          activated: true,
          is_verified: false,
          language: 'en',
          created_at: new Date().toISOString(),
        };

        const { data: chatUserResult, error: chatUserError } = await adminDB
          .from('chat_users')
          .insert([chatUserData])
          .select();

        if (!chatUserError) {
          chatUserCreated = true;
          chatUserDataResult = chatUserResult;
        }
      } catch (chatError) {
        console.error('Error creating chat user:', chatError);
      }
    }

    res.json(
      buildCreateClientResponse({
        userId,
        userData,
        clientRows: data,
        providerToken,
        chatUserCreated,
        chatUserData: chatUserDataResult,
      }),
    );
  } catch (error) {
    console.error('Error creating client record:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getClient(req, res) {
  try {
    const { userId } = req.params;
    if (userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    const { data: client, error } = await clientDB.from('clients').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    if (!client) return res.status(404).json({ error: 'Client not found' });

    res.json({ data: client });
  } catch (error) {
    console.error('Error getting client:', error);
    res.status(500).json({ error: error.message });
  }
}

async function updateClient(req, res) {
  try {
    const { userId } = req.params;
    if (userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    const { clientData } = req.body;
    if (!clientData) return res.status(400).json({ error: 'clientData is required' });

    const { data, error } = await clientDB.from('clients').update({ ...clientData, updated_at: new Date().toISOString() }).eq('user_id', userId).select();
    if (error) throw error;

    res.json({ data: data?.[0] || null });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  refreshSession, appleVerify, appleExchange, googleFinalize, googleStart,
  deleteAccount, signup, login, checkEmail, checkPhone, checkUserCode,
  checkRegistrationRule, getDefaultProvider, createClient, getClient, updateClient,
};
