// src/routes/campaigns.js
const express = require('express');
const { body } = require('express-validator');
const campaignController = require('../controllers/campaignController');

const router = express.Router();

// Step 0
router.put(
  '/:id/step/0',
  [
    body('name').notEmpty().withMessage('Le nom est requis'),
    body('startDate').isISO8601().withMessage('Date invalide').toDate()
  ],
  campaignController.updateStep0
);

// Plus tard : router.put('/:id/step/1', validation..., campaignController.updateStep1);

module.exports = router;
