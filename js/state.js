/**
 * state.js — Modèle de données et helpers globaux.
 *
 * Expose un objet global `AppState` contenant toutes les données
 * (plannings, plats, ingrédients) et les fonctions utilitaires
 * de date et de tri.
 *
 * Dépend de : storage.js (chargé avant dans index.html)
 */

// ─── Constantes de date ───────────────────────────────────────────

/** Noms courts des jours de la semaine (index 0 = Dimanche) */
const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/** Abréviations des mois */
const MONTH_LABELS = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];

// ─── Helpers de date ─────────────────────────────────────────────

/** Formate une date en "JJ/MM" */
function formatDateShort(d) {
  return d.getDate() + '/' + (d.getMonth() + 1);
}

/** Formate une date en "JJ mois" */
function formatDateFull(d) {
  return d.getDate() + ' ' + MONTH_LABELS[d.getMonth()];
}

/** Ajoute n jours à une date (retourne une nouvelle Date) */
function addDays(date, n) {
  const r = new Date(date);
  r.setDate(r.getDate() + n);
  return r;
}

/** Retourne true si la date correspond à aujourd'hui */
function isToday(d) {
  const now = new Date();
  return d.getDate() === now.getDate()
      && d.getMonth() === now.getMonth()
      && d.getFullYear() === now.getFullYear();
}

/**
 * Retourne le vendredi de la semaine en cours (ou passé immédiat).
 * Le planning commence toujours un vendredi soir.
 */
