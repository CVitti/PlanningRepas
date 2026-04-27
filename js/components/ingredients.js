/* ═══════════════════════════════════════════════════════════
   js/components/ingredients.js — Ingredient CRUD
   Pas global fixe de 0.5 pour toutes les quantités.
   ═══════════════════════════════════════════════════════════ */

const Ingredients = (() => {

  const STEP = 0.5; // pas global pour toutes les quantités

  let list = [];

  function load()          { list = Storage.get('ingredients', []); }
  function save()          { Storage.set('ingredients', list); }
  function getAll()        { return list; }
  function getById(id)     { return list.find(i => i.id === id) || null; }
  function getStep()       { return STEP; }

  function add(name, unit) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (list.some(i => i.name.toLowerCase() === trimmed.toLowerCase())) {
      Toast.error('Cet ingredient existe deja.');
      return null;
    }
    const ing = { id: Dates.uid(), name: trimmed, unit: unit || 'g' };
    list.push(ing);
    save();
    render();
    populateDishSelect();
    Toast.success('"' + ing.name + '" ajoute !');
    return ing;
  }

  function remove(id) {
    const used = Dishes.getAll().some(d => d.ingredients.some(i => i.id === id));
    if (used) {
      Toast.error('Cet ingredient est utilise dans un plat.');
      return;
    }
    list = list.filter(i => i.id !== id);
    save();
    render();
    populateDishSelect();
    Toast.info('Ingredient supprime.');
  }

  function render() {
    const container = document.getElementById('ingredient-list');
    if (!container) return;
    if (!list.length) {
      container.innerHTML = '<p style="color:var(--ink-faint);font-size:.83rem;padding:10px 0;">Aucun ingredient. Ajoutez-en un ci-dessus.</p>';
      return;
    }
    container.innerHTML = [...list]
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .map(ing =>
        '<div class="ingredient-row" data-id="' + ing.id + '">' +
          '<span class="ingredient-row-name">' + ing.name + '</span>' +
          '<span class="ingredient-row-unit">' + ing.unit + '</span>' +
          '<button class="btn btn-danger btn-sm" onclick="Ingredients.remove(\'' + ing.id + '\')">✕</button>' +
        '</div>'
      ).join('');
  }

  function populateDishSelect() {
    const sel = document.getElementById('ing-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Choisir un ingredient —</option>' +
      [...list]
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
        .map(i => '<option value="' + i.id + '">' + i.name + ' (' + i.unit + ')</option>').join('');
  }

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

  return { init, load, getAll, getById, getStep, add, remove, render, populateDishSelect };
})();
