/* ═══════════════════════════════════════════════════════════
   js/components/ingredients.js — CRUD des ingrédients
   ═══════════════════════════════════════════════════════════

   Gère la liste des ingrédients affichée dans le panneau
   "Ingrédients" de la modale catalogue.

   Fonctionnalités :
     - Ajout et modification via le formulaire supérieur
       (même formulaire pour les deux modes, comme dishes.js)
     - Suppression (bloquée si l'ingrédient est utilisé dans un plat)
     - Champ "équivalent grammes" affiché si l'unité n'est pas g/kg
     - Section repliable "Valeurs nutritionnelles" avec 8 champs + référence
     - Tri alphabétique (fr-FR) à chaque rendu
     - Badge kcal/100 g affiché sur la carte si la valeur est connue
     - Synchronisation automatique avec Storage après chaque modification

   Règle null vs 0 pour la nutrition :
     champ vide → null (valeur inconnue, affiche "—")
     champ à 0  → 0    (valeur nulle volontaire)
   ═══════════════════════════════════════════════════════════ */

const Ingredients = (() => {

  const STEP = 0.05; // incrément minimal pour les quantités de plat
  let list      = []; // tableau des ingrédients en mémoire
  let editingId = null; // identifiant de l'ingrédient en cours de modification

  /* ── Clés nutritionnelles (même ordre que Nutrition.KEYS) ── */
  const NUT_KEYS = ['kcal', 'fat', 'satFat', 'carbs', 'sugars', 'fiber', 'protein', 'salt'];

  /* ── Accès à l'état ── */
  function load()      { list = Storage.get('ingredients', []); }
  function save()      { Storage.set('ingredients', list); }
  function getAll()    { return list; }
  function getById(id) { return list.find(i => i.id === id) || null; }
  function getStep()   { return STEP; }

  /* ── Groupes d'unités pour les <select> ── */
  const UNIT_GROUPS = [
    { label: 'Poids',   opts: ['g', 'kg'] },
    { label: 'Volume',  opts: ['ml', 'cl', 'l'] },
    { label: 'Cuisine', opts: ['c. à s.', 'c. à c.', 'pincée'] },
    { label: 'Autre',   opts: ['unité'] },
  ];

  /**
   * Génère le HTML des <optgroup> pour un <select> d'unité.
   * selected : valeur pré-sélectionnée.
   */
  function unitOptionsHTML(selected) {
    return UNIT_GROUPS.map(g =>
      `<optgroup label="${g.label}">${
        g.opts.map(o =>
          `<option value="${o}"${o === selected ? ' selected' : ''}>${o}</option>`
        ).join('')
      }</optgroup>`
    ).join('');
  }

  /* ══════════════════════════════════════════════════════════
     LECTURE DU FORMULAIRE
     ══════════════════════════════════════════════════════════ */

  /**
   * Retourne la valeur de gramsPerUnit depuis le formulaire.
   * null si l'unité est g ou kg (conversion native), ou si le champ est vide.
   */
  function readGramsPerUnit(unit) {
    if (unit === 'g' || unit === 'kg') return null;
    const val = document.getElementById('ing-gramsPerUnit')?.value;
    return (val !== '' && val !== undefined) ? parseFloat(val) || null : null;
  }

  /**
   * Lit les champs nutritionnels du formulaire.
   * Retourne null si aucun champ n'est renseigné (pas de section nutrition).
   * Retourne l'objet { per, kcal, fat, satFat, … } sinon.
   * Champ vide → null (inconnu). Champ à "0" → 0 (zéro volontaire).
   */
  function readNutritionForm() {
    const anyFilled = NUT_KEYS.some(k => {
      const el = document.getElementById(`ing-nut-${k}`);
      return el && el.value !== '';
    });
    if (!anyFilled) return null;

    const per = parseFloat(document.getElementById('ing-nut-per')?.value) || 100;
    const nutrition = { per };
    NUT_KEYS.forEach(k => {
      const el = document.getElementById(`ing-nut-${k}`);
      nutrition[k] = (el && el.value !== '') ? parseFloat(el.value) : null;
    });
    return nutrition;
  }

  /* ── Affichage / masquage du champ gramsPerUnit ── */

  /**
   * Unités pour lesquelles un équivalent grammes par défaut est connu.
   * Le champ reste visible mais le hint indique la valeur par défaut.
   */
  const DEFAULT_GPU = { ml: 1, cl: 10, l: 1000 };

  /**
   * Met à jour la visibilité du champ "équivalent grammes" selon l'unité choisie.
   * - g / kg : masqué (conversion native)
   * - ml / cl / l : visible avec hint sur la valeur par défaut
   * - autres : visible, requis pour le calcul nutritionnel
   * value : valeur à pré-remplir dans le champ (optionnel)
   */
  function updateGpuRow(unit, value) {
    const row   = document.getElementById('ing-gpu-row');
    const label = document.getElementById('ing-unit-label');
    const input = document.getElementById('ing-gramsPerUnit');
    const hint  = document.getElementById('ing-gpu-hint');
    if (!row) return;

    if (unit === 'g' || unit === 'kg') {
      row.style.display = 'none';
      return;
    }

    row.style.display = 'flex';
    if (label) label.textContent = unit;
    if (input && value !== undefined) input.value = value ?? '';

    /* Hint contextuel */
    if (hint) {
      if (DEFAULT_GPU[unit]) {
        hint.textContent = `(défaut eau : ${DEFAULT_GPU[unit]} g)`;
      } else {
        hint.textContent = 'requis pour le calcul nutritionnel';
      }
    }
  }

  /* ══════════════════════════════════════════════════════════
     CRUD
     ══════════════════════════════════════════════════════════ */

  /**
   * Ajoute un nouvel ingrédient à la liste.
   * Valide : nom non vide + pas de doublon (insensible à la casse).
   * Lit gramsPerUnit et nutrition depuis le formulaire.
   */
  function add(name, unit) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (list.some(i => i.name.toLowerCase() === trimmed.toLowerCase())) {
      Toast.error('Cet ingrédient existe déjà.');
      return null;
    }

    const ing = { id: Dates.uid(), name: trimmed, unit: unit || 'g' };

    const catId = document.getElementById('ing-category')?.value || '';
    if (catId) ing.categoryId = catId;

    const gpu = readGramsPerUnit(unit);
    if (gpu) ing.gramsPerUnit = gpu;

    const nutrition = readNutritionForm();
    if (nutrition) ing.nutrition = nutrition;

    list.push(ing);
    save();
    render();
    if (typeof Dishes !== 'undefined') Dishes.renderAvailableIngredients();
    Toast.success(`"${ing.name}" ajouté !`);
    return ing;
  }

  /**
   * Met à jour les données d'un ingrédient existant.
   * Lit toutes les valeurs depuis le formulaire (nom, unité, gramsPerUnit, nutrition).
   */
  function update(id, name, unit) {
    const ing     = list.find(i => i.id === id);
    if (!ing) return;
    const trimmed = name.trim();
    if (!trimmed) { Toast.error('Le nom ne peut pas être vide.'); return; }

    ing.name = trimmed;
    ing.unit = unit;

    const catId = document.getElementById('ing-category')?.value || '';
    if (catId) ing.categoryId = catId;
    else       delete ing.categoryId;

    const gpu = readGramsPerUnit(unit);
    if (gpu) ing.gramsPerUnit = gpu;
    else     delete ing.gramsPerUnit;

    const nutrition = readNutritionForm();
    if (nutrition) ing.nutrition = nutrition;
    else           delete ing.nutrition;

    save();
    editingId = null;
    render();
    if (typeof Dishes !== 'undefined') Dishes.renderAvailableIngredients();
    Toast.success(`"${ing.name}" mis à jour !`);
  }

  /**
   * Supprime un ingrédient.
   * Bloqué si l'ingrédient est référencé dans au moins un plat.
   */
  function remove(id) {
    const used = Dishes.getAll().some(d => d.ingredients.some(i => i.id === id));
    if (used) {
      Toast.error('Cet ingrédient est utilisé dans un plat.');
      return;
    }
    list      = list.filter(i => i.id !== id);
    save();
    editingId = null;
    render();
    if (typeof Dishes !== 'undefined') Dishes.renderAvailableIngredients();
    Toast.info('Ingrédient supprimé.');
  }

  /* ══════════════════════════════════════════════════════════
     MODE ÉDITION (formulaire supérieur)
     ══════════════════════════════════════════════════════════ */

  /**
   * Passe le formulaire en mode édition pour l'ingrédient ciblé :
   *   - pré-remplit tous les champs (nom, unité, gramsPerUnit, nutrition)
   *   - ouvre la section nutritionnelle si des valeurs sont définies
   *   - met en évidence la carte dans la grille
   *   - fait défiler jusqu'au formulaire
   */
  function startEdit(id) {
    const ing = list.find(i => i.id === id);
    if (!ing) return;
    editingId = id;

    /* Champs de base */
    const nameEl = document.getElementById('ing-name');
    const unitEl = document.getElementById('ing-unit');
    if (nameEl) { nameEl.value = ing.name; nameEl.focus(); nameEl.select(); }
    if (unitEl)   unitEl.value = ing.unit;

    /* Catégorie */
    renderCategorySelect(ing.categoryId || '');

    /* Équivalent grammes */
    updateGpuRow(ing.unit, ing.gramsPerUnit ?? '');

    /* Valeurs nutritionnelles */
    const n = ing.nutrition || {};
    const perEl = document.getElementById('ing-nut-per');
    if (perEl) perEl.value = n.per ?? 100;
    NUT_KEYS.forEach(k => {
      const el = document.getElementById(`ing-nut-${k}`);
      if (el) el.value = (n[k] !== null && n[k] !== undefined) ? n[k] : '';
    });

    /* Ouvre la section nutrition si l'ingrédient a des données */
    const section = document.getElementById('ing-nutrition-section');
    if (section) section.classList.toggle('open', !!ing.nutrition);

    /* Boutons */
    const submitBtn = document.getElementById('btn-ing-submit');
    const cancelBtn = document.getElementById('btn-cancel-ing-edit');
    if (submitBtn) submitBtn.textContent = 'Mettre à jour';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';

    /* Met en évidence la carte */
    render();

    /* Scroll vers le formulaire */
    document.getElementById('ing-form-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Annule le mode édition et réinitialise entièrement le formulaire.
   */
  function cancelEdit() {
    editingId = null;

    const form = document.getElementById('form-ingredient');
    if (form) form.reset();

    /* Réinitialise les champs supplémentaires non couverts par form.reset() */
    renderCategorySelect(''); // remet sur "Sans catégorie"
    updateGpuRow('g'); // masque le champ gramsPerUnit
    document.getElementById('ing-nut-per').value = 100;
    NUT_KEYS.forEach(k => {
      const el = document.getElementById(`ing-nut-${k}`);
      if (el) el.value = '';
    });

    /* Ferme la section nutrition */
    document.getElementById('ing-nutrition-section')?.classList.remove('open');

    /* Boutons */
    const submitBtn = document.getElementById('btn-ing-submit');
    const cancelBtn = document.getElementById('btn-cancel-ing-edit');
    if (submitBtn) submitBtn.textContent = 'Ajouter';
    if (cancelBtn) cancelBtn.style.display = 'none';

    render();
  }

  /* ══════════════════════════════════════════════════════════
     RENDU DE LA GRILLE
     ══════════════════════════════════════════════════════════ */

  /**
   * Reconstruit la grille des ingrédients dans #ingredient-list.
   * Chaque carte affiche :
   *   - nom de l'ingrédient
   *   - badge kcal/100 g si la valeur est connue
   *   - overlay au survol : ✎ (éditer) / ✕ (supprimer)
   *
   * La carte de l'ingrédient en cours d'édition reçoit la classe
   * ing-card-active pour le mettre en évidence.
   */
  function render() {
    const container = document.getElementById('ingredient-list');
    if (!container) return;

    if (!list.length) {
      container.innerHTML = '<p class="panel-empty">Aucun ingrédient. Ajoutez-en un ci-dessus.</p>';
      return;
    }

    container.innerHTML = [...list]
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .map(ing => {
        /* Badge kcal/100g : normalisé sur 100 g, arrondi à l'entier */
        let kcalBadge = '';
        if (ing.nutrition?.kcal != null) {
          const per100 = Math.round(ing.nutrition.kcal / (ing.nutrition.per || 100) * 100);
          kcalBadge = `<span class="ing-card-kcal">${per100} kcal</span>`;
        }

        return `
          <div class="ing-card${editingId === ing.id ? ' ing-card-active' : ''}" data-id="${ing.id}">
            <span class="ing-card-name">${ing.name}</span>
            ${kcalBadge}
            <div class="ing-card-actions">
              <button class="ing-action-btn ing-action-edit"   type="button" onclick="Ingredients._startEdit('${ing.id}')" title="Modifier">✎</button>
              <button class="ing-action-btn ing-action-delete" type="button" onclick="Ingredients.remove('${ing.id}')" title="Supprimer">✕</button>
            </div>
          </div>`;
      }).join('');
  }

  /* ══════════════════════════════════════════════════════════
     SELECT DE CATÉGORIE
     ══════════════════════════════════════════════════════════ */

  /**
   * Reconstruit le <select id="ing-category"> à partir des catégories connues.
   * selectedId : identifiant de la catégorie à pré-sélectionner (optionnel).
   */
  function renderCategorySelect(selectedId) {
    const sel = document.getElementById('ing-category');
    if (!sel) return;
    const cats = (typeof Categories !== 'undefined') ? Categories.getAll() : [];
    const sorted = [...cats].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    sel.innerHTML =
      '<option value="">— Sans catégorie —</option>' +
      sorted.map(c =>
        `<option value="${c.id}"${c.id === selectedId ? ' selected' : ''}>${c.name}</option>`
      ).join('');
  }

  /* ── No-op de compatibilité ── */
  function populateDishSelect() {}

  /* ══════════════════════════════════════════════════════════
     INITIALISATION
     ══════════════════════════════════════════════════════════ */

  /**
   * Câble tous les éléments du formulaire :
   *   - changement d'unité → affiche/masque le champ gramsPerUnit
   *   - toggle de la section nutritionnelle
   *   - bouton Annuler
   *   - soumission du formulaire (create ou update selon editingId)
   */
  function initForm() {
    const form = document.getElementById('form-ingredient');
    if (!form) return;

    /* Changement d'unité → met à jour le champ gramsPerUnit */
    const unitSel = document.getElementById('ing-unit');
    unitSel?.addEventListener('change', () => updateGpuRow(unitSel.value));

    /* Toggle de la section nutritionnelle */
    const toggle  = document.getElementById('ing-nutrition-toggle');
    const section = document.getElementById('ing-nutrition-section');
    toggle?.addEventListener('click', () => section?.classList.toggle('open'));

    /* Bouton Annuler édition */
    document.getElementById('btn-cancel-ing-edit')?.addEventListener('click', cancelEdit);

    /* Soumission */
    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('ing-name').value;
      const unit = document.getElementById('ing-unit').value;
      if (editingId) {
        update(editingId, name, unit);
        cancelEdit();
      } else {
        if (add(name, unit)) cancelEdit();
      }
    });
  }

  /** Charge les données, affiche la liste et active le formulaire */
  function init() { load(); render(); initForm(); renderCategorySelect(); }

  /* ── API publique ── */
  return {
    init, load, getAll, getById, getStep, add, remove, render, populateDishSelect,
    renderCategorySelect,
    /* Exposées pour les onclick inline générés dans render() */
    _startEdit: id => startEdit(id),
  };
})();
