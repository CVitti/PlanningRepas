/**
 * planning.js — Rendu de la grille des plannings et gestion du drag-and-drop.
 *
 * Expose un objet global `Planning` avec les méthodes de rendu.
 * Dépend de : state.js, modals.js
 */

// ─── État du drag-and-drop (sur window pour être partagé avec sidebar.js) ────

/**
 * Objet décrivant le plat en cours de déplacement.
 * { dishId: number, sourcePlanningIndex: number|null }
 * null quand aucun drag n'est en cours.
 * Stocké sur window pour être accessible depuis sidebar.js.
 */
window._dragState = null;

/** Clé du créneau source d'où provient le drag (ex: "3-midi"). Sur window. */
window._dragSourceSlotKey = null;

// ─── Objet public ─────────────────────────────────────────────────

const Planning = {

  /**
   * Restitue tous les blocs de planning dans #js-plannings-container.
   * Appelé à chaque modification des données.
   */
  renderAll() {
    const container = document.getElementById('js-plannings-container');
    container.innerHTML = '';
    AppState.plannings.forEach((planning, planningIndex) => {
      container.appendChild(this._buildPlanningBlock(planning, planningIndex));
    });
  },

  // ─── Construction d'un bloc de planning ───────────────────────

  /**
   * Construit le bloc DOM complet d'un planning (en-tête + grille).
   * @param {Object} planning — données du planning
   * @param {number} planningIndex — index dans AppState.plannings
   */
  _buildPlanningBlock(planning, planningIndex) {
    const block = document.createElement('div');
    block.className = 'planning-block';
    block.appendChild(this._buildPlanningHeader(planning, planningIndex));
    block.appendChild(this._buildGrid(planning, planningIndex));
    return block;
  },

  /**
   * Construit l'en-tête d'un planning : titre + boutons (courses, effacer, semaine suivante).
   */
  _buildPlanningHeader(planning, planningIndex) {
    const header = document.createElement('div');
    header.className = 'planning-block__header';

    // Titre
    const title = document.createElement('h2');
    title.className   = 'planning-block__title';
    title.textContent = planning.name;

    // Bouton liste de courses
    const btnShop = document.createElement('button');
    btnShop.className = 'btn btn--ghost-amber btn--sm';
    btnShop.innerHTML = '🛒 Courses';
    btnShop.onclick   = () => Modals.openShoppingList(planningIndex);

    // Bouton effacer le planning
    // IMPORTANT : `planningIndex` est capturé ici dans la closure.
    // Pour éviter le bug historique où la valeur de `pi` changeait après
    // la boucle, on passe explicitement la valeur via un paramètre de la
    // fonction arrow, garantissant que chaque bouton capture le bon index.
    const btnClear = document.createElement('button');
    btnClear.className = 'btn btn--danger btn--sm';
    btnClear.innerHTML = '✕ Effacer';
    btnClear.onclick   = () => {
      const idx = planningIndex; // valeur figée
      Modals.askConfirm('Effacer tous les repas de ce planning ?', () => {
        const slots = AppState.getSlotsForPlanning(idx);
        Object.keys(slots).forEach(key => { slots[key] = null; });
        AppState.save();
        Planning.renderAll();
      });
    };

    header.appendChild(title);
    header.appendChild(btnShop);
    header.appendChild(btnClear);

    // Bouton "Semaine suivante" uniquement sur le dernier planning
    if (planningIndex === AppState.plannings.length - 1) {
      const btnNext = document.createElement('button');
      btnNext.className = 'btn btn--sm';
      btnNext.innerHTML = '＋ Semaine suivante';
      btnNext.onclick   = () => {
        const lastPlanning = AppState.plannings[AppState.plannings.length - 1];
        const nextFriday   = addDays(new Date(lastPlanning.startFri), 7);
        AppState.plannings.push(createEmptyPlanning(nextFriday));
        AppState.save();
        Planning.renderAll();
      };
      header.appendChild(btnNext);
    }

    return header;
  },

  // ─── Construction de la grille ────────────────────────────────

  /**
   * Construit la grille complète : en-tête colonnes + ligne par jour.
   */
  _buildGrid(planning, planningIndex) {
    const wrapper = document.createElement('div');

    // En-tête des colonnes
    const colHeaders = document.createElement('div');
    colHeaders.className = 'planning-grid__col-headers';
    colHeaders.innerHTML = `
      <div></div>
      <div class="planning-grid__col-label">☀ Midi</div>
      <div class="planning-grid__col-label">🌙 Soir</div>
    `;
    wrapper.appendChild(colHeaders);

    // Une ligne par jour
    const days = buildWeekDays(new Date(planning.startFri));
    days.forEach((day, dayIndex) => {
      wrapper.appendChild(this._buildDayRow(day, dayIndex, planning, planningIndex));
    });

    return wrapper;
  },

  /**
   * Construit une ligne de jour : étiquette + créneau midi + créneau soir.
   */
  _buildDayRow(day, dayIndex, planning, planningIndex) {
    const row = document.createElement('div');
    row.className = 'planning-day-row';

    // Étiquette du jour (nom + date)
    const label = document.createElement('div');
    label.className = 'day-label' + (isToday(day.date) ? ' day-label--today' : '');
    label.innerHTML = `
      <span class="day-label__name">${day.shortName}</span>
      <span class="day-label__date">${formatDateFull(day.date)}</span>
    `;
    row.appendChild(label);

    // Créneau midi puis créneau soir
    ['midi', 'soir'].forEach(slotType => {
      if (!day.slotTypes.includes(slotType)) {
        // Créneau hors périmètre : affichage fantôme non interactif
        row.appendChild(this._buildGhostSlot(slotType));
      } else {
        const slotKey = `${dayIndex}-${slotType}`;
        const dishId  = planning.slots[slotKey];
        const dish    = dishId ? AppState.getDish(dishId) : null;
        row.appendChild(this._buildSlot(dish, slotKey, slotType, planningIndex));
      }
    });

    return row;
  },

  /**
   * Construit un créneau fantôme (hors périmètre du planning).
   */
  _buildGhostSlot(slotType) {
    const ghost = document.createElement('div');
    ghost.className = `meal-slot meal-slot--ghost meal-slot--${slotType}`;
    ghost.innerHTML = `
      <div class="meal-slot__type-label">${slotType === 'midi' ? '☀ Midi' : '🌙 Soir'}</div>
      <div class="meal-slot__empty-hint">—</div>
    `;
    return ghost;
  },

  /**
   * Construit un créneau actif (vide ou rempli, interactif).
   */
  _buildSlot(dish, slotKey, slotType, planningIndex) {
    const slot = document.createElement('div');
    slot.className = `meal-slot meal-slot--${slotType}${dish ? ' meal-slot--filled' : ''}`;

    // Label du type de créneau
    const typeLabel = document.createElement('div');
    typeLabel.className   = 'meal-slot__type-label';
    typeLabel.textContent = slotType === 'midi' ? '☀ Midi' : '🌙 Soir';
    slot.appendChild(typeLabel);

    if (dish) {
      // Créneau rempli : carte du plat
      const portionTag = AppState.getPortionTag(planningIndex, slotKey, dish);
      slot.appendChild(this._buildMealCard(dish, slotKey, slotType, planningIndex, portionTag));
    } else {
      // Créneau vide : texte d'invite
      const hint = document.createElement('div');
      hint.className   = 'meal-slot__empty-hint';
      hint.textContent = 'Cliquer pour assigner';
      slot.appendChild(hint);
    }

    // Clic sur le créneau vide → ouvre le picker de plats
    slot.onclick = e => {
      if (!e.target.closest('.meal-card')) {
        Modals.openSlotPicker(planningIndex, slotKey, slotType);
      }
    };

    // Événements drag-and-drop
    slot.ondragover  = e => { e.preventDefault(); slot.classList.add('meal-slot--drag-over'); };
    slot.ondragleave = ()  => slot.classList.remove('meal-slot--drag-over');
    slot.ondrop      = e  => {
      e.preventDefault();
      slot.classList.remove('meal-slot--drag-over');
      _handleDrop(planningIndex, slotKey, slotType);
    };

    return slot;
  },

  /**
   * Construit la carte d'un plat (draggable) affichée dans un créneau rempli.
   */
  _buildMealCard(dish, slotKey, slotType, planningIndex, portionTag) {
    const card = document.createElement('div');
    card.className = 'meal-card';
    card.draggable = true;

    // Démarrage du drag — écriture sur window pour partage avec sidebar.js
    card.ondragstart = () => {
      window._dragState         = { dishId: dish.id, sourcePlanningIndex: planningIndex };
      window._dragSourceSlotKey = slotKey;
      setTimeout(() => card.classList.add('meal-card--dragging'), 0);
    };
    card.ondragend = () => card.classList.remove('meal-card--dragging');

    // Nom du plat
    const name = document.createElement('div');
    name.className   = 'meal-card__name';
    name.textContent = dish.name;

    // Tags (restriction créneau, double portion, P1/P2)
    const tags = document.createElement('div');
    tags.className = 'meal-card__tags';
    if (dish.restriction !== 'both') {
      tags.appendChild(_makeTag(`tag--${dish.restriction}`, dish.restriction === 'midi' ? 'Midi' : 'Soir'));
    }
    if (dish.double) {
      tags.appendChild(_makeTag('tag--double', '×2'));
    }
    if (portionTag) {
      tags.appendChild(_makeTag(`tag--portion-${portionTag === 'P1' ? '1' : '2'}`, portionTag));
    }

    // Bouton de retrait du plat
    const removeBtn = document.createElement('button');
    removeBtn.className = 'meal-card__remove-btn';
    removeBtn.innerHTML = '✕';
    removeBtn.title     = 'Retirer ce plat';
    removeBtn.onclick   = e => {
      e.stopPropagation();
      AppState.getSlotsForPlanning(planningIndex)[slotKey] = null;
      AppState.save();
      Planning.renderAll();
    };

    card.appendChild(name);
    card.appendChild(tags);
    card.appendChild(removeBtn);
    return card;
  }
};

