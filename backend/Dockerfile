FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.base.json ./
COPY backend/package*.json ./backend/
RUN npm install --workspace @sette-log/backend --include-workspace-root
COPY backend ./backend
RUN npm run build --workspace @sette-log/backend

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
  && mkdir -p /etc/apt/keyrings \
  && curl -fsSL https://pgp.mongodb.com/server-7.0.asc | gpg --dearmor -o /etc/apt/keyrings/mongodb-server-7.0.gpg \
  && echo "deb [ signed-by=/etc/apt/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" > /etc/apt/sources.list.d/mongodb-org-7.0.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends mongodb-database-tools \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm install --workspace @sette-log/backend --omit=dev --include-workspace-root
COPY --from=builder /app/backend/dist ./backend/dist

WORKDIR /app/backend
EXPOSE 3333
CMD ["node", "dist/main.js"]
