#!/bin/sh
# Arranque de la demo local: prepara la base ficticia y abre la aplicación.
set -e
echo "Preparando la base de datos de la demo..."
pnpm -s db:deploy
pnpm -s db:seed
pnpm -s demo:seed
pnpm -s demo:users
# D-109: ejemplos ficticios de cada módulo (solo la primera vez).
npx tsx scripts/demo/seed-examples.ts
# D-099: un único instalador reconoce por su SHA-256 los ZIP, el PNT de OOS y las plantillas
# de Auditorías que haya en /plantillas; ignora el resto y nunca sustituye una versión instalada.
if [ -d /plantillas ] && [ -n "$(ls -A /plantillas 2>/dev/null)" ]; then
  echo "Instalando las plantillas de /plantillas..."
  npx tsx scripts/install-templates.ts /plantillas || echo "Alguna plantilla no se ha podido instalar; la demo sigue con las demás."
fi
# D-110: versiones 00/01 del CAPA plan de los ejemplos; necesitan la plantilla A4.03 instalada.
node --conditions=react-server --import tsx scripts/demo/seed-capa-plans.ts || echo "No se han podido añadir las versiones del CAPA plan de ejemplo; la demo sigue."
echo "Demo lista: abre http://localhost:3000 en el navegador."
exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3000
