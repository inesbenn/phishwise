// routes/trackingRoutes.js
const express = require('express');
const router = express.Router();
const EmailTrackingService = require('../services/EmailTrackingService');

/**
 * Route pour tracker l'ouverture d'email (pixel invisible)
 * GET /api/tracking/open/:trackingToken
 */
router.get('/open/:trackingToken', async (req, res) => {
    try {
        const { trackingToken } = req.params;
        
        // Collecter les métadonnées
        const metadata = {
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            referer: req.get('Referer'),
            timestamp: new Date()
        };

        // Enregistrer l'ouverture
        await EmailTrackingService.trackEmailOpen(trackingToken, metadata);

        // Retourner un pixel transparent 1x1
        const pixel = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
            'base64'
        );

        res.set({
            'Content-Type': 'image/png',
            'Content-Length': pixel.length,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        res.send(pixel);

    } catch (error) {
        console.error('Erreur tracking ouverture:', error);
        // Même en cas d'erreur, retourner le pixel pour ne pas casser l'email
        const pixel = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
            'base64'
        );
        res.set('Content-Type', 'image/png');
        res.send(pixel);
    }
});

/**
 * Route pour tracker les clics sur les liens
 * GET /api/tracking/click/:trackingToken?url=...
 */
router.get('/click/:trackingToken', async (req, res) => {
    try {
        const { trackingToken } = req.params;
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'URL manquante'
            });
        }

        // Décoder l'URL originale
        const originalUrl = decodeURIComponent(url);

        // Collecter les métadonnées
        const metadata = {
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            referer: req.get('Referer'),
            timestamp: new Date()
        };

        // Enregistrer le clic
        await EmailTrackingService.trackEmailClick(trackingToken, originalUrl, metadata);

        // Rediriger vers l'URL originale
        res.redirect(302, originalUrl);

    } catch (error) {
        console.error('Erreur tracking clic:', error);
        
        // En cas d'erreur, essayer quand même de rediriger
        const { url } = req.query;
        if (url) {
            try {
                const originalUrl = decodeURIComponent(url);
                res.redirect(302, originalUrl);
            } catch (decodeError) {
                res.status(500).json({
                    success: false,
                    message: 'Erreur lors du tracking du clic'
                });
            }
        } else {
            res.status(500).json({
                success: false,
                message: 'Erreur lors du tracking du clic'
            });
        }
    }
});

/**
 * Route pour obtenir les statistiques d'une campagne
 * GET /api/tracking/stats/:campaignId
 */
router.get('/stats/:campaignId', async (req, res) => {
    try {
        const { campaignId } = req.params;
        
        const stats = await EmailTrackingService.getCampaignStats(campaignId);
        
        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Erreur récupération statistiques:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques',
            error: error.message
        });
    }
});

/**
 * Route pour obtenir les statistiques détaillées par cible
 * GET /api/tracking/detailed-stats/:campaignId
 */
router.get('/detailed-stats/:campaignId', async (req, res) => {
    try {
        const { campaignId } = req.params;
        
        const Campaign = require('../models/Campaign');
        const campaign = await Campaign.findById(campaignId);
        
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campagne introuvable'
            });
        }

        const detailedStats = campaign.emailTracking || [];
        
        // Enrichir avec les informations des cibles
        const enrichedStats = detailedStats.map(tracking => {
            const target = campaign.targets.find(t => t.email === tracking.targetEmail);
            return {
                ...tracking.toObject(),
                targetInfo: {
                    firstName: target?.firstName,
                    lastName: target?.lastName,
                    position: target?.position,
                    country: target?.country,
                    office: target?.office
                }
            };
        });

        res.json({
            success: true,
            data: {
                campaignId,
                campaignName: campaign.name,
                tracking: enrichedStats,
                summary: {
                    totalSent: enrichedStats.length,
                    totalOpened: enrichedStats.filter(t => t.opened).length,
                    totalWithClicks: enrichedStats.filter(t => t.clickCount > 0).length,
                    totalClicks: enrichedStats.reduce((sum, t) => sum + (t.clickCount || 0), 0)
                }
            }
        });

    } catch (error) {
        console.error('Erreur récupération statistiques détaillées:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques détaillées',
            error: error.message
        });
    }
});

