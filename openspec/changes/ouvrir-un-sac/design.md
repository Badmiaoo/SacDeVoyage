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
- Le premier code enregistre déjà toute la forme du contrat. Cette tranche n'en montre qu'une partie. Aucun champ n'est ajouté, renommé ou jeté plus tard.
- Un enfant ne copie pas les lignes du modèle. Il ne garde que ses écarts. Ce qu'on affiche se calcule.
- Le réglage après usage est déjà sur le modèle de sac. L'état rempli ou à vider est déjà sur l'enfant. L'écran ne les montre pas encore.
- Un modèle de départ, un enfant de départ et la case d'une action existent déjà dans les données. L'agenda se déduit de ces actions. Il n'est pas une deuxième liste.
- Un objet est partagé par son nom. Le nombre est sur la ligne du sac.

## Risks / Trade-offs

- Les données du navigateur ne suivent pas un changement de téléphone. Accepté pour cette tranche.
