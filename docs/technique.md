# Documentation technique

## Forme

Site statique. Pas de compilateur, pas de framework. HTML, CSS, modules JavaScript. Publié par GitHub Pages depuis `main`.

Page : https://badmiaoo.github.io/SacDeVoyage/

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Coquille, manifeste, message si la page plante. |
| `styles.css` | Mise en page. Pas de thème. |
| `src/app.js` | Pages, gestes, dessin. |
| `src/store.js` | Données et règles. Pur. Pas de DOM. |
| `src/personal.js` | Maquette de départ. |
| `src/agenda.js` | Plan des événements : créer, allonger, supprimer. |
| `src/google.js` | Calendrier dédié, jeton, appels. |
| `src/text.js` | Dates et nombres en français. |

Les tests sont à côté : `*.test.js`. `npm test` lance `node --test`.

## Données

Une seule base, dans `localStorage`, clé `sac-de-voyage`.

```
{
  version: 1,
  seed: "maquette-3" | "imported" | ...,
  items: [{ id, name }],
  bagModels: [{ id, name, afterUse, lines: [{ itemId, qty, removeAfter, group }] }],
  bags: [{ id, name, modelId, added, qty, checks, excluded, status, emptiedOn }],
  departureModels: [{ id, name, bagIds, actions: [{ id, label, offsetDays }] }],
  departures: [{ id, name, modelId, kind, start, end, weekday, done, emptiedOn, createdOn }]
}
```

`afterUse` : `stay`, `all`, `marked`.
`status` : `ready`, `emptying`, `filling`.
`kind` : `once`, `recurring`.
`offsetDays` est négatif ou nul. J-7 est `-7`. Plafond 365.

Les identifiants sont des UUID. Les noms sont uniques dans leur liste, après normalisation (casse et accents ignorés).

## Règles du store

`resolveLines` assemble le modèle et les ajouts de l'enfant, applique les exclusions et les nombres propres.

`missingChecks` ne regarde que les sacs `ready`. Un sac incomplet n'est pas rempli.

`attention` trie : à vider, à remplir, incomplet, prêt.

`applyOutings` passe un sac à `emptying` le lendemain de la sortie, une fois par date, par sac. Un sac déjà marqué pour cette date n'est pas revide. Un sac pas prêt bloque seulement son propre passage.

`resetBag` remet le sac à `ready`, efface ses coches, et oublie sa date de vidage. Les autres sacs du même départ ne bougent pas.

`releaseUnusedEmptying` ne ramène un sac à prêt que si plus aucun départ passé ne le réclame. Supprimer un départ déjà passé ne le déclenche pas.

## Agenda

`agendaEvents` produit les événements voulus. `planCalendar` compare à ce qui est déjà dans Google, par clé privée `app=sac-de-voyage`.

Une clé d'action est `action:{départ}:{action}:{jour}`. Une clé de sac est `bag:{sac}:emptying` ou `bag:{sac}:filling`.

L'événement part du jour prévu et finit soixante jours plus tard. Cocher retire la clé, donc l'événement.

Le contenu d'un sac n'entre jamais dans le titre ni dans la description.

## Google

Client OAuth public, sans secret. Identifiant dans `src/google.js`. Retour : `https://badmiaoo.github.io/SacDeVoyage/`.

Le jeton vit dans `sessionStorage` côté session, et dans `localStorage` pour la session Google. Il expire au bout d'environ une heure. Pas de jeton long dans cette maquette.

Le calendrier est retrouvé ou créé par son nom, « Sac de voyage ».

## Persistance et reprise

`openDb` garde une base qui a un `seed` connu, ou une base inconnue qui a déjà des sacs. Une base vide ou sans marque est remplacée par la maquette. Une base illisible aussi.

L'import exige les cinq listes. Les sacs sans `added` en reçoivent un vide.

La pile d'annulation est dans `sessionStorage`, vingt gestes. Elle est lue dans un `try`.

Un autre onglet qui écrit la même clé recalcule. Revenir sur la page recalcule aussi.

## Publication

`.github/workflows/check.yml` lance les tests, puis publie si `main` est vert. `.nojekyll` empêche Jekyll de toucher aux fichiers.

Le cache du navigateur est cassé par `?v=` sur la feuille et le script.

## Ce qui est volontairement absent

- Compilation, bundler, framework.
- Notifications push.
- Jeton à longue durée.
- Synchronisation entre deux appareils sans conflit.
- Thème, animations, aspect soigné.

Ces points sont pour la vraie application, pas pour la maquette.
