// src/services/dnsValidationService.js - Version avec DNS publics forcés
const dns = require('dns').promises;
const Campaign = require('../models/Campaign');

class DNSValidationService {
  constructor() {
    // FORCER l'utilisation de serveurs DNS publics fiables
    this.setupDNSServers();
    
    this.DNS_TIMEOUT = 15000; // 15 secondes
    this.MAX_RETRIES = 2;
    this.RETRY_DELAY = 3000; // 3 secondes
  }

  /**
   * Configuration forcée des serveurs DNS publics
   */
  setupDNSServers() {
    const publicDNSServers = [
      '8.8.8.8',      // Google Primary
      '8.8.4.4',      // Google Secondary  
      '1.1.1.1',      // Cloudflare Primary
      '1.0.0.1',      // Cloudflare Secondary
      '208.67.222.222', // OpenDNS
      '208.67.220.220'  // OpenDNS
    ];

    console.log('🔧 Configuration DNS avec serveurs publics:', publicDNSServers);
    dns.setServers(publicDNSServers);
    
    // Vérifier que les serveurs sont bien configurés
    const currentServers = dns.getServers();
    console.log('✅ Serveurs DNS actifs:', currentServers);
  }

  /**
   * Utilitaire pour retry avec délai
   */
  async retryWithDelay(fn, retries = this.MAX_RETRIES, delay = this.RETRY_DELAY, context = '') {
    try {
      return await fn();
    } catch (error) {
      console.log(`⚠️ Erreur DNS ${context}: ${error.code} - ${error.message}`);
      
      if (retries > 0 && this.shouldRetry(error)) {
        console.log(`🔄 Retry DNS ${context} (${retries} tentatives restantes)`);
        
        // Essayer avec des serveurs DNS différents à chaque retry
        if (retries === 1) {
          console.log('🔧 Changement vers Cloudflare DNS pour retry');
          dns.setServers(['1.1.1.1', '1.0.0.1']);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.retryWithDelay(fn, retries - 1, delay, context);
      }
      throw error;
    }
  }

  /**
   * Vérifier si l'erreur justifie un retry
   */
  shouldRetry(error) {
    const retryableCodes = ['ESERVFAIL', 'ETIMEOUT', 'ECONNREFUSED', 'ENOTFOUND'];
    return retryableCodes.includes(error.code);
  }

  /**
   * Résoudre DNS avec timeout, retry et serveurs multiples
   */
  async resolveDNSWithTimeout(resolver, domain, recordType = 'A') {
    console.log(`🔍 Résolution DNS: ${recordType} pour ${domain}`);
    
    return this.retryWithDelay(async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('DNS_TIMEOUT')), this.DNS_TIMEOUT);
      });

      const dnsPromise = resolver(domain);
      const result = await Promise.race([dnsPromise, timeoutPromise]);
      
      console.log(`✅ DNS ${recordType} résolu pour ${domain}:`, Array.isArray(result) ? result.length + ' enregistrements' : 'OK');
      return result;
    }, this.MAX_RETRIES, this.RETRY_DELAY, `${recordType} ${domain}`);
  }

  /**
   * Valider un domaine avec suggestions de corrections et sauvegarde des champs SMTP
   */
  async validateDomainWithCorrections(domain, campaignId = null, smtpData = null) {
    try {
      console.log(`🎯 === VALIDATION DNS POUR ${domain} ===`);
      
      // Réinitialiser les serveurs DNS au début de chaque validation
      this.setupDNSServers();

      // Test de base pour vérifier que le domaine existe
      console.log('🔍 Test de connectivité de base...');
      try {
        await this.resolveDNSWithTimeout(dns.resolve4, domain, 'A');
        console.log('✅ Domaine accessible');
      } catch (error) {
        console.warn(`⚠️ Domaine ${domain} difficile d'accès: ${error.message}`);
        // Ne pas échouer ici, continuer avec les tests TXT
      }

      // Effectuer les validations en parallèle avec gestion d'erreur individuelle
      console.log('🔍 Début des validations SPF, DKIM, DMARC...');
      
      const [spfResult, dkimResult, dmarcResult] = await Promise.allSettled([
        this.validateSPF(domain),
        this.validateDKIM(domain), 
        this.validateDMARC(domain)
      ]);

      const validationResults = {
        domain,
        spf: spfResult.status === 'fulfilled' ? spfResult.value : this.createErrorResult('SPF', spfResult.reason),
        dkim: dkimResult.status === 'fulfilled' ? dkimResult.value : this.createErrorResult('DKIM', dkimResult.reason),
        dmarc: dmarcResult.status === 'fulfilled' ? dmarcResult.value : this.createErrorResult('DMARC', dmarcResult.reason),
        timestamp: new Date()
      };

      // Logique de validation plus permissive
      validationResults.validationComplete = this.calculateValidationStatus(validationResults);

      console.log('📊 Résultat final:', {
        spf: validationResults.spf.status,
        dkim: validationResults.dkim.status, 
        dmarc: validationResults.dmarc.status,
        validationComplete: validationResults.validationComplete
      });

      // Sauvegarder les résultats dans la campagne si l'ID est fourni
      if (campaignId) {
        await this.saveDNSValidationToCampaign(campaignId, validationResults, smtpData);
      }

      return validationResults;

    } catch (error) {
      console.error('❌ Erreur validation DNS globale:', error);
      throw new Error(`Erreur lors de la validation DNS: ${error.message}`);
    }
  }

  /**
   * Calculer le statut de validation (plus permissif)
   */
  calculateValidationStatus(results) {
    // Considérer comme valide si on a au moins un succès ou que tous sont des warnings
    const statuses = [results.spf.status, results.dkim.status, results.dmarc.status];
    
    const hasSuccess = statuses.includes('success');
    const hasOnlyWarningsOrSuccess = statuses.every(status => ['success', 'warning'].includes(status));
    const hasCriticalErrors = statuses.some(status => status === 'error' && results[status]?.errorCode === 'ESERVFAIL');
    
    console.log('🧮 Calcul validation:', { hasSuccess, hasOnlyWarningsOrSuccess, hasCriticalErrors });
    
    // Valide si on n'a pas d'erreurs critiques ET (on a des succès OU que des warnings)
    return !hasCriticalErrors && (hasSuccess || hasOnlyWarningsOrSuccess);
  }

  /**
   * Créer un résultat d'erreur standardisé
   */
  createErrorResult(recordType, error) {
    const errorCode = error.code || 'UNKNOWN';
    const errorMessage = error.message || 'Erreur inconnue';

    console.log(`❌ Création résultat d'erreur ${recordType}:`, { errorCode, errorMessage });

    return {
      status: 'error',
      message: `Erreur lors de la validation ${recordType}: ${errorMessage}`,
      record: null,
      suggestedRecord: this.getSuggestedRecord(recordType),
      correctionSteps: this.getCorrectionSteps(recordType, errorCode),
      correctionCommand: null,
      canAutoCorrect: false,
      issues: [`Erreur ${errorCode}`, 'Vérifiez la connectivité DNS'],
      errorCode,
      retryable: this.shouldRetry(error)
    };
  }

  /**
   * Obtenir un enregistrement suggéré par type
   */
  getSuggestedRecord(recordType) {
    switch (recordType.toLowerCase()) {
      case 'spf':
        return 'v=spf1 include:_spf.google.com ~all';
      case 'dkim':
        return 'v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY';
      case 'dmarc':
        return 'v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com';
      default:
        return '';
    }
  }

  /**
   * Obtenir les étapes de correction
   */
  getCorrectionSteps(recordType, errorCode) {
    const commonSteps = [
      'Vérifiez que le domaine est accessible',
      'Contactez votre administrateur DNS si le problème persiste'
    ];

    if (errorCode === 'ESERVFAIL') {
      return [
        `Problème de serveur DNS détecté pour ${recordType}`,
        'Le serveur DNS du domaine ne répond pas correctement',
        'Ceci peut être temporaire - réessayez dans 15-30 minutes',
        ...commonSteps
      ];
    }

    return [
      `Configurez l'enregistrement ${recordType} pour votre domaine`,
      ...commonSteps
    ];
  }

  /**
   * Valider l'enregistrement SPF
   */
  async validateSPF(domain) {
    try {
      console.log(`🔍 Validation SPF pour ${domain}`);
      const txtRecords = await this.resolveDNSWithTimeout(dns.resolveTxt, domain, 'TXT');
      
      const spfRecord = txtRecords.find(record => 
        record.join('').toLowerCase().includes('v=spf1')
      );

      if (!spfRecord) {
        console.log(`⚠️ Aucun enregistrement SPF trouvé pour ${domain}`);
        return {
          status: 'warning',
          message: 'Aucun enregistrement SPF trouvé - Recommandé pour la sécurité email',
          record: null,
          suggestedRecord: `v=spf1 include:_spf.google.com ~all`,
          correctionSteps: [
            'Ajoutez un enregistrement TXT SPF à votre DNS',
            'Utilisez la valeur suggérée ou personnalisez selon vos besoins'
          ],
          correctionCommand: `Ajoutez: "${domain}" TXT "v=spf1 include:_spf.google.com ~all"`,
          canAutoCorrect: false,
          issues: ['Enregistrement SPF manquant'],
          retryable: false
        };
      }

      const spfRecordString = spfRecord.join('');
      console.log(`✅ SPF trouvé pour ${domain}: ${spfRecordString.substring(0, 50)}...`);
      
      return {
        status: 'success',
        message: 'Enregistrement SPF valide trouvé',
        record: spfRecordString,
        suggestedRecord: spfRecordString,
        correctionSteps: [],
        correctionCommand: null,
        canAutoCorrect: false,
        issues: [],
        retryable: false
      };

    } catch (error) {
      console.error(`❌ Erreur SPF pour ${domain}:`, error.code, error.message);
      throw error;
    }
  }

  /**
   * Valider l'enregistrement DKIM
   */
  async validateDKIM(domain) {
    try {
      console.log(`🔍 Validation DKIM pour ${domain}`);
      const commonSelectors = ['default', 'google', 'mail', 'k1', 'selector1', 'selector2'];
      
      // Tester les sélecteurs un par un pour éviter trop de requêtes simultanées
      for (const selector of commonSelectors) {
        try {
          const dkimDomain = `${selector}._domainkey.${domain}`;
          console.log(`🔍 Test sélecteur DKIM: ${selector}`);
          
          const txtRecords = await this.resolveDNSWithTimeout(dns.resolveTxt, dkimDomain, 'DKIM');
          const dkimRecord = txtRecords.find(record => 
            record.join('').toLowerCase().includes('v=dkim1')
          );

          if (dkimRecord) {
            const recordString = dkimRecord.join('');
            console.log(`✅ DKIM trouvé pour ${domain} (${selector}): ${recordString.substring(0, 50)}...`);
            
            return {
              status: 'success',
              message: `Enregistrement DKIM valide trouvé (sélecteur: ${selector})`,
              record: recordString,
              suggestedRecord: recordString,
              correctionSteps: [],
              correctionCommand: null,
              canAutoCorrect: false,
              issues: [],
              retryable: false
            };
          }
        } catch (error) {
          console.log(`⚠️ Sélecteur DKIM ${selector} non trouvé: ${error.code}`);
          // Continuer avec le sélecteur suivant
        }
      }

      console.log(`⚠️ Aucun DKIM trouvé pour ${domain}`);
      return {
        status: 'warning',
        message: 'Aucun enregistrement DKIM trouvé - Recommandé pour l\'authentification',
        record: null,
        suggestedRecord: 'v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY',
        correctionSteps: [
          'Générez une paire de clés DKIM',
          'Ajoutez l\'enregistrement DKIM à votre DNS',
          'Configurez votre serveur de messagerie'
        ],
        correctionCommand: `Ajoutez: "default._domainkey.${domain}" TXT "v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY"`,
        canAutoCorrect: false,
        issues: ['Enregistrement DKIM manquant'],
        retryable: false
      };

    } catch (error) {
      console.error(`❌ Erreur DKIM pour ${domain}:`, error.code, error.message);
      throw error;
    }
  }

  /**
   * Valider l'enregistrement DMARC
   */
  async validateDMARC(domain) {
    try {
      console.log(`🔍 Validation DMARC pour ${domain}`);
      const dmarcDomain = `_dmarc.${domain}`;
      const txtRecords = await this.resolveDNSWithTimeout(dns.resolveTxt, dmarcDomain, 'DMARC');
      
      const dmarcRecord = txtRecords.find(record => 
        record.join('').toLowerCase().includes('v=dmarc1')
      );

      if (!dmarcRecord) {
        console.log(`⚠️ Aucun DMARC trouvé pour ${domain}`);
        return {
          status: 'warning',
          message: 'Aucun enregistrement DMARC trouvé - Fortement recommandé',
          record: null,
          suggestedRecord: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}`,
          correctionSteps: [
            'Créez un enregistrement TXT DMARC',
            'Configurez la politique appropriée',
            'Ajoutez une adresse pour les rapports'
          ],
          correctionCommand: `Ajoutez: "_dmarc.${domain}" TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}"`,
          canAutoCorrect: false,
          issues: ['Enregistrement DMARC manquant'],
          retryable: false
        };
      }

      const dmarcRecordString = dmarcRecord.join('');
      console.log(`✅ DMARC trouvé pour ${domain}: ${dmarcRecordString}`);

      return {
        status: 'success',
        message: 'Enregistrement DMARC valide trouvé',
        record: dmarcRecordString,
        suggestedRecord: dmarcRecordString,
        correctionSteps: [],
        correctionCommand: null,
        canAutoCorrect: false,
        issues: [],
        retryable: false
      };

    } catch (error) {
      console.error(`❌ Erreur DMARC pour ${domain}:`, error.code, error.message);
      throw error;
    }
  }

  // ... (reste des méthodes inchangées)
  
  /**
   * Sauvegarder les résultats de validation et les données SMTP dans la campagne
   */
  async saveDNSValidationToCampaign(campaignId, validationResults, smtpData = null) {
    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        throw new Error('Campagne non trouvée');
      }

    if (!campaign.step5) {
        campaign.step5 = {};
      }

    if (smtpData) {
        if (smtpData.fromEmail) campaign.step5.fromEmail = smtpData.fromEmail;
        if (smtpData.fromName) campaign.step5.fromName = smtpData.fromName;
        console.log(`✅ Données SMTP sauvegardées: ${smtpData.fromEmail} (${smtpData.fromName})`);
      }

    campaign.step5.domain = validationResults.domain;
      campaign.step5.dnsValidation = {
        spf: {
          status: validationResults.spf.status,
          message: validationResults.spf.message,
          record: validationResults.spf.record,
          lastChecked: new Date()
        },
        dkim: {
          status: validationResults.dkim.status,
          message: validationResults.dkim.message,
          record: validationResults.dkim.record,
          lastChecked: new Date()
        },
        dmarc: {
          status: validationResults.dmarc.status,
          message: validationResults.dmarc.message,
          record: validationResults.dmarc.record,
          lastChecked: new Date()
        }
      };

      campaign.step5.validationComplete = validationResults.validationComplete;
      campaign.step5.isConfigured = validationResults.validationComplete;

      if (validationResults.validationComplete) {
        campaign.step5.configuredAt = new Date();
      }

      await campaign.save();
      console.log(`✅ Campagne ${campaignId} sauvegardée avec validation: ${validationResults.validationComplete}`);

    } catch (error) {
      console.error('❌ Erreur sauvegarde:', error);
      throw error;
    }
  }

  /**
   * Récupérer les données SMTP d'une campagne
   */
  async getCampaignSMTPData(campaignId) {
    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        throw new Error('Campagne non trouvée');
      }

      return {
        fromEmail: campaign.step5?.fromEmail || '',
        fromName: campaign.step5?.fromName || '',
        domain: campaign.step5?.domain || '',
        dnsValidation: campaign.step5?.dnsValidation || null,
        validationComplete: campaign.step5?.validationComplete || false,
        isConfigured: campaign.step5?.isConfigured || false,
        configuredAt: campaign.step5?.configuredAt || null
      };

    } catch (error) {
      console.error('❌ Erreur récupération données SMTP:', error);
      throw error;
    }
  }
}

module.exports = new DNSValidationService();