// routes/followUpEmailRoutes.js
const express = require('express');
const FollowUpEmailService = require('../services/FollowUpEmailService');
const Campaign = require('../models/Campaign');
const EmailTrackingService = require('../services/EmailTrackingService');
const router = express.Router();

/**
 * Envoie manuellement un email de suivi pour une cible spécifique
 * POST /api/followup/:campaignId/send
 * Body: { targetEmail: string, token?: string }
 */
router.post('/:campaignId/send', async (req, res) => {
    try {
        const { campaignId } = req.params;
        const { targetEmail, token } = req.body;

        console.log(`📧 Demande d'envoi manuel email de suivi - Campagne: ${campaignId}, Cible: ${targetEmail}`);

        if (!targetEmail) {
            return res.status(400).json({
                success: false,
                message: 'Email cible requis'
            });
        }

        // Récupérer la campagne pour trouver le token si non fourni
        let finalToken = token;
        if (!finalToken) {
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campagne introuvable'
                });
            }

            const trackingEntry = campaign.emailTracking.find(t => t.targetEmail === targetEmail);
            if (trackingEntry) {
                finalToken = trackingEntry.trackingToken;
            } else {
                return res.status(404).json({
                    success: false,
                    message: 'Aucun token trouvé pour cette cible'
                });
            }
        }

        // Envoyer l'email de suivi
        const result = await FollowUpEmailService.sendPhishingFollowUpEmail(
            campaignId, 
            targetEmail, 
            finalToken,
            { manual: true }
        );

        res.json(result);

    } catch (error) {
        console.error('Erreur envoi manuel email de suivi:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'envoi de l\'email de suivi',
            error: error.message
        });
    }
});

/**
 * Obtient les statistiques des emails de suivi pour une campagne
 * GET /api/followup/:campaignId/stats
 */
router.get('/:campaignId/stats', async (req, res) => {
    try {
        const { campaignId } = req.params;

        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campagne introuvable'
            });
        }

        const stats = campaign.getFollowUpEmailStats();

        res.json({
            success: true,
            campaignId: campaignId,
            campaignName: campaign.name,
            stats: stats
        });

    } catch (error) {
        console.error('Erreur récupération stats emails de suivi:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques',
            error: error.message
        });
    }
});

/**
 * Obtient la liste des cibles qui ont besoin d'un email de suivi
 * GET /api/followup/:campaignId/pending
 */
router.get('/:campaignId/pending', async (req, res) => {
    try {
        const { campaignId } = req.params;

        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campagne introuvable'
            });
        }

        const pendingTargets = campaign.getTargetsNeedingFollowUp();

        res.json({
            success: true,
            campaignId: campaignId,
            campaignName: campaign.name,
            pendingCount: pendingTargets.length,
            targets: pendingTargets
        });

    } catch (error) {
        console.error('Erreur récupération cibles en attente:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des cibles en attente',
            error: error.message
        });
    }
});

/**
 * Envoie des emails de suivi en masse pour toutes les cibles qui en ont besoin
 * POST /api/followup/:campaignId/send-bulk
 */
router.post('/:campaignId/send-bulk', async (req, res) => {
    try {
        const { campaignId } = req.params;

        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campagne introuvable'
            });
        }

        const pendingTargets = campaign.getTargetsNeedingFollowUp();

        if (pendingTargets.length === 0) {
            return res.json({
                success: true,
                message: 'Aucun email de suivi en attente',
                sent: 0,
                failed: 0
            });
        }

        console.log(`📧📦 Envoi en masse de ${pendingTargets.length} emails de suivi`);

        // Envoyer les emails de suivi pour chaque cible
        const results = await Promise.allSettled(
            pendingTargets.map(target =>
                FollowUpEmailService.sendPhishingFollowUpEmail(
                    campaignId,
                    target.email,
                    target.token,
                    { bulk: true }
                )
            )
        );

        // Analyser les résultats
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
        const failed = results.filter(r => r.status === 'rejected' || !r.value.success);

        res.json({
            success: true,
            message: `Envoi en masse terminé: ${successful.length} réussis, ${failed.length} échecs`,
            total: pendingTargets.length,
            sent: successful.length,
            failed: failed.length,
            details: results.map((result, index) => ({
                email: pendingTargets[index].email,
                success: result.status === 'fulfilled' && result.value.success,
                message: result.status === 'fulfilled' ? result.value.message : result.reason?.message
            }))
        });

    } catch (error) {
        console.error('Erreur envoi en masse emails de suivi:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'envoi en masse',
            error: error.message
        });
    }
});

