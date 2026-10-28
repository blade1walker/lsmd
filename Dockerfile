# The LSMD website as one container. Works on any host that builds a
# Dockerfile — Railway, Render, Fly.io, Koyeb, DigitalOcean App Platform, or
# any server with Docker (see deploy/docker/compose.yml). Settings come from the
# host's environment variables when the container starts, not at build time —
# see deploy/README.md for the list.
FROM node:22-bookworm-slim

WORKDIR /app
# CA certificates for HTTPS to Discord (and the one-time copy from Neon).
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1
# Many hosts have no IPv6 route: use IPv4, and do not race addresses — the race
# gives each one 250 ms, less than a round trip to a database on another continent.
ENV NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection"

# Dependencies first so they are cached between builds. postinstall runs
# `prisma generate`, which needs the schema and prisma.config.ts (and the file
# it imports).
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
COPY src/lib/paths.ts ./src/lib/paths.ts
RUN npm ci --no-audit --no-fund --include=dev

COPY . .
# The database is opened lazily, so `next build` needs none.
RUN npx next build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
# The database lives in /app/data (DATA_DIR): give it a volume (compose.yml does).
# Checks the settings, gets the database ready, then serves on $PORT.
CMD ["bash", "deploy/start.sh"]
