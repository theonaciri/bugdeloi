# Analyse des textes LEGI

Lisez uniquement `blind-packet.json`, dans un environnement isolé sans accès à d’autres
documents ni au web. Chaque entrée contient le texte DILA d’une version d’article, son
identifiant LEGIARTI, ses dates et l’empreinte du texte.

Relevez les passages dont l’application ou la mise en calcul pose une question précise.
Pour chaque passage, expliquez la question et ce qu’il faudrait savoir ou décider pour y
répondre. Appuyez-vous sur les termes du passage. Soumettez un tableau JSON contenant
une observation par question, avec quatre champs :

- `legiarti` : identifiant de la version dans le paquet.
- `category` : `appreciation` (critère à apprécier), `perimetre` (champ d’application),
  `renvoi_externe` (texte de renvoi absent), `arrondi` (précision ou étape d’arrondi),
  `parametre` (donnée à préciser), `calcul` (assiette ou ordre des opérations),
  ou `autre`.
- `quote` : extrait exact et continu du texte LEGI concerné.
- `explanation` : question soulevée et son lien avec l’extrait.

Renvoyez `[]` si vous ne relevez aucune question.
