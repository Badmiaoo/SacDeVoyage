# Proposal

## Why

La liste voulue existe. Il manque l'appel qui crée le calendrier « Sac de voyage » et n'écrit que dedans.

## What Changes

- Créer ce calendrier s'il n'existe pas, le réutiliser sinon.
- Y écrire des journées entières, avec une clé privée, et une description vide.
- Ne pas lire ni modifier un autre calendrier.
- Connexion sans secret client, par code et vérificateur.

## Capabilities

### Modified Capabilities

- `agenda`: le calendrier dédié est un calendrier Google nommé Sac de voyage

## Impact

L'identifiant client Google n'est pas encore posé. Tant qu'il est vide, l'application n'appelle pas Google.
