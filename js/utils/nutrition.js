/* ═══════════════════════════════════════════════════════════
   js/utils/nutrition.js — Calcul des valeurs nutritionnelles
   ═══════════════════════════════════════════════════════════

   Fournit les fonctions de conversion et de calcul partagées
   entre le formulaire de plat (dishes.js), la modale de détail
   et les cartes du planning (planning.js).

   Modèle de données ajouté sur chaque ingrédient :
   {
     gramsPerUnit: null | number,   // g pour 1 unité de cet ingrédient
                                    // (ignoré pour g et kg)
     nutrition: null | {
       per:     number,             // quantité de référence en g (défaut 100)
       kcal:    number | null,      // énergie
       fat:     number | null,      // graisses totales
       satFat:  number | null,      // dont acides gras saturés
       carbs:   number | null,      // glucides totaux
       sugars:  number | null,      // dont sucres
       fiber:   number | null,      // fibres alimentaires
       protein: number | null,      // protéines
       salt:    number | null,      // sel
     }
   }

   Règle null vs 0 :
     null → valeur inconnue → affiche "—"
     0    → valeur nulle volontaire → affiche "0"
   ═══════════════════════════════════════════════════════════ */

const Nutrition = (() => {

  /* ── Définition des colonnes ── */

  /** Ordre d'affichage des nutriments */
  const KEYS = ['kcal', 'fat', 'satFat', 'carbs', 'sugars', 'fiber', 'protein', 'salt'];

  /** Libellés courts pour les en-têtes de colonnes */
  const LABELS = {
    kcal:    'Énergie',
    fat:     'Graisses',
    satFat:  'dont Sat.',
    carbs:   'Glucides',
    sugars:  'dont Sucres',
    fiber:   'Fibres',
    protein: 'Protéines',
    salt:    'Sel',
  };

  /** Unités affichées sous chaque en-tête */
  const UNIT_LABELS = {
    kcal: 'kcal',
    fat: 'g', satFat: 'g', carbs: 'g', sugars: 'g',
    fiber: 'g', protein: 'g', salt: 'g',
  };

  /** Colonnes qui sont des sous-valeurs (affichage en retrait + couleur atténuée) */
  const IS_SUB = { satFat: true, sugars: true };

  /* ── Conversions en grammes ── */

  /** Conversions natives : pas de champ gramsPerUnit requis */
  const NATIVE_G = { g: 1, kg: 1000 };

  /**
   * Conversions volumétriques par défaut (densité eau ≈ 1 g/ml).
   * Peuvent être surchargées par gramsPerUnit sur l'ingrédient
   * (ex : huile d'olive ≈ 0,92 g/ml → gramsPerUnit = 0.92).
   */
  const DEFAULT_VOL_G = { ml: 1, cl: 10, l: 1000 };

  /**
   * Convertit une quantité dans l'unité de l'ingrédient en grammes.
   * Retourne null si la conversion est impossible
   * (unité non-standard sans gramsPerUnit défini).
   */
  function toGrams(qty, ing) {
    if (NATIVE_G[ing.unit] !== undefined)      return qty * NATIVE_G[ing.unit];
    if (ing.gramsPerUnit)                      return qty * ing.gramsPerUnit;
    if (DEFAULT_VOL_G[ing.unit] !== undefined) return qty * DEFAULT_VOL_G[ing.unit];
    return null; // unité non convertible
  }

  /* ── Calcul par ingrédient ── */

  /**
   * Calcule les apports nutritionnels d'une quantité d'un ingrédient.
   *
   * Retourne null si :
   *   - l'ingrédient n'a pas de données nutritionnelles
   *   - la conversion en grammes est impossible
   *
   * Pour chaque nutriment : null = inconnu, nombre = valeur calculée.
   */
  function calcIngredient(ing, qty) {
    if (!ing.nutrition) return null;
    const grams = toGrams(qty, ing);
    if (grams === null) return null;
    const factor = grams / (ing.nutrition.per || 100);
    const result = {};
    KEYS.forEach(k => {
      const v = ing.nutrition[k];
      result[k] = (v === null || v === undefined)
        ? null
        : parseFloat((v * factor).toFixed(4));
    });
    return result;
  }

  /* ── Calcul du total d'un plat ── */

  /**
   * Calcule le total nutritionnel d'un plat (somme de ses ingrédients).
   *
   * Une valeur reste null si aucun ingrédient ne l'a fournie.
   * Si au moins un ingrédient contribue, les autres sans données sont ignorés
   * (le total n'est donc pas forcément exhaustif, mais reste cohérent).
   */
  function calcDish(dish) {
    const totals = {};
    KEYS.forEach(k => { totals[k] = null; });

    dish.ingredients.forEach(item => {
      const ing = Ingredients.getById(item.id);
      if (!ing) return;
      const n = calcIngredient(ing, item.qty);
      if (!n) return;
      KEYS.forEach(k => {
        if (n[k] !== null) totals[k] = (totals[k] ?? 0) + n[k];
      });
    });

    return totals;
  }

  /* ── Formatage ── */

  /**
   * Formate une valeur nutritionnelle pour l'affichage :
   *   null → "—"
   *   kcal → arrondi à l'entier
   *   autres → 1 décimale (zéros finaux supprimés)
   */
  function fmt(val, key) {
    if (val === null || val === undefined) return '—';
    if (key === 'kcal') return Math.round(val).toString();
    return parseFloat(val.toFixed(1)).toString();
  }

  /* ── Construction du tableau HTML ── */

  /**
   * Génère le HTML complet du tableau nutritionnel d'un plat :
   *   - une ligne par ingrédient (avec la quantité utilisée)
   *   - une ligne Total en pied de tableau
   *
   * Cas particuliers par cellule :
   *   "—"  → ingrédient sans données nutritionnelles
   *   "?"  → données présentes mais conversion en grammes impossible
   *          (gramsPerUnit non défini pour l'unité)
   *
   * Retourne un message vide si le plat n'a aucun ingrédient.
   */
  function buildTableHTML(dish) {
    if (!dish || !dish.ingredients.length) {
      return '<p class="nutr-empty">Aucun ingrédient dans ce plat.</p>';
    }

    /* En-têtes */
    const heads = KEYS.map(k =>
      `<th class="nutr-th${IS_SUB[k] ? ' nutr-sub' : ''}">${LABELS[k]}<span class="nutr-unit">&thinsp;(${UNIT_LABELS[k]})</span></th>`
    ).join('');

    /* Lignes par ingrédient */
    const rows = dish.ingredients.map(item => {
      const ing = Ingredients.getById(item.id);
      if (!ing) return '';
      const n       = calcIngredient(ing, item.qty);
      const hasNutr = !!ing.nutrition;
      const canConv = toGrams(item.qty, ing) !== null;

      const cols = KEYS.map(k => {
        let cell;
        if (!hasNutr)    cell = '<span class="nutr-dash">—</span>';
        else if (!canConv) cell = '<span class="nutr-unknown" title="Équivalent grammes non défini pour cette unité">?</span>';
        else               cell = fmt(n?.[k] ?? null, k);
        return `<td class="nutr-td${IS_SUB[k] ? ' nutr-sub' : ''}">${cell}</td>`;
      }).join('');

      return `<tr>
        <td class="nutr-td-name"><span class="nutr-ing-name">${ing.name}</span><em class="nutr-qty-label">${item.qty}&nbsp;${ing.unit}</em></td>
        ${cols}
      </tr>`;
    }).join('');

    /* Ligne Total */
    const totals    = calcDish(dish);
    const totalCols = KEYS.map(k =>
      `<td class="nutr-td${IS_SUB[k] ? ' nutr-sub' : ''} nutr-total">${fmt(totals[k], k)}</td>`
    ).join('');

    return `
      <div class="nutr-table-wrap">
        <p class="nutr-table-title">Valeurs nutritionnelles</p>
        <div class="nutr-scroll">
          <table class="nutr-table">
            <thead>
              <tr><th class="nutr-th-name">Ingrédient</th>${heads}</tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr><td class="nutr-td-name nutr-total">Total</td>${totalCols}</tr>
            </tfoot>
          </table>
        </div>
      </div>`;
  }

  /* ── API publique ── */
  return { KEYS, LABELS, UNIT_LABELS, IS_SUB, toGrams, calcIngredient, calcDish, fmt, buildTableHTML };
})();
