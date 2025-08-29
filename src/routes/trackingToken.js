// routes/trackingToken.js - VERSION CORRIGÉE
const express = require('express');
const EmailTrackingService = require('../services/EmailTrackingService');
const router = express.Router(); 

/**
 * Route pour obtenir les statistiques de tracking d'un token spécifique
 * GET /api/tracking/stats/:token
 */
router.get('/stats/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        console.log(`📊 Demande de stats pour le token: ${token}`);
        
        const Campaign = require('../models/Campaign');
        
        // ✅ CORRECTION: Utiliser findOne avec condition sur emailTracking.trackingToken
        // Ne PAS utiliser findById car le token n'est pas un ObjectId
        const campaign = await Campaign.findOne({
            'emailTracking.trackingToken': token
        });

        if (!campaign) {
            console.log(`❌ Token de tracking non trouvé: ${token}`);
            return res.status(404).json({
                success: false,
                message: 'Token de tracking non trouvé',
                debug: {
                    searchedToken: token,
                    tokenLength: token.length,
                    isValidObjectId: /^[0-9a-fA-F]{24}$/.test(token)
                }
            });
        }

        const tracking = campaign.emailTracking.find(t => t.trackingToken === token);
        
        if (!tracking) {
            console.log(`❌ Tracking data non trouvé pour le token: ${token}`);
            return res.status(404).json({
                success: false,
                message: 'Données de tracking non trouvées pour ce token'
            });
        }

        // Préparer les données de réponse
        const statsData = {
            token: token,
            campaignId: campaign._id,
            campaignName: campaign.name,
            targetEmail: tracking.targetEmail,
            sentAt: tracking.sentAt,
            opened: tracking.opened,
            openedAt: tracking.openedAt,
            openCount: tracking.openCount || (tracking.opened ? 1 : 0),
            clickCount: tracking.clickCount || 0,
            clicks: tracking.clicks || [],
            lastActivity: tracking.lastActivity || tracking.openedAt,
            // Métadonnées supplémentaires
            openMetadata: tracking.openMetadata,
            bounced: tracking.bounced || false,
            bounceReason: tracking.bounceReason
        };

        console.log(`✅ Stats trouvées pour ${tracking.targetEmail}:`, {
            opened: statsData.opened,
            clickCount: statsData.clickCount
        });
        
        res.json({
            success: true,
            data: statsData
        });

    } catch (error) {
        console.error('❌ Erreur récupération stats tracking:', error);
        
        // Log détaillé de l'erreur pour debug
        console.error('Stack trace:', error.stack);
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques',
            error: error.message,
            debug: {
                receivedToken: req.params.token,
                errorType: error.name,
                mongooseError: error.message.includes('Cast to ObjectId')
            }
        });
    }
});

/**
 * ✅ NOUVELLE ROUTE: Obtenir les stats par campaignId (pour les ObjectId valides)
 * GET /api/tracking/campaign-stats/:campaignId
 */
router.get('/campaign-stats/:campaignId', async (req, res) => {
    try {
        const { campaignId } = req.params;
        
        console.log(`📊 Demande de stats de campagne: ${campaignId}`);
        
        // Valider que c'est un ObjectId valide
        if (!/^[0-9a-fA-F]{24}$/.test(campaignId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de campagne invalide',
                debug: {
                    receivedId: campaignId,
                    expectedFormat: 'ObjectId (24 caractères hexadécimaux)'
                }
            });
        }

        // Utiliser le service EmailTrackingService
        const stats = await EmailTrackingService.getCampaignStats(campaignId);
        
        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('❌ Erreur récupération stats campagne:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques de campagne',
            error: error.message
        });
    }
});

/**
 * Route pour obtenir toutes les statistiques d'une campagne (EXISTANTE - mais clarifiée)
 * GET /api/tracking/campaign/:campaignId/stats
 */
router.get('/campaign/:campaignId/stats', async (req, res) => {
    try {
        const { campaignId } = req.params;
        
        // Rediriger vers la nouvelle route pour éviter la confusion
        return res.redirect(`/api/tracking/campaign-stats/${campaignId}`);

    } catch (error) {
        console.error('❌ Erreur redirection stats campagne:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques de campagne',
            error: error.message
        });
    }
});

/**
 * ✅ ROUTE DE DEBUG AMÉLIORÉE: Identifier le type d'identifiant
 * GET /api/tracking/identify/:identifier
 */
router.get('/identify/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
        const isTrackingToken = identifier.length === 32 && /^[0-9a-fA-F]{32}$/.test(identifier);
        
        const Campaign = require('../models/Campaign');
        let result = {
            identifier,
            length: identifier.length,
            isObjectId,
            isTrackingToken,
            found: false,
            type: null,
            data: null
        };

        if (isObjectId) {
            // Chercher comme campaignId
            const campaign = await Campaign.findById(identifier);
            if (campaign) {
                result.found = true;
                result.type = 'campaign';
                result.data = {
                    id: campaign._id,
                    name: campaign.name,
                    emailTrackingCount: campaign.emailTracking ? campaign.emailTracking.length : 0
                };
            }
        }
        
        if (isTrackingToken && !result.found) {
            // Chercher comme tracking token
            const campaign = await Campaign.findOne({
                'emailTracking.trackingToken': identifier
            });
            if (campaign) {
                const tracking = campaign.emailTracking.find(t => t.trackingToken === identifier);
                result.found = true;
                result.type = 'tracking_token';
                result.data = {
                    campaignId: campaign._id,
                    campaignName: campaign.name,
                    targetEmail: tracking.targetEmail,
                    opened: tracking.opened,
                    clickCount: tracking.clickCount || 0
                };
            }
        }

        res.json(result);

    } catch (error) {
        console.error('❌ Erreur identification:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'identification',
            error: error.message
        });
    }
});

module.exports = router;