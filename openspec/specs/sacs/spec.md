# Sacs

## Purpose

Un modèle de sac décide du contenu. Un enfant est le sac qu'on ouvre et qu'on coche.

## Requirements

### Requirement: Lignes du modèle
Un modèle de sac DOIT contenir des lignes. Une ligne est un objet et un nombre. On NE DOIT PAS cocher une ligne sur le modèle.

#### Scenario: Composer le modèle
- **WHEN** on ajoute Masque avec le nombre 1 au modèle Plongée
- **THEN** la ligne est enregistrée et aucune case à cocher n'est proposée

### Requirement: Ouvrir un enfant
Un enfant DOIT avoir un nom et un modèle. En l'ouvrant, on DOIT voir toutes les lignes héritées, avec leur nombre. Chaque ligne DOIT pouvoir être cochée et décochée.

#### Scenario: Vérifier le sac
- **WHEN** on ouvre l'enfant Plongée du mardi
- **THEN** toutes les affaires du modèle sont visibles, avec leur nombre, et chacune peut être cochée

### Requirement: Écart de l'enfant
Un enfant PEUT ajouter une ligne ou changer un nombre. Cet écart NE DOIT PAS remonter au modèle. Une ligne ajoutée ensuite au modèle DOIT arriver dans l'enfant. Les écarts déjà présents DOIVENT rester.

#### Scenario: Lampe et palmes
- **WHEN** l'enfant ajoute Lampe, passe Masque à 2, puis le modèle gagne Palmes
- **THEN** le modèle n'a pas Lampe et garde Masque à 1, et l'enfant a Lampe, Masque à 2, et Palmes

### Requirement: Réglage après usage
À la création d'un modèle de sac, on DOIT choisir un seul réglage : il reste prêt, tout sortir après la fin, ou sortir seulement les affaires marquées. Une affaire marquée DOIT l'être sur la ligne de ce sac.

#### Scenario: Matériel humide
- **WHEN** le modèle Plongée est réglé sur sortir seulement les affaires marquées, et Stab est marqué
- **THEN** Masque, non marqué, ne fait pas partie de ce qui doit sortir

### Requirement: Voir seulement ce qui sort
Après la sortie, l'ouverture du sac DOIT montrer seulement les affaires à sortir. Les autres NE DOIVENT PAS s'afficher. Pour un départ en une fois, la sortie est passée après la date de fin. Pour un départ récurrent, elle est passée après le jour de la règle.

#### Scenario: Mardi soir
- **WHEN** on ouvre Plongée après le mardi et que seul Stab est à sortir
- **THEN** Stab est visible et le reste de la liste ne l'est pas

### Requirement: États du sac
Un sac DOIT avoir un seul état parmi rempli, à vider et à remplir. Après la sortie, un sac réglé sur tout sortir ou sur sortir les affaires marquées DOIT passer à « à vider ». Un sac réglé pour rester prêt DOIT rester rempli.

#### Scenario: Après la plongée
- **WHEN** la sortie de Plongée est passée et le réglage est de sortir les affaires marquées
- **THEN** l'état du sac est à vider

### Requirement: Après avoir vidé
Marquer un sac comme vidé DOIT quitter l'état « à vider ». Si son réglage est de sortir seulement les affaires marquées, il DOIT passer à « à remplir ». Si son réglage est de tout sortir, il NE DOIT PAS passer à « à remplir ».

#### Scenario: Matériel humide sorti
- **WHEN** on marque Plongée comme vidé et que seules des affaires marquées devaient sortir
- **THEN** l'état devient à remplir

#### Scenario: Valise vidée
- **WHEN** on marque une valise réglée sur tout sortir comme vidée
- **THEN** elle n'est plus à vider et elle n'est pas à remplir

### Requirement: Retour à rempli
Le passage à l'état rempli DOIT être manuel.

#### Scenario: Remise du matériel
- **WHEN** Stab est sec et remis dans le sac et qu'on passe le sac sur rempli
- **THEN** l'état est rempli
