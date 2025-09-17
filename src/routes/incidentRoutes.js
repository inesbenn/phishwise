// src/routes/incidentRoutes.js - VERSION COMPLÈTE CORRIGÉE
const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const incidentController = require('../controllers/incidentController');

const router = express.Router();

// ======================== MIDDLEWARE DE VALIDATION ========================

const validateCreateIncident = [
  body('url')
    .isURL({ protocols: ['http', 'https'] })
    .isLength({ max: 2048 })
    .withMessage('URL valide requise (max 2048 caractères)'),
    
  body('riskLevel')
    .isIn(['low', 'medium', 'high'])
    .withMessage('Niveau de risque doit être: low, medium ou high'),
    
  body('riskScore')
    .isInt({ min: 0, max: 100 })
    .withMessage('Score de risque doit être entre 0 et 100'),
    
  body('incidentType')
    .optional()
    .isIn(['malware', 'phishing', 'scam', 'suspicious_domain', 'fake_website', 'malicious_redirect', 'ip_address_access', 'untrusted_certificate', 'other'])
    .withMessage('Type d\'incident invalide'),
    
  body('blocked')
    .optional()
    .isBoolean()
    .withMessage('Blocked doit être un booléen'),
    
  body('userAction')
    .optional()
    .isIn(['blocked', 'warned', 'ignored', 'proceeded'])
    .withMessage('Action utilisateur invalide'),
    
  body('threats')
    .optional()
    .isArray()
    .withMessage('Threats doit être un tableau'),
    
  body('threats.*.type')
    .optional()
    .notEmpty()
    .withMessage('Type de menace requis'),
    
  body('threats.*.severity')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Sévérité de menace invalide'),
    
  body('clientInfo.extensionVersion')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Version extension trop longue'),
    
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes trop longues (max 1000 caractères)')
];

const validateGetIncidents = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page doit être un entier positif'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limite doit être entre 1 et 100'),
    
  query('riskLevel')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Niveau de risque invalide'),
    
  query('incidentType')
    .optional()
    .isIn(['malware', 'phishing', 'scam', 'suspicious_domain', 'fake_website', 'malicious_redirect', 'ip_address_access', 'untrusted_certificate', 'other'])
    .withMessage('Type d\'incident invalide'),
    
  query('blocked')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Blocked doit être true ou false'),
    
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Date de début invalide'),
    
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Date de fin invalide'),
    
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'riskScore', 'domain', 'riskLevel'])
    .withMessage('Critère de tri invalide'),
    
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Ordre de tri invalide')
];

const validateId = [
  param('id')
    .isMongoId()
    .withMessage('ID MongoDB valide requis')
];

const validateDomain = [
  param('domain')
    .matches(/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/)
    .withMessage('Nom de domaine valide requis')
];

const validateUpdateIncident = [
  ...validateId,
  body('verified')
    .optional()
    .isBoolean()
    .withMessage('Verified doit être un booléen'),
    
  body('falsePositive')
    .optional()
    .isBoolean()
    .withMessage('FalsePositive doit être un booléen'),
    
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes trop longues'),
    
  body('adminNotes')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Notes admin trop longues')
];

// ======================== ROUTES SPÉCIFIQUES (AVANT /:id) ========================

// Routes pour l'extension
router.post('/create', validateCreateIncident, incidentController.createIncident);
router.post('/check-url-report', validateCreateIncident, incidentController.createIncident);

// Routes de données spécifiques
router.get('/statistics', incidentController.getStatistics);
router.get('/dashboard', incidentController.getDashboard);

