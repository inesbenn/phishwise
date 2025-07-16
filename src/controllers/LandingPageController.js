const Campaign = require('../models/Campaign'); 
const ScrapingService = require('../services/ScrapingService');
const { validationResult } = require('express-validator');

class LandingPageController {

  /**
   * Récupérer les données de la landing page pour une campagne
   */
  async getLandingPageData(req, res) {
    try {
      const { campaignId } = req.params;

      console.log(`📄 Récupération des données landing page pour campagne: ${campaignId}`);

      const campaign = await Campaign.findById(campaignId)
        .select('step4 name status createdBy');

      if (!campaign) {
        console.log(`❌ Campagne non trouvée: ${campaignId}`);
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }

      console.log(`✅ Campagne trouvée: ${campaign.name}`);

      // Vérifier les permissions (optionnel - à adapter selon votre système d'auth)
      // if (campaign.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      //   return res.status(403).json({ success: false, message: 'Accès refusé' });
      // }

      res.json({
        success: true,
        data: {
          campaignId: campaign._id,
          campaignName: campaign.name,
          landingPageData: campaign.step4 || {}
        }
      });

    } catch (error) {
      console.error('❌ Erreur getLandingPageData:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Cloner une URL
   */
  async cloneUrl(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Erreurs de validation:', errors.array());
        return res.status(400).json({
          success: false,
          message: 'Données invalides',
          errors: errors.array()
        });
      }

      const { campaignId } = req.params;
      const { url } = req.body;

      console.log(`🔄 Début du clonage de ${url} pour la campagne ${campaignId}`);

      // Vérifier que la campagne existe
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        console.log(`❌ Campagne non trouvée: ${campaignId}`);
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }

      console.log(`✅ Campagne trouvée: ${campaign.name}`);

      // Mettre à jour le statut en cours
      await Campaign.findByIdAndUpdate(campaignId, {
        'step4.status': 'cloning',
        'step4.message': 'Clonage en cours...'
      });

      // Appeler le service de scraping
      console.log(`🕷️ Appel du service de scraping pour clonage direct...`);
      const scrapingResult = await ScrapingService.cloneWebsite(url, campaignId);

      if (!scrapingResult.success) {
        console.log(`❌ Échec du scraping:`, scrapingResult.message);

        // Mettre à jour le statut d'erreur
        await Campaign.findByIdAndUpdate(campaignId, {
          'step4.status': 'error',
          'step4.errorMessage': scrapingResult.message || scrapingResult.error
        });

        return res.status(400).json({
          success: false,
          message: scrapingResult.message,
          error: scrapingResult.error
        });
      }

      console.log(`✅ Scraping réussi:`, scrapingResult);

      // Mettre à jour la campagne avec les données clonées
      const updateData = {
        'step4.type': 'cloned',
        'step4.originalUrl': url,
        'step4.clonedUrl': scrapingResult.clonedUrl,
        'step4.previewUrl': scrapingResult.previewUrl,
        'step4.filePath': scrapingResult.filePath,
        'step4.cloneId': scrapingResult.cloneId,
        'step4.clonedAt': new Date(),
        'step4.status': 'success',
        'step4.postSubmissionActions': {
          collectData: true,
          redirectToLearning: true,
          downloadMaliciousFile: true,
          redirectUrl: `${process.env.BASE_URL}/learning/${campaignId}`, // Utiliser BASE_URL
          maliciousFileUrl: `${process.env.BASE_URL}/downloads/malicious-test-file.zip` // Utiliser BASE_URL
        }
      };

      await Campaign.findByIdAndUpdate(campaignId, updateData);

      console.log(`✅ Campagne mise à jour avec succès`);

      res.json({
        success: true,
        message: 'URL clonée avec succès',
        data: {
          originalUrl: url,
          clonedUrl: scrapingResult.clonedUrl,
          previewUrl: scrapingResult.previewUrl,
          filePath: scrapingResult.filePath,
          resourcesCount: scrapingResult.resourcesCount || 0,
          cloneId: scrapingResult.cloneId
        }
      });

    } catch (error) {
      console.error('❌ Erreur cloneUrl:', error);

      // Mettre à jour le statut d'erreur dans la campagne
      if (req.params.campaignId) {
        await Campaign.findByIdAndUpdate(req.params.campaignId, {
          'step4.status': 'error',
          'step4.errorMessage': error.message
        }).catch(console.error);
      }

      res.status(500).json({
        success: false,
        message: 'Erreur lors du clonage',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Sélectionner un template prédéfini
   */
  async selectTemplate(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Données invalides',
          errors: errors.array()
        });
      }

      const { campaignId } = req.params;
      const { templateId } = req.body; // MODIFICATION ICI: Récupère templateId

      console.log(`📋 Sélection du template avec ID: ${templateId} pour la campagne ${campaignId}`);

      // Vérifier que la campagne existe
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }

      // MODIFICATION ICI: Récupère la liste des templates et trouve le template par ID
      const availableTemplates = [
        { id: 1, name: "Page de connexion Office 365", url: `${process.env.BASE_URL}/static-cloned-templates/office365-login.html`, thumbnail: "https://via.placeholder.com/300x200/1e40af/ffffff?text=Office+365", category: "Microsoft", popularity: 5, description: "Page de connexion Microsoft Office 365 classique (pré-clonée)" },
        { id: 2, name: "Gmail Login", url: `${process.env.BASE_URL}/static-cloned-templates/gmail-login.html`, thumbnail: "https://via.placeholder.com/300x200/dc2626/ffffff?text=Gmail", category: "Google", popularity: 4, description: "Page de connexion Gmail avec authentification (pré-clonée)" },
        { id: 3, name: "Facebook Login", url: `${process.env.BASE_URL}/static-cloned-templates/facebook-login.html`, thumbnail: "https://via.placeholder.com/300x200/1877f2/ffffff?text=Facebook", category: "Social Media", popularity: 3, description: "Page de connexion Facebook mobile et desktop (pré-clonée)" },
        { id: 4, name: "LinkedIn Login", url: `${process.env.BASE_URL}/static-cloned-templates/linkedin-login.html`, thumbnail: "https://via.placeholder.com/300x200/0077b5/ffffff?text=LinkedIn", category: "Professional", popularity: 4, description: "Page de connexion LinkedIn professionnelle (pré-clonée)" },
        { id: 5, name: "Banking Portal", url: `${process.env.BASE_URL}/static-cloned-templates/banking-portal.html`, thumbnail: "https://via.placeholder.com/300x200/059669/ffffff?text=Banking", category: "Finance", popularity: 2, description: "Portail bancaire générique avec authentification forte (pré-clonée)" },
        { id: 6, name: "Corporate VPN", url: `${process.env.BASE_URL}/static-cloned-templates/corporate-vpn.html`, thumbnail: "https://via.placeholder.com/300x200/7c3aed/ffffff?text=VPN", category: "Enterprise", popularity: 3, description: "Page de connexion VPN d'entreprise (pré-clonée)" }
      ];
      const template = availableTemplates.find(t => t.id == templateId); // Utilise == pour comparaison lâche (nombre vs chaîne)

      if (!template) {
        console.log(`❌ Template non trouvé avec ID: ${templateId}`);
        return res.status(404).json({
          success: false,
          message: 'Template non trouvé'
        });
      }

      // Mettre à jour le statut en cours pour le template
      await Campaign.findByIdAndUpdate(campaignId, {
        'step4.status': 'cloning', // Le statut est "cloning" même pour un template, car on le traite comme un clonage
        'step4.message': `Préparation du template '${template.name}'...`
      });

      // Appeler le service de scraping pour "cloner" le template
      console.log(`🕷️ Appel du service de scraping pour le template: ${template.url}`);
      const scrapingResult = await ScrapingService.cloneWebsite(template.url, campaignId);

      if (!scrapingResult.success) {
        console.log(`❌ Échec de la préparation du template:`, scrapingResult.message);
        await Campaign.findByIdAndUpdate(campaignId, {
          'step4.status': 'error',
          'step4.errorMessage': scrapingResult.message || scrapingResult.error
        });
        return res.status(400).json({
          success: false,
          message: scrapingResult.message,
          error: scrapingResult.error
        });
      }

      console.log(`✅ Préparation du template réussie:`, scrapingResult);

      // Mettre à jour la campagne avec les données du template "cloné"
      const updateData = {
        'step4.type': 'template',
        'step4.selectedTemplate': template, // Conserver l'objet template original
        'step4.originalUrl': template.url, // L'URL originale du template
        'step4.clonedUrl': scrapingResult.clonedUrl, // L'URL de la page clonée
        'step4.previewUrl': scrapingResult.previewUrl, // L'URL d'aperçu de la page clonée
        'step4.filePath': scrapingResult.filePath,
        'step4.cloneId': scrapingResult.cloneId,
        'step4.selectedAt': new Date(),
        'step4.status': 'success',
        'step4.resourcesCount': scrapingResult.resourcesCount || 0,
        'step4.postSubmissionActions': {
          collectData: true,
          redirectToLearning: true,
          downloadMaliciousFile: true,
          redirectUrl: `${process.env.BASE_URL}/learning/${campaignId}`, // Utiliser BASE_URL
          maliciousFileUrl: `${process.env.BASE_URL}/downloads/malicious-test-file.zip` // Utiliser BASE_URL
        }
      };

      await Campaign.findByIdAndUpdate(campaignId, updateData);

      console.log(`✅ Campagne mise à jour avec le template sélectionné et cloné`);

      res.json({
        success: true,
        message: 'Template sélectionné et cloné avec succès',
        data: {
          selectedTemplate: template,
          clonedUrl: scrapingResult.clonedUrl,
          previewUrl: scrapingResult.previewUrl, // C'est cette URL qui sera utilisée par le frontend
          filePath: scrapingResult.filePath,
          resourcesCount: scrapingResult.resourcesCount || 0,
          cloneId: scrapingResult.cloneId
        }
      });

    } catch (error) {
      console.error('❌ Erreur selectTemplate:', error);
      // Mettre à jour le statut d'erreur dans la campagne
      if (req.params.campaignId) {
        await Campaign.findByIdAndUpdate(req.params.campaignId, {
          'step4.status': 'error',
          'step4.errorMessage': error.message
        }).catch(console.error);
      }
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la sélection du template',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtenir la liste des templates disponibles
   */
  async getTemplates(req, res) {
    try {
      console.log(`📋 Récupération de la liste des templates`);

      // Templates prédéfinis. Les URLs pointent maintenant vers des versions *statiques et pré-clonées*
      // Ces fichiers HTML statiques devraient exister dans un répertoire accessible publiquement,
      // par exemple, dans 'public/static-cloned-templates/'
      const templates = [
        {
          id: 1,
          name: "Page de connexion Office 365",
          url: `${process.env.BASE_URL}/static-cloned-templates/office365-login.html`, // URL de la page clonée statique
          thumbnail: "https://via.placeholder.com/300x200/1e40af/ffffff?text=Office+365",
          category: "Microsoft",
          popularity: 5,
          description: "Page de connexion Microsoft Office 365 classique (pré-clonée)"
        },
        {
          id: 2,
          name: "Gmail Login",
          url: `${process.env.BASE_URL}/static-cloned-templates/gmail-login.html`, // URL de la page clonée statique
          thumbnail: "https://via.placeholder.com/300x200/dc2626/ffffff?text=Gmail",
          category: "Google",
          popularity: 4,
          description: "Page de connexion Gmail avec authentification (pré-clonée)"
        },
        {
          id: 3,
          name: "Facebook Login",
          url: `${process.env.BASE_URL}/static-cloned-templates/facebook-login.html`, // URL de la page clonée statique
          thumbnail: "https://via.placeholder.com/300x200/1877f2/ffffff?text=Facebook",
          category: "Social Media",
          popularity: 3,
          description: "Page de connexion Facebook mobile et desktop (pré-clonée)"
        },
        {
          id: 4,
          name: "LinkedIn Login",
          url: `${process.env.BASE_URL}/static-cloned-templates/linkedin-login.html`, // URL de la page clonée statique
          thumbnail: "https://via.placeholder.com/300x200/0077b5/ffffff?text=LinkedIn",
          category: "Professional",
          popularity: 4,
          description: "Page de connexion LinkedIn professionnelle (pré-clonée)"
        },
        {
          id: 5,
          name: "Banking Portal",
          url: `${process.env.BASE_URL}/static-cloned-templates/banking-portal.html`, // URL de la page clonée statique
          thumbnail: "https://via.placeholder.com/300x200/059669/ffffff?text=Banking",
          category: "Finance",
          popularity: 2,
          description: "Portail bancaire générique avec authentification forte (pré-clonée)"
        },
        {
          id: 6,
          name: "Corporate VPN",
          url: `${process.env.BASE_URL}/static-cloned-templates/corporate-vpn.html`, // URL de la page clonée statique
          thumbnail: "https://via.placeholder.com/300x200/7c3aed/ffffff?text=VPN",
          category: "Enterprise",
          popularity: 3,
          description: "Page de connexion VPN d'entreprise (pré-clonée)"
        }
      ];

      console.log(`✅ ${templates.length} templates trouvés`);

      res.json({
        success: true,
        data: templates
      });

    } catch (error) {
      console.error('❌ Erreur getTemplates:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des templates'
      });
    }
  }

