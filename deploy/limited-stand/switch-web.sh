#!/bin/sh
set -eu
cd /opt/platformamarket/releases/limited-20261106
image=${1:?Provide the verified local SHA256 image ID}
printf '%s\n' "$image" | grep -Eq '^sha256:[a-f0-9]{64}$'
docker image inspect "$image" >/dev/null
umask 077
backup="images.env.before-web-$(date +%s)-$$"
test ! -e "$backup"
cp -p images.env "$backup"
sed "s/^WEB_IMAGE=.*/WEB_IMAGE=$image/" images.env > images.env.candidate
test "$(grep -c '^WEB_IMAGE=' images.env.candidate)" -eq 1
docker compose --env-file images.env.candidate config --quiet
mv images.env.candidate images.env
if ! docker compose --env-file images.env up -d --no-deps web; then
  cp -p "$backup" images.env
  docker compose --env-file images.env up -d --no-deps web
  exit 1
fi
printf 'Web image switched to %s; previous environment saved in %s\n' "$image" "$backup"
