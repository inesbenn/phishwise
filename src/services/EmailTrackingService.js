// services/EmailTrackingService.js - VERSION CORRIGÉE
const Campaign = require('../models/Campaign');
const crypto = require('crypto');

class EmailTrackingService {
    constructor() {
        this.baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    }

    /**
     * Génère un token de tracking unique pour un email 
     */
    generateTrackingToken(campaignId, targetEmail) {
        const data = `${campaignId}-${targetEmail}-${Date.now()}`;
        return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
    }

    /**
     * Génère les URLs de tracking pour un email 
     */
    generateTrackingUrls(campaignId, targetEmail) {
        const trackingToken = this.generateTrackingToken(campaignId, targetEmail);
        
        return {
            trackingToken,
            openTrackingUrl: `${this.baseUrl}/api/tracking/open/${trackingToken}`,
            clickTrackingBaseUrl: `${this.baseUrl}/api/tracking/click/${trackingToken}`
        };
    }

    /**
     * Injecte le pixel de tracking d'ouverture dans le contenu HTML 
     */
    injectOpenTracking(htmlContent, openTrackingUrl) { 
        const trackingPixel = `
            <img src="${openTrackingUrl}" 
                 width="1" height="1" 
                 style="display:none !important; 
                        visibility:hidden !important; 
                        opacity:0 !important; 
                        width:0 !important; 
                        height:0 !important; 
                        border:0 !important; 
                        padding:0 !important; 
                        margin:0 !important;"
                 alt="" />
        `;
 
        if (htmlContent.includes('</body>')) {
            return htmlContent.replace('</body>', `${trackingPixel}</body>`);
        } else {
            return htmlContent + trackingPixel;
        }
    }

    /**
     * Remplace tous les liens dans le contenu HTML par des liens trackés 
     */
    injectClickTracking(htmlContent, clickTrackingBaseUrl) {
        const linkRegex = /href\s*=\s*["']([^"']+)["']/gi; 
        
        return htmlContent.replace(linkRegex, (match, originalUrl) => { 
            if (originalUrl.includes('/api/tracking/') || 
                originalUrl.startsWith('#') || 
                originalUrl.startsWith('mailto:') || 
                originalUrl.startsWith('tel:')) {
                return match;
            } 
 
            const encodedUrl = encodeURIComponent(originalUrl);
            const trackedUrl = `${clickTrackingBaseUrl}?url=${encodedUrl}`;
            
            return `href="${trackedUrl}"`;
        });
    }

