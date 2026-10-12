# Fase 4B2 — infraestructura, backup y recuperación

Base confirmada: `main` / `dc0f8f85fae988b40b52b4e471e0dc4a56adcee8`, integración de #139. Rama `feature/phase4b2-infrastructure-backup`; una PR, sin merge. Esta entrega prepara componentes y procedimientos reproducibles. No instala servicios corporativos, registra Entra, crea usuarios reales ni modifica bases habituales. Las alternativas son candidatas; sistema operativo, Docker, DNS, certificados, VPN y custodia requieren decisión de IT. No hay requisito de alojamiento Azure ni declaración de validación GMP.

## 1. Estado real revisado y límites del alcance

`compose.yaml` queda intacto: PostgreSQL de desarrollo, puerto publicado y credenciales ficticias. `next.config.ts` ya produce `standalone`, conserva el parche Next/React y las cabeceras de seguridad. `/api/health` ya ejecuta `SELECT 1`, devuelve 200/503 genérico y `no-store`; se reutiliza sin cambios. OIDC, cookies seguras, CSRF/Origin, revocación, permisos por operación y presentación de 4B1 se conservan íntegros.

`backup:export` exporta JSON de modelos en lecturas independientes; `backup:verify` comprueba estructura/recuentos y calcula un hash, sin restauración PostgreSQL ni cotejo de un manifiesto custodiado. Sigue siendo una herramienta de demostración. Los nuevos scripts usan `pg_dump`/`pg_restore` reales, una instantánea PostgreSQL exportada común al dump y al inventario, cifrado, autenticación, destinos nuevos y verificación completa.

No cambia ningún archivo `src/`, modelo Prisma, migración ni regla de los siete módulos. La CI conserva todos sus grupos y suites; añade `phase4b2:smoke` al grupo PostgreSQL, sin nuevo job ni compilación remota adicional.

## 2. Arquitectura propuesta

| Componente | Docker candidato | Linux sin Docker |
| --- | --- | --- |
| Aplicación | Node 22 LTS / imagen `standalone`, UID 10001 | Release `standalone`, Node 22 LTS y systemd |
| PostgreSQL | 16, volumen externo persistente, red interna, sin puerto host | Servicio PostgreSQL 16 independiente, interfaz local o red privada autorizada |
| Transporte BD | TLS, certificado con SAN del nombre de conexión | TLS y CA administrada por IT |
| Entrada | Nginx HTTPS, puerto 443 ligado a la IP aprobada | Nginx HTTPS; Node solo en `127.0.0.1:3000` |
| Identidad | Microsoft Entra OIDC existente | La misma implementación de 4B1 |
| Backup | Contenedor de herramientas ejecutado por scheduler de IT | Python 3.10+, OpenSSL 3, clientes PostgreSQL 16 y timer systemd |
| Recuperación | Servidor/cluster separado y artefactos/keys custodiados | Servidor/cluster separado y artefactos/keys custodiados |

No se escoge una plataforma definitiva. Un ordenador dedicado puede servir si IT acepta disponibilidad, soporte, UPS, almacenamiento, reinicio automático, cifrado y capacidad. No usar suspensión, sesión interactiva ni Docker Desktop como plataforma de operación regulada.

## 3. Requisitos del servidor y del sistema operativo

Propuesta inicial, pendiente de carga/documentos reales: mínimo candidato 4 vCPU, 8 GiB RAM; recomendado 8 vCPU, 16 GiB RAM y SSD. Separar capacidad para sistema/releases, PostgreSQL/WAL, temporales y backups. Dimensionar por datos y binarios existentes, crecimiento, índices, WAL, espacio de restauración y al menos dos releases; estos valores no sustituyen una prueba de carga ni garantizan RTO.

Linux mantenido por IT (por ejemplo Debian/Ubuntu/RHEL compatible), Node 22 LTS con parche vigente, PostgreSQL/clientes 16, Python 3.10+, OpenSSL 3, CA, Nginx y, si se escoge, Docker Engine/Compose v2. Restringir administración y acceso al socket Docker: equivale a privilegios de sistema. Mantener reloj/NTP, parches, protección del endpoint, cifrado de discos, UPS y reinicio tras fallo eléctrico. No se ha instalado systemd ni probado una VM corporativa.

