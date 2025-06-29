// src/controllers/ModelMailController.js
const Campaign = require('../models/Campaign');
const NewsService = require('../services/NewsService');
// CORRECTION: Import GroqService réactivé
const GroqService = require('../services/GroqService');

class ModelMailController {

  // Vérification préalable des clés API
   static init() {
     if (!process.env.NEWS_API_KEY) {
      console.warn('⚠️ NEWS_API_KEY is not defined in environment variables');
    }
    if (!process.env.GROQ_API_KEY) {
      console.warn('⚠️ GROQ_API_KEY is not defined in environment variables');
    }
  }

  /**
   * Récupère les actualités dynamiques depuis NewsAPI
   * GET /api/campaigns/:campaignId/news
   */
  static async getNews(req, res) {
    try {
      const { campaignId } = req.params;
      const { country, theme, credibility = 5, limit = 20 } = req.query;

      // Validation des paramètres
      if (!country || !theme) {
        return res.status(400).json({
          success: false,
          message: 'Les paramètres country et theme sont requis'
        });
      }

      // Récupération des actualités depuis NewsAPI
      const newsData = await NewsService.fetchNews({
        country,
        theme,
        credibility: Number(credibility),
        limit: Number(limit)
      });

      // Vérifier si la campagne existe et la mettre à jour avec les filtres
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }

      // Sauvegarder les filtres appliqués dans la campagne
      if (!campaign.step2) {
        campaign.step2 = {};
      }
      
      campaign.step2.filters = {
        country,
        theme,
        credibility: Number(credibility)
      };

      await campaign.save();

      return res.json({
        success: true,
        data: {
          news: newsData.articles,
          totalResults: newsData.totalResults,
          filters: {
            country,
            theme,
            credibility: Number(credibility)
          }
        }
      });

    } catch (error) {
      console.error('🔥 getNews ERROR:', error.stack || error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne lors de la récupération des actualités (voir logs serveur)',
        error: error.message
      });
    }
  }

  /**
   * Sauvegarde les actualités sélectionnées pour la campagne
   * POST /api/campaigns/:campaignId/news/select
   */
  static async selectNews(req, res) {
    try {
      const { campaignId } = req.params;
      const { selectedNews } = req.body;

      if (!selectedNews || !Array.isArray(selectedNews)) {
        return res.status(400).json({
          success: false,
          message: 'selectedNews doit être un tableau'
        });
      }

      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }

      // Initialiser step2 si nécessaire
      if (!campaign.step2) {
        campaign.step2 = {
          filters: {},
          news: [],
          suggestions: []
        };
      }

      // Sauvegarder les actualités sélectionnées
      campaign.step2.news = selectedNews.map(news => ({
        id: news.id || Date.now() + Math.random(),
        title: news.title,
        excerpt: news.description || news.excerpt,
        source: news.source,
        date: new Date(news.publishedAt || news.date),
        credibility: news.credibilityScore || news.credibility || 5,
        url: news.url,
        urlToImage: news.urlToImage
      }));

      await campaign.save();

      res.json({
        success: true,
        message: 'Actualités sélectionnées sauvegardées',
        data: {
          selectedCount: selectedNews.length,
          news: campaign.step2.news
        }
      });

    } catch (error) {
      console.error('Erreur lors de la sauvegarde des actualités:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la sauvegarde des actualités',
        error: error.message
      });
    }
  }

  /**
   * Génère des suggestions de sujets basées sur les actualités sélectionnées
   * POST /api/campaigns/:campaignId/suggestions/generate
   * 
   * ⚠️ TEMPORAIREMENT DÉSACTIVÉ - Service OpenAI non disponible
   */
  static async generateSuggestions(req, res) {
    try {
      const { campaignId } = req.params;
      const { selectedNews } = req.body;

      if (!selectedNews || !Array.isArray(selectedNews) || selectedNews.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Au moins une actualité doit être sélectionnée pour générer des suggestions'
        });
      }

      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }

      // TEMPORAIRE : Générer des suggestions factices en attendant OpenAI
      const mockSuggestions = [
        {
          id: 1,
          title: "Alerte de sécurité urgente",
          description: "Une faille de sécurité critique a été découverte dans votre système",
          type: "security_alert",
          urgency: "high",
          basedOn: selectedNews[0]?.title || "Actualité sélectionnée"
        },
        {
          id: 2,
          title: "Mise à jour requise immédiatement",
          description: "Votre compte nécessite une mise à jour de sécurité immédiate",
          type: "update_required",
          urgency: "medium",
          basedOn: selectedNews[0]?.title || "Actualité sélectionnée"
        },
        {
          id: 3,
          title: "Vérification d'identité nécessaire",
          description: "Suite aux récents événements, une vérification est requise",
          type: "identity_check",
          urgency: "medium",
          basedOn: selectedNews[0]?.title || "Actualité sélectionnée"
        }
      ];
            // Sauvegarder les suggestions dans la campagne
      if (!campaign.step2) {
        campaign.step2 = {
          filters: {},
          news: [],
          suggestions: []
        };
      }

      campaign.step2.suggestions = mockSuggestions; // Utilisation des suggestions factices
      await campaign.save();

      res.json({
        success: true,
        message: 'Suggestions générées avec succès (mode temporaire)',
        data: {
          suggestions: mockSuggestions,
          count: mockSuggestions.length,
          note: "Service OpenAI temporairement désactivé - suggestions factices utilisées"
        }
      });

    } catch (error) {
      console.error('Erreur lors de la génération des suggestions:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération des suggestions',
        error: error.message
      });
    }
  }

  /**
   * Récupère les données sauvegardées du Step 2 pour une campagne
   * GET /api/campaigns/:campaignId/step2
   */
  static async getStep2Data(req, res) {
    try {
      const { campaignId } = req.params;

      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }

      res.json({
        success: true,
        data: campaign.step2 || {
          filters: {},
          news: [],
          suggestions: []
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des données Step 2:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des données',
        error: error.message
      });
    }
  }

  /**
   * Met à jour les données du Step 2
   * PUT /api/campaigns/:campaignId/step2
   */
  static async updateStep2Data(req, res) {
    try {
      const { campaignId } = req.params;
      const { filters, news, suggestions } = req.body;

      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }

      // Initialiser step2 si nécessaire
      if (!campaign.step2) {
        campaign.step2 = {};
      }

      // Mettre à jour les données
      if (filters) campaign.step2.filters = filters;
      if (news) campaign.step2.news = news;
      if (suggestions) campaign.step2.suggestions = suggestions;

      await campaign.save();

      res.json({
        success: true,
        message: 'Données Step 2 mises à jour',
        data: campaign.step2
      });

    } catch (error) {
      console.error('Erreur lors de la mise à jour Step 2:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour',
        error: error.message
      });
    }
  }

  /**
   * Récupère les thèmes disponibles
   * GET /api/news/themes
   */
  static async getThemes(req, res) {
    try {
      const themes = [
        { id: 'cybersecurity', name: 'Cybersécurité', icon: '🔒', keywords: 'cybersecurity security hack breach data' },
        { id: 'finance', name: 'Finance', icon: '💰', keywords: 'finance banking money investment crypto' },
        { id: 'tech', name: 'Technologie', icon: '💻', keywords: 'technology software AI artificial intelligence' },
        { id: 'health', name: 'Santé', icon: '🏥', keywords: 'health medical healthcare medicine' },
        { id: 'politics', name: 'Politique', icon: '🏛️', keywords: 'politics government election policy' },
        { id: 'business', name: 'Business', icon: '💼', keywords: 'business corporate company enterprise' },
        { id: 'science', name: 'Science', icon: '🔬', keywords: 'science research innovation discovery' }
      ];

      res.json({
        success: true,
        data: themes
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des thèmes',
        error: error.message
      });
    }
  }

  /**
   * Récupère les pays supportés
   * GET /api/news/countries
   */
  static async getCountries(req, res) {
    try {
      const countries = [
        { code: 'tn', name: 'Tunisie', flag: '🇹🇳' },
        { code: 'fr', name: 'France', flag: '🇫🇷' },
        { code: 'us', name: 'États-Unis', flag: '🇺🇸' },
        { code: 'de', name: 'Allemagne', flag: '🇩🇪' },
        { code: 'gb', name: 'Royaume-Uni', flag: '🇬🇧' },
        { code: 'ca', name: 'Canada', flag: '🇨🇦' },
        { code: 'au', name: 'Australie', flag: '🇦🇺' },
        { code: 'jp', name: 'Japon', flag: '🇯🇵' },
        { code: 'it', name: 'Italie', flag: '🇮🇹' },
        { code: 'es', name: 'Espagne', flag: '🇪🇸' }
      ];

      res.json({
        success: true,
        data: countries
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des pays',
        error: error.message
      });
    }
  }

  /**
   * Génère des templates d'emails basés sur les actualités sélectionnées
   * POST /api/campaigns/:campaignId/templates/generate
   */
  static async generateEmailTemplates(req, res) {
    try {
      const { campaignId } = req.params;
      const { useSelectedNews = true, customParams = {} } = req.body;

      // Vérifier que la campagne existe
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }

      // Vérifier qu'il y a des actualités sélectionnées si nécessaire
      if (useSelectedNews && (!campaign.step2?.news || campaign.step2.news.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'Aucune actualité sélectionnée. Veuillez d\'abord compléter l\'étape 2.'
        });
      }

      const selectedNews = useSelectedNews ? campaign.step2.news : [];
      const targets = campaign.targets || [];

      // Générer les templates via Groq
      console.log(`🤖 Génération de templates pour la campagne ${campaignId}...`);
      const generatedTemplates = await GroqService.generatePhishingTemplates(selectedNews, targets);

      // Initialiser step3 si nécessaire
      if (!campaign.step3) {
        campaign.step3 = {
          templates: [],
          selectedTemplate: null,
          generatedAt: null
        };
      }

      // Sauvegarder les templates générés
      campaign.step3.templates = generatedTemplates;
      campaign.step3.generatedAt = new Date();

      await campaign.save();

      res.json({
        success: true,
        message: 'Templates d\'emails générés avec succès',
        data: {
          templates: generatedTemplates,
          count: generatedTemplates.length,
          generatedAt: campaign.step3.generatedAt,
          basedOnNews: selectedNews.map(news => news.title)
        }
      });

    } catch (error) {
      console.error('🔥 Erreur generateEmailTemplates:', error);
      
      // Gestion spécifique des erreurs Groq/IA
      if (error.message.includes('API key') || error.message.includes('GROQ_API_KEY')) {
        return res.status(500).json({
          success: false,
          message: 'Service de génération IA non configuré',
          error: 'Clé API Groq manquante'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération des templates',
        error: error.message
      });
    }
  }

  /**
   * Récupère les templates existants pour une campagne
   * GET /api/campaigns/:campaignId/templates
   */
  static async getEmailTemplates(req, res) {
    try {
      const { campaignId } = req.params;

      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }

      const step3Data = campaign.step3 || {
        templates: [],
        selectedTemplate: null,
        generatedAt: null
      };

      res.json({
        success: true,
        data: step3Data
      });

    } catch (error) {
      console.error('Erreur getEmailTemplates:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des templates',
        error: error.message
      });
    }
  }

  /**
   * Sélectionne un template spécifique pour la campagne
   * PUT /api/campaigns/:campaignId/templates/:templateId/select
   */
  static async selectEmailTemplate(req, res) {
    try {
      const { campaignId, templateId } = req.params;

      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }

      // Vérifier que le template existe
      if (!campaign.step3?.templates) {
        return res.status(400).json({
          success: false,
          message: 'Aucun template disponible'
        });
      }

      const selectedTemplate = campaign.step3.templates.find(t => t.id === templateId);
      if (!selectedTemplate) {
        return res.status(404).json({
          success: false,
          message: 'Template non trouvé'
        });
      }

      // Sauvegarder la sélection
      campaign.step3.selectedTemplate = templateId;
      await campaign.save();

      res.json({
        success: true,
        message: 'Template sélectionné',
        data: {
          selectedTemplate: templateId,
          template: selectedTemplate
        }
      });

    } catch (error) {
      console.error('Erreur selectEmailTemplate:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la sélection du template',
        error: error.message
      });
    }
  }

  /**
   * Génère un template personnalisé
   * POST /api/campaigns/:campaignId/templates/custom
   */
  static async generateCustomTemplate(req, res) {
    try {
      const { campaignId } = req.params;
      const { type, sophistication, newsId, customInstructions } = req.body;

      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }

      // Récupérer l'actualité spécifique si fournie
      let selectedNews = null;
      if (newsId && campaign.step2?.news) {
        selectedNews = campaign.step2.news.find(news => news.id === newsId);
      }

      // Générer le template personnalisé
      const customTemplate = await GroqService.generateCustomTemplate({
        type,
        sophistication,
        news: selectedNews,
        customInstructions
      });

      // Ajouter le template aux templates existants
      if (!campaign.step3) {
        campaign.step3 = { templates: [], selectedTemplate: null, generatedAt: null };
      }

      campaign.step3.templates.push(customTemplate);
      await campaign.save();

      res.json({
        success: true,
        message: 'Template personnalisé généré',
        data: {
          template: customTemplate,
          totalTemplates: campaign.step3.templates.length
        }
      });

    } catch (error) {
      console.error('Erreur generateCustomTemplate:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du template personnalisé',
        error: error.message
      });
    }
  }

  /**
   * Supprime un template spécifique
   * DELETE /api/campaigns/:campaignId/templates/:templateId
   */
  static async deleteEmailTemplate(req, res) {
    try {
      const { campaignId, templateId } = req.params;

      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }

      if (!campaign.step3?.templates) {
        return res.status(400).json({
          success: false,
          message: 'Aucun template disponible'
        });
      }

      // Filtrer le template à supprimer
      const originalCount = campaign.step3.templates.length;
      campaign.step3.templates = campaign.step3.templates.filter(t => t.id !== templateId);

      if (campaign.step3.templates.length === originalCount) {
        return res.status(404).json({
          success: false,
          message: 'Template non trouvé'
        });
      }

      // Réinitialiser la sélection si le template sélectionné est supprimé
      if (campaign.step3.selectedTemplate === templateId) {
        campaign.step3.selectedTemplate = null;
      }

      await campaign.save();

      res.json({
        success: true,
        message: 'Template supprimé',
        data: {
          remainingTemplates: campaign.step3.templates.length
        }
      });

    } catch (error) {
      console.error('Erreur deleteEmailTemplate:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression du template',
        error: error.message
      });
    }
  }

  /**
   * Prévisualise un template avec des données de test
   * POST /api/campaigns/:campaignId/templates/:templateId/preview
   */
  static async previewEmailTemplate(req, res) {
    try {
      const { campaignId, templateId } = req.params;
      const { sampleData = {} } = req.body;

      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campagne non trouvée'
        });
      }

      const template = campaign.step3?.templates?.find(t => t.id === templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template non trouvé'
        });
      }

      // Données de test par défaut
      const defaultData = {
        firstName: sampleData.firstName || 'John',
        lastName: sampleData.lastName || 'Doe',
        position: sampleData.position || 'Employé',
        email: sampleData.email || 'john.doe@example.com'
      };

      // Remplacer les placeholders
      let previewHTML = template.content_html;
      let previewText = template.content_text || '';

      Object.entries(defaultData).forEach(([key, value]) => {
        const placeholder = new RegExp(`{{${key}}}`, 'g');
        previewHTML = previewHTML.replace(placeholder, value);
        previewText = previewText.replace(placeholder, value);
      });

      res.json({
        success: true,
        data: {
          template: {
            ...template,
            preview_html: previewHTML,
            preview_text: previewText
          },
          sampleData: defaultData
        }
      });

    } catch (error) {
      console.error('Erreur previewEmailTemplate:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la prévisualisation',
        error: error.message
      });
    }
  }

  /**
   * Test de la connexion Groq
   * GET /api/groq/test
   */
  static async testGroqConnection(req, res) {
    try {
      // Vérifier d'abord si la clé API est configurée
      if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({
          success: false,
          message: 'Clé API Groq non configurée',
          error: 'GROQ_API_KEY manquante dans les variables d\'environnement',
          details: {
            hasApiKey: false,
            service: 'Groq/Llama-3.3-70b-versatile'
          }
        });
      }

      const isConnected = await GroqService.testConnection();
      
      res.json({
        success: isConnected,
        message: isConnected ? 'Connexion Groq fonctionnelle' : 'Échec de connexion Groq',
        data: {
          service: 'Groq/Llama-3.3-70b-versatile',
          status: isConnected ? 'connected' : 'failed',
          timestamp: new Date(),
          hasApiKey: true
        }
      });
    } catch (error) {
      console.error('🔥 Erreur test Groq:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du test de connexion',
        error: error.message,
        details: {
          hasApiKey: !!process.env.GROQ_API_KEY,
          errorType: error.constructor.name,
          service: 'Groq/Llama-3.3-70b-versatile'
        }
      });
    }
  }

}

module.exports = ModelMailController;
ModelMailController.init();