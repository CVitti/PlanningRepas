/* ═══════════════════════════════════════════════════════════
   js/utils/recipe.js — Mise en forme partagée des étapes de recette
   ═══════════════════════════════════════════════════════════

   Utilisé à la fois par la modale de détail d'un plat (planning.js)
   et par l'aperçu en direct de l'onglet "Plats" du catalogue (dishes.js).

   Une ligne du textarea = une étape. Les lignes commençant par
   "Étape <n>" affichent ce préfixe mis en valeur (couleur + gras).
   ═══════════════════════════════════════════════════════════ */

const Recipe = (() => {

  const STEP_LABEL_RE = /^(Étape\s*\d+\s*:?)/i;

  /** Échappe les caractères HTML sensibles d'une chaîne de texte libre */
  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  /** Découpe le texte du textarea en lignes non vides (une par étape) */
  function parseSteps(text) {
    return (text || '')
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  /** Construit le <li> d'une étape, avec le préfixe "Étape N" mis en valeur */
  function buildStepHTML(s) {
    const match = s.match(STEP_LABEL_RE);
    if (!match) return '<li>' + escapeHtml(s) + '</li>';
    const label = escapeHtml(match[1]);
    const rest  = escapeHtml(s.slice(match[1].length));
    return '<li><span class="recipe-step-label">' + label + '</span>' + rest + '</li>';
  }

  /** Construit la liste <ul class="recipe-steps"> complète, ou '' si aucune étape */
  function buildStepsListHTML(text) {
    const steps = parseSteps(text);
    if (!steps.length) return '';
    return '<ul class="recipe-steps">' + steps.map(buildStepHTML).join('') + '</ul>';
  }

  return { parseSteps, buildStepHTML, buildStepsListHTML, escapeHtml };
})();
