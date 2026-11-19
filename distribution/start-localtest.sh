#!/usr/bin/env bash
# Start de localtest-omgeving (docker-compose-localtest.yml: de lokaal gebouwde images tegen een backup) en de
# venue-bridge (gebouwd uit de lokale code), met de instellingen uit localtest.local.env.
#
#   ./start-localtest.sh                 # bouwt en start Streamz en (RUN_BRIDGE=true) de bridge
#   ./start-localtest.sh --only bridge   # alleen de bridge (bijv. na het invullen van API_KEY)
#   ./start-localtest.sh --no-build      # de al gebouwde images
#   ./start-localtest.sh --reset         # database terug naar de backup (down -v) en dan starten
#   ./start-localtest.sh --stop          # alles stoppen (de database blijft bewaard)
#
# Draai nooit tegelijk met docker-compose-dev.yml (dezelfde poorten 80 en 5050). Relatieve paden in
# localtest.local.env gaan vanaf deze map (distribution/).
set -euo pipefail

# Deze map (distribution/) en de repo erboven
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "${ROOT}")"
CONFIG="${LOCALTEST_ENV_FILE:-${ROOT}/localtest.local.env}"
ONLY=all
BUILD=(--build)
RESET=
STOP=

while [[ $# -gt 0 ]]; do
  case "$1" in
    --only) ONLY="${2:-}"; shift 2 ;;
    --no-build) BUILD=(); shift ;;
    --reset) RESET=1; shift ;;
    --stop) STOP=1; shift ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "Onbekende optie: $1 (zie --help)" >&2; exit 1 ;;
  esac
done
[[ "${ONLY}" =~ ^(all|streamz|bridge)$ ]] || { echo "--only: kies all, streamz of bridge" >&2; exit 1; }

if [[ ! -f "${CONFIG}" ]]; then
  echo "${CONFIG} ontbreekt. Kopieer localtest.local.env.example naar localtest.local.env en vul hem in." >&2
  exit 1
fi

# Een waarde uit het env-bestand (zonder aanhalingstekens), leeg als hij ontbreekt
cfg() {
  local line
  line="$(grep -E "^[[:space:]]*$1[[:space:]]*=" "${CONFIG}" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  line="${line#[\"\']}"
  echo "${line%[\"\']}"
}

wait_http() {
  local url="$1" name="$2" i
  for i in $(seq 1 60); do
    if curl -fsS -o /dev/null --max-time 5 "${url}"; then echo "${name} is bereikbaar (${url})."; return 0; fi
    sleep 3
  done
  echo "Let op: ${name} antwoordt niet op ${url}." >&2
  return 0
}

cd "${ROOT}"
BASE=(--env-file "${CONFIG}" -f docker-compose-localtest.yml)
BRIDGE_FILES=(-f docker-compose.venue-bridge-dev.yml)
# The compose file reads the bridge settings from the same file (env_file)
export BRIDGE_ENV_FILE="${CONFIG}"
VARIANT="$(cfg BRIDGE_VARIANT)"
if [[ -n "${VARIANT}" ]]; then
  if [[ ! -f "variants/${VARIANT}.yml" ]]; then
    echo "Onbekende BRIDGE_VARIANT '${VARIANT}' (kies uit: $(ls variants | sed 's/\.yml$//' | tr '\n' ' '))" >&2
    exit 1
  fi
  BRIDGE_FILES+=(-f "variants/${VARIANT}.yml")
fi

if [[ -n "${STOP}" ]]; then
  # Met de bridge-bestanden erbij, zodat ook de bridge (zelfde project) stopt
  docker compose "${BASE[@]}" "${BRIDGE_FILES[@]}" down
  exit 0
fi

docker info >/dev/null 2>&1 || { echo "Docker draait niet. Start Docker Desktop en probeer opnieuw." >&2; exit 1; }

RUN_BRIDGE="$(cfg RUN_BRIDGE)"
if [[ "${ONLY}" == bridge ]]; then RUN_STREAMZ=; else RUN_STREAMZ=1; fi
if [[ "${ONLY}" == streamz ]] || { [[ "${ONLY}" == all ]] && [[ ! "${RUN_BRIDGE}" =~ ^(true|1|yes|ja)$ ]]; }; then RUN_BRIDGE=; else RUN_BRIDGE=1; fi

if [[ -n "${RUN_STREAMZ}" ]]; then
  if [[ -n "${RESET}" ]]; then
    echo "Database terugzetten naar de backup (down -v)..."
    docker compose "${BASE[@]}" "${BRIDGE_FILES[@]}" down -v
  fi
  SQL="$(cfg LOCALTEST_SQL)"; SQL="${SQL:-../../2025-2026-backup/streamz-2025.sql}"
  [[ -f "${SQL}" ]] || echo "Let op: de backup ${SQL} bestaat niet; een nieuwe database begint dan leeg." >&2
  echo "Streamz localtest starten..."
  docker compose "${BASE[@]}" up -d "${BUILD[@]}"
  wait_http http://localhost:3334/api/health 'De API'
fi

if [[ -n "${RUN_BRIDGE}" ]]; then
  if [[ -z "$(cfg API_KEY)" ]]; then
    echo
    echo "De bridge start nog niet: API_KEY is leeg. Maak in de Kit (http://localhost) bij Beheer > Organisatie-instellingen >"
    echo "API-sleutels een sleutel, zet hem in ${CONFIG} en draai: ./start-localtest.sh --only bridge"
  else
    mkdir -p "${REPO}/data/venue-bridge"
    echo "Venue-bridge starten (${VARIANT:-opgeslagen pagina})..."
    docker compose "${BASE[@]}" "${BRIDGE_FILES[@]}" up -d "${BUILD[@]}" venue-bridge
    wait_http http://localhost:3340/health 'De venue-bridge'
  fi
fi

echo
[[ -n "${RUN_STREAMZ}" ]] && echo "Streamz:      http://localhost   (API http://localhost:3334, pgAdmin http://localhost:5050)"
[[ -n "${RUN_BRIDGE}" && -n "$(cfg API_KEY)" ]] && echo "Venue-bridge: http://localhost:3340 (verbonden? Beheer > Instellingen > Venue)"
exit 0
