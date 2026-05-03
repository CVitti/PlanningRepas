/* ═══════════════════════════════════════════════════════════
   js/components/sidebar.js — Liste de plats (sidebar) + filtres
   ═══════════════════════════════════════════════════════════

   Affiche la liste des plats dans la colonne de droite.
   Chaque carte est draggable vers un créneau du planning.

   Fonctionnalités :
     - Filtres par créneau (Tous / Midi / Soir / ×2)
     - Tri alphabétique (fr-FR)
     - Mise en évidence des plats déjà planifiés :
         dish-item--in-use    → au moins une portion posée
         dish-item--partial   → 1 portion sur 2 d'un plat double posée
     - Overlay d'actions au survol : modifier (✎) et supprimer (✕)
     - Drag & drop avec image fantôme personnalisée
   ═══════════════════════════════════════════════════════════ */

const Sidebar = (() => {

  let activeFilter = 'all'; // filtre actif : 'all' | 'midi' | 'soir' | 'double'

  /* ── Filtres ── */

  /** Câble les onglets de filtre et redessine la liste à chaque changement */
  function initFilters() {
    document.querySelectorAll('.filter-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        render();
      });
    });
  }

  /**
   * Retourne les plats correspondant au filtre actif :
   *   all    → tous les plats
   *   double → plats avec l'option "double portion"
   *   midi / soir → plats compatibles avec ce créneau (slot === filtre ou === 'both')
   */
  function filterDishes(dishes) {
    if (activeFilter === 'all')    return dishes;
    if (activeFilter === 'double') return dishes.filter(d => d.double);
    return dishes.filter(d => d.slot === activeFilter || d.slot === 'both');
  }

  /* ── Icônes de créneaux ── */

  /**
   * Retourne le HTML des icônes ☀ (midi) et/ou 🌙 (soir)
   * selon le créneau d'un plat.
   */
  function slotIcons(slot) {
    const sun  = '<span class="slot-icon slot-icon-midi">☀</span>';
    const moon = '<span class="slot-icon slot-icon-soir">🌙</span>';
    if (slot === 'midi') return sun;
    if (slot === 'soir') return moon;
    return sun + moon; // 'both'
  }

  /* ── Rendu ── */

  /**
   * Reconstruit la liste #dish-list avec les cartes filtrées et triées.
   *
   * Classes de mise en évidence :
   *   dish-item--in-use  → plat utilisé dans la semaine affichée
   *   dish-item--partial → plat double avec seulement 1 portion posée
   *
   * Après injection du HTML, câble les événements :
   *   - dragstart / dragend sur chaque carte
   *   - clic sur ✎ → ouvre la modale d'édition du plat
   *   - clic sur ✕ → confirmation puis suppression
   */
  function render() {
    const container = document.getElementById('dish-list');
    if (!container) return;

    const all      = Dishes.getAll();
    const filtered = filterDishes(all).slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    /* État vide */
    if (!filtered.length) {
      container.innerHTML = `
        <div class="dish-list-empty">
          <strong>Aucun plat</strong>
          Cliquez sur <em>+ Nouveau</em> pour créer votre premier plat.
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(dish => {
      /* Nombre de fois que le plat est placé dans la semaine courante */
      const count     = typeof Planning !== 'undefined' ? Planning.countUsedThisWeek(dish.id) : 0;
      const inUse     = count > 0;
      const isPartial = dish.double && count === 1; // double avec une seule portion placée
      return `
      <div class="dish-item${inUse ? ' dish-item--in-use' : ''}${isPartial ? ' dish-item--partial' : ''}"
           draggable="true"
           data-dish-id="${dish.id}"
           title="Glissez pour assigner">
        <div class="dish-item-name">${dish.name}</div>
        <div class="dish-item-footer">
          <div class="dish-item-slots">${slotIcons(dish.slot)}</div>
          ${dish.double ? '<span class="dish-double-badge">\xd72</span>' : ''}
        </div>
        <div class="dish-item-actions">
          <button class="dish-action dish-action-edit"   data-id="${dish.id}" title="Modifier">✎</button>
          <button class="dish-action dish-action-delete" data-id="${dish.id}" title="Supprimer">✕</button>
        </div>
      </div>
    `;
    }).join('');

    /* ── Câblage des événements ── */

    /* Drag & drop */
    container.querySelectorAll('.dish-item').forEach(el => {
      el.addEventListener('dragstart', onDragStart);
      el.addEventListener('dragend',   onDragEnd);
    });

    /* Bouton modifier → ouvre la modale de plat en mode édition */
    container.querySelectorAll('.dish-action-edit').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        Dishes._startEdit(btn.dataset.id);
      });
    });

    /* Bouton supprimer → confirmation avant suppression */
    container.querySelectorAll('.dish-action-delete').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (confirm('Supprimer ce plat ?')) Dishes.remove(btn.dataset.id);
      });
    });
  }

  /* ── Drag handlers ── */

  /**
   * Démarre le drag :
   *   - stocke l'identifiant du plat dans dataTransfer (deux types pour compatibilité)
   *   - génère une image fantôme hors-écran
   *   - marque la carte comme "en cours de drag"
   */
  function onDragStart(e) {
    const dishId = this.dataset.dishId;
    e.dataTransfer.effectAllowed = 'all';
    e.dataTransfer.setData('text/dish-id', dishId);
    e.dataTransfer.setData('text/plain',   dishId);

    this.classList.add('dragging');

    /* Crée un clone hors-écran comme image de drag personnalisée */
    const ghost = this.cloneNode(true);
    ghost.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:220px;opacity:.85;';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 20, 20);
    setTimeout(() => ghost.remove(), 0); // supprime le clone après utilisation
  }

  /** Retire la classe "dragging" et nettoie les indicateurs visuels sur les slots */
  function onDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.meal-slot.drag-over').forEach(s => s.classList.remove('drag-over'));
  }

  /* ── Initialisation ── */

  /**
   * Active les filtres, dessine la liste et câble le bouton "+ Nouveau"
   * qui ouvre la modale de création de plat.
   */
  function init() {
    initFilters();
    render();
    document.getElementById('btn-new-dish')
      ?.addEventListener('click', () => Dishes.openCreate());
  }

  return { init, render };
})();
