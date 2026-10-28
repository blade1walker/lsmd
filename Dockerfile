# The LSMD website as one container. Works on any host that builds a
# Dockerfile — Railway, Render, Fly.io, Koyeb, DigitalOcean App Platform, or
# any server with Docker (see deploy/docker/compose.yml). Settings come from the
# host's environment variables when the container starts, not at build time —
# see deploy/README.md for the list.
FROM node:22-bookworm-slim

WORKDIR /app
# Prisma's engines need OpenSSL; the slim image ships without it.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencies first so they are cached between builds. postinstall runs
# `prisma generate`, which needs the schema and prisma.config.ts (and the file
# it imports); its schema push skips itself here because no database is set.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY src/lib/database-url.ts ./src/lib/database-url.ts
RUN npm ci --no-audit --no-fund --include=dev

COPY . .
# The Prisma client is built lazily, so `next build` needs no database.
RUN npx next build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
# Checks the settings, applies the schema, then serves on $PORT.
CMD ["bash", "deploy/start.sh"]
