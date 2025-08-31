# syntax=docker/dockerfile:1.6

ARG NODE_VERSION=24

# Build stage: bundle the app with Mastra
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime stage: minimal image that runs the built agent
FROM --platform=$TARGETPLATFORM node:${NODE_VERSION}-bookworm-slim AS runtime
ARG TARGETPLATFORM
ARG TARGETARCH
ENV NODE_ENV=production
WORKDIR /app

# Install root production dependencies (includes @mastra/fastembed)
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN set -eux; \
  npm ci --omit=dev; \
  npm cache clean --force

# Copy bundled output and src (src kept so relative db path resolves)
COPY --from=builder /app/.mastra /app/.mastra
COPY --from=builder /app/src /app/src

# Install production deps for the built output (telemetry/instrumentation deps)
RUN set -eux; \
  cd /app/.mastra/output; \
  npm ci --omit=dev; \
  npm cache clean --force

# Drop privileges
RUN chown -R node:node /app
USER node

# Ensure the working dir matches code's relative db path 'file:../../memory.db'
WORKDIR /app/src/mastra

# Start the bundled app
CMD ["node", "../../.mastra/output/index.mjs"]
