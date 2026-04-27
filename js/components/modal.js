/* ═══════════════════════════════════════════════════════════
   js/components/modal.js — Modal open/close manager
   ═══════════════════════════════════════════════════════════ */

const Modal = (() => {

  function open(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function close(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  function closeAll() {
    document.querySelectorAll('.modal-overlay.open').forEach(el => {
      el.classList.remove('open');
    });
    document.body.style.overflow = '';
  }

  function init() {
    /* Close buttons inside modals */
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.modal;
        if (modalId) close(modalId);
        else closeAll();
      });
    });

    /* Click on overlay backdrop closes */
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeAll();
      });
    });

    /* ESC key */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeAll();
    });
  }

  return { open, close, closeAll, init };
})();
