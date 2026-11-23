const { adminDB } = require('../../config/db');
const svc = require('../../services/streak');

// GET /api/streak?today=YYYY-MM-DD → { data: { today, currentStreak, longestStreak, freezes, ... } }
async function get(req, res) {
  try {
    const data = await svc.getStreak(req.userCode, { today: req.query.today }, { adminDB });
    res.set('Cache-Control', 'no-store');
    return res.json({ data });
  } catch (error) {
    if (!error.status || error.status >= 500) console.error('GET /api/streak error:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Request failed', code: error.code || null });
  }
}

module.exports = { get };
