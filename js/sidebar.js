/**
 * sidebar.js — Rendu du panneau latéral (liste des plats)
 *              et de la liste des ingrédients (dans la modale de gestion).
 *
 * Expose un objet global `Sidebar`.
 * Dépend de : state.js, modals.js
 */

const Sidebar = {

  // ─── Liste des plats ──────────────────────────────────────────

  /**
   * Restitue la liste des plats dans #js-dish-list.
   * Les plats sont triés par ordre alphabétique.
   * Chaque plat est une carte draggable vers la grille.
   */
  renderDishList() {
    const container = document.getElementById('js-dish-list');
    container.innerHTML = '';

    const sortedDishes = sortByName(AppState.dishes);

    if (!sortedDishes.length) {
      container.innerHTML = '<div class="empty-state">Aucun plat enregistré</div>';
      return;
    }

    sortedDishes.forEach(dish => {
      container.appendChild(this._buildDishListItem(dish));
    });
  },

  /**
   * Construit la carte d'un plat dans la sidebar.
   * @param {Object} dish — données du plat
   */
  _buildDishListItem(dish) {
    const item = document.createElement('div');
    item.className = 'dish-list-item';
    item.draggable = true;

    // Début du drag depuis la sidebar (source = pas de créneau)
    item.ondragstart = () => {
      // On expose l'état de drag via les variables de planning.js
      // en passant par le même mécanisme global
      window._dragState          = { dishId: dish.id, sourcePlanningIndex: null };
      window._dragSourceSlotKey  = null;
    };

    // Poignée de drag
    const dragHandle = document.createElement('span');
    dragHandle.className   = 'dish-list-item__drag-handle';
    dragHandle.textContent = '⠿';

    // Infos du plat : nom + tags
    const info = document.createElement('div');
    info.className = 'dish-list-item__info';

    const name = document.createElement('div');
    name.className   = 'dish-list-item__name';
    name.textContent = dish.name;

    const tags = document.createElement('div');
    tags.className = 'dish-list-item__tags';
    if (dish.restriction !== 'both') {
      const t = document.createElement('span');
      t.className   = `tag tag--${dish.restriction}`;
      t.textContent = dish.restriction === 'midi' ? '☀M' : '🌙S';
      tags.appendChild(t);
    }
    if (dish.double) {
      const t = document.createElement('span');
      t.className = 'tag tag--double'; t.textContent = '×2';
      tags.appendChild(t);
    }
    info.appendChild(name);
    info.appendChild(tags);

    // Boutons d'action : modifier et supprimer
    const actions = document.createElement('div');
    actions.className = 'dish-list-item__actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn--icon btn--icon-edit';
    editBtn.title     = 'Modifier ce plat';
    editBtn.innerHTML = '✏️';
    editBtn.onclick   = () => Modals.openDishForm(dish.id);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn--icon btn--icon-delete';
    deleteBtn.title     = 'Supprimer ce plat';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.onclick   = () => {
      Modals.askConfirm(`Supprimer le plat « ${dish.name} » ?`, () => {
        // Retirer le plat de tous les créneaux de tous les plannings
        AppState.dishes = AppState.dishes.filter(d => d.id !== dish.id);
        AppState.plannings.forEach(planning => {
          Object.keys(planning.slots).forEach(key => {
            if (planning.slots[key] === dish.id) planning.slots[key] = null;
          });
        });
        AppState.save();
        Sidebar.renderDishList();
        Planning.renderAll();
      });
    };

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(dragHandle);
    item.appendChild(info);
    item.appendChild(actions);
    return item;
  },

  // ─── Liste des ingrédients (dans la modale de gestion) ────────

  /**
   * Restitue la liste des ingrédients dans #js-ingredient-list.
   * Triés alphabétiquement. Affiché dans la modale de gestion des ingrédients.
   */
  renderIngredientList() {
    const container = document.getElementById('js-ingredient-list');
    container.innerHTML = '';

    const sortedIngredients = sortByName(AppState.ingredients);

    if (!sortedIngredients.length) {
      container.innerHTML = '<div class="empty-state">Aucun ingrédient enregistré</div>';
      return;
    }

    sortedIngredients.forEach(ingredient => {
      container.appendChild(this._buildIngredientListItem(ingredient));
    });
  },

  /**
   * Construit une ligne d'ingrédient dans le gestionnaire.
   * @param {Object} ingredient — { id, name, unit }
   */
  _buildIngredientListItem(ingredient) {
    const item = document.createElement('div');
    item.className = 'ingredient-list-item';

    const name = document.createElement('span');
    name.className   = 'ingredient-list-item__name';
    name.textContent = ingredient.name;

    const unit = document.createElement('span');
    unit.className   = 'ingredient-list-item__unit';
    unit.textContent = ingredient.unit || '—';

    const actions = document.createElement('div');
    actions.className = 'ingredient-list-item__actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn--icon btn--icon-edit';
    editBtn.style.cssText = 'width:20px;height:20px;font-size:11px';
    editBtn.title     = 'Modifier';
    editBtn.innerHTML = '✏️';
    editBtn.onclick   = () => Modals.openIngredientForm(ingredient.id);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn--icon btn--icon-delete';
    deleteBtn.style.cssText = 'width:20px;height:20px;font-size:11px';
    deleteBtn.title     = 'Supprimer';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.onclick   = () => {
      const isUsed = AppState.dishes.some(d =>
        (d.ingredients || []).some(i => i.ingId === ingredient.id)
      );
      const message = isUsed
        ? `« ${ingredient.name} » est utilisé dans un plat. Supprimer quand même ?`
        : `Supprimer l'ingrédient « ${ingredient.name} » ?`;

      Modals.askConfirm(message, () => {
        // Supprimer l'ingrédient et le retirer des plats qui l'utilisent
        AppState.ingredients = AppState.ingredients.filter(i => i.id !== ingredient.id);
        AppState.dishes.forEach(d => {
          d.ingredients = (d.ingredients || []).filter(i => i.ingId !== ingredient.id);
        });
        AppState.save();
        Sidebar.renderIngredientList();
      });
    };

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(name);
    item.appendChild(unit);
    item.appendChild(actions);
    return item;
  }
};
