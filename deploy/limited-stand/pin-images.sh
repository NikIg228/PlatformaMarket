#!/bin/sh
set -eu
cd /opt/platformamarket/releases/limited-20261106
test ! -e images.env
umask 077
: "${MARKET_ORIGIN:?Set the canonical HTTPS Market origin}"
{
  printf 'SHARED_DIR=/opt/platformamarket/shared\n'
  printf 'MARKET_ORIGIN=%s\n' "$MARKET_ORIGIN"
  for item in 'API platformamarket-api:limited-20261106' 'WEB platformamarket-web:limited-20261106' 'GATE platformamarket-gate:limited-20261106' 'POSTGRES postgres:17-alpine' 'REDIS redis:7-alpine' 'CLAMAV clamav/clamav:stable'; do
    set -- $item
    printf '%s_IMAGE=%s\n' "$1" "$(docker image inspect "$2" --format '{{.Id}}')"
  done
} > images.env
docker compose --env-file images.env config --quiet
