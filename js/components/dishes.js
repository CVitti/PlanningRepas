/* ═══════════════════════════════════════════════════════════
   js/components/dishes.js — CRUD des plats + éditeur d'ingrédients
   ═══════════════════════════════════════════════════════════

   Gère la liste des plats affichée dans le panneau "Plats"
   de la modale catalogue (onglet droit).

   Fonctionnalités :
     - Ajout / modification / suppression de plats
     - Éditeur de recette par glisser-déposer depuis la liste d'ingrédients
     - Contrôle des quantités par ingrédient (±0,25)
     - Options : créneau (midi / soir / les deux), double portion, exclusion aléatoire
     - Badge "–🎲" affiché sur les plats exclus de la génération aléatoire
     - Synchronisation avec Storage, Planning et Sidebar après chaque modification
   ═══════════════════════════════════════════════════════════ */

const Dishes = (() => {

  let list           = []; // liste des plats en mémoire
  let formIngredients = []; // ingrédients en cours d'édition dans le formulaire
  let editingId      = null; // identifiant du plat en cours de modification

  /* ── Accès à l'état ── */
  function load()      { list = Storage.get('dishes', []); }
  function save()      { Storage.set('dishes', list); }
  function getAll()    { return list; }
  function getById(id) { return list.find(d => d.id === id) || null; }

  /* ── CRUD ── */

  /**
   * Met à jour un plat existant avec les nouvelles valeurs.
   * Déclenche un rendu de la sidebar et du planning pour
   * refléter immédiatement les changements.
   */
  function update(id, name, slot, isDouble, ingredients, excludeFromRandom) {
    const dish = list.find(d => d.id === id);
    if (!dish) return;
    dish.name             = name.trim();
    dish.slot             = slot;
    dish.double           = isDouble;
    dish.ingredients      = ingredients;
    dish.excludeFromRandom = !!excludeFromRandom;
    save();
    renderExisting();
    Sidebar.render();
    Planning.render();
    Toast.success(`Plat « ${dish.name} » mis à jour !`);
  }

  /** Ouvre la modale catalogue sur l'onglet "Plats" en mode création */
  function openCreate() {
    cancelEdit();
    Modal.openCatalog('dishes');
  }

  /**
   * Passe en mode édition pour le plat identifié.
   * Pré-remplit le formulaire avec les valeurs actuelles du plat,
   * puis ouvre la modale sur l'onglet "Plats".
   */
  function startEdit(id) {
    const dish = list.find(d => d.id === id);
    if (!dish) return;
    editingId = id;

    document.getElementById('dish-name').value = dish.name;

    const slotInput = document.querySelector(`input[name="dish-slot"][value="${dish.slot}"]`);
    if (slotInput) slotInput.checked = true;

    document.getElementById('dish-double').checked = dish.double;
    document.getElementById('dish-random').checked = !dish.excludeFromRandom;

    /* Copie les ingrédients existants dans le formulaire temporaire */
    formIngredients = dish.ingredients.map(i => ({ ...i }));
    renderFormIngredients();
    renderAvailableIngredients();

    document.getElementById('btn-dish-submit').textContent  = 'Mettre à jour';
    document.getElementById('btn-cancel-edit').style.display = 'inline-flex';
    Modal.openCatalog('dishes');
  }

  /**
   * Annule le mode édition et réinitialise complètement le formulaire.
   * Masque le bouton "Annuler" et remet le bouton de soumission en mode création.
   */
  function cancelEdit() {
    editingId = null;
    const form = document.getElementById('form-dish');
    if (form) form.reset();
    formIngredients = [];
    renderFormIngredients();
    renderAvailableIngredients();
    const submitBtn = document.getElementById('btn-dish-submit');
    if (submitBtn) submitBtn.textContent = 'Enregistrer le plat';
    const cancelBtn = document.getElementById('btn-cancel-edit');
    if (cancelBtn) cancelBtn.style.display = 'none';
  }

  /**
   * Crée un nouveau plat et l'ajoute à la liste.
   * Retourne le plat créé ou null si le nom est vide.
   */
  function add(name, slot, isDouble, ingredients, excludeFromRandom) {
    if (!name.trim()) return null;
    const dish = {
      id:                Dates.uid(),
      name:              name.trim(),
      slot,
      double:            isDouble,
      excludeFromRandom: !!excludeFromRandom,
      ingredients,
    };
    list.push(dish);
    save();
    renderExisting();
    Sidebar.render();
    Toast.success(`Plat « ${dish.name} » créé !`);
    return dish;
  }

  /**
   * Supprime un plat et nettoie toutes ses occurrences dans le planning.
   * Déclenche un rendu complet (sidebar + planning).
   */
  function remove(id) {
    /* Retire le plat de tous les créneaux du planning */
    const planning = Storage.get('planning', {});
    Object.keys(planning).forEach(dateKey => {
      ['midi', 'soir'].forEach(slot => {
        if (planning[dateKey][slot] === id) delete planning[dateKey][slot];
      });
    });
    Storage.set('planning', planning);

    list = list.filter(d => d.id !== id);
    save();
    renderExisting();
    Sidebar.render();
    Planning.render();
    Toast.info('Plat supprimé.');
  }

  /* ── Helpers de créneau ── */

  /** Retourne le libellé lisible d'un créneau : "Midi & Soir", "Midi" ou "Soir" */
  function slotLabel(slot) {
    return slot === 'both' ? 'Midi & Soir' : slot === 'midi' ? 'Midi' : 'Soir';
  }

  /** Retourne la classe CSS associée à un créneau pour les pills colorées */
  function slotClass(slot) {
    return slot === 'both' ? 'both' : slot;
  }

  /* ── Panneau "Ingrédients disponibles" (colonne gauche du formulaire) ── */

  /**
   * Affiche la liste triée des ingrédients existants.
   * Les ingrédients déjà présents dans la recette sont marqués "used"
   * et rendus non-draggables pour éviter les doublons.
   */
  function renderAvailableIngredients() {
    const container = document.getElementById('available-ingredients');
    if (!container) return;

    const all = Ingredients.getAll()
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    if (!all.length) {
      container.innerHTML = '<p class="panel-empty">Créez d\'abord des ingrédients dans l\'onglet correspondant.</p>';
      return;
    }

    const usedIds = new Set(formIngredients.map(i => i.id));
    container.innerHTML = all.map(ing => {
      const used = usedIds.has(ing.id);
      return `<div class="available-ing-item${used ? ' used' : ''}"
                   draggable="${used ? 'false' : 'true'}"
                   data-id="${ing.id}"
                   ondragstart="Dishes._onDragStart(event,'${ing.id}')">
        <span class="available-ing-name">${ing.name}</span>
        <span class="available-ing-unit">${ing.unit}</span>
      </div>`;
    }).join('');
  }

  /* ── Glisser-déposer depuis la liste d'ingrédients ── */

  /** Stocke l'identifiant de l'ingrédient dans dataTransfer au début du drag */
  function onDragStart(e, ingId) {
    e.dataTransfer.setData('ing-id', ingId);
    e.dataTransfer.effectAllowed = 'copy';
  }

  /* ── Zone de dépôt de la recette (colonne droite du formulaire) ── */

  /**
   * Initialise la zone de drop #dish-ingredients.
   * À chaque dépôt, l'ingrédient est ajouté avec une quantité par défaut de 1
   * et les deux colonnes sont rafraîchies.
   */
  function initDropZone() {
    const zone = document.getElementById('dish-ingredients');
    if (!zone) return;

    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', e => {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const ingId = e.dataTransfer.getData('ing-id');
      if (!ingId) return;
      if (!Ingredients.getById(ingId)) return;
      if (formIngredients.find(i => i.id === ingId)) return; // déjà présent
      formIngredients.push({ id: ingId, qty: 1 });
      renderFormIngredients();
      renderAvailableIngredients();
    });
  }

  /* ── Lignes d'ingrédients de la recette ── */

  /** Retire un ingrédient de la recette en cours d'édition */
  function removeIngFromForm(ingId) {
    formIngredients = formIngredients.filter(i => i.id !== ingId);
    renderFormIngredients();
    renderAvailableIngredients();
  }

  /**
   * Modifie la quantité d'un ingrédient par delta (±STEP).
   * Lit d'abord la valeur affichée dans l'input pour ne pas écraser
   * une modification manuelle non encore enregistrée.
   */
  function changeQty(ingId, delta) {
    const item  = formIngredients.find(i => i.id === ingId);
    if (!item) return;
    /* Récupère la valeur saisie manuellement avant d'appliquer le delta */
    const input = document.querySelector(`.qty-value[data-id="${ingId}"]`);
    if (input) item.qty = parseFloat(input.value) || item.qty;
    const step  = Ingredients.getStep();
    item.qty    = Math.max(step, parseFloat((item.qty + delta).toFixed(2)));
    renderFormIngredients();
  }

  /** Met à jour la quantité d'un ingrédient depuis la saisie manuelle */
  function setQty(ingId, val) {
    const item = formIngredients.find(i => i.id === ingId);
    if (item) item.qty = parseFloat(val) || item.qty;
  }

  /**
   * Reconstruit la liste des ingrédients de la recette en cours de composition.
   * Chaque ligne affiche : nom | contrôle ±qty | unité | bouton ✕.
   */
  function renderFormIngredients() {
    const container = document.getElementById('dish-ingredients');
    if (!container) return;

    if (!formIngredients.length) {
      container.innerHTML = '<p class="drop-hint-text">Glissez des ingrédients ici…</p>';
      return;
    }

    container.innerHTML = formIngredients.map(item => {
      const ing = Ingredients.getById(item.id);
      if (!ing) return '';
      return `
        <div class="dish-ing-row">
          <span class="dish-ing-name">${ing.name}</span>
          <div class="qty-control">
            <button class="qty-btn" type="button" onclick="Dishes._qtyDown('${ing.id}')">−</button>
            <input type="number" class="qty-value" data-id="${ing.id}" value="${item.qty}" min="0.25" step="0.25" oninput="Dishes._setQty('${ing.id}',this.value)">
            <button class="qty-btn" type="button" onclick="Dishes._qtyUp('${ing.id}')">+</button>
          </div>
          <span class="qty-unit-ext">${ing.unit}</span>
          <button class="btn btn-danger btn-sm" type="button" onclick="Dishes._removeIngFromForm('${ing.id}')">✕</button>
        </div>`;
    }).join('');
  }

  /* ── Liste des plats existants (dans la modale, si présente) ── */

  /**
   * Affiche la liste des plats existants dans #existing-dishes (si l'élément existe).
   * Chaque ligne montre le nom, les badges (×2, –🎲), le créneau et les boutons Modifier/Supprimer.
   */
  function renderExisting() {
    const container = document.getElementById('existing-dishes');
    if (!container) return;

    if (!list.length) {
      container.innerHTML = '<p style="color:var(--ink-faint);font-size:.85rem;">Aucun plat créé.</p>';
      return;
    }

    container.innerHTML = [...list]
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .map(d => `
        <div class="existing-dish-row">
          <span class="existing-dish-name">${d.name}</span>
          <div class="existing-dish-meta">
            ${d.double ? '<span class="badge badge-double">×2</span>' : ''}
            ${d.excludeFromRandom ? '<span class="badge badge-excluded" title="Exclu de la génération aléatoire">–🎲</span>' : ''}
            <span class="slot-pill ${slotClass(d.slot)}">${slotLabel(d.slot)}</span>
            <button class="btn btn-ghost btn-sm" onclick="Dishes._startEdit('${d.id}')">Modifier</button>
            <button class="btn btn-danger btn-sm" onclick="Dishes.remove('${d.id}')">Supprimer</button>
          </div>
        </div>`
      ).join('');
  }

  /* ── Initialisation du formulaire ── */

  /**
   * Câble le formulaire #form-dish :
   *   - bouton "Annuler" → cancelEdit()
   *   - zone de dépôt d'ingrédients → initDropZone()
   *   - soumission → création ou mise à jour selon editingId
   */
  function initForm() {
    const form = document.getElementById('form-dish');
    if (!form) return;

    document.getElementById('btn-cancel-edit').addEventListener('click', cancelEdit);
    initDropZone();

    form.addEventListener('submit', e => {
      e.preventDefault();
      const name             = document.getElementById('dish-name').value;
      const slot             = document.querySelector('input[name="dish-slot"]:checked')?.value || 'both';
      const isDouble         = document.getElementById('dish-double').checked;
      const excludeFromRandom = !document.getElementById('dish-random').checked;

      if (!name.trim()) { Toast.error('Donnez un nom au plat.'); return; }

      if (editingId) {
        update(editingId, name, slot, isDouble, [...formIngredients], excludeFromRandom);
        cancelEdit();
      } else {
        add(name, slot, isDouble, [...formIngredients], excludeFromRandom);
        cancelEdit();
      }
      Modal.close('modal-catalog');
    });
  }

  /** Charge les données, affiche la liste et initialise le formulaire */
  function init() {
    load();
    renderExisting();
    initForm();
  }

  /* ── API publique ── */
  return {
    init, load, getAll, getById, add, remove, slotLabel, slotClass,
    openCreate, renderAvailableIngredients,
    /* Exposées pour les onclick inline générés dans les templates HTML */
    _qtyUp:             id      => changeQty(id,  Ingredients.getStep()),
    _qtyDown:           id      => changeQty(id, -Ingredients.getStep()),
    _setQty:            (id, v) => setQty(id, v),
    _removeIngFromForm: id      => removeIngFromForm(id),
    _startEdit:         id      => startEdit(id),
    _onDragStart:       (e, id) => onDragStart(e, id),
  };
})();
