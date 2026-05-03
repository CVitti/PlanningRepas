/* ═══════════════════════════════════════════════════════════
   js/app.js — Point d'entrée principal
   ═══════════════════════════════════════════════════════════

   Deux fonctions publiques :
     start() — appelée au DOMContentLoaded, gère le boot asynchrone
     boot()  — appelée après un chargement Gist réussi (depuis Setup ou start)

   Flux de démarrage :
     1. Setup.init() câble les événements de l'écran de configuration
     2. Si non configuré → affiche l'écran de setup et attend
     3. Si configuré → affiche le loader, charge le Gist, lance boot()

   Gestion des erreurs de chargement :
     TOKEN_INVALID   → token expiré, retour au setup
     TOKEN_FORBIDDEN → token sans scope gist, retour au setup
     GIST_NOT_FOUND  → identifiant incorrect, retour au setup
     autres          → problème réseau, affiche le setup sans effacer les creds
   ═══════════════════════════════════════════════════════════ */

const App = (() => {

  /* ── Démarrage des composants (après chargement Gist réussi) ── */

  /**
   * Initialise tous les composants dans l'ordre de leurs dépendances :
   *   Modal       → gestion des modales (doit être prêt avant les autres)
   *   Ingredients → chargement de la liste d'ingrédients
   *   Dishes      → chargement des plats (dépend d'Ingredients)
   *   Planning    → grille + navigation hebdomadaire (dépend de Dishes)
   *   Sidebar     → liste draggable (dépend de Planning pour les highlights)
   */
  function boot() {
    Modal.init();
    Ingredients.init();
    Dishes.init();
    Planning.init();
    Sidebar.init();
  }

  /* ── Boot asynchrone avec chargement Gist ── */

  /**
   * Appelé au DOMContentLoaded.
   * Affiche l'écran de setup si non configuré,
   * sinon charge les données et lance boot().
   */
  async function start() {
    Setup.init();

    /* Pas de configuration en localStorage → affiche le setup et attend */
    if (!Gist.isConfigured()) {
      Setup.show();
      return;
    }

    showLoader(true);
    try {
      await Gist.load();       // récupère les données depuis l'API Gist
      Storage.maybeInit();     // insère les données d'exemple si le Gist est vide
      boot();
    } catch (err) {
      showLoader(false);

      /* Traitement des erreurs connues avec messages adaptés */
      if (err.message === 'TOKEN_INVALID') {
        Toast.error('Token GitHub expiré ou révoqué. Reconfigurez l\'accès.');
        Gist.clearCreds();
        Setup.show();
      } else if (err.message === 'TOKEN_FORBIDDEN') {
        Toast.error('Permission refusée : recréez un token avec le scope "gist".');
        Gist.clearCreds();
        Setup.show();
      } else if (err.message === 'GIST_NOT_FOUND') {
        Toast.error('Gist introuvable. Reconfigurez l\'accès.');
        Gist.clearCreds();
        Setup.show();
      } else {
        /* Erreur réseau ou autre — les creds sont conservés pour la prochaine tentative */
        Toast.error('Impossible de joindre GitHub. Vérifiez votre connexion.');
        Setup.show();
      }
      return;
    }
    showLoader(false);
  }

  /* ── Loader de démarrage ── */

  /** Affiche ou masque l'écran de chargement #boot-loader */
  function showLoader(on) {
    const el = document.getElementById('boot-loader');
    if (el) el.classList.toggle('visible', on);
  }

  return { boot, start };
})();

/* ── Déclenchement au chargement du DOM ── */
document.addEventListener('DOMContentLoaded', () => App.start());
