require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const morgan   = require('morgan');
const cors     = require('cors')

const app = express();

// Debug des requêtes
app.use((req, res, next) => {
  console.log(`🔍 ${req.method} ${req.originalUrl}`);
  next();
});

// Middlewares globaux
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Connexion MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('✅ MongoDB connecté'))
  .catch(err => console.error(err));

// Import des routes
const authRoutes      = require('./routes/auth');
const userRoutes      = require('./routes/users');
const campaignRoutes  = require('./routes/campaigns');
const targetRoutes    = require('./routes/targets');
const authMiddleware  = require('./middleware/authMiddleware');
const modelMailRoutes = require('./routes/ModelMail');
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes)

// ⚠️ Middleware d’authentification global
// Si tu veux l’activer, décommente la ligne suivante :
// app.use(authMiddleware);

// Routes de campagne (utilisent fakeAuthMiddleware en local)
app.use('/api/campaigns', campaignRoutes);
app.use('/api/campaigns', targetRoutes);

app.use('/api', modelMailRoutes);

app.get('/', (req, res) => res.send('OK'));
app.use((req, res) => res.status(404).json({ error: 'Route non trouvée' }));



// Routes supplémentaires
app.get('/',       (req, res) => res.json({ message: 'OK' }));
app.get('/health', (req, res) => res.send('OK'));

// 404 et gestion d’erreurs
app.use((req, res) => res.status(404).json({ error: 'Route non trouvée' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur serveur' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Serveur sur port ${PORT}`));

module.exports = app;
