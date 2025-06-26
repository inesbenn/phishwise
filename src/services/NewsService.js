// src/services/NewsService.js
const axios = require('axios');

class NewsService {
  constructor() {
    this.apiKey = process.env.NEWS_API_KEY || 'e8164eff7bb7431eb673c5591b663c1e';
    this.baseUrl = 'https://newsapi.org/v2';
    
    if (!this.apiKey) {
      console.warn('NEWS_API_KEY non définie dans les variables d\'environnement');
    }
  }

  /**
   * Récupère les actualités depuis NewsAPI
   * @param {Object} params - Paramètres de recherche
   * @param {string} params.country - Code pays (ex: 'fr', 'us')
   * @param {string} params.theme - Thème recherché
   * @param {number} params.credibility - Seuil de crédibilité minimum
   * @param {number} params.limit - Nombre max d'articles
   * @returns {Promise<Object>} Articles avec score de crédibilité
   */
  async fetchNews({ country, theme, credibility = 0, limit = 20 }) {
    try {
      // Convertir le thème en mots-clés de recherche
      const searchQuery = this.getSearchKeywords(theme);
      
      // Calculer la langue en fonction du pays
      const language = this.getLanguageFromCountry(country);

      console.log('🔍 Recherche NewsAPI:', {
        query: searchQuery,
        language,
        country,
        theme
      });

      // Appel à l'API NewsAPI
      const response = await axios.get(`${this.baseUrl}/everything`, {
        params: {
          apiKey: this.apiKey,
          q: searchQuery,
          language,
          sortBy: 'publishedAt',
          pageSize: Math.min(limit * 3, 100), // Récupérer plus pour avoir le choix après filtrage
          from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 7 derniers jours
        },
        timeout: 15000
      });

      console.log('📡 Réponse API:', {
        status: response.data.status,
        totalResults: response.data.totalResults,
        articlesReçus: response.data.articles?.length || 0
      });

      if (response.data.status !== 'ok') {
        console.error('❌ Erreur API:', response.data);
        throw new Error(`NewsAPI Error: ${response.data.message || 'Erreur inconnue'}`);
      }

      // Vérifier si des articles ont été retournés
      if (!response.data.articles || response.data.articles.length === 0) {
        console.log('⚠️ Aucun article trouvé pour cette recherche');
        return {
          articles: [],
          totalResults: 0,
          query: searchQuery,
          filters: { country, theme, credibility },
          message: 'Aucun article trouvé pour ces critères'
        };
      }

      // Traitement MINIMAL des articles pour garder le maximum
      let articles = response.data.articles
        .filter(article => {
          // Filtrage minimal - on garde même les articles partiels
          return article && 
                 article.title && 
                 article.title.trim() !== '' &&
                 article.title !== '[Removed]' &&
                 article.source?.name;
        })
        .map((article, index) => {
          // Calcul du score de crédibilité
          const credibilityScore = this.calculateCredibilityScore(article);
          
          return {
            id: `news_${Date.now()}_${index}`,
            title: article.title,
            description: article.description || article.content?.substring(0, 200) || 'Description non disponible',
            excerpt: article.description?.substring(0, 150) || article.content?.substring(0, 150) || 'Extrait non disponible',
            source: article.source.name,
            publishedAt: article.publishedAt,
            date: new Date(article.publishedAt).toISOString().split('T')[0],
            url: article.url,
            urlToImage: article.urlToImage,
            credibilityScore: credibilityScore,
            credibility: credibilityScore,
            theme: theme,
            country: country,
            author: article.author
          };
        });

      console.log('📊 Articles après traitement initial:', articles.length);

      // Filtrer par seuil de crédibilité SEULEMENT si credibility > 0
      if (credibility > 0) {
        articles = articles.filter(article => article.credibilityScore >= credibility);
        console.log(`📊 Articles après filtrage crédibilité (>=${credibility}):`, articles.length);
      }

      // Trier par date puis par crédibilité
      articles.sort((a, b) => {
        const dateA = new Date(a.publishedAt);
        const dateB = new Date(b.publishedAt);
        if (dateB.getTime() !== dateA.getTime()) {
          return dateB.getTime() - dateA.getTime(); // Plus récent d'abord
        }
        return b.credibilityScore - a.credibilityScore; // Puis par crédibilité
      });

      // Limiter le nombre d'articles
      const finalArticles = articles.slice(0, limit);
      
      console.log('✅ Articles finaux retournés:', finalArticles.length);
      
      if (finalArticles.length > 0) {
        console.log('📰 Premier article:', {
          title: finalArticles[0].title,
          source: finalArticles[0].source,
          credibility: finalArticles[0].credibilityScore
        });
      }

      return {
        articles: finalArticles,
        totalResults: finalArticles.length,
        query: searchQuery,
        filters: { country, theme, credibility },
        apiStats: {
          totalFromAPI: response.data.totalResults,
          receivedFromAPI: response.data.articles.length,
          afterFiltering: finalArticles.length
        }
      };

    } catch (error) {
      console.error('❌ ERREUR dans fetchNews:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      // NE PAS utiliser le fallback - retourner l'erreur réelle
      if (error.response?.status === 429) {
        throw new Error('Limite de requêtes NewsAPI atteinte (429). Attendez avant de réessayer.');
      } else if (error.response?.status === 401) {
        throw new Error('Clé API NewsAPI invalide (401). Vérifiez votre clé API.');
      } else if (error.response?.status === 400) {
        throw new Error(`Requête invalide (400): ${error.response.data?.message || 'Paramètres incorrects'}`);
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Timeout - NewsAPI met trop de temps à répondre');
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error('Impossible de contacter NewsAPI - vérifiez votre connexion internet');
      }
      
      // Pour toute autre erreur, la relancer
      throw new Error(`Erreur NewsAPI: ${error.message}`);
    }
  }

  /**
   * Calcule un score de crédibilité basé sur la source et d'autres facteurs
   * @param {Object} article - Article NewsAPI
   * @returns {number} Score de 1 à 10
   */
  calculateCredibilityScore(article) {
    let score = 6; // Score de base plus généreux

    // Sources fiables connues (plus large)
    const trustedSources = [
      'bbc', 'reuters', 'associated press', 'ap news', 'france24', 'le monde', 'le figaro',
      'libération', 'liberation', 'afp', 'cnn', 'nytimes', 'guardian', 'techcrunch',
      'wired', 'ars technica', 'zdnet', 'the verge', 'engadget', 'forbes',
      'bleeping computer', 'security week', 'krebs on security', 'the hacker news',
      'cnet', '01net', 'numerama', 'clubic', 'silicon'
    ];

    if (article.source?.name) {
      const sourceName = article.source.name.toLowerCase();
      
      // Bonus pour sources fiables
      if (trustedSources.some(trusted => sourceName.includes(trusted))) {
        score += 2;
      }
    }

    // Bonus si l'article a une description
    if (article.description && article.description.length > 50) {
      score += 1;
    }

    // Bonus si l'article a une image
    if (article.urlToImage) {
      score += 1;
    }

    // Bonus si l'article a un auteur
    if (article.author) {
      score += 1;
    }

    // Léger malus si très ancien (plus de 30 jours)
    if (article.publishedAt) {
      const publishDate = new Date(article.publishedAt);
      const daysDiff = (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > 30) {
        score -= 1;
      }
    }

    return Math.max(1, Math.min(10, Math.round(score)));
  }

  /**
   * Convertit un thème en mots-clés de recherche optimisés
   * @param {string} theme - Thème sélectionné
   * @returns {string} Mots-clés pour la recherche
   */
  getSearchKeywords(theme) {
    const themeKeywords = {
      // Mots-clés plus simples et efficaces
      'cybersecurity': 'cybersecurity OR security OR hack OR breach',
      'finance': 'finance OR banking OR economy OR financial',
      'tech': 'technology OR tech OR digital OR innovation',
      'health': 'health OR medical OR healthcare OR medicine',
      'politics': 'politics OR political OR government OR election',
      'business': 'business OR company OR corporate OR industry',
      'science': 'science OR research OR scientific OR discovery'
    };

    return themeKeywords[theme.toLowerCase()] || theme;
  }

  /**
   * Détermine la langue basée sur le pays
   * @param {string} country - Code pays
   * @returns {string} Code langue
   */
  getLanguageFromCountry(country) {
    const countryToLanguage = {
      'fr': 'fr',
      'tn': 'ar', // Tunisie -> arabe ou français, essayons arabe d'abord
      'us': 'en',
      'gb': 'en',
      'ca': 'en',
      'au': 'en',
      'de': 'de',
      'it': 'it',
      'es': 'es',
      'jp': 'ja',
      'cn': 'zh'
    };

    return countryToLanguage[country.toLowerCase()] || 'en';
  }
}

// Export singleton
module.exports = new NewsService();