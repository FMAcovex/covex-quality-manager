# COVEX Quality Manager

Aplicación web interna de COVEX para gestionar procesos del Sistema de Calidad. **Desarrollo funcional integrado en siete módulos; no equivale a sistema GMP validado ni a implantación productiva autorizada.**

## Módulos integrados en desarrollo

- **Desviaciones** — GC-00/023.
- **CAPA** — GC-00/030.
- **Controles de Cambios** — GC-00/003.
- **Reclamaciones** — GC-00/027.
- **Devoluciones** — GC-00/028.
- **Auditorías internas y externas**, incluidos planes y Programas Anuales Word — GC-00/033, GC-00/034 y Planes Maestros correspondientes.
- **PNT / documentación controlada**, maestro, revisiones, biblioteca e importación controlada.

Servicios compartidos: relaciones QMS, UUID/códigos de negocio, versiones y snapshots, anexos, registros históricos, catálogos, filtros, indicadores y vencimientos. El envío automático de avisos sigue desactivado.

**Baseline 2026-10-10:** main 5194afe5 (PR #123 squash), CI #585 verde (496 pruebas unitarias comunicadas). Ver [estado y backlog V1](docs/V1_BASELINE_AND_BACKLOG.md). El cierre técnico de módulos no acredita instalación, firma electrónica ni validación GMP.

## Arquitectura y futuro

- Next.js + React/TypeScript; Prisma + PostgreSQL; monolito modular.
- Generación documental DOCX/XLSX en servidor y plantillas controladas por versiones/checksum.
- Preparación gradual para nuevos módulos, dashboard global, autenticación corporativa, autorización por rol/operación, audit trail según riesgos, flujos de aprobación versionados y firmas electrónicas **futuras**.
- **Se conserva la interfaz corporativa actual**. Las mejoras visuales propuestas se limitan a maquetación de filtros e indicadores de listados; las mejoras funcionales UX serán incrementales y sujetas a regresión.
- Independiente de COVEX Training Manager; integración solo mediante decisión posterior.

Prioridad documental y límites: [Decisiones](docs/DECISIONS.md), [Roadmap vigente](docs/ROADMAP.md), [Arquitectura objetivo](docs/QMS_TARGET_ARCHITECTURE.md), [Estado actual/histórico](docs/CURRENT_STATUS.md) y [AGENTS](AGENTS.md).

## Demo local sin intervención de IT

Para ver y probar la aplicación en tu ordenador con datos ficticios basta con Docker Desktop y un comando:

```
docker compose -f compose.demo.yaml up --build
```

Después se abre <http://localhost:3000> y se elige un perfil de demostración (Garantía de Calidad, responsable de departamento, consulta o administrador técnico). Guía paso a paso para Windows, perfiles, plantillas opcionales y resolución de problemas: [DEMO_LOCAL.md](docs/DEMO_LOCAL.md). La demo solo es accesible desde el propio equipo, no usa Entra ni activa el audit trail GMP y no admite datos reales (D-087).

Desarrollo sin Docker: PostgreSQL local, `.env` a partir de `.env.example`, `pnpm install`, `pnpm db:deploy`, `pnpm db:seed` y `pnpm dev`. El acceso requiere la identidad corporativa configurada (4B1) o las variables de la demo local descritas en [DEMO_LOCAL.md](docs/DEMO_LOCAL.md#para-desarrolladores).

## Backup lógico de demo / contingencia técnica

Exportación: `pnpm backup:export`; ruta opcional: `pnpm backup:export -- --out ./backups/mi-backup.json`. Verificación: `pnpm backup:verify -- ./backups/mi-backup.json`.

La exportación incorpora datos y binarios reversibles y checksum SHA-256. El directorio `backups/` se excluye de Git porque puede contener datos sensibles del QMS. **No sustituye política IT de backup/restauración, retención o continuidad de negocio.**

## Comprobaciones

`pnpm quality` ejecuta comprobaciones estáticas/unitarias; la CI incorpora PostgreSQL real y suites de navegador según workflow. La CI validada de referencia para el baseline es [#585](https://github.com/FMAcovex/covex-quality-manager/actions/runs/38065843516).

Para una base antigua creada con `db push`, consultar [adopción de baseline y migraciones](docs/AUDITS_R3A.md). No reinicializar ni aplicar migraciones destructivas sobre datos existentes sin evaluación.

## Límites para el uso regulado

Quedan por confirmar instalación persistente de plantillas y aceptación manual de Microsoft Word, cargas reales conciliadas de históricos y PNT, identidad y permisos corporativos, auditoría de cambios conforme al uso previsto, backup/restauración, procedimientos, validación GMP y liberación. Los PDFs firmados recibidos y evidencias externas no representan por sí mismos firma electrónica GMP nativa.
