# Importación histórica CAPA 2025–2026

## Fuente
`02. LISTADO DE CAPAS (2025_).xlsx`

SHA-256 revisado:
`a88f5024001b0a7d793b3f1f79c7aeb00b5e278d934297ed731e60e34c93ebfb`

## Dry-run
```bash
pnpm import:capa -- --file "/ruta/02. LISTADO DE CAPAS (2025_).xlsx"
```

La ejecución por defecto no escribe expedientes.

## Aplicación real
```bash
pnpm import:capa -- \
  --file "/ruta/02. LISTADO DE CAPAS (2025_).xlsx" \
  --apply \
  --confirm APPLY_CAPA_2025_2026 \
  --actor "Nombre del usuario"
```

## Reglas
- hojas 2025 y 2026 = fuente principal;
- Base_KPI = enriquecimiento auxiliar, nunca sustituto de las hojas anuales;
- no se inventa causa raíz;
- ausencia de causa raíz queda marcada para revisión;
- seguimiento 2026 se reconstruye solo cuando el listado incluye número/fecha explícitos;
- N/A de eficacia histórico se conserva como N/A;
- duplicados internos se rechazan;
- códigos ya existentes en PostgreSQL se omiten;
- se conserva snapshot, hoja, fila, SHA-256 e historial IMPORT.

## Resultado de análisis de la copia revisada
- 129 CAPA;
- 75 en 2025;
- 54 en 2026;
- 0 registros sin departamento;
- 0 registros sin descripción;
- 0 registros sin fecha de apertura;
- 3 registros 2026 no presentes en Base_KPI;
- un código duplicado: `AC/GC-11/001/2026`.

El código duplicado corresponde a dos acciones distintas y requiere decisión humana antes de importarlas.
