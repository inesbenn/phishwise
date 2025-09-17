// models/UserProgress.js - VERSION CORRIGÉE avec gestion des tentatives
const { Schema, model } = require('mongoose');

const moduleProgressSchema = new Schema({
    moduleId: { type: Number, required: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
    
    // ✅ CORRECTION: Structure améliorée pour les tentatives
    attempts: [{
        attemptedAt: { type: Date, default: Date.now },
        attemptNumber: { type: Number, default: 1 }, // Numéro de la tentative
        score: { type: Number, default: 0 }, // Score obtenu (pour les quiz)
        passed: { type: Boolean, default: false }, // Tentative réussie ou non
        answers: { type: Schema.Types.Mixed }, // Réponses du quiz/exercice
        timeSpent: { type: Number, default: 0 }, // Temps passé en secondes
        feedback: { type: String }, // Feedback optionnel
        metadata: { type: Schema.Types.Mixed } // Données supplémentaires
    }],
    
    // Statistiques du module
    bestScore: { type: Number, default: 0 }, // Meilleur score obtenu
    totalAttempts: { type: Number, default: 0 }, // Nombre total de tentatives
    timeSpent: { type: Number, default: 0 }, // Temps total passé en secondes
    
    // État du module
    status: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed', 'failed'],
        default: 'not_started'
    },
    
    // Dates importantes
    firstAttemptAt: { type: Date }, // Date de la première tentative
    lastAttemptAt: { type: Date }   // Date de la dernière tentative
}, { timestamps: true });

const formationProgressSchema = new Schema({
    formationId: {
        type: Schema.Types.ObjectId,
        ref: 'Formation',
        required: true
    },
    
    // Dates de suivi
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    lastActivity: { type: Date, default: Date.now },
    
    // État global de la formation
    status: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed', 'failed', 'paused'],
        default: 'not_started'
    },
    
    // Progression des modules
    modules: [moduleProgressSchema],
    
    // Statistiques globales
    overallProgress: { type: Number, default: 0 }, // Pourcentage de progression
    totalTimeSpent: { type: Number, default: 0 }, // Temps total en secondes
    averageScore: { type: Number, default: 0 }, // Score moyen des quiz
    
    // Récompenses
    badgeEarned: { type: Boolean, default: false },
    badgeEarnedAt: { type: Date },
    badgeId: { type: String }, // ID du badge obtenu
    
    // Métadonnées
    certificateGenerated: { type: Boolean, default: false },
    certificateUrl: { type: String },
    notes: { type: String }, // Notes personnelles ou commentaires
    
    // Paramètres de formation
    mandatory: { type: Boolean, default: true }, // Formation obligatoire ou non
    dueDate: { type: Date }, // Date limite si applicable
    remindersSent: { type: Number, default: 0 } // Nombre de rappels envoyés
}, { timestamps: true });

// ✅ CORRECTION: Index pour optimiser les requêtes par formation
formationProgressSchema.index({ formationId: 1, status: 1 });

