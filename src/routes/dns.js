// routes/dns.js
const express = require('express');
const router = express.Router();
const dnsController = require('../controllers/DNSController');
const { body, param } = require('express-validator');

// ===========================================
// VALIDATIONS COMMUNES
// ===========================================

// Validation pour le domaine
const validateDomain = [
  body('domain')
    .isLength({ min: 1 })
    .withMessage('Le domaine est requis')
    .matches(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i)
    .withMessage('Format de domaine invalide')
];

// Validation pour le paramètre domaine dans l'URL
const validateDomainParam = [
  param('domain')
    .matches(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i)
    .withMessage('Format de domaine invalide')
];

// Validation pour l'ID de campagne
const validateCampaignId = [
  body('campaignId')
    .optional()
    .isMongoId()
    .withMessage('ID de campagne invalide')
];

// Validation pour l'ID de campagne en paramètre
const validateCampaignIdParam = [
  param('campaignId')
    .isMongoId()
    .withMessage('ID de campagne invalide')
];

// ===========================================
// ROUTES PRINCIPALES DE VALIDATION DNS
// ===========================================

/**
 * Valider le DNS d'un domaine avec suggestions de correction
 * POST /api/dns/validate
 * Body: { domain: string, campaignId?: string }
 */
router.post('/validate',
  validateDomain,
  validateCampaignId,
  dnsController.validateDomain
);

/**
 * Appliquer les corrections automatiques DNS
 * POST /api/dns/apply-corrections
 * Body: { domain: string, campaignId?: string }
 */
router.post('/apply-corrections',
  validateDomain,
  validateCampaignId,
  dnsController.applyCorrections
);

/**
 * Obtenir les recommandations DNS pour un domaine
 * GET /api/dns/recommendations/:domain
 */
router.get('/recommendations/:domain',
  validateDomainParam,
  dnsController.getDNSRecommendations
);

/**
 * Tester la propagation DNS
 * POST /api/dns/test-propagation
 * Body: { domain: string }
 */
router.post('/test-propagation',
  validateDomain,
  dnsController.testDNSPropagation
);

// ===========================================
// ROUTES SPÉCIFIQUES AUX CAMPAGNES
// ===========================================

/**
 * Obtenir le statut DNS d'une campagne
 * GET /api/dns/campaign/:campaignId/status
 */
router.get('/campaign/:campaignId/status',
  validateCampaignIdParam,
  dnsController.getCampaignDNSStatus
);

/**
 * Revalider le DNS d'une campagne
 * POST /api/dns/campaign/:campaignId/revalidate
 */
router.post('/campaign/:campaignId/revalidate',
  validateCampaignIdParam,
  dnsController.revalidateCampaignDNS
);

/**
 * Configurer le DNS pour une campagne (Step 5)
 * POST /api/dns/campaign/:campaignId/configure
 * Body: { domain: string }
 */
