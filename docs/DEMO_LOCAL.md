# Demo local de COVEX Quality Manager

Guía para ver y probar la aplicación **en tu propio ordenador**, con datos ficticios, antes de ponerla en funcionamiento. No necesita IT, Entra ni servidor: todo se ejecuta en tu equipo y solo es accesible desde él (D-087).

> **No es un entorno validado ni de producción.** No introduzcas datos reales. El audit trail GMP no está activado en la demo y el inicio de sesión es con perfiles de demostración, no con tu cuenta corporativa.

## Qué necesitas

- Un ordenador con Windows 10/11 (o Mac) con permisos para instalar programas.
- **Docker Desktop**: <https://www.docker.com/products/docker-desktop/>. Es gratuito para uso personal y para empresas pequeñas. Las empresas de más de 250 empleados o más de 10 millones de dólares de facturación necesitan una suscripción de pago: si es el caso de COVEX, consúltalo con IT.
- Unos 5 GB libres de disco.

## Primera vez

1. **Instala Docker Desktop** y ábrelo. En Windows te pedirá activar WSL 2 y reiniciar: acepta. Espera a que el icono de la ballena indique que Docker está en marcha.
2. **Descarga la aplicación**: en GitHub, en la página del repositorio, pulsa **Code → Download ZIP**. Descomprime el ZIP en una carpeta sencilla, por ejemplo `C:\covex-demo`.
3. **Plantillas oficiales (opcional)**: para probar la generación de anexos Word y Excel, copia en la carpeta `plantillas` que hay dentro de la aplicación tus ZIP de plantillas (por ejemplo `ANEXOS PARA APP.zip` y el de Auditorías) y el PNT de OOS `GC-10-014-04 (15-06-2025) EN REDACCION.docx` corregido. La demo reconoce cada archivo por su huella SHA-256, aunque cambie de nombre, e ignora el resto. Sin plantillas, la demo funciona igual, pero no genera documentos.
4. **Abre una terminal en la carpeta**: en el Explorador de Windows, entra en la carpeta de la aplicación, escribe `powershell` en la barra de direcciones y pulsa Intro.
5. **Arranca la demo** con este comando:

   ```
   docker compose -f compose.demo.yaml up --build
   ```

   La primera vez tarda varios minutos (descarga e instala todo). Cuando veas el mensaje **«Demo lista: abre http://localhost:3000 en el navegador»**, ya está.
6. **Abre <http://localhost:3000>** en el navegador y elige un perfil.

## Perfiles de demostración

| Perfil | Qué puede hacer |
|---|---|
| Garantía de Calidad | Todos los permisos de los siete módulos y la configuración |
| Responsable de departamento | Crear, editar y hacer seguimiento en los expedientes de su departamento (GC-00) |
| Consulta | Consultar y descargar, sin modificar nada |
| Administrador técnico | Usuarios y roles, sin modificar expedientes |

Para cambiar de perfil, pulsa **Cerrar sesión** arriba a la derecha y elige otro.

## Uso diario

- **Parar la demo**: pulsa `Ctrl + C` en la terminal, o ejecuta `docker compose -f compose.demo.yaml down`.
- **Volver a arrancarla**: `docker compose -f compose.demo.yaml up`. Los datos que hayas creado se conservan.
- **Empezar de cero** (borra todo lo creado en la demo): `docker compose -f compose.demo.yaml down -v` y vuelve a arrancarla.
- **Actualizar a una versión nueva**: descarga de nuevo el ZIP, descomprímelo y arranca con `up --build`.

## Qué incluye y qué no

- Incluye los siete módulos con un expediente ficticio de ejemplo en cada uno (código `DEMO-…`), catálogos, el buscador, la cronología, las vistas guardadas y la configuración de usuarios y roles.
- No incluye: inicio de sesión con Microsoft, audit trail GMP activo, envío de correos ni datos reales.
- La aplicación solo escucha en `localhost`: nadie de la red puede entrar en tu demo.

## Si algo falla

| Problema | Qué hacer |
|---|---|
| `docker` no se reconoce | Abre Docker Desktop y espera a que arranque; cierra y vuelve a abrir la terminal |
| «port is already allocated» con el 3000 | Otra aplicación usa el puerto 3000: ciérrala, o cambia `127.0.0.1:3000:3000` por `127.0.0.1:3001:3000` en `compose.demo.yaml` y usa <http://localhost:3001> (cambia también `AUTH_ORIGIN` a `http://localhost:3001`) |
| Docker pide activar la virtualización | Debe activarse en la BIOS del equipo; consúltalo con IT |
| Errores de descarga detrás del proxy de la empresa | Configura el proxy en Docker Desktop → Settings → Resources → Proxies |
| No se generan anexos Word | Copia el ZIP de plantillas en `plantillas` y vuelve a arrancar la demo |

## Para desarrolladores

La demo se compone de `compose.demo.yaml`, `ops/demo/Dockerfile` y `ops/demo/start.sh`. Este último aplica las migraciones, carga catálogos (`db:seed`), datos ficticios (`demo:seed`), usuarios de demostración (`demo:users`) y, si hay archivos en `plantillas`, las plantillas controladas con el instalador único `scripts/install-templates.ts` (D-099). El modo demo solo se activa con `APP_ENV=demo`, `AUTH_PROVIDER=demo`, la base `covex_demo` y un origen `http://localhost` (`localDemoEnvironment` en `src/lib/auth/config.ts`). La imagen de producción (`ops/Dockerfile`) y su arranque exigen Entra y lo rechazan.
