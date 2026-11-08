#!/bin/bash
set -euo pipefail

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${ORDER_DB_PASSWORD:?ORDER_DB_PASSWORD is required}"
: "${PAYMENT_DB_PASSWORD:?PAYMENT_DB_PASSWORD is required}"

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=order_password="$ORDER_DB_PASSWORD" \
  --set=payment_password="$PAYMENT_DB_PASSWORD" \
  --set=ON_ERROR_STOP=1 <<'SQL'

SELECT format(
    'CREATE ROLE order_service LOGIN PASSWORD %L',
    :'order_password'
)
WHERE NOT EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'order_service'
)
\gexec

SELECT format(
    'CREATE ROLE payment_service LOGIN PASSWORD %L',
    :'payment_password'
)
WHERE NOT EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'payment_service'
)
\gexec

SELECT 'CREATE DATABASE order_db OWNER order_service'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'order_db'
)
\gexec

SELECT 'CREATE DATABASE payment_db OWNER payment_service'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'payment_db'
)
\gexec

SQL