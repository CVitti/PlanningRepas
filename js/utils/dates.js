/* ═══════════════════════════════════════════════════════════
   js/utils/dates.js — Week calculation helpers
   ═══════════════════════════════════════════════════════════ */

const Dates = (() => {

  /** Return a Date set to midnight local time */
  function today() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Add `n` days to a Date (returns new Date) */
  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  /**
   * Find the LAST friday that is <= today (start of planning window)
   * Planning: vendredi S0 soir → vendredi S+1 soir
   * Vendredi midi S0 = locked (géré par semaine précédente)
   * Vendredi soir S+1 = locked (géré par semaine suivante)
   */
  function getStartFriday() {
    const t = today();
    const dow = t.getDay(); // 0=Sun,1=Mon,...,5=Fri,6=Sat
    // Days since last Friday (5)
    const diff = (dow + 2) % 7; // Friday=5 → 0 days ago, Sat=6 → 1, Sun=0 → 2, …
    const fri = addDays(t, -diff);
    return fri;
  }

  /**
   * Build the list of days in the planning window.
   * Vendredi S0 → Vendredi S+1 (8 days, indices 0..7)
   * But only slots that make sense:
   *   index 0 (Ven S0): midi=locked, soir=editable
   *   index 7 (Ven S+1): midi=editable, soir=locked
   */
  function getPlanningDays(weekOffset) {
    const offset = weekOffset || 0;
    const start = addDays(getStartFriday(), offset * 7);
    const days = [];
    for (let i = 0; i < 8; i++) {
      const date = addDays(start, i);
      const dow = date.getDay(); // 0=Sun…6=Sat
      const isWeekend = dow === 0 || dow === 6 || dow === 5;
      days.push({
        date,
        key: formatKey(date),
        label: formatLabel(date),
        dayName: formatDayName(date),
        isToday: date.getTime() === today().getTime(),
        isWeekend,
        midiLocked: i === 0,   // Ven S0 midi locked
        soirLocked: i === 7,   // Ven S+1 soir locked
      });
    }
    return days;
  }

  /** Format date as storage key: YYYY-MM-DD */
  function formatKey(date) {
    return date.toISOString().slice(0, 10);
  }

  /** Format display label: "12" */
  function formatLabel(date) {
    return date.getDate().toString();
  }

  /** Format day name: "Lundi" */
  function formatDayName(date) {
    return date.toLocaleDateString('fr-FR', { weekday: 'long' });
  }

  /** Format full date label for header */
  function formatWeekRange(days) {
    const opts = { day: 'numeric', month: 'long' };
    const start = days[0].date.toLocaleDateString('fr-FR', opts);
    const end   = days[7].date.toLocaleDateString('fr-FR', opts);
    return `${start} – ${end}`;
  }

  /** Generate a unique ID */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  return { today, addDays, getStartFriday, getPlanningDays, formatKey, formatWeekRange, uid };
})();
