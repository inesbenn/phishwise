// src/services/GroqService.js
const { Groq } = require('groq-sdk');

class GroqService {
  constructor() {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
  }

  /**
   * Nettoie et extrait le JSON d'une réponse IA
   * @param {string} response - Réponse brute de l'IA
   * @returns {Object} - JSON parsé
   */
  extractAndParseJSON(response) {
    try {
      // Nettoyer la réponse
      let cleanResponse = response.trim();
      
      // Supprimer les balises markdown si présentes
      cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Chercher le premier { jusqu'au dernier }
      const firstBrace = cleanResponse.indexOf('{');
      const lastBrace = cleanResponse.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanResponse = cleanResponse.substring(firstBrace, lastBrace + 1);
      }
      
      // Tenter de parser
      return JSON.parse(cleanResponse);
    } catch (error) {
      console.error('Erreur parsing JSON:', error.message);
      console.error('Réponse brute:', response);
      throw new Error(`Impossible de parser la réponse JSON: ${error.message}`);
    }
  }

  /**
   * Génère des templates de fallback pour un sujet spécifique
   * @param {Object} newsItem - Actualité sélectionnée
   * @param {number} templateCount - Nombre de templates à générer
   * @returns {Array} - Templates de fallback
   */
  generateFallbackTemplatesForNews(newsItem, templateCount = 3) {
    const templates = [];
    const newsTitle = newsItem?.title || 'Actualité récente';
    const newsExcerpt = newsItem?.excerpt || newsItem?.description || 'Événement important';
    const timestamp = Date.now();

    for (let i = 0; i < templateCount; i++) {
      const sophisticationLevels = ['low', 'medium', 'high'];
      const types = ['security_alert', 'system_notification', 'verification'];
      const currentLevel = sophisticationLevels[i % 3];
      const currentType = types[i % 3];

      templates.push({
        id: `fallback_${timestamp}_${i + 1}`,
        name: `Template ${currentLevel} - ${newsTitle}`,
        type: currentType,
        sophistication_level: currentLevel,
        subject: this.generateFallbackSubject(newsTitle, currentType, currentLevel),
        content_html: this.generateFallbackHTML(newsTitle, newsExcerpt, currentType, currentLevel),
        content_text: this.generateFallbackText(newsTitle, newsExcerpt, currentType, currentLevel),
        personalization_fields: ["firstName", "lastName", "position"],
        based_on_news: newsTitle,
        preview: `Template ${currentLevel} basé sur: ${newsTitle}`,
        created_at: new Date()
      });
    }

    return templates;
  }

  /**
   * Génère un sujet de fallback
   */
  generateFallbackSubject(newsTitle, type, level) {
    const subjects = {
      security_alert: {
        low: `URGENT: Action requise suite à ${newsTitle}`,
        medium: `Alerte de sécurité - ${newsTitle}`,
        high: `Vérification de sécurité suite à l'incident ${newsTitle}`
      },
      system_notification: {
        low: `Mise à jour importante - ${newsTitle}`,
        medium: `Notification système - Impact ${newsTitle}`,
        high: `Procédure de conformité suite à ${newsTitle}`
      },
      verification: {
        low: `Vérification de compte nécessaire`,
        medium: `Validation d'identité requise - ${newsTitle}`,
        high: `Audit de sécurité suite aux événements ${newsTitle}`
      }
    };

    return subjects[type]?.[level] || `Information importante - ${newsTitle}`;
  }

