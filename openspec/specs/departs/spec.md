# Départs

## Purpose

Un modèle de départ décide des sacs et des actions en J-x. Un enfant est le départ qu'on ouvre.

## Requirements

### Requirement: Contenu du modèle
Un modèle de départ DOIT indiquer quels sacs il contient et quelles actions en J-x il prévoit. On NE DOIT PAS cocher sur le modèle.

#### Scenario: Modèle avec avion
- **WHEN** on crée le modèle Avec avion avec un sac et l'action J-30 vérifier les papiers
- **THEN** le sac et l'action sont enregistrés sans case à cocher

### Requirement: Départ en une fois
Un enfant de départ en une fois DOIT avoir une date de début et une date de fin. Les J-x DOIVENT se compter depuis le début.

#### Scenario: CSE juin
- **WHEN** le début est le 12 août et le modèle contient J-30 et J-1
- **THEN** J-30 tombe le 13 juillet et J-1 tombe le 11 août

### Requirement: Départ récurrent
Un enfant de départ récurrent NE DOIT PAS demander de date de début ni de fin. Le jour de la règle DOIT être le jour du départ. Une action en J-x DOIT se caler sur ce jour.

#### Scenario: Paris mercredi
- **WHEN** l'enfant est récurrent tous les mercredis
- **THEN** aucune date n'est saisie et le mercredi est le jour

### Requirement: Ouvrir un départ
En ouvrant un enfant de départ, on DOIT pouvoir choisir un de ses sacs et voir le contenu de ce sac. Les actions en J-x DOIVENT se cocher sur le départ. Elles NE DOIVENT PAS apparaître dans le sac.

#### Scenario: Choisir le sac
- **WHEN** on ouvre CSE juin et qu'on choisit un sac
- **THEN** on voit le contenu de ce sac, et les actions en J-x restent sur le départ