Windows permanece pendiente: Node `standalone` y PostgreSQL pueden ejecutarse como servicios con un supervisor aprobado por IT, proxy/certificados y ACL NTFS; otra opción es una VM Linux supervisada sobre Windows Server. Los scripts Python usan comandos estándar, pero las garantías POSIX de permisos, unidades systemd y Docker Linux no prueban seguridad de NTFS, supervisión Windows ni recuperación corporativa. Hace falta ensayo y aceptación específicos antes de afirmar compatibilidad productiva.

## 4. Inventario documental y de almacenamiento

| Ubicación | Contenido que se recupera |
| --- | --- |
| `TemplateVersion.fileData` | Plantillas DOCX/XLSX conservadas, tamaño y checksum |
| `GeneratedDocument.fileData` | Documentos generados, relaciones a plantilla y versión, checksum |
| `RecordVersionDocument.fileData` | PDF firmados recibidos asociados a versión, bytes originales y hash |
| `ControlledRevisionDocument.fileData` | Objetos PNT/adjuntos/evidencias, SHA-256, referencia `postgres:UUID` |
| `AuditAnnualProgrammeVersion.fileData` | Programa anual congelado, snapshot, plantilla y bytes emitidos |
| Todas las tablas `public` | Siete módulos, relaciones, versiones/snapshots, cambios, revisiones, decisiones, catálogos, configuración, usuarios, roles, concesiones, autorizaciones e historial de acceso |
| `_prisma_migrations` | Identidad/checksums de migraciones, estructura y estado conservados |
| `TemplateVersion.filePath` y fallback de generadores | Archivo fuera de PostgreSQL: obligatorio capturarlo en raíces de assets aprobadas |
| `ControlledRevisionDocument.externalReference` | Solo URL/metadatos, **sin custodia del binario**; el informe cuenta las referencias no conservadas |
| Fuentes de importación, documentos descargados y archivos en SharePoint/otro destino | No forman parte automática de PostgreSQL; IT/QA deben inventariar custodias, versiones y backups del sistema externo |

Las raíces `assets` se inventarían por ruta relativa, tamaño y SHA-256, se archivan y se cifran. No se siguen symlinks ni archivos especiales. La copia falla si una plantilla por ruta no está capturada o si los assets cambian durante la copia. Usar releases/plantillas inmutables de solo lectura o una ventana de mantenimiento aprobada; la instantánea PostgreSQL no hace una instantánea transaccional de un filesystem externo.

No se descargan automáticamente URLs. El operador debe registrar la aceptación del límite `references-only-accepted`; esto no certifica conservación documental. Si QA requiere conservar esos binarios, debe definirse su custodia y copia externa antes de habilitar producción. Secrets, certificados privados, claves de cifrado y configuración operativa se recuperan desde la custodia independiente de IT, no desde Git ni desde el dump de roles PostgreSQL.

## 5. DNS, LAN/VPN, HTTPS y puertos

IT define DNS estable, IP/interfaz, certificado con cadena válida, CA de clientes y procedimiento de renovación. `quality.example.invalid` es exclusivamente un ejemplo inválido. El proxy mantiene Host y X-Forwarded-Host canónicos, fija HTTPS y reemplaza la cadena X-Forwarded-For del cliente. Rechaza Host distintos. No confiar en cabeceras aportadas directamente por usuarios ni permitir acceso directo a Node. Si existe otro balanceador/proxy, IT debe adaptar y probar la frontera de confianza expresamente.

Propuesta de firewall, sin rangos corporativos reales: usuarios LAN/VPN autorizados → proxy 443; proxy → Node interno 3000; aplicación/backup/migración → PostgreSQL TLS privado 5432; administrador → canales de gestión restringidos; salida necesaria a Entra HTTPS, DNS/NTP y servicios de custodia autorizados. PostgreSQL nunca publica puerto de usuarios en Compose. En nativo, escuchar en loopback si está en el mismo servidor o en una interfaz privada aprobada y aplicar firewall/`pg_hba.conf` revisados. La VPN y sus grupos se administran fuera de la app; no se habilita VPN desde este código.

Nginx conserva las cabeceras de Next y añade HSTS únicamente en HTTPS. No hay HTTP público, indexación, URL pública cloud ni activación de alertas externas. `/api/health` se bloquea en el proxy; monitorizarlo por loopback/red interna autorizada. Health comprueba conectividad, no migraciones, OIDC ni integridad funcional completa.

## 6. Entra y variables de entorno

IT configura tenant único, cliente confidencial, secreto rotatorio y redirects exactos `https://DNS/auth/callback` y `https://DNS/login`, con las políticas MFA/Conditional Access que apruebe. La app admite usuarios activos/autorizados; no registra automáticamente usuarios del tenant. No se cambia el protocolo OIDC ni se conecta a una aplicación Entra real en estas pruebas.

