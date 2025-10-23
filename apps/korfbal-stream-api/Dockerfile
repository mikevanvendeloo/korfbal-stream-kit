# Multi-stage Dockerfile that always builds from the latest sources
# Build with:  docker build -f apps/korfbal-stream-api/Dockerfile .
# Or via Nx:   npx nx docker:build @korfbal-stream-kit/korfbal-stream-api
# STAGE 1: De Bouwer
FROM node:22 AS builder

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

# ----------------------------------------------------------------

# STAGE 2: De Productie-Image
FROM node:22

WORKDIR /app

# Installeer pnpm ook hier (nodig voor 'pnpm install --prod')
RUN npm i -g pnpm

# Kopieer ALLEEN de slanke package.json uit de dist-map
COPY --from=builder /app/package.json ./package.json

# Installeer ALLEEN productie-dependencies
RUN pnpm install --prod

# Kopieer de gebouwde JS-code en het prisma-schema
COPY --from=builder /app/dist/apps/korfbal-stream-api .

# --- DE PRISMA FIX ---
# Genereer de Prisma Client *binnen* de definitieve container
RUN npx prisma generate

# Expose de poort van je API
EXPOSE 3333

# Start de applicatie
CMD ["node", "main.js"]
