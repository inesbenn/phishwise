// routes/phishing.js - SOLUTION COMPLÈTE CORRIGÉE

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const Campaign = require('../models/Campaign');
const EmailTrackingService = require('../services/EmailTrackingService');
const router = express.Router();

/**
 * Route pour servir la page de phishing clonée avec token d'email
 * GET /phishing/:campaignId?email=xxx&token=xxx
 */
router.get('/:campaignId', async (req, res) => {
    try {
        const { campaignId } = req.params;
        const { email, token } = req.query;

        console.log(`🎣 Accès à la page de phishing - Campagne: ${campaignId}, Email: ${email}, Token: ${token}`);

        // Vérifier que la campagne existe
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            console.log(`❌ Campagne non trouvée: ${campaignId}`);
            return res.status(404).send(generateErrorPage('Page non trouvée', 'Cette campagne n\'existe pas ou n\'est plus accessible.'));
        }

        // *** CORRECTION PRINCIPALE : Récupérer l'email depuis le token ET rediriger avec l'email ***
        let targetEmail = email;
        if (token && !email) {
            try {
                const trackingEntry = campaign.emailTracking.find(t => t.trackingToken === token);
                if (trackingEntry) {
                    targetEmail = trackingEntry.targetEmail;
                    console.log(`📧 Email récupéré depuis le token: ${targetEmail}`);
                    
                    // REDIRECTION AUTOMATIQUE avec l'email dans l'URL
                    const redirectUrl = `/phishing/${campaignId}?email=${encodeURIComponent(targetEmail)}`;
                    console.log(`🔄 Redirection automatique vers: ${redirectUrl}`);
                    return res.redirect(redirectUrl);
                } else {
                    console.warn(`⚠️ Token d'email non trouvé: ${token}`);
                }
            } catch (tokenError) {
                console.error('❌ Erreur lors de la vérification du token:', tokenError);
            }
        }

        // Vérifier qu'une page a été clonée
        if (!campaign.step4 || !campaign.step4.filePath) {
            console.log(`❌ Aucune page clonée pour la campagne: ${campaignId}`);
            return res.status(404).send(generateErrorPage('Page non configurée', 'Cette campagne n\'a pas encore de page configurée.'));
        }

        // Si on arrive ici sans email, c'est un problème
        if (!targetEmail) {
            console.warn(`⚠️ Aucun email trouvé pour la campagne ${campaignId}`);
            return res.status(400).send(generateErrorPage(
                'Email requis', 
                'Un email valide est requis. Veuillez utiliser le lien reçu par email.'
            ));
        }

        // Vérifier que l'email fait partie des cibles
        const isValidTarget = campaign.targets && campaign.targets.some(target => target.email === targetEmail);
        if (!isValidTarget) {
            console.log(`❌ Email ${targetEmail} non trouvé dans les cibles de la campagne ${campaignId}`);
            return res.status(403).send(generateErrorPage('Accès non autorisé', 'Vous n\'êtes pas autorisé à accéder à cette page.'));
        }

        // Chemin vers le fichier HTML cloné
        const filePath = campaign.step4.filePath;
        console.log(`📁 Lecture du fichier: ${filePath}`);

        try {
            // Lire le contenu du fichier
            let htmlContent = await fs.readFile(filePath, 'utf8');

            // *** CORRECTION : Injecter le script avec l'email correctement ***
            const sessionScript = `
<script>
    // Variables pour la session de phishing avec email CONFIRMÉ
    window.PHISHING_SESSION = {
        campaignId: '${campaignId}',
        targetEmail: '${targetEmail}',
        token: '${token || 'direct-access'}',
        timestamp: new Date().toISOString()
    };
    console.log('🎯 Session de phishing initialisée avec email:', window.PHISHING_SESSION);
</script>`;

            // Injecter le script de redirection corrigé
            const correctedRedirectScript = generateCorrectedRedirectScript();
            const scriptsToInject = sessionScript + correctedRedirectScript;
            htmlContent = injectScripts(htmlContent, scriptsToInject);
            
            console.log(`✅ Page de phishing servie avec email confirmé: ${targetEmail}`);

            // Marquer la visite si on a un token
            if (token) {
                try {
                    await EmailTrackingService.trackEmailClick(token, req.url || 'phishing-page', {
                        ipAddress: req.ip,
                        userAgent: req.get('User-Agent'),
                        timestamp: new Date()
                    });
                } catch (trackingError) {
                    console.error('❌ Erreur tracking visite:', trackingError);
                }
            }

            // Définir les en-têtes appropriés
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('X-Frame-Options', 'SAMEORIGIN');
            res.setHeader('X-Content-Type-Options', 'nosniff');

            res.send(htmlContent);

        } catch (fileError) {
            console.error(`❌ Erreur lecture fichier ${filePath}:`, fileError);
            return res.status(500).send(generateErrorPage('Erreur de chargement', 'Impossible de charger la page. Veuillez réessayer plus tard.'));
        }

    } catch (error) {
        console.error('❌ Erreur générale route phishing:', error);
        return res.status(500).send(generateErrorPage('Erreur serveur', 'Une erreur inattendue s\'est produite.'));
    }
});

