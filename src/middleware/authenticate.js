// src/middleware/authenticate.js
const jwt = require('jsonwebtoken');
exports.authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token manquant' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.userId, role: payload.role };
    next();
  } catch {
    res.status(401).json({ message: 'Tokenhhhhhhh' });
  }
};


