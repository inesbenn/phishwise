// routes/emailRoutes.js
const express = require('express');
const router = express.Router();
const { sendCampaignEmail, testEmailConfiguration } = require('../controllers/EmailController');

/**
 * @route POST /api/campaigns/:campaignId/send-mail
 * @desc Envoie les emails de la campagne à toutes les cibles ou à une cible spécifique
 * @access Private (nécessite authentification selon votre architecture)
 * @body { targetEmail?: string } - Email de la cible spécifique (optionnel)
 */
router.post('/:campaignId/send-mail', sendCampaignEmail);

/**
 * @route GET /api/campaigns/:campaignId/test-email
 * @desc Test de la configuration SMTP
 * @access Private
 */
router.get('/:campaignId/test-email', testEmailConfiguration);

module.exports = router;