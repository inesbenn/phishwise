// models/UserProgress.js
const { Schema, model } = require('mongoose');

const moduleProgressSchema = new Schema({
    moduleId: { type: Number, required: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
    attempts: [{
        attemptedAt: { type: Date, default: Date.now },
        score: { type: Number }, // Pour les quiz
        passed: { type: Boolean },
        answers: { type: Schema.Types.Mixed }, // Réponses du quiz
        timeSpent: { type: Number } // En secondes
    }],
    bestScore: { type: Number },
    timeSpent: { type: Number, default: 0 } // Temps total en secondes
});

const formationProgressSchema = new Schema({
    formationId: {
        type: Schema.Types.ObjectId,
        ref: 'Formation',
        required: true
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    lastActivity: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed', 'failed'],
        default: 'not_started'
    },
    modules: [moduleProgressSchema],
    overallProgress: { type: Number, default: 0 }, // Pourcentage
    badgeEarned: { type: Boolean, default: false },
    badgeEarnedAt: { type: Date }
});

const userProgressSchema = new Schema({
    // Lien vers le target dans la campagne
    campaignId: {
        type: Schema.Types.ObjectId,
        ref: 'Campaign',
        required: true
    },
    targetEmail: { type: String, required: true }, // Email du target
    targetId: { type: Schema.Types.Mixed }, // ID du target dans la campagne
    
    // Informations du target (dénormalisées pour performance)
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    position: { type: String },
    country: { type: String },
    office: { type: String },
    
    formations: [formationProgressSchema],
    
    // Statistiques globales
    totalFormationsStarted: { type: Number, default: 0 },
    totalFormationsCompleted: { type: Number, default: 0 },
    totalBadgesEarned: { type: Number, default: 0 },
    totalTimeSpent: { type: Number, default: 0 }, // En secondes
    averageScore: { type: Number, default: 0 },
    
    // Dernière activité
    lastLogin: { type: Date },
    lastActivity: { type: Date, default: Date.now },
    
    // Preferences
    preferredLanguage: { type: String, default: 'fr' },
    emailNotifications: { type: Boolean, default: true }
}, { timestamps: true });

// Index composé pour optimiser les requêtes
userProgressSchema.index({ campaignId: 1, targetEmail: 1 }, { unique: true });

module.exports = model('UserProgress', userProgressSchema);