/**
 * *** NOUVEAU *** Route spécialisée pour les accès via token d'email
 * GET /phishing/:campaignId/email/:token
 */
router.get('/:campaignId/email/:token', async (req, res) => {
    try {
        const { campaignId, token } = req.params;
        
        console.log(`📧 Accès via token email - Campagne: ${campaignId}, Token: ${token}`);
        
        // Récupérer la campagne pour trouver l'email associé au token
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).send(generateErrorPage('Campagne non trouvée', 'Cette campagne n\'existe pas.'));
        }

        // Trouver l'email associé au token
        const trackingEntry = campaign.emailTracking.find(t => t.trackingToken === token);
        if (!trackingEntry) {
            return res.status(404).send(generateErrorPage('Lien invalide', 'Ce lien n\'est pas valide ou a expiré.'));
        }

        // Rediriger vers la page de phishing avec l'email
        const redirectUrl = `/phishing/${campaignId}?email=${encodeURIComponent(trackingEntry.targetEmail)}`;
        console.log(`🔄 Redirection depuis token vers: ${redirectUrl}`);
        
        res.redirect(redirectUrl);
        
    } catch (error) {
        console.error('❌ Erreur redirection token email:', error);
        res.status(500).send(generateErrorPage('Erreur de redirection', 'Impossible de traiter le lien.'));
    }
});

/**
 * Route pour capturer les données de phishing
 * POST /api/phishing/:campaignId/capture
 */
