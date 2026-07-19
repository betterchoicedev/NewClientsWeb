const { clientDB, adminDB } = require('../../config/db');
const svc = require('./onboarding.service');

async function saveDraft(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { draft, phase, stepIndex } = req.body || {};
    const email = req.authUser?.email || null;
    const result = await svc.saveDraft(userId, { draft, phase, stepIndex, email }, { clientDB, adminDB });
    return res.json(result);
  } catch (error) {
    console.error('POST /api/onboarding/draft error:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to save draft' });
  }
}

async function commit(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const body = { ...(req.body || {}) };
    delete body.email;
    delete body.skipPayment;
    const result = await svc.commitOnboarding(userId, {
      ...body,
      email: req.authUser?.email || null,
    }, { clientDB, adminDB });

    if (!result?.userCode) {
      return res.status(500).json({ error: 'Commit succeeded without userCode' });
    }
    return res.json(result);
  } catch (error) {
    console.error('POST /api/onboarding/commit error:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to commit onboarding' });
  }
}

async function getStatus(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const status = await svc.getStatus(userId, { clientDB, adminDB });
    return res.json(status);
  } catch (error) {
    console.error('GET /api/onboarding/status error:', error);
    return res.status(500).json({ error: error.message || 'Failed to load onboarding status' });
  }
}

async function redeemAccessCode(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { code } = req.body || {};
    const status = await svc.redeemAccessCode(userId, { code }, { clientDB, adminDB });
    return res.json({ valid: true, ...status });
  } catch (error) {
    console.error('POST /api/onboarding/redeem-access-code error:', error);
    return res.status(error.status || 500).json({
      valid: false,
      error: error.message || 'Failed to redeem access code',
    });
  }
}

module.exports = {
  saveDraft,
  commit,
  getStatus,
  redeemAccessCode,
};
