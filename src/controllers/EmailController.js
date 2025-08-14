// controllers/EmailController.js
const Campaign = require('../models/Campaign');
const EmailService = require('../services/EmailService');

class EmailController {
    /**
     * Envoie les emails de campagne
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

            // 5. Construction et envoi des emails
            const emailPromises = targets.map(target => {
                const emailData = this.buildEmailData(campaign, selectedTemplate, target);
                return EmailService.sendMail(emailData);
            });

            // 6. Traitement des résultats
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

            // 7. Statistiques des résultats
            const successCount = processedResults.filter(r => r.success).length;
            const failureCount = processedResults.filter(r => !r.success).length;

            // 8. Log de l'activité
            console.log(`📧 Campagne ${campaignId}: ${successCount} envois réussis, ${failureCount} échecs`);

            // 9. Réponse
            return res.status(200).json({
                success: true,
                message: `Envoi terminé: ${successCount} réussis, ${failureCount} échecs`,
                statistics: {
                    total: processedResults.length,
                    successful: successCount,
                    failed: failureCount
                },
                results: processedResults
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
        // MODIFICATION PRINCIPALE : Séparation de l'adresse d'affichage et d'envoi
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
            from: displayFromAddress,  // Adresse qui s'affiche
            to: target.email,
            subject: personalizedSubject,
            html: personalizedHtml,
            text: template.content_text || null,
            // Ajout des en-têtes personnalisés pour masquer l'adresse réelle
            headers: {
                'Reply-To': campaign.step5.fromEmail, // Optionnel : où les réponses sont envoyées
                'Return-Path': campaign.step5.fromEmail, // Optionnel : où les bounces sont envoyés
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
}

const emailController = new EmailController();

module.exports = {
    sendCampaignEmail: emailController.sendCampaignEmail.bind(emailController),
    testEmailConfiguration: emailController.testEmailConfiguration.bind(emailController)
};