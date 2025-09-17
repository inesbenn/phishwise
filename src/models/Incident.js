const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  // Informations de base
  url: {
    type: String,
    required: true,
    trim: true,
    maxLength: 2048
  },
  
  domain: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxLength: 255
  },
  
  // Classification du risque
  riskLevel: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  
  riskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  
  // Détails de l'incident
  incidentType: {
    type: String,
    required: true,
    enum: [
      'malware',
      'phishing', 
      'scam',
      'suspicious_domain',
      'fake_website',
      'malicious_redirect',
      'ip_address_access',
      'untrusted_certificate',
      'other'
    ],
    default: 'other'
  },
  
  threats: [{
    type: {
      type: String,
      required: true
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true
    },
    message: {
      type: String,
      required: true
    },
    details: {
      type: mongoose.Schema.Types.Mixed
    }
  }],
  
  // Actions prises
  blocked: {
    type: Boolean,
    default: false
  },
  
  userAction: {
    type: String,
    enum: ['blocked', 'warned', 'ignored', 'proceeded'],
    default: 'blocked'
  },
  
  // Métadonnées techniques
  analysisDetails: {
    analysisLevel: {
      type: String,
      enum: ['basic', 'advanced'],
      default: 'basic'
    },
    basicChecks: [{
      check: String,
      result: Boolean,
      severity: String,
      message: String
    }],
    advancedChecks: {
      type: mongoose.Schema.Types.Mixed
    },
    scanDuration: {
      type: Number // en millisecondes
    }
  },
  
  // Informations client
  clientInfo: {
    userAgent: {
      type: String,
      maxLength: 512
    },
    extensionVersion: {
      type: String,
      maxLength: 20
    },
    tabId: {
      type: Number
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    sessionId: {
      type: String,
      maxLength: 128
    }
  },
  
  // Géolocalisation (optionnelle, respecter RGPD)
  geolocation: {
    country: {
      type: String,
      maxLength: 2, // Code pays ISO
      uppercase: true
    },
    city: {
      type: String,
      maxLength: 100
    },
    includeGeoInfo: {
      type: Boolean,
      default: false
    }
  },
  
  // Informations de suivi
  reportedBy: {
    type: String,
    enum: ['extension', 'user', 'system', 'api'],
    default: 'extension'
  },
  
  verified: {
    type: Boolean,
    default: false
  },
  
  falsePositive: {
    type: Boolean,
    default: false
  },
  
  resolvedAt: {
    type: Date
  },
  
  // Commentaires et notes
  notes: {
    type: String,
    maxLength: 1000
  },
  
  adminNotes: {
    type: String,
    maxLength: 2000
  }
}, {
  timestamps: true,
  collection: 'incidents'
});

// Index pour optimiser les requêtes
incidentSchema.index({ url: 1 });
incidentSchema.index({ domain: 1 });
incidentSchema.index({ riskLevel: 1, createdAt: -1 });
incidentSchema.index({ incidentType: 1 });
incidentSchema.index({ blocked: 1 });
incidentSchema.index({ createdAt: -1 });
incidentSchema.index({ 'clientInfo.timestamp': -1 });

// Index composé pour les statistiques
incidentSchema.index({ 
  riskLevel: 1, 
  incidentType: 1, 
  createdAt: -1 
});

// Index pour recherche par domaine et date
incidentSchema.index({ 
  domain: 1, 
  createdAt: -1 
});

// Méthodes du schema
incidentSchema.methods.markAsResolved = function() {
  this.resolvedAt = new Date();
  this.verified = true;
  return this.save();
};

incidentSchema.methods.markAsFalsePositive = function(adminNote) {
  this.falsePositive = true;
  this.verified = true;
  this.resolvedAt = new Date();
  if (adminNote) {
    this.adminNotes = adminNote;
  }
  return this.save();
};

