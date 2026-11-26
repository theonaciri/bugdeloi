#!/usr/bin/env bash
# Déploie une révision Git de BugDeLoi en production locale (127.0.0.1:19069).
#
#   scripts/deploy.sh [ref]        # ref par défaut : HEAD
#
# Chaque révision est construite dans son propre dossier (releases/<sha>) à partir de `git archive`,
# indépendamment de la copie de travail. Le lien `current` bascule seulement si la construction
# réussit, puis le service est redémarré ; si le contrôle de santé échoue, retour à la révision
# précédente. On garde les 5 dernières révisions.
set -euo pipefail

REF="${1:-HEAD}"
REPO="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"
ROOT="${BUGDELOI_HOME:-$HOME/.local/share/bugdeloi}"
RELEASES="$ROOT/releases"
CURRENT="$ROOT/current"
SERVICE="bugdeloi-web"
HEALTH_URL="http://127.0.0.1:19069/api/status.json"
BUN="${BUN:-$HOME/.bun/bin/bun}"

SHA="$(git -C "$REPO" rev-parse --verify "$REF^{commit}")"
SHORT="${SHA:0:12}"
DEST="$RELEASES/$SHORT"
PREVIOUS="$(readlink -f "$CURRENT" 2>/dev/null || true)"

log() { printf '\033[1m[deploy]\033[0m %s\n' "$*"; }

if [[ -n "$(git -C "$REPO" status --porcelain)" && "$REF" == "HEAD" ]]; then
  log "attention : la copie de travail a des modifications non commitées ; elles ne seront PAS déployées."
fi

mkdir -p "$RELEASES"
if [[ ! -d "$DEST" ]]; then
  log "extraction de $SHORT dans $DEST"
  TMP="$(mktemp -d "$RELEASES/.tmp-$SHORT-XXXX")"
  git -C "$REPO" archive "$SHA" | tar -x -C "$TMP"
  printf '%s\n' "$SHA" > "$TMP/REVISION"
  (
    cd "$TMP"
    log "installation des dépendances"
    nice -n 10 "$BUN" install --frozen-lockfile
    log "migrations de la base"
    "$BUN" run db:migrate
    log "construction du site"
    nice -n 10 "$BUN" run --filter @bugdeloi/web build
  )
  mv "$TMP" "$DEST"
else
  log "révision $SHORT déjà construite"
fi

log "installation de l'unité systemd"
sudo install -m 0644 "$DEST/infra/systemd/$SERVICE.service" "/etc/systemd/system/$SERVICE.service"
for unit in bugdeloi-nightly.service bugdeloi-nightly.timer; do
  sudo install -m 0644 "$DEST/infra/systemd/$unit" "/etc/systemd/system/$unit"
done
mkdir -p "$HOME/.cache/bugdeloi"
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE" >/dev/null 2>&1 || true
# Le timer est activé sans lancer la synchronisation (--no-block ne s'applique qu'au timer).
sudo systemctl enable --now --no-block bugdeloi-nightly.timer >/dev/null 2>&1 || log "avertissement : activation du timer nocturne impossible"

ln -sfn "$DEST" "$CURRENT"
log "redémarrage de $SERVICE sur $SHORT"
sudo systemctl restart "$SERVICE"

ok=0
for _ in $(seq 1 20); do
  if curl -fsS --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done

if [[ "$ok" != 1 ]]; then
  log "ÉCHEC du contrôle de santé ($HEALTH_URL)"
  sudo journalctl -u "$SERVICE" -n 30 --no-pager || true
  if [[ -n "$PREVIOUS" && -d "$PREVIOUS" && "$PREVIOUS" != "$DEST" ]]; then
    log "retour à $(basename "$PREVIOUS")"
    ln -sfn "$PREVIOUS" "$CURRENT"
    sudo systemctl restart "$SERVICE"
  fi
  exit 1
fi

log "en ligne : $SHORT ($HEALTH_URL)"

# Ménage : garder les 5 révisions les plus récentes (jamais celle en service).
ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +6 | while read -r old; do
  [[ "$(readlink -f "$old")" == "$(readlink -f "$CURRENT")" ]] && continue
  rm -rf "$old"
done
