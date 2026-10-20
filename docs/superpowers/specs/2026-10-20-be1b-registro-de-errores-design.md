# BE1-B — Registro de errores con referencia visible

**Fecha:** 2026-10-20. **Backlog:** BE1, segunda de tres entregas (A → B → C). **Estado:** diseño aprobado en conversación; pendiente de revisión de esta especificación.

## 1. Propósito y criterios de éxito

Cuando algo falla en el servidor, el usuario recibe un código de referencia e IT puede encontrar ese fallo en el registro del servidor con ese código. El registro es **operativo**: no es el audit trail, ni el historial, ni una evidencia GMP.

Decisiones del responsable de Calidad:

- Lo consulta **IT en el servidor**: líneas JSON en la salida estándar, que se recogen con docker/journald o el colector que IT apruebe. Sin tabla ni pantalla en la aplicación.
- El usuario se identifica **solo por su identificador interno** (UUID), sin nombre ni correo.
- Sin librerías nuevas ni cambios de base de datos.

Éxito:

- Todo error no controlado que llega a la página de error deja una línea en el registro con `ref` igual a la «Referencia técnica» que se muestra.
- Todo fallo inesperado al guardar (la rama genérica de `persistenceFormError`) deja una línea y muestra «Referencia para IT: E-xxxxxxxx».
- Los `catch` que hoy ocultan fallos reales del servidor dejan una línea.
- Ninguna línea contiene datos de negocio, textos de formulario, mensajes de error, SQL, cookies, tokens ni nombres o correos.

## 2. Situación de partida

- **Arranque de producción (4B2).** `ops/runtime/logging.mjs` (`installSafeLogging`) sustituye todos los métodos de `console` por una línea fija `{service, event: "server-message", level, at}` sin contenido, para no filtrar consultas, formularios o tokens (`docs/PHASE_4B2.md` §14).
  - Consecuencia: en producción la «Referencia técnica» que muestra `src/app/error.tsx` (el `digest` de Next.js) no aparece en ningún registro.
- **`persistenceFormError`** (`src/lib/forms/persistence-error.ts`, 19 usos) convierte los errores no previstos en «error inesperado de persistencia», sin registro ni referencia.
- **Guardas comunes.** `authorizedAction` y `authorizedRoute` solo tratan los errores de acceso y propagan el resto, que llega a Next.js.
- **`catch` vacíos.** Hay 68 bloques `catch` vacíos o que descartan el error. Muchos son legítimos (entrada mal formada que se trata como vacía, almacenamiento del navegador).
- **Página de error.** `src/app/error.tsx` escribe el error en la consola del navegador del usuario.

## 3. Diseño

### 3.1 Registrador común (`src/lib/log/server-log.ts`)

`logServerError(event: string, error: unknown, context?: { ref?: string; operation?: string; module?: string }): string`:

- **Salida.** Escribe una línea con `process.stdout.write` y no con `console`, para no pasar por el envoltorio de producción. Devuelve la `ref` usada.
- **Campos fijos:**
  - `service: "covex-quality-manager"`, `event`, `level: "error"`, `at` (ISO), como en el formato de 4B2;
  - `ref`: la recibida o una nueva `E-` + 8 hexadecimales aleatorios;
  - `operation` y `module` (nombre técnico de la acción o ruta y módulo), si se conocen;
  - `userId`: el UUID del usuario de la sesión (`currentIdentity()?.principal.id`), o `null`. Sin nombre ni correo;
  - `errorName`: nombre de la clase (`Error`, `PrismaClientKnownRequestError`…);
  - `prismaCode` y `prismaModel`: solo para errores conocidos de Prisma (`code` y `meta.modelName`);
  - `frames`: hasta 10 líneas `at …` de la traza, sin la primera línea, que repite el mensaje.
- **Lo que nunca se escribe:** el mensaje del error, `cause`, `meta` completo, argumentos, cuerpos de petición, cabeceras, cookies, SQL ni valores de formulario.
- **Robustez.** Nunca lanza: si no puede serializar, emite una línea mínima con `event` y `ref`.
- **Pruebas.** El formato es una función pura (`serverErrorLine`) para poder probarlo.

### 3.2 Errores no controlados (`onRequestError`)

