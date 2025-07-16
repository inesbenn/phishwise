function setSiteLevel2(url, urlwithdomain) {
   var tld = document.location.hostname.split('.')[document.location.hostname.split('.').length - 1];
   if (tld === "fr")
   {
       /*Ajout de xiti_xtn2 16 comptes en ligne*/
       if (urlwithdomain.indexOf("voscomptesenligne-ti.sf.intra.laposte.fr") > -1 || urlwithdomain.indexOf("voscomptesenligne-rf.sf.intra.laposte.fr") > -1 || urlwithdomain.indexOf("voscomptesenligne.labanquepostale.fr") > -1) {
           return "espace clients";
       }

       /* URL for AEM espace clients */
        if ((urlwithdomain.indexOf("services.labanquepostale.fr") > -1 || urlwithdomain.indexOf("services.rf.labanquepostale.fr") > -1) && url.startsWith("/pph/bel")) {
           return "espace clients";
      }

       /*Ajout de xiti_xtn2 34 comptes en ligne*/
       if (urlwithdomain.indexOf("banqueenligneti.sf.intra.laposte.fr") > -1 || urlwithdomain.indexOf("banqueenlignerf.sf.intra.laposte.fr") > -1 || urlwithdomain.indexOf("banqueenligne.entreprises.labanquepostale.fr") > -1) {
           return "pmo - espace clients";
       }

       /* URL for AEM pmo - espace clients */
     if ((urlwithdomain.indexOf("services.labanquepostale.fr") > -1 || urlwithdomain.indexOf("services.rf.labanquepostale.fr") > -1) && url.startsWith("/pmo/bel")) {
           return "pmo - espace clients";
      }

       if ((url === "/" && (urlwithdomain.includes("www.labanquepostale.fr") || urlwithdomain.includes("www.rf.labanquepostale.fr"))) ||
           url.indexOf("/portail") === 0) {
           return "Particuliers - Refonte";
       }

       if (url === "/transversal/popups/groupe/cv_de_remy_weber.html" || url === "/transversal/popups/groupe/Philippe_Wahl.html" || url.indexOf("/transversal/opcvm") === 0) {
           return "Corporate";
       }

       if (urlwithdomain.indexOf(".harvest.fr") > -1 || urlwithdomain.indexOf("simulateurs.labanquepostale.fr") > -1) {
           return "Dossiers";
       }

       // Cas particuliers à ajouter ici pour s2 = 6

       /*if (url === "/transversal/popups/credits.html" || url === "/transversal/popups/mentions_legales.html") {
           return 8; => "Footer"
       }*/

       if (urlwithdomain.indexOf("transverse.labanquepostale.fr") > -1 ||
           urlwithdomain.indexOf("formulaire-tpe.labanquepostale.fr") > -1) {
           return "Contact";
       }
       if (urlwithdomain.indexOf("formulairepmo.labanquepostale.fr?id=") !== -1) {
           if (urlwithdomain.indexOf("?id=10") !== 1) {
               return "pmo - Grandes entreprises";
           }
           if (urlwithdomain.indexOf("?id=11") !== 1) {
               return "pmo - PME";
           }
       }
       // Cas particuliers à ajouter ici pour s2 = 11

       if (url === "/transversal/popups/particuliers/module_pieces_justificatives/popup_piecesJustificatives_intro.html" || url === "/transversal/popups/particuliers/module_pieces_justificatives/popup_piecesJustificatives_step1.html") {
           return "NOER";
       }

       if (url.indexOf("/particuliers/") === 0) {
           return "espace clients";
       }

       if (urlwithdomain.indexOf("sadselfservicedeficom.labanquepostale.fr") > -1 ||
           url.indexOf("/particulier/") === 0 || url.indexOf("/particulier.html") === 0 ||
           url.indexOf("/content/particulier/") === 0 ||
           url.indexOf("/content/particulier.html") === 0 ||
           url.indexOf("/content/portail.html") === 0 ||
           url.indexOf("/particulier/formulaires/") === 0 ||
           url.indexOf("/particulier/Outils/simulateurs/diagnostic_retraite.diagretraite.html") === 0 ||
           url.indexOf("/guideimmo/") === 0 ||
           url.indexOf("/guideimmo.sommaire.html") === 0 ||
           urlwithdomain.indexOf("ouvriruncompte.labanquepostale.fr") !== -1) {
           return "Particuliers - Refonte";
       }

       if (url.indexOf("/legroupe") === 0) {
           return "Le Groupe";
       }

       if (url.indexOf("/transversal/popups/argent_au_quotidien/e_carte_bleue/") === 0) {
           return "Popups e-Cartes Bleues";
       }

       if (url.indexOf("/associations-gestionnaires") === 0) {
           return "pmo - Associations de proximités";
       }
       if (url === "/associations.html" || url.indexOf("/associations") === 0) {
           return "pmo - Associations de proximités";
       }

       if (url.indexOf("/bailleurs-sociaux") === 0) {
           return "pmo - Bailleurs sociaux";
       }

       if (url.indexOf("/collectivites") === 0) {
           return "pmo - Collectivités locales";
       }


       if (url.indexOf("/grandes-entreprises") === 0) {
           return "pmo - PME";
       }

       if (url.indexOf("/grands-institutionnels") === 0) {
           return "pmo - Grands institutionnels";
       }

       if (url.indexOf("/acteurs-economiques") === 0) {
           return "pmo - Pages transverses";
       }
       if (url.indexOf("/institutionnels") === 0) {
           return "pmo - PME";
       }

       if (url.indexOf("/hopitaux") === 0) {
           return "pmo - Hopitaux publics";
       }

       if (url.indexOf("/mutuelles") === 0) {
           return "pmo - Mutuelles et protection sociale";
       }

       if (url.indexOf("/entreprises") === 0) {
           if (url.indexOf("entreprises-territoires") === 0) {
               return "pmo - Pages transverses";
           } else {
               return "pmo - PME";
           }
       }

       if (url.indexOf("/professionnels") === 0 || url === "/transversal/ident/pmo_ouvrir_compte.html" || document.location.hostname.indexOf("ouvriruncomptepro.") > -1 || urlwithdomain.indexOf("ecreditpro.labanquepostale.fr") > -1) {
           return "pmo - Professionnels";
       }

       if (url === "/page_indispo-F5-AEM.html") {
           return "Particuliers - Refonte";
       }
   }

   if (tld === "com") {
       if (urlwithdomain.indexOf("labanquepostaleselfservicev2.mm-dev2.com") > -1) {
           return "Particuliers - Refonte";
       } else if (url.indexOf("/corporate_eng.html") > -1) {
           return "Corporate English";
       } else if (urlwithdomain.indexOf("www.labanquepostale.com/en") > -1) {
           return "english group";
       } else if (urlwithdomain.indexOf("www.labanquepostale.com") > -1) {
           return "Le Groupe";
       } else if (urlwithdomain.indexOf("www.rf.labanquepostale.com") > -1) {
           return "Le Groupe";
       }

       return "Particuliers - Refonte";

   }

   if (tld === "net") {
       if (urlwithdomain.indexOf("re7.labanquepostale.ekeynox.net") > -1) {
           return "pmo - Professionnels";
       }
   }
}

