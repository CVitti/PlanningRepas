/* ═══════════════════════════════════════════════════════════
   js/components/settings.js — Réglages utilisateur globaux
   ═══════════════════════════════════════════════════════════

   Gère la modale de réglages ouverte depuis l'icône ⚙ du header.

   Réglages gérés :
     - planningWindow : jour + créneau de début, jour + créneau de fin
       du planning (1 à 14 repas, calculé et affiché en direct)
     - cutoffHours     : heure à partir de laquelle un créneau midi/soir
       est considéré comme "dépassé" (grisé, exclu de la génération auto)

   Stockage : clé 'settings' dans Storage → { planningWindow, cutoffHours }
   (synchronisée via le Gist comme le reste des données).
   ═══════════════════════════════════════════════════════════ */

const Settings = (() => {

  const DEFAULT_WINDOW  = { startDow: 5, startSlot: 'soir', endDow: 5, endSlot: 'midi' };
  const DEFAULT_CUTOFFS = { midi: 14, soir: 21 };

  let data = { planningWindow: { ...DEFAULT_WINDOW }, cutoffHours: { ...DEFAULT_CUTOFFS } };

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
    if (raw) {
      data = {
        planningWindow: { ...DEFAULT_WINDOW,  ...(raw.planningWindow || {}) },
        cutoffHours:    { ...DEFAULT_CUTOFFS, ...(raw.cutoffHours    || {}) },
      };
    } else {
      data = { planningWindow: { ...DEFAULT_WINDOW }, cutoffHours: { ...DEFAULT_CUTOFFS } };
      save(); // amorce la clé au premier chargement
    }
  }

  function save() { Storage.set('settings', data); }

  function getPlanningWindow() { return data.planningWindow; }
  function getCutoffHours()    { return data.cutoffHours; }

  /**
   * Applique les réglages saisis dans le formulaire et recharge tout
   * ce qui en dépend : planning (revient à la semaine courante,
   * recalcule aussi les créneaux "passés"), sidebar, liste de courses
   * (contenu + libellés de dates du sélecteur d'import).
   */
  function applySettings({ planningWindow, cutoffHours }) {
    data.planningWindow = { ...data.planningWindow, ...planningWindow };
    data.cutoffHours    = { ...data.cutoffHours,    ...cutoffHours };
    save();
    if (typeof Planning !== 'undefined') Planning.reloadForSettingsChange();
    if (typeof Shopping !== 'undefined') {
      Shopping.populateImportWeekSelect();
      Shopping.render();
    }
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

  /** Options d'heure 00h à 23h */
  function hourOptionsHTML(selected) {
    let html = '';
    for (let h = 0; h < 24; h++) {
      html += `<option value="${h}"${h === selected ? ' selected' : ''}>${String(h).padStart(2, '0')}h</option>`;
    }
    return html;
  }

  /** Reconstruit le contenu du formulaire à partir des réglages courants */
  function renderForm() {
    const w = data.planningWindow;
    const c = data.cutoffHours;
    document.getElementById('settings-start-dow').innerHTML  = dowOptionsHTML(w.startDow);
    document.getElementById('settings-start-slot').innerHTML = slotOptionsHTML(w.startSlot);
    document.getElementById('settings-end-dow').innerHTML    = dowOptionsHTML(w.endDow);
    document.getElementById('settings-end-slot').innerHTML   = slotOptionsHTML(w.endSlot);
    document.getElementById('settings-cutoff-midi').innerHTML = hourOptionsHTML(c.midi);
    document.getElementById('settings-cutoff-soir').innerHTML = hourOptionsHTML(c.soir);
    updateSummary();
  }

  /** Lit le formulaire et met à jour le compteur "X repas" en direct */
  function updateSummary() {
    const cfg   = readWindowConfig();
    const count = Dates.computeSpanSlots(cfg);
    const el    = document.getElementById('settings-summary');
    if (el) el.textContent = count + ' repas couverts par le planning (maximum 14).';
  }

  /** Lit la fenêtre de planning actuellement affichée dans le formulaire */
  function readWindowConfig() {
    return {
      startDow:  parseInt(document.getElementById('settings-start-dow').value, 10),
      startSlot: document.getElementById('settings-start-slot').value,
      endDow:    parseInt(document.getElementById('settings-end-dow').value, 10),
      endSlot:   document.getElementById('settings-end-slot').value,
    };
  }

  /** Lit les heures limites actuellement affichées dans le formulaire */
  function readCutoffConfig() {
    return {
      midi: parseInt(document.getElementById('settings-cutoff-midi').value, 10),
      soir: parseInt(document.getElementById('settings-cutoff-soir').value, 10),
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
      applySettings({ planningWindow: readWindowConfig(), cutoffHours: readCutoffConfig() });
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

  return { init, load, getPlanningWindow, getCutoffHours };
})();
