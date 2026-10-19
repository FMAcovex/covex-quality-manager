#!/usr/bin/env bash
# Demo con perfiles ficticios dentro de GitHub Codespaces (D-108): «pnpm demo:codespace».
# Usa una base de datos aparte (covex_demo) en el PostgreSQL de compose.yaml; la base habitual
# del Codespace no se toca. Datos ficticios; no introducir datos reales.
set -euo pipefail

if [ "${CODESPACES:-}" != "true" ] || [ -z "${CODESPACE_NAME:-}" ] || [ -z "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]; then
  echo "Este comando es solo para GitHub Codespaces. En tu ordenador usa la demo local (docs/DEMO_LOCAL.md)."
  exit 1
fi

echo "1/4 · Arrancando la base de datos..."
docker compose up -d postgres >/dev/null
for _ in $(seq 1 30); do
  docker compose exec -T postgres pg_isready -U covex -d postgres >/dev/null 2>&1 && break
  sleep 2
done
if ! docker compose exec -T postgres psql -U covex -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='covex_demo'" | grep -q 1; then
  docker compose exec -T postgres psql -U covex -d postgres -qc "CREATE DATABASE covex_demo" >/dev/null
fi

export APP_ENV=demo AUTH_PROVIDER=demo AUTH_SYNTHETIC_IDENTITY=0 ALLOW_DEMO_DATA=true
export DATABASE_URL="postgresql://covex:covex_dev@localhost:5432/covex_demo?schema=public"
export AUTH_ORIGIN="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
export DEFAULT_ACTOR_NAME="Demo Codespaces"
# Las plantillas que haya en la carpeta «plantillas» se instalan al arrancar (D-107).
export TEMPLATE_INSTALL_DIR=plantillas

echo "2/4 · Preparando la base de la demo (migraciones, catálogos, usuarios y ejemplos ficticios)..."
pnpm exec prisma migrate deploy >/dev/null
pnpm exec tsx prisma/seed.ts >/dev/null
pnpm exec tsx scripts/seed-demo.ts >/dev/null
pnpm exec tsx scripts/demo/install-users.ts >/dev/null
# D-109: ejemplos ficticios de cada módulo (solo la primera vez; si ya están, no hace nada).
pnpm exec tsx scripts/demo/seed-examples.ts
# D-110: las versiones del CAPA plan de los ejemplos congelan su A4.03, así que las plantillas
# se instalan antes (el instalador no repite las que ya están).
if [ -d plantillas ] && [ -n "$(ls -A plantillas 2>/dev/null)" ]; then
  pnpm exec tsx scripts/install-templates.ts plantillas >/dev/null || echo "Alguna plantilla no se ha podido instalar; la demo sigue con las demás."
fi
node --conditions=react-server --import tsx scripts/demo/seed-capa-plans.ts || echo "No se han podido añadir las versiones del CAPA plan de ejemplo; la demo sigue."

echo "3/4 · Compilando la aplicación (un par de minutos)..."
pnpm exec prisma generate >/dev/null
pnpm exec next build >/dev/null

# Los puertos de un Codespace son privados por defecto: solo tu cuenta de GitHub puede abrirlos.
echo "4/4 · Demo lista: abre ${AUTH_ORIGIN} y elige un perfil."
exec pnpm exec next start -p 3000
