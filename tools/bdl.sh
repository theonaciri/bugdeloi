#!/usr/bin/env bash
set +x
set -euo pipefail

origin=${BDL_ORIGIN:-https://bugdeloi.theonaciri.fr}
origin=${origin%/}
family=${BDL_FAMILY:-openai}
model=${BDL_MODEL:-unknown}
role=${BDL_ROLE-translate}
image=${BDL_IMAGE:-ghcr.io/theonaciri/bugdeloi-catala:1.3.2}
lease_dir=.bdl/leases
lease_pattern='^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z'
path_pattern='^[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*/?\z'

usage() {
  cat <<'HELP'
Usage : tools/bdl.sh <commande>

  setup                     Vérifier les outils et récupérer l’image Catala.
  next                      Réserver une tâche et préparer son fichier Catala.
  beat <task_id>            Renouveler le bail.
  check <task_id>           Contrôler la contribution et lancer les tests Catala.
  submit <task_id>          Créer une branche et ouvrir une pull request.
  release <task_id> <motif> Libérer le bail.

Configuration : BDL_ORIGIN, BDL_HANDLE, BDL_FAMILY, BDL_MODEL, BDL_ROLE, BDL_IMAGE.
HELP
}

die() {
  printf '%s\n' "$*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null || die "Commande requise introuvable : $1."
}

container_engine() {
  if command -v podman >/dev/null; then
    printf '%s\n' podman
  else
    command -v docker >/dev/null || die "Installez Podman ou Docker."
    printf '%s\n' docker
  fi
}

setup() {
  local command engine
  for command in git gh curl jq bun; do
    need "$command"
  done
  engine=$(container_engine)
  gh auth status
  if ! "$engine" pull "$image"; then
    if [[ $(uname -m) == aarch64 || $(uname -m) == arm64 ]]; then
      printf 'Sur ARM64, essayez %s pull --platform linux/amd64 %s (avec émulation) ou %s build -t %s -f infra/catala/Containerfile infra/catala.\n' \
        "$engine" "$image" "$engine" "$image" >&2
    fi
    die "Échec de la récupération de l’image Catala."
  fi
}

valid_task_id() {
  [[ $1 =~ ^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$ ]]
}

valid_origin() {
  [[ $1 =~ ^https?://([A-Za-z0-9.-]+|\[[[:xdigit:]:]+\])(:[0-9]+)?$ ]]
}

valid_role() {
  case $1 in
    analyst|translate|oracle|redteam|backtranslate|judge|doctrine|reduce) return 0 ;;
    *) return 1 ;;
  esac
}

valid_family() {
  case $1 in
    anthropic|openai|google|mistral|meta|deepseek|qwen|local-autre|humain) return 0 ;;
    *) return 1 ;;
  esac
}

valid_reason() {
  case $1 in
    submitted|text_mismatch|ambiguous_text|missing_dependency|interface_too_weak|needs_reduction|out_of_time|other)
      return 0 ;;
    *) return 1 ;;
  esac
}

valid_model() {
  [[ -n $1 && ! $1 =~ [[:cntrl:]] ]]
}

at_repo_root() {
  local root
  need git
  root=$(git rev-parse --show-toplevel) || die "Lancez cette commande depuis un dépôt Git."
  cd -- "$root"
}

