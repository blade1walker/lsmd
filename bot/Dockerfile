# Nexus EMS Bot — container image for any Docker host (Railway, Fly.io, a VPS…).
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json tsconfig.json index.js ./
COPY src ./src
# npm ci runs the postinstall build, so src must already be here.
RUN npm ci && chown -R node:node /app
USER node
CMD ["node", "index.js"]