router.post('/campaign/:campaignId/configure',
  validateCampaignIdParam,
  validateDomain,
  async (req, res) => {
    const { campaignId } = req.params;
    const { domain } = req.body;

    try {
      // Valider le domaine et mettre à jour la campagne
      const validationResults = await require('../services/dnsValidationService')
        .validateDomainWithCorrections(domain, campaignId);

      res.json({
        success: true,
        message: 'Configuration DNS initiée pour la campagne',
        data: {
          campaignId,
          domain,
          validationResults,
          isConfigured: validationResults.validationComplete
        }
      });

    } catch (error) {
      console.error('❌ Erreur configuration DNS campagne:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la configuration DNS',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// ===========================================
// ROUTES D'UTILITAIRES DNS
// ===========================================

/**
 * Vérifier si un domaine est valide (format uniquement)
 * POST /api/dns/validate-format
 * Body: { domain: string }
 */
router.post('/validate-format',
  validateDomain,
  (req, res) => {
    const { domain } = req.body;
    
    // La validation est déjà effectuée par le middleware
    res.json({
      success: true,
      message: 'Format de domaine valide',
      data: {
        domain,
        isValid: true
      }
    });
  }
);

/**
 * Extraire le domaine d'une adresse email
 * POST /api/dns/extract-domain
 * Body: { email: string }
 */
router.post('/extract-domain',
  body('email')
    .isEmail()
    .withMessage('Format d\'email invalide'),
  (req, res) => {
    const { email } = req.body;
    const domain = email.split('@')[1];
    
    res.json({
      success: true,
      message: 'Domaine extrait avec succès',
      data: {
        email,
        domain
      }
    });
  }
);

/**
 * Obtenir des informations de base sur un domaine
 * GET /api/dns/info/:domain
 */
router.get('/info/:domain',
  validateDomainParam,
  async (req, res) => {
    const { domain } = req.params;

    try {
      const dns = require('dns').promises;
      const domainInfo = {};

      // Récupérer les enregistrements de base
      try {
        domainInfo.mx = await dns.resolveMx(domain);
      } catch (error) {
        domainInfo.mx = [];
      }

      try {
        domainInfo.a = await dns.resolve4(domain);
      } catch (error) {
        domainInfo.a = [];
      }

      try {
        domainInfo.aaaa = await dns.resolve6(domain);
      } catch (error) {
        domainInfo.aaaa = [];
      }

      try {
        domainInfo.txt = await dns.resolveTxt(domain);
      } catch (error) {
        domainInfo.txt = [];
      }

      res.json({
        success: true,
        message: 'Informations DNS récupérées',
        data: {
          domain,
          records: domainInfo
        }
      });

    } catch (error) {
      console.error('❌ Erreur récupération info DNS:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des informations DNS',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// ===========================================
// ROUTES DE MONITORING ET STATISTIQUES
// ===========================================

/**
 * Obtenir l'historique des validations DNS pour une campagne
 * GET /api/dns/campaign/:campaignId/history
 */
router.get('/campaign/:campaignId/history',
  validateCampaignIdParam,
  async (req, res) => {
    const { campaignId } = req.params;

    try {
      const Campaign = require('../models/Campaign');
      const campaign = await Campaign.findById(campaignId);

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }

      // Simuler un historique basé sur les données actuelles
      // En production, vous pourriez stocker un historique réel
      const history = [];
      
      if (campaign.step5.dnsValidation) {
        history.push({
          timestamp: campaign.step5.dnsValidation.spf.lastChecked || new Date(),
          spfStatus: campaign.step5.dnsValidation.spf.status,
          dkimStatus: campaign.step5.dnsValidation.dkim.status,
          dmarcStatus: campaign.step5.dnsValidation.dmarc.status,
          validationComplete: campaign.step5.validationComplete
        });
      }

      res.json({
        success: true,
        message: 'Historique DNS récupéré',
        data: {
          campaignId,
          domain: campaign.step5.domain,
          history
        }
      });

    } catch (error) {
      console.error('❌ Erreur récupération historique DNS:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de l\'historique DNS',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * Obtenir un résumé des statuts DNS pour toutes les campagnes
 * GET /api/dns/summary
 */
router.get('/summary',
  async (req, res) => {
    try {
      const Campaign = require('../models/Campaign');
      const campaigns = await Campaign.find({ 'step5.domain': { $exists: true, $ne: '' } })
        .select('name step5.domain step5.validationComplete step5.dnsValidation step5.configuredAt');

      const summary = campaigns.map(campaign => ({
        campaignId: campaign._id,
        campaignName: campaign.name,
        domain: campaign.step5.domain,
        validationComplete: campaign.step5.validationComplete,
        configuredAt: campaign.step5.configuredAt,
        healthScore: campaign.step5.dnsValidation ? 
          require('../controllers/DNSController').calculateDNSHealthScore(campaign.step5.dnsValidation) : 0
      }));

      res.json({
        success: true,
        message: 'Résumé DNS récupéré',
        data: {
          totalCampaigns: summary.length,
          validatedCampaigns: summary.filter(c => c.validationComplete).length,
          campaigns: summary
        }
      });

    } catch (error) {
      console.error('❌ Erreur récupération résumé DNS:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du résumé DNS',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

module.exports = router;