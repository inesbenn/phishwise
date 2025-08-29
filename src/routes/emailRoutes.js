// routes/emailRoutes.js - VERSION CORRIGÉE
const express = require('express');
const router = express.Router();
const EmailController = require('../controllers/EmailController');

/**
 * @route POST /api/campaigns/:campaignId/send-mail
 * @desc Envoie les emails de la campagne à toutes les cibles ou à une cible spécifique 
 * @body { targetEmail?: string } - Email de la cible spécifique (optionnel)
 */
router.post('/:campaignId/send-mail', EmailController.sendCampaignEmail);

/**
 * @route POST /api/campaigns/:campaignId/send-test-email
 * @desc Envoie un email de test
 * @body { testEmail: string } - Email de destination pour le test
 */
router.post('/:campaignId/send-test-email', EmailController.sendTestEmail);

/**
 * @route GET /api/campaigns/:campaignId/test-email
 * @desc Test de la configuration SMTP 
 */
router.get('/:campaignId/test-email', EmailController.testEmailConfiguration);

/**
 * @route GET /api/campaigns/:campaignId/stats
 * @desc Récupère les statistiques d'une campagne par son ID 
 */
router.get('/:campaignId/stats', EmailController.getCampaignStats);

module.exports = router;