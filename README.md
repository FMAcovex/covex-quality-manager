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
5. Iniciar la aplicación:
   ```bash
   pnpm dev
   ```
6. Abrir `http://localhost:3000/deviations`.

Las credenciales incluidas en `compose.yaml` son exclusivamente de desarrollo local y no deben reutilizarse en producción.

## Estado

Hitos 0, 1 y 2 completados. El módulo Desviaciones ya dispone de listado, filtros, alta, edición, expediente, seguimientos e historial. La generación de Anexo III/V pertenece al Hito 3.
