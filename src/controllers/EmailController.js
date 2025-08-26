// controllers/EmailController.js
const Campaign = require('../models/Campaign');
const EmailService = require('../services/EmailService');
const EmailTrackingService = require('../services/EmailTrackingService');

class EmailController {
    /**
     * Envoie les emails de campagne avec tracking intégré
     * POST /api/campaigns/:campaignId/send-mail
     * Body: { targetEmail?: string } (optionnel, pour envoyer à une cible spécifique)
     */
    async sendCampaignEmail(req, res) {
        try {
            const { campaignId } = req.params;
            const { targetEmail } = req.body;

            // 1. Récupération de la campagne
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campagne introuvable'
                });
            }

            // 2. Vérifications des données requises
            const validationErrors = this.validateCampaignData(campaign);
            if (validationErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Configuration de campagne incomplète',
                    errors: validationErrors
                });
            }

            // 3. Récupération du template sélectionné
            const selectedTemplate = campaign.step3.templates.find(
                template => template.id === campaign.step3.selectedTemplate
            );

            if (!selectedTemplate) {
                return res.status(400).json({
                    success: false,
                    message: 'Template sélectionné introuvable'
                });
            }

            // 4. Filtrage des cibles
            let targets = campaign.targets;
            if (targetEmail) {
                targets = targets.filter(target => target.email === targetEmail);
                if (targets.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Cible avec cet email introuvable'
                    });
                }
            }

            // 5. Initialiser le système de tracking si nécessaire
            if (!campaign.emailTracking) {
                campaign.emailTracking = [];
                await campaign.save();
            }

            // 6. Construction et envoi des emails avec tracking
            const emailPromises = targets.map(target => {
                return this.sendTrackedEmail(campaign, selectedTemplate, target, campaignId);
            });

            // 7. Traitement des résultats
            const results = await Promise.allSettled(emailPromises);
            const processedResults = results.map((result, index) => {
                const target = targets[index];
                if (result.status === 'fulfilled') {
                    return {
                        target: {
                            email: target.email,
                            firstName: target.firstName,
                            lastName: target.lastName
                        },
                        ...result.value
                    };
                } else {
                    return {
                        target: {
                            email: target.email,
                            firstName: target.firstName,
                            lastName: target.lastName
                        },
                        success: false,
                        error: result.reason.message
                    };
                }
            });

            // 8. Statistiques des résultats
            const successCount = processedResults.filter(r => r.success).length;
            const failureCount = processedResults.filter(r => !r.success).length;

            // 9. Mettre à jour les statistiques initiales de la campagne
            if (successCount > 0) {
                await EmailTrackingService.updateCampaignStats(campaignId);
            }

            // 10. Log de l'activité
            console.log(`📧 Campagne ${campaignId}: ${successCount} envois réussis, ${failureCount} échecs`);

            // 11. Réponse
            return res.status(200).json({
                success: true,
                message: `Envoi terminé: ${successCount} réussis, ${failureCount} échecs`,
                statistics: {
                    total: processedResults.length,
                    successful: successCount,
                    failed: failureCount
                },
                results: processedResults,
                trackingInfo: {
                    trackingEnabled: true,
                    message: 'Les ouvertures et clics seront trackés automatiquement'
                }
            });

        } catch (error) {
            console.error('Erreur lors de l\'envoi des emails de campagne:', error);
            return res.status(500).json({
                success: false,
                message: 'Erreur interne du serveur',
                error: error.message
            });
        }
    }

    /**
     * Envoie un email avec tracking intégré
     * @param {Object} campaign - Campagne
     * @param {Object} template - Template
     * @param {Object} target - Cible
     * @param {string} campaignId - ID de la campagne
     * @returns {Promise<Object>} Résultat de l'envoi
     */
    async sendTrackedEmail(campaign, template, target, campaignId) {
        try {
            // 1. Générer les URLs de tracking
            const trackingUrls = EmailTrackingService.generateTrackingUrls(campaignId, target.email);
            
            // 2. Construire les données de base de l'email
            const baseEmailData = this.buildEmailData(campaign, template, target);
            
            // 3. Injecter le tracking dans le contenu HTML
            let trackedHtml = baseEmailData.html;
            
            // Injecter le pixel de tracking d'ouverture
            trackedHtml = EmailTrackingService.injectOpenTracking(
                trackedHtml, 
                trackingUrls.openTrackingUrl
            );
            
            // Injecter le tracking des clics
            trackedHtml = EmailTrackingService.injectClickTracking(
                trackedHtml, 
                trackingUrls.clickTrackingBaseUrl
            );

            // 4. Données de l'email final avec tracking
            const trackedEmailData = {
                ...baseEmailData,
                html: trackedHtml
            };

            // 5. Stocker le token de tracking AVANT l'envoi
            await EmailTrackingService.storeTrackingToken(
                trackingUrls.trackingToken,
                campaignId,
                target.email
            );

            // 6. Envoyer l'email
            const result = await EmailService.sendMail(trackedEmailData);

            // 7. Enrichir le résultat avec les informations de tracking
            if (result.success) {
                result.trackingToken = trackingUrls.trackingToken;
                result.trackingEnabled = true;
                
                console.log(`📧✅ Email tracké envoyé à ${target.email} (Token: ${trackingUrls.trackingToken})`);
            }

            return result;

        } catch (error) {
            console.error(`Erreur lors de l'envoi tracké pour ${target.email}:`, error);
            throw error;
        }
    }

    /**
     * Valide les données de campagne requises pour l'envoi
     * @param {Object} campaign - Objet campagne
     * @returns {Array<string>} Liste des erreurs de validation
     */
    validateCampaignData(campaign) {
        const errors = [];

        // Vérification des cibles
        if (!campaign.targets || campaign.targets.length === 0) {
            errors.push('Aucune cible définie');
        }

        // Vérification de la configuration SMTP
        if (!campaign.step5?.fromEmail) {
            errors.push('Adresse email expéditeur manquante (step5.fromEmail)');
        }
        if (!campaign.step5?.fromName) {
            errors.push('Nom expéditeur manquant (step5.fromName)');
        }

        // Vérification du template
        if (!campaign.step3?.selectedTemplate) {
            errors.push('Template sélectionné manquant (step3.selectedTemplate)');
        }
        if (!campaign.step3?.templates || campaign.step3.templates.length === 0) {
            errors.push('Aucun template disponible (step3.templates)');
        }

        // Vérification de la landing page
        if (!campaign.step4?.clonedUrl) {
            errors.push('URL de la page clonée manquante (step4.clonedUrl)');
        }

        return errors;
    }

    /**
     * Construit les données de l'email pour une cible donnée
     * @param {Object} campaign - Campagne
     * @param {Object} template - Template sélectionné
     * @param {Object} target - Cible
     * @returns {Object} Données de l'email formatées
     */
 buildEmailData(campaign, template, target) {
        // L'adresse qui s'affiche dans le client email (celle saisie par l'utilisateur)
        const displayFromAddress = `${campaign.step5.fromName} <${campaign.step5.fromEmail}>`;
        
        // Personnalisation du contenu HTML
        const personalizedHtml = this.personalizeEmailContent(
            template.content_html,
            target,
            campaign.step4.clonedUrl
        );

        // Personnalisation du sujet
        const personalizedSubject = this.personalizeText(template.subject, target);

        return {
            from: displayFromAddress,
            to: target.email,
            subject: personalizedSubject,
            html: personalizedHtml,
         text: template.content_text || null,
            headers: {
                'Reply-To': campaign.step5.fromEmail,
                'Return-Path': campaign.step5.fromEmail,
            }
        };
    }

    /** 
     * Personnalise le contenu de l'email 
     * @param {string} content - Contenu du template
     * @param {Object} target - Données de la cible
     * @param {string} clonedUrl - URL de la page clonée
     * @returns {string} Contenu personnalisé
     */
    personalizeEmailContent(content, target, clonedUrl) {
        // Construction du message personnalisé complet
        const personalizedContent = `
            <p>Bonjour ${target.firstName} ${target.lastName},</p>
            ${content}
            <p><a href="${clonedUrl}">Accéder à votre page</a></p>
        `;

        // Remplacement des variables dans le contenu
        return this.personalizeText(personalizedContent, target);
    }

    /**
     * Remplace les variables de personnalisation dans un texte
     * @param {string} text - Texte à personnaliser
     * @param {Object} target - Données de la cible
     * @returns {string} Texte personnalisé
     */
    personalizeText(text, target) {
        return text
            .replace(/\{\{firstName\}\}/g, target.firstName || '')
            .replace(/\{\{lastName\}\}/g, target.lastName || '')
            .replace(/\{\{email\}\}/g, target.email || '')
            .replace(/\{\{position\}\}/g, target.position || '')
            .replace(/\{\{country\}\}/g, target.country || '')
            .replace(/\{\{office\}\}/g, target.office || '');
    }

    /**
     * Test de la configuration email
     * GET /api/campaigns/:campaignId/test-email
     */
    async testEmailConfiguration(req, res) {
        try {
            const isConnected = await EmailService.testConnection();
            
            if (isConnected) {
                return res.status(200).json({
                    success: true,
                    message: 'Configuration SMTP fonctionnelle'
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Problème de configuration SMTP'
                });
            }
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Erreur lors du test de configuration',
                error: error.message
            });
        }
    }

    /**
     * Obtient les statistiques en temps réel d'une campagne
     * GET /api/campaigns/:campaignId/stats
     */
    async getCampaignStats(req, res) {
        try {
            const { campaignId } = req.params;
            
            const stats = await EmailTrackingService.getCampaignStats(campaignId);
            
            return res.status(200).json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('Erreur récupération statistiques campagne:', error);
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des statistiques',
                error: error.message
            });
        }
    }

    /**
     * Envoie un email de test avec tracking
     * POST /api/campaigns/:campaignId/send-test-email
     * Body: { testEmail: string }
     */
    async sendTestEmail(req, res) {
        try {
            const { campaignId } = req.params;
            const { testEmail } = req.body;

            if (!testEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Email de test requis'
                });
            }

            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campagne introuvable'
                });
            }

            // Créer une cible temporaire pour le test
            const testTarget = {
                firstName: 'Test',
                lastName: 'User',
                email: testEmail,
                position: 'Test Position',
                country: 'Test Country',
                office: 'Test Office'
            };

            // Récupérer le template sélectionné
            const selectedTemplate = campaign.step3.templates.find(
                template => template.id === campaign.step3.selectedTemplate
            );

            if (!selectedTemplate) {
                return res.status(400).json({
                    success: false,
                    message: 'Template sélectionné introuvable'
                });
            }

            // Envoyer l'email de test avec tracking
            const result = await this.sendTrackedEmail(campaign, selectedTemplate, testTarget, campaignId);

            return res.status(200).json({
                success: true,
                message: `Email de test envoyé à ${testEmail}`,
                data: result
            });

        } catch (error) {
            console.error('Erreur envoi email de test:', error);
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'envoi de l\'email de test',
                error: error.message
            });
        }
    }
}

const emailController = new EmailController();

module.exports = {
    sendCampaignEmail: emailController.sendCampaignEmail.bind(emailController),
    testEmailConfiguration: emailController.testEmailConfiguration.bind(emailController),
    getCampaignStats: emailController.getCampaignStats.bind(emailController),
    sendTestEmail: emailController.sendTestEmail.bind(emailController)
};
