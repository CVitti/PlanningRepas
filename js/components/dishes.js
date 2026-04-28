/* ═══════════════════════════════════════════════════════════
   js/components/dishes.js — Dish CRUD & ingredient builder
   ═══════════════════════════════════════════════════════════ */

const Dishes = (() => {

  let list = [];
  let formIngredients = [];
  let editingId = null;

  /* ── State ── */
  function load() { list = Storage.get('dishes', []); }
  function save() { Storage.set('dishes', list); }
  function getAll() { return list; }
  function getById(id) { return list.find(d => d.id === id) || null; }

  /* ── CRUD ── */
  function update(id, name, slot, isDouble, ingredients) {
    const dish = list.find(d => d.id === id);
    if (!dish) return;
    dish.name = name.trim();
    dish.slot = slot;
    dish.double = isDouble;
    dish.ingredients = ingredients;
    save();
    renderExisting();
    Sidebar.render();
    Planning.render();
    Toast.success(`Plat « ${dish.name} » mis à jour !`);
  }

  function setModalTitle(text) {
    const el = document.querySelector('#modal-dishes .modal-title');
    if (el) el.textContent = text;
  }

  function openCreate() {
    cancelEdit();
    Modal.open('modal-dishes');
  }

  function startEdit(id) {
    const dish = list.find(d => d.id === id);
    if (!dish) return;
    editingId = id;
    document.getElementById('dish-name').value = dish.name;
    const slotInput = document.querySelector(`input[name="dish-slot"][value="${dish.slot}"]`);
    if (slotInput) slotInput.checked = true;
    document.getElementById('dish-double').checked = dish.double;
    formIngredients = dish.ingredients.map(i => ({ ...i }));
    renderFormIngredients();
    document.getElementById('btn-dish-submit').textContent = 'Mettre à jour';
    document.getElementById('btn-cancel-edit').style.display = 'inline-flex';
    setModalTitle('Modifier un plat');
    Modal.open('modal-dishes');
  }

  function cancelEdit() {
    editingId = null;
    document.getElementById('form-dish').reset();
    formIngredients = [];
    renderFormIngredients();
    document.getElementById('btn-dish-submit').textContent = 'Enregistrer le plat';
    document.getElementById('btn-cancel-edit').style.display = 'none';
    setModalTitle('Créer un plat');
  }

  function add(name, slot, isDouble, ingredients) {
    if (!name.trim()) return null;
    const dish = {
      id:          Dates.uid(),
      name:        name.trim(),
      slot,          // 'both' | 'midi' | 'soir'
      double:      isDouble,
      ingredients, // [{id, qty}]
    };
    list.push(dish);
    save();
    renderExisting();
    Sidebar.render();
    Toast.success(`Plat « ${dish.name} » créé !`);
    return dish;
  }

  function remove(id) {
    /* Remove from planning too */
    const planning = Storage.get('planning', {});
    Object.keys(planning).forEach(dateKey => {
      ['midi', 'soir'].forEach(slot => {
        if (planning[dateKey][slot] === id) {
          delete planning[dateKey][slot];
        }
      });
    });
    Storage.set('planning', planning);

    list = list.filter(d => d.id !== id);
    save();
    renderExisting();
    Sidebar.render();
    Planning.render();
    Toast.info('Plat supprimé.');
  }

  /* ── Slot labels ── */
  function slotLabel(slot) {
    return slot === 'both' ? 'Midi & Soir' : slot === 'midi' ? 'Midi' : 'Soir';
  }

  function slotClass(slot) {
    return slot === 'both' ? 'both' : slot;
  }

  /* ── Form: ingredient builder ── */
  function addIngToForm() {
    const sel   = document.getElementById('ing-select');
    const ingId = sel.value;
    if (!ingId) return;
    const ing = Ingredients.getById(ingId);
    if (!ing) return;
    if (formIngredients.find(i => i.id === ingId)) {
      Toast.error('Cet ingredient est deja dans la liste.');
      return;
    }
    const step = Ingredients.getStep();
    formIngredients.push({ id: ingId, qty: step });
    renderFormIngredients();
    sel.value = '';
  }

  function removeIngFromForm(ingId) {
    formIngredients = formIngredients.filter(i => i.id !== ingId);
    renderFormIngredients();
  }

  function changeQty(ingId, delta) {
    const item = formIngredients.find(i => i.id === ingId);
    if (!item) return;
    const input = document.querySelector(`.qty-value[data-id="${ingId}"]`);
    if (input) item.qty = parseFloat(input.value) || item.qty;
    const step = Ingredients.getStep();
    item.qty = Math.max(step, parseFloat((item.qty + delta).toFixed(2)));
    renderFormIngredients();
  }

  function setQty(ingId, val) {
    const item = formIngredients.find(i => i.id === ingId);
    if (item) item.qty = parseFloat(val) || item.qty;
  }

  function renderFormIngredients() {
    const container = document.getElementById('dish-ingredients');
    if (!container) return;
    if (!formIngredients.length) {
      container.innerHTML = '<p style="color:var(--ink-faint);font-size:.8rem;padding:8px 0;">Aucun ingrédient sélectionné.</p>';
      return;
    }
    container.innerHTML = formIngredients.map(item => {
      const ing = Ingredients.getById(item.id);
      if (!ing) return '';
      return `
        <div class="dish-ing-row">
          <span class="dish-ing-name">${ing.name}</span>
          <div class="qty-control">
            <button class="qty-btn" onclick="Dishes._qtyDown('${ing.id}')">−</button>
            <input type="number" class="qty-value" data-id="${ing.id}" value="${item.qty}" min="0.5" step="0.5" oninput="Dishes._setQty('${ing.id}', this.value)">
            <span class="qty-unit">${ing.unit}</span>
            <button class="qty-btn" onclick="Dishes._qtyUp('${ing.id}')">+</button>
          </div>
          <button class="btn btn-danger btn-sm" onclick="Dishes._removeIngFromForm('${ing.id}')">✕</button>
        </div>
      `;
    }).join('');
  }

  /* ── Render existing dishes in modal ── */
  function renderExisting() {
    const container = document.getElementById('existing-dishes');
    if (!container) return;
    if (!list.length) {
      container.innerHTML = '<p style="color:var(--ink-faint);font-size:.85rem;">Aucun plat créé.</p>';
      return;
    }
    container.innerHTML = [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(d => `
      <div class="existing-dish-row">
        <span class="existing-dish-name">${d.name}</span>
        <div class="existing-dish-meta">
          ${d.double ? '<span class="badge badge-double">×2</span>' : ''}
          <span class="slot-pill ${slotClass(d.slot)}">${slotLabel(d.slot)}</span>
          <button class="btn btn-ghost btn-sm" onclick="Dishes._startEdit('${d.id}')">Modifier</button>
          <button class="btn btn-danger btn-sm" onclick="Dishes.remove('${d.id}')">Supprimer</button>
        </div>
      </div>
    `).join('');
  }

  /* ── Form submit ── */
  function initForm() {
    const form = document.getElementById('form-dish');
    if (!form) return;

    document.getElementById('btn-add-ing').addEventListener('click', addIngToForm);
    document.getElementById('btn-cancel-edit').addEventListener('click', cancelEdit);

    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('dish-name').value;
      const slot = document.querySelector('input[name="dish-slot"]:checked')?.value || 'both';
      const isDouble = document.getElementById('dish-double').checked;

      if (!name.trim()) { Toast.error('Donnez un nom au plat.'); return; }

      if (editingId) {
        update(editingId, name, slot, isDouble, [...formIngredients]);
        cancelEdit();
        Modal.close('modal-dishes');
      } else {
        add(name, slot, isDouble, [...formIngredients]);
        cancelEdit();
        Modal.close('modal-dishes');
      }
    });
  }

  function init() {
    load();
    renderExisting();
    initForm();
  }

  /* Exposed for inline onclick */
  return {
    init, load, getAll, getById, add, remove, slotLabel, slotClass,
    openCreate,
    _qtyUp:             (id)      => { changeQty(id,  Ingredients.getStep()); },
    _qtyDown:           (id)      => { changeQty(id, -Ingredients.getStep()); },
    _setQty:            (id, val) => { setQty(id, val); },
    _removeIngFromForm: (id)      => { removeIngFromForm(id); },
    _startEdit:         (id)      => { startEdit(id); },
  };
})();
