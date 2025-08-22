// src/controllers/campaignController.js
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Campaign = require('../models/Campaign');

// POST /api/campaigns - Crée une nouvelle campagne
exports.createCampaign = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error("ERREUR DE VALIDATION (createCampaign):", errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  let userId;
  try {
    userId = new mongoose.Types.ObjectId(req.user.id);
    console.log("INFO (createCampaign): ID Utilisateur reçu de req.user.id =", req.user.id);
    console.log("INFO (createCampaign): ID Utilisateur converti en ObjectId =", userId);
  } catch (err) {
    console.error("ERREUR (createCampaign): Échec de la conversion de l'ID utilisateur :", err.message);
    return res.status(400).json({ message: 'ID utilisateur invalide' });
  }

  try {
    const campaign = new Campaign({
      name: req.body.name,
      startDate: req.body.startDate,
      createdBy: userId
    });
    console.log("INFO (createCampaign): Tentative de sauvegarde de la campagne avec les données :", campaign.toObject());
    await campaign.save();
    console.log("SUCCÈS (createCampaign): Campagne sauvegardée ! ID :", campaign._id);
    res.status(201).json(campaign);
  } catch (err) {
    console.error("ERREUR (createCampaign): Erreur lors de la sauvegarde de la campagne dans MongoDB :", err);
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/campaigns/:id/step/0 - Met à jour les paramètres généraux (nom, date de début)
exports.updateStep0 = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const campaign = await Campaign.findByIdAndUpdate( // Renommé 'camp' en 'campaign' pour la cohérence
      req.params.id,
      {
        name: req.body.name,
        startDate: req.body.startDate
      },
      { new: true, runValidators: true }
    );
    if (!campaign) {
      return res.status(404).json({ message: 'Campagne non trouvée pour la mise à jour des paramètres généraux' });
    }
    console.log("SUCCÈS (updateStep0): Paramètres généraux de la campagne mis à jour. ID Campagne:", campaign._id);
    res.json(campaign);
  } catch (err) {
    console.error("ERREUR (updateStep0): Erreur lors de la mise à jour des paramètres généraux de la campagne :", err);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/campaigns/:id/complete - Récupère toutes les données de la campagne pour la validation finale
exports.getCampaignCompleteData = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de campagne invalide' });
    }

    // Récupérer la campagne avec toutes ses données
    const campaign = await Campaign.findById(id).lean();

    if (!campaign) {
      return res.status(404).json({ message: 'Campagne non trouvée' });
    }

    // Structurer les données pour la validation finale
    const completeData = {
      // Informations générales
      id: campaign._id,
      name: campaign.name,
      startDate: campaign.startDate,
      status: campaign.status,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,

      // Step 0 - Paramètres généraux (déjà dans les champs principaux)
      step0: {
        name: campaign.name,
        startDate: campaign.startDate
      },

      // Step 1 - Cibles
      step1: {
        targets: campaign.targets || [],
        totalTargets: campaign.targets ? campaign.targets.length : 0
      },

      // Step 2 - Actualités et suggestions
      step2: {
        filters: campaign.step2?.filters || {},
        selectedNews: campaign.step2?.news || [],
        suggestions: campaign.step2?.suggestions || [],
        hasData: !!(campaign.step2?.news?.length || campaign.step2?.suggestions?.length)
      },

      // Step 3 - Templates d'emails
      step3: {
        templates: campaign.step3?.templates || [],
        selectedTemplate: campaign.step3?.selectedTemplate ? 
          campaign.step3.templates?.find(t => t.id === campaign.step3.selectedTemplate) : null,
        hasSelectedTemplate: !!campaign.step3?.selectedTemplate
      },

      // Step 4 - Landing Page
      step4: {
        type: campaign.step4?.type,
        originalUrl: campaign.step4?.originalUrl,
        clonedUrl: campaign.step4?.clonedUrl,
        previewUrl: campaign.step4?.previewUrl,
        selectedTemplate: campaign.step4?.selectedTemplate,
        status: campaign.step4?.status || 'pending',
        postSubmissionActions: campaign.step4?.postSubmissionActions || {},
        isConfigured: !!(campaign.step4?.clonedUrl || campaign.step4?.selectedTemplate)
      },

      // Step 5 - Configuration SMTP
      step5: {
        fromEmail: campaign.step5?.fromEmail,
        fromName: campaign.step5?.fromName,
        domain: campaign.step5?.domain,
        dnsValidation: campaign.step5?.dnsValidation || {
          spf: { status: 'pending' },
          dkim: { status: 'pending' },
          dmarc: { status: 'pending' }
        },
        validationComplete: campaign.step5?.validationComplete || false,
        isConfigured: campaign.step5?.isConfigured || false
      },

      // Step 6 - Formation
      step6: {
        configurationType: campaign.step6?.configurationType || 'existing',
        assignedFormations: campaign.step6?.assignedFormations || [],
        learningPageConfig: campaign.step6?.learningPageConfig || {},
        redirectToLearning: campaign.step6?.redirectToLearning !== false,
        stats: campaign.step6?.stats || { totalFormations: 0, totalModules: 0 },
        isConfigured: campaign.step6?.isConfigured || false
      },

      // Statut de validation globale
      validationStatus: {
        hasTargets: campaign.targets && campaign.targets.length > 0,
        hasEmailTemplate: !!(campaign.step3?.selectedTemplate),
        hasLandingPage: !!(campaign.step4?.clonedUrl || campaign.step4?.selectedTemplate),
        hasSMTPConfig: !!(campaign.step5?.isConfigured),
        hasFormation: !!(campaign.step6?.assignedFormations?.length > 0),
        overallStatus: calculateOverallStatus(campaign)
      }
    };

    console.log("SUCCÈS (getCampaignCompleteData): Données complètes récupérées pour la campagne:", id);
    res.json(completeData);

  } catch (err) {
    console.error("ERREUR (getCampaignCompleteData): Erreur lors de la récupération des données complètes :", err);
    res.status(500).json({ message: err.message });
  }
};

