/* ═══════════════════════════════════════════════════════════
   js/components/modal.js — Gestionnaire de modales
   ═══════════════════════════════════════════════════════════

   Toutes les modales partagent la classe .modal-overlay ;
   l'ajout de .open les rend visibles (transition CSS opacity).
   Le scroll de la page est bloqué pendant qu'une modale est ouverte.

   Fermeture déclenchée par :
     - bouton .modal-close (data-modal="id" ou sans attribut pour tout fermer)
     - clic sur le fond sombre (backdrop)
     - touche Échap
   ═══════════════════════════════════════════════════════════ */

const Modal = (() => {

  /* ── Ouvrir / fermer une modale par son ID DOM ── */

  function open(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('open');
      document.body.style.overflow = 'hidden'; // bloque le défilement de la page
    }
  }

  function close(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('open');
      document.body.style.overflow = ''; // restaure le défilement
    }
  }

  /** Ferme toutes les modales ouvertes (utilisé par Échap et clic backdrop) */
  function closeAll() {
    document.querySelectorAll('.modal-overlay.open').forEach(el => {
      el.classList.remove('open');
    });
    document.body.style.overflow = '';
  }

  /* ── Catalogue (modale à onglets : Ingrédients | Plats) ── */

  /**
   * Active l'onglet demandé dans la modale catalogue et l'ouvre.
   * Si l'onglet est "dishes", rafraîchit la liste des ingrédients
   * disponibles dans le formulaire de plat (colonne gauche).
   */
  function openCatalog(tab) {
    /* Bascule l'onglet actif dans la barre de navigation */
    document.querySelectorAll('.catalog-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tab));
    /* Affiche le panneau correspondant */
    document.querySelectorAll('.catalog-panel').forEach(p =>
      p.classList.toggle('active', p.id === `panel-${tab}`));
    /* Rafraîchit les ingrédients disponibles si on ouvre l'onglet plats */
    if (tab === 'dishes' && typeof Dishes !== 'undefined') {
      Dishes.renderAvailableIngredients();
    }
    open('modal-catalog');
  }

  /* ── Câblage des événements globaux ── */

  function init() {
    /* Clics sur les onglets du catalogue */
    document.querySelectorAll('.catalog-tab').forEach(btn => {
      btn.addEventListener('click', () => openCatalog(btn.dataset.tab));
    });

    /* Boutons ✕ dans les modales — ferme la modale ciblée ou toutes */
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.modal;
        if (modalId) close(modalId);
        else closeAll();
      });
    });

    /* Clic sur le fond sombre (en dehors de la boîte modale) */
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeAll();
      });
    });

    /* Touche Échap → ferme toutes les modales */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeAll();
    });
  }

  return { open, close, closeAll, openCatalog, init };
})();
