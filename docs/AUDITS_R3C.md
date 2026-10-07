# Auditorías R3C — documentos, versiones, Review y cierre

Base: main `cfd05b65eb682f65bfe55ede98dc87cb79837ceb`, R3A/R3B fusionados. Rama `feature/audits-r3c-documents-versioning-review-close`. Complementa y sustituye las limitaciones de fase de AUDITS_R3A.md/AUDITS_R3B.md; no modifica sus identidades, codificaciones ni relaciones.

## Fuentes controladas realmente revisadas

El usuario autorizó las carpetas SharePoint de Dirección de Calidad GC-00.033 y GC-00.034. Se descargaron los cinco binarios vigentes y se revisaron sus tablas, textos y secciones OOXML. No se usaron OBSOLETOS ni BORRADOR_Anexo_IV_CAPA_Auditorias_COVEX.xlsx.

| Fuente | SHA-256 |
| --- | --- |
| GC-00.033.03 Auditorías internas.docx | `06cb44d201d5b3fd9f4cb8b54acbf55b15459bc4bb6ee018e384d423ada1017f` |
| A3.03 INFORME AUDITORIA INTERNA.docx | `d461403cecfb8b6cfb601ad9e395e6f3d1f0247156570633b0e287ac2f87b7f9` |
| A4.03 CAPA PLAN.xlsx | `88d1a49e814cb3f035bc85c025ebefb2e5da6f7eb4da2d245d2b0deb9de32414` |
| A3. INFORME AUDITORIA_V04.docx | `ed09292702a08c73a26a42d019e81c1d7d74ac63264b278dd6d6fa6e2acbc40d` |
| GC-00.034.04 Auditorías externas.docx | `1c73fa4fbe06b42a797000ce0a95ccee034261a230ddc7602920ace17bcae6af` |

Vigencias: interno 10/04/2026; externo 08/06/2026. Fuentes autorizadas: [internas](https://covex365.sharepoint.com/:f:/s/Direccion-de-Calidad/IgC-kG_DnSQqUYqyHiQVc8U2ATi1Dy4mswzP0p7GMiicUI0?e=StOsVb), [externas](https://covex365.sharepoint.com/:f:/s/Direccion-de-Calidad/IgDyd8IdkmdyVoi8WzlUXHX4Af9ydRJ1BJrKfAxqUGb3X00?e=CRXo8b).

## Informe y versiones

La unidad formal es el informe emitido/revisado. 00 inicial; 01+ requiere motivo y autor, con fecha persistida. La transacción bloquea Audit/QmsRecord y asigna número correlativo único. Cada QmsRecordVersion nace congelada y conserva datos, UUID/referencia OBS/Rk, criticidad, tratamiento, acciones, relaciones/códigos/estado de aquel momento y TemplateVersion/checksum seleccionados. No hay fallback a datos vivos para generar históricos. Retirar, editar o añadir elementos después no modifica 00.

Seguimientos, acciones, CAPA Plan actual y cambios administrativos no emiten versiones automáticamente. CLIENT/AUTHORITY conservan referencia y revisión externa del documento primario; 00/01 son snapshots internos del expediente y no renumeran ni fabrican el acta externa.

## Generación documental

A3 interno se utiliza para ambas internas, incluida contratada. A3 externo V04 solo para SUPPLIER. Conservan paquete OOXML, estilos, tablas, logos, clasificación fija, secciones y espacios de firma; se rellenan identificación, participantes, OBS/Rk, antecedentes, conclusión y programa. Se amplían filas sin renumerar referencias. No se simula firma electrónica.

A4.03 CAPA PLAN.xlsx se usa en todos los escenarios: una fila por elemento, acciones múltiples reunidas con saltos de línea, códigos de relaciones incluidos. Conserva las tres hojas, leyenda, catálogos, estilos, zonas de firmas y textos fijos; la ampliación desplaza el pie y extiende filtros/desplegables. El estado actual es una generación archivada independiente; la descarga desde Versiones usa exclusivamente su snapshot.

No existe un binario independiente vigente del Plan externo en la fuente revisada. Se extrae el Anexo IV real del PNT GC-00.034.04, preservando paquete, encabezado, pie y formato. Se rellenan entidad, fecha, lugar, introducción, alcance, personal/equipo, duración, programa y distribución. El texto fijo sobre elaboración/distribución se conserva; no crea vencimientos automáticos. Solo SUPPLIER y con datos mínimos completos.

TemplateVersion almacena los cuatro binarios de generación con hashes verificados. Históricos fijan UUID/checksum; cambiar la activa no los regenera con una nueva. GeneratedDocument archiva bytes y checksum; sus metadatos distinguen GENERATED/RECEIVED. No se crea un segundo almacén ni modelos de archivos paralelos. Las descargas comprueban pertenencia al expediente y checksum.

## Adjuntos y PDF firmado

Documento recibido, respuesta y evidencia admiten PDF/DOCX/XLSX hasta 15 MB. Documento primario exige tipo/nombre, referencia y fecha; revisión externa y observaciones se conservan sin asignar código AI/AE artificial. Los bytes no se sobrescriben.

SIGNED_PDF transversal se asocia a la QmsRecordVersion exacta. Se validan propietario, PDF real por cabecera, tamaño y actor. Se rechaza sustituir el firmado de la misma versión; 00 y 01 permanecen descargables. PDF esperado ausente genera aviso de integridad, no requisito absoluto de cierre: los PNT no establecen que la carga en la aplicación sea condición necesaria. Firma manual/externa, sin aprobación electrónica GMP.

## Cierre decidido por QA y validado en servidor

Sin nueva máquina de estados: DRAFT/OPEN/CLOSED. `closedAt` solo para cierre definitivo. No hay reapertura automática. Backend valida todas las condiciones; UI muestra bloqueos/avisos derivados, no un checklist manual duplicado.

Internas: informe formal y conclusión, hallazgos tratados o no procedencia justificada, acciones terminales con evidencia y verificación local CONFORMING/NA con responsable/fecha. Tratamiento sin acciones exige evidencia y, si cerrado, comentario de verificación. CAPA formal atribuida necesaria debe estar operativa, cerrada y con eficacia CONFORMING/NA. Se usa estado vivo sin duplicar eficacia CAPA en Auditorías. Se bloquean esas filas al decidir cierre para evitar cambios concurrentes. No se exige universalmente cerrar todas las Desviaciones relacionadas. CAPA Plan establecido tras informe/tratamientos deriva cierre parcial, sin `closedAt`.

Proveedor: envío de informe final deriva cierre parcial. Cierre normal requiere tratamiento, acciones, evidencia, verificación y resolución de seguimientos pendientes. Excepción explícita solo SUPPLIER sin respuesta CAPA (fecha o documento de respuesta registrado) y sin críticos; exige motivo, actor, fecha y marca de verificar deficiencias en siguiente auditoría. Permite diferir tratamiento local/seguimiento; no omite una CAPA formal necesaria ya atribuida. Registra evaluación/observación QA sobre proveedor sin alterar automáticamente homologación GC-00/025.

Cliente/autoridad: documento primario recibido, snapshot, conclusión, observaciones/acciones tratadas, evidencia de cierre y respuesta enviada si se indicó requerida. No impone una eficacia local universal nueva; CAPA formal necesaria conserva su propia regla. Seguimiento pendiente es la última entrada cronológica por ámbito general/hallazgo activo con próxima revisión informada; una resolución posterior sin próxima revisión lo resuelve.

## Review y workspace

Reutiliza hilos/mensajes/transiciones R2C. Estáticos: identificación, alcance, planificación, participantes, conclusión, cierre. Dinámicos: UUID de hallazgo, acción y seguimiento, con validación de pertenencia. Creación estándar en versión vigente; hilos históricos conservan versión y snapshot, se consultan y responden sin copiarlos a 01. Filtrado por versión en Revisión. Deep links abren pestaña, desplazan y resaltan incluso targets retirados.

Pestañas Información, Hallazgos, Seguimiento, Relaciones, Informe y cierre, Documentos, Versiones, Revisión e Historial. Los Server Actions devuelven resultado confirmado y después el cliente navega/recarga, conservando solución R3B. Los enlaces Editar, pestañas y consulta de retirados usan navegación nativa para no depender de una transición RSC pendiente. Errores conservan valores; no se introducen retries ni ampliaciones artificiales de timeout. Responsive 1440/768/390.

Situación derivada: Borrador, Planificada, Realizada · informe pendiente, Informe emitido, En seguimiento, Cierre parcial y Cerrada. Hechos de informe y cierre parcial prevalecen sobre estimaciones antiguas R3B. Columnas opcionales versión/fecha/PDF/parcial, filtros informe/firmado de última versión/situación/Review. Review activas PENDING+ACCEPTED, RESOLVED no activa; agregación por lote, sin N+1.

Anulados conservan consulta/descarga histórica; se bloquea generación operativa y emisiones nuevas. Integridad avisa sobre realizada sin informe, fecha de informe sin versión, cierre sin conclusión, tratamiento/evidencia ausentes, PDF esperado, documento externo faltante y excepción incompleta. Historial operativo de cambios, emisiones/motivos, archivos y cierre; Review conserva su historial propio.

## Despliegue y verificación

Migración aditiva `20261007000300_audits_r3c`: campos Audit, verificación local AuditFindingAction, bytes/metadatos GeneratedDocument y enums. Se reutilizan 46 modelos. Sobre R3B: backup habitual, `pnpm db:deploy`, `pnpm db:generate`; sin reset/backfill de versiones inventadas. Desde vacío se aplican las cuatro migraciones.

Los binarios corporativos no se incluyen en Git. Copiar los cuatro nombres exactos a una carpeta autorizada y ejecutar `pnpm templates:audits:install /ruta/carpeta`. El instalador verifica todos los SHA-256 antes de escribir, es idempotente y rechaza sobrescribir una versión con hash diferente. Una fuente futura debe revisarse y activarse como nueva versión, adaptando el mapeo si cambia la estructura.

Pruebas: cierre positivo/negativo por escenario, generación real por snapshot, 00/01, retiradas/relaciones/histórico, PDFs separados, checksum, pertenencia, Review/transiciones/deep links, concurrencia y anulación. `APP_ENV=test pnpm audits-r3c:smoke` instala y limpia plantillas sintéticas explícitamente ficticias para CI; `R3C_OFFICIAL_TEMPLATES=1` usa las reales instaladas. `R3C_QA_OUTPUT=reports/audits` permite exportar fixtures para comprobar OOXML/LibreOffice. CI nunca convierte sus fixtures en plantillas oficiales de despliegue.

Navegador: `APP_ENV=test R3C_UI_BASE_URL=http://127.0.0.1:3000 pnpm audits-r3c:ui:smoke`, Chromium opcional R3C_UI_CHROMIUM_PATH. Datos ficticios, limpieza limitada a UUID propios. Se ejecutan también regresión PostgreSQL completa, Review R2C UI, tres pasadas consecutivas R3A UI y R3B UI con next start y Node 22. Evidencia definitiva en CI/PR; no representa validación GMP.

Fuera de R3C: Plan Maestro anual, alertas y módulos de homologación/firma electrónica. Queda revisión manual documental por Calidad en Microsoft Office: OOXML y conversión con LibreOffice no certifican fidelidad idéntica entre motores.
