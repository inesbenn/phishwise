// src/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');

// Register
exports.register = async (req, res) => {
  const { firstName, lastName, email, password, role } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ firstName, lastName, email, password: hash, role });
  res.status(201).json({ message: 'Utilisateur créé', userId: user._id });
};

// Login avec vérification du statut utilisateur
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User
      .findOne({ email })
      .select('+password +status +refreshToken');
    
    if (!user) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    
    // Bloquer l'accès aux utilisateurs inactifs
    if (user.status !== 'active') {
      let message = 'Accès refusé. ';
      switch (user.status) {
        case 'inactive':
          message += 'Votre compte est inactif. Contactez un administrateur.';
          break;
        default:
          message += 'Votre compte n\'est pas actif.';
      }
      return res.status(403).json({ message });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    
    // Création tokens
    const accessToken  = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    user.refreshToken = refreshToken;
    await user.save();
    
    res.json({ accessToken, refreshToken });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la connexion' });
  }
};

// Vérification du statut utilisateur lors du refresh
exports.refreshToken = async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ message: 'Token manquant' });
  
  let payload;
  try { 
    payload = jwt.verify(token, process.env.JWT_SECRET); 
  } catch { 
    return res.status(401).json({ message: 'Token invalide' }); 
  }
  
  const user = await User.findById(payload.userId);
  if (!user || user.refreshToken !== token) {
    return res.status(403).json({ message: 'Token révoqué' });
  }
  
  // Vérifier le statut de l'utilisateur
  if (user.status !== 'active') {
    return res.status(403).json({ message: 'Compte inactif. Veuillez vous reconnecter.' });
  }
  
  const newAccessToken = jwt.sign(
    { userId: user._id, role: user.role }, 
    process.env.JWT_SECRET, 
    { expiresIn: '15m' }
  );
  
  res.json({ accessToken: newAccessToken });
};

// Get current user info
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password -refreshToken');
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    // Vérifier le statut de l'utilisateur
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Compte inactif' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Error getting current user:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Logout
exports.logout = async (req, res) => {
  const { token } = req.body;
  if (token) {
    await User.updateOne({ refreshToken: token }, { $unset: { refreshToken: 1 } });
  }
  res.json({ message: 'Déconnexion réussie' });
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
  const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  // TODO: envoyer resetToken par email (nodemailer)
  res.json({ message: 'Email de réinitialisation envoyé' });
};

// Reset Password
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
}