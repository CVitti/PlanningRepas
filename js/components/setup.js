/* ═══════════════════════════════════════════════════════════
   js/components/setup.js — Écran de configuration Gist
   ═══════════════════════════════════════════════════════════

   Gère le processus de première configuration en 3 étapes :
     1. Saisie et validation du token GitHub
     2. Création d'un nouveau Gist ou saisie d'un Gist existant
     3. Confirmation et accès au planning

   L'écran de setup est affiché si aucune configuration n'est
   trouvée en localStorage (token ou gistId manquant).
   ═══════════════════════════════════════════════════════════ */

const Setup = (() => {

  /* ── Affichage / masquage de l'écran ── */

  /** Affiche l'écran de setup et masque l'application principale */
  function show() {
    document.getElementById('setup-screen').classList.add('visible');
    document.getElementById('app-root').classList.add('hidden');
  }

  /** Masque l'écran de setup et affiche l'application principale */
  function hide() {
    document.getElementById('setup-screen').classList.remove('visible');
    document.getElementById('app-root').classList.remove('hidden');
  }

  /* ── Navigation entre les étapes ── */

  /**
   * Active l'étape n (1, 2 ou 3) en mettant à jour :
   *   - la classe .active sur les panneaux .setup-step
   *   - les classes .done / .active sur les indicateurs .step-dot
   */
  function goToStep(n) {
    document.querySelectorAll('.setup-step').forEach((el, i) => {
      el.classList.toggle('active', i + 1 === n);
    });
    document.querySelectorAll('.step-dot').forEach((el, i) => {
      el.classList.toggle('done',   i + 1 < n);
      el.classList.toggle('active', i + 1 === n);
    });
  }

  /* ── Étape 1 : validation du token ── */

  /**
   * Appelle l'API GitHub pour vérifier le token saisi.
   * Si valide : mémorise le token, affiche le nom d'utilisateur et passe à l'étape 2.
   * Sinon : affiche un message d'erreur dans #token-error.
   */
  async function handleTokenSubmit() {
    const input = document.getElementById('setup-token');
    const btn   = document.getElementById('btn-validate-token');
    const error = document.getElementById('token-error');
    const token = input.value.trim();

    if (!token) { showError(error, 'Veuillez saisir votre token.'); return; }

    btn.disabled    = true;
    btn.textContent = 'Vérification...';
    error.textContent = '';

    try {
      const user = await Gist.validateToken(token);
      if (!user) throw new Error('invalid');
      Gist.setToken(token);
      document.getElementById('setup-username').textContent = user.login;
      document.getElementById('setup-avatar').src           = user.avatar_url;
      goToStep(2);
    } catch (e) {
      showError(error, 'Token invalide ou droits insuffisants. Vérifiez le scope "gist".');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Valider →';
    }
  }

  /* ── Étape 2a : création d'un nouveau Gist ── */

  /**
   * Crée un Gist privé vide via l'API, mémorise son identifiant
   * et affiche l'étape 3 avec l'identifiant à copier.
   */
  async function handleCreateGist() {
    const btn   = document.getElementById('btn-create-gist');
    const error = document.getElementById('gist-error');
    btn.disabled    = true;
    btn.textContent = 'Création...';
    error.textContent = '';

    try {
      const id = await Gist.createGist();
      Gist.setGistId(id);
      document.getElementById('created-gist-id').textContent = id;
      goToStep(3);
    } catch (e) {
      showError(error, 'Impossible de créer le Gist. Vérifiez vos droits.');
    } finally {
      btn.disabled    = false;
      btn.textContent = '✦ Créer un nouveau Gist';
    }
  }

  /* ── Étape 2b : utiliser un Gist existant ── */

  /**
   * Tente de charger un Gist existant à partir de l'identifiant saisi.
   * Si le chargement réussit, lance directement l'application (sans passer par l'étape 3).
   * Sinon : affiche un message d'erreur adapté (introuvable, réseau…).
   */
  async function handleUseExistingGist() {
    const idInput = document.getElementById('existing-gist-id');
    const btn     = document.getElementById('btn-use-existing');
    const error   = document.getElementById('gist-error');
    const id      = idInput.value.trim();

    if (!id) { showError(error, 'Saisissez l\'identifiant du Gist.'); return; }

    btn.disabled    = true;
    btn.textContent = 'Vérification...';
    error.textContent = '';

    try {
      Gist.setGistId(id);
      await Gist.load();
      await launchApp();
    } catch (e) {
      Gist.setGistId(null);
      if (e.message === 'GIST_NOT_FOUND') {
        showError(error, 'Gist introuvable. Vérifiez l\'identifiant.');
      } else {
        showError(error, 'Erreur : ' + e.message);
      }
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Utiliser ce Gist';
    }
  }

  /* ── Étape 3 : finalisation ── */

  /** Déclenche le chargement du Gist nouvellement créé et démarre l'app */
  async function handleFinish() {
    const btn = document.getElementById('btn-finish-setup');
    btn.disabled    = true;
    btn.textContent = 'Chargement...';
    await launchApp();
  }

  /* ── Lancement de l'application après configuration ── */

  /**
   * Charge les données depuis le Gist, initialise les données par défaut
   * si le Gist est vide, masque le setup et démarre les composants.
   */
  async function launchApp() {
    try {
      await Gist.load();
      Storage.maybeInit();
      hide();
      App.boot();
    } catch (e) {
      Toast.error('Impossible de charger les données depuis le Gist.');
      console.error(e);
    }
  }

  /* ── Déconnexion de l'appareil ── */

  /**
   * Efface les identifiants stockés localement et recharge la page
   * pour revenir à l'écran de setup.
   * Les données restent intactes sur le Gist.
   */
  function disconnect() {
    if (!confirm('Déconnecter cet appareil ? Vos données restent sur le Gist.')) return;
    Gist.clearCreds();
    location.reload();
  }

  /* ── Affichage d'un message d'erreur (avec animation) ── */

  /**
   * Injecte le message dans l'élément et re-déclenche l'animation CSS
   * pour attirer l'attention même si le texte était déjà présent.
   */
  function showError(el, msg) {
    el.textContent = msg;
    el.style.animation = 'none';
    requestAnimationFrame(() => { el.style.animation = ''; });
  }

  /* ── Bascule visibilité du token ── */

  /** Alterne le champ token entre type "password" et "text" */
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

  /* ── Initialisation des événements ── */

  /** Câble tous les boutons de l'écran de setup et positionne sur l'étape 1 */
  function init() {
    /* Bouton de déconnexion dans l'en-tête de l'app */
    const disconnectBtn = document.getElementById('btn-disconnect');
    if (disconnectBtn) disconnectBtn.addEventListener('click', disconnect);

    /* Étape 1 */
    document.getElementById('btn-validate-token').addEventListener('click', handleTokenSubmit);
    document.getElementById('setup-token').addEventListener('keydown', e => {
      if (e.key === 'Enter') handleTokenSubmit();
    });
    document.getElementById('btn-toggle-token').addEventListener('click', toggleTokenVisibility);

    /* Étape 2 */
    document.getElementById('btn-create-gist').addEventListener('click', handleCreateGist);
    document.getElementById('btn-use-existing').addEventListener('click', handleUseExistingGist);

    /* Étape 3 */
    document.getElementById('btn-finish-setup').addEventListener('click', handleFinish);

    goToStep(1); // démarre sur la première étape
  }

  return { init, show, hide, disconnect };
})();