router.post('/:campaignId/capture', async (req, res) => {
    try {
        const { campaignId } = req.params;
        const {
            targetEmail,
            triggerType,
            formData,
            userAgent,
            url,
            referrer,
            timestamp,
            token
        } = req.body;

        console.log(`📊 Capture phishing - Campaign: ${campaignId}, Email: ${targetEmail}, Token: ${token}`);

        // Vérifier que la campagne existe
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campagne introuvable'
            });
        }

        // *** CORRECTION CRITIQUE : Récupérer email depuis token si manquant ***
        let finalTargetEmail = targetEmail;
        if (token && !targetEmail && token !== 'direct-access') {
            const trackingEntry = campaign.emailTracking?.find(t => t.trackingToken === token);
            if (trackingEntry) {
                finalTargetEmail = trackingEntry.targetEmail;
                console.log(`📧 Email récupéré depuis token pour capture: ${finalTargetEmail}`);
            } else {
                console.warn(`⚠️ Token non trouvé dans emailTracking: ${token}`);
            }
        }

        // Validation de l'email final
        if (!finalTargetEmail) {
            console.error('❌ Aucun email trouvé pour la capture');
            return res.status(400).json({
                success: false,
                message: 'Email cible requis pour la capture',
                debug: {
                    receivedEmail: targetEmail,
                    receivedToken: token,
                    campaignId: campaignId
                }
            });
        }

        // Vérifier que l'email fait partie des cibles
        const isValidTarget = campaign.targets?.some(target => target.email === finalTargetEmail);
        if (!isValidTarget) {
            console.warn(`⚠️ Email non trouvé dans les cibles: ${finalTargetEmail}`);
            return res.status(403).json({
                success: false,
                message: 'Email non autorisé pour cette campagne'
            });
        }

        // Mise à jour du tracking email si token présent
        if (token && token !== 'direct-access') {
            try {
                await EmailTrackingService.trackEmailClick(token, 'phishing-form-submission', {
                    ipAddress: req.ip,
                    userAgent: userAgent,
                    referer: referrer,
                    formData: formData,
                    triggerType: triggerType
                });
                console.log(`📧 Tracking email mis à jour pour token: ${token}`);
            } catch (trackingError) {
                console.error('❌ Erreur tracking email:', trackingError);
            }
        }

        // Initialiser les interactions et submissions si nécessaire
        if (!campaign.step4) {
            campaign.step4 = {};
        }
        if (!campaign.step4.interactions) {
            campaign.step4.interactions = [];
        }
        if (!campaign.step4.submissions) {
            campaign.step4.submissions = [];
        }

        // Ajouter l'interaction
        campaign.step4.interactions.push({
            type: 'phishing_success',
            timestamp: new Date(timestamp) || new Date(),
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: userAgent,
            pageUrl: url,
            referrer: referrer,
            metadata: {
                triggerType: triggerType,
                formData: formData,
                targetEmail: finalTargetEmail,
                emailToken: token
            }
        });

        // Ajouter dans les submissions
        campaign.step4.submissions.push({
            submittedAt: new Date(timestamp) || new Date(),
            userAgent: userAgent,
            ipAddress: req.ip || req.connection.remoteAddress,
            referrer: referrer,
            url: url,
            formData: formData,
            targetEmail: finalTargetEmail,
            metadata: {
                triggerType: triggerType,
                capturedBy: 'phishing_redirect_script',
                emailToken: token
            }
        });

        await campaign.save();

        console.log(`✅ Données capturées pour ${finalTargetEmail}`);

        // *** CORRECTION PRINCIPALE : Construction de l'URL de redirection ***
        let redirectUrl;
        
        // Priorité 1: Email + Token (le plus sûr)
        if (finalTargetEmail && token && token !== 'direct-access') {
            redirectUrl = `/training/${campaignId}?email=${encodeURIComponent(finalTargetEmail)}&token=${token}`;
            console.log(`🔄 Redirection avec email+token: ${redirectUrl}`);
        }
        // Priorité 2: Email seul (fallback sécurisé)
        else if (finalTargetEmail) {
            redirectUrl = `/training/${campaignId}?email=${encodeURIComponent(finalTargetEmail)}`;
            console.log(`🔄 Redirection avec email seul: ${redirectUrl}`);
        }
        // Priorité 3: Token dans path (sera résolu côté serveur)
        else if (token && token !== 'direct-access') {
            redirectUrl = `/training/${campaignId}/${token}`;
            console.log(`🔄 Redirection avec token path: ${redirectUrl}`);
        }
        // Fallback de base
        else {
            redirectUrl = `/training/${campaignId}`;
            console.log(`🔄 Redirection de base: ${redirectUrl}`);
        }

        res.json({
            success: true,
            message: 'Données capturées avec succès',
            redirectUrl: redirectUrl,
            debug: {
                campaignId: campaignId,
                finalTargetEmail: finalTargetEmail,
                token: token,
                triggerType: triggerType,
                constructedUrl: redirectUrl
            }
        });

    } catch (error) {
        console.error('❌ Erreur capture phishing:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la capture des données',
            error: error.message
        });
    }
});

/**
 * *** FONCTION CORRIGÉE *** Script de redirection universel avec validation d'email
 */
