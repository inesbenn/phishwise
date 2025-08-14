require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
const fs = require('fs'); // Ajout pour la lecture des fichiers HTML
const path = require('path'); // Ajout pour la manipulation des chemins de fichiers

const app = express();

// --- Configuration BASE_URL (CRITIQUE pour le tracking) ---
// S'assure que BASE_URL est défini. Il sera utilisé par le script de tracking.
if (!process.env.BASE_URL) {
    // Si BASE_URL n'est pas dans .env, utilise un fallback, mais affiche un avertissement.
    const defaultBaseUrl = process.env.NODE_ENV === 'production' ? 'https://your-production-domain.com' : `http://localhost:${process.env.PORT || 3000}`;
    console.warn(`⚠️ AVERTISSEMENT: La variable d'environnement BASE_URL n'est pas définie. Le tracking pourrait échouer. Utilisation de ${defaultBaseUrl} par défaut.`);
    process.env.BASE_URL = defaultBaseUrl;
}
// -----------------------------------------------------------

// Debug des requêtes (à garder pour le développement, à désactiver en production)
app.use((req, res, next) => {
    console.log(`🔍 ${req.method} ${req.originalUrl}`);
    next();
});

// Middlewares globaux
app.use(cors());
app.use(express.json()); // Pour parser les corps de requête JSON
app.use(express.urlencoded({ extended: true })); // Pour parser les corps de requête URL-encoded
app.use(morgan('dev')); // Logger les requêtes HTTP

// Servir les fichiers statiques depuis le dossier 'public'
// C'est CRUCIAL pour que tes pages clonées puissent charger leurs images, CSS, etc.
app.use(express.static('public'));


// Connexion MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('✅ MongoDB connecté'))
    .catch(err => {
        console.error('❌ Erreur de connexion MongoDB:', err);
        // Quitter l'application si la connexion à la BDD échoue
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
const dashboardRoutes = require('./routes/dashboard');// ✅ Ajout de l'import des routes email
// Import du contrôleur d'interaction et du service de tracking pour la route de page clonée
const learningRoutes = require('./routes/learningRoutes');
const InteractionController = require('./controllers/DNSController');
const TrackingService = require('./services/TrackingService'); // Pour l'injection du script
const Campaign = require('./models/Campaign'); // Pour récupérer les infos de campagne


// Routes principales
app.get('/', (req, res) => res.json({ message: 'Bienvenue sur l\'API PhishWise!' }));
app.get('/health', (req, res) => res.send('OK')); // Route de health check simple
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'API est saine' })); // Route de health check pour l'API

// Routes d'authentification
app.use('/api/auth', authRoutes);

// Routes utilisateurs (peuvent être protégées)
app.use('/api/users', userRoutes);

// ⚠️ Middleware d'authentification global
// Si tu veux l'activer, décommente la ligne suivante pour protéger la plupart de tes API :
// app.use(authMiddleware);

// Routes de campagne
app.use('/api/campaigns', campaignRoutes);
// Les routes de cible peuvent être imbriquées dans campaigns ou séparées si elles sont très indépendantes.
// Si targetRoutes contient des routes comme /api/campaigns/:campaignId/targets, c'est bon.
app.use('/api/campaigns', targetRoutes);
app.use('/api/campaigns', emailRoutes); // ✅ Ajout des routes email

// Autres routes API
app.use('/api', modelMailRoutes);
app.use('/api/landingpage', landingpageRoutes);

app.use('/api/learning', learningRoutes);

// --- Routes d'Interaction (Tracking) ---
// Ces routes sont généralement publiques car elles sont appelées depuis les pages clonées.
app.use('/api/dns', dnsRoutes);
app.use('/api/dashboard', dashboardRoutes); 
// ----------------------------------------


// --- Route pour servir les pages clonées ---
// Cette route est CRUCIALE et doit être publique pour que les victimes puissent y accéder.
app.get('/cloned-page/:campaignId', async (req, res) => {
    try {
        const campaignId = req.params.campaignId;
        
        // Validation simple de l'ID de campagne
        if (!mongoose.Types.ObjectId.isValid(campaignId)) {
            return res.status(400).send('ID de campagne invalide.');
        }

        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            console.warn(`Tentative d'accès à une page clonée pour une campagne inexistante: ${campaignId}`);
            return res.status(404).send('Page de campagne non trouvée.');
        }

        // Assurez-vous que campaign.step4.clonedTemplateName est bien défini.
        // Ce champ devrait stocker le nom du fichier HTML (ex: "microsoft", "linkedin")
        const clonedTemplateName = campaign.step4.clonedTemplateName; 
        if (!clonedTemplateName) {
            console.error(`Nom de template cloné manquant pour la campagne ${campaignId}`);
            return res.status(500).send('Configuration de page clonée manquante.');
        }

        const templatePath = path.join(__dirname, 'public', 'cloned-templates', `${clonedTemplateName}.html`);
        
        if (!fs.existsSync(templatePath)) {
            console.error(`Fichier template non trouvé pour la campagne ${campaignId}: ${templatePath}`);
            return res.status(404).send('Page clonée introuvable sur le serveur.');
        }

        let htmlContent = fs.readFileSync(templatePath, 'utf8');

        // Injecte le code de tracking avec l'ID de la campagne comme token
        // Le script client côté page clonée utilisera ce campaignId pour toutes ses requêtes d'API de tracking.
        htmlContent = TrackingService.injectTrackingCode(htmlContent, campaignId); 

        res.set('Content-Type', 'text/html'); // S'assure que le navigateur interprète comme du HTML
        res.send(htmlContent);

    } catch (error) {
        console.error('❌ Erreur lors du service de la page clonée:', error);
        res.status(500).send('Erreur lors du chargement de la page clonée.');
    }
});
// ---------------------------------------------


// Gestion des routes non trouvées (404)
app.use((req, res) => {
    console.log(`❌ Route non trouvée: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: 'Route non trouvée' });
});

// Gestion globale des erreurs (500) - DOIT ÊTRE LA DERNIÈRE FONCTION MIDDLEWARE
app.use((err, req, res, next) => {
    console.error('❌ Erreur serveur:', err.stack); // Log complet de l'erreur
    res.status(500).json({
        message: 'Erreur serveur interne',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined // Affiche le message d'erreur en dev
    });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`🔗 BASE_URL configuré pour le tracking: ${process.env.BASE_URL}`);
});

module.exports = app;
