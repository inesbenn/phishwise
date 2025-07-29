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
     * Envoie un email
     * @param {Object} mailOptions - Options de l'email
     * @param {string} mailOptions.from - Adresse expéditeur (format: "Nom <email@domain.com>")
     * @param {string} mailOptions.to - Adresse destinataire
     * @param {string} mailOptions.subject - Sujet de l'email
     * @param {string} mailOptions.html - Contenu HTML de l'email
     * @param {string} [mailOptions.text] - Contenu texte de l'email (optionnel)
     * @returns {Promise<Object>} Résultat de l'envoi
     */
    async sendMail({ from, to, subject, html, text }) {
        try {
            // Validation des paramètres requis
            if (!from || !to || !subject || !html) {
                throw new Error('Paramètres requis manquants: from, to, subject, html');
            }

            const mailOptions = {
                from,
                to,
                subject,
                html,
                text: text || this.stripHtml(html) // Génère automatiquement le texte si non fourni
            };

            // Envoi de l'email
            const result = await this.getTransporter().sendMail(mailOptions);

            return {
                success: true,
                messageId: result.messageId,
                response: result.response,
                to: to,
                subject: subject
            };

        } catch (error) {
            console.error(`Erreur lors de l'envoi de l'email à ${to}:`, error.message);
            
            return {
                success: false,
                error: error.message,
                to: to,
                subject: subject
            };
        }
    }

    /**
     * Envoie plusieurs emails en parallèle
     * @param {Array<Object>} emails - Liste des emails à envoyer
     * @returns {Promise<Array>} Résultats de tous les envois
     */
    async sendBulkMails(emails) {
        try {
            const promises = emails.map(email => this.sendMail(email));
            const results = await Promise.allSettled(promises);
            
            return results.map((result, index) => {
                if (result.status === 'fulfilled') {
                    return result.value;
                } else {
                    return {
                        success: false,
                        error: result.reason.message,
                        to: emails[index].to,
                        subject: emails[index].subject
                    };
                }
            });
        } catch (error) {
            console.error('Erreur lors de l\'envoi en masse:', error.message);
            throw error;
        }
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
            .trim();
    }

    /**
     * Teste la connexion SMTP
     * @returns {Promise<boolean>} True si la connexion fonctionne
     */
    async testConnection() {
        try {
            await this.getTransporter().verify();
            return true;
        } catch (error) {
            console.error('Test de connexion SMTP échoué:', error.message);
            return false;
        }
    }
}

module.exports = new EmailService();