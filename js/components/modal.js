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

  function openCatalog(tab) {
    document.querySelectorAll('.catalog-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.catalog-panel').forEach(p =>
      p.classList.toggle('active', p.id === `panel-${tab}`));
    if (tab === 'dishes' && typeof Dishes !== 'undefined') {
      Dishes.renderAvailableIngredients();
    }
    open('modal-catalog');
  }

  function init() {
    /* Catalog tab clicks */
    document.querySelectorAll('.catalog-tab').forEach(btn => {
      btn.addEventListener('click', () => openCatalog(btn.dataset.tab));
    });
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

  return { open, close, closeAll, openCatalog, init };
})();
