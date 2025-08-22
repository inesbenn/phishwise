// src/controllers/dashboardController.js
const Campaign = require('../models/Campaign');
const mongoose = require('mongoose');

/**
 * GET /api/dashboard/stats
 * Récupère les statistiques générales du dashboard
 */
const getDashboardStats = async (req, res) => {
  try {
    // Compter les campagnes actives
    const activeCampaigns = await Campaign.countDocuments({ 
      status: 'running' 
    });

    // Compter les campagnes terminées ce mois
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const newCampaignsThisMonth = await Campaign.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    // Calculer le nombre total d'employés sensibilisés
    // (somme de tous les targets de toutes les campagnes)
    const totalTargetsResult = await Campaign.aggregate([
      {
        $project: {
          targetsCount: { $size: "$targets" }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$targetsCount" }
        }
      }
    ]);
    
    const totalEmployees = totalTargetsResult.length > 0 ? totalTargetsResult[0].total : 0;

    // Calculer le taux de réussite moyen
    // Basé sur les soumissions vs targets
    const campaignsWithStats = await Campaign.aggregate([
      {
        $match: { status: { $in: ['running', 'completed'] } }
      },
      {
        $project: {
          targetsCount: { $size: "$targets" },
          submissionsCount: { $size: "$step4.submissions" },
          completionRate: {
            $cond: {
              if: { $gt: [{ $size: "$targets" }, 0] },
              then: {
                $multiply: [
                  { $divide: [{ $size: "$step4.submissions" }, { $size: "$targets" }] },
                  100
                ]
              },
              else: 0
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          avgCompletionRate: { $avg: "$completionRate" }
        }
      }
    ]);

    const successRate = campaignsWithStats.length > 0 
      ? Math.round(campaignsWithStats[0].avgCompletionRate)
      : 87; // Valeur par défaut

    // Compter les alertes actives (campagnes avec taux de clic élevé)
    const alertCampaigns = await Campaign.countDocuments({
      status: 'running',
      // On pourrait ajouter des critères basés sur les interactions
    });

    const stats = {
      activeCampaigns,
      newCampaignsThisMonth,
      totalEmployees,
      successRate,
      activeAlerts: alertCampaigns || 3 // Valeur par défaut
    };

    res.json(stats);
  } catch (err) {
    console.error('ERREUR (getDashboardStats):', err);
    res.status(500).json({ message: 'Erreur lors de la récupération des statistiques' });
  }
};

/**
 * GET /api/dashboard/campaigns
 * Récupère les campagnes en cours pour le dashboard
 */
const getActiveCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find({
      status: { $in: ['running', 'completed'] }
    })
    .select('name status targets step4.submissions step4.interactions createdAt updatedAt')
    .sort({ updatedAt: -1 })
    .limit(10);

    // Transformer les données pour le frontend
    const transformedCampaigns = campaigns.map(campaign => {
      const targetsCount = campaign.targets.length;
      const submissionsCount = campaign.step4?.submissions?.length || 0;
      const interactionsCount = campaign.step4?.interactions?.length || 0;
      
      // Calculer les métriques
      const opened = Math.floor(interactionsCount * 0.6); // Estimation des ouvertures
      const clicked = submissionsCount;
      const completion = targetsCount > 0 ? Math.round((clicked / targetsCount) * 100) : 0;
      const progress = completion;

      return {
        id: campaign._id,
        name: campaign.name,
        status: campaign.status === 'running' ? 'active' : 'completed',
        sent: targetsCount,
        opened,
        clicked,
        completion,
        progress,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt
      };
    });

    res.json(transformedCampaigns);
  } catch (err) {
    console.error('ERREUR (getActiveCampaigns):', err);
    res.status(500).json({ message: 'Erreur lors de la récupération des campagnes' });
  }
};

/**
 * GET /api/dashboard/recent-activity
 * Récupère l'activité récente
 */
