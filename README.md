# COVEX Quality Manager

Aplicación web interna para gestionar procesos del Sistema de Calidad de COVEX.

## Alcance previsto

- Desviaciones
- CAPA
- Controles de cambios
- Reclamaciones
- Devoluciones
- Indicadores y tendencias
- Generación de anexos y listados

El proyecto es independiente de COVEX Training Manager.

## Arquitectura

- Next.js + TypeScript + React
- PostgreSQL
- Prisma
- Aplicación monolítica modular
- Integraciones Microsoft 365 opcionales y posteriores al MVP

La fuente funcional de verdad está en `/docs`. Antes de implementar cambios, leer `AGENTS.md`.

## Demo local sin intervención de IT

Requisitos: Node.js compatible, pnpm y Docker Desktop o un PostgreSQL local.

1. Iniciar PostgreSQL:
   ```bash
   docker compose up -d postgres
   ```
2. Copiar `.env.example` a `.env`.
3. Instalar dependencias:
   ```bash
   pnpm install
   ```
4. Preparar la base:
   ```bash
   pnpm db:push
   pnpm db:seed
   ```
5. Instalar una vez las plantillas oficiales v06 de Desviaciones:
   ```bash
   pnpm templates:install -- --annex-iii "/ruta/Anexo III Informe Desviaciones 06.docx" --annex-v "/ruta/Anexo_V_Listado_de_Desviaciones_06 (2).xlsx"
   ```
   El instalador comprueba SHA-256 antes de aceptar los archivos.
6. Iniciar la aplicación:
   ```bash
   pnpm dev
   ```
7. Abrir `http://localhost:3000/deviations`.

Las credenciales incluidas en `compose.yaml` son exclusivamente de desarrollo local y no deben reutilizarse en producción.

## Estado

Hitos 0, 1, 2 y 3 completados. Desviaciones dispone de gestión de expedientes, Anexo III DOCX, Anexo V anual XLSX y listado simple descargable.
