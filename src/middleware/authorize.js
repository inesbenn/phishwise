const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Accès refusé - Privilèges insuffisants',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
};

module.exports = { authorize };