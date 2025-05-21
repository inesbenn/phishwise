// src/controllers/campaignController.js
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Campaign = require('../models/Campaign');

exports.createCampaign = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  // Conversion et validation de l'ID utilisateur
  let userId;
  try {
    userId = mongoose.Types.ObjectId(req.user.id);
  } catch {
    return res.status(400).json({ message: 'ID utilisateur invalide' });
  }

  try {
    const campaign = new Campaign({
      name: req.body.name,
      startDate: req.body.startDate,
      createdBy: userId
    });
    await campaign.save();
    res.status(201).json(campaign);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateStep0 = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const camp = await Campaign.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name,
        startDate: req.body.startDate
      },
      { new: true }
    );
    if (!camp) return res.status(404).json({ message: 'Campagne non trouvée' });
    res.json(camp);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}