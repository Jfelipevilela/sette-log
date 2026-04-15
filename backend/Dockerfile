FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.base.json ./
COPY backend/package*.json ./backend/
RUN npm install --workspace @sette-log/backend --include-workspace-root
COPY backend ./backend
RUN npm run build --workspace @sette-log/backend

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm install --workspace @sette-log/backend --omit=dev --include-workspace-root
COPY --from=builder /app/backend/dist ./backend/dist
WORKDIR /app/backend
EXPOSE 3333
CMD ["node", "dist/main.js"]
