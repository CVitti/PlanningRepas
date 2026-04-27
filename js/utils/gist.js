/* ═══════════════════════════════════════════════════════════
   js/utils/gist.js — GitHub Gist sync layer
   ═══════════════════════════════════════════════════════════

   Flux :
   1. Au démarrage, on lit le token + gistId depuis localStorage
   2. On charge les données depuis l'API Gist (GET)
   3. Chaque écriture déclenche un debounced save (PATCH)

   Structure du Gist (un seul fichier "meal-planner.json") :
   {
     "ingredients": [...],
     "dishes": [...],
     "planning": { "2024-11-22": { "midi": "dish1", "soir": "dish2" } }
   }
   ═══════════════════════════════════════════════════════════ */

const Gist = (() => {

  const API          = 'https://api.github.com';
  const GIST_FILE    = 'meal-planner.json';
  const LS_TOKEN     = 'mp_gh_token';
  const LS_GIST_ID   = 'mp_gist_id';
  const DEBOUNCE_MS  = 1200;

  /* ── In-memory state ── */
  let _token   = null;
  let _gistId  = null;
  let _data    = null;        // objet JS complet des données
  let _saveTimer = null;
  let _syncStatus = 'idle';   // 'idle' | 'saving' | 'error'

  /* ── Token / GistId (stockés en localStorage, pas les données) ── */
  function getToken()   { return localStorage.getItem(LS_TOKEN)   || null; }
  function getGistId()  { return localStorage.getItem(LS_GIST_ID) || null; }
  function setToken(t)  { localStorage.setItem(LS_TOKEN,   t); _token  = t; }
  function setGistId(id){ localStorage.setItem(LS_GIST_ID, id); _gistId = id; }
  function clearCreds() {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_GIST_ID);
    _token = _gistId = null;
  }

  function isConfigured() {
    return !!getToken() && !!getGistId();
  }

  /* ── API helpers ── */
  async function apiFetch(path, options = {}) {
    const token = _token || getToken();
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept':        'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type':  'application/json',
        ...(options.headers || {}),
      },
    });

    if (res.status === 401) throw new Error('TOKEN_INVALID');
    if (res.status === 404) throw new Error('GIST_NOT_FOUND');
    if (!res.ok) throw new Error(`API_ERROR_${res.status}`);
    return res.json();
  }

  /* ── Validate token (check authenticated user) ── */
  async function validateToken(token) {
    const res = await fetch(`${API}/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
      },
    });
    if (!res.ok) return null;
    return res.json(); // { login, ... }
  }

  /* ── Create a new private Gist ── */
  async function createGist() {
    const empty = defaultData();
    const body = {
      description: 'Meal Planner — données synchronisées',
      public: false,
      files: {
        [GIST_FILE]: { content: JSON.stringify(empty, null, 2) }
      }
    };
    const result = await apiFetch('/gists', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return result.id;
  }

  /* ── Load data from Gist ── */
  async function load() {
    _token  = getToken();
    _gistId = getGistId();

    const raw = await apiFetch(`/gists/${_gistId}`);
    const file = raw.files[GIST_FILE];
    if (!file) throw new Error('FILE_MISSING');

    try {
      _data = JSON.parse(file.content);
    } catch {
      _data = defaultData();
    }

    /* Ensure all keys exist */
    _data = { ...defaultData(), ..._data };
    return _data;
  }

  /* ── Save data to Gist (debounced) ── */
  function scheduleSave() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(flushSave, DEBOUNCE_MS);
  }

  async function flushSave() {
    if (!_data) return;
    setSyncStatus('saving');
    try {
      await apiFetch(`/gists/${_gistId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          files: {
            [GIST_FILE]: { content: JSON.stringify(_data, null, 2) }
          }
        }),
      });
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('error');
      Toast.error('Erreur de synchronisation Gist.');
      console.error('[Gist] save error', err);
    }
  }

  /* Force immediate save (e.g. before page unload) */
  async function forceSave() {
    clearTimeout(_saveTimer);
    await flushSave();
  }

  /* ── In-memory data accessors (replaces localStorage) ── */
  function get(key, fallback = null) {
    if (!_data) return fallback;
    return _data[key] !== undefined ? _data[key] : fallback;
  }

  function set(key, value) {
    if (!_data) return;
    _data[key] = value;
    scheduleSave();
  }

  /* ── Sync status indicator ── */
  function setSyncStatus(status) {
    _syncStatus = status;
    const el = document.getElementById('sync-status');
    if (!el) return;
    const labels = {
      idle:   { text: '',             cls: '' },
      saving: { text: '↑ Sync...',    cls: 'saving' },
      ok:     { text: '✓ Synchronisé', cls: 'ok' },
      error:  { text: '⚠ Erreur sync', cls: 'error' },
    };
    const l = labels[status] || labels.idle;
    el.textContent  = l.text;
    el.className    = `sync-status ${l.cls}`;

    if (status === 'ok') {
      setTimeout(() => {
        if (_syncStatus === 'ok') setSyncStatus('idle');
      }, 3000);
    }
  }

  /* ── Default empty data structure ── */
  function defaultData() {
    return { ingredients: [], dishes: [], planning: {} };
  }

  /* Save on tab close */
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
