# syntax=docker/dockerfile:1

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine AS runtime

WORKDIR /app

# Install only production deps
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Ensure non-root runtime
RUN chown -R node:node /app
USER node

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

## Runtime working directory so that the app's relative
## SQLite path (file:../../memory.db) resolves to /app/memory.db
WORKDIR /app/src/mastra

# Default command runs the TypeScript entry via ts-node ESM loader
CMD ["node", "--loader", "ts-node/esm", "index.ts"]
