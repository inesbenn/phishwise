// src/middleware/learningRedirect.js
const Campaign = require('../models/Campaign');
const jwt = require('jsonwebtoken');

const generateLearningToken = (campaignId, targetEmail) => {
    return jwt.sign(
        { campaignId, targetEmail, type: 'learning' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
};

const handlePhishingSubmission = async (req, res, next) => {
    try {
        const { campaignId } = req.params;
        const targetEmail = req.body.email || req.body.targetEmail;
        
        const campaign = await Campaign.findById(campaignId);
        
        if (!campaign || !campaign.step6?.redirectToLearning) {
            return next(); // Continuer avec la logique normale
        }
        
        // Générer un token d'accès pour l'apprentissage
        const token = generateLearningToken(campaignId, targetEmail);
        
        // URL de redirection vers la plateforme d'apprentissage
        const learningUrl = campaign.step6.learningPageUrl || 
            `${process.env.FRONTEND_URL}/learning/${campaignId}/${encodeURIComponent(targetEmail)}?token=${token}`;
        
        // Rediriger vers la plateforme d'apprentissage
        res.redirect(learningUrl);
        
    } catch (error) {
        console.error('Erreur lors de la redirection vers l\'apprentissage:', error);
        next(); // Continuer avec la logique normale en cas d'erreur
    }
};

module.exports = {
    generateLearningToken,
    handlePhishingSubmission
};