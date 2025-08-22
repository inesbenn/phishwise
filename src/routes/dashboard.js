// src/routes/dashboard.js
const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const fakeAuthMiddleware = require('../middleware/fakeAuthMiddleware');

const router = express.Router();

// Debug: Verify that all controller methods exist
console.log('Dashboard controller methods:', Object.keys(dashboardController));

/**
 * GET /api/dashboard/stats
 * Récupère les statistiques générales du dashboard
 */
router.get('/stats', fakeAuthMiddleware, dashboardController.getDashboardStats);

/**
 * GET /api/dashboard/campaigns
 * Récupère les campagnes actives pour le dashboard
 */
router.get('/campaigns', fakeAuthMiddleware, dashboardController.getActiveCampaigns);

/**
 * GET /api/dashboard/recent-activity
 * Récupère l'activité récente
 */
router.get('/recent-activity', fakeAuthMiddleware, dashboardController.getRecentActivity);

/**
 * GET /api/dashboard/recommendations
 * Récupère les recommandations IA
 */
router.get('/recommendations', fakeAuthMiddleware, dashboardController.getRecommendations);

module.exports = router;