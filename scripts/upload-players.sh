#!/usr/bin/env bash
# Upload alle afbeeldingen in een directory als player images (zonder mapfile)
# Gebruik: ./upload_players.sh /pad/naar/afbeeldingen [http://localhost:3333]

set -euo pipefail

DIR=${1:-}
API_BASE=${2:-http://localhost:3333}
ENDPOINT="$API_BASE/api/players/images"

if [[ -z "${DIR}" || ! -d "${DIR}" ]]; then
  echo "Gebruik: $0 /pad/naar/afbeeldingen [API_BASE]" >&2
  echo "Voorbeeld: $0 ./mijn-foto-map http://localhost:3333" >&2
  exit 1
fi

# Controleer of de API bereikbaar is (best effort)
if ! curl -sS -m 3 "$API_BASE/api/health" >/dev/null; then
  echo "Waarschuwing: Kan $API_BASE niet bereiken. Controleer of de API draait." >&2
fi

# Tel bestanden vooraf (voor nette logging)
FILE_COUNT=$(find "$DIR" -type f \
  \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' -o -iname '*.gif' \) | wc -l | tr -d ' ')

if [[ "$FILE_COUNT" -eq 0 ]]; then
  echo "Geen afbeeldingen gevonden in: $DIR" >&2
  exit 0
fi

echo "Ga $FILE_COUNT bestanden uploaden naar: $ENDPOINT" >&2

SUCCESS=0
FAIL=0

# Gebruik -print0 + read -d '' om spaties/rare tekens in bestandsnamen te ondersteunen
# sort -z voor stabiele, nul-gescheiden sortering (mocht je coreutils sort hebben)
if sort --help 2>&1 | grep -q '\-z'; then
  FIND_CMD=(find "$DIR" -type f \
    \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' -o -iname '*.gif' \) -print0)
  # shellcheck disable=SC2030
  "${FIND_CMD[@]}" | sort -z | while IFS= read -r -d '' file; do
    filename=$(basename "$file")
    subject=${filename%.*}

    http_body=$(mktemp)
    http_code=$(curl -sS -X POST "$ENDPOINT" \
      -F "subject=$subject" \
      -F "file=@$file" \
      -w '%{http_code}' -o "$http_body" || true)

    if [[ "$http_code" =~ ^2 ]]; then
      SUCCESS=$((SUCCESS+1))
      echo "✔️  $filename -> subject='$subject' (HTTP $http_code)"
    else
      FAIL=$((FAIL+1))
      echo "❌  Upload mislukt voor: $filename (HTTP $http_code)" >&2
      if [[ -s "$http_body" ]]; then
        echo "    Response: $(cat "$http_body")" >&2
      fi
    fi
    rm -f "$http_body"
  done
else
  # Zonder sort -z: direct streamen vanaf find -print0
  find "$DIR" -type f \
    \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' -o -iname '*.gif' \) -print0 \
  | while IFS= read -r -d '' file; do
    filename=$(basename "$file")
    subject=${filename%.*}

    http_body=$(mktemp)
    http_code=$(curl -sS -X POST "$ENDPOINT" \
      -F "subject=$subject" \
      -F "file=@$file" \
      -w '%{http_code}' -o "$http_body" || true)

    if [[ "$http_code" =~ ^2 ]]; then
      SUCCESS=$((SUCCESS+1))
      echo "✔️  $filename -> subject='$subject' (HTTP $http_code)"
    else
      FAIL=$((FAIL+1))
      echo "❌  Upload mislukt voor: $filename (HTTP $http_code)" >&2
      if [[ -s "$http_body" ]]; then
        echo "    Response: $(cat "$http_body")" >&2
      fi
    fi
    rm -f "$http_body"
  done
fi

echo "Klaar: $SUCCESS gelukt, $FAIL mislukt." >&2

# Exit met non-zero als er iets faalde
if (( FAIL > 0 )); then
  exit 2
fi
