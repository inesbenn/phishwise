require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// --- Configuration BASE_URL (CRITIQUE pour le tracking) ---  
if (!process.env.BASE_URL) { 
    const defaultBaseUrl = process.env.NODE_ENV === 'production' ? 'https://your-production-domain.com' : `http://localhost:${process.env.PORT || 3000}`;
    console.warn(`⚠️ AVERTISSEMENT: La variable d'environnement BASE_URL n'est pas définie. Le tracking pourrait échouer. Utilisation de ${defaultBaseUrl} par défaut.`);
    process.env.BASE_URL = defaultBaseUrl;
} 

// Debug des requêtes (à garder pour le développement, à désactiver en production)
app.use((req, res, next) => {
    console.log(`🔍 ${req.method} ${req.originalUrl}`);
    next();
});

// Middlewares globaux
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Servir les fichiers statiques depuis le dossier 'public' 
app.use(express.static('public')); 

// Connexion MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('✅ MongoDB connecté'))
    .catch(err => { 
        console.error('❌ Erreur de connexion MongoDB:', err); 
        process.exit(1);
    });

// Import des routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const campaignRoutes = require('./routes/campaigns');
const targetRoutes = require('./routes/targets');
const authMiddleware = require('./middleware/authMiddleware');
const modelMailRoutes = require('./routes/ModelMail');
const landingpageRoutes = require('./routes/landingpage');
const dnsRoutes = require('./routes/dns');
const emailRoutes = require('./routes/emailRoutes');
const dashboardRoutes = require('./routes/dashboard');
const trackingRoutes = require('./routes/trackingRoutes'); 
const learningRoutes = require('./routes/learningRoutes');

// NOUVEAU : Import des routes de phishing et de formation
const phishingRoutes = require('./routes/phishing');
const trainingRoutes = require('./routes/trainingRoutes');
const trackingTokenRoutes = require('./routes/trackingToken');

// Import pour la route de page clonée (ancienne méthode - à supprimer si vous utilisez les nouvelles routes)
const InteractionController = require('./controllers/DNSController');
const TrackingService = require('./services/TrackingService');
const Campaign = require('./models/Campaign');

// Routes principales
app.get('/', (req, res) => res.json({ message: 'Bienvenue sur l\'API PhishWise!' }));
app.get('/health', (req, res) => res.send('OK'));
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'API est saine' }));

// CORRECTION 1: Route de fallback /learning -> /training (DOIT ÊTRE AVANT LES AUTRES ROUTES)
app.use('/learning', (req, res) => {
    const newPath = req.originalUrl.replace('/learning', '/training');
    console.log(`🔄 Redirection automatique: ${req.originalUrl} → ${newPath}`);
    res.redirect(301, newPath);
});

// Routes d'authentification
app.use('/api/auth', authRoutes);

// Routes utilisateurs
app.use('/api/users', userRoutes); 

// Routes de campagne
app.use('/api/campaigns', campaignRoutes); 
app.use('/api/campaigns', targetRoutes);
app.use('/api/campaigns', emailRoutes);

// Autres routes API
app.use('/api', modelMailRoutes);
app.use('/api/landingpage', landingpageRoutes); 
app.use('/api/learning', learningRoutes);

// Routes d'interaction (Tracking)
app.use('/api/tracking', trackingRoutes);
app.use('/api/dns', dnsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// --- NOUVELLES ROUTES POUR LE SYSTÈME DE PHISHING ---
// Ces routes sont publiques car elles sont utilisées par les victimes

// CORRECTION 2: S'assurer que les routes phishing sont bien montées
console.log('🎣 Montage des routes de phishing sur /phishing et /api/phishing');
app.use('/phishing', phishingRoutes);
app.use('/api/phishing', phishingRoutes);
app.use('/api/trackingToken', trackingTokenRoutes);


// CORRECTION 3: S'assurer que les routes training sont bien montées
console.log('📚 Montage des routes de formation sur /training et /api/training');
app.use('/training', trainingRoutes);
app.use('/api/training', trainingRoutes);

// --- Route de redirection pour la compatibilité ---
// Redirige l'ancienne URL vers la nouvelle
app.get('/cloned-page/:campaignId', (req, res) => {
    const { campaignId } = req.params;
    const queryString = req.url.split('?')[1];
    const redirectUrl = `/phishing/${campaignId}${queryString ? '?' + queryString : ''}`;
    
    console.log(`🔄 Redirection de l'ancienne URL vers: ${redirectUrl}`);
    res.redirect(301, redirectUrl); // 301 = redirection permanente
});

// --- Route de test pour vérifier le système de phishing ---
app.get('/test-phishing/:campaignId', async (req, res) => {
    try {
        const campaignId = req.params.campaignId;
        const testEmail = req.query.email || 'test@example.com';
        
        // Vérifier que la campagne existe
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({ 
                error: 'Campagne non trouvée',
                campaignId 
            });
        }

        // Générer les liens de test
        const phishingUrl = `${req.protocol}://${req.get('host')}/phishing/${campaignId}?email=${encodeURIComponent(testEmail)}`;
        const trainingUrl = `${req.protocol}://${req.get('host')}/training/${campaignId}?email=${encodeURIComponent(testEmail)}`;
        
        res.json({
            message: 'URLs de test générées',
            campaign: {
                id: campaign._id,
                name: campaign.name
            },
            testEmail,
            urls: {
                phishing: phishingUrl,
                training: trainingUrl,
                capture: `${req.protocol}://${req.get('host')}/api/phishing/${campaignId}/capture`
            },
            instructions: [
                '1. Cliquez sur l\'URL de phishing pour tester la page clonée',
                '2. Remplissez le formulaire et cliquez sur "Se connecter"',
                '3. Vous devriez être redirigé vers la page de formation',
                '4. Vérifiez que les données sont bien capturées dans la base'
            ]
        });

    } catch (error) {
        console.error('❌ Erreur test phishing:', error);
        res.status(500).json({
            error: 'Erreur lors de la génération des liens de test',
            details: error.message
        });
    }
});

