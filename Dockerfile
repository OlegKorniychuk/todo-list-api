# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app

# --- deps: full deps (incl. dev) for building ---
FROM base AS deps
COPY package*.json ./
RUN npm ci

# --- build: compile TypeScript -> dist ---
FROM base AS build
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- migrate: one-off drizzle-kit migration runner (needs devDeps + drizzle/ + schema) ---
FROM build AS migrate
CMD ["npm", "run", "db:migrate"]

# --- prod-deps: production-only node_modules ---
FROM base AS prod-deps
COPY package*.json ./
RUN npm ci --omit=dev

# --- runtime: minimal final image ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S app && adduser -S app -G app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

USER app
EXPOSE 3000

CMD ["node", "dist/main.js"]