/**
 * Planifie un email de suivi avec délai
 * POST /api/followup/:campaignId/schedule
 * Body: { targetEmail: string, token?: string, delayMinutes: number }
 */
router.post('/:campaignId/schedule', async (req, res) => {
    try {
        const { campaignId } = req.params;
        const { targetEmail, token, delayMinutes = 5 } = req.body;

        if (!targetEmail) {
            return res.status(400).json({
                success: false,
                message: 'Email cible requis'
            });
        }

        // Récupérer le token si non fourni
        let finalToken = token;
        if (!finalToken) {
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campagne introuvable'
                });
            }

            const trackingEntry = campaign.emailTracking.find(t => t.targetEmail === targetEmail);
            if (trackingEntry) {
                finalToken = trackingEntry.trackingToken;
            } else {
                return res.status(404).json({
                    success: false,
                    message: 'Aucun token trouvé pour cette cible'
                });
            }
        }

        const result = await FollowUpEmailService.scheduleFollowUpEmail(
            campaignId,
            targetEmail,
            finalToken,
            delayMinutes
        );

        res.json(result);

    } catch (error) {
        console.error('Erreur planification email de suivi:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la planification',
            error: error.message
        });
    }
});

/**
 * Test d'envoi d'email de suivi
 * POST /api/followup/test
 * Body: { testEmail: string, campaignName?: string }
 */
router.post('/test', async (req, res) => {
    try {
        const { testEmail, campaignName = 'Test Campaign' } = req.body;

        if (!testEmail) {
            return res.status(400).json({
                success: false,
                message: 'Email de test requis'
            });
        }

        // Créer des données de test
        const testCampaign = {
            _id: 'test-campaign-id',
            name: campaignName,
            step5: {
                fromEmail: process.env.SMTP_USER || 'test@phishwise.com',
                fromName: 'PhishWise Security Team'
            }
        };

        const testTarget = {
            firstName: 'Test',
            lastName: 'User',
            email: testEmail
        };

        const testTrainingUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/training/test-campaign-id?email=${encodeURIComponent(testEmail)}&token=test-token&test=true`;

        // Générer l'email de test
        const emailData = {
            from: `${testCampaign.step5.fromName} <${testCampaign.step5.fromEmail}>`,
            to: testEmail,
            subject: '🧪 TEST - Rappel de formation - Vous êtes tombé(e) dans le piège de phishing',
            html: FollowUpEmailService.templates.phishing_caught.generateHtml(testTarget, testCampaign, testTrainingUrl),
            headers: {
                'X-Campaign-Type': 'phishing-followup-test',
                'X-Test-Mode': 'true'
            }
        };

        // Envoyer l'email de test
        const EmailService = require('../services/EmailService');
        const result = await EmailService.sendMail(emailData);

        res.json({
            success: result.success,
            message: result.success ? 
                `Email de test envoyé à ${testEmail}` : 
                `Erreur envoi email de test: ${result.error}`,
            testEmail: testEmail,
            messageId: result.messageId,
            trainingUrl: testTrainingUrl
        });

    } catch (error) {
        console.error('Erreur test email de suivi:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du test d\'email de suivi',
            error: error.message
        });
    }
});

module.exports = router;