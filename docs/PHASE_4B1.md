# Fase 4B1 — identidad, sesiones y permisos

Implementación 4B1 para revisión. Base main `31dd148f45619d8f721ea690c932b0dd6831536c` (3B3 / #138 integrada). Rama `feature/phase4b1-entra-auth-rbac`; una PR, sin fusión ni despliegue corporativo. Las credenciales y la aceptación corporativas siguen pendientes de IT y QA/DT.

## Decisión aprobada y límites

Todos los usuarios activos y autorizados tienen lectura global de los siete módulos, sin restricciones departamentales de consulta ordinaria. DOWNLOAD, EXPORT, IMPORT y cada actuación requieren permisos propios. La escritura puede limitarse a departamentos o expedientes asignados. Las reglas de estado, editabilidad, eficacia, relaciones y documentos vigentes se siguen aplicando después de autorizar.

Los seis perfiles iniciales son categorías configurables; las atribuciones operativas deben aceptarse por QA/DT antes de uso real. El administrador técnico no hereda revisión, cierre ni capacidades documentales GMP. No se crean identidades reales, nuevas aprobaciones ni firmas; no se atribuye identidad corporativa retroactiva a los históricos.

## Inventario previo

El inventario versionado `src/lib/auth/operation-inventory.json` enumera las Server Actions, métodos API y páginas actuales. Su revisión exige mantener cobertura cuando se incorpora una entrada nueva. Las capacidades se verifican en el servidor, con el principal de la sesión; ocultar botones no constituye autorización.

| Módulo | Consulta | Mutaciones existentes a proteger | Documentos/otras operaciones |
| --- | --- | --- | --- |
| Desviaciones | expedientes, indicadores, versiones, Review | alta, edición, seguimiento, cierre, relaciones, anulación | anexos, PDF recibido, descargas y exportación |
| CAPA | expedientes, indicadores, eficacia, versiones, Review | alta, edición, seguimiento/eficacia/cierre, relaciones, anulación | anexos, PDF recibido, descargas y exportación |
| Cambios | solicitud/dictamen/seguimientos, indicadores e históricos | alta, edición, seguimientos, cierre y relaciones | anexos, PDF recibido, descargas y exportación |
| Reclamaciones | expedientes, indicadores, versiones e históricos | alta, edición/nueva versión, relaciones y anulación | anexos, PDF recibido, descargas y exportación |
| Devoluciones | expedientes, productos, indicadores e históricos | alta, edición, seguimiento, relaciones y anulación | anexos por producto, PDF, descargas y exportación |
| Auditorías | auditorías, hallazgos, planes, versiones y Review | alta/edición, hallazgos/acciones/seguimiento, atribuciones, cierre | emisión de informe/programa, adjuntos, PDF y descargas |
| PNT | maestros, revisiones y consulta histórica global | borradores, conciliación/importación y ciclo documental existente | custodia, verificación/evidencia externa, activación/retirada/rectificación, descarga/exportación |

Administración funcional exige MANAGE_CONFIGURATION según módulo; administración de identidades exige MANAGE_USERS y no concede facultades de negocio. Relaciones y actuaciones que afectan a más de un expediente deben respetar el ámbito de todos los extremos modificados. Alta/edición que solicite cierre requiere CLOSE además de su permiso ordinario. Las operaciones documentales PNT conservan capacidades diferenciadas.

## Arquitectura implementada

`openid-client` 6.8.8 implementa Authorization Code/PKCE S256. Se activa expresamente su comprobación criptográfica de firma del ID token (`enableNonRepudiationChecks`), además de emisor, audiencia, caducidad, state y nonce. El tenant es único, el emisor se construye desde su GUID y la identificación estable es `tid` + `oid`, nunca correo o nombre. No se implementa un validador JWT propio. Biblioteca mantenida compatible con Node 22 de CI, Next 15.5.26 y React 19; se conserva el parche Next/React de 3B3.

El registro local requiere usuario activo y admitido previamente. No hay registro automático del tenant. El flujo pendiente vive cinco minutos en PostgreSQL y se consume una sola vez. La sesión opaca aleatoria de 256 bits tiene TTL absoluto de ocho horas y caduca tras treinta minutos sin actividad; en base solo se almacenan hashes del token y de CSRF. Cada entrada relee admisión y políticas, sin permisos confiados al navegador. Las bajas/cambios administrativos revocan sesiones. El logout POST revoca la sesión actual, borra cookies y solicita cierre Entra; la revocación local funciona aunque el proveedor no esté disponible.

En configuración corporativa las cookies usan `__Host-`, Secure, Path=/, SameSite=Lax y HttpOnly para sesión/flujo. CSRF es accesible al cliente, ligado al hash de la sesión y acompañado de Origin exacto. Está en el HTML inicial de los formularios y en las cabeceras de las API de escritura. Review transmite su CSRF explícito y lo elimina antes de validar datos de negocio. Referrer-Policy `same-origin` conserva Origin en formularios nativos sin enviar Referer a destinos externos.

El proveedor sintético queda limitado a APP_ENV=test, indicador explícito, PostgreSQL loopback y nombre `covex_phase4b1_test_*` (o servicio desechable `covex_quality` exclusivamente dentro de GitHub Actions/CI). Proveedor y origen deben estar en loopback. Produce JWT firmados con claves efímeras, discovery/JWKS y códigos de un solo uso; la aplicación recorre el mismo protocolo OIDC. Producción rechaza configuración incompleta o modo sintético al registrar el runtime y en cada operación protegida. No hay cuenta por defecto ni bypass HTTP administrativo.

Fuentes: [openid-client](https://github.com/panva/openid-client), [flujo Microsoft](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [claims estables](https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation).

## Modelo y matriz efectiva

La migración `20261012000100_phase4b1_identity` crea AuthUser, AuthRole/Permission, asignaciones de rol/departamento/expediente, AuthSession, AuthLoginAttempt y AuthAuthorizationChange. Los GUID de identidad son inmutables también mediante trigger PostgreSQL. No actualiza datos históricos. Las columnas nullable de autor autenticado se añaden a doce tablas de eventos/documentos/versiones, conservando NULL en todo registro anterior.

| Perfil inicial | READ siete módulos | Derechos iniciales adicionales en instalación corporativa | Política operativa |
| --- | --- | --- | --- |
| Administrador técnico | Global si está admitido | SYSTEM READ / MANAGE_USERS, solo mediante bootstrap explícito | Sin derechos GMP automáticos; rol técnico reservado |
| Garantía de Calidad | Global si está admitido | Ninguno automático | Propuesta configurable por módulo; pendiente QA/DT |
| Director Técnico | Global si está admitido | Ninguno automático | Propuesta configurable por módulo; pendiente QA/DT |
| Responsable departamental | Global si está admitido | Ninguno automático | Actuaciones ASSIGNED a departamento/expediente, pendientes QA/DT |
| Usuario operativo | Global si está admitido | Ninguno automático | Actuaciones expresas, pendientes QA/DT |
| Usuario de consulta | Global si está admitido | Ninguno automático | DOWNLOAD/EXPORT se conceden por separado cuando corresponda |

READ ordinario de los siete módulos es una regla aprobada de admisión, independiente de departamento/roles. SYSTEM no hereda esta consulta. Las concesiones de escritura usan ALL o ASSIGNED: para ASSIGNED debe coincidir el expediente canónico o todos los departamentos afectados. Sin ámbito reconocido se deniega; las operaciones masivas y la administración requieren ALL.

Se implementan los doce permisos solicitados y ATTACH_DOCUMENT, GENERATE_DOCUMENT, AUDIT_ISSUE_REPORT, AUDIT_ISSUE_PROGRAMME y PNT_VERIFY/RECORD_APPROVAL/ACCEPT_APPROVAL/ACTIVATE/RETIRE/CORRECT/LEGACY_REGISTER/MANAGE_STATE. Son capacidades de operaciones existentes, no nuevas aprobaciones ni firmas. CLOSE y ANNUL se verifican también al solicitar esos estados dentro de edición/seguimiento. En relaciones se comprueban los dos extremos, incluidos los resueltos dentro de la transacción.

`/settings/users` permite admisión, baja, perfiles, departamentos y expedientes, además de propuestas de política y consulta de historial administrativo. MANAGE_USERS se verifica en servidor. La identidad estable no es editable; no se permite cambiar autorizaciones propias ni la política del rol técnico. Cambiar una política elimina su aceptación y revoca sesiones de los usuarios afectados. Las concesiones operativas no son efectivas hasta registrar aceptación administrativa QA/DT mediante la herramienta offline controlada. No es una aprobación electrónica GMP.

## Frontera de servidor y autoría

El inventario contiene 71 Server Actions, 48 métodos API/auth y 52 páginas. Solo health y los extremos de inicio/callback OIDC son públicos; callback valida el protocolo y la admisión antes de emitir sesión. Logout/perfil son operaciones sobre la sesión propia. Un test AST exige que toda nueva entrada quede inventariada y use su frontera correspondiente.

Las páginas autorizan antes de consultar datos. API/acciones verifican identidad, CSRF cuando procede, módulo/operación y expediente autoritativo, y después ejecutan las validaciones funcionales existentes. Descargas conservan comprobaciones de ownership y bytes originales. Las respuestas API protegidas son privadas y no cacheables. Una redirección Next con streaming puede responder HTTP 200: las pruebas verifican además redirección a login y ausencia de contenido de negocio.

FormData y parámetros no pueden sustituir al actor de sesión. Se conserva responsable de negocio, participante o firmante externo. La extensión Prisma añade el UUID estable y etiqueta autenticada únicamente al crear eventos/versiones/documentos, incluyendo upsert.create y el mensaje inicial de Review. No reatribuye históricos ni modifica snapshots/documentos emitidos. El historial sigue siendo operativo, sin declaración de audit trail GMP validado.

PNT obtiene identidad y capacidades de la sesión, incluyendo ámbito. Las cabeceras `x-pnt-*` no conceden acceso corporativo. Las variantes puras antiguas se conservan únicamente para sus fixtures unitarios explícitos; las regresiones de navegador tras reinicio usan usuarios OIDC de lectura, escritura documental y capacidades separadas, además de accesos anónimos.

## Pruebas y CI

`pnpm quality` mantiene Prisma validate/generate, ESLint, todas las pruebas y build. Se conservan las 536 pruebas de referencia; el total inicial 4B1 es 688. `phase4b1:smoke` añade OIDC real simulado, firma/emisor/audiencia/tenant/state/nonce/caducidad/replay, admisión y bajas, sesión opaca, CSRF/logout, cambios de permisos durante sesión, autoría estable, integridad de snapshots y escenarios de consulta/escritura en los siete módulos. También comprueba administración propia denegada y políticas pendientes sin actuación.

La CI conserva los cinco grupos y todas sus suites 3B3. Cada base se migra desde cero, se configura con identidades sintéticas explícitas y arranca su proveedor loopback. El grupo PostgreSQL también consume el build único verificado por SHA para ejecutar la nueva regresión HTTP de identidad. No se omiten smokes ni se eliminan aserciones de estado/snapshot/documentos para obtener verde. `QMS final gate` exige fixtures y suite de seguridad además de toda la evidencia anterior sobre el mismo HEAD. La evidencia definitiva de la entrega es Checks y artefactos del gate de la PR, sobre su commit final.

Solo se han utilizado bases nuevas de pruebas. No se ha migrado la base habitual ni una corporativa, ni se han creado cuentas reales, registrado aplicaciones Entra o desplegado servidores. Valores de fixtures son públicos/ficticios; claves del proveedor son efímeras. No se incorporan credenciales operativas, tokens ni datos de empleados al repositorio.

## Configuración posterior con IT

1. Confirmar servidor privado/VM, DNS y HTTPS, proxy de confianza, entorno de producción y origen canónico. Entra no requiere alojamiento Azure. Infraestructura, backups y validación posteriores no se implantan en 4B1.
2. Registrar por IT una aplicación web de tenant único, con redirect HTTPS `<origen>/auth/callback` y logout `<origen>/login`, permisos OIDC openid/profile/email; no se requiere Graph para este bloque. Configurar asignación empresarial, MFA y Conditional Access de la organización.
3. Gestionar fuera de Git AUTH_PROVIDER=entra, AUTH_ORIGIN, AUTH_ENTRA_TENANT_ID, AUTH_ENTRA_CLIENT_ID, AUTH_ENTRA_CLIENT_SECRET y DATABASE_URL; APP_ENV=production y AUTH_SYNTHETIC_IDENTITY=0. SERVER_ACTION_ALLOWED_ORIGINS debe contener solo el host corporativo correspondiente cuando el proxy lo requiera. No usar cabeceras PNT como identidad.
4. Revisar/aplicar la migración aditiva sobre copia corporativa cualificada antes de cualquier producción. El bootstrap **no se ejecuta automáticamente** por startup, seed, migración ni HTTP. Un operador IT autorizado suministra explícitamente oid, nombre/correo, motivo y confirmación `IT_AUTHORIZED_INITIAL_ADMIN` a `scripts/auth-provision.ts bootstrap`; solo admite registro de identidad vacío y concede gestión de acceso, nunca operaciones GMP.
5. Admitir usuarios individualmente y proponer sus políticas en administración. Tras aceptación externa documentada de QA/DT, un operador autorizado registra referencia/motivo y confirmación `QA_DT_ACCEPTED_POLICY` con `auth-provision.ts accept-role-policy`. La aceptación propia del administrador está bloqueada. Cualquier cambio posterior de política requiere nueva aceptación.
6. Ensayar con tenant corporativo los accesos admitidos/denegados, MFA/CA, HTTPS/cookies, Origin detrás del proxy, caducidad y baja/revocación, permisos y lectura global; registrar aceptación QA/DT/IT antes de uso real.

Las confirmaciones offline deben suministrarse por un procedimiento IT controlado, con permisos OS/DB y evidencia de la aceptación externa. No sustituyen verificación de una firma ni una aprobación GMP. No ejecutar esos comandos con cuentas reales durante esta fase.

## Decisiones pendientes y límites

QA/DT deben aprobar las atribuciones definitivas, ámbitos, descarga/exportación y segregación operativa de cada perfil. IT debe confirmar TTL/idle, política de sesiones simultáneas, administración inicial, custodia/rotación de secretos y procedimiento de baja. Desactivar una cuenta en Entra no revoca por sí solo una sesión local ya emitida: el procedimiento combina revocación local y caducidad; no se implementa Graph/CAE en este bloque. El funcionamiento con tenant/URL/MFA corporativos requiere prueba posterior de IT.

La aplicación web requiere JavaScript para sus flujos interactivos; el campo CSRF está además en los formularios iniciales. Se mantienen los avisos y controles funcionales existentes; una actuación sin permiso falla cerrada en servidor, aunque la navegación a un formulario sea posible. Alertas automáticas, infraestructura corporativa/backup (4B2), audit trail/firma/validación GMP (4B3) siguen fuera de alcance.
