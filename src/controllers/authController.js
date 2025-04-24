// src/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');

// — Register
exports.register = async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);   // Hash du mot de passe :contentReference[oaicite:8]{index=8}
  const user = await User.create({ firstName, lastName, email, password: hash });
  res.status(201).json({ message: 'Utilisateur créé', userId: user._id });
};

// — Login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User
    .findOne({ email })
    .select('+password +status +refreshToken');    // On inclut explicitement password :contentReference[oaicite:9]{index=9}
  if (!user) return res.status(401).json({ message: 'Utilisateur non trouvé' });
  if (user.status !== 'active') return res.status(403).json({ message: 'Compte inactif' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: 'Mot de passe incorrect' });
  // Création tokens
  const accessToken  = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '15m' });  
  const refreshToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });  // Best practices :contentReference[oaicite:10]{index=10}
  user.refreshToken = refreshToken;
  await user.save();
  res.json({ accessToken, refreshToken });
};

// — Refresh Token
exports.refreshToken = async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ message: 'Token manquant' });
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ message: 'Token invalide' }); }
  const user = await User.findById(payload.userId);
  if (!user || user.refreshToken !== token)
    return res.status(403).json({ message: 'Token révoqué' });
  const newAccessToken = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '15m' });
  res.json({ accessToken: newAccessToken });
};

// — Logout
exports.logout = async (req, res) => {
  const { token } = req.body;
  if (token) await User.updateOne({ refreshToken: token }, { $unset: { refreshToken: 1 } });
  res.json({ message: 'Déconnexion réussie' });
};

// — Forgot Password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
  const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  // TODO: envoyer resetToken par email (nodemailer)
  res.json({ message: 'Email de réinitialisation envoyé' });
};

// — Reset Password
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const hash = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(userId, { password: hash });
    return res.json({ message: 'Mot de passe réinitialisé' });
  } catch {
    return res.status(400).json({ message: 'Token invalide ou expiré' });
  }
};
