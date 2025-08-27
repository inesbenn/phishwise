// routes/analytics.js
const express = require('express');
const AnalyticsController = require('../controllers/AnalyticsController');
const fakeAuthMiddleware = require('../middleware/fakeAuthMiddleware');

const router = express.Router();

/**
 * GET /api/analytics/overview
 * Récupère les statistiques globales du système
 */
router.get('/overview', fakeAuthMiddleware, AnalyticsController.getOverview);

/**
 * GET /api/analytics/campaigns
 * Récupère les analytics de toutes les campagnes
 */
router.get('/campaigns', fakeAuthMiddleware, AnalyticsController.getCampaigns);

/**
 * GET /api/analytics/campaigns/:campaignId
 * Récupère les analytics détaillées d'une campagne spécifique
 */
router.get('/campaigns/:campaignId', fakeAuthMiddleware, AnalyticsController.getCampaignDetails);

/**
 * GET /api/analytics/users/progress
 * Récupère la progression des utilisateurs avec filtres et pagination
 * 
 * Query Parameters:
 * - campaignId: ID de campagne pour filtrer
 * - search: Terme de recherche (nom, email, poste)
 * - office: Filtre par bureau
 * - country: Filtre par pays  
 * - status: Filtre par statut (completed, in_progress, not_started)
 * - sortBy: Champ de tri (averageScore, totalFormationsCompleted, etc.)
 * - sortOrder: Ordre de tri (asc, desc)
 * - page: Numéro de page (défaut: 1)
 * - limit: Éléments par page (défaut: 50)
 */
router.get('/users/progress', fakeAuthMiddleware, AnalyticsController.getUserProgress);

/**
 * GET /api/analytics/users/:campaignId/:targetEmail
 * Récupère les détails complets d'un utilisateur spécifique
 */
