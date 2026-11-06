#!/bin/sh
set -eu
umask 077
root=/opt/platformamarket/shared
backup="$root/backups/acceptance-20261106"
test ! -e "$backup"
mkdir "$backup"
docker exec platformamarket-stand-postgres-1 pg_dump -U market_admin -d market_stand -Fc > "$backup/market.dump"
tar -czf "$backup/files-and-config.tgz" -C "$root" files market.env stand.env stand-password.txt accounts.json tls pg-admin-password redis.conf init-db.sql
test -s "$backup/market.dump"
test -s "$backup/files-and-config.tgz"
docker exec platformamarket-stand-postgres-1 createdb -U market_admin market_restore_acceptance_20261106
docker exec -i platformamarket-stand-postgres-1 pg_restore -U market_admin -d market_restore_acceptance_20261106 --exit-on-error < "$backup/market.dump"
query='SELECT (SELECT count(*) FROM "User")::text || '\''/'\'' || (SELECT count(*) FROM "Organization")::text || '\''/'\'' || (SELECT count(*) FROM "UserMfaFactor")::text || '\''/'\'' || (SELECT count(*) FROM "_prisma_migrations")::text'
original=$(docker exec platformamarket-stand-postgres-1 psql -U market_admin -d market_stand -Atc "$query")
restored=$(docker exec platformamarket-stand-postgres-1 psql -U market_admin -d market_restore_acceptance_20261106 -Atc "$query")
test "$original" = "$restored"
docker exec platformamarket-stand-postgres-1 dropdb -U market_admin market_restore_acceptance_20261106
sha256sum "$backup/market.dump" "$backup/files-and-config.tgz" > "$backup/SHA256SUMS"
printf 'PASS separate database restore: users/organizations/MFA/migrations %s\n' "$restored"
printf 'PASS private backup saved under %s\n' "$backup"
