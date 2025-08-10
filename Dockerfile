# syntax=docker/dockerfile:1

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-bookworm-slim

WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Environment
ENV NODE_ENV=production

# Non-root
RUN chown -R node:node /app
USER node

# Run: build inside the container for the current arch, then start
CMD ["bash", "-lc", "npm run build && node --import=.mastra/output/instrumentation.mjs .mastra/output/index.mjs"]