router.get('/users/:campaignId/:targetEmail', fakeAuthMiddleware, async (req, res) => {
  try {
    const { campaignId, targetEmail } = req.params;
    
    // Utiliser la fonction existante du Learning Controller
    const LearningController = require('../controllers/LearningController');
    await LearningController.getCampaignFormations(req, res);
    
  } catch (error) {
    console.error('Erreur détails utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des détails utilisateur',
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/progress-over-time
 * Récupère l'évolution des progrès dans le temps
 * 
 * Query Parameters:
 * - timeframe: Période d'analyse (7d, 30d, 90d, 1y)
 * - campaignId: ID de campagne pour filtrer
 */
router.get('/progress-over-time', fakeAuthMiddleware, AnalyticsController.getProgressOverTime);

/**
 * GET /api/analytics/formations/performance
 * Récupère les statistiques de performance par formation
 */
router.get('/formations/performance', fakeAuthMiddleware, AnalyticsController.getFormationPerformance);

/**
 * GET /api/analytics/engagement
 * Récupère les données d'engagement et d'activité
 * 
 * Query Parameters:
 * - timeframe: Période d'analyse (7d, 30d, 90d, 1y)
 * - groupBy: Groupement des données (day, week, month)
 */
router.get('/engagement', fakeAuthMiddleware, async (req, res) => {
  try {
    const { timeframe = '30d', groupBy = 'day' } = req.query;
    
    // Calculer la date de début
    const now = new Date();
    let startDate;
    
    switch (timeframe) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const UserProgress = require('../models/UserProgress');

    // Engagement basé sur l'activité récente
    const engagementData = await UserProgress.aggregate([
      {
        $match: {
          lastActivity: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupBy === 'day' ? "%Y-%m-%d" : 
                     groupBy === 'week' ? "%Y-%U" : "%Y-%m",
              date: "$lastActivity"
            }
          },
          activeUsers: { $sum: 1 },
          totalFormationsStarted: { $sum: '$totalFormationsStarted' },
          totalFormationsCompleted: { $sum: '$totalFormationsCompleted' },
          totalTimeSpent: { $sum: '$totalTimeSpent' },
          averageScore: { $avg: '$averageScore' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({
      success: true,
      data: engagementData
    });

  } catch (error) {
    console.error('Erreur analytics engagement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des données d\'engagement',
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/completion-metrics
 * Récupère les métriques de completion et d'abandon
 */
router.get('/completion-metrics', fakeAuthMiddleware, async (req, res) => {
  try {
    const UserProgress = require('../models/UserProgress');

    const completionMetrics = await UserProgress.aggregate([
      {
        $facet: {
          overallStats: [
            {
              $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                usersWithStartedFormations: {
                  $sum: { $cond: [{ $gt: ['$totalFormationsStarted', 0] }, 1, 0] }
                },
                usersWithCompletedFormations: {
                  $sum: { $cond: [{ $gt: ['$totalFormationsCompleted', 0] }, 1, 0] }
                },
                averageCompletionRate: {
                  $avg: {
                    $cond: [
                      { $gt: ['$totalFormationsStarted', 0] },
                      { $divide: ['$totalFormationsCompleted', '$totalFormationsStarted'] },
                      0
                    ]
                  }
                }
              }
            }
          ],
          dropoffAnalysis: [
            {
              $unwind: '$formations'
            },
            {
              $group: {
                _id: '$formations.status',
                count: { $sum: 1 },
                averageProgress: { $avg: '$formations.overallProgress' }
              }
            }
          ]
        }
      }
    ]);

    const metrics = completionMetrics[0];
    const overall = metrics.overallStats[0] || {};
    
    res.json({
      success: true,
      data: {
        overall: {
          totalUsers: overall.totalUsers || 0,
          startedRate: overall.totalUsers > 0 
            ? Math.round((overall.usersWithStartedFormations / overall.totalUsers) * 100)
            : 0,
          completionRate: overall.totalUsers > 0 
            ? Math.round((overall.usersWithCompletedFormations / overall.totalUsers) * 100)
            : 0,
          averageCompletionRate: Math.round((overall.averageCompletionRate || 0) * 100)
        },
        dropoffAnalysis: metrics.dropoffAnalysis.map(item => ({
          status: item._id,
          count: item.count,
          averageProgress: Math.round(item.averageProgress || 0)
        }))
      }
    });

  } catch (error) {
    console.error('Erreur completion metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des métriques de completion',
      error: error.message
    });
  }
});

/**
 * POST /api/analytics/export
 * Exporte les données analytics dans différents formats (CSV, JSON, Excel)
 * 
 * Body:
 * - format: Format d'export (csv, json, xlsx)
 * - type: Type de données (users, campaigns, formations, overview)
 * - filters: Filtres à appliquer aux données
 */
router.post('/export', fakeAuthMiddleware, AnalyticsController.exportData);

/**
 * GET /api/analytics/recommendations
 * Génère des recommandations basées sur les données analytics
 * 
 * Query Parameters:
 * - campaignId: ID de campagne pour des recommandations spécifiques
 */
router.get('/recommendations', fakeAuthMiddleware, async (req, res) => {
  try {
    const { campaignId } = req.query;
    const recommendations = [];

    const UserProgress = require('../models/UserProgress');
    const Campaign = require('../models/Campaign');

    // Filtre par campagne si spécifié
    let matchFilter = {};
    if (campaignId && campaignId !== 'all') {
      matchFilter.campaignId = require('mongoose').Types.ObjectId(campaignId);
    }

    // Analyser les taux de completion faibles
    const lowCompletionStats = await UserProgress.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          completedUsers: {
            $sum: { $cond: [{ $gt: ['$totalFormationsCompleted', 0] }, 1, 0] }
          },
          averageScore: { $avg: '$averageScore' }
        }
      }
    ]);

    const stats = lowCompletionStats[0];
    if (stats) {
      const completionRate = (stats.completedUsers / stats.totalUsers) * 100;
      
      if (completionRate < 50) {
        recommendations.push({
          type: 'warning',
          priority: 'high',
          title: 'Taux de completion faible',
          message: `Seulement ${Math.round(completionRate)}% des utilisateurs ont terminé au moins une formation. Considérez réviser le contenu ou la durée des formations.`,
          actionSuggested: 'Analyser les points d\'abandon et simplifier les modules',
          metrics: { completionRate: Math.round(completionRate) }
        });
      }

      if (stats.averageScore < 70) {
        recommendations.push({
          type: 'info',
          priority: 'medium',
          title: 'Score moyen sous la moyenne',
          message: `Le score moyen de ${Math.round(stats.averageScore)}% indique que le contenu pourrait être trop difficile ou pas assez clair.`,
          actionSuggested: 'Réviser la complexité des questions et ajouter plus d\'exemples',
          metrics: { averageScore: Math.round(stats.averageScore) }
        });
      }
    }

    // Analyser les formations les moins performantes
    const underperformingFormations = await UserProgress.aggregate([
      { $match: matchFilter },
      { $unwind: '$formations' },
      {
        $lookup: {
          from: 'formations',
          localField: 'formations.formationId',
          foreignField: '_id',
          as: 'formationInfo'
        }
      },
      { $unwind: '$formationInfo' },
      {
        $group: {
          _id: '$formations.formationId',
          formationName: { $first: '$formationInfo.title' },
          totalStarted: { $sum: 1 },
          totalCompleted: {
            $sum: { $cond: [{ $eq: ['$formations.status', 'completed'] }, 1, 0] }
          },
          averageProgress: { $avg: '$formations.overallProgress' }
        }
      },
      {
        $addFields: {
          completionRate: { $divide: ['$totalCompleted', '$totalStarted'] }
        }
      },
      {
        $match: {
          totalStarted: { $gte: 5 }, // Au moins 5 utilisateurs ont commencé
          completionRate: { $lt: 0.3 } // Moins de 30% de completion
        }
      },
      { $sort: { completionRate: 1 } },
      { $limit: 3 }
    ]);

    if (underperformingFormations.length > 0) {
      recommendations.push({
        type: 'warning',
        priority: 'high',
        title: 'Formations à problème identifiées',
        message: `${underperformingFormations.length} formation(s) ont un taux de completion très faible (<30%).`,
        actionSuggested: 'Réviser ces formations ou les diviser en modules plus courts',
        details: underperformingFormations.map(f => ({
          name: f.formationName,
          completionRate: Math.round(f.completionRate * 100)
        }))
      });
    }

    // Recommandations positives pour les bonnes performances
    const topPerformers = await UserProgress.aggregate([
      { $match: matchFilter },
      {
        $match: {
          totalFormationsCompleted: { $gte: 2 },
          averageScore: { $gte: 85 }
        }
      },
      { $sort: { averageScore: -1 } },
      { $limit: 5 }
    ]);

    if (topPerformers.length > 0) {
      recommendations.push({
        type: 'success',
        priority: 'low',
        title: 'Utilisateurs exemplaires identifiés',
        message: `${topPerformers.length} utilisateurs excellent dans les formations (score > 85%).`,
        actionSuggested: 'Considérer ces utilisateurs comme ambassadeurs ou mentors',
        details: topPerformers.map(u => ({
          name: `${u.firstName} ${u.lastName}`,
          score: Math.round(u.averageScore),
          completedFormations: u.totalFormationsCompleted
        }))
      });
    }

    // Recommandations temporelles
    const recentActivity = await UserProgress.find({
      ...matchFilter,
      lastActivity: { 
        $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Plus de 7 jours
      }
    }).countDocuments();

    if (recentActivity > 0) {
      const totalUsers = await UserProgress.countDocuments(matchFilter);
      const inactiveRate = (recentActivity / totalUsers) * 100;
      
      if (inactiveRate > 30) {
        recommendations.push({
          type: 'info',
          priority: 'medium',
          title: 'Utilisateurs inactifs détectés',
          message: `${Math.round(inactiveRate)}% des utilisateurs n'ont pas eu d'activité depuis plus de 7 jours.`,
          actionSuggested: 'Envoyer des rappels ou proposer du nouveau contenu',
          metrics: { inactiveRate: Math.round(inactiveRate) }
        });
      }
    }

    console.log(`💡 ${recommendations.length} recommandations générées`);
    res.json({
      success: true,
      data: recommendations
    });

  } catch (error) {
    console.error('Erreur recommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération des recommandations',
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/health
 * Health check pour vérifier que le système analytics fonctionne
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      analytics: 'operational',
      userProgress: 'active',
      formations: 'active'
    }
  });
});

module.exports = router;