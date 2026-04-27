/* ═══════════════════════════════════════════════════════════
   js/components/setup.js — Écran de configuration Gist
   ═══════════════════════════════════════════════════════════ */

const Setup = (() => {

  function show() {
    document.getElementById('setup-screen').classList.add('visible');
    document.getElementById('app-root').classList.add('hidden');
  }

  function hide() {
    document.getElementById('setup-screen').classList.remove('visible');
    document.getElementById('app-root').classList.remove('hidden');
  }

  function goToStep(n) {
    document.querySelectorAll('.setup-step').forEach((el, i) => {
      el.classList.toggle('active', i + 1 === n);
    });
    document.querySelectorAll('.step-dot').forEach((el, i) => {
      el.classList.toggle('done',   i + 1 < n);
      el.classList.toggle('active', i + 1 === n);
    });
  }

  async function handleTokenSubmit() {
    const input = document.getElementById('setup-token');
    const btn   = document.getElementById('btn-validate-token');
    const error = document.getElementById('token-error');
    const token = input.value.trim();

    if (!token) { showError(error, 'Veuillez saisir votre token.'); return; }

    btn.disabled    = true;
    btn.textContent = 'Verification...';
    error.textContent = '';

    try {
      const user = await Gist.validateToken(token);
      if (!user) throw new Error('invalid');
      Gist.setToken(token);
      document.getElementById('setup-username').textContent = user.login;
      document.getElementById('setup-avatar').src = user.avatar_url;
      goToStep(2);
    } catch (e) {
      showError(error, 'Token invalide ou droits insuffisants. Verifiez le scope "gist".');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Valider';
    }
  }

  async function handleCreateGist() {
    const btn   = document.getElementById('btn-create-gist');
    const error = document.getElementById('gist-error');
    btn.disabled    = true;
    btn.textContent = 'Creation...';
    error.textContent = '';

    try {
      const id = await Gist.createGist();
      Gist.setGistId(id);
      document.getElementById('created-gist-id').textContent = id;
      goToStep(3);
    } catch (e) {
      showError(error, 'Impossible de creer le Gist. Verifiez vos droits.');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Creer un nouveau Gist';
    }
  }

  async function handleUseExistingGist() {
    const idInput = document.getElementById('existing-gist-id');
    const btn     = document.getElementById('btn-use-existing');
    const error   = document.getElementById('gist-error');
    const id      = idInput.value.trim();

    if (!id) { showError(error, 'Saisissez l\'identifiant du Gist.'); return; }

    btn.disabled    = true;
    btn.textContent = 'Verification...';
    error.textContent = '';

    try {
      Gist.setGistId(id);
      await Gist.load();
      await launchApp();
    } catch (e) {
      Gist.setGistId(null);
      if (e.message === 'GIST_NOT_FOUND') {
        showError(error, 'Gist introuvable. Verifiez l\'identifiant.');
      } else {
        showError(error, 'Erreur : ' + e.message);
      }
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Utiliser ce Gist';
    }
  }

  async function handleFinish() {
    const btn = document.getElementById('btn-finish-setup');
    btn.disabled    = true;
    btn.textContent = 'Chargement...';
    await launchApp();
  }

  async function launchApp() {
    try {
      await Gist.load();
      Storage.maybeInit();
      hide();
      App.boot();
    } catch (e) {
      Toast.error('Impossible de charger les donnees depuis le Gist.');
      console.error(e);
    }
  }

  function disconnect() {
    if (!confirm('Deconnecter cet appareil ? Vos donnees restent sur le Gist.')) return;
    Gist.clearCreds();
    location.reload();
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.style.animation = 'none';
    requestAnimationFrame(() => { el.style.animation = ''; });
  }

  function toggleTokenVisibility() {
    const input = document.getElementById('setup-token');
    const btn   = document.getElementById('btn-toggle-token');
    if (input.type === 'password') {
      input.type      = 'text';
      btn.textContent = '🙈';
    } else {
      input.type      = 'password';
      btn.textContent = '👁';
    }
  }

  function init() {
    const disconnectBtn = document.getElementById('btn-disconnect');
    if (disconnectBtn) disconnectBtn.addEventListener('click', disconnect);

    document.getElementById('btn-validate-token').addEventListener('click', handleTokenSubmit);
    document.getElementById('setup-token').addEventListener('keydown', e => {
      if (e.key === 'Enter') handleTokenSubmit();
    });
    document.getElementById('btn-toggle-token').addEventListener('click', toggleTokenVisibility);
    document.getElementById('btn-create-gist').addEventListener('click', handleCreateGist);
    document.getElementById('btn-use-existing').addEventListener('click', handleUseExistingGist);
    document.getElementById('btn-finish-setup').addEventListener('click', handleFinish);

    goToStep(1);
  }

  return { init, show, hide, disconnect };
})();
