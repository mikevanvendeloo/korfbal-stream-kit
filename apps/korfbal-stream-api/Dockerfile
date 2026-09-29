# Multi-stage Dockerfile that always builds from the latest sources
# Build with:  docker build -f apps/korfbal-stream-api/Dockerfile .
# Or via Nx:   npx nx docker:build @korfbal-stream-kit/korfbal-stream-api
#
# Base images zijn Docker Hardened Images (DHI) van dhi.io. Daarvoor eerst eenmalig inloggen met je
# Docker Hub-account:  docker login dhi.io
# - *-dev varianten (shell, apk, npm) alleen in de build-stages
# - de runtime-variant heeft geen shell, geen package manager en draait als non-root
ARG NODE_DEV_IMAGE=dhi.io/node:24-alpine3.23-dev
ARG NODE_RUNTIME_IMAGE=dhi.io/node:24-alpine3.23

# STAGE 1: De Bouwer
FROM ${NODE_DEV_IMAGE} AS builder
USER root

ENV CI=true

WORKDIR /app

# Installeer pnpm globaal
RUN npm i -g pnpm

# Kopieer de package manifests
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY nx.json ./
COPY apps/korfbal-stream-api/.swcrc ./

# Installeer alle dependencies
RUN pnpm install

# Kopieer de rest van de broncode
COPY . .

# Bouw de API.
RUN npx prisma generate
RUN npx nx build korfbal-stream-api --prod --verbose

# Transpile Prisma seed (TypeScript) naar JavaScript zodat de runtime-image
# zonder ts-node/tsx kan seeden.
# We compileren de seed scripts naar CJS output. rootDir is de API-app, want seed.ts importeert
# ook services uit src/ (o.a. src/services/season.ts): output in dist-seed/prisma en dist-seed/src.
RUN npx tsc apps/korfbal-stream-api/prisma/seed.ts apps/korfbal-stream-api/prisma/seed-data.ts \
    --outDir /app/dist-seed \
    --module commonjs \
    --target ES2020 \
    --esModuleInterop \
    --skipLibCheck \
    --rootDir apps/korfbal-stream-api

# ----------------------------------------------------------------

# STAGE 2: Productie-dependencies (in de -dev image, want de runtime-image heeft geen npm/pnpm)
FROM ${NODE_DEV_IMAGE} AS prod-deps
USER root
ENV CI=true
WORKDIR /app

# OpenSSL is nodig voor de Prisma-engines (linux-musl-openssl-3.0.x)
RUN apk add --no-cache openssl

RUN npm i -g pnpm

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Installeer ALLEEN productie-dependencies
RUN pnpm install --prod

# Genereer de Prisma Client voor dit platform
COPY --from=builder /app/apps/korfbal-stream-api/prisma/schema.prisma ./prisma/schema.prisma
RUN pnpm exec prisma generate --schema=./prisma/schema.prisma

# Zet de Prisma-engines + OpenSSL-libs op een vaste plek: de runtime-image heeft geen shell,
# waardoor Prisma zijn platform (openssl-versie) daar niet zelf kan detecteren.
COPY apps/korfbal-stream-api/docker/collect-prisma-runtime.cjs /tmp/collect-prisma-runtime.cjs
RUN node /tmp/collect-prisma-runtime.cjs /prisma-runtime

# Schrijfbare paden voor de non-root runtime-user (storage/uploads als er geen volume gemount is,
# en error.log van winston in de werkmap)
RUN mkdir -p /writable/storage /writable/uploads && touch /writable/error.log

# ----------------------------------------------------------------

# STAGE 3: De Productie-Image (hardened runtime: geen shell, geen package manager)
FROM ${NODE_RUNTIME_IMAGE}

# Accepteer APP_VERSION als build argument
ARG APP_VERSION=0.0.0-dev
# Zet het als environment variabele in de runtime container
ENV APP_VERSION=${APP_VERSION}

# Vaste, numerieke non-root user zodat bestandsrechten voorspelbaar zijn (ook op gemounte volumes)
ARG APP_UID=1000

ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/prisma-runtime/libquery_engine.so.node \
    PRISMA_SCHEMA_ENGINE_BINARY=/app/prisma-runtime/schema-engine \
    LD_LIBRARY_PATH=/app/prisma-runtime/lib

WORKDIR /app

# Productie-dependencies (incl. gegenereerde Prisma Client) en de Prisma-engines
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /prisma-runtime ./prisma-runtime

# Kopieer de gebouwde JS-code en het prisma-schema
COPY --from=builder /app/dist/apps/korfbal-stream-api .

# Kopieer prisma folder (schema + migrations) zodat prisma migrate in de
# container kan draaien zonder de volledige source checkout.
COPY --from=builder /app/apps/korfbal-stream-api/prisma /app/apps/korfbal-stream-api/prisma

# Kopieer de getranspilede seed (prisma/seed.js + de services uit src/ die hij importeert) naar
# /app/seed; de onderlinge relatieve imports (../src/services/...) blijven zo kloppen.
COPY --from=builder /app/dist-seed /app/seed

# Kopieer de JSON seed-data naar de locatie waar de seed scripts ze verwachten.
# In seed.ts wordt path.join(__dirname, 'seed-data/...') gebruikt.
COPY --from=builder /app/apps/korfbal-stream-api/prisma/seed-data /app/seed/prisma/seed-data

# Migratie + seed zonder shell (gebruikt door de migrate-job in docker-compose)
COPY apps/korfbal-stream-api/docker/migrate-and-seed.cjs /app/seed/migrate-and-seed.cjs

# Schrijfbare paden voor de runtime-user
COPY --from=prod-deps --chown=${APP_UID}:${APP_UID} /writable/ /app/

# Build-time check (exec-form, er is geen shell): faalt de build als de Prisma-engines hun
# libraries in deze image niet kunnen laden.
RUN ["node", "-e", "require(process.env.PRISMA_QUERY_ENGINE_LIBRARY)"]
RUN ["/app/prisma-runtime/schema-engine", "--version"]

USER ${APP_UID}:${APP_UID}

# Expose de poort van je API
EXPOSE 3333

# Leeg entrypoint: CMD (en `command:` in docker-compose) wordt letterlijk uitgevoerd,
# ongeacht het entrypoint van de base-image
ENTRYPOINT []

# Start de applicatie
CMD ["node", "main.js"]
