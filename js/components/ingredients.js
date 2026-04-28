/* ═══════════════════════════════════════════════════════════
   js/components/ingredients.js — Ingredient CRUD (card grid + inline edit)
   ═══════════════════════════════════════════════════════════ */

const Ingredients = (() => {

  const STEP = 0.5;
  let list      = [];
  let editingId = null;

  /* ── State ── */
  function load()      { list = Storage.get('ingredients', []); }
  function save()      { Storage.set('ingredients', list); }
  function getAll()    { return list; }
  function getById(id) { return list.find(i => i.id === id) || null; }
  function getStep()   { return STEP; }

  /* ── Unit options HTML helper ── */
  const UNIT_GROUPS = [
    { label: 'Poids',   opts: ['g', 'kg'] },
    { label: 'Volume',  opts: ['ml', 'cl', 'l'] },
    { label: 'Cuisine', opts: ['c. à s.', 'c. à c.', 'pincée'] },
    { label: 'Autre',   opts: ['unité'] },
  ];

  function unitOptionsHTML(selected) {
    return UNIT_GROUPS.map(g =>
      `<optgroup label="${g.label}">${
        g.opts.map(o =>
          `<option value="${o}"${o === selected ? ' selected' : ''}>${o}</option>`
        ).join('')
      }</optgroup>`
    ).join('');
  }

  /* ── CRUD ── */
  function add(name, unit) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (list.some(i => i.name.toLowerCase() === trimmed.toLowerCase())) {
      Toast.error('Cet ingrédient existe déjà.');
      return null;
    }
    const ing = { id: Dates.uid(), name: trimmed, unit: unit || 'g' };
    list.push(ing);
    save();
    render();
    if (typeof Dishes !== 'undefined') Dishes.renderAvailableIngredients();
    Toast.success('"' + ing.name + '" ajouté !');
    return ing;
  }

  function update(id, name, unit) {
    const ing = list.find(i => i.id === id);
    if (!ing) return;
    const trimmed = name.trim();
    if (!trimmed) { Toast.error('Le nom ne peut pas être vide.'); return; }
    ing.name = trimmed;
    ing.unit = unit;
    save();
    editingId = null;
    render();
    if (typeof Dishes !== 'undefined') Dishes.renderAvailableIngredients();
    Toast.success('"' + ing.name + '" mis à jour !');
  }

  function remove(id) {
    const used = Dishes.getAll().some(d => d.ingredients.some(i => i.id === id));
    if (used) {
      Toast.error('Cet ingrédient est utilisé dans un plat.');
      return;
    }
    list = list.filter(i => i.id !== id);
    save();
    editingId = null;
    render();
    if (typeof Dishes !== 'undefined') Dishes.renderAvailableIngredients();
    Toast.info('Ingrédient supprimé.');
  }

  /* ── Inline edit ── */
  function startEdit(id) {
    editingId = id;
    render();
    const input = document.querySelector(`.ing-card[data-id="${id}"] .ing-edit-name`);
    if (input) { input.focus(); input.select(); }
  }

  function cancelEdit() {
    editingId = null;
    render();
  }

  function saveEdit(id) {
    const card = document.querySelector(`.ing-card[data-id="${id}"]`);
    if (!card) return;
    const nameVal = card.querySelector('.ing-edit-name').value;
    const unitVal = card.querySelector('.ing-edit-unit').value;
    update(id, nameVal, unitVal);
  }

  /* ── Render ── */
  function render() {
    const container = document.getElementById('ingredient-list');
    if (!container) return;
    if (!list.length) {
      container.innerHTML = '<p class="panel-empty">Aucun ingrédient. Ajoutez-en un ci-dessus.</p>';
      return;
    }
    container.innerHTML = [...list]
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .map(ing => {
        if (editingId === ing.id) {
          return `
            <div class="ing-card ing-card-editing" data-id="${ing.id}">
              <input class="input ing-edit-name" type="text" value="${ing.name}" autocomplete="off" spellcheck="false"/>
              <select class="input ing-edit-unit">${unitOptionsHTML(ing.unit)}</select>
              <div class="ing-card-actions">
                <button class="btn btn-primary btn-sm" type="button" onclick="Ingredients._saveEdit('${ing.id}')">✓ Ok</button>
                <button class="btn btn-ghost   btn-sm" type="button" onclick="Ingredients._cancelEdit()">Annuler</button>
              </div>
            </div>`;
        }
        return `
          <div class="ing-card" data-id="${ing.id}">
            <span class="ing-card-name">${ing.name}</span>
            <div class="ing-card-footer">
              <span class="ing-card-unit">${ing.unit}</span>
              <div class="ing-card-actions">
                <button class="btn btn-ghost  btn-sm" type="button" onclick="Ingredients._startEdit('${ing.id}')" title="Modifier">✎</button>
                <button class="btn btn-danger btn-sm" type="button" onclick="Ingredients.remove('${ing.id}')" title="Supprimer">✕</button>
              </div>
            </div>
          </div>`;
      }).join('');
  }

  /* ── Legacy no-op (select removed) ── */
  function populateDishSelect() {}

  /* ── Init ── */
  function initForm() {
    const form = document.getElementById('form-ingredient');
    if (!form) return;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('ing-name').value;
      const unit = document.getElementById('ing-unit').value;
      if (add(name, unit)) form.reset();
    });
  }

  function init() { load(); render(); initForm(); }

  return {
    init, load, getAll, getById, getStep, add, remove, render, populateDishSelect,
    _startEdit:  id => startEdit(id),
    _saveEdit:   id => saveEdit(id),
    _cancelEdit: ()  => cancelEdit(),
  };
})();
