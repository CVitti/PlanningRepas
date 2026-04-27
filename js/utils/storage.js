/* ═══════════════════════════════════════════════════════════
   js/utils/storage.js — Thin adapter over Gist.get / Gist.set
   Tous les composants appellent Storage.get/set comme avant,
   mais les données vivent dans le Gist (in-memory + sync).
   ═══════════════════════════════════════════════════════════ */

const Storage = (() => {

  function get(key, fallback = null) {
    return Gist.get(key, fallback);
  }

  function set(key, value) {
    Gist.set(key, value);
  }

  /* remove n'est plus nécessaire mais on le garde pour compatibilité */
  function remove(key) {
    Gist.set(key, undefined);
  }

  /* Plus de seed local — les données viennent du Gist.
     Appelé après load() si le Gist est vide (premier usage). */
  function maybeInit() {
    const ings = get('ingredients', null);
    if (ings !== null) return; // déjà initialisé côté Gist

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
    set('planning', {});
  }

  return { get, set, remove, maybeInit };
})();
