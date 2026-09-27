# Importación histórica de Desviaciones

## Fuente prevista

El importador del Hito 4 está diseñado para el libro `000 LISTADO GENERAL DESVIACIONES.xlsx`, hojas `2025` y `2026`.

Los dos años tienen esquemas diferentes y se procesan con mapeos independientes.

## Dry-run

El comportamiento por defecto es de solo lectura:

```bash
pnpm import:deviations -- --file "/ruta/000 LISTADO GENERAL DESVIACIONES.xlsx"
```

Puede limitarse a un año:

```bash
pnpm import:deviations -- --file "/ruta/000 LISTADO GENERAL DESVIACIONES.xlsx" --years 2026
```

El comando genera un informe JSON en `reports/imports/`, ruta excluida de Git.

## Importación real

Solo ejecutar después de revisar el informe dry-run:

```bash
pnpm import:deviations -- \
  --file "/ruta/000 LISTADO GENERAL DESVIACIONES.xlsx" \
  --years 2025,2026 \
  --apply \
  --confirm APPLY_2025_2026 \
  --actor "Nombre del usuario"
```

## Reglas

- No se inventan campos no presentes en el listado.
- Los históricos se crean con `dataQualityStatus=REVIEW_REQUIRED` salvo datos esenciales inválidos.
- La revisión de formulario/Anexo III no se asigna automáticamente cuando no está demostrada.
- El texto original de la fila se conserva en `extraData.historicalImport`.
- Cada expediente recibe un evento de historial con `source=IMPORT`.
- Se conserva archivo, SHA-256, hoja y fila de origen.
- Los códigos existentes en PostgreSQL se omiten como duplicados.
- Los duplicados internos en el Excel se rechazan.
- Los códigos AC/AP se extraen únicamente cuando aparecen de forma explícita.
- La información histórica combinada no se reescribe para aparentar una separación que la fuente no contiene.

## Validación de la fuente revisada el 2026-09-27

- 53 expedientes en 2025.
- 34 expedientes en 2026.
- 87 expedientes en total.
- 0 códigos duplicados dentro de las dos hojas.
- SHA-256 de la copia revisada: `c11558835752558d1e3858a5eb11a1ce829c42410e19067aa109bbe76527af02`.

Si el SHA-256 cambia, debe repetirse el dry-run antes de aplicar.
