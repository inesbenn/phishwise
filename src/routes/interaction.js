// src/routes/interaction.js
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { validationResult } = require('express-validator');
const Campaign = require('../models/Campaign');
const mongoose = require('mongoose');

// ===========================================
// INTERACTION TRACKING ROUTES
// ===========================================

/**
 * Enregistrer une visite de page
 * POST /api/interactions/visit
 */
router.post('/visit', [
  body('campaignId').isMongoId().withMessage('ID de campagne invalide'),
  body('pageUrl').isURL().withMessage('URL de page invalide'),
  body('userAgent').optional().isString(),
  body('referrer').optional().isString(),
  body('viewport').optional().isObject()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { campaignId, pageUrl, userAgent, referrer, viewport } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campagne non trouvée'
      });
    }

    // Ajouter l'interaction de visite
    const interaction = {
      type: 'visit',
      timestamp: new Date(),
      ipAddress,
      userAgent,
      pageUrl,
      referrer,
      viewport
    };

    campaign.step4.interactions.push(interaction);
    await campaign.save();

    res.json({
      success: true,
      message: 'Visite enregistrée'
    });

  } catch (error) {
    console.error('❌ Erreur enregistrement visite:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

/**
 * Enregistrer un clic
 * POST /api/interactions/click
 */
router.post('/click', [
  body('campaignId').isMongoId().withMessage('ID de campagne invalide'),
  body('clickedUrl').isURL().withMessage('URL cliquée invalide'),
  body('linkText').optional().isString(),
  body('pageUrl').optional().isURL()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { campaignId, clickedUrl, linkText, pageUrl } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campagne non trouvée'
      });
    }

    // Ajouter l'interaction de clic
    const interaction = {
      type: 'click',
      timestamp: new Date(),
      ipAddress,
      userAgent,
      pageUrl,
      clickedUrl,
      linkText
    };

    campaign.step4.interactions.push(interaction);
    await campaign.save();

    res.json({
      success: true,
      message: 'Clic enregistré'
    });

  } catch (error) {
    console.error('❌ Erreur enregistrement clic:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

/**
 * Enregistrer une soumission de formulaire
 * POST /api/interactions/submit
 */
router.post('/submit', [
  body('campaignId').isMongoId().withMessage('ID de campagne invalide'),
  body('formData').isObject().withMessage('Données de formulaire invalides'),
  body('pageUrl').optional().isURL()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { campaignId, formData, pageUrl } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    const referrer = req.get('Referrer');

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campagne non trouvée'
      });
    }

    // Ajouter la soumission
    const submission = {
      submittedAt: new Date(),
      userAgent,
      ipAddress,
      referrer,
      url: pageUrl,
      formData,
      targetEmail: formData.email || null,
      metadata: {
        timestamp: new Date(),
        source: 'landing_page'
      }
    };

    campaign.step4.submissions.push(submission);
    await campaign.save();

    res.json({
      success: true,
      message: 'Soumission enregistrée'
    });

  } catch (error) {
    console.error('❌ Erreur enregistrement soumission:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

/**
 * Obtenir les statistiques d'interaction pour une campagne
 * GET /api/interactions/stats/:campaignId
 */
router.get('/stats/:campaignId', [
  param('campaignId').isMongoId().withMessage('ID de campagne invalide')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { campaignId } = req.params;

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campagne non trouvée'
      });
    }

    const interactions = campaign.step4.interactions || [];
    const submissions = campaign.step4.submissions || [];

    const stats = {
      totalVisits: interactions.filter(i => i.type === 'visit').length,
      totalClicks: interactions.filter(i => i.type === 'click').length,
      totalSubmissions: submissions.length,
      uniqueVisitors: [...new Set(interactions.map(i => i.ipAddress))].length,
      conversionRate: interactions.filter(i => i.type === 'visit').length > 0 
        ? (submissions.length / interactions.filter(i => i.type === 'visit').length * 100).toFixed(2) + '%'
        : '0%'
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Erreur récupération statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

module.exports = router;