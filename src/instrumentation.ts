export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.APP_ENV === "production") {
    const { authConfiguration } = await import("./lib/auth/config"); authConfiguration();
  }
  // D-107: instala al arrancar las plantillas que IT deje en la carpeta del servidor. No retrasa el
  // arranque y un fallo no lo detiene: las plantillas se pueden subir después desde Configuración.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.TEMPLATE_INSTALL_DIR) {
    const directory = process.env.TEMPLATE_INSTALL_DIR;
    void import("./modules/configuration/template-autoinstall")
      .then(async ({ autoInstallSummary, installTemplatesFromDirectory }) => console.info(autoInstallSummary(await installTemplatesFromDirectory(directory))))
      .catch(() => console.error("Plantillas: no se han podido instalar al arrancar; súbelas en Configuración → Versiones."));
  }
}

/** BE1-B (D-113): todo error no controlado deja una línea en el registro con la referencia visible. */
export async function onRequestError(error: unknown, request: { path: string; method: string }, context: { routePath: string; routeType: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { handleRequestError } = await import("./lib/log/request-error");
  handleRequestError(error, request, context);
}
