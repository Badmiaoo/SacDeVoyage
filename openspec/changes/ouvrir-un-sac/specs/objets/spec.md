# Spec Delta

## Purpose

Catalogue des affaires pour la première tranche.

## ADDED Requirements

### Requirement: Nom unique
Un objet DOIT avoir un nom. Deux objets NE DOIVENT PAS porter le même nom.

#### Scenario: Nom déjà pris
- **WHEN** on crée un objet avec un nom déjà utilisé
- **THEN** l'objet n'est pas créé