  /**
   * Génère le contenu HTML de fallback
   */
  generateFallbackHTML(newsTitle, newsExcerpt, type, level) {
    const baseStyle = "font-family: Arial, sans-serif; margin: 20px;";
    const urgentStyle = "background: #ff4444; color: white; padding: 10px; border-radius: 5px;";
    const professionalStyle = "background: #2c5aa0; color: white; padding: 20px; text-align: center;";

    const contents = {
      security_alert: {
        low: `
<html>
<body style="${baseStyle}">
  <div style="${urgentStyle}">
    <h2>⚠️ ALERTE DE SÉCURITÉ</h2>
    </div>
  <p>Bonjour {{firstName}} {{lastName}},</p>
  <p>Suite aux récents événements concernant <strong>${newsTitle}</strong>, votre compte nécessite une vérification immédiate.</p>
  <p>${newsExcerpt}</p>
  <div style="text-align: center; margin: 20px;">
    <a href="http://example-phishing-simulation.local" style="background: #ff4444; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px;">
      VÉRIFIER MON COMPTE
    </a>
  </div>
  <p>Cordialement,<br>L'équipe de sécurité</p>
</body>
</html>`,
        medium: `
<html>
<body style="${baseStyle}">
  <div style="${professionalStyle}">
    <h1>Alerte de Sécurité</h1>
  </div>
  <div style="padding: 20px;">
    <p>Cher(e) {{firstName}},</p>
    <p>En raison des événements récents mentionnés dans les actualités (<em>${newsTitle}</em>), notre équipe de sécurité a identifié des risques potentiels.</p>
    <p><strong>Contexte:</strong> ${newsExcerpt}</p>
    <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h3>Action requise</h3>
      <p>Votre profil {{position}} nécessite une validation immédiate.</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="http://example-phishing-simulation.local" style="background: #28a745; color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px;">
        VALIDER MON PROFIL
      </a>
    </div>
  </div>
</body>
</html>`,
        high: `
<html>
<body style="font-family: 'Times New Roman', serif; margin: 0; padding: 20px; background-color: #fafafa;">
  <div style="max-width: 700px; margin: 0 auto; background: white; border: 1px solid #ddd;">
    <div style="background: #1e3a8a; color: white; padding: 15px 30px;">
      <h2>🏛️ Direction de la Sécurité Informatique</h2>
      <p style="margin: 5px 0 0 0; font-size: 12px;">Réf: SEC-${Date.now().toString().slice(-6)}</p>
   </div>
    <div style="padding: 30px;">
      <p>À l'attention de : <strong>{{firstName}} {{lastName}}</strong><br>
      Fonction : {{position}}</p>
      <h3>Objet : Audit de sécurité suite à l'incident "${newsTitle}"</h3>
      <p>Madame, Monsieur,</p>
      <p>Suite à l'analyse des événements rapportés dans <em>"${newsTitle}"</em>, votre profil a été sélectionné pour un audit de sécurité approfondi.</p>
      <p><strong>Contexte détaillé:</strong> ${newsExcerpt}</p>
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0;">
        <h4>📋 Procédure obligatoire</h4>
        <p>Vous disposez de 48 heures pour compléter cette vérification.</p>
    </div>
      <div style="text-align: center; margin: 35px 0;">
        <a href="http://example-phishing-simulation.local" style="background: linear-gradient(135deg, #1e3a8a, #3b82f6); color: white; padding: 18px 35px; text-decoration: none; border-radius: 6px;">
          🔐 ACCÉDER AU PORTAIL SÉCURISÉ
        </a>
      </div>
      <p>Cordialement,<br><strong>Service de Sécurité Informatique</strong></p>
    </div>
  </div>
</body>
</html>`
      }
    };

    return contents[type]?.[level] || contents.security_alert.medium;
  }

  /**
   * Génère le contenu texte de fallback
   */
  generateFallbackText(newsTitle, newsExcerpt, type, level) {
    return `${newsTitle}\n\nBonjour {{firstName}} {{lastName}},\n\nSuite aux événements récents concernant ${newsTitle}, une action est requise.\n\nContexte: ${newsExcerpt}\n\nLien: http://example-phishing-simulation.local\n\nCordialement,\nÉquipe de sécurité\n\n[Simulation de phishing - Formation cybersécurité]`;
  }

