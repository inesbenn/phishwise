// src/routes/users.js
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const userController = require('../controllers/UserController');
//const { authenticate } = require('../middleware/authenticate');
//const { authorize }    = require('../middleware/authorize');
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

// Protection : seuls Admin et Manager gèrent les comptes
//router.use(authenticate);
//router.use(authorize([ roles.ADMIN, roles.MANAGER ]));

// Lire tous
router.get('/', userController.listUsers);

// Lire un seul
router.get('/:id',
  validate([ param('id').isMongoId() ]),
  userController.getUser
);

// Créer
router.post('/',
  validate([
    body('firstName').notEmpty(),
    body('lastName').notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('role').isIn(Object.values(roles)),
    body('status').isIn(['active','inactive','suspended'])
  ]),
  userController.createUser
);

// Mettre à jour
router.put('/:id',
  validate([
    param('id').isMongoId(),
    body('firstName').optional().notEmpty(),
    body('lastName').optional().notEmpty(),
    body('email').optional().isEmail(),
    body('password').optional().isLength({ min: 6 }),
    body('role').optional().isIn(Object.values(roles)),
    body('status').optional().isIn(['active','inactive','suspended'])
  ]),
  userController.updateUser
);

// Supprimer
router.delete('/:id',
  validate([ param('id').isMongoId() ]),
  userController.deleteUser
);

module.exports = router;
