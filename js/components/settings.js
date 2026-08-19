/* ═══════════════════════════════════════════════════════════
   js/components/settings.js — Réglages utilisateur globaux
   ═══════════════════════════════════════════════════════════

   Gère la modale de réglages ouverte depuis l'icône ⚙ du header.

   Premier réglage : la fenêtre de planning (jour + créneau de début,
   jour + créneau de fin). Le nombre de repas couverts (1 à 14) est
   calculé et affiché en direct pendant la saisie.

   Stockage : clé 'settings' dans Storage → { planningWindow: {...} }
   (synchronisée via le Gist comme le reste des données).
   ═══════════════════════════════════════════════════════════ */

const Settings = (() => {

  const DEFAULT_WINDOW = { startDow: 5, startSlot: 'soir', endDow: 5, endSlot: 'midi' };

  let data = { planningWindow: { ...DEFAULT_WINDOW } };

  /* ── Jours (affichage lundi → dimanche, valeurs Date.getDay() 0..6) ── */
  const DOW_OPTIONS = [
    { value: 1, label: 'Lundi' },
    { value: 2, label: 'Mardi' },
    { value: 3, label: 'Mercredi' },
    { value: 4, label: 'Jeudi' },
    { value: 5, label: 'Vendredi' },
    { value: 6, label: 'Samedi' },
    { value: 0, label: 'Dimanche' },
  ];

  /* ── Accès à l'état ── */

  function load() {
    const raw = Storage.get('settings', null);
    if (raw && raw.planningWindow) {
      data = { ...raw, planningWindow: { ...DEFAULT_WINDOW, ...raw.planningWindow } };
    } else {
      data = { planningWindow: { ...DEFAULT_WINDOW } };
      save(); // amorce la clé au premier chargement
    }
  }

  function save() { Storage.set('settings', data); }

  function getPlanningWindow() { return data.planningWindow; }

  /**
   * Met à jour la fenêtre de planning et recharge tout ce qui en dépend :
   * planning (revient à la semaine courante), sidebar, liste de courses.
   */
  function setPlanningWindow(win) {
    data.planningWindow = { ...data.planningWindow, ...win };
    save();
    if (typeof Planning !== 'undefined') Planning.reloadForSettingsChange();
    if (typeof Shopping !== 'undefined') Shopping.render();
  }

  /* ══════════════════════════════════════════════════════════
     MODALE DE RÉGLAGES
     ══════════════════════════════════════════════════════════ */

  function dowOptionsHTML(selected) {
    return DOW_OPTIONS.map(o =>
      `<option value="${o.value}"${o.value === selected ? ' selected' : ''}>${o.label}</option>`
    ).join('');
  }

  function slotOptionsHTML(selected) {
    return ['midi', 'soir'].map(s =>
      `<option value="${s}"${s === selected ? ' selected' : ''}>${s === 'midi' ? 'Midi' : 'Soir'}</option>`
    ).join('');
  }

  /** Reconstruit le contenu du formulaire à partir de la fenêtre courante */
  function renderForm() {
    const w = data.planningWindow;
    document.getElementById('settings-start-dow').innerHTML  = dowOptionsHTML(w.startDow);
    document.getElementById('settings-start-slot').innerHTML = slotOptionsHTML(w.startSlot);
    document.getElementById('settings-end-dow').innerHTML    = dowOptionsHTML(w.endDow);
    document.getElementById('settings-end-slot').innerHTML   = slotOptionsHTML(w.endSlot);
    updateSummary();
  }

  /** Lit les 4 select et met à jour le compteur "X repas" en direct */
  function updateSummary() {
    const cfg   = readFormConfig();
    const count = Dates.computeSpanSlots(cfg);
    const el    = document.getElementById('settings-summary');
    if (el) el.textContent = count + ' repas couverts par le planning (maximum 14).';
  }

  /** Lit la configuration actuellement affichée dans le formulaire */
  function readFormConfig() {
    return {
      startDow:  parseInt(document.getElementById('settings-start-dow').value, 10),
      startSlot: document.getElementById('settings-start-slot').value,
      endDow:    parseInt(document.getElementById('settings-end-dow').value, 10),
      endSlot:   document.getElementById('settings-end-slot').value,
    };
  }

  /* ── Initialisation ── */

  function initForm() {
    const form = document.getElementById('form-settings');
    if (!form) return;

    ['settings-start-dow', 'settings-start-slot', 'settings-end-dow', 'settings-end-slot'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', updateSummary);
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      setPlanningWindow(readFormConfig());
      Modal.close('modal-settings');
      Toast.success('Réglages enregistrés.');
    });

    document.getElementById('btn-open-settings')?.addEventListener('click', () => {
      renderForm();
      Modal.open('modal-settings');
    });
  }

  function init() {
    load();
    initForm();
  }

  return { init, load, getPlanningWindow, setPlanningWindow };
})();