function generateCorrectedRedirectScript() {
    return `
<script>
(function() {
    'use strict';
    const REDIRECT_DELAY = 2000;

    function initializePhishingRedirect() {
        console.log('🎣 Initialisation du système de redirection de phishing');
        const session = window.PHISHING_SESSION;
        
        // VALIDATION STRICTE DE LA SESSION
        if (!session || !session.campaignId) {
            console.error('❌ Données de session invalides:', session);
            alert('Erreur: Données de session manquantes. Veuillez utiliser le lien reçu par email.');
            return;
        }
        
        console.log('📋 Session détectée:', session);
        interceptFormSubmissions(session);
        interceptLoginButtons(session);
    }

    function interceptFormSubmissions(session) {
        const forms = document.querySelectorAll('form');
        console.log(\`📋 \${forms.length} formulaire(s) détecté(s)\`);
        forms.forEach((form, index) => {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                console.log(\`📋 Soumission interceptée du formulaire \${index + 1}\`);
                const formData = collectFormData(form);
                handlePhishingSuccess(session, formData, 'form_submission');
            });
        });
    }

    function interceptLoginButtons(session) {
        const buttonSelectors = [
            'button[type="submit"]', 'input[type="submit"]', 
            'button', 'input[type="button"]',
            '[id*="login"]', '[id*="signin"]', '[class*="login"]', '[class*="signin"]',
            '.next-button', '.sign-in-button', '._42ft', '#loginBtn', '#nextBtn',
            '#loginButton'
        ];

        let interceptedButtons = 0;
        buttonSelectors.forEach(selector => {
            const buttons = document.querySelectorAll(selector);
            buttons.forEach(button => {
                if (!button.hasAttribute('data-phishing-intercepted')) {
                    const buttonText = button.textContent || button.value || '';
                    const isLoginButton = /Se connecter|Connexion|Login|Sign in|Suivant|Next|Valider/i.test(buttonText) || 
                                         button.id === 'loginButton' || 
                                         button.type === 'submit';
                    
                    if (isLoginButton) {
                        button.setAttribute('data-phishing-intercepted', 'true');
                        button.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🖱️ Clic intercepté sur bouton:', buttonText);
                            const form = this.closest('form') || document.querySelector('form');
                            const formData = form ? collectFormData(form) : {};
                            handlePhishingSuccess(session, formData, 'button_click');
                        });
                        interceptedButtons++;
                        console.log(\`✅ Bouton intercepté: "\${buttonText}"\`);
                    }
                }
            });
        });
        
        console.log(\`🎯 Total boutons interceptés: \${interceptedButtons}\`);
    }

    function collectFormData(form) {
        const formData = {};
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.name || input.id) {
                const key = input.name || input.id;
                let value = input.value;
                if (input.type === 'password') {
                    value = '***HIDDEN***';
                }
                formData[key] = value;
            }
        });
        console.log('📊 Données collectées:', formData);
        return formData;
    }

    function handlePhishingSuccess(session, formData, triggerType) {
        console.log(\`🎯 Phishing réussi! Type: \${triggerType}\`);
        console.log('📋 Session:', session);
        
        showLoadingIndicator();
        
        // *** CORRECTION PRINCIPALE : Construction de l'URL avec EMAIL ***
        let trainingUrl;
        
        // Priorité 1: Email + Token (le plus sûr)
        if (session.targetEmail && session.token && session.token !== 'direct-access') {
            trainingUrl = \`/training/\${session.campaignId}?email=\${encodeURIComponent(session.targetEmail)}&token=\${session.token}\`;
            console.log(\`🔄 URL avec email+token: \${trainingUrl}\`);
        }
        // Priorité 2: Email seul (fallback sécurisé)
        else if (session.targetEmail) {
            trainingUrl = \`/training/\${session.campaignId}?email=\${encodeURIComponent(session.targetEmail)}\`;
            console.log(\`🔄 URL avec email: \${trainingUrl}\`);
        }
        // Priorité 3: Token seul (sera résolu côté serveur)
        else if (session.token && session.token !== 'direct-access') {
            trainingUrl = \`/training/\${session.campaignId}/\${session.token}\`;
            console.log(\`🔄 URL avec token path: \${trainingUrl}\`);
        }
        // Fallback: URL de base (problématique mais nécessaire)
        else {
            trainingUrl = \`/training/\${session.campaignId}\`;
            console.error(\`⚠️ URL de base utilisée (peut causer des erreurs): \${trainingUrl}\`);
        }
        
        sendPhishingData(session, formData, triggerType, trainingUrl);
    }

    function showLoadingIndicator() {
        const overlay = document.createElement('div');
        overlay.style.cssText = \`
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(255, 255, 255, 0.95); display: flex;
            justify-content: center; align-items: center; z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        \`;
        overlay.innerHTML = \`
            <div style="text-align: center;">
                <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; 
                           border-top: 4px solid #4c51bf; border-radius: 50%; 
                           animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                <p style="color: #333; font-size: 16px; margin: 0;">Connexion en cours...</p>
                <p style="color: #666; font-size: 14px; margin: 5px 0 0;">Redirection vers la formation</p>
            </div>
            <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
        \`;
        document.body.appendChild(overlay);
    }

    function sendPhishingData(session, formData, triggerType, trainingUrl) {
        const payload = {
            campaignId: session.campaignId,
            targetEmail: session.targetEmail,
            timestamp: new Date().toISOString(),
            triggerType: triggerType,
            formData: formData,
            userAgent: navigator.userAgent,
            url: window.location.href,
            referrer: document.referrer,
            token: session.token
        };
        
        const captureUrl = \`/api/phishing/\${session.campaignId}/capture\`;
        console.log('📊 Envoi vers:', captureUrl);
        console.log('📊 Payload:', payload);
        console.log('🔄 URL de redirection prévue:', trainingUrl);
        
        fetch(captureUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(response => {
            console.log('📊 Status capture:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('✅ Capture réussie:', data);
            // Utiliser l'URL du serveur si fournie, sinon celle calculée localement
            const finalUrl = data.redirectUrl || trainingUrl;
            console.log('🔄 URL finale de redirection:', finalUrl);
        })
        .catch(error => {
            console.warn('⚠️ Erreur capture (redirection quand même):', error);
        })
        .finally(() => {
            console.log('⏰ Redirection dans', REDIRECT_DELAY, 'ms vers:', trainingUrl);
            setTimeout(() => {
                console.log('🔄 Redirection effective vers:', trainingUrl);
                window.location.href = trainingUrl;
            }, REDIRECT_DELAY);
        });
    }

    // Initialisation avec validation
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePhishingRedirect);
    } else {
        initializePhishingRedirect();
    }
    
    // Debug global
    window.debugPhishing = function() {
        console.log('🔍 Debug session:', window.PHISHING_SESSION);
        console.log('🔍 URL actuelle:', window.location.href);
        console.log('🔍 Email dans session:', window.PHISHING_SESSION?.targetEmail);
        console.log('🔍 Token dans session:', window.PHISHING_SESSION?.token);
    };
    
    console.log('✅ Script de redirection corrigé chargé avec validation email');
})();
</script>
`;
}

