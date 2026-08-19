/* ═══════════════════════════════════════════════════════════
   js/components/units.js — CRUD des unités de mesure
   ═══════════════════════════════════════════════════════════

   Gère la liste des unités affichée dans le panneau "Unités"
   de la page catalogue (quatrième onglet), regroupées par type
   (Poids, Volume, Cuisine, Autre) comme l'était l'ancienne liste
   figée en dur dans le <select> d'ingrédient.

   Contrairement aux catégories (référencées par id), les ingrédients
   et les items de la liste de courses stockent l'unité comme une
   simple chaîne (ing.unit = 'g'). Renommer une unité met donc à jour
   par cascade toutes les références existantes pour ne rien casser.

   Stockage : clé 'units' dans Storage → tableau d'objets { id, name, type }
   Amorçage : si la clé est absente (première utilisation après cette
   fonctionnalité), la liste par défaut reprend exactement les valeurs
   auparavant figées en dur, pour ne rien changer aux données existantes.
   ═══════════════════════════════════════════════════════════ */

const Units = (() => {

  let list      = []; // tableau des unités en mémoire
  let editingId = null; // identifiant de l'unité en cours de modification

  /* ── Types et libellés ── */
  const TYPE_ORDER  = ['poids', 'volume', 'cuisine', 'autre'];
  const TYPE_LABELS = { poids: 'Poids', volume: 'Volume', cuisine: 'Cuisine', autre: 'Autre' };

  /* ── Liste par défaut (reprend l'ancien <select> figé en dur) ── */
  const DEFAULT_UNITS = [
    { name: 'g',        type: 'poids'   },
    { name: 'kg',       type: 'poids'   },
    { name: 'ml',       type: 'volume'  },
    { name: 'cl',       type: 'volume'  },
    { name: 'l',        type: 'volume'  },
    { name: 'c. à s.',  type: 'cuisine' },
    { name: 'c. à c.',  type: 'cuisine' },
    { name: 'pincée',   type: 'cuisine' },
    { name: 'unité',    type: 'autre'   },
  ];

  /* ── Accès à l'état ── */

  /** Charge la liste ; amorce les valeurs par défaut au tout premier chargement */
  function load() {
    const raw = Storage.get('units', null);
    if (raw === null) {
      list = DEFAULT_UNITS.map(u => ({ id: Dates.uid(), ...u }));
      save();
    } else {
      list = raw;
    }
  }

  function save()      { Storage.set('units', list); }
  function getAll()    { return list; }
  function getById(id) { return list.find(u => u.id === id) || null; }

  /* ══════════════════════════════════════════════════════════
     CRUD
     ══════════════════════════════════════════════════════════ */

  /**
   * Ajoute une nouvelle unité.
   * Valide : nom non vide + pas de doublon (insensible à la casse) + type connu.
   */
  function add(name, type) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (!TYPE_ORDER.includes(type)) type = 'autre';
    if (list.some(u => u.name.toLowerCase() === trimmed.toLowerCase())) {
      Toast.error('Cette unité existe déjà.');
      return null;
    }
    const unit = { id: Dates.uid(), name: trimmed, type };
    list.push(unit);
    save();
    render();
    refreshDependentSelects();
    Toast.success(`Unité "${unit.name}" créée !`);
    return unit;
  }

  /**
   * Met à jour le nom et/ou le type d'une unité existante.
   * Si le nom change, met à jour par cascade toutes les références
   * existantes (ingrédients + items de la liste de courses) puisque
   * ces derniers stockent l'unité comme une simple chaîne.
   */
  function update(id, name, type) {
    const unit = list.find(u => u.id === id);
    if (!unit) return;
    const trimmed = name.trim();
    if (!trimmed) { Toast.error('Le nom ne peut pas être vide.'); return; }
    if (list.some(u => u.id !== id && u.name.toLowerCase() === trimmed.toLowerCase())) {
      Toast.error('Cette unité existe déjà.');
      return;
    }

    const oldName = unit.name;
    unit.name = trimmed;
    unit.type = TYPE_ORDER.includes(type) ? type : 'autre';

    if (oldName !== trimmed) cascadeRename(oldName, trimmed);

    save();
    editingId = null;
    render();
    refreshDependentSelects();
    Toast.success(`Unité "${unit.name}" mise à jour !`);
  }

  /** Met à jour toutes les références existantes à une unité renommée */
  function cascadeRename(oldName, newName) {
    if (typeof Ingredients !== 'undefined') {
      let changed = false;
      Ingredients.getAll().forEach(ing => {
        if (ing.unit === oldName) { ing.unit = newName; changed = true; }
      });
      if (changed) Ingredients.save();
    }
    if (typeof Shopping !== 'undefined') Shopping.renameUnitReferences(oldName, newName);
  }

  /**
   * Supprime une unité.
   * Bloqué si au moins un ingrédient ou un item de la liste de courses
   * l'utilise encore (comparaison par nom, comme pour les références).
   */
  function remove(id) {
    const unit = list.find(u => u.id === id);
    if (!unit) return;

    const usedByIngredient = typeof Ingredients !== 'undefined' &&
      Ingredients.getAll().some(i => i.unit === unit.name);
    const usedByShopping = typeof Shopping !== 'undefined' &&
      Shopping.isUnitUsed(unit.name);

    if (usedByIngredient || usedByShopping) {
      Toast.error('Cette unité est utilisée par des ingrédients ou la liste de courses.');
      return;
    }

    list      = list.filter(u => u.id !== id);
    save();
    editingId = null;
    render();
    refreshDependentSelects();
    Toast.info('Unité supprimée.');
  }

  /** Rafraîchit les <select> d'unité des autres composants après une modification */
  function refreshDependentSelects() {
    if (typeof Ingredients !== 'undefined') Ingredients.renderUnitSelect();
    if (typeof Shopping !== 'undefined') Shopping.refreshUnitSelects();
  }

  /* ══════════════════════════════════════════════════════════
     OPTIONS POUR <select> (ingrédients, liste de courses)
     ══════════════════════════════════════════════════════════ */

  /**
   * Génère le HTML des <optgroup> groupées par type (ordre TYPE_ORDER,
   * tri alphabétique fr-FR à l'intérieur de chaque groupe).
   * selected : valeur (nom) pré-sélectionnée.
   */
  function optionsHTML(selected) {
    return TYPE_ORDER.map(type => {
      const opts = list
        .filter(u => u.type === type)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      if (!opts.length) return '';
      return '<optgroup label="' + TYPE_LABELS[type] + '">' +
        opts.map(u =>
          '<option value="' + u.name + '"' + (u.name === selected ? ' selected' : '') + '>' + u.name + '</option>'
        ).join('') +
        '</optgroup>';
    }).join('');
  }

  /* ══════════════════════════════════════════════════════════
     MODE ÉDITION (formulaire supérieur)
     ══════════════════════════════════════════════════════════ */

  /** Passe le formulaire en mode édition pour l'unité ciblée */
  function startEdit(id) {
    const unit = list.find(u => u.id === id);
    if (!unit) return;
    editingId = id;

    const nameEl = document.getElementById('unit-name');
    const typeEl = document.getElementById('unit-type');
    if (nameEl) { nameEl.value = unit.name; nameEl.focus(); nameEl.select(); }
    if (typeEl) typeEl.value = unit.type;

    const submitBtn = document.getElementById('btn-unit-submit');
    const cancelBtn = document.getElementById('btn-cancel-unit-edit');
    if (submitBtn) submitBtn.textContent = 'Mettre à jour';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';

    render();
  }

  /** Annule le mode édition et réinitialise le formulaire */
  function cancelEdit() {
    editingId = null;
    const form = document.getElementById('form-unit');
    if (form) form.reset();
    const submitBtn = document.getElementById('btn-unit-submit');
    const cancelBtn = document.getElementById('btn-cancel-unit-edit');
    if (submitBtn) submitBtn.textContent = 'Ajouter';
    if (cancelBtn) cancelBtn.style.display = 'none';
    render();
  }

  /* ══════════════════════════════════════════════════════════
     RENDU DE LA LISTE (groupée par type)
     ══════════════════════════════════════════════════════════ */

  /**
   * Reconstruit la liste des unités dans #unit-list, groupée par type.
   * Chaque ligne affiche : nom + boutons Modifier / Supprimer.
   */
  function render() {
    const container = document.getElementById('unit-list');
    if (!container) return;

    if (!list.length) {
      container.innerHTML = '<p class="panel-empty">Aucune unité. Ajoutez-en une ci-dessus.</p>';
      return;
    }

    container.innerHTML = TYPE_ORDER.map(type => {
      const units = list
        .filter(u => u.type === type)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      if (!units.length) return '';

      const rows = units.map(unit => `
        <div class="cat-row${editingId === unit.id ? ' cat-row-active' : ''}" data-id="${unit.id}">
          <span class="cat-row-name">${unit.name}</span>
          <div class="cat-row-actions">
            <button class="btn btn-ghost btn-sm" type="button" onclick="Units._startEdit('${unit.id}')">✎ Modifier</button>
            <button class="btn btn-danger btn-sm" type="button" onclick="Units.remove('${unit.id}')">✕</button>
          </div>
        </div>`).join('');

      return '<div class="unit-group">' +
        '<div class="unit-group-header">' + TYPE_LABELS[type] + '</div>' +
        '<div class="unit-group-rows">' + rows + '</div>' +
        '</div>';
    }).join('');
  }

  /* ══════════════════════════════════════════════════════════
     INITIALISATION
     ══════════════════════════════════════════════════════════ */

  /** Câble le formulaire #form-unit (soumission + bouton Annuler) */
  function initForm() {
    const form = document.getElementById('form-unit');
    if (!form) return;

    document.getElementById('btn-cancel-unit-edit')?.addEventListener('click', cancelEdit);

    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('unit-name').value;
      const type = document.getElementById('unit-type').value;
      if (editingId) {
        update(editingId, name, type);
        cancelEdit();
      } else {
        if (add(name, type)) cancelEdit();
      }
    });
  }

  /** Charge les données, affiche la liste et active le formulaire */
  function init() { load(); render(); initForm(); }

  /* ── API publique ── */
  return {
    init, load, getAll, getById, remove, render, optionsHTML,
    TYPE_ORDER, TYPE_LABELS,
    /* Exposée pour les onclick inline générés dans render() */
    _startEdit: id => startEdit(id),
  };
})();