var url = window.location.href;
var pathname = window.location.pathname;
var lastIndex = pathname.substring(pathname.lastIndexOf('/') + 1);
var pagename = lastIndex.slice(0, lastIndex.indexOf("."));

function getMeta(metaName) {
    var metas = document.getElementsByTagName('meta');
    for (let i = 0; i < metas.length; i++) {
        if (metas[i].getAttribute('property') === metaName || metas[i].getAttribute('name') === metaName) {
            return metas[i].getAttribute('content');
        }
    }
    return '';
}

function getTrackingScriptJsonAttr(attr) {
    const trackingScriptElement = document.getElementById('initTracking');
    if (trackingScriptElement) {
        // Get the value of the data-custom-attribute
        const attributeValue = trackingScriptElement.getAttribute(attr);

        if (attributeValue) {
            var jsonAttr = JSON.parse(attributeValue);
            if (jsonAttr) {
                return jsonAttr;
            }
        } else {
          console.error(attr + 'not found on the body element.');
        }
    } else {
        console.error('Body element not found.');
    }
}
var pageMetaName = getMeta("og:title"),
    env = getMeta("env"),
    jsonPage  = getTrackingScriptJsonAttr('data-jsonPage'),
    jsonClick = getTrackingScriptJsonAttr('data-jsonClick');


tc_vars.site_level2 = setSiteLevel2(document.location.pathname, location.href);

