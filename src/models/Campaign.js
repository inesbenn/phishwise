// src/models/Campaign.js 
const { Schema, model } = require('mongoose');

const targetSchema = new Schema({
  firstName: { type: String, required: true },
  lastName:  { type: String, required: true },
  email:     { type: String, required: true },
  position:  { type: String },
  country:   { type: String },
  office:    { type: String }
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
  targets: [ targetSchema ],
  
  // Étape 2 : Actualités & Sujets
  step2: {
    filters: {
      country:     { type: String, default: 'fr' },
      theme:       { type: String, default: 'cybersecurity' },
      credibility: { type: Number, default: 0  }
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
      
    // Statut
    status: { type: String, enum: ['pending', 'success', 'error'], default: 'pending' },
    errorMessage: { type: String }
  },

  status: {
    type: String,
    enum: ['draft', 'running', 'completed'],
    default: 'draft'
  }
}, { timestamps: true });

module.exports = model('Campaign', campaignSchema);
