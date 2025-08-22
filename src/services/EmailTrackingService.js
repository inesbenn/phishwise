// services/EmailTrackingService.js
const Campaign = require('../models/Campaign');
const crypto = require('crypto');

class EmailTrackingService {
    constructor() {
        this.baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    }

    /**
     * Génère un token de tracking unique pour un email
     * @param {string} campaignId - ID de la campagne
     * @param {string} targetEmail - Email de la cible
     * @returns {string} Token de tracking
     */
    generateTrackingToken(campaignId, targetEmail) {
        const data = `${campaignId}-${targetEmail}-${Date.now()}`;
        return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
    }

    /**
     * Génère les URLs de tracking pour un email
     * @param {string} campaignId - ID de la campagne
     * @param {string} targetEmail - Email de la cible
     * @returns {Object} URLs de tracking
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
     * @param {string} htmlContent - Contenu HTML de l'email
     * @param {string} openTrackingUrl - URL du pixel de tracking
     * @returns {string} Contenu HTML avec pixel de tracking
     */
    injectOpenTracking(htmlContent, openTrackingUrl) {
        // Pixel de tracking invisible (1x1 transparent)
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

        // Injecter le pixel juste avant la fermeture du body ou à la fin si pas de body
        if (htmlContent.includes('</body>')) {
            return htmlContent.replace('</body>', `${trackingPixel}</body>`);
        } else {
            return htmlContent + trackingPixel;
        }
    }

    /**
     * Remplace tous les liens dans le contenu HTML par des liens trackés
     * @param {string} htmlContent - Contenu HTML de l'email
     * @param {string} clickTrackingBaseUrl - URL de base pour le tracking des clics
     * @returns {string} Contenu HTML avec liens trackés
     */
    injectClickTracking(htmlContent, clickTrackingBaseUrl) {
        // Regex pour matcher les liens href
        const linkRegex = /href\s*=\s*["']([^"']+)["']/gi;
        
        return htmlContent.replace(linkRegex, (match, originalUrl) => {
            // Ne pas tracker les liens de tracking déjà présents ou les ancres
            if (originalUrl.includes('/api/tracking/') || 
                originalUrl.startsWith('#') || 
                originalUrl.startsWith('mailto:') || 
                originalUrl.startsWith('tel:')) {
                return match;
            }

            // Encoder l'URL originale pour la passer en paramètre
            const encodedUrl = encodeURIComponent(originalUrl);
            const trackedUrl = `${clickTrackingBaseUrl}?url=${encodedUrl}`;
            
            return `href="${trackedUrl}"`;
        });
    }

