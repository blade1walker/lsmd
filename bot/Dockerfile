# Nexus EMS Bot — container image for any Docker host (Railway, Fly.io, a VPS…).
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json tsconfig.json index.js ./
COPY src ./src
RUN npm ci --no-audit --no-fund && npm run build && npm prune --omit=dev && chown -R node:node /app
ENV NODE_ENV=production
USER node
CMD ["node", "index.js"]
