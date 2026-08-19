/* ═══════════════════════════════════════════════════════════
   js/utils/dates.js — Calculs de dates et fenêtre de planning
   ═══════════════════════════════════════════════════════════

   Fournit les utilitaires de dates utilisés par l'ensemble
   de l'application :
     - Calcul du jour d'ancrage de la fenêtre de planning (configurable)
     - Construction de la liste des jours du planning
     - Formatage des clés de stockage (YYYY-MM-DD)
     - Formatage des labels d'affichage (fr-FR)
     - Générateur d'identifiants uniques

   Fenêtre de planning configurable (Settings.getPlanningWindow) :
     { startDow, startSlot, endDow, endSlot }
     startDow/endDow : 0=Dimanche … 6=Samedi (Date.getDay())
     startSlot/endSlot : 'midi' | 'soir'

   Par défaut (comportement historique) : vendredi soir → vendredi midi
   de la semaine suivante, soit 14 repas.
   ═══════════════════════════════════════════════════════════ */

const Dates = (() => {

  const DEFAULT_WINDOW = { startDow: 5, startSlot: 'soir', endDow: 5, endSlot: 'midi' };

  /** Lit la fenêtre configurée (Settings), ou la valeur par défaut si indisponible */
  function getWindowConfig() {
    if (typeof Settings !== 'undefined') {
      const w = Settings.getPlanningWindow();
      if (w) return w;
    }
    return DEFAULT_WINDOW;
  }

  /* ── Date de référence ── */

  /** Retourne la date du jour à minuit heure locale */
  function today() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Ajoute n jours à une date et retourne une nouvelle Date */
  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  /* ── Calcul du jour d'ancrage ── */

  /**
   * Retourne le dernier jour de la semaine ciblé (targetDow, 0=Dim..6=Sam)
   * ≤ aujourd'hui. C'est le jour d'ancrage de la fenêtre de planning.
   */
  function getStartAnchor(targetDow) {
    const t    = today();
    const diff = (t.getDay() - targetDow + 7) % 7;
    return addDays(t, -diff);
  }

  /** Conservé pour compatibilité : ancrage sur vendredi (comportement historique) */
  function getStartFriday() { return getStartAnchor(5); }

  /* ── Longueur de la fenêtre (en créneaux) ── */

  /** Position chronologique d'un (jour, créneau) dans un cycle de 7 jours : 0..13 */
  function slotPosition(dow, slot) { return dow * 2 + (slot === 'soir' ? 1 : 0); }

  /**
   * Nombre de créneaux (repas) couverts par la fenêtre configurée,
   * du début à la fin inclus, en avançant chronologiquement (modulo 14).
   * Toujours compris entre 1 et 14 quelle que soit la configuration.
   */
  function computeSpanSlots(cfg) {
    const startPos = slotPosition(cfg.startDow, cfg.startSlot);
    const endPos   = slotPosition(cfg.endDow, cfg.endSlot);
    return ((endPos - startPos + 14) % 14) + 1;
  }

  /* ── Construction de la fenêtre de jours ── */

  /**
   * Retourne le tableau des jours du planning pour la semaine demandée,
   * selon la fenêtre configurée (Settings.getPlanningWindow()).
   * weekOffset : 0 = semaine courante, -1 = précédente, +1 = suivante.
   *
   * Le nombre de jours retournés varie selon la configuration (1 à 8) :
   * un jour n'est inclus que s'il porte au moins un créneau actif.
   *
   * Chaque entrée contient :
   *   date        — objet Date
   *   key         — clé de stockage YYYY-MM-DD
   *   label       — numéro du jour ("12")
   *   dayName     — nom du jour ("lundi")
   *   isToday     — booléen
   *   isWeekend   — booléen (vendredi inclus pour le style)
   *   midiLocked  — true si le créneau midi de ce jour est hors fenêtre
   *   soirLocked  — true si le créneau soir de ce jour est hors fenêtre
   */
  function getPlanningDays(weekOffset) {
    const offset = weekOffset || 0;
    const cfg    = getWindowConfig();
    const anchor = addDays(getStartAnchor(cfg.startDow), offset * 7);
    let remaining = computeSpanSlots(cfg);

    const days = [];
    let cursorDate = new Date(anchor);
    let cursorSlot = cfg.startSlot;
    let dayEntry   = null;

    while (remaining > 0) {
      if (!dayEntry || dayEntry.date.getTime() !== cursorDate.getTime()) {
        const dow = cursorDate.getDay();
        dayEntry = {
          date:       new Date(cursorDate),
          key:        formatKey(cursorDate),
          label:      formatLabel(cursorDate),
          dayName:    formatDayName(cursorDate),
          isToday:    cursorDate.getTime() === today().getTime(),
          isWeekend:  dow === 0 || dow === 6 || dow === 5, // sam, dim, ven
          midiLocked: true,
          soirLocked: true,
        };
        days.push(dayEntry);
      }

      if (cursorSlot === 'midi') dayEntry.midiLocked = false;
      else                       dayEntry.soirLocked = false;
      remaining--;

      if (cursorSlot === 'midi') {
        cursorSlot = 'soir';
      } else {
        cursorSlot = 'midi';
        cursorDate = addDays(cursorDate, 1);
      }
    }
    return days;
  }

  /* ── Formatage ── */

  /** Clé de stockage : "YYYY-MM-DD" (heure locale, pas UTC) */
  function formatKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Numéro du jour pour l'en-tête de colonne : "12" */
  function formatLabel(date) {
    return date.getDate().toString();
  }

  /** Nom du jour en français : "lundi", "mardi"… */
  function formatDayName(date) {
    return date.toLocaleDateString('fr-FR', { weekday: 'long' });
  }

  /** Plage de la semaine pour le label de l'en-tête : "12 mai – 19 mai" */
  function formatWeekRange(days) {
    const opts  = { day: 'numeric', month: 'long' };
    const start = days[0].date.toLocaleDateString('fr-FR', opts);
    const end   = days[days.length - 1].date.toLocaleDateString('fr-FR', opts);
    return `${start} – ${end}`;
  }

  /** Date courte "JJ/MM", pour les libellés compacts (ex: sélecteur de semaine) */
  function formatShort(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}`;
  }

  /* ── Générateur d'identifiants ── */

  /**
   * Génère un identifiant unique combinant timestamp base36 + suffixe aléatoire.
   * Suffisamment unique pour des données locales/Gist sans conflit UUID.
   */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  return {
    today, addDays, getStartFriday, getStartAnchor, computeSpanSlots,
    getPlanningDays, formatKey, formatWeekRange, formatShort, uid,
  };
})();
