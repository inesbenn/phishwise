// src/controllers/campaignController.js
const { validationResult } = require('express-validator');
const Campaign = require('../models/Campaign');

exports.updateStep0 = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const camp = await Campaign.findByIdAndUpdate(
      req.params.id,
      { name: req.body.name, startDate: req.body.startDate },
      { new: true }
    );
    res.json(camp);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// À terme, exportez aussi updateStep1, updateStep2, etc.
