// src/routes/admin.js
const express      = require('express');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const router       = express.Router();

router.use(authenticate);           // premièrement, on doit être connecté
router.use(authorize(['admin']));   // seuls les 'admin' passent

router.get('/dashboard', (req, res) => {
  res.json({ secret: 'Données sensibles admin' });
});

module.exports = router;
