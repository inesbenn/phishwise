// controllers/AnalyticsController.js
const Campaign = require('../models/Campaign');
const UserProgress = require('../models/UserProgress');
const Formation = require('../models/Formation');
const mongoose = require('mongoose');

class AnalyticsController {
    /**
     * GET /api/analytics/overview
     * Récupère les statistiques globales de toutes les formations et campagnes
     */
    static async getOverview(req, res) {
        try {
            console.log('📊 Récupération overview analytics...');

            // Statistiques globales des campagnes
            const campaignStats = await Campaign.aggregate([
                {
                    $group: {
                        _id: null,
                        totalCampaigns: { $sum: 1 },
                        activeCampaigns: {
                            $sum: { $cond: [{ $eq: ['$status', 'running'] }, 1, 0] }
                        },
                        totalTargets: { $sum: { $size: '$targets' } }
                    }
                }
            ]);

            // Statistiques des utilisateurs et progressions
            const userProgressStats = await UserProgress.aggregate([
                {
                    $group: {
                        _id: null,
                        totalUsers: { $sum: 1 },
                        activeUsers: {
                            $sum: { $cond: [{ $gt: ['$totalFormationsStarted', 0] }, 1, 0] }
                        },
                        completedUsers: {
                            $sum: { $cond: [{ $gt: ['$totalFormationsCompleted', 0] }, 1, 0] }
                        },
                        totalFormationsCompleted: { $sum: '$totalFormationsCompleted' },
                        totalBadgesEarned: { $sum: '$totalBadgesEarned' },
                        totalTimeSpent: { $sum: '$totalTimeSpent' },
                        averageScoreSum: { $sum: '$averageScore' },
                        usersWithScore: {
                            $sum: { $cond: [{ $gt: ['$averageScore', 0] }, 1, 0] }
                        }
                    }
                }
            ]);

            // Statistiques des formations disponibles
            const formationStats = await Formation.aggregate([
                {
                    $match: { isActive: true }
                },
                {
                    $group: {
                        _id: null,
                        totalFormations: { $sum: 1 },
                        totalModules: { $sum: { $size: '$modules' } }
                    }
                }
            ]);

            // Statistiques d'engagement récent (30 derniers jours)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const recentActivity = await UserProgress.aggregate([
                {
                    $match: {
                        lastActivity: { $gte: thirtyDaysAgo }
                    }
                },
                {
                    $group: {
                        _id: null,
                        activeUsersLast30Days: { $sum: 1 },
                        recentFormationsCompleted: {
                            $sum: {
                                $size: {
                                    $filter: {
                                        input: '$formations',
                                        cond: { $gte: ['$$this.completedAt', thirtyDaysAgo] }
                                    }
                                }
                            }
                        }
                    }
                }
            ]);

            // Compiler les résultats
            const campaignData = campaignStats[0] || { totalCampaigns: 0, activeCampaigns: 0, totalTargets: 0 };
            const userProgressData = userProgressStats[0] || { 
                totalUsers: 0, activeUsers: 0, completedUsers: 0, 
                totalFormationsCompleted: 0, totalBadgesEarned: 0, 
                totalTimeSpent: 0, averageScoreSum: 0, usersWithScore: 0 
            };
            const formationData = formationStats[0] || { totalFormations: 0, totalModules: 0 };
            const activityData = recentActivity[0] || { activeUsersLast30Days: 0, recentFormationsCompleted: 0 };

