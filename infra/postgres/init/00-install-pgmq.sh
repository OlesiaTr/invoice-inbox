#!/bin/sh
# Installs pgmq (https://github.com/pgmq/pgmq, PostgreSQL License) from its SQL-only
# distribution, so the stock postgres image is enough. Installed into template1 too,
# so databases created later (e.g. Prisma's shadow DB, test DBs) already have it.
# On Supabase, pgmq is a built-in extension instead (Integrations → Queues).
set -e
for db in template1 "$POSTGRES_DB"; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" -q -f /pgmq/pgmq-v1.7.0.sql
done
