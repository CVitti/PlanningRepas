/* ═══════════════════════════════════════════════════════════
   js/utils/gist.js — Couche de synchronisation GitHub Gist
   ═══════════════════════════════════════════════════════════

   Flux de données :
     1. Au démarrage, lecture du token + gistId depuis localStorage
     2. Chargement des données via l'API GitHub Gist (GET)
     3. Chaque écriture déclenche une sauvegarde debounced (PATCH)

   Structure du fichier "meal-planner.json" dans le Gist :
   {
     "ingredients": [...],
     "dishes":      [...],
     "planning":    { "2024-11-22": { "midi": "dish1", "soir": "dish2" } }
   }

   Codes d'erreur renvoyés :
     TOKEN_INVALID   — 401, token expiré ou révoqué
     TOKEN_FORBIDDEN — 403, token sans scope gist
     GIST_NOT_FOUND  — 404, identifiant de Gist incorrect
   ═══════════════════════════════════════════════════════════ */

const Gist = (() => {

  /* ── Constantes ── */
  const API         = 'https://api.github.com';
  const GIST_FILE   = 'meal-planner.json';
  const LS_TOKEN    = 'mp_gh_token';   // clé localStorage pour le token
  const LS_GIST_ID  = 'mp_gist_id';   // clé localStorage pour l'identifiant du Gist
  const DEBOUNCE_MS = 1200;            // délai de debounce avant sauvegarde (ms)

  /* ── État interne ── */
  let _token      = null;
  let _gistId     = null;
  let _data       = null;       // objet JS complet des données (en mémoire)
  let _saveTimer  = null;       // timer du debounce
  let _syncStatus = 'idle';     // état de la synchro : 'idle' | 'saving' | 'error'

  /* ── Persistance du token et du gistId (localStorage uniquement) ── */
  function getToken()    { return localStorage.getItem(LS_TOKEN)   || null; }
  function getGistId()   { return localStorage.getItem(LS_GIST_ID) || null; }
  function setToken(t)   { localStorage.setItem(LS_TOKEN,   t); _token  = t; }
  function setGistId(id) { localStorage.setItem(LS_GIST_ID, id); _gistId = id; }

  /** Efface les identifiants stockés (déconnexion de l'appareil) */
  function clearCreds() {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_GIST_ID);
    _token = _gistId = null;
  }

  /** Retourne true si le token et le gistId sont tous deux renseignés */
  function isConfigured() {
    return !!getToken() && !!getGistId();
  }

  /* ── Requête API GitHub générique ── */
  async function apiFetch(path, options = {}) {
    const token = _token || getToken();
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Authorization':         `Bearer ${token}`,
        'Accept':                'application/vnd.github+json',
        'X-GitHub-Api-Version':  '2022-11-28',
        'Content-Type':          'application/json',
        ...(options.headers || {}),
      },
    });

    /* Traduction des codes HTTP en erreurs nommées */
    if (res.status === 401) throw new Error('TOKEN_INVALID');
    if (res.status === 403) throw new Error('TOKEN_FORBIDDEN');
    if (res.status === 404) throw new Error('GIST_NOT_FOUND');
    if (!res.ok)            throw new Error(`API_ERROR_${res.status}`);
    return res.json();
  }

  /* ── Validation du token (vérifie l'utilisateur connecté) ── */
  /**
   * Retourne l'objet utilisateur GitHub { login, avatar_url, … }
   * si le token est valide, ou null sinon.
   */
  async function validateToken(token) {
    const res = await fetch(`${API}/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept':        'application/vnd.github+json',
      },
    });
    if (!res.ok) return null;
    return res.json();
  }

  /* ── Création d'un nouveau Gist privé ── */
  /**
   * Crée un Gist privé contenant un fichier "meal-planner.json" vide
   * et retourne son identifiant.
   */
  async function createGist() {
    const empty = defaultData();
    const body  = {
      description: 'Meal Planner — données synchronisées',
      public:      false,
      files: {
        [GIST_FILE]: { content: JSON.stringify(empty, null, 2) }
      }
    };
    const result = await apiFetch('/gists', {
      method: 'POST',
      body:   JSON.stringify(body),
    });
    return result.id;
  }

  /* ── Chargement des données depuis le Gist ── */
  /**
   * Récupère le contenu du fichier JSON via l'API et le parse.
   * En cas de JSON invalide, initialise des données vides.
   * Garantit que toutes les clés attendues existent dans _data.
   */
  async function load() {
    _token  = getToken();
    _gistId = getGistId();

    const raw  = await apiFetch(`/gists/${_gistId}`);
    const file = raw.files[GIST_FILE];
    if (!file) throw new Error('FILE_MISSING');

    try {
      _data = JSON.parse(file.content);
    } catch {
      _data = defaultData(); // JSON corrompu → repart de zéro
    }

    /* Fusionne avec les valeurs par défaut pour garantir toutes les clés */
    _data = { ...defaultData(), ..._data };
    return _data;
  }

  /* ── Sauvegarde debounced vers le Gist ── */

  /** Repousse la sauvegarde de DEBOUNCE_MS ms à chaque appel */
  function scheduleSave() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(flushSave, DEBOUNCE_MS);
  }

  /** Effectue la sauvegarde immédiate (PATCH sur l'API Gist) */
  async function flushSave() {
    if (!_data) return;
    setSyncStatus('saving');
    try {
      await apiFetch(`/gists/${_gistId}`, {
        method: 'PATCH',
        body:   JSON.stringify({
          files: {
            [GIST_FILE]: { content: JSON.stringify(_data, null, 2) }
          }
        }),
      });
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('error');
      /* Message d'erreur adapté selon le type de problème */
      if (err.message === 'TOKEN_FORBIDDEN') {
        Toast.error('Permission refusée : le token n\'a pas le scope gist.');
      } else {
        Toast.error('Erreur de synchronisation Gist.');
      }
      console.error('[Gist] save error', err);
    }
  }

  /** Force une sauvegarde immédiate, par exemple avant fermeture de page */
  async function forceSave() {
    clearTimeout(_saveTimer);
    await flushSave();
  }

  /* ── Accesseurs en mémoire (remplacent localStorage pour les données) ── */

  /** Lit une clé dans _data ; retourne fallback si absente */
  function get(key, fallback = null) {
    if (!_data) return fallback;
    return _data[key] !== undefined ? _data[key] : fallback;
  }

  /** Écrit une valeur dans _data et planifie une sauvegarde debounced */
  function set(key, value) {
    if (!_data) return;
    _data[key] = value;
    scheduleSave();
  }

  /* ── Indicateur de statut de synchronisation ── */
  /**
   * Met à jour l'élément #sync-status avec le texte et la classe CSS
   * correspondant à l'état courant.
   * Après 3 s en état 'ok', repasse automatiquement à 'idle'.
   */
  function setSyncStatus(status) {
    _syncStatus = status;
    const el = document.getElementById('sync-status');
    if (!el) return;

    const labels = {
      idle:   { text: '',              cls: ''      },
      saving: { text: '↑ Sync...',     cls: 'saving' },
      ok:     { text: '✓ Synchronisé', cls: 'ok'    },
      error:  { text: '⚠ Erreur sync', cls: 'error' },
    };
    const l = labels[status] || labels.idle;
    el.textContent = l.text;
    el.className   = `sync-status ${l.cls}`;

    if (status === 'ok') {
      setTimeout(() => {
        if (_syncStatus === 'ok') setSyncStatus('idle');
      }, 3000);
    }
  }

  /* ── Structure de données par défaut ── */
  function defaultData() {
    return { ingredients: [], dishes: [], planning: {} };
  }

  /* ── Sauvegarde de secours à la fermeture de l'onglet ── */
  window.addEventListener('beforeunload', () => {
    if (_saveTimer) flushSave();
  });

  return {
    isConfigured,
    validateToken,
    createGist,
    setToken,
    setGistId,
    getToken,
    getGistId,
    clearCreds,
    load,
    forceSave,
    get,
    set,
    setSyncStatus,
  };
})();
