/* ═══════════════════════════════════════════════════════════
   js/components/planning.js — Grille hebdomadaire du planning
   ═══════════════════════════════════════════════════════════

   Affiche et gère la grille de planification des repas.

   Fenêtre de planning : vendredi S0 (soir) → vendredi S+1 (midi)
   soit 8 jours (indices 0..7) avec deux créneaux par jour :
     - Midi (☀)  — verrouillé le jour 0 (vendredi S0)
     - Soir (🌙) — verrouillé le jour 7 (vendredi S+1)

   Les slots verrouillés appartiennent aux semaines adjacentes
   et ne peuvent être ni modifiés ni vidés.

   Valeurs spéciales dans planningData[dateKey][slot] :
     '__free__' → repas libre (avec note optionnelle)
     <dishId>   → identifiant d'un plat enregistré

   Structure de stockage :
   {
     "2024-11-22": {
       "midi": "dish_abc",
       "soir": "__free__",
       "soir_note": "Restes de dimanche"
     }
   }
   ═══════════════════════════════════════════════════════════ */

const Planning = (() => {

  /* ── État interne ── */
  let planningData = {};  // données complètes du planning (toutes semaines)
  let days         = [];  // fenêtre de 8 jours de la semaine affichée
  let weekOffset   = 0;   // décalage hebdomadaire : 0=courante, -1=précédente, +1=suivante

  /* ── Valeur spéciale pour les repas libres ── */
  const FREE_MEAL = '__free__';

  /* ── Lecture / écriture en mémoire ── */

  /** Charge le planning depuis Storage et recalcule la fenêtre de jours */
  function load() {
    planningData = Storage.get('planning', {});
    days         = Dates.getPlanningDays(weekOffset);
  }

  /** Sauvegarde le planning complet dans Storage (déclenche un sync Gist debounced) */
  function save() { Storage.set('planning', planningData); }

  /** Retourne les données du jour (objet { midi, soir, … } ou {}) */
  function getDayData(key) { return planningData[key] || {}; }

  /* ── Notes associées aux repas libres ── */

  /**
   * Retourne la note d'un créneau libre, stockée sous la clé slot + '_note'.
   * Retourne une chaîne vide si aucune note n'est définie.
   */
  function getNote(dateKey, slot) {
    return planningData[dateKey]?.[slot + '_note'] || '';
  }

  /**
   * Enregistre ou supprime la note d'un créneau libre.
   * Si le texte est vide, la clé est supprimée pour ne pas polluer le Gist.
   */
  function setNote(dateKey, slot, text) {
    if (!planningData[dateKey]) planningData[dateKey] = {};
    if (text) {
      planningData[dateKey][slot + '_note'] = text;
    } else {
      delete planningData[dateKey][slot + '_note'];
    }
    save();
  }

  /* ── Affectation et suppression de plats ── */

  /** Affecte un plat (ou FREE_MEAL) à un créneau et sauvegarde */
  function assignDish(dateKey, slot, value) {
    if (!planningData[dateKey]) planningData[dateKey] = {};
    planningData[dateKey][slot] = value;
    save();
  }

  /**
   * Vide un créneau : supprime le plat et la note éventuelle.
   * Si l'objet du jour devient vide après suppression, il est lui-même retiré.
   */
  function clearSlot(dateKey, slot) {
    if (!planningData[dateKey]) return;
    delete planningData[dateKey][slot];
    delete planningData[dateKey][slot + '_note'];
    if (!Object.keys(planningData[dateKey]).length) delete planningData[dateKey];
    save();
  }

  /* ── Navigation hebdomadaire ── */

  /** Passe à la semaine précédente (minimum : S-1) */
  function goToPrevWeek() {
    weekOffset = Math.max(-1, weekOffset - 1);
    days = Dates.getPlanningDays(weekOffset);
    render();
    updateLabel();
  }

  /** Passe à la semaine suivante (maximum : S+1) */
  function goToNextWeek() {
    weekOffset = Math.min(1, weekOffset + 1);
    days = Dates.getPlanningDays(weekOffset);
    render();
    updateLabel();
  }

  /** Retourne à la semaine courante */
  function goToCurrentWeek() {
    weekOffset = 0;
    days = Dates.getPlanningDays(0);
    render();
    updateLabel();
  }

  /* ── Purge des anciennes données ── */

  /**
   * Supprime les entrées du planning antérieures à S-1.
   * Appelé au démarrage pour éviter une accumulation infinie de données.
   */
  function purgeOldWeeks() {
    const cutoff = Dates.formatKey(Dates.addDays(Dates.getStartFriday(), -7));
    Object.keys(planningData).forEach(key => {
      if (key < cutoff) delete planningData[key];
    });
    save();
  }

  /* ── Numérotation des portions pour les plats doubles ── */

  /**
   * Retourne l'index de portion (1 ou 2) d'un placement de plat double,
   * ou null si le plat n'est pas double ou s'il n'est posé qu'une seule fois.
   *
   * L'ordre est déterminé par le parcours chronologique des créneaux
   * visibles et non verrouillés de la semaine affichée.
   */
  function getPortionIndex(dishId, dateKey, slot) {
    const dish = Dishes.getById(dishId);
    if (!dish || !dish.double) return null;

    /* Collecte toutes les occurrences du plat dans la semaine, dans l'ordre */
    const placements = [];
    days.forEach(dayInfo => {
      ['midi', 'soir'].forEach(s => {
        if (s === 'midi' && dayInfo.midiLocked) return;
        if (s === 'soir' && dayInfo.soirLocked) return;
        if (planningData[dayInfo.key]?.[s] === dishId) {
          placements.push({ dk: dayInfo.key, s });
        }
      });
    });

    if (placements.length < 2) return null; // pas encore les deux portions
    const idx = placements.findIndex(p => p.dk === dateKey && p.s === slot);
    return idx === -1 ? null : idx + 1; // 1 pour la première portion, 2 pour la seconde
  }

  /* ── Vidage de la semaine ── */

  /**
   * Vide tous les créneaux non verrouillés de la semaine affichée.
   * Les slots midiLocked (vendredi S0) et soirLocked (vendredi S+1)
   * sont préservés car ils appartiennent aux semaines adjacentes.
   */
  function clearCurrentWeek() {
    days.forEach(d => {
      if (!d.midiLocked) clearSlot(d.key, 'midi');
      if (!d.soirLocked) clearSlot(d.key, 'soir');
    });
    render();
    Toast.info('Planning vidé.');
  }

  /* ── Label de semaine et visibilité des boutons de navigation ── */

  /**
   * Met à jour le label de semaine dans l'en-tête (#week-label)
   * et masque les boutons de navigation inutiles
   * (pas de "précédente" si déjà à S-1, etc.).
   */
  function updateLabel() {
    const el = document.getElementById('week-label');
    if (el) el.textContent = Dates.formatWeekRange(Dates.getPlanningDays(weekOffset));

    const show = (id, visible) => {
      const btn = document.getElementById(id);
      if (btn) btn.style.display = visible ? '' : 'none';
    };
    show('btn-prev-week',    weekOffset !== -1); // caché si déjà à S-1
    show('btn-week-current', weekOffset !==  0); // caché si déjà sur la semaine courante
    show('btn-next-week',    weekOffset !==  1); // caché si déjà à S+1
  }

  /* ── Compatibilité de créneau ── */

  /**
   * Vérifie si un plat peut être assigné à un créneau donné :
   *   - slot non verrouillé
   *   - créneau du plat compatible (both, midi ou soir)
   */
  function canAssign(dish, slot, dayInfo) {
    if (slot === 'midi' && dayInfo.midiLocked) return false;
    if (slot === 'soir' && dayInfo.soirLocked) return false;
    if (dish.slot === 'both') return true;
    return dish.slot === slot;
  }

  /* ── Détection des créneaux passés ── */

  /**
   * Retourne true si le créneau est passé :
   *   - midi : après 14h00
   *   - soir : après 21h00
   * Utilisé pour appliquer la classe CSS .past sur les slots antérieurs.
   */
  function isPast(dateKey, slot) {
    const now    = new Date();
    const date   = new Date(dateKey + 'T00:00:00');
    const cutoff = new Date(date);
    cutoff.setHours(slot === 'midi' ? 14 : 21, 0, 0, 0);
    return now > cutoff;
  }

  /* ── Palette de couleurs pour les badges de portions ── */

  /**
   * Nombre de couleurs disponibles pour différencier les plats doubles.
   * Les couleurs sont définies dans planning.css : .badge-portion-0 … .badge-portion-5
   */
  const PORTION_COLORS = 6;

  /**
   * Construit la table d'association dishId → index de couleur (0..5)
   * pour les plats doubles présents dans la semaine affichée.
   * Chaque plat double reçoit un index unique, recyclé modulo PORTION_COLORS.
   */
  function buildDoubleColorMap() {
    const map = {};
    let idx   = 0;
    days.forEach(dayInfo => {
      ['midi', 'soir'].forEach(slot => {
        if (slot === 'midi' && dayInfo.midiLocked) return;
        if (slot === 'soir' && dayInfo.soirLocked) return;
        const dishId = planningData[dayInfo.key]?.[slot];
        if (!dishId || dishId === FREE_MEAL) return;
        const dish = Dishes.getById(dishId);
        if (!dish || !dish.double) return;
        if (!(dishId in map)) map[dishId] = (idx++) % PORTION_COLORS;
      });
    });
    return map;
  }

  /* ══════════════════════════════════════════════════════════
     RENDU DE LA GRILLE
     ══════════════════════════════════════════════════════════ */

  /**
   * Reconstruit entièrement la grille #planning-grid.
   * Pour chaque jour : en-tête + slot midi + slot soir.
   * La colorMap est calculée une seule fois et passée à tous les buildMealCard.
   * Après le rendu, la sidebar est mise à jour pour refléter les états "in-use".
   */
  function render() {
    const grid = document.getElementById('planning-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const colorMap = buildDoubleColorMap();

    days.forEach(dayInfo => {
      const dayData = getDayData(dayInfo.key);

      /* Colonne du jour */
      const col = document.createElement('div');
      col.className = 'day-column' + (dayInfo.isWeekend ? ' weekend' : '');

      /* En-tête : nom du jour + numéro */
      const hdr = document.createElement('div');
      hdr.className = 'day-header' + (dayInfo.isToday ? ' today' : '');
      hdr.innerHTML =
        '<span class="day-name">' + cap(dayInfo.dayName) + '</span>' +
        '<span class="day-date">' + dayInfo.label + '</span>';
      col.appendChild(hdr);

      /* Créneaux midi et soir */
      col.appendChild(buildSlot(dayInfo, 'midi', dayData.midi, colorMap));
      col.appendChild(buildSlot(dayInfo, 'soir', dayData.soir, colorMap));
      grid.appendChild(col);
    });

    initDropZones();

    /* Synchronise les highlights de la sidebar après chaque rendu */
    if (typeof Sidebar !== 'undefined') Sidebar.render();
  }

  /* ── Construction d'un créneau ── */

  /**
   * Crée l'élément .meal-slot pour un créneau donné.
   * Selon la valeur du planning :
   *   - verrouillé   → affiche uniquement le label (pas de contenu)
   *   - FREE_MEAL     → buildFreeCard()
   *   - dishId        → buildMealCard()
   *   - vide          → buildHint()
   */
  function buildSlot(dayInfo, slot, value, colorMap) {
    const locked = (slot === 'midi' && dayInfo.midiLocked) ||
                   (slot === 'soir' && dayInfo.soirLocked);
    const past   = !locked && isPast(dayInfo.key, slot);

    const el = document.createElement('div');
    el.className  = 'meal-slot' +
                    (locked ? ' locked' : '') +
                    (past   ? ' past'   : '');
    el.dataset.date = dayInfo.key;
    el.dataset.slot = slot;

    /* Label du créneau (☀ Midi / 🌙 Soir) */
    const lbl = document.createElement('div');
    lbl.className = 'meal-slot-label';
    lbl.innerHTML = slot === 'midi'
      ? '<span class="slot-icon slot-icon-midi">☀</span><span>Midi</span>'
      : '<span class="slot-icon slot-icon-soir">🌙</span><span>Soir</span>';
    el.appendChild(lbl);

    /* Slots verrouillés : pas de contenu interactif */
    if (locked) return el;

    /* Contenu selon l'état du créneau */
    if (value === FREE_MEAL) {
      el.appendChild(buildFreeCard(dayInfo.key, slot));
    } else if (value) {
      el.appendChild(buildMealCard(dayInfo.key, slot, value, colorMap));
    } else {
      el.appendChild(buildHint());
    }

    return el;
  }

  /* ── Indication de slot vide ── */

  /**
   * Affiche un hint invitant à déposer un plat,
   * avec un bouton "Libre" pour marquer le créneau comme repas libre.
   */
  function buildHint() {
    const hint = document.createElement('div');
    hint.className = 'slot-hint';
    hint.innerHTML = '<span>Déposez un plat</span><button class="btn-free-meal" title="Marquer comme libre">Libre</button>';
    hint.querySelector('.btn-free-meal').addEventListener('click', e => {
      e.stopPropagation();
      const slotEl = e.target.closest('.meal-slot');
      assignDish(slotEl.dataset.date, slotEl.dataset.slot, FREE_MEAL);
      render();
    });
    return hint;
  }

  /* ── Carte "repas libre" ── */

  /**
   * Crée une carte pour un créneau marqué comme repas libre.
   *
   * Structure :
   *   .free-card-content  → label "✨ Repas libre" + aperçu de la note
   *   .meal-card-actions  → overlay au survol avec boutons ✎ et ✕
   *   textarea            → masquée par défaut, visible uniquement en mode édition
   *
   * Mode édition (clic sur ✎) :
   *   - masque le content et l'overlay
   *   - affiche la textarea et place le focus
   *   - à la perte de focus (blur) : exitEdit() remet l'affichage normal
   *
   * La visibilité de la textarea est gérée via style.display inline
   * (indépendant du cache CSS) pour garantir un comportement fiable.
   */
  function buildFreeCard(dateKey, slot) {
    const card = document.createElement('div');
    card.className = 'meal-card meal-card-free';

    /* ── Contenu affiché en mode normal ── */
    const content = document.createElement('div');
    content.className = 'free-card-content';

    const label = document.createElement('div');
    label.className  = 'meal-card-name free-label';
    label.textContent = '✨ Repas libre';

    const notePreview = document.createElement('div');
    notePreview.className  = 'free-note-preview';
    notePreview.textContent = getNote(dateKey, slot);

    content.appendChild(label);
    content.appendChild(notePreview);
    card.appendChild(content);

    /* ── Overlay d'actions (même patron que les cartes de plat) ── */
    const actionsEl = document.createElement('div');
    actionsEl.className = 'meal-card-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'dish-action dish-action-edit';
    editBtn.title     = 'Modifier la note';
    editBtn.textContent = '✎';

    const rmBtn = document.createElement('button');
    rmBtn.className = 'dish-action dish-action-delete';
    rmBtn.title     = 'Retirer';
    rmBtn.textContent = '✕';

    rmBtn.addEventListener('click', e => {
      e.stopPropagation();
      clearSlot(dateKey, slot);
      render();
    });

    actionsEl.appendChild(editBtn);
    actionsEl.appendChild(rmBtn);
    card.appendChild(actionsEl);

    /* ── Textarea de note (masquée par inline style, indépendant du CSS) ── */
    const noteEl      = document.createElement('textarea');
    noteEl.className  = 'free-meal-note';
    noteEl.name       = `free-note-${dateKey}-${slot}`; // évite l'avertissement d'accessibilité
    noteEl.placeholder = 'Note…';
    noteEl.value      = getNote(dateKey, slot);
    noteEl.style.display = 'none'; // masquée par défaut
    card.appendChild(noteEl);

    /* ── Bascule entre mode affichage et mode édition ── */

    function enterEdit() {
      content.style.visibility      = 'hidden'; // cache le contenu sans décaler la mise en page
      actionsEl.style.opacity       = '0';
      actionsEl.style.pointerEvents = 'none';
      noteEl.style.display          = 'block';
      noteEl.focus();
    }

    function exitEdit() {
      noteEl.style.display          = 'none';
      content.style.visibility      = '';       // restaure la visibilité
      actionsEl.style.opacity       = '';
      actionsEl.style.pointerEvents = '';
    }

    /* ── Événements ── */
    editBtn.addEventListener('click', e => { e.stopPropagation(); enterEdit(); });

    noteEl.addEventListener('input', () => {
      const val = noteEl.value;
      setNote(dateKey, slot, val);
      notePreview.textContent = val; // mise à jour temps réel de l'aperçu
    });

    noteEl.addEventListener('blur',      () => exitEdit());
    noteEl.addEventListener('click',     e  => e.stopPropagation()); // évite la propagation vers le slot
    noteEl.addEventListener('mousedown', e  => e.stopPropagation()); // idem pour le focus

    return card;
  }

  /* ── Carte de plat planifié ── */

  /**
   * Crée une carte pour un plat assigné à un créneau.
   *
   * Contient :
   *   - nom du plat
   *   - badge de portion (P1/P2 coloré si plat double avec 2 placements,
   *     sinon "×2 portions" si une seule portion est posée)
   *   - overlay d'action au survol avec bouton ✕ (retrait du plat)
   *
   * La carte est draggable pour déplacer le plat vers un autre créneau.
   * Un clic ouvre la modale de détail (ingrédients + créneau).
   */
  function buildMealCard(dateKey, slot, dishId, colorMap) {
    const dish = Dishes.getById(dishId);
    /* Plat introuvable (supprimé entre-temps) → nettoyage silencieux */
    if (!dish) { clearSlot(dateKey, slot); return document.createTextNode(''); }

    const card = document.createElement('div');
    card.className     = 'meal-card';
    card.draggable     = true;
    card.dataset.dishId = dishId;
    card.dataset.date   = dateKey;
    card.dataset.slot   = slot;

    /* Nom du plat */
    const nameEl = document.createElement('div');
    nameEl.className  = 'meal-card-name';
    nameEl.textContent = dish.name;

    /* Badges (portion ou double) */
    const badges = document.createElement('div');
    badges.className = 'meal-card-badges';
    if (dish.double) {
      const b          = document.createElement('span');
      const portionIdx = getPortionIndex(dishId, dateKey, slot);
      if (portionIdx !== null) {
        /* Deux portions posées : badge coloré P1 / P2 */
        const ci    = colorMap?.[dishId] ?? 0;
        b.className = 'badge badge-portion badge-portion-' + ci;
        b.textContent = 'P' + portionIdx;
      } else {
        /* Une seule portion posée : badge générique */
        b.className   = 'badge badge-double';
        b.textContent = '\xd72 portions';
      }
      badges.appendChild(b);
    }

    /* Overlay d'action au survol (même patron que sidebar/ingrédients) */
    const actionsEl = document.createElement('div');
    actionsEl.className = 'meal-card-actions';

    /* Bouton "voir les ingrédients" */
    const infoBtn = document.createElement('button');
    infoBtn.className   = 'dish-action dish-action-info';
    infoBtn.title       = 'Voir les ingrédients';
    infoBtn.textContent = '≡';
    infoBtn.addEventListener('click', e => {
      e.stopPropagation();
      showDetail(dish);
    });

    /* Bouton "retirer le plat" */
    const rmBtn = document.createElement('button');
    rmBtn.className   = 'dish-action dish-action-delete';
    rmBtn.title       = 'Retirer ce plat';
    rmBtn.textContent = '✕';
    rmBtn.addEventListener('click', e => {
      e.stopPropagation();
      clearSlot(dateKey, slot);
      render();
    });

    actionsEl.appendChild(infoBtn);
    actionsEl.appendChild(rmBtn);

    card.appendChild(nameEl);
    card.appendChild(badges);
    card.appendChild(actionsEl);

    /* Clic → modale de détail (sauf si clic sur l'overlay ou pendant un drag) */
    card.addEventListener('click', e => {
      if (actionsEl.contains(e.target))       return;
      if (card.classList.contains('is-dragging')) return;
      showDetail(dish);
    });

    /* Drag : stocke l'identifiant du plat et la source pour permettre le déplacement */
    card.addEventListener('dragstart', e => {
      e.stopPropagation();
      e.dataTransfer.effectAllowed = 'all';
      e.dataTransfer.setData('text/plain',       dishId);
      e.dataTransfer.setData('text/dish-id',     dishId);
      e.dataTransfer.setData('text/source-date', dateKey);
      e.dataTransfer.setData('text/source-slot', slot);
      setTimeout(() => card.classList.add('is-dragging'), 0);
    });
    card.addEventListener('dragend', () => card.classList.remove('is-dragging'));

    return card;
  }

  /* ══════════════════════════════════════════════════════════
     GESTION DU DRAG & DROP VERS LES CRÉNEAUX
     ══════════════════════════════════════════════════════════ */

  /** Attache les événements de drop sur tous les créneaux non verrouillés */
  function initDropZones() {
    document.querySelectorAll('.meal-slot:not(.locked)').forEach(el => {
      el.addEventListener('dragover',  onDragOver);
      el.addEventListener('dragleave', onDragLeave);
      el.addEventListener('drop',      onDrop);
    });
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    this.classList.add('drag-over');
  }

  function onDragLeave(e) {
    /* Ignore si on entre dans un élément enfant du slot */
    if (!this.contains(e.relatedTarget)) this.classList.remove('drag-over');
  }

  /**
   * Gère le dépôt d'un plat sur un créneau :
   *   1. Récupère dishId + source (si déplacement depuis un autre créneau)
   *   2. Vérifie la compatibilité du plat avec le créneau cible
   *   3. Retire le plat de la source si déplacement (pas copie)
   *   4. Assigne le plat au créneau cible et redessine
   */
  function onDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');

    const dishId   = e.dataTransfer.getData('text/dish-id') ||
                     e.dataTransfer.getData('text/plain');
    const srcDate  = e.dataTransfer.getData('text/source-date');
    const srcSlot  = e.dataTransfer.getData('text/source-slot');
    const destDate = this.dataset.date;
    const destSlot = this.dataset.slot;

    if (!dishId || !destDate || !destSlot) return;

    const dish    = Dishes.getById(dishId);
    const dayInfo = days.find(d => d.key === destDate);
    if (!dish || !dayInfo) return;

    if (!canAssign(dish, destSlot, dayInfo)) {
      Toast.error(dish.name + ' n\'est pas disponible pour ce créneau.');
      return;
    }

    /* Déplacement (pas duplication) : retire la source si différente de la cible */
    if (srcDate && srcSlot && (srcDate !== destDate || srcSlot !== destSlot)) {
      clearSlot(srcDate, srcSlot);
    }

    assignDish(destDate, destSlot, dishId);
    render();
  }

  /* ══════════════════════════════════════════════════════════
     LISTE DE COURSES
     ══════════════════════════════════════════════════════════ */

  /** Formatte une quantité numérique sans zéros décimaux inutiles */
  function formatQty(qty) {
    if (qty % 1 === 0) return String(qty);
    return parseFloat(qty.toFixed(4)).toString();
  }

  /**
   * Calcule les totaux d'ingrédients pour la semaine affichée.
   * Règles :
   *   - Ignore les créneaux verrouillés (semaines adjacentes)
   *   - Ignore les repas libres (FREE_MEAL)
   *   - Pour les plats doubles : compte les ingrédients une seule fois
   *     (seenDouble évite le doublon de la seconde portion)
   * Retourne un tableau trié alphabétiquement.
   */
  function buildShoppingList() {
    const totals     = {};       // ingId → { ing, qty }
    const seenDouble = new Set(); // dishId des plats doubles déjà comptés

    days.forEach(dayInfo => {
      const dayData = getDayData(dayInfo.key);
      ['midi', 'soir'].forEach(slot => {
        /* Ignore les slots verrouillés (appartiennent aux semaines adjacentes) */
        if (slot === 'midi' && dayInfo.midiLocked) return;
        if (slot === 'soir' && dayInfo.soirLocked) return;
        const dishId = dayData[slot];
        if (!dishId || dishId === FREE_MEAL) return;
        const dish = Dishes.getById(dishId);
        if (!dish) return;
        /* Plat double : une seule préparation → on ne compte qu'une fois */
        if (dish.double) {
          if (seenDouble.has(dishId)) return;
          seenDouble.add(dishId);
        }
        dish.ingredients.forEach(item => {
          const ing = Ingredients.getById(item.id);
          if (!ing) return;
          if (!totals[item.id]) totals[item.id] = { ing, qty: 0 };
          totals[item.id].qty += item.qty;
        });
      });
    });

    return Object.values(totals).sort((a, b) => a.ing.name.localeCompare(b.ing.name, 'fr'));
  }

  /**
   * Ouvre la modale #modal-shopping avec la liste de courses de la semaine.
   * Chaque item est une checkbox cochable pour la faire au fur et à mesure.
   */
  function showShoppingList() {
    const items     = buildShoppingList();
    const weekRange = Dates.formatWeekRange(days);

    const titleEl = document.getElementById('shopping-title');
    if (titleEl) titleEl.textContent = 'Liste de courses — ' + weekRange;

    const bodyEl = document.getElementById('shopping-body');
    if (!bodyEl) return;

    if (!items.length) {
      bodyEl.innerHTML = '<p class="panel-empty" style="padding:16px 0;">Aucun plat planifié cette semaine.</p>';
      Modal.open('modal-shopping');
      return;
    }

    bodyEl.innerHTML =
      '<div class="shopping-list">' +
      items.map((item, i) =>
        '<label class="shopping-item">' +
          '<input type="checkbox" class="shopping-check" id="sc-' + i + '">' +
          '<span class="shopping-name">' + item.ing.name + '</span>' +
          '<span class="shopping-qty">' + formatQty(item.qty) + ' ' + item.ing.unit + '</span>' +
        '</label>'
      ).join('') +
      '</div>';

    /* Coche → ajoute la classe .checked sur la ligne pour la barrer visuellement */
    bodyEl.querySelectorAll('.shopping-check').forEach(cb => {
      cb.addEventListener('change', () => {
        cb.closest('.shopping-item').classList.toggle('checked', cb.checked);
      });
    });

    Modal.open('modal-shopping');
  }

  /* ── Modale de détail d'un plat ── */

  /**
   * Affiche la modale #modal-meal-detail avec le nom du plat,
   * son créneau, son statut "double" et la liste des ingrédients.
   */
  function showDetail(dish) {
    document.getElementById('meal-detail-title').textContent = dish.name;

    /* Tri alphabétique (fr-FR) des ingrédients avant affichage */
    const rows = dish.ingredients
      .map(item => ({ item, ing: Ingredients.getById(item.id) }))
      .filter(({ ing }) => ing !== null)
      .sort((a, b) => a.ing.name.localeCompare(b.ing.name, 'fr'))
      .map(({ item, ing }) =>
        '<tr><td>' + ing.name + '</td><td>' + item.qty + ' ' + ing.unit + '</td></tr>'
      ).join('');

    document.getElementById('meal-detail-body').innerHTML =
      '<div class="meal-detail-info">' +
        '<p>Créneau : <strong>' + Dishes.slotLabel(dish.slot) + '</strong></p>' +
        (dish.double ? '<p><strong>Plat double (2 portions)</strong></p>' : '') +
      '</div>' +
      (dish.ingredients.length
        ? '<table class="ingredient-table"><thead><tr><th>Ingrédient</th><th>Quantité</th></tr></thead><tbody>' + rows + '</tbody></table>'
        : '<p style="color:var(--ink-faint);">Aucun ingrédient renseigné.</p>');

    Modal.open('modal-meal-detail');
  }

  /* ── Utilitaire ── */

  /** Capitalise la première lettre d'une chaîne */
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ══════════════════════════════════════════════════════════
     GÉNÉRATION ALÉATOIRE DU PLANNING
     ══════════════════════════════════════════════════════════ */

  /**
   * Génère automatiquement les repas de la semaine affichée.
   *
   * Contraintes respectées :
   *   1. Les repas libres (FREE_MEAL) ne sont pas écrasés
   *   2. Les créneaux verrouillés (midiLocked / soirLocked) sont ignorés
   *   3. Le slot (midi / soir / both) de chaque plat est respecté
   *   4. Les plats avec excludeFromRandom = true sont exclus
   *   5. Chaque plat n'est utilisé qu'une seule fois (sauf double)
   *   6. Les plats doubles requièrent deux créneaux compatibles
   *      séparés de moins de 72h
   *
   * Algorithme :
   *   - Mélange aléatoire de la liste de plats éligibles
   *   - Attribution gloutonne slot par slot
   *   - Pour les plats doubles : recherche du deuxième créneau le plus proche
   */
  function generateWeek() {
    if (!confirm('Générer les plats de la semaine ? Les repas libres seront conservés, les autres créneaux seront remplacés.')) return;

    /* ── 1. Collecte des créneaux à remplir (non verrouillés, non libres) ── */
    const slots = [];
    days.forEach(dayInfo => {
      ['midi', 'soir'].forEach(slot => {
        if (slot === 'midi' && dayInfo.midiLocked) return;
        if (slot === 'soir' && dayInfo.soirLocked) return;
        if (planningData[dayInfo.key]?.[slot] === FREE_MEAL) return;
        slots.push({ dayInfo, slot });
      });
    });

    /* ── 2. Plats éligibles (non exclus de la génération aléatoire) ── */
    const eligible = Dishes.getAll().filter(d => !d.excludeFromRandom);
    if (!eligible.length) {
      Toast.error('Aucun plat disponible pour la génération. Activez l\'option "Aléatoire" sur vos plats.');
      return;
    }

    /* ── 3. Mélange aléatoire de la liste ── */
    const shuffled = eligible.slice().sort(() => Math.random() - 0.5);

    /* ── 4. Fonctions utilitaires ── */

    /** Clé unique d'un créneau : "YYYY-MM-DD|midi" ou "YYYY-MM-DD|soir" */
    const slotKey = (dayInfo, slot) => `${dayInfo.key}|${slot}`;

    /** Timestamp en ms du créneau (12h pour midi, 19h pour soir) */
    const slotMs  = (dayInfo, slot) => {
      const d = new Date(dayInfo.date);
      d.setHours(slot === 'midi' ? 12 : 19, 0, 0, 0);
      return d.getTime();
    };

    const MS72H = 72 * 3600 * 1000; // fenêtre temporelle pour les plats doubles

    /* ── 5. Pré-marquage des créneaux déjà occupés (repas libres) ── */
    const filledKeys = new Set();
    days.forEach(dayInfo => {
      ['midi', 'soir'].forEach(slot => {
        if (slot === 'midi' && dayInfo.midiLocked) return;
        if (slot === 'soir' && dayInfo.soirLocked) return;
        if (planningData[dayInfo.key]?.[slot] === FREE_MEAL) {
          filledKeys.add(slotKey(dayInfo, slot));
        }
      });
    });

    /* ── 6. Attribution gloutonne ── */
    const result      = {};         // slotKey → dishId
    const usedDishIds = new Set();  // plats déjà attribués

    for (const { dayInfo, slot } of slots) {
      const k1 = slotKey(dayInfo, slot);
      if (filledKeys.has(k1)) continue; // créneau déjà pris
      const t1 = slotMs(dayInfo, slot);

      /* Trouve le premier plat mélangé qui satisfait toutes les contraintes */
      const candidate = shuffled.find(dish => {
        if (usedDishIds.has(dish.id)) return false;
        if (!canAssign(dish, slot, dayInfo)) return false;
        if (dish.double) {
          /* Plat double : exige au moins un deuxième créneau libre et compatible dans les 72h */
          return slots.some(({ dayInfo: d2, slot: s2 }) => {
            const k2 = slotKey(d2, s2);
            return k2 !== k1 &&
                   !filledKeys.has(k2) &&
                   canAssign(dish, s2, d2) &&
                   Math.abs(slotMs(d2, s2) - t1) <= MS72H;
          });
        }
        return true;
      });

      if (!candidate) continue; // aucun plat compatible pour ce créneau

      if (candidate.double) {
        /* Choisit le deuxième créneau le plus proche temporellement */
        const second = slots
          .filter(({ dayInfo: d2, slot: s2 }) => {
            const k2 = slotKey(d2, s2);
            return k2 !== k1 &&
                   !filledKeys.has(k2) &&
                   canAssign(candidate, s2, d2) &&
                   Math.abs(slotMs(d2, s2) - t1) <= MS72H;
          })
          .sort((a, b) =>
            Math.abs(slotMs(a.dayInfo, a.slot) - t1) -
            Math.abs(slotMs(b.dayInfo, b.slot) - t1)
          )[0];

        /* Attribue les deux portions */
        result[k1] = candidate.id;
        result[slotKey(second.dayInfo, second.slot)] = candidate.id;
        filledKeys.add(k1);
        filledKeys.add(slotKey(second.dayInfo, second.slot));
      } else {
        result[k1] = candidate.id;
        filledKeys.add(k1);
      }

      usedDishIds.add(candidate.id);
    }

    /* ── 7. Application des résultats au planning ── */
    Object.entries(result).forEach(([key, dishId]) => {
      const pipe    = key.indexOf('|');
      const dateKey = key.substring(0, pipe);
      const slot    = key.substring(pipe + 1);
      assignDish(dateKey, slot, dishId);
    });

    render();

    /* Feedback : indique si tous les créneaux ont pu être remplis */
    const filled = Object.keys(result).length;
    const total  = slots.length;
    if (filled < total) {
      Toast.info(`Planning généré (${filled}/${total} créneaux — plats insuffisants pour les autres).`);
    } else {
      Toast.success('Planning généré !');
    }
  }

  /* ══════════════════════════════════════════════════════════
     COMPTAGE D'UTILISATION (pour les highlights de la sidebar)
     ══════════════════════════════════════════════════════════ */

  /**
   * Retourne le nombre de fois qu'un plat est placé dans la semaine affichée.
   * Ignore les créneaux verrouillés (vendredi S0 midi et S+1 soir).
   */
  function countUsedThisWeek(dishId) {
    let count = 0;
    days.forEach(dayInfo =>
      ['midi', 'soir'].forEach(slot => {
        if (slot === 'midi' && dayInfo.midiLocked) return;
        if (slot === 'soir' && dayInfo.soirLocked) return;
        if (planningData[dayInfo.key]?.[slot] === dishId) count++;
      })
    );
    return count;
  }

  /** Retourne true si le plat est utilisé au moins une fois cette semaine */
  function isUsedThisWeek(dishId) { return countUsedThisWeek(dishId) > 0; }

  /* ── Initialisation ── */

  /**
   * Charge les données, purge les anciennes semaines, dessine la grille
   * et câble tous les boutons de la barre d'outils du planning.
   */
  function init() {
    load();
    purgeOldWeeks();
    render();
    updateLabel();

    document.getElementById('btn-clear-week')
      ?.addEventListener('click', () => {
        if (confirm('Vider tous les repas du planning affiché ?')) clearCurrentWeek();
      });
    document.getElementById('btn-generate')      ?.addEventListener('click', generateWeek);
    document.getElementById('btn-prev-week')      ?.addEventListener('click', goToPrevWeek);
    document.getElementById('btn-next-week')      ?.addEventListener('click', goToNextWeek);
    document.getElementById('btn-week-current')   ?.addEventListener('click', goToCurrentWeek);
    document.getElementById('btn-shopping-list')  ?.addEventListener('click', showShoppingList);
  }

  /* ── API publique ── */
  return { init, load, render, assignDish, clearSlot, FREE_MEAL, isUsedThisWeek, countUsedThisWeek };
})();
