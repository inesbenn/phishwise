// services/FollowUpEmailService.js - CORRECTION DOUBLES ENVOIS
const EmailService = require('./EmailService');
const Campaign = require('../models/Campaign');
const EmailTrackingService = require('./EmailTrackingService');

class FollowUpEmailService {
    constructor() {
        this.templates = {
            phishing_caught: {
                subject: "⚠️ Rappel de formation - Vous êtes tombé(e) dans le piège de phishing",
                generateHtml: (target, campaign, trainingUrl) => this.generatePhishingCaughtTemplate(target, campaign, trainingUrl),
                generateText: (target, campaign, trainingUrl) => this.generatePhishingCaughtText(target, campaign, trainingUrl)
            }
        };
    }

    /**
     * Envoie automatiquement un email de suivi après détection de phishing
     * @param {string} campaignId - ID de la campagne
     * @param {string} targetEmail - Email de la cible
     * @param {string} token - Token de tracking
     * @param {Object} triggerData - Données sur le déclenchement (formulaire, clic, etc.)
     */
    async sendPhishingFollowUpEmail(campaignId, targetEmail, token, triggerData = {}) {
        try {
            console.log(`📧🔄 Déclenchement email de suivi - Campagne: ${campaignId}, Cible: ${targetEmail}`);
            console.log(`📧🔍 TriggerData:`, triggerData);

            // Récupérer la campagne
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                throw new Error('Campagne introuvable');
            }

            // Récupérer les informations de la cible
            const target = campaign.targets?.find(t => t.email === targetEmail);
            if (!target) {
                throw new Error('Cible introuvable dans la campagne');
            }

            // *** CORRECTION PRINCIPALE : Vérification stricte des doubles envois ***
            const trackingEntry = campaign.emailTracking?.find(t => t.trackingToken === token);
            
            if (trackingEntry?.followUpEmailSent) {
                // Cas spéciaux où on permet le renvoi
                if (triggerData.forceResend) {
                    console.log(`🔄 ENVOI FORCÉ - Ignorer vérification déjà envoyé`);
                } else if (triggerData.manual) {
                    console.log(`🔄 ENVOI MANUEL - Ignorer vérification déjà envoyé`);
                } else {
                    // BLOQUAGE STRICT pour éviter les doubles envois automatiques
                    console.log(`❌ ENVOI BLOQUÉ - Email de suivi déjà envoyé pour ${targetEmail}`);
                    console.log(`📊 Détails:`, {
                        followUpSent: trackingEntry.followUpEmailSent,
                        sentAt: trackingEntry.followUpEmailSentAt,
                        triggerSource: triggerData.source || 'unknown'
                    });
                    
                    return {
                        success: false,
                        message: 'Email de suivi déjà envoyé',
                        alreadySent: true,
                        sentAt: trackingEntry.followUpEmailSentAt,
                        blocked: true
                    };
                }
            }

            // Construction de l'URL de formation avec le token
            const trainingUrl = this.buildTrainingUrl(campaignId, targetEmail, token);

            // Préparer les données de l'email
            const emailData = this.buildFollowUpEmail(campaign, target, trainingUrl, triggerData);

            console.log(`📤 ENVOI EMAIL DE SUIVI EN COURS VERS: ${targetEmail}`);
            console.log(`📧 Sujet: ${emailData.subject}`);
            console.log(`📧 De: ${emailData.from}`);
            console.log(`📧 Source déclenchement: ${triggerData.source || 'manual'}`);

            // Envoyer l'email
            const sendResult = await EmailService.sendMail(emailData);

            console.log(`📊 Résultat envoi:`, sendResult);

            if (sendResult.success) {
                // Marquer l'email de suivi comme envoyé dans le tracking
                await this.markFollowUpEmailSent(campaignId, token, sendResult.messageId, triggerData);

                // Enregistrer dans les interactions de la campagne
                await this.recordFollowUpEmailActivity(campaignId, targetEmail, sendResult, triggerData);

                console.log(`✅ EMAIL DE SUIVI ENVOYÉ AVEC SUCCÈS À ${targetEmail}`);

                return {
                    success: true,
                    message: 'Email de suivi envoyé avec succès',
                    messageId: sendResult.messageId,
                    trainingUrl: trainingUrl,
                    triggerSource: triggerData.source || 'manual'
                };
            } else {
                console.error(`❌ ÉCHEC ENVOI EMAIL DE SUIVI À ${targetEmail}:`, sendResult.error);
                return {
                    success: false,
                    message: 'Échec de l\'envoi de l\'email de suivi',
                    error: sendResult.error
                };
            }

        } catch (error) {
            console.error('❌ ERREUR SERVICE EMAIL DE SUIVI:', error);
            return {
                success: false,
                message: 'Erreur lors de l\'envoi de l\'email de suivi',
                error: error.message
            };
        }
    }

    /**
     * Construit l'URL de formation avec token
     */
    buildTrainingUrl(campaignId, targetEmail, token) {
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return `${baseUrl}/training/${campaignId}?email=${encodeURIComponent(targetEmail)}&token=${token}&followup=true`;
    }

    /**
     * Prépare les données de l'email de suivi
     */
    buildFollowUpEmail(campaign, target, trainingUrl, triggerData) {
        const template = this.templates.phishing_caught;
        const fromAddress = `${campaign.step5.fromName} <${campaign.step5.fromEmail}>`;

        return {
            from: fromAddress,
            to: target.email,
            subject: template.subject,
            html: template.generateHtml(target, campaign, trainingUrl),
            text: template.generateText(target, campaign, trainingUrl),
            headers: {
                'X-Campaign-Type': 'phishing-followup',
                'X-Campaign-ID': campaign._id.toString(),
                'X-Target-Email': target.email,
                'X-Trigger-Source': triggerData.source || 'manual',
                'Reply-To': campaign.step5.fromEmail
            }
        };
    }

    /**
     * Template HTML simple pour l'email de rappel de formation (sans tracking)
     */
    generatePhishingCaughtTemplate(target, campaign, trainingUrl) {
        const campaignName = campaign.name || 'Formation Sécurité';
        const firstName = target.firstName || 'Cher(e) collègue';
        
        return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rappel de formation - Sensibilisation au phishing</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <div style="text-align: center; margin-bottom: 30px;">
        <div style="background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 24px;">⚠️ Rappel de Formation</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Sensibilisation au Phishing</p>
        </div>
    </div>

    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #e74c3c; margin-bottom: 20px;">
        <h2 style="color: #e74c3c; margin-top: 0;">Bonjour ${firstName},</h2>
        <p><strong>Vous êtes récemment tombé(e) dans notre simulation de phishing.</strong></p>
        <p>Ceci était un test de sécurité dans le cadre de la campagne "<em>${campaignName}</em>" et aucune donnée sensible n'a été compromise.</p>
    </div>

    <div style="background: white; padding: 20px; border-radius: 8px; border: 2px solid #3498db; margin-bottom: 20px;">
        <h3 style="color: #3498db; margin-top: 0;">🎓 Formation Obligatoire</h3>
        <p>Pour améliorer votre vigilance face aux tentatives de phishing, vous devez suivre une formation personnalisée.</p>
        
        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p style="margin: 0;"><strong>Durée estimée :</strong> 15-20 minutes</p>
            <p style="margin: 5px 0 0 0;"><strong>Objectif :</strong> Apprendre à identifier et éviter les tentatives de phishing</p>
        </div>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <a href="${trainingUrl}" 
           style="display: inline-block; background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);">
            🚀 Commencer la Formation Maintenant
        </a>
    </div>

    <div style="background: #fff3cd; padding: 15px; border-radius: 5px; border: 1px solid #ffeaa7; margin: 20px 0;">
        <p style="margin: 0; color: #856404;"><strong>💡 Pourquoi cette formation ?</strong></p>
        <p style="margin: 10px 0 0 0; color: #856404;">Le phishing représente 90% des cyberattaques réussies. Cette formation vous donnera les outils pour reconnaître et éviter ces pièges à l'avenir.</p>
    </div>

    <div style="background: #d4edda; padding: 15px; border-radius: 5px; border: 1px solid #c3e6cb; margin: 20px 0;">
        <p style="margin: 0; color: #155724;"><strong>✅ Vos avantages :</strong></p>
        <ul style="color: #155724; margin: 10px 0;">
            <li>Formation interactive et personnalisée</li>
            <li>Exemples concrets et récents</li>
            <li>Certificat de completion</li>
            <li>Accès 24h/24, reprendre à tout moment</li>
        </ul>
    </div>

    <hr style="border: none; height: 1px; background: #eee; margin: 30px 0;">

    <div style="text-align: center; font-size: 14px; color: #666;">
        <p>Cet email fait suite à votre interaction avec notre simulation de phishing.</p>
        <p>Si vous avez des questions, contactez votre équipe sécurité.</p>
        <p style="margin-top: 20px;"><strong>Lien personnel de formation :</strong><br>
        <a href="${trainingUrl}" style="color: #3498db; word-break: break-all;">${trainingUrl}</a></p>
    </div>

</body>
</html>
        `;
    }

    /**
     * Template texte pour l'email de rappel
     */
    generatePhishingCaughtText(target, campaign, trainingUrl) {
        const firstName = target.firstName || 'Cher(e) collègue';
        const campaignName = campaign.name || 'Formation Sécurité';

        return `
RAPPEL DE FORMATION - SENSIBILISATION AU PHISHING

Bonjour ${firstName},

Vous êtes récemment tombé(e) dans notre simulation de phishing dans le cadre de la campagne "${campaignName}".

Ceci était un test de sécurité et aucune donnée sensible n'a été compromise.

FORMATION OBLIGATOIRE :
Pour améliorer votre vigilance face aux tentatives de phishing, vous devez suivre une formation personnalisée.

Durée estimée : 15-20 minutes
Objectif : Apprendre à identifier et éviter les tentatives de phishing

COMMENCER LA FORMATION :
${trainingUrl}

POURQUOI CETTE FORMATION ?
Le phishing représente 90% des cyberattaques réussies. Cette formation vous donnera les outils pour reconnaître et éviter ces pièges à l'avenir.

VOS AVANTAGES :
- Formation interactive et personnalisée
- Exemples concrets et récents  
- Certificat de completion
- Accès 24h/24, reprendre à tout moment

Si vous avez des questions, contactez votre équipe sécurité.

---
Cet email fait suite à votre interaction avec notre simulation de phishing.
        `;
    }

    /**
     * Marque l'email de suivi comme envoyé dans le tracking
     */
    async markFollowUpEmailSent(campaignId, token, messageId, triggerData = {}) {
        try {
            await Campaign.updateOne(
                {
                    _id: campaignId,
                    'emailTracking.trackingToken': token
                },
                {
                    $set: {
                        'emailTracking.$.followUpEmailSent': true,
                        'emailTracking.$.followUpEmailSentAt': new Date(),
                        'emailTracking.$.followUpMessageId': messageId,
                        'emailTracking.$.followUpTriggerSource': triggerData.source || 'manual'
                    }
                }
            );

            console.log(`📧✅ Email de suivi marqué comme envoyé pour token: ${token}`);

        } catch (error) {
            console.error('❌ Erreur marquage email de suivi:', error);
        }
    }

    /**
     * Enregistre l'activité d'envoi d'email de suivi
     */
    async recordFollowUpEmailActivity(campaignId, targetEmail, sendResult, triggerData = {}) {
        try {
            await Campaign.updateOne(
                { _id: campaignId },
                {
                    $push: {
                        'step4.interactions': {
                            type: 'followup_email_sent',
                            timestamp: new Date(),
                            metadata: {
                                targetEmail: targetEmail,
                                messageId: sendResult.messageId,
                                subject: 'Rappel de formation - Phishing détecté',
                                triggerSource: triggerData.source || 'manual',
                                triggerType: triggerData.triggerType
                            }
                        }
                    }
                }
            );

        } catch (error) {
            console.error('❌ Erreur enregistrement activité email de suivi:', error);
        }
    }

    /**
     * Envoie un email de suivi avec délai (optionnel)
     * @param {string} campaignId - ID de la campagne
     * @param {string} targetEmail - Email de la cible
     * @param {string} token - Token de tracking
     * @param {number} delayMinutes - Délai en minutes (défaut: 5)
     */
    async scheduleFollowUpEmail(campaignId, targetEmail, token, delayMinutes = 5) {
        console.log(`⏰ Planification email de suivi dans ${delayMinutes} minutes pour ${targetEmail}`);

        setTimeout(async () => {
            await this.sendPhishingFollowUpEmail(campaignId, targetEmail, token, {
                delayed: true,
                delayMinutes: delayMinutes,
                source: 'scheduled'
            });
        }, delayMinutes * 60 * 1000);

        return {
            success: true,
            message: `Email de suivi planifié dans ${delayMinutes} minutes`,
            scheduledFor: new Date(Date.now() + (delayMinutes * 60 * 1000))
        };
    }

    /**
     * Vérifie si un email de suivi a déjà été envoyé
     */
    async hasFollowUpEmailBeenSent(campaignId, token) {
        try {
            const campaign = await Campaign.findOne(
                {
                    _id: campaignId,
                    'emailTracking.trackingToken': token
                },
                {
                    'emailTracking.$': 1
                }
            );

            if (campaign && campaign.emailTracking[0]) {
                return !!campaign.emailTracking[0].followUpEmailSent;
            }

            return false;

        } catch (error) {
            console.error('❌ Erreur vérification email de suivi:', error);
            return false;
        }
    }
}

module.exports = new FollowUpEmailService();