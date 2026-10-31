# Cómo se actualiza la aplicación (D-131)

Cómo llega un cambio a la aplicación en uso, sin perder datos y con Calidad al tanto. Es un resumen para IT y Calidad. Los comandos técnicos detallados están en [PHASE_4B2.md](PHASE_4B2.md), §8, §9, §10, §13 y §15.

**Límites.** La aplicación no está validada para uso GMP. Este procedimiento no sustituye al control de cambios de sistemas informatizados de COVEX, que debe definir QA. Hasta entonces, cada actualización queda registrada en la PR, las notas de versión y la evidencia de despliegue. El entorno de **preproducción** está pendiente de que IT lo prepare.

## Quién hace qué

| Paso | Quién | Resultado |
|---|---|---|
| 1. Cambio | Desarrollo | PR con pruebas, CI en verde y revisión independiente (AGENTS.md) |
| 2. Versión | Desarrollo; Calidad revisa las notas | Número de versión, notas y `pnpm release:check` correcto |
| 3. Preproducción | IT instala; Calidad prueba | Visto bueno de Calidad a la versión |
| 4. Producción | IT, en una ventana avisada | Versión instalada, comprobada y registrada |
| 5. Aviso | Calidad | Usuarios informados («Novedades», al pie de cada página) |

## 1. Cambio

Cada cambio se hace en una rama y se fusiona en `main` por PR, con:
- CI en verde;
- revisión independiente;
- documentación actualizada.

Fusionar en `main` **no** instala nada en producción: `main` es la siguiente versión en preparación.

## 2. Preparar la versión

El número es `MAYOR.MENOR.CORRECCIÓN` (en `package.json`):
- **CORRECCIÓN** (0.2.0 → 0.2.1): arreglos sin cambios en la base de datos.
- **MENOR** (0.2.1 → 0.3.0): novedades, o cualquier cambio en la base de datos (migraciones).
- **MAYOR**: cambios que obligan a reorganizar el trabajo o los datos. La versión que IT y QA acepten para la puesta en marcha será la 1.0.0. Hasta entonces, 0.x.

Pasos:
1. Subir el número en `package.json` y escribir las notas en `src/lib/release/release-notes.ts`: resumen, novedades, correcciones, qué deben hacer Calidad o IT y si cambia la base de datos. Se escriben para los usuarios, sin jerga técnica. **Calidad revisa las notas en la PR.**
2. Ejecutar `pnpm release:check`. Compara con la entrega anterior (la última etiqueta `vX.Y.Z`) y falla si:
   - la versión no sube;
   - faltan las notas;
   - hay migraciones nuevas que las notas no declaran;
   - con migraciones, solo sube la corrección.

   Muestra el resumen para IT: versión, commit, migraciones nuevas y lo que hay que hacer.
3. Fusionar y etiquetar el commit de `main` como `vX.Y.Z`. Esa etiqueta es la que se instala.

## 3. Preproducción

Un entorno igual que producción (mismo sistema, PostgreSQL 16, configuración y plantillas oficiales), separado de ella. IT decide si usa una copia restaurada de producción (PHASE_4B2 §13, siempre en un servidor separado) o datos ficticios.

1. IT instala la versión etiquetada como en producción (pasos 4.3 a 4.5).
2. IT o desarrollo ejecuta la **verificación de los anexos** con las plantillas oficiales (`pnpm annexes:verify`, [ANNEX_VERIFICATION.md](ANNEX_VERIFICATION.md)), en su base de datos desechable. Tiene que salir sin fallos.
3. Calidad prueba lo que dicen las notas de versión y, como mínimo:
   - abrir, guardar y cerrar un expediente de cada módulo afectado;
   - descargar sus anexos;
   - comprobar que los permisos siguen como estaban.

   Para las plantillas nuevas se usa «Probar» ([GUIA_PLANTILLAS_CALIDAD.md](GUIA_PLANTILLAS_CALIDAD.md)).
4. Calidad da su visto bueno, o devuelve la versión con lo que ha fallado. Con un fallo, se corrige en una versión nueva y se vuelve a empezar desde el paso 2.

## 4. Producción

1. **Avisar** a los usuarios de la ventana y cerrar el acceso durante la actualización.
2. **Copia de seguridad previa**, verificada (`python3 ops/backup/backup.py backup …`, PHASE_4B2 §10). Sin copia verificada no se sigue.
3. **Base de datos:** si las notas dicen que cambia, aplicar las migraciones con el usuario de migraciones (`pnpm db:deploy`, PHASE_4B2 §7). Nunca `db:push` ni `migrate reset`.
4. **Instalar** la versión etiquetada. Con Docker, la imagen del commit. Sin Docker, el paquete de `ops/release.py`. Hay que conservar la versión y la configuración anteriores.
5. **Comprobar**:
   - estado (`/api/health`);
   - inicio de sesión;
   - consulta;
   - una operación permitida y una denegada;
   - la descarga de un anexo;
   - que el pie de la página muestra la versión nueva.
6. **Registrar** la evidencia (`ops/deploy_record.py`, PHASE_4B2 §15): versión, commit, migraciones, copia previa, comprobaciones y responsable. Se custodia fuera del repositorio.
7. **Abrir** el acceso.

## 5. Avisar

Calidad avisa a los usuarios. Las novedades se pueden leer en la propia aplicación: enlace «Novedades» al pie de cada página. Si las notas piden algo (por ejemplo, conceder un permiso o activar una plantilla), se hace ahora.

## Si algo sale mal

- **Antes de abrir el acceso:** volver a la versión anterior, que se conserva. Si la versión nueva no cambiaba la base de datos, basta con eso.
- **Si cambiaba la base de datos:** volver a la versión anterior no deshace las migraciones. IT decide con QA si:
  - se corrige con una versión nueva;
  - o se recupera la copia previa en un servidor nuevo (PHASE_4B2 §13), y se reconcilia lo que se haya hecho después.

  No se inventan migraciones inversas.
- **Con el acceso ya abierto:** se abre una incidencia. Si el fallo afecta a expedientes o anexos ya generados, se trata como indique QA.

## Correcciones urgentes

Siguen los mismos pasos, normalmente como CORRECCIÓN y sin cambios en la base de datos. La preproducción se puede limitar a lo corregido y a la verificación de los anexos, si Calidad lo acepta.
