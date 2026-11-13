# Objets

## Purpose

Catalogue des affaires. Le nom est unique et partagé. Le nombre n'est pas ici.

## Requirements

### Requirement: Nom unique
Un objet DOIT avoir un nom. Deux objets NE DOIVENT PAS porter le même nom.

#### Scenario: Nom déjà pris
- **WHEN** on crée un objet avec un nom déjà utilisé
- **THEN** l'objet n'est pas créé

### Requirement: Renommer se propage
Quand le nom d'un objet change, tous les sacs qui l'utilisent DOIVENT afficher le nouveau nom.

#### Scenario: Renommage
- **WHEN** on renomme Stab en Gilet
- **THEN** le modèle et les enfants qui contenaient Stab affichent Gilet

### Requirement: Supprimer se propage
Quand un objet est supprimé, il DOIT disparaître de tous les sacs.

#### Scenario: Suppression
- **WHEN** on supprime un objet présent dans un modèle et dans un enfant
- **THEN** la ligne disparaît des deux
