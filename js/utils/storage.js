/* ═══════════════════════════════════════════════════════════
   js/utils/storage.js — Adaptateur mince vers Gist.get / Gist.set
   ═══════════════════════════════════════════════════════════

   Tous les composants appellent Storage.get/set comme s'ils
   parlaient à un localStorage, mais les données vivent en mémoire
   dans l'objet Gist et sont synchronisées automatiquement
   vers l'API GitHub Gist (lecture au démarrage, écriture debounced).

   Clés gérées : "ingredients", "dishes", "planning"
   ═══════════════════════════════════════════════════════════ */

const Storage = (() => {

  /* ── Lecture / écriture (délèguent à Gist) ── */

  function get(key, fallback = null) {
    return Gist.get(key, fallback);
  }

  function set(key, value) {
    Gist.set(key, value); // déclenche un save debounced vers l'API
  }

  /** Remove est conservé pour compatibilité mais passe par Gist.set(undefined) */
  function remove(key) {
    Gist.set(key, undefined);
  }

  /* ── Initialisation des données par défaut ── */

  /**
   * Appelé après Gist.load() au premier démarrage (Gist vide).
   * Si la clé "ingredients" est déjà présente dans le Gist, on ne touche
   * à rien — les données existantes de l'utilisateur sont conservées.
   *
   * Insère un jeu de données d'exemple (ingrédients + plats + planning vide)
   * pour que l'application soit utilisable immédiatement.
   */
  function maybeInit() {
    const ings = get('ingredients', null);
    if (ings !== null) return; // données déjà présentes, rien à faire

    /* Ingrédients de démonstration */
    set('ingredients', [
      { id: 'ing1', name: 'Farine',         unit: 'g'         },
      { id: 'ing2', name: 'Oeufs',          unit: 'unite'     },
      { id: 'ing3', name: 'Lait',           unit: 'cl'        },
      { id: 'ing4', name: 'Fromage rape',   unit: 'g'         },
      { id: 'ing5', name: 'Poitrine fumee', unit: 'g'         },
      { id: 'ing6', name: 'Pates',          unit: 'g'         },
      { id: 'ing7', name: 'Tomates pelees', unit: 'g'         },
      { id: 'ing8', name: 'Viande hachee',  unit: 'g'         },
      { id: 'ing9', name: "Huile d'olive",  unit: 'c. a s.'   },
    ]);

    /* Plats de démonstration associés aux ingrédients ci-dessus */
    set('dishes', [
      {
        id: 'dish1', name: 'Quiche lorraine', slot: 'both', double: false,
        ingredients: [
          { id: 'ing1', qty: 200 }, { id: 'ing2', qty: 3 },
          { id: 'ing3', qty: 30  }, { id: 'ing4', qty: 80 },
          { id: 'ing5', qty: 150 },
        ]
      },
      {
        id: 'dish2', name: 'Bolognaise', slot: 'soir', double: false,
        ingredients: [
          { id: 'ing6', qty: 300 }, { id: 'ing7', qty: 400 },
          { id: 'ing8', qty: 400 }, { id: 'ing9', qty: 2   },
        ]
      },
      {
        id: 'dish3', name: 'Omelette', slot: 'midi', double: false,
        ingredients: [
          { id: 'ing2', qty: 3 }, { id: 'ing4', qty: 30 },
        ]
      },
    ]);

    /* Planning vide — l'utilisateur commence à planifier depuis zéro */
    set('planning', {});
  }

  return { get, set, remove, maybeInit };
})();
