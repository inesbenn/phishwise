// models/Formation.js
const { Schema, model } = require('mongoose');

const moduleSchema = new Schema({
    id: { type: Number, required: true },
    title: { type: String, required: true },
    type: {
        type: String,
        enum: ['text', 'video', 'quiz', 'simulation'],
        required: true
    },
    category: {
        type: String,
        enum: ['basics', 'identification', 'prevention', 'evaluation', 'practice'],
        default: 'basics'
    },
    content: {
        // Pour les modules texte
        text: { type: String },
        
        // Pour les modules vidéo
        videoUrl: { type: String },
        videoType: { type: String, default: 'youtube' },
        transcript: { type: String },
        
        // Pour les quiz
        questions: [{
            id: { type: Number },
            question: { type: String },
            type: { type: String, default: 'multiple' },
            options: [{ type: String }],
            correctAnswer: { type: Number },
            explanation: { type: String }
        }],
        passingScore: { type: Number, default: 70 },
        
        // Pour les simulations
        scenario: { type: String },
        emailContent: {
            from: { type: String },
            subject: { type: String },
            body: { type: String },
            suspiciousElements: [{
                element: { type: String },
                position: { type: String },
                explanation: { type: String }
            }]
        }
    },
    duration: { type: String, required: true },
    required: { type: Boolean, default: true },
    usageCount: { type: Number, default: 0 },
    lastUsed: { type: Date },
    status: {
        type: String,
        enum: ['active', 'inactive', 'draft'],
        default: 'active'
    }
}, { timestamps: true });

const formationSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    estimatedTime: { type: String, required: true },
    difficulty: {
        type: String,
        enum: ['débutant', 'intermédiaire', 'avancé'],
        default: 'débutant'
    },
    category: {
        type: String,
        enum: ['phishing', 'password', 'social', 'general'],
        default: 'general'
    },
    badge: { type: String },
    modules: [moduleSchema],
    isActive: { type: Boolean, default: true },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

module.exports = model('Formation', formationSchema);