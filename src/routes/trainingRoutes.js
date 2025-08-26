// routes/trainingRoutes.js - VERSION CORRIGÉE
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const Campaign = require('../models/Campaign');
const router = express.Router();

/**
 * Route pour servir la page de formation après phishing
 * GET /training/:campaignId?email=xxx&token=xxx
 * OU GET /training/:campaignId/:token (nouvelle route pour token direct)
 */
router.get('/:campaignId', async (req, res) => {
    try {
        const { campaignId } = req.params;
        let { email, token } = req.query;

        console.log(`📚 Accès formation - Campaign: ${campaignId}, Email: ${email}, Token: ${token}`);

        // Vérifier que la campagne existe
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            console.log(`❌ Campagne non trouvée: ${campaignId}`);
            return res.status(404).send(generateTrainingErrorPage('Formation non trouvée', 'Cette formation n\'est plus disponible.'));
        }

        // *** CORRECTION PRINCIPALE : Récupération de l'email depuis diverses sources ***
        let targetEmail = email;

        // Méthode 1: Email depuis les paramètres de requête (priorité haute)
        if (!targetEmail && token && token !== 'direct-access') {
            console.log(`🔍 Recherche email pour token: ${token}`);
            try {
                const trackingEntry = campaign.emailTracking?.find(t => t.trackingToken === token);
                if (trackingEntry) {
                    targetEmail = trackingEntry.targetEmail;
                    console.log(`📧 Email trouvé dans emailTracking: ${targetEmail}`);
                    
                    // REDIRECTION avec email pour cohérence d'URL
                    const redirectUrl = `/training/${campaignId}?email=${encodeURIComponent(targetEmail)}&token=${token}`;
                    console.log(`🔄 Redirection avec email: ${redirectUrl}`);
                    return res.redirect(redirectUrl);
                } else {
                    console.warn(`⚠️ Token non trouvé dans emailTracking: ${token}`);
                }
            } catch (tokenError) {
                console.error('❌ Erreur vérification token:', tokenError);
            }
        }

        // Méthode 2: Vérifier si le token est dans le path (format /training/campaignId/token)
        if (!targetEmail) {
            const pathParts = req.path.split('/');
            const possibleToken = pathParts[3]; // /training/campaignId/token
            if (possibleToken && possibleToken.length > 10) {
                console.log(`🔍 Token potentiel dans path: ${possibleToken}`);
                try {
                    const trackingEntry = campaign.emailTracking?.find(t => t.trackingToken === possibleToken);
                    if (trackingEntry) {
                        targetEmail = trackingEntry.targetEmail;
                        token = possibleToken;
                        console.log(`📧 Email trouvé depuis path token: ${targetEmail}`);
                        
                        // Rediriger vers format standard avec paramètres
                        const redirectUrl = `/training/${campaignId}?email=${encodeURIComponent(targetEmail)}&token=${token}`;
                        console.log(`🔄 Redirection depuis path vers: ${redirectUrl}`);
                        return res.redirect(redirectUrl);
                    }
                } catch (error) {
                    console.error('❌ Erreur path token:', error);
                }
            }
        }

        // Méthode 3: Recherche dans toutes les cibles si aucune méthode précédente n'a fonctionné
        if (!targetEmail && campaign.targets && campaign.targets.length === 1) {
            // Si une seule cible, on peut l'utiliser automatiquement
            targetEmail = campaign.targets[0].email;
            console.log(`📧 Email unique automatique: ${targetEmail}`);
        }

        // Validation finale : vérifier qu'on a un email
        if (!targetEmail) {
            console.warn(`⚠️ Aucun email trouvé - Campaign: ${campaignId}, Token: ${token}`);
            return res.status(400).send(generateTrainingErrorPage(
                'Email manquant', 
                'Un email valide est requis. Veuillez utiliser le lien reçu par email.',
                `Debug: Campaign=${campaignId}, Token=${token}, Path=${req.path}`
            ));
        }

        // Vérifier que l'email fait partie des cibles
        const isValidTarget = campaign.targets?.some(target => target.email === targetEmail);
        if (!isValidTarget) {
            console.log(`❌ Email non valide: ${targetEmail}`);
            return res.status(403).send(generateTrainingErrorPage(
                'Accès non autorisé', 
                'Vous n\'êtes pas autorisé à accéder à cette formation.'
            ));
        }

        // Récupérer les infos de la cible
        const target = campaign.targets.find(t => t.email === targetEmail);

        // Construction de l'URL vers l'application React
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        let trainingUrl = `${frontendUrl}/training/${campaignId}?email=${encodeURIComponent(targetEmail)}`;
        
        if (token && token !== 'direct-access') {
            trainingUrl += `&token=${token}`;
        }

        console.log(`🔄 Redirection vers React: ${trainingUrl}`);

        // Page HTML de redirection vers l'app React
        const redirectPage = generateTrainingRedirectPage(trainingUrl, target, campaign);
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(redirectPage);

    } catch (error) {
        console.error('❌ Erreur route formation:', error);
        return res.status(500).send(generateTrainingErrorPage(
            'Erreur serveur', 
            'Une erreur s\'est produite lors du chargement de la formation.',
            error.message
        ));
    }
});

