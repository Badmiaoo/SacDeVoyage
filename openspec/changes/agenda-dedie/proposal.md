# Proposal

## Why

Les règles disent déjà ce qui doit être dans l'agenda. Sans décision de création, d'allongement et de suppression, Google créerait des doublons ou effacerait un autre calendrier.

## What Changes

- Chaque entrée a une clé stable.
- Un événement nouveau commence à sa date et couvre jusqu'à aujourd'hui.
- Le lendemain, le même événement s'allonge. Il n'est pas recréé.
- Cocher, ou changer l'état du sac, retire seulement cet événement.
- Un événement sans notre clé n'est pas touché.
- Le texte ne contient jamais le contenu d'un sac.

## Capabilities

### Modified Capabilities

- `agenda`: le passage de la liste voulue aux opérations du calendrier dédié

## Impact

Pas encore de connexion Google. Cette tranche décide seulement. La connexion viendra quand un identifiant client existera.
