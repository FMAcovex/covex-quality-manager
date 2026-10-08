# R4B — Devoluciones: cierre funcional

Baseline: main fb931b67d073cdd3aef495649f1e9f096c76e80a. Rama: feature/returns-r4b-functional. Un solo PR; sin merge ni squash automático.

## Estado previo clasificado

A. Correcto y reutilizable: serie DEV/LG, reserva de códigos anulados y asignador concurrente, QmsRecord RETURN, borrador parcial, productos 1:N, ReturnFollowup, estados/decisión/cierre, relación COMPLAINT → RETURN, generadores III/IV/V/VI, PDF independientes III/V con propiedad/checksum/motivo, Review R2C sin versión funcional.

B. Parcial: las comprobaciones se exigían universalmente, el snapshot técnico no contenía UUID/pines/orígenes completos, el instalador solo admitía el PNT completo, el listado truncaba a 300, las generaciones conservaban únicamente metadatos.

C. Defectos reales: la edición borraba/recreaba productos y rompía su identidad Review; aceptar no validaba incompatibilidades para stock; cierre admitía trazabilidad N/A; año de código basado solo en comunicación; el formulario no capturaba datos existentes de declaración/destrucción; vinculación desde Return utilizaba cliente raíz y omitía refresh transaccional de Complaint.

D. Legacy conservado: modelos/columnas, ReturnFollowup, snapshots previos, códigos/áreas operativos, metadatos adicionales extraData y plantillas ya instaladas. Sin migración ni backfill masivo. Productos retirados quedan en ChangeHistory con UUID/valores y Review conserva su target histórico. No se inventa un fichero para generaciones antiguas que nunca archivaron binario.

## Fuente controlada real

Se han revisado los cinco binarios vigentes de SharePoint Dirección de Calidad, carpeta GC-00.028 Devoluciones de productos. No se utilizan OBSOLETOS ni borradores. PNT GC-00/028/03, vigente 26/05/2026, sustituye GC-00/028/02 y DT015/02. Los binarios no se versionan en Git.

| Fuente real | SHA-256 |
|---|---|
| GC-00.028.03 DEV PRODUCTO_CSM_CG.docx | 7f6b318e936cef9d2685347decf52b8951c34585dbd2ef1ebca05232a0c59a5a |
| A3 FORMULARIO DEV 03.docx | 9716477f2b261a4fec8b1d459fb8aa62bd42840f8fa352b4b66b15c2669745f4 |
| A4 PETICION DEV 03.docx | 4c125e117f8b44f4605b4fde203cfb825ed3b5378e9858cda5591ecc84336460 |
| A5 DECLARACION CLIENTE 03.docx | 0b8a6e74a45c1f4a3cf216444449acd2cbdf54fc47276728c9cd7a48fb3a52ee |
| A6 LISTADO DEV 03.xlsx | fa027508995beca7e39368f92e9d75ac2fdcf0dd7dffa57dfef8d59e6696db64 |

III/VI/PNT coinciden con los hashes previos. Los anexos separados IV/V actuales tienen hashes distintos de las copias previas: se preservan activos instalados y los fallbacks históricos; el instalador se niega a reemplazar una versión 03 ya poblada con otro checksum. La instalación desde carpeta verifica todos los binarios antes de mutar y usa la vigencia real. No crea módulo PNT ni sincronización SharePoint.

## Unidad de seguimiento y documentación

El PNT §5.2 dispone que el formulario se completa con datos disponibles y se actualiza durante la investigación. No define una unidad formal de revisión del expediente. Decisión: mantener ReturnFollowup y un snapshot técnico único (secuencia 0), editable, con autor/motivo original preservados. No se crean V01/V02 por editar, evaluar, decidir, seguir o cerrar. Review mantiene recordVersionId null. No se copia el versionado funcional de Reclamaciones.

Cada descarga nueva III/IV/V archiva bytes, checksum, fecha, actor, plantilla y snapshot de datos con UUID de productos. Los archivos se descargan por UUID/propiedad y se verifica checksum; las ediciones posteriores no regeneran estos históricos. El puntero al V00 mutable es técnico: el snapshot inmutable de la generación está dentro de metadata.sourceSnapshot.

PDF III/V independientes: validación de PDF/límite/propiedad/checksum y motivo de sustitución reutilizados. R4B añade archivo inmutable de cada carga; una sustitución conserva bytes anteriores. Para una carga legacy anterior sin snapshot documental conocido se registra explícitamente originalSnapshotKnown=false; no se inventa asociación histórica. observedSnapshot refleja datos observados al recibir el PDF, no prueba del contenido ni firma electrónica. IV mantiene recepción/verificación documental por producto y generación archivada; no se introduce una firma electrónica ni revisión formal de recepción.

## Reglas funcionales

