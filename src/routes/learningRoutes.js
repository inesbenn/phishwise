// routes/learningRoutes.js
const express = require('express');
const LearningController = require('../controllers/LearningController');
const authMiddleware = require('../middleware/authMiddleware'); // Assurez-vous que le chemin est correct

const router = express.Router();

// ============ ROUTE DE TEST TEMPORAIRE (À SUPPRIMER EN PRODUCTION) ============
// Route temporaire pour créer des formations sans authentification
router.post('/formations/no-auth', async (req, res) => {
    try {
        const Formation = require('../models/Formation');
        const User = require('../models/User');
        
        console.log('🧪 Test de création de formation sans authentification');
        console.log('Body reçu:', JSON.stringify(req.body, null, 2));
           
        // Créer ou trouver un utilisateur test
        let testUser = await User.findOne({ email: 'inestestt@example.com' });

        if (!testUser) {
            testUser = new User({
                name: 'inestest',
                email: 'inestestt@example.com',
                password: 'test1234', // Hash factice pour les tests
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
            details: error.errors // Détails de validation Mongoose si disponibles
        });
    }
});

// ============ ROUTES NORMALES AVEC AUTHENTIFICATION ============

// Routes pour les formations (admin)
router.get('/formations', authMiddleware, LearningController.getAllFormations);
router.post('/formations', authMiddleware, LearningController.createFormation);
router.get('/formations/:id', authMiddleware, LearningController.getFormation);
router.put('/formations/:id', authMiddleware, LearningController.updateFormation);
router.delete('/formations/:id', authMiddleware, LearningController.deleteFormation);

// Routes pour les campagnes (admin)
router.post('/campaigns/:campaignId/assign-formations', authMiddleware, LearningController.assignFormationsToCampaign);
router.get('/campaigns/:campaignId/stats', authMiddleware, LearningController.getCampaignStats);

// Routes pour les utilisateurs (targets) - publiques car utilisées depuis les liens de phishing
router.get('/campaigns/:campaignId/users/:targetEmail/formations', LearningController.getCampaignFormations);
router.post('/progress/start-formation', LearningController.startFormation);
router.post('/progress/submit-module', LearningController.submitModuleProgress);

module.exports = router;