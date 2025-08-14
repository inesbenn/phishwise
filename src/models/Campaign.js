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

// Define the submissionSchema
const submissionSchema = new Schema({
    submittedAt: { type: Date, default: Date.now },
    userAgent: { type: String },
    ipAddress: { type: String },
    referrer: { type: String },
    url: { type: String },
    formData: { type: Schema.Types.Mixed }, // Store all form data
    targetEmail: { type: String }, // Email of the target who submitted
    metadata: { type: Schema.Types.Mixed } // Additional metadata
});

// Nouveau schéma pour les interactions générales (visites, clics)
const interactionSchema = new Schema({
    type: {
        type: String,
        enum: ['visit', 'click', 'download', 'error'], // Ajout de 'download' et 'error' pour plus de granularité si besoin
        required: true
    },
    timestamp: { type: Date, default: Date.now },
    ipAddress: { type: String },
    userAgent: { type: String },
    pageUrl: { type: String },
    referrer: { type: String },
    viewport: { // Pour les visites
        width: { type: Number },
        height: { type: Number }
    },
    clickedUrl: { type: String }, // Pour les clics
    linkText: { type: String },   // Pour les clics
    downloadedFile: { type: String }, // Pour les téléchargements
    errorMessage: { type: String } // Pour les erreurs de script client
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

    // Étape 2 : Actualités & Sujets
    step2: {
        filters: {
            country: { type: String, default: 'fr' },
            theme: { type: String, default: 'cybersecurity' },
            credibility: { type: Number, default: 0 }
        },
        news: [{
            id: { type: Schema.Types.Mixed }, // String for 'news_<timestamp>_<index>'
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
        selectedTemplate: { type: String }, // ID du template sélectionné
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
        previewUrl: { type: String }, // Ajouté pour correspondre au controller
        resourcesCount: { type: Number }, // Ajouté pour correspondre au controller
        
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
            redirectUrl: { type: String }, // URL personnalisée de redirection
            maliciousFileUrl: { type: String } // URL du fichier malveillant
        },
        
        // Soumissions capturées
        submissions: { type: [submissionSchema], default: [] },
        
        // Interactions (visites, clics, etc.)
        interactions: { type: [interactionSchema], default: [] }, // <--- NOUVEAU CHAMP AJOUTÉ ICI

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
        // Formations assignées à cette campagne
        assignedFormations: [{
            formationId: {
                type: Schema.Types.ObjectId,
                ref: 'Formation',
                required: true
            },
            assignedAt: { type: Date, default: Date.now },
            mandatory: { type: Boolean, default: true },
            dueDate: { type: Date }, // Date limite pour compléter
            order: { type: Number, default: 0 } // Ordre de présentation
        }],
        
        // Configuration de redirection après phishing
        redirectToLearning: { type: Boolean, default: true },
        learningPageUrl: { type: String }, // URL personnalisée de la page d'apprentissage
        
        // Paramètres d'accès
        requireAuthentication: { type: Boolean, default: false },
        accessToken: { type: String }, // Token pour accès direct
        sessionDuration: { type: Number, default: 3600 }, // Durée de session en secondes
        
        isConfigured: { type: Boolean, default: false },
        configuredAt: { type: Date }
    },

    status: {
        type: String,
        enum: ['draft', 'running', 'completed'],
        default: 'draft'
    }
}, { 
    timestamps: true // Ceci remplace les champs createdAt/updatedAt manuels
});

// Middleware pour mettre à jour updatedAt (optionnel car timestamps: true le fait automatiquement)
campaignSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = model('Campaign', campaignSchema);
