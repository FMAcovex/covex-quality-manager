export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.APP_ENV === "production") {
    const { authConfiguration } = await import("./lib/auth/config"); authConfiguration();
  }
}
