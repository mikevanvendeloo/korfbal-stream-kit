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

# Bouw de API. De Prisma Client (en de model-metadata voor de tenant-scope) wordt gegenereerd naar
# apps/korfbal-stream-api/src/generated en meegebundeld in main.js; Prisma 7 heeft geen query-engine meer.
RUN npx prisma generate
RUN npx nx build korfbal-stream-api --prod --verbose

# Bundel de Prisma seed (TypeScript) tot een enkel CJS-bestand zodat de runtime-image zonder ts-node/tsx
# kan seeden. De seed importeert de gegenereerde client en services uit src/ (via tsconfig-paden): die gaan
# mee in de bundel, npm-packages blijven extern (zitten in node_modules van de runtime-image).
RUN npx esbuild apps/korfbal-stream-api/prisma/seed.ts \
    --bundle --platform=node --format=cjs --target=node20 --packages=external \
    --tsconfig=apps/korfbal-stream-api/tsconfig.json \
    --outfile=/app/dist-seed/prisma/seed.js

# ----------------------------------------------------------------

# STAGE 2: Productie-dependencies (in de -dev image, want de runtime-image heeft geen npm/pnpm)
FROM ${NODE_DEV_IMAGE} AS prod-deps
USER root
ENV CI=true
WORKDIR /app

# OpenSSL is nodig voor de Prisma schema-engine (linux-musl-openssl-3.0.x)
RUN apk add --no-cache openssl

RUN npm i -g pnpm

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Installeer ALLEEN productie-dependencies
RUN pnpm install --prod

# Zet de Prisma schema-engine (voor `prisma migrate deploy`) + OpenSSL-libs op een vaste plek: de
# runtime-image heeft geen shell, waardoor Prisma zijn platform (openssl-versie) daar niet zelf kan detecteren.
# De query-engine bestaat in Prisma 7 niet meer: de API praat via de pg driver adapter met PostgreSQL.
COPY apps/korfbal-stream-api/docker/collect-prisma-runtime.cjs /tmp/collect-prisma-runtime.cjs
RUN node /tmp/collect-prisma-runtime.cjs /prisma-runtime

# Schrijfbare paden voor de non-root runtime-user (storage/uploads als er geen volume gemount is,
# en logs/ voor de foutlog per dag)
RUN mkdir -p /writable/storage /writable/uploads /writable/logs

# ----------------------------------------------------------------

# STAGE 3: De Productie-Image (hardened runtime: geen shell, geen package manager)
FROM ${NODE_RUNTIME_IMAGE}

# Accepteer APP_VERSION als build argument
ARG APP_VERSION=0.0.0-dev
# Zet het als environment variabele in de runtime container
ENV APP_VERSION=${APP_VERSION}

# Vaste, numerieke non-root user zodat bestandsrechten voorspelbaar zijn (ook op gemounte volumes)
ARG APP_UID=1000

ENV PRISMA_SCHEMA_ENGINE_BINARY=/app/prisma-runtime/schema-engine \
    LD_LIBRARY_PATH=/app/prisma-runtime/lib

WORKDIR /app

# Productie-dependencies (o.a. @prisma/client runtime, de pg driver adapter en de prisma CLI voor de
# migrate-job) en de Prisma schema-engine
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /prisma-runtime ./prisma-runtime

# Kopieer de gebouwde JS-code en het prisma-schema
COPY --from=builder /app/dist/apps/korfbal-stream-api .

# Kopieer prisma folder (schema + migrations) en prisma.config.ts (schema, migrations, DATABASE_URL uit de
# omgeving) zodat prisma migrate in de container kan draaien zonder de volledige source checkout.
COPY --from=builder /app/apps/korfbal-stream-api/prisma /app/apps/korfbal-stream-api/prisma
COPY --from=builder /app/prisma.config.ts /app/prisma.config.ts

# Kopieer de gebundelde seed (prisma/seed.js) naar /app/seed.
COPY --from=builder /app/dist-seed /app/seed

# De standaardset (sjablonen, posities, skills) zit als TypeScript in src/standardSet en wordt
# met de seed mee gebundeld; er is geen losse JSON seed-data meer.

# Migratie + seed zonder shell (gebruikt door de migrate-job in docker-compose)
COPY apps/korfbal-stream-api/docker/migrate-and-seed.cjs /app/seed/migrate-and-seed.cjs

# Schrijfbare paden voor de runtime-user
COPY --from=prod-deps --chown=${APP_UID}:${APP_UID} /writable/ /app/

# Build-time check (exec-form, er is geen shell): faalt de build als de Prisma schema-engine zijn
# libraries in deze image niet kan laden.
RUN ["/app/prisma-runtime/schema-engine", "--version"]

USER ${APP_UID}:${APP_UID}

# Expose de poort van je API
EXPOSE 3333

# Leeg entrypoint: CMD (en `command:` in docker-compose) wordt letterlijk uitgevoerd,
# ongeacht het entrypoint van de base-image
ENTRYPOINT []

# Start de applicatie
CMD ["node", "main.js"]
