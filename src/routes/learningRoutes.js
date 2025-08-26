// routes/learningRoutes.js - CORRECTION COMPLETE
const express = require('express');
const LearningController = require('../controllers/LearningController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// ============ ROUTE DE TEST TEMPORAIRE ============
router.post('/formations/no-auth', async (req, res) => {
    try {
        const Formation = require('../models/Formation');
        const User = require('../models/User');
                
        console.log('🧪 Test de création de formation sans authentification');
        console.log('Body reçu:', JSON.stringify(req.body, null, 2));
                   
        let testUser = await User.findOne({ email: 'inestestt@example.com' });
        
        if (!testUser) {
            testUser = new User({
                name: 'inestest',
                email: 'inestestt@example.com',
                password: 'test1234',
                role: 'admin'
            });
            await testUser.save();
            console.log('✅ Utilisateur test créé avec ID:', testUser._id);
        } else {
            console.log('✅ Utilisateur test trouvé avec ID:', testUser._id);
        }
                
        const formation = new Formation({
            ...req.body,
            createdBy: testUser._id
        });
                
        console.log('💾 Tentative de sauvegarde de la formation...');
        await formation.save();
        console.log('✅ Formation sauvegardée avec succès');
                
        res.status(201).json({
            success: true,
            data: formation,
            message: '🧪 Formation créée avec succès (mode test sans auth)',
            testUser: {
                id: testUser._id,
                email: testUser.email,
                name: testUser.name
            }
        });
            
    } catch (error) {
        console.error('❌ Erreur lors de la création de formation (test):', error);
        res.status(400).json({
            success: false,
            message: 'Erreur lors de la création de la formation',
            error: error.message,
            details: error.errors
        });
    }
});

// ============ ROUTES FORMATIONS (ADMIN) ============
router.get('/formations', LearningController.getAllFormations);
router.post('/formations', authMiddleware, LearningController.createFormation);
router.get('/formations/:id', authMiddleware, LearningController.getFormation);
router.put('/formations/:id', LearningController.updateFormation);
router.delete('/formations/:id', authMiddleware, LearningController.deleteFormation);

// ============ ROUTES CAMPAGNES (ADMIN) ============
router.post('/campaigns/:campaignId/assign-formations', authMiddleware, LearningController.assignFormationsToCampaign);
router.get('/campaigns/:campaignId/stats', authMiddleware, LearningController.getCampaignStats);

// ============ ROUTES UTILISATEURS (PUBLIQUES) ============

// CORRECTION PRINCIPALE: Route corrigée pour correspondre à l'URL attendue
// Ancienne route mal nommée: /campaigns/:campaignId/users/:targetEmail/formations
// Nouvelle route correcte: /campaigns/:campaignId/:targetEmail/formations
router.get('/campaigns/:campaignId/:targetEmail/formations', (req, res, next) => {
    console.log(`📚 Route formations appelée - Campaign: ${req.params.campaignId}, Email: ${req.params.targetEmail}`);
    
    // Mapper vers la méthode existante du contrôleur
    req.params.targetEmail = req.params.targetEmail;
    LearningController.getCampaignFormations(req, res);
});

// Route alternative pour compatibilité (garder l'ancienne si utilisée ailleurs)
router.get('/campaigns/:campaignId/users/:targetEmail/formations', (req, res, next) => {
    console.log(`📚 Route formations (format alternatif) - Campaign: ${req.params.campaignId}, Email: ${req.params.targetEmail}`);
    LearningController.getCampaignFormations(req, res);
});

// CORRECTION: Routes de progression avec logging amélioré
router.post('/progress/start-formation', (req, res) => {
    console.log('🚀 Démarrage formation:', req.body);
    LearningController.startFormation(req, res);
});

router.post('/progress/submit-module', (req, res) => {
    console.log('📝 Soumission module:', req.body);
    LearningController.submitModuleProgress(req, res);
});

// ============ ROUTES DE DEBUG ET TEST ============

// Route de test pour vérifier la récupération des formations d'une campagne
router.get('/test/campaigns/:campaignId/:targetEmail', async (req, res) => {
    try {
        const { campaignId, targetEmail } = req.params;
        
        console.log(`🧪 Test formations - Campaign: ${campaignId}, Email: ${targetEmail}`);
        
        const Campaign = require('../models/Campaign');
        const campaign = await Campaign.findById(campaignId);
        
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campagne non trouvée'
            });
        }
        
        const target = campaign.targets.find(t => t.email === targetEmail);
        
        if (!target) {
            return res.status(404).json({
                success: false,
                message: 'Email non trouvé dans les cibles',
                availableEmails: campaign.targets.map(t => t.email)
            });
        }
        
        res.json({
            success: true,
            campaign: {
                id: campaign._id,
                name: campaign.name,
                totalTargets: campaign.targets.length
            },
            target: {
                firstName: target.firstName,
                lastName: target.lastName,
                email: target.email
            },
            urls: {
                formations: `/api/learning/campaigns/${campaignId}/${targetEmail}/formations`,
                trainingPage: `/training/${campaignId}?email=${encodeURIComponent(targetEmail)}`
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur test formations:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du test',
            error: error.message
        });
    }
});

// Route pour générer un lien de test valide
router.get('/generate-test-link/:campaignId/:targetEmail', async (req, res) => {
    try {
        const { campaignId, targetEmail } = req.params;
        
        const Campaign = require('../models/Campaign');
        const campaign = await Campaign.findById(campaignId);
        
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campagne non trouvée'
            });
        }
        
        const target = campaign.targets.find(t => t.email === targetEmail);
        
        if (!target) {
            return res.status(404).json({
                success: false,
                message: 'Email non trouvé dans les cibles'
            });
        }
        
        const baseUrl = req.protocol + '://' + req.get('host');
        
        res.json({
            success: true,
            message: 'Liens de test générés',
            links: {
                phishing: `${baseUrl}/phishing/${campaignId}?email=${encodeURIComponent(targetEmail)}`,
                training: `${baseUrl}/training/${campaignId}?email=${encodeURIComponent(targetEmail)}`,
                formations: `${baseUrl}/api/learning/campaigns/${campaignId}/${targetEmail}/formations`,
                formationsAlt: `${baseUrl}/api/learning/campaigns/${campaignId}/users/${targetEmail}/formations`
            },
            target: {
                firstName: target.firstName,
                lastName: target.lastName,
                email: target.email
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur génération lien test:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la génération du lien',
            error: error.message
        });
    }
});

module.exports = router;