function getWeekStartFriday(from) {
  const d = new Date(from);
  // Décale au vendredi précédent (getDay() : 0=Dim … 5=Ven … 6=Sam)
  d.setDate(d.getDate() - ((d.getDay() - 5 + 7) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Retourne les types de créneaux disponibles pour le jour d'index `dayIndex`
 * (0 = vendredi début, 7 = vendredi fin).
 * - Jour 0 (ven début) : soir seulement (le midi n'est pas planifiable)
 * - Jour 7 (ven fin)   : midi seulement (le soir n'est pas planifiable)
 * - Autres jours       : midi et soir
 */
function getSlotTypesForDay(dayIndex) {
  if (dayIndex === 0) return ['soir'];
  if (dayIndex === 7) return ['midi'];
  return ['midi', 'soir'];
}

/**
 * Construit le tableau des 8 jours d'un planning à partir du vendredi de départ.
 * @param {Date} startFriday
 * @returns {Array<{date, shortName, slotTypes}>}
 */
function buildWeekDays(startFriday) {
  return Array.from({ length: 8 }, (_, i) => {
    const date = addDays(startFriday, i);
    return {
      date,
      shortName: DAY_SHORT[date.getDay()],
      slotTypes: getSlotTypesForDay(i)
    };
  });
}

// ─── Helpers de tri ──────────────────────────────────────────────

/** Trie un tableau d'objets {name} par ordre alphabétique français */
function sortByName(arr) {
  return [...arr].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

// ─── Données par défaut ──────────────────────────────────────────

function getDefaultIngredients() {
  return [
    { id: 101, name: 'Ail',                unit: 'gousse(s)' },
    { id: 102, name: 'Aubergines',         unit: 'unité(s)'  },
    { id: 103, name: 'Beurre',             unit: 'g'         },
    { id: 104, name: 'Bouillon cube',      unit: 'unité(s)'  },
    { id: 105, name: 'Carottes',           unit: 'g'         },
    { id: 106, name: 'Courgettes',         unit: 'unité(s)'  },
    { id: 107, name: 'Crème fraîche',      unit: 'cl'        },
    { id: 108, name: 'Fromage râpé',       unit: 'g'         },
    { id: 109, name: 'Herbes de Provence', unit: 'c.s.'      },
    { id: 110, name: 'Lardons',            unit: 'g'         },
    { id: 111, name: 'Œufs',              unit: 'unité(s)'  },
    { id: 112, name: 'Oignon',             unit: 'unité(s)'  },
    { id: 113, name: 'Olives',             unit: 'g'         },
    { id: 114, name: 'Pâte brisée',       unit: 'unité(s)'  },
    { id: 115, name: 'Pâtes',             unit: 'g'         },
    { id: 116, name: 'Poireaux',           unit: 'unité(s)'  },
    { id: 117, name: 'Poivrons',           unit: 'unité(s)'  },
    { id: 118, name: 'Pommes de terre',    unit: 'g'         },
    { id: 119, name: 'Poulet',             unit: 'kg'        },
    { id: 120, name: 'Thon en boîte',      unit: 'g'         },
    { id: 121, name: 'Tomates',            unit: 'unité(s)'  },
    { id: 122, name: 'Tomates concassées', unit: 'g'         },
    { id: 123, name: 'Viande hachée',      unit: 'g'         },
  ];
}

function getDefaultDishes() {
  return [
    { id: 1, name: 'Gratin dauphinois', restriction: 'soir', double: true,  ingredients: [{ ingId: 118, qty: 800 }, { ingId: 107, qty: 40 }, { ingId: 108, qty: 100 }, { ingId: 101, qty: 2 }] },
    { id: 2, name: 'Omelette',          restriction: 'both', double: false, ingredients: [{ ingId: 111, qty: 4 }, { ingId: 103, qty: 20 }] },
    { id: 3, name: 'Pâtes bolognaise', restriction: 'soir', double: true,  ingredients: [{ ingId: 115, qty: 500 }, { ingId: 123, qty: 400 }, { ingId: 122, qty: 400 }, { ingId: 112, qty: 1 }] },
    { id: 4, name: 'Poulet rôti',       restriction: 'both', double: false, ingredients: [{ ingId: 119, qty: 1.5 }, { ingId: 101, qty: 4 }, { ingId: 109, qty: 2 }] },
    { id: 5, name: 'Quiche lorraine',   restriction: 'midi', double: false, ingredients: [{ ingId: 114, qty: 1 }, { ingId: 110, qty: 200 }, { ingId: 107, qty: 20 }, { ingId: 111, qty: 3 }] },
    { id: 6, name: 'Ratatouille',       restriction: 'both', double: true,  ingredients: [{ ingId: 106, qty: 2 }, { ingId: 102, qty: 1 }, { ingId: 117, qty: 2 }, { ingId: 121, qty: 4 }] },
    { id: 7, name: 'Salade niçoise',   restriction: 'midi', double: false, ingredients: [{ ingId: 120, qty: 185 }, { ingId: 121, qty: 3 }, { ingId: 113, qty: 50 }, { ingId: 111, qty: 3 }] },
    { id: 8, name: 'Soupe de légumes', restriction: 'both', double: true,  ingredients: [{ ingId: 105, qty: 300 }, { ingId: 116, qty: 2 }, { ingId: 118, qty: 400 }, { ingId: 104, qty: 2 }] },
  ];
}

/**
 * Crée un objet planning vide pour une semaine donnée.
 * Les créneaux sont initialisés à null (aucun plat assigné).
 */
function createEmptyPlanning(startFriday) {
  const slots = {};
  for (let i = 0; i < 8; i++) {
    getSlotTypesForDay(i).forEach(slotType => {
      slots[`${i}-${slotType}`] = null;
    });
  }
  return {
    startFri: startFriday.toISOString(),
    name: `Planning du ${formatDateShort(startFriday)} au ${formatDateShort(addDays(startFriday, 7))}`,
    slots
  };
}

/** Retourne l'état initial (données par défaut) */
function getDefaultState() {
  const friday = getWeekStartFriday(new Date());
  return {
    plannings:   [createEmptyPlanning(friday)],
    dishes:      getDefaultDishes(),
    ingredients: getDefaultIngredients()
  };
}

// ─── État global de l'application ───────────────────────────────

/**
 * AppState — objet global contenant toutes les données.
 * Initialisé par Storage.load() dans index.html avant tout rendu.
 */
const AppState = {
  plannings:   [],
  dishes:      [],
  ingredients: [],

  /** Remplace l'état complet (appelé après chargement du storage) */
  hydrate(data) {
    const source = data || getDefaultState();
    this.plannings   = source.plannings;
    this.dishes      = source.dishes;
    this.ingredients = source.ingredients;
  },

  /** Persiste l'état courant dans le storage */
  async save() {
    await Storage.save({
      plannings:   this.plannings,
      dishes:      this.dishes,
      ingredients: this.ingredients
    });
  },

  // ── Accesseurs ──

  getDish(id)       { return this.dishes.find(d => d.id === id); },
  getIngredient(id) { return this.ingredients.find(i => i.id === id); },
  getSlotsForPlanning(planningIndex) { return this.plannings[planningIndex].slots; },

  /**
   * Calcule le tag de portion (P1 ou P2) d'un plat en double portion
   * dans un créneau donné, en se basant sur l'ordre chronologique des créneaux.
   */
  getPortionTag(planningIndex, slotKey, dish) {
    if (!dish.double) return null;
    const slots = this.getSlotsForPlanning(planningIndex);
    const occupiedKeys = Object.keys(slots).filter(k => slots[k] === dish.id);
    if (occupiedKeys.length <= 1) return null;

    // Tri chronologique : index du jour * 2 + (soir=1, midi=0)
    occupiedKeys.sort((a, b) => {
      const [ai, at] = a.split('-'), [bi, bt] = b.split('-');
      return (parseInt(ai) * 2 + (at === 'soir' ? 1 : 0))
           - (parseInt(bi) * 2 + (bt === 'soir' ? 1 : 0));
    });
    const pos = occupiedKeys.indexOf(slotKey);
    return pos === 0 ? 'P1' : pos === 1 ? 'P2' : null;
  }
};

// ─── Initialisation : chargement storage puis rendu ─────────────

// On surcharge Storage.load pour hydrater AppState automatiquement
const _originalStorageLoad = Storage.load.bind(Storage);
Storage.load = async function() {
  const data = await _originalStorageLoad();
  AppState.hydrate(data);
};
