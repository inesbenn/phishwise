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
}

// NOTE: Les fonctions 'updateStep1', 'getTargets', 'updateTarget', 'deleteTarget' ont été déplacées vers src/controllers/targetController.js
