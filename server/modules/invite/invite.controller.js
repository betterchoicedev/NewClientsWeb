const { clientDB, adminDB } = require('../../config/db');
const svc = require('./invite.service');
const { ensureClientAndChatUser } = require('../onboarding/onboarding.service');

// GET /api/invite-codes/:code (public): landing page info for a dietitian's code.
async function lookup(req, res) {
  try {
    const invite = await svc.lookupInvite(req.params.code, { adminDB });
    if (!invite) return res.status(404).json({ error: 'Code not found', code: 'code_not_found' });
    res.set('Cache-Control', 'public, max-age=60');
    return res.json({ invite });
  } catch (error) {
    console.error('GET /api/invite-codes error:', error);
    return res.status(500).json({ error: 'Failed to look up code' });
  }
}

// POST /api/my-dietitian/claim-code { code }: attach the signed-in client to that dietitian.
async function claim(req, res) {
  try {
    const invite = await svc.claimInviteCode(req.userId, req.body?.code, {
      clientDB,
      adminDB,
      ensureClientAndChatUser,
    });
    return res.json({ invite });
  } catch (error) {
    if (!error.status || error.status >= 500) console.error('POST /api/my-dietitian/claim-code error:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to apply code', code: error.code || null });
  }
}

// GET /api/my-dietitian: the "My dietitian" card. { dietitian: null } when there is none.
async function mine(req, res) {
  try {
    const dietitian = await svc.getMyDietitian(req.userId, { clientDB, adminDB });
    return res.json({ dietitian });
  } catch (error) {
    console.error('GET /api/my-dietitian error:', error);
    return res.status(500).json({ error: 'Failed to load dietitian' });
  }
}

module.exports = { lookup, claim, mine };
