# Design

## Décision

Le calendrier s'appelle « Sac de voyage ». On le retrouve par son nom. S'il existe, on ne le recrée pas.

Chaque événement porte deux propriétés privées : `app` vaut `sac-de-voyage`, `key` est la clé stable. La lecture ignore tout événement sans cette clé. La liste demande seulement `app=sac-de-voyage`, et suit les pages.

La description envoyée est toujours vide. Le résumé est le titre déjà décidé.

La connexion utilise le flux avec vérificateur. Aucun secret n'est envoyé. Le jeton est gardé dans le navigateur. S'il n'y a pas d'identifiant client, aucun appel ne part.