  /**
   * Génère des modèles d'emails de phishing basés sur PLUSIEURS actualités sélectionnées
   * @param {Array} selectedNews - Actualités sélectionnées
   * @param {Array} targets - Cibles de la campagne pour personnalisation
   * @param {Object} options - Options de génération
   * @returns {Promise<Array>} - Templates d'emails générés
   */
  async generatePhishingTemplates(selectedNews, targets = [], options = {}) {
    try {
      const {
        templatesPerNews = 3,
        maxTotalTemplates = 15,
        sophisticationLevels = ['low', 'medium', 'high'],
        templateTypes = ['security_alert', 'system_notification', 'verification']
      } = options;

      // Validation des paramètres
      if (!selectedNews || selectedNews.length === 0) {
        console.warn('⚠️ Aucune actualité fournie, utilisation des templates de fallback');
        return this.generateFallbackTemplatesForNews({}, 3);
      }

      // Vérifier la clé API
      if (!process.env.GROQ_API_KEY) {
        console.warn('⚠️ GROQ_API_KEY manquante, utilisation des templates de fallback');
        return this.generateMultipleFallbackTemplates(selectedNews, templatesPerNews);
      }

      console.log(`🤖 Génération de ${templatesPerNews} templates pour ${selectedNews.length} actualités...`);

      const allTemplates = [];

      // Générer des templates pour chaque actualité
      for (let i = 0; i < selectedNews.length; i++) {
        const newsItem = selectedNews[i];
        
        // Limiter le nombre total de templates
        if (allTemplates.length >= maxTotalTemplates) {
          console.log(`⚠️ Limite de ${maxTotalTemplates} templates atteinte`);
          break;
        }

        try {
          const templatesForThisNews = await this.generateTemplatesForSingleNews(
            newsItem, 
            targets, 
            templatesPerNews,
            sophisticationLevels,
            templateTypes
          );

          allTemplates.push(...templatesForThisNews);
          
          // Petit délai pour éviter le rate limiting
          if (i < selectedNews.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

        } catch (error) {
          console.error(`❌ Erreur pour l'actualité "${newsItem.title}":`, error.message);
          // Ajouter des templates de fallback pour cette actualité
          const fallbackTemplates = this.generateFallbackTemplatesForNews(newsItem, templatesPerNews);
          allTemplates.push(...fallbackTemplates);
        }
      }

      console.log(`✅ ${allTemplates.length} templates générés au total`);
      return allTemplates.slice(0, maxTotalTemplates);

    } catch (error) {
      console.error('❌ Erreur GroqService:', error.message);
      console.log('🔄 Fallback: génération de templates par défaut');
      return this.generateMultipleFallbackTemplates(selectedNews || [], templatesPerNews);
    }
  }

  /**
   * Génère des templates pour une seule actualité
   */
  async generateTemplatesForSingleNews(newsItem, targets, templateCount, sophisticationLevels, templateTypes) {
    const targetCountries = [...new Set(targets.map(t => t.country).filter(Boolean))];
    const targetPositions = [...new Set(targets.map(t => t.position).filter(Boolean))];

    const prompt = `Tu es un expert en cybersécurité qui crée des simulations d'emails de phishing pour la formation.

ACTUALITÉ À UTILISER:
- Titre: ${newsItem.title}
- Description: ${newsItem.excerpt || newsItem.description || 'Non disponible'}
- Source: ${newsItem.source || 'Source inconnue'}

INFORMATIONS SUR LES CIBLES:
- Pays: ${targetCountries.join(', ') || 'Non spécifié'}
- Postes: ${targetPositions.join(', ') || 'Non spécifié'}

CONSIGNES STRICTES:
1. Génère exactement ${templateCount} modèles d'emails de phishing basés sur cette actualité
2. Utilise les niveaux de sophistication: ${sophisticationLevels.join(', ')}
3. Varie les types: ${templateTypes.join(', ')}
4. RÉPONDS UNIQUEMENT AVEC DU JSON VALIDE, RIEN D'AUTRE
5. Chaque email doit être crédible et se baser sur l'actualité fournie

Format de réponse requis:
{
  "templates": [
    {
      "id": "template_${Date.now()}_1",
      "name": "Nom descriptif du template",
      "type": "security_alert",
      "sophistication_level": "low",
      "subject": "Objet de l'email",
      "content_html": "HTML complet avec style et {{firstName}}, {{lastName}}, {{position}}",
      "content_text": "Version texte propre",
      "personalization_fields": ["firstName", "lastName", "position"],
      "based_on_news": "${newsItem.title}",
      "preview": "Aperçu court du template"
    }
  ]
}

IMPORTANT: Base-toi spécifiquement sur l'actualité "${newsItem.title}" pour créer des emails réalistes et contextuels.`;

    const chatCompletion = await this.groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_completion_tokens: 4000,
      top_p: 0.9,
      stream: false
    });

    const response = chatCompletion.choices[0]?.message?.content;
    
    if (!response) {
      throw new Error('Aucune réponse de Groq');
    }

