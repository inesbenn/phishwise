// src/controllers/DNSController.js
const { validationResult } = require('express-validator');
const dnsValidationService = require('../services/dnsValidationService');
const Campaign = require('../models/Campaign');
const mongoose = require('mongoose');

class DNSController {
  /**
   * Valider le DNS d'un domaine avec suggestions de correction
   * POST /api/dns/validate
   */
  validateDomain = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: errors.array()
      });
    }

    const { domain, campaignId, fromEmail, fromName } = req.body;

    try {
      console.log(`🔍 Validation DNS pour domaine: ${domain}`);

      // Préparer les données SMTP si fournies
      const smtpData = {};
      if (fromEmail) smtpData.fromEmail = fromEmail;
      if (fromName) smtpData.fromName = fromName;

      // Effectuer la validation avec suggestions de correction et sauvegarde SMTP
      const validationResults = await dnsValidationService.validateDomainWithCorrections(
        domain, 
        campaignId,
        Object.keys(smtpData).length > 0 ? smtpData : null
      );

      // Calculer le score de santé DNS
      const healthScore = this.calculateDNSHealthScore(validationResults);

      console.log(`✅ Validation DNS terminée pour ${domain} - Score: ${healthScore}%`);

      res.json({
        success: true,
        message: 'Validation DNS terminée',
        data: {
          domain,
          validationResults,
          healthScore,
          smtpData: Object.keys(smtpData).length > 0 ? smtpData : null,
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error('❌ Erreur validation DNS:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la validation DNS',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Configurer le DNS et SMTP pour une campagne (Step 5)
   * POST /api/dns/campaign/:campaignId/configure
   */
  configureCampaignDNS = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: errors.array()
      });
    }

    const { campaignId } = req.params;
    const { domain, fromEmail, fromName } = req.body;

    try {
      console.log(`🔧 Configuration DNS/SMTP pour campagne: ${campaignId}`);

      // Préparer les données SMTP
      const smtpData = {};
      if (fromEmail) smtpData.fromEmail = fromEmail;
      if (fromName) smtpData.fromName = fromName;

      // Effectuer la validation et sauvegarde
      const validationResults = await dnsValidationService.validateDomainWithCorrections(
        domain, 
        campaignId,
        smtpData
      );

      const healthScore = this.calculateDNSHealthScore(validationResults);

      console.log(`✅ Configuration DNS/SMTP terminée pour campagne ${campaignId} - Score: ${healthScore}%`);

      res.json({
        success: true,
        message: 'Configuration DNS et SMTP initiée pour la campagne',
        data: {
          campaignId,
          domain,
          validationResults,
          healthScore,
          smtpData,
          isConfigured: validationResults.validationComplete,
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error('❌ Erreur configuration DNS/SMTP campagne:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la configuration DNS/SMTP',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Appliquer les corrections automatiques DNS
   * POST /api/dns/apply-corrections
   */
  applyCorrections = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: errors.array()
      });
    }

    const { domain, campaignId } = req.body;

    try {
      console.log(`🔧 Application des corrections DNS pour domaine: ${domain}`);

      // Première validation pour obtenir l'état actuel
      const initialValidation = await dnsValidationService.validateDomainWithCorrections(domain, campaignId);

      // Appliquer les corrections automatiques
      const corrections = await dnsValidationService.applyAutoCorrections(domain, initialValidation);

      // Générer le rapport de correction
      const correctionReport = dnsValidationService.generateCorrectionReport(domain, initialValidation, corrections);

      console.log(`✅ Corrections appliquées pour ${domain}:`);
      console.log(`   - Corrections appliquées: ${corrections.applied.length}`);
      console.log(`   - Actions manuelles requises: ${corrections.requiresManualAction.length}`);
      console.log(`   - Échecs: ${corrections.failed.length}`);

      res.json({
        success: true,
        message: 'Corrections DNS appliquées',
        data: {
          domain,
          corrections,
          correctionReport,
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error('❌ Erreur application corrections DNS:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'application des corrections DNS',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtenir le statut DNS d'une campagne
   * GET /api/dns/campaign/:campaignId/status
   */
  getCampaignDNSStatus = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'ID de campagne invalide',
        errors: errors.array()
      });
    }

    const { campaignId } = req.params;

    try {
      console.log(`📋 Récupération du statut DNS/SMTP pour campagne: ${campaignId}`);

      // Vérifier si l'ID est un ObjectId valide
      if (!mongoose.Types.ObjectId.isValid(campaignId)) {
        console.error(`❌ ID de campagne invalide: ${campaignId}`);
        return res.status(400).json({
          success: false,
          message: 'Format d\'ID de campagne invalide'
        });
      }

      // Utiliser le service pour récupérer les données
      const smtpData = await dnsValidationService.getCampaignSMTPData(campaignId);

      const healthScore = smtpData.dnsValidation ? 
        this.calculateDNSHealthScore(smtpData.dnsValidation) : 0;

      console.log(`✅ Statut DNS/SMTP récupéré pour campagne ${campaignId}:`, {
        fromEmail: smtpData.fromEmail,
        fromName: smtpData.fromName,
        domain: smtpData.domain,
        validationComplete: smtpData.validationComplete,
        isConfigured: smtpData.isConfigured,
        healthScore: healthScore
      });

      res.json({
        success: true,
        message: 'Statut DNS/SMTP récupéré',
        data: {
          ...smtpData,
          healthScore,
          dnsValidation: smtpData.dnsValidation // Inclure les détails de validation
        }
      });

    } catch (error) {
      console.error('❌ Erreur récupération statut DNS/SMTP:', error);
      console.error('Stack trace:', error.stack);
      
      // Gestion spécifique des erreurs Mongoose
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Format d\'ID de campagne invalide'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du statut DNS/SMTP',
        error: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : undefined
      });
    }
  }

  /**
   * Revalider le DNS d'une campagne
   * POST /api/dns/campaign/:campaignId/revalidate
   */
  revalidateCampaignDNS = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'ID de campagne invalide',
        errors: errors.array()
      });
    }

    const { campaignId } = req.params;

    try {
      console.log(`🔄 Revalidation DNS pour campagne: ${campaignId}`);

      // Vérifier si l'ID est un ObjectId valide
      if (!mongoose.Types.ObjectId.isValid(campaignId)) {
        return res.status(400).json({
          success: false,
          message: 'Format d\'ID de campagne invalide'
        });
      }

      // Récupérer les données actuelles de la campagne
      const currentData = await dnsValidationService.getCampaignSMTPData(campaignId);

      if (!currentData.domain) {
        return res.status(400).json({
          success: false,
          message: 'Aucun domaine configuré pour cette campagne'
        });
      }

      // Préparer les données SMTP pour la revalidation
      const smtpData = {};
      if (currentData.fromEmail) smtpData.fromEmail = currentData.fromEmail;
      if (currentData.fromName) smtpData.fromName = currentData.fromName;

      // Effectuer la revalidation
      const validationResults = await dnsValidationService.validateDomainWithCorrections(
        currentData.domain, 
        campaignId,
        Object.keys(smtpData).length > 0 ? smtpData : null
      );

      const healthScore = this.calculateDNSHealthScore(validationResults);

      console.log(`✅ Revalidation DNS terminée pour campagne ${campaignId} - Score: ${healthScore}%`);

      res.json({
        success: true,
        message: 'Revalidation DNS terminée',
        data: {
          domain: currentData.domain,
          validationResults,
          healthScore,
          smtpData,
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error('❌ Erreur revalidation DNS:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la revalidation DNS',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtenir les recommandations DNS pour un domaine
   * GET /api/dns/recommendations/:domain
   */
  getDNSRecommendations = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Domaine invalide',
        errors: errors.array()
      });
    }

    const { domain } = req.params;

    try {
      console.log(`💡 Génération des recommandations DNS pour: ${domain}`);

      // Effectuer une validation simple pour obtenir les recommandations
      const validationResults = await dnsValidationService.validateDomainWithCorrections(domain);
      
      // Extraire les recommandations
      const recommendations = {
        spf: {
          current: validationResults.spf?.record || null,
          suggested: validationResults.spf?.suggestedRecord || null,
          steps: validationResults.spf?.correctionSteps || [],
          command: validationResults.spf?.correctionCommand || null,
          canAutoCorrect: validationResults.spf?.canAutoCorrect || false,
          issues: validationResults.spf?.issues || []
        },
        dkim: {
          current: validationResults.dkim?.record || null,
          suggested: validationResults.dkim?.suggestedRecord || null,
          steps: validationResults.dkim?.correctionSteps || [],
          command: validationResults.dkim?.correctionCommand || null,
          canAutoCorrect: validationResults.dkim?.canAutoCorrect || false,
          issues: validationResults.dkim?.issues || []
        },
        dmarc: {
          current: validationResults.dmarc?.record || null,
          suggested: validationResults.dmarc?.suggestedRecord || null,
          steps: validationResults.dmarc?.correctionSteps || [],
          command: validationResults.dmarc?.correctionCommand || null,
          canAutoCorrect: validationResults.dmarc?.canAutoCorrect || false,
          issues: validationResults.dmarc?.issues || []
        }
      };

      console.log(`✅ Recommandations DNS générées pour ${domain}`);

      res.json({
        success: true,
        message: 'Recommandations DNS générées',
        data: {
          domain,
          recommendations,
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error('❌ Erreur génération recommandations DNS:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération des recommandations DNS',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Tester la propagation DNS
   * POST /api/dns/test-propagation
   */
  testDNSPropagation = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: errors.array()
      });
    }

    const { domain } = req.body;

    try {
      console.log(`🌐 Test de propagation DNS pour: ${domain}`);

      // Effectuer plusieurs validations avec un délai pour tester la propagation
      const propagationResults = [];
      const testCount = 3;
      const delayBetweenTests = 5000; // 5 secondes

      for (let i = 0; i < testCount; i++) {
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenTests));
        }

        const validation = await dnsValidationService.validateDomainWithCorrections(domain);
        propagationResults.push({
          testNumber: i + 1,
          timestamp: new Date(),
          spfStatus: validation.spf?.status || 'unknown',
          dkimStatus: validation.dkim?.status || 'unknown',
          dmarcStatus: validation.dmarc?.status || 'unknown',
          validationComplete: validation.validationComplete || false
        });

        console.log(`   Test ${i + 1}/${testCount} - Status: ${validation.validationComplete ? 'OK' : 'KO'}`);
      }

      const propagationComplete = propagationResults.every(result => result.validationComplete);

      console.log(`✅ Test de propagation terminé pour ${domain} - Propagé: ${propagationComplete}`);

      res.json({
        success: true,
        message: 'Test de propagation DNS terminé',
        data: {
          domain,
          propagationComplete,
          testResults: propagationResults,
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error('❌ Erreur test propagation DNS:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du test de propagation DNS',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // ===========================================
  // MÉTHODES UTILITAIRES
  // ===========================================

  /**
   * Calculer le score de santé DNS (0-100)
   */
  calculateDNSHealthScore(validationResults) {
    if (!validationResults) return 0;

    let score = 0;
    let totalChecks = 0;

    // SPF (33% du score)
    totalChecks += 1;
    if (validationResults.spf?.status === 'success') {
      score += 33;
    } else if (validationResults.spf?.status === 'warning') {
      score += 16;
    }

    // DKIM (33% du score)
    totalChecks += 1;
    if (validationResults.dkim?.status === 'success') {
      score += 33;
    } else if (validationResults.dkim?.status === 'warning') {
      score += 16;
    }

    // DMARC (34% du score)
    totalChecks += 1;
    if (validationResults.dmarc?.status === 'success') {
      score += 34;
    } else if (validationResults.dmarc?.status === 'warning') {
      score += 17;
    }

    return Math.round(score);
  }

  /**
   * Vérifier si un domaine est valide
   */
  isDomainValid(domain) {
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
    return domainRegex.test(domain);
  }

  /**
   * Extraire le domaine d'une adresse email
   */
  extractDomainFromEmail(email) {
    const emailRegex = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/;
    const match = email.match(emailRegex);
    return match ? match[1] : null;
  }
}

module.exports = new DNSController();