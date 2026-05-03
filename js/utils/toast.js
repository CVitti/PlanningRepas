/* ═══════════════════════════════════════════════════════════
   js/utils/toast.js — Notifications temporaires (toasts)
   ═══════════════════════════════════════════════════════════

   Affiche un bandeau en bas de l'écran pendant ~2,8 s.
   Trois niveaux : success (vert), error (rouge), info (bleu).

   Usage :
     Toast.success('Plat créé !');
     Toast.error('Token invalide.');
     Toast.info('Planning vidé.');
   ═══════════════════════════════════════════════════════════ */

const Toast = (() => {

  /* Icône affichée à gauche du message selon le niveau */
  const ICONS = {
    success: '✓',
    error:   '✕',
    info:    'ℹ',
  };

  /**
   * Crée un élément toast, l'insère dans #toast-container,
   * puis déclenche son animation de sortie après `duration` ms
   * avant de le retirer du DOM.
   */
  function show(message, type = 'info', duration = 2800) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="toast-icon">${ICONS[type] || '·'}</span>
      <span class="toast-msg">${message}</span>
    `;
    container.appendChild(el);

    /* Après la durée d'affichage : animation de sortie puis suppression */
    setTimeout(() => {
      el.classList.add('toast-out');
      el.addEventListener('animationend', () => el.remove());
    }, duration);
  }

  /* ── API publique ── */
  return {
    success: (msg, dur) => show(msg, 'success', dur),
    error:   (msg, dur) => show(msg, 'error',   dur),
    info:    (msg, dur) => show(msg, 'info',    dur),
  };
})();