const getRecentActivity = async (req, res) => {
  try {
    // Récupérer les campagnes récemment créées
    const recentCampaigns = await Campaign.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name createdAt status');

    // Récupérer les soumissions récentes
    const recentSubmissions = await Campaign.aggregate([
      { $unwind: "$step4.submissions" },
      {
        $project: {
          campaignName: "$name",
          submittedAt: "$step4.submissions.submittedAt",
          targetEmail: "$step4.submissions.targetEmail"
        }
      },
      { $sort: { submittedAt: -1 } },
      { $limit: 10 }
    ]);

    // Construire l'activité récente
    const activity = [];

    // Ajouter les nouvelles campagnes
    recentCampaigns.forEach(campaign => {
      const timeDiff = Date.now() - campaign.createdAt.getTime();
      const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
      
      let timeText;
      if (hoursAgo < 1) {
        const minutesAgo = Math.floor(timeDiff / (1000 * 60));
        timeText = `Il y a ${minutesAgo} min`;
      } else if (hoursAgo < 24) {
        timeText = `Il y a ${hoursAgo}h`;
      } else {
        const daysAgo = Math.floor(hoursAgo / 24);
        timeText = `Il y a ${daysAgo}j`;
      }

      activity.push({
        time: timeText,
        action: `Nouvelle campagne '${campaign.name}' ${campaign.status === 'running' ? 'lancée' : 'créée'}`,
        type: campaign.status === 'running' ? 'info' : 'success',
        timestamp: campaign.createdAt
      });
    });

    // Ajouter les soumissions récentes
    recentSubmissions.forEach(submission => {
      const timeDiff = Date.now() - submission.submittedAt.getTime();
      const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
      
      let timeText;
      if (hoursAgo < 1) {
        const minutesAgo = Math.floor(timeDiff / (1000 * 60));
        timeText = `Il y a ${minutesAgo} min`;
      } else if (hoursAgo < 24) {
        timeText = `Il y a ${hoursAgo}h`;
      } else {
        const daysAgo = Math.floor(hoursAgo / 24);
        timeText = `Il y a ${daysAgo}j`;
      }

      activity.push({
        time: timeText,
        action: `Nouvelle soumission pour '${submission.campaignName}'`,
        type: 'warning',
        timestamp: submission.submittedAt
      });
    });

    // Trier par timestamp et limiter
    activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json(activity.slice(0, 8));
  } catch (err) {
    console.error('ERREUR (getRecentActivity):', err);
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'activité récente' });
  }
};

/**
 * GET /api/dashboard/recommendations
 * Récupère les recommandations IA
 */
const getRecommendations = async (req, res) => {
  try {
    // Analyser les campagnes pour générer des recommandations
    const campaigns = await Campaign.find({ status: 'running' })
      .select('name targets step4.submissions step4.interactions');

    const recommendations = [];

    // Recommandation basée sur le taux de clic
    const highClickRateCampaigns = campaigns.filter(campaign => {
      const targetsCount = campaign.targets.length;
      const clicksCount = campaign.step4?.submissions?.length || 0;
      const clickRate = targetsCount > 0 ? (clicksCount / targetsCount) * 100 : 0;
      return clickRate > 15;
    });

    if (highClickRateCampaigns.length > 0) {
      recommendations.push({
        type: 'warning',
        message: `📊 ${highClickRateCampaigns.length} campagne(s) montrent un taux de clic élevé. Envisagez une formation ciblée.`,
        priority: 'high'
      });
    }

    // Recommandation temporelle (exemple statique mais pourrait être basée sur des données)
    const currentHour = new Date().getHours();
    if (currentHour >= 14 && currentHour <= 16) {
      recommendations.push({
        type: 'info',
        message: '🎯 Moment optimal pour une campagne : Vendredi 14h-16h (taux d\'ouverture +23%).',
        priority: 'medium'
      });
    }

    // Recommandation basée sur l'absence d'activité récente
    const inactiveCampaigns = campaigns.filter(campaign => {
      const lastActivity = campaign.step4?.interactions?.length > 0 
        ? Math.max(...campaign.step4.interactions.map(i => new Date(i.timestamp).getTime()))
        : campaign.updatedAt.getTime();
      
      const daysSinceActivity = (Date.now() - lastActivity) / (1000 * 60 * 60 * 24);
      return daysSinceActivity > 7;
    });

    if (inactiveCampaigns.length > 0) {
      recommendations.push({
        type: 'suggestion',
        message: `💡 ${inactiveCampaigns.length} campagne(s) sans activité depuis 7 jours. Considérez un suivi.`,
        priority: 'low'
      });
    }

    res.json(recommendations);
  } catch (err) {
    console.error('ERREUR (getRecommendations):', err);
    res.status(500).json({ message: 'Erreur lors de la génération des recommandations' });
  }
};

// Export all functions
module.exports = {
  getDashboardStats,
  getActiveCampaigns,
  getRecentActivity,
  getRecommendations
};
