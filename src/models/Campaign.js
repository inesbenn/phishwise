// src/models/Campaign.js
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
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
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
}, { timestamps: true });

module.exports = model('Campaign', campaignSchema);