            const overview = {
                totalUsers: userProgressData.totalUsers,
                activeUsers: userProgressData.activeUsers,
                completedUsers: userProgressData.completedUsers,
                totalCampaigns: campaignData.totalCampaigns,
                activeCampaigns: campaignData.activeCampaigns,
                totalFormations: formationData.totalFormations,
                completedFormations: userProgressData.totalFormationsCompleted,
                averageScore: userProgressData.usersWithScore > 0 
                    ? Math.round(userProgressData.averageScoreSum / userProgressData.usersWithScore * 10) / 10
                    : 0,
                totalTimeSpent: Math.round(userProgressData.totalTimeSpent / 60), // Convertir en heures
                badgesEarned: userProgressData.totalBadgesEarned,
                
                // Métriques d'engagement
                engagement: {
                    activeUsersLast30Days: activityData.activeUsersLast30Days,
                    recentFormationsCompleted: activityData.recentFormationsCompleted,
                    engagementRate: userProgressData.totalUsers > 0 
                        ? Math.round((userProgressData.activeUsers / userProgressData.totalUsers) * 100)
                        : 0,
                    completionRate: userProgressData.activeUsers > 0 
                        ? Math.round((userProgressData.completedUsers / userProgressData.activeUsers) * 100)
                        : 0
                }
            };