// *** ROUTE SUPPLÉMENTAIRE pour les tokens directs dans le path ***
router.get('/:campaignId/:token', async (req, res) => {
    try {
        const { campaignId, token } = req.params;
        
        console.log(`📧 Accès direct par token - Campaign: ${campaignId}, Token: ${token}`);
        
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).send(generateTrainingErrorPage('Campagne non trouvée', 'Cette campagne n\'existe pas.'));
        }

        // Chercher l'email associé au token
        const trackingEntry = campaign.emailTracking?.find(t => t.trackingToken === token);
        if (!trackingEntry) {
            console.warn(`⚠️ Token non trouvé: ${token}`);
            return res.status(404).send(generateTrainingErrorPage(
                'Lien invalide', 
                'Ce lien n\'est pas valide ou a expiré.'
            ));
        }

        // Rediriger vers la route standard avec email et token
        const redirectUrl = `/training/${campaignId}?email=${encodeURIComponent(trackingEntry.targetEmail)}&token=${token}`;
        console.log(`🔄 Redirection token direct vers: ${redirectUrl}`);
        
        res.redirect(redirectUrl);
        
    } catch (error) {
        console.error('❌ Erreur token direct:', error);
        res.status(500).send(generateTrainingErrorPage('Erreur de redirection', 'Impossible de traiter le lien.'));
    }
});

// Fonction d'erreur améliorée avec debug
function generateTrainingErrorPage(title, message, debugInfo = '') {
    return `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <title>${title}</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%);
                    color: white;
                    text-align: center;
                    padding: 0;
                    margin: 0;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .error-container {
                    max-width: 600px;
                    padding: 40px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 15px;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
                }
                .error-icon { font-size: 64px; margin-bottom: 20px; }
                .error-title {
                    font-size: 28px;
                    font-weight: 700;
                    margin-bottom: 15px;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                }
                .error-message {
                    font-size: 16px;
                    line-height: 1.5;
                    margin-bottom: 20px;
                    opacity: 0.9;
                }
                .debug-info {
                    background: rgba(0,0,0,0.2);
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                    font-family: monospace;
                    font-size: 12px;
                    text-align: left;
                }
                .retry-button {
                    display: inline-block;
                    background: rgba(255, 255, 255, 0.2);
                    color: white;
                    text-decoration: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    margin: 10px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    transition: all 0.3s ease;
                    cursor: pointer;
                    border: none;
                    font-size: 16px;
                }
                .retry-button:hover {
                    background: rgba(255, 255, 255, 0.3);
                    transform: translateY(-2px);
                }
            </style>
        </head>
        <body>
            <div class="error-container">
                <div class="error-icon">⚠️</div>
                <h1 class="error-title">${title}</h1>
                <p class="error-message">${message}</p>
                ${debugInfo ? `<div class="debug-info">Debug: ${debugInfo}</div>` : ''}
                <button class="retry-button" onclick="window.location.reload()">
                    Réessayer
                </button>
                <button class="retry-button" onclick="window.history.back()">
                    Retour
                </button>
            </div>
        </body>
        </html>
    `;
}

/**
 * *** NOUVELLE ROUTE *** : Route directe avec token pour faciliter les redirections
 * GET /training/:campaignId/:token
 */
router.get('/:campaignId/:token', async (req, res) => {
    try {
        const { campaignId, token } = req.params;
        
        console.log(`📧 Accès formation via token direct - Campagne: ${campaignId}, Token: ${token}`);
        
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).send(generateTrainingErrorPage('Campagne non trouvée', 'Cette campagne n\'existe pas.'));
        }

        // Trouver l'email associé au token
        const trackingEntry = campaign.emailTracking.find(t => t.trackingToken === token);
        if (!trackingEntry) {
            return res.status(404).send(generateTrainingErrorPage('Lien invalide', 'Ce lien n\'est pas valide ou a expiré.'));
        }

        // Rediriger vers la route standard avec email et token
        const redirectUrl = `/training/${campaignId}?email=${encodeURIComponent(trackingEntry.targetEmail)}&token=${token}`;
        console.log(`🔄 Redirection depuis token direct vers: ${redirectUrl}`);
        
        res.redirect(redirectUrl);
        
    } catch (error) {
        console.error('❌ Erreur redirection token formation:', error);
        res.status(500).send(generateTrainingErrorPage('Erreur de redirection', 'Impossible de traiter le lien.'));
    }
});