- `src/instrumentation.ts` exporta `onRequestError(error, request, context)`. Next.js la llama para los errores de componentes de servidor, acciones y rutas.
- Registra `logServerError("request.unhandled", error, { ref: error.digest, operation: context.routePath })`. La `ref` es la misma «Referencia técnica» que ve el usuario.
- No registra la URL completa ni la consulta, solo `routePath`, que es la plantilla de ruta (p. ej. `/deviations/[id]`).
- `src/app/error.tsx` deja de escribir el error en la consola del navegador. La página no cambia.

### 3.3 Fallos inesperados al guardar

- La rama genérica de `persistenceFormError` llama a `logServerError("action.persistence", error, { module })`.
- Añade la referencia al mensaje visible: «Se ha producido un error inesperado de persistencia. Los datos no se han guardado. Revisa los campos e inténtalo de nuevo. Referencia para IT: E-xxxxxxxx.»
- *Ajuste tras la revisión final:* la referencia va en el mensaje principal (`error`: «No se ha podido guardar … Referencia para IT: E-xxxxxxxx.»), porque los formularios de seguimiento y las acciones de Auditorías solo muestran ese campo.
- Las ramas esperadas no se registran: motivo de cambio crítico, duplicado (P2002), relación inexistente (P2003), registro inexistente (P2025) y validación de Prisma.

### 3.4 `catch` que ocultan fallos

- Se revisan los 68 uno por uno, con el criterio «¿descarta un fallo del servidor que IT necesitaría ver?».
  - **Sí** (lectura o escritura de base de datos, ficheros, plantillas, importación, sesión o identidad): `logServerError("<módulo>.<operación>", error)` y el mismo comportamiento visible de antes.
  - **No** (`JSON.parse` de entrada del usuario, fechas mal formadas, almacenamiento del navegador, `navigator.clipboard`): se dejan como están, con un comentario breve si no lo tienen.
- La clasificación de cada caso queda en el registro del plan.
- **Código de cliente:** los componentes `"use client"` no importan el registrador, porque es solo de servidor.

### 3.5 Lo que no cambia

Pantallas, textos (salvo la referencia añadida en §3.3), permisos, audit trail, historial, `installSafeLogging` (sigue silenciando `console`), esquema y migraciones.

## 4. Pruebas

- **Unitarias** (`src/lib/log/server-log.test.ts`):
  - `serverErrorLine` produce JSON con los campos fijos;
  - no contiene el mensaje del error, el `cause` ni el `meta` de Prisma, aunque los mensajes incluyan valores ficticios reconocibles;
  - recorta a 10 frames;
  - la `ref` generada sigue `^E-[0-9a-f]{8}$`;
  - no lanza con valores raros (`null`, cadenas, objetos circulares).
- **`persistenceFormError`:** la rama genérica devuelve la referencia en el mensaje y escribe una línea con la misma `ref`; las ramas esperadas no escriben nada.
- **`onRequestError`:** prueba unitaria con un error con `digest`, que deja una línea con `ref` = `digest`, `event: "request.unhandled"` y `operation` = `routePath`, sin la URL con consulta.
- **Smoke de servidor (`be1b:smoke`, grupo `browser-qms`):**
  - arranca la build con la salida estándar capturada;
  - provoca un error no controlado con un expediente inexistente en una acción que propaga el error, o con una ruta de prueba solo para test si no existe ninguna;
  - comprueba que la referencia visible en la página aparece como `ref` en el registro.
- **Regresión:** suites unitarias, PostgreSQL y navegador completas; lint, tsc y build.

## 5. Documentación

- **`docs/DECISIONS.md`, D-113:** registro operativo de errores, campos, exclusiones, referencia visible y relación con el envoltorio seguro de 4B2.
- **`docs/PHASE_4B2.md` §14:** cómo localizar una referencia, por ejemplo `docker compose logs app | grep '"ref":"E-7f3a9c2b"'` o `journalctl -u covex-quality | grep …`, y qué significa cada campo.
- **`docs/CURRENT_STATUS.md`, `docs/V1_BASELINE_AND_BACKLOG.md` y `docs/ROADMAP.md`:** BE1-B hecho; BE1-C pendiente.

## 6. Entrega

Una PR con CI verde y fusión según la autorización vigente del responsable. Rollback: revertir la PR; no hay migraciones ni datos.