            console.log('✅ Overview analytics calculé:', overview);
            res.status(200).json({
                success: true,
                data: overview
            });

        } catch (error) {
            console.error('❌ Erreur getOverview analytics:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération de l\'overview',
                error: error.message
            });
        }
    }

    /**
     * GET /api/analytics/campaigns
     * Récupère les statistiques détaillées de toutes les campagnes
     */
    static async getCampaigns(req, res) {
        try {
            console.log('📋 Récupération analytics des campagnes...');

            const campaigns = await Campaign.find({
                'step6.assignedFormations.0': { $exists: true }
            })
            .populate('step6.assignedFormations.formationId', 'title modules estimatedTime')
            .sort({ updatedAt: -1 });

            const campaignAnalytics = await Promise.all(
                campaigns.map(async (campaign) => {
                    // Statistiques des utilisateurs pour cette campagne
                    const userProgressStats = await UserProgress.aggregate([
                        {
                            $match: { campaignId: campaign._id }
                        },
                        {
                            $group: {
                                _id: null,
                                totalUsers: { $sum: 1 },
                                completedUsers: {
                                    $sum: { $cond: [{ $gt: ['$totalFormationsCompleted', 0] }, 1, 0] }
                                },
                                averageProgress: {
                                    $avg: {
                                        $cond: [
                                            { $gt: [{ $size: '$formations' }, 0] },
                                            {
                                                $avg: '$formations.overallProgress'
                                            },
                                            0
                                        ]
                                    }
                                },
                                averageScore: { $avg: '$averageScore' },
                                totalTimeSpent: { $sum: '$totalTimeSpent' },
                                totalBadges: { $sum: '$totalBadgesEarned' }
                            }
                        }
                    ]);

                    // Statistiques par formation dans cette campagne
                    const formationStats = await UserProgress.aggregate([
                        {
                            $match: { campaignId: campaign._id }
                        },
                        {
                            $unwind: '$formations'
                        },
                        {
                            $lookup: {
                                from: 'formations',
                                localField: 'formations.formationId',
                                foreignField: '_id',
                                as: 'formationInfo'
                            }
                        },
                        {
                            $unwind: '$formationInfo'
                        },
                        {
                            $group: {
                                _id: '$formations.formationId',
                                formationName: { $first: '$formationInfo.title' },
                                totalStarted: { $sum: 1 },
                                totalCompleted: {
                                    $sum: { $cond: [{ $eq: ['$formations.status', 'completed'] }, 1, 0] }
                                },
                                averageProgress: { $avg: '$formations.overallProgress' },
                                averageScore: {
                                    $avg: {
                                        $avg: {
                                            $map: {
                                                input: '$formations.modules',
                                                as: 'module',
                                                in: '$$module.bestScore'
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    ]);

                    const stats = userProgressStats[0] || {
                        totalUsers: 0, completedUsers: 0, averageProgress: 0,
                        averageScore: 0, totalTimeSpent: 0, totalBadges: 0
                    };

                    return {
                        id: campaign._id,
                        name: campaign.name,
                        status: campaign.status,
                        createdAt: campaign.createdAt,
                        updatedAt: campaign.updatedAt,
                        totalUsers: stats.totalUsers,
                        completedUsers: stats.completedUsers,
                        averageProgress: Math.round(stats.averageProgress || 0),
                        averageScore: Math.round((stats.averageScore || 0) * 10) / 10,
                        totalTimeSpent: Math.round(stats.totalTimeSpent / 60), // en heures
                        totalBadges: stats.totalBadges,
                        
                        // Formations assignées
                        formations: formationStats.map(f => ({
                            id: f._id,
                            name: f.formationName,
                            completion: Math.round((f.totalCompleted / f.totalStarted) * 100),
                            avgScore: Math.round((f.averageScore || 0) * 10) / 10,
                            totalStarted: f.totalStarted,
                            totalCompleted: f.totalCompleted
                        })),
                        
                        // Métriques de performance
                        completionRate: stats.totalUsers > 0 
                            ? Math.round((stats.completedUsers / stats.totalUsers) * 100)
                            : 0,
                        engagementLevel: stats.averageProgress > 75 ? 'high' :
                                       stats.averageProgress > 50 ? 'medium' : 'low'
                    };
                })
            );

            console.log(`✅ Analytics de ${campaignAnalytics.length} campagnes calculées`);
            res.status(200).json({
                success: true,
                data: campaignAnalytics
            });

        } catch (error) {
            console.error('❌ Erreur getCampaigns analytics:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des campagnes',
                error: error.message
            });
        }
    }

    /**
     * GET /api/analytics/users/progress
     * Récupère les détails de progression de tous les utilisateurs avec filtres
     */
    static async getUserProgress(req, res) {
        try {
            console.log('👥 Récupération progression utilisateurs...');

            const {
                campaignId,
                search,
                office,
                country,
                status,
                sortBy = 'averageScore',
                sortOrder = 'desc',
                page = 1,
                limit = 50
            } = req.query;

            // Construction du filtre de base
            let matchFilter = {};
            
            if (campaignId && campaignId !== 'all') {
                matchFilter.campaignId = new mongoose.Types.ObjectId(campaignId);
            }

            if (office) {
                matchFilter.office = { $regex: office, $options: 'i' };
            }

            if (country) {
                matchFilter.country = { $regex: country, $options: 'i' };
            }

            // Filtre par recherche textuelle
            if (search) {
                matchFilter.$or = [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { targetEmail: { $regex: search, $options: 'i' } },
                    { position: { $regex: search, $options: 'i' } }
                ];
            }

            // Pipeline d'agrégation
            const pipeline = [
                { $match: matchFilter }
            ];

            // Filtre par statut de progression
            if (status) {
                if (status === 'completed') {
                    pipeline.push({ $match: { totalFormationsCompleted: { $gt: 0 } } });
                } else if (status === 'in_progress') {
                    pipeline.push({
                        $match: {
                            totalFormationsStarted: { $gt: 0 },
                            totalFormationsCompleted: { $eq: 0 }
                        }
                    });
                } else if (status === 'not_started') {
                    pipeline.push({ $match: { totalFormationsStarted: { $eq: 0 } } });
                }
            }

            // Enrichissement avec les informations de campagne
            pipeline.push(
                {
                    $lookup: {
                        from: 'campaigns',
                        localField: 'campaignId',
                        foreignField: '_id',
                        as: 'campaignInfo'
                    }
                },
                {
                    $unwind: {
                        path: '$campaignInfo',
                        preserveNullAndEmptyArrays: true
                    }
                }
            );

            // Ajout de champs calculés
            pipeline.push({
                $addFields: {
                    completionRate: {
                        $cond: [
                            { $gt: ['$totalFormationsStarted', 0] },
                            { $divide: ['$totalFormationsCompleted', '$totalFormationsStarted'] },
                            0
                        ]
                    },
                    progressStatus: {
                        $cond: [
                            { $eq: ['$totalFormationsStarted', 0] },
                            'not_started',
                            {
                                $cond: [
                                    { $eq: ['$totalFormationsCompleted', '$totalFormationsStarted'] },
                                    'completed',
                                    'in_progress'
                                ]
                            }
                        ]
                    }
                }
            });

            // Tri
            const sortDirection = sortOrder === 'asc' ? 1 : -1;
            const sortField = {};
            sortField[sortBy] = sortDirection;
            pipeline.push({ $sort: sortField });

            // Pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);
            pipeline.push({ $skip: skip }, { $limit: parseInt(limit) });

            // Exécution de la requête
            const [users, totalCount] = await Promise.all([
                UserProgress.aggregate(pipeline),
                UserProgress.countDocuments(matchFilter)
            ]);

            // Enrichissement des données utilisateur avec détails des formations
            const enrichedUsers = await Promise.all(
                users.map(async (user) => {
                    // Récupérer les détails des formations avec leurs progrès
                    const formationDetails = await UserProgress.aggregate([
                        {
                            $match: { 
                                campaignId: user.campaignId, 
                                targetEmail: user.targetEmail 
                            }
                        },
                        {
                            $unwind: '$formations'
                        },
                        {
                            $lookup: {
                                from: 'formations',
                                localField: 'formations.formationId',
                                foreignField: '_id',
                                as: 'formationInfo'
                            }
                        },
                        {
                            $unwind: '$formationInfo'
                        },
                        {
                            $project: {
                                formationName: '$formationInfo.title',
                                status: '$formations.status',
                                progress: '$formations.overallProgress',
                                completedAt: '$formations.completedAt',
                                badgeEarned: '$formations.badgeEarned',
                                timeSpent: {
                                    $sum: '$formations.modules.timeSpent'
                                },
                                bestScore: {
                                    $avg: '$formations.modules.bestScore'
                                }
                            }
                        }
                    ]);

                    return {
                        ...user,
                        campaignName: user.campaignInfo?.name || 'Campagne supprimée',
                        formations: formationDetails,
                        totalTimeSpentMinutes: user.totalTimeSpent, // Garder en minutes pour l'interface
                        lastActivityFormatted: user.lastActivity,
                        completionRatePercentage: Math.round(user.completionRate * 100)
                    };
                })
            );

            console.log(`✅ ${enrichedUsers.length} utilisateurs récupérés (${totalCount} total)`);
            res.status(200).json({
                success: true,
                data: {
                    users: enrichedUsers,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(totalCount / parseInt(limit)),
                        totalItems: totalCount,
                        itemsPerPage: parseInt(limit)
                    },
                    summary: {
                        totalUsers: totalCount,
                        completedUsers: enrichedUsers.filter(u => u.progressStatus === 'completed').length,
                        inProgressUsers: enrichedUsers.filter(u => u.progressStatus === 'in_progress').length,
                        notStartedUsers: enrichedUsers.filter(u => u.progressStatus === 'not_started').length
                    }
                }
            });

        } catch (error) {
            console.error('❌ Erreur getUserProgress analytics:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des progrès utilisateurs',
                error: error.message
            });
        }
    }

    /**
     * GET /api/analytics/campaigns/:campaignId
     * Récupère les statistiques détaillées d'une campagne spécifique
     */
    static async getCampaignDetails(req, res) {
        try {
            const { campaignId } = req.params;
            console.log(`📊 Récupération détails campagne ${campaignId}...`);

            const campaign = await Campaign.findById(campaignId)
                .populate('step6.assignedFormations.formationId', 'title description modules estimatedTime');

            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campagne non trouvée'
                });
            }

            // Statistiques détaillées de la campagne
            const detailedStats = await UserProgress.aggregate([
                {
                    $match: { campaignId: new mongoose.Types.ObjectId(campaignId) }
                },
                {
                    $facet: {
                        overallStats: [
                            {
                                $group: {
                                    _id: null,
                                    totalUsers: { $sum: 1 },
                                    completedUsers: {
                                        $sum: { $cond: [{ $gt: ['$totalFormationsCompleted', 0] }, 1, 0] }
                                    },
                                    averageScore: { $avg: '$averageScore' },
                                    totalTimeSpent: { $sum: '$totalTimeSpent' },
                                    totalBadges: { $sum: '$totalBadgesEarned' }
                                }
                            }
                        ],
                        formationBreakdown: [
                            {
                                $unwind: '$formations'
                            },
                            {
                                $lookup: {
                                    from: 'formations',
                                    localField: 'formations.formationId',
                                    foreignField: '_id',
                                    as: 'formationInfo'
                                }
                            },
                            {
                                $unwind: '$formationInfo'
                            },
                            {
                                $group: {
                                    _id: '$formations.formationId',
                                    formationName: { $first: '$formationInfo.title' },
                                    totalStarted: { $sum: 1 },
                                    totalCompleted: {
                                        $sum: { $cond: [{ $eq: ['$formations.status', 'completed'] }, 1, 0] }
                                    },
                                    averageProgress: { $avg: '$formations.overallProgress' },
                                    averageScore: {
                                        $avg: {
                                            $avg: '$formations.modules.bestScore'
                                        }
                                    },
                                    totalTimeSpent: {
                                        $sum: { $sum: '$formations.modules.timeSpent' }
                                    }
                                }
                            }
                        ],
                        progressDistribution: [
                            {
                                $bucket: {
                                    groupBy: {
                                        $cond: [
                                            { $gt: ['$totalFormationsStarted', 0] },
                                            { $divide: ['$totalFormationsCompleted', '$totalFormationsStarted'] },
                                            0
                                        ]
                                    },
                                    boundaries: [0, 0.25, 0.5, 0.75, 1.0, 1.1],
                                    default: 'other',
                                    output: {
                                        count: { $sum: 1 },
                                        users: { $push: { email: '$targetEmail', name: { $concat: ['$firstName', ' ', '$lastName'] } } }
                                    }
                                }
                            }
                        ]
                    }
                }
            ]);

            const stats = detailedStats[0];
            const overall = stats.overallStats[0] || {};
            
            res.status(200).json({
                success: true,
                data: {
                    campaign: {
                        id: campaign._id,
                        name: campaign.name,
                        status: campaign.status,
                        createdAt: campaign.createdAt,
                        totalTargets: campaign.targets.length
                    },
                    stats: {
                        totalUsers: overall.totalUsers || 0,
                        completedUsers: overall.completedUsers || 0,
                        averageScore: Math.round((overall.averageScore || 0) * 10) / 10,
                        totalTimeSpent: Math.round((overall.totalTimeSpent || 0) / 60),
                        totalBadges: overall.totalBadges || 0,
                        completionRate: overall.totalUsers > 0 
                            ? Math.round((overall.completedUsers / overall.totalUsers) * 100)
                            : 0
                    },
                    formations: stats.formationBreakdown.map(f => ({
                        id: f._id,
                        name: f.formationName,
                        totalStarted: f.totalStarted,
                        totalCompleted: f.totalCompleted,
                        completionRate: Math.round((f.totalCompleted / f.totalStarted) * 100),
                        averageProgress: Math.round(f.averageProgress || 0),
                        averageScore: Math.round((f.averageScore || 0) * 10) / 10,
                        totalTimeSpent: Math.round(f.totalTimeSpent / 60)
                    })),
                    progressDistribution: stats.progressDistribution
                }
            });

        } catch (error) {
            console.error('❌ Erreur getCampaignDetails analytics:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des détails de campagne',
                error: error.message
            });
        }
    }

    /**
     * GET /api/analytics/progress-over-time
     * Récupère l'évolution des progrès dans le temps
     */
    static async getProgressOverTime(req, res) {
        try {
            console.log('📈 Récupération progression temporelle...');

            const { timeframe = '30d', campaignId } = req.query;
            
            // Calculer la date de début selon la période
            const now = new Date();
            let startDate;
            let groupFormat;
            
            switch (timeframe) {
                case '7d':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    groupFormat = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
                    break;
                case '30d':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    groupFormat = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
                    break;
                case '90d':
                    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                    groupFormat = { $dateToString: { format: "%Y-%U", date: "$createdAt" } }; // Par semaine
                    break;
                case '1y':
                    startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                    groupFormat = { $dateToString: { format: "%Y-%m", date: "$createdAt" } }; // Par mois
                    break;
                default:
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    groupFormat = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
            }

            // Filtre par campagne si spécifié
            let matchFilter = {
                createdAt: { $gte: startDate }
            };
            
            if (campaignId && campaignId !== 'all') {
                matchFilter.campaignId = new mongoose.Types.ObjectId(campaignId);
            }

            // Agrégation pour les formations complétées dans le temps
            const completionOverTime = await UserProgress.aggregate([
                { $match: matchFilter },
                { $unwind: '$formations' },
                {
                    $match: {
                        'formations.completedAt': { $gte: startDate, $lte: now }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { 
                                format: "%Y-%m-%d", 
                                date: "$formations.completedAt" 
                            }
                        },
                        completed: { $sum: 1 },
                        users: { $addToSet: '$targetEmail' }
                    }
                },
                {
                    $addFields: {
                        uniqueUsers: { $size: '$users' }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            // Agrégation pour les démarrages de formation
            const startOverTime = await UserProgress.aggregate([
                { $match: matchFilter },
                { $unwind: '$formations' },
                {
                    $match: {
                        'formations.startedAt': { $gte: startDate, $lte: now }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { 
                                format: "%Y-%m-%d", 
                                date: "$formations.startedAt" 
                            }
                        },
                        started: { $sum: 1 },
                        users: { $addToSet: '$targetEmail' }
                    }
                },
                {
                    $addFields: {
                        uniqueUsers: { $size: '$users' }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            // Combiner les données
            const dateMap = new Map();
            
            completionOverTime.forEach(item => {
                dateMap.set(item._id, {
                    date: item._id,
                    completed: item.completed,
                    completedUsers: item.uniqueUsers,
                    started: 0,
                    startedUsers: 0
                });
            });

            startOverTime.forEach(item => {
                if (dateMap.has(item._id)) {
                    dateMap.get(item._id).started = item.started;
                    dateMap.get(item._id).startedUsers = item.uniqueUsers;
                } else {
                    dateMap.set(item._id, {
                        date: item._id,
                        completed: 0,
                        completedUsers: 0,
                        started: item.started,
                        startedUsers: item.uniqueUsers
                    });
                }
            });

            const progressData = Array.from(dateMap.values()).sort((a, b) => 
                new Date(a.date) - new Date(b.date)
            );

            console.log(`✅ Données de progression temporelle récupérées (${progressData.length} points)`);
            res.status(200).json({
                success: true,
                data: progressData
            });

        } catch (error) {
            console.error('❌ Erreur getProgressOverTime analytics:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération de la progression temporelle',
                error: error.message
            });
        }
    }

    /**
     * GET /api/analytics/formations/performance
     * Récupère les statistiques de performance par formation
     */
    static async getFormationPerformance(req, res) {
        try {
            console.log('🎯 Récupération performance des formations...');

            const performanceStats = await UserProgress.aggregate([
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
                        category: { $first: '$formationInfo.category' },
                        totalStarted: { $sum: 1 },
                        totalCompleted: {
                            $sum: { $cond: [{ $eq: ['$formations.status', 'completed'] }, 1, 0] }
                        },
                        averageProgress: { $avg: '$formations.overallProgress' },
                        averageCompletionTime: {
                            $avg: {
                                $sum: '$formations.modules.timeSpent'
                            }
                        },
                        averageScore: {
                            $avg: {
                                $avg: '$formations.modules.bestScore'
                            }
                        },
                        badgesEarned: {
                            $sum: { $cond: ['$formations.badgeEarned', 1, 0] }
                        },
                        dropoffPoints: {
                            $push: {
                                $map: {
                                    input: '$formations.modules',
                                    as: 'module',
                                    in: {
                                        moduleId: '$module.moduleId',
                                        completed: '$module.completed'
                                    }
                                }
                            }
                        }
                    }
                },
                {
                    $addFields: {
                        completionRate: {
                            $divide: ['$totalCompleted', '$totalStarted']
                        },
                        badgeRate: {
                            $divide: ['$badgesEarned', '$totalStarted']
                        }
                    }
                },
                { $sort: { totalStarted: -1 } }
            ]);

            console.log(`✅ Performance de ${performanceStats.length} formations récupérée`);
            res.status(200).json({
                success: true,
                data: performanceStats.map(formation => ({
                    ...formation,
                    completionRate: Math.round(formation.completionRate * 100),
                    badgeRate: Math.round(formation.badgeRate * 100),
                    averageScore: Math.round((formation.averageScore || 0) * 10) / 10,
                    averageCompletionTime: Math.round(formation.averageCompletionTime / 60) // en heures
                }))
            });

        } catch (error) {
            console.error('❌ Erreur getFormationPerformance analytics:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération de la performance des formations',
                error: error.message
            });
        }
    }

    /**
     * POST /api/analytics/export
     * Exporte les données analytics dans différents formats
     */
    static async exportData(req, res) {
        try {
            const { format = 'csv', type = 'users', filters = {} } = req.body;
            console.log(`📊 Export des données analytics - Format: ${format}, Type: ${type}`);

            let data = [];
            let filename = '';

            switch (type) {
                case 'users':
                    const userProgressQuery = await AnalyticsController.buildUserProgressQuery(filters);
                    data = await UserProgress.aggregate(userProgressQuery);
                    filename = 'user-progress-export';
                    break;

                case 'campaigns':
                    data = await AnalyticsController.getCampaignExportData();
                    filename = 'campaigns-export';
                    break;

                case 'formations':
                    data = await AnalyticsController.getFormationExportData();
                    filename = 'formations-export';
                    break;

                default:
                    return res.status(400).json({
                        success: false,
                        message: 'Type d\'export non supporté'
                    });
            }

            // Gérer différents formats d'export
            if (format === 'csv') {
                const csv = AnalyticsController.convertToCSV(data);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
                res.send(csv);
            } else if (format === 'json') {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
                res.json(data);
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Format d\'export non supporté'
                });
            }

        } catch (error) {
            console.error('❌ Erreur export analytics:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'export des données',
                error: error.message
            });
        }
    }

    // Méthodes utilitaires
    static buildUserProgressQuery(filters) {
        const pipeline = [];
        
        // Ajouter les filtres selon les paramètres
        if (filters.campaignId) {
            pipeline.push({ $match: { campaignId: new mongoose.Types.ObjectId(filters.campaignId) } });
        }
        
        if (filters.dateRange) {
            pipeline.push({
                $match: {
                    createdAt: {
                        $gte: new Date(filters.dateRange.start),
                        $lte: new Date(filters.dateRange.end)
                    }
                }
            });
        }

        return pipeline;
    }

    static async getCampaignExportData() {
        return await Campaign.aggregate([
            {
                $lookup: {
                    from: 'userprogresses',
                    localField: '_id',
                    foreignField: 'campaignId',
                    as: 'userProgress'
                }
            },
            {
                $project: {
                    name: 1,
                    status: 1,
                    createdAt: 1,
                    totalUsers: { $size: '$userProgress' },
                    completedUsers: {
                        $size: {
                            $filter: {
                                input: '$userProgress',
                                cond: { $gt: ['$this.totalFormationsCompleted', 0] }
                            }
                        }
                    }
                }
            }
        ]);
    }

    static async getFormationExportData() {
        return await Formation.aggregate([
            {
                $lookup: {
                    from: 'userprogresses',
                    let: { formationId: '$_id' },
                    pipeline: [
                        { $unwind: '$formations' },
                        { $match: { $expr: { $eq: ['$formations.formationId', '$formationId'] } } }
                    ],
                    as: 'progress'
                }
            },
            {
                $project: {
                    title: 1,
                    category: 1,
                    estimatedTime: 1,
                    totalStarted: { $size: '$progress' },
                    totalCompleted: {
                        $size: {
                            $filter: {
                                input: '$progress',
                                cond: { $eq: ['$this.formations.status', 'completed'] }
                            }
                        }
                    }
                }
            }
        ]);
    }

    static convertToCSV(data) {
        if (!data.length) return '';

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => {
                    const value = row[header];
                    return typeof value === 'string' ? `"${value}"` : value;
                }).join(',')
            )
        ].join('\n');

        return csvContent;
    }
}

module.exports = AnalyticsController;