/**
 * API pour obtenir les données de formation d'une campagne
 * GET /api/training/:campaignId/data?email=xxx&token=xxx
 */
router.get('/:campaignId/data', async (req, res) => {
    try {
        const { campaignId } = req.params;
        let { email, token } = req.query;

        console.log(`📊 Récupération des données de formation - Campagne: ${campaignId}, Email: ${email}, Token: ${token}`);

        // Vérifier que la campagne existe
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campagne non trouvée'
            });
        }

        // *** CORRECTION : Récupérer email depuis token si nécessaire ***
        let targetEmail = email;
        if (token && !email) {
            const trackingEntry = campaign.emailTracking.find(t => t.trackingToken === token);
            if (trackingEntry) {
                targetEmail = trackingEntry.targetEmail;
                console.log(`📧 Email API récupéré depuis token: ${targetEmail}`);
            }
        }

        // Vérifier l'email
        if (!targetEmail) {
            return res.status(400).json({
                success: false,
                message: 'Email requis'
            });
        }

        // Vérifier que l'email fait partie des cibles
        const target = campaign.targets.find(t => t.email === targetEmail);
        if (!target) {
            return res.status(403).json({
                success: false,
                message: 'Accès non autorisé'
            });
        }

        // Construire la réponse avec les informations de formation
        const responseData = {
            success: true,
            campaign: {
                id: campaign._id,
                name: campaign.name,
                startDate: campaign.startDate
            },
            target: {
                firstName: target.firstName,
                lastName: target.lastName,
                email: target.email,
                position: target.position,
                office: target.office
            },
            training: {
                title: campaign.step6?.learningPageConfig?.title || "Formation Sécurité - Sensibilisation au Phishing",
                description: campaign.step6?.learningPageConfig?.description || "Cette formation vous aidera à reconnaître et éviter les tentatives de phishing.",
                estimatedTime: campaign.step6?.learningPageConfig?.estimatedTime || "15-20 minutes",
                welcomeMessage: campaign.step6?.learningPageConfig?.welcomeMessage || null,
                completionMessage: campaign.step6?.learningPageConfig?.completionMessage || null
            },
            formations: campaign.step6?.assignedFormations || []
        };

        console.log(`✅ Données de formation envoyées pour ${targetEmail}`);
        res.json(responseData);

    } catch (error) {
        console.error('❌ Erreur récupération données formation:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
});

