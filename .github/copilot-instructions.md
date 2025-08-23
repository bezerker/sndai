# sndai - WoW Character Gear Agent

**ALWAYS follow these instructions first and only fallback to additional search and context gathering if the information in these instructions is incomplete or found to be in error.**

sndai is a Node.js/TypeScript WoW Character Gear Agent built with the Mastra framework. It provides character lookups, gear recommendations, Discord bot integration, and an advanced memory system for remembering user preferences across conversations.

## Working Effectively

### Bootstrap and Build the Repository

**CRITICAL TIMING REQUIREMENTS:**
- **NEVER CANCEL builds or long-running commands**
- Build takes ~67 seconds - **ALWAYS set timeout to 120+ seconds minimum**
- Tests take ~4 seconds - **ALWAYS set timeout to 30+ seconds minimum**
- Docker build takes ~2.5 minutes - **ALWAYS set timeout to 300+ seconds minimum**

1. **Install dependencies:**
   ```bash
   npm install
   ```
   Takes ~22 seconds. If this fails due to network issues, retry 2-3 times.

2. **Build the application:**
   ```bash
   npm run build
   ```
   **CRITICAL:** Takes ~67 seconds. **NEVER CANCEL**. Set timeout to 120+ seconds.
   Creates bundled output in `.mastra/output/` directory.

3. **Run tests to validate functionality:**
   ```bash
   npm test
   ```
   Takes ~4 seconds. All 28 tests should pass. Set timeout to 30+ seconds.

### Development and Testing

4. **Run development server:**
   ```bash
   npm run dev
   ```
   **Requires environment variables** (see Configuration section below).
   Starts server on http://localhost:4111 with playground at http://localhost:4111.
   **Takes ~5-10 seconds to start**. Wait for "Playground available" message.

5. **Run built application:**
   ```bash
   node --import=./.mastra/output/instrumentation.mjs .mastra/output/index.mjs
   ```
   **Requires environment variables**. Runs the production build.

6. **Run memory-specific tests:**
   ```bash
   npm run test:memory
   ```
   Takes <1 second. Tests the enhanced memory system functionality.

### Docker Support

7. **Build Docker image:**
   ```bash
   docker build -t sndai .
   ```
   **CRITICAL:** Takes ~2.5 minutes. **NEVER CANCEL**. Set timeout to 300+ seconds minimum.
   Uses multi-stage build with Node.js 24.

## Configuration

### Required Environment Variables

**For basic functionality, you MUST set these variables:**

```bash
# Model provider (choose one)
MODEL_PROVIDER=openai  # or "ollama"

# For OpenAI (recommended)
OPENAI_API_KEY=sk-your-real-api-key
OPENAI_MODEL=gpt-4o
OPENAI_BASE_URL=https://api.openai.com/v1  # optional

# For Ollama (alternative)
OLLAMA_MODEL=llama3.1:latest

# Blizzard API (required for character lookups)
BLIZZARD_CLIENT_ID=your-blizzard-client-id
BLIZZARD_CLIENT_SECRET=your-blizzard-client-secret

# Brave API (required for web search - cannot be empty)
BRAVE_API_KEY=BSA-your-brave-api-key
```

**CRITICAL:** The BRAVE_API_KEY cannot be empty or the application will fail to start with "Connection closed" errors.

### Optional Configuration

```bash
# Discord bot (optional)
DISCORD_ENABLED=true  # set to "false" to disable
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_TEMPERATURE=0.5  # optional

# Agent behavior
AGENT_MAX_STEPS=50  # optional, limits execution steps
MEMORY_MAX_MESSAGES=40  # optional, recent messages in context

# Memory system (all optional, defaults work well)
MEMORY_SEMANTIC_RECALL_ENABLED=true
MEMORY_WORKING_MEMORY_ENABLED=true
MEMORY_SEMANTIC_RECALL_TOP_K=5
MEMORY_SEMANTIC_RECALL_MESSAGE_RANGE=3
MEMORY_SEMANTIC_RECALL_SCOPE=resource  # or "thread"
MEMORY_WORKING_MEMORY_SCOPE=resource  # or "thread"
```

### For Testing/Development Only

If you need to test without real API keys, create `.env.test`:
```bash
MODEL_PROVIDER=openai
OPENAI_API_KEY=sk-dummy-test-key-not-real
BLIZZARD_CLIENT_ID=dummy_client_id
BLIZZARD_CLIENT_SECRET=dummy_client_secret
BRAVE_API_KEY=BSA-dummy-test-key-12345
DISCORD_ENABLED=false
```