    /**
     * Enregistre un token de tracking dans la base de données 
     */
    async storeTrackingToken(trackingToken, campaignId, targetEmail) {
        try {
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                throw new Error('Campagne introuvable');
            } 
 
            if (!campaign.emailTracking) {
                campaign.emailTracking = [];
            }
 
            const existingTracking = campaign.emailTracking.find(
                t => t.trackingToken === trackingToken
            );

            if (!existingTracking) {
                campaign.emailTracking.push({
                    trackingToken,
                    targetEmail,
                    sentAt: new Date(),
                    opened: false,
                    openedAt: null,
                    openCount: 0, // CORRECTION: Initialiser à 0
                    clicks: [],
                    clickCount: 0
                });

                await campaign.save();
                console.log(`Token de tracking ${trackingToken} stocké pour ${targetEmail}`);
            }

        } catch (error) {
            console.error('Erreur lors du stockage du token de tracking:', error);
        }
    }

    /**
     * Enregistre une ouverture d'email - CORRECTION MAJEURE
     */
    async trackEmailOpen(trackingToken, metadata = {}) {
        try {
            const campaign = await Campaign.findOne({
                'emailTracking.trackingToken': trackingToken
            });

            if (!campaign) {
                console.warn(`Token de tracking introuvable: ${trackingToken}`);
                return false;
            }

            const tracking = campaign.emailTracking.find(
                t => t.trackingToken === trackingToken
            );

            if (tracking) {
                // CORRECTION: Toujours incrémenter openCount, même si déjà ouvert
                tracking.openCount = (tracking.openCount || 0) + 1;
                
                // Marquer comme ouvert si première ouverture
                if (!tracking.opened) {
                    tracking.opened = true;
                    tracking.openedAt = new Date();
                    tracking.openMetadata = {
                        ipAddress: metadata.ipAddress,
                        userAgent: metadata.userAgent,
                        timestamp: new Date()
                    };
                }

                // Mettre à jour la dernière activité
                tracking.lastActivity = new Date();

                await campaign.save();
                
                console.log(`Email ouvert (${tracking.openCount}x): ${tracking.targetEmail} (Token: ${trackingToken})`);
                
                // Mettre à jour les statistiques en temps réel
                await this.updateCampaignStats(campaign._id);
                
                return true;
            }

            return false;
        } catch (error) {
            console.error('Erreur lors du tracking d\'ouverture:', error);
            return false;
        }
    }

    /**
     * Enregistre un clic sur un lien - CORRECTION MAJEURE
     */
    async trackEmailClick(trackingToken, originalUrl, metadata = {}) {
        try {
            const campaign = await Campaign.findOne({
                'emailTracking.trackingToken': trackingToken
            });

            if (!campaign) {
                console.warn(`Token de tracking introuvable: ${trackingToken}`);
                return false;
            }

            const tracking = campaign.emailTracking.find(
                t => t.trackingToken === trackingToken
            );

            if (tracking) {
                // Marquer comme ouvert si ce n'est pas déjà fait
                if (!tracking.opened) {
                    tracking.opened = true;
                    tracking.openedAt = new Date();
                    tracking.openCount = 1;
                }

                // Enregistrer le clic
                tracking.clicks.push({
                    url: originalUrl,
                    clickedAt: new Date(),
                    metadata: {
                        ipAddress: metadata.ipAddress,
                        userAgent: metadata.userAgent,
                        referer: metadata.referer
                    }
                });

                // CORRECTION: Compter tous les clics
                tracking.clickCount = tracking.clicks.length;
                tracking.lastActivity = new Date();

                await campaign.save();
                
                console.log(`Lien cliqué (${tracking.clickCount}x): ${tracking.targetEmail} → ${originalUrl}`);
                
                // Mettre à jour les statistiques en temps réel
                await this.updateCampaignStats(campaign._id);
                
                return true;
            }

            return false;
        } catch (error) {
            console.error('Erreur lors du tracking de clic:', error);
            return false;
        }
    }

    /**
     * Met à jour les statistiques de campagne en temps réel - CORRECTION
     */
    async updateCampaignStats(campaignId) {
        try {
            const campaign = await Campaign.findById(campaignId);
            if (!campaign || !campaign.emailTracking) return;

            const stats = {
                totalSent: campaign.emailTracking.length,
                totalOpened: campaign.emailTracking.filter(t => t.opened).length,
                totalOpenCount: campaign.emailTracking.reduce((sum, t) => sum + (t.openCount || 0), 0), // NOUVEAU
                totalClicks: campaign.emailTracking.reduce((sum, t) => sum + (t.clickCount || 0), 0),
                uniqueClicks: campaign.emailTracking.filter(t => t.clickCount > 0).length
            };

            // Calculer les taux
            stats.openRate = stats.totalSent > 0 ? 
                parseFloat(((stats.totalOpened / stats.totalSent) * 100).toFixed(1)) : 0;
            stats.clickRate = stats.totalSent > 0 ? 
                parseFloat(((stats.uniqueClicks / stats.totalSent) * 100).toFixed(1)) : 0;
            stats.clickThroughRate = stats.totalOpened > 0 ? 
                parseFloat(((stats.uniqueClicks / stats.totalOpened) * 100).toFixed(1)) : 0;

            // Stocker dans la campagne
            campaign.emailStats = {
                ...stats,
                lastUpdated: new Date()
            };

            await campaign.save();

            console.log(`Statistiques mises à jour - Campagne ${campaignId}:`, {
                sent: stats.totalSent,
                opened: stats.totalOpened,
                totalOpenCount: stats.totalOpenCount, // NOUVEAU
                clicks: stats.totalClicks,
                uniqueClicks: stats.uniqueClicks,
                openRate: `${stats.openRate}%`,
                clickRate: `${stats.clickRate}%`
            });

        } catch (error) {
            console.error('Erreur lors de la mise à jour des statistiques:', error);
        }
    }

    /**
     * Obtient les statistiques détaillées d'une campagne - CORRECTION
     */
    async getCampaignStats(campaignId) {
        try {
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                throw new Error('Campagne introuvable');
            }
 
            if (!campaign.emailTracking || campaign.emailTracking.length === 0) {
                return {
                    totalSent: 0,
                    totalOpened: 0,
                    totalOpenCount: 0, // NOUVEAU
                    totalClicks: 0,
                    uniqueClicks: 0,
                    openRate: 0,
                    clickRate: 0,
                    clickThroughRate: 0,
                    targets: []
                };
            }

            // Statistiques par cible
            const targets = campaign.emailTracking.map(tracking => ({
                email: tracking.targetEmail,
                sent: true,
                opened: tracking.opened,
                openedAt: tracking.openedAt,
                openCount: tracking.openCount || 0, // NOUVEAU
                clickCount: tracking.clickCount || 0,
                totalClicks: tracking.clicks ? tracking.clicks.length : 0, // VERIFICATION
                lastClick: tracking.clicks && tracking.clicks.length > 0 ? 
                    tracking.clicks[tracking.clicks.length - 1].clickedAt : null,
                lastActivity: tracking.lastActivity
            }));

            // Recalculer les statistiques globales
            const stats = {
                totalSent: campaign.emailTracking.length,
                totalOpened: campaign.emailTracking.filter(t => t.opened).length,
                totalOpenCount: campaign.emailTracking.reduce((sum, t) => sum + (t.openCount || 0), 0), // NOUVEAU
                totalClicks: campaign.emailTracking.reduce((sum, t) => sum + (t.clickCount || 0), 0),
                uniqueClicks: campaign.emailTracking.filter(t => t.clickCount > 0).length
            };

            stats.openRate = stats.totalSent > 0 ? 
                parseFloat(((stats.totalOpened / stats.totalSent) * 100).toFixed(1)) : 0;
            stats.clickRate = stats.totalSent > 0 ? 
                parseFloat(((stats.uniqueClicks / stats.totalSent) * 100).toFixed(1)) : 0;
            stats.clickThroughRate = stats.totalOpened > 0 ? 
                parseFloat(((stats.uniqueClicks / stats.totalOpened) * 100).toFixed(1)) : 0;

            return {
                ...stats,
                targets
            };

        } catch (error) {
            console.error('Erreur lors de la récupération des statistiques:', error);
            throw error;
        }
    }

    /**
     * NOUVELLE MÉTHODE: Obtient les statistiques détaillées avec toutes les ouvertures
     */
    async getDetailedStats(campaignId) {
        try {
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                throw new Error('Campagne introuvable');
            }

            const detailedTargets = campaign.emailTracking.map(tracking => {
                return {
                    email: tracking.targetEmail,
                    trackingToken: tracking.trackingToken,
                    sentAt: tracking.sentAt,
                    opened: tracking.opened,
                    openedAt: tracking.openedAt,
                    openCount: tracking.openCount || 0,
                    clicks: tracking.clicks || [],
                    clickCount: tracking.clickCount || 0,
                    lastActivity: tracking.lastActivity,
                    metadata: tracking.openMetadata
                };
            });

            return {
                campaignId: campaignId,
                campaignName: campaign.name,
                targets: detailedTargets,
                summary: {
                    totalSent: detailedTargets.length,
                    totalOpened: detailedTargets.filter(t => t.opened).length,
                    totalOpenCount: detailedTargets.reduce((sum, t) => sum + t.openCount, 0),
                    totalClicks: detailedTargets.reduce((sum, t) => sum + t.clickCount, 0),
                    uniqueClickers: detailedTargets.filter(t => t.clickCount > 0).length
                }
            };

        } catch (error) {
            console.error('Erreur lors de la récupération des statistiques détaillées:', error);
            throw error;
        }
    }

    /**
     * Nettoie les anciens tokens de tracking
     */
    async cleanupOldTrackingTokens(daysOld = 90) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const result = await Campaign.updateMany(
                {},
                {
                    $pull: {
                        emailTracking: {
                            sentAt: { $lt: cutoffDate }
                        }
                    }
                }
            );

            console.log(`Nettoyage des anciens tokens: ${result.modifiedCount} campagnes mises à jour`);
            return result;

        } catch (error) {
            console.error('Erreur lors du nettoyage des tokens:', error);
            throw error;
        }
    }
}

module.exports = new EmailTrackingService();