`ops/production.env.example` y `ops/compose.env.example` contienen solo valores ficticios. Producción exige `NODE_ENV=production`, `APP_ENV=production`, `ALLOW_DEMO_DATA=false`, `AUTH_PROVIDER=entra`, `AUTH_SYNTHETIC_IDENTITY=0`, HTTPS y ausencia de issuer sintético/demo documental. El wrapper deniega configuración incompleta, secretos ambiguos o legibles por grupo/otros y usuarios de BD privilegiados conocidos.

Secretos: `DATABASE_URL` y `AUTH_ENTRA_CLIENT_SECRET` desde EnvironmentFile privado o respectivos `*_FILE`. En Compose los archivos se montan como secrets: **Compose no es un vault y los UID/modes del bind real deben probarse**. Aplicación UID 10001, URL/secreto 0400/0600 legibles por ese UID; PostgreSQL comprueba clave privada 0600 con dueño compatible con su UID (verificar UID de la imagen aprobada). CA, certificados públicos y configuración HBA deben ser legibles por su proceso (por ejemplo 0644); esto no permite lectura pública de claves privadas. No usar `set -x`, secrets en argumentos, `docker inspect`/`compose config` con valores reales en logs ni compartir `.env`. El wrapper no imprime errores de conexión/configuración completos.

Prisma 6 emplea `sslmode=require&sslaccept=strict&sslcert=/ruta/ca.pem`; los clientes libpq del backup emplean `sslmode=verify-full` y `sslrootcert`. El certificado debe contener el DNS de conexión en SAN. No usar `accept_invalid_certs`, `sslmode=disable` ni desactivar TLS en producción. El wrapper exige la configuración TLS estricta de Prisma; la CA se monta en `/run/secrets/pg_ca_cert` en Docker. Estas comprobaciones de configuración no sustituyen probar la cadena/SAN con los certificados de IT.

`SERVER_ACTION_ALLOWED_ORIGINS` se resuelve en el **build**, no al cambiar el EnvironmentFile del runtime. Con el proxy canónico del mismo origen puede quedar vacío. Cualquier origen adicional requiere revisión y rebuild; no introducir comodines. Entra necesita salida HTTPS y confianza CA; un proxy de inspección corporativo requiere CA administrada, sin desactivar validación.

## 7. PostgreSQL, privilegios y migraciones

`ops/postgres/roles.sql` propone roles independientes: aplicación con DML necesario y sin ownership/DDL/TRUNCATE; migrador con ownership/DDL; backup solo lectura; recuperación restringida al cluster independiente y con CREATEDB. Contraseñas distintas suministradas por IT; no se generan ni incrustan credenciales conocidas. El SQL falla sobre roles existentes, de modo que el DBA revisa antes de adaptarlo. No hace bootstrap de usuarios Entra.

El DBA elimina grants PUBLIC innecesarios, comprueba tablas ya existentes y default privileges del **propietario real** de futuras migraciones. Revisar CONNECT, USAGE, secuencias, funciones y restricciones/trigger existentes. En un cluster restaurado, verificar ownership/grants antes de abrirlo: `--no-owner --no-acl` no reconstruye roles del cluster. Ningún superusuario o migrador se usa como identidad de la aplicación.

Producción: únicamente `pnpm db:deploy` en un proceso manual/controlado desde el checkout/imagen de herramientas del SHA aprobado. Nunca `db:push`, reset, seeds demo ni bootstrap automático. El runtime no ejecuta migraciones. Verificar historial/checksums, backup previo, conexiones/pool y ventanas. `DATABASE_URL` de migrador procede de su archivo privado; eliminarla del shell al terminar. El secreto de migración no entra en la imagen de aplicación.

No se altera el volumen existente ni se asume que cambiar `POSTGRES_PASSWORD_FILE` rota el password de una BD inicializada. Rotación SQL/secretos y reinicios se planifican expresamente por IT. Monitorizar conexiones, locks, autovacuum, tamaño, crecimiento, WAL y espacio libre.

## 8. Instalación Docker paso a paso

Solo después de aprobar Linux/Docker Engine, almacenamiento, DNS, PKI, Entra y acceso. Los comandos siguientes son un procedimiento para IT; no se ejecutan sobre infraestructura corporativa en esta entrega.