  /**
   * Mettre à jour les actions post-soumission
   */
  async updatePostSubmissionActions(req, res) {
    try {
      const { campaignId } = req.params;
      const { postSubmissionActions } = req.body;

      console.log(`⚙️ Mise à jour des actions post-soumission pour ${campaignId}`);

      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }

      await Campaign.findByIdAndUpdate(campaignId, {
        'step4.postSubmissionActions': {
          ...campaign.step4?.postSubmissionActions,
          ...postSubmissionActions
        }
      });

      console.log(`✅ Actions post-soumission mises à jour`);

      res.json({
        success: true,
        message: 'Actions post-soumission mises à jour'
      });

    } catch (error) {
      console.error('❌ Erreur updatePostSubmissionActions:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour'
      });
    }
  }

  /**
   * Valider l'étape landing page et passer à la suivante
   */
  async validateStep(req, res) {
    try {
      const { campaignId } = req.params;

      console.log(`✅ Validation de l'étape landing page pour ${campaignId}`);

      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }

      // Vérifier que l'étape est complète et qu'une page a été clonée ou un template sélectionné et traité
      if (!campaign.step4 || campaign.step4.status !== 'success' || (!campaign.step4.clonedUrl && !campaign.step4.selectedTemplate)) {
        return res.status(400).json({
          success: false,
          message: 'Veuillez compléter la configuration de la landing page (clonage ou sélection de template).'
        });
      }

      console.log(`✅ Étape validée avec succès`);

      res.json({
        success: true,
        message: 'Étape validée avec succès',
        data: {
          nextStep: 'step5',
          canProceed: true
        }
      });

    } catch (error) {
      console.error('❌ Erreur validateStep:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la validation'
      });
    }
  }
}

module.exports = new LandingPageController();
