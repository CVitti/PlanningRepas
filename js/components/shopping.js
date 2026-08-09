/* ═══════════════════════════════════════════════════════════
   js/components/shopping.js — Liste de courses persistante
   ═══════════════════════════════════════════════════════════

   Modèle de données (Storage key : 'shoppingList') :
   [{ id, name, ingId|null, categoryId|null, qty|null, unit, checked }]

   Import depuis le planning : lit Storage directement pour calculer
   les totaux d'ingrédients sans toucher à l'état d'affichage du planning.
   ═══════════════════════════════════════════════════════════ */

const Shopping = (() => {

  const KEY = 'shoppingList';
  let items = [];

  /* ── Persistence ── */

  function load() { items = Storage.get(KEY, []); }
  function save() { Storage.set(KEY, items); }

  function genId() {
    return 'sl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ── Formatage quantité ── */

  function fmtQty(qty) {
    if (qty === null || qty === undefined || qty === '') return '';
    if (qty % 1 === 0) return String(qty);
    return parseFloat(qty.toFixed(4)).toString();
  }

  /* ── Mutation ── */

  /**
   * Ajoute un item à la liste.
   * Si ingId est fourni et qu'un item non-coché avec le même ingId existe,
   * additionne simplement la quantité (import planning).
   */
  function addItem({ name, ingId = null, categoryId = null, qty = null, unit = '' }) {
    if (ingId) {
      const existing = items.find(i => i.ingId === ingId && !i.checked);
      if (existing) {
        if (qty !== null) existing.qty = (existing.qty || 0) + qty;
        return;
      }
    }
    items.push({ id: genId(), name, ingId, categoryId, qty, unit, checked: false });
  }

  function removeItem(id) {
    items = items.filter(i => i.id !== id);
    save();
    render();
  }

  function removeChecked() {
    items = items.filter(i => !i.checked);
    save();
    render();
  }

  /* ── Import depuis le planning ── */

  /**
   * Calcule les totaux d'ingrédients pour un weekOffset donné
   * en lisant directement Storage (sans modifier l'état de Planning).
   */
  function buildTotals(weekOffset) {
    const targetDays  = Dates.getPlanningDays(weekOffset);
    const planData    = Storage.get('planning', {});
    const totals      = {};
    const seenDouble  = new Set();

    targetDays.forEach(dayInfo => {
      const dayData = planData[dayInfo.key] || {};
      ['midi', 'soir'].forEach(slot => {
        if (slot === 'midi' && dayInfo.midiLocked) return;
        if (slot === 'soir' && dayInfo.soirLocked) return;
        const dishId = dayData[slot];
        if (!dishId || dishId === '__free__') return;
        const dish = Dishes.getById(dishId);
        if (!dish) return;
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

  function importFromWeek(weekOffset) {
    const totals = buildTotals(weekOffset);
    if (!totals.length) {
      Toast.info('Aucun plat planifié pour cette semaine.');
      return;
    }
    totals.forEach(({ ing, qty }) => {
      addItem({
        name:       ing.name,
        ingId:      ing.id,
        categoryId: ing.categoryId || null,
        qty,
        unit:       ing.unit
      });
    });
    save();
    render();
    Toast.success(totals.length + ' ingrédient' + (totals.length > 1 ? 's' : '') + ' importé' + (totals.length > 1 ? 's' : '') + '.');
  }

  /* ── Rendu ── */

  function buildCatOptions(selectedId) {
    const cats = (typeof Categories !== 'undefined')
      ? [...Categories.getAll()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      : [];
    return '<option value="">— Sans catégorie —</option>' +
      cats.map(c => '<option value="' + c.id + '"' + (c.id === selectedId ? ' selected' : '') + '>' + c.name + '</option>').join('');
  }

  function buildItemHTML(item) {
    const cls      = 'sl-item' + (item.checked ? ' sl-checked' : '');
    const qtyVal   = item.qty !== null && item.qty !== undefined ? fmtQty(item.qty) : '';
    const unitVal  = item.unit || '';
    const catOpts  = buildCatOptions(item.categoryId || '');
    return '<div class="' + cls + '" data-id="' + item.id + '">' +
      '<label class="sl-label">' +
      '<input type="checkbox" class="sl-check"' + (item.checked ? ' checked' : '') + '>' +
      '<span class="sl-name">' + item.name + '</span>' +
      '</label>' +
      '<div class="sl-controls">' +
      '<input type="number" class="input sl-qty" value="' + qtyVal + '" placeholder="qté" min="0" step="0.1">' +
      '<input type="text" class="input sl-unit" value="' + unitVal + '" placeholder="unité">' +
      '<select class="input sl-cat-sel">' + catOpts + '</select>' +
      '<button class="sl-rm" title="Supprimer">✕</button>' +
      '</div>' +
      '</div>';
  }

  function render() {
    const container = document.getElementById('shopping-content');
    if (!container) return;

    if (!items.length) {
      container.innerHTML = '<p class="sl-empty">Votre liste de courses est vide.<br>Ajoutez des éléments ou importez depuis le planning.</p>';
      return;
    }

    /* Groupement par catégorie */
    const catGroups     = {};
    const uncategorized = [];

    items.forEach(item => {
      const catId = item.categoryId;
      const cat   = (catId && typeof Categories !== 'undefined') ? Categories.getById(catId) : null;
      if (cat) {
        if (!catGroups[catId]) catGroups[catId] = { name: cat.name, items: [] };
        catGroups[catId].items.push(item);
      } else {
        uncategorized.push(item);
      }
    });

    const sortedGroups = Object.values(catGroups)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    if (uncategorized.length) {
      sortedGroups.push({ name: sortedGroups.length ? 'Autres' : null, items: uncategorized });
    }

    let html = '';
    sortedGroups.forEach(group => {
      html += '<div class="sl-group">';
      if (group.name !== null) {
        const allChecked = group.items.every(i => i.checked);
        html += '<div class="sl-group-header">' +
          '<label class="sl-group-check-label">' +
          '<input type="checkbox" class="sl-group-check"' + (allChecked ? ' checked' : '') + '>' +
          '<span class="sl-group-name">' + group.name + '</span>' +
          '</label></div>';
      }
      html += '<div class="sl-items">';
      group.items.forEach(item => { html += buildItemHTML(item); });
      html += '</div></div>';
    });

    container.innerHTML = html;
    attachEvents(container);
  }

  /* ── Événements des items ── */

  function attachEvents(container) {
    container.querySelectorAll('.sl-item').forEach(el => {
      const id = el.dataset.id;

      el.querySelector('.sl-check').addEventListener('change', e => {
        const item = items.find(i => i.id === id);
        if (!item) return;
        item.checked = e.target.checked;
        save();
        el.classList.toggle('sl-checked', e.target.checked);
      });

      const qtyInput = el.querySelector('.sl-qty');
      qtyInput.addEventListener('change', () => {
        const item = items.find(i => i.id === id);
        if (!item) return;
        item.qty = qtyInput.value !== '' ? parseFloat(qtyInput.value) : null;
        save();
      });

      const unitInput = el.querySelector('.sl-unit');
      unitInput.addEventListener('change', () => {
        const item = items.find(i => i.id === id);
        if (!item) return;
        item.unit = unitInput.value.trim();
        save();
      });

      const catSel = el.querySelector('.sl-cat-sel');
      catSel.addEventListener('change', () => {
        const item = items.find(i => i.id === id);
        if (!item) return;
        item.categoryId = catSel.value || null;
        save();
        render();
      });

      el.querySelector('.sl-rm').addEventListener('click', () => {
        if (confirm('Supprimer cet élément de la liste ?')) removeItem(id);
      });
    });

    /* Case "cocher tout" par catégorie */
    container.querySelectorAll('.sl-group').forEach(groupEl => {
      const groupCheck = groupEl.querySelector('.sl-group-check');
      if (!groupCheck) return;
      groupCheck.addEventListener('change', () => {
        const checked = groupCheck.checked;
        groupEl.querySelectorAll('.sl-item').forEach(itemEl => {
          const item = items.find(i => i.id === itemEl.dataset.id);
          if (item) item.checked = checked;
        });
        save();
        render();
      });
    });
  }

  /* ── Formulaire d'ajout manuel ── */

  function initAddForm() {
    const form = document.getElementById('sl-add-form');
    if (!form) return;

    /* Peuple le select de catégorie */
    const refreshCatSel = () => {
      const sel = document.getElementById('sl-add-cat');
      if (sel) sel.innerHTML = buildCatOptions('');
    };
    refreshCatSel();

    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('sl-add-name').value.trim();
      if (!name) return;
      const qtyRaw = document.getElementById('sl-add-qty').value;
      const unit   = document.getElementById('sl-add-unit').value.trim();
      const catId  = document.getElementById('sl-add-cat').value;
      addItem({
        name,
        qty:        qtyRaw ? parseFloat(qtyRaw) : null,
        unit,
        categoryId: catId || null
      });
      save();
      form.reset();
      refreshCatSel();
      render();
    });
  }

  /* ── Sélecteur de semaine et import ── */

  function initImport() {
    const sel = document.getElementById('sl-import-week-sel');
    if (!sel) return;
    sel.innerHTML =
      '<option value="-1">Semaine précédente</option>' +
      '<option value="0" selected>Semaine courante</option>' +
      '<option value="1">Semaine suivante</option>';

    document.getElementById('btn-sl-import')
      ?.addEventListener('click', () => importFromWeek(parseInt(sel.value, 10)));
  }

  /* ── Suppression des cochés ── */

  function initDeleteChecked() {
    document.getElementById('btn-sl-delete-checked')
      ?.addEventListener('click', () => {
        const cnt = items.filter(i => i.checked).length;
        if (!cnt) { Toast.info('Aucun élément coché.'); return; }
        if (confirm('Supprimer ' + cnt + ' élément' + (cnt > 1 ? 's' : '') + ' coché' + (cnt > 1 ? 's' : '') + ' ?')) {
          removeChecked();
        }
      });
  }

  /* ── Init ── */

  function init() {
    load();
    initAddForm();
    initImport();
    initDeleteChecked();
  }

  return { init, load, render, addItem };
})();