/**
 * Route de test pour vérifier qu'un token fonctionne
 * GET /api/tracking/test/:trackingToken
 */
router.get('/test/:trackingToken', async (req, res) => {
    try {
        const { trackingToken } = req.params;
        
        const Campaign = require('../models/Campaign');
        const campaign = await Campaign.findOne({
            'emailTracking.trackingToken': trackingToken
        });

        if (!campaign) {
            return res.json({
                success: false,
                message: 'Token de tracking introuvable',
                trackingToken
            });
        }

        const tracking = campaign.emailTracking.find(
            t => t.trackingToken === trackingToken
        );

        res.json({
            success: true,
            message: 'Token de tracking valide',
            data: {
                trackingToken,
                campaignId: campaign._id,
                campaignName: campaign.name,
                targetEmail: tracking.targetEmail,
                opened: tracking.opened,
                clickCount: tracking.clickCount || 0,
                sentAt: tracking.sentAt
            }
        });

    } catch (error) {
        console.error('Erreur test tracking:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du test du token',
            error: error.message
        });
    }
});

/**
 * Route pour forcer la mise à jour des statistiques d'une campagne
 * POST /api/tracking/refresh-stats/:campaignId
 */
router.post('/refresh-stats/:campaignId', async (req, res) => {
    try {
        const { campaignId } = req.params;
        
        await EmailTrackingService.updateCampaignStats(campaignId);
        const stats = await EmailTrackingService.getCampaignStats(campaignId);
        
        res.json({
            success: true,
            message: 'Statistiques mises à jour',
            data: stats
        });

    } catch (error) {
        console.error('Erreur actualisation statistiques:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'actualisation des statistiques',
            error: error.message
        });
    }
});
/**
 * GET /api/tracking/recent-events
 * Endpoint pour récupérer les événements d'email tracking en temps réel
 * Query params: since=timestamp
 */
router.get('/recent-events', async (req, res) => {
    try {
        const { since } = req.query;
        const sinceDate = since ? new Date(since) : new Date(Date.now() - 60000); // Dernière minute

        const Campaign = require('../models/Campaign');

        // Récupérer les événements récents d'email tracking
        const recentEvents = await Campaign.aggregate([
            {
                $match: {
                    'emailTracking.0': { $exists: true }
                }
            },
            {
                $unwind: "$emailTracking"
            },
            {
                $match: {
                    $or: [
                        { 'emailTracking.openedAt': { $gte: sinceDate } },
                        { 'emailTracking.clicks.clickedAt': { $gte: sinceDate } }
                    ]
                }
            },
            {
                $project: {
                    campaignId: "$_id",
                    campaignName: "$name",
                    targetEmail: "$emailTracking.targetEmail",
                    opened: "$emailTracking.opened",
                    openedAt: "$emailTracking.openedAt",
                    recentClicks: {
                        $filter: {
                            input: "$emailTracking.clicks",
                            cond: { $gte: ["$$this.clickedAt", sinceDate] }
                        }
                    }
                }
            },
            {
                $sort: { openedAt: -1 }
            },
            {
                $limit: 20
            }
        ]);

        const events = [];
        
        recentEvents.forEach(event => {
            // Événement d'ouverture
            if (event.opened && event.openedAt >= sinceDate) {
                events.push({
                    type: 'email_open',
                    campaignId: event.campaignId,
                    campaignName: event.campaignName,
                    timestamp: event.openedAt,
                    targetEmail: event.targetEmail.split('@')[0] + '***@' + event.targetEmail.split('@')[1]
                });
            }
            
            // Événements de clic
            event.recentClicks.forEach(click => {
                events.push({
                    type: 'email_click',
                    campaignId: event.campaignId,
                    campaignName: event.campaignName,
                    timestamp: click.clickedAt,
                    url: click.url,
                    targetEmail: event.targetEmail.split('@')[0] + '***@' + event.targetEmail.split('@')[1]
                });
            });
        });

        // Trier par timestamp
        events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({
            success: true,
            data: events.slice(0, 10)
        });
        
    } catch (error) {
        console.error('Erreur récupération événements récents:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des événements récents',
            error: error.message
        });
    }
});

module.exports = router;