- Prisma mantiene el enum de tipo obligatorio sin migración: un borrador sin selección utiliza OTHER técnico y extraData.pendingReturnType=true; en la UI sigue pendiente y al abrir se exige selección explícita.
- Borrador incompleto admite productos parciales y evaluación pendiente. Al abrir se valida III y cada producto; los errores conservan captura. No exige cierre/control interno ni criterios no aplicables.
- Código nuevo usa año de recepción, o comunicación/apertura disponible. Código/año/área se conservan después de asignar código, incluido un borrador con código reservado; historial previo no se recodifica. Áreas LG-00/10/20/30/40 existentes se preservan; GC codifica/evalúa, LG recibe/segrega, QC y DT intervienen según el PNT, sin RBAC inventado. Área por producto opcional para trazabilidad mixta.
- Los productos conservan UUID al editar/reordenar; se rechazan UUID ajenos/duplicados dentro de transacción.
- Contexto mínimo en extraData.r4b: circuito de destino, temperatura controlada, medicamento serializado, declaración requerida por GC, evaluación QC requerida, necesidad de seguimiento, procedencia mayorista de medicamento y justificación de excepción de plazo ambiente. No migración.
- La aceptación es aceptación de gestión (§5.5), no liberación. El destino queda explícito y admite los circuitos del PNT. La reincorporación con decisión exige fecha y controles aplicables positivos: envases, conservación, ausencia de uso/contaminación/alertas y caducidad; QC para API/intermedio, declaración para medicamento/casos requeridos, identificador/tamper solo medicamento serializado, frío según condiciones. Un NO en criterio aplicable bloquea reincorporación. N/A se admite para ausencia de excursiones y para el sistema de retorno cuando no aplica su validación, según los textos reales; no permite omitir registros de temperatura, embalaje o conservación. El plazo de 10 días de medicamento ambiente distingue mayorista autorizado frente a farmacia/entidad sin autorización: un NO solo admite la excepción explícita de §5.6 con justificación y evaluación de riesgos documentadas, incluidas en III. Los demás NO no se exceptúan. El máximo de 48 horas se exige a medicamento frío, no a API frío. No se calculan plazos comerciales sin datos suficientes.
- Apertura permite investigación pendiente. Evaluación de reincorporación y cierre requieren completar criterios aplicables. Frío indicado en conservación no puede eludirse desmarcando contexto. No se exigen criterios de frío/EMVO a un API ambiente.
- Declaración: firmante/cargo/fecha/observaciones editables, generación V y PDF devuelto separado. Destrucción: gestor/evidencia editables; cerrar con destrucción necesita certificado/registro equivalente.
- Cierre requiere decisión, fecha, destino y trazabilidad/reconciliación Sí, además de evaluación aplicable y evidencia de destrucción cuando corresponde. No se añade eficacia CAPA ni cierre condicionado a Complaint/CAPA independientes. Expedientes cerrados siguen editables; nuevos seguimientos exigen activo abierto.
- La planificación se registra en ReturnFollowup, sin una segunda fecha en ReturnRecord. Un nuevo seguimiento de un expediente marcado como pendiente también necesita próxima fecha en UI/backend. La fecha vigente es la del último seguimiento cronológico, con desempate estable; no se interpreta un vencimiento antiguo como vencimiento actual.
- Alta desde Reclamación conserva tipo y código de origen durante la edición del Draft; el vínculo canónico se crea al abrir, sin enlace operativo prematuro ni duplicados.
- Relación única persistida COMPLAINT → RETURN; selector UUID real con navegación inversa. Alta/baja transaccional refresca snapshots de ambos módulos respetando versiones Complaint congeladas. Bloqueo Complaint antes de Return.
- Listado SQL: 25 por página, recuento filtrado, búsqueda código/cliente/país/motivo/destino/documento/origen/producto/lote, filtros existentes + seguimiento y Complaint. Review counts por lote; exportación simple usa los mismos filtros y excluye Draft. VI anual sigue alcance anual, una fila por producto, 13 columnas de fuente real, destino/trazabilidad en Seguimiento y control.

## Verificación

- Unitarios R4B: aplicabilidad API/medicamento/frío, aceptación distinta de stock, incompatibilidad NO/N/A, trazabilidad/destrucción, fechas reales y planificación conservada.
- PostgreSQL R4B: UUID/reordenación/propiedad/rollback, snapshots de ambos módulos, Complaint V00 congelado, Return técnico único, último seguimiento y 305 expedientes paginados.
- Navegador R4B: API multiproducto ambiente iniciado desde Reclamación y medicamento frío/serializado; borrador→apertura→seguimiento→evaluación→cierre, origen automático/selector UUID/navegación inversa, Review producto/seguimiento sin versión y deep link, retiro con snapshot del hilo intacto, rechazo stock NO y N/A válido, III/IV/V/VI, archivo histórico/checksum/ownership, PDF independientes/sustitución/bytes anteriores, anulación con históricos descargables, 1440/768/390 y timezone Madrid. Ejecutado con fuentes oficiales y también con fixtures en BD/servidor separados.
- Fixtures CI se identifican TEST y nunca son plantillas oficiales ni fallbacks de producción. QA local contrasta los binarios reales mediante R4B_OFFICIAL_TEMPLATES=1.
- Regresión: smokes existentes Devoluciones R2/R3, Reclamaciones R3/R4A, relaciones/codificación, Review R2C y Auditorías R3A/B/C; quality, typecheck y build.

Quality y typecheck locales correctos: 346 tests en 67 archivos, Prisma validate/generate, lint y build. Smokes PostgreSQL existentes y R4B correctos; regresiones de navegador R4A, Review R2C y Auditorías correctas. CI incorpora los dos smokes R4B y conserva toda la batería previa; el resultado del head se verifica en la PR antes de entregar.

## Pendientes

Revisión UX/UI transversal final: pulido visual global, fuera del alcance R4B. La aplicación V1 no implementa RBAC, e-signature, validación GMP formal ni automatización de plazos comerciales/EMVO; estas funciones no forman parte de R4B.
