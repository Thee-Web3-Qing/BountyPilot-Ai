#!/usr/bin/env bash
# Full database export using pg_dump (most reliable for PostgreSQL -> PostgreSQL migration)
# Usage: bash scripts/export-db.sh > db-export-full.sql

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL not set" >&2
  exit 1
fi

# Extract host, port, user, password, database from URL
# Format: postgresql://user:pass@host:port/db?sslmode=...
# Extract the connection string without the protocol prefix
CONN_STRING="${DATABASE_URL#postgresql://}"
CONN_STRING="${CONN_STRING#postgres://}"

# Parse user
USER="${CONN_STRING%%:*}"
CONN_STRING="${CONN_STRING#*:}"

# Parse password
PASS="${CONN_STRING%%@*}"
CONN_STRING="${CONN_STRING#*@}"

# Parse host (and port)
HOST_PORT="${CONN_STRING%%/*}"
HOST="${HOST_PORT%%:*}"
PORT="${HOST_PORT##*:}"
if [ "$HOST" = "$PORT" ]; then PORT="5432"; fi

# Parse database
DB="${CONN_STRING#*/}"
DB="${DB%%\?*}"

echo "-- BountyPilot Full Database Export"
echo "-- Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "-- Source: Replit PostgreSQL"
echo "-- Target: Supabase PostgreSQL"
echo ""
echo "-- Table schemas and data"
echo ""

# Export schema and data for all tables
PGPASSWORD="$PASS" pg_dump \
  -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --no-publications \
  --no-subscriptions \
  --no-comments \
  --no-tablespaces \
  --no-security-labels \
  2>/dev/null || {
    echo "-- pg_dump failed. Trying data-only export..." >&2
    exit 1
  }

# Export data separately
PGPASSWORD="$PASS" pg_dump \
  -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" \
  --data-only \
  --no-owner \
  --no-privileges \
  --no-publications \
  --no-subscriptions \
  --no-comments \
  --no-tablespaces \
  --no-security-labels \
  --inserts \
  2>/dev/null || {
    echo "-- pg_dump data export failed" >&2
    exit 1
  }

echo ""
echo "-- Export complete!"