# Vérifie chaque composant sans suivre de liens symboliques.
safe_path() {
  local path=$1 part prefix=
  local -a parts
  [[ $path =~ ^[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*/?$ ]] || return 1
  IFS=/ read -r -a parts <<< "$path"
  for part in "${parts[@]}"; do
    [[ $part != . && $part != .. && ${part,,} != .git ]] || return 1
    prefix=${prefix:+$prefix/}$part
    [[ ! -L $prefix ]] || return 1
  done
}

save_skeleton() {
  local file=$1
  safe_path "$file" || die "Chemin Catala non autorisé."
  [[ ! -e $file ]] || return 0

  jq -e '
    .task.context_pack.article_number as $number
    | .task.legal_units[0] as $unit
    | ($number | type == "string" and length > 0 and (test("[[:cntrl:]|]") | not))
      and ($unit.legiarti | type == "string" and test("^LEGIARTI[0-9]{12}$"))
      and ($unit.text | type == "string" and length > 0)
  ' "$lease_file" >/dev/null || die "Numéro d’article ou texte LEGI manquant ou invalide. Bail conservé."
  mkdir -p -- "${file%/*}"
  (
    set -o noclobber
    jq -jr '
      .task.context_pack.article_number as $number
      | .task.legal_units[0]
      | "#### Article \($number)|\(.legiarti)\n\n", .text
    ' "$lease_file" > "$file"
  )
}

desk_next() {
  curl --disable --silent --max-time 15 --globoff --get \
    --data-urlencode "handle=$handle" --data-urlencode "role=$role" --data-urlencode "family=$family" \
    --output "$response" --write-out '%{http_code}' "$origin/desk/next" ||
    die "Impossible de joindre le guichet."
}

next_task() {
  local handle=${BDL_HANDLE:-} status task_id temp_lease= response lease_file first_path
  if [[ -z $handle ]] && command -v gh >/dev/null; then
    handle=$(gh api user --jq .login 2>/dev/null) || handle=
  fi
  [[ ${#handle} -le 39 && $handle =~ ^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$ ]] ||
    die "Définissez BDL_HANDLE avec un pseudo GitHub valide."
  valid_origin "$origin" || die "BDL_ORIGIN doit être une origine HTTP(S)."
  valid_role "$role" || die "BDL_ROLE invalide."
  valid_family "$family" || die "BDL_FAMILY invalide."
  valid_model "$model" || die "BDL_MODEL doit tenir sur une ligne."
  need curl
  need jq
  at_repo_root

  safe_path "$lease_dir" || die "Répertoire des baux non autorisé."
  (umask 077; mkdir -p -- "$lease_dir")
  chmod 700 .bdl "$lease_dir"
  response=$(mktemp "$lease_dir/.response.XXXXXXXX")
  trap 'rm -f -- "${response:-}" "${temp_lease:-}"' EXIT

  status=$(desk_next)
  if [[ $status == 204 && ! ${BDL_ROLE+x} ]]; then
    role=analyst
    status=$(desk_next)
  fi
  case $status in
    204) rm -f -- "$response"; trap - EXIT; printf 'Aucune tâche disponible.\n'; return ;;
    200) ;;
    *) die "Réservation refusée (HTTP $status)." ;;
  esac

  task_id=$(jq -er --arg role "$role" '
    .task | select(.role == $role) | .id | strings | select(test("^[A-Za-z0-9][A-Za-z0-9_-]{0,127}\\z"))
  ' "$response") || die "Identifiant ou rôle de tâche invalide."
  lease_file=$lease_dir/$task_id.json
  safe_path "$lease_file" && [[ ! -e $lease_file || -f $lease_file ]] ||
    die "Emplacement du bail non autorisé."
  # La réponse et les métadonnées sont assemblées dans un fichier privé puis publiées atomiquement.
  temp_lease=$(mktemp "$lease_dir/.lease.XXXXXXXX")
  jq -e --arg origin "$origin" --arg family "$family" --arg model "$model" \
    --arg lease_pattern "$lease_pattern" --arg path_pattern "$path_pattern" '
    select(.lease | type == "string" and test($lease_pattern))
    | select(.task.allowed_paths | type == "array" and length > 0 and all(.[]; type == "string" and test($path_pattern)))
    | . + {origin: $origin, family: $family, model: $model}
  ' "$response" > "$temp_lease" || die "Réponse de réservation invalide."
  mv -f -- "$temp_lease" "$lease_file"
  first_path=$(jq -r '.task.allowed_paths[0]' "$lease_file")
  if [[ $first_path == *.catala_fr ]]; then
    [[ $first_path == corpus/* ]] || first_path=corpus/$first_path
    save_skeleton "$first_path"
  fi
  rm -f -- "$response"
  trap - EXIT
  printf 'Rejoint BugDeLoi. Suivre mon avancement : %s/a/%s\n' "$origin" "$handle"
}

load_lease() {
  local task_id=$1
  need jq
  at_repo_root
  lease_file=$lease_dir/$task_id.json
  safe_path "$lease_file" && [[ -f $lease_file ]] || die "Aucun bail local pour $task_id."
  lease=$(jq -er --arg id "$task_id" --arg pattern "$lease_pattern" '
    select(.task.id == $id) | .lease | strings
    | select(test($pattern))
  ' "$lease_file") || die "Bail local invalide."
  origin=$(jq -er '.origin | strings' "$lease_file") || die "Origine du bail manquante."
  valid_origin "$origin" || die "Origine du bail invalide."
}

desk_post() {
  local action=$1 query=${2:-}
  need curl
  # Le secret passe par stdin pour rester hors des arguments de processus de curl.
  printf 'url = "%s/desk/%s?lease=%s%s"\n' "$origin" "$action" "$lease" "$query" |
    curl --disable --silent --max-time 15 --globoff --request POST --header "Origin: $origin" \
      --config - --output /dev/null --write-out '%{http_code}' ||
    die "Impossible de joindre le guichet."
}

beat() {
  local status
  status=$(desk_post beat)
  case $status in
    200) printf 'Bail renouvelé.\n' ;;
    410) rm -f -- "$lease_file"; printf 'STOPPED\n'; return 1 ;;
    *) die "Renouvellement refusé (HTTP $status)." ;;
  esac
}

release() {
  local status
  status=$(desk_post release "&reason=$1")
  case $status in
    204) rm -f -- "$lease_file" ;;
    410) rm -f -- "$lease_file"; die STOPPED ;;
    *) die "Libération refusée (HTTP $status)." ;;
  esac
}

load_paths() {
  local paths path
  paths=$(jq -er --arg pattern "$path_pattern" '
    .task.allowed_paths | select(type == "array" and length > 0)
    | if all(.[]; type == "string" and test($pattern))
      then .[] else error("Chemin invalide") end
  ' "$lease_file") || die "Chemins autorisés du bail invalides."
  allowed_paths=()
  while IFS= read -r path; do
    [[ $path != corpus && $path != corpus/ ]] || die "Le chemin doit désigner une partie du corpus."
    [[ $path == corpus/* ]] || path=corpus/$path
    safe_path "$path" || die "Chemin du corpus non autorisé."
    allowed_paths+=("$path")
  done <<< "$paths"
}

check_task() {
  local engine path
  local -a catala_paths=()
  jq -e '(.task.blind_to // []) == []' "$lease_file" >/dev/null ||
    die "Le contrôle parcourt le corpus et cette tâche déclare des fichiers à garder aveugles."
  need bun
  for path in "${allowed_paths[@]}"; do
    if [[ $path == *.catala_fr ]]; then
      catala_paths+=("${path#corpus/}")
    fi
  done
  bun scripts/check-corpus-pr.ts
  if (( ${#catala_paths[@]} )); then
    engine=$(container_engine)
    "$engine" run --rm --pull=never --network=none --read-only \
      --security-opt=no-new-privileges --cap-drop=ALL --cpus=2 --memory=2g --pids-limit=128 \
      -v "$PWD/corpus:/work:ro" --tmpfs /tmp:rw,nodev,nosuid,size=128m,mode=1777 \
      --tmpfs /build:rw,nodev,nosuid,exec,size=1g,mode=1777 \
      -e CLERK_BUILD_DIR=/build -e CLERK_TARGET_DIR=/build/targets \
      -w /work "$image" clerk test --color=never "${catala_paths[@]}"
  fi
}

submit() {
  local task_id=$1 title message branch base
  need gh
  if ! git diff --cached --quiet; then
    die "L’index Git contient déjà des modifications. Utilisez un index vide pour soumettre la tâche."
  fi
  base=$(git symbolic-ref --short refs/remotes/origin/HEAD) ||
    die "Branche par défaut d’origin inconnue. Lancez git remote set-head origin -a."
  [[ $(git rev-parse HEAD) == "$(git rev-parse "$base")" ]] ||
    die "Partez de $base pour soumettre un seul commit."
  role=$(jq -er '.task.role | strings' "$lease_file") && valid_role "$role" || die "Rôle du bail invalide."
  family=$(jq -er '.family | strings' "$lease_file") && valid_family "$family" || die "Famille du bail invalide."
  model=$(jq -er '.model | strings | select(length > 0 and (test("[[:cntrl:]]") | not))' "$lease_file") ||
    die "Modèle du bail invalide."

  check_task
  branch=corpus/$task_id
  title="Contribuer à la tâche $task_id"
  printf -v message '%s\n\nBugDeLoi-Task: %s\nBugDeLoi-Role: %s\nBugDeLoi-Family: %s\nBugDeLoi-Model: %s' \
    "$title" "$task_id" "$role" "$family" "$model"
  git switch -c "$branch"
  git --literal-pathspecs add -- "${allowed_paths[@]}"
  git --literal-pathspecs commit --only -m "$message" -- "${allowed_paths[@]}"
  git push --set-upstream origin "$branch"
  gh pr create --base "${base#origin/}" --head "$branch" --title "$title" --body "$message" ||
    die "Création de la PR échouée. La branche $branch est sur origin et le bail est conservé."
  release submitted
}

main() {
  local command=${1:-}
  if (( $# )); then shift; fi
  case $command in
    ''|help|-h|--help) [[ $# == 0 ]] || die "Trop d’arguments. Voir --help."; usage ;;
    setup|next)
      [[ $# == 0 ]] || die "Trop d’arguments. Voir --help."
      if [[ $command == setup ]]; then setup; else next_task; fi ;;
    beat|check|submit|release)
      if [[ $command == release ]]; then
        [[ $# == 2 ]] || die "Usage : release <task_id> <motif>."
        valid_reason "$2" || die "Motif de libération invalide."
      else
        [[ $# == 1 ]] || die "Usage : $command <task_id>."
      fi
      valid_task_id "$1" || die "Identifiant de tâche invalide."
      load_lease "$1"
      case $command in
        beat) beat ;;
        release) release "$2" ;;
        check) load_paths; check_task ;;
        submit) load_paths; submit "$1" ;;
      esac ;;
    *) die "Commande inconnue. Voir --help." ;;
  esac
}

main "$@"
