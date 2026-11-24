const { adminDB } = require('../../config/db');
const svc = require('../../services/points');

// GET /api/points?today=YYYY-MM-DD → { data: { todayPoints, todayParts, weekPoints, week, level, ... } }
async function get(req, res) {
  try {
    const data = await svc.getPoints(req.userCode, { today: req.query.today }, { adminDB });
    res.set('Cache-Control', 'no-store');
    return res.json({ data });
  } catch (error) {
    if (!error.status || error.status >= 500) console.error('GET /api/points error:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Request failed', code: error.code || null });
  }
}

module.exports = { get };
