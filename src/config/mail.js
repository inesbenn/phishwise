// src/config/mail.js
const nodemailer = require('nodemailer');

// Configuration du transporteur SMTP avec les variables d'environnement
const createTransporter = () => {
    // Validation des variables d'environnement requises
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        throw new Error('Configuration SMTP incomplète. Vérifiez vos variables d\'environnement SMTP_HOST, SMTP_USER, SMTP_PASS');
    }

    const config = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true', // true pour 465, false pour autres ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        // Options supplémentaires pour Gmail
        tls: {
            rejectUnauthorized: false
        }
    };
    
    console.log(`📧 Configuration SMTP: ${config.host}:${config.port} (secure: ${config.secure})`);
    
    // CORRECTION: utiliser createTransport au lieu de createTransporter
    return nodemailer.createTransport(config);
};

// Export du transporteur
let transporter;

const getTransporter = () => {
    if (!transporter) {
        transporter = createTransporter();
    }
    return transporter;
};

// Fonction de test de connexion SMTP
const testConnection = async () => {
    try {
        const transport = getTransporter();
        await transport.verify();
        console.log('✅ Connexion SMTP établie avec succès');
        return true;
    } catch (error) {
        console.error('❌ Erreur de connexion SMTP:', error.message);
        return false;
    }
};

module.exports = {
    getTransporter,
    testConnection
};