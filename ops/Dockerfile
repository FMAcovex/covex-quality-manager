# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
# The optional CA is only for managed builders; never persisted in the image.
RUN --mount=type=secret,id=proxy_ca \
    export NODE_USE_ENV_PROXY=1; \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    pnpm install --frozen-lockfile
COPY . .
ARG RELEASE_SHA
RUN test -n "$RELEASE_SHA" && pnpm db:generate && pnpm build && \
    node ops/runtime/release-manifest.mjs "$RELEASE_SHA"

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
RUN groupadd --gid 10001 covex && useradd --uid 10001 --gid 10001 --no-create-home covex
COPY --from=build --chown=10001:10001 /app/.next/standalone ./
COPY --from=build --chown=10001:10001 /app/.next/static ./.next/static
COPY --from=build /app/release-manifest.json ./release-manifest.json
COPY ops/runtime ./ops/runtime
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["node", "ops/runtime/health.mjs", "http://127.0.0.1:3000/api/health"]
CMD ["node", "ops/runtime/start.mjs"]