const userProgressSchema = new Schema({
    // Identification de l'utilisateur dans le contexte de la campagne
    campaignId: {
        type: Schema.Types.ObjectId,
        ref: 'Campaign',
        required: true
    },
    targetEmail: { type: String, required: true },
    targetId: { type: Schema.Types.Mixed }, // ID du target dans la campagne
    
    // Informations personnelles (dénormalisées pour performance)
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    position: { type: String },
    department: { type: String }, // Département de l'utilisateur
    country: { type: String },
    office: { type: String },
    
    // Progression des formations
    formations: [formationProgressSchema],
    
    // ✅ STATISTIQUES GLOBALES AMÉLIORÉES
    totalFormationsAssigned: { type: Number, default: 0 }, // Formations assignées
    totalFormationsStarted: { type: Number, default: 0 },   // Formations commencées
    totalFormationsCompleted: { type: Number, default: 0 }, // Formations terminées
    totalFormationsFailed: { type: Number, default: 0 },    // Formations échouées
    
    // Statistiques des quiz et évaluations
    totalQuizAttempts: { type: Number, default: 0 },      // Tentatives total de quiz
    totalQuizPassed: { type: Number, default: 0 },        // Quiz réussis
    averageScore: { type: Number, default: 0 },           // Score moyen global
    bestScore: { type: Number, default: 0 },              // Meilleur score obtenu
    
    // Récompenses et badges
    totalBadgesEarned: { type: Number, default: 0 },
    badgesCollection: [{
        badgeId: { type: String },
        badgeName: { type: String },
        earnedAt: { type: Date },
        formationId: { type: Schema.Types.ObjectId, ref: 'Formation' }
    }],
    
    // Temps et activité
    totalTimeSpent: { type: Number, default: 0 }, // Temps total en secondes
    averageSessionTime: { type: Number, default: 0 }, // Temps moyen par session
    totalSessions: { type: Number, default: 0 }, // Nombre de sessions d'apprentissage
    
    // Dates importantes
    firstLogin: { type: Date },
    lastLogin: { type: Date },
    lastActivity: { type: Date, default: Date.now },
    
    // Préférences utilisateur
    preferredLanguage: { type: String, default: 'fr' },
    emailNotifications: { type: Boolean, default: true },
    reminderFrequency: { 
        type: String, 
        enum: ['none', 'daily', 'weekly', 'biweekly'],
        default: 'weekly'
    },
    
    // ✅ NOUVELLES MÉTRIQUES POUR L'ANALYSE
    engagementScore: { type: Number, default: 0 }, // Score d'engagement (0-100)
    difficultyPreference: {
        type: String,
        enum: ['easy', 'moderate', 'challenging', 'adaptive'],
        default: 'adaptive'
    },
    
    // Suivi des performances
    performanceMetrics: {
        consistency: { type: Number, default: 0 }, // Régularité d'apprentissage
        improvement: { type: Number, default: 0 }, // Amélioration au fil du temps
        retention: { type: Number, default: 0 },   // Taux de rétention
        participation: { type: Number, default: 0 } // Niveau de participation
    },
    
    // Feedback et évaluations
    feedback: [{
        formationId: { type: Schema.Types.ObjectId, ref: 'Formation' },
        rating: { type: Number, min: 1, max: 5 },
        comment: { type: String },
        submittedAt: { type: Date, default: Date.now },
        anonymous: { type: Boolean, default: false }
    }],
    
    // Statut de l'utilisateur
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended', 'completed'],
        default: 'active'
    },
    
    // Informations de contact et communication
    lastEmailSent: { type: Date },
    totalEmailsSent: { type: Number, default: 0 },
    emailBounced: { type: Boolean, default: false },
    optedOut: { type: Boolean, default: false } // Utilisateur a refusé les communications
    
}, { 
    timestamps: true,
    // ✅ Options d'optimisation
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ✅ INDEX COMPOSÉS pour optimisation des requêtes
userProgressSchema.index({ campaignId: 1, targetEmail: 1 }, { unique: true });
userProgressSchema.index({ campaignId: 1, status: 1 });
userProgressSchema.index({ lastActivity: 1 });
userProgressSchema.index({ 'formations.status': 1 });

// ✅ PROPRIÉTÉS VIRTUELLES pour des calculs dynamiques
userProgressSchema.virtual('completionRate').get(function() {
    if (this.totalFormationsAssigned === 0) return 0;
    return Math.round((this.totalFormationsCompleted / this.totalFormationsAssigned) * 100);
});

userProgressSchema.virtual('passRate').get(function() {
    if (this.totalQuizAttempts === 0) return 0;
    return Math.round((this.totalQuizPassed / this.totalQuizAttempts) * 100);
});

userProgressSchema.virtual('isActive').get(function() {
    if (!this.lastActivity) return false;
    const daysSinceLastActivity = (Date.now() - this.lastActivity.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLastActivity <= 30; // Actif si activité dans les 30 derniers jours
});

// ✅ MÉTHODES D'INSTANCE
userProgressSchema.methods.updateEngagementScore = function() {
    let score = 0;
    
    // Facteurs d'engagement
    if (this.totalFormationsCompleted > 0) score += 20;
    if (this.averageScore > 70) score += 20;
    if (this.totalBadgesEarned > 0) score += 15;
    if (this.isActive) score += 15;
    if (this.totalSessions > 5) score += 10;
    if (this.feedback && this.feedback.length > 0) score += 10;
    if (this.completionRate > 80) score += 10;
    
    this.engagementScore = Math.min(score, 100);
    return this.engagementScore;
};

userProgressSchema.methods.addQuizAttempt = function(moduleId, formationId, score, passed, timeSpent, answers) {
    // Mettre à jour les statistiques globales
    this.totalQuizAttempts += 1;
    if (passed) this.totalQuizPassed += 1;
    
    // Recalculer le score moyen
    const allScores = [];
    this.formations.forEach(formation => {
        formation.modules.forEach(module => {
            module.attempts.forEach(attempt => {
                if (attempt.score > 0) allScores.push(attempt.score);
            });
        });
    });
    allScores.push(score);
    
    this.averageScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
    this.bestScore = Math.max(this.bestScore, score);
    this.totalTimeSpent += timeSpent;
    this.lastActivity = new Date();
    
    return this.save();
};

// ✅ MÉTHODES STATIQUES
userProgressSchema.statics.findByEmailAndCampaign = function(email, campaignId) {
    return this.findOne({ targetEmail: email, campaignId: campaignId });
};

userProgressSchema.statics.getCampaignStatistics = function(campaignId) {
    return this.aggregate([
        { $match: { campaignId: campaignId } },
        {
            $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                activeUsers: { 
                    $sum: { 
                        $cond: [
                            { $gte: ["$lastActivity", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                            1,
                            0
                        ]
                    }
                },
                averageCompletionRate: { $avg: "$completionRate" },
                averageScore: { $avg: "$averageScore" },
                totalBadges: { $sum: "$totalBadgesEarned" },
                totalTimeSpent: { $sum: "$totalTimeSpent" }
            }
        }
    ]);
};

module.exports = model('UserProgress', userProgressSchema);