/**
 * Fonctions utilitaires
 */
function injectScripts(htmlContent, scriptsToInject) {
    if (htmlContent.includes('<head>')) {
        return htmlContent.replace('<head>', `<head>${scriptsToInject}`);
    } else if (htmlContent.includes('<body>')) {
        return htmlContent.replace('<body>', `<body>${scriptsToInject}`);
    } else {
        return scriptsToInject + htmlContent;
    }
}

function generateErrorPage(title, message, errorCode = '') {
    return `
        <html>
            <head>
                <title>${title}</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                        background-color: #f8f9fa;
                        color: #333;
                        text-align: center;
                        padding: 50px 20px;
                        margin: 0;
                    }
                    .error-container {
                        max-width: 500px;
                        margin: 0 auto;
                        background: white;
                        padding: 40px;
                        border-radius: 8px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .error-icon {
                        font-size: 48px;
                        margin-bottom: 20px;
                    }
                    .error-title {
                        color: #dc3545;
                        font-size: 24px;
                        font-weight: 600;
                        margin-bottom: 15px;
                    }
                    .error-message {
                        color: #666;
                        font-size: 16px;
                        line-height: 1.5;
                        margin-bottom: 20px;
                    }
                    .error-code {
                        color: #999;
                        font-size: 12px;
                        font-family: monospace;
                    }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <div class="error-icon">⚠️</div>
                    <h1 class="error-title">${title}</h1>
                    <p class="error-message">${message}</p>
                    ${errorCode ? `<small class="error-code">Code erreur: ${errorCode}</small>` : ''}
                </div>
            </body>
        </html>
    `;
}

module.exports = router;