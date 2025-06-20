
// src/middleware/fakeAuthMiddleware.js
/**
 * Middleware factice pour simuler un utilisateur connecté.
 * Ici on utilise un ObjectId MongoDB valide (24 caractères hex).
 */
module.exports = (req, res, next) => {
  req.user = { id: '680844b9c5df1636e86b5a78' }; 
  next();
};
