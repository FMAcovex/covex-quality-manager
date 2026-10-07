# Auditorías R3A — operación y despliegue

R3A añade solo expediente base y planificación. Las decisiones están en D-064. La ficha incluye Información e Historial. Review muestra indicador neutro en el listado; no hay targets, hilos o versiones. Cierre final bloqueado también en servidor.

## Migraciones

Main utilizaba db push y no contenía migrations. Se incorpora:

1. 20261007000000_baseline: esquema exacto anterior a R3A, generado desde main 0fa2306.
2. 20261007000100_audits_r3a: tipo AUDIT, enums, tres tablas, índices/FKs y CHECK tipo/escenario.

BD limpia: `pnpm db:deploy`, `pnpm db:generate`, `pnpm db:seed`. CI utiliza deploy desde vacío.

BD existente creada con db push: hacer backup; contrastar que su esquema corresponde a la baseline (Prisma migrate diff). Solo si coincide, registrar la baseline como ya aplicada con `pnpm exec prisma migrate resolve --applied 20261007000000_baseline`, después ejecutar `pnpm db:deploy`. No ejecutar la baseline CREATE TABLE sobre tablas existentes, resetear la BD ni marcar como aplicada una baseline que no coincida. La adopción sobre una BD real necesita su comprobación específica; la prueba local/CI de R3A es sobre BD limpia aislada.

## Códigos

Internas: AI/área/YY/año, dos dígitos, máximo 99, serie por área/año. Proveedor: AE/códigoEntidad/YY/año, misma anchura y serie por entidad/año. Al agotar la serie, se informa error; no se amplía silenciosamente. Código entidad manual, mayúsculas, letras/números/guion/guion bajo, hasta 40 caracteres; XXXX es el marcador del PNT, no una longitud asumida del maestro.

Año inicial desde prevista, apertura o realizada, en ese orden. Código/año estables después de apertura. Interna con múltiples áreas requiere referencia explícita; no se puede retirar el área de codificación de un expediente operativo. Tipo/escenario y dimensión de serie se fijan al abrir.

Cliente/autoridad: sin serie normativa; UUID QMS y referencia externa separada. La ausencia de código no impide abrir ni anular/reactivar esos escenarios.

## Identidades y datos históricos

Participantes actualizados por UUID y validados por pertenencia. Retirada lógica; asociación área/auditoría única y reactivable con mismo UUID. Snapshots de área conservados aunque cambie el catálogo. Comparación de updatedAt evita sobrescribir ediciones concurrentes desde el formulario.

## Verificación

`APP_ENV=test pnpm audits-r3a:smoke` en una BD aislada y con db:seed previo. Incluye concurrencia, apertura, UUID, filtros/búsqueda/paginación, administración, SQL CHECK e idempotencia demo. Solo elimina fixtures propios.

`APP_ENV=test R3A_UI_BASE_URL=http://127.0.0.1:3000 pnpm audits-r3a:ui:smoke` contra servidor/BD de test. Opcional R3A_UI_CHROMIUM_PATH para navegador local. Comprueba 1440/768/390, valores tras error/cambio de escenario, administración y resolver QMS.

`pnpm quality` ejecuta Prisma validate/generate, lint, tests y build. Fuentes de auditorías: reglas comunicadas por el usuario, no binarios instalados. Datos demo ficticios con convención DEMO-; no informes reales ni datos personales reales.

## Guardado y navegación — diagnóstico CI de la PR #99

El bloqueo intermitente de Guardando… se reprodujo con Node 22.23.3 y Chromium de Playwright sobre el mismo build tanto con next start como con standalone. La instrumentación mostró la transacción y ChangeHistory terminados, consultas de destino terminadas, POST 303 completamente recibido y redirect RSC decodificado/entregado a React, sin consultas o locks pendientes. La transición de navegación del cliente no se completaba. El test negativo Audit_type_scenario_check es intencionado y las consultas posteriores funcionan; se conserva.

saveAuditAction sigue ejecutándose mediante useActionState y espera la misma transacción/validaciones. Tras éxito devuelve savedHref serializable; AuditForm navega al documento del detalle únicamente al recibir ese resultado. Los errores siguen conservando valores. Las rutas de Auditorías son force-dynamic y el documento nuevo lee datos actuales; se retira la invalidación/redirect RSC simultánea del guardado base. No cambian reglas, UUID, estados, códigos, cierres ni historial.

El smoke conserva los clics reales de Guardar y Editar y los timeouts estándar de Playwright (30 s), sin retries ni navegación sustitutiva del guardado. Tras un guardado exitoso, espera la carga del cliente del nuevo documento antes de pulsar Editar o continuar. La navegación puede cancelar el tramo final del stream RSC después de recibir savedHref; la comprobación exige las respuestas 200 y la persistencia real, no un evento requestfinished que puede cancelarse al abandonar el documento. CI ejecuta tres pasadas consecutivas y falla en la primera incidencia; el smoke comprueba tres respuestas Server Action reales y correctas (alta, validación rechazada y apertura). En fallo imprime únicamente el resumen de peticiones Server Action (ruta/estado/finalización) y errores de página, sin cuerpos de formularios. Se mantiene el log del servidor en fallos CI y se eliminan los ajustes PostgreSQL checkpoint_timeout/pg_reload_conf/CHECKPOINT.

next start y standalone comparten el flujo de acciones/redirects; cambiar el arranque no elimina la reproducción. CI conserva pnpm start para verificar la corrección con su arranque original. Para ejecutar el paquete standalone, copiar .next/static a .next/standalone/.next/static (y public si existe), configurar HOSTNAME/PORT y ejecutar node .next/standalone/server.js.
