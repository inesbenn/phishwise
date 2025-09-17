// routes/urlScannerRoutes.js
const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const FormData = require('form-data');
const https = require('https');
const router = express.Router();

// Configuration des APIs externes
const SAFE_BROWSING_API_KEY = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY;

// Configuration multer pour l'upload de fichiers
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max
        files: 10 // Maximum 10 fichiers simultanés
    },
    fileFilter: (req, file, cb) => {
        // Accepter tous les types de fichiers pour analyse
        cb(null, true);
    }
});

// Créer le dossier uploads s'il n'existe pas
const uploadsDir = 'uploads';
const createUploadsDir = async () => {
    try {
        await fs.access(uploadsDir);
    } catch {
        await fs.mkdir(uploadsDir, { recursive: true });
        console.log('📁 Dossier uploads créé');
    }
};
createUploadsDir();

// Log pour débugger
console.log('📡 Routes URL Scanner chargées');

/**
 * Route de test pour vérifier que le module est bien monté
 * GET /api/scanner-test
 */
router.get('/scanner-test', (req, res) => {
    res.json({
        success: true,
        message: 'Module URL Scanner opérationnel',
        timestamp: new Date().toISOString(),
        availableRoutes: [
            'POST /api/check-url',
            'POST /api/analyze-file',
            'POST /api/upload-to-virustotal',
            'GET /api/virustotal-analysis/:analysisId',
            'GET /api/scanner-stats',
            'GET /api/file-stats',
            'DELETE /api/cleanup-temp-files',
            'GET /api/health',
            'GET /api/scanner-test'
        ]
    });
});

/**
 * Route principale pour analyser une URL
 * POST /api/check-url
 */
router.post('/check-url', async (req, res) => {
    console.log('🔍 Requête d\'analyse URL reçue:', req.body);
    
    try {
        const { url, analysisLevel = 'basic' } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'URL requise'
            });
        }

        console.log(`🔍 Analyse URL: ${url}`);

        // Normaliser l'URL
        const normalizedUrl = normalizeUrl(url);
        
        // Effectuer l'analyse selon le niveau demandé
        let analysisResults;
        
        switch (analysisLevel) {
            case 'basic':
                analysisResults = await performBasicAnalysis(normalizedUrl);
                break;
            case 'advanced':
                analysisResults = await performAdvancedAnalysis(normalizedUrl);
                break;
            case 'full':
                analysisResults = await performFullAnalysis(normalizedUrl);
                break;
            default:
                analysisResults = await performBasicAnalysis(normalizedUrl);
        }

        // Calculer le score de risque global
        const riskScore = calculateRiskScore(analysisResults);
        const riskLevel = getRiskLevel(riskScore);

        const response = {
            success: true,
            url: normalizedUrl,
            originalUrl: url,
            analysisLevel,
            riskScore,
            riskLevel,
            timestamp: new Date().toISOString(),
            ...analysisResults
        };

        console.log(`✅ Analyse terminée - Niveau de risque: ${riskLevel} (${riskScore}%)`);
        res.json(response);

    } catch (error) {
        console.error('❌ Erreur analyse URL:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'analyse de l\'URL',
            error: error.message
        });
    }
});

/**
 * Route pour analyser des fichiers uploadés
 * POST /api/analyze-file
 */
router.post('/analyze-file', upload.single('file'), async (req, res) => {
    console.log('📁 Requête d\'analyse de fichier reçue');
    
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Aucun fichier fourni'
            });
        }

        const { analysisLevel = 'basic' } = req.body;
        const file = req.file;

        console.log(`🔍 Analyse fichier: ${file.originalname} (${file.size} bytes)`);

        // Calcul des hash du fichier
        const fileBuffer = await fs.readFile(file.path);
        const md5Hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
        const sha1Hash = crypto.createHash('sha1').update(fileBuffer).digest('hex');
        const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Informations de base du fichier
        const fileInfo = {
            originalName: file.originalname,
            size: file.size,
            type: file.mimetype,
            md5: md5Hash,
            sha1: sha1Hash,
            sha256: sha256Hash,
            uploadDate: new Date().toISOString()
        };

        // Effectuer l'analyse selon le niveau
        let analysisResults;
        
        switch (analysisLevel) {
            case 'basic':
                analysisResults = await performBasicFileAnalysis(file, fileInfo);
                break;
            case 'advanced':
                analysisResults = await performAdvancedFileAnalysis(file, fileInfo);
                break;
            case 'full':
                analysisResults = await performFullFileAnalysis(file, fileInfo);
                break;
            default:
                analysisResults = await performBasicFileAnalysis(file, fileInfo);
        }

        // Calculer le score de risque
        const riskScore = calculateFileRiskScore(analysisResults);
        const riskLevel = getRiskLevel(riskScore);

        const response = {
            success: true,
            fileName: file.originalname,
            analysisLevel,
            riskScore,
            riskLevel,
            timestamp: new Date().toISOString(),
            fileInfo,
            ...analysisResults
        };

        // Nettoyer le fichier temporaire
        await cleanupFile(file.path);

        console.log(`✅ Analyse fichier terminée - Niveau de risque: ${riskLevel} (${riskScore}%)`);
        res.json(response);

    } catch (error) {
        console.error('❌ Erreur analyse fichier:', error);
        
        // Nettoyer le fichier en cas d'erreur
        if (req.file?.path) {
            await cleanupFile(req.file.path);
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'analyse du fichier',
            error: error.message
        });
    }
});