    const parsedResponse = this.extractAndParseJSON(response);

    if (!parsedResponse.templates || !Array.isArray(parsedResponse.templates)) {
      throw new Error('Structure invalide dans la réponse');
    }

    // Valider et enrichir les templates
    const validTemplates = parsedResponse.templates
      .filter(template => template.subject && template.content_html)
      .map((template, index) => ({
        id: template.id || `groq_${newsItem.title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${index}`,
        name: template.name || `Template ${index + 1} - ${newsItem.title}`,
        type: template.type || templateTypes[index % templateTypes.length],
        sophistication_level: template.sophistication_level || sophisticationLevels[index % sophisticationLevels.length],
        subject: template.subject,
        content_html: template.content_html,
        content_text: template.content_text || this.extractTextFromHTML(template.content_html),
        personalization_fields: template.personalization_fields || ["firstName", "lastName", "position"],
        based_on_news: newsItem.title,
        preview: template.preview || template.subject,
        created_at: new Date()
      }));

    if (validTemplates.length === 0) {
      throw new Error('Aucun template valide généré');
    }

    return validTemplates;
  }

  /**
   * Génère des templates de fallback pour plusieurs actualités
   */
  generateMultipleFallbackTemplates(selectedNews, templatesPerNews = 3) {
    const allTemplates = [];

    selectedNews.forEach(newsItem => {
      const templates = this.generateFallbackTemplatesForNews(newsItem, templatesPerNews);
      allTemplates.push(...templates);
    });

    return allTemplates;
  }

  /**
   * Génère des templates basés sur des sujets personnalisés
   * @param {Array} subjects - Liste des sujets à utiliser
   * @param {Array} targets - Cibles de la campagne
   * @param {Object} options - Options de génération
   * @returns {Promise<Array>} - Templates générés
   */
  async generateTemplatesFromSubjects(subjects, targets = [], options = {}) {
    try {
      const {
        templatesPerSubject = 2,
        maxTotalTemplates = 10,
        sophisticationLevels = ['medium', 'high'],
        templateTypes = ['security_alert', 'system_notification']
      } = options;

      console.log(`🎯 Génération de templates pour ${subjects.length} sujets personnalisés...`);

      // Convertir les sujets en format d'actualités
      const newsItems = subjects.map((subject, index) => ({
        title: subject.title || `Sujet ${index + 1}`,
        description: subject.description || subject.content || 'Sujet personnalisé',
        source: 'Personnalisé',
        excerpt: subject.excerpt || subject.description || subject.content
      }));

      // Utiliser la méthode existante avec les sujets convertis
      return await this.generatePhishingTemplates(newsItems, targets, {
        templatesPerNews: templatesPerSubject,
        maxTotalTemplates,
        sophisticationLevels,
        templateTypes
      });

    } catch (error) {
      console.error('❌ Erreur generateTemplatesFromSubjects:', error.message);
      
      // Fallback pour sujets personnalisés
      const fallbackTemplates = [];
      subjects.forEach(subject => {
        const newsItem = {
          title: subject.title || 'Sujet personnalisé',
          description: subject.description || subject.content || 'Contenu personnalisé'
        };
        const templates = this.generateFallbackTemplatesForNews(newsItem, 2);
        fallbackTemplates.push(...templates);
      });

      return fallbackTemplates;
    }
  }

  /**
   * Extrait le texte d'un contenu HTML
   * @param {string} html - Contenu HTML
   * @returns {string} - Texte brut
   */
  extractTextFromHTML(html) {
    return html
      .replace(/<[^>]*>/g, '') // Supprimer les balises HTML
      .replace(/\s+/g, ' ')    // Normaliser les espaces
      .trim();
  }

  /**
   * Génère un template personnalisé basé sur des paramètres spécifiques
   * @param {Object} params - Paramètres de génération
   * @returns {Promise<Object>} - Template généré
   */
  async generateCustomTemplate(params) {
    try {
      const { 
        type = 'generic', 
        sophistication = 'medium', 
        news, 
        customInstructions = '' 
      } = params;

      // Fallback si pas de clé API
      if (!process.env.GROQ_API_KEY) {
        return this.generateFallbackCustomTemplate(params);
      }

      const prompt = `Génère un email de phishing personnalisé.

Type: ${type}
Sophistication: ${sophistication}
${news ? `Actualité: ${news.title} - ${news.description}` : ''}
${customInstructions ? `Instructions: ${customInstructions}` : ''}

Réponds UNIQUEMENT avec du JSON valide:
{
  "id": "custom_${Date.now()}",
  "name": "Nom du template",
  "type": "${type}",
  "sophistication_level": "${sophistication}",
  "subject": "Objet de l'email",
  "content_html": "HTML complet",
  "content_text": "Version texte",
  "personalization_fields": ["firstName", "lastName"],
  "based_on_news": "${news?.title || 'Personnalisé'}",
  "preview": "Aperçu"
}`;

      const chatCompletion = await this.groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_completion_tokens: 1500,
        top_p: 0.9,
        stream: false
      });

      const response = chatCompletion.choices[0]?.message?.content;
      const parsed = this.extractAndParseJSON(response);
      
      return {
        ...parsed,
        id: parsed.id || `custom_${Date.now()}`,
        created_at: new Date()
      };

    } catch (error) {
      console.error('Erreur generateCustomTemplate:', error);
      return this.generateFallbackCustomTemplate(params);
    }
  }

  /**
   * Génère un template personnalisé de fallback
   * @param {Object} params - Paramètres
   * @returns {Object} - Template de fallback
   */
  generateFallbackCustomTemplate(params) {
    const { type = 'generic', sophistication = 'medium', news } = params;
    
    return {
      id: `custom_fallback_${Date.now()}`,
      name: `Template ${type} personnalisé`,
      type,
      sophistication_level: sophistication,
      subject: `Action requise - ${news?.title || 'Mise à jour importante'}`,
      content_html: `
<html>
<body style="font-family: Arial, sans-serif; margin: 20px;">
  <h2>Information importante</h2>
  <p>Bonjour {{firstName}} {{lastName}},</p>
  <p>En tant que {{position}}, votre attention est requise concernant ${news?.title || 'une mise à jour importante'}.</p>
  <p>Veuillez cliquer sur le lien suivant pour plus d'informations :</p>
  <a href="http://example-phishing-simulation.local" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none;">
    En savoir plus
  </a>
</body>
</html>`,
      content_text: `Bonjour {{firstName}} {{lastName}},\n\nInformation importante concernant ${news?.title || 'une mise à jour'}.\n\nLien: http://example-phishing-simulation.local\n\n[Simulation de phishing]`,
      personalization_fields: ["firstName", "lastName", "position"],
      based_on_news: news?.title || 'Personnalisé',
      preview: 'Template personnalisé généré automatiquement',
      created_at: new Date()
    };
  }

  /**
   * Teste la connexion à Groq
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      if (!process.env.GROQ_API_KEY) {
        return false;
      }

      const completion = await this.groq.chat.completions.create({
        messages: [{ role: "user", content: "Test - réponds juste 'OK'" }],
        model: "llama-3.3-70b-versatile",
        max_completion_tokens: 10,
        temperature: 0
      });
      
      const response = completion.choices[0]?.message?.content;
      return response && response.toLowerCase().includes('ok');
    } catch (error) {
      console.error('Test de connexion Groq échoué:', error.message);
      return false;
    }
  }

  /**
   * Obtient des statistiques sur la génération de templates
   * @param {Array} templates - Templates générés
   * @returns {Object} - Statistiques
   */
  getTemplateStats(templates) {
    const stats = {
      total: templates.length,
      byType: {},
      bySophistication: {},
      byNews: {},
      createdToday: 0
    };

    const today = new Date().toDateString();

    templates.forEach(template => {
      // Par type
      stats.byType[template.type] = (stats.byType[template.type] || 0) + 1;
      
      // Par sophistication
      stats.bySophistication[template.sophistication_level] = 
        (stats.bySophistication[template.sophistication_level] || 0) + 1;
      
      // Par actualité
      stats.byNews[template.based_on_news] = 
        (stats.byNews[template.based_on_news] || 0) + 1;
      
      // Créés aujourd'hui
      if (template.created_at && new Date(template.created_at).toDateString() === today) {
        stats.createdToday++;
      }
    });

    return stats;
  }
}

module.exports = new GroqService();