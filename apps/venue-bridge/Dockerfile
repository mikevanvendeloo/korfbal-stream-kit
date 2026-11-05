# Venue-bridge: de app in de zaal die scorebord, schotklok, statistiek-pc en vMix met de Streamz API verbindt.
# Build with:  docker build -f apps/venue-bridge/Dockerfile .
# Or via Nx:   npx nx docker:build @korfbal-stream-kit/venue-bridge   (bouwt ook de statuspagina, apps/venue-bridge-ui)
#
# Base images zijn Docker Hardened Images (DHI) van dhi.io, zoals bij de API: eenmalig inloggen met
#   docker login dhi.io
# - *-dev varianten (shell, apk, npm) alleen in de build-stages
# - de runtime-variant heeft geen shell, geen package manager en draait als non-root
ARG NODE_DEV_IMAGE=dhi.io/node:24-alpine3.23-dev
ARG NODE_RUNTIME_IMAGE=dhi.io/node:24-alpine3.23

# STAGE 1: De Bouwer
FROM ${NODE_DEV_IMAGE} AS builder
USER root
ENV CI=true
WORKDIR /app
RUN npm i -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json ./
RUN pnpm install

COPY . .
RUN npx nx build venue-bridge --prod --verbose

# ----------------------------------------------------------------

# STAGE 2: Productie-dependencies (in de -dev image, want de runtime-image heeft geen npm/pnpm)
FROM ${NODE_DEV_IMAGE} AS prod-deps
USER root
ENV CI=true
WORKDIR /app
RUN npm i -g pnpm

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --prod

# Schrijfbaar pad voor de non-root runtime-user: de lokale kopie van de database (COPY_DIR)
RUN mkdir -p /writable/data

# ----------------------------------------------------------------

# STAGE 3: De Productie-Image (hardened runtime: geen shell, geen package manager)
FROM ${NODE_RUNTIME_IMAGE}

ARG APP_VERSION=0.0.0-dev
ENV APP_VERSION=${APP_VERSION}
# Vaste, numerieke non-root user zodat bestandsrechten op gemounte volumes voorspelbaar zijn
ARG APP_UID=1000

WORKDIR /app
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist/apps/venue-bridge .
COPY --from=prod-deps --chown=${APP_UID}:${APP_UID} /writable/data /data

ENV NODE_ENV=production \
    PORT=3340 \
    COPY_DIR=/data

USER ${APP_UID}:${APP_UID}
EXPOSE 3340
ENTRYPOINT []

# Geen shell in de runtime-image: de healthcheck is exec-form.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:' + (process.env.PORT || 3340) + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "main.js"]
