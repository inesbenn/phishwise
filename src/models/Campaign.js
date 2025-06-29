
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
      psychological_triggers: [{ type: String }],
      based_on_news: { type: String },
      preview: { type: String },
      created_at: { type: Date, default: Date.now }
    }],
    selectedTemplate: { type: String }, // ID du template sélectionné
    generatedAt: { type: Date }
  },

  status: {
    type: String,
    enum: ['draft', 'running', 'completed'],
    default: 'draft'
  }
}, { timestamps: true });

module.exports = model('Campaign', campaignSchema);