// ─── Drag-and-drop : gestion du drop ─────────────────────────────

/**
 * Gère le dépôt d'un plat sur un créneau cible.
 * - Vérifie la compatibilité créneau/restriction du plat.
 * - Échange les plats si les deux créneaux sont remplis.
 * - Restitue le planning après modification.
 */
function _handleDrop(targetPlanningIndex, targetSlotKey, targetSlotType) {
  if (!window._dragState) return;

  const { dishId, sourcePlanningIndex } = window._dragState;
  const dish = AppState.getDish(dishId);
  if (!dish) return;

  // Vérification de la compatibilité avec la restriction du plat
  if (dish.restriction !== 'both' && dish.restriction !== targetSlotType) {
    window._dragState         = null;
    window._dragSourceSlotKey = null;
    return;
  }

  const targetSlots = AppState.getSlotsForPlanning(targetPlanningIndex);
  const previousDishInTarget = targetSlots[targetSlotKey];

  // Place le plat dans le créneau cible
  targetSlots[targetSlotKey] = dishId;

  // Si le drag vient d'un créneau du même planning → échange des deux plats
  if (window._dragSourceSlotKey && sourcePlanningIndex === targetPlanningIndex
      && window._dragSourceSlotKey !== targetSlotKey) {
    AppState.getSlotsForPlanning(sourcePlanningIndex)[window._dragSourceSlotKey] = previousDishInTarget;
  }

  window._dragState         = null;
  window._dragSourceSlotKey = null;

  AppState.save();
  Planning.renderAll();
}

// ─── Helper interne ───────────────────────────────────────────────

/** Crée un élément <span class="tag ..."> */
function _makeTag(cssModifier, label) {
  const span = document.createElement('span');
  span.className   = `tag ${cssModifier}`;
  span.textContent = label;
  return span;
}
