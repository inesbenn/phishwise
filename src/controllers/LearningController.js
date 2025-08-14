// controllers/LearningController.js
const Formation = require('../models/Formation');
const UserProgress = require('../models/UserProgress');
const Campaign = require('../models/Campaign');

class LearningController {
    // Obtenir toutes les formations
    static async getAllFormations(req, res) {
        try {
            const formations = await Formation.find({ isActive: true })
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 });
            
            res.status(200).json({
                success: true,
                data: formations,
                count: formations.length
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des formations',
                error: error.message
            });
        }
    }

    // Créer une nouvelle formation
    static async createFormation(req, res) {
        try {
            const formation = new Formation({
                ...req.body,
                createdBy: req.user.id
            });
            
            await formation.save();
            
            res.status(201).json({
                success: true,
                data: formation,
                message: 'Formation créée avec succès'
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: 'Erreur lors de la création de la formation',
                error: error.message
            });
        }
    }

    // Mettre à jour une formation
    static async updateFormation(req, res) {
        try {
            const formation = await Formation.findByIdAndUpdate(
                req.params.id,
                req.body,
                { new: true, runValidators: true }
            );
            
            if (!formation) {
                return res.status(404).json({
                    success: false,
                    message: 'Formation non trouvée'
                });
            }
            
            res.status(200).json({
                success: true,
                data: formation,
                message: 'Formation mise à jour avec succès'
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: 'Erreur lors de la mise à jour',
                error: error.message
            });
        }
    }

    // Supprimer une formation
    static async deleteFormation(req, res) {
        try {
            const formation = await Formation.findByIdAndDelete(req.params.id);
            
            if (!formation) {
                return res.status(404).json({
                    success: false,
                    message: 'Formation non trouvée'
                });
            }
            
            res.status(200).json({
                success: true,
                message: 'Formation supprimée avec succès'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la suppression',
                error: error.message
            });
        }
    }

    // Obtenir une formation spécifique
    static async getFormation(req, res) {
        try {
            const formation = await Formation.findById(req.params.id)
                .populate('createdBy', 'name email');
            
            if (!formation) {
                return res.status(404).json({
                    success: false,
                    message: 'Formation non trouvée'
                });
            }
            
            res.status(200).json({
                success: true,
                data: formation
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération',
                error: error.message
            });
        }
    }

    // Assigner des formations à une campagne
    static async assignFormationsToCampaign(req, res) {
        try {
            const { campaignId } = req.params;
            const { formationIds, mandatory = true, dueDate } = req.body;
            
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campagne non trouvée'
                });
            }

            // Vérifier que les formations existent
            const formations = await Formation.find({ 
                '_id': { $in: formationIds },
                isActive: true
            });

            if (formations.length !== formationIds.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Une ou plusieurs formations sont invalides'
                });
            }

            // Créer les assignations
            const assignedFormations = formationIds.map((formationId, index) => ({
                formationId,
                mandatory,
                dueDate,
                order: index
            }));

            // Mettre à jour la campagne
            campaign.step6 = {
                ...campaign.step6,
                assignedFormations,
                isConfigured: true,
                configuredAt: new Date()
            };

            await campaign.save();

            res.status(200).json({
                success: true,
                data: campaign.step6,
                message: 'Formations assignées avec succès'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'assignation',
                error: error.message
            });
        }
    }

    // Obtenir les formations d'une campagne pour un utilisateur
    static async getCampaignFormations(req, res) {
        try {
            const { campaignId, targetEmail } = req.params;
            
            const campaign = await Campaign.findById(campaignId)
                .populate('step6.assignedFormations.formationId');
                
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campagne non trouvée'
                });
            }

            // Vérifier que l'utilisateur fait partie des targets
            const target = campaign.targets.find(t => t.email === targetEmail);
            if (!target) {
                return res.status(403).json({
                    success: false,
                    message: 'Accès non autorisé'
                });
            }

            // Obtenir le progrès de l'utilisateur
            let userProgress = await UserProgress.findOne({
                campaignId,
                targetEmail
            });

            // Si pas de progrès, en créer un
            if (!userProgress) {
                userProgress = new UserProgress({
                    campaignId,
                    targetEmail,
                    targetId: target._id,
                    firstName: target.firstName,
                    lastName: target.lastName,
                    position: target.position,
                    country: target.country,
                    office: target.office
                });
                await userProgress.save();
            }

            // Préparer les données de réponse
            const formationsData = campaign.step6.assignedFormations
                .map(af => af.formationId)
                .filter(f => f) // Filtrer les formations supprimées
                .map(formation => {
                    const progress = userProgress.formations.find(
                        fp => fp.formationId.toString() === formation._id.toString()
                    );
                    
                    return {
                        ...formation.toObject(),
                        progress: progress ? {
                            status: progress.status,
                            overallProgress: progress.overallProgress,
                            completedAt: progress.completedAt,
                            badgeEarned: progress.badgeEarned
                        } : {
                            status: 'not_started',
                            overallProgress: 0,
                            completedAt: null,
                            badgeEarned: false
                        }
                    };
                });

            res.status(200).json({
                success: true,
                data: {
                    formations: formationsData,
                    user: {
                        firstName: target.firstName,
                        lastName: target.lastName,
                        email: target.email,
                        position: target.position
                    },
                    overallStats: {
                        totalFormations: formationsData.length,
                        completedFormations: userProgress.totalFormationsCompleted,
                        totalBadges: userProgress.totalBadgesEarned,
                        totalTimeSpent: userProgress.totalTimeSpent,
                        averageScore: userProgress.averageScore
                    }
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des formations',
                error: error.message
            });
        }
    }

    // Démarrer une formation
    static async startFormation(req, res) {
        try {
            const { campaignId, targetEmail, formationId } = req.body;

            let userProgress = await UserProgress.findOne({
                campaignId,
                targetEmail
            });

            if (!userProgress) {
                return res.status(404).json({
                    success: false,
                    message: 'Utilisateur non trouvé'
                });
            }

            // Vérifier si la formation est déjà commencée
            let formationProgress = userProgress.formations.find(
                fp => fp.formationId.toString() === formationId
            );

            if (!formationProgress) {
                const formation = await Formation.findById(formationId);
                if (!formation) {
                    return res.status(404).json({
                        success: false,
                        message: 'Formation non trouvée'
                    });
                }

                formationProgress = {
                    formationId: formationId,
                    status: 'in_progress',
                    modules: formation.modules.map(module => ({
                        moduleId: module.id,
                        completed: false,
                        attempts: [],
                        timeSpent: 0
                    }))
                };

                userProgress.formations.push(formationProgress);
                userProgress.totalFormationsStarted += 1;
            } else {
                formationProgress.status = 'in_progress';
            }

            userProgress.lastActivity = new Date();
            await userProgress.save();

            res.status(200).json({
                success: true,
                data: formationProgress,
                message: 'Formation démarrée avec succès'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erreur lors du démarrage de la formation',
                error: error.message
            });
        }
    }

    // Soumettre une réponse de module
    static async submitModuleProgress(req, res) {
        try {
            const { campaignId, targetEmail, formationId, moduleId, answers, timeSpent, score } = req.body;

            const userProgress = await UserProgress.findOne({
                campaignId,
                targetEmail
            });

            if (!userProgress) {
                return res.status(404).json({
                    success: false,
                    message: 'Utilisateur non trouvé'
                });
            }

            const formationProgress = userProgress.formations.find(
                fp => fp.formationId.toString() === formationId
            );

            if (!formationProgress) {
                return res.status(404).json({
                    success: false,
                    message: 'Formation non trouvée'
                });
            }

            const moduleProgress = formationProgress.modules.find(
                mp => mp.moduleId === parseInt(moduleId)
            );

            if (!moduleProgress) {
                return res.status(404).json({
                    success: false,
                    message: 'Module non trouvé'
                });
            }

            // Ajouter la tentative
            const attempt = {
                answers,
                timeSpent: timeSpent || 0,
                score: score || 0,
                passed: score ? score >= 70 : true // Seuil par défaut de 70%
            };

            moduleProgress.attempts.push(attempt);
            moduleProgress.timeSpent += timeSpent || 0;
            
            if (attempt.passed) {
                moduleProgress.completed = true;
                moduleProgress.completedAt = new Date();
            }

            // Mettre à jour le meilleur score
            if (score && (score > moduleProgress.bestScore || !moduleProgress.bestScore)) {
                moduleProgress.bestScore = score;
            }

            // Calculer le progrès global de la formation
            const completedModules = formationProgress.modules.filter(m => m.completed).length;
            formationProgress.overallProgress = Math.round(
                (completedModules / formationProgress.modules.length) * 100
            );

            // Vérifier si la formation est terminée
            if (formationProgress.overallProgress === 100) {
                formationProgress.status = 'completed';
                formationProgress.completedAt = new Date();
                
                // Attribuer le badge si nécessaire
                const formation = await Formation.findById(formationId);
                if (formation && formation.badge && !formationProgress.badgeEarned) {
                    formationProgress.badgeEarned = true;
                    formationProgress.badgeEarnedAt = new Date();
                    userProgress.totalBadgesEarned += 1;
                }
                
                userProgress.totalFormationsCompleted += 1;
            }

            formationProgress.lastActivity = new Date();
            userProgress.lastActivity = new Date();
            userProgress.totalTimeSpent += timeSpent || 0;

            // Recalculer le score moyen
            const allScores = userProgress.formations.flatMap(f => 
                f.modules.flatMap(m => 
                    m.attempts.filter(a => a.score > 0).map(a => a.score)
                )
            );
            userProgress.averageScore = allScores.length > 0 
                ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
                : 0;

            await userProgress.save();

            res.status(200).json({
                success: true,
                data: {
                    moduleProgress,
                    formationProgress: formationProgress.overallProgress,
                    badgeEarned: formationProgress.badgeEarned && formationProgress.badgeEarnedAt.getTime() === new Date(formationProgress.badgeEarnedAt).getTime()
                },
                message: 'Progrès enregistré avec succès'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'enregistrement du progrès',
                error: error.message
            });
        }
    }

    // Obtenir les statistiques d'une campagne
    static async getCampaignStats(req, res) {
        try {
            const { campaignId } = req.params;
            
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campagne non trouvée'
                });
            }

            const userProgresses = await UserProgress.find({ campaignId })
                .populate('formations.formationId', 'title badge');

            // Calculer les statistiques
            const stats = {
                totalUsers: campaign.targets.length,
                usersStarted: userProgresses.filter(up => up.totalFormationsStarted > 0).length,
                usersCompleted: userProgresses.filter(up => up.totalFormationsCompleted > 0).length,
                totalBadgesEarned: userProgresses.reduce((sum, up) => sum + up.totalBadgesEarned, 0),
                averageProgress: userProgresses.length > 0 
                    ? Math.round(userProgresses.reduce((sum, up) => {
                        const userAvgProgress = up.formations.length > 0 
                            ? up.formations.reduce((s, f) => s + f.overallProgress, 0) / up.formations.length
                            : 0;
                        return sum + userAvgProgress;
                    }, 0) / userProgresses.length)
                    : 0,
                averageScore: userProgresses.length > 0
                    ? Math.round(userProgresses.reduce((sum, up) => sum + up.averageScore, 0) / userProgresses.length)
                    : 0,
                totalTimeSpent: userProgresses.reduce((sum, up) => sum + up.totalTimeSpent, 0),
                
                // Détails par utilisateur
                userDetails: userProgresses.map(up => ({
                    firstName: up.firstName,
                    lastName: up.lastName,
                    email: up.targetEmail,
                    position: up.position,
                    country: up.country,
                    office: up.office,
                    totalFormationsStarted: up.totalFormationsStarted,
                    totalFormationsCompleted: up.totalFormationsCompleted,
                    totalBadgesEarned: up.totalBadgesEarned,
                    averageScore: up.averageScore,
                    totalTimeSpent: up.totalTimeSpent,
                    lastActivity: up.lastActivity,
                    formations: up.formations.map(f => ({
                        formationId: f.formationId._id,
                        formationTitle: f.formationId.title,
                        status: f.status,
                        overallProgress: f.overallProgress,
                        completedAt: f.completedAt,
                        badgeEarned: f.badgeEarned,
                        timeSpent: f.modules.reduce((sum, m) => sum + m.timeSpent, 0)
                    }))
                }))
            };

            res.status(200).json({
                success: true,
                data: stats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des statistiques',
                error: error.message
            });
        }
    }
}

module.exports = LearningController;