// src/controllers/incidentController.js
const Incident = require('../models/Incident');
const { validationResult } = require('express-validator');

class IncidentController {
  
  // Créer un nouvel incident (AVEC EXTRACTION DOMAINE)
  async createIncident(req, res) {
    try {
      // Vérifier les erreurs de validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Données invalides',
          errors: errors.array()
        });
      }

      const {
        url,
        riskLevel,
        riskScore,
        incidentType,
        threats,
        blocked,
        userAction,
        analysisDetails,
        clientInfo,
        geolocation,
        notes
      } = req.body;

      // EXTRACTION DU DOMAINE (NOUVEAU)
      let domain = req.body.domain; // Si fourni explicitement
      if (!domain) {
        try {
          // Nettoyer l'URL
          let cleanUrl = url.trim();
          if (!/^https?:\/\//i.test(cleanUrl)) {
            cleanUrl = 'http://' + cleanUrl;
          }
          const urlObj = new URL(cleanUrl);
          domain = urlObj.hostname.toLowerCase();
          console.log('Domaine extrait dans le contrôleur:', domain);
        } catch (error) {
          console.error('Erreur extraction domaine dans contrôleur:', error);
          // Fallback
          const match = url.match(/^https?:\/\/([^\/]+)/i);
          if (match) {
            domain = match[1].toLowerCase();
          } else {
            domain = 'unknown-domain';
          }
        }
      }

      // Créer l'incident AVEC le domaine
      const incident = new Incident({
        url,
        domain, // DOMAINE EXPLICITEMENT DÉFINI
        riskLevel,
        riskScore,
        incidentType,
        threats: threats || [],
        blocked: blocked !== undefined ? blocked : true,
        userAction: userAction || 'blocked',
        analysisDetails: analysisDetails || {},
        clientInfo: {
          ...clientInfo,
          timestamp: new Date(),
          userAgent: req.headers['user-agent'],
          extensionVersion: req.headers['extension-version'] || '1.0.0'
        },
        geolocation: geolocation || {},
        notes,
        reportedBy: 'extension'
      });

      const savedIncident = await incident.save();

      // Log pour debugging
      console.log(`Nouvel incident créé: ${savedIncident._id} - ${savedIncident.url} - ${savedIncident.domain}`);

      res.status(201).json({
        success: true,
        message: 'Incident enregistré avec succès',
        data: {
          id: savedIncident._id,
          url: savedIncident.url,
          domain: savedIncident.domain,
          riskLevel: savedIncident.riskLevel,
          riskScore: savedIncident.riskScore,
          blocked: savedIncident.blocked,
          createdAt: savedIncident.createdAt
        }
      });

    } catch (error) {
      console.error('Erreur création incident:', error);
      
      // Gestion des erreurs spécifiques
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Erreur de validation',
          errors: Object.values(error.errors).map(e => ({
            field: e.path,
            message: e.message
          }))
        });
      }

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Incident similaire déjà existant'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir tous les incidents avec pagination et filtres
  async getIncidents(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        riskLevel,
        incidentType,
        blocked,
        domain,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Construire les filtres
      const filters = {};
      
      if (riskLevel) {
        filters.riskLevel = riskLevel;
      }
      
      if (incidentType) {
        filters.incidentType = incidentType;
      }
      
      if (blocked !== undefined) {
        filters.blocked = blocked === 'true';
      }
      
      if (domain) {
        filters.domain = { $regex: domain, $options: 'i' };
      }
      
      if (startDate || endDate) {
        filters.createdAt = {};
        if (startDate) filters.createdAt.$gte = new Date(startDate);
        if (endDate) filters.createdAt.$lte = new Date(endDate);
      }

      // Configuration pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Exécuter les requêtes
      const [incidents, total] = await Promise.all([
        Incident.find(filters)
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit))
          .select('-adminNotes -__v'), // Exclure les champs sensibles
        Incident.countDocuments(filters)
      ]);

      res.json({
        success: true,
        data: {
          incidents,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalIncidents: total,
            hasNextPage: skip + incidents.length < total,
            hasPrevPage: parseInt(page) > 1
          }
        }
      });

    } catch (error) {
      console.error('Erreur récupération incidents:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des incidents'
      });
    }
  }

  // Obtenir un incident spécifique
  async getIncidentById(req, res) {
    try {
      const { id } = req.params;

      const incident = await Incident.findById(id);
      
      if (!incident) {
        return res.status(404).json({
          success: false,
          message: 'Incident non trouvé'
        });
      }

      res.json({
        success: true,
        data: incident
      });

    } catch (error) {
      console.error('Erreur récupération incident:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'ID incident invalide'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de l\'incident'
      });
    }
  }

  // Mettre à jour un incident
  async updateIncident(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Supprimer les champs qui ne doivent pas être modifiés
      delete updates._id;
      delete updates.createdAt;
      delete updates.reportedBy;

      const incident = await Incident.findByIdAndUpdate(
        id,
        { ...updates, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      if (!incident) {
        return res.status(404).json({
          success: false,
          message: 'Incident non trouvé'
        });
      }

      res.json({
        success: true,
        message: 'Incident mis à jour avec succès',
        data: incident
      });

    } catch (error) {
      console.error('Erreur mise à jour incident:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Données de mise à jour invalides',
          errors: Object.values(error.errors).map(e => ({
            field: e.path,
            message: e.message
          }))
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour'
      });
    }
  }

  // Marquer comme faux positif
  async markAsFalsePositive(req, res) {
    try {
      const { id } = req.params;
      const { adminNote } = req.body;

      const incident = await Incident.findById(id);
      
      if (!incident) {
        return res.status(404).json({
          success: false,
          message: 'Incident non trouvé'
        });
      }

      await incident.markAsFalsePositive(adminNote);

      res.json({
        success: true,
        message: 'Incident marqué comme faux positif',
        data: incident
      });

    } catch (error) {
      console.error('Erreur marquage faux positif:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du marquage'
      });
    }
  }

  // Marquer comme résolu
  async markAsResolved(req, res) {
    try {
      const { id } = req.params;

      const incident = await Incident.findById(id);
      
      if (!incident) {
        return res.status(404).json({
          success: false,
          message: 'Incident non trouvé'
        });
      }

      await incident.markAsResolved();

      res.json({
        success: true,
        message: 'Incident marqué comme résolu',
        data: incident
      });

    } catch (error) {
      console.error('Erreur marquage résolu:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du marquage'
      });
    }
  }

  // Obtenir les incidents par domaine
  async getIncidentsByDomain(req, res) {
    try {
      const { domain } = req.params;
      const { limit = 50 } = req.query;

      const incidents = await Incident.findByDomain(domain, parseInt(limit));

      res.json({
        success: true,
        data: {
          domain,
          incidents,
          count: incidents.length
        }
      });

    } catch (error) {
      console.error('Erreur récupération par domaine:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération'
      });
    }
  }

  // Obtenir des statistiques
  async getStatistics(req, res) {
    try {
      const { 
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 derniers jours
        endDate = new Date()
      } = req.query;

      const [
        totalIncidents,
        riskLevelStats,
        incidentTypeStats,
        topThreats,
        recentIncidents
      ] = await Promise.all([
        // Total des incidents
        Incident.countDocuments({
          createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
        }),
        
        // Statistiques par niveau de risque
        Incident.aggregate([
          {
            $match: {
              createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
            }
          },
          {
            $group: {
              _id: '$riskLevel',
              count: { $sum: 1 },
              avgRiskScore: { $avg: '$riskScore' },
              blockedCount: { $sum: { $cond: ['$blocked', 1, 0] } }
            }
          }
        ]),
        
        // Statistiques par type d'incident
        Incident.aggregate([
          {
            $match: {
              createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
            }
          },
          {
            $group: {
              _id: '$incidentType',
              count: { $sum: 1 },
              avgRiskScore: { $avg: '$riskScore' }
            }
          },
          { $sort: { count: -1 } }
        ]),
        
        // Top menaces
        Incident.getTopThreats(10),
        
        // Incidents récents
        Incident.find({
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('url domain riskLevel riskScore createdAt blocked')
      ]);

      res.json({
        success: true,
        data: {
          period: {
            startDate: new Date(startDate),
            endDate: new Date(endDate)
          },
          summary: {
            totalIncidents,
            averagePerDay: Math.round(totalIncidents / ((new Date(endDate) - new Date(startDate)) / (24 * 60 * 60 * 1000))),
            blockedIncidents: riskLevelStats.reduce((sum, stat) => sum + stat.blockedCount, 0)
          },
          riskLevelStats,
          incidentTypeStats,
          topThreats,
          recentIncidents
        }
      });

    } catch (error) {
      console.error('Erreur récupération statistiques:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques'
      });
    }
  }

  // Obtenir le dashboard
  async getDashboard(req, res) {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [
        incidentsToday,
        incidents7d,
        criticalIncidents,
        topDomains,
        recentActivity
      ] = await Promise.all([
        // Incidents aujourd'hui
        Incident.countDocuments({ createdAt: { $gte: last24h } }),
        
        // Incidents 7 derniers jours
        Incident.countDocuments({ createdAt: { $gte: last7d } }),
        
        // Incidents critiques non résolus
        Incident.countDocuments({ 
          riskLevel: 'high', 
          resolvedAt: { $exists: false } 
        }),
        
        // Top domaines à risque
        Incident.aggregate([
          { $match: { createdAt: { $gte: last7d } } },
          {
            $group: {
              _id: '$domain',
              count: { $sum: 1 },
              avgRiskScore: { $avg: '$riskScore' },
              highRiskCount: { 
                $sum: { $cond: [{ $eq: ['$riskLevel', 'high'] }, 1, 0] } 
              }
            }
          },
          { $sort: { highRiskCount: -1, count: -1 } },
          { $limit: 10 }
        ]),
        
        // Activité récente
        Incident.find()
          .sort({ createdAt: -1 })
          .limit(20)
          .select('url domain riskLevel createdAt blocked')
      ]);

      res.json({
        success: true,
        data: {
          metrics: {
            incidentsToday,
            incidents7d,
            criticalIncidents,
            averagePerDay: Math.round(incidents7d / 7)
          },
          topDomains,
          recentActivity,
          lastUpdate: now
        }
      });

    } catch (error) {
      console.error('Erreur récupération dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du dashboard'
      });
    }
  }

  // Rechercher des incidents similaires
  async findSimilarIncidents(req, res) {
    try {
      const { url, domain, hours = 24 } = req.query;

      if (!url && !domain) {
        return res.status(400).json({
          success: false,
          message: 'URL ou domaine requis'
        });
      }

      const similarIncidents = await Incident.findSimilarIncidents(
        url, 
        domain, 
        parseInt(hours)
      );

      res.json({
        success: true,
        data: {
          url,
          domain,
          searchPeriodHours: parseInt(hours),
          similarIncidents,
          count: similarIncidents.length
        }
      });

    } catch (error) {
      console.error('Erreur recherche incidents similaires:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche'
      });
    }
  }

  // Supprimer un incident (admin seulement)
  async deleteIncident(req, res) {
    try {
      const { id } = req.params;

      const incident = await Incident.findByIdAndDelete(id);
      
      if (!incident) {
        return res.status(404).json({
          success: false,
          message: 'Incident non trouvé'
        });
      }

      res.json({
        success: true,
        message: 'Incident supprimé avec succès'
      });

    } catch (error) {
      console.error('Erreur suppression incident:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression'
      });
    }
  }
}

module.exports = new IncidentController();