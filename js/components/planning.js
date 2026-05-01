/* ═══════════════════════════════════════════════════════════
   js/components/planning.js
   ═══════════════════════════════════════════════════════════ */

const Planning = (() => {

  let planningData    = {};
  let days            = [];
  let weekOffset      = 0;

  /* ── SPECIAL VALUES ── */
  const FREE_MEAL = '__free__'; // repas marque "libre"

  /* ── Storage ── */
  function load() {
    planningData = Storage.get('planning', {});
    days = Dates.getPlanningDays(weekOffset);
  }

  function save() { Storage.set('planning', planningData); }

  function getDayData(key) { return planningData[key] || {}; }

  function getNote(dateKey, slot) {
    return planningData[dateKey]?.[slot + '_note'] || '';
  }
  function setNote(dateKey, slot, text) {
    if (!planningData[dateKey]) planningData[dateKey] = {};
    if (text) {
      planningData[dateKey][slot + '_note'] = text;
    } else {
      delete planningData[dateKey][slot + '_note'];
    }
    save();
  }

  function assignDish(dateKey, slot, value) {
    if (!planningData[dateKey]) planningData[dateKey] = {};
    planningData[dateKey][slot] = value;
    save();
  }

  function clearSlot(dateKey, slot) {
    if (!planningData[dateKey]) return;
    delete planningData[dateKey][slot];
    delete planningData[dateKey][slot + '_note'];
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

    // Restreint aux slots visibles et non-verrouillés de la semaine affichée
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

    if (placements.length < 2) return null;
    const idx = placements.findIndex(p => p.dk === dateKey && p.s === slot);
    return idx === -1 ? null : idx + 1;
  }

  function clearCurrentWeek() {
    days.forEach(d => {
      if (!d.midiLocked) clearSlot(d.key, 'midi');
      if (!d.soirLocked) clearSlot(d.key, 'soir');
    });
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
    /* Sync sidebar "in-use" highlights after every planning render */
    if (typeof Sidebar !== 'undefined') Sidebar.render();
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
    lbl.innerHTML = slot === 'midi'
      ? '<span class="slot-icon slot-icon-midi">☀</span><span>Midi</span>'
      : '<span class="slot-icon slot-icon-soir">🌙</span><span>Soir</span>';
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

    /* Header: label + remove button */
    const header = document.createElement('div');
    header.className = 'free-card-header';

    const label = document.createElement('div');
    label.className = 'meal-card-name free-label';
    label.textContent = '✨ Repas libre';

    const rmBtn = document.createElement('button');
    rmBtn.className = 'meal-card-remove free-card-remove';
    rmBtn.title = 'Retirer';
    rmBtn.textContent = '✕';
    rmBtn.addEventListener('click', e => {
      e.stopPropagation();
      clearSlot(dateKey, slot);
      render();
    });

    header.appendChild(label);
    header.appendChild(rmBtn);

    /* Note textarea */
    const noteEl = document.createElement('textarea');
    noteEl.className = 'free-meal-note';
    noteEl.placeholder = 'Note…';
    noteEl.value = getNote(dateKey, slot);
    noteEl.addEventListener('input', () => setNote(dateKey, slot, noteEl.value));
    noteEl.addEventListener('click',     e => e.stopPropagation());
    noteEl.addEventListener('mousedown', e => e.stopPropagation());

    card.appendChild(header);
    card.appendChild(noteEl);

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
    rmBtn.textContent = '✕';

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

    if (srcDate && srcSlot && (srcDate !== destDate || srcSlot !== destSlot)) {
      clearSlot(srcDate, srcSlot);
    }

    assignDish(destDate, destSlot, dishId);
    render();
  }

  /* ── Shopping list ── */
  function formatQty(qty) {
    if (qty % 1 === 0) return String(qty);
    return parseFloat(qty.toFixed(4)).toString();
  }

  function buildShoppingList() {
    const totals    = {}; // ingId -> { ing, qty }
    const seenDouble = new Set();

    days.forEach(dayInfo => {
      const dayData = getDayData(dayInfo.key);
      ['midi', 'soir'].forEach(slot => {
        // Ignorer les slots verrouillés (appartiennent aux semaines adjacentes)
        if (slot === 'midi' && dayInfo.midiLocked) return;
        if (slot === 'soir' && dayInfo.soirLocked) return;
        const dishId = dayData[slot];
        if (!dishId || dishId === FREE_MEAL) return;
        const dish = Dishes.getById(dishId);
        if (!dish) return;
        // Plat double : une seule preparation pour la semaine
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

  function showShoppingList() {
    const items = buildShoppingList();
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
          '<span class="shopping-qty">' + formatQty(item.qty) + ' ' + item.ing.unit + '</span>' +
        '</label>'
      ).join('') +
      '</div>';

    bodyEl.querySelectorAll('.shopping-check').forEach(cb => {
      cb.addEventListener('change', () => {
        cb.closest('.shopping-item').classList.toggle('checked', cb.checked);
      });
    });

    Modal.open('modal-shopping');
  }

  /* ── Detail modal ── */
  function showDetail(dish) {
    document.getElementById('meal-detail-title').textContent = dish.name;
    const rows = dish.ingredients.map(item => {
      const ing = Ingredients.getById(item.id);
      return ing ? '<tr><td>' + ing.name + '</td><td>' + item.qty + ' ' + ing.unit + '</td></tr>' : '';
    }).join('');

    document.getElementById('meal-detail-body').innerHTML =
      '<div class="meal-detail-info">' +
        '<p>Créneau : <strong>' + Dishes.slotLabel(dish.slot) + '</strong></p>' +
        (dish.double ? '<p><strong>Plat double (2 portions)</strong></p>' : '') +
      '</div>' +
      (dish.ingredients.length
        ? '<table class="ingredient-table"><thead><tr><th>Ingrédient</th><th>Quantité</th></tr></thead><tbody>' + rows + '</tbody></table>'
        : '<p style="color:var(--ink-faint);">Aucun ingrédient renseigné.</p>');

    Modal.open('modal-meal-detail');
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ── Random week generation ── */
  function generateWeek() {
    if (!confirm('Générer les plats de la semaine ? Les repas libres seront conservés, les autres créneaux seront remplacés.')) return;

    /* 1. Collect fillable slots (non-locked, non-libre) */
    const slots = [];
    days.forEach(dayInfo => {
      ['midi', 'soir'].forEach(slot => {
        if (slot === 'midi' && dayInfo.midiLocked) return;
        if (slot === 'soir' && dayInfo.soirLocked) return;
        if (planningData[dayInfo.key]?.[slot] === FREE_MEAL) return;
        slots.push({ dayInfo, slot });
      });
    });

    /* 2. Eligible dishes (not excluded from random) */
    const eligible = Dishes.getAll().filter(d => !d.excludeFromRandom);
    if (!eligible.length) {
      Toast.error('Aucun plat disponible pour la génération. Activez l\'option "Aléatoire" sur vos plats.');
      return;
    }

    /* 3. Shuffle eligible list */
    const shuffled = eligible.slice().sort(() => Math.random() - 0.5);

    /* 4. Helpers */
    const slotKey = (dayInfo, slot) => `${dayInfo.key}|${slot}`;
    const slotMs  = (dayInfo, slot) => {
      const d = new Date(dayInfo.date);
      d.setHours(slot === 'midi' ? 12 : 19, 0, 0, 0);
      return d.getTime();
    };
    const MS72H = 72 * 3600 * 1000;

    /* 5. Pre-fill occupied keys (libre slots = already taken) */
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

    /* 6. Greedy assignment */
    const result      = {}; // key -> dishId
    const usedDishIds = new Set();

    for (const { dayInfo, slot } of slots) {
      const k1 = slotKey(dayInfo, slot);
      if (filledKeys.has(k1)) continue;
      const t1 = slotMs(dayInfo, slot);

      /* Find first compatible unused dish */
      const candidate = shuffled.find(dish => {
        if (usedDishIds.has(dish.id)) return false;
        if (!canAssign(dish, slot, dayInfo)) return false;
        if (dish.double) {
          /* Require at least one free compatible second slot within 72 h */
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

      if (!candidate) continue;

      if (candidate.double) {
        /* Pick closest free second slot within 72 h */
        const second = slots
          .filter(({ dayInfo: d2, slot: s2 }) => {
            const k2 = slotKey(d2, s2);
            return k2 !== k1 &&
                   !filledKeys.has(k2) &&
                   canAssign(candidate, s2, d2) &&
                   Math.abs(slotMs(d2, s2) - t1) <= MS72H;
          })
          .sort((a, b) => Math.abs(slotMs(a.dayInfo, a.slot) - t1) - Math.abs(slotMs(b.dayInfo, b.slot) - t1))[0];

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

    /* 7. Apply to planning */
    Object.entries(result).forEach(([key, dishId]) => {
      const pipe    = key.indexOf('|');
      const dateKey = key.substring(0, pipe);
      const slot    = key.substring(pipe + 1);
      assignDish(dateKey, slot, dishId);
    });

    render();

    const filled = Object.keys(result).length;
    const total  = slots.length;
    if (filled < total) {
      Toast.info(`Planning généré (${filled}/${total} créneaux — plats insuffisants pour les autres).`);
    } else {
      Toast.success('Planning généré !');
    }
  }

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
    document.getElementById('btn-generate')     ?.addEventListener('click', generateWeek);
    document.getElementById('btn-prev-week')    ?.addEventListener('click', goToPrevWeek);
    document.getElementById('btn-next-week')    ?.addEventListener('click', goToNextWeek);
    document.getElementById('btn-week-current') ?.addEventListener('click', goToCurrentWeek);
    document.getElementById('btn-shopping-list')?.addEventListener('click', showShoppingList);
  }

  /* ── Vérifie si un plat est posé au moins une fois dans la semaine affichée ── */
  function isUsedThisWeek(dishId) {
    return days.some(dayInfo =>
      ['midi', 'soir'].some(slot => {
        if (slot === 'midi' && dayInfo.midiLocked) return false;
        if (slot === 'soir' && dayInfo.soirLocked) return false;
        return planningData[dayInfo.key]?.[slot] === dishId;
      })
    );
  }

  return { init, load, render, assignDish, clearSlot, FREE_MEAL, isUsedThisWeek };
})();