// ... le reste des fonctions utilitaires reste identique
function generateTrainingRedirectPage(trainingUrl, target, campaign) {
    return `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Vous êtes tombé(e) dans le piège !</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                    color: white;
                    text-align: center;
                    padding: 0;
                    margin: 0;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .container {
                    max-width: 700px;
                    padding: 40px;
                    background: rgba(0, 0, 0, 0.7);
                    border-radius: 15px;
                    backdrop-filter: blur(10px);
                    border: 2px solid #e74c3c;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                }
                .warning-icon {
                    font-size: 80px;
                    margin-bottom: 20px;
                    animation: shake 0.5s ease-in-out infinite alternate;
                }
                @keyframes shake {
                    0% { transform: translateX(-5px); }
                    100% { transform: translateX(5px); }
                }
                .alert-title {
                    font-size: 32px;
                    font-weight: 700;
                    margin-bottom: 20px;
                    color: #e74c3c;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
                    text-transform: uppercase;
                }
                .phishing-message {
                    font-size: 20px;
                    font-weight: 600;
                    margin-bottom: 25px;
                    line-height: 1.4;
                    background: rgba(231, 76, 60, 0.2);
                    padding: 20px;
                    border-radius: 10px;
                    border-left: 5px solid #e74c3c;
                    border: 2px solid #e74c3c;
                }
                .training-section {
                    background: rgba(0, 0, 0, 0.5);
                    border-radius: 10px;
                    padding: 20px;
                    margin: 20px 0;
                    border: 2px solid #3498db;
                }
                .loading-spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid rgba(255, 255, 255, 0.3);
                    border-top: 4px solid #3498db;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 20px auto;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .countdown {
                    font-size: 24px;
                    font-weight: bold;
                    margin-top: 15px;
                    color: #3498db;
                }
                .manual-link {
                    display: inline-block;
                    background: #3498db;
                    color: white;
                    text-decoration: none;
                    padding: 15px 30px;
                    border-radius: 8px;
                    margin-top: 20px;
                    border: 2px solid #3498db;
                    transition: all 0.3s ease;
                    font-weight: 600;
                }
                .manual-link:hover {
                    background: #2980b9;
                    border-color: #2980b9;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(52, 152, 219, 0.4);
                }
                .target-name {
                    color: #e74c3c;
                    font-weight: 700;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="warning-icon">⚠️</div>
                <h1 class="alert-title">Vous êtes tombé(e) dans le piège !</h1>
                
                <div class="phishing-message">
                    <p><strong>Salut <span class="target-name">${target.firstName} ${target.lastName}</span></strong>, vous êtes tombé dans le piège de phishing. Soyez plus attentif(ve) à l'avenir.</p>
                </div>

                <div class="training-section">
                    <h3 style="margin-top: 0; color: #3498db;">🎓 Voici une formation pour vous aider :</h3>
                    <p><strong>Formation :</strong> Sensibilisation au Phishing</p>
                    <p><strong>Durée estimée :</strong> 15-20 minutes</p>
                    <p><strong>Objectif :</strong> Apprendre à identifier et éviter les tentatives de phishing</p>
                </div>

                <div class="loading-spinner"></div>
                <p><strong>Redirection automatique vers votre formation personnalisée dans :</strong></p>
                <div class="countdown" id="countdown">60</div>
                
                <p style="margin-top: 30px; font-size: 14px; opacity: 0.8;">
                    Si la redirection automatique ne fonctionne pas :
                </p>
                <a href="${trainingUrl}" class="manual-link">
                    🚀 Commencer la formation maintenant
                </a>
            </div>

            <script>
                // Redirection automatique après 1 minute (60 secondes) avec compteur
                let countdown = 60;
                const countdownElement = document.getElementById('countdown');
                
                const timer = setInterval(() => {
                    countdown--;
                    if (countdownElement) {
                        // Afficher le temps en format MM:SS
                        const minutes = Math.floor(countdown / 60);
                        const seconds = countdown % 60;
                        const formattedSeconds = seconds < 10 ? '0' + seconds : seconds;
                        countdownElement.textContent = minutes + ':' + formattedSeconds;
                    }
                    
                    if (countdown <= 0) {
                        clearInterval(timer);
                        window.location.href = '${trainingUrl}';
                    }
                }, 1000);

                // Redirection de secours après 65 secondes (1min 5sec)
                setTimeout(() => {
                    if (window.location.href !== '${trainingUrl}') {
                        window.location.href = '${trainingUrl}';
                    }
                }, 65000);

                console.log('🎯 Cible tombée dans le piège:', '${target.email}');
                console.log('🔄 Redirection prévue vers :', '${trainingUrl}');
            </script>
        </body>
        </html>
    `;
}

function generateTrainingErrorPage(title, message, errorCode = '') {
    return `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <title>${title}</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%);
                    color: white;
                    text-align: center;
                    padding: 0;
                    margin: 0;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .error-container {
                    max-width: 500px;
                    padding: 40px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 15px;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
                }
                .error-icon {
                    font-size: 64px;
                    margin-bottom: 20px;
                }
                .error-title {
                    font-size: 28px;
                    font-weight: 700;
                    margin-bottom: 15px;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                }
                .error-message {
                    font-size: 16px;
                    line-height: 1.5;
                    margin-bottom: 20px;
                    opacity: 0.9;
                }
                .error-code {
                    font-size: 12px;
                    font-family: monospace;
                    opacity: 0.7;
                }
                .retry-button {
                    display: inline-block;
                    background: rgba(255, 255, 255, 0.2);
                    color: white;
                    text-decoration: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    margin-top: 20px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    transition: all 0.3s ease;
                    cursor: pointer;
                    border: none;
                    font-size: 16px;
                }
                .retry-button:hover {
                    background: rgba(255, 255, 255, 0.3);
                    border-color: rgba(255, 255, 255, 0.5);
                    transform: translateY(-2px);
                }
            </style>
        </head>
        <body>
            <div class="error-container">
                <div class="error-icon">⚠️</div>
                <h1 class="error-title">${title}</h1>
                <p class="error-message">${message}</p>
                ${errorCode ? `<small class="error-code">Code erreur: ${errorCode}</small>` : ''}
                <button class="retry-button" onclick="window.location.reload()">
                    Réessayer
                </button>
            </div>
        </body>
        </html>
    `;
}

module.exports = router;