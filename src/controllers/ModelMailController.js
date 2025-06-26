// src/controllers/ModelMailController.js
const Campaign = require('../models/Campaign');
const NewsService = require('../services/NewsService');
// TEMPORAIREMENT DÉSACTIVÉ - Service OpenAI non disponible
//const OpenAIService = require('../services/OpenAIService');

class ModelMailController {

  // Vérification préalable de la clé API
   static init() {
     if (!process.env.NEWS_API_KEY) {
      console.warn('⚠️ NEWS_API_KEY is not defined in environment variables');
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

      // ANCIEN CODE OpenAI (temporairement désactivé)
      // const suggestions = await OpenAIService.generatePhishingSuggestions(selectedNews);

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
}

module.exports = ModelMailController;
ModelMailController.init();