// Route d'export (CRITIQUE: doit être avant /:id)
router.get('/export', [
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Format doit être json ou csv'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Date de début invalide'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Date de fin invalide')
], async (req, res) => {
  try {
    console.log('🚀 Route export appelée:', req.query);
    
    // Vérifier les erreurs de validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Erreurs validation export:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Paramètres invalides',
        errors: errors.array()
      });
    }

    const { 
      format = 'json', 
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate = new Date().toISOString() 
    } = req.query;

    console.log('📥 Export incidents demandé:', { format, startDate, endDate });

    const Incident = require('../models/Incident');

    const incidents = await Incident.find({
      createdAt: { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      }
    }).select('-__v -adminNotes').sort({ createdAt: -1 });

    console.log(`📊 ${incidents.length} incidents trouvés pour l'export`);

    if (format === 'csv') {
      const csvHeader = 'URL,Domain,Risk Level,Risk Score,Incident Type,Blocked,Created At,Threats Count\n';
      const csvData = incidents.map(incident => 
        `"${incident.url.replace(/"/g, '""')}","${incident.domain}","${incident.riskLevel}",${incident.riskScore},"${incident.incidentType}",${incident.blocked},"${incident.createdAt.toISOString()}",${incident.threats?.length || 0}`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="incidents_${Date.now()}.csv"`);
      res.send(csvHeader + csvData);
    } else {
      res.json({
        success: true,
        exportDate: new Date(),
        period: { 
          startDate: new Date(startDate), 
          endDate: new Date(endDate) 
        },
        count: incidents.length,
        data: incidents
      });
    }

  } catch (error) {
    console.error('❌ Erreur export:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'export',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Route pour métriques temps réel
router.get('/metrics/realtime', async (req, res) => {
  try {
    const now = new Date();
    const last5min = new Date(now.getTime() - 5 * 60 * 1000);
    const last1h = new Date(now.getTime() - 60 * 60 * 1000);

    const Incident = require('../models/Incident');

    const [
      incidentsLast5min,
      incidentsLastHour,
      criticalIncidents,
      activeThreats
    ] = await Promise.all([
      Incident.countDocuments({ createdAt: { $gte: last5min } }),
      Incident.countDocuments({ createdAt: { $gte: last1h } }),
      Incident.countDocuments({ 
        riskLevel: 'high', 
        createdAt: { $gte: last1h },
        resolvedAt: { $exists: false }
      }),
      Incident.aggregate([
        { $match: { createdAt: { $gte: last1h } } },
        { $unwind: '$threats' },
        {
          $group: {
            _id: '$threats.type',
            count: { $sum: 1 },
            severity: { $first: '$threats.severity' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ])
    ]);

    res.json({
      success: true,
      data: {
        timestamp: now,
        incidentsLast5min,
        incidentsLastHour,
        criticalIncidents,
        activeThreats,
        status: criticalIncidents > 10 ? 'critical' : 
                incidentsLastHour > 50 ? 'warning' : 'normal'
      }
    });

  } catch (error) {
    console.error('Erreur métriques temps réel:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des métriques'
    });
  }
});

// Route pour rechercher des incidents similaires
router.get('/similar', [
  query('url')
    .optional()
    .isURL()
    .withMessage('URL valide requise'),
  query('domain')
    .optional()
    .matches(/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/)
    .withMessage('Domaine valide requis'),
  query('hours')
    .optional()
    .isInt({ min: 1, max: 168 })
    .withMessage('Heures doit être entre 1 et 168')
], incidentController.findSimilarIncidents);

// ======================== ROUTES GÉNÉRALES ========================

// Route principale pour récupérer tous les incidents
router.get('/', validateGetIncidents, incidentController.getIncidents);

// ======================== ROUTES AVEC PARAMÈTRES (APRÈS LES SPÉCIFIQUES) ========================

// Route pour récupérer les incidents par domaine
router.get('/domain/:domain', validateDomain, incidentController.getIncidentsByDomain);

// Route pour récupérer un incident spécifique (DOIT ÊTRE EN DERNIER)
router.get('/:id', validateId, incidentController.getIncidentById);

// Routes de mise à jour
router.put('/:id', validateUpdateIncident, incidentController.updateIncident);

// Route pour marquer comme faux positif
router.patch('/:id/false-positive', [
  ...validateId,
  body('adminNote')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Note admin trop longue')
], incidentController.markAsFalsePositive);

// Route pour marquer comme résolu
router.patch('/:id/resolve', validateId, incidentController.markAsResolved);

// Route pour supprimer un incident (admin seulement)
router.delete('/:id', validateId, incidentController.deleteIncident);

// ======================== MIDDLEWARE D'ERREUR ========================

// Middleware de gestion d'erreurs spécifique aux routes incidents
router.use((error, req, res, next) => {
  console.error('Erreur route incident:', error);

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Erreur de validation',
      errors: Object.values(error.errors).map(e => e.message)
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Conflit - donnée déjà existante'
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'ID invalide'
    });
  }

  res.status(500).json({
    success: false,
    message: 'Erreur interne du serveur'
  });
});

// ======================== FONCTIONS UTILITAIRES ========================

// Fonction utilitaire pour déterminer le type d'incident
function determineIncidentType(url, analysisDetails) {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('phishing') || urlLower.includes('phish')) {
    return 'phishing';
  }
  if (urlLower.includes('malware') || urlLower.includes('virus')) {
    return 'malware';
  }
  if (urlLower.includes('scam') || urlLower.includes('fake')) {
    return 'scam';
  }
  
  try {
    const hostname = new URL(url).hostname;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return 'ip_address_access';
    }
    
    if (hostname.match(/\.(tk|ml|ga|cf)$/)) {
      return 'suspicious_domain';
    }
  } catch (e) {
    // URL malformée
  }
  
  if (analysisDetails && analysisDetails.basicChecks) {
    for (const check of analysisDetails.basicChecks) {
      if (check.type === 'phishing_pattern') return 'phishing';
      if (check.type === 'malware') return 'malware';
      if (check.type === 'suspicious_domain') return 'suspicious_domain';
      if (check.type === 'ip_address') return 'ip_address_access';
    }
  }
  
  return 'other';
}

// Fonction utilitaire pour extraire les menaces
function extractThreats(analysisDetails) {
  const threats = [];
  
  if (analysisDetails && analysisDetails.basicChecks) {
    analysisDetails.basicChecks.forEach(check => {
      threats.push({
        type: check.type || 'unknown',
        severity: check.severity || 'medium',
        message: check.message || 'Menace détectée',
        details: check.details || {}
      });
    });
  }
  
  return threats;
}

module.exports = router;