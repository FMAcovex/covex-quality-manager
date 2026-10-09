# P2A — Documentos y evidencias por revisión de PNT

Baseline main `236262e9ac861125dbc426744d4dc697f1e1b823` (P1B-2). Rama `feature/pnt-p2a-documents`. Sin aprobación, publicación, firma electrónica ni importación corporativa nueva.

## Análisis y referencias

Revisados ControlledDocument/Revision, staging/confirmación P1B-2, pestaña Documentos y cargas/descargas Desviaciones/CAPA. Estos módulos custodian binarios PostgreSQL; su PDF único y upsert no sirven para el historial inmutable multidocumento PNT y no se modifican. Se reutilizan Prisma/PostgreSQL, historial PNT, estilos de formularios, controles HTTP y validación PDF/OOXML existente de adjuntos, sin cambiar Auditorías.

Contrastado el texto de los originales autorizados SharePoint GC-00.001.03 Elaboración de PNTs.docx (GC-00/001/03, 13/04/2026) y GC-00.013.01 Control de documentación.docx (GC-00/013/01, 15/06/2023): identificación por revisión, elaboración separada de aprobación, conservación/localización de originales y registro de cambios. No se incorporan binarios ni datos personales reales. El contraste textual no acredita formato, firmas ni cualificación. No se automatizan plazos de retención: ambos PNT y sus excepciones deben conciliarse antes de disponer documentos.

## Arquitectura y almacenamiento

Custodia persistente **PostgreSQL BYTEA**, ya disponible en el servidor interno; no directorio Next.js, filesystem público ni memoria temporal. Transacción conjunta binario/metadatos/evento, sin archivos huérfanos. UUID inmutable y referencia opaca `postgres:<UUID>`. Referencias externas `external:<UUID>` sin descarga desde servidor; no son binarios custodiados, MIME/tamaño/SHA quedan sin comprobar. No se exponen rutas físicas.

DATABASE_URL debe apuntar a PostgreSQL persistente. El volumen debe sobrevivir a reinicios/reemplazos del contenedor. Requiere dimensionamiento (15 MiB por archivo, múltiples documentos), acceso DB restringido, cifrado/TLS según despliegue, backup completo con BYTEA, restauración ensayada, monitorización y retención definida. La prueba de aplicación no cualifica el volumen ni backup corporativo. No usar BD efímera en explotación.

El contrato incorporación/descarga separa custodia y presentación. Una futura integración SharePoint podrá añadir proveedor con identidad opaca y hash/versión estable, sin cambiar silenciosamente objetos históricos. P2A solo usa PostgreSQL y referencias HTTPS: sin Graph, sincronización ni lectura remota.

## Modelo e integridad

Migración aditiva `pnt_p2a_documents`, sin alterar modelos QMS/importaciones. ControlledRevisionDocument: UUID; FK compuesta maestro/revisión UUID; nombre original; tipo/estado; MIME/tamaño/SHA-256; bytes o referencia HTTPS; fecha; responsable y fuente de identidad; referencia de almacenamiento; contexto; antecesor y motivo de sustitución.

Tipos WORKING_WORD, DOCUMENT_PDF, EXTERNAL_SIGNED_PDF, APPROVAL_EVIDENCE, ANNEX. Word permanece WORKING; los demás RECORDED_UNVERIFIED, incluso firmado/evidencia. Extensión o clasificación no acredita aprobación ni firma. Referencias externas sin hash inventado.

Cada incorporación es INSERT. No hay edición/borrado/upsert ordinario. Trigger PostgreSQL rechaza UPDATE/DELETE de todos los objetos, consolidados o no. Sustitución exige motivo y mismo tipo/revisión, conserva UUID/bytes/metadatos originales y añade objeto/evento. FK compuesta impide antecesor de otra revisión; unicidad impide dos sucesores concurrentes. «Sustituido» se deriva del sucesor sin editar original; todos los originales siguen descargables. Mantenimiento/disposición requiere procedimiento separado autorizado.

SHA-256 calculado en servidor sobre bytes y comprobado antes de descargar. Incorporar no escribe maestro/revisión: conserva updatedAt, snapshots, sourceMetadata, procedencia Excel, consolidación/verificadores y lote confirmado. No crea revisiones ni cambia DRAFT/UNVERIFIED/IMPORTED_PENDING.

## Pantallas

Ficha PNT → Documentos, revisiones descendentes. Aviso de verificación pendiente, referencia original, distinción explícita elaboración/firmado/evidencia, nombre, fecha/responsable, estado, UUID objeto/revisión, MIME/tamaño/hash y contexto. Descarga por triple UUID maestro/revisión/objeto; HTTPS externo con noopener/noreferrer. Cadena y motivos visibles; Historial operativo registra incorporación/sustitución. PNT anulado y acceso read: solo lectura.

## Seguridad y configuración de acceso

