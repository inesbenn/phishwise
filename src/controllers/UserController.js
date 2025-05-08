// src/controllers/userController.js
const bcrypt = require('bcrypt');
const User   = require('../models/User');

// GET /api/users
exports.listUsers = async (req, res) => {
  const users = await User.find().select('-password');
  res.json(users);
};

// GET /api/users/:id
exports.getUser = async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
  res.json(user);
};

// POST /api/users
exports.createUser = async (req, res) => {
  const { firstName, lastName, email, password, role, office, country, status } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ firstName, lastName, email, password: hash, role, office, country, status });
  res.status(201).json({ message: 'Utilisateur créé', userId: user._id });
};

// PUT /api/users/:id
exports.updateUser = async (req, res) => {
  const updates = { ...req.body };
  if (updates.password) {
    updates.password = await bcrypt.hash(updates.password, 10);
  }
  const user = await User.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true, context: 'query' }
  ).select('-password');
  if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
  res.json({ message: 'Utilisateur mis à jour', user });
};

// DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
  const result = await User.findByIdAndDelete(req.params.id);
  if (!result) return res.status(404).json({ message: 'Utilisateur non trouvé' });
  res.json({ message: 'Utilisateur supprimé' });
};
