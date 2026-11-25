const { adminDB } = require('../../config/db');
const svc = require('../../services/hanukkah');

// GET /api/challenges/hanukkah?today=YYYY-MM-DD → { data: { nights, tonight, done, total, badgeEarned, ... } }
async function hanukkah(req, res) {
  try {
    const data = await svc.getHanukkah(req.userCode, { today: req.query.today }, { adminDB });
    res.set('Cache-Control', 'no-store');
    return res.json({ data });
  } catch (error) {
    if (!error.status || error.status >= 500) console.error('GET /api/challenges/hanukkah error:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Request failed', code: error.code || null });
  }
}

module.exports = { hanukkah };
