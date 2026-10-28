#!/usr/bin/env bash
# Zet een dev-omgeving op de database uit een pg_dump-backup, bijvoorbeeld die van vorig seizoen, en draait
# daarna alleen de migraties (geen seed: die zou personen, sponsors en templates uit de backup aanpassen).
#
#   npm run db:restore-backup                       # npm run dev: database 'korfbal' op localhost:5432
#   npm run docker:restore-backup                   # Docker-dev-stack (docker-compose.yml), localhost:5434
#   ... -- /pad/naar/dump.sql                       # andere backup (standaard ../2025-2026-backup/streamz-2025.sql)
#   ./scripts/restore-backup.sh --target npm -y     # zonder bevestigen
#
# Wist alleen de database 'korfbal' van het gekozen doel. De testdatabase korfbal_stream_test, localtest en
# het andere doel blijven staan. Afbeeldingen komen uit ./storage, die staan niet in de dump.
set -euo pipefail

cd "$(dirname "$0")/.."

SQL="../2025-2026-backup/streamz-2025.sql"
TARGET=""
YES=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes) YES=true ;;
    --target) TARGET="${2:-}"; shift ;;
    *) SQL="$1" ;;
  esac
  shift
done

case "$TARGET" in
  npm)    COMPOSE=(docker compose -f docker-compose-db.yml); WHERE="database van npm run dev (docker-compose-db.yml, localhost:5432)" ;;
  docker) COMPOSE=(docker compose); WHERE="Docker-dev-stack (docker-compose.yml, project korfbal-dev, localhost:5434)" ;;
  *) echo "Kies --target npm of --target docker" >&2; exit 1 ;;
esac

if [[ ! -f "$SQL" ]]; then
  echo "Backup niet gevonden: $SQL" >&2
  exit 1
fi

echo "Backup:  $SQL"
echo "Doel:    database 'korfbal' van de $WHERE"
if [[ "$YES" != true ]]; then
  read -r -p "Deze database wordt gewist en vervangen. Doorgaan? [j/N] " answer
  [[ "$answer" =~ ^[jJyY]$ ]] || { echo "Gestopt."; exit 1; }
fi

if [[ "$TARGET" == docker ]]; then
  echo "== monitoring en localtest stoppen (localtest gebruikt dezelfde poorten 80 en 5050)"
  # Monitoring eerst: hij hangt aan het netwerk van localtest
  docker compose -f docker-compose-monitoring.yml down
  docker compose -f docker-compose-localtest.yml down
  echo "== App van de stack stoppen"
  docker compose stop korfbal-streamz-api korfbal-streamz-kit 2>/dev/null || true
else
  echo "Stop eerst npm run dev / api:dev als die draait: de database wordt met FORCE weggegooid."
fi

echo "== Database starten"
"${COMPOSE[@]}" up -d --wait db

echo "== Database leegmaken"
"${COMPOSE[@]}" exec -T db psql -U korfbal -d postgres -v ON_ERROR_STOP=1 \
  -c 'DROP DATABASE IF EXISTS korfbal WITH (FORCE)' -c 'CREATE DATABASE korfbal'

echo "== Backup terugzetten"
# De dump komt van gebruiker 'fortuna': zonder de OWNER-regels wordt alles van 'korfbal', waarmee de API inlogt
grep -v ' OWNER TO ' "$SQL" | "${COMPOSE[@]}" exec -T db psql -q -U korfbal -d korfbal -v ON_ERROR_STOP=1 >/dev/null

if [[ "$TARGET" == docker ]]; then
  echo "== Migraties (zonder seed) en app starten"
  SKIP_SEED=true docker compose up -d --build
  docker compose logs migrate-streamz | tail -n 5
  cat <<'EOF'

Klaar: http://localhost
Start de stack hierna met:  SKIP_SEED=true docker compose up -d
(zonder SKIP_SEED past de seed personen, sponsors en templates uit de backup aan)
EOF
else
  echo "== Migraties (zonder seed)"
  npm run prisma:deploy
  cat <<'EOF'

Klaar: start de app met npm run dev (http://localhost:4200).
Draai hierna geen npm run prisma:seed: die past personen, sponsors en templates uit de backup aan.
EOF
fi
