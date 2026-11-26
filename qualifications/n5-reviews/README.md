# Revues humaines signées — niveau N5

Le niveau **N5** (`AGENTS.md` §4.1) exige la **revue d'un juriste identifié**, matérialisée par un commit
**signé** qui introduit ou met à jour un fichier de revue. Ce dossier contient ces fichiers et leur vérificateur.

> Un agent LLM n'écrit **jamais** de fichier de revue N5. Un commit non signé, ou dont la signature est invalide,
> n'accorde jamais N5.

## Qui peut relire

Juristes, fiscalistes, spécialistes des prestations sociales, capables d'identifier leur qualification
(`reviewer.credentials`) et leur rattachement (`reviewer.affiliation`).

## Comment relire un nœud N4

1. Choisis un nœud ayant atteint N4. La page du nœud donne son interface, son fichier lettré et le commit du corpus.
2. Relis, unité légale par unité légale, le texte officiel (LEGI) à côté du code Catala. Vérifie que
   `text_sha256` correspond au texte que tu as lu.
3. Relis **chaque choix d'interprétation** : lecture d'un seuil, d'un arrondi, d'une exception, entrées
   `appréciation_…` pour les standards non calculables. Liste-les dans `interpretation_choices_checked`.
4. Copie `EXEMPLE-N5.yaml.sample` vers `AAAA-MM-JJ-<handle>-<nœud>.yaml` et remplis tous les champs.
5. Choisis le `verdict` :
   - `approved` : les choix d'interprétation sont défendables par le texte ;
   - `changes_requested` : explique le motif dans `note`. Cela n'accorde pas N5.
6. **Commite avec une signature** (GPG, SSH ou S/MIME) :
   `git config commit.gpgsign true` puis `git commit -S`. Ta clé doit pouvoir être vérifiée par Git sur la
   machine du contrôle.
7. Lance le contrôle : `bun qualifications/n5-reviews/verify-n5.ts`.

## Ce que contrôle `verify-n5.ts`

| Statut            | Sens                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `VALID_SIGNED`    | Schéma valide et dernier commit du fichier signé (`%G?` = `G` ou `U`)                     |
| `UNSIGNED_COMMIT` | Commit sans signature : **pas de N5**                                                     |
| `BAD_SIGNATURE`   | Signature mauvaise, expirée, révoquée ou non vérifiable : **pas de N5**                   |
| `UNCOMMITTED`     | Fichier absent de l'historique ou modifié depuis son dernier commit : **pas de N5**       |
| `INVALID_SCHEMA`  | Champ manquant ou mal formé (LEGIARTI, SHA-256, qualification du relecteur, choix relus…) |

N5 est accordé à un nœud seulement si au moins une revue est `VALID_SIGNED` **et** de verdict `approved`.
Les fichiers `*.sample` sont ignorés. Code de sortie : 1 si un fichier de revue n'est pas `VALID_SIGNED`.

Le contrôle est mécanique : il ne juge pas le fond. Il ne vérifie pas non plus que le `text_sha256` et le commit
cités correspondent au corpus : cet appariement est fait par les contrôles N1 et par la page du nœud.
