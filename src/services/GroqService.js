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
   * Génère des templates de fallback en cas d'échec de l'IA
   * @param {Array} selectedNews - Actualités sélectionnées
   * @returns {Array} - Templates de fallback
   */
  generateFallbackTemplates(selectedNews) {
    const firstNews = selectedNews[0] || { title: 'Actualité récente', excerpt: 'Événement important' };
    
    return [
      {
        id: `fallback_${Date.now()}_1`,
        name: "Alerte de sécurité urgente",
        type: "security_alert",
        sophistication_level: "low",
        subject: `URGENT: Action requise suite à ${firstNews.title}`,
        content_html: `
<html>
<body style="font-family: Arial, sans-serif; margin: 20px;">
  <div style="background: #ff4444; color: white; padding: 10px; border-radius: 5px;">
    <h2>⚠️ ALERTE DE SÉCURITÉ</h2>
  </div>
  
  <p>Bonjour {{firstName}} {{lastName}},</p>
  
  <p>Suite aux récents événements concernant <strong>${firstNews.title}</strong>, votre compte nécessite une vérification immédiate.</p>
  
  <p>Des activités suspectes ont été détectées sur votre profil. Pour éviter une suspension de compte, veuillez cliquer sur le lien ci-dessous dans les 24 heures :</p>
  
  <div style="text-align: center; margin: 20px;">
    <a href="http://example-phishing-simulation.local" style="background: #ff4444; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px;">
      VÉRIFIER MON COMPTE
    </a>
  </div>
  
  
  <p>Cordialement,<br>
  L'équipe de sécurité</p>
</body>
</html>`,
        content_text: `ALERTE DE SÉCURITÉ\n\nBonjour {{firstName}} {{lastName}},\n\nSuite aux récents événements concernant ${firstNews.title}, votre compte nécessite une vérification immédiate.\n\nDes activités suspectes ont été détectées. Veuillez vérifier votre compte : http://example-phishing-simulation.local\n\nCordialement,\nL'équipe de sécurité`,
        personalization_fields: ["firstName", "lastName", "position"],
        based_on_news: firstNews.title,
        preview: "Alerte de sécurité urgente demandant une vérification de compte",
        created_at: new Date()
      },
      {
        id: `fallback_${Date.now()}_2`,
        name: "Mise à jour système requise",
        type: "system_notification",
        sophistication_level: "medium",
        subject: `Mise à jour importante - ${firstNews.title}`,
        content_html: `
<html>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <div style="background: #2c5aa0; color: white; padding: 20px; text-align: center;">
      <h1 style="margin: 0;">Mise à jour système</h1>
    </div>
    
    <div style="padding: 30px;">
      <p>Cher(e) {{firstName}},</p>
      
      <p>En raison des événements récents mentionnés dans les actualités (${firstNews.title}), notre équipe IT a identifié des vulnérabilités critiques nécessitant une mise à jour immédiate.</p>
      
      <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="color: #856404; margin-top: 0;">⚡ Action requise</h3>
        <p style="margin-bottom: 0;">Votre système {{position}} doit être mis à jour avant le <strong>$(date + 2 jours)</strong></p>
      </div>
      
      <p>Pour procéder à la mise à jour :</p>
      <ol>
        <li>Cliquez sur le bouton ci-dessous</li>
        <li>Entrez vos identifiants pour validation</li>
        <li>Laissez la mise à jour s'installer (5-10 minutes)</li>
      </ol>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="http://example-phishing-simulation.local" style="background: #28a745; color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
          🔧 LANCER LA MISE À JOUR
        </a>
      </div>
      
      <p style="font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 15px; margin-top: 30px;">
      </p>
    </div>
  </div>
</body>
</html>`,
        content_text: `Mise à jour système requise\n\nCher(e) {{firstName}},\n\nEn raison des événements récents (${firstNews.title}), une mise à jour critique est nécessaire pour votre système {{position}}.\n\nAction requise avant 48h :\nhttp://example-phishing-simulation.local\n\nÉquipe IT`,
        personalization_fields: ["firstName", "lastName", "position"],
        based_on_news: firstNews.title,
        preview: "Notification de mise à jour système avec urgence modérée",
        created_at: new Date()
      },
      {
        id: `fallback_${Date.now()}_3`,
        name: "Vérification d'identité avancée",
        type: "verification",
        sophistication_level: "high",
        subject: `Re: Procédure de vérification suite à l'incident ${firstNews.title}`,
        content_html: `
<html>
<body style="font-family: 'Times New Roman', serif; margin: 0; padding: 20px; background-color: #fafafa; line-height: 1.6;">
  <div style="max-width: 700px; margin: 0 auto; background: white; border: 1px solid #ddd;">
    
    <!-- En-tête officiel -->
    <div style="background: #1e3a8a; color: white; padding: 15px 30px; border-bottom: 4px solid #3b82f6;">
      <table width="100%">
        <tr>
          <td>
            <h2 style="margin: 0; font-size: 18px;">🏛️ Direction de la Conformité</h2>
            <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">Département Sécurité & Vérifications</p>
          </td>
          <td style="text-align: right; font-size: 11px;">
            Réf: SEC-${Date.now().toString().slice(-6)}<br>
            Classification: CONFIDENTIEL
          </td>
        </tr>
      </table>
    </div>
    
    <div style="padding: 30px;">
      <p style="color: #374151;">À l'attention de : <strong>{{firstName}} {{lastName}}</strong><br>
      Fonction : {{position}}<br>
      Date : ${new Date().toLocaleDateString('fr-FR')}</p>
      
      <h3 style="color: #1e3a8a; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
        Objet : Procédure de vérification d'identité renforcée
      </h3>
      
      <p>Madame, Monsieur,</p>
      
      <p>Suite à l'analyse des événements rapportés dans <em>"${firstNews.title}"</em> et dans le cadre du renforcement de nos protocoles de sécurité, votre profil a été sélectionné pour une vérification d'identité approfondie.</p>
      
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0;">
        <h4 style="color: #92400e; margin-top: 0;">📋 Procédure à suivre impérativement</h4>
        <p style="margin-bottom: 0; color: #78350f;">
          Conformément à la directive DPO-2024-${Math.floor(Math.random() * 1000)}, vous disposez de <strong>72 heures</strong> pour compléter cette vérification. Un défaut de réponse entraînerait une restriction temporaire de vos accès.
        </p>
      </div>
      
      <p><strong>Documents requis pour la vérification :</strong></p>
      <ul style="color: #374151;">
        <li>Confirmation de votre identité numérique</li>
        <li>Validation de vos autorisations d'accès actuelles</li>
        <li>Mise à jour de votre profil de sécurité</li>
      </ul>
      
      <div style="text-align: center; margin: 35px 0;">
        <p style="margin-bottom: 15px; color: #6b7280; font-size: 14px;">Accès sécurisé au portail de vérification :</p>
        <a href="http://example-phishing-simulation.local" 
           style="background: linear-gradient(135deg, #1e3a8a, #3b82f6); 
                  color: white; 
                  padding: 18px 35px; 
                  text-decoration: none; 
                  border-radius: 6px; 
                  display: inline-block; 
                  font-weight: 600;
                  box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          🔐 ACCÉDER AU PORTAIL SÉCURISÉ
        </a>
      </div>
      
      <p style="font-size: 13px; color: #6b7280;">
        <strong>Note importante :</strong> Ce lien est personnel et confidentiel. Il expire automatiquement après utilisation ou au terme du délai de 72 heures.
      </p>
      
      <p>Nous vous remercions de votre coopération dans cette démarche de sécurisation de nos systèmes.</p>
      
      <p style="margin-top: 30px;">
        Cordialement,<br><br>
        <strong>Marie-Claire DUBOIS</strong><br>
        <em>Responsable Conformité & Vérifications</em><br>
        📧 m.dubois@compliance-dept.local<br>
        📞 +33 1 XX XX XX XX (poste 4502)
      </p>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      
    
    </div>
  </div>
</body>
</html>`,
        content_text: `DIRECTION DE LA CONFORMITÉ - CONFIDENTIEL\nRéf: SEC-${Date.now().toString().slice(-6)}\n\nÀ: {{firstName}} {{lastName}} ({{position}})\nDate: ${new Date().toLocaleDateString('fr-FR')}\n\nObjet: Procédure de vérification d'identité renforcée\n\nMadame, Monsieur,\n\nSuite aux événements "${firstNews.title}", votre profil nécessite une vérification d'identité approfondie.\n\nDélai: 72 heures\nPortail: http://example-phishing-simulation.local\n\nCordialement,\nMarie-Claire DUBOIS\nResponsable Conformité\n\n[Simulation de phishing - Formation cybersécurité]`,
        personalization_fields: ["firstName", "lastName", "position"],
        based_on_news: firstNews.title,
        preview: "Vérification d'identité sophistiquée avec apparence officielle",
        created_at: new Date()
      }
    ];
  }

  /**
   * Génère des modèles d'emails de phishing basés sur les actualités sélectionnées
   * @param {Array} selectedNews - Actualités sélectionnées
   * @param {Array} targets - Cibles de la campagne pour personnalisation
   * @returns {Promise<Array>} - Templates d'emails générés
   */
  async generatePhishingTemplates(selectedNews, targets = []) {
    try {
      // Validation des paramètres
      if (!selectedNews || selectedNews.length === 0) {
        console.warn('⚠️ Aucune actualité fournie, utilisation des templates de fallback');
        return this.generateFallbackTemplates([]);
      }

      // Vérifier la clé API
      if (!process.env.GROQ_API_KEY) {
        console.warn('⚠️ GROQ_API_KEY manquante, utilisation des templates de fallback');
        return this.generateFallbackTemplates(selectedNews);
      }

      // Construire le contexte des actualités
      const newsContext = selectedNews.map(news => 
        `- Titre: ${news.title}\n  Description: ${news.excerpt || news.description || 'Non disponible'}\n  Source: ${news.source || 'Source inconnue'}`
      ).join('\n\n');

      // Analyser les cibles pour adapter le contenu
      const targetCountries = [...new Set(targets.map(t => t.country).filter(Boolean))];
      const targetPositions = [...new Set(targets.map(t => t.position).filter(Boolean))];

      const prompt = `Tu es un expert en cybersécurité qui crée des simulations d'emails de phishing pour la formation.

CONTEXTE DES ACTUALITÉS:
${newsContext}

INFORMATIONS SUR LES CIBLES:
- Pays: ${targetCountries.join(', ') || 'Non spécifié'}
- Postes: ${targetPositions.join(', ') || 'Non spécifié'}

CONSIGNES STRICTES:
1. Génère exactement 3 modèles d'emails de phishing (low, medium, high sophistication)
2. Base-toi sur les actualités fournies
3. RÉPONDS UNIQUEMENT AVEC DU JSON VALIDE, RIEN D'AUTRE
4. Utilise ce format exact:

{
  "templates": [
    {
      "id": "template_1",
      "name": "Nom du template",
      "type": "security_alert",
      "sophistication_level": "low",
      "subject": "Objet de l'email",
      "content_html": "HTML complet avec {{firstName}}, {{lastName}}, {{position}}",
      "content_text": "Version texte",
      "personalization_fields": ["firstName", "lastName", "position"],
      "based_on_news": "Titre de l'actualité",
      "preview": "Aperçu court"
    }
  ]
}`;

      console.log('🤖 Tentative de génération via Groq...');

      const chatCompletion = await this.groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_completion_tokens: 3000,
        top_p: 0.9,
        stream: false
      });

      const response = chatCompletion.choices[0]?.message?.content;
      
      if (!response) {
        console.warn('⚠️ Aucune réponse de Groq, utilisation des templates de fallback');
        return this.generateFallbackTemplates(selectedNews);
      }

      console.log('📝 Réponse Groq reçue, tentative de parsing...');

      // Parser la réponse JSON avec gestion d'erreurs robuste
      let parsedResponse;
      try {
        parsedResponse = this.extractAndParseJSON(response);
      } catch (parseError) {
        console.error('❌ Erreur de parsing, utilisation des templates de fallback');
        console.error('Réponse brute:', response.substring(0, 500) + '...');
        return this.generateFallbackTemplates(selectedNews);
      }

      // Validation de la structure
      if (!parsedResponse.templates || !Array.isArray(parsedResponse.templates)) {
        console.warn('⚠️ Structure invalide, utilisation des templates de fallback');
        return this.generateFallbackTemplates(selectedNews);
      }

      // Valider et nettoyer chaque template
      const validTemplates = parsedResponse.templates
        .filter(template => template.subject && template.content_html)
        .map((template, index) => ({
          id: template.id || `groq_template_${Date.now()}_${index}`,
          name: template.name || `Template ${index + 1}`,
          type: template.type || 'generic',
          sophistication_level: template.sophistication_level || 'medium',
          subject: template.subject,
          content_html: template.content_html,
          content_text: template.content_text || this.extractTextFromHTML(template.content_html),
          personalization_fields: template.personalization_fields || ["firstName", "lastName", "position"],
          based_on_news: template.based_on_news || selectedNews[0]?.title || 'Actualité sélectionnée',
          preview: template.preview || template.subject,
          created_at: new Date()
        }));

      if (validTemplates.length === 0) {
        console.warn('⚠️ Aucun template valide généré, utilisation des templates de fallback');
        return this.generateFallbackTemplates(selectedNews);
      }

      console.log(`✅ ${validTemplates.length} templates générés avec succès via Groq`);
      return validTemplates;

    } catch (error) {
      console.error('❌ Erreur GroqService:', error.message);
      console.log('🔄 Fallback: génération de templates par défaut');
      return this.generateFallbackTemplates(selectedNews || []);
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
}

module.exports = new GroqService();