1. Obtener checkout del commit aprobado, comprobar CI integral y lock/parche, construir en un builder administrado y registrar SHA/digest de imagen. `docker build --build-arg RELEASE_SHA=SHA_APROBADO -f ops/Dockerfile -t covex-quality:SHA_APROBADO .`. Builder cloud con proxy: añadir `--secret id=proxy_ca,src=RUTA_CA_PUBLICA`; no se conserva esa CA de sesión en imagen. La imagen usa Node 22, dependencies congeladas, Prisma generado y build Next obligatorio.
2. Copiar configuraciones aprobadas a `/etc/covex` fuera de Git; preparar secrets/CA/TLS y assets readonly con UID/modes verificados. Sustituir referencias de imagen por digests aprobados para actualización controlada. El `.dockerignore` excluye secrets, `.env` reales, backups, datos, informes y originales GMP.
3. Crear **una vez**, por IT, el volumen durable de nombre aprobado; cifrado del disco, reserva y backup deben estar garantizados. Compose exige volumen externo, no lo crea silenciosamente. No usar `down -v`, `volume prune` ni recrear el volumen para resolver errores.
4. Renderizar/validar Compose en un canal privado con la configuración aprobada; arrancar solo `postgres`. Configurar certificado PostgreSQL, HBA y roles/grants por consola DBA (`docker exec --user postgres ... psql`), con `\password`/vault seguro; no poner passwords en argumentos.
5. Aplicar migraciones controladas con identidad de migrador desde builder/herramientas en la red privada. Puede construirse el target `build` del mismo Dockerfile y ejecutar `pnpm db:deploy` con un env-file privado en una tarea explícita de mantenimiento; no modificar CMD ni incluir el secreto en capas.
6. Arrancar `app` y `proxy` con `docker compose --env-file ARCHIVO_PRIVADO -f ops/compose.production.yaml up -d app proxy`. El bootstrap de acceso, si procede, sigue el procedimiento explícito de 4B1; no ocurre al arrancar.
7. Comprobar health interno, TLS/cadena/SAN, redirects/cookies, CSRF, consulta global, operaciones permitidas/denegadas y descarga autorizada con casos aceptados de IT/QA. Verificar que 5432/3000 no son alcanzables por usuarios. Reinicio del host/servicios, persistencia, supervisión y restauración deben ensayarse en el entorno definitivo.

`restart: unless-stopped` reinicia procesos que salen y actúa al reiniciar el daemon. Un estado Docker `unhealthy` **no** reinicia automáticamente el contenedor: el monitor y procedimiento de IT deben detectarlo y actuar. No añadir un reiniciador con acceso al socket sin evaluación.

## 9. Instalación Linux sin Docker

1. IT prepara cuentas de sistema separadas, paquetes/versiones, directorios, PostgreSQL/certificados/firewall y Nginx. No instalar dependencias como parte del arranque del servicio.
2. En builder/controlado del SHA aprobado: `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm quality`. Empaquetar `python3 ops/release.py --sha SHA_APROBADO --out /ruta/nueva/release`. Copia standalone, `.next/static` y, si existe, `public`, junto al wrapper y manifiesto de commit/version/lock/migraciones. Rechaza salida existente y SHA diferente al checkout.
3. Transferir/cotejar artefacto y manifiesto a `/opt/covex/releases/SHA`; enlazar assets aprobados como `templates` readonly y crear `.next/cache` escribible por `covex`. Las rutas de plantillas deben coincidir con los metadatos, evitando depender de archivos perdidos del builder.
4. Aplicar roles y migraciones por proceso DBA/migrador separado. Preparar `/etc/covex/production.env` privado. Establecer enlace `current` al release aprobado y adaptar/copiar `ops/systemd/covex-quality.service`. Supervisión no depende de sesión interactiva.
5. Renderizar `ops/nginx/covex.conf.template` con **solo** `COVEX_DNS` y `COVEX_UPSTREAM=127.0.0.1:3000` mediante envsubst con allowlist de esos nombres; preservar variables propias de Nginx como `$remote_addr`. Instalar certificados en la ruta configurada, ejecutar `nginx -t` y revisión antes de reload.
6. IT ejecuta `systemctl daemon-reload`, habilita/inicia el servicio aprobado y realiza las mismas comprobaciones de puesta en marcha de Docker. Adaptar journald/ACL y supervisión a su distribución. No se instalan ni habilitan estas unidades desde scripts del repositorio.

## 10. Backup completo consistente y automatizable

