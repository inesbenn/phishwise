// src/models/Campaign.js
const { Schema, model } = require('mongoose');

const targetSchema = new Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    position: { type: String },
    country: { type: String },
    office: { type: String }
});
 
const submissionSchema = new Schema({
    submittedAt: { type: Date, default: Date.now },
    userAgent: { type: String },
    ipAddress: { type: String },
    referrer: { type: String },
    url: { type: String },
    formData: { type: Schema.Types.Mixed },
    targetEmail: { type: String },
    metadata: { type: Schema.Types.Mixed }
});
 
const interactionSchema = new Schema({
    type: {
        type: String,
        enum: ['visit', 'click', 'download', 'error'],
        required: true
    },
    timestamp: { type: Date, default: Date.now },
    ipAddress: { type: String },
    userAgent: { type: String },
    pageUrl: { type: String },
    referrer: { type: String },
    viewport: {
        width: { type: Number },
        height: { type: Number }
    },
    clickedUrl: { type: String },
    linkText: { type: String },
    downloadedFile: { type: String },
    errorMessage: { type: String }
});
 
// Schéma de tracking des emails mis à jour avec fonctionnalité de suivi
const emailTrackingSchema = new Schema({
    trackingToken: { 
        type: String, 
        required: true, 
        unique: false,
        index: true 
    },
    targetEmail: { 
        type: String, 
        required: true 
    },
    sentAt: { 
        type: Date, 
        default: Date.now 
    },
    
    // Tracking des ouvertures
    opened: { 
        type: Boolean, 
        default: false 
    },
    openedAt: { 
        type: Date 
    },
    openCount: { 
        type: Number, 
        default: 0 
    },
    openMetadata: {
        ipAddress: { type: String },
        userAgent: { type: String },
        timestamp: { type: Date }
    },
    
    // Tracking des clics
    clicks: [{
        url: { type: String, required: true },
        clickedAt: { type: Date, default: Date.now },
        metadata: {
            ipAddress: { type: String },
            userAgent: { type: String },
            referer: { type: String }
        }
    }],
    clickCount: { 
        type: Number, 
        default: 0 
    },
    
    // NOUVEAU: Email de rappel/suivi (sans tracking d'ouverture)
    followUpEmailSent: {
        type: Boolean,
        default: false
    },
    followUpEmailSentAt: {
        type: Date
    },
    followUpMessageId: {
        type: String
    },
    
    // Statut et métadonnées
    bounced: { 
        type: Boolean, 
        default: false 
    },
    bounceReason: { 
        type: String 
    },
    lastActivity: { 
        type: Date 
    }
}, {
    timestamps: true
});

const campaignSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    targets: [targetSchema],

    // NOUVEAU: Système de planification des envois
    scheduledSendDate: {
        type: Date,
        index: true // Index pour les recherches de planification
    },
    actualSendStartTime: {
        type: Date
    },
    actualSendEndTime: {
        type: Date
    },
    launchedAt: {
        type: Date
    },
    cancelledAt: {
        type: Date
    },
    lastSendResult: {
        type: Schema.Types.Mixed
    },
    lastSendError: {
        type: String
    },
    failedAt: {
        type: Date
    },

    // Étape 2 : Actualités & Sujets
    step2: {
        filters: {
            country: { type: String, default: 'fr' },
            theme: { type: String, default: 'cybersecurity' },
            credibility: { type: Number, default: 0 }
        },
        news: [{
            id: { type: Schema.Types.Mixed },
            title: { type: String },
            description: { type: String },
            excerpt: { type: String },
            source: { type: String },
            date: { type: Date },
            credibility: { type: Number },
            url: { type: String },
            urlToImage: { type: String }
        }],
        suggestions: [{
            subject: { type: String },
            summary: { type: String }
        }]
    },

    // Étape 3 : Modèles d'Emails
    step3: {
        templates: [{
            id: { type: String, required: true },
            name: { type: String, required: true },
            type: {
                type: String,
                enum: ['security_alert', 'system_notification', 'urgent_update', 'verification', 'generic'],
                default: 'generic'
            },
            sophistication_level: {
                type: String,
                enum: ['low', 'medium', 'high'],
                default: 'medium'
            },
            subject: { type: String, required: true },
            content_html: { type: String, required: true },
            content_text: { type: String },
            personalization_fields: [{ type: String }],
            based_on_news: { type: String },
            preview: { type: String },
            created_at: { type: Date, default: Date.now }
        }],
        selectedTemplate: { type: String },
        generatedAt: { type: Date }
    },

    // Étape 4 : Landing Page
    step4: {
        type: {
            type: String,
            enum: ['cloned', 'template'],
        },
        
        // Pour les URLs clonées
        originalUrl: { type: String },
        clonedUrl: { type: String },
        filePath: { type: String },
        clonedAt: { type: Date },
        cloneId: { type: String },
        previewUrl: { type: String },
        resourcesCount: { type: Number },
        
        // Pour les templates
        selectedTemplate: {
            id: { type: Number },
            name: { type: String },
            url: { type: String },
            category: { type: String },
            description: { type: String }
        },
        selectedAt: { type: Date },
        
        // Configuration post-soumission
        postSubmissionActions: {
            collectData: { type: Boolean, default: true },
            redirectToLearning: { type: Boolean, default: true },
            downloadMaliciousFile: { type: Boolean, default: true },
            redirectUrl: { type: String },
            maliciousFileUrl: { type: String }
        },
        
        // Soumissions capturées
        submissions: { type: [submissionSchema], default: [] },
        
        // Interactions (visites, clics, etc.)
        interactions: { type: [interactionSchema], default: [] },

        // Statut
        status: { type: String, enum: ['pending', 'success', 'error'], default: 'pending' },
        errorMessage: { type: String }
    },

    // Étape 5 : Configuration SMTP
    step5: {
        fromEmail: { 
            type: String, 
            required: false, 
            validate: { 
                validator: function(v) { 
                    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); 
                }, 
                message: 'Format d\'email invalide' 
            } 
        },
        fromName: { 
            type: String, 
            required: false, 
            minlength: 2, 
            maxlength: 100 
        },
        domain: { 
            type: String, 
            required: false  
        },
        dnsValidation: {
            spf: {
                status: { 
                    type: String, 
                    enum: ['pending', 'success', 'warning', 'error'], 
                    default: 'pending' 
                },
                message: String,
                record: String,
                lastChecked: Date
            },
            dkim: {
                status: { 
                    type: String, 
                    enum: ['pending', 'success', 'warning', 'error'], 
                    default: 'pending' 
                },
                message: String,
                record: String,
                lastChecked: Date
            },
            dmarc: {
                status: { 
                    type: String, 
                    enum: ['pending', 'success', 'warning', 'error'], 
                    default: 'pending' 
                },
                message: String,
                record: String,
                lastChecked: Date
            }
        },
        validationComplete: { 
            type: Boolean, 
            default: false 
        },
        isConfigured: { 
            type: Boolean, 
            default: false 
        },
        configuredAt: { type: Date }
    },

    step6: {
        configurationType: {
            type: String,
            enum: ['existing', 'custom', 'mixed'],
            default: 'existing'
        },
        
        assignedFormations: [{
            formationId: {
                type: Schema.Types.ObjectId,
                ref: 'Formation',
                required: true
            },
            assignedAt: { type: Date, default: Date.now },
            mandatory: { type: Boolean, default: true },
            dueDate: { type: Date },
            order: { type: Number, default: 0 },
            
            source: {
                type: String,
                enum: ['library', 'wizard_created'],
                default: 'library'
            },
            
            wizardData: {
                title: { type: String },
                description: { type: String },
                estimatedTime: { type: String },
                modules: [{ type: Schema.Types.Mixed }]
            }
        }],
        
        learningPageConfig: {
            title: { type: String, default: "Formation Sécurité - Sensibilisation au Phishing" },
            description: { type: String, default: "Cette formation vous aidera à reconnaître et éviter les tentatives de phishing." },
            estimatedTime: { type: String, default: "15-20 minutes" },
            welcomeMessage: { type: String },
            completionMessage: { type: String }
        },
        
        redirectToLearning: { type: Boolean, default: true },
        learningPageUrl: { type: String },
      
        requireAuthentication: { type: Boolean, default: false },
        accessToken: { type: String },
        sessionDuration: { type: Number, default: 3600 },
        
        allowRetry: { type: Boolean, default: true },
        showProgress: { type: Boolean, default: true },
        randomizeOrder: { type: Boolean, default: false },
        
        globalPassingCriteria: {
            minimumScore: { type: Number, default: 70 },
            requiredCompletionRate: { type: Number, default: 100 },
            timeLimit: { type: Number }
        },
        
        stats: {
            totalFormations: { type: Number, default: 0 },
            totalModules: { type: Number, default: 0 },
            estimatedTotalTime: { type: String, default: "0 minutes" },
            lastUpdated: { type: Date, default: Date.now }
        },
        
        isConfigured: { type: Boolean, default: false },
        configuredAt: { type: Date }
    },

    // Système de tracking des emails (avec suivi intégré)
    emailTracking: {
        type: [emailTrackingSchema],
        default: []
    },

    // Statistiques d'emails en temps réel (cache)
    emailStats: {
        totalSent: { type: Number, default: 0 },
        totalOpened: { type: Number, default: 0 },
        totalClicks: { type: Number, default: 0 },
        uniqueClicks: { type: Number, default: 0 },
        openRate: { type: Number, default: 0 },
        clickRate: { type: Number, default: 0 },
        clickThroughRate: { type: Number, default: 0 },
        bounceCount: { type: Number, default: 0 },
        bounceRate: { type: Number, default: 0 },
        lastUpdated: { type: Date, default: Date.now }
    },
    
    status: {
        type: String,
        enum: ['draft', 'scheduled', 'running', 'sending', 'sent', 'completed', 'failed', 'cancelled'],
        default: 'draft'
    }
}, { 
    timestamps: true
});

