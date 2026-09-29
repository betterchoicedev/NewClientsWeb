/**
 * Re-exports the auth middleware factory, pre-wired to the singleton DB clients.
 * Import { requireAuth, assertOwnUserCode, ... } from here in all module controllers.
 */
const { createAuthMiddleware } = require('../middleware/auth');
const { clientDB, supabaseAuth, adminDB } = require('../config/db');

const {
  requireAuth,
  assertSelfUserId,
  assertOwnUserCode,
  verifyFoodLogOwnership,
  verifyCalendarEventOwnership,
  apiAuthGuard,
} = createAuthMiddleware(supabaseAuth, clientDB, adminDB);

module.exports = {
  requireAuth,
  assertSelfUserId,
  assertOwnUserCode,
  verifyFoodLogOwnership,
  verifyCalendarEventOwnership,
  apiAuthGuard,
};
