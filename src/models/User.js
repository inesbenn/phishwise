// src/models/User.js
const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  firstName:   { type: String, required: true },  
  lastName:    { type: String, required: true },   
  email:       { type: String, required: true, unique: true },  
  password:    { type: String, required: true, select: false },
  role:        { type: String, enum: ['Admin','Manager','Analyste','Cible'], default: 'Cible' },  
  office:      { type: String },  
  country:     { type: String },  
  status:      { type: String, enum: ['active','inactive'], default: 'active' }, // Seulement actif/inactif
  refreshToken: { type: String, select: false }
}, { timestamps: true });

module.exports = model('User', userSchema);