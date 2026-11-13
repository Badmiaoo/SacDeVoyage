# Pour l'agent qui code

Le contrat est dans `openspec/specs`. On ne code pas une idée qui n'y est pas.

Avant une tranche :

1. Écrire le changement dans `openspec/changes`.
2. Écrire le test qui échoue.
3. Coder le minimum pour qu'il passe.
4. Lancer `npm test`. Tout doit passer, y compris les tests déjà là.

Le site est statique. Pas de compilateur. GitHub Actions lance les tests, puis publie. Une publication ne part pas si un test échoue.

Pas de code prévu pour être jeté ou migré ensuite. La forme des données dans `src/store.js` reste celle du contrat.