CLI: `python3 ops/backup/backup.py backup --config /etc/covex/backup.json`. Requiere clientes PostgreSQL 16, Python/OpenSSL y archivos privados; `ops/backup/Dockerfile` proporciona herramientas equivalentes para Docker. Ejecutar contenedor con configuración/keys/pgpass/CA/asset roots readonly, destino offsite aprobado escribible y `--tmpfs /work:mode=0700` para staging; configurar `temporary_directory=/work`. No montar socket Docker ni secretos de Entra en ese contenedor. En nativo, `/run/covex-backup` debe ser tmpfs o almacenamiento temporal cifrado controlado.

`pg_dump -Fc` usa snapshot exportado en una transacción read-only mantenida; el inventario utiliza el mismo snapshot. Cubre todas las tablas, restricciones, índices, funciones/trigger, secuencias y binarios. Se cotejan hashes de datos ordenados por tabla, estructura y hashes/tamaños binarios almacenados cuando existen. Identificar checksums históricos ausentes; el inventario conserva sus bytes sin atribuir retroactivamente validación documental.

El dump y tar de assets se cifran con OpenSSL AES-256-CBC, salt y PBKDF2 (600000 iteraciones). El manifiesto se autentica con HMAC-SHA256 usando **otra clave**, incluye SHA-256 de ambos ciphertexts, y se verifica antes de descifrar (encrypt-then-MAC). No utilizar CBC sin esa verificación. Dos claves aleatorias independientes, por ejemplo 32 bytes aleatorios codificados hexadecimal mediante el mecanismo seguro aprobado por IT, 0600, fuera de Git y respaldadas bajo custodia/recuperación independiente. Una clave perdida impide recuperar; una clave antigua debe conservarse mientras sus copias estén retenidas. Rotación por generaciones/configuraciones custodiadas, sin borrar claves anteriores.

Artefactos privados 0700/0600: `database.dump.enc`, `assets.tar.enc`, `manifest.json`, `manifest.mac`. Publicación por rename de un bundle completo en el mismo filesystem; fallos no generan bundle definitivo. El manifiesto puede contener nombres de assets/metadatos: también es material sensible, protegido por permisos/cifrado del destino. No subir bundles, informes, keys ni evidence con datos reales a GitHub.

## 11. Programación, retención y protección fuera del servidor

IT monta almacenamiento **fuera del servidor principal**, cifrado, con autenticación, autorización y disponibilidad verificadas; replica una copia independiente/offline o con versionado inmutable/WORM. El script no demuestra que una ruta montada sea offsite ni configura Object Lock. Copiar/custodiar manifiestos y MAC fuera del alcance de borrado del servidor y comprobarlos en la copia remota. El proceso de backup puede escribir nuevas copias; la eliminación remota exige identidad distinta/aprobación. Un servidor comprometido con acceso a ambas claves puede producir artefactos nuevos: la custodia inmutable externa es esencial para preservar copias anteriores.

`covex-backup.service` y `.timer` son ejemplos deshabilitados hasta autorización. La propuesta diaria 02:00 UTC está en el archivo, no es política aprobada. IT adapta OnCalendar, jitter y destino. Registra salida/exit code, último éxito y un fallo específico; `status_directory` mantiene **backup.json, verify.json y restore.json separados**, de modo que verificar/restaurar no sustituye el último estado de backup.

Retención configurable y manual: `... prune --config ... --keep NUMERO_APROBADO --older-than-days DIAS_APROBADOS --confirm approved-local-retention`. Conserva al menos dos bundles recientes y solo elimina bundles locales autenticados fuera de los límites aprobados. No equivale a política WORM/remota y no se programa automáticamente. Política histórica/GMP, hold legal y borrado deben aprobarse por QA/IT.

Propuestas para decisión, no objetivos fijados: full diario si se acepta RPO de hasta 24 h; 30 copias diarias y 12 mensuales como hipótesis de capacidad, con retención regulatoria aparte; RTO inicial a evaluar 4–8 h. Si se necesita RPO menor, pérdidas máximas de minutos o alto volumen, elegir y probar WAL/PITR antes de producción. La prueba pequeña de esta entrega no acredita esos RPO/RTO.

## 12. Opción WAL/PITR pendiente de decisión

