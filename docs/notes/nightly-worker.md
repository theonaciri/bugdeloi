# Synchronisation nocturne (LEGI + balayage C0.2)

Chaque nuit à 03:30 (Europe/Paris, +0–15 min aléatoires), `bugdeloi-nightly.timer` lance
`bugdeloi-nightly.service`, qui exécute `scripts/nightly-sync.sh` depuis
`~/.local/share/bugdeloi/current` :

1. `ingest legi --incremental --reproject` (incréments DILA, puis reprojection de l'arbre daté) ;
2. `sweep run` (4 détecteurs déterministes C0.2). Les résultats restent des **candidats** : rien n'est
   publié sans rejeu et qualification humaine.

Un verrou `flock -n` (`$XDG_RUNTIME_DIR` ou `/tmp`, `bugdeloi-nightly.lock`) empêche tout chevauchement.
Aucun secret n'est journalisé ; la connexion Postgres passe par le socket Unix.

## Essai à blanc

```bash
scripts/nightly-sync.sh --dry-run   # affiche les commandes, n'exécute rien, base intacte
```

## Suivi

```bash
systemctl list-timers bugdeloi-nightly.timer
journalctl -u bugdeloi-nightly -n 100 --no-pager
systemctl status bugdeloi-nightly.service
```

## Lancement manuel, pause, reprise

```bash
sudo systemctl start --no-block bugdeloi-nightly.service   # exécution immédiate
sudo systemctl disable --now bugdeloi-nightly.timer        # pause
sudo systemctl enable --now bugdeloi-nightly.timer         # reprise
```

`scripts/deploy.sh` installe les unités et active le timer sans lancer de synchronisation.

## `/desk`

`bugdeloi-web.service` définit `DESK_ENABLED=1` : le guichet de réservation de tâches est ouvert
(débit limité par IP, baux par transactions atomiques). Pour le couper : retirer cette ligne, puis
`sudo systemctl daemon-reload && sudo systemctl restart bugdeloi-web`.
