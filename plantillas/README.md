# Plantillas oficiales (fuera de Git)

Copia aquí los ZIP de plantillas oficiales (por ejemplo `ANEXOS PARA APP.zip` y el de Auditorías),
el PNT de OOS y el `.docx` del programa anual interno. Se instalan solos:

- en la demo (`compose.demo.yaml`), al arrancar;
- en desarrollo o Codespaces, al arrancar la aplicación si `.env` tiene `TEMPLATE_INSTALL_DIR="plantillas"` (D-107);
- en cualquier momento, con `pnpm templates:install -- plantillas/`.

Cada archivo se reconoce por su huella SHA-256 y una versión ya instalada nunca se sustituye.
También se pueden subir desde Configuración → Versiones → «Instalar plantillas».

Nada de esta carpeta, salvo este archivo, se sube al repositorio (`.gitignore`).
