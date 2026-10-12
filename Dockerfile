# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# SQL authentication uses the pure-JS driver. The Windows ODBC addon is not built.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production APP_ENV=production HOST=0.0.0.0 PORT=3000 DB_AUTH=sql
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json index.html ./
COPY --chown=node:node server ./server
COPY --chown=node:node assets ./assets
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node database ./database
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD ["node", "scripts/docker-healthcheck.js"]
CMD ["node", "server/index.js"]
