import "server-only";
import packageJson from "../../../package.json";

/** D-131: versión de la aplicación (package.json). Solo en el servidor, para no enviar package.json al navegador. */
export const appVersion: string = packageJson.version;
