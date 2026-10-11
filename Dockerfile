# syntax=docker/dockerfile:1

# ── Etapa de construcción ──────────────────────────────────────────────────────
FROM node:22-bookworm AS build

# python3/make/g++/unixodbc-dev sólo se usan si pnpm autoriza la compilación del
# módulo nativo msnodesqlv8. Con DB_AUTH=sql el módulo nunca se carga, así que
# su ausencia no impide ejecutar la aplicación en contenedor.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ unixodbc-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10

WORKDIR /app

# Manifestos primero para aprovechar la caché de capas en `pnpm install`.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# ── Etapa de ejecución ─────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

# unixodbc por si alguien configura DB_AUTH=windows (msnodesqlv8); con
# DB_AUTH=sql no es imprescindible. ca-certificates mantiene verificable TLS.
RUN apt-get update \
    && apt-get install -y --no-install-recommends unixodbc ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Misma ruta /app que en la etapa de construcción: conserva los enlaces de
# pnpm dentro de node_modules. La configuración llega por compose, no por .env.
WORKDIR /app
COPY --from=build --chown=node:node /app /app
# Bit de ejecución del entrypoint sin depender de BuildKit (--chmod).
RUN chmod +x /app/deploy/docker-entrypoint.sh

USER node
EXPOSE 3000

ENTRYPOINT ["/app/deploy/docker-entrypoint.sh"]
