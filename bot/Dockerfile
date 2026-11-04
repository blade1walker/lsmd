FROM node:20-alpine

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
COPY index.js ./
RUN npm run build
RUN npm prune --omit=dev

ENV NODE_ENV=production
ENV TIMEZONE=Asia/Kolkata

CMD ["node", "index.js"]
