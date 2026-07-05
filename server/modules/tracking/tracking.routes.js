const { Router } = require('express');
const ctrl = require('./tracking.controller');
const { requireAuth, assertOwnUserCode } = require('../../middlewares/auth');

const router = Router();

router.post(  '/calendar-events',          requireAuth, assertOwnUserCode('body'),  ctrl.createCalendarEvent);
router.put(   '/calendar-events/:id',      requireAuth,                             ctrl.updateCalendarEvent);
router.delete('/calendar-events/:id',      requireAuth,                             ctrl.deleteCalendarEvent);

router.get('/daily-xp/today',              requireAuth, assertOwnUserCode('query'), ctrl.getDailyXpToday);
router.get('/daily-xp/weekly',             requireAuth, assertOwnUserCode('query'), ctrl.getDailyXpWeekly);

router.get( '/weight-logs',                requireAuth, assertOwnUserCode('query'), ctrl.getWeightLogs);
router.post('/weight-logs',                requireAuth, assertOwnUserCode('body'),  ctrl.createWeightLog);

router.post('/health/ingest',              requireAuth,                             ctrl.ingestHealthData);
router.get( '/health/summary',             requireAuth,                             ctrl.getHealthSummary);

module.exports = router;
