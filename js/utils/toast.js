/* ═══════════════════════════════════════════════════════════
   js/utils/toast.js — Toast notifications
   ═══════════════════════════════════════════════════════════ */

const Toast = (() => {
  const ICONS = {
    success: '✓',
    error:   '✕',
    info:    'ℹ',
  };

  function show(message, type = 'info', duration = 2800) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="toast-icon">${ICONS[type] || '·'}</span>
      <span class="toast-msg">${message}</span>
    `;
    container.appendChild(el);

    setTimeout(() => {
      el.classList.add('toast-out');
      el.addEventListener('animationend', () => el.remove());
    }, duration);
  }

  return {
    success: (msg, dur) => show(msg, 'success', dur),
    error:   (msg, dur) => show(msg, 'error', dur),
    info:    (msg, dur) => show(msg, 'info', dur),
  };
})();