Los dumps lógicos completos **no son incrementales ni permiten PITR**. `pgbackrest.conf.example` prepara una alternativa estándar full/differential/incremental + archivo WAL, con valores de retención, rol y data directory pendientes. IT suministra el secreto de repositorio por canal seguro, habilita `archive_mode`/`archive_command` aprobados y ensaya `stanza-create`, `check`, backup full/diff/incr y recuperaciones a tiempos concretos en un cluster independiente. Verificar continuidad WAL, timeline, cifrado y retención conjunta de base+WAL.

No se instala ni ejecuta pgBackRest ni se altera configuración PostgreSQL de producción en esta fase. Una restauración física requiere nueva ruta de datos/servidor aislado, revisión de recovery target y pausa, invalidación de sesiones/acceso y reconciliación. No reutilizar la configuración/ruta primaria para ejecutar `restore`. La aceptación de PITR, repositorio y métricas es una dependencia explícita si IT/QA seleccionan ese nivel de servicio.

## 13. Restauración real y contingencia

1. Aislar incidente y mantener acceso cerrado. Obtener bundle, **ambas claves**, CA, configuración aprobada, artefacto del SHA correcto y roles desde custodias independientes. `verify --config ... --bundle ...` autentica manifiesto/ciphertexts; no certifica por sí sola una restauración.
2. Preparar cluster PostgreSQL 16 independiente con rol de recuperación/CREATE DATABASE, sin acceso de usuarios, hosts aprobados y TLS verificado. Configurar source histórico como metadato: la restauración **no conecta al servidor original**.
3. Ejecutar `restore --config ... --bundle ... --target covex_restore_IDENTIFICADOR --confirm covex_restore_IDENTIFICADOR --assets-out /ruta/nueva/assets`. El nombre exige prefijo dedicado/confirmación exacta, el host debe estar aprobado y ser distinto del primary endpoint en producción; la BD y destino assets deben ser nuevos. Se rechazan bases habituales, existentes y nombres peligrosos. Nunca se usa `--clean`, DROP ni sobrescritura en el script operativo.
4. Tras autenticación/descifrado y validación de archive, crear BD vacía, restaurar con `--single-transaction --exit-on-error --no-owner --no-acl`, comparar todas las tablas/estructura y archivos contra el manifiesto. Una divergencia/error devuelve exit code no cero y estado failure. BD/directorio creados permanecen en cuarentena para diagnóstico; no se borran automáticamente. Reintentar con otro destino nuevo, no usar el destino parcial como aplicación.
5. Solo después de verificar igualdad, revocar todas las sesiones recuperadas y eliminar intentos OIDC pendientes, sin reescribir usuarios, permisos, cambios ni históricos de negocio. Reconciliar bajas/permisos y decisiones **posteriores al punto de backup** con IT/QA antes de abrir: el dump puede recuperar autorizaciones antiguas. No se reautoriza automáticamente a nadie.
6. DBA configura ownership/grants mínimos del cluster nuevo, reinstala/valida assets en rutas correctas, aplica secretos actuales desde vault y comprueba esquema contra release. Probar salud, nuevo login, sesión anterior rechazada, consulta global, operaciones permitidas/denegadas, descarga/hashes y documentos externos custodiados. Verificar UUID/recuentos/relaciones/versiones sin duplicaciones.
7. IT/QA registran evidencia técnica, reconciliación, punto recuperado y pérdida real/RPO/RTO; solo entonces autorizan apertura y cambio DNS/configuración. **Restauración técnica satisfactoria no significa recuperación corporativa aceptada**. Las referencias externas permanecen pendientes de la custodia del sistema externo.

Las pruebas usan nombres estrictos `covex_phase4b1_test_4b2_source_*` y `...restore_*` en loopback, para mantener la frontera sintética ya existente en 4B1. El único DROP está en el cleanup de su script de pruebas, limitado a nombres aleatorios que él creó; no existe en el CLI operativo.

## 14. Monitorización y logs

`ops/runtime/health.mjs` valida estado/servicio/BD y devuelve exit code sin imprimir cuerpos, URL ni excepciones. `ops/monitor.py` comprueba health interno, último backup exitoso/fresco, espacio, load average/memoria Linux y caducidad de certificado local con `openssl x509 -checkend`. Umbrales de edad, disco y certificado son parámetros del scheduler de IT; no se activa ningún envío externo.

Comprobar además estado supervisor/daemon/PostgreSQL, CPU/IO/conexiones/locks, espacio de data/WAL/backup, NTP, mounts, permisos y restauraciones periódicas. Ejemplo de llamada con parámetros aprobados: `python3 ops/monitor.py --backup-status /var/lib/covex-backup/backup.json --max-backup-age-seconds VALOR --disk /ruta/aprobada --min-free-bytes VALOR --certificate /ruta/fullchain.pem --min-cert-seconds VALOR`.

