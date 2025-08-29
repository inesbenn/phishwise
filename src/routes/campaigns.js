const express = require('express');
const { body, param } = require('express-validator');
const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const Formation = require('../models/Formation');
const User = require('../models/User');
const fakeAuthMiddleware = require('../middleware/fakeAuthMiddleware');
const campaignController = require('../controllers/campaignController');

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
  campaignController.createCampaign
);

// GET /api/campaigns — renvoie toutes les campagnes
router.get(
  '/',
  fakeAuthMiddleware,
  async (req, res) => {
    try {
      const campaigns = await Campaign.find();
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
  campaignController.updateStep0
);

/**
 * PUT /api/campaigns/:id/step/6
 * Sauvegarde les données du step6 (configuration d'apprentissage)
 */
router.put(
  '/:id/step/6',
  fakeAuthMiddleware,
  [
    param('id').isMongoId().withMessage('ID de campagne invalide')
  ],
  async (req, res) => {
    try {
      const campaignId = req.params.id;
      const step6Data = req.body;
      
      console.log('Sauvegarde step6 pour campagne:', campaignId);
      console.log('Données reçues:', JSON.stringify(step6Data, null, 2));

      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }
 
      campaign.step6 = {
        ...campaign.step6,
        ...step6Data,
        isConfigured: true,
        configuredAt: new Date(),
        stats: {
          totalFormations: step6Data.assignedFormations?.length || 0,
          totalModules: 0,
          estimatedTotalTime: "À calculer",
          lastUpdated: new Date()
        }
      };
 
      if (step6Data.assignedFormations && step6Data.assignedFormations.length > 0) {
        const formationIds = step6Data.assignedFormations.map(af => af.formationId);
        const formations = await Formation.find({ _id: { $in: formationIds } });
        
        let totalModules = 0;
        formations.forEach(formation => {
          if (formation.modules) {
            totalModules += formation.modules.length;
          }
        });
        
        campaign.step6.stats.totalModules = totalModules;
      }

      await campaign.save();

      console.log('Step6 sauvegardé avec succès');

      res.status(200).json({
        success: true,
        data: campaign.step6,
        message: 'Configuration d\'apprentissage sauvegardée avec succès'
      });

    } catch (error) {
      console.error('Erreur sauvegarde step6:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la sauvegarde',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/campaigns/:id/step6
 * Récupère les données du step6
 */
router.get(
  '/:id/step6',
  fakeAuthMiddleware,
  [
    param('id').isMongoId().withMessage('ID de campagne invalide')
  ],
  async (req, res) => {
    try {
      const campaignId = req.params.id;
      
      console.log('Récupération step6 pour campagne:', campaignId);

      const campaign = await Campaign.findById(campaignId)
        .populate('step6.assignedFormations.formationId');

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }

      res.status(200).json({
        success: true,
        data: campaign.step6 || {
          assignedFormations: [],
          isConfigured: false
        }
      });

    } catch (error) {
      console.error('Erreur récupération step6:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/campaigns/:id/assign-existing-formations
 * Assigne des formations existantes à la campagne
 */
router.post(
  '/:id/assign-existing-formations',
  fakeAuthMiddleware,
  [
    param('id').isMongoId().withMessage('ID de campagne invalide'),
    body('formationIds').isArray().withMessage('formationIds doit être un tableau'),
    body('formationIds.*').isMongoId().withMessage('ID de formation invalide'),
    body('mandatory').optional().isBoolean().withMessage('mandatory doit être un booléen'),
    body('dueDate').optional().isISO8601().withMessage('Date d\'échéance invalide').toDate()
  ],
  async (req, res) => {
    try {
      const campaignId = req.params.id;
      const { formationIds, mandatory = true, dueDate = null } = req.body;
      
      console.log('Assignation formations existantes:', { campaignId, formationIds, mandatory, dueDate });

      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }
 
      const formations = await Formation.find({ 
        '_id': { $in: formationIds },
        isActive: true
      });

      if (formations.length !== formationIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Une ou plusieurs formations sont invalides ou inactives'
        });
      }
 
      const assignedFormations = formationIds.map((formationId, index) => ({
        formationId,
        assignedAt: new Date(),
        mandatory,
        dueDate,
        order: index,
        source: 'library'
      }));
 
      if (!campaign.step6) {
        campaign.step6 = {};
      }
 
      const existingAssignments = campaign.step6.assignedFormations || [];
      const newAssignments = assignedFormations.filter(newAf => 
        !existingAssignments.some(existing => 
          existing.formationId.toString() === newAf.formationId.toString()
        )
      );

      campaign.step6.assignedFormations = [...existingAssignments, ...newAssignments];
      campaign.step6.isConfigured = true;
      campaign.step6.configuredAt = new Date();

      await campaign.save();

      console.log('Formations assignées avec succès');

      res.status(200).json({
        success: true,
        data: {
          assignedFormations: campaign.step6.assignedFormations,
          newAssignments: newAssignments.length,
          totalAssignments: campaign.step6.assignedFormations.length
        },
        message: `${newAssignments.length} nouvelle(s) formation(s) assignée(s) avec succès`
      });

    } catch (error) {
      console.error('Erreur assignation formations:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'assignation des formations',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/campaigns/:id/create-wizard-formation
 * Crée une formation via wizard et l'assigne à la campagne
 */
router.post(
  '/:id/create-wizard-formation',
  fakeAuthMiddleware,
  [
    param('id').isMongoId().withMessage('ID de campagne invalide'),
    body('formationData').isObject().withMessage('Données de formation requises'),
    body('modules').isArray().withMessage('Modules requis'),
    body('assignmentOptions').optional().isObject()
  ],
  async (req, res) => {
    try {
      const campaignId = req.params.id;
      const { formationData, modules, assignmentOptions = {} } = req.body;
      
      console.log('Création formation wizard pour campagne:', campaignId);
      console.log('Données formation:', JSON.stringify(formationData, null, 2));
      console.log('Modules:', JSON.stringify(modules, null, 2));

      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }
 
      let createdBy = null;
       
      if (req.user) {
        createdBy = req.user.id;
      } else { 
        let systemUser = await User.findOne({ email: 'system@phishwise.com' });
        if (!systemUser) {
          systemUser = new User({
            name: 'Système PhishWise',
            email: 'system@phishwise.com',
            password: 'system_password_' + Date.now(),
            role: 'admin'
          });
          await systemUser.save();
          console.log('Utilisateur système créé');
        }
        createdBy = systemUser._id;
      }
 
      const newFormation = new Formation({
        title: formationData.title || 'Formation personnalisée',
        description: formationData.description || 'Formation créée via l\'assistant',
        estimatedTime: formationData.estimatedTime || '15 minutes',
        difficulty: formationData.difficulty || 'débutant',
        category: formationData.category || 'phishing',
        badge: formationData.badge || null,
        modules: modules.map((module, index) => ({
          id: module.id || index + 1,
          title: module.title,
          type: module.type,
          category: module.category || 'basics',
          content: module.content,
          duration: module.duration || '5 minutes',
          required: module.required !== undefined ? module.required : true,
          status: 'active'
        })),
        isActive: true,
        createdBy
      });

      await newFormation.save();
      console.log('Formation wizard créée avec ID:', newFormation._id);
 
      if (!campaign.step6) {
        campaign.step6 = { assignedFormations: [] };
      }

      const assignment = {
        formationId: newFormation._id,
        assignedAt: new Date(),
        mandatory: assignmentOptions.mandatory !== undefined ? assignmentOptions.mandatory : true,
        dueDate: assignmentOptions.dueDate || null,
        order: campaign.step6.assignedFormations.length,
        source: 'wizard_created',
        wizardData: {
          title: formationData.title,
          description: formationData.description,
          estimatedTime: formationData.estimatedTime,
          modules: modules
        }
      };

      campaign.step6.assignedFormations.push(assignment);
      campaign.step6.isConfigured = true;
      campaign.step6.configuredAt = new Date();

      await campaign.save();

      console.log('Formation wizard assignée à la campagne');

      res.status(201).json({
        success: true,
        data: {
          formation: newFormation,
          assignment,
          campaignStep6: campaign.step6
        },
        message: 'Formation créée et assignée avec succès'
      });

    } catch (error) {
      console.error('Erreur création formation wizard:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création de la formation',
        error: error.message,
        details: error.errors
      });
    }
  }
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
 * Lance la campagne avec programmation ou envoi immédiat
 */
router.post(
  '/:id/launch',
  fakeAuthMiddleware,
  [
    param('id').isMongoId().withMessage('ID de campagne invalide'),
    body('scheduledDate').optional().isISO8601().withMessage('Date de programmation invalide').toDate(),
    body('sendImmediately').optional().isBoolean().withMessage('sendImmediately doit être un booléen')
  ],
  campaignController.launchCampaign
);

/**
 * POST /api/campaigns/:id/cancel
 * Annule une campagne programmée
 */
router.post(
  '/:id/cancel',
  fakeAuthMiddleware,
  [
    param('id').isMongoId().withMessage('ID de campagne invalide')
  ],
  campaignController.cancelScheduledCampaign
);

/**
 * PUT /api/campaigns/:id/reschedule
 * Reprogramme une campagne avec une nouvelle date
 */
router.put(
  '/:id/reschedule',
  fakeAuthMiddleware,
  [
    param('id').isMongoId().withMessage('ID de campagne invalide'),
    body('newScheduledDate').isISO8601().withMessage('Nouvelle date programmée requise').toDate()
  ],
  campaignController.rescheduleCampaign
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

/**
 * GET /api/campaigns/scheduled
 * Récupère toutes les campagnes programmées
 */
router.get(
  '/scheduled',
  fakeAuthMiddleware,
  campaignController.getScheduledCampaigns
);

module.exports = router;
