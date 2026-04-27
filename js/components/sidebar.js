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
          Créez vos premiers plats avec le bouton <em>⊕ Plats</em>.
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
        <div class="dish-item-meta">
          <span class="slot-pill ${Dishes.slotClass(dish.slot)}">${Dishes.slotLabel(dish.slot)}</span>
          ${dish.double ? '<span class="badge badge-double">\xd72</span>' : ''}
        </div>
        <span class="drag-handle">⠿⠿</span>
      </div>
    `).join('');

    /* Attach drag events */
    container.querySelectorAll('.dish-item').forEach(el => {
      el.addEventListener('dragstart', onDragStart);
      el.addEventListener('dragend',   onDragEnd);
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
  }

  return { init, render };
})();
