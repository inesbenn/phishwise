// services/EmailSchedulerService.js
const cron = require('node-cron');
const Campaign = require('../models/Campaign');
const EmailController = require('../controllers/EmailController');

class EmailSchedulerService {
    constructor() {
        this.scheduledTasks = new Map(); // Stockage des tâches planifiées
        this.initializeService();
    }

    /**
     * Initialise le service de planification
     */
    initializeService() {
        console.log('🕒 Initialisation du service de planification des emails...');
        
        // Vérifier les campagnes programmées au démarrage
        this.restoreScheduledCampaigns();
        
        // Vérifier toutes les minutes s'il y a des campagnes à envoyer
        this.startPeriodicCheck();
        
        console.log('✅ Service de planification initialisé');
    }

    /**
     * Planifie l'envoi d'une campagne à une date/heure spécifique
     * @param {string} campaignId - ID de la campagne
     * @param {Date} scheduledDate - Date et heure programmées
     * @returns {Promise<Object>} Résultat de la planification
     */
    async scheduleCampaignSending(campaignId, scheduledDate) {
        try {
            const now = new Date();
            const scheduleTime = new Date(scheduledDate);

            // Validation de la date
            if (scheduleTime <= now) {
                throw new Error('La date programmée doit être dans le futur');
            }

            // Vérifier que la campagne existe
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                throw new Error('Campagne introuvable');
            }

            // Mettre à jour la campagne avec la date programmée
            campaign.scheduledSendDate = scheduleTime;
            campaign.status = 'scheduled';
            await campaign.save();

            // Programmer la tâche
            const taskKey = this.scheduleTask(campaignId, scheduleTime);

            console.log(`📅 Campagne ${campaignId} programmée pour le ${scheduleTime.toLocaleString('fr-FR')}`);

            return {
                success: true,
                message: 'Campagne programmée avec succès',
                campaignId,
                scheduledDate: scheduleTime,
                taskKey
            };

        } catch (error) {
            console.error('❌ Erreur lors de la planification:', error);
            throw error;
        }
    }

    /**
     * Programme une tâche cron pour une campagne
     * @param {string} campaignId - ID de la campagne
     * @param {Date} scheduledDate - Date programmée
     * @returns {string} Clé de la tâche
     */
    scheduleTask(campaignId, scheduledDate) {
        const taskKey = `campaign_${campaignId}_${scheduledDate.getTime()}`;
        
        // Créer l'expression cron basée sur la date programmée
        const minute = scheduledDate.getMinutes();
        const hour = scheduledDate.getHours();
        const day = scheduledDate.getDate();
        const month = scheduledDate.getMonth() + 1; // Les mois en JS commencent à 0
        const cronExpression = `${minute} ${hour} ${day} ${month} *`;

        console.log(`⏰ Création tâche cron: ${cronExpression} pour campagne ${campaignId}`);

        // Programmer la tâche
        const task = cron.schedule(cronExpression, async () => {
            console.log(`🚀 Déclenchement automatique de la campagne ${campaignId}`);
            await this.executeCampaignSending(campaignId);
            
            // Nettoyer la tâche après exécution
            this.cleanupTask(taskKey);
        }, {
            scheduled: true,
            timezone: process.env.TIMEZONE || 'Europe/Paris'
        });

        // Stocker la référence de la tâche
        this.scheduledTasks.set(taskKey, {
            task,
            campaignId,
            scheduledDate,
            createdAt: new Date()
        });

        return taskKey;
    }

    /**
     * Démarre la vérification périodique des campagnes à envoyer
     */
    startPeriodicCheck() {
        // Vérifier toutes les minutes
        cron.schedule('* * * * *', async () => {
            await this.checkPendingCampaigns();
        }, {
            scheduled: true,
            timezone: process.env.TIMEZONE || 'Europe/Paris'
        });

        console.log('⏱️ Vérification périodique des campagnes programmées activée');
    }

    /**
     * Vérifie les campagnes programmées qui doivent être envoyées maintenant
     */
    async checkPendingCampaigns() {
        try {
            const now = new Date();
            
            // Rechercher les campagnes programmées dont l'heure est dépassée
            const campaignsToSend = await Campaign.find({
                status: 'scheduled',
                scheduledSendDate: { $lte: now }
            });

            if (campaignsToSend.length > 0) {
                console.log(`📨 ${campaignsToSend.length} campagne(s) à envoyer maintenant`);
                
                for (const campaign of campaignsToSend) {
                    await this.executeCampaignSending(campaign._id.toString());
                }
            }

        } catch (error) {
            console.error('❌ Erreur lors de la vérification périodique:', error);
        }
    }

    /**
     * Restaure les tâches programmées au démarrage du serveur
     */
    async restoreScheduledCampaigns() {
        try {
            const now = new Date();
            
            // Trouver toutes les campagnes programmées dans le futur
            const scheduledCampaigns = await Campaign.find({
                status: 'scheduled',
                scheduledSendDate: { $gt: now }
            });

            console.log(`🔄 Restauration de ${scheduledCampaigns.length} campagne(s) programmée(s)`);

            for (const campaign of scheduledCampaigns) {
                this.scheduleTask(campaign._id.toString(), campaign.scheduledSendDate);
            }

        } catch (error) {
            console.error('❌ Erreur lors de la restauration des tâches:', error);
        }
    }

    /**
     * Exécute l'envoi d'une campagne
     * @param {string} campaignId - ID de la campagne
     */
    async executeCampaignSending(campaignId) {
        try {
            console.log(`📤 Début de l'envoi de la campagne ${campaignId}`);

            // Mettre à jour le statut avant l'envoi
            await Campaign.findByIdAndUpdate(campaignId, {
                status: 'sending',
                actualSendStartTime: new Date()
            });

            // Créer un objet de requête simulé pour le contrôleur
            const mockReq = {
                params: { campaignId },
                body: {} // Envoyer à toutes les cibles
            };

            const mockRes = {
                status: (code) => ({
                    json: (data) => {
                        console.log(`📊 Résultat envoi campagne ${campaignId}:`, data);
                        return data;
                    }
                })
            };

            // Appeler le contrôleur d'envoi d'emails
            const emailController = require('../controllers/EmailController');
            const result = await emailController.sendCampaignEmail(mockReq, mockRes);

            // Mettre à jour le statut final
            await Campaign.findByIdAndUpdate(campaignId, {
                status: 'sent',
                actualSendEndTime: new Date(),
                lastSendResult: result
            });

            console.log(`✅ Campagne ${campaignId} envoyée avec succès`);

        } catch (error) {
            console.error(`❌ Erreur lors de l'envoi de la campagne ${campaignId}:`, error);

            // Marquer la campagne comme échouée
            await Campaign.findByIdAndUpdate(campaignId, {
                status: 'failed',
                lastSendError: error.message,
                failedAt: new Date()
            }).catch(updateError => {
                console.error('❌ Erreur lors de la mise à jour du statut:', updateError);
            });
        }
    }

    /**
     * Annule une campagne programmée
     * @param {string} campaignId - ID de la campagne
     * @returns {Promise<Object>} Résultat de l'annulation
     */
    async cancelScheduledCampaign(campaignId) {
        try {
            // Trouver et supprimer les tâches associées
            const tasksToRemove = [];
            for (const [taskKey, taskInfo] of this.scheduledTasks.entries()) {
                if (taskInfo.campaignId === campaignId) {
                    tasksToRemove.push(taskKey);
                }
            }

            // Supprimer les tâches
            for (const taskKey of tasksToRemove) {
                this.cleanupTask(taskKey);
            }

            // Mettre à jour le statut de la campagne
            await Campaign.findByIdAndUpdate(campaignId, {
                status: 'draft',
                scheduledSendDate: null,
                cancelledAt: new Date()
            });

            console.log(`🚫 Campagne ${campaignId} annulée`);

            return {
                success: true,
                message: 'Campagne annulée avec succès',
                cancelledTasks: tasksToRemove.length
            };

        } catch (error) {
            console.error('❌ Erreur lors de l\'annulation:', error);
            throw error;
        }
    }

    /**
     * Nettoie une tâche terminée
     * @param {string} taskKey - Clé de la tâche
     */
    cleanupTask(taskKey) {
        const taskInfo = this.scheduledTasks.get(taskKey);
        if (taskInfo) {
            taskInfo.task.stop();
            taskInfo.task.destroy();
            this.scheduledTasks.delete(taskKey);
            console.log(`🧹 Tâche ${taskKey} nettoyée`);
        }
    }

    /**
     * Reprogramme une campagne avec une nouvelle date
     * @param {string} campaignId - ID de la campagne
     * @param {Date} newScheduledDate - Nouvelle date programmée
     * @returns {Promise<Object>} Résultat de la reprogrammation
     */
    async rescheduleCampaign(campaignId, newScheduledDate) {
        try {
            // Annuler l'ancienne programmation
            await this.cancelScheduledCampaign(campaignId);
            
            // Programmer avec la nouvelle date
            return await this.scheduleCampaignSending(campaignId, newScheduledDate);

        } catch (error) {
            console.error('❌ Erreur lors de la reprogrammation:', error);
            throw error;
        }
    }

    /**
     * Obtient les informations sur les campagnes programmées
     * @returns {Array} Liste des campagnes programmées
     */
    getScheduledCampaigns() {
        const scheduled = [];
        for (const [taskKey, taskInfo] of this.scheduledTasks.entries()) {
            scheduled.push({
                taskKey,
                campaignId: taskInfo.campaignId,
                scheduledDate: taskInfo.scheduledDate,
                createdAt: taskInfo.createdAt,
                timeUntilExecution: taskInfo.scheduledDate.getTime() - Date.now()
            });
        }
        return scheduled;
    }

    /**
     * Obtient les statistiques du service de planification
     * @returns {Object} Statistiques
     */
    getServiceStats() {
        return {
            totalScheduledTasks: this.scheduledTasks.size,
            scheduledCampaigns: this.getScheduledCampaigns(),
            serviceUptime: process.uptime(),
            timezone: process.env.TIMEZONE || 'Europe/Paris'
        };
    }
}

module.exports = new EmailSchedulerService();