// POST /api/campaigns/:id/launch - Lance la campagne
exports.launchCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const launchData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de campagne invalide' });
    }

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campagne non trouvée' });
    }

    // Vérifications avant lancement
    const validationErrors = validateCampaignForLaunch(campaign);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        message: 'La campagne ne peut pas être lancée',
        errors: validationErrors 
      });
    }

    // Mettre à jour le statut de la campagne
    campaign.status = 'running';
    campaign.launchedAt = new Date();
    
    // Ajouter des données de lancement si fournies
    if (launchData.scheduledDate) {
      campaign.scheduledLaunchDate = new Date(launchData.scheduledDate);
    }

    await campaign.save();

    // Ici, vous pourriez déclencher l'envoi des emails, etc.
    // await triggerEmailSending(campaign);

    console.log("SUCCÈS (launchCampaign): Campagne lancée avec succès. ID:", id);
    res.json({ 
      message: 'Campagne lancée avec succès',
      campaign: {
        id: campaign._id,
        name: campaign.name,
        status: campaign.status,
        launchedAt: campaign.launchedAt
      }
    });

  } catch (err) {
    console.error("ERREUR (launchCampaign): Erreur lors du lancement de la campagne :", err);
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/campaigns/:id/draft - Sauvegarde la campagne en brouillon
exports.saveCampaignAsDraft = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de campagne invalide' });
    }

    const campaign = await Campaign.findByIdAndUpdate(
      id,
      { 
        status: 'draft',
        lastSavedAsDraft: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!campaign) {
      return res.status(404).json({ message: 'Campagne non trouvée' });
    }

    console.log("SUCCÈS (saveCampaignAsDraft): Campagne sauvegardée en brouillon. ID:", id);
    res.json({ 
      message: 'Campagne sauvegardée en brouillon',
      campaign: {
        id: campaign._id,
        name: campaign.name,
        status: campaign.status
      }
    });

  } catch (err) {
    console.error("ERREUR (saveCampaignAsDraft): Erreur lors de la sauvegarde en brouillon :", err);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/campaigns/:id/validation-status - Récupère le statut de validation
exports.getCampaignValidationStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de campagne invalide' });
    }

    const campaign = await Campaign.findById(id).lean();
    if (!campaign) {
      return res.status(404).json({ message: 'Campagne non trouvée' });
    }

    const validationStatus = {
      hasTargets: campaign.targets && campaign.targets.length > 0,
      hasEmailTemplate: !!(campaign.step3?.selectedTemplate),
      hasLandingPage: !!(campaign.step4?.clonedUrl || campaign.step4?.selectedTemplate),
      hasSMTPConfig: !!(campaign.step5?.isConfigured),
      hasFormation: !!(campaign.step6?.assignedFormations?.length > 0),
      
      // Détails par étape
      steps: {
        step1: {
          completed: campaign.targets && campaign.targets.length > 0,
          count: campaign.targets ? campaign.targets.length : 0
        },
        step2: {
          completed: !!(campaign.step2?.news?.length || campaign.step2?.suggestions?.length),
          newsCount: campaign.step2?.news?.length || 0,
          suggestionsCount: campaign.step2?.suggestions?.length || 0
        },
        step3: {
          completed: !!(campaign.step3?.selectedTemplate),
          templatesCount: campaign.step3?.templates?.length || 0,
          selectedTemplate: campaign.step3?.selectedTemplate
        },
        step4: {
          completed: !!(campaign.step4?.clonedUrl || campaign.step4?.selectedTemplate),
          type: campaign.step4?.type,
          status: campaign.step4?.status
        },
        step5: {
          completed: campaign.step5?.isConfigured || false,
          dnsStatus: {
            spf: campaign.step5?.dnsValidation?.spf?.status || 'pending',
            dkim: campaign.step5?.dnsValidation?.dkim?.status || 'pending',
            dmarc: campaign.step5?.dnsValidation?.dmarc?.status || 'pending'
          }
        },
        step6: {
          completed: campaign.step6?.isConfigured || false,
          formationsCount: campaign.step6?.assignedFormations?.length || 0
        }
      },
      
      overallStatus: calculateOverallStatus(campaign),
      readyForLaunch: isReadyForLaunch(campaign),
      validationErrors: validateCampaignForLaunch(campaign)
    };

    res.json(validationStatus);

  } catch (err) {
    console.error("ERREUR (getCampaignValidationStatus): Erreur lors de la récupération du statut :", err);
    res.status(500).json({ message: err.message });
  }
};

