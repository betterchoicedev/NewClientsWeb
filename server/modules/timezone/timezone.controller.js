const { adminDB, clientDB } = require('../../config/db');
const svc = require('../../services/timezone');

// POST /api/profile/timezone { timezone: 'Asia/Jerusalem' } → { data: { timezone, previous, changed } }
async function save(req, res) {
  try {
    const data = await svc.saveDeviceTimezone(req.userCode, req.userId, req.body?.timezone, { adminDB, clientDB });
    res.set('Cache-Control', 'no-store');
    return res.json({ data });
  } catch (error) {
    if (!error.status || error.status >= 500) console.error('POST /api/profile/timezone error:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Request failed', code: error.code || null });
  }
}

module.exports = { save };