Compose rota logs locales (10 MiB × 3, propuesta técnica ajustable). Nginx desactiva access log para no conservar rutas/consultas de expedientes y reduce error verbosity. Configurar journald o colector aprobado, acceso restringido, cuotas y retención revisada por IT. No registrar SQL/params de negocio, passwords, tokens, cookies, Authorization, formularios ni cadenas de conexión. El wrapper de producción descarta los argumentos de console del framework/Prisma y emite solo nivel/evento/fecha; rechaza DEBUG y termina con un evento genérico ante errores fatales para que el supervisor reinicie. Backup/probes también emiten resultados genéricos. Esto limita deliberadamente el detalle diagnóstico: la investigación privada requiere herramientas y procedimientos autorizados. Revisar stderr nativo, logs del host/BD y colectores en el entorno definitivo; no activar debug de Prisma/OIDC. Monitorización técnica no es audit trail GMP.

## 15. Actualización, reversión y evidencia

Para cada release: registrar SHA/digest, version de app, checksums/migraciones, aprobación de configuración no secreta, fecha/responsable, CI y controles, backup previo verificado/restaurable y plan de recuperación. `release-manifest.json` identifica commit, versión, Node, lock y todas las migraciones SHA-256. El empaquetador exige SHA de checkout exacto; el builder Docker debe verificar el checkout antes de pasar el build arg.

Cerrar escrituras/ventana cuando proceda → backup previo → revisar y aplicar migraciones explícitas por migrador → desplegar imagen/release aprobado → health/OIDC/permisos/documentos → apertura autorizada. Conservar release y configuración anteriores; no usar `latest` ni auto-updaters. systemd: parar servicio, cambiar enlace `current` de forma controlada y arrancar. Docker: cambiar digest aprobado/recrear app, conservar DB/volumen. Reinicio/actualización de PostgreSQL requiere su propio procedimiento de backup/prueba.

Si falla aplicación con esquema compatible, volver al ejecutable/configuración anterior y probar. **Revertir ejecutable no revierte datos/migraciones**. Si cambió esquema o hubo escritura incompatible, decidir recuperación a nuevo cluster/bundle o forward fix autorizado, con pérdida/reconciliación explícitas. No ejecutar migraciones inversas inventadas ni reset.

`ops/deploy_record.py` genera evidence privado nuevo y falla si el esquema no coincide con las migraciones del release, faltan backup/aprobación/responsable o las comprobaciones no son correctas. Recibe JSON de schema (migration_name/checksum/finished/rolled_back), configuración aprobada **solo metadatos no secretos**, resultado de backup y checks health/OIDC/permissions/documents. `ops/postgres/schema-evidence.sql` obtiene los metadatos de migraciones sin sus logs ni datos de expedientes mediante `psql -XAt -f ops/postgres/schema-evidence.sql` con conexión privada. No acepta `.env` como metadata de configuración. Uso: `python3 ops/deploy_record.py --release release-manifest.json --schema schema.json --configuration approval.json --backup backup-result.json --checks checks.json --operator REFERENCIA --out /ruta/nueva/evidence.json`. Custodiar/revisar evidencia; no atribuirle firma GMP.

## 16. Checklist y decisiones para IT/QA

- [ ] Linux/Docker Engine, Linux nativo o evaluación Windows; VM/servidor/PC, soporte y responsable.
- [ ] Tamaño, discos/cifrado, UPS, NTP, reinicios, crecimiento y separación de entornos.
- [ ] DNS, IP/interfaz, LAN/VPN y grupos, firewall/puertos, salida Entra y proxies de confianza.
- [ ] CA/SAN/cadena/renovación HTTPS y PostgreSQL, supervisión de caducidad.
- [ ] Tenant/cliente, redirects, MFA/Conditional Access, vault/rotación y prueba de login corporativo.
- [ ] Usuarios DB independientes, ownership/default privileges, pool/conexiones y proceso de migración aprobado.
- [ ] Inventario de plantillas por ruta, imports/descargas y referencias externas; custodia fuera de PostgreSQL aceptada.
- [ ] RPO/RTO, full vs WAL/PITR, frecuencia, retención/hold, capacity y pruebas periódicas.
- [ ] Offsite cifrado y WORM/versionado/offline, identidad sin borrado, MAC/keys en custodia independiente y recuperación sin servidor original.
- [ ] Alertas técnicas por canales autorizados, logs/retención/ACL sin datos sensibles.
- [ ] Ensayo staging equivalente: instalación, restart/host reboot, pérdida primaria, restauración, reconciliación de permisos y rollback compatible.
- [ ] Acta IT/QA para apertura; requisitos de validación GMP/evolución 4B3 permanecen fuera de esta entrega.

