# CI #583 — R4B UI / PR #123

## Evidencia y causa

Los dos intentos de CI #583 sobre f9faeef05a944e078bbd12851cd1090a0f7ec703 superan los smokes PostgreSQL y quality (494 pruebas). El primero agota waitForURL tras pulsar Externas; el segundo, después de Crear plan externo. Sus logs originales no permiten conocer por sí solos todos los detalles del transporte.

El commit de diagnóstico 0eb81b0 y CI #584 conservan las pruebas y reproducen el segundo fallo. El POST contiene year=2091, auditType=EXTERNAL, título y actor correctos, y el mismo identificador de Server Action usado para crear el plan interno. La respuesta es HTTP 303, con x-action-redirect hacia el UUID del nuevo plan. El navegador permanece en /audits/plans. La validación y redirect del servidor funcionan; no es una ausencia de redirección HTTP ni un formulario incompleto.

La reproducción complementaria en producción (next build + next start) confirma también el filtro: clic real, raíz hidratada (isDehydrated=false, sin trabajo pendiente antes del clic), GET RSC del filtro HTTP 200 y cuerpo completo. La URL y aria-current mantienen el valor anterior; no es un falso timeout de Playwright. No hay errores de hidratación/JavaScript. Los eventos privados de React se inspeccionaron exclusivamente en QA, sin introducir dependencias de esos campos en el código funcional ni en la prueba de navegador.

La instrumentación del renderer identifica un aviso síncrono durante el renderizado de un chunk RSC en estado resolved_model: attachPingListener llama a .then y la inicialización del chunk resuelve inmediatamente la promesa. pingSuspendedRoot recibe executionContext=2 y RootSuspendedWithDelay=4. La rama de Next 15.5.26 evita prepareFreshStack durante el render, pero omite registrar workInProgressRootPingedLanes. markRootSuspended borra después el ping y deja las lanes suspendidas sin reintento. El estado del router y la promesa ya están resueltos, pero no se produce el commit. Es un fallo funcional intermitente del renderer compartido por navegación y Server Actions, expuesto por el smoke, no un fallo de datos ni exclusivamente una prueba inestable.

## Corrección limitada

Se incorpora mediante patchedDependencies de pnpm un parche ligado a next@15.5.26. Modifica únicamente la rama de pingSuspendedRoot en sus renderers normal de producción y desarrollo: cuando no se puede reiniciar el render activo, se registra el ping para conservar el reintento. Es la misma rama ya presente en react-dom@19.3.0 instalado; actualizar únicamente react-dom no corrige App Router, que utiliza el renderer compilado dentro de Next.

No cambian versiones de dependencias, rutas, enlaces, formularios, Server Actions, modelos, migraciones, plantillas ni reglas de Auditorías/PNT. No se añaden timers, reintentos de envío, recargas o saltos de navegación. Se descartaron loading.tsx de Auditorías y desactivar prefetch porque no eliminaban el fallo. El parche afecta al runtime App Router compartido: requiere las regresiones transversales del workflow y revisión al actualizar Next.

El smoke R4B mantiene todos sus recorridos, clicks, envíos y comprobaciones. Se conserva diagnóstico HTTP compacto en fallos y se exige que una respuesta 303 tenga el destino esperado, antes de esperar la navegación real. El reload posterior que ya existía en main no se añade ni sustituye la comprobación previa de redirección.

Dos pruebas ejecutan pingSuspendedRoot y markRootSuspended del renderer realmente instalado por Next, con una resolución durante render activo. Ambas fallan al retirar el parche y pasan al aplicarlo, protegiendo la causa concreta tanto en producción como en desarrollo.

## Validación previa a CI final

- Control del filtro con 12 páginas nuevas: el renderer sin corregir falla intermitentemente; el parche pasa 12/12 sin cambiar el clic o destino.
- 98 pruebas afectadas de Auditorías y regresión del renderer, 9 archivos, verdes.
- Build de producción y lint de los archivos de pruebas verdes.
- Smokes R4B y Programa Anual en PostgreSQL 16 nativo, y ambos recorridos completos en Chromium: verdes. Programa interno/externo, vista obsoleta, motivo, histórico y descargas, 1440/768/390.
- El almacenamiento overlay del entorno local produjo un error PostgreSQL XX000 de EOF; se repitió en un cluster aislado sobre tmpfs, sin silenciar el error ni cambiar la aplicación. La CI utiliza PostgreSQL 16 convencional.
- La CI completa se lanza en el commit que incorpora esta corrección; su resultado se informa en la PR/conversación sin editar de nuevo el head validado.

## Mantenimiento

Al cambiar la versión de Next, revisar su renderer integrado, retirar el parche solo cuando incluya esta corrección y conservar las dos regresiones y los smokes reales. No se hace merge ni squash.
