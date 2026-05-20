/* ═══════════════════════════════════════════════════════════
   js/components/categories.js — CRUD des catégories d'ingrédients
   ═══════════════════════════════════════════════════════════

   Gère la liste des catégories affichée dans le panneau
   "Catégories" de la modale catalogue (troisième onglet).

   Fonctionnalités :
     - Ajout et modification via le formulaire supérieur
       (même formulaire pour les deux modes, comme ingredients.js)
     - Suppression (bloquée si la catégorie est utilisée par un ingrédient)
     - Tri alphabétique (fr-FR) à chaque rendu
     - Met à jour le <select> de catégorie du formulaire d'ingrédient
       après chaque modification

   Stockage : clé 'categories' dans Storage → tableau d'objets { id, name }
   ═══════════════════════════════════════════════════════════ */

const Categories = (() => {

  let list      = []; // tableau des catégories en mémoire
  let editingId = null; // identifiant de la catégorie en cours de modification

  /* ── Accès à l'état ── */
  function load()      { list = Storage.get('categories', []); }
  function save()      { Storage.set('categories', list); }
  function getAll()    { return list; }
  function getById(id) { return list.find(c => c.id === id) || null; }

  /* ══════════════════════════════════════════════════════════
     CRUD
     ══════════════════════════════════════════════════════════ */

  /**
   * Ajoute une nouvelle catégorie.
   * Valide : nom non vide + pas de doublon (insensible à la casse).
   */
  function add(name) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (list.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      Toast.error('Cette catégorie existe déjà.');
      return null;
    }
    const cat = { id: Dates.uid(), name: trimmed };
    list.push(cat);
    save();
    render();
    if (typeof Ingredients !== 'undefined') Ingredients.renderCategorySelect();
    Toast.success(`Catégorie "${cat.name}" créée !`);
    return cat;
  }

  /**
   * Met à jour le nom d'une catégorie existante.
   * Rafraîchit le select de catégorie dans le formulaire d'ingrédient.
   */
  function update(id, name) {
    const cat     = list.find(c => c.id === id);
    if (!cat) return;
    const trimmed = name.trim();
    if (!trimmed) { Toast.error('Le nom ne peut pas être vide.'); return; }
    cat.name  = trimmed;
    save();
    editingId = null;
    render();
    if (typeof Ingredients !== 'undefined') Ingredients.renderCategorySelect();
    Toast.success(`Catégorie "${cat.name}" mise à jour !`);
  }

  /**
   * Supprime une catégorie.
   * Bloqué si au moins un ingrédient lui est associé.
   */
  function remove(id) {
    const used = typeof Ingredients !== 'undefined' &&
      Ingredients.getAll().some(i => i.categoryId === id);
    if (used) {
      Toast.error('Cette catégorie est utilisée par des ingrédients.');
      return;
    }
    list      = list.filter(c => c.id !== id);
    save();
    editingId = null;
    render();
    if (typeof Ingredients !== 'undefined') Ingredients.renderCategorySelect();
    Toast.info('Catégorie supprimée.');
  }

  /* ══════════════════════════════════════════════════════════
     MODE ÉDITION (formulaire supérieur)
     ══════════════════════════════════════════════════════════ */

  /**
   * Passe le formulaire en mode édition pour la catégorie ciblée.
   * Pré-remplit le champ nom et met en évidence la ligne dans la liste.
   */
  function startEdit(id) {
    const cat = list.find(c => c.id === id);
    if (!cat) return;
    editingId = id;

    const nameEl = document.getElementById('cat-name');
    if (nameEl) { nameEl.value = cat.name; nameEl.focus(); nameEl.select(); }

    const submitBtn = document.getElementById('btn-cat-submit');
    const cancelBtn = document.getElementById('btn-cancel-cat-edit');
    if (submitBtn) submitBtn.textContent = 'Mettre à jour';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';

    render();
  }

  /** Annule le mode édition et réinitialise le formulaire */
  function cancelEdit() {
    editingId = null;
    const form = document.getElementById('form-category');
    if (form) form.reset();
    const submitBtn = document.getElementById('btn-cat-submit');
    const cancelBtn = document.getElementById('btn-cancel-cat-edit');
    if (submitBtn) submitBtn.textContent = 'Ajouter';
    if (cancelBtn) cancelBtn.style.display = 'none';
    render();
  }

  /* ══════════════════════════════════════════════════════════
     RENDU DE LA LISTE
     ══════════════════════════════════════════════════════════ */

  /**
   * Reconstruit la liste des catégories dans #category-list.
   * Chaque ligne affiche : nom + boutons Modifier / Supprimer.
   * La ligne en cours d'édition reçoit la classe cat-row-active.
   */
  function render() {
    const container = document.getElementById('category-list');
    if (!container) return;

    if (!list.length) {
      container.innerHTML = '<p class="panel-empty">Aucune catégorie. Ajoutez-en une ci-dessus.</p>';
      return;
    }

    container.innerHTML = [...list]
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .map(cat => `
        <div class="cat-row${editingId === cat.id ? ' cat-row-active' : ''}" data-id="${cat.id}">
          <span class="cat-row-name">${cat.name}</span>
          <div class="cat-row-actions">
            <button class="btn btn-ghost btn-sm" type="button" onclick="Categories._startEdit('${cat.id}')">✎ Modifier</button>
            <button class="btn btn-danger btn-sm" type="button" onclick="Categories.remove('${cat.id}')">✕</button>
          </div>
        </div>`)
      .join('');
  }

  /* ══════════════════════════════════════════════════════════
     INITIALISATION
     ══════════════════════════════════════════════════════════ */

  /** Câble le formulaire #form-category (soumission + bouton Annuler) */
  function initForm() {
    const form = document.getElementById('form-category');
    if (!form) return;

    document.getElementById('btn-cancel-cat-edit')?.addEventListener('click', cancelEdit);

    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('cat-name').value;
      if (editingId) {
        update(editingId, name);
        cancelEdit();
      } else {
        if (add(name)) cancelEdit();
      }
    });
  }

  /** Charge les données, affiche la liste et active le formulaire */
  function init() { load(); render(); initForm(); }

  /* ── API publique ── */
  return {
    init, load, getAll, getById, remove, render,
    /* Exposée pour les onclick inline générés dans render() */
    _startEdit: id => startEdit(id),
  };
})();