## 17. Pruebas y evidencia técnica

`pnpm phase4b2:smoke`: contratos de despliegue/configuración, cifrado/HMAC y guardas adversarias, wrapper de producción y recuperación PostgreSQL 16 real en bases creadas desde todas las migraciones. Fixtures íntegramente ficticios, incluidos bytes PDF/DOCX/XLSX de prueba; no se leen ni incorporan originales GMP al backup de prueba.

La recuperación compara todas las tablas, columnas/restricciones/índices, IDs/recuentos, relaciones, dos snapshots por expediente, historial y las cinco familias binarias. Incluye plantilla local y referencia externa sin custodia, identidad de backup solo lectura con DDL/DML denegados, backup alterado rechazado antes de crear destino, destino habitual/existente rechazado, divergencia firmada sintética que produce fallo/cuarentena y recuperación con endpoint origen inaccesible. Arranca release standalone restaurado, comprueba health, revocación real de cookie antigua, nuevo OIDC, siete listados globales y baja de usuario efectiva; comprueba parada real.

Prueba adicional local de imagen/certificados ficticios: `python3 ops/test_container.py --image IMAGEN_CANDIDATA`. Reutiliza Compose y crea su propia pila/volumen, comprobando UID 10001, arranque de producción con TLS PostgreSQL, HTTPS/cabeceras, health interno, rechazo con CA incorrecta y logs sin secretos, reinicio supervisado y persistencia al eliminar/recrear contenedores. Se limpia exclusivamente esa pila ficticia. No se repite una compilación Docker en Actions; la CI mantiene sus 690 pruebas de referencia más las suites focalizadas y todas las regresiones. Resultado de este ensayo y SHA de entrega en la PR; no equivale a prueba de certificados corporativos ni reboot del servidor.

Resultados locales de preparación: `pnpm quality` correcto, 690 pruebas/95 archivos y build; 28 pruebas focalizadas (6 despliegue/evidencia/monitorización, 9 backup adversario, 13 configuración/logs de runtime) y recuperación PostgreSQL real correctas. Imágenes de aplicación y herramientas de backup compiladas y ejecutables sin privilegios; ensayo Docker/HTTPS/TLS/persistencia correcto con certificados ficticios. Se comprobaron Node 22.23.3 y clientes PostgreSQL 16 en contenedor. No se consideraron satisfactorios los intentos fallidos por dependencias/permisos o capacidad temporal: se corrigieron y se repitieron los ensayos. El gate/CI del commit final debe confirmar la entrega sobre el HEAD exacto de la PR.

Los clientes PG16 de pruebas pueden utilizar el servicio Docker sintético de CI mediante un adapter explícito que solo puentea stdin/archivos de herramientas reales. No modifica el CLI operativo ni introduce bypass de autenticación. Las bases/roles temporales se eliminan al finalizar. La suite entra en el gate por SHA sin acceder a red/datos corporativos; quality y todas las regresiones anteriores siguen obligatorias. Resultado definitivo y SHA final en Checks de la única PR.

## 18. Riesgos y aceptación pendiente

Probado en entorno aislado: migraciones desde cero, copia/restauración PostgreSQL16, cifrado/autenticación/detección de alteraciones, datos/documentos ficticios, standalone/OIDC y contratos de configuración. No se ha probado un tenant/certificado/VPN/storage corporativo, instalación systemd sobre host IT, reboot físico, WORM, Windows, PITR ni cargas/volúmenes/RPO/RTO reales. El contenedor/artefacto candidato no autoriza una instalación corporativa.

Una referencia externa no es un archivo conservado; un snapshot de BD no asegura consistencia de archivos que siguen escribiéndose; SHA-256 sin MAC/custodia no protege contra sustitución; un dump de BD no recupera por sí solo secretos/PKI/roles de cluster; permisos recuperados necesitan reconciliación; backups offsite accesibles con borrado desde el primario no protegen contra compromiso. Estos límites están expresamente en el checklist. El código sigue público, por lo que toda configuración/evidencia real permanece fuera del repositorio y de los artefactos públicos de CI.
