
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
      credibility: { type: Number, default: 0 }
    },
    news: [{
      id:          { type: Number },
      title:       { type: String },
      source:      { type: String },
      date:        { type: Date },
      credibility: { type: Number }
    }],
    suggestions: [{
      subject: { type: String },
      summary: { type: String }
    }]
  },
  
  status: {
    type: String,
    enum: ['draft', 'running', 'completed'],
    default: 'draft'
  }
}, { timestamps: true });

module.exports = model('Campaign', campaignSchema);
