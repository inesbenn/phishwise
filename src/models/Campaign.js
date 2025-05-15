const { Schema, model } = require('mongoose');

const campaignSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  targets: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['draft', 'running', 'completed'],
    default: 'draft'
  }
  // À compléter plus tard : newsFilters, emailTemplates, landingPageUrl, etc.
}, { timestamps: true });

module.exports = model('Campaign', campaignSchema);
