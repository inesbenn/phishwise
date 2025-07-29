// src/services/dnsValidationService.js
const dns = require('dns').promises;
const Campaign = require('../models/Campaign');

class DNSValidationService {
  /**
   * Valider un domaine avec suggestions de corrections et sauvegarde des champs SMTP
   */
  async validateDomainWithCorrections(domain, campaignId = null, smtpData = null) {
    try {
      console.log(`🔍 Validation DNS pour domaine: ${domain}`);

      // Effectuer les validations DNS
      const spfValidation = await this.validateSPF(domain);
      const dkimValidation = await this.validateDKIM(domain);
      const dmarcValidation = await this.validateDMARC(domain);

      const validationResults = {
        domain,
        spf: spfValidation,
        dkim: dkimValidation,
        dmarc: dmarcValidation,
        validationComplete: spfValidation.status === 'success' && 
                           dkimValidation.status === 'success' && 
                           dmarcValidation.status === 'success',
        timestamp: new Date()
      };

      // Sauvegarder les résultats dans la campagne si l'ID est fourni
      if (campaignId) {
        await this.saveDNSValidationToCampaign(campaignId, validationResults, smtpData);
      }

      return validationResults;

    } catch (error) {
      console.error('❌ Erreur validation DNS:', error);
      throw new Error(`Erreur lors de la validation DNS: ${error.message}`);
    }
  }

  /**
   * Valider l'enregistrement SPF
   */
  async validateSPF(domain) {
    try {
      const txtRecords = await dns.resolveTxt(domain);
      const spfRecord = txtRecords.find(record => 
        record.join('').toLowerCase().includes('v=spf1')
      );

      if (!spfRecord) {
        return {
          status: 'error',
          message: 'Aucun enregistrement SPF trouvé',
          record: null,
          suggestedRecord: `v=spf1 include:_spf.google.com ~all`,
          correctionSteps: [
            'Ajoutez un enregistrement TXT SPF à votre DNS',
            'Utilisez la valeur suggérée ou personnalisez selon vos besoins'
          ],
          correctionCommand: `Ajoutez l'enregistrement TXT: "${domain}" "v=spf1 include:_spf.google.com ~all"`,
          canAutoCorrect: false,
          issues: ['Enregistrement SPF manquant']
        };
      }

      const spfRecordString = spfRecord.join('');
      
      return {
        status: 'success',
        message: 'Enregistrement SPF valide',
        record: spfRecordString,
        suggestedRecord: spfRecordString,
        correctionSteps: [],
        correctionCommand: null,
        canAutoCorrect: false,
        issues: []
      };

    } catch (error) {
      return {
        status: 'error',
        message: `Erreur lors de la validation SPF: ${error.message}`,
        record: null,
        suggestedRecord: `v=spf1 include:_spf.google.com ~all`,
        correctionSteps: [
          'Vérifiez que le domaine est accessible',
          'Ajoutez un enregistrement SPF valide'
        ],
        correctionCommand: `Ajoutez l'enregistrement TXT: "${domain}" "v=spf1 include:_spf.google.com ~all"`,
        canAutoCorrect: false,
        issues: ['Erreur de résolution DNS']
      };
    }
  }

  /**
   * Valider l'enregistrement DKIM
   */
  async validateDKIM(domain) {
    try {
      // Vérifier les sélecteurs DKIM courants
      const commonSelectors = ['default', 'google', 'mail', 'k1', 'selector1', 'selector2'];
      let dkimRecord = null;
      let foundSelector = null;

      for (const selector of commonSelectors) {
        try {
          const dkimDomain = `${selector}._domainkey.${domain}`;
          const txtRecords = await dns.resolveTxt(dkimDomain);
          const dkimTxtRecord = txtRecords.find(record => 
            record.join('').toLowerCase().includes('v=dkim1')
          );

          if (dkimTxtRecord) {
            dkimRecord = dkimTxtRecord.join('');
            foundSelector = selector;
            break;
          }
        } catch (error) {
          // Continuer avec le sélecteur suivant
        }
      }

      if (!dkimRecord) {
        return {
          status: 'error',
          message: 'Aucun enregistrement DKIM trouvé',
          record: null,
          suggestedRecord: 'v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY',
          correctionSteps: [
            'Générez une paire de clés DKIM',
            'Ajoutez l\'enregistrement TXT DKIM à votre DNS',
            'Configurez votre serveur de messagerie pour signer les emails'
          ],
          correctionCommand: `Ajoutez l'enregistrement TXT: "default._domainkey.${domain}" "v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY"`,
          canAutoCorrect: false,
          issues: ['Enregistrement DKIM manquant']
        };
      }

      return {
        status: 'success',
        message: `Enregistrement DKIM valide (sélecteur: ${foundSelector})`,
        record: dkimRecord,
        suggestedRecord: dkimRecord,
        correctionSteps: [],
        correctionCommand: null,
        canAutoCorrect: false,
        issues: []
      };

    } catch (error) {
      return {
        status: 'error',
        message: `Erreur lors de la validation DKIM: ${error.message}`,
        record: null,
        suggestedRecord: 'v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY',
        correctionSteps: [
          'Vérifiez que le domaine est accessible',
          'Configurez DKIM pour votre domaine'
        ],
        correctionCommand: `Ajoutez l'enregistrement TXT: "default._domainkey.${domain}" "v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY"`,
        canAutoCorrect: false,
        issues: ['Erreur de résolution DNS']
      };
    }
  }

