# Build stage
FROM node:20-alpine AS deps
WORKDIR /app

# Only install root deps to build the workspace
COPY package*.json nx.json tsconfig*.json ./
COPY apps/korfbal-stream-api/package*.json apps/korfbal-stream-api/
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client
RUN npm run prisma:generate

# Build the API
RUN npm run api:build

# Runtime stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy only the dist and necessary files
COPY --from=deps /app/dist/apps/korfbal-stream-api ./dist
COPY --from=deps /app/apps/korfbal-stream-api/prisma ./apps/korfbal-stream-api/prisma
COPY package*.json ./
RUN npm ci --omit=dev

EXPOSE 3333
ENV PORT=3333
# Start via startup script that runs migrate+seed and then starts the server
CMD ["node", "dist/apps/korfbal-stream-api/src/start.js"]
