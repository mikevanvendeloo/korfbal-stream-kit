# Base images zijn Docker Hardened Images (DHI) van dhi.io. Daarvoor eerst eenmalig inloggen met je
# Docker Hub-account:  docker login dhi.io
# - de -dev variant (shell, npm) alleen in de build-stage
# - de nginx runtime-variant heeft geen shell en draait als non-root (luistert daarom op 8080)
ARG NODE_DEV_IMAGE=dhi.io/node:24-alpine3.23-dev
ARG NGINX_RUNTIME_IMAGE=dhi.io/nginx:1.31-alpine3.24

FROM ${NODE_DEV_IMAGE} AS builder
USER root
ENV CI=true
WORKDIR /app

# Accepteer APP_VERSION als build argument
ARG APP_VERSION=0.0.0-dev
# Zet het als environment variabele voor de build (Vite gebruikt dit)
ENV VITE_APP_VERSION=${APP_VERSION}

# Installeer pnpm in de image
RUN npm i -g pnpm

# Kopieer de pnpm-specifieke bestanden
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY nx.json ./

# Draai de installatie met pnpm
RUN pnpm install

COPY . .
RUN pnpm nx build korfbal-stream-kit --prod
# ----------------------------------------------------------------

# STAGE 2: De Productie-Image (hardened nginx: geen shell, non-root)
FROM ${NGINX_RUNTIME_IMAGE}

# Eigen hoofdconfig (pid/logs/includes) + de server-config met React Router- en API-proxyregels
COPY apps/korfbal-stream-kit/nginx.main.conf /etc/nginx/nginx.conf
COPY apps/korfbal-stream-kit/nginx.conf /etc/nginx/conf.d/default.conf

# Kopieer de gebouwde bestanden van de 'builder' stage
COPY --from=builder /app/dist/apps/korfbal-stream-kit /usr/share/nginx/html

# Build-time check (exec-form, er is geen shell): faalt de build bij een ongeldige nginx-config
RUN ["nginx", "-t", "-c", "/etc/nginx/nginx.conf"]

EXPOSE 8080

ENTRYPOINT []
CMD ["nginx", "-c", "/etc/nginx/nginx.conf", "-g", "daemon off;"]
