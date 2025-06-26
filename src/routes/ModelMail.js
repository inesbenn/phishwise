// src/routes/ModelMail.js
const express = require('express');
const router = express.Router();
const ModelMailController = require('../controllers/ModelMailController');
// TEMPORAIREMENT DÉSACTIVÉ pour les tests
// const authMiddleware = require('../middleware/authMiddleware');
// const rateLimit = require('express-rate-limit');

// Middleware factice pour les tests (remplace l'authentification)
const fakeAuthMiddleware = (req, res, next) => {
  console.log('🔓 Mode test - authentification désactivée');
  next();
};

// Middleware factice pour remplacer le rate limiting
const fakeRateLimit = (req, res, next) => {
  console.log('⚡ Mode test - rate limiting désactivé');
  next();
};

// Routes pour les données de référence (pas besoin d'auth stricte)
router.get('/news/themes', ModelMailController.getThemes);
router.get('/news/countries', ModelMailController.getCountries);

// Routes spécifiques aux campagnes 
// TEMPORAIRE : Utilisation du middleware factice pour les tests
router.use(fakeAuthMiddleware);

// Récupération des actualités dynamiques
router.get('/campaigns/:campaignId/news', fakeRateLimit, ModelMailController.getNews);

// Sauvegarde des actualités sélectionnées
router.post('/campaigns/:campaignId/news/select', ModelMailController.selectNews);

// Génération de suggestions via IA (réactivée avec fallback temporaire)
router.post('/campaigns/:campaignId/suggestions/generate', fakeRateLimit, ModelMailController.generateSuggestions);

// Gestion des données Step 2
router.get('/campaigns/:campaignId/step2', ModelMailController.getStep2Data);
router.put('/campaigns/:campaignId/step2', ModelMailController.updateStep2Data);

module.exports = router;