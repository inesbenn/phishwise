// src/routes/auth.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

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

// Public routes (no authentication required)
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
  validate([
    body('email').isEmail().withMessage('Email valide requis'),
    body('password').notEmpty().withMessage('Mot de passe requis')
  ]),
  authController.login
);

router.post(
  '/refresh',
  validate([
    body('token').notEmpty().withMessage('Refresh token requis')
  ]),
  authController.refreshToken
);

router.post(
  '/logout',
  authController.logout
);

router.post(
  '/forgot-password',
  validate([
    body('email').isEmail().withMessage('Email valide requis')
  ]),
  authController.forgotPassword
);

router.post(
  '/reset-password',
  validate([
    body('token').notEmpty().withMessage('Token requis'),
    body('newPassword').isLength({ min: 6 }).withMessage('6 caractères minimum')
  ]),
  authController.resetPassword
);

// Protected routes (authentication required)
router.get('/me', authMiddleware, authController.getCurrentUser);

module.exports = router;