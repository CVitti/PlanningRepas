# Menu de la semaine

Application web de planning hebdomadaire de repas, hébergeable statiquement (GitHub Pages, Netlify, etc.) avec synchronisation entre appareils via GitHub Gist.

## Fonctionnalités

- **Planning vendredi → vendredi** : 8 jours du vendredi S0 soir au vendredi S+1 midi, avec verrouillage automatique des créneaux adjacents aux semaines précédente et suivante
- **Navigation entre semaines** : consultation et saisie de la semaine courante ou des semaines à venir
- **Drag & drop** : glissez un plat depuis la liste vers un créneau, ou déplacez-le d'un créneau à l'autre directement dans le planning
- **Repas libre** : marquez un créneau comme "libre" (pas de plat prévu)
- **Repas dépassés** : les créneaux passés (midi > 14h, soir > 21h) sont visuellement atténués
- **Ingrédients** : créez vos ingrédients avec une unité (g, cl, unité…)
- **Plats** : composez vos plats avec des ingrédients et quantités ajustables par pas de 0,5 ; chaque plat peut être réservé au midi, au soir, ou aux deux, et peut représenter 2 portions
- **Responsive** : interface adaptée mobile et desktop, sidebar masquable

## Synchronisation multi-appareils

Les données sont stockées dans un **Gist GitHub privé**. Aucun backend nécessaire.

### Premier appareil

1. Générer un token GitHub sur `github.com/settings/tokens`
   - Type : Fine-grained token ou Classic token
   - Permission requise : **Gists → Read and write**
2. Ouvrir le site → saisir le token → **Créer un nouveau Gist**
3. **Noter le Gist ID** affiché (32 caractères hexadécimaux)

### Appareils suivants

1. Ouvrir le site → saisir le token → **Utiliser un Gist existant** → coller le Gist ID

### Déconnexion

Le bouton ⏏ dans la barre du haut déconnecte l'appareil courant (le token est supprimé du localStorage). Les données restent intactes sur le Gist.

## Structure du projet

```
meal-planner/
├── index.html
├── css/
│   ├── base.css        — variables, reset, layout, boutons, formulaires
│   ├── planning.css    — grille hebdomadaire, slots, cartes repas
│   ├── sidebar.css     — liste des plats draggable
│   ├── modal.css       — fenêtres modales
│   ├── setup.css       — écran de configuration Gist
│   └── toast.css       — notifications
└── js/
    ├── app.js          — point d'entrée, boot asynchrone
    ├── utils/
    │   ├── gist.js     — couche API GitHub Gist (lecture/écriture/debounce)
    │   ├── storage.js  — adaptateur Storage → Gist
    │   ├── dates.js    — calcul de la fenêtre de planning
    │   └── toast.js    — notifications
    └── components/
        ├── setup.js       — wizard de configuration
        ├── modal.js       — gestion ouverture/fermeture modales
        ├── ingredients.js — CRUD ingrédients
        ├── dishes.js      — CRUD plats + builder d'ingrédients
        ├── planning.js    — grille + drag & drop + navigation semaines
        └── sidebar.js     — liste filtrée + source de drag
```

## Déploiement GitHub Pages

1. Pousser le dossier `meal-planner/` à la racine d'un repo public (ou privé avec Pages activé)
2. Dans les paramètres du repo → Pages → Source : `main` branch, dossier `/` (ou `/docs` si renommé)
3. Accéder à `https://<user>.github.io/<repo>/`
