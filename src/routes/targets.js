// src/routes/targets.js
const express = require('express');
const { body, param } = require('express-validator'); // Gardez validationResult hors des routes pour le middleware
const fakeAuthMiddleware = require('../middleware/fakeAuthMiddleware');
const targetController = require('../controllers/targetController'); // Importez le nouveau contrôleur

const router = express.Router();

// Note : Les routes ici sont préfixées par '/api/campaigns' dans app.js,
// donc `:id` fera référence à l'ID de la campagne.

/**
 * PUT /api/campaigns/:id/step/1
 * Met à jour la liste complète des cibles pour une campagne (Step 1 du wizard)
 */
router.put(
  '/:id/step/1',
  fakeAuthMiddleware,
  [
    param('id').isMongoId().withMessage('ID de campagne invalide'),
    body('targets').isArray({ min: 1 }).withMessage('Liste de cibles requise'),
    body('targets.*.firstName').notEmpty().withMessage('Prénom de cible requis'),
    body('targets.*.lastName').notEmpty().withMessage('Nom de cible requis'),
    body('targets.*.email').isEmail().withMessage('Email de cible invalide'),
    // Les autres champs (position, country, office) peuvent être optionnels ou avoir leurs propres validations
  ],
  targetController.updateStep1 // Appelle la fonction du nouveau contrôleur
);

/**
 * GET /api/campaigns/:id/targets
 * Récupère toutes les cibles pour une campagne spécifique
 */
router.get(
  '/:id/targets',
  fakeAuthMiddleware,
  [
    param('id').isMongoId().withMessage('ID de campagne invalide')
  ],
  targetController.getTargets // Appelle la fonction du nouveau contrôleur
);

/**
 * PUT /api/campaigns/:id/targets/:targetId
 * Met à jour une cible spécifique dans une campagne
 
router.put(
  '/:id/targets/:targetId',
  fakeAuthMiddleware,
  [
    param('id').isMongoId().withMessage('ID de campagne invalide'),
    param('targetId').isMongoId().withMessage('ID de cible invalide'),
    body('firstName').notEmpty().withMessage('Prénom requis'),
    body('lastName').notEmpty().withMessage('Nom requis'),
    body('email').isEmail().withMessage('Email invalide'),
  ],
  targetController.updateTarget // Appelle la fonction du nouveau contrôleur
);*/

/**
 * DELETE /api/campaigns/:id/targets/:targetId
 * Supprime une cible spécifique d'une campagne
 
router.delete(
  '/:id/targets/:targetId',
  fakeAuthMiddleware,
  [
    param('id').isMongoId().withMessage('ID de campagne invalide'),
    param('targetId').isMongoId().withMessage('ID de cible invalide')
  ],
  targetController.deleteTarget // Appelle la fonction du nouveau contrôleur
);*/

module.exports = router;
