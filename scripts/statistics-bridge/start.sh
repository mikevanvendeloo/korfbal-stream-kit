#!/usr/bin/env bash
# Start (of herstart) de statistics bridge naast de dev-omgeving.
#
#   scripts/statistics-bridge/start.sh                        # standaard: de opgeslagen pagina, geen database
#   scripts/statistics-bridge/start.sh mac                    # variant uit apps/statistics-bridge/compose/variants/
#   scripts/statistics-bridge/start.sh page-only
#   COMPOSE_BASE=docker-compose-localtest.yml scripts/statistics-bridge/start.sh windows-robocopy
#   PROD=1 STREAMZ_BRIDGE_VERSION=2026.11.1 scripts/statistics-bridge/start.sh cifs
#
# Variabelen die de bridge leest (PAGE_URL, SHARE_HOST, MDB_PATH, BRIDGE_TOKEN, KEEP_COPY) mogen in de omgeving
# staan of in een lokale env-file: STATS_BRIDGE_ENV_FILE=./statistics-bridge.env
set -euo pipefail

VARIANT="${1:-}" # leeg: de opgeslagen pagina uit compose/local-html, geen database
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIR="${ROOT}/apps/statistics-bridge/compose"

if [[ -n "${VARIANT}" && ! -f "${DIR}/variants/${VARIANT}.yml" ]]; then
  echo "Gebruik: $0 <variant>   (variants: $(ls "${DIR}/variants" | sed 's/\.yml$//' | tr '\n' ' '))" >&2
  exit 1
fi

if [[ -n "${PROD:-}" ]]; then
  BASE="${COMPOSE_BASE:-docker-compose-prod.yml}"
  OVERRIDE="${DIR}/docker-compose.statistics-bridge.prod.yml"
  BUILD=()
else
  BASE="${COMPOSE_BASE:-docker-compose.yml}"
  OVERRIDE="${DIR}/docker-compose.statistics-bridge.yml"
  BUILD=(--build)
fi

mkdir -p "${ROOT}/data/statistics-bridge"
ENV_FILE=()
[[ -n "${STATS_BRIDGE_ENV_FILE:-}" ]] && ENV_FILE=(--env-file "${STATS_BRIDGE_ENV_FILE}")

cd "${ROOT}"
VARIANT_FILE=()
[[ -n "${VARIANT}" ]] && VARIANT_FILE=(-f "${DIR}/variants/${VARIANT}.yml")
docker compose "${ENV_FILE[@]}" -f "${BASE}" -f "${OVERRIDE}" "${VARIANT_FILE[@]}" up -d "${BUILD[@]}" statistics-bridge
echo "Statistics bridge gestart (${VARIANT:-opgeslagen pagina}). Controle: curl http://localhost:3340/health"
echo "Vul bij Beheer > Instellingen > Statistieken in: Statistics bridge URL = http://statistics-bridge:3340"
