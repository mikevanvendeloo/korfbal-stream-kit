#!/usr/bin/env bash
# Start (of herstart) de venue-bridge: naast de dev-omgeving, of (PROD=1) in de zaal.
#
#   scripts/venue-bridge/start.sh                        # standaard: de opgeslagen pagina, geen database
#   scripts/venue-bridge/start.sh mac                    # variant uit apps/venue-bridge/compose/variants/
#   scripts/venue-bridge/start.sh page-only
#   COMPOSE_BASE=docker-compose-localtest.yml scripts/venue-bridge/start.sh windows-robocopy
#   PROD=1 STREAMZ_BRIDGE_VERSION=2026.11.1 scripts/venue-bridge/start.sh cifs   # in de zaal: Docker Hub-image, zonder andere compose-bestanden
#
# De bridge leest alleen API_URL, API_KEY, BRIDGE_NAME en (optioneel) BRIDGE_PAGE_URL; alle rest van de zaal stel je in
# bij Beheer > Instellingen > Venue. Zet ze in de omgeving of in een lokale env-file (niet inchecken):
#   VENUE_BRIDGE_ENV_FILE=./venue-bridge.env scripts/venue-bridge/start.sh
set -euo pipefail

VARIANT="${1:-}" # leeg: de opgeslagen pagina uit compose/local-html, geen database
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIR="${ROOT}/apps/venue-bridge/compose"

if [[ -n "${VARIANT}" && ! -f "${DIR}/variants/${VARIANT}.yml" ]]; then
  echo "Gebruik: $0 <variant>   (variants: $(ls "${DIR}/variants" | sed 's/\.yml$//' | tr '\n' ' '))" >&2
  exit 1
fi

if [[ -n "${PROD:-}" ]]; then
  # In de zaal staat de bridge los; COMPOSE_BASE=docker-compose-prod.yml voegt hem toe aan een bestaande omgeving
  BASE="${COMPOSE_BASE:-}"
  OVERRIDE="${DIR}/docker-compose.venue-bridge.prod.yml"
  BUILD=()
else
  BASE="${COMPOSE_BASE:-docker-compose.yml}"
  OVERRIDE="${DIR}/docker-compose.venue-bridge.yml"
  BUILD=(--build)
fi

mkdir -p "${ROOT}/data/venue-bridge"
ENV_FILE=()
[[ -n "${VENUE_BRIDGE_ENV_FILE:-}" ]] && ENV_FILE=(--env-file "${VENUE_BRIDGE_ENV_FILE}")

cd "${ROOT}"
VARIANT_FILE=()
[[ -n "${VARIANT}" ]] && VARIANT_FILE=(-f "${DIR}/variants/${VARIANT}.yml")
BASE_FILE=()
[[ -n "${BASE}" ]] && BASE_FILE=(-f "${BASE}")
docker compose "${ENV_FILE[@]}" "${BASE_FILE[@]}" -f "${OVERRIDE}" "${VARIANT_FILE[@]}" up -d "${BUILD[@]}" venue-bridge
echo "Venue-bridge gestart (${VARIANT:-opgeslagen pagina}). Controle: curl http://localhost:3340/health"
echo "Kijk bij Beheer > Instellingen > Venue of de bridge verbonden is, of open http://localhost:3340"
