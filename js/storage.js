/**
 * storage.js — Couche de persistance des données.
 *
 * Utilise window.storage (API Anthropic artifact storage) quand disponible,
 * avec un fallback sur un objet en mémoire pour les environnements qui ne
 * la supportent pas (ouverture directe du fichier HTML).
 *
 * L'API window.storage est une base clé-valeur asynchrone qui persiste
 * les données indépendamment du cache navigateur, permettant d'y accéder
 * depuis n'importe quelle machine via l'interface Anthropic.
 *
 * Clé utilisée : 'meal-planner-data'
 */

const STORAGE_KEY = 'meal-planner-data';

/** Stockage en mémoire utilisé comme fallback si window.storage n'est pas disponible */
let _memoryFallback = null;

/** Indique si l'API window.storage est disponible */
const _hasArtifactStorage = typeof window !== 'undefined' && typeof window.storage !== 'undefined';

const Storage = {

  /**
   * Charge les données depuis le stockage.
   * Retourne une Promise résolue avec les données parsées, ou null si aucune donnée.
   */
  async load() {
    if (_hasArtifactStorage) {
      try {
        const result = await window.storage.get(STORAGE_KEY);
        return result ? JSON.parse(result.value) : null;
      } catch (err) {
        console.warn('[Storage] Erreur de lecture artifact storage:', err);
        return null;
      }
    } else {
      // Fallback mémoire : pas de persistance entre sessions
      return _memoryFallback;
    }
  },

  /**
   * Sauvegarde les données dans le stockage.
   * @param {Object} data — L'état complet de l'application à sauvegarder.
   */
  async save(data) {
    const serialized = JSON.stringify(data);

    if (_hasArtifactStorage) {
      try {
        await window.storage.set(STORAGE_KEY, serialized);
        Storage._showSaveIndicator();
      } catch (err) {
        console.warn('[Storage] Erreur de sauvegarde artifact storage:', err);
      }
    } else {
      // Fallback mémoire
      _memoryFallback = data;
    }
  },

  /**
   * Affiche brièvement l'indicateur de sauvegarde dans l'interface.
   * L'élément #js-save-indicator doit exister dans le DOM.
   */
  _showSaveIndicator() {
    const el = document.getElementById('js-save-indicator');
    if (!el) return;
    el.classList.add('save-indicator--visible');
    setTimeout(() => el.classList.remove('save-indicator--visible'), 1500);
  }
};