incidentSchema.methods.getSeverityScore = function() {
  const weights = {
    high: 3,
    medium: 2, 
    low: 1
  };
  
  let totalScore = weights[this.riskLevel] * 10;
  
  if (this.threats && this.threats.length > 0) {
    const threatScore = this.threats.reduce((sum, threat) => {
      return sum + weights[threat.severity];
    }, 0);
    totalScore += threatScore;
  }
  
  return Math.min(totalScore, 100);
};

// Méthodes statiques
incidentSchema.statics.findByDomain = function(domain, limit = 50) {
  return this.find({ domain })
    .sort({ createdAt: -1 })
    .limit(limit);
};

incidentSchema.statics.getStatsByPeriod = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: {
          riskLevel: '$riskLevel',
          incidentType: '$incidentType'
        },
        count: { $sum: 1 },
        avgRiskScore: { $avg: '$riskScore' },
        blockedCount: {
          $sum: { $cond: ['$blocked', 1, 0] }
        }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

incidentSchema.statics.getTopThreats = function(limit = 10) {
  return this.aggregate([
    { $unwind: '$threats' },
    {
      $group: {
        _id: {
          type: '$threats.type',
          severity: '$threats.severity'
        },
        count: { $sum: 1 },
        avgRiskScore: { $avg: '$riskScore' },
        domains: { $addToSet: '$domain' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
};

incidentSchema.statics.findSimilarIncidents = function(url, domain, hours = 24) {
  const timeThreshold = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.find({
    $or: [
      { url: url },
      { domain: domain }
    ],
    createdAt: { $gte: timeThreshold }
  }).sort({ createdAt: -1 });
};

// Pre-save middleware pour extraction du domaine
incidentSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('url')) {
    try {
      const urlObj = new URL(this.url);
      this.domain = urlObj.hostname.toLowerCase();
    } catch (error) {
      // Si l'URL est invalide, essayer d'extraire le domaine manuellement
      const match = this.url.match(/^https?:\/\/([^\/]+)/i);
      if (match) {
        this.domain = match[1].toLowerCase();
      } else {
        this.domain = 'unknown';
      }
    }
  }
  
  // Déterminer le type d'incident automatiquement si non spécifié
  if (this.isNew && !this.incidentType) {
    this.incidentType = this.determineIncidentType();
  }
  
  next();
});

// Méthode pour déterminer le type d'incident
incidentSchema.methods.determineIncidentType = function() {
  const url = this.url.toLowerCase();
  const domain = this.domain.toLowerCase();
  
  // Patterns de détection
  if (url.includes('phishing') || domain.includes('phishing')) {
    return 'phishing';
  }
  
  if (url.includes('malware') || url.includes('virus')) {
    return 'malware';
  }
  
  if (url.includes('scam') || url.includes('fake')) {
    return 'scam';
  }
  
  if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
    return 'ip_address_access';
  }
  
  if (domain.match(/\.(tk|ml|ga|cf)$/)) {
    return 'suspicious_domain';
  }
  
  if (this.threats && this.threats.length > 0) {
    const threatTypes = this.threats.map(t => t.type);
    if (threatTypes.includes('phishing')) return 'phishing';
    if (threatTypes.includes('malware')) return 'malware';
    if (threatTypes.includes('scam')) return 'scam';
  }
  
  return 'other';
};

// Virtual pour calculer l'âge de l'incident
incidentSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Virtual pour formater l'âge de façon lisible
incidentSchema.virtual('ageFormatted').get(function() {
  const minutes = Math.floor(this.age / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}j ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
});

// Transform pour limiter les données exposées
incidentSchema.methods.toJSON = function() {
  const incident = this.toObject();
  
  // Masquer les informations sensibles si nécessaire
  if (!incident.geolocation?.includeGeoInfo) {
    delete incident.geolocation;
  }
  
  // Limiter la taille de certains champs
  if (incident.clientInfo?.userAgent) {
    incident.clientInfo.userAgent = incident.clientInfo.userAgent.substring(0, 200);
  }
  
  return incident;
};

const Incident = mongoose.model('Incident', incidentSchema);

module.exports = Incident;