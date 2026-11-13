# Design

## Décision

`agendaEvents` reste la liste voulue. `planCalendar` la compare aux événements déjà posés.

La fin d'un événement est le lendemain d'aujourd'hui, exclue, comme le fait Google pour une journée entière. Ainsi l'événement est visible chaque jour depuis son début.

Le début ne bouge pas. Pour un sac, le premier jour connu est gardé même si la liste voulue redonne aujourd'hui.

La clé d'une action contient le départ, l'action et le jour de cette fois. La fois suivante est donc un autre événement. La clé d'un sac contient le sac et l'état. Passer de « à vider » à « à remplir » supprime l'un et crée l'autre.

`applyPlan` supprime, puis crée, puis met à jour. Le calendrier est injecté. Les tests n'appellent pas Google.
