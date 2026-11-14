# Documentation fonctionnelle

Ce que l'application fait, page par page, tel que c'est livré.

## Accueil — Sacs

Liste des sacs. Ordre : à vider, à remplir, à vérifier ou en défaut, prêt.

Chaque ligne montre le nom, l'état, et un compte `fait/total`.

Une recherche filtre par nom. Si rien ne correspond, le message le dit.

Les réglages (créer un sac, copie de sauvegarde) sont derrière « Réglages ».

Il n'y a pas de « à faire » ici. Les actions J-x sont sur Départs.

## Un sac

En haut : l'état et le compte. Juste en dessous, le geste principal s'il y en a un : « C'est vidé » ou « C'est rempli ».

Puis les lignes, groupées si le modèle a des groupes. On coche. Le nombre n'apparaît que s'il est supérieur à 1.

En bas : le lien vers le modèle, les départs qui utilisent ce sac, et « Régler ce sac ».

Dans les réglages : remettre à zéro, renommer, ajouter une ligne pour ce sac seulement, exclure une ligne héritée, supprimer le sac. Supprimer prévient que les départs le perdront.

Un sac jamais coché dit « À vérifier ». Un sac partiellement coché dit « En défaut ».

## Départs

Premier bloc : « À faire ». Toutes les actions, échues d'abord, puis à venir, avec la date.

Puis la liste des départs, triée par date. Puis ce qui est dans l'agenda. Puis le formulaire de création.

Créer un départ : choisir le modèle, le type (une fois ou récurrent), les dates ou le jour, le nom. Un nom déjà pris est refusé.

## Un départ

Les actions à cocher, avec leur date. Cocher avant la date ne fait rien et le dit. Une action récurrente avance à la suivante une fois cochée ; un second appui avant la date suivante ne défait pas la coche.

Les sacs du départ, avec leur compte.

Renommer et supprimer sont en bas. Supprimer un départ déjà passé ne défait pas un sac déjà à vider.

## Modèles

Deux listes : modèles de sac, modèles de départ.

Créer un modèle de sac demande le réglage après usage : reste prêt, tout sortir, sortir le marqué.

Un nom déjà pris est refusé, à la création comme au renommage.

## Un modèle de sac

Les lignes : objet, nombre, groupe, « à sortir » si le réglage est « marqué ».

Ajouter une ligne depuis le catalogue. Changer le nombre. Retirer une ligne. Le retrait d'une ligne du modèle ne retire pas une ligne que l'enfant avait ajoutée lui-même.

Supprimer le modèle prévient qu'il emporte ses sacs et les départs qui s'en servent.

## Un modèle de départ

Les sacs inclus. Les actions, avec le nombre de jours avant. Les départs datés qui s'en servent.

Supprimer prévient qu'il emporte les départs datés.

## Objets

Le catalogue. Créer, renommer, supprimer. Le nom est unique, sans tenir compte des accents ni de la casse. Renommer se propage. Supprimer retire l'objet partout, y compris des exclusions.

## Après une sortie

Le jour qui suit la fin d'un départ, ou le lendemain d'un récurrent, les sacs dont le modèle dit de sortir passent à « à vider ».

- « Tout sortir » : toutes les lignes. Après « C'est vidé », le sac revient à prêt, coches effacées.
- « Sortir le marqué » : seulement les lignes marquées. Après « C'est vidé », le sac passe à « à remplir ». « C'est rempli » le ramène à prêt.
- « Reste prêt » : rien ne change.

Deux départs le même jour ne vident pas deux fois le même sac. Remettre à zéro un sac redemande son vidage, sans toucher aux autres.

## Agenda

Un calendrier Google nommé « Sac de voyage », à part des autres.

Il reçoit :

- chaque action J-x, du jour prévu jusqu'à la coche, sous le titre « Nom du départ · action » ;
- chaque sac à vider ou à remplir, sous le titre « Nom, à vider » ou « Nom, à remplir ».

Jamais la liste des affaires. L'événement tient soixante jours, pour rester visible même si l'application n'est pas ouverte le lendemain. Cocher dans l'application le retire.

## Sauvegarde

Tout est sur l'appareil. Une copie JSON s'exporte et s'importe. Une copie illisible est refusée. Une base déjà remplie n'est pas remplacée par la maquette.