  /**
   * Valider l'enregistrement DMARC
   */
  async validateDMARC(domain) {
    try {
      const dmarcDomain = `_dmarc.${domain}`;
      const txtRecords = await dns.resolveTxt(dmarcDomain);
      const dmarcRecord = txtRecords.find(record => 
        record.join('').toLowerCase().includes('v=dmarc1')
      );

      if (!dmarcRecord) {
        return {
          status: 'error',
          message: 'Aucun enregistrement DMARC trouvé',
          record: null,
          suggestedRecord: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@' + domain,
          correctionSteps: [
            'Créez un enregistrement TXT DMARC',
            'Configurez la politique DMARC appropriée',
            'Ajoutez une adresse email pour les rapports'
          ],
          correctionCommand: `Ajoutez l'enregistrement TXT: "_dmarc.${domain}" "v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}"`,
          canAutoCorrect: false,
          issues: ['Enregistrement DMARC manquant']
        };
      }

      const dmarcRecordString = dmarcRecord.join('');

      return {
        status: 'success',
        message: 'Enregistrement DMARC valide',
        record: dmarcRecordString,
        suggestedRecord: dmarcRecordString,
        correctionSteps: [],
        correctionCommand: null,
        canAutoCorrect: false,
        issues: []
      };

    } catch (error) {
      return {
        status: 'error',
        message: `Erreur lors de la validation DMARC: ${error.message}`,
        record: null,
        suggestedRecord: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@' + domain,
        correctionSteps: [
          'Vérifiez que le domaine est accessible',
          'Ajoutez un enregistrement DMARC valide'
        ],
        correctionCommand: `Ajoutez l'enregistrement TXT: "_dmarc.${domain}" "v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}"`,
        canAutoCorrect: false,
        issues: ['Erreur de résolution DNS']
      };
    }
  }

  /**
   * Appliquer les corrections automatiques
   */
  async applyAutoCorrections(domain, validationResults) {
    // Cette méthode est un placeholder - en réalité, vous ne pouvez pas
    // automatiquement modifier les enregistrements DNS externes
    return {
      applied: [],
      requiresManualAction: [
        {
          type: 'spf',
          action: 'add_record',
          value: validationResults.spf.suggestedRecord,
          reason: 'Les enregistrements DNS doivent être ajoutés manuellement'
        },
        {
          type: 'dkim',
          action: 'add_record',
          value: validationResults.dkim.suggestedRecord,
          reason: 'Les enregistrements DNS doivent être ajoutés manuellement'
        },
        {
          type: 'dmarc',
          action: 'add_record',
          value: validationResults.dmarc.suggestedRecord,
          reason: 'Les enregistrements DNS doivent être ajoutés manuellement'
        }
      ],
      failed: []
    };
  }

  /**
   * Générer un rapport de correction
   */
  generateCorrectionReport(domain, initialValidation, corrections) {
    return {
      domain,
      timestamp: new Date(),
      summary: {
        totalIssues: corrections.requiresManualAction.length + corrections.failed.length,
        autoFixed: corrections.applied.length,
        manualActionRequired: corrections.requiresManualAction.length,
        failed: corrections.failed.length
      },
      recommendations: corrections.requiresManualAction.map(action => ({
        type: action.type,
        priority: action.type === 'spf' ? 'high' : 'medium',
        description: `Ajoutez l'enregistrement ${action.type.toUpperCase()}`,
        command: action.value
      }))
    };
  }

  /**
   * Sauvegarder les résultats de validation et les données SMTP dans la campagne
   */
  async saveDNSValidationToCampaign(campaignId, validationResults, smtpData = null) {
    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        throw new Error('Campagne non trouvée');
      }

      // Initialiser step5 si nécessaire
      if (!campaign.step5) {
        campaign.step5 = {};
      }

      // Sauvegarder les données SMTP si fournies
      if (smtpData) {
        if (smtpData.fromEmail) {
          campaign.step5.fromEmail = smtpData.fromEmail;
        }
        if (smtpData.fromName) {
          campaign.step5.fromName = smtpData.fromName;
        }
        console.log(`✅ Données SMTP sauvegardées: ${smtpData.fromEmail} (${smtpData.fromName})`);
      }

      // Sauvegarder le domaine
      campaign.step5.domain = validationResults.domain;

      // Mettre à jour les résultats DNS
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
      console.log(`✅ Résultats DNS et SMTP sauvegardés pour la campagne ${campaignId}`);

    } catch (error) {
      console.error('❌ Erreur sauvegarde DNS/SMTP:', error);
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