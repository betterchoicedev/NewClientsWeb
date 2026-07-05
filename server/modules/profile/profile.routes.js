const { Router } = require('express');
const ctrl = require('./profile.controller');
const { requireAuth, assertOwnUserCode } = require('../../middlewares/auth');

const router = Router();

// ─── User settings ────────────────────────────────────────────────────────────
router.get( '/user/user-code',         requireAuth, ctrl.getUserCode);
router.get( '/user/language',          requireAuth, ctrl.getUserLanguage);
router.get( '/user/settings',          requireAuth, ctrl.getUserSettings);
router.post('/user/settings',          requireAuth, ctrl.updateUserSettings);

// ─── Onboarding ───────────────────────────────────────────────────────────────
router.get( '/onboarding/client-data',         requireAuth, ctrl.getOnboardingClientData);
router.get( '/onboarding/chat-user-meal-data', requireAuth, ctrl.getOnboardingChatUserMealData);
router.post('/onboarding/check-phone',         requireAuth, ctrl.checkOnboardingPhone);
router.post('/onboarding/update-client',       requireAuth, ctrl.updateOnboardingClient);
router.post('/onboarding/update-chat-user',    requireAuth, ctrl.updateOnboardingChatUser);
router.post('/onboarding/start-async-meal-plan', requireAuth, ctrl.startAsyncMealPlan);
router.post('/onboarding/classify-activity',              ctrl.classifyActivity);
router.get( '/onboarding/status',              requireAuth, ctrl.getOnboardingStatus);

// ─── Cities ───────────────────────────────────────────────────────────────────
router.get('/cities/search', ctrl.searchCities);

// ─── Profile ──────────────────────────────────────────────────────────────────
router.get( '/profile/meal-plan',                  requireAuth, ctrl.getProfileMealPlan);
router.post('/profile/meal-plan/clear-edited',     requireAuth, ctrl.clearEditedMealPlan);
router.post('/profile/meal-plan/save-edited',      requireAuth, ctrl.saveEditedMealPlan);
router.post('/profile/meal-plan/ai-update',        requireAuth, ctrl.aiUpdateMealPlan);
router.post('/profile/meal-plan/create',           requireAuth, ctrl.createMealPlan);
router.get( '/profile/client',                     requireAuth, ctrl.getProfileClient);
router.get( '/profile/load',                       requireAuth, ctrl.loadProfile);
router.get( '/profile/chat-user',                  requireAuth, ctrl.getProfileChatUser);
router.get( '/profile/chat-user/me',               requireAuth, ctrl.getProfileChatUserMe);
router.get( '/profile/meal-window',                requireAuth, ctrl.getMealWindow);
router.post('/profile/save',                       requireAuth, ctrl.saveProfile);
router.post('/profile/sync-chat-user',             requireAuth, ctrl.syncChatUser);
router.post('/profile/save-nutritional',           requireAuth, ctrl.saveNutritional);
router.post('/profile/save-personal',              requireAuth, ctrl.savePersonal);
router.post('/profile/save-health',                requireAuth, ctrl.saveHealth);
router.post('/profile/save-image-url',             requireAuth, ctrl.saveImageUrl);
router.get( '/profile/user-code',                  requireAuth, ctrl.getProfileUserCode);
router.post('/profile/upload-image',               requireAuth, ctrl.uploadImage);
router.get( '/profile/client-data-full',           requireAuth, ctrl.getClientDataFull);
router.get( '/profile/provider',                   requireAuth, ctrl.getProvider);
router.get( '/profile/system-message-exists',      requireAuth, ctrl.systemMessageExists);
router.post('/profile/system-message',             requireAuth, ctrl.upsertSystemMessage);
router.post('/profile/update-language',            requireAuth, ctrl.updateLanguage);

module.exports = router;
