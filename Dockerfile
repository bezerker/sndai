# syntax=docker/dockerfile:1

ARG NODE_VERSION=24

# Build stage (bundles app with Mastra for target arch)
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime stage (no instrumentation)
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Copy bundled output and src (for memory.db relative path)
COPY --from=builder /app/.mastra /app/.mastra
COPY --from=builder /app/src /app/src

# Ensure native modules match target arch by installing deps in output
RUN cd /app/.mastra/output \
  && npm ci --omit=dev

# Drop privileges
RUN chown -R node:node /app
USER node

# Set working directory so 'file:../../memory.db' -> '/app/memory.db'
WORKDIR /app/src/mastra

# Start the bundled app without instrumentation
CMD ["node", "../../.mastra/output/index.mjs"]
