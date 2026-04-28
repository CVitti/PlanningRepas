/* ═══════════════════════════════════════════════════════════
   js/components/sidebar.js — Draggable dish list + filters
   ═══════════════════════════════════════════════════════════ */

const Sidebar = (() => {

  let activeFilter = 'all';

  /* ── Filter ── */
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

  function filterDishes(dishes) {
    if (activeFilter === 'all')    return dishes;
    if (activeFilter === 'double') return dishes.filter(d => d.double);
    return dishes.filter(d => d.slot === activeFilter || d.slot === 'both');
  }

  /* ── Slot icons ── */
  function slotIcons(slot) {
    const sun  = '<span class="slot-icon slot-icon-midi">☀</span>';
    const moon = '<span class="slot-icon slot-icon-soir">☽</span>';
    if (slot === 'midi') return sun;
    if (slot === 'soir') return moon;
    return sun + moon;
  }

  /* ── Render ── */
  function render() {
    const container = document.getElementById('dish-list');
    if (!container) return;

    const all      = Dishes.getAll();
    const filtered = filterDishes(all).slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    if (!filtered.length) {
      container.innerHTML = `
        <div class="dish-list-empty">
          <strong>Aucun plat</strong>
          Cliquez sur <em>+ Nouveau</em> pour créer votre premier plat.
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(dish => `
      <div class="dish-item"
           draggable="true"
           data-dish-id="${dish.id}"
           title="Glissez pour assigner">
        <div class="dish-item-name">${dish.name}</div>
        <div class="dish-item-footer">
          <div class="dish-item-slots">${slotIcons(dish.slot)}</div>
          ${dish.double ? '<span class="dish-double-badge">\xd72</span>' : ''}
        </div>
        <div class="dish-item-actions">
          <button class="dish-action dish-action-edit" data-id="${dish.id}" title="Modifier">✎</button>
          <button class="dish-action dish-action-delete" data-id="${dish.id}" title="Supprimer">✕</button>
        </div>
      </div>
    `).join('');

    /* Attach drag + action events */
    container.querySelectorAll('.dish-item').forEach(el => {
      el.addEventListener('dragstart', onDragStart);
      el.addEventListener('dragend',   onDragEnd);
    });

    container.querySelectorAll('.dish-action-edit').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        Dishes._startEdit(btn.dataset.id);
      });
    });

    container.querySelectorAll('.dish-action-delete').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (confirm('Supprimer ce plat ?')) Dishes.remove(btn.dataset.id);
      });
    });
  }

  /* ── Drag handlers ── */
  function onDragStart(e) {
    const dishId = this.dataset.dishId;
    e.dataTransfer.effectAllowed = 'all';
    e.dataTransfer.setData('text/dish-id', dishId);
    e.dataTransfer.setData('text/plain',   dishId);

    this.classList.add('dragging');

    /* Ghost image */
    const ghost = this.cloneNode(true);
    ghost.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:220px;opacity:.85;';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 20, 20);
    setTimeout(() => ghost.remove(), 0);
  }

  function onDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.meal-slot.drag-over').forEach(s => s.classList.remove('drag-over'));
  }

  function init() {
    initFilters();
    render();
    document.getElementById('btn-new-dish')
      ?.addEventListener('click', () => Dishes.openCreate());
  }

  return { init, render };
})();