// Fonctions utilitaires pour la validation

function calculateOverallStatus(campaign) {
  const completedSteps = [
    campaign.targets && campaign.targets.length > 0,
    !!(campaign.step3?.selectedTemplate),
    !!(campaign.step4?.clonedUrl || campaign.step4?.selectedTemplate),
    !!(campaign.step5?.isConfigured),
    !!(campaign.step6?.assignedFormations?.length > 0)
  ].filter(Boolean).length;

  if (completedSteps === 5) return 'ready';
  if (completedSteps >= 3) return 'warning';
  return 'incomplete';
}

function isReadyForLaunch(campaign) {
  return campaign.targets && campaign.targets.length > 0 &&
         campaign.step3?.selectedTemplate &&
         (campaign.step4?.clonedUrl || campaign.step4?.selectedTemplate) &&
         campaign.step5?.isConfigured;
  // Note: La formation n'est pas obligatoire pour le lancement
}

function validateCampaignForLaunch(campaign) {
  const errors = [];

  // Vérification des cibles
  if (!campaign.targets || campaign.targets.length === 0) {
    errors.push('Aucune cible n\'a été configurée');
  }

  // Vérification du template d'email
  if (!campaign.step3?.selectedTemplate) {
    errors.push('Aucun template d\'email n\'a été sélectionné');
  }

  // Vérification de la landing page
  if (!campaign.step4?.clonedUrl && !campaign.step4?.selectedTemplate) {
    errors.push('Aucune landing page n\'a été configurée');
  }

  // Vérification de la configuration SMTP
  if (!campaign.step5?.isConfigured) {
    errors.push('La configuration SMTP n\'est pas complète');
  }

  // Vérification du nom de la campagne
  if (!campaign.name || campaign.name.trim().length === 0) {
    errors.push('Le nom de la campagne est requis');
  }

  // Vérification de la date de début
  if (!campaign.startDate) {
    errors.push('La date de début est requise');
  } else if (new Date(campaign.startDate) < new Date()) {
    errors.push('La date de début ne peut pas être dans le passé');
  }

  return errors;
}

// NOTE: Les fonctions 'updateStep1', 'getTargets', 'updateTarget', 'deleteTarget' ont été déplacées vers src/controllers/targetController.js
