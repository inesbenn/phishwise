// src/routes/dashboard.js - Version avec support temps réel
const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const fakeAuthMiddleware = require('../middleware/fakeAuthMiddleware');

const router = express.Router();

// Debug: Verify that all controller methods exist
console.log('Dashboard controller methods:', Object.keys(dashboardController));

/**
 * GET /api/dashboard/stats
 * Récupère les statistiques générales du dashboard avec métriques d'email
 */
router.get('/stats', fakeAuthMiddleware, dashboardController.getDashboardStats);

/**
 * GET /api/dashboard/campaigns
 * Récupère les campagnes actives avec statistiques de tracking en temps réel
 */
router.get('/campaigns', fakeAuthMiddleware, dashboardController.getActiveCampaigns);

/**
 * GET /api/dashboard/recent-activity
 * Récupère l'activité récente incluant les événements d'email tracking
 */
router.get('/recent-activity', fakeAuthMiddleware, dashboardController.getRecentActivity);

/**
 * GET /api/dashboard/recommendations
 * Génère des recommandations basées sur les performances d'email tracking
 */
router.get('/recommendations', fakeAuthMiddleware, dashboardController.getRecommendations);

/**
 * GET /api/dashboard/recent-events
 * Endpoint pour le polling temps réel des événements d'email
 * Query params: 
 * - since: timestamp ISO pour récupérer seulement les événements après cette date
 */
router.get('/recent-events', fakeAuthMiddleware, dashboardController.getRecentEvents);

/**
 * GET /api/dashboard/health
 * Health check pour vérifier que le dashboard fonctionne
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      emailTracking: 'active',
      dashboard: 'operational'
    }
  });
});

module.exports = router;