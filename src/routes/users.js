// src/routes/users.js
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const userController = require('../controllers/UserController');
const { authorize }    = require('../middleware/authorize');
const authMiddleware = require('../middleware/authMiddleware');
const roles            = require('../config/roles');

const router = express.Router();

// Middleware de validation
const validate = checks => [
  ...checks,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    next();
  }
];

// Protéger toutes les routes utilisateurs (Admin seulement)
router.use(authMiddleware);
router.use(authorize(['Admin']));

// Lire tous
router.get('/', userController.listUsers);

// Lire un seul
router.get('/:id',
  validate([ param('id').isMongoId() ]),
  userController.getUser
);

// Créer - avec validation du mot de passe obligatoire
router.post('/',
  validate([
    body('firstName').notEmpty().withMessage('Le prénom est requis'),
    body('lastName').notEmpty().withMessage('Le nom est requis'),
    body('email').isEmail().withMessage('Email valide requis'),
    body('password')
      .isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères')
      .matches(/[0-9]/).withMessage('Le mot de passe doit contenir au moins un chiffre'),
    body('role').isIn(Object.values(roles)).withMessage('Rôle invalide'),
    body('status').isIn(['active','inactive']).withMessage('Statut invalide')
  ]),
  userController.createUser
);

// Mettre à jour - mot de passe optionnel
router.put('/:id',
  validate([
    param('id').isMongoId(),
    body('firstName').optional().notEmpty().withMessage('Le prénom ne peut pas être vide'),
    body('lastName').optional().notEmpty().withMessage('Le nom ne peut pas être vide'),
    body('email').optional().isEmail().withMessage('Email valide requis'),
    body('password').optional()
      .isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères')
      .matches(/[0-9]/).withMessage('Le mot de passe doit contenir au moins un chiffre'),
    body('role').optional().isIn(Object.values(roles)).withMessage('Rôle invalide'),
    body('status').optional().isIn(['active','inactive']).withMessage('Statut invalide')
  ]),
  userController.updateUser
);

// Supprimer
router.delete('/:id',
  validate([ param('id').isMongoId() ]),
  userController.deleteUser
);

module.exports = router;
