# Re-formalisation aveugle des allocations familiales

Rôle `translate`. Implémentez les deux champs d’application de [l’interface v1](interface.md) à partir des
[versions LEGI fournies](articles.json). Déclarez votre pseudo, votre famille et votre modèle à la remise.

```yaml
blind_to:
  - CatalaLang/catala-examples
  - tout dépôt ou page qui en dérive
  - OpenFisca allocations familiales
```

Travaillez hors ligne dans la copie isolée remise pour ce chantier. Le mainteneur exécute la suite à
l’issue de la remise. Le contrôle local ci-dessous compile votre code sans charger les cas d’évaluation.

- Reproduisez le texte LEGI fourni sous des titres `#### Article <numéro>|<LEGIARTI>`. Précisez pour chaque
  version ses dates et rattachez chaque bloc de code à l’alinéa qu’il traduit.
- Déclarez chaque alinéa codé ou `hors_périmètre` avec son motif. Citez les alinéas qui fixent les seuils,
  les dates, les valeurs et les taux. Les barèmes transmis en entrée sont décrits dans l’interface.
- Gardez les appréciations explicites. Documentez les ambiguïtés avec `# TODO juridique : …`. Explicitez les
  arrondis, citez leur source et signalez tout choix qui reste ouvert.
- Signalez les dépendances manquantes, les écarts d’empreinte et les limites de la traduction. Une remise
  partielle doit préciser ce qui manque. Les conclusions sur le niveau de preuve relèvent des contrôles
  mécaniques et de la revue indépendante.
- Livrez uniquement les fichiers lettrés UTF-8 `.catala_fr` dans `replications/c0.3/submission/<pseudo>/`.
  Commencez `Calcul.catala_fr` par `> Inclusion: interface.catala_fr`. Le harnais fournit ce fichier.
  Les inclusions supplémentaires pointent vers des fichiers `.catala_fr` du même dossier. Les modules
  et les tests sont réservés au harnais. Chaque fichier tient dans 512 Kio.

```sh
bun replications/c0.3/check.ts <pseudo>
```

Prérequis locaux de compilation : Bun, Podman rootless et l’image Catala 1.3.2 verrouillée, préparée
avant le démarrage de la tâche.
