# Spec Delta

## Purpose

Ouvrir un sac et cocher ce qui doit être dedans.

## ADDED Requirements

### Requirement: Lignes du modèle
Un modèle de sac DOIT contenir des lignes. Une ligne est un objet et un nombre. On NE DOIT PAS cocher une ligne sur le modèle.

#### Scenario: Composer le modèle
- **WHEN** on ajoute une affaire avec un nombre au modèle
- **THEN** la ligne est enregistrée et aucune case à cocher n'est proposée

### Requirement: Ouvrir un enfant
Un enfant DOIT avoir un nom et un modèle. En l'ouvrant, on DOIT voir toutes les lignes du modèle, avec leur nombre. Chaque ligne DOIT pouvoir être cochée et décochée.

#### Scenario: Vérifier le sac
- **WHEN** on ouvre l'enfant
- **THEN** toutes les affaires du modèle sont visibles, avec leur nombre, et chacune peut être cochée
