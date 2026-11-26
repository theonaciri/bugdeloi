# C0.4 · Rappel des ambiguïtés juridiques connues

Cette expérience mesure la capacité d’un analyste (ou d’un détecteur mécanique témoin) à retrouver à l’aveugle les questions juridiques (`TODO`) et dépendances à la doctrine (`BOI-`) annotées par les auteurs d’Inria et de la DGFiP dans `CatalaLang/catala-examples`.

## Reproduire l’expérience

```bash
# 1. Extraire l’inventaire de référence depuis le commit épinglé d’Inria
bun replications/c0.4/extract-ground-truth.ts

# 2. Construire le paquet strictement aveugle (textes LEGI seuls, sans aucune annotation Inria)
bun replications/c0.4/generate-task.ts

# 3. Exécuter le témoin mécanique déterministe (sans LLM)
bun replications/c0.4/baseline-heuristic.ts

# 4. Évaluer les soumissions et régénérer summary.json et REPORT.md
bun replications/c0.4/evaluate.ts
```

Les résultats chiffrés sont consignés dans `summary.json` et `REPORT.md`. **Un compte, pas une probabilité.**
