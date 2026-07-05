const { Router } = require('express');
const ctrl = require('./food.controller');
const { requireAuth, assertOwnUserCode } = require('../../middlewares/auth');

const router = Router();

router.get(   '/food-logs',                requireAuth, assertOwnUserCode('query'), ctrl.getFoodLogs);
router.post(  '/food-logs',                requireAuth, assertOwnUserCode('body'),  ctrl.createFoodLog);
router.put(   '/food-logs/:id',            requireAuth,                             ctrl.updateFoodLog);
router.delete('/food-logs/:id',            requireAuth,                             ctrl.deleteFoodLog);
router.post(  '/food-logs/analyze-image',  requireAuth,                             ctrl.analyzeImage);
router.post(  '/food-logs/analyze-text',   requireAuth,                             ctrl.analyzeText);

router.get('/foods/search',                                                          ctrl.searchFoods);
router.get('/foods/:id',                                                             ctrl.getFoodById);

router.post('/ingredient-reports',                                                   ctrl.submitIngredientReport);

module.exports = router;
