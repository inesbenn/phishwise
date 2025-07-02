// src/routes/landingpage.js
const express = require('express');
const { body, param } = require('express-validator');
const LandingPageController = require('../controllers/LandingPageController');
const router = express.Router();

// Middleware de validation pour l'ID de campagne
const validateCampaignId = [
  param('campaignId')
    .isMongoId()
    .withMessage('ID de campagne invalide')
];

// Middleware de validation améliorée pour l'URL à cloner
const validateCloneUrl = [
  body('url')
    .trim()
    .customSanitizer((value) => {
      // Nettoyer les URLs mal formées (double protocole)
      if (value.startsWith('https://https://') || value.startsWith('http://https://')) {
        return value.replace(/^https?:\/\//, '');
      }
      if (value.startsWith('http://http://') || value.startsWith('https://http://')) {
        return value.replace(/^https?:\/\//, '');
      }
      return value;
    })
    .isURL({ 
      protocols: ['http', 'https'], 
      require_protocol: true,
      require_host: true,
      require_valid_protocol: true
    })
    .withMessage('URL invalide. Format attendu: https://exemple.com')
    .isLength({ max: 2048 })
    .withMessage('URL trop longue (max 2048 caractères)')
    .custom((value) => {
      try {
        const url = new URL(value);
        // Vérifier que ce n'est pas une URL locale
        if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) {
          throw new Error('URLs locales non autorisées');
        }
        return true;
      } catch (error) {
        throw new Error('URL malformée');
      }
    }),
];

// Middleware de validation pour la sélection de template
const validateTemplateSelection = [
  body('template')
    .isObject()
    .withMessage('Template invalide'),
  body('template.id')
    .isInt({ min: 1 })
    .withMessage('ID de template invalide'),
  body('template.name')
    .trim()
    .notEmpty()
    .withMessage('Nom du template requis'),
  body('template.url')
    .isURL()
    .withMessage('URL du template invalide'),
  body('template.category')
    .trim()
    .notEmpty()
    .withMessage('Catégorie du template requise')
];

// Middleware de validation pour les actions post-soumission
const validatePostSubmissionActions = [
  body('postSubmissionActions')
    .isObject()
    .withMessage('Actions post-soumission invalides'),
  body('postSubmissionActions.collectData')
    .optional()
    .isBoolean()
    .withMessage('collectData doit être un booléen'),
  body('postSubmissionActions.redirectToLearning')
    .optional()
    .isBoolean()
    .withMessage('redirectToLearning doit être un booléen'),
  body('postSubmissionActions.downloadMaliciousFile')
    .optional()
    .isBoolean()
    .withMessage('downloadMaliciousFile doit être un booléen'),
  body('postSubmissionActions.redirectUrl')
    .optional()
    .isURL()
    .withMessage('URL de redirection invalide'),
  body('postSubmissionActions.maliciousFileUrl')
    .optional()
    .isURL()
    .withMessage('URL du fichier malveillant invalide')
];

/**
 * @route   GET /api/landingpage/templates
 * @desc    Obtenir la liste des templates disponibles
 * @access  Private
 * @note    Cette route doit être AVANT /:campaignId pour éviter les conflits
 */
router.get('/templates', LandingPageController.getTemplates);

/**
 * @route   GET /api/landingpage/:campaignId
 * @desc    Récupérer les données de landing page d'une campagne
 * @access  Private
 */
router.get('/:campaignId', 
  validateCampaignId,
  LandingPageController.getLandingPageData
);

/**
 * @route   POST /api/landingpage/:campaignId/clone
 * @desc    Cloner une URL pour créer une landing page
 * @access  Private
 */
router.post('/:campaignId/clone',
  [...validateCampaignId, ...validateCloneUrl],
  LandingPageController.cloneUrl
);

/**
 * @route   POST /api/landingpage/:campaignId/template
 * @desc    Sélectionner un template prédéfini
 * @access  Private
 */
router.post('/:campaignId/template',
  [...validateCampaignId, ...validateTemplateSelection],
  LandingPageController.selectTemplate
);

/**
 * @route   PUT /api/landingpage/:campaignId/post-submission
 * @desc    Mettre à jour les actions post-soumission
 * @access  Private
 */
router.put('/:campaignId/post-submission',
  [...validateCampaignId, ...validatePostSubmissionActions],
  LandingPageController.updatePostSubmissionActions
);

/**
 * @route   POST /api/landingpage/:campaignId/validate
 * @desc    Valider l'étape landing page
 * @access  Private
 */
router.post('/:campaignId/validate',
  validateCampaignId,
  LandingPageController.validateStep
);

module.exports = router;