// Index pour optimiser les requêtes de tracking et de planification
campaignSchema.index({ 'emailTracking.trackingToken': 1 });
campaignSchema.index({ 'emailTracking.targetEmail': 1 });
campaignSchema.index({ 'emailTracking.opened': 1 });
campaignSchema.index({ status: 1 });
campaignSchema.index({ scheduledSendDate: 1 });
campaignSchema.index({ status: 1, scheduledSendDate: 1 });

// Middleware pour mettre à jour updatedAt
campaignSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Méthodes pour obtenir les statistiques
campaignSchema.methods.getQuickStats = function() {
    const tracking = this.emailTracking || [];
    
    return {
        sent: tracking.length,
        opened: tracking.filter(t => t.opened).length,
        clicked: tracking.filter(t => t.clickCount > 0).length,
        totalClicks: tracking.reduce((sum, t) => sum + (t.clickCount || 0), 0)
    };
};
 
campaignSchema.methods.getOpenRate = function() {
    const stats = this.getQuickStats();
    return stats.sent > 0 ? ((stats.opened / stats.sent) * 100).toFixed(1) : 0;
};
 
campaignSchema.methods.getClickRate = function() {
    const stats = this.getQuickStats();
    return stats.sent > 0 ? ((stats.clicked / stats.sent) * 100).toFixed(1) : 0;
};

// Méthodes pour la planification
campaignSchema.methods.isScheduled = function() {
    return this.status === 'scheduled' && this.scheduledSendDate && this.scheduledSendDate > new Date();
};

campaignSchema.methods.isPastDue = function() {
    return this.status === 'scheduled' && this.scheduledSendDate && this.scheduledSendDate <= new Date();
};

campaignSchema.methods.getSchedulingInfo = function() {
    if (!this.scheduledSendDate) return null;
    
    const now = new Date();
    const scheduledTime = new Date(this.scheduledSendDate);
    
    return {
        scheduledDate: scheduledTime,
        isPastDue: scheduledTime <= now,
        timeUntilSend: scheduledTime.getTime() - now.getTime(),
        status: this.status,
        canCancel: this.status === 'scheduled' && scheduledTime > now
    };
};

// NOUVELLES MÉTHODES: Statistiques des emails de suivi
campaignSchema.methods.getFollowUpEmailStats = function() {
    if (!this.emailTracking || this.emailTracking.length === 0) {
        return {
            totalPhishingVictims: 0,
            followUpEmailsSent: 0,
            followUpSendRate: 0
        };
    }
    
    const phishingVictims = this.emailTracking.filter(t => t.clickCount > 0);
    const followUpsSent = this.emailTracking.filter(t => t.followUpEmailSent);
    
    return {
        totalPhishingVictims: phishingVictims.length,
        followUpEmailsSent: followUpsSent.length,
        followUpSendRate: phishingVictims.length > 0 ? 
            ((followUpsSent.length / phishingVictims.length) * 100).toFixed(1) : 0
    };
};

// NOUVELLE MÉTHODE: Obtenir la liste des cibles qui ont besoin d'un email de suivi
campaignSchema.methods.getTargetsNeedingFollowUp = function() {
    if (!this.emailTracking || this.emailTracking.length === 0) {
        return [];
    }
    
    return this.emailTracking
        .filter(tracking => tracking.clickCount > 0 && !tracking.followUpEmailSent)
        .map(tracking => ({
            email: tracking.targetEmail,
            token: tracking.trackingToken,
            clickCount: tracking.clickCount,
            lastActivity: tracking.lastActivity
        }));
};

// NOUVELLE MÉTHODE: Marquer un email de suivi comme envoyé
campaignSchema.methods.markFollowUpEmailSent = function(targetEmail, messageId) {
    const tracking = this.emailTracking.find(t => t.targetEmail === targetEmail);
    if (tracking) {
        tracking.followUpEmailSent = true;
        tracking.followUpEmailSentAt = new Date();
        tracking.followUpMessageId = messageId;
        return this.save();
    }
    return Promise.reject(new Error('Email tracking not found for target'));
};

// NOUVELLE MÉTHODE: Obtenir les statistiques complètes incluant le suivi
campaignSchema.methods.getCompleteStats = function() {
    const basicStats = this.getQuickStats();
    const followUpStats = this.getFollowUpEmailStats();
    
    return {
        ...basicStats,
        ...followUpStats,
        openRate: this.getOpenRate(),
        clickRate: this.getClickRate()
    };
};

module.exports = model('Campaign', campaignSchema);
