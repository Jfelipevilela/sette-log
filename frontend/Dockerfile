FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.base.json ./
COPY frontend/package*.json ./frontend/
RUN npm install --workspace @sette-log/frontend --include-workspace-root
COPY frontend ./frontend
RUN npm run build --workspace @sette-log/frontend

FROM nginx:1.27-alpine AS runner
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
