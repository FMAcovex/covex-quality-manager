# syntax=docker/dockerfile:1
# Imagen de la DEMO LOCAL (D-087): datos ficticios, acceso con perfiles de demo y
# sin Entra. No es la imagen de producción (ops/Dockerfile) ni sirve para ella.
# La imagen completa de Node ya incluye OpenSSL 3, que necesita Prisma.
FROM node:22-bookworm
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
# El certificado opcional solo sirve para constructores detrás de un proxy corporativo.
RUN --mount=type=secret,id=proxy_ca \
    export NODE_USE_ENV_PROXY=1; \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    pnpm install --frozen-lockfile
COPY . .
ENV APP_ENV=demo AUTH_PROVIDER=demo NEXT_TELEMETRY_DISABLED=1
RUN pnpm db:generate && pnpm build
EXPOSE 3000
CMD ["sh", "ops/demo/start.sh"]
