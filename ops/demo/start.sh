#!/bin/sh
# Arranque de la demo local: prepara la base ficticia y abre la aplicación.
set -e
echo "Preparando la base de datos de la demo..."
pnpm -s db:deploy
pnpm -s db:seed
pnpm -s demo:seed
pnpm -s demo:users
for zip in /plantillas/*.zip; do
  [ -f "$zip" ] || continue
  echo "Instalando plantillas de $zip..."
  npx tsx scripts/install-template-bundle.ts "$zip" || echo "No se han podido instalar las plantillas de $zip; la demo sigue sin ellas."
done
echo "Demo lista: abre http://localhost:3000 en el navegador."
exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3000
