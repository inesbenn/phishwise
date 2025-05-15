require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const morgan   = require('morgan');
const cors     = require('cors');


const app = express();

// Debug
app.use((req, res, next) => {
  console.log(`🔍 ${req.method} ${req.originalUrl}`);
  next();
});

// Middlewares globaux
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Connexion MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connecté'))
  .catch(err => console.error(err));

// **ATTENTION : IMPORT ET MONTAGE DES ROUTES ICI**
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

const campaignRoutes = require('./routes/campaigns');
app.use('/api/campaigns', campaignRoutes);



// Routes supplémentaires
app.get('/',    (req, res) => res.json({ message: 'OK' }));
app.get('/health', (req, res) => res.send('OK'));

// 404 et gestion erreurs
app.use((req, res) => res.status(404).json({ error: 'Route non trouvée' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur serveur' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Serveur sur port ${PORT}`));
module.exports = app;