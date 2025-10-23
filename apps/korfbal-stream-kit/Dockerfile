# GEEN --platform=linux/amd64 nodig
FROM node:22 AS builder
ENV CI=true
WORKDIR /app

# Installeer pnpm in de image
RUN npm i -g pnpm

# Kopieer de pnpm-specifieke bestanden
COPY package.json pnpm-lock.yaml ./
COPY nx.json ./
# pnpm heeft de .npmrc nodig voor workspace settings
#COPY .npmrc .npmrc

# Draai de installatie met pnpm
RUN pnpm install

COPY . .
RUN npx nx build korfbal-stream-kit --prod
# ----------------------------------------------------------------

# STAGE 2: De Productie-Image
# Gebruik een lichtgewicht Nginx-server
FROM nginx:1.25-alpine

# Verwijder de default Nginx content
RUN rm -rf /usr/share/nginx/html/*

# Kopieer de gebouwde bestanden van de 'builder' stage
COPY --from=builder /app/dist/apps/korfbal-stream-kit /usr/share/nginx/html

# LET OP: Als je React Router gebruikt, moet je een nginx.conf
# bestand kopiëren om 404-fouten op subpagina's te voorkomen.
# Haal de commentaar-regels hieronder weg als dat zo is.
# COPY apps/korfbal-stream-kit/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
