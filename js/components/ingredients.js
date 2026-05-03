/* ═══════════════════════════════════════════════════════════
   js/components/ingredients.js — CRUD des ingrédients
   ═══════════════════════════════════════════════════════════

   Gère la liste des ingrédients affichée dans le panneau
   "Ingrédients" de la modale catalogue.

   Fonctionnalités :
     - Ajout via formulaire (#form-ingredient)
     - Modification inline (clic sur ✎ → champs éditables dans la carte)
     - Suppression (bloquée si l'ingrédient est utilisé dans un plat)
     - Tri alphabétique (fr-FR) à chaque rendu
     - Synchronisation automatique avec Storage après chaque modification

   Les boutons d'action (✎ / ✕) utilisent des attributs onclick
   avec les fonctions exposées via le préfixe _ de l'API publique.
   ═══════════════════════════════════════════════════════════ */

const Ingredients = (() => {

  const STEP = 0.25; // incrément minimal pour les quantités
  let list      = []; // tableau des ingrédients en mémoire
  let editingId = null; // identifiant de l'ingrédient en cours de modification

  /* ── Accès à l'état ── */
  function load()      { list = Storage.get('ingredients', []); }
  function save()      { Storage.set('ingredients', list); }
  function getAll()    { return list; }
  function getById(id) { return list.find(i => i.id === id) || null; }
  function getStep()   { return STEP; }

  /* ── Construction du HTML des options d'unité ── */

  /** Groupes d'unités affichés dans les <select> de l'application */
  const UNIT_GROUPS = [
    { label: 'Poids',   opts: ['g', 'kg'] },
    { label: 'Volume',  opts: ['ml', 'cl', 'l'] },
    { label: 'Cuisine', opts: ['c. à s.', 'c. à c.', 'pincée'] },
    { label: 'Autre',   opts: ['unité'] },
  ];

  /**
   * Génère le HTML des <optgroup> pour un <select> d'unité.
   * La valeur selected est pré-sélectionnée si elle correspond à l'unité actuelle.
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

  /* ── CRUD ── */

  /**
   * Ajoute un nouvel ingrédient à la liste après validation :
   *   - nom non vide
   *   - pas de doublon (insensible à la casse)
   * Déclenche un rendu et met à jour la liste côté formulaire de plat.
   */
  function add(name, unit) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (list.some(i => i.name.toLowerCase() === trimmed.toLowerCase())) {
      Toast.error('Cet ingrédient existe déjà.');
      return null;
    }
    const ing = { id: Dates.uid(), name: trimmed, unit: unit || 'g' };
    list.push(ing);
    save();
    render();
    if (typeof Dishes !== 'undefined') Dishes.renderAvailableIngredients();
    Toast.success('"' + ing.name + '" ajouté !');
    return ing;
  }

  /**
   * Met à jour le nom et l'unité d'un ingrédient existant.
   * Bloque la mise à jour si le nom est vide.
   */
  function update(id, name, unit) {
    const ing     = list.find(i => i.id === id);
    if (!ing) return;
    const trimmed = name.trim();
    if (!trimmed) { Toast.error('Le nom ne peut pas être vide.'); return; }
    ing.name  = trimmed;
    ing.unit  = unit;
    save();
    editingId = null;
    render();
    if (typeof Dishes !== 'undefined') Dishes.renderAvailableIngredients();
    Toast.success('"' + ing.name + '" mis à jour !');
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

  /* ── Modification inline ── */

  /** Active le mode édition sur la carte de l'ingrédient ciblé */
  function startEdit(id) {
    editingId = id;
    render();
    /* Place le focus sur le champ nom après le rendu */
    const input = document.querySelector(`.ing-card[data-id="${id}"] .ing-edit-name`);
    if (input) { input.focus(); input.select(); }
  }

  /** Annule la modification en cours et retourne à l'affichage normal */
  function cancelEdit() {
    editingId = null;
    render();
  }

  /** Lit les valeurs des champs inline et appelle update() */
  function saveEdit(id) {
    const card = document.querySelector(`.ing-card[data-id="${id}"]`);
    if (!card) return;
    const nameVal = card.querySelector('.ing-edit-name').value;
    const unitVal = card.querySelector('.ing-edit-unit').value;
    update(id, nameVal, unitVal);
  }

  /* ── Rendu ── */

  /**
   * Reconstruit la grille des ingrédients dans #ingredient-list.
   * Chaque carte affiche :
   *   - en mode normal  : nom + overlay actions (✎ / ✕)
   *   - en mode édition : champs input + select + boutons valider/annuler
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
        /* Carte en mode édition */
        if (editingId === ing.id) {
          return `
            <div class="ing-card ing-card-editing" data-id="${ing.id}">
              <input class="input ing-edit-name" type="text" value="${ing.name}" autocomplete="off" spellcheck="false"/>
              <select class="input ing-edit-unit">${unitOptionsHTML(ing.unit)}</select>
              <div class="ing-edit-actions">
                <button class="ing-edit-btn ing-edit-confirm" type="button" onclick="Ingredients._saveEdit('${ing.id}')" title="Valider">✓</button>
                <button class="ing-edit-btn ing-edit-cancel"  type="button" onclick="Ingredients._cancelEdit()" title="Annuler">✕</button>
              </div>
            </div>`;
        }
        /* Carte en mode affichage normal */
        return `
          <div class="ing-card" data-id="${ing.id}">
            <span class="ing-card-name">${ing.name}</span>
            <div class="ing-card-actions">
              <button class="ing-action-btn ing-action-edit"   type="button" onclick="Ingredients._startEdit('${ing.id}')" title="Modifier">✎</button>
              <button class="ing-action-btn ing-action-delete" type="button" onclick="Ingredients.remove('${ing.id}')" title="Supprimer">✕</button>
            </div>
          </div>`;
      }).join('');
  }

  /* ── No-op de compatibilité ── */
  /** Ancienne fonction de peuplement d'un <select> de plat, conservée pour éviter les erreurs */
  function populateDishSelect() {}

  /* ── Initialisation du formulaire ── */

  /** Câble la soumission du formulaire #form-ingredient */
  function initForm() {
    const form = document.getElementById('form-ingredient');
    if (!form) return;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('ing-name').value;
      const unit = document.getElementById('ing-unit').value;
      if (add(name, unit)) form.reset(); // réinitialise si l'ajout a réussi
    });
  }

  /** Charge les données, affiche la liste et active le formulaire */
  function init() { load(); render(); initForm(); }

  /* ── API publique ── */
  return {
    init, load, getAll, getById, getStep, add, remove, render, populateDishSelect,
    /* Exposées pour les onclick inline générés dans render() */
    _startEdit:  id => startEdit(id),
    _saveEdit:   id => saveEdit(id),
    _cancelEdit: ()  => cancelEdit(),
  };
})();
