// services/EmailService.js
const { getTransporter } = require('../config/mail');

class EmailService {
    constructor() {
        this.transporter = null;
    }

    /**
     * Obtient le transporteur (initialisation paresseuse)
     * @returns {Object} Transporteur Nodemailer
     */
    getTransporter() {
        if (!this.transporter) {
            this.transporter = getTransporter();
        }
        return this.transporter;
    }

    /**
     * Envoie un email avec masquage de l'adresse réelle
     * @param {Object} mailOptions - Options de l'email
     * @param {string} mailOptions.from - Adresse expéditeur à afficher (format: "Nom <email@domain.com>")
     * @param {string} mailOptions.to - Adresse destinataire
     * @param {string} mailOptions.subject - Sujet de l'email
     * @param {string} mailOptions.html - Contenu HTML de l'email
     * @param {string} [mailOptions.text] - Contenu texte de l'email (optionnel)
     * @param {Object} [mailOptions.headers] - En-têtes personnalisés
     * @returns {Promise<Object>} Résultat de l'envoi
     */
    async sendMail({ from, to, subject, html, text, headers = {} }) {
        try {
            // Validation des paramètres requis
            if (!from || !to || !subject || !html) {
                throw new Error('Paramètres requis manquants: from, to, subject, html');
            }

            // Configuration de base des options email
            const mailOptions = {
                from, // Adresse d'affichage (celle saisie par l'utilisateur)
                to,
                subject,
                html,
                text: text || this.stripHtml(html),
                headers: {
                    ...headers,
                    'X-Mailer': 'PhishWise-Mailer',
                    'X-Priority': '3'
                }
            };

            // CONFIGURATION AVANCÉE : Masquage de l'adresse réelle
            // Si l'option de masquage est activée dans l'environnement
            if (process.env.SMTP_MASK_REAL_SENDER === 'true') {
                const technicalSenderEmail = process.env.SMTP_TECHNICAL_SENDER || process.env.SMTP_USER;
                
                // Utilisation de l'envelope pour séparer l'adresse d'envoi de l'adresse d'affichage
                mailOptions.envelope = {
                    from: technicalSenderEmail, // Adresse technique réelle pour SMTP
                    to: to
                };

                // Ajout d'en-têtes pour améliorer la livraison
                mailOptions.headers = {
                    ...mailOptions.headers,
                    'Reply-To': this.extractEmailFromAddress(from), // Les réponses vont vers l'adresse affichée
                    'Return-Path': technicalSenderEmail, // Les bounces reviennent vers l'adresse technique
                    'Sender': technicalSenderEmail // Identifie l'expéditeur technique réel
                };

                console.log(`📧 Envoi masqué: Technique="${technicalSenderEmail}" → Affichage="${from}" → Destinataire="${to}"`);
            } else {
                console.log(`📧 Envoi direct: "${from}" → "${to}"`);
            }

            // Envoi de l'email
            const result = await this.getTransporter().sendMail(mailOptions);

            // Log de succès détaillé
            console.log(`✅ Email envoyé avec succès à ${to}`);
            console.log(`   - Message ID: ${result.messageId}`);
            console.log(`   - Affichage expéditeur: ${from}`);

            return {
                success: true,
                messageId: result.messageId,
                response: result.response,
                to: to,
                subject: subject,
                displayFrom: from,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error(`❌ Erreur lors de l'envoi de l'email à ${to}:`, error.message);
            
            // Log détaillé de l'erreur pour debugging
            if (error.code) {
                console.error(`   - Code d'erreur: ${error.code}`);
            }
            if (error.response) {
                console.error(`   - Réponse serveur: ${error.response}`);
            }
            
            return {
                success: false,
                error: error.message,
                errorCode: error.code || 'UNKNOWN',
                to: to,
                subject: subject,
                displayFrom: from,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Envoie plusieurs emails en parallèle avec gestion optimisée pour les gros volumes
     * @param {Array<Object>} emails - Liste des emails à envoyer
     * @returns {Promise<Array>} Résultats de tous les envois
     */
    async sendBulkMails(emails) {
        try {
            const totalEmails = emails.length;
            console.log(`📦 Démarrage de l'envoi en masse de ${totalEmails} emails`);

            // Configuration des limites
            const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_EMAILS) || 50;
            const batchSize = parseInt(process.env.BATCH_SIZE) || 25;
            const batchDelay = parseInt(process.env.BATCH_DELAY) || 1000;
            const sendDelay = parseInt(process.env.SMTP_SEND_DELAY) || 75;

            console.log(`⚙️  Configuration: ${maxConcurrent} simultanés, lots de ${batchSize}, délai ${sendDelay}ms`);

            let allResults = [];
            
            // Traitement par lots pour éviter la surcharge
            for (let i = 0; i < totalEmails; i += batchSize) {
                const batch = emails.slice(i, i + batchSize);
                const batchNumber = Math.floor(i / batchSize) + 1;
                const totalBatches = Math.ceil(totalEmails / batchSize);
                
                console.log(`📨 Traitement du lot ${batchNumber}/${totalBatches} (${batch.length} emails)`);

                // Envoi du lot avec limitation de concurrence
                const batchResults = await this.sendBatchWithConcurrencyLimit(batch, maxConcurrent, sendDelay);
                allResults.push(...batchResults);

                // Délai entre les lots (sauf pour le dernier)
                if (i + batchSize < totalEmails) {
                    console.log(`⏳ Pause de ${batchDelay}ms avant le prochain lot...`);
                    await new Promise(resolve => setTimeout(resolve, batchDelay));
                }
            }

            // Statistiques finales
            const successful = allResults.filter(r => r.success).length;
            const failed = allResults.filter(r => !r.success).length;
            
            console.log(`📊 Envoi en masse terminé: ${successful} réussis, ${failed} échecs sur ${totalEmails} total`);
            console.log(`📈 Taux de réussite: ${((successful / totalEmails) * 100).toFixed(1)}%`);

            return allResults;

        } catch (error) {
            console.error('💥 Erreur critique lors de l\'envoi en masse:', error.message);
            throw error;
        }
    }

    /**
     * Envoie un lot d'emails avec limitation de concurrence
     * @param {Array<Object>} batch - Lot d'emails à envoyer
     * @param {number} maxConcurrent - Nombre maximum d'envois simultanés
     * @param {number} sendDelay - Délai entre les envois
     * @returns {Promise<Array>} Résultats du lot
     */
    async sendBatchWithConcurrencyLimit(batch, maxConcurrent, sendDelay) {
        const results = [];
        
        // Envoi avec limitation de concurrence
        for (let i = 0; i < batch.length; i += maxConcurrent) {
            const concurrentBatch = batch.slice(i, i + maxConcurrent);
            
            // Envoi simultané du sous-lot
            const promises = concurrentBatch.map(async (email, index) => {
                // Délai échelonné pour éviter les pics
                if (sendDelay > 0 && index > 0) {
                    await new Promise(resolve => setTimeout(resolve, sendDelay * index));
                }
                
                return this.sendMailWithRetry(email);
            });

            const concurrentResults = await Promise.allSettled(promises);
            
            // Traitement des résultats
            const processedResults = concurrentResults.map((result, index) => {
                const email = concurrentBatch[index];
                if (result.status === 'fulfilled') {
                    return result.value;
                } else {
                    console.error(`❌ Échec envoi à ${email.to}:`, result.reason.message);
                    return {
                        success: false,
                        error: result.reason.message,
                        to: email.to,
                        subject: email.subject,
                        displayFrom: email.from,
                        timestamp: new Date().toISOString()
                    };
                }
            });

            results.push(...processedResults);
            
            // Progression
            const progress = Math.min(i + maxConcurrent, batch.length);
            console.log(`   ✓ ${progress}/${batch.length} emails du lot traités`);
        }

        return results;
    }

    /**
     * Envoie un email avec retry automatique
     * @param {Object} emailOptions - Options de l'email
     * @returns {Promise<Object>} Résultat de l'envoi
     */
    async sendMailWithRetry(emailOptions) {
        const maxRetries = parseInt(process.env.EMAIL_RETRY_ATTEMPTS) || 3;
        const retryDelay = parseInt(process.env.EMAIL_RETRY_DELAY) || 5000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.sendMail(emailOptions);
                
                if (result.success) {
                    if (attempt > 1) {
                        console.log(`✅ Email à ${emailOptions.to} envoyé après ${attempt} tentatives`);
                    }
                    return result;
                }
                
                // Si échec et ce n'est pas la dernière tentative
                if (attempt < maxRetries) {
                    console.log(`⚠️  Tentative ${attempt} échouée pour ${emailOptions.to}, retry dans ${retryDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    continue;
                }
                
                return result; // Retourne l'échec après toutes les tentatives

            } catch (error) {
                if (attempt < maxRetries) {
                    console.log(`🔄 Erreur tentative ${attempt} pour ${emailOptions.to}: ${error.message}`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    continue;
                }
                
                // Dernière tentative échouée
                return {
                    success: false,
                    error: error.message,
                    to: emailOptions.to,
                    subject: emailOptions.subject,
                    displayFrom: emailOptions.from,
                    timestamp: new Date().toISOString(),
                    attempts: attempt
                };
            }
        }
    }

    /**
     * Extrait l'adresse email d'une chaîne au format "Nom <email@domain.com>"
     * @param {string} fromAddress - Adresse au format avec ou sans nom
     * @returns {string} Adresse email extraite
     */
    extractEmailFromAddress(fromAddress) {
        const match = fromAddress.match(/<(.+)>/);
        return match ? match[1] : fromAddress;
    }

    /**
     * Supprime les balises HTML d'une chaîne pour créer du texte brut
     * @param {string} html - Contenu HTML
     * @returns {string} Texte sans balises HTML
     */
    stripHtml(html) {
        return html
            .replace(/<[^>]*>/g, '') // Supprime toutes les balises HTML
            .replace(/&nbsp;/g, ' ') // Remplace les espaces insécables
            .replace(/&amp;/g, '&')  // Remplace les entités HTML
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ') // Remplace plusieurs espaces par un seul
            .trim();
    }

    /**
     * Teste la connexion SMTP avec informations détaillées
     * @returns {Promise<Object>} Résultat détaillé du test
     */
    async testConnection() {
        try {
            console.log('🔍 Test de la connexion SMTP...');
            
            const transporter = this.getTransporter();
            const verification = await transporter.verify();
            
            console.log('✅ Connexion SMTP validée avec succès');
            console.log(`   - Serveur: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
            console.log(`   - Utilisateur: ${process.env.SMTP_USER}`);
            console.log(`   - Sécurité: ${process.env.SMTP_SECURE === 'true' ? 'SSL/TLS' : 'STARTTLS'}`);
            
            return {
                success: true,
                message: 'Connexion SMTP fonctionnelle',
                details: {
                    host: process.env.SMTP_HOST,
                    port: process.env.SMTP_PORT,
                    user: process.env.SMTP_USER,
                    secure: process.env.SMTP_SECURE === 'true',
                    maskingEnabled: process.env.SMTP_MASK_REAL_SENDER === 'true'
                },
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Test de connexion SMTP échoué:', error.message);
            
            return {
                success: false,
                message: 'Problème de connexion SMTP',
                error: error.message,
                errorCode: error.code || 'UNKNOWN',
                details: {
                    host: process.env.SMTP_HOST,
                    port: process.env.SMTP_PORT,
                    user: process.env.SMTP_USER
                },
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Envoie un email de test pour vérifier la configuration
     * @param {string} testEmail - Email de destination pour le test
     * @param {string} displayFrom - Adresse d'affichage à tester
     * @returns {Promise<Object>} Résultat du test d'envoi
     */
    async sendTestEmail(testEmail, displayFrom = 'Test PhishWise <test@phishwise.com>') {
        const testMailOptions = {
            from: displayFrom,
            to: testEmail,
            subject: '🧪 Test de configuration PhishWise',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Test de configuration PhishWise</h2>
                    <p>Ce message confirme que votre configuration email fonctionne correctement.</p>
                    
                    <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h3>Détails techniques :</h3>
                        <ul>
                            <li><strong>Adresse d'affichage :</strong> ${displayFrom}</li>
                            <li><strong>Adresse technique :</strong> ${process.env.SMTP_USER}</li>
                            <li><strong>Serveur SMTP :</strong> ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}</li>
                            <li><strong>Masquage activé :</strong> ${process.env.SMTP_MASK_REAL_SENDER === 'true' ? 'Oui' : 'Non'}</li>
                            <li><strong>Horodatage :</strong> ${new Date().toLocaleString('fr-FR')}</li>
                        </ul>
                    </div>
                    
                    <p style="color: #059669;">✅ Configuration validée avec succès !</p>
                </div>
            `
        };

        return this.sendMail(testMailOptions);
    }
}

module.exports = new EmailService();