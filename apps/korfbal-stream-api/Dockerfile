# Multi-stage Dockerfile that always builds from the latest sources
# Build with:  docker build -f apps/korfbal-stream-api/Dockerfile .
# Or via Nx:   npx nx docker:build @korfbal-stream-kit/korfbal-stream-api
# STAGE 1: De Bouwer
FROM node:22-alpine AS builder

ENV CI=true

WORKDIR /app

# Installeer pnpm globaal
RUN npm i -g pnpm

# Kopieer de package manifests
COPY package.json ./
COPY pnpm-lock.yaml ./
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
# We compileren de seed scripts naar CJS output.
RUN npx tsc apps/korfbal-stream-api/prisma/seed.ts apps/korfbal-stream-api/prisma/seed-data.ts \
    --outDir /app/dist-seed \
    --module commonjs \
    --target ES2020 \
    --esModuleInterop \
    --skipLibCheck \
    --rootDir apps/korfbal-stream-api/prisma

# ----------------------------------------------------------------

# STAGE 2: De Productie-Image
FROM node:22-alpine

# Accepteer APP_VERSION als build argument
ARG APP_VERSION=0.0.0-dev
# Zet het als environment variabele in de runtime container
ENV APP_VERSION=${APP_VERSION}

WORKDIR /app

# Installeer pnpm ook hier (nodig voor 'pnpm install --prod')
RUN npm i -g pnpm

# Kopieer package files voor productie-dependencies
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Installeer ALLEEN productie-dependencies
RUN pnpm install --prod

# Kopieer de gebouwde JS-code en het prisma-schema
COPY --from=builder /app/dist/apps/korfbal-stream-api .

# Kopieer prisma folder (schema + migrations) zodat prisma migrate/cli in de
# container kan draaien zonder de volledige source checkout.
COPY --from=builder /app/apps/korfbal-stream-api/prisma /app/apps/korfbal-stream-api/prisma

# Kopieer de getranspilede seed naar een vaste locatie in de image.
# Vanwege --rootDir apps/korfbal-stream-api/prisma staan seed.js en seed-data.js
# direct in /app/dist-seed.
RUN mkdir -p /app/seed
COPY --from=builder /app/dist-seed/seed.js /app/seed/seed.cjs
COPY --from=builder /app/dist-seed/seed-data.js /app/seed/seed-data.js

# Kopieer de JSON seed-data naar de locatie waar de seed scripts ze verwachten.
# In seed.ts wordt path.join(__dirname, 'seed-data/...') gebruikt.
# Dus kopieer apps/korfbal-stream-api/prisma/seed-data naar /app/seed/seed-data.
COPY --from=builder /app/apps/korfbal-stream-api/prisma/seed-data /app/seed/seed-data

# --- DE PRISMA FIX ---
# Genereer de Prisma Client *binnen* de definitieve container
RUN npx prisma generate

# Expose de poort van je API
EXPOSE 3333

# Start de applicatie
CMD ["node", "main.js"]
