/* ═══════════════════════════════════════════════════════════
   js/utils/dates.js — Calculs de dates et fenêtre de planning
   ═══════════════════════════════════════════════════════════

   Fournit les utilitaires de dates utilisés par l'ensemble
   de l'application :
     - Calcul du vendredi de départ (fenêtre glissante)
     - Construction de la liste des 8 jours du planning
     - Formatage des clés de stockage (YYYY-MM-DD)
     - Formatage des labels d'affichage (fr-FR)
     - Générateur d'identifiants uniques
   ═══════════════════════════════════════════════════════════ */

const Dates = (() => {

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

  /* ── Calcul du vendredi de départ ── */

  /**
   * Retourne le dernier vendredi ≤ aujourd'hui.
   * C'est le jour d'ancrage du planning : vendredi S0 (soir) → vendredi S+1 (midi).
   *
   * Vendredi midi S0  = verrouillé (appartient à la semaine précédente)
   * Vendredi soir S+1 = verrouillé (appartient à la semaine suivante)
   */
  function getStartFriday() {
    const t = today();
    const dow = t.getDay(); // 0=Dim, 1=Lun, …, 5=Ven, 6=Sam
    // Nombre de jours écoulés depuis le dernier vendredi
    const diff = (dow + 2) % 7; // Ven→0, Sam→1, Dim→2, Lun→3, Mar→4, Mer→5, Jeu→6
    return addDays(t, -diff);
  }

  /* ── Construction de la fenêtre de 8 jours ── */

  /**
   * Retourne le tableau des 8 jours du planning pour la semaine demandée.
   * weekOffset : 0 = semaine courante, -1 = précédente, +1 = suivante.
   *
   * Chaque entrée contient :
   *   date        — objet Date
   *   key         — clé de stockage YYYY-MM-DD
   *   label       — numéro du jour ("12")
   *   dayName     — nom du jour ("lundi")
   *   isToday     — booléen
   *   isWeekend   — booléen (vendredi inclus pour le style)
   *   midiLocked  — true uniquement pour le vendredi S0 (index 0)
   *   soirLocked  — true uniquement pour le vendredi S+1 (index 7)
   */
  function getPlanningDays(weekOffset) {
    const offset = weekOffset || 0;
    const start  = addDays(getStartFriday(), offset * 7);
    const days   = [];

    for (let i = 0; i < 8; i++) {
      const date = addDays(start, i);
      const dow  = date.getDay();
      const isWeekend = dow === 0 || dow === 6 || dow === 5; // sam, dim, ven
      days.push({
        date,
        key:        formatKey(date),
        label:      formatLabel(date),
        dayName:    formatDayName(date),
        isToday:    date.getTime() === today().getTime(),
        isWeekend,
        midiLocked: i === 0, // vendredi S0 midi = appartient à la semaine précédente
        soirLocked: i === 7, // vendredi S+1 soir = appartient à la semaine suivante
      });
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
    const end   = days[7].date.toLocaleDateString('fr-FR', opts);
    return `${start} – ${end}`;
  }

  /* ── Générateur d'identifiants ── */

  /**
   * Génère un identifiant unique combinant timestamp base36 + suffixe aléatoire.
   * Suffisamment unique pour des données locales/Gist sans conflit UUID.
   */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  return { today, addDays, getStartFriday, getPlanningDays, formatKey, formatWeekRange, uid };
})();