Then run: `export $(cat .env.test | grep -v '^#' | xargs) && npm run dev`

## Validation Scenarios

**ALWAYS perform these validation steps after making changes:**

### Build Timing Validation (from actual testing)
- npm install: ~17-22 seconds
- npm run build: ~55-67 seconds (**NEVER CANCEL** - set 120+ second timeout)
- npm test: ~4 seconds (all 28 tests)
- npm run test:memory: <1 second (12 memory tests)
- npm run dev: ~5-10 seconds to start
- Docker build: ~2.5 minutes (**NEVER CANCEL** - set 300+ second timeout)

### 1. Basic Build Validation
```bash
npm install && npm run build && npm test
```
**Expected:** All commands succeed, tests pass.

### 2. Development Server Validation
Start the dev server and verify:
- Server starts without errors
- Logs show "Playground available at http://localhost:4111"
- Brave Search MCP Server is running
- No connection errors in logs

### 3. Memory System Validation
```bash
npm run test:memory
```
**Expected:** All 12 memory tests pass, SQLite database files created (memory.db*).

### 4. Application Functionality Test
**MANUAL TESTING REQUIRED:** After starting the application, test:
- Access the playground at http://localhost:4111
- Try a basic WoW character lookup query in the playground
- Verify Discord bot responds (if enabled)
- Check that memory.db files are created and updated (memory.db, memory.db-shm, memory.db-wal)
- Verify logs show "Brave Search MCP Server running on stdio"

### 5. Complete Validation Command Chain
```bash
# Full validation pipeline
npm install && npm run build && npm test && npm run test:memory
```
**Expected:** All commands succeed, all 28+12 tests pass, memory database files created.

## Project Structure

### Key Directories
- `src/mastra/` - Main application code
  - `agents/` - WoW Character Gear Agent implementation
  - `tools/` - Character lookup, BiS scraper, web search tools
  - `adapters/` - Discord bot integration
  - `storage.ts` - Memory database configuration
  - `mcp.ts` - MCP (Model Context Protocol) server configuration
  - `index.ts` - Main application entry point

### Important Files
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `Dockerfile` - Multi-stage Docker build
- `README.md` - Detailed project documentation
- `MEMORY_CONFIGURATION.md` - Comprehensive memory system guide
- `charts/sndai/` - Helm charts for Kubernetes deployment

### Build Artifacts (DO NOT COMMIT)
- `.mastra/output/` - Built application bundle (created by `npm run build`)
- `memory.db*` - SQLite database files for memory system (runtime generated)
- `node_modules/` - Dependencies (excluded by .gitignore)
- `.env.test` - Test environment file (should not be committed)

## Common Tasks and Commands

### Always run these validation commands before committing:
```bash
npm test          # Run full test suite
npm run build     # Verify build works
```

**No linting commands are configured** - the project doesn't use ESLint/Prettier.

### Memory system debugging:
```bash
npm run test:memory  # Test memory functionality
```

### Docker operations:
```bash
docker build -t sndai .                    # Build image
docker run -e MODEL_PROVIDER=openai sndai  # Run container
```

## Troubleshooting

### Build Issues
- **"npm install fails":** Retry 2-3 times, check network connectivity
- **"Build times out":** **NEVER CANCEL** - always set timeout to 120+ seconds
- **"MCP connection fails":** Ensure BRAVE_API_KEY is set to valid value

### Runtime Issues
- **"Discord bot not responding":** Check DISCORD_ENABLED=true and valid tokens
- **"Memory not working":** Verify database permissions, check memory.db file creation
- **"Character lookup fails":** Verify BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET

### Environment Variable Issues
- **Missing variables:** Application will fail to start - check all required variables are set
- **Invalid API keys:** Use dummy values for testing, real values for production

## Critical Reminders

1. **NEVER CANCEL long-running builds** - they may take 2+ minutes
2. **ALWAYS set appropriate timeouts** - 120s for builds, 300s for Docker
3. **ALWAYS validate functionality** after changes using the validation scenarios
4. **Environment variables are required** - application will not start without proper config
5. **Memory database persists data** - memory.db files store conversation history
6. **Tests use mocks** - they don't require real API keys to pass
7. **DO NOT commit build artifacts** - exclude .mastra/, memory.db*, .env.test files
8. **Test environment file available** - use .env.test with dummy values for development testing