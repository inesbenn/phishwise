// src/controllers/DNSController.js
const { validationResult } = require('express-validator');
const dnsValidationService = require('../services/dnsValidationService');
const Campaign = require('../models/Campaign');

class DNSController {
  /**
   * Valider le DNS d'un domaine avec suggestions de correction
   * POST /api/dns/validate
   */
  async validateDomain(req, res) {
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
      console.log(`🔍 Validation DNS pour domaine: ${domain}`);

      // Effectuer la validation avec suggestions de correction
      const validationResults = await dnsValidationService.validateDomainWithCorrections(domain, campaignId);

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
   * Appliquer les corrections automatiques DNS
   * POST /api/dns/apply-corrections
   */
  async applyCorrections(req, res) {
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
  async getCampaignDNSStatus(req, res) {
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
      console.log(`📋 Récupération du statut DNS pour campagne: ${campaignId}`);

      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }

      const dnsStatus = {
        domain: campaign.step5.domain,
        validationComplete: campaign.step5.validationComplete,
        isConfigured: campaign.step5.isConfigured,
        configuredAt: campaign.step5.configuredAt,
        lastValidation: campaign.step5.dnsValidation,
        healthScore: campaign.step5.dnsValidation ? 
          this.calculateDNSHealthScore(campaign.step5.dnsValidation) : 0
      };

      console.log(`✅ Statut DNS récupéré pour campagne ${campaignId}`);

      res.json({
        success: true,
        message: 'Statut DNS récupéré',
        data: dnsStatus
      });

    } catch (error) {
      console.error('❌ Erreur récupération statut DNS:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du statut DNS',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Revalider le DNS d'une campagne
   * POST /api/dns/campaign/:campaignId/revalidate
   */
  async revalidateCampaignDNS(req, res) {
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

      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }

      const domain = campaign.step5.domain;
      if (!domain) {
        return res.status(400).json({
          success: false,
          message: 'Aucun domaine configuré pour cette campagne'
        });
      }

      // Effectuer la revalidation
      const validationResults = await dnsValidationService.validateDomainWithCorrections(domain, campaignId);
      const healthScore = this.calculateDNSHealthScore(validationResults);

      console.log(`✅ Revalidation DNS terminée pour campagne ${campaignId} - Score: ${healthScore}%`);

      res.json({
        success: true,
        message: 'Revalidation DNS terminée',
        data: {
          domain,
          validationResults,
          healthScore,
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
  async getDNSRecommendations(req, res) {
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
          current: validationResults.spf.record,
          suggested: validationResults.spf.suggestedRecord,
          steps: validationResults.spf.correctionSteps,
          command: validationResults.spf.correctionCommand,
          canAutoCorrect: validationResults.spf.canAutoCorrect,
          issues: validationResults.spf.issues || []
        },
        dkim: {
          current: validationResults.dkim.record,
          suggested: validationResults.dkim.suggestedRecord,
          steps: validationResults.dkim.correctionSteps,
          command: validationResults.dkim.correctionCommand,
          canAutoCorrect: validationResults.dkim.canAutoCorrect,
          issues: validationResults.dkim.issues || []
        },
        dmarc: {
          current: validationResults.dmarc.record,
          suggested: validationResults.dmarc.suggestedRecord,
          steps: validationResults.dmarc.correctionSteps,
          command: validationResults.dmarc.correctionCommand,
          canAutoCorrect: validationResults.dmarc.canAutoCorrect,
          issues: validationResults.dmarc.issues || []
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
  async testDNSPropagation(req, res) {
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
          spfStatus: validation.spf.status,
          dkimStatus: validation.dkim.status,
          dmarcStatus: validation.dmarc.status,
          validationComplete: validation.validationComplete
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
    let score = 0;
    let totalChecks = 0;

    // SPF (33% du score)
    totalChecks += 1;
    if (validationResults.spf.status === 'success') {
      score += 33;
    } else if (validationResults.spf.status === 'warning') {
      score += 16;
    }

    // DKIM (33% du score)
    totalChecks += 1;
    if (validationResults.dkim.status === 'success') {
      score += 33;
    } else if (validationResults.dkim.status === 'warning') {
      score += 16;
    }

    // DMARC (34% du score)
    totalChecks += 1;
    if (validationResults.dmarc.status === 'success') {
      score += 34;
    } else if (validationResults.dmarc.status === 'warning') {
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