/**
 * modals.js — Gestion de toutes les modales de l'application.
 *
 * Expose un objet global `Modals` avec les méthodes d'ouverture,
 * de fermeture et de sauvegarde pour chaque modale.
 *
 * Modales gérées :
 * - modal-slot-picker       : sélection d'un plat pour un créneau
 * - modal-ingredient-manager: liste CRUD des ingrédients
 * - modal-ingredient-form   : création / édition d'un ingrédient
 * - modal-dish-form         : création / édition d'un plat
 * - modal-shopping-list     : liste de courses d'un planning
 * - modal-confirm           : confirmation générique (remplace window.confirm)
 *
 * Dépend de : state.js, sidebar.js, planning.js
 */

// ─── Fermeture par touche Échap ───────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay--open').forEach(o => {
      o.classList.remove('modal-overlay--open');
    });
  }
});

const Modals = {

  // ─── Helpers génériques ───────────────────────────────────────

  /** Ouvre la modale identifiée par son id */
  open(modalId) {
    document.getElementById(modalId).classList.add('modal-overlay--open');
  },

  /** Ferme la modale identifiée par son id */
  close(modalId) {
    document.getElementById(modalId).classList.remove('modal-overlay--open');
  },

  /**
   * Affiche une modale de confirmation personnalisée.
   * @param {string} message — texte à afficher
   * @param {Function} onConfirm — callback appelé si l'utilisateur confirme
   */
  askConfirm(message, onConfirm) {
    document.getElementById('js-confirm-message').textContent = message;
    document.getElementById('js-confirm-ok-btn').onclick = () => {
      this.close('modal-confirm');
      onConfirm();
    };
    this.open('modal-confirm');
  },

  // ─── Sélecteur de plat pour un créneau ───────────────────────

  /** Contexte courant du sélecteur de plat */
  _slotPickerContext: null,

  /**
   * Ouvre la modale de sélection d'un plat pour un créneau donné.
   * Filtre les plats selon la restriction de créneau (midi/soir/les deux).
   */
  openSlotPicker(planningIndex, slotKey, slotType) {
    this._slotPickerContext = { planningIndex, slotKey, slotType };
    const container = document.getElementById('js-slot-options');
    container.innerHTML = '';

    // Plats compatibles avec ce type de créneau, triés alphabétiquement
    const eligible = sortByName(
      AppState.dishes.filter(d => d.restriction === 'both' || d.restriction === slotType)
    );

    if (!eligible.length) {
      container.innerHTML = '<div class="empty-state">Aucun plat compatible pour ce créneau.</div>';
    } else {
      eligible.forEach(dish => {
        container.appendChild(this._buildSlotOptionBtn(dish));
      });
    }
    this.open('modal-slot-picker');
  },

  /**
   * Construit le bouton d'option pour un plat dans le sélecteur de créneau.
   */
  _buildSlotOptionBtn(dish) {
    const btn = document.createElement('button');
    btn.className = 'slot-picker__option-btn';

    const name = document.createElement('span');
    name.className   = 'slot-picker__option-name';
    name.textContent = dish.name;

    const tags = document.createElement('div');
    tags.className = 'slot-picker__option-tags';
    if (dish.restriction !== 'both') {
      const t = document.createElement('span');
      t.className   = `tag tag--${dish.restriction}`;
      t.textContent = dish.restriction === 'midi' ? '☀ Midi' : '🌙 Soir';
      tags.appendChild(t);
    }
    if (dish.double) {
      const t = document.createElement('span'); t.className = 'tag tag--double'; t.textContent = '×2'; tags.appendChild(t);
    }

    btn.appendChild(name); btn.appendChild(tags);
    btn.onclick = () => {
      const { planningIndex, slotKey } = this._slotPickerContext;
      AppState.getSlotsForPlanning(planningIndex)[slotKey] = dish.id;
      AppState.save();
      Planning.renderAll();
      this.close('modal-slot-picker');
    };
    return btn;
  },

  // ─── Gestionnaire d'ingrédients ───────────────────────────────

  /**
   * Ouvre la modale de gestion des ingrédients (liste + CRUD).
   */
  openIngredientManager() {
    Sidebar.renderIngredientList();
    this.open('modal-ingredient-manager');
  },

  // ─── Formulaire d'ingrédient (création / édition) ─────────────

  /** Id de l'ingrédient en cours d'édition (null = création) */
  _ingredientEditId: null,

  /**
   * Ouvre le formulaire d'ingrédient.
   * Si `ingredientId` est fourni, pré-remplit le formulaire pour l'édition.
   */
  openIngredientForm(ingredientId = null) {
    this._ingredientEditId = ingredientId;
    const ingredient = ingredientId ? AppState.getIngredient(ingredientId) : null;

    document.getElementById('js-ingredient-form-title').textContent =
      ingredient ? 'Modifier l\'ingrédient' : 'Nouvel ingrédient';
    document.getElementById('js-ingredient-name').value = ingredient ? ingredient.name : '';
    document.getElementById('js-ingredient-unit').value = ingredient ? (ingredient.unit || '') : '';

    this.open('modal-ingredient-form');
    setTimeout(() => document.getElementById('js-ingredient-name').focus(), 80);
  },

  /**
   * Sauvegarde l'ingrédient (création ou édition) depuis le formulaire.
   */
  saveIngredient() {
    const name = document.getElementById('js-ingredient-name').value.trim();
    if (!name) { document.getElementById('js-ingredient-name').focus(); return; }
    const unit = document.getElementById('js-ingredient-unit').value.trim();

    if (this._ingredientEditId) {
      // Édition : mise à jour de l'ingrédient existant
      const ingredient = AppState.getIngredient(this._ingredientEditId);
      if (ingredient) { ingredient.name = name; ingredient.unit = unit; }
    } else {
      // Création : ajout d'un nouvel ingrédient
      AppState.ingredients.push({ id: Date.now(), name, unit });
    }

    AppState.save();
    Sidebar.renderIngredientList();
    this.close('modal-ingredient-form');

    // Si le formulaire de plat est ouvert, rafraîchir son picker d'ingrédients
    if (document.getElementById('modal-dish-form').classList.contains('modal-overlay--open')) {
      this._renderIngredientPicker();
    }
  },

  // ─── Formulaire de plat (création / édition) ──────────────────

  /** Id du plat en cours d'édition (null = création) */
  _dishEditId: null,

  /** Ingrédients sélectionnés dans le formulaire en cours (copie de travail) */
  _dishIngredientDraft: [],

  /** Terme de recherche actuel dans le picker d'ingrédients */
  _ingredientPickerQuery: '',

  /**
   * Ouvre le formulaire de plat.
   * Si `dishId` est fourni, pré-remplit le formulaire pour l'édition.
   */
  openDishForm(dishId = null) {
    this._dishEditId = dishId;
    const dish = dishId ? AppState.getDish(dishId) : null;

    document.getElementById('js-dish-form-title').textContent =
      dish ? 'Modifier le plat' : 'Ajouter un plat';
    document.getElementById('js-dish-name').value           = dish ? dish.name        : '';
    document.getElementById('js-dish-restriction').value    = dish ? dish.restriction : 'both';
    document.getElementById('js-dish-double').checked       = dish ? dish.double      : false;

    // Copie de travail des ingrédients du plat
    this._dishIngredientDraft  = dish ? JSON.parse(JSON.stringify(dish.ingredients || [])) : [];
    this._ingredientPickerQuery = '';
    document.getElementById('js-ingredient-picker-search').value = '';

    this._renderDishIngredientEditor();
    this._renderIngredientPicker();
    this.open('modal-dish-form');
    setTimeout(() => document.getElementById('js-dish-name').focus(), 80);
  },

  /**
   * Sauvegarde le plat (création ou édition) depuis le formulaire.
   */
  saveDish() {
    const name = document.getElementById('js-dish-name').value.trim();
    if (!name) { document.getElementById('js-dish-name').focus(); return; }

    const restriction = document.getElementById('js-dish-restriction').value;
    const double      = document.getElementById('js-dish-double').checked;
    const ingredients = JSON.parse(JSON.stringify(this._dishIngredientDraft));

    if (this._dishEditId) {
      // Édition : mise à jour du plat existant
      const dish = AppState.getDish(this._dishEditId);
      if (dish) { dish.name = name; dish.restriction = restriction; dish.double = double; dish.ingredients = ingredients; }
    } else {
      // Création : ajout d'un nouveau plat
      AppState.dishes.push({ id: Date.now(), name, restriction, double, ingredients });
    }

    AppState.save();
    Sidebar.renderDishList();
    Planning.renderAll();
    this.close('modal-dish-form');
  },

  // ─── Éditeur d'ingrédients dans le formulaire de plat ─────────

  /**
   * Restitue la liste des ingrédients déjà ajoutés au plat (copie de travail).
   */
  _renderDishIngredientEditor() {
    const container = document.getElementById('js-dish-ingredient-selected');
    container.innerHTML = '';

    if (!this._dishIngredientDraft.length) {
      container.innerHTML = '<div class="empty-state">Aucun ingrédient ajouté</div>';
      return;
    }

    this._dishIngredientDraft.forEach((entry, index) => {
      const ingredient = AppState.getIngredient(entry.ingId);
      if (!ingredient) return;

      const row = document.createElement('div');
      row.className = 'dish-ingredient-row';

      // Nom de l'ingrédient
      const name = document.createElement('span');
      name.className   = 'dish-ingredient-row__name';
      name.textContent = ingredient.name;

      // Champ de quantité (pas de 0.5)
      const qtyInput = document.createElement('input');
      qtyInput.type      = 'number';
      qtyInput.min       = '0';
      qtyInput.step      = '0.5';
      qtyInput.value     = entry.qty != null ? entry.qty : '';
      qtyInput.className = 'dish-ingredient-row__qty-input';
      qtyInput.oninput   = e => {
        this._dishIngredientDraft[index].qty = parseFloat(e.target.value) || 0;
      };

      // Unité
      const unit = document.createElement('span');
      unit.className   = 'dish-ingredient-row__unit';
      unit.textContent = ingredient.unit || '';

      // Bouton de retrait
      const removeBtn = document.createElement('button');
      removeBtn.className   = 'btn btn--icon btn--icon-delete';
      removeBtn.style.cssText = 'width:18px;height:18px;font-size:10px';
      removeBtn.innerHTML   = '✕';
      removeBtn.onclick     = () => {
        this._dishIngredientDraft.splice(index, 1);
        this._renderDishIngredientEditor();
        this._renderIngredientPicker();
      };

      row.appendChild(name); row.appendChild(qtyInput);
      row.appendChild(unit); row.appendChild(removeBtn);
      container.appendChild(row);
    });
  },

  // ─── Picker d'ingrédients dans le formulaire de plat ──────────

  /** Callback du champ de recherche du picker */
  onIngredientPickerSearch(query) {
    this._ingredientPickerQuery = query;
    this._renderIngredientPicker();
  },

  /**
   * Restitue la liste des ingrédients disponibles à ajouter au plat.
   * Filtrés : pas déjà sélectionnés, et correspondant au terme de recherche.
   */
  _renderIngredientPicker() {
    const query     = this._ingredientPickerQuery.toLowerCase();
    const container = document.getElementById('js-ingredient-picker-list');
    container.innerHTML = '';

    // Ids des ingrédients déjà dans le brouillon
    const selectedIds = new Set(this._dishIngredientDraft.map(e => e.ingId));

    // Filtrage et tri
    const available = sortByName(
      AppState.ingredients.filter(i =>
        !selectedIds.has(i.id) && (!query || i.name.toLowerCase().includes(query))
      )
    );

    if (!available.length && query) {
      // Aucun résultat → proposer de créer l'ingrédient à la volée
      const createRow = document.createElement('div');
      createRow.className = 'ingredient-picker__item ingredient-picker__item--create';
      createRow.innerHTML = `<span style="flex:1">Créer « ${this._ingredientPickerQuery} »</span>`;
      createRow.onclick = () => {
        // Création immédiate de l'ingrédient avec le terme tapé
        AppState.ingredients.push({ id: Date.now(), name: this._ingredientPickerQuery, unit: '' });
        AppState.save();
        Sidebar.renderIngredientList();
        document.getElementById('js-ingredient-picker-search').value = '';
        this._ingredientPickerQuery = '';
        this._renderIngredientPicker();
      };
      container.appendChild(createRow);
    } else if (!available.length) {
      container.innerHTML = '<div class="empty-state" style="padding:8px">Tous les ingrédients sont déjà ajoutés</div>';
    } else {
      available.forEach(ingredient => {
        container.appendChild(this._buildIngredientPickerItem(ingredient));
      });
    }
  },

  /**
   * Construit une ligne d'ingrédient dans le picker (nom + unité + qté + bouton +).
   */
  _buildIngredientPickerItem(ingredient) {
    const row = document.createElement('div');
    row.className = 'ingredient-picker__item';

    const name = document.createElement('div');
    name.className   = 'ingredient-picker__item-name';
    name.textContent = ingredient.name;

    const unit = document.createElement('div');
    unit.className   = 'ingredient-picker__item-unit';
    unit.textContent = ingredient.unit || '';

    // Champ de quantité (pas de 0.5)
    const qtyInput = document.createElement('input');
    qtyInput.type      = 'number';
    qtyInput.min       = '0';
    qtyInput.step      = '0.5';
    qtyInput.placeholder = 'Qté';
    qtyInput.className = 'ingredient-picker__item-qty';
    qtyInput.onclick   = e => e.stopPropagation(); // ne pas fermer la ligne

    // Bouton d'ajout au plat
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn--icon btn--icon-add';
    addBtn.style.cssText = 'width:20px;height:20px;font-size:12px';
    addBtn.innerHTML = '＋';
    addBtn.onclick   = e => {
      e.stopPropagation();
      this._dishIngredientDraft.push({
        ingId: ingredient.id,
        qty:   parseFloat(qtyInput.value) || 0
      });
      this._renderDishIngredientEditor();
      this._renderIngredientPicker();
    };

    row.appendChild(name); row.appendChild(unit);
    row.appendChild(qtyInput); row.appendChild(addBtn);
    return row;
  },

  // ─── Liste de courses ─────────────────────────────────────────

  /**
   * Calcule et affiche la liste de courses cumulée pour un planning.
   * Les quantités du même ingrédient sont additionnées sur tous les créneaux.
   */
  openShoppingList(planningIndex) {
    const planning = AppState.plannings[planningIndex];

    // Cumul : ingId → { name, unit, total, sources[] }
    const cumul = {};
    Object.values(planning.slots).forEach(dishId => {
      if (!dishId) return;
      const dish = AppState.getDish(dishId); if (!dish) return;
      (dish.ingredients || []).forEach(entry => {
        const ingredient = AppState.getIngredient(entry.ingId); if (!ingredient) return;
        if (!cumul[entry.ingId]) {
          cumul[entry.ingId] = { name: ingredient.name, unit: ingredient.unit || '', total: 0, sources: [] };
        }
        cumul[entry.ingId].total += entry.qty || 0;
        cumul[entry.ingId].sources.push(dish.name);
      });
    });

    document.getElementById('js-shopping-list-title').textContent = '🛒 ' + planning.name;
    const content = document.getElementById('js-shopping-list-content');

    const entries = Object.values(cumul).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    if (!entries.length) {
      content.innerHTML = '<div class="empty-state" style="padding:20px 0">Aucun ingrédient renseigné pour ce planning.</div>';
    } else {
      content.innerHTML = entries.map(entry => {
        const qty = entry.total > 0 ? `${entry.total} ${entry.unit}` : '—';
        const src = [...new Set(entry.sources)].join(', ');
        return `<div class="shopping-list__item">
          <div>
            <span class="shopping-list__item-name">${entry.name}</span>
            <span class="shopping-list__item-source">(${src})</span>
          </div>
          <span class="shopping-list__item-qty">${qty}</span>
        </div>`;
      }).join('');
    }

    this.open('modal-shopping-list');
  }
};
