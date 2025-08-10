# syntax=docker/dockerfile:1

ARG NODE_VERSION=24

# Build stage: install deps and bundle with Mastra
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime stage: run the bundled output
FROM node:${NODE_VERSION}-alpine AS runtime

# Environment you will commonly set at runtime
#   MODEL_PROVIDER=openai|ollama (default: openai)
#   OPENAI_API_KEY=... (if MODEL_PROVIDER=openai)
#   OPENAI_BASE_URL=... (optional)
#   OPENAI_MODEL=gpt-4o (optional)
#   OLLAMA_MODEL=llama3.1:latest (if MODEL_PROVIDER=ollama)
#   DISCORD_ENABLED=true|false (enable Discord bot)
#   DISCORD_BOT_TOKEN=... (if Discord enabled)
#   DISCORD_CLIENT_ID=... (if Discord enabled)
#   BRAVE_API_KEY=... (for web search MCP server)
ENV NODE_ENV=production

# Copy only what is needed to run
WORKDIR /app
COPY --from=builder /app/.mastra /app/.mastra
# Keep src path so relative SQLite URL (file:../../memory.db) resolves to /app/memory.db
COPY --from=builder /app/src /app/src

# Ensure non-root runtime and writable app dir (node user exists in base image)
RUN chown -R node:node /app
USER node

# Set working directory so '../../memory.db' -> '/app/memory.db'
WORKDIR /app/src/mastra

# Run the bundled app as recommended by Mastra CLI
CMD ["node", "--import=../../.mastra/output/instrumentation.mjs", "../../.mastra/output/index.mjs"]
