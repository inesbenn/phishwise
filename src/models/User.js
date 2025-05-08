// src/models/User.js
const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  firstName:   { type: String, required: true },  
  lastName:    { type: String, required: true },   // Champs obligatoires  
  email:       { type: String, required: true, unique: true },  
  password:    { type: String, required: true, select: false },  // Masqué par défaut :contentReference[oaicite:0]{index=0}  
  role:        { type: String, enum: ['Admin','Manager','Analyste','Cible'], default: 'Cible' },  
  office:      { type: String },  
  country:     { type: String },  
  status:      { type: String, enum: ['active','inactive','suspended'], default: 'active' }  // Nouveau statut :contentReference[oaicite:1]{index=1}  
}, { timestamps: true });

module.exports = model('User', userSchema);
