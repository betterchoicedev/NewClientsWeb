const { clientDB, adminDB } = require('../../config/db');
const svc = require('./onboarding.service');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveUserId(req) {
  const userId = req.userId || req.body?.userId || req.query?.userId;
  if (!userId || !UUID_RE.test(String(userId))) return null;
  return String(userId);
}

async function saveStep(req, res) {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { stepId, answers, stepIndex, phase, draft } = req.body || {};
    const email = req.authUser?.email || req.body?.email || null;
    const result = await svc.saveStep(
      userId,
      { stepId, answers, stepIndex, phase, draft, email },
      { clientDB, adminDB }
    );
    return res.json(result);
  } catch (error) {
    console.error('POST /api/onboarding/save-step error:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to save onboarding step' });
  }
}

async function saveDraft(req, res) {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { draft, phase, stepIndex } = req.body || {};
    const email = req.authUser?.email || req.body?.email || null;
    const result = await svc.saveDraft(userId, { draft, phase, stepIndex, email }, { clientDB, adminDB });
    return res.json(result);
  } catch (error) {
    console.error('POST /api/onboarding/draft error:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to save draft' });
  }
}

async function commit(req, res) {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const body = { ...(req.body || {}) };
    delete body.email;
    delete body.skipPayment;
    const result = await svc.commitOnboarding(userId, {
      ...body,
      email: req.authUser?.email || req.body?.email || null,
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
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const status = await svc.getStatus(userId, { clientDB, adminDB });
    return res.json(status);
  } catch (error) {
    console.error('GET /api/onboarding/status error:', error);
    return res.status(500).json({ error: error.message || 'Failed to load onboarding status' });
  }
}

async function optOut(req, res) {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const status = await svc.optOutOnboarding(userId, {
      clientDB,
      adminDB,
      email: req.authUser?.email || req.body?.email || null,
    });
    return res.json(status);
  } catch (error) {
    console.error('POST /api/onboarding/opt-out error:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to opt out of onboarding' });
  }
}

async function redeemAccessCode(req, res) {
  try {
    const userId = resolveUserId(req);
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

async function initCommerce(req, res) {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await svc.initCommerceSession(userId, {
      email: req.authUser?.email || null,
      companyId: req.body?.companyId || null,
    }, { clientDB, adminDB });
    return res.json(result);
  } catch (error) {
    console.error('POST /api/onboarding/init-commerce error:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to init commerce session' });
  }
}

async function validatePromo(req, res) {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { code, companyId, productIds } = req.body || {};
    const result = await svc.validateCompanyPromo(userId, { code, companyId, productIds }, { clientDB, adminDB });
    return res.json(result);
  } catch (error) {
    console.error('POST /api/onboarding/validate-promo error:', error);
    return res.status(error.status || 500).json({ valid: false, error: error.message || 'Failed to validate promo' });
  }
}

async function complete(req, res) {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    await svc.completeOnboardingAfterPaidSubscription(userId, { clientDB, adminDB });
    const status = await svc.getStatus(userId, { clientDB, adminDB });
    return res.json(status);
  } catch (error) {
    console.error('POST /api/onboarding/complete error:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to complete onboarding' });
  }
}

async function applyBypassPromo(req, res) {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { code, companyId, productIds } = req.body || {};
    const status = await svc.applyBypassPromo(userId, {
      code,
      companyId,
      productIds,
      email: req.authUser?.email || null,
    }, { clientDB, adminDB });
    return res.json(status);
  } catch (error) {
    console.error('POST /api/onboarding/apply-bypass-promo error:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to apply bypass promo' });
  }
}

module.exports = {
  saveDraft,
  saveStep,
  commit,
  getStatus,
  redeemAccessCode,
  optOut,
  initCommerce,
  validatePromo,
  applyBypassPromo,
  complete,
};
