# Agenda

## Purpose

Un agenda à part reçoit les actions en J-x et les sacs à vider ou à remplir. Il ne dit jamais quoi mettre dans un sac.

## Requirements

### Requirement: Pas la liste du sac
L'agenda dédié NE DOIT PAS contenir la liste de ce qu'il faut mettre dans un sac.

#### Scenario: Jour du départ
- **WHEN** le jour du départ arrive
- **THEN** l'agenda ne dit pas quelles affaires prendre

### Requirement: Tous les jours jusqu'à la case
Une action en J-x DOIT apparaître dans l'agenda tous les jours à partir de sa date, jusqu'à ce que sa case soit cochée dans l'application.

#### Scenario: Action non faite
- **WHEN** J-1 a commencé mardi et la case n'est pas cochée mercredi
- **THEN** l'action est encore dans l'agenda mercredi

### Requirement: Seule la case supprime
Cocher la case d'une action dans l'application DOIT supprimer son événement. Le passage du jour NE DOIT PAS le supprimer.

#### Scenario: Jour passé
- **WHEN** la date de l'action est passée et la case n'est pas cochée
- **THEN** l'événement est toujours là

### Requirement: Une récurrence à la fois
La fois suivante d'une action récurrente NE DOIT PAS être créée tant que la précédente n'est pas cochée.

#### Scenario: Mercredis
- **WHEN** l'action de Paris mercredi n'est pas cochée
- **THEN** le mercredi d'après n'a pas encore son événement

### Requirement: Rappel d'état du sac
Chaque sac dont l'état est « à vider » ou « à remplir » DOIT avoir un événement dans l'agenda, tous les jours, tant que cet état dure. L'événement DOIT nommer le sac et son état. Il NE DOIT PAS lister les affaires.

#### Scenario: Sac à vider
- **WHEN** Plongée est à vider
- **THEN** l'agenda a chaque jour un événement Plongée, à vider

### Requirement: Fin du rappel
Vider un sac DOIT supprimer son événement « à vider ». Le passer sur rempli DOIT supprimer son événement « à remplir ». Le passage du jour NE DOIT PAS supprimer ces événements.

#### Scenario: Sac vidé
- **WHEN** on marque Plongée comme vidé
- **THEN** l'événement « à vider » de Plongée disparaît
