# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json tsup.config.ts ./
COPY src ./src
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM gcr.io/distroless/nodejs24-debian12:nonroot
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# HTTP inside the container. MCP_HTTP_TOKEN and CHARTED_SEA_TOKEN must be supplied at run time.
ENV NODE_ENV=production MCP_TRANSPORT=http MCP_HTTP_HOST=0.0.0.0 MCP_HTTP_PORT=3333
EXPOSE 3333
USER nonroot
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:3333/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["dist/bin.js"]
