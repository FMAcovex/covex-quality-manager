# Primera tarea para Codex — Hito 1

## Objetivo

Construir el núcleo técnico de COVEX Quality Manager sin implementar todavía el módulo funcional completo de Desviaciones.

## Lectura obligatoria

Antes de modificar archivos:
1. `AGENTS.md`
2. `docs/DECISIONS.md`
3. `docs/SPECIFICATION.md`
4. `docs/DATA_MODEL.md`
5. `docs/ROADMAP.md`
6. `docs/CURRENT_STATUS.md`

## Alcance

### Inicializar aplicación
- Next.js estable compatible.
- TypeScript.
- React.
- pnpm.
- ESLint.
- Vitest o equivalente coherente con el stack.
- estructura modular.

### Base de datos
- Prisma.
- PostgreSQL.
- `.env.example` sin secretos.
- esquema inicial para:
  - QmsRecord;
  - QmsRelation;
  - Department;
  - FormVersion;
  - TemplateVersion;
  - ChangeHistory;
  - GeneratedDocument;
  - Deviation;
  - DeviationImmediateAction;
  - DeviationFollowup;
  - DeviationCapaPlan.
- reservar arquitectura CAPA sin implementar UI completa.

### Reglas de modelo
- UUID internos.
- businessCode separado de la PK.
- unicidad de código por `recordType + businessCode`.
- relaciones N:N mediante QmsRecord.
- almacenar relaciones direccionales una sola vez y derivar la vista inversa.
- normalizar relaciones simétricas para evitar duplicados invertidos.
- Deviation referencia `Department` por FK y conserva snapshots de código/nombre.
- timestamps.
- constraints/índices razonables.
- no usar businessCode como PK.
- no hardcodear plazos GMP no confirmados.

### UI base
Crear shell de aplicación sobrio:
- navegación;
- placeholder Desviaciones;
- módulos futuros sin funcionalidad falsa.

No construir todavía el formulario completo del Hito 2.

### Datos de desarrollo
- seed exclusivamente ficticio;
- catálogo inicial ficticio/estructural de departamentos cuando sea necesario;
- no importar datos reales 2025/2026 todavía.

### Calidad
Añadir pruebas mínimas del modelo/utilidades relevantes.

Comandos que deben pasar:
- `pnpm lint`
- `pnpm test`
- `pnpm prisma validate` o equivalente
- `pnpm build`

Actualizar `docs/CURRENT_STATUS.md` al finalizar.

## Fuera de alcance
- Entra.
- SharePoint/Graph.
- Power Automate.
- documentos DOCX/XLSX.
- importación histórica real.
- indicadores.
- alertas.
- CAPA UI completa.
- controles de cambios/reclamaciones/devoluciones.

## Resultado esperado

Repositorio ejecutable localmente, modelo de datos sólido y base visual suficiente para iniciar el Hito 2 sin reestructuración mayor.