// CORRECTION 4: Route de debug pour vérifier toutes les routes montées
app.get('/debug/routes', (req, res) => {
    const routes = [];
    
    function extractRoutes(stack, basePath = '') {
        stack.forEach((layer) => {
            if (layer.route) {
                // Route directe
                routes.push({
                    path: basePath + layer.route.path,
                    methods: Object.keys(layer.route.methods),
                    type: 'route'
                });
            } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
                // Sous-routeur
                const routerPath = layer.regexp.source
                    .replace('\\', '')
                    .replace('^', '')
                    .replace('$', '')
                    .replace('/?', '')
                    .replace('(?=\\/|$)', '');
                
                const cleanPath = routerPath.replace(/\\\//g, '/').replace(/\(\?\:\(\?\:\[\^\\\/\]\)\+\|\$\)/g, '');
                
                routes.push({
                    path: basePath + cleanPath,
                    type: 'router',
                    routes: layer.handle.stack.length
                });
                
                extractRoutes(layer.handle.stack, basePath + cleanPath);
            }
        });
    }
    
    extractRoutes(app._router.stack);
    
    res.json({
        totalRoutes: routes.length,
        routes: routes.sort((a, b) => a.path.localeCompare(b.path)),
        important: {
            phishing: routes.filter(r => r.path.includes('phishing')),
            training: routes.filter(r => r.path.includes('training')),
            api: routes.filter(r => r.path.includes('/api/'))
        }
    });
});

// CORRECTION 5: Route de test simple pour vérifier les captures
app.post('/test-capture', (req, res) => {
    console.log('📊 Test de capture reçu:', req.body);
    res.json({
        success: true,
        message: 'Capture de test réussie',
        received: req.body
    });
});

// Gestion des routes non trouvées (404)
app.use((req, res) => {
    console.log(`❌ Route non trouvée: ${req.method} ${req.originalUrl}`);
    
    // Suggestions pour routes similaires
    const suggestions = [];
    if (req.originalUrl.includes('learning')) {
        suggestions.push(`Essayez ${req.originalUrl.replace('learning', 'training')}`);
    }
    if (req.originalUrl.includes('phishing') && !req.originalUrl.includes('/api/')) {
        suggestions.push(`Pour l'API: /api${req.originalUrl}`);
    }
    
    res.status(404).json({ 
        error: 'Route non trouvée',
        requested: `${req.method} ${req.originalUrl}`,
        suggestions: suggestions.length > 0 ? suggestions : ['Vérifiez /debug/routes pour voir toutes les routes disponibles']
    });
});

// Gestion globale des erreurs (500) - DOIT ÊTRE LA DERNIÈRE FONCTION MIDDLEWARE
app.use((err, req, res, next) => {
    console.error('❌ Erreur serveur:', err.stack);
    res.status(500).json({
        message: 'Erreur serveur interne',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`🔗 BASE_URL configuré pour le tracking: ${process.env.BASE_URL}`);
    console.log(`🎣 Routes de phishing disponibles sur: /phishing/:campaignId`);
    console.log(`📚 Routes de formation disponibles sur: /training/:campaignId`);
    console.log(`🧪 Test du système disponible sur: /test-phishing/:campaignId`);
    console.log(`🔍 Debug des routes disponible sur: /debug/routes`);
    console.log(`🔄 Redirection automatique /learning → /training activée`);
});

module.exports = app;