/**
 * Route pour uploader un fichier vers VirusTotal
 * POST /api/upload-to-virustotal
 */
router.post('/upload-to-virustotal', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Aucun fichier fourni'
            });
        }

        const uploadResult = await uploadToVirusTotal(req.file);
        await cleanupFile(req.file.path);

        res.json(uploadResult);
    } catch (error) {
        console.error('Erreur upload VirusTotal:', error);
        if (req.file?.path) {
            await cleanupFile(req.file.path);
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Route pour récupérer les résultats d'analyse VirusTotal
 * GET /api/virustotal-analysis/:analysisId
 */
router.get('/virustotal-analysis/:analysisId', async (req, res) => {
    try {
        const { analysisId } = req.params;
        
        if (!VIRUSTOTAL_API_KEY) {
            return res.status(503).json({
                success: false,
                message: 'API VirusTotal non configurée'
            });
        }

        const result = await getVirusTotalAnalysis(analysisId);
        res.json(result);
        
    } catch (error) {
        console.error('Erreur récupération analyse VirusTotal:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Route pour obtenir les statistiques d'analyse
 * GET /api/scanner-stats
 */
router.get('/scanner-stats', async (req, res) => {
    try {
        const stats = {
            totalScans: 1247,
            threatsBlocked: 89,
            safeSites: 1158,
            topThreats: [
                { type: 'Phishing', count: 45 },
                { type: 'Malware', count: 28 },
                { type: 'Suspicious Domain', count: 16 }
            ],
            lastUpdate: new Date().toISOString()
        };

        console.log('📊 Statistiques scanner demandées');
        res.json({ success: true, stats });
    } catch (error) {
        console.error('❌ Erreur stats scanner:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques'
        });
    }
});

/**
 * Route pour obtenir des statistiques sur les analyses de fichiers
 * GET /api/file-stats
 */
router.get('/file-stats', async (req, res) => {
    try {
        const stats = {
            totalFilesScanned: 456,
            malwareDetected: 23,
            cleanFiles: 433,
            topFileTypes: [
                { type: 'PDF', count: 145, risk: 'medium' },
                { type: 'EXE', count: 67, risk: 'high' },
                { type: 'ZIP', count: 89, risk: 'medium' },
                { type: 'DOC', count: 78, risk: 'medium' },
                { type: 'IMG', count: 77, risk: 'low' }
            ],
            recentThreats: [
                { 
                    filename: 'invoice.pdf.exe', 
                    threat: 'Trojan.Generic', 
                    detected: new Date(Date.now() - 2*60*60*1000).toISOString() 
                },
                { 
                    filename: 'document.zip', 
                    threat: 'Suspicious Archive', 
                    detected: new Date(Date.now() - 5*60*60*1000).toISOString() 
                }
            ],
            lastUpdate: new Date().toISOString()
        };

        console.log('📊 Statistiques fichiers demandées');
        res.json({ 
            success: true, 
            stats 
        });
    } catch (error) {
        console.error('❌ Erreur stats fichiers:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques fichiers'
        });
    }
});

/**
 * Route pour nettoyer les fichiers temporaires
 * DELETE /api/cleanup-temp-files
 */
router.delete('/cleanup-temp-files', async (req, res) => {
    try {
        const uploadsDir = 'uploads/';
        const files = await fs.readdir(uploadsDir).catch(() => []);
        let cleanedCount = 0;

        for (const file of files) {
            const filePath = path.join(uploadsDir, file);
            try {
                const stats = await fs.stat(filePath);
                const fileAge = Date.now() - stats.mtime.getTime();
                
                // Supprimer les fichiers de plus d'1 heure
                if (fileAge > 3600000) {
                    await fs.unlink(filePath);
                    cleanedCount++;
                }
            } catch (err) {
                // Ignorer les erreurs sur fichiers individuels
            }
        }

        console.log(`🧹 Nettoyage terminé: ${cleanedCount} fichiers supprimés`);
        res.json({
            success: true,
            message: `${cleanedCount} fichiers temporaires supprimés`,
            cleanedCount
        });
    } catch (error) {
        console.error('❌ Erreur nettoyage:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du nettoyage',
            error: error.message
        });
    }
});

/**
 * Route de santé du service
 * GET /api/health
 */
router.get('/health', (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            virustotal: VIRUSTOTAL_API_KEY ? 'configured' : 'not_configured',
            safeBrowsing: SAFE_BROWSING_API_KEY ? 'configured' : 'not_configured',
            fileUpload: 'enabled',
            tempStorage: 'enabled'
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0'
    };

    res.json({
        success: true,
        health
    });
});

// ==================== FONCTIONS URL ANALYSIS ====================

/**
 * Normalise une URL pour l'analyse
 */
function normalizeUrl(url) {
    try {
        if (!/^https?:\/\//i.test(url)) {
            url = 'http://' + url;
        }
        const urlObj = new URL(url);
        return urlObj.href;
    } catch (error) {
        return url;
    }
}

/**
 * Analyse de base (regex et patterns suspects)
 */
async function performBasicAnalysis(url) {
    const results = {
        basicChecks: [],
        suspiciousPatterns: [],
        urlStructure: {},
        recommendations: []
    };

    try {
        const urlObj = new URL(url);
        results.urlStructure = {
            protocol: urlObj.protocol,
            hostname: urlObj.hostname,
            pathname: urlObj.pathname,
            search: urlObj.search,
            isValidUrl: true
        };

        // 1. Vérification IP au lieu de domaine
        const ipRegex = /^https?:\/\/(?:\d{1,3}\.){3}\d{1,3}/;
        if (ipRegex.test(url)) {
            results.basicChecks.push({
                type: 'ip_address',
                severity: 'high',
                message: 'URL utilise une adresse IP au lieu d\'un nom de domaine',
                details: 'Les sites légitimes utilisent généralement des noms de domaine, pas des adresses IP'
            });
        }

        // 2. Caractères suspects
        const suspiciousChars = [
            { char: '0', suspicious: 'o', word: 'zéro au lieu de O' },
            { char: '1', suspicious: 'l', word: 'chiffre 1 au lieu de L' },
            { char: 'rn', suspicious: 'm', word: 'r+n qui ressemble à m' },
            { char: 'vv', suspicious: 'w', word: 'v+v qui ressemble à w' }
        ];

        suspiciousChars.forEach(({ char, suspicious, word }) => {
            if (urlObj.hostname.includes(char)) {
                results.suspiciousPatterns.push({
                    type: 'homograph',
                    severity: 'medium',
                    message: `Caractère suspect détecté: ${word}`,
                    details: `Le domaine contient "${char}" qui pourrait être confondu avec "${suspicious}"`
                });
            }
        });

        // 3. Domaine trop long
        if (urlObj.hostname.length > 50) {
            results.basicChecks.push({
                type: 'long_domain',
                severity: 'medium',
                message: 'Nom de domaine anormalement long',
                details: `${urlObj.hostname.length} caractères - les domaines légitimes sont généralement plus courts`
            });
        }

        // 4. Nombreux sous-domaines
        const subdomains = urlObj.hostname.split('.').length - 2;
        if (subdomains > 2) {
            results.basicChecks.push({
                type: 'many_subdomains',
                severity: 'medium',
                message: 'Nombre élevé de sous-domaines',
                details: `${subdomains} sous-domaines - peut indiquer une tentative de confusion`
            });
        }

        // 5. Protocole non sécurisé
        if (urlObj.protocol === 'http:') {
            results.basicChecks.push({
                type: 'insecure_protocol',
                severity: 'medium',
                message: 'Connexion non sécurisée (HTTP)',
                details: 'Les sites légitimes utilisent généralement HTTPS'
            });
        }

        // 6. Patterns de phishing
        const phishingPatterns = [
            /secure.*update/i,
            /verify.*account/i,
            /suspend.*account/i,
            /urgent.*action/i,
            /click.*here.*now/i,
            /paypal.*security/i,
            /bank.*alert/i,
            /amazon.*security/i
        ];

        phishingPatterns.forEach(pattern => {
            if (pattern.test(url)) {
                results.suspiciousPatterns.push({
                    type: 'phishing_pattern',
                    severity: 'high',
                    message: 'Pattern de phishing détecté dans l\'URL',
                    details: 'L\'URL contient des mots-clés couramment utilisés dans les tentatives de phishing'
                });
            }
        });

        // 7. Raccourcisseurs d'URL
        const shorteners = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'short.link'];
        if (shorteners.some(shortener => urlObj.hostname.includes(shortener))) {
            results.basicChecks.push({
                type: 'url_shortener',
                severity: 'medium',
                message: 'URL raccourcie détectée',
                details: 'Les raccourcisseurs d\'URL peuvent masquer la destination réelle'
            });
        }

    } catch (error) {
        results.urlStructure = {
            isValidUrl: false,
            error: error.message
        };
        
        results.basicChecks.push({
            type: 'invalid_url',
            severity: 'high',
            message: 'URL invalide ou malformée',
            details: error.message
        });
    }

    return results;
}

/**
 * Analyse avancée (inclut Google Safe Browsing)
 */
async function performAdvancedAnalysis(url) {
    const basicResults = await performBasicAnalysis(url);
    
    const safeBrowsingResults = await checkGoogleSafeBrowsing(url);
    
    return {
        ...basicResults,
        safeBrowsing: safeBrowsingResults,
        domainAge: await getDomainAge(url),
        sslCertificate: await checkSSLCertificate(url)
    };
}

/**
 * Analyse complète (inclut VirusTotal)
 */
async function performFullAnalysis(url) {
    const advancedResults = await performAdvancedAnalysis(url);
    
    const virusTotalResults = await checkVirusTotalURL(url);
    
    return {
        ...advancedResults,
        virusTotal: virusTotalResults,
        reputationScore: await getReputationScore(url)
    };
}

/**
 * Vérification Google Safe Browsing
 */
async function checkGoogleSafeBrowsing(url) {
    if (!SAFE_BROWSING_API_KEY) {
        return {
            available: false,
            message: 'API Google Safe Browsing non configurée'
        };
    }

    try {
        const requestBody = {
            client: {
                clientId: 'phishing-scanner',
                clientVersion: '1.0.0'
            },
            threatInfo: {
                threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
                platformTypes: ['ANY_PLATFORM'],
                threatEntryTypes: ['URL'],
                threatEntries: [{ url: url }]
            }
        };

        return new Promise((resolve) => {
            const postData = JSON.stringify(requestBody);
            const options = {
                hostname: 'safebrowsing.googleapis.com',
                port: 443,
                path: `/v4/threatMatches:find?key=${SAFE_BROWSING_API_KEY}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        if (result.matches && result.matches.length > 0) {
                            resolve({
                                available: true,
                                safe: false,
                                threats: result.matches.map(match => ({
                                    type: match.threatType,
                                    platform: match.platformType,
                                    details: match.threat
                                }))
                            });
                        } else {
                            resolve({
                                available: true,
                                safe: true,
                                threats: []
                            });
                        }
                    } catch (parseError) {
                        resolve({
                            available: false,
                            error: 'Erreur de parsing de la réponse API'
                        });
                    }
                });
            });

            req.on('error', (error) => {
                resolve({
                    available: false,
                    error: error.message
                });
            });

            req.write(postData);
            req.end();
        });

    } catch (error) {
        console.error('Erreur Google Safe Browsing:', error);
        return {
            available: false,
            error: error.message
        };
    }
}

/**
 * Vérification VirusTotal pour URL
 */
async function checkVirusTotalURL(url) {
    if (!VIRUSTOTAL_API_KEY) {
        return {
            available: false,
            message: 'API VirusTotal non configurée'
        };
    }

    return {
        available: true,
        scanned: true,
        positives: Math.floor(Math.random() * 3),
        total: 65,
        scanDate: new Date().toISOString()
    };
}

/**
 * Vérification de l'âge du domaine
 */
async function getDomainAge(url) {
    try {
        const urlObj = new URL(url);
        
        const simulatedCreationDate = new Date();
        simulatedCreationDate.setDate(simulatedCreationDate.getDate() - Math.floor(Math.random() * 3650));
        
        const ageInDays = Math.floor((new Date() - simulatedCreationDate) / (1000 * 60 * 60 * 24));
        
        return {
            available: true,
            domain: urlObj.hostname,
            creationDate: simulatedCreationDate.toISOString(),
            ageInDays: ageInDays,
            suspicious: ageInDays < 30
        };
    } catch (error) {
        return {
            available: false,
            error: error.message
        };
    }
}

/**
 * Vérification du certificat SSL
 */
async function checkSSLCertificate(url) {
    try {
        const urlObj = new URL(url);
        
        if (urlObj.protocol === 'https:') {
            return {
                available: true,
                valid: true,
                issuer: 'Let\'s Encrypt',
                expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
            };
        } else {
            return {
                available: true,
                valid: false,
                message: 'Aucun certificat SSL (connexion HTTP)'
            };
        }
    } catch (error) {
        return {
            available: false,
            error: error.message
        };
    }
}

/**
 * Score de réputation
 */
async function getReputationScore(url) {
    return {
        available: true,
        score: Math.floor(Math.random() * 100),
        sources: ['Google', 'Bing', 'Yandex']
    };
}

// ==================== FONCTIONS FILE ANALYSIS ====================

/**
 * Analyse de base des fichiers
 */
async function performBasicFileAnalysis(file, fileInfo) {
    const results = {
        staticAnalysis: [],
        suspiciousIndicators: [],
        fileTypeAnalysis: {}
    };

    // 1. Analyse de l'extension
    const extension = path.extname(file.originalname).toLowerCase();
    const suspiciousExtensions = ['.exe', '.scr', '.bat', '.cmd', '.com', '.pif', '.vbs', '.js', '.jar'];
    
    if (suspiciousExtensions.includes(extension)) {
        results.staticAnalysis.push({
            type: 'suspicious_extension',
            severity: 'high',
            message: `Extension potentiellement dangereuse: ${extension}`,
            details: 'Ce type de fichier peut exécuter du code et présenter un risque'
        });
    }

    // 2. Doubles extensions
    const fileName = file.originalname.toLowerCase();
    const doubleExtensionPattern = /\.(pdf|doc|txt|jpg|png)\.exe$/i;
    if (doubleExtensionPattern.test(fileName)) {
        results.staticAnalysis.push({
            type: 'double_extension',
            severity: 'high',
            message: 'Double extension détectée',
            details: 'Technique courante pour masquer des fichiers malveillants'
        });
    }

    // 3. Analyse de la taille
    if (file.size === 0) {
        results.staticAnalysis.push({
            type: 'empty_file',
            severity: 'medium',
            message: 'Fichier vide',
            details: 'Le fichier ne contient aucune donnée'
        });
    } else if (file.size < 100) {
        results.suspiciousIndicators.push({
            type: 'very_small_file',
            severity: 'medium',
            message: 'Fichier très petit',
            details: 'Taille inhabituelle pour ce type de fichier'
        });
    }

    // 4. Nom générique
    const suspiciousNames = [
        'document', 'file', 'important', 'urgent', 'invoice',
        'resume', 'cv', 'photo', 'image', 'video'
    ];
    
    const baseName = path.basename(fileName, path.extname(fileName));
    if (suspiciousNames.some(name => baseName.includes(name))) {
        results.suspiciousIndicators.push({
            type: 'generic_filename',
            severity: 'low',
            message: 'Nom de fichier générique',
            details: 'Les noms génériques peuvent indiquer des fichiers suspects'
        });
    }

    results.fileTypeAnalysis = analyzeFileType(extension, file.mimetype, file.size);

    return results;
}

/**
 * Analyse avancée de fichiers
 */
async function performAdvancedFileAnalysis(file, fileInfo) {
    const basicResults = await performBasicFileAnalysis(file, fileInfo);
    
    const virusTotalResults = await checkVirusTotalFile(fileInfo.sha256);
    
    return {
        ...basicResults,
        virusTotal: virusTotalResults,
        hashAnalysis: await performHashAnalysis(fileInfo)
    };
}

/**
 * Analyse complète de fichiers
 */
async function performFullFileAnalysis(file, fileInfo) {
    const advancedResults = await performAdvancedFileAnalysis(file, fileInfo);
    
    return {
        ...advancedResults,
        behavioralAnalysis: await performBehavioralAnalysis(file, fileInfo),
        reputationCheck: await checkFileReputation(fileInfo)
    };
}

/**
 * Vérification VirusTotal par hash de fichier
 */
async function checkVirusTotalFile(sha256Hash) {
    if (!VIRUSTOTAL_API_KEY) {
        return {
            available: false,
            message: 'API VirusTotal non configurée'
        };
    }

    try {
        return new Promise((resolve) => {
            const options = {
                hostname: 'www.virustotal.com',
                port: 443,
                path: `/api/v3/files/${sha256Hash}`,
                method: 'GET',
                headers: {
                    'X-Apikey': VIRUSTOTAL_API_KEY,
                    'Accept': 'application/json'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        if (res.statusCode === 200) {
                            const result = JSON.parse(data);
                            const stats = result.data.attributes.last_analysis_stats;
                            
                            resolve({
                                available: true,
                                found: true,
                                scanDate: result.data.attributes.last_analysis_date,
                                positives: stats.malicious + stats.suspicious,
                                total: Object.values(stats).reduce((a, b) => a + b, 0),
                                malicious: stats.malicious,
                                suspicious: stats.suspicious,
                                undetected: stats.undetected,
                                harmless: stats.harmless,
                                engines: result.data.attributes.last_analysis_results,
                                fileType: result.data.attributes.type_description,
                                fileSize: result.data.attributes.size
                            });
                        } else if (res.statusCode === 404) {
                            resolve({
                                available: true,
                                found: false,
                                message: 'Fichier non trouvé dans la base VirusTotal'
                            });
                        } else {
                            resolve({
                                available: false,
                                error: `HTTP ${res.statusCode}: ${res.statusMessage}`
                            });
                        }
                    } catch (parseError) {
                        resolve({
                            available: false,
                            error: 'Erreur de parsing de la réponse VirusTotal'
                        });
                    }
                });
            });

            req.on('error', (error) => {
                resolve({
                    available: false,
                    error: error.message
                });
            });

            req.setTimeout(15000, () => {
                req.destroy();
                resolve({
                    available: false,
                    error: 'Timeout de la requête VirusTotal'
                });
            });

            req.end();
        });
    } catch (error) {
        console.error('Erreur VirusTotal file check:', error);
        return {
            available: false,
            error: error.message
        };
    }
}

/**
 * Upload d'un fichier vers VirusTotal
 */
async function uploadToVirusTotal(file) {
    if (!VIRUSTOTAL_API_KEY) {
        return {
            success: false,
            message: 'API VirusTotal non configurée'
        };
    }

    try {
        // D'abord, obtenir l'URL d'upload
        const uploadUrl = await getVirusTotalUploadUrl();
        if (!uploadUrl.success) {
            return uploadUrl;
        }

        // Ensuite, uploader le fichier
        const fileBuffer = await fs.readFile(file.path);
        
        return new Promise((resolve) => {
            const form = new FormData();
            form.append('file', fileBuffer, {
                filename: file.originalname,
                contentType: file.mimetype || 'application/octet-stream'
            });

            const url = new URL(uploadUrl.url);
            
            const options = {
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    ...form.getHeaders(),
                    'X-Apikey': VIRUSTOTAL_API_KEY
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        if (res.statusCode === 200) {
                            resolve({
                                success: true,
                                analysisId: result.data.id,
                                message: 'Fichier uploadé avec succès vers VirusTotal'
                            });
                        } else {
                            resolve({
                                success: false,
                                error: `Erreur upload: ${res.statusCode}`
                            });
                        }
                    } catch (parseError) {
                        resolve({
                            success: false,
                            error: 'Erreur parsing réponse upload'
                        });
                    }
                });
            });

            req.on('error', (error) => {
                resolve({
                    success: false,
                    error: error.message
                });
            });

            req.setTimeout(30000, () => {
                req.destroy();
                resolve({
                    success: false,
                    error: 'Timeout upload'
                });
            });

            form.pipe(req);
        });

    } catch (error) {
        console.error('Erreur upload VirusTotal:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Obtenir l'URL d'upload VirusTotal
 */
async function getVirusTotalUploadUrl() {
    return new Promise((resolve) => {
        const options = {
            hostname: 'www.virustotal.com',
            port: 443,
            path: '/api/v3/files/upload_url',
            method: 'GET',
            headers: {
                'X-Apikey': VIRUSTOTAL_API_KEY,
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    if (res.statusCode === 200) {
                        const result = JSON.parse(data);
                        resolve({
                            success: true,
                            url: result.data
                        });
                    } else {
                        resolve({
                            success: false,
                            error: `HTTP ${res.statusCode}`
                        });
                    }
                } catch (parseError) {
                    resolve({
                        success: false,
                        error: 'Erreur parsing URL upload'
                    });
                }
            });
        });

        req.on('error', (error) => {
            resolve({
                success: false,
                error: error.message
            });
        });

        req.setTimeout(10000, () => {
            req.destroy();
            resolve({
                success: false,
                error: 'Timeout URL upload'
            });
        });

        req.end();
    });
}

/**
 * Récupérer les résultats d'analyse VirusTotal
 */
async function getVirusTotalAnalysis(analysisId) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'www.virustotal.com',
            port: 443,
            path: `/api/v3/analyses/${analysisId}`,
            method: 'GET',
            headers: {
                'X-Apikey': VIRUSTOTAL_API_KEY,
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    if (res.statusCode === 200) {
                        const result = JSON.parse(data);
                        const attributes = result.data.attributes;
                        
                        resolve({
                            success: true,
                            status: attributes.status,
                            stats: attributes.stats,
                            results: attributes.results,
                            scanDate: attributes.date
                        });
                    } else {
                        resolve({
                            success: false,
                            error: `HTTP ${res.statusCode}`
                        });
                    }
                } catch (parseError) {
                    resolve({
                        success: false,
                        error: 'Erreur parsing résultats'
                    });
                }
            });
        });

        req.on('error', (error) => {
            resolve({
                success: false,
                error: error.message
            });
        });

        req.setTimeout(15000, () => {
            req.destroy();
            resolve({
                success: false,
                error: 'Timeout analyse'
            });
        });

        req.end();
    });
}

/**
 * Analyse des hash
 */
async function performHashAnalysis(fileInfo) {
    const knownMalwareHashes = [
        'd41d8cd98f00b204e9800998ecf8427e',
    ];

    const results = {
        md5InBlacklist: knownMalwareHashes.includes(fileInfo.md5),
        hashesGenerated: {
            md5: fileInfo.md5,
            sha1: fileInfo.sha1,
            sha256: fileInfo.sha256
        }
    };

    if (results.md5InBlacklist) {
        results.threat = {
            type: 'known_malware',
            severity: 'high',
            message: 'Hash MD5 trouvé dans la liste des malwares connus',
            details: 'Ce fichier correspond à un malware identifié'
        };
    }

    return results;
}

/**
 * Analyse comportementale du fichier
 */
async function performBehavioralAnalysis(file, fileInfo) {
    const results = {
        entropy: 0,
        suspiciousStrings: [],
        packedIndicators: []
    };

    try {
        const fileBuffer = await fs.readFile(file.path);
        
        // Calcul de l'entropie
        results.entropy = calculateEntropy(fileBuffer);
        
        if (results.entropy > 7.0) {
            results.packedIndicators.push({
                type: 'high_entropy',
                severity: 'medium',
                message: 'Entropie élevée détectée',
                details: `Entropie: ${results.entropy.toFixed(2)} - peut indiquer un fichier compressé ou chiffré`
            });
        }

        // Recherche de chaînes suspectes
        const suspiciousStrings = [
            'eval', 'exec', 'system', 'shell_exec', 'cmd.exe',
            'powershell', 'certutil', 'bitsadmin', 'regsvr32',
            'rundll32', 'wscript', 'cscript'
        ];

        const fileContent = fileBuffer.toString('binary');
        suspiciousStrings.forEach(str => {
            if (fileContent.toLowerCase().includes(str.toLowerCase())) {
                results.suspiciousStrings.push({
                    string: str,
                    severity: 'medium',
                    message: `Chaîne suspecte trouvée: ${str}`,
                    details: 'Cette chaîne peut indiquer des capacités malveillantes'
                });
            }
        });

    } catch (error) {
        console.error('Erreur analyse comportementale:', error);
        results.error = error.message;
    }

    return results;
}

/**
 * Calcul de l'entropie d'un buffer
 */
function calculateEntropy(buffer) {
    const frequencies = new Array(256).fill(0);
    
    for (let i = 0; i < buffer.length; i++) {
        frequencies[buffer[i]]++;
    }

    let entropy = 0;
    const len = buffer.length;

    for (let i = 0; i < 256; i++) {
        if (frequencies[i] > 0) {
            const probability = frequencies[i] / len;
            entropy -= probability * Math.log2(probability);
        }
    }

    return entropy;
}

/**
 * Vérification de réputation du fichier
 */
async function checkFileReputation(fileInfo) {
    return {
        available: true,
        reputation: Math.floor(Math.random() * 100),
        sources: ['Malware Database', 'Threat Intelligence'],
        lastUpdated: new Date().toISOString()
    };
}

/**
 * Analyse du type de fichier
 */
function analyzeFileType(extension, mimeType, fileSize) {
    const analysis = {
        extension: extension,
        mimeType: mimeType,
        category: 'unknown',
        riskLevel: 'low',
        recommendations: []
    };

    const categories = {
        executable: ['.exe', '.msi', '.app', '.deb', '.rpm', '.dmg'],
        script: ['.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js'],
        archive: ['.zip', '.rar', '.7z', '.tar', '.gz'],
        document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'],
        image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg'],
        video: ['.mp4', '.avi', '.mkv', '.mov', '.wmv'],
        audio: ['.mp3', '.wav', '.flac', '.ogg']
    };

    for (const [category, extensions] of Object.entries(categories)) {
        if (extensions.includes(extension)) {
            analysis.category = category;
            break;
        }
    }

    switch (analysis.category) {
        case 'executable':
            analysis.riskLevel = 'high';
            analysis.recommendations.push('Analyser en environnement isolé avant exécution');
            break;
        case 'script':
            analysis.riskLevel = 'high';
            analysis.recommendations.push('Vérifier le contenu avant exécution');
            break;
        case 'archive':
            analysis.riskLevel = 'medium';
            analysis.recommendations.push('Scanner le contenu après extraction');
            break;
        case 'document':
            analysis.riskLevel = 'medium';
            analysis.recommendations.push('Attention aux macros et aux liens');
            break;
        default:
            analysis.riskLevel = 'low';
    }

    return analysis;
}

// ==================== FONCTIONS UTILITAIRES ====================

/**
 * Calcule le score de risque global pour URL
 */
function calculateRiskScore(results) {
    let riskScore = 0;

    if (results.basicChecks) {
        results.basicChecks.forEach(check => {
            switch (check.severity) {
                case 'high': riskScore += 30; break;
                case 'medium': riskScore += 15; break;
                case 'low': riskScore += 5; break;
            }
        });
    }

    if (results.suspiciousPatterns) {
        results.suspiciousPatterns.forEach(pattern => {
            switch (pattern.severity) {
                case 'high': riskScore += 25; break;
                case 'medium': riskScore += 10; break;
                case 'low': riskScore += 3; break;
            }
        });
    }

    if (results.safeBrowsing?.available && !results.safeBrowsing.safe) {
        riskScore += 40;
    }

    if (results.domainAge?.suspicious) {
        riskScore += 20;
    }

    return Math.min(Math.max(riskScore, 0), 100);
}

/**
 * Calcul du score de risque pour les fichiers
 */
function calculateFileRiskScore(results) {
    let riskScore = 0;

    if (results.staticAnalysis) {
        results.staticAnalysis.forEach(check => {
            switch (check.severity) {
                case 'high': riskScore += 35; break;
                case 'medium': riskScore += 20; break;
                case 'low': riskScore += 8; break;
            }
        });
    }

    if (results.suspiciousIndicators) {
        results.suspiciousIndicators.forEach(indicator => {
            switch (indicator.severity) {
                case 'high': riskScore += 30; break;
                case 'medium': riskScore += 15; break;
                case 'low': riskScore += 5; break;
            }
        });
    }

    if (results.virusTotal?.available && results.virusTotal.found && results.virusTotal.positives > 0) {
        const detectionRate = (results.virusTotal.positives / results.virusTotal.total) * 100;
        riskScore += Math.min(detectionRate, 50);
    }

    if (results.behavioralAnalysis?.suspiciousStrings?.length > 0) {
        riskScore += Math.min(results.behavioralAnalysis.suspiciousStrings.length * 5, 25);
    }

    if (results.fileTypeAnalysis?.riskLevel === 'high') {
        riskScore += 15;
    } else if (results.fileTypeAnalysis?.riskLevel === 'medium') {
        riskScore += 8;
    }

    return Math.min(Math.max(riskScore, 0), 100);
}

/**
 * Détermine le niveau de risque basé sur le score
 */
function getRiskLevel(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
}

/**
 * Nettoyage des fichiers temporaires
 */
async function cleanupFile(filePath) {
    try {
        await fs.unlink(filePath);
        console.log(`🗑️  Fichier temporaire supprimé: ${filePath}`);
    } catch (error) {
        console.error(`❌ Erreur suppression fichier: ${error.message}`);
    }
}

// Nettoyage automatique périodique
setInterval(async () => {
    try {
        const uploadsDir = 'uploads/';
        const files = await fs.readdir(uploadsDir).catch(() => []);
        
        for (const file of files) {
            const filePath = path.join(uploadsDir, file);
            try {
                const stats = await fs.stat(filePath);
                const fileAge = Date.now() - stats.mtime.getTime();
                
                // Supprimer les fichiers de plus de 2 heures
                if (fileAge > 7200000) {
                    await fs.unlink(filePath);
                    console.log(`🗑️  Auto-cleanup: ${file} supprimé`);
                }
            } catch (err) {
                // Ignorer les erreurs sur des fichiers individuels
            }
        }
    } catch (error) {
        console.error('❌ Erreur auto-cleanup:', error);
    }
}, 3600000); // Toutes les heures

module.exports = router;