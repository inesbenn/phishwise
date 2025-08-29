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

// Variable pour le service de planification (initialisé après la connexion DB)
let EmailSchedulerService = null;

// Debug des requêtes (à garder pour le développement, à désactiver en production)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`🔍 ${req.method} ${req.originalUrl}`);
        next();
    });
}

// Middlewares globaux
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

// Servir les fichiers statiques depuis le dossier 'public' 
app.use(express.static('public')); 

// Connexion MongoDB
mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(async () => {
        console.log('✅ MongoDB connecté');
        
        // INITIALISATION DU SERVICE DE PLANIFICATION APRÈS LA CONNEXION DB
        try {
            EmailSchedulerService = require('./services/EmailSchedulerService');
            console.log('📅 Service de planification des emails initialisé');
            
            // Démarrer la récupération des tâches en attente au démarrage
            if (EmailSchedulerService.startPendingJobs) {
                await EmailSchedulerService.startPendingJobs();
                console.log('🔄 Tâches d\'email en attente redémarrées');
            }
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation du service de planification:', error);
        }
    })
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
const analyticsRoutes = require('./routes/analytics'); 

// Import pour la route de page clonée (ancienne méthode - à supprimer si vous utilisez les nouvelles routes)
const InteractionController = require('./controllers/DNSController');
const TrackingService = require('./services/TrackingService');
const Campaign = require('./models/Campaign');

// Routes principales
app.get('/', (req, res) => res.json({ 
    message: 'Bienvenue sur l\'API PhishWise!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
}));

// Route de santé améliorée
app.get('/health', (req, res) => res.send('OK'));
app.get('/api/health', (req, res) => {
    const healthStatus = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
            database: mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected',
            emailScheduler: EmailSchedulerService ? '✅ Active' : '❌ Inactive',
            baseUrl: process.env.BASE_URL || '⚠️ Not configured'
        },
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
        }
    };
    
    const isHealthy = mongoose.connection.readyState === 1;
    res.status(isHealthy ? 200 : 503).json(healthStatus);
});

// Route pour obtenir le statut du scheduler d'emails
app.get('/api/scheduler/status', (req, res) => {
    if (!EmailSchedulerService) {
        return res.status(503).json({
            error: 'Service de planification non disponible',
            status: 'inactive'
        });
    }

    try {
        // Si votre EmailSchedulerService a une méthode getStatus
        const status = EmailSchedulerService.getStatus ? 
            EmailSchedulerService.getStatus() : 
            { active: true, message: 'Service actif' };
            
        res.json({
            status: 'active',
            scheduler: status,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Erreur lors de la récupération du statut',
            details: error.message
        });
    }
});

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
app.use('/api/analytics', analyticsRoutes); 

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
            emailScheduler: EmailSchedulerService ? 'Actif' : 'Inactif',
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
        emailScheduler: EmailSchedulerService ? 'Actif' : 'Inactif',
        routes: routes.sort((a, b) => a.path.localeCompare(b.path)),
        important: {
            phishing: routes.filter(r => r.path.includes('phishing')),
            training: routes.filter(r => r.path.includes('training')),
            api: routes.filter(r => r.path.includes('/api/')),
            health: routes.filter(r => r.path.includes('health'))
        }
    });
});

// CORRECTION 5: Route de test simple pour vérifier les captures
app.post('/test-capture', (req, res) => {
    console.log('📊 Test de capture reçu:', req.body);
    res.json({
        success: true,
        message: 'Capture de test réussie',
        received: req.body,
        timestamp: new Date().toISOString()
    });
});

// Route de test pour le scheduler d'emails
app.post('/test-email-scheduler', async (req, res) => {
    if (!EmailSchedulerService) {
        return res.status(503).json({
            error: 'Service de planification non disponible'
        });
    }

    try {
        // Test basique de planification (à adapter selon votre EmailSchedulerService)
        const testSchedule = {
            campaignId: 'test',
            recipientEmail: 'test@example.com',
            sendDate: new Date(Date.now() + 60000) // Dans 1 minute
        };

        console.log('📧 Test de planification d\'email:', testSchedule);
        
        res.json({
            success: true,
            message: 'Test de planification lancé',
            scheduledFor: testSchedule.sendDate,
            note: 'Vérifiez les logs pour voir l\'exécution'
        });

    } catch (error) {
        console.error('❌ Erreur test scheduler:', error);
        res.status(500).json({
            error: 'Erreur lors du test de planification',
            details: error.message
        });
    }
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
        suggestions: suggestions.length > 0 ? suggestions : ['Vérifiez /debug/routes pour voir toutes les routes disponibles'],
        availableTestRoutes: [
            '/api/health',
            '/debug/routes',
            '/test-capture',
            '/test-email-scheduler',
            '/api/scheduler/status'
        ]
    });
});

// Gestion globale des erreurs (500) - DOIT ÊTRE LA DERNIÈRE FONCTION MIDDLEWARE
app.use((err, req, res, next) => {
    console.error('❌ Erreur serveur:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Erreur serveur interne',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Erreur interne',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        timestamp: new Date().toISOString()
    });
});

// Gestion propre de l'arrêt du serveur
const gracefulShutdown = (signal) => {
    console.log(`\n${signal} reçu, arrêt propre du serveur...`);
    
    // Arrêter le scheduler d'emails si disponible
    if (EmailSchedulerService && EmailSchedulerService.shutdown) {
        console.log('📅 Arrêt du service de planification...');
        EmailSchedulerService.shutdown();
    }
    
    // Fermer la connexion MongoDB
    mongoose.connection.close(() => {
        console.log('✅ Connexion MongoDB fermée proprement');
        process.exit(0);
    });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Rejection non gérée:', reason);
    // En production, vous pourriez vouloir redémarrer l'application
});

process.on('uncaughtException', (error) => {
    console.error('❌ Exception non capturée:', error);
    process.exit(1);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur PhishWise démarré sur le port ${PORT}`);
    console.log(`🔗 BASE_URL configuré pour le tracking: ${process.env.BASE_URL}`);
    console.log(`🎣 Routes de phishing disponibles sur: /phishing/:campaignId`);
    console.log(`📚 Routes de formation disponibles sur: /training/:campaignId`);
    console.log(`📧 Service de planification: ${EmailSchedulerService ? '✅ Actif' : '❌ Inactif'}`);
    console.log(`🧪 Test du système disponible sur: /test-phishing/:campaignId`);
    console.log(`📊 Route de santé: http://localhost:${PORT}/api/health`);
    console.log(`🔍 Debug des routes: http://localhost:${PORT}/debug/routes`);
    console.log(`📅 Statut scheduler: http://localhost:${PORT}/api/scheduler/status`);
    console.log(`🔄 Redirection automatique /learning → /training activée`);
});

module.exports = app;
