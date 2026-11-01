#!/usr/bin/env bash
# Mount de share van de statistiek-pc op de Mac, voor de statistics bridge (compose/variants/mac.yml).
#
#   scripts/statistics-bridge/mount-share-mac.sh                       # //GUEST@10.12.0.63/KL2627 op /Volumes/KL2627
#   scripts/statistics-bridge/mount-share-mac.sh 10.12.0.63 KL2627 /Volumes/KL2627
#   scripts/statistics-bridge/mount-share-mac.sh --unmount
#
# Idempotent: staat de share er al, dan gebeurt er niets. Staat de pc uit, dan komt er een melding en een
# afsluitcode 1 (geen hangende mount: mount_smbfs krijgt een tijdslimiet).
set -euo pipefail

HOST="${1:-10.12.0.63}"
SHARE="${2:-KL2627}"
MOUNT_POINT="${3:-/Volumes/${SHARE}}"
TIMEOUT_SECONDS="${MOUNT_TIMEOUT_SECONDS:-8}"

if [[ "${1:-}" == "--unmount" ]]; then
  MOUNT_POINT="${2:-/Volumes/KL2627}"
  if mount | grep -q " on ${MOUNT_POINT} "; then
    umount "${MOUNT_POINT}" && echo "Share losgekoppeld van ${MOUNT_POINT}"
  else
    echo "Niets gemount op ${MOUNT_POINT}"
  fi
  exit 0
fi

if mount | grep -q " on ${MOUNT_POINT} "; then
  echo "Al gemount: ${MOUNT_POINT}"
  exit 0
fi

# Eerst kijken of de pc op het netwerk is (SMB-poort), zodat mount_smbfs niet blijft wachten
if ! nc -z -G "${TIMEOUT_SECONDS}" "${HOST}" 445 2>/dev/null; then
  echo "De statistiek-pc (${HOST}) antwoordt niet op de SMB-poort 445." >&2
  exit 1
fi

# /Volumes is van root: een eigen mountpoint (bijvoorbeeld ~/stats) hoeft geen sudo
if [[ ! -d "${MOUNT_POINT}" ]]; then
  mkdir -p "${MOUNT_POINT}" 2>/dev/null || sudo mkdir -p "${MOUNT_POINT}"
fi

# Gast zonder wachtwoord, alleen-lezen (-o rdonly)
if ! mount_smbfs -o rdonly "//GUEST@${HOST}/${SHARE}" "${MOUNT_POINT}"; then
  echo "Mounten van //${HOST}/${SHARE} is mislukt." >&2
  exit 1
fi
echo "Gemount: //${HOST}/${SHARE} op ${MOUNT_POINT}"
