// routes/trackingToken.js
const express = require('express');
const EmailTrackingService = require('../services/EmailTrackingService');
const router = express.Router();

/**
 * Route pour tracker l'ouverture des emails
 * GET /api/tracking/open/:token
 */
router.get('/open/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        console.log(`📖 Tentative de tracking d'ouverture - Token: ${token}`);

        // Métadonnées de la requête
        const metadata = {
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            referer: req.get('Referer'),
            timestamp: new Date()
        };

        // Enregistrer l'ouverture
        const tracked = await EmailTrackingService.trackEmailOpen(token, metadata);
        
        if (tracked) {
            console.log(`✅ Ouverture trackée avec succès pour le token: ${token}`);
        } else {
            console.log(`⚠️ Token non trouvé ou déjà ouvert: ${token}`);
        }

        // Retourner un pixel transparent 1x1
        const pixelBuffer = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77QQAAAABJRU5ErkJggg==',
            'base64'
        );

        res.set({
            'Content-Type': 'image/png',
            'Content-Length': pixelBuffer.length,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        res.send(pixelBuffer);

    } catch (error) {
        console.error('Erreur lors du tracking d\'ouverture:', error);
        
        // Même en cas d'erreur, retourner le pixel transparent
        const pixelBuffer = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77QQAAAABJRU5ErkJggg==',
            'base64'
        );
        res.set('Content-Type', 'image/png');
        res.send(pixelBuffer);
    }
});

/**
 * Route pour tracker les clics sur les liens
 * GET /api/tracking/click/:token?url=originalUrl
 */
router.get('/click/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { url } = req.query;
        
        console.log(`🖱️ Tentative de tracking de clic - Token: ${token}, URL: ${url}`);

        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'URL de redirection manquante'
            });
        }

        // Métadonnées de la requête
        const metadata = {
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            referer: req.get('Referer'),
            timestamp: new Date()
        };

        // Enregistrer le clic
        const tracked = await EmailTrackingService.trackEmailClick(token, url, metadata);
        
        if (tracked) {
            console.log(`✅ Clic tracké avec succès - Token: ${token}, URL: ${url}`);
        } else {
            console.log(`⚠️ Token non trouvé pour le clic: ${token}`);
        }

        // Rediriger vers l'URL originale
        const decodedUrl = decodeURIComponent(url);
        console.log(`🔄 Redirection vers: ${decodedUrl}`);
        
        res.redirect(302, decodedUrl);

    } catch (error) {
        console.error('Erreur lors du tracking de clic:', error);
        
        // En cas d'erreur, essayer quand même de rediriger
        if (req.query.url) {
            try {
                const decodedUrl = decodeURIComponent(req.query.url);
                res.redirect(302, decodedUrl);
            } catch (decodeError) {
                res.status(400).json({
                    success: false,
                    message: 'URL de redirection invalide'
                });
            }
        } else {
            res.status(500).json({
                success: false,
                message: 'Erreur lors du tracking du clic',
                error: error.message
            });
        }
    }
});

/**
 * Route pour obtenir les statistiques de tracking d'un token spécifique
 * GET /api/tracking/stats/:token
 */
router.get('/stats/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        const Campaign = require('../models/Campaign');
        const campaign = await Campaign.findOne({
            'emailTracking.trackingToken': token
        });

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Token de tracking non trouvé'
            });
        }

        const tracking = campaign.emailTracking.find(t => t.trackingToken === token);
        
        res.json({
            success: true,
            data: {
                token: token,
                targetEmail: tracking.targetEmail,
                sentAt: tracking.sentAt,
                opened: tracking.opened,
                openedAt: tracking.openedAt,
                clickCount: tracking.clickCount || 0,
                clicks: tracking.clicks || [],
                lastActivity: tracking.lastActivity
            }
        });

    } catch (error) {
        console.error('Erreur récupération stats tracking:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques',
            error: error.message
        });
    }
});

/**
 * Route pour obtenir toutes les statistiques d'une campagne
 * GET /api/tracking/campaign/:campaignId/stats
 */
router.get('/campaign/:campaignId/stats', async (req, res) => {
    try {
        const { campaignId } = req.params;
        
        const stats = await EmailTrackingService.getCampaignStats(campaignId);
        
        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Erreur récupération stats campagne:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques de campagne',
            error: error.message
        });
    }
});

/**
 * Route de debug pour vérifier un token (À SUPPRIMER EN PRODUCTION)
 * GET /api/tracking/debug/:token
 */
router.get('/debug/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        const Campaign = require('../models/Campaign');
        const campaign = await Campaign.findOne({
            'emailTracking.trackingToken': token
        });

        if (!campaign) {
            return res.json({
                found: false,
                token: token,
                message: 'Token non trouvé dans aucune campagne'
            });
        }

        const tracking = campaign.emailTracking.find(t => t.trackingToken === token);
        
        res.json({
            found: true,
            token: token,
            campaign: {
                id: campaign._id,
                name: campaign.name
            },
            tracking: {
                targetEmail: tracking.targetEmail,
                sentAt: tracking.sentAt,
                opened: tracking.opened,
                openedAt: tracking.openedAt,
                clickCount: tracking.clickCount || 0,
                totalClicks: tracking.clicks ? tracking.clicks.length : 0
            },
            urls: {
                openTracking: `/api/tracking/open/${token}`,
                clickTracking: `/api/tracking/click/${token}?url=https://example.com`,
                phishingPage: `/phishing/${campaign._id}?email=${encodeURIComponent(tracking.targetEmail)}&token=${token}`,
                trainingPage: `/training/${campaign._id}?email=${encodeURIComponent(tracking.targetEmail)}&token=${token}`
            }
        });

    } catch (error) {
        console.error('Erreur debug tracking:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du debug',
            error: error.message
        });
    }
});

module.exports = router;