Baseline sin autenticación corporativa. El actor escrito de P1A/CAPA **no autentica** y no autoriza P2A ni determina su responsable. P2A falla cerrado por defecto: pestaña, descarga e incorporación.

Configuración operativa: `PNT_DOCUMENT_ACCESS_MODE=trusted-proxy`, `PNT_DOCUMENT_PROXY_SECRET` aleatorio ≥32 caracteres en gestor de secretos. Gateway interno autentica usuario, decide acceso y establece `x-pnt-user`, `x-pnt-permissions` (`read` / `read,write`) y `x-pnt-proxy-secret`; comparación constante. No enviar secreto al navegador/HTML/repositorio. Proxy debe eliminar cabeceras del cliente, inyectar las propias, impedir acceso directo al upstream, proteger enlace/logs. **Sin esa topología no hay autenticación segura y no debe habilitarse.** Gateway y responsabilidades requieren revisión operativa; no se implementan Entra ni roles corporativos.

`PNT_DOCUMENT_ACCESS_MODE=demo` requiere APP_ENV=test/demo y responsable fijo TEST_DEMO. Solo datos sintéticos; no habilitar en explotación. APP_ENV debe gobernarse desde despliegue. CI reinicia con proxy y secreto público exclusivamente de prueba. Servidor valida acceso antes de consultar documentos y write antes de incorporar. POST documental exige Origin igual al origen de servicio; configurar `PNT_DOCUMENT_ALLOWED_ORIGIN` con el origen HTTPS externo exacto si el proxy cambia Host/protocolo. Cuerpo multipart acotado a 16 MiB leyendo el stream, sin confiar en Content-Length. Tras confirmar devuelve JSON y el formulario navega a la pestaña, evitando que una revalidación de Server Action deje la carga en espera.

Validación servidor: UUID/ownership, nombre sin rutas/traversal/controles, tipos, 15 MiB, extensión/MIME coherentes (MIME vacío/octet-stream normalizado), cabecera PDF, paquete DOCX/XLSX con CRC/partes/tipo/relaciones Office y límite expandido 60 MiB. WORKING_WORD exige DOCX; tipos PDF exigen PDF. Referencia HTTPS sin credenciales; no fetch remoto/SSRF. Descarga attachment, nosniff, private/no-store; sin inline. Consultas de metadatos excluyen BYTEA.

Límites pendientes: cabecera PDF no prueba estructura completa/malware/firma; OOXML no es antivirus. Scanner/cuarentena, cuotas globales, permisos por PNT/departamento, directorio corporativo, disponibilidad de enlaces y cualificación de backup/storage. No conformidad GMP, audit trail ni firma electrónica validados; historial operativo.

## Pruebas

Fixtures sintéticos. Unitarios: tipos/extensiones/MIME/contenido/tamaño/rutas/HTTPS, acceso fail-closed/read-write y endpoint denegado antes de consulta con triple ownership.

PostgreSQL: Excel sintético importado por P1B-2, siete documentos de todos los tipos, SHA/descarga íntegra/corrupción rechazada, referencia, sustitución/motivo y concurrencia, rechazo UUID/FK/antecesor ajeno, inmutabilidad SQL incluso en revisión consolidada, estados/procedencia/snapshots intactos y nuevo cliente tras desconexión. Fixtures inmutables retenidas en BD QA desechable, sin eludir trigger para borrarlas.

Navegador: revisiones descendentes, avisos, cargas/referencia/metadatos, sustitución/historial, original descargable, ownership, falso PDF rechazado, vistas 1440/768/390 y sin hidratación. Reinicio real de Next en modo proxy: original íntegro, acceso sin credenciales/secreto incorrecto denegado, lector sin formulario y no autorizado sin metadatos.

Regresión focalizada PostgreSQL/navegador P1A/P1B-1/P1B-2. CI selecciona job documental por paths y comparación del esquema original salvo adición P2A; ejecuta cuatro bloques y quality al final, sin navegador Auditorías. Resultado final en la PR.

Validación local final: 53 tests afectados / 6 archivos; smokes PostgreSQL y navegador P1A/P1B-1/P1B-2/P2A, más reinicio real autenticado, todos correctos. `pnpm quality` correcto (399 tests / 73 archivos, Prisma validate/generate, lint y build). Solo warnings preexistentes CAPA/CC. Se corrigió el retorno de carga que podía quedar pendiente y se hizo inequívoco el selector de error XLSX del smoke P1B-1; no se debilitan comprobaciones. El backup lógico demo existente no sustituye el backup PostgreSQL completo requerido para custodiar estos binarios.

## Pendiente de P2B

Contraste/aceptación documental, identidad autorizada de aprobadores, evidencia suficiente, verificación de firma externa, UNVERIFIED→VERIFIED / IMPORTED_PENDING→IN_FORCE / DRAFT→ACTIVE, publicación/distribución/vigencia. Ninguna transición se deduce de adjuntar, sustituir o clasificar documentos en P2A.
