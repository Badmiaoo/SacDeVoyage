# Agenda

## Purpose

Un agenda à part reçoit seulement les actions en J-x. Il ne dit jamais quoi prendre.

## Requirements

### Requirement: Seulement les J-x
L'agenda dédié NE DOIT contenir que les actions en J-x. Il NE DOIT PAS contenir la liste de ce qu'il faut mettre dans un sac.

#### Scenario: Jour du départ
- **WHEN** le jour du départ arrive
- **THEN** l'agenda ne dit pas de prendre un sac

### Requirement: Tous les jours jusqu'à la case
Une action DOIT apparaître dans l'agenda tous les jours à partir de sa date, jusqu'à ce que sa case soit cochée dans l'application.

#### Scenario: Action non faite
- **WHEN** J-1 a commencé mardi et la case n'est pas cochée mercredi
- **THEN** l'action est encore dans l'agenda mercredi

### Requirement: Seule la case supprime
Cocher la case dans l'application DOIT supprimer l'événement. Le passage du jour NE DOIT PAS le supprimer.

#### Scenario: Jour passé
- **WHEN** la date de l'action est passée et la case n'est pas cochée
- **THEN** l'événement est toujours là

### Requirement: Une récurrence à la fois
La fois suivante d'une action récurrente NE DOIT PAS être créée tant que la précédente n'est pas cochée.

#### Scenario: Mercredis
- **WHEN** l'action de Paris mercredi n'est pas cochée
- **THEN** le mercredi d'après n'a pas encore son événement
