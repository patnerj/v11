# WebSocket price fan-out server (ws-server/index.js).
# P1 FIX: build context is the repo root (see docker-compose.yml).
FROM node:20-alpine
WORKDIR /app
COPY 01_SOURCE_CODE/ws-server/package.json 01_SOURCE_CODE/ws-server/package-lock.json* ./
RUN npm ci --omit=dev
COPY 01_SOURCE_CODE/ws-server/index.js ./
ENV NODE_ENV=production
# SECRET_TOKEN is injected at runtime via compose (.env) — never bake it here.
EXPOSE 8080
USER node
CMD ["node", "index.js"]
