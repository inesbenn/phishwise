const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const fakeAuthMiddleware = require('../middleware/fakeAuthMiddleware');

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
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    // Conversion de l'ID utilisateur factice en ObjectId
    let userId;
    try {
      userId = new mongoose.Types.ObjectId(req.user.id);
    } catch {
      // Cette fois, comme l'ID est valide, on ne devrait pas passer ici
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
    body('name')
      .notEmpty().withMessage('Le nom est requis'),
    body('startDate')
      .isISO8601().withMessage('Date invalide')
      .toDate()
  ],
  async (req, res) => {
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
      if (!camp)
        return res.status(404).json({ message: 'Campagne non trouvée' });
      res.json(camp);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
