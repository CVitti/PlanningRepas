/* ═══════════════════════════════════════════════════════════
   js/components/planning.js
   ═══════════════════════════════════════════════════════════ */

const Planning = (() => {

  let planningData    = {};
  let days            = [];
  let weekOffset      = 0;

  /* ── SPECIAL VALUES ── */
  const FREE_MEAL = '__free__'; // repas marqué "libre"

  /* ── Storage ── */
  function load() {
    planningData = Storage.get('planning', {});
    days = Dates.getPlanningDays(weekOffset);
  }

  function save() { Storage.set('planning', planningData); }

  function getDayData(key) { return planningData[key] || {}; }

  function assignDish(dateKey, slot, value) {
    if (!planningData[dateKey]) planningData[dateKey] = {};
    planningData[dateKey][slot] = value;
    save();
  }

  function clearSlot(dateKey, slot) {
    if (!planningData[dateKey]) return;
    delete planningData[dateKey][slot];
    if (!Object.keys(planningData[dateKey]).length) delete planningData[dateKey];
    save();
  }

  /* ── Week navigation ── */
  function goToPrevWeek()    { weekOffset = Math.max(-1, weekOffset - 1); days = Dates.getPlanningDays(weekOffset); render(); updateLabel(); }
  function goToNextWeek()    { weekOffset = Math.min( 1, weekOffset + 1); days = Dates.getPlanningDays(weekOffset); render(); updateLabel(); }
  function goToCurrentWeek() { weekOffset = 0; days = Dates.getPlanningDays(0); render(); updateLabel(); }

  /* ── Purge S-2 and older at startup ── */
  function purgeOldWeeks() {
    const cutoff = Dates.formatKey(Dates.addDays(Dates.getStartFriday(), -7));
    Object.keys(planningData).forEach(key => {
      if (key < cutoff) delete planningData[key];
    });
    save();
  }

  /* ── Portion index for double dishes ── */
  function getPortionIndex(dishId, dateKey, slot) {
    const dish = Dishes.getById(dishId);
    if (!dish || !dish.double) return null;

    const placements = [];
    Object.keys(planningData).sort().forEach(dk => {
      ['midi', 'soir'].forEach(s => {
        if (planningData[dk]?.[s] === dishId) placements.push({ dk, s });
      });
    });

    if (placements.length < 2) return null;
    const idx = placements.findIndex(p => p.dk === dateKey && p.s === slot);
    return idx === -1 ? null : idx + 1;
  }

  function clearCurrentWeek() {
    days.forEach(d => { clearSlot(d.key, 'midi'); clearSlot(d.key, 'soir'); });
    render();
    Toast.info('Planning vide.');
  }

  function updateLabel() {
    const el = document.getElementById('week-label');
    if (el) el.textContent = Dates.formatWeekRange(Dates.getPlanningDays(weekOffset));
    const show = (id, visible) => {
      const btn = document.getElementById(id);
      if (btn) btn.style.display = visible ? '' : 'none';
    };
    show('btn-prev-week',    weekOffset !== -1);
    show('btn-week-current', weekOffset !==  0);
    show('btn-next-week',    weekOffset !==  1);
  }

  /* ── Slot compatibility ── */
  function canAssign(dish, slot, dayInfo) {
    if (slot === 'midi' && dayInfo.midiLocked) return false;
    if (slot === 'soir' && dayInfo.soirLocked) return false;
    if (dish.slot === 'both') return true;
    return dish.slot === slot;
  }

  /* ── Past detection ── */
  function isPast(dateKey, slot) {
    const now  = new Date();
    const date = new Date(dateKey + 'T00:00:00');
    const cutoff = new Date(date);
    cutoff.setHours(slot === 'midi' ? 14 : 21, 0, 0, 0);
    return now > cutoff;
  }

  /* ── Render ── */
  function render() {
    const grid = document.getElementById('planning-grid');
    if (!grid) return;
    grid.innerHTML = '';

    days.forEach(dayInfo => {
      const dayData = getDayData(dayInfo.key);
      const col = document.createElement('div');
      col.className = 'day-column' + (dayInfo.isWeekend ? ' weekend' : '');

      const hdr = document.createElement('div');
      hdr.className = 'day-header' + (dayInfo.isToday ? ' today' : '');
      hdr.innerHTML = '<span class="day-name">' + cap(dayInfo.dayName) + '</span>' +
                      '<span class="day-date">' + dayInfo.label + '</span>';
      col.appendChild(hdr);
      col.appendChild(buildSlot(dayInfo, 'midi', dayData.midi));
      col.appendChild(buildSlot(dayInfo, 'soir', dayData.soir));
      grid.appendChild(col);
    });

    initDropZones();
  }

  function buildSlot(dayInfo, slot, value) {
    const locked = (slot === 'midi' && dayInfo.midiLocked) ||
                   (slot === 'soir' && dayInfo.soirLocked);
    const past   = !locked && isPast(dayInfo.key, slot);

    const el = document.createElement('div');
    el.className = 'meal-slot' +
                   (locked ? ' locked' : '') +
                   (past   ? ' past'   : '');
    el.dataset.date = dayInfo.key;
    el.dataset.slot = slot;

    const lbl = document.createElement('div');
    lbl.className = 'meal-slot-label';
    lbl.textContent = slot === 'midi' ? '\u2600 Midi' : '\uD83C\uDF19 Soir';
    el.appendChild(lbl);

    if (locked) return el;

    if (value === FREE_MEAL) {
      el.appendChild(buildFreeCard(dayInfo.key, slot));
    } else if (value) {
      el.appendChild(buildMealCard(dayInfo.key, slot, value));
    } else {
      el.appendChild(buildHint());
    }

    return el;
  }

  /* ── Hint (empty slot) ── */
  function buildHint() {
    const hint = document.createElement('div');
    hint.className = 'slot-hint';
    hint.innerHTML = '<span>Deposez un plat</span><button class="btn-free-meal" title="Marquer comme libre">Libre</button>';
    hint.querySelector('.btn-free-meal').addEventListener('click', e => {
      e.stopPropagation();
      const slotEl = e.target.closest('.meal-slot');
      assignDish(slotEl.dataset.date, slotEl.dataset.slot, FREE_MEAL);
      render();
    });
    return hint;
  }

  /* ── Free meal card ── */
  function buildFreeCard(dateKey, slot) {
    const card = document.createElement('div');
    card.className = 'meal-card meal-card-free';
    card.innerHTML =
      '<div class="meal-card-name free-label">\u2728 Repas libre</div>' +
      '<button class="meal-card-remove" title="Retirer">\u2715</button>';

    card.querySelector('.meal-card-remove').addEventListener('click', e => {
      e.stopPropagation();
      clearSlot(dateKey, slot);
      render();
    });
    return card;
  }

  /* ── Meal card ── */
  function buildMealCard(dateKey, slot, dishId) {
    const dish = Dishes.getById(dishId);
    if (!dish) { clearSlot(dateKey, slot); return document.createTextNode(''); }

    const card = document.createElement('div');
    card.className = 'meal-card';
    card.draggable  = true;
    card.dataset.dishId = dishId;
    card.dataset.date   = dateKey;
    card.dataset.slot   = slot;

    const rmBtn = document.createElement('button');
    rmBtn.className = 'meal-card-remove';
    rmBtn.title     = 'Retirer ce plat';
    rmBtn.textContent = '\u2715';

    const nameEl = document.createElement('div');
    nameEl.className = 'meal-card-name';
    nameEl.textContent = dish.name;

    const badges = document.createElement('div');
    badges.className = 'meal-card-badges';
    if (dish.double) {
      const b = document.createElement('span');
      const portionIdx = getPortionIndex(dishId, dateKey, slot);
      if (portionIdx !== null) {
        b.className = 'badge badge-portion';
        b.textContent = 'P' + portionIdx;
      } else {
        b.className = 'badge badge-double';
        b.textContent = '\xd72 portions';
      }
      badges.appendChild(b);
    }

    card.appendChild(rmBtn);
    card.appendChild(nameEl);
    card.appendChild(badges);

    card.addEventListener('click', e => {
      if (e.target === rmBtn || rmBtn.contains(e.target)) return;
      if (card.classList.contains('is-dragging')) return;
      showDetail(dish);
    });

    rmBtn.addEventListener('click', e => {
      e.stopPropagation();
      clearSlot(dateKey, slot);
      render();
    });

    /* Drag from planning card */
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

  /* ── Drop zones ── */
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
    if (!this.contains(e.relatedTarget)) this.classList.remove('drag-over');
  }

  function onDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');

    /* Récupérer dishId depuis les deux MIME types possibles */
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
      Toast.error(dish.name + ' n\'est pas disponible pour ce creneau.');
      return;
    }

    /* Libérer la source si c'est un déplacement depuis le planning */
    if (srcDate && srcSlot && (srcDate !== destDate || srcSlot !== destSlot)) {
      clearSlot(srcDate, srcSlot);
    }

    assignDish(destDate, destSlot, dishId);
    render();
  }

  /* ── Detail modal ── */
  function showDetail(dish) {
    document.getElementById('meal-detail-title').textContent = dish.name;
    const rows = dish.ingredients.map(item => {
      const ing = Ingredients.getById(item.id);
      return ing ? '<tr><td>' + ing.name + '</td><td>' + item.qty + ' ' + ing.unit + '</td></tr>' : '';
    }).join('');

    document.getElementById('meal-detail-body').innerHTML =
      '<div class="meal-detail-info">' +
        '<p>Creneau\u00a0: <strong>' + Dishes.slotLabel(dish.slot) + '</strong></p>' +
        (dish.double ? '<p><strong>Plat double (2 portions)</strong></p>' : '') +
      '</div>' +
      (dish.ingredients.length
        ? '<table class="ingredient-table"><thead><tr><th>Ingredient</th><th>Quantite</th></tr></thead><tbody>' + rows + '</tbody></table>'
        : '<p style="color:var(--ink-faint);">Aucun ingredient renseigne.</p>');

    Modal.open('modal-meal-detail');
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ── Init ── */
  function init() {
    load();
    purgeOldWeeks();
    render();
    updateLabel();

    document.getElementById('btn-clear-week')
      ?.addEventListener('click', () => {
        if (confirm('Vider tous les repas du planning affiche ?')) clearCurrentWeek();
      });
    document.getElementById('btn-prev-week')    ?.addEventListener('click', goToPrevWeek);
    document.getElementById('btn-next-week')    ?.addEventListener('click', goToNextWeek);
    document.getElementById('btn-week-current') ?.addEventListener('click', goToCurrentWeek);
  }

  return { init, load, render, assignDish, clearSlot, FREE_MEAL };
})();
