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
# OOS (D-088): los Anexos III, IV y VI se derivan del PNT GC-10/014/04 en Word.
# El instalador solo acepta el PNT corregido (SHA-256) e ignora otros .docx.
for docx in /plantillas/*.docx; do
  [ -f "$docx" ] || continue
  echo "Comprobando si $docx es el PNT de OOS GC-10/014/04..."
  npx tsx scripts/install-oos-templates.ts "$docx" || echo "$docx no es el PNT GC-10/014/04 corregido; se ignora."
done
echo "Demo lista: abre http://localhost:3000 en el navegador."
exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3000
