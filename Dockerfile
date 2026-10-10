# Modified by Applexus Technologies, 2026-10-10: AURA_COMMIT build arg, OCI labels, LICENSE and NOTICE in the image (AGPL-3.0)
# --- Base ---
FROM oven/bun:1.3.11-alpine AS base
WORKDIR /app

# --- Install ---
FROM base AS deps
COPY package.json bun.lock .npmrc ./
COPY patches/ patches/
COPY tools/ tools/
RUN bun install --frozen-lockfile

# --- Build ---
FROM base AS build
COPY --from=deps /app/node_modules node_modules
COPY . .
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
ARG AURA_COMMIT
ENV VITE_AURA_COMMIT=${AURA_COMMIT}
ENV NODE_ENV=production
RUN bun run build

# --- Production dependencies (patches applied, then devDeps stripped) ---
FROM base AS prod-deps
COPY package.json bun.lock .npmrc ./
COPY patches/ patches/
COPY tools/ tools/
RUN bun install --frozen-lockfile \
    && bun install --frozen-lockfile --production

# --- Runtime ---
FROM base AS runtime
ARG AURA_COMMIT
LABEL org.opencontainers.image.title="AURA Admin" \
      org.opencontainers.image.source="https://github.com/ortimusirig/aura-admin" \
      org.opencontainers.image.revision="${AURA_COMMIT}" \
      org.opencontainers.image.licenses="AGPL-3.0"
ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules node_modules
COPY --from=build /app/dist dist
COPY --from=build /app/src/server src/server
COPY --from=build /app/src/aura src/aura
COPY server.ts package.json LICENSE NOTICE ./

RUN chown -R bun:bun /app
USER bun

ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e "fetch(\`http://localhost:\${process.env.PORT}/health\`).then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"

EXPOSE 3000
CMD ["bun", "run", "start"]
