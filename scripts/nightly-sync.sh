#!/usr/bin/env bash
# Synchronisation nocturne : ingestion LEGI incrémentale + reprojection, puis balayage C0.2.
#
#   scripts/nightly-sync.sh [--dry-run]
#
# --dry-run : affiche les étapes exactes, n'exécute rien et ne touche pas à la base.
# Variables : BUGDELOI_ROOT (défaut ~/.local/share/bugdeloi/current), DATABASE_URL, BUN.
set -euo pipefail

DRY_RUN=0
case "${1:-}" in
  "") ;;
  --dry-run) DRY_RUN=1 ;;
  *) echo "usage : $0 [--dry-run]" >&2; exit 2 ;;
esac

ROOT="${BUGDELOI_ROOT:-/home/ubuntu/.local/share/bugdeloi/current}"
BUN="${BUN:-/home/ubuntu/.bun/bin/bun}"
export DATABASE_URL="${DATABASE_URL:-postgres://ubuntu@localhost:5432/bugdeloi?host=/var/run/postgresql}"
LOCK="${XDG_RUNTIME_DIR:-/tmp}/bugdeloi-nightly.lock"

log() { printf '%s [nightly] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
# Ne jamais afficher DATABASE_URL (peut contenir un mot de passe).
safe_url() { printf '%s' "${DATABASE_URL%%\?*}" | sed -E 's#(://[^:/@]*):[^@]*@#\1:***@#'; }

INGEST=("$BUN" packages/ingest/src/cli.ts legi --incremental --reproject)
SWEEP=("$BUN" packages/sweep/src/cli.ts run)

if [[ "$DRY_RUN" == 1 ]]; then
  log "DRY-RUN : aucune commande exécutée, base intacte"
  log "racine    : $ROOT"
  log "base      : $(safe_url)"
  log "verrou    : flock -n $LOCK"
  log "étape 1/2 : cd $ROOT && ${INGEST[*]}"
  log "étape 2/2 : cd $ROOT && ${SWEEP[*]}"
  exit 0
fi

exec 9>"$LOCK"
if ! flock -n 9; then
  log "une synchronisation est déjà en cours ($LOCK), abandon"
  exit 0
fi

cd "$ROOT"
log "début (révision $(cat REVISION 2>/dev/null || echo inconnue), base $(safe_url))"

log "étape 1/2 : ingestion LEGI incrémentale + reprojection"
"${INGEST[@]}"

log "étape 2/2 : balayage C0.2"
"${SWEEP[@]}"

log "terminé"
