# COVEX Quality Manager

Aplicación web interna para gestionar procesos del Sistema de Calidad de COVEX.

## Módulos

- Desviaciones · GC-00/023
- CAPA · GC-00/030
- Controles de Cambios · GC-00/003
- Reclamaciones · GC-00/027
- Devoluciones · GC-00/028
- Indicadores y tendencias
- Administración de catálogos, versiones, plantillas y vencimientos

La aplicación es independiente de COVEX Training Manager. La V1 es una herramienta interna de gestión y generación documental; no debe considerarse un sistema GMP validado ni sustituye los controles corporativos requeridos para producción.

## Arquitectura

- Next.js + TypeScript + React
- PostgreSQL + Prisma
- monolito modular
- documentos DOCX/XLSX generados en servidor
- plantillas versionadas con control SHA-256
- relaciones QMS N:N y versionado funcional de expedientes
- Microsoft 365 / Entra ID reservados para Hito 11

La fuente funcional de verdad está en `/docs`. Antes de cambiar comportamiento, leer `AGENTS.md`.

## Demo local sin intervención de IT

Requisitos: Node.js 22 compatible, pnpm y Docker Desktop o PostgreSQL local.

1. Iniciar PostgreSQL:
   ```bash
   docker compose up -d postgres
   ```
2. Copiar `.env.example` a `.env`.
3. Instalar dependencias:
   ```bash
   pnpm install
   ```
4. Preparar base y configuración:
   ```bash
   pnpm db:push
   pnpm db:seed
   ```
5. Opcional: cargar cinco expedientes ficticios de demostración:
   ```bash
   pnpm demo:seed
   ```
   Requiere `ALLOW_DEMO_DATA=true` y se bloquea siempre si `APP_ENV=production`.
6. Instalar las plantillas controladas que se vayan a demostrar mediante los comandos `templates:*`.
7. Iniciar:
   ```bash
   pnpm dev
   ```
8. Abrir `http://localhost:3000`.

Todos los registros creados por `demo:seed` usan prefijo `DEMO-` y texto explícito de datos ficticios.

## Backup lógico de demo / contingencia técnica

Generar una exportación lógica completa de PostgreSQL:

```bash
pnpm backup:export
```

O elegir ruta:

```bash
pnpm backup:export -- --out ./backups/mi-backup.json
```

Validar estructura y recuentos:

```bash
pnpm backup:verify -- ./backups/mi-backup.json
```

El export incluye todas las tablas Prisma y conserva de forma reversible fechas y binarios. Se genera además SHA-256. La carpeta `backups/` está excluida de Git porque puede contener el contenido completo del QMS.

Este mecanismo es una exportación técnica para demo/contingencia y no sustituye una política corporativa de backup, restauración, retención o disaster recovery.

## Comprobaciones

```bash
pnpm quality
```

La CI añade PostgreSQL real y smoke tests de todos los módulos, versionado, administración y endurecimiento.

## Estado

Hitos 0–10 completados y validados en CI. Hito 11 queda reservado para producción/IT.