    /**
     * Enregistre un token de tracking dans la base de données
     * @param {string} trackingToken - Token de tracking
     * @param {string} campaignId - ID de la campagne
     * @param {string} targetEmail - Email de la cible
     */
    async storeTrackingToken(trackingToken, campaignId, targetEmail) {
        try {
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                throw new Error('Campagne introuvable');
            }

            // Initialiser le tableau de tracking s'il n'existe pas
            if (!campaign.emailTracking) {
                campaign.emailTracking = [];
            }

            // Vérifier si ce token existe déjà
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
                    clicks: [],
                    clickCount: 0
                });

                await campaign.save();
                console.log(`📧 Token de tracking ${trackingToken} stocké pour ${targetEmail}`);
            }

        } catch (error) {
            console.error('Erreur lors du stockage du token de tracking:', error);
        }
    }

    /**
     * Enregistre une ouverture d'email
     * @param {string} trackingToken - Token de tracking
     * @param {Object} metadata - Métadonnées de la requête (IP, User-Agent, etc.)
     */
    async trackEmailOpen(trackingToken, metadata = {}) {
        try {
            const campaign = await Campaign.findOne({
                'emailTracking.trackingToken': trackingToken
            });

            if (!campaign) {
                console.warn(`⚠️  Token de tracking introuvable: ${trackingToken}`);
                return false;
            }

            const tracking = campaign.emailTracking.find(
                t => t.trackingToken === trackingToken
            );

            if (tracking && !tracking.opened) {
                tracking.opened = true;
                tracking.openedAt = new Date();
                tracking.openMetadata = {
                    ipAddress: metadata.ipAddress,
                    userAgent: metadata.userAgent,
                    timestamp: new Date()
                };

                await campaign.save();
                
                console.log(`📖 Email ouvert: ${tracking.targetEmail} (Token: ${trackingToken})`);
                
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
     * Enregistre un clic sur un lien
     * @param {string} trackingToken - Token de tracking
     * @param {string} originalUrl - URL originale cliquée
     * @param {Object} metadata - Métadonnées de la requête
     */
    async trackEmailClick(trackingToken, originalUrl, metadata = {}) {
        try {
            const campaign = await Campaign.findOne({
                'emailTracking.trackingToken': trackingToken
            });

            if (!campaign) {
                console.warn(`⚠️  Token de tracking introuvable: ${trackingToken}`);
                return false;
            }

            const tracking = campaign.emailTracking.find(
                t => t.trackingToken === trackingToken
            );

            if (tracking) {
                // Marquer comme ouvert si ce n'est pas déjà fait (clic implique ouverture)
                if (!tracking.opened) {
                    tracking.opened = true;
                    tracking.openedAt = new Date();
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

                tracking.clickCount = tracking.clicks.length;

                await campaign.save();
                
                console.log(`🖱️  Lien cliqué: ${tracking.targetEmail} → ${originalUrl}`);
                
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
     * Met à jour les statistiques de campagne en temps réel
     * @param {string} campaignId - ID de la campagne
     */
    async updateCampaignStats(campaignId) {
        try {
            const campaign = await Campaign.findById(campaignId);
            if (!campaign || !campaign.emailTracking) return;

            const stats = {
                totalSent: campaign.emailTracking.length,
                totalOpened: campaign.emailTracking.filter(t => t.opened).length,
                totalClicks: campaign.emailTracking.reduce((sum, t) => sum + (t.clickCount || 0), 0),
                uniqueClicks: campaign.emailTracking.filter(t => t.clickCount > 0).length
            };

            // Calculer les taux
            stats.openRate = stats.totalSent > 0 ? ((stats.totalOpened / stats.totalSent) * 100).toFixed(1) : 0;
            stats.clickRate = stats.totalSent > 0 ? ((stats.uniqueClicks / stats.totalSent) * 100).toFixed(1) : 0;
            stats.clickThroughRate = stats.totalOpened > 0 ? ((stats.uniqueClicks / stats.totalOpened) * 100).toFixed(1) : 0;

            // Stocker dans la campagne
            campaign.emailStats = {
                ...stats,
                lastUpdated: new Date()
            };

            await campaign.save();

            console.log(`📊 Statistiques mises à jour - Campagne ${campaignId}:`, {
                sent: stats.totalSent,
                opened: stats.totalOpened,
                clicks: stats.totalClicks,
                openRate: `${stats.openRate}%`,
                clickRate: `${stats.clickRate}%`
            });

        } catch (error) {
            console.error('Erreur lors de la mise à jour des statistiques:', error);
        }
    }

    /**
     * Obtient les statistiques détaillées d'une campagne
     * @param {string} campaignId - ID de la campagne
     * @returns {Object} Statistiques détaillées
     */
    async getCampaignStats(campaignId) {
        try {
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                throw new Error('Campagne introuvable');
            }

            // Si pas de tracking, retourner des stats vides
            if (!campaign.emailTracking || campaign.emailTracking.length === 0) {
                return {
                    totalSent: 0,
                    totalOpened: 0,
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
                clickCount: tracking.clickCount || 0,
                lastClick: tracking.clicks.length > 0 ? 
                    tracking.clicks[tracking.clicks.length - 1].clickedAt : null
            }));

            // Statistiques globales (utiliser les stats mises en cache si disponibles)
            const cachedStats = campaign.emailStats;
            if (cachedStats && 
                new Date() - new Date(cachedStats.lastUpdated) < 60000) { // Cache valide 1 minute
                return {
                    ...cachedStats,
                    targets
                };
            }

            // Recalculer si pas de cache ou cache expiré
            const stats = {
                totalSent: campaign.emailTracking.length,
                totalOpened: campaign.emailTracking.filter(t => t.opened).length,
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
     * Nettoie les anciens tokens de tracking (tâche de maintenance)
     * @param {number} daysOld - Nombre de jours après lesquels nettoyer
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

            console.log(`🧹 Nettoyage des anciens tokens: ${result.modifiedCount} campagnes mises à jour`);
            return result;

        } catch (error) {
            console.error('Erreur lors du nettoyage des tokens:', error);
            throw error;
        }
    }
}

module.exports = new EmailTrackingService();
