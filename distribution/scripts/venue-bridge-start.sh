#!/usr/bin/env bash
# Start (of herstart) de venue-bridge: naast de dev-omgeving, of (PROD=1) in de zaal.
#
#   scripts/venue-bridge-start.sh                        # standaard: de opgeslagen pagina, geen database
#   scripts/venue-bridge-start.sh mac                    # variant uit variants/
#   scripts/venue-bridge-start.sh page-only
#   COMPOSE_BASE=docker-compose-localtest.yml scripts/venue-bridge-start.sh windows-robocopy
#   PROD=1 VENUE_BRIDGE_ENV_FILE=streamz.local.env scripts/venue-bridge-start.sh cifs   # in de zaal: Docker Hub-image
#
# (paden relatief aan distribution/; localtest met de bridge: liever ./start-localtest.sh)
#
# De bridge leest alleen API_URL, API_KEY, BRIDGE_NAME en (optioneel) BRIDGE_PAGE_URL; alle rest van de zaal stel je in
# bij Beheer > Instellingen > Venue. Zet ze in de omgeving of in een lokale env-file (niet inchecken), in productie
# streamz.local.env met STREAMZ_BRIDGE_VERSION.
set -euo pipefail

VARIANT="${1:-}" # leeg: de opgeslagen pagina uit local-html, geen database
DIST="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -n "${VARIANT}" && ! -f "${DIST}/variants/${VARIANT}.yml" ]]; then
  echo "Gebruik: $0 <variant>   (variants: $(ls "${DIST}/variants" | sed 's/\.yml$//' | tr '\n' ' '))" >&2
  exit 1
fi

if [[ -n "${PROD:-}" ]]; then
  # In de zaal: een eigen project (venue-bridge); de data komt in distribution/data/venue-bridge
  BASE="${COMPOSE_BASE:-}"
  OVERRIDE="docker-compose.venue-bridge.yml"
  BUILD=()
  DATA="${DIST}/data/venue-bridge"
else
  # Naast dev of localtest, in hun project; de data komt in data/venue-bridge in de root van de repo
  BASE="${COMPOSE_BASE:-docker-compose-dev.yml}"
  OVERRIDE="docker-compose.venue-bridge-dev.yml"
  BUILD=(--build)
  DATA="$(dirname "${DIST}")/data/venue-bridge"
fi

mkdir -p "${DATA}"
ENV_FILE=()
[[ -n "${VENUE_BRIDGE_ENV_FILE:-}" ]] && ENV_FILE=(--env-file "${VENUE_BRIDGE_ENV_FILE}")

cd "${DIST}"
VARIANT_FILE=()
[[ -n "${VARIANT}" ]] && VARIANT_FILE=(-f "variants/${VARIANT}.yml")
BASE_FILE=()
[[ -n "${BASE}" ]] && BASE_FILE=(-f "${BASE}")
docker compose "${ENV_FILE[@]}" "${BASE_FILE[@]}" -f "${OVERRIDE}" "${VARIANT_FILE[@]}" up -d "${BUILD[@]}" venue-bridge
echo "Venue-bridge gestart (${VARIANT:-opgeslagen pagina}). Controle: curl http://localhost:3340/health"
echo "Kijk bij Beheer > Instellingen > Venue of de bridge verbonden is, of open http://localhost:3340"
