#!/bin/sh
set -eu
root=/opt/platformamarket
source="$root/releases/limited-20261106/Caddyfile.market"
origin=$(sed -n 's/^MARKET_ORIGIN=//p' "$root/releases/limited-20261106/images.env")
domain=${origin#https://}
test "$domain" != "$origin"
printf '%s\n' "$domain" | grep -Eq '^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$'
test -s "$source"
test ! -e "$root/Caddyfile.before-market"
sha256sum -c "$root/crm-hashes-before.txt"
cp -p /etc/caddy/Caddyfile "$root/Caddyfile.before-market"
{
  cat "$root/Caddyfile.before-market"
  printf '\n'
  sed 's/{$MARKET_DOMAIN}/'"$domain"'/g' "$source"
} > "$root/Caddyfile.candidate"
caddy validate --config "$root/Caddyfile.candidate" --adapter caddyfile
cp "$root/Caddyfile.candidate" /etc/caddy/Caddyfile
if ! systemctl reload caddy; then
  cp "$root/Caddyfile.before-market" /etc/caddy/Caddyfile
  systemctl reload caddy
  exit 1
fi
printf 'PASS added Market site; original CRM configuration retained byte-for-byte\n'
