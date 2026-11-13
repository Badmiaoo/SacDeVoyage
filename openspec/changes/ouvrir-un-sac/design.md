# Design

## Context

Le contrat complet est dans openspec/specs. Cette tranche n'en réalise qu'une partie. L'application sera publiée plus tard sur GitHub Pages, donc sans serveur.

## Goals / Non-Goals

**Goals:**

- Créer et nommer un objet.
- Composer un modèle de sac.
- Nommer un enfant et l'ouvrir sur la liste complète.
- Cocher et décocher chaque ligne.
- Retrouver les données après avoir fermé la page.

**Non-Goals:**

- Départs, J-x, agenda.
- Réglages après usage.
- Écarts d'un enfant par rapport au modèle.
- Rendu final. L'écran doit être lisible, pas décoré.

## Decisions

- Les données restent dans le navigateur. Il n'y a pas de compte.
- Un objet est partagé par son nom. Le nombre est sur la ligne du sac.
- L'enfant de cette tranche affiche exactement les lignes de son modèle.

## Risks / Trade-offs

- Les données du navigateur ne suivent pas un changement de téléphone. Accepté pour cette tranche.
