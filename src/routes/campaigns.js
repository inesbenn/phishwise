const express = require('express');
const { body, param } = require('express-validator'); // Gardez validationResult hors des routes pour le middleware
const mongoose = require('mongoose'); // Toujours nécessaire si vous faites new ObjectId ici
const Campaign = require('../models/Campaign'); // Nécessaire pour la route GET /
const fakeAuthMiddleware = require('../middleware/fakeAuthMiddleware');
const campaignController = require('../controllers/campaignController'); // Le contrôleur de campagne modifié

const router = express.Router();

/**
 * POST /api/campaigns
 * Crée une nouvelle campagne (Step 0) avec createdBy simulé
 */
router.post(
  '/',
  fakeAuthMiddleware,
  [
    body('name')
      .notEmpty().withMessage('Le nom est requis'),
    body('startDate')
      .isISO8601().withMessage('Date invalide')
      .toDate()
  ],
  campaignController.createCampaign // Appelle la fonction du contrôleur de campagne
);

// GET /api/campaigns — renvoie toutes les campagnes
router.get(
  '/',
  fakeAuthMiddleware,
  async (req, res) => {
    try {
      const campaigns = await Campaign.find(); // Renommé 'camps' en 'campaigns' pour la cohérence
      res.json(campaigns);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);


/**
 * PUT /api/campaigns/:id/step/0
 * Met à jour les paramètres généraux (name, startDate)
 */
router.put(
  '/:id/step/0',
  fakeAuthMiddleware,
  [
    param('id').isMongoId().withMessage('ID de campagne invalide'),
    body('name')
      .notEmpty().withMessage('Le nom est requis'),
    body('startDate')
      .isISO8601().withMessage('Date invalide')
      .toDate()
  ],
  campaignController.updateStep0 // Appelle la fonction du contrôleur de campagne
);

/**
 * GET /api/campaigns/:id/complete
 * Récupère toutes les données de la campagne pour la validation finale
 */
router.get(
  '/:id/complete',
  fakeAuthMiddleware,
  [
    param('id').isMongoId().withMessage('ID de campagne invalide')
  ],
  campaignController.getCampaignCompleteData
);

/**
 * POST /api/campaigns/:id/launch
 * Lance la campagne après validation
 */
router.post(
  '/:id/launch',
  fakeAuthMiddleware,
  [
    param('id').isMongoId().withMessage('ID de campagne invalide'),
    body('scheduledDate').optional().isISO8601().withMessage('Date de programmation invalide').toDate()
  ],
  campaignController.launchCampaign
);

/**
 * PUT /api/campaigns/:id/draft
 * Sauvegarde la campagne en brouillon
 */
router.put(
  '/:id/draft',
  fakeAuthMiddleware,
  [
    param('id').isMongoId().withMessage('ID de campagne invalide')
  ],
  campaignController.saveCampaignAsDraft
);

/**
 * GET /api/campaigns/:id/validation-status
 * Récupère le statut de validation de la campagne
 */
router.get(
  '/:id/validation-status',
  fakeAuthMiddleware,
  [
    param('id').isMongoId().withMessage('ID de campagne invalide')
  ],
  campaignController.getCampaignValidationStatus
);

module.exports = router;
