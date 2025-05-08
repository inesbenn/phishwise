// src/routes/auth.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController'); // nom exact

const router = express.Router();

// middleware de validation commun
const validate = (checks) => [
  ...checks,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) 
      return res.status(400).json({ errors: errors.array() });
    next();
  }
];

// Routes corrigées :
router.post(
    '/register',
    validate([
      body('firstName').notEmpty().withMessage('Le prénom est requis'),
      body('lastName').notEmpty().withMessage('Le nom est requis'),
      body('email')
        .isEmail().withMessage('Format email invalide')
        .normalizeEmail(),
      body('password')
        .isLength({ min: 6 }).withMessage('6 caractères minimum requis')
        .matches(/[0-9]/).withMessage('Doit contenir un chiffre'),
      body('role')
        .optional().isIn(['Admin','Manager','Analyste','Cible']).withMessage('Rôle invalide')
    ]),
    authController.register
  );

router.post(
  '/login',
  validate([ body('email').isEmail(), body('password').exists() ]),
  authController.login
);

router.post(
  '/refresh',
  authController.refreshToken       // corriger la typo authControllerl → authController
);

router.post(
  '/logout',
  authController.logout
);

router.post(
  '/forgot-password',
  validate([ body('email').isEmail() ]),
  authController.forgotPassword
);

router.post(
  '/reset-password',
  validate([ body('token').exists(), body('newPassword').isLength({ min: 6 }) ]),
  authController.resetPassword
);

module.exports = router;