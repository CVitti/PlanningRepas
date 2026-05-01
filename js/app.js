/* ═══════════════════════════════════════════════════════════
   js/app.js — Point d'entree (boot async Gist)
   ═══════════════════════════════════════════════════════════ */

const App = (() => {

  function boot() {
    Modal.init();
    Ingredients.init();
    Dishes.init();
Planning.init();
    Sidebar.init();

  }

  async function start() {
    Setup.init();

    if (!Gist.isConfigured()) {
      Setup.show();
      return;
    }

    showLoader(true);
    try {
      await Gist.load();
      Storage.maybeInit();
      boot();
    } catch (err) {
      showLoader(false);
      if (err.message === 'TOKEN_INVALID') {
        Toast.error('Token GitHub expire ou revoque. Reconfigurez l\'acces.');
        Gist.clearCreds();
        Setup.show();
      } else if (err.message === 'TOKEN_FORBIDDEN') {
        Toast.error('Permission refusee : recreez un token avec le scope "gist".');
        Gist.clearCreds();
        Setup.show();
      } else if (err.message === 'GIST_NOT_FOUND') {
        Toast.error('Gist introuvable. Reconfigurez l\'acces.');
        Gist.clearCreds();
        Setup.show();
      } else {
        Toast.error('Impossible de joindre GitHub. Verifiez votre connexion.');
        Setup.show();
      }
      return;
    }
    showLoader(false);
  }

  function showLoader(on) {
    const el = document.getElementById('boot-loader');
    if (el) el.classList.toggle('visible', on);
  }

  return { boot, start };
})();

document.addEventListener('DOMContentLoaded